import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const source = readFileSync("src/lib/firebase-native.ts", "utf8");
const webBoundaryPath = "src/lib/firebase-native.web.ts";
const appSurface = readFileSync("src/features/freed-app.tsx", "utf8");

assert.ok(existsSync(webBoundaryPath), "Firebase web builds need a platform-resolved, native-module-free boundary.");
const webSource = readFileSync(webBoundaryPath, "utf8");

for (const moduleName of ["@react-native-firebase/", "react-native/Libraries/"]) {
  assert.doesNotMatch(webSource, new RegExp(moduleName.replaceAll("/", "\\/")));
}

for (const exportedName of [
  "startFirebaseClient",
  "getFirebaseNativeAuthAdapter",
  "getFirebaseMessagingRegistrationAfterPermission",
  "registerFirebasePushTokenAfterPermission",
  "callFirebaseBackendReadiness",
  "getFirebaseCallableContracts"
]) {
  assert.match(webSource, new RegExp(`export (?:async )?function ${exportedName}`));
}

assert.match(webSource, /status: "unsupported"/);
assert.match(webSource, /return null/);

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
assert.match(source, /callFirebaseBackendReadiness/);
assert.match(source, /backendReadiness/);
assert.doesNotMatch(source, /firebaseFoundation/);
assert.match(source, /getFirebaseMessagingRegistrationContract/);
assert.match(source, /await startFirebaseClient\(\)/);
assert.match(source, /nativeAuth\.currentUser/);
assert.match(source, /limitedUseAppCheckTokens: true/);
assert.match(source, /timeout: FIREBASE_CALLABLE_TIMEOUT_MS/);
assert.match(source, /createFirebaseClientEventId\("push"\)/);
assert.match(source, /registerPushToken/);
assert.doesNotMatch(source, /requestPermissionsAsync/);
assert.match(source, /const emailLinkReadiness = getFirebaseEmailLinkReadiness\(\);[\s\S]*emailLinkReady: emailLinkReadiness\.ready,[\s\S]*emailLinkDomain: emailLinkReadiness\.linkDomain/);
assert.match(source, /crashlytics\.setCrashlyticsCollectionEnabled\(false\)/);
assert.match(source, /performance\.setPerformanceCollectionEnabled\(false\)/);
assert.doesNotMatch(source, /setUserId\(/);
assert.doesNotMatch(source, /setAttribute\(/);
assert.doesNotMatch(source, /firestore\(/i);
assert.doesNotMatch(source, /storage\(/i);
assert.match(appSurface, /getFirebaseNativeAuthAdapter/);
assert.match(appSurface, /getFirebaseEmailLinkReadiness/);
assert.match(appSurface, /isFirebaseEmailLinkDeliveryUrl/);
assert.match(appSurface, /const emailLinkEnabled = syncEndpointConfigured && firebaseAuthReadiness\.ready && firebaseEmailLinkReadiness\.ready/);
assert.match(appSurface, /const consumeFirebaseEmailLink = React\.useCallback/);
assert.match(appSurface, /setPendingFirebaseEmailLink\(url\);[\s\S]*setTab\("profile"\);[\s\S]*setScreen\("main"\);/);
assert.match(appSurface, /if \(consumeFirebaseEmailLink\(url\)\) return;[\s\S]*Linking\.getInitialURL\(\)[\s\S]*Linking\.addEventListener\("url"/);
assert.match(appSurface, /pendingFirebaseEmailLink=\{pendingFirebaseEmailLink\}/);
assert.match(appSurface, /Email-link sign-in is disabled until the signed app-link association is deployed and physically verified\./);
assert.match(appSurface, /void startFirebaseClient\(\)/);
assert.match(appSurface, /registerFirebasePushTokenAfterPermission/);
assert.match(appSurface, /result\.permissionStatus === "granted"/);
assert.match(appSurface, /Delete Account & Data/);
assert.match(appSurface, /Confirm Account & Data Deletion/);
assert.match(appSurface, /accessibilityLabel="Delete Account & Data"/);
assert.match(appSurface, /requestAccountDeletion/);
assert.match(appSurface, /await deleteLocalRecoveryData\(\)/);
assert.match(appSurface, /https:\/\/freedrecovery\.app\/account-deletion/);
assert.doesNotMatch(appSurface, /label="Server Deletion"/);
assert.match(appSurface, /firebaseEmailLinkReadiness\.callbackUrl/);
assert.doesNotMatch(appSurface, /isFirebaseEmailLinkCallbackUrl/);
assert.match(appSurface, /EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT/);
assert.doesNotMatch(appSurface, /EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT/);
assert.match(appSurface, /getCurrentIdToken/);
assert.doesNotMatch(appSurface, /supabase-auth-client/);
console.log("firebase native runtime tests passed");
