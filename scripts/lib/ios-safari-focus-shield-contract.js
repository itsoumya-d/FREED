"use strict";

const assert = require("node:assert/strict");
const vm = require("node:vm");
const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { createHash } = require("node:crypto");
const { analyzePngBuffer, createRgbaPng } = require("./png-screenshot-audit");

const SAFARI_FOCUS_HOST_PERMISSIONS = Object.freeze([
  "*://youtube.com/*",
  "*://*.youtube.com/*",
  "*://instagram.com/*",
  "*://*.instagram.com/*",
  "*://tiktok.com/*",
  "*://*.tiktok.com/*",
]);
const SAFARI_FOCUS_ALLOWED_DOMAINS = Object.freeze([
  "youtube.com",
  "*.youtube.com",
  "instagram.com",
  "*.instagram.com",
  "tiktok.com",
  "*.tiktok.com",
]);
const APPROVED_RULE_HOSTS = Object.freeze({
  "short-form:youtube-shorts": "youtube.com",
  "short-form:instagram-reels": "instagram.com",
  "short-form:tiktok-feed": "tiktok.com",
});
const SAFARI_FOCUS_NATIVE_APP_ID = "app.freed.recovery";
const SAFARI_FOCUS_ICON_SIZES = Object.freeze([16, 32, 48, 128]);

function pngChecksum(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validIconPng(buffer, size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!Buffer.isBuffer(buffer) || buffer.length < 45 || buffer.length > 1024 * 1024 || !buffer.subarray(0, 8).equals(signature)) return false;
  if (buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR" || buffer.readUInt32BE(16) !== size || buffer.readUInt32BE(20) !== size) return false;
  const data = [];
  let ended = false;
  for (let offset = 8; offset + 12 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    if (pngChecksum(buffer.subarray(offset + 4, end - 4)) !== buffer.readUInt32BE(end - 4)) return false;
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (type === "IHDR" && offset !== 8) return false;
    if (type === "IDAT") data.push(buffer.subarray(offset + 8, end - 4));
    if (type === "IEND") { ended = length === 0 && end === buffer.length; break; }
    offset = end;
  }
  if (!ended || !data.length) return false;
  try {
    // Bound decompression before the existing PNG decoder inspects pixels.
    const inflated = zlib.inflateSync(Buffer.concat(data), { maxOutputLength: (size * 4 + 1) * size });
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[buffer[25]];
    if (inflated.length !== (size * channels + 1) * size) return false;
    const image = analyzePngBuffer(buffer);
    return image.width === size && image.height === size;
  } catch { return false; }
}

function inspectSafariFocusShieldIcons({ manifest, extensionPath, iconResources }) {
  const entries = manifest?.icons;
  const iconsManifestValid = Boolean(entries) && typeof entries === "object" && !Array.isArray(entries) &&
    exactStringSet(Object.keys(entries), SAFARI_FOCUS_ICON_SIZES.map(String)) &&
    SAFARI_FOCUS_ICON_SIZES.every((size) => entries[size] === `icons/icon-${size}.png`);
  const icons = SAFARI_FOCUS_ICON_SIZES.map((size) => {
    const file = iconsManifestValid ? entries[size] : "";
    let buffer;
    try {
      if (file && extensionPath) {
        const root = fs.realpathSync(extensionPath);
        const target = path.join(root, file);
        if (fs.lstatSync(target).isFile() && fs.realpathSync(target).startsWith(root + path.sep)) buffer = fs.readFileSync(target);
      } else if (file) buffer = iconResources?.[file];
    } catch { /* A missing, unsafe or unreadable resource fails closed. */ }
    const valid = validIconPng(buffer, size);
    return { size, path: file, available: Buffer.isBuffer(buffer), width: valid ? size : 0, height: valid ? size : 0, valid };
  });
  return { iconsManifestValid, iconResourcesValid: iconsManifestValid && icons.every((icon) => icon.valid), icons };
}

function parseBackground(source) {
  return ts.createSourceFile("SafariFocusShield-background.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
}

// Compare executable syntax, ignoring comments, whitespace and literal quote
// style. Keep declaration mutability and every child/operator in the shape.
function syntaxShape(node) {
  const children = [];
  ts.forEachChild(node, (child) => { children.push(syntaxShape(child)); });
  return [
    node.kind,
    ts.isIdentifier(node) || ts.isLiteralExpression(node) || (node.kind >= ts.SyntaxKind.TemplateHead && node.kind <= ts.SyntaxKind.TemplateTail) ? node.text : null,
    ts.isVariableDeclarationList(node) ? node.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let) : null,
    children,
  ];
}

function statementShape(source) {
  return JSON.stringify(syntaxShape(parseBackground(source).statements[0]));
}

const APPROVED_APP_ID_SHAPE = statementShape(`const NATIVE_APP_ID = "${SAFARI_FOCUS_NATIVE_APP_ID}";`);
const APPROVED_RULE_HOSTS_SHAPE = statementShape(`const APPROVED_RULE_HOSTS = Object.freeze(${JSON.stringify(APPROVED_RULE_HOSTS)});`);
const APPROVED_PAYLOAD_SHAPE = statementShape(`
  function approvedNativePayload(message) {
    if (!message || typeof message !== "object") return null;
    const host = typeof message.host === "string" ? message.host : "";
    const rule = typeof message.rule === "string" ? message.rule : "";
    if (APPROVED_RULE_HOSTS[rule] !== host) return null;
    return { type: "record-pending-intervention", source: "ios-safari-short-form", host, rule };
  }
`);
const APPROVED_LISTENER_SHAPE = statementShape(`
  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === "get-protection-configuration") {
      return browser.runtime.sendNativeMessage(NATIVE_APP_ID, { type: "get-protection-configuration" })
        .catch(() => ({ protectionConfigurationActive: false }));
    }
    const payload = approvedNativePayload(message);
    if (!payload) return Promise.resolve({ accepted: false });
    return browser.runtime.sendNativeMessage(NATIVE_APP_ID, payload).catch(() => ({ accepted: false }));
  });
`);

// Observation v1 has one fixed whole-program AST; legacy specimens remain exact.
const OBSERVATION_BACKGROUND_AST_SHA256 = "7d33ec51cbbf4863c9e89addfa4f1b8dcfdde419b55e9ce217c679ec1fc8bfe4";
const OBSERVATION_RESOURCES = Object.freeze({"check.html": "7df38cf304d8870156b0b8c245ae718b120989c795f2fd2be3d74e7b51bb7fc5", "check.js": "e31f36814d8a42f263802cc3dc4e4843930002d110464ab335f244cb94d9300a", "check.css": "436ac4a3a402429810072b6b8ff6a6dd37292853717cd0c081d403c2023d8228"});
function inspectObservationResources(manifest, extensionPath, nativeStructure, nativeHandlerBinary) {
  if (manifest?.action === undefined) return nativeStructure.observationContract !== true;
  const requiredKeys = ["manifest_version", "name", "version", "description", "browser_specific_settings", "background", "permissions", "icons", "host_permissions", "content_scripts", "action", ...(manifest?.declarative_net_request === undefined ? [] : ["declarative_net_request"]), ...(manifest?.web_accessible_resources === undefined ? [] : ["web_accessible_resources"])];
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(requiredKeys.sort()) || JSON.stringify(manifest.background) !== JSON.stringify({service_worker:"background.js"}) || !nativeHandlerBinary.includes("begin-safari-recovery-observation") || !nativeHandlerBinary.includes("commit-safari-recovery-observation")) return false;
  if (!nativeStructure.observationContract || !extensionPath || JSON.stringify(manifest.action) !== JSON.stringify({ default_popup: "safari-observation/check.html" })) return false;
  try {
    const directory = path.join(extensionPath, "safari-observation");
    if (fs.lstatSync(directory).isSymbolicLink() || JSON.stringify(fs.readdirSync(directory).sort()) !== JSON.stringify(Object.keys(OBSERVATION_RESOURCES).sort())) return false;
    return Object.entries(OBSERVATION_RESOURCES).every(([file, digest]) => { const target = path.join(directory, file); return !fs.lstatSync(target).isSymbolicLink() && fs.lstatSync(target).isFile() && createHash("sha256").update(fs.readFileSync(target)).digest("hex") === digest; });
  } catch { return false; }
}

function inspectNativeMessageStructure(source) {
  const ast = parseBackground(source);
  const observationContract = ast.parseDiagnostics.length === 0 && createHash("sha256").update(JSON.stringify(syntaxShape(ast))).digest("hex") === OBSERVATION_BACKGROUND_AST_SHA256;
  if (observationContract) return { hostsValid: true, payloadValid: true, listenerValid: true, nativeAppIdentifierValid: true, nativePayloadSchemaValid: true, observationContract: true };
  const statements = [...ast.statements];
  if (statements[0] && ts.isExpressionStatement(statements[0]) && ts.isStringLiteral(statements[0].expression) && statements[0].expression.text === "use strict") {
    statements.shift();
  }
  const matches = (index, shape) => Boolean(statements[index]) && JSON.stringify(syntaxShape(statements[index])) === shape;
  const appIdValid = matches(0, APPROVED_APP_ID_SHAPE);
  const hostsValid = matches(1, APPROVED_RULE_HOSTS_SHAPE);
  const payloadValid = matches(2, APPROVED_PAYLOAD_SHAPE);
  const listenerValid = matches(3, APPROVED_LISTENER_SHAPE);
  let nativeMessageReferences = 0;
  let configurationCalls = 0;
  let interventionCalls = 0;
  function visit(node) {
    if (ts.isIdentifier(node) && node.text === "sendNativeMessage") nativeMessageReferences += 1;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "sendNativeMessage") {
      const runtime = node.expression.expression;
      const [target, envelope] = node.arguments;
      if (ts.isPropertyAccessExpression(runtime) && ts.isIdentifier(runtime.expression) && runtime.expression.text === "browser" && runtime.name.text === "runtime" &&
          node.arguments.length === 2 && ts.isIdentifier(target) && target.text === "NATIVE_APP_ID") {
        if (ts.isIdentifier(envelope) && envelope.text === "payload") interventionCalls += 1;
        if (ts.isObjectLiteralExpression(envelope) && envelope.properties.length === 1) {
          const property = envelope.properties[0];
          if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === "type" &&
              ts.isStringLiteral(property.initializer) && property.initializer.text === "get-protection-configuration") configurationCalls += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  // The closed statement allowlist rejects alias/eval dispatches, shadowing,
  // computed access and payload mutation even when the two known calls remain.
  const closedStructure = ast.parseDiagnostics.length === 0 && statements.length === 4 && appIdValid && hostsValid && payloadValid && listenerValid;
  return {
    hostsValid,
    payloadValid,
    listenerValid,
    nativeAppIdentifierValid: closedStructure && nativeMessageReferences === 2 && configurationCalls === 1 && interventionCalls === 1,
    nativePayloadSchemaValid: closedStructure,
  };
}

function exactStringSet(actual, expected) {
  if (!Array.isArray(actual) || actual.some((value) => typeof value !== "string")) return false;
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function versionAtLeast(value, minimum) {
  const parse = (input) => String(input || "").split(".").map((part) => Number.parseInt(part, 10));
  const actual = parse(value);
  const required = parse(minimum);
  if (actual.some((part) => !Number.isFinite(part))) return false;
  for (let index = 0; index < Math.max(actual.length, required.length); index += 1) {
    const left = actual[index] || 0;
    const right = required[index] || 0;
    if (left !== right) return left > right;
  }
  return true;
}

function stripJavaScriptComments(source) {
  let output = "";
  let quote = "";
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];
    if (quote) {
      output += current;
      if (escaped) escaped = false;
      else if (current === "\\") escaped = true;
      else if (current === quote) quote = "";
      continue;
    }
    if (current === '"' || current === "'" || current === "`") {
      quote = current;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      output += "  ";
      index += 2;
      while (index < source.length && source[index] !== "\n") {
        output += " ";
        index += 1;
      }
      if (index < source.length) output += "\n";
      continue;
    }
    if (current === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
        output += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < source.length) {
        output += "  ";
        index += 1;
      }
      continue;
    }
    output += current;
  }
  return output;
}

function isExecutableJavaScript(source) {
  try {
    new vm.Script(source, { filename: "SafariFocusShield-background.js" });
    return true;
  } catch {
    return false;
  }
}

function inspectSafariFocusShieldContract({ manifest, info, background, content, nativeHandlerBinary, extensionPath, iconResources }) {
  const adultRecovery = require('./safari-adult-recovery').inspectSafariAdultRecoveryArtifact({ manifest, info, extensionPath });
  const iconContract = inspectSafariFocusShieldIcons({ manifest, extensionPath, iconResources });
  const contentScripts = Array.isArray(manifest?.content_scripts) ? manifest.content_scripts : [];
  const contentScriptsScoped =
    contentScripts.length === 1 &&
    exactStringSet(contentScripts[0]?.matches, SAFARI_FOCUS_HOST_PERMISSIONS) &&
    Array.isArray(contentScripts[0]?.js) &&
    contentScripts[0].js.length === 1 &&
    contentScripts[0].js[0] === "content.js";
  const hostPermissionsScoped = exactStringSet(manifest?.host_permissions, SAFARI_FOCUS_HOST_PERMISSIONS);
  const allowedDomains = info?.NSExtension?.SFSafariWebsiteAccess?.["Allowed Domains"];
  const infoAllowedDomainsScoped =
    info?.NSExtension?.SFSafariWebsiteAccess?.Level === "Some" &&
    exactStringSet(allowedDomains, SAFARI_FOCUS_ALLOWED_DOMAINS);
  const serviceWorker = manifest?.background?.service_worker || "";
  const backgroundServiceWorkerValid = serviceWorker === "background.js";
  const executableBackground = stripJavaScriptComments(background);
  const backgroundIsExecutableJavaScript = isExecutableJavaScript(background);
  const nativeStructure = inspectNativeMessageStructure(background);
  const observationCheckValid = inspectObservationResources(manifest, extensionPath, nativeStructure, nativeHandlerBinary);
  const backgroundOwnsNativeMessaging =
    nativeStructure.listenerValid && nativeStructure.hostsValid;
  const nativeAppIdentifierValid = backgroundIsExecutableJavaScript && nativeStructure.nativeAppIdentifierValid;
  const fixedNativeEnvelope = nativeStructure.payloadValid;
  const approvedRuleHostsPresent = nativeStructure.hostsValid && Object.entries(APPROVED_RULE_HOSTS).every(
    ([rule, host]) => nativeHandlerBinary.includes(rule) && nativeHandlerBinary.includes(host),
  );
  const nativePayloadSchemaValid =
    backgroundIsExecutableJavaScript && nativeStructure.nativePayloadSchemaValid &&
    !/originalUrl|originalURL|pathname|searchParams/i.test(executableBackground);
  const nativeHandlerContractValid =
    nativeHandlerBinary.includes("record-pending-intervention") &&
    nativeHandlerBinary.includes("ios-safari-short-form") &&
    approvedRuleHostsPresent;
  const contentUsesRuntimeMessaging =
    content.includes("runtime?.sendMessage") &&
    !content.includes("sendNativeMessage") &&
    !/originalUrl|originalURL/i.test(content);
  const minimumSafariVersion = manifest?.browser_specific_settings?.safari?.strict_min_version || "";
  const minimumOSVersion = info?.MinimumOSVersion || "";
  const minimumOSVersionAtLeast154 = versionAtLeast(minimumOSVersion, "15.4");
  const manifestVersion3 = manifest?.manifest_version === 3;
  const nativeMessagingPermission =
    Array.isArray(manifest?.permissions) &&
    manifest.permissions.length === 1 &&
    manifest.permissions[0] === "nativeMessaging";
  const usableForManualEvidence =
    manifestVersion3 &&
    minimumSafariVersion === "15.4" &&
    minimumOSVersionAtLeast154 &&
    backgroundServiceWorkerValid &&
    nativeMessagingPermission &&
    hostPermissionsScoped &&
    contentScriptsScoped &&
    infoAllowedDomainsScoped &&
    backgroundOwnsNativeMessaging &&
    nativeAppIdentifierValid &&
    fixedNativeEnvelope &&
    approvedRuleHostsPresent &&
    nativePayloadSchemaValid &&
    nativeHandlerContractValid &&
    contentUsesRuntimeMessaging &&
    iconContract.iconsManifestValid &&
    iconContract.iconResourcesValid &&
    !adultRecovery.present && observationCheckValid;

  return {
    ...iconContract,
    observationCheckValid,
    packageContractVariant: adultRecovery.valid ? adultRecovery.variant : adultRecovery.present ? 'unrecognized' : 'short-form-v1',
    adultRecoveryArtifactValid: adultRecovery.valid,
    adultRecoveryPackageContractValid: adultRecovery.valid && observationCheckValid && manifestVersion3 && minimumSafariVersion === '15.4' && minimumOSVersionAtLeast154 && backgroundServiceWorkerValid && contentScriptsScoped && nativeAppIdentifierValid && nativePayloadSchemaValid && nativeHandlerContractValid && contentUsesRuntimeMessaging && iconContract.iconsManifestValid && iconContract.iconResourcesValid,
    adultRecoveryArtifact: adultRecovery.valid ? adultRecovery.artifact : null,
    adultRecoveryArtifactError: adultRecovery.present && !adultRecovery.valid ? adultRecovery.error : '',
    allowedDomains: Array.isArray(allowedDomains) ? allowedDomains : [],
    approvedRuleHostsPresent,
    backgroundIsExecutableJavaScript,
    backgroundOwnsNativeMessaging,
    backgroundServiceWorkerValid,
    contentScriptsScoped,
    contentUsesRuntimeMessaging,
    fixedNativeEnvelope,
    hostPermissions: Array.isArray(manifest?.host_permissions) ? manifest.host_permissions : [],
    hostPermissionsScoped,
    infoAllowedDomainsScoped,
    manifestVersion3,
    minimumOSVersion,
    minimumOSVersionAtLeast154,
    minimumSafariVersion,
    nativeAppIdentifierValid,
    nativeHandlerContractValid,
    nativeMessagingPermission,
    nativePayloadSchemaValid,
    serviceWorker,
    usableForManualEvidence,
  };
}

function validFixture() {
  const manifest = {
    manifest_version: 3,
    browser_specific_settings: { safari: { strict_min_version: "15.4" } },
    background: { service_worker: "background.js" },
    permissions: ["nativeMessaging"],
    icons: Object.fromEntries(SAFARI_FOCUS_ICON_SIZES.map((size) => [String(size), `icons/icon-${size}.png`])),
    host_permissions: [...SAFARI_FOCUS_HOST_PERMISSIONS],
    content_scripts: [{ matches: [...SAFARI_FOCUS_HOST_PERMISSIONS], js: ["content.js"] }],
  };
  const info = {
    MinimumOSVersion: "15.4",
    NSExtension: { SFSafariWebsiteAccess: { Level: "Some", "Allowed Domains": [...SAFARI_FOCUS_ALLOWED_DOMAINS] } },
  };
  const background = `
    const NATIVE_APP_ID = "app.freed.recovery";
    const APPROVED_RULE_HOSTS = Object.freeze({
      "short-form:youtube-shorts": "youtube.com",
      "short-form:instagram-reels": "instagram.com",
      "short-form:tiktok-feed": "tiktok.com"
    });
    function approvedNativePayload(message) {
      if (!message || typeof message !== "object") return null;
      const host = typeof message.host === "string" ? message.host : "";
      const rule = typeof message.rule === "string" ? message.rule : "";
      if (APPROVED_RULE_HOSTS[rule] !== host) return null;
      return { type: "record-pending-intervention", source: "ios-safari-short-form", host, rule };
    }
    browser.runtime.onMessage.addListener((message) => {
      if (message?.type === "get-protection-configuration") {
        return browser.runtime.sendNativeMessage(NATIVE_APP_ID, { type: "get-protection-configuration" })
          .catch(() => ({ protectionConfigurationActive: false }));
      }
      const payload = approvedNativePayload(message);
      if (!payload) return Promise.resolve({ accepted: false });
      return browser.runtime.sendNativeMessage(NATIVE_APP_ID, payload).catch(() => ({ accepted: false }));
    });
  `;
  const content = "const runtime = browser.runtime; if (runtime?.sendMessage) runtime.sendMessage({host: 'youtube.com', rule: 'short-form:youtube-shorts'});";
  const nativeHandlerBinary = `record-pending-intervention ios-safari-short-form ${Object.entries(APPROVED_RULE_HOSTS).flat().join(" ")}`;
  const iconResources = Object.fromEntries(SAFARI_FOCUS_ICON_SIZES.map((size) => [`icons/icon-${size}.png`, createRgbaPng(size, size, () => [65, 74, 206, 255])]));
  return { manifest, info, background, content, nativeHandlerBinary, iconResources };
}

function assertSafariFocusShieldContractSelfTest() {
  const fixture = validFixture();
  assert.equal(inspectSafariFocusShieldContract(fixture).usableForManualEvidence, true);
  const unsafeCases = [
    { ...fixture, manifest: { ...fixture.manifest, background: {} } },
    { ...fixture, manifest: { ...fixture.manifest, host_permissions: ["<all_urls>"] } },
    { ...fixture, manifest: { ...fixture.manifest, content_scripts: [] } },
    { ...fixture, manifest: { ...fixture.manifest, icons: undefined } },
    { ...fixture, iconResources: {} },
    { ...fixture, info: { ...fixture.info, MinimumOSVersion: "15.3" } },
    { ...fixture, info: { ...fixture.info, NSExtension: { SFSafariWebsiteAccess: { Level: "All", "Allowed Domains": ["*"] } } } },
    { ...fixture, background: fixture.background.replace("APPROVED_RULE_HOSTS", "rules") },
    { ...fixture, background: fixture.background.replace('source: "ios-safari-short-form"', 'source: "unsafe"') },
    { ...fixture, background: fixture.background.replace('"app.freed.recovery"', '"attacker.example"') },
    {
      ...fixture,
      background: fixture.background.replace(
        "return browser.runtime.sendNativeMessage(NATIVE_APP_ID, payload).catch(() => ({ accepted: false }));",
        'const method = "sendNativeMessage"; return browser.runtime[method]("attacker.example", payload); /* return browser.runtime.sendNativeMessage(NATIVE_APP_ID, payload); */',
      ),
    },
    { ...fixture, nativeHandlerBinary: "record-pending-intervention" },
    { ...fixture, content: "browser.runtime.sendNativeMessage('app.freed.recovery', {})" },
  ];
  for (const unsafe of unsafeCases) {
    assert.equal(inspectSafariFocusShieldContract(unsafe).usableForManualEvidence, false);
  }
}

module.exports = {
  APPROVED_RULE_HOSTS,
  SAFARI_FOCUS_NATIVE_APP_ID,
  SAFARI_FOCUS_ICON_SIZES,
  SAFARI_FOCUS_ALLOWED_DOMAINS,
  SAFARI_FOCUS_HOST_PERMISSIONS,
  assertSafariFocusShieldContractSelfTest,
  inspectSafariFocusShieldContract,
  inspectSafariFocusShieldIcons,
  versionAtLeast,
};
