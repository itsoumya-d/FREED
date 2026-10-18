import {
  BACKUP_KDF_ITERATIONS,
  BACKUP_IV_BYTES,
  BACKUP_SALT_BYTES,
  MAX_BACKUP_PLAINTEXT_BYTES,
  validateBackupCiphertext,
  validateBackupSaltAndIv
} from "./backup-crypto-format";

function getWebCrypto() {
  const crypto = globalThis.crypto;
  if (!crypto?.subtle || typeof crypto.getRandomValues !== "function") {
    throw new Error("Encrypted recovery backup requires Web Crypto support.");
  }
  return crypto;
}

export function assertBackupCryptoAvailable(): void {
  getWebCrypto();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function generateBackupRandomBase64(length: number): Promise<string> {
  if (length !== BACKUP_SALT_BYTES && length !== BACKUP_IV_BYTES) {
    throw new Error("Recovery backup has invalid random byte count.");
  }
  return bytesToBase64(getWebCrypto().getRandomValues(new Uint8Array(length)));
}

async function deriveBackupKey(passphrase: string, salt: string, usage: KeyUsage) {
  const crypto = getWebCrypto();
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: base64ToBytes(salt), iterations: BACKUP_KDF_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    [usage]
  );
}

export async function encryptBackupPayload(passphrase: string, salt: string, iv: string, plaintext: string): Promise<string> {
  validateBackupSaltAndIv(salt, iv);
  if (plaintext.length > MAX_BACKUP_PLAINTEXT_BYTES) throw new Error("Recovery backup payload exceeds the size limit.");
  const bytes = new TextEncoder().encode(plaintext);
  if (bytes.length > MAX_BACKUP_PLAINTEXT_BYTES) throw new Error("Recovery backup payload exceeds the size limit.");
  const key = await deriveBackupKey(passphrase, salt, "encrypt");
  const encrypted = await getWebCrypto().subtle.encrypt({ name: "AES-GCM", iv: base64ToBytes(iv), tagLength: 128 }, key, bytes);
  // WebCrypto returns ciphertext || the 16-byte tag; the IV stays in the envelope.
  return bytesToBase64(new Uint8Array(encrypted));
}

export async function decryptBackupPayload(passphrase: string, salt: string, iv: string, payload: string): Promise<string> {
  validateBackupSaltAndIv(salt, iv);
  validateBackupCiphertext(payload);
  const key = await deriveBackupKey(passphrase, salt, "decrypt");
  const decrypted = await getWebCrypto().subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv), tagLength: 128 }, key, base64ToBytes(payload));
  return new TextDecoder("utf-8", { fatal: true }).decode(decrypted);
}
