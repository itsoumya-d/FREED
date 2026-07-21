import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/firebase-native.ts", "utf8");
const appSurface = readFileSync("src/features/freed-app.tsx", "utf8");

for (const moduleName of [
  "@react-native-firebase/app",
  "@react-native-firebase/auth",
  "@react-native-firebase/app-check",
  "@react-native-firebase/functions",
  "@react-native-firebase/messaging",
  "@react-native-firebase/installations",
  "@react-native-firebase/crashlytics",
  "@react-native-firebase/perf",
  "@react-native-firebase/remote-config"
]) {
  assert.match(source, new RegExp(moduleName.replaceAll("/", "\\/")));
}

assert.match(source, /initializeAppCheck/);
assert.match(source, /getFirebaseAppCheckProviderConfig\("android", readiness\)/);
assert.match(source, /getFirebaseAppCheckProviderConfig\("ios", readiness\)/);
assert.match(source, /firebaseFoundation/);
assert.match(source, /getFirebaseMessagingRegistrationContract/);
assert.match(source, /crashlytics\.setCrashlyticsCollectionEnabled\(false\)/);
assert.match(source, /performance\.setPerformanceCollectionEnabled\(false\)/);
assert.doesNotMatch(source, /setUserId\(/);
assert.doesNotMatch(source, /setAttribute\(/);
assert.doesNotMatch(source, /firestore\(/i);
assert.doesNotMatch(source, /storage\(/i);
assert.match(appSurface, /getFirebaseNativeAuthAdapter/);
assert.match(appSurface, /void startFirebaseClient\(\)/);
assert.match(appSurface, /EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL/);
assert.match(appSurface, /EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT/);
assert.doesNotMatch(appSurface, /EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT/);
assert.match(appSurface, /getCurrentIdToken/);
assert.doesNotMatch(appSurface, /supabase-auth-client/);
console.log("firebase native runtime tests passed");
