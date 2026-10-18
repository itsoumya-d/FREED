"""Check the Swift bridge against this app's existing Simulator build products."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[3]
products = root / "ios/build/Build/Products/Debug-iphonesimulator"
framework_dirs = sorted({path.parent for path in products.glob("**/*.framework")})
if not list(products.glob("**/ExpoModulesCore.framework")):
    raise SystemExit("Build the iOS Simulator app first to provide ExpoModulesCore/React frameworks.")

sdk = subprocess.check_output(["xcrun", "--sdk", "iphonesimulator", "--show-sdk-path"], text=True).strip()
args = [
    "xcrun", "swiftc", "-typecheck", "-swift-version", "5", "-strict-concurrency=complete",
    "-sdk", sdk, "-target", "arm64-apple-ios15.1-simulator", "-module-name", "FreedBackupCrypto",
]
for directory in framework_dirs:
    args.extend(["-F", str(directory)])
headers = root / "ios/Pods/Headers/Public"
if headers.exists():
    args.extend(["-I", str(headers)])
    for directory in sorted(headers.iterdir()):
        if directory.is_dir():
            args.extend(["-I", str(directory)])
args.extend([
    str(root / "modules/freed-backup-crypto/ios/FreedBackupCipher.swift"),
    str(root / "modules/freed-backup-crypto/ios/FreedBackupCryptoModule.swift"),
])
print("Checking Swift bridge against existing iOS Simulator Expo/React build products", flush=True)
raise SystemExit(subprocess.call(args))
