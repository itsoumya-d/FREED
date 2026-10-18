"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { cpSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, copyFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const { createRgbaPng } = require("../scripts/lib/png-screenshot-audit");
const {
  assertSafariFocusShieldContractSelfTest,
  inspectSafariFocusShieldContract,
} = require("../scripts/lib/ios-safari-focus-shield-contract");

const sourceExtension = resolve(__dirname, "../ios/FREEDSafariFocusShield");
const archiveExtension = process.env.FREED_SAFARI_FOCUS_SHIELD_ARCHIVE_EXTENSION;
const rejectedArchiveExtension = process.env.FREED_SAFARI_FOCUS_SHIELD_REJECTED_ARCHIVE_EXTENSION;
const sourceBackground = readFileSync(join(sourceExtension, "background.js"), "utf8");

function readInfo(extension) {
  const result = spawnSync("plutil", ["-convert", "json", "-o", "-", join(extension, "Info.plist")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function sourceFixture(background = sourceBackground) {
  return {
    manifest: JSON.parse(readFileSync(join(sourceExtension, "manifest.json"), "utf8")),
    info: { ...readInfo(sourceExtension), MinimumOSVersion: "15.4" },
    background,
    content: readFileSync(join(sourceExtension, "content.js"), "utf8"),
    nativeHandlerBinary: readFileSync(join(sourceExtension, "SafariWebExtensionHandler.swift"), "utf8"),
    extensionPath: sourceExtension,
  };
}

const fixture = sourceFixture();
const inspect = background => inspectSafariFocusShieldContract({ ...fixture, background });

function mutate(before, after) {
  assert.ok(sourceBackground.includes(before), `Mutation must change the real background: ${before}`);
  return sourceBackground.replace(before, after);
}

test("the real Safari background accepts the retained configuration/intervention paths and the closed observation contract", () => {
  const result = inspect(sourceBackground);
  assert.equal(result.nativeAppIdentifierValid, true);
  assert.equal(result.nativePayloadSchemaValid, true);
  assert.equal(result.usableForManualEvidence, true);
});

test("the archived Safari background has the same approved contract as the actual source", { skip: !archiveExtension }, () => {
  const info = readInfo(archiveExtension);
  const background = readFileSync(join(archiveExtension, "background.js"), "utf8");
  const digest = value => createHash("sha256").update(value).digest("hex");
  assert.equal(digest(background), digest(sourceBackground), "archive/source regression must exercise the same bundled JavaScript");
  const result = inspectSafariFocusShieldContract({
    manifest: JSON.parse(readFileSync(join(archiveExtension, "manifest.json"), "utf8")),
    info,
    background,
    content: readFileSync(join(archiveExtension, "content.js"), "utf8"),
    nativeHandlerBinary: readFileSync(join(archiveExtension, info.CFBundleExecutable)).toString("latin1"),
    extensionPath: archiveExtension,
  });
  assert.equal(result.nativeAppIdentifierValid, true);
  assert.equal(result.nativePayloadSchemaValid, true);
  assert.equal(result.usableForManualEvidence, true);
});

test("approved JavaScript structure tolerates comments, quote style and spacing", () => {
  const formatted = sourceBackground.replaceAll('"', "'")
    .replace("browser.runtime.onMessage", "browser . runtime . onMessage")
    .replace("const payload", "/* read and write stay separate */\nconst payload");
  assert.equal(inspect(formatted).usableForManualEvidence, true);
});

const configurationCall = 'browser.runtime.sendNativeMessage(NATIVE_APP_ID, { type: "get-protection-configuration" })';
const interventionCall = ".sendNativeMessage(NATIVE_APP_ID, payload)";
const configurationBranch = `  if (message?.type === "get-protection-configuration") {
    return ${configurationCall}
      .catch(() => ({ protectionConfigurationActive: false }));
  }
`;

const unsafeMutations = [
  ["wrong fixed app identifier", '"app.freed.recovery"', '"attacker.example"'],
  ["computed app identifier", '"app.freed.recovery"', '"app.freed." + "recovery"'],
  ["mutable app identifier", "const NATIVE_APP_ID", "let NATIVE_APP_ID"],
  ["configuration target comes from the message", configurationCall, configurationCall.replace("NATIVE_APP_ID", "message.nativeAppId")],
  ["intervention target comes from the message", interventionCall, interventionCall.replace("NATIVE_APP_ID", "message.nativeAppId")],
  ["configuration uses a computed method", configurationCall, configurationCall.replace(".sendNativeMessage", '["sendNativeMessage"]')],
  ["intervention uses a computed runtime", "browser.runtime\n    .sendNativeMessage", 'browser["runtime"]\n    .sendNativeMessage'],
  ["intervention uses a computed method", interventionCall, interventionCall.replace(".sendNativeMessage", '["send" + "NativeMessage"]')],
  ["configuration forwards the dynamic input", configurationCall, configurationCall.replace('{ type: "get-protection-configuration" }', "message")],
  ["configuration envelope has an extra field", configurationCall, configurationCall.replace('{ type: "get-protection-configuration" }', '{ type: "get-protection-configuration", host: message.host }')],
  ["configuration envelope has a spread", configurationCall, configurationCall.replace('{ type: "get-protection-configuration" }', '{ type: "get-protection-configuration", ...message }')],
  ["configuration envelope uses a getter", configurationCall, configurationCall.replace('{ type: "get-protection-configuration" }', '{ get type() { return "get-protection-configuration"; } }')],
  ["configuration type is wrong", configurationCall, configurationCall.replace('{ type: "get-protection-configuration" }', '{ type: "record-pending-intervention" }')],
  ["configuration branch is missing", configurationBranch, ""],
  ["intervention call is missing", interventionCall, ".sendMessage(payload)"],
  ["intervention forwards the dynamic input", interventionCall, ".sendNativeMessage(NATIVE_APP_ID, message)"],
  ["intervention has a third argument", interventionCall, ".sendNativeMessage(NATIVE_APP_ID, payload, message)"],
  ["intervention type is wrong", 'type: "record-pending-intervention"', 'type: "other-intervention"'],
  ["intervention source is wrong", 'source: "ios-safari-short-form"', 'source: "other-source"'],
  ["intervention envelope has an extra field", "    host,\n    rule", "    host,\n    rule,\n    extra: message.extra"],
  ["intervention envelope has a spread", "    host,\n    rule", "    host,\n    rule,\n    ...message"],
  ["intervention payload is changed after validation", "  if (!payload)", "  if (payload) payload.host = message.otherHost;\n  if (!payload)"],
  ["invalid rule/host pairs bypass validation", "if (APPROVED_RULE_HOSTS[rule] !== host)", "if (false)"],
  ["host validation guard is reversed", "APPROVED_RULE_HOSTS[rule] !== host", "APPROVED_RULE_HOSTS[rule] === host"],
  ["unapproved hosts are added", '"short-form:tiktok-feed": "tiktok.com"', '"short-form:tiktok-feed": "tiktok.com", "short-form:other-feed": "attacker.example"'],
  ["host mapping is replaced", '"short-form:youtube-shorts": "youtube.com"', '"short-form:youtube-shorts": "attacker.example"'],
  ["host mapping is mutable", "Object.freeze({", "({"],
  ["host input type check is removed", 'typeof message.host === "string" ? message.host : ""', "message.host"],
  ["rule input type check is removed", 'typeof message.rule === "string" ? message.rule : ""', "message.rule"],
  ["message object guard is removed", '  if (!message || typeof message !== "object") return null;\n', ""],
  ["intervention rejection guard is removed", '  if (!payload) return Promise.resolve({ accepted: false });\n', ""],
  ["app identifier is shadowed", "(message, sender) => {", '(message, sender) => { const NATIVE_APP_ID = "attacker.example";'],
  ["payload helper is shadowed", "(message, sender) => {", "(message, sender) => { const approvedNativePayload = value => value;"],
];

for (const [name, before, after] of unsafeMutations) {
  test(`source contract rejects ${name}`, () => {
    assert.equal(inspect(mutate(before, after)).usableForManualEvidence, false);
  });
}

for (const [name, extra] of [
  ["an extra direct call", `\n${configurationCall};`],
  ["an extra computed call", '\nbrowser.runtime["send" + "NativeMessage"]("attacker.example", {});'],
  ["a native messaging alias", '\nconst send = browser.runtime.sendNativeMessage; send("attacker.example", {});'],
  ["a computed runtime alias", '\nconst runtime = browser["runtime"]; runtime["send" + "NativeMessage"]("attacker.example", {});'],
  ["duplicate app identifier declarations in a new scope", '\n{ const NATIVE_APP_ID = "app.freed.recovery"; }'],
  ["an eval dispatch", '\neval("browser.runtime.sendNativeMessage(\\\"attacker.example\\\", {})");'],
  ["syntactically malformed background", "\n}"],
]) {
  test(`source contract rejects ${name}`, () => assert.equal(inspect(sourceBackground + extra).usableForManualEvidence, false));
}

test("source contract rejects missing or comment-only background resources", () => {
  for (const background of ["", "/* no executable background */"]) {
    assert.equal(inspect(background).usableForManualEvidence, false);
  }
});

test("actual background execution sends exact schemas and rejects invalid rule/host pairs", async () => {
  let listener;
  const sent = [];
  vm.runInNewContext(sourceBackground, { browser: { runtime: {
    onMessage: { addListener(value) { listener = value; } },
    sendNativeMessage(appId, payload) {
      sent.push({ appId, payload: JSON.parse(JSON.stringify(payload)) });
      return Promise.resolve({ accepted: true });
    },
  } } }, { timeout: 1000 });
  await listener({ type: "get-protection-configuration", host: "attacker.example", extra: "discarded" });
  await listener({ host: "youtube.com", rule: "short-form:youtube-shorts", extra: "discarded" });
  assert.deepEqual(sent, [
    { appId: "app.freed.recovery", payload: { type: "get-protection-configuration" } },
    { appId: "app.freed.recovery", payload: { type: "record-pending-intervention", source: "ios-safari-short-form", host: "youtube.com", rule: "short-form:youtube-shorts" } },
  ]);
  for (const message of [null, {}, { host: "attacker.example", rule: "short-form:youtube-shorts" }, { host: "youtube.com", rule: "short-form:other-feed" }]) {
    const result = await listener(message);
    assert.equal(result.accepted, false);
  }
  assert.equal(sent.length, 2);
});

test("the existing offline Safari contract self-test retains its safety cases", () => {
  assertSafariFocusShieldContractSelfTest();
});

const expectedIcons = { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" };
const iconFixture = () => Object.fromEntries(Object.entries(expectedIcons).map(([size, file]) => [file, createRgbaPng(Number(size), Number(size), () => [65, 74, 206, 255])]));
const invalidChecksumIcon = Buffer.from(iconFixture()["icons/icon-16.png"]);
invalidChecksumIcon[invalidChecksumIcon.length - 1] ^= 1;
const inspectIcons = (icons, iconResources = iconFixture()) => inspectSafariFocusShieldContract({
  ...fixture, extensionPath: undefined, manifest: { ...fixture.manifest, icons }, iconResources,
});

test("missing manifest icons reproduces Apple upload validation 90849", () => {
  const { icons, ...manifest } = fixture.manifest;
  const result = inspectSafariFocusShieldContract({ ...fixture, manifest });
  assert.equal(result.iconsManifestValid, false);
  assert.equal(result.usableForManualEvidence, false);
});

test("the four original kite PNGs have safe paths and their advertised dimensions", () => {
  assert.deepEqual(fixture.manifest.icons, expectedIcons);
  const result = inspect(sourceBackground);
  assert.equal(result.iconsManifestValid, true);
  assert.equal(result.iconResourcesValid, true);
  assert.equal(result.usableForManualEvidence, true);
  assert.deepEqual(result.icons.map(icon => [icon.size, icon.path, icon.width, icon.height, icon.valid]), [
    [16, "icons/icon-16.png", 16, 16, true], [32, "icons/icon-32.png", 32, 32, true],
    [48, "icons/icon-48.png", 48, 48, true], [128, "icons/icon-128.png", 128, 128, true],
  ]);
});

test("the rejected archive preserves valid messaging but fails its missing icon packaging", { skip: !rejectedArchiveExtension }, () => {
  const manifest = JSON.parse(readFileSync(join(rejectedArchiveExtension, "manifest.json"), "utf8"));
  assert.equal(manifest.icons, undefined, "this receipt must use the original iconless rejected package");
  const result = inspectSafariFocusShieldContract({ ...fixture, manifest, extensionPath: rejectedArchiveExtension });
  assert.equal(result.nativeAppIdentifierValid, true);
  assert.equal(result.iconsManifestValid, false);
  assert.equal(result.usableForManualEvidence, false);
});

for (const [name, icons] of [
  ["missing", undefined], ["array", []], ["empty", {}], ["non-numeric key", { ...expectedIcons, small: "icons/icon-16.png" }],
  ["non-string value", { ...expectedIcons, "16": 16 }], ["missing size", { "16": "icons/icon-16.png" }],
  ["absolute path", { ...expectedIcons, "16": "/tmp/icon.png" }], ["traversal", { ...expectedIcons, "16": "icons/../icon.png" }],
  ["URL", { ...expectedIcons, "16": "https://attacker.example/icon.png" }],
  ["encoded traversal", { ...expectedIcons, "16": "icons/%2e%2e/icon.png" }],
  ["wrong extension", { ...expectedIcons, "16": "icons/icon-16.svg" }],
]) {
  test(`icon contract rejects ${name} manifest entries`, () => assert.equal(inspectIcons(icons).usableForManualEvidence, false));
}

for (const [name, resources] of [
  ["missing files", {}],
  ["wrong image type", { ...iconFixture(), "icons/icon-16.png": Buffer.from("<svg></svg>") }],
  ["wrong dimensions", { ...iconFixture(), "icons/icon-16.png": createRgbaPng(32, 32, () => [65, 74, 206, 255]) }],
  ["truncated PNG", { ...iconFixture(), "icons/icon-16.png": iconFixture()["icons/icon-16.png"].subarray(0, 33) }],
  ["corrupt PNG checksum", { ...iconFixture(), "icons/icon-16.png": invalidChecksumIcon }],
]) {
  test(`icon contract rejects ${name}`, () => assert.equal(inspectIcons(expectedIcons, resources).usableForManualEvidence, false));
}

test("icon contract rejects resource symlinks escaping the actual extension bundle", () => {
  const workspace = mkdtempSync(join(tmpdir(), "freed-safari-icon-path-"));
  try {
    const extensionPath = join(workspace, "extension");
    mkdirSync(join(extensionPath, "icons"), { recursive: true });
    for (const [file, data] of Object.entries(iconFixture())) writeFileSync(join(extensionPath, file), data);
    const outside = join(workspace, "outside.png");
    writeFileSync(outside, iconFixture()["icons/icon-16.png"]);
    rmSync(join(extensionPath, "icons/icon-16.png"));
    symlinkSync(outside, join(extensionPath, "icons/icon-16.png"));
    const result = inspectSafariFocusShieldContract({ ...fixture, manifest: { ...fixture.manifest, icons: expectedIcons }, extensionPath });
    assert.equal(result.iconResourcesValid, false);
    assert.equal(result.usableForManualEvidence, false);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test("a manifest alone cannot establish that icon resources were bundled", () => {
  const result = inspectSafariFocusShieldContract({ ...fixture, manifest: { ...fixture.manifest, icons: expectedIcons }, extensionPath: undefined });
  assert.equal(result.iconResourcesValid, false);
  assert.equal(result.usableForManualEvidence, false);
});

test("the tracked Xcode resource phase copies the icons folder only into Safari Focus Shield", () => {
  const code = `require "xcodeproj"; require "json"; project = Xcodeproj::Project.open(ARGV[0]); puts JSON.generate(project.targets.to_h { |target| [target.name, target.resources_build_phase.files_references.select { |ref| ["icons", "safari-observation"].include?(ref.path) }.map { |ref| {path: ref.path, type: ref.last_known_file_type} }] })`;
  const result = spawnSync("ruby", ["-e", code, resolve(__dirname, "../ios/FREED.xcodeproj")], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const resources = JSON.parse(result.stdout);
  assert.deepEqual(resources.FREEDSafariFocusShield, [{ path: "icons", type: "folder" }, { path: "safari-observation", type: "folder" }]);
  for (const [target, folders] of Object.entries(resources)) if (target !== "FREEDSafariFocusShield") assert.deepEqual(folders, [], target);
});

test("native extension generation recreates missing icon assets and preserves folder bundling", () => {
  const workspace = mkdtempSync(join(tmpdir(), "freed-safari-icon-generator-"));
  try {
    for (const directory of ["scripts", "assets/brand", "ios/FREED.xcodeproj", "ios/FREED", "ios/FREEDShieldConfiguration", "ios/FREEDShieldAction", "ios/FREEDDeviceActivityMonitor", "ios/FREEDSafariContentBlocker", "ios/FREEDSafariFocusShield"]) {
      mkdirSync(join(workspace, directory), { recursive: true });
    }
    for (const file of ["scripts/add-ios-screen-time-extensions.rb", "assets/brand/freed-symbol.svg", "ios/FREED.xcodeproj/project.pbxproj", "ios/FREED/Info.plist", "ios/FREEDShieldConfiguration/Info.plist", "ios/FREEDShieldAction/Info.plist", "ios/FREEDDeviceActivityMonitor/Info.plist", "ios/FREEDSafariContentBlocker/Info.plist"]) {
      copyFileSync(resolve(__dirname, "..", file), join(workspace, file));
    }
    copyFileSync(resolve(__dirname, '../scripts/configure-safari-recovery-probe.js'), join(workspace, 'scripts/configure-safari-recovery-probe.js'));
    symlinkSync(resolve(__dirname, '../scripts/lib'), join(workspace, 'scripts/lib'));
    symlinkSync(resolve(__dirname, "../node_modules"), join(workspace, "node_modules"));
    const extensionPath = join(workspace, "ios/FREEDSafariFocusShield");
    copyFileSync(join(sourceExtension, 'Info.plist'), join(extensionPath, 'Info.plist'));
    cpSync(join(sourceExtension, 'safari-observation'), join(extensionPath, 'safari-observation'), {recursive:true});
    mkdirSync(join(extensionPath, 'recovery-probe'));
    for (const file of ['page.html', 'page.css', 'page.js', 'kite.svg', 'rules.json']) copyFileSync(join(sourceExtension, 'recovery-probe', file), join(extensionPath, 'recovery-probe', file));
    const { icons, ...oldManifest } = fixture.manifest;
    writeFileSync(join(extensionPath, "manifest.json"), JSON.stringify(oldManifest));
    const removedReference = spawnSync("ruby", ["-e", 'require "xcodeproj"; p = Xcodeproj::Project.open(ARGV[0]); p.files.select { |ref| ref.path == "icons" }.each(&:remove_from_project); p.save', join(workspace, "ios/FREED.xcodeproj")], { encoding: "utf8" });
    assert.equal(removedReference.status, 0, removedReference.stderr);
    for (let run = 0; run < 2; run += 1) {
      const generated = spawnSync("ruby", ["scripts/add-ios-screen-time-extensions.rb"], { cwd: workspace, env: { ...process.env, FREED_SAFARI_RECOVERY_PROBE: '0' }, encoding: "utf8", timeout: 30000 });
      assert.equal(generated.status, 0, generated.stdout + generated.stderr);
      const manifest = JSON.parse(readFileSync(join(extensionPath, "manifest.json"), "utf8"));
      assert.deepEqual(manifest.icons, expectedIcons);
      const { icons: generatedIcons, ...preservedManifest } = manifest;
      assert.deepEqual(preservedManifest, oldManifest, "icon generation must preserve every policy/resource setting");
      const contract = inspectSafariFocusShieldContract({ ...fixture, manifest, extensionPath });
      assert.equal(contract.iconResourcesValid, true);
      for (const file of Object.values(expectedIcons)) assert.deepEqual(readFileSync(join(extensionPath, file)), readFileSync(join(sourceExtension, file)));
      const references = spawnSync("ruby", ["-e", 'require "xcodeproj"; p = Xcodeproj::Project.open(ARGV[0]); t = p.targets.find { |target| target.name == "FREEDSafariFocusShield" }; puts t.resources_build_phase.files_references.count { |ref| ref.path == "icons" && ref.last_known_file_type == "folder" }', join(workspace, "ios/FREED.xcodeproj")], { encoding: "utf8" });
      assert.equal(references.status, 0, references.stderr);
      assert.equal(references.stdout.trim(), "1", "regeneration must keep exactly one non-flattened icon folder");
      const probeFolder = spawnSync('ruby', ['-e', 'require "xcodeproj"; p=Xcodeproj::Project.open(ARGV[0]); t=p.targets.find { |t| t.name=="FREEDSafariFocusShield" }; puts t.resources_build_phase.files_references.count { |r| r.path=="recovery-probe" && r.last_known_file_type=="folder" }', join(workspace, 'ios/FREED.xcodeproj')], { encoding: 'utf8' });
      assert.equal(probeFolder.status, 0, probeFolder.stderr);
      assert.equal(probeFolder.stdout.trim(), '1', 'regeneration must keep exactly one bundled local probe folder without enabling its rules');
      const retainedSources = spawnSync('ruby', ['-e', 'require "xcodeproj"; require "json"; p=Xcodeproj::Project.open(ARGV[0]); puts JSON.generate(p.targets.to_h { |t| [t.name, t.source_build_phase.files_references.map(&:path).select { |path| path.include?("FreedRetainedAdultProtection") || path.include?("FreedAdultProtectionLock") || path.include?("FreedFriendLock") }] })', join(workspace, 'ios/FREED.xcodeproj')], { encoding: 'utf8' });
      assert.equal(retainedSources.status, 0, retainedSources.stderr);
      const retainedByTarget = JSON.parse(retainedSources.stdout);
      const expectedRetentionTargets = new Set(['FREEDShieldAction', 'FREEDDeviceActivityMonitor', 'FREEDSafariContentBlocker', 'FREEDSafariFocusShield']);
      for (const [target, sources] of Object.entries(retainedByTarget)) {
        assert.deepEqual(sources, expectedRetentionTargets.has(target) ? ['../modules/freed-protection/ios/FreedRetainedAdultProtection.swift'] : [], `${target}: only the non-secret retained policy is shared, exactly once`);
      }
      const allSources = spawnSync('ruby', ['-e', 'require "xcodeproj"; require "json"; p=Xcodeproj::Project.open(ARGV[0]); puts JSON.generate(p.targets.to_h { |t| [t.name, t.source_build_phase.files_references.map(&:path)] })', join(workspace, 'ios/FREED.xcodeproj')], { encoding: 'utf8' });
      assert.equal(allSources.status, 0, allSources.stderr);
      const runtimeTargets = new Set(['FREEDDeviceActivityMonitor', 'FREEDShieldAction']);
      const sharedHelpers = ['FreedAccountProtectionCleanup.swift', 'FreedAccountBindingSession.swift'];
      const hostOnly = /FreedProtectionModule|FreedAdultProtectionRuntime|FreedAdultProtectionLockCoordinator|FreedAdultProtectionOperationStore|FreedNativeAdultMutationAdapter|FreedFriendLock|FreedAccountBindingSessionBridge/;
      for (const [target, sources] of Object.entries(JSON.parse(allSources.stdout))) {
        for (const helper of sharedHelpers) {
          assert.equal(sources.filter(source => source.endsWith('/' + helper)).length, runtimeTargets.has(target) ? 1 : 0, `${target}: ${helper} follows runtime membership exactly once`);
        }
        assert.equal(sources.some(source => source.endsWith('/FreedAppGroupsRuntime.swift')), runtimeTargets.has(target), `${target}: runtime target closure stays bounded`);
        if (target !== 'FREED') assert.deepEqual(sources.filter(source => hostOnly.test(source)), [], `${target}: host core, coordinator, protected store, verifier and Expo bridge stay excluded`);
      }
      const sharedSession = readFileSync(resolve(__dirname, '../modules/freed-protection/ios/FreedAccountBindingSession.swift'), 'utf8');
      assert.doesNotMatch(sharedSession, /import ExpoModulesCore|:\s*SharedObject|canImport\(ExpoModulesCore\)/, 'shared lifecycle remains independent even when Expo can be imported');

    }
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

// Task96A intentionally extends the closed contract, with no permission exemption.
test("own check contract rejects optional permissions, unknown action/script resources and a stale native endpoint", () => {
  for (const mutateManifest of [m => m.optional_permissions = ['tabs'], m => m.optional_host_permissions = ['<all_urls>'], m => m.externally_connectable = {matches:['<all_urls>']}, m => m.action.default_popup='other.html', m => m.background.scripts=['other.js']]) {
    const manifest=structuredClone(fixture.manifest);mutateManifest(manifest);
    assert.equal(inspectSafariFocusShieldContract({...fixture,manifest}).usableForManualEvidence,false);
  }
  assert.equal(inspectSafariFocusShieldContract({...fixture,nativeHandlerBinary:fixture.nativeHandlerBinary.replaceAll('begin-safari-recovery-observation','other-operation')}).observationCheckValid,false);
});

test('observation closed AST binds numeric deadlines/counts and regex contents',()=>{
 for(const [before,after] of [['30000','999999'],['4012','999999'],['/^[a-f0-9]{64}$/','/.*/']]){
  assert.ok(sourceBackground.includes(before));assert.equal(inspect(sourceBackground.replaceAll(before,after)).nativePayloadSchemaValid,false,before);
 }
});
