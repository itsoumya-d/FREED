package app.freed.protection

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream

internal interface FriendLockAtomicBytes {
    fun begin()
    fun end()
    fun read(key: String): ByteArray?
    fun write(key: String, value: ByteArray)
    fun remove(key: String)
}
internal class FriendLockSealedBytes(val iv: ByteArray, val ciphertext: ByteArray)
internal interface FriendLockCipherBoundary {
    fun keyExists(): Boolean
    fun encrypt(value: ByteArray, aad: ByteArray, create: Boolean): FriendLockSealedBytes
    fun decrypt(value: FriendLockSealedBytes, aad: ByteArray): ByteArray
}
// Production envelope and AAD validation are exercised with JVM AES-GCM plus injected file/key I/O.
internal class FriendLockEncryptedBytes(private val atomic: FriendLockAtomicBytes, private val cipher: FriendLockCipherBoundary) : FriendLockProtectedBytes {
    companion object { const val MAX_ENCRYPTED_BYTES = FriendLockRecordCodec.MAX_JOURNAL_BYTES + 128 }
    private fun validate(key: String) { if (key !in setOf("witness", "record", "journal")) fail(FriendLockError.INVALID_SCOPE) }
    private fun aad(key: String) = "app.freed.device-adult.friend-lock.aes-gcm.v1:$key:1".toByteArray(Charsets.UTF_8)
    override fun beginAccess() = atomic.begin()
    override fun endAccess() = atomic.end()
    override fun read(key: String): ByteArray? {
        validate(key)
        val encoded = atomic.read(key)
        if (encoded == null) {
            if (key == "witness" && cipher.keyExists()) fail(FriendLockError.MISSING_ENROLLED)
            return null
        }
        if (encoded.size > MAX_ENCRYPTED_BYTES) fail(FriendLockError.CORRUPT)
        return try {
            DataInputStream(ByteArrayInputStream(encoded)).use { input ->
                if (input.readInt() != 1 || input.readInt() != 12) fail(FriendLockError.CORRUPT)
                val iv = ByteArray(12).also { input.readFully(it) }; val count = input.readInt()
                if (count < 16 || count > MAX_ENCRYPTED_BYTES || count != input.available()) fail(FriendLockError.CORRUPT)
                val ciphertext = ByteArray(count).also { input.readFully(it) }
                cipher.decrypt(FriendLockSealedBytes(iv, ciphertext), aad(key)).also {
                    if (it.size > FriendLockRecordCodec.MAX_JOURNAL_BYTES) fail(FriendLockError.CORRUPT)
                }
            }
        } catch (failure: FriendLockException) { throw failure }
        catch (_: java.io.IOException) { fail(FriendLockError.CORRUPT) }
        catch (_: Exception) { fail(FriendLockError.STORAGE_UNAVAILABLE) }
    }
    override fun write(key: String, value: ByteArray) {
        validate(key)
        if (value.size > FriendLockRecordCodec.MAX_JOURNAL_BYTES) fail(FriendLockError.CORRUPT)
        val sealed = cipher.encrypt(value, aad(key), create = key == "witness")
        if (sealed.iv.size != 12 || sealed.ciphertext.size != value.size + 16) fail(FriendLockError.CRYPTO_UNAVAILABLE)
        val buffer = ByteArrayOutputStream()
        DataOutputStream(buffer).use { out -> out.writeInt(1); out.writeInt(sealed.iv.size); out.write(sealed.iv); out.writeInt(sealed.ciphertext.size); out.write(sealed.ciphertext) }
        atomic.write(key, buffer.toByteArray())
    }
    override fun remove(key: String) {
        validate(key); if (key == "witness") fail(FriendLockError.INVALID_SCOPE)
        atomic.remove(key)
    }
}
