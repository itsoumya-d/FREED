package app.freed.protection

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.AtomicFile
import android.system.Os
import android.system.OsConstants
import java.io.File
import java.io.FileNotFoundException
import java.io.RandomAccessFile
import java.nio.channels.FileLock
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Dedicated, device-level no-backup namespace. No account/private/reset/export coupling.
internal class FriendLockKeystoreBytes(context: Context) : FriendLockProtectedBytes by FriendLockEncryptedBytes(
    FriendLockAndroidAtomicBytes(context), FriendLockAndroidCipher()
)
internal class FriendLockAndroidAtomicBytes(context: Context) : FriendLockAtomicBytes {
    private val directory = File(context.applicationContext.noBackupFilesDir, "freed-device-adult-security-v1")
    private var accessFile: RandomAccessFile? = null
    private var accessLock: FileLock? = null
    private fun file(key: String): AtomicFile {
        if (key !in setOf("witness", "record", "journal")) fail(FriendLockError.INVALID_SCOPE)
        return AtomicFile(File(directory, "$key.gcm"))
    }
    override fun begin() {
        try {
            if (!directory.exists() && !directory.mkdirs()) fail(FriendLockError.STORAGE_UNAVAILABLE)
            val opened = RandomAccessFile(File(directory, "transaction.lock"), "rw")
            accessFile = opened; accessLock = opened.channel.tryLock() ?: fail(FriendLockError.STORAGE_UNAVAILABLE)
        } catch (_: Exception) { end(); fail(FriendLockError.STORAGE_UNAVAILABLE) }
    }
    override fun end() {
        try { accessLock?.release() } finally { accessLock = null; accessFile?.close(); accessFile = null }
    }
    override fun read(key: String): ByteArray? = try {
        file(key).openRead().use { input ->
            if (input.channel.size() > FriendLockEncryptedBytes.MAX_ENCRYPTED_BYTES) fail(FriendLockError.CORRUPT)
            val bytes = input.readBytes(); if (bytes.size > FriendLockEncryptedBytes.MAX_ENCRYPTED_BYTES) fail(FriendLockError.CORRUPT); bytes
        }
    } catch (_: FileNotFoundException) { null }
    override fun write(key: String, value: ByteArray) {
        val atomic = file(key); val output = atomic.startWrite()
        try {
            output.write(value); output.fd.sync(); atomic.finishWrite(output)
            val descriptor = Os.open(directory.absolutePath, OsConstants.O_RDONLY, 0)
            try {
                if (!OsConstants.S_ISDIR(Os.fstat(descriptor).st_mode)) fail(FriendLockError.STORAGE_UNAVAILABLE)
                Os.fsync(descriptor)
            } finally { Os.close(descriptor) }
        }
        catch (_: Exception) { atomic.failWrite(output); fail(FriendLockError.STORAGE_UNAVAILABLE) }
    }
    override fun remove(key: String) {
        if (key == "witness") fail(FriendLockError.INVALID_SCOPE)
        val atomic = file(key); atomic.delete()
        if (atomic.baseFile.exists() || File(atomic.baseFile.path + ".bak").exists()) fail(FriendLockError.STORAGE_UNAVAILABLE)
    }
}
internal class FriendLockAndroidCipher : FriendLockCipherBoundary {
    private val alias = "app.freed.device-adult.friend-lock.aes-gcm.v1"
    private fun keyStore() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    override fun keyExists() = keyStore().containsAlias(alias)
    private fun encryptionKey(create: Boolean): SecretKey {
        val store = keyStore()
        if (store.containsAlias(alias)) return store.getKey(alias, null) as? SecretKey ?: fail(FriendLockError.STORAGE_UNAVAILABLE)
        if (!create) fail(FriendLockError.MISSING_ENROLLED)
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true).setUserAuthenticationRequired(false).build())
        return generator.generateKey()
    }
    override fun encrypt(value: ByteArray, aad: ByteArray, create: Boolean): FriendLockSealedBytes {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        // Creation is limited to first witness write. Never generate a replacement for unreadable enrollment.
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey(create)); cipher.updateAAD(aad)
        return FriendLockSealedBytes(cipher.iv, cipher.doFinal(value))
    }
    override fun decrypt(value: FriendLockSealedBytes, aad: ByteArray): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(false), GCMParameterSpec(128, value.iv)); cipher.updateAAD(aad)
        return try { cipher.doFinal(value.ciphertext) }
        catch (_: javax.crypto.AEADBadTagException) { fail(FriendLockError.CORRUPT) }
    }
}
