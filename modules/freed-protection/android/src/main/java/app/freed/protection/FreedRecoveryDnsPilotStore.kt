package app.freed.protection

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.system.Os
import android.system.OsConstants
import android.util.AtomicFile
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileNotFoundException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Device-only DNS namespace. No friend-lock aliases, witness keys, preferences or portable backups. */
internal class FreedRecoveryDnsPilotStore(context: Context) {
  private val directory = File(context.applicationContext.noBackupFilesDir, "freed-recovery-dns-pilot-v1")
  private val file = AtomicFile(File(directory, "candidates.gcm"))
  private val aad = "app.freed.recovery-dns-pilot.aes-gcm.v1:candidates:1".toByteArray(Charsets.UTF_8)
  private fun keyStore() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
  private fun key(create: Boolean): SecretKey {
    val store = keyStore()
    if (store.containsAlias(ALIAS)) return store.getKey(ALIAS, null) as? SecretKey ?: error("recovery-dns-store-unavailable")
    check(create) { "recovery-dns-key-unavailable" }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true).setUserAuthenticationRequired(false).build())
    return generator.generateKey()
  }

  fun read(): FreedRecoveryDnsPilotRecord.State = synchronized(ioLock) {
    val encoded = try {
      file.openRead().use { stream ->
        check(stream.channel.size() <= MAX_ENVELOPE_BYTES)
        stream.readBytes().also { check(it.size <= MAX_ENVELOPE_BYTES) }
      }
    } catch (_: FileNotFoundException) {
      // Never recreate a missing record under a previously created encryption key.
      check(!file.baseFile.exists() && !File(file.baseFile.path + ".bak").exists() && !directory.exists() &&
        !keyStore().containsAlias(ALIAS)) { "recovery-dns-record-missing" }
      return@synchronized FreedRecoveryDnsPilotRecord.State()
    }
    DataInputStream(ByteArrayInputStream(encoded)).use { input ->
      check(input.readInt() == 1 && input.readInt() == 12)
      val iv = ByteArray(12).also(input::readFully)
      val size = input.readInt().also { check(it in 16..MAX_ENVELOPE_BYTES && it == input.available()) }
      val sealed = ByteArray(size).also(input::readFully)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(false), GCMParameterSpec(128, iv)); cipher.updateAAD(aad)
      val clear = cipher.doFinal(sealed)
      try { FreedRecoveryDnsPilotRecord.decode(clear) } finally { clear.fill(0) }
    }
  }

  /** One process-wide transaction; its final owner check runs before the only durable publication. */
  fun stage(candidate: FreedRecoveryDnsPilotPolicy.Candidate, scope: String, stillCurrent: () -> Boolean,
    beforeRenew: (List<FreedRecoveryDnsPilotRecord.Operation>) -> Unit): FreedRecoveryDnsPilotPolicy.Candidate = synchronized(ioLock) {
    val before = read()
    val enrolled = before.candidates.filter { it.sameEnrollment(candidate) }
    check(enrolled.size <= 1) { "recovery-dns-enrollment-identity-ambiguous" }
    val matching = enrolled.singleOrNull()
    if (matching != null) {
      check(stillCurrent()) { "recovery-dns-owner-stale" }
      return@synchronized renew(matching.reference, scope, candidate.ownerIdentityDigest ?: error("recovery-dns-owner-stale"),
        candidate.adultGeneration, stillCurrent, beforeRenew)
    }
    check(before.candidates.size < FreedRecoveryDnsPilotRecord.MAX_CANDIDATES) { "recovery-dns-candidate-capacity" }
    check(stillCurrent()) { "recovery-dns-owner-stale" }
    save(before.copy(candidates = before.candidates + candidate), stillCurrent)
    candidate
  }

  fun renew(reference: String, scope: String, identity: String, generation: String, stillCurrent: () -> Boolean,
    beforeRenew: (List<FreedRecoveryDnsPilotRecord.Operation>) -> Unit): FreedRecoveryDnsPilotPolicy.Candidate = synchronized(ioLock) {
    val before = read()
    val previous = before.candidates.single { it.reference == reference }
    val next = FreedRecoveryDnsPilotRecord.renewBinding(before, reference, scope, identity, generation)
    check(stillCurrent()) { "recovery-dns-owner-stale" }
    if (next !== before) {
      beforeRenew(before.operations.filter { previous.ownerScopeDigest != FreedRecoveryDnsPilotPolicy.digest(scope) &&
        it.reference == reference && it.ownerScopeDigest == previous.ownerScopeDigest &&
        it.phase in setOf("prepared", "authorized") })
      check(stillCurrent()) { "recovery-dns-owner-stale" }
      save(next, stillCurrent)
    }
    next.candidates.single { it.reference == reference }
  }

  fun update(operation: (FreedRecoveryDnsPilotRecord.State) -> FreedRecoveryDnsPilotRecord.State): FreedRecoveryDnsPilotRecord.State = synchronized(ioLock) {
    val next = operation(read())
    save(next)
    next
  }

  private fun save(state: FreedRecoveryDnsPilotRecord.State, stillCurrent: () -> Boolean = { true }) {
    val existed = file.baseFile.exists() || keyStore().containsAlias(ALIAS)
    val clear = FreedRecoveryDnsPilotRecord.encode(state)
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key(create = !existed)); cipher.updateAAD(aad)
      val sealed = cipher.doFinal(clear)
      check(cipher.iv.size == 12 && sealed.size == clear.size + 16)
      val encoded = ByteArrayOutputStream().also { buffer ->
        DataOutputStream(buffer).use { output ->
          output.writeInt(1); output.writeInt(12); output.write(cipher.iv)
          output.writeInt(sealed.size); output.write(sealed)
        }
      }.toByteArray()
      check(directory.isDirectory || directory.mkdirs()) { "recovery-dns-store-unavailable" }
      check(stillCurrent()) { "recovery-dns-owner-stale" }
      val output = file.startWrite()
      try {
        output.write(encoded); output.fd.sync(); file.finishWrite(output)
        val descriptor = Os.open(directory.absolutePath, OsConstants.O_RDONLY, 0)
        try { Os.fsync(descriptor) } finally { Os.close(descriptor) }
        check(FreedRecoveryDnsPilotRecord.encode(read()).contentEquals(clear)) { "recovery-dns-readback-unavailable" }
      } catch (failure: Exception) { file.failWrite(output); throw failure }
      check(stillCurrent()) { "recovery-dns-owner-stale" }
    } finally { clear.fill(0) }
  }

  private companion object {
    const val ALIAS = "app.freed.recovery-dns-pilot.aes-gcm.v1"
    const val MAX_ENVELOPE_BYTES = FreedRecoveryDnsPilotPolicy.MAX_RECORD_BYTES + 64
    val ioLock = Any()
  }
}
