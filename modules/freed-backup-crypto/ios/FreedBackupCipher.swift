import CommonCrypto
import CryptoKit
import Foundation
import Security

enum FreedBackupCipher {
  static let iterations = 210_000
  static let maxPlaintextBytes = 2 * 1024 * 1024

  enum Failure: Error {
    case invalidParameters
    case derivationFailed
    case randomnessFailed
    case invalidText
  }

  static func randomBytes(count: Int) throws -> Data {
    guard count == 16 || count == 12 else { throw Failure.invalidParameters }
    var bytes = Data(count: count)
    let status = bytes.withUnsafeMutableBytes { buffer in
      SecRandomCopyBytes(kSecRandomDefault, count, buffer.baseAddress!)
    }
    guard status == errSecSuccess else { throw Failure.randomnessFailed }
    return bytes
  }

  static func encrypt(passphrase: String, salt: Data, iv: Data, plaintext: Data) throws -> Data {
    guard salt.count == 16, iv.count == 12, plaintext.count <= maxPlaintextBytes else {
      throw Failure.invalidParameters
    }
    let key = try deriveKey(passphrase: passphrase, salt: salt)
    let sealed = try AES.GCM.seal(plaintext, using: key, nonce: AES.GCM.Nonce(data: iv))
    // CryptoKit's `combined` also contains the nonce. V1 stores only ciphertext || tag.
    return sealed.ciphertext + sealed.tag
  }

  static func decrypt(passphrase: String, salt: Data, iv: Data, payload: Data) throws -> Data {
    guard salt.count == 16, iv.count == 12, payload.count >= 16,
          payload.count <= maxPlaintextBytes + 16 else { throw Failure.invalidParameters }
    let key = try deriveKey(passphrase: passphrase, salt: salt)
    let sealed = try AES.GCM.SealedBox(
      nonce: AES.GCM.Nonce(data: iv),
      ciphertext: payload.dropLast(16),
      tag: payload.suffix(16)
    )
    return try AES.GCM.open(sealed, using: key)
  }

  private static func deriveKey(passphrase: String, salt: Data) throws -> SymmetricKey {
    var password = Data(passphrase.utf8)
    var key = Data(count: 32)
    defer {
      password.resetBytes(in: 0..<password.count)
      key.resetBytes(in: 0..<key.count)
    }
    // Explicit byte length preserves Unicode, embedded NULs and significant whitespace.
    let status = password.withUnsafeBytes { passwordBuffer in
      salt.withUnsafeBytes { saltBuffer in
        key.withUnsafeMutableBytes { keyBuffer in
          CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2),
            passwordBuffer.baseAddress?.assumingMemoryBound(to: Int8.self), passwordBuffer.count,
            saltBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self), saltBuffer.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(iterations),
            keyBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self), keyBuffer.count
          )
        }
      }
    }
    guard status == kCCSuccess else { throw Failure.derivationFailed }
    return SymmetricKey(data: key)
  }
}
