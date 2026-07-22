import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as ts from "typescript";

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
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`export const unsafe = onCall({ /* enforceAppCheck: true */ }, async (request) => { /* requireUid(request.auth?.uid) */ });`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`export const unsafe = onCall({ policy: "enforceAppCheck: true" }, async (request) => { const text = "requireUid(request.auth?.uid)"; });`)),
  /unsafe.*enforceAppCheck/i
);
assert.equal(
  extractExportedOnCalls(`const fixture = "export const fake = onCall({ enforceAppCheck: true }, async (request) => { requireUid(request.auth?.uid); })";`).length,
  0,
  "A string literal must not be treated as a callable declaration."
);
assert.equal(
  extractExportedOnCalls(`/* export const fake = onCall({ enforceAppCheck: true }, async (request) => { requireUid(request.auth?.uid); }); */`).length,
  0,
  "A comment must not be treated as a callable declaration."
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

type ExportedOnCall = { name: string; options: ts.ObjectLiteralExpression; body: ts.Block };

/** Enumerates syntax nodes only: comments and strings are not declarations. */
function extractExportedOnCalls(source: string): ExportedOnCall[] {
  const sourceFile = ts.createSourceFile("functions/src/index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const handlers: ExportedOnCall[] = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !ts.isCallExpression(declaration.initializer)) continue;
      const [options, callback] = declaration.initializer.arguments;
      if (!ts.isIdentifier(declaration.initializer.expression) || declaration.initializer.expression.text !== "onCall") continue;
      if (!options || !ts.isObjectLiteralExpression(options) || !callback || !isBlockCallback(callback)) continue;
      handlers.push({ name: declaration.name.text, options, body: callback.body });
    }
  }
  return handlers;
}

function assertCallablePolicies(handlers: ExportedOnCall[]) {
  assert.ok(handlers.length > 0, "No exported onCall handlers were found.");
  for (const handler of handlers) {
    if (!hasTrueOption(handler.options, "enforceAppCheck")) {
      throw new Error(`${handler.name} must set enforceAppCheck: true.`);
    }
    if (!usesSharedUidGate(handler.body)) {
      throw new Error(`${handler.name} must use the shared UID auth gate.`);
    }
    const consumesLimitedUseToken = hasTrueOption(handler.options, "consumeAppCheckToken");
    if (handler.name === "requestAccountDeletion" && !consumesLimitedUseToken) {
      throw new Error("requestAccountDeletion must consume a limited-use App Check token.");
    }
    if (handler.name !== "requestAccountDeletion" && consumesLimitedUseToken) {
      throw new Error("Only requestAccountDeletion may consume a limited-use App Check token.");
    }
  }
}

function hasExportModifier(statement: ts.VariableStatement) {
  return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function isBlockCallback(node: ts.Expression): node is ts.ArrowFunction | ts.FunctionExpression {
  return (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isBlock(node.body);
}

function hasTrueOption(options: ts.ObjectLiteralExpression, name: string) {
  return options.properties.some((property) => {
    if (!ts.isPropertyAssignment(property) || propertyName(property.name) !== name) return false;
    return property.initializer.kind === ts.SyntaxKind.TrueKeyword;
  });
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function usesSharedUidGate(body: ts.Block) {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "requireUid") {
      const [argument] = node.arguments;
      if (argument && isRequestAuthUid(argument)) found = true;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
  return found;
}

function isRequestAuthUid(node: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "uid" &&
    node.questionDotToken !== undefined &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "auth" &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "request"
  );
}
