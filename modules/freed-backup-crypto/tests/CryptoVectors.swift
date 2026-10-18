import Foundation

@main
struct CryptoVectors {
  static func main() throws {
    let salt = Data((0..<16).map(UInt8.init))
    let iv = Data((16..<28).map(UInt8.init))
    let vectors = [
      ("correct horse battery staple", "FREED backup v1", "X73wvPSyCPik6JmupXandIsbc6SidWAZwLpHUCzskA=="),
      ("pässword 🔐\0 trail ", "FREED backup 🚀", "31btXu3Kc0qpBo4g1TXTPXFu17QTjitnK6kA8TwkhJzO"),
      ("  whitespace password  ", "", "DDNodavCps+OgvaYTIIC/w==")
    ]
    for (password, plaintext, expected) in vectors {
      let encrypted = try FreedBackupCipher.encrypt(passphrase: password, salt: salt, iv: iv, plaintext: Data(plaintext.utf8))
      precondition(encrypted.base64EncodedString() == expected, "Swift v1 encryption mismatch")
      let decrypted = try FreedBackupCipher.decrypt(passphrase: password, salt: salt, iv: iv, payload: encrypted)
      precondition(decrypted == Data(plaintext.utf8), "Swift v1 decryption mismatch")
      expectRejection { _ = try FreedBackupCipher.decrypt(passphrase: "wrong password", salt: salt, iv: iv, payload: encrypted) }
      var tampered = encrypted
      tampered[tampered.count - 1] ^= 1
      expectRejection { _ = try FreedBackupCipher.decrypt(passphrase: password, salt: salt, iv: iv, payload: tampered) }
    }
    expectRejection { _ = try FreedBackupCipher.encrypt(passphrase: "password", salt: Data(), iv: iv, plaintext: Data()) }
    expectRejection { _ = try FreedBackupCipher.decrypt(passphrase: "password", salt: salt, iv: iv, payload: Data(repeating: 0, count: 15)) }
    expectRejection { _ = try FreedBackupCipher.encrypt(passphrase: "password", salt: salt, iv: iv, plaintext: Data(repeating: 0, count: 2 * 1024 * 1024 + 1)) }
    expectRejection { _ = try FreedBackupCipher.decrypt(passphrase: "password", salt: salt, iv: iv, payload: Data(repeating: 0, count: 2 * 1024 * 1024 + 17)) }
    expectRejection { _ = try FreedBackupCipher.randomBytes(count: 17) }
    let randomSalt = try FreedBackupCipher.randomBytes(count: 16)
    let randomIv = try FreedBackupCipher.randomBytes(count: 12)
    precondition(randomSalt.count == 16)
    precondition(randomIv.count == 12)
    print("Swift backup crypto vectors and rejection checks passed")
  }

  static func expectRejection(_ operation: () throws -> Void) {
    do { try operation() } catch { return }
    preconditionFailure("Invalid input or unauthenticated ciphertext was accepted")
  }
}
