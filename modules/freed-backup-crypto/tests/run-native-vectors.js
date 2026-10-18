// Compile and execute the production crypto cores without Expo/Simulator bridge dependencies.
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { resolve, join } = require("node:path");

const moduleRoot = resolve(__dirname, "..");
const outputDirectory = mkdtempSync(join(tmpdir(), "freed-backup-crypto-"));
try {
  const swiftBinary = join(outputDirectory, "swift-vectors");
  execFileSync("xcrun", ["swiftc", "-swift-version", "5", "-strict-concurrency=complete",
    join(moduleRoot, "ios/FreedBackupCipher.swift"), join(__dirname, "CryptoVectors.swift"), "-o", swiftBinary
  ], { stdio: "inherit", timeout: 60_000 });
  execFileSync(swiftBinary, [], { stdio: "inherit", timeout: 60_000 });

  const kotlinJar = join(outputDirectory, "kotlin-vectors.jar");
  execFileSync("kotlinc", [
    join(moduleRoot, "android/src/main/java/app/freed/backupcrypto/FreedBackupCipher.kt"),
    join(__dirname, "CryptoVectors.kt"), "-include-runtime", "-d", kotlinJar
  ], { stdio: "inherit", timeout: 60_000 });
  execFileSync("java", ["-jar", kotlinJar], { stdio: "inherit", timeout: 60_000 });
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
