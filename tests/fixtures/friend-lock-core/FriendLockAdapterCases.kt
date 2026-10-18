package app.freed.protection

import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

private class FixtureAtomicBytes : FriendLockAtomicBytes {
    val values = mutableMapOf<String, ByteArray>()
    var failWrite = false
    override fun begin() {}
    override fun end() {}
    override fun read(key: String) = values[key]?.clone()
    override fun write(key: String, value: ByteArray) {
        if (failWrite) fail(FriendLockError.STORAGE_UNAVAILABLE)
        values[key] = value.clone()
    }
    override fun remove(key: String) { values.remove(key) }
}
private class FixtureCipher : FriendLockCipherBoundary {
    private val key = SecretKeySpec(ByteArray(32) { (it + 1).toByte() }, "AES")
    var exists = false
    var unavailable = false
    override fun keyExists(): Boolean { if (unavailable) fail(FriendLockError.STORAGE_UNAVAILABLE); return exists }
    override fun encrypt(value: ByteArray, aad: ByteArray, create: Boolean): FriendLockSealedBytes {
        if (unavailable) fail(FriendLockError.STORAGE_UNAVAILABLE)
        if (!exists && !create) fail(FriendLockError.MISSING_ENROLLED)
        exists = true
        val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key); cipher.updateAAD(aad)
        return FriendLockSealedBytes(cipher.iv, cipher.doFinal(value))
    }
    override fun decrypt(value: FriendLockSealedBytes, aad: ByteArray): ByteArray {
        if (unavailable) fail(FriendLockError.STORAGE_UNAVAILABLE)
        if (!exists) fail(FriendLockError.MISSING_ENROLLED)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, value.iv)); cipher.updateAAD(aad)
        return try { cipher.doFinal(value.ciphertext) } catch (_: javax.crypto.AEADBadTagException) { fail(FriendLockError.CORRUPT) }
    }
}
internal fun friendLockAdapterCases() {
    val atomic = FixtureAtomicBytes(); val cipher = FixtureCipher(); val adapter = FriendLockEncryptedBytes(atomic, cipher)
    adapter.write("witness", byteArrayOf(1)); adapter.write("record", "protected-verifier".toByteArray())
    check(adapter.read("record")!!.contentEquals("protected-verifier".toByteArray()))
    check(!atomic.values.getValue("record").toString(Charsets.ISO_8859_1).contains("protected-verifier"))
    // AAD binding prevents swapping encrypted items between names.
    atomic.values["journal"] = atomic.values.getValue("record")
    rejectsAdapter(FriendLockError.CORRUPT) { adapter.read("journal") }
    val original = atomic.values.getValue("record").clone()
    atomic.values["record"] = original.clone().also { it[it.lastIndex] = (it.last().toInt() xor 1).toByte() }
    rejectsAdapter(FriendLockError.CORRUPT) { adapter.read("record") }
    atomic.values["record"] = original
    cipher.unavailable = true
    rejectsAdapter(FriendLockError.STORAGE_UNAVAILABLE) { adapter.read("record") }
    cipher.unavailable = false; atomic.failWrite = true
    rejectsAdapter(FriendLockError.STORAGE_UNAVAILABLE) { adapter.write("record", "new-record".toByteArray()) }
    check(adapter.read("record")!!.contentEquals("protected-verifier".toByteArray()))
    atomic.values.remove("witness")
    rejectsAdapter(FriendLockError.MISSING_ENROLLED) { adapter.read("witness") }
    rejectsAdapter(FriendLockError.INVALID_SCOPE) { adapter.remove("witness") }
}
private fun rejectsAdapter(reason: FriendLockError, operation: () -> Unit) {
    try { operation(); error("Expected $reason") } catch (failure: FriendLockException) { check(failure.reason == reason) }
}
