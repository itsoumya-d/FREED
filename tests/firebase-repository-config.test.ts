import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as ts from "typescript";
const { collectExportedFunctionSources } = require("../scripts/lib/firebase-function-source");

const aliases = JSON.parse(readFileSync(".firebaserc", "utf8"));
const config = JSON.parse(readFileSync("firebase.json", "utf8"));
const firestoreIndexes = JSON.parse(readFileSync("firestore.indexes.json", "utf8"));
const firestoreRules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const functionSurface = collectExportedFunctionSources(process.cwd());
const functionsPackageJson = JSON.parse(readFileSync("functions/package.json", "utf8"));
const remoteConfig = JSON.parse(readFileSync("remoteconfig.template.json", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const environmentExample = readFileSync(".env.example", "utf8");
const productionEnvironmentExample = readFileSync(".env.production.example", "utf8");
const onCallImport = `import { onCall } from "firebase-functions/v2/https";`;
assert.throws(() => extractDeploymentCallables(collectExportedFunctionSources('/fixture', 'functions/src/index.ts', (file: string) => {
  if (file === 'functions/src/index.ts') return 'export * from "./foundation.js";';
  return `${onCallImport} function requireUid(uid: string | undefined) { return uid; } export const unsafe = onCall({ enforceAppCheck: true }, async request => { requireUid(request.auth?.uid); });`;
})), /auth gate.*unauthenticated|unauthenticated.*auth gate/i);

assert.equal(aliases.projects.production, "freed-7d5ee");
assert.equal(aliases.projects.staging, "freed-staging-7d5ee");
assert.equal(config.firestore.rules, "firestore.rules");
assert.equal(config.firestore.indexes, "firestore.indexes.json");
assert.deepEqual(firestoreIndexes.indexes.filter((index: { collectionGroup: string }) => index.collectionGroup === "notification_jobs"), [
  {
    collectionGroup: "notification_jobs",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "scheduledAt", order: "ASCENDING" }
    ]
  },
  {
    collectionGroup: "notification_jobs",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "status", order: "ASCENDING" },
      { fieldPath: "claimedAt", order: "ASCENDING" }
    ]
  }
]);
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
const deployedCallables = extractDeploymentCallables(functionSurface);
const clientCallableNames = callableNamesFromClient(readFileSync("src/lib/firebase-client.ts", "utf8"));
assert.deepEqual(deployedCallables.map(handler => handler.name).sort(), clientCallableNames.sort(), "Every client callable must actually be exported by the deployment entry; no callable may disappear behind a re-export.");
assertCallablePolicies(deployedCallables);
for (const module of functionSurface.modules) {
  if (extractExportedOnCalls(module.source).length) assert.match(module.source, /A Firebase Auth session is required/);
}
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const unsafe = onCall({}, async (request) => { requireUid(request.auth?.uid); });`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(() => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const verifyStorePurchase = onCall({ enforceAppCheck: true }, async request => { requirePurchaseUid(request.auth?.uid); });`)), /verifyStorePurchase.*limited-use/i);
assert.doesNotThrow(() => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const verifyStorePurchase = onCall({ enforceAppCheck: true, consumeAppCheckToken: true }, async request => { requirePurchaseUid(request.auth?.uid); });`)));
assert.throws(() => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const disguised = onCall({ enforceAppCheck: true }, async request => { const requireUid = () => "fake"; requireUid(request.auth?.uid); });`)), /UID auth gate/i);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const unsafe = onCall({ enforceAppCheck: true }, async () => {});`)),
  /unsafe.*UID auth gate/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const other = onCall({ consumeAppCheckToken: true, enforceAppCheck: true }, async (request) => { requireUid(request.auth?.uid); });`)),
  /only requestAccountDeletion/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const unsafe = onCall({ /* enforceAppCheck: true */ }, async (request) => { /* requireUid(request.auth?.uid) */ });`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const unsafe = onCall({ policy: "enforceAppCheck: true" }, async (request) => { const text = "requireUid(request.auth?.uid)"; });`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} const unsafe = onCall({}, async (request) => { requireUid(request.auth?.uid); }); export { unsafe };`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`import { onCall as callable } from "firebase-functions/v2/https"; const unsafe = (callable({}, async (request) => { requireUid(request.auth?.uid); })) as unknown; export { unsafe };`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`import { onCall as callable } from "firebase-functions/v2/https"; const unsafe = (callable({}, async (request) => { requireUid(request.auth?.uid); })) satisfies unknown; export { unsafe };`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const unsafe = onCall({ enforceAppCheck: true, ...unknownOptions }, async (request) => { requireUid(request.auth?.uid); });`)),
  /unsafe.*enforceAppCheck/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const requestAccountDeletion = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, ...unknownOptions, enforceAppCheck: true }, async (request) => { requireUid(request.auth?.uid); });`)),
  /requestAccountDeletion.*limited-use/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const other = onCall({ enforceAppCheck: true, consumeAppCheckToken: true, ...unknownOptions, enforceAppCheck: true }, async (request) => { requireUid(request.auth?.uid); });`)),
  /only requestAccountDeletion/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const other = onCall({ enforceAppCheck: true, consumeAppCheckToken: runtimeConfig }, async (request) => { requireUid(request.auth?.uid); });`)),
  /only requestAccountDeletion/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const other = onCall({ enforceAppCheck: true, consumeAppCheckToken: runtimeConfig as boolean }, async (request) => { requireUid(request.auth?.uid); });`)),
  /only requestAccountDeletion/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const safe = onCall({ ...unknownOptions, enforceAppCheck: true }, async (request) => { const uid = requireUid(request.auth?.uid); });`)),
  /only requestAccountDeletion/i
);
assert.doesNotThrow(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const requestAccountDeletion = onCall({ ...unknownOptions, enforceAppCheck: true, consumeAppCheckToken: true }, async (request) => { const uid = requireUid(request.auth?.uid); });`))
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const unsafe = onCall({ enforceAppCheck: true }, async (request) => { const deferred = () => requireUid(request.auth?.uid); });`)),
  /unsafe.*UID auth gate/i
);
assert.throws(
  () => assertCallablePolicies(extractExportedOnCalls(`${onCallImport} export const unsafe = onCall({ enforceAppCheck: true }, async (request) => { if (false) requireUid(request.auth?.uid); });`)),
  /unsafe.*UID auth gate/i
);
assert.equal(
  extractExportedOnCalls(`export const fake = onCall({ enforceAppCheck: true }, async (request) => { requireUid(request.auth?.uid); });`).length,
  0,
  "A non-imported local onCall identifier must not be trusted as the Firebase v2 binding."
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
for (const parameter of ["ai_clara_enabled", "ai_challenges_enabled", "ai_retention_enabled"]) {
  assert.equal(remoteConfig.parameters[parameter].defaultValue.value, "false", `${parameter} must fail closed by default`);
  assert.match(remoteConfig.parameters[parameter].description, /server-side|server provider/i);
}
assert.equal(remoteConfig.parameters.remote_notifications_enabled.defaultValue.value, "false");
assert.match(remoteConfig.parameters.remote_notifications_enabled.description, /signed-device.*FCM\/APNs proof/i);
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

type ExportedOnCall = { name: string; options: ts.ObjectLiteralExpression | null; body: ts.Block | null };

function extractDeploymentCallables(surface: { modules: Array<{ path: string; source: string }>; exports: Array<{ path: string; localName: string; exportName: string }> }): ExportedOnCall[] {
  for (const module of surface.modules) assertAuthenticationGateDefinitions(module.source, module.path);
  const localHandlers = new Map(surface.modules.map(module => [module.path, extractExportedOnCalls(module.source)]));
  return surface.exports.flatMap(binding => {
    const handler = localHandlers.get(binding.path)?.find(candidate => candidate.name === binding.localName);
    return handler ? [{ ...handler, name: binding.exportName }] : [];
  });
}

function assertAuthenticationGateDefinitions(source: string, file: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const statement of ast.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !["requireUid", "requirePurchaseUid", "requireAuthenticatedUid"].includes(statement.name.text)) continue;
    const first = statement.body?.statements[0];
    const last = statement.body?.statements[statement.body.statements.length - 1];
    const validDenial = first && ts.isIfStatement(first) && ts.isPrefixUnaryExpression(first.expression) && first.expression.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(first.expression.operand) && first.expression.operand.text === "uid" && ts.isThrowStatement(first.thenStatement) && first.thenStatement.expression && ts.isNewExpression(first.thenStatement.expression) && ts.isIdentifier(first.thenStatement.expression.expression) && first.thenStatement.expression.expression.text === "HttpsError" && first.thenStatement.expression.arguments?.[0] && ts.isStringLiteral(first.thenStatement.expression.arguments[0]) && first.thenStatement.expression.arguments[0].text === "unauthenticated";
    assert.ok(validDenial && last && ts.isReturnStatement(last) && last.expression && ts.isIdentifier(last.expression) && last.expression.text === "uid", `${file} ${statement.name.text} auth gate must throw unauthenticated before returning UID.`);
  }
}

function callableNamesFromClient(source: string): string[] {
  const ast = ts.createSourceFile("firebase-client.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = ast.statements.find((statement): statement is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(statement) && statement.name.text === "FirebaseCallableName");
  assert.ok(declaration && ts.isUnionTypeNode(declaration.type), "Client callable union is required.");
  return declaration.type.types.map(type => { assert.ok(ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)); return type.literal.text; });
}

/**
 * Enumerates only actual top-level values created by the locally imported v2
 * onCall binding, then resolves direct and named exports. Unsupported syntax is
 * retained as an invalid handler so the policy check fails closed.
 */
function extractExportedOnCalls(source: string): ExportedOnCall[] {
  const sourceFile = ts.createSourceFile("functions/src/index.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const onCallBindings = importedOnCallBindings(sourceFile);
  const localCallables = new Map<string, ExportedOnCall>();
  const directlyExported = new Set<string>();
  const reExported = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const callable = callableFromInitializer(declaration.name.text, declaration.initializer, onCallBindings);
        if (!callable) continue;
        localCallables.set(callable.name, callable);
        if (hasExportModifier(statement)) directlyExported.add(callable.name);
      }
    }
    if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const specifier of statement.exportClause.elements) {
        reExported.add((specifier.propertyName ?? specifier.name).text);
      }
    }
  }

  return [...localCallables.values()].filter((handler) => directlyExported.has(handler.name) || reExported.has(handler.name));
}

function assertCallablePolicies(handlers: ExportedOnCall[]) {
  assert.ok(handlers.length > 0, "No exported onCall handlers were found.");
  for (const handler of handlers) {
    const enforceAppCheck = handler.options ? effectiveOption(handler.options, "enforceAppCheck") : null;
    if (!enforceAppCheck || enforceAppCheck.state !== "true") {
      throw new Error(`${handler.name} must set enforceAppCheck: true.`);
    }
    if (!handler.body || !usesSharedUidGate(handler.body)) {
      throw new Error(`${handler.name} must use the shared UID auth gate.`);
    }
    const consumeAppCheckToken = effectiveOption(handler.options, "consumeAppCheckToken");
    if (["requestAccountDeletion", "verifyStorePurchase"].includes(handler.name) && consumeAppCheckToken.state !== "true") {
      throw new Error(`${handler.name} must consume a limited-use App Check token.`);
    }
    if (!["requestAccountDeletion", "verifyStorePurchase"].includes(handler.name) && consumeAppCheckToken.state !== "not-true") {
      throw new Error("Only requestAccountDeletion or verifyStorePurchase may consume a limited-use App Check token.");
    }
  }
}

function hasExportModifier(statement: ts.VariableStatement) {
  return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function importedOnCallBindings(sourceFile: ts.SourceFile) {
  const bindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== "firebase-functions/v2/https") continue;
    const namedImports = statement.importClause?.namedBindings;
    if (!namedImports || !ts.isNamedImports(namedImports)) continue;
    for (const specifier of namedImports.elements) {
      const importedName = (specifier.propertyName ?? specifier.name).text;
      if (importedName === "onCall") bindings.add(specifier.name.text);
    }
  }
  return bindings;
}

function callableFromInitializer(name: string, initializer: ts.Expression, onCallBindings: Set<string>): ExportedOnCall | null {
  const expression = unwrapExpression(initializer);
  if (!ts.isCallExpression(expression) || !ts.isIdentifier(expression.expression) || !onCallBindings.has(expression.expression.text)) return null;
  const [rawOptions, rawCallback] = expression.arguments;
  const options = rawOptions && ts.isObjectLiteralExpression(unwrapExpression(rawOptions)) ? unwrapExpression(rawOptions) as ts.ObjectLiteralExpression : null;
  const callback = rawCallback ? unwrapExpression(rawCallback) : null;
  return { name, options, body: callback && isBlockCallback(callback) ? callback.body : null };
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isBlockCallback(node: ts.Expression): node is ts.ArrowFunction | ts.FunctionExpression {
  return (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && ts.isBlock(node.body);
}

type OptionState = "true" | "not-true" | "unknown";
type OptionEvaluation = { state: OptionState };

/** Applies object declaration order; spread values are unprovable until overwritten. */
function effectiveOption(options: ts.ObjectLiteralExpression, name: string): OptionEvaluation {
  let state: OptionState = "not-true";
  for (const property of options.properties) {
    if (ts.isSpreadAssignment(property)) {
      state = "unknown";
      continue;
    }
    const propertyKey = propertyName(property.name);
    if (propertyKey === null) {
      state = "unknown";
      continue;
    }
    if (propertyKey !== name) continue;
    if (ts.isPropertyAssignment(property)) {
      const initializer = unwrapExpression(property.initializer);
      state = initializer.kind === ts.SyntaxKind.TrueKeyword
        ? "true"
        : initializer.kind === ts.SyntaxKind.FalseKeyword
          ? "not-true"
          : "unknown";
    } else {
      state = "unknown";
    }
  }
  return { state };
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function usesSharedUidGate(body: ts.Block) {
  const gateNames = new Set(["requireUid", "requirePurchaseUid", "requireAuthenticatedUid"]);
  // A callback-local fake/shadowed gate must not satisfy authentication.
  if (body.statements.some(statement => ts.isFunctionDeclaration(statement) && statement.name && gateNames.has(statement.name.text) || ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && gateNames.has(declaration.name.text)))) return false;
  return body.statements.some((statement) => {
    if (ts.isExpressionStatement(statement)) return isSharedUidCall(statement.expression);
    if (!ts.isVariableStatement(statement)) return false;
    return statement.declarationList.declarations.some((declaration) => Boolean(declaration.initializer && isSharedUidCall(declaration.initializer)));
  });
}

function isSharedUidCall(expression: ts.Expression) {
  const node = unwrapExpression(expression);
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || !["requireUid", "requirePurchaseUid", "requireAuthenticatedUid"].includes(node.expression.text)) return false;
  const [argument] = node.arguments;
  return Boolean(argument && isRequestAuthUid(argument));
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
