import Dispatch
import ExpoModulesCore
import Foundation

// A dedicated serial background queue bounds concurrent KDF work and avoids UI stalls.
private let backupCryptoQueue = DispatchQueue(label: "app.freed.backupcrypto", qos: .userInitiated)

public final class FreedBackupCryptoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FreedBackupCrypto")

    AsyncFunction("randomBase64") { (count: Int) -> String in
      try FreedBackupCipher.randomBytes(count: count).base64EncodedString()
    }.runOnQueue(backupCryptoQueue)

    AsyncFunction("encrypt") { (passphrase: String, salt: String, iv: String, plaintext: String) -> String in
      guard plaintext.utf8.count <= FreedBackupCipher.maxPlaintextBytes else {
        throw FreedBackupCipher.Failure.invalidParameters
      }
      let saltBytes = try decodeBase64(salt, minimum: 16, maximum: 16)
      let ivBytes = try decodeBase64(iv, minimum: 12, maximum: 12)
      return try FreedBackupCipher.encrypt(
        passphrase: passphrase, salt: saltBytes, iv: ivBytes, plaintext: Data(plaintext.utf8)
      ).base64EncodedString()
    }.runOnQueue(backupCryptoQueue)

    AsyncFunction("decrypt") { (passphrase: String, salt: String, iv: String, payload: String) -> String in
      let saltBytes = try decodeBase64(salt, minimum: 16, maximum: 16)
      let ivBytes = try decodeBase64(iv, minimum: 12, maximum: 12)
      let ciphertext = try decodeBase64(payload, minimum: 16, maximum: FreedBackupCipher.maxPlaintextBytes + 16)
      let plaintext = try FreedBackupCipher.decrypt(passphrase: passphrase, salt: saltBytes, iv: ivBytes, payload: ciphertext)
      guard let text = String(data: plaintext, encoding: .utf8) else { throw FreedBackupCipher.Failure.invalidText }
      return text
    }.runOnQueue(backupCryptoQueue)
  }
}

private func decodeBase64(_ encoded: String, minimum: Int, maximum: Int) throws -> Data {
  guard encoded.utf8.count <= ((maximum + 2) / 3) * 4,
        let bytes = Data(base64Encoded: encoded), bytes.count >= minimum, bytes.count <= maximum,
        bytes.base64EncodedString() == encoded else { throw FreedBackupCipher.Failure.invalidParameters }
  return bytes
}
