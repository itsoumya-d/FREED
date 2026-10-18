const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ALLOWED_UPLOAD_ORIGIN,
  createFirebaseClient,
  planRecoveryPublish,
  publishRecoveryPage,
} = require('../scripts/publish-recovery-page.cjs');

const PROJECT = 'freed-7d5ee';
const SITE = 'freed-landing';
const PRIOR_VERSION = `projects/${PROJECT}/sites/${SITE}/versions/d13d066f5dbc08d7`;
const NEW_VERSION = `projects/${PROJECT}/sites/${SITE}/versions/new-version`;

const SOURCE_FIXTURES = {
  'website/recovery.html': {
    bytes: 'recovery html\n',
    rawHash: 'cd415f5a5f2b23ece62ab125d5f4b91b2b94146ddd2d188cf014df932afe42c7',
    hostedPath: '/recovery.html',
    gzipHash: 'ee30fd5e164bac2b517bd84aebfe540976ef685cd942ec5e2e8633131b5c3946',
    gzipBase64: 'H4sIAAAAAAACEytKTc4vSy2qVMgoyc3hAgDyEoEMDgAAAA==',
  },
  'website/assets/recovery.css': {
    bytes: 'recovery css\n',
    rawHash: '393df30e07fe0acaed20e8361003a863cb8cdd7bd0e15e65b8fbdd149757f344',
    hostedPath: '/assets/recovery.css',
    gzipHash: '7ff9f47182c8c6bf6a531333202eb88dc80efa770d1aa70c47151495ec9ecb80',
    gzipBase64: 'H4sIAAAAAAACEytKTc4vSy2qVEguLuYCANHQvZoNAAAA',
  },
  'website/assets/recovery.js': {
    bytes: 'recovery js\n',
    rawHash: '05bafb1d72378c6b5946309ac6ecb563132582f22a4338ca6f4a5069a2d0806d',
    hostedPath: '/assets/recovery.js',
    gzipHash: '7fcc3b477e630c135bccafc27aa7b85adb1bbd8e9112bfd7125875569f841e0e',
    gzipBase64: 'H4sIAAAAAAACEytKTc4vSy2qVMgq5gIAuuUBKwwAAAA=',
  },
  'website/assets/recovery-kite.png': {
    bytes: 'kite bytes\n',
    rawHash: 'a08bef0630fb760eed0d1e3eb8d9abfebf0e74b7f32183c75f719dd21cb71d02',
    hostedPath: '/assets/recovery-kite.png',
    gzipHash: '7a368be8205f64f0fcd6bc2faf09ddee22b58435d37a069104dfa60ffdfdd1cf',
    gzipBase64: 'H4sIAAAAAAACE8vOLElVSKosSS3mAgB0WwEwCwAAAA==',
  },
};

const BASELINE_FILES = [
  { path: '/index.html', hash: 'old-index-hash', status: 'ACTIVE' },
  { path: '/assets/styles.css', hash: 'old-styles-hash', status: 'ACTIVE' },
];

const BASELINE_CONFIG = {
  headers: [
    {
      glob: '/assets/**',
      headers: { 'Cache-Control': 'public, max-age=604800' },
    },
  ],
  rewrites: [{ glob: '/api/adult-domain-feed', path: '/adult-domain-feed.json' }],
  cleanUrls: true,
  trailingSlashBehavior: 'REMOVE',
};

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createFixture() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-publisher-'));
  for (const [relativePath, fixture] of Object.entries(SOURCE_FIXTURES)) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, fixture.bytes);
  }

  const manifestPath = path.join(workspaceRoot, 'page-manifest.json');
  const manifest = {
    source: {
      ...Object.fromEntries(
        Object.entries(SOURCE_FIXTURES).map(([relativePath, fixture]) => [relativePath, fixture.rawHash]),
      ),
      'tests/recovery-page.test.js': 'ignored-non-publish-source',
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const baselinePath = path.join(workspaceRoot, 'hosting-before.json');
  fs.writeFileSync(
    baselinePath,
    `${JSON.stringify({
      project: PROJECT,
      site: SITE,
      channel: `projects/${PROJECT}/sites/${SITE}/channels/live`,
      version: PRIOR_VERSION,
      config: BASELINE_CONFIG,
      files: BASELINE_FILES,
    }, null, 2)}\n`,
  );

  return {
    workspaceRoot,
    manifestPath,
    baselinePath,
    receiptPath: path.join(workspaceRoot, 'publisher-receipt.json'),
  };
}

function expectedPublishedFileMap() {
  return {
    '/index.html': 'old-index-hash',
    '/assets/styles.css': 'old-styles-hash',
    ...Object.fromEntries(
      Object.values(SOURCE_FIXTURES).map((fixture) => [fixture.hostedPath, fixture.gzipHash]),
    ),
  };
}

function createFakeClient({
  liveVersions = [PRIOR_VERSION, PRIOR_VERSION, NEW_VERSION],
  uploadUrl = `${ALLOWED_UPLOAD_ORIGIN}/upload/sites/${SITE}/versions/new-version/files`,
  uploadRequiredHashes = Object.values(SOURCE_FIXTURES).map((fixture) => fixture.gzipHash),
  finalizeError,
  readbackFiles,
  readbackConfig,
} = {}) {
  const calls = [];
  let liveRead = 0;
  let finalizedConfig;

  return {
    calls,
    async getLiveRelease() {
      calls.push(['getLiveRelease']);
      const version = liveVersions[Math.min(liveRead, liveVersions.length - 1)];
      liveRead += 1;
      return { version };
    },
    async getVersion({ version }) {
      calls.push(['getVersion', version]);
      return {
        name: version,
        config: version === PRIOR_VERSION
          ? structuredClone(BASELINE_CONFIG)
          : structuredClone(readbackConfig || finalizedConfig),
      };
    },
    async listVersionFiles({ version }) {
      calls.push(['listVersionFiles', version]);
      if (version === PRIOR_VERSION) return structuredClone(BASELINE_FILES);
      const files = readbackFiles || Object.entries(expectedPublishedFileMap()).map(([filePath, hash]) => ({
        path: filePath,
        hash,
        status: 'ACTIVE',
      }));
      return structuredClone(files);
    },
    async createVersion() {
      calls.push(['createVersion']);
      return { name: NEW_VERSION };
    },
    async populateFiles({ version, files }) {
      calls.push(['populateFiles', version, structuredClone(files)]);
      return { uploadUrl, uploadRequiredHashes: [...uploadRequiredHashes] };
    },
    async uploadFile({ uploadUrl: actualUrl, hash, bytes }) {
      calls.push(['uploadFile', actualUrl, hash, Buffer.from(bytes)]);
    },
    async finalizeVersion({ version, config }) {
      calls.push(['finalizeVersion', version, structuredClone(config)]);
      if (finalizeError) throw finalizeError;
      finalizedConfig = structuredClone(config);
      return { name: version, status: 'FINALIZED', config: finalizedConfig };
    },
    async releaseVersion({ version }) {
      calls.push(['releaseVersion', version]);
      return { version: { name: version } };
    },
  };
}

test('default planning verifies four pinned files without contacting Firebase or mutating hosting', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));

  const plan = await planRecoveryPublish(fixture);

  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.mutationPerformed, false);
  assert.equal(plan.priorVersion, PRIOR_VERSION);
  assert.deepEqual(plan.publishedPaths, [
    '/recovery.html',
    '/assets/recovery.css',
    '/assets/recovery.js',
    '/assets/recovery-kite.png',
  ]);
  assert.deepEqual(plan.fileHashes, Object.fromEntries(
    Object.values(SOURCE_FIXTURES).map(({ hostedPath, gzipHash }) => [hostedPath, gzipHash]),
  ));
});

test('publish preserves every old file and config entry, uploads only pinned gzip bytes, then verifies readback', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient();

  const receipt = await publishRecoveryPage({
    ...fixture,
    client,
    now: () => '2026-10-13T12:00:00.000Z',
  });

  const populate = client.calls.find(([name]) => name === 'populateFiles');
  assert.deepEqual(populate.slice(1), [NEW_VERSION, expectedPublishedFileMap()]);

  const uploads = client.calls.filter(([name]) => name === 'uploadFile');
  assert.equal(uploads.length, 4);
  for (const fixtureFile of Object.values(SOURCE_FIXTURES)) {
    const upload = uploads.find(([, , hash]) => hash === fixtureFile.gzipHash);
    assert.ok(upload, `missing upload for ${fixtureFile.hostedPath}`);
    assert.equal(upload[1], `${ALLOWED_UPLOAD_ORIGIN}/upload/sites/${SITE}/versions/new-version/files`);
    assert.equal(upload[3].toString('base64'), fixtureFile.gzipBase64);
    assert.equal(sha256(upload[3]), fixtureFile.gzipHash);
  }

  const finalize = client.calls.find(([name]) => name === 'finalizeVersion');
  assert.deepEqual(finalize[2].headers[0], BASELINE_CONFIG.headers[0]);
  assert.deepEqual(finalize[2].rewrites, BASELINE_CONFIG.rewrites);
  assert.equal(finalize[2].cleanUrls, true);
  assert.equal(finalize[2].trailingSlashBehavior, 'REMOVE');
  assert.deepEqual(finalize[2].headers.slice(1).map(({ glob }) => glob), [
    '/recovery',
    '/recovery.html',
    '/assets/recovery.css',
    '/assets/recovery.js',
    '/assets/recovery-kite.png',
  ]);
  for (const rule of finalize[2].headers.slice(1)) {
    assert.equal(rule.headers['Cache-Control'], 'no-store, max-age=0');
    assert.equal(rule.headers['X-Content-Type-Options'], 'nosniff');
  }
  assert.equal(finalize[2].headers[1].headers['Content-Security-Policy'],
    "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'none'");
  assert.equal(client.calls.filter(([name]) => name === 'getLiveRelease').length, 3);
  assert.equal(client.calls.filter(([name]) => name === 'releaseVersion').length, 1);

  assert.deepEqual(receipt, {
    schemaVersion: 1,
    mode: 'published-and-verified',
    project: PROJECT,
    site: SITE,
    priorVersion: PRIOR_VERSION,
    newVersion: NEW_VERSION,
    publishedAt: '2026-10-13T12:00:00.000Z',
    publishedPaths: [
      '/recovery.html',
      '/assets/recovery.css',
      '/assets/recovery.js',
      '/assets/recovery-kite.png',
    ],
    preservedFileCount: 2,
    verifiedFileCount: 6,
    configVerified: true,
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(fixture.receiptPath, 'utf8')), receipt);
  assert.doesNotMatch(JSON.stringify(receipt), /uploadUrl|authorization|access[_-]?token/i);
});

test('a source mismatch fails before the first Firebase read or mutation', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  fs.appendFileSync(path.join(fixture.workspaceRoot, 'website/recovery.html'), 'mutated');
  const client = createFakeClient();

  await assert.rejects(
    publishRecoveryPage({ ...fixture, client }),
    /Pinned source hash mismatch for website\/recovery\.html/,
  );
  assert.deepEqual(client.calls, []);
  assert.equal(fs.existsSync(fixture.receiptPath), false);
});

test('a stale baseline version fails before creating a version', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient({ liveVersions: ['projects/freed-7d5ee/sites/freed-landing/versions/newer'] });

  await assert.rejects(
    publishRecoveryPage({ ...fixture, client }),
    /Baseline version fence failed/,
  );
  assert.equal(client.calls.some(([name]) => name === 'createVersion'), false);
  assert.equal(fs.existsSync(fixture.receiptPath), false);
});

test('an unexpected upload origin stops before uploading, finalizing, or releasing', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient({ uploadUrl: 'https://attacker.example/upload/files' });

  await assert.rejects(
    publishRecoveryPage({ ...fixture, client }),
    /Refusing unapproved Firebase upload origin/,
  );
  assert.equal(client.calls.some(([name]) => name === 'uploadFile'), false);
  assert.equal(client.calls.some(([name]) => name === 'finalizeVersion'), false);
  assert.equal(client.calls.some(([name]) => name === 'releaseVersion'), false);
});

test('a required hash from the old live site is rejected instead of being re-uploaded', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient({ uploadRequiredHashes: ['old-index-hash'] });

  await assert.rejects(
    publishRecoveryPage({ ...fixture, client }),
    /Populate requested an unapproved upload hash: old-index-hash/,
  );
  assert.equal(client.calls.some(([name]) => name === 'uploadFile'), false);
  assert.equal(client.calls.some(([name]) => name === 'finalizeVersion'), false);
  assert.equal(client.calls.some(([name]) => name === 'releaseVersion'), false);
});

test('a live-version race after finalization leaves the new version unreleased', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const racedVersion = 'projects/freed-7d5ee/sites/freed-landing/versions/concurrent-release';
  const client = createFakeClient({ liveVersions: [PRIOR_VERSION, racedVersion] });

  await assert.rejects(
    publishRecoveryPage({ ...fixture, client }),
    /Pre-release version fence failed/,
  );
  assert.equal(client.calls.some(([name]) => name === 'finalizeVersion'), true);
  assert.equal(client.calls.some(([name]) => name === 'releaseVersion'), false);
  assert.equal(fs.existsSync(fixture.receiptPath), false);
});

test('a finalization failure cannot release or record a success receipt', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient({ finalizeError: new Error('finalization failed') });

  await assert.rejects(
    publishRecoveryPage({ ...fixture, client }),
    /finalization failed/,
  );
  assert.equal(client.calls.some(([name]) => name === 'releaseVersion'), false);
  assert.equal(fs.existsSync(fixture.receiptPath), false);
});

test('a source change during live inspection stops before creating any version', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient();
  const originalRead = client.listVersionFiles;
  client.listVersionFiles = async (args) => {
    const result = await originalRead(args);
    fs.appendFileSync(path.join(fixture.workspaceRoot, 'website/assets/recovery.js'), 'changed');
    return result;
  };
  await assert.rejects(publishRecoveryPage({ ...fixture, client }), /Pinned source hash mismatch/);
  assert.equal(client.calls.some(([name]) => name === 'createVersion'), false);
});

test('a source change during upload cannot finalize or release', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient();
  const originalUpload = client.uploadFile;
  client.uploadFile = async (args) => {
    await originalUpload(args);
    fs.appendFileSync(path.join(fixture.workspaceRoot, 'website/assets/recovery.css'), 'changed');
  };
  await assert.rejects(publishRecoveryPage({ ...fixture, client }), /Pinned source hash mismatch/);
  assert.equal(client.calls.filter(([name]) => name === 'uploadFile').length, 1);
  assert.equal(client.calls.some(([name]) => name === 'finalizeVersion'), false);
  assert.equal(client.calls.some(([name]) => name === 'releaseVersion'), false);
});

test('live baseline inventory or config drift fails before mutation even when version is unchanged', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  for (const kind of ['files', 'config']) {
    const client = createFakeClient();
    if (kind === 'files') client.listVersionFiles = async () => BASELINE_FILES.slice(1);
    else client.getVersion = async () => ({ config: { ...BASELINE_CONFIG, cleanUrls: false } });
    await assert.rejects(publishRecoveryPage({ ...fixture, client }), /Live baseline .* mismatch/);
    assert.equal(client.calls.some(([name]) => name === 'createVersion'), false);
  }
});

test('all required hashes are validated before any upload, including mixed approved and unknown hashes', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient({ uploadRequiredHashes: [Object.values(SOURCE_FIXTURES)[0].gzipHash, 'unknown'] });
  await assert.rejects(publishRecoveryPage({ ...fixture, client }), /unapproved upload hash/);
  assert.equal(client.calls.some(([name]) => name === 'uploadFile'), false);
});

test('credentials, query parameters, wrong version and alternate paths in upload URL are rejected', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const base = `${ALLOWED_UPLOAD_ORIGIN}/upload/sites/${SITE}/versions/new-version/files`;
  for (const uploadUrl of [base + '?secret=value', base + '#fragment', base.replace('https://', 'https://user:password@'), base.replace('new-version', 'old-version'), `${ALLOWED_UPLOAD_ORIGIN}/elsewhere`]) {
    const client = createFakeClient({ uploadUrl });
    await assert.rejects(publishRecoveryPage({ ...fixture, client }), /Refusing/);
    assert.equal(client.calls.some(([name]) => name === 'uploadFile'), false);
    assert.equal(client.calls.some(([name]) => name === 'releaseVersion'), false);
  }
});

test('published file/config mismatch cannot write a success receipt', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  for (const mismatch of [
    { readbackFiles: BASELINE_FILES },
    { readbackConfig: BASELINE_CONFIG },
    { liveVersions: [PRIOR_VERSION, PRIOR_VERSION, PRIOR_VERSION] },
  ]) {
    const client = createFakeClient(mismatch);
    await assert.rejects(publishRecoveryPage({ ...fixture, client }), /readback mismatch/);
    assert.equal(fs.existsSync(fixture.receiptPath), false);
  }
});

test('an existing success receipt is preserved and blocks all remote activity', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  fs.writeFileSync(fixture.receiptPath, 'prior evidence');
  const client = createFakeClient();
  await assert.rejects(publishRecoveryPage({ ...fixture, client }), /Receipt already exists/);
  assert.deepEqual(client.calls, []);
  assert.equal(fs.readFileSync(fixture.receiptPath, 'utf8'), 'prior evidence');
});

test('unconfirmed finalization and upload errors cannot release', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  for (const phase of ['upload', 'finalize']) {
    const client = createFakeClient();
    if (phase === 'upload') client.uploadFile = async () => { throw new Error('upload failed'); };
    else client.finalizeVersion = async () => ({ name: NEW_VERSION, status: 'CREATED' });
    await assert.rejects(publishRecoveryPage({ ...fixture, client }), /upload failed|Finalization was not confirmed/);
    assert.equal(client.calls.some(([name]) => name === 'releaseVersion'), false);
    assert.equal(fs.existsSync(fixture.receiptPath), false);
  }
});

test('importing the module and the default CLI dry-run do not load Firebase or authenticate', (t) => {
  const { spawnSync } = require('node:child_process');
  const scriptPath = path.resolve(__dirname, '../scripts/publish-recovery-page.cjs');
  const script = `const Module = require('node:module'); const original = Module._load;
    Module._load = function (name, ...args) { if (name.includes('firebase-tools')) throw new Error('Firebase must not load'); return original.call(this, name, ...args); };
    const helper = require(${JSON.stringify(scriptPath)}); helper.main([]);`;
  const child = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const plan = JSON.parse(child.stdout);
  assert.equal(plan.mode, 'dry-run');
  assert.equal(plan.preservedFileCount, 15);
  assert.equal(plan.plannedFileCount, 19);
  assert.equal(plan.liveVersionChecked, false);
});

test('real adapter uses pinned API resources, pagination, streaming uploads and explicit finalize/release masks', async () => {
  const calls = [];
  const clients = [];
  const modules = {
    logger: { logger: { silent: false } },
    auth: {
      getProjectDefaultAccount(root) { calls.push(['defaultAccount', root]); return { user: { email: 'not-logged' }, tokens: { refresh_token: 'not-logged' } }; },
      setActiveAccount(options, account) { calls.push(['activeAccount']); options.user = account.user; options.tokens = account.tokens; },
    },
    requireAuth: { async requireAuth(options) { assert.equal(options.project, PROJECT); assert.equal(options.nonInteractive, true); calls.push(['requireAuth']); } },
    apiv2: { Client: class {
      constructor(options) { this.options = options; clients.push(options); }
      async get(resource, options) {
        calls.push(['get', resource, options]);
        if (resource.endsWith('/channels/live')) return { body: { release: { version: { name: PRIOR_VERSION } } } };
        if (resource.endsWith('/files')) return { body: options.queryParams.pageToken ? { files: [BASELINE_FILES[1]] } : { files: [BASELINE_FILES[0]], nextPageToken: 'page2' } };
        return { body: { name: PRIOR_VERSION, config: BASELINE_CONFIG } };
      }
      async post(resource, payload, options) { calls.push(['post', resource, payload, options]); return { body: { name: NEW_VERSION } }; }
      async patch(resource, payload, options) { calls.push(['patch', resource, payload, options]); return { body: { name: NEW_VERSION, status: 'FINALIZED' } }; }
      async request(options) {
        const chunks = [];
        for await (const chunk of options.body) chunks.push(chunk);
        calls.push(['request', { ...options, body: Buffer.concat(chunks) }]);
        return { status: 200 };
      }
    } },
  };
  const client = await createFirebaseClient({ workspaceRoot: '/fixture', moduleLoader: (name) => modules[name] });
  assert.equal(modules.logger.logger.silent, true);
  assert.deepEqual((await client.getLiveRelease()).version, { name: PRIOR_VERSION });
  assert.deepEqual(await client.listVersionFiles({ version: PRIOR_VERSION }), BASELINE_FILES);
  await client.createVersion();
  await client.populateFiles({ version: NEW_VERSION, files: { '/index.html': 'preserved' } });
  const pinned = Object.values(SOURCE_FIXTURES)[0];
  await client.uploadFile({ uploadUrl: `${ALLOWED_UPLOAD_ORIGIN}/upload/sites/${SITE}/versions/new-version/files`, hash: pinned.gzipHash, bytes: Buffer.from(pinned.gzipBase64, 'base64') });
  await client.finalizeVersion({ version: NEW_VERSION, config: BASELINE_CONFIG });
  await client.releaseVersion({ version: NEW_VERSION });
  assert.deepEqual(clients[0], { urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1', auth: true });
  assert.deepEqual(calls.find(([name]) => name === 'patch').slice(1), [`/${NEW_VERSION}`, { status: 'FINALIZED', config: BASELINE_CONFIG }, { queryParams: { updateMask: 'status,config' } }]);
  assert.deepEqual(calls.filter(([name]) => name === 'post').at(-1).slice(1), [`/projects/${PROJECT}/sites/${SITE}/channels/live/releases`, {}, { queryParams: { versionName: NEW_VERSION } }]);
  const request = calls.find(([name]) => name === 'request')[1];
  assert.equal(request.method, 'POST');
  assert.equal(request.redirect, 'error');
  assert.equal(request.path, `/${pinned.gzipHash}`);
  assert.equal(sha256(request.body), pinned.gzipHash);
  assert.equal(calls.filter(([name]) => name === 'requireAuth').length, 1);
});

test('real adapter propagates failed authentication without making Hosting requests', async () => {
  const calls = [];
  const modules = {
    logger: { logger: {} },
    auth: {
      getProjectDefaultAccount: () => ({ user: {}, tokens: {} }),
      setActiveAccount: () => {},
    },
    requireAuth: { requireAuth: async () => { throw new Error('authentication unavailable'); } },
    apiv2: { Client: class { constructor() { calls.push('request client'); } } },
  };
  await assert.rejects(createFirebaseClient({ workspaceRoot: '/fixture', moduleLoader: (name) => modules[name] }), /authentication unavailable/);
  assert.deepEqual(calls, []);
});

test('real adapter rejects HTTP upload failure and prevents redirect-following', async () => {
  const requests = [];
  const modules = {
    logger: { logger: {} },
    auth: { getProjectDefaultAccount: () => ({ user: {}, tokens: {} }), setActiveAccount: () => {} },
    requireAuth: { requireAuth: async () => {} },
    apiv2: { Client: class { async request(options) { requests.push(options); return { status: 403 }; } } },
  };
  const client = await createFirebaseClient({ workspaceRoot: '/fixture', moduleLoader: (name) => modules[name] });
  const pinned = Object.values(SOURCE_FIXTURES)[0];
  const args = { uploadUrl: `${ALLOWED_UPLOAD_ORIGIN}/upload/sites/${SITE}/versions/new-version/files`, hash: pinned.gzipHash, bytes: Buffer.from(pinned.gzipBase64, 'base64') };
  await assert.rejects(client.uploadFile(args), /Firebase file upload failed/);
  assert.equal(requests[0].redirect, 'error');
  await assert.rejects(client.uploadFile({ ...args, bytes: Buffer.from('different') }), /Invalid upload content hash/);
  assert.equal(requests.length, 1);
});



test('canonical recovery page receives the security headers before clean URL resolution', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient();
  await publishRecoveryPage({ ...fixture, client });
  const config = client.calls.find(([name]) => name === 'finalizeVersion')[2];
  const canonical = config.headers.find(({ glob }) => glob === '/recovery');
  const html = config.headers.find(({ glob }) => glob === '/recovery.html');
  assert.ok(canonical, 'cleanUrls path must receive page security headers');
  assert.deepEqual(canonical.headers, html.headers);
  assert.match(canonical.headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(canonical.headers['Cache-Control'], 'no-store, max-age=0');
});

test('already cached uploads may omit the empty protobuf repeated hash field', async (t) => {
  const fixture = createFixture();
  t.after(() => fs.rmSync(fixture.workspaceRoot, { recursive: true, force: true }));
  const client = createFakeClient();
  client.populateFiles = async ({ version, files }) => {
    client.calls.push(['populateFiles', version, structuredClone(files)]);
    return { uploadUrl: `${ALLOWED_UPLOAD_ORIGIN}/upload/sites/${SITE}/versions/new-version/files` };
  };
  const receipt = await publishRecoveryPage({ ...fixture, client });
  assert.equal(receipt.mode, 'published-and-verified');
  assert.equal(client.calls.some(([name]) => name === 'uploadFile'), false);
  assert.equal(client.calls.filter(([name]) => name === 'releaseVersion').length, 1);
});
