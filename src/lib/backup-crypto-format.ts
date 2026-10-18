// The v1 wire format is shared by WebCrypto, CryptoKit/CommonCrypto and JCA.
export const BACKUP_KDF_ITERATIONS = 210_000;
export const BACKUP_SALT_BYTES = 16;
export const BACKUP_IV_BYTES = 12;
export const BACKUP_TAG_BYTES = 16;
export const MAX_BACKUP_PLAINTEXT_BYTES = 2 * 1024 * 1024;
export const MAX_BACKUP_ENVELOPE_CHARS = 3 * 1024 * 1024;

/** Validate canonical base64 and its decoded size without allocating decoded data. */
export function backupBase64ByteLength(value: string, minimum: number, maximum: number): number {
  const maxChars = Math.ceil(maximum / 3) * 4;
  if (value.length > maxChars || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error("Recovery backup has invalid envelope parameters.");
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // Reject alternate encodings with nonzero unused bits in the last sextet.
  if (padding && (alphabet.indexOf(value[value.length - padding - 1]) & (padding === 2 ? 15 : 3))) {
    throw new Error("Recovery backup has invalid envelope parameters.");
  }
  const bytes = value.length / 4 * 3 - padding;
  if (bytes < minimum || bytes > maximum) {
    throw new Error("Recovery backup has invalid envelope parameters.");
  }
  return bytes;
}

export function validateBackupSaltAndIv(salt: string, iv: string): void {
  backupBase64ByteLength(salt, BACKUP_SALT_BYTES, BACKUP_SALT_BYTES);
  backupBase64ByteLength(iv, BACKUP_IV_BYTES, BACKUP_IV_BYTES);
}

export function validateBackupCiphertext(payload: string): void {
  backupBase64ByteLength(payload, BACKUP_TAG_BYTES, MAX_BACKUP_PLAINTEXT_BYTES + BACKUP_TAG_BYTES);
}
