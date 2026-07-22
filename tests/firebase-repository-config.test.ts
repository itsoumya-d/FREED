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
assert.match(functionSource, /function requireUid\(uid: string \| undefined\)/);
assert.match(functionSource, /A Firebase Auth session is required/);
assertCallablePolicies(extractExportedOnCalls(functionSource));
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`export const unsafe = onCall({}, async (request) => { requireUid(request.auth?.uid); });`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`export const unsafe = onCall({ enforceAppCheck: true }, async () => {});`)),
  /unsafe.*UID auth gate/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`export const other = onCall({ consumeAppCheckToken: true, enforceAppCheck: true }, async (request) => { requireUid(request.auth?.uid); });`)),
  /only requestAccountDeletion/i
);
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

type ExportedOnCall = { name: string; options: string; body: string };

/** Extracts exported v2 onCall declarations without relying on option order or formatting. */
function extractExportedOnCalls(source: string): ExportedOnCall[] {
  const handlers: ExportedOnCall[] = [];
  const declaration = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*onCall\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(source))) {
    const optionsStart = nextNonWhitespace(source, declaration.lastIndex);
    if (source[optionsStart] !== "{") throw new Error(`Exported callable ${match[1]} must use explicit options.`);
    const options = readBalanced(source, optionsStart, "{", "}");
    const arrow = source.indexOf("=>", options.end);
    if (arrow < 0) throw new Error(`Exported callable ${match[1]} must define a handler.`);
    const bodyStart = nextNonWhitespace(source, arrow + 2);
    if (source[bodyStart] !== "{") throw new Error(`Exported callable ${match[1]} must use a block handler.`);
    const body = readBalanced(source, bodyStart, "{", "}");
    handlers.push({ name: match[1]!, options: options.content, body: body.content });
    declaration.lastIndex = body.end + 1;
  }
  if (handlers.length === 0) throw new Error("No exported onCall handlers were found.");
  return handlers;
}

function assertCallablePolicies(handlers: ExportedOnCall[]) {
  for (const handler of handlers) {
    if (!/\benforceAppCheck\s*:\s*true\b/.test(handler.options)) {
      throw new Error(`${handler.name} must set enforceAppCheck: true.`);
    }
    if (!/\brequireUid\s*\(\s*request\s*\.\s*auth\s*\?\.\s*uid\s*\)/.test(handler.body)) {
      throw new Error(`${handler.name} must use the shared UID auth gate.`);
    }
    const consumesLimitedUseToken = /\bconsumeAppCheckToken\s*:\s*true\b/.test(handler.options);
    if (handler.name === "requestAccountDeletion" && !consumesLimitedUseToken) {
      throw new Error("requestAccountDeletion must consume a limited-use App Check token.");
    }
    if (handler.name !== "requestAccountDeletion" && consumesLimitedUseToken) {
      throw new Error("Only requestAccountDeletion may consume a limited-use App Check token.");
    }
  }
}

function nextNonWhitespace(source: string, start: number) {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index += 1;
  return index;
}

function readBalanced(source: string, start: number, open: string, close: string) {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]!;
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (character === "\\") { index += 1; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (character === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (character === "'" || character === '"' || character === "`") { quote = character; continue; }
    if (character === open) depth += 1;
    if (character === close) {
      depth -= 1;
      if (depth === 0) return { content: source.slice(start + 1, index), end: index };
    }
  }
  throw new Error(`Unterminated ${open}${close} block in Firebase callable source.`);
}
