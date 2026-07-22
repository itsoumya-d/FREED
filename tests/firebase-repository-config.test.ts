import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const aliases = JSON.parse(readFileSync(".firebaserc", "utf8"));
const config = JSON.parse(readFileSync("firebase.json", "utf8"));
const firestoreRules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const functionSource = readFileSync("functions/src/index.ts", "utf8");
const functionsPackageJson = JSON.parse(readFileSync("functions/package.json", "utf8"));
const remoteConfig = JSON.parse(readFileSync("remoteconfig.template.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const environmentExample = readFileSync(".env.example", "utf8");
const productionEnvironmentExample = readFileSync(".env.production.example", "utf8");

assert.equal(aliases.projects.production, "freed-7d5ee");
assert.equal(aliases.projects.staging, "freed-staging-7d5ee");
assert.equal(config.firestore.rules, "firestore.rules");
assert.equal(config.firestore.indexes, "firestore.indexes.json");
assert.equal(config.storage.rules, "storage.rules");
assert.equal(config.remoteconfig.template, "remoteconfig.template.json");
assert.equal(config.emulators.auth.port, 9099);
assert.equal(config.emulators.functions.port, 5001);
assert.equal(config.emulators.firestore.port, 8080);
assert.equal(config.emulators.hosting.port, 5000);
assert.equal(config.emulators.storage.port, 9199);
const hosting = config.hosting.find((entry: { target: string }) => entry.target === "web");
assert.ok(hosting);
assert.deepEqual(hosting.predeploy, ["npm run prepare:firebase-hosting"]);
assert.ok(!hosting.ignore.includes("**/.*"), "Hosting must not ignore generated .well-known association files.");
assert.match(firestoreRules, /allow read, write: if false/);
assert.match(storageRules, /allow read, write: if false/);
assert.equal(functionsPackageJson.main, "lib/index.js");
assert.equal(functionsPackageJson.engines.node, "22");
assert.ok(config.functions.some((entry: { source: string; runtime: string }) => entry.source === "functions" && entry.runtime === "nodejs22"));
assert.match(functionSource, /export const backendReadiness = onCall\(\{ enforceAppCheck: true \}/);
assert.match(functionSource, /export const ingestAggregateAnalytics = onCall\(\{ enforceAppCheck: true \}/);
assert.match(functionSource, /export const registerEncryptedBackupMetadata = onCall\(\{ enforceAppCheck: true \}/);
assert.match(functionSource, /export const registerPushToken = onCall\(\{ enforceAppCheck: true \}/);
assert.match(functionSource, /export const requestAccountDeletion = onCall\(\{ enforceAppCheck: true, consumeAppCheckToken: true \}/);
assert.match(functionSource, /function requireUid\(uid: string \| undefined\)/);
assert.match(functionSource, /A Firebase Auth session is required/);
assert.doesNotMatch(functionSource, /enforceAppCheck: false/);
assert.equal(remoteConfig.parameters.firebase_foundation_enabled.defaultValue.value, "false");
assert.equal(
  packageJson.scripts["audit:firebase-config"],
  "node -- scripts/run-ts-entry.js scripts/firebase-config-audit.ts",
);
assert.equal(
  packageJson.scripts["audit:firebase-privacy"],
  "node -- scripts/run-ts-entry.js scripts/firebase-privacy-audit.ts",
);
assert.equal(packageJson.scripts["preflight:firebase-email-links"], "node -- scripts/firebase-hosting-preflight.js");
assert.equal(packageJson.scripts["prepare:firebase-hosting"], "node -- scripts/firebase-hosting-predeploy.js");
assert.equal(packageJson.scripts["audit:firebase-email-links"], "node -- scripts/firebase-email-link-delivery-audit.js");
assert.equal(
  packageJson.scripts["test:firebase-email-links"],
  "node -- scripts/run-ts-entry.js tests/firebase-email-link-delivery-audit.test.ts"
);
assert.equal(config["react-native"].analytics_collection_deactivated, true);
assert.equal(config["react-native"].crashlytics_auto_collection_enabled, false);
assert.equal(config["react-native"].perf_collection_deactivated, true);
assert.equal(config["react-native"].messaging_auto_init_enabled, false);
assert.match(environmentExample, /EXPO_PUBLIC_FIREBASE_ENV=production/);
assert.match(environmentExample, /EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL=https:\/\/freed-7d5ee\.web\.app\/auth\/callback/);
assert.match(environmentExample, /EXPO_PUBLIC_FIREBASE_EMAIL_LINK_DOMAIN=freed-7d5ee\.firebaseapp\.com/);
assert.match(environmentExample, /EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT=/);
assert.match(productionEnvironmentExample, /EXPO_PUBLIC_FIREBASE_ENV=production/);
assert.match(productionEnvironmentExample, /EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL=https:\/\/freed-7d5ee\.web\.app\/auth\/callback/);
assert.match(productionEnvironmentExample, /EXPO_PUBLIC_FIREBASE_EMAIL_LINK_DOMAIN=freed-7d5ee\.firebaseapp\.com/);
console.log("firebase repository configuration tests passed");
