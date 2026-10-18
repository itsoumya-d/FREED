package app.freed.backupcrypto

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

class FreedBackupCryptoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FreedBackupCrypto")

    // Expo AsyncFunction runs on its serial background modules queue, never the UI thread.
    AsyncFunction("randomBase64") { count: Int ->
      Base64.encodeToString(FreedBackupCipher.randomBytes(count), Base64.NO_WRAP)
    }

    AsyncFunction("encrypt") { passphrase: String, salt: String, iv: String, plaintext: String ->
      require(plaintext.length <= FreedBackupCipher.MAX_PLAINTEXT_BYTES) { "Invalid backup payload size" }
      val saltBytes = decodeBase64(salt, 16, 16)
      val ivBytes = decodeBase64(iv, 12, 12)
      val payload = FreedBackupCipher.encrypt(passphrase, saltBytes, ivBytes, plaintext.toByteArray(Charsets.UTF_8))
      Base64.encodeToString(payload, Base64.NO_WRAP)
    }

    AsyncFunction("decrypt") { passphrase: String, salt: String, iv: String, payload: String ->
      val saltBytes = decodeBase64(salt, 16, 16)
      val ivBytes = decodeBase64(iv, 12, 12)
      val ciphertext = decodeBase64(payload, 16, FreedBackupCipher.MAX_PLAINTEXT_BYTES + 16)
      val plaintext = FreedBackupCipher.decrypt(passphrase, saltBytes, ivBytes, ciphertext)
      Charsets.UTF_8.newDecoder()
        .onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT)
        .decode(ByteBuffer.wrap(plaintext)).toString()
    }
  }

  private fun decodeBase64(encoded: String, minimum: Int, maximum: Int): ByteArray {
    require(encoded.length <= ((maximum + 2) / 3) * 4) { "Invalid backup payload size" }
    val bytes = Base64.decode(encoded, Base64.NO_WRAP)
    require(bytes.size in minimum..maximum && Base64.encodeToString(bytes, Base64.NO_WRAP) == encoded) { "Invalid backup parameters" }
    return bytes
  }
}
