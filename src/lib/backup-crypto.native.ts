import { requireOptionalNativeModule } from "expo";

import {
  BACKUP_IV_BYTES,
  BACKUP_SALT_BYTES,
  MAX_BACKUP_PLAINTEXT_BYTES,
  validateBackupCiphertext,
  validateBackupSaltAndIv
} from "./backup-crypto-format";

type NativeBackupCrypto = {
  randomBase64(length: number): Promise<string>;
  encrypt(passphrase: string, salt: string, iv: string, plaintext: string): Promise<string>;
  decrypt(passphrase: string, salt: string, iv: string, payload: string): Promise<string>;
};

function getNativeBackupCrypto(): NativeBackupCrypto {
  const module = requireOptionalNativeModule<NativeBackupCrypto>("FreedBackupCrypto");
  if (!module) {
    throw new Error("Encrypted recovery backup requires a native build with FREED backup crypto support.");
  }
  return module;
}

export function assertBackupCryptoAvailable(): void {
  getNativeBackupCrypto();
}

export async function generateBackupRandomBase64(length: number): Promise<string> {
  if (length !== BACKUP_SALT_BYTES && length !== BACKUP_IV_BYTES) {
    throw new Error("Recovery backup has invalid random byte count.");
  }
  return getNativeBackupCrypto().randomBase64(length);
}

export async function encryptBackupPayload(passphrase: string, salt: string, iv: string, plaintext: string): Promise<string> {
  validateBackupSaltAndIv(salt, iv);
  if (plaintext.length > MAX_BACKUP_PLAINTEXT_BYTES) throw new Error("Recovery backup payload exceeds the size limit.");
  return getNativeBackupCrypto().encrypt(passphrase, salt, iv, plaintext);
}

export async function decryptBackupPayload(passphrase: string, salt: string, iv: string, payload: string): Promise<string> {
  validateBackupSaltAndIv(salt, iv);
  validateBackupCiphertext(payload);
  return getNativeBackupCrypto().decrypt(passphrase, salt, iv, payload);
}
