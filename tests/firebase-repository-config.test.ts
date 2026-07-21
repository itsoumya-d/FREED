import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const aliases = JSON.parse(readFileSync(".firebaserc", "utf8"));
const config = JSON.parse(readFileSync("firebase.json", "utf8"));
const firestoreRules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const functionSource = readFileSync("functions/index.js", "utf8");
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
assert.match(firestoreRules, /allow read, write: if false/);
assert.match(storageRules, /allow read, write: if false/);
assert.match(functionSource, /onCall/);
assert.match(functionSource, /enforceAppCheck: false/);
assert.equal(remoteConfig.parameters.firebase_foundation_enabled.defaultValue.value, "false");
assert.equal(
  packageJson.scripts["audit:firebase-config"],
  "node -- scripts/run-ts-entry.js scripts/firebase-config-audit.ts",
);
assert.equal(
  packageJson.scripts["audit:firebase-privacy"],
  "node -- scripts/run-ts-entry.js scripts/firebase-privacy-audit.ts",
);
assert.equal(config["react-native"].analytics_collection_deactivated, true);
assert.equal(config["react-native"].crashlytics_auto_collection_enabled, false);
assert.equal(config["react-native"].perf_collection_deactivated, true);
assert.equal(config["react-native"].messaging_auto_init_enabled, false);
assert.match(environmentExample, /EXPO_PUBLIC_FIREBASE_ENV=production/);
assert.match(environmentExample, /EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL=https:\/\/freed-7d5ee\.web\.app\/auth\/callback/);
assert.match(environmentExample, /EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT=/);
assert.match(productionEnvironmentExample, /EXPO_PUBLIC_FIREBASE_ENV=production/);
assert.match(productionEnvironmentExample, /EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL=https:\/\/freed-7d5ee\.web\.app\/auth\/callback/);
console.log("firebase repository configuration tests passed");
