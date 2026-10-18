# FREED backup crypto

Local Expo module for the existing encrypted recovery backup v1 format. It uses
PBKDF2-HMAC-SHA256 (210,000 iterations, 16-byte salt, 32-byte key) and AES-GCM
(12-byte IV, 16-byte authentication tag). Encrypted payload bytes are
`ciphertext || tag`; the IV is stored separately in the JSON envelope.

iOS uses CommonCrypto and CryptoKit on a dedicated serial background queue.
Android uses JCA on Expo's serial background module queue. Providers without
`PBKDF2WithHmacSHA256` (Android API 24/25) derive the same single-block PBKDF2
key with platform `HmacSHA256`. Derived keys stay within native code. Random
salts and IVs come from platform secure randomness.

The JS native adapter does not depend on `crypto.subtle`, `TextEncoder`,
`TextDecoder`, `atob` or `btoa`. Web and Node use the WebCrypto adapter instead.
Both adapters validate salt/IV lengths and canonical base64. Payloads are
limited to 2 MiB of plaintext plus the GCM tag, and JSON envelopes to 3 MiB
characters. Invalid KDF parameters are rejected before cryptographic work.

## Integration

Expo autolinking discovers this directory through its default `./modules`
search path. A root `file:modules/freed-backup-crypto` dependency may also be
added to match the application's existing local-module convention. No JS
package import is needed: the native adapter resolves `FreedBackupCrypto`
through Expo. Refresh CocoaPods for the checked-in iOS project and rebuild
both native apps after adding the module. Expo Go and older app binaries
without the module report backup crypto as unavailable. The module needs no
permissions, entitlements, config plugin or network connection.

## Verification

From the application root:

```sh
node -- scripts/run-ts-entry.js tests/backup-crypto.test.ts
node modules/freed-backup-crypto/tests/run-native-vectors.js
python3 modules/freed-backup-crypto/tests/typecheck-ios-bridge.py
```

The native command requires macOS/Xcode, Kotlin and a JDK. It compiles the
production Swift and Kotlin crypto cores and checks the same fixed vectors
as WebCrypto, including Unicode, embedded NUL, whitespace and empty
plaintext. The JVM fixture removes the SHA-256 PBKDF2 factory while retaining
real platform AES/HMAC implementations to exercise the API 24/25 fallback.
It also checks wrong-password rejection, modified tags and size bounds.
The bridge typecheck command needs the application's existing iOS Simulator
Expo/React build products under `ios/build`. It checks source compatibility
without editing the iOS project or linking a rebuilt application.

These core tests do not exercise the Expo bridge or Hermes. A rebuilt iOS
and Android app must additionally create a backup, restore a web-created v1
backup, and export a backup that can be restored on web. Restored recovery
progress must not reinstate purchases, permission grants or native
protection activation.
