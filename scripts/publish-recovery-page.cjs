#!/usr/bin/env node
'use strict';

// Narrow, additive publisher. Importing this module does not load Firebase or authenticate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { Readable } = require('node:stream');
const { isDeepStrictEqual } = require('node:util');

const PROJECT = 'freed-7d5ee';
const SITE = 'freed-landing';
const SITE_NAME = `projects/${PROJECT}/sites/${SITE}`;
const ALLOWED_UPLOAD_ORIGIN = 'https://upload-firebasehosting.googleapis.com';
const FILES = Object.freeze([
  ['website/recovery.html', '/recovery.html'],
  ['website/assets/recovery.css', '/assets/recovery.css'],
  ['website/assets/recovery.js', '/assets/recovery.js'],
  ['website/assets/recovery-kite.png', '/assets/recovery-kite.png'],
]);
const EVIDENCE = '.superpowers/sdd/2026-10-13-publishable-recovery/task-68';
const CSP = "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'";
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = (value) => structuredClone(value);

function optionsWithDefaults(options = {}) {
  const workspaceRoot = options.workspaceRoot || path.resolve(__dirname, '..');
  return {
    ...options,
    workspaceRoot,
    manifestPath: options.manifestPath || path.join(workspaceRoot, EVIDENCE, 'page-fix1/manifest.json'),
    baselinePath: options.baselinePath || path.join(workspaceRoot, EVIDENCE, 'hosting-before.json'),
    receiptPath: options.receiptPath || path.join(workspaceRoot, EVIDENCE, 'publisher/published-receipt.json'),
  };
}

function versionName(value) {
  const name = typeof value === 'string' ? value : value?.name;
  if (typeof name !== 'string' || !name.startsWith(`${SITE_NAME}/versions/`) ||
      !/^[A-Za-z0-9_-]+$/.test(name.slice(`${SITE_NAME}/versions/`.length))) {
    throw new Error('Invalid version resource for the pinned Hosting site');
  }
  return name;
}

function fileMap(files) {
  if (!Array.isArray(files)) throw new Error('Invalid Hosting file inventory');
  const map = {};
  for (const file of files) {
    if (typeof file.path !== 'string' || !file.path.startsWith('/') ||
        typeof file.hash !== 'string' || !file.hash || file.status !== 'ACTIVE' ||
        Object.hasOwn(map, file.path)) throw new Error('Invalid or duplicate Hosting file entry');
    Object.defineProperty(map, file.path, { value: file.hash, enumerable: true, configurable: true, writable: true });
  }
  return map;
}

function prepare(options) {
  const manifest = JSON.parse(fs.readFileSync(options.manifestPath, 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(options.baselinePath, 'utf8'));
  if (baseline.project !== PROJECT || baseline.site !== SITE ||
      baseline.channel !== `${SITE_NAME}/channels/live`) throw new Error('Baseline target does not match the pinned project/site/live channel');
  versionName(baseline.version);
  if (!baseline.config || typeof baseline.config !== 'object' || Array.isArray(baseline.config)) throw new Error('Invalid baseline config');
  const priorFiles = fileMap(baseline.files);
  const uploads = new Map();
  const fileHashes = {};
  const sourceHashes = {};
  function verifySource() {
    for (const [source] of FILES) {
      const expected = manifest.source?.[source];
      const bytes = fs.readFileSync(path.join(options.workspaceRoot, source));
      if (!/^[a-f0-9]{64}$/.test(expected || '') || sha256(bytes) !== expected) {
        throw new Error(`Pinned source hash mismatch for ${source}`);
      }
    }
  }
  verifySource();
  for (const [source, hostedPath] of FILES) {
    const bytes = fs.readFileSync(path.join(options.workspaceRoot, source));
    // Recheck the bytes actually frozen for upload, avoiding a read/read race.
    if (sha256(bytes) !== manifest.source[source]) throw new Error(`Pinned source hash mismatch for ${source}`);
    const gzip = zlib.gzipSync(bytes, { level: 9 });
    const hash = sha256(gzip);
    uploads.set(hash, gzip);
    fileHashes[hostedPath] = hash;
    sourceHashes[source] = manifest.source[source];
  }
  const config = clone(baseline.config);
  config.headers = [...(config.headers || []), ...['/recovery', ...FILES.map(([, hostedPath]) => hostedPath)].map(glob => ({
    glob,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...(['/recovery', '/recovery.html'].includes(glob) ? { 'Content-Security-Policy': CSP } : {}),
    },
  }))];
  return { baseline, priorFiles, uploads, fileHashes, sourceHashes, config, verifySource,
    files: { ...priorFiles, ...fileHashes } };
}

async function planRecoveryPublish(rawOptions = {}) {
  const options = optionsWithDefaults(rawOptions);
  const prepared = prepare(options);
  return {
    schemaVersion: 1,
    mode: 'dry-run',
    mutationPerformed: false,
    project: PROJECT,
    site: SITE,
    priorVersion: prepared.baseline.version,
    publishedPaths: FILES.map(([, hostedPath]) => hostedPath),
    fileHashes: prepared.fileHashes,
    sourceHashes: prepared.sourceHashes,
    preservedFileCount: prepared.baseline.files.length,
    plannedFileCount: Object.keys(prepared.files).length,
    config: prepared.config,
    liveVersionChecked: false,
  };
}

function validateUploadUrl(value, version) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Refusing unapproved Firebase upload origin'); }
  if (url.origin !== ALLOWED_UPLOAD_ORIGIN || url.username || url.password || url.search || url.hash) {
    throw new Error('Refusing unapproved Firebase upload origin');
  }
  const id = version.split('/').at(-1);
  if (url.pathname !== `/upload/sites/${SITE}/versions/${id}/files`) throw new Error('Refusing unexpected Firebase upload path');
  return url.href;
}

async function publishRecoveryPage(rawOptions = {}) {
  const options = optionsWithDefaults(rawOptions);
  const prepared = prepare(options); // Must run before even authentication or remote reads.
  const { baseline, priorFiles, files, config, uploads, verifySource } = prepared;
  if (fs.existsSync(options.receiptPath)) throw new Error('Receipt already exists; preserve it and use a fresh evidence destination');
  const client = options.client || await createFirebaseClient(options);
  const live = await client.getLiveRelease();
  if (versionName(live.version) !== baseline.version) throw new Error('Baseline version fence failed');
  const liveVersion = await client.getVersion({ version: baseline.version });
  const liveFiles = await client.listVersionFiles({ version: baseline.version });
  if (!isDeepStrictEqual(liveVersion.config, baseline.config)) throw new Error('Live baseline config mismatch');
  if (!isDeepStrictEqual(fileMap(liveFiles), priorFiles)) throw new Error('Live baseline file map mismatch');
  verifySource();
  const created = await client.createVersion();
  const newVersion = versionName(created.name);
  if (newVersion === baseline.version) throw new Error('Create returned the old version');
  verifySource();
  const populated = await client.populateFiles({ version: newVersion, files });
  const uploadUrl = validateUploadUrl(populated.uploadUrl, newVersion);
  const requiredHashes = populated.uploadRequiredHashes === undefined ? [] : populated.uploadRequiredHashes;
  if (!Array.isArray(requiredHashes)) throw new Error('Invalid populate upload hash inventory');
  // Validate the entire response before uploading any bytes.
  for (const hash of requiredHashes) {
    if (!uploads.has(hash)) throw new Error(`Populate requested an unapproved upload hash: ${String(hash)}`);
  }
  for (const hash of new Set(requiredHashes)) {
    verifySource();
    await client.uploadFile({ uploadUrl, hash, bytes: Buffer.from(uploads.get(hash)) });
  }
  verifySource();
  const finalized = await client.finalizeVersion({ version: newVersion, config });
  if (finalized.status !== 'FINALIZED' || versionName(finalized.name) !== newVersion) throw new Error('Finalization was not confirmed');
  if (versionName((await client.getLiveRelease()).version) !== baseline.version) throw new Error('Pre-release version fence failed');
  verifySource();
  const release = await client.releaseVersion({ version: newVersion });
  if (versionName(release.version) !== newVersion) throw new Error('Release response did not confirm the new version');
  if (versionName((await client.getLiveRelease()).version) !== newVersion) throw new Error('Released live-version readback mismatch');
  const readback = await client.getVersion({ version: newVersion });
  const readbackFiles = await client.listVersionFiles({ version: newVersion });
  if (!isDeepStrictEqual(fileMap(readbackFiles), files)) throw new Error('Released file map readback mismatch');
  if (!isDeepStrictEqual(readback.config, config)) throw new Error('Released config readback mismatch');
  const receipt = {
    schemaVersion: 1,
    mode: 'published-and-verified',
    project: PROJECT,
    site: SITE,
    priorVersion: baseline.version,
    newVersion,
    publishedAt: (options.now || (() => new Date().toISOString()))(),
    publishedPaths: FILES.map(([, hostedPath]) => hostedPath),
    preservedFileCount: baseline.files.length,
    verifiedFileCount: Object.keys(files).length,
    configVerified: true,
  };
  fs.mkdirSync(path.dirname(options.receiptPath), { recursive: true });
  // Never serialize a client, response, upload URL, auth options, or raw exception.
  fs.writeFileSync(options.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return receipt;
}

async function createFirebaseClient(rawOptions = {}) {
  const options = optionsWithDefaults(rawOptions);
  const load = options.moduleLoader || ((name) => require(path.join(options.workspaceRoot, 'functions/node_modules/firebase-tools/lib', name)));
  const { logger } = load('logger');
  logger.silent = true; // apiv2 errors may log request details; never enable CLI debug/file logging.
  const auth = load('auth');
  const { requireAuth } = load('requireAuth');
  const { Client } = load('apiv2');
  if (process.env.FIREBASE_TOKEN) throw new Error('Use the existing project default Firebase account, not FIREBASE_TOKEN');
  const account = auth.getProjectDefaultAccount(options.workspaceRoot);
  if (!account) throw new Error('No existing project default Firebase account');
  const authOptions = { project: PROJECT, projectRoot: options.workspaceRoot, nonInteractive: true };
  auth.setActiveAccount(authOptions, account);
  await requireAuth(authOptions);
  const api = new Client({ urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1', auth: true });
  const body = async (promise) => (await promise).body;
  return {
    async getLiveRelease() {
      const channel = await body(api.get(`/${SITE_NAME}/channels/live`));
      return channel.release;
    },
    getVersion: ({ version }) => body(api.get(`/${versionName(version)}`)),
    async listVersionFiles({ version }) {
      const files = [];
      let pageToken;
      do {
        const page = await body(api.get(`/${versionName(version)}/files`, {
          queryParams: { pageSize: 1000, ...(pageToken ? { pageToken } : {}) },
        }));
        files.push(...(page.files || []));
        pageToken = page.nextPageToken;
      } while (pageToken);
      return files;
    },
    createVersion: () => body(api.post(`/${SITE_NAME}/versions`, {})),
    populateFiles: ({ version, files }) => body(api.post(`/${versionName(version)}:populateFiles`, { files })),
    async uploadFile({ uploadUrl, hash, bytes }) {
      if (!/^[a-f0-9]{64}$/.test(hash) || sha256(bytes) !== hash) throw new Error('Invalid upload content hash');
      const id = new URL(uploadUrl).pathname.split('/')[5];
      validateUploadUrl(uploadUrl, `${SITE_NAME}/versions/${id}`);
      const upload = new Client({ urlPrefix: uploadUrl, auth: true });
      const response = await upload.request({ method: 'POST', path: `/${hash}`, body: Readable.from([bytes]),
        responseType: 'stream', resolveOnHTTPError: true, redirect: 'error', timeout: 120000 });
      // Drain without printing/persisting the service response.
      if (response.response?.body) for await (const chunk of response.response.body) { void chunk; }
      if (response.status !== 200) throw new Error('Firebase file upload failed');
    },
    finalizeVersion: ({ version, config }) => body(api.patch(`/${versionName(version)}`, { status: 'FINALIZED', config }, {
      queryParams: { updateMask: 'status,config' },
    })),
    releaseVersion: ({ version }) => body(api.post(`/${SITE_NAME}/channels/live/releases`, {}, {
      queryParams: { versionName: versionName(version) },
    })),
  };
}

async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && !['--publish', '--dry-run'].includes(args[0]))) {
    throw new Error('Usage: node scripts/publish-recovery-page.cjs [--dry-run|--publish]');
  }
  const result = args[0] === '--publish' ? await publishRecoveryPage() : await planRecoveryPublish();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = { ALLOWED_UPLOAD_ORIGIN, planRecoveryPublish, publishRecoveryPage, createFirebaseClient, main };
if (require.main === module) main().catch(() => {
  // Firebase exceptions can carry credentials/request details. Fail closed with a fixed CLI message.
  process.stderr.write('Recovery publisher failed. No success receipt was written; inspect source/baseline and Hosting state before retrying.\n');
  process.exitCode = 1;
});
