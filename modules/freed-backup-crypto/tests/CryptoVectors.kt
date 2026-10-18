package app.freed.backupcrypto

import java.util.Base64
import java.security.NoSuchAlgorithmException
import java.security.Provider
import java.security.Security

fun main() {
  val salt = ByteArray(16) { it.toByte() }
  val iv = ByteArray(12) { (it + 16).toByte() }
  val vectors = listOf(
    Triple("correct horse battery staple", "FREED backup v1", "X73wvPSyCPik6JmupXandIsbc6SidWAZwLpHUCzskA=="),
    Triple("pässword 🔐\u0000 trail ", "FREED backup 🚀", "31btXu3Kc0qpBo4g1TXTPXFu17QTjitnK6kA8TwkhJzO"),
    Triple("  whitespace password  ", "", "DDNodavCps+OgvaYTIIC/w==")
  )
  fun checkVectors() {
    for ((password, plaintext, expected) in vectors) {
      val encrypted = FreedBackupCipher.encrypt(password, salt, iv, plaintext.toByteArray(Charsets.UTF_8))
      check(Base64.getEncoder().encodeToString(encrypted) == expected) { "Kotlin v1 encryption mismatch" }
      check(FreedBackupCipher.decrypt(password, salt, iv, encrypted).contentEquals(plaintext.toByteArray(Charsets.UTF_8)))
      expectRejection { FreedBackupCipher.decrypt("wrong password", salt, iv, encrypted) }
      val tampered = encrypted.copyOf()
      tampered[tampered.lastIndex] = (tampered.last().toInt() xor 1).toByte()
      expectRejection { FreedBackupCipher.decrypt(password, salt, iv, tampered) }
    }
  }
  checkVectors()
  // Simulate API 24/25's absent SHA-256 factory while retaining platform HMAC/AES.
  val provider = Security.getProvider("SunJCE")
  val legacyProvider = object : Provider("LegacyCryptoFixture", "1.0", "API 24/25 factory availability") {
    init {
      for (service in provider.services.filter { it.type == "Mac" || it.type == "Cipher" }) {
        putService(Service(this, service.type, service.algorithm, service.className, emptyList(), emptyMap()))
      }
    }
  }
  Security.removeProvider(provider.name)
  Security.addProvider(legacyProvider)
  try {
    var unavailable = false
    try { javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256") } catch (_: NoSuchAlgorithmException) { unavailable = true }
    check(unavailable) { "Fallback fixture failed to remove the PBKDF2 factory" }
    checkVectors()
  } finally {
    Security.removeProvider(legacyProvider.name)
    Security.addProvider(provider)
  }
  expectRejection { FreedBackupCipher.encrypt("password", byteArrayOf(), iv, byteArrayOf()) }
  expectRejection { FreedBackupCipher.decrypt("password", salt, iv, ByteArray(15)) }
  expectRejection { FreedBackupCipher.encrypt("password", salt, iv, ByteArray(2 * 1024 * 1024 + 1)) }
  expectRejection { FreedBackupCipher.decrypt("password", salt, iv, ByteArray(2 * 1024 * 1024 + 17)) }
  expectRejection { FreedBackupCipher.randomBytes(17) }
  check(FreedBackupCipher.randomBytes(16).size == 16)
  check(FreedBackupCipher.randomBytes(12).size == 12)
  println("Kotlin backup crypto vectors and rejection checks passed")
}

private fun expectRejection(operation: () -> Unit) {
  try { operation() } catch (_: Exception) { return }
  error("Invalid input or unauthenticated ciphertext was accepted")
}
