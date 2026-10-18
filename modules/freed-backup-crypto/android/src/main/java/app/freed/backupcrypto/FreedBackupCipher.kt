package app.freed.backupcrypto

import java.security.NoSuchAlgorithmException
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

internal object FreedBackupCipher {
  private const val ITERATIONS = 210_000
  const val MAX_PLAINTEXT_BYTES = 2 * 1024 * 1024

  fun randomBytes(count: Int): ByteArray {
    require(count == 16 || count == 12) { "Invalid backup random byte count" }
    return ByteArray(count).also { SecureRandom().nextBytes(it) }
  }

  fun encrypt(passphrase: String, salt: ByteArray, iv: ByteArray, plaintext: ByteArray): ByteArray {
    require(salt.size == 16 && iv.size == 12 && plaintext.size <= MAX_PLAINTEXT_BYTES) { "Invalid backup parameters" }
    return crypt(Cipher.ENCRYPT_MODE, passphrase, salt, iv, plaintext)
  }

  fun decrypt(passphrase: String, salt: ByteArray, iv: ByteArray, payload: ByteArray): ByteArray {
    require(salt.size == 16 && iv.size == 12 && payload.size in 16..MAX_PLAINTEXT_BYTES + 16) { "Invalid backup parameters" }
    return crypt(Cipher.DECRYPT_MODE, passphrase, salt, iv, payload)
  }

  private fun crypt(mode: Int, passphrase: String, salt: ByteArray, iv: ByteArray, input: ByteArray): ByteArray {
    val key = deriveKey(passphrase, salt)
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(mode, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv))
      // JCA returns ciphertext || the 16-byte authentication tag.
      return cipher.doFinal(input)
    } finally {
      key.fill(0)
    }
  }

  private fun deriveKey(passphrase: String, salt: ByteArray): ByteArray {
    val password = passphrase.toCharArray()
    val spec = PBEKeySpec(password, salt, ITERATIONS, 256)
    try {
      return try {
        SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
      } catch (_: NoSuchAlgorithmException) {
        // Android API 24/25 lacks this SecretKeyFactory algorithm. Use platform HMAC
        // for RFC 8018 PBKDF2's single SHA-256 block; never fall back to SHA-1.
        deriveWithPlatformHmac(passphrase, salt)
      }
    } finally {
      spec.clearPassword()
      password.fill('\u0000')
    }
  }

  private fun deriveWithPlatformHmac(passphrase: String, salt: ByteArray): ByteArray {
    val password = passphrase.toByteArray(Charsets.UTF_8)
    val mac = Mac.getInstance("HmacSHA256")
    try {
      mac.init(SecretKeySpec(password, "HmacSHA256"))
    } finally {
      password.fill(0)
    }
    // INT_32_BE(1), since the requested 32-byte key needs exactly one HMAC block.
    var previous = mac.doFinal(salt + byteArrayOf(0, 0, 0, 1))
    val key = previous.copyOf()
    repeat(ITERATIONS - 1) {
      val next = mac.doFinal(previous)
      previous.fill(0)
      previous = next
      for (index in key.indices) key[index] = (key[index].toInt() xor next[index].toInt()).toByte()
    }
    previous.fill(0)
    return key
  }
}
