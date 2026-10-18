"use strict";

const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash, randomUUID } = require('node:crypto');
const ts = require('typescript');
const plist = require('@expo/plist').default;
const { reviewedAdultDomainFeedSourceFamily } = require('./adult-domain-feed-source-contract');

// Internal source inventory bounds, NOT a Safari installation/capacity claim.
// One static ruleset uses Safari 15.4+ redirect/regexFilter/main_frame syntax:
// https://developer.apple.com/documentation/safariservices/blocking-content-with-your-safari-web-extension
const MAX_DOMAINS = 1000;
const MAX_FEED_BYTES = 1024 * 1024;
const VARIANT = 'adult-recovery-internal-v1';
const RULE_RESOURCE = Object.freeze({ id: 'freed_adult_recovery_internal_v1', enabled: true, path: 'adult-recovery/rules.json' });
const STATIC_FILES = Object.freeze(['kite.svg', 'page.css', 'page.html', 'page.js']);
const GENERATED_FILES = Object.freeze(['feed.json', 'rules.json', 'artifact.json']);
const RESTORE_FILE = '.freed-adult-recovery-restore.json';
// Immutable resource digests are part of this reviewed artifact version.
const RESOURCE_HASHES = Object.freeze({
  "kite.svg": "ccdcd1063035f4c284727d9eecbd9063e51af7d7e59557455cce0faf7626e6ec",
  "page.css": "4ebbbc3e0de1c3ddd573e9e7208212204a3beda80799d6c861b046edd6c75a75",
  "page.html": "bfeec207eed14268e70786ee3c22e6c05dfe3736dd192fb9c126685e05429932",
  "page.js": "53c8335e8cc0bb3d2399888afe5749d71d321987fe9fccb3d184fb093090f67f"
});
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
// plist dictionaries may have null prototypes; compare JSON data, not runtime
// prototypes or dictionary insertion order. Array order remains contractual.
function jsonData(value) {
  if (Array.isArray(value)) return value.map(jsonData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, jsonData(value[key])]));
  return value;
}
const same = (left, right) => JSON.stringify(jsonData(left)) === JSON.stringify(jsonData(right));
const matches = (host, domain) => host === domain || host.endsWith('.' + domain);
function exists(file) { try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
let engine;
function feedEngine() {
  if (!engine) {
    // Execute the existing pure producer; never duplicate its checksum/normalizer
    // or import a runtime/network provider. Type-only imports are erased.
    const file = path.resolve(__dirname, '../../src/lib/blocking-engine.ts');
    const loaded = new Module(file, module);
    loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
    engine = loaded.exports;
  }
  return engine;
}
function requireCondition(value, message) { if (!value) throw new Error(message); }
function canonicalTime(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function canonicalList(values, label) {
  requireCondition(Array.isArray(values) && values.length <= MAX_DOMAINS, `${label} capacity exceeded or invalid list.`);
  const normalize = feedEngine().normalizeAdultDomainCandidate;
  requireCondition(values.every(value => typeof value === 'string' && value === normalize(value)) && same(values, [...new Set(values)].sort()), `${label} must be canonical, sorted, unique domains.`);
}
function compileSafariAdultRecoveryArtifact(bytes, { sha256: pin, now = Date.now() } = {}) {
  requireCondition(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_FEED_BYTES, 'Adult feed input size exceeds 1 MiB or is empty.');
  requireCondition(typeof pin === 'string' && /^[a-f0-9]{64}$/.test(pin) && sha256(bytes) === pin, 'Adult feed SHA256 pin mismatch or missing.');
  requireCondition(Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes), 'Adult feed must be valid UTF-8.');
  const feed = JSON.parse(bytes.toString('utf8'));
  requireCondition(feed && same(Object.keys(feed).sort(), ['checksum', 'domains', 'exceptions', 'generatedAt', 'sources', 'version']), 'Unrecognized AdultDomainFeed shape.');
  requireCondition(typeof feed.version === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(feed.version), 'Adult feed version must be explicit.');
  requireCondition(canonicalTime(feed.generatedAt) && Number.isFinite(now) && Date.parse(feed.generatedAt) <= now + 5 * 60000 && Date.parse(feed.generatedAt) >= now - 48 * 3600000, 'Adult feed generatedAt is invalid, stale or future.');
  canonicalList(feed.domains, 'Adult domain'); canonicalList(feed.exceptions, 'Exception');
  requireCondition(feed.domains.length > 0, 'Adult feed cannot be empty.');
  requireCondition(Array.isArray(feed.sources) && feed.sources.length > 0 && feed.sources.length <= 10, 'Adult feed needs explicit source metadata.');
  const ids = new Set();
  for (const source of feed.sources) {
    requireCondition(source && same(Object.keys(source).sort(), ['domainCount', 'id', 'label', 'updatedAt']) && typeof source.id === 'string' && /^[a-z0-9-]{1,64}$/.test(source.id) && reviewedAdultDomainFeedSourceFamily(source.id) && !ids.has(source.id) && typeof source.label === 'string' && source.label.trim() === source.label && source.label.length > 0 && source.label.length <= 80 && !/[\r\n]/.test(source.label) && canonicalTime(source.updatedAt) && Date.parse(source.updatedAt) <= Date.parse(feed.generatedAt) && Date.parse(source.updatedAt) >= now - 48 * 3600000 && Number.isInteger(source.domainCount) && source.domainCount > 0 && source.domainCount <= MAX_DOMAINS, 'Adult feed source metadata is invalid or unqualified.');
    ids.add(source.id);
  }
  const readiness = feedEngine().getAdultDomainFeedReadiness(feed);
  requireCondition(readiness.ready, 'Adult feed readiness failed: ' + readiness.issues.join('; '));
  for (const [index, domain] of feed.domains.entries()) {
    requireCondition(!feed.exceptions.some(exception => matches(domain, exception) || matches(exception, domain)), 'Adult/exception domain overlap.');
    requireCondition(!feed.domains.slice(index + 1).some(other => matches(domain, other) || matches(other, domain)), 'Adult root/subdomain overlap.');
  }
  const hostPermissions = feed.domains.flatMap(domain => [`*://${domain}/*`, `*://*.${domain}/*`]);
  const allowedDomains = feed.domains.flatMap(domain => [domain, `*.${domain}`]);
  const rules = feed.domains.map((domain, index) => ({
    id: 940001 + index, priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/adult-recovery/page.html' } },
    condition: {
      // Anchor the actual authority. Adult text in userinfo/path/query cannot
      // match an ordinary host. Credentials before a protected host still match.
      regexFilter: `^https?://([^/?#@]*@)?([a-z0-9-]+[.])*${domain.replace(/\./g, '[.]')}(:[0-9]+)?([/?#]|$)`,
      isUrlFilterCaseSensitive: false, resourceTypes: ['main_frame'],
    },
  }));
  const ruleBytes = jsonBytes(rules);
  const metadata = {
    schemaVersion: VARIANT, internalOnly: true, coverage: 'pinned-input-only',
    corpusReview: 'source-metadata-is-not-corpus-review-proof',
    feed: { sha256: pin, version: feed.version, generatedAt: feed.generatedAt, checksum: feed.checksum, sources: feed.sources, domainCount: feed.domains.length },
    ruleCount: rules.length, rulesSha256: sha256(ruleBytes),
    resourceHashes: { ...RESOURCE_HASHES },
  };
  return { feed, rules, ruleBytes, metadata, hostPermissions, allowedDomains, webResources: [{ resources: ['adult-recovery/page.html'], matches: hostPermissions }] };
}
function localFile(directory, file) {
  requireCondition(!fs.lstatSync(directory).isSymbolicLink(), 'Symlink resource directory rejected.');
  requireCondition(!path.isAbsolute(file) && !file.split(/[\\/]/).some(part => part === '..' || part === '.' || part === ''), 'Unsafe adult resource path.');
  const root = fs.realpathSync(directory);
  let current = directory;
  for (const part of file.split('/')) { current = path.join(current, part); requireCondition(!fs.lstatSync(current).isSymbolicLink(), 'Symlink adult resource rejected.'); }
  requireCondition(fs.lstatSync(current).isFile() && fs.realpathSync(current).startsWith(root + path.sep), 'Missing or unsafe adult resource.');
  return fs.readFileSync(current);
}
function validateResources(directory, active) {
  requireCondition(!fs.lstatSync(directory).isSymbolicLink() && fs.lstatSync(directory).isDirectory(), 'Adult resources require a local directory.');
  requireCondition(same(fs.readdirSync(directory).sort(), [...STATIC_FILES, ...(active ? GENERATED_FILES : [])].sort()), 'Unknown or missing adult resource.');
  for (const file of STATIC_FILES) requireCondition(sha256(localFile(directory, file)) === RESOURCE_HASHES[file], 'Altered adult resource: ' + file);
}
function baseConfiguration(manifest, info) {
  const { SAFARI_FOCUS_HOST_PERMISSIONS, SAFARI_FOCUS_ALLOWED_DOMAINS } = require('./ios-safari-focus-shield-contract');
  requireCondition(same(manifest.permissions, ['nativeMessaging']) && same(manifest.host_permissions, SAFARI_FOCUS_HOST_PERMISSIONS) && manifest.declarative_net_request === undefined && manifest.web_accessible_resources === undefined && info.FREEDWebsiteRecoveryProbeEnabled === undefined && info.FREEDSafariAdultRecoveryArtifact === undefined && info.NSExtension?.SFSafariWebsiteAccess?.Level === 'Some' && same(info.NSExtension.SFSafariWebsiteAccess['Allowed Domains'], SAFARI_FOCUS_ALLOWED_DOMAINS), 'Unrecognized baseline configuration or conflicting probe.');
  requireCondition(manifest.optional_permissions === undefined && manifest.optional_host_permissions === undefined && same(Object.keys(info.NSExtension.SFSafariWebsiteAccess).sort(), ['Allowed Domains', 'Level']), 'Unknown optional/native website permission additions.');
}
function configured(baseManifest, baseInfo, artifact) {
  baseConfiguration(baseManifest, baseInfo);
  const manifest = structuredClone(baseManifest), info = structuredClone(baseInfo);
  manifest.permissions.push('declarativeNetRequestWithHostAccess');
  manifest.host_permissions.push(...artifact.hostPermissions);
  manifest.declarative_net_request = { rule_resources: [{ ...RULE_RESOURCE }] };
  manifest.web_accessible_resources = artifact.webResources;
  info.NSExtension.SFSafariWebsiteAccess['Allowed Domains'].push(...artifact.allowedDomains);
  info.FREEDSafariAdultRecoveryArtifact = VARIANT;
  return { manifest, info };
}
function inspectSafariAdultRecoveryArtifact({ manifest, info, extensionPath }) {
  const present = info?.FREEDSafariAdultRecoveryArtifact !== undefined || Boolean(manifest?.declarative_net_request) || Boolean(manifest?.web_accessible_resources);
  if (!present) return { present: false, valid: false };
  try {
    requireCondition(info.FREEDSafariAdultRecoveryArtifact === VARIANT && extensionPath, 'Unknown/missing adult variant.');
    const directory = path.join(extensionPath, 'adult-recovery');
    validateResources(directory, true);
    const bytes = localFile(directory, 'feed.json');
    const metadata = JSON.parse(localFile(directory, 'artifact.json'));
    const artifact = compileSafariAdultRecoveryArtifact(bytes, { sha256: metadata.feed?.sha256, now: Date.parse(metadata.feed?.generatedAt) });
    requireCondition(localFile(directory, 'artifact.json').equals(jsonBytes(artifact.metadata)) && localFile(directory, 'rules.json').equals(artifact.ruleBytes), 'Adult artifact metadata/rules integrity mismatch.');
    const baseManifest = structuredClone(manifest), baseInfo = structuredClone(info);
    baseManifest.permissions = ['nativeMessaging'];
    const { SAFARI_FOCUS_HOST_PERMISSIONS, SAFARI_FOCUS_ALLOWED_DOMAINS } = require('./ios-safari-focus-shield-contract');
    baseManifest.host_permissions = [...SAFARI_FOCUS_HOST_PERMISSIONS];
    delete baseManifest.declarative_net_request; delete baseManifest.web_accessible_resources;
    baseInfo.NSExtension.SFSafariWebsiteAccess['Allowed Domains'] = [...SAFARI_FOCUS_ALLOWED_DOMAINS];
    delete baseInfo.FREEDSafariAdultRecoveryArtifact;
    const expected = configured(baseManifest, baseInfo, artifact);
    requireCondition(same(manifest, expected.manifest) && same(info, expected.info), 'Adult host/native/WAR/rule scope mismatch.');
    return { present: true, valid: true, variant: VARIANT, artifact: artifact.metadata, baseManifest, baseInfo };
  } catch (error) { return { present: true, valid: false, error: error.message }; }
}
function transaction(changes) {
  const previous = changes.map(({ file }) => exists(file) ? fs.readFileSync(file) : null);
  const staged = [];
  try {
    for (const change of changes) {
      const temporary = change.file + '.freed-adult-' + randomUUID();
      staged.push(temporary);
      if (change.bytes !== null) fs.writeFileSync(temporary, change.bytes, { flag: 'wx' });
    }
    for (const [index, change] of changes.entries()) {
      if (change.bytes === null) fs.renameSync(change.file, staged[index]);
      else fs.renameSync(staged[index], change.file);
    }
  } catch (error) {
    for (const [index, change] of changes.entries()) {
      if (previous[index] !== null) fs.writeFileSync(change.file, previous[index]);
      else if (fs.existsSync(change.file)) fs.unlinkSync(change.file);
    }
    throw error;
  } finally { for (const file of staged) if (fs.existsSync(file)) fs.unlinkSync(file); }
}
function configureSafariAdultRecovery(root, inputs) {
  const flag = inputs.FREED_SAFARI_ADULT_RECOVERY;
  requireCondition(flag === undefined || flag === '' || flag === '0' || flag === '1', 'FREED_SAFARI_ADULT_RECOVERY must be 0 or 1.');
  const directory = path.join(root, 'ios/FREEDSafariFocusShield');
  const manifestBytes = localFile(directory, 'manifest.json'), infoBytes = localFile(directory, 'Info.plist');
  const manifest = JSON.parse(manifestBytes), info = plist.parse(infoBytes.toString());
  const active = info.FREEDSafariAdultRecoveryArtifact !== undefined;
  const restorePath = path.join(directory, RESTORE_FILE);
  if (flag !== '1' && !active) {
    requireCondition(!exists(restorePath) && !inputs.FREED_SAFARI_ADULT_FEED_PATH && !inputs.FREED_SAFARI_ADULT_FEED_SHA256, 'Unexpected adult restore/feed inputs while disabled.');
    return null;
  }
  requireCondition(inputs.FREED_SAFARI_RECOVERY_PROBE !== '1', 'Safari adult/probe modes conflict.');
  if (flag === '1') requireCondition(inputs.EAS_BUILD_PROFILE === 'internal', 'Safari adult artifact requires explicit internal profile.');
  let originalManifest = manifestBytes, originalInfo = infoBytes;
  if (active) {
    const inspection = inspectSafariAdultRecoveryArtifact({ manifest, info, extensionPath: directory });
    requireCondition(inspection.valid, inspection.error || 'Invalid adult package.');
    const restore = JSON.parse(localFile(directory, RESTORE_FILE));
    requireCondition(same(Object.keys(restore).sort(), ['info', 'manifest', 'schemaVersion']) && restore.schemaVersion === VARIANT, 'Unknown adult restore record.');
    originalManifest = Buffer.from(restore.manifest, 'base64'); originalInfo = Buffer.from(restore.info, 'base64');
    const { SAFARI_FOCUS_HOST_PERMISSIONS, SAFARI_FOCUS_ALLOWED_DOMAINS } = require('./ios-safari-focus-shield-contract');
    const expected = configured(JSON.parse(originalManifest), plist.parse(originalInfo.toString()), { hostPermissions: manifest.host_permissions.slice(SAFARI_FOCUS_HOST_PERMISSIONS.length), allowedDomains: info.NSExtension.SFSafariWebsiteAccess['Allowed Domains'].slice(SAFARI_FOCUS_ALLOWED_DOMAINS.length), webResources: manifest.web_accessible_resources });
    requireCondition(same(manifest, expected.manifest) && same(info, expected.info), 'Adult restore/current configuration mismatch.');
  } else {
    requireCondition(!exists(restorePath), 'Unknown existing adult restore record.');
    baseConfiguration(manifest, info); validateResources(path.join(directory, 'adult-recovery'), false);
  }
  const resourceDirectory = path.join(directory, 'adult-recovery');
  let writes;
  if (flag === '1') {
    requireCondition(typeof inputs.FREED_SAFARI_ADULT_FEED_PATH === 'string' && inputs.FREED_SAFARI_ADULT_FEED_PATH.length > 0, 'Explicit pinned adult feed path required.');
    const feedPath = path.resolve(root, inputs.FREED_SAFARI_ADULT_FEED_PATH);
    requireCondition(fs.lstatSync(feedPath).isFile() && !fs.lstatSync(feedPath).isSymbolicLink() && fs.statSync(feedPath).size <= MAX_FEED_BYTES, 'Unsafe adult feed path or input size.');
    const bytes = fs.readFileSync(feedPath);
    const artifact = compileSafariAdultRecoveryArtifact(bytes, { sha256: inputs.FREED_SAFARI_ADULT_FEED_SHA256 });
    const result = configured(JSON.parse(originalManifest), plist.parse(originalInfo.toString()), artifact);
    writes = [bytes, artifact.ruleBytes, jsonBytes(artifact.metadata), jsonBytes({ schemaVersion: VARIANT, manifest: originalManifest.toString('base64'), info: originalInfo.toString('base64') }), jsonBytes(result.manifest), Buffer.from(plist.build(result.info))];
  } else writes = [null, null, null, null, originalManifest, originalInfo];
  const files = [...GENERATED_FILES.map(file => path.join(resourceDirectory, file)), restorePath, path.join(directory, 'manifest.json'), path.join(directory, 'Info.plist')];
  const changes = files.map((file, index) => ({ file, bytes: writes[index] })).filter(({ file, bytes }) => bytes === null || !fs.existsSync(file) || !fs.readFileSync(file).equals(bytes));
  transaction(changes);
  return { enabled: flag === '1', profile: inputs.EAS_BUILD_PROFILE ?? null, variant: VARIANT, internalOnly: true };
}

module.exports = { compileSafariAdultRecoveryArtifact, configureSafariAdultRecovery, inspectSafariAdultRecoveryArtifact, MAX_DOMAINS, MAX_FEED_BYTES, VARIANT };
