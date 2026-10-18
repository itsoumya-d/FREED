const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function productionAdapter({ files: existingFiles, failures: existingFailures, mutateAdapter } = {}) {
  const files = existingFiles ?? new Map([['file:///cache/ImagePicker/fresh.jpg','photo'],['file:///cache/ImagePicker/unrelated.jpg','private']]);
  const failures = existingFailures ?? { create: true, deletion: false };
  const deleted = [];
  let lists = 0;
  class Directory {
    constructor(parent, name) { this.uri = (typeof parent === 'string' ? parent : parent.uri).replace(/\/$/,'') + '/' + name + '/'; }
    create() { if (failures.create) throw Object.assign(new Error('ENOSPC'), {code:'ENOSPC'}); }
    list() { lists++; if (failures.listFrom && lists >= failures.listFrom) throw new Error('list denied'); return [...files.keys()].filter(uri => uri.startsWith(this.uri)).map(uri => new File(uri)); }
  }
  class File {
    constructor(parent, name) { this.uri = name ? parent.uri + name : parent; }
    get exists() { return files.has(this.uri); }
    delete() { deleted.push(this.uri); if (failures.deletion || failures.deletionUris?.has(this.uri)) throw new Error('delete denied'); files.delete(this.uri); }
    textSync() { if (failures.read) throw new Error('read denied'); return files.get(this.uri); }
    write(value) { if (failures.write) throw new Error('write denied'); files.set(this.uri,value); }
    copy(destination) { if (!files.has(this.uri)) throw new Error('source missing'); files.set(destination.uri,files.get(this.uri)); }
  }
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} }; cache.set(path,module.exports);
    const original = fs.readFileSync(path,'utf8');
    const candidate = mutateAdapter && path.endsWith('/challenge-photo-files.ts') ? mutateAdapter(original) : original;
    const source = ts.transpileModule(candidate,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    vm.runInNewContext(source,{module,exports:module.exports,setTimeout,clearTimeout,require:name=>name==='expo-file-system'?{Directory,File,Paths:{cache:{uri:'file:///cache/'}}}:load(require('node:path').resolve(require('node:path').dirname(path),name+'.ts'))},{filename:path});
    return module.exports;
  }
  return { adapter:load(require('node:path').resolve('src/lib/challenge-photo-files.ts')),runtime:load(require('node:path').resolve('src/lib/challenge-verification-runtime.ts')),files,failures,deleted };
}
test('actual adapter deletes a proven fresh camera original when owned-directory creation fails',async()=>{
 const f=productionAdapter();await assert.rejects(async()=>f.adapter.adoptTemporaryChallengePhoto('file:///cache/ImagePicker/fresh.jpg'));
 assert.deepEqual(f.deleted,['file:///cache/ImagePicker/fresh.jpg']);assert.ok(!f.files.has('file:///cache/ImagePicker/fresh.jpg'));assert.ok(f.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});
test('actual adapter keeps failed initialization cleanup retryable and reports remaining failure',async()=>{
 const f=productionAdapter();f.failures.deletion=true;await assert.rejects(async()=>f.adapter.adoptTemporaryChallengePhoto('file:///cache/ImagePicker/fresh.jpg'));
 assert.ok(f.deleted.includes('file:///cache/ImagePicker/fresh.jpg'));assert.ok(f.adapter.cleanupAbandonedChallengePhotos().remaining>0);
 f.failures.deletion=false;f.failures.create=false;const result=f.adapter.cleanupAbandonedChallengePhotos();assert.equal(result.remaining,0);assert.ok(!f.files.has('file:///cache/ImagePicker/fresh.jpg'));assert.ok(f.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});
test('actual adapter never deletes or retries unproven, escaped or user paths on initialization failure',async()=>{
 const f=productionAdapter();for(const uri of ['file:///cache/user.jpg','content://camera/photo','file:///cache/ImagePicker/../user.jpg','file:///cache/ImagePicker/sub/a.jpg'])await assert.rejects(async()=>f.adapter.adoptTemporaryChallengePhoto(uri));
 assert.deepEqual(f.deleted,[]);assert.ok(f.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('actual adapter persists the proven original after storage recovery and retries it after restart',async()=>{
 const f=productionAdapter();f.failures.deletion=true;
 await assert.rejects(async()=>f.adapter.adoptTemporaryChallengePhoto('file:///cache/ImagePicker/fresh.jpg'));
 f.failures.create=false;assert.ok(f.adapter.cleanupAbandonedChallengePhotos().remaining>0);
 const manifest=[...f.files.entries()].find(([uri])=>uri.endsWith('/owned.json'));
 assert.ok(manifest);assert.ok(manifest[1].includes('file:///cache/ImagePicker/fresh.jpg'));
 const restart=productionAdapter({files:f.files,failures:f.failures});restart.failures.deletion=false;
 assert.equal(restart.adapter.cleanupAbandonedChallengePhotos().remaining,0);
 assert.ok(!restart.files.has('file:///cache/ImagePicker/fresh.jpg'));assert.ok(restart.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});
test('actual initialization retry metadata stays bounded and never claims overflow cleanup succeeded',async()=>{
 const f=productionAdapter();f.failures.deletion=true;
 for(let index=0;index<128;index++){const uri=`file:///cache/ImagePicker/failed-${index}.jpg`;f.files.set(uri,'photo');await assert.rejects(async()=>f.adapter.adoptTemporaryChallengePhoto(uri));}
 const full=f.adapter.cleanupAbandonedChallengePhotos();assert.equal(full.attempted,128);assert.equal(full.remaining,128);
 const overflow='file:///cache/ImagePicker/overflow.jpg';f.files.set(overflow,'photo');await assert.rejects(async()=>f.adapter.adoptTemporaryChallengePhoto(overflow),/capacity/);
 const exceeded=f.adapter.cleanupAbandonedChallengePhotos();assert.equal(exceeded.attempted,128);assert.equal(exceeded.remaining,129);
 f.failures.create=false;f.failures.deletion=false;assert.ok(f.adapter.cleanupAbandonedChallengePhotos().remaining>0,'an untracked overflow cannot be claimed deleted');assert.ok(f.files.has(overflow));assert.ok(f.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('actual adapter boundary regression detects removal of initialization fallback deletion',async()=>{
 const f=productionAdapter({mutateAdapter:source=>{
   const changed=source.replace('if (!removeProvenFreshOriginal(uri)) {','if (false) {');
   assert.notEqual(changed,source,'mutation must remove the production fallback call');return changed;
 }});
 await assert.rejects(async()=>f.adapter.adoptTemporaryChallengePhoto('file:///cache/ImagePicker/fresh.jpg'));
 assert.deepEqual(f.deleted,[]);assert.ok(f.files.has('file:///cache/ImagePicker/fresh.jpg'),'the positive initialization regression would catch this surviving original');
});

async function recoverThroughNextCapture(mutateAdapter) {
  const state = productionAdapter({ mutateAdapter });
  const oldOriginal = 'file:///cache/ImagePicker/fresh.jpg';
  const nextOriginal = 'file:///cache/ImagePicker/next.jpg';
  assert.equal(state.adapter.cleanupAbandonedChallengePhotos().remaining, 1, 'initial app startup cannot create the namespace');
  state.failures.deletion = true;
  await assert.rejects(state.adapter.adoptTemporaryChallengePhoto(oldOriginal));

  state.failures.create = false;
  state.failures.deletion = false;
  state.files.set(nextOriginal, 'next photo');
  const owned = await state.adapter.adoptTemporaryChallengePhoto(nextOriginal);
  assert.equal(state.files.get(owned), 'next photo', 'the new live destination survives retry');
  await state.adapter.deleteTemporaryChallengePhoto(owned);
  return { state, oldOriginal };
}

test('normal adoption retries a failed initialization original before natural restart cleanup', async () => {
  const { state, oldOriginal } = await recoverThroughNextCapture();
  assert.ok(!state.files.has(oldOriginal), 'normal capture must recover the old original without manually invoking cleanup');
  assert.ok(state.files.has('file:///cache/ImagePicker/unrelated.jpg'));

  const restart = productionAdapter({ files: state.files, failures: state.failures });
  const result = restart.adapter.cleanupAbandonedChallengePhotos();
  assert.equal(result.remaining, 0);
  assert.ok(!restart.files.has(oldOriginal));
  assert.ok(restart.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('normal adoption persists an old original still awaiting deletion for restart recovery', async () => {
  const state = productionAdapter();
  const oldOriginal = 'file:///cache/ImagePicker/fresh.jpg';
  state.adapter.cleanupAbandonedChallengePhotos();
  state.failures.deletion = true;
  await assert.rejects(state.adapter.adoptTemporaryChallengePhoto(oldOriginal));

  state.failures.create = false;
  state.failures.deletion = false;
  state.failures.deletionUris = new Set([oldOriginal]);
  const nextOriginal = 'file:///cache/ImagePicker/next.jpg';
  state.files.set(nextOriginal, 'next photo');
  const owned = await state.adapter.adoptTemporaryChallengePhoto(nextOriginal);
  await state.adapter.deleteTemporaryChallengePhoto(owned);
  const manifest = state.files.get('file:///cache/freed-challenge-photos-v1/owned.json');
  assert.ok(manifest.includes(oldOriginal), 'normal capture must durably register the unresolved original');
  assert.ok(state.files.has(oldOriginal));

  const restart = productionAdapter({ files: state.files, failures: state.failures });
  restart.failures.deletionUris.clear();
  const result = restart.adapter.cleanupAbandonedChallengePhotos();
  assert.equal(result.attempted, 1);
  assert.equal(result.remaining, 0);
  assert.ok(!restart.files.has(oldOriginal));
  assert.ok(restart.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('retry excludes a freshly returned original reused after a failed adoption', async () => {
  const state = productionAdapter();
  const original = 'file:///cache/ImagePicker/fresh.jpg';
  state.failures.deletion = true;
  await assert.rejects(state.adapter.adoptTemporaryChallengePhoto(original));
  state.failures.create = false;
  state.failures.deletion = false;

  const owned = await state.adapter.adoptTemporaryChallengePhoto(original);
  assert.equal(state.files.get(owned), 'photo', 'retry must not delete the current source before its copy');
  await state.adapter.deleteTemporaryChallengePhoto(owned);
  const restart = productionAdapter({ files: state.files, failures: state.failures });
  assert.equal(restart.adapter.cleanupAbandonedChallengePhotos().remaining, 0);
  assert.ok(!restart.files.has(original));
});

test('normal release retries failed originals while protecting another live capture', async () => {
  const state = productionAdapter();
  state.failures.create = false;
  const first = await state.adapter.adoptTemporaryChallengePhoto('file:///cache/ImagePicker/fresh.jpg');
  const liveOriginal = 'file:///cache/ImagePicker/live.jpg';
  state.files.set(liveOriginal, 'live photo');
  const live = await state.adapter.adoptTemporaryChallengePhoto(liveOriginal);
  const failedOriginal = 'file:///cache/ImagePicker/failed.jpg';
  state.files.set(failedOriginal, 'failed photo');
  state.failures.write = true;
  state.failures.deletion = true;
  await assert.rejects(state.adapter.adoptTemporaryChallengePhoto(failedOriginal));

  state.failures.write = false;
  state.failures.deletion = false;
  await state.adapter.deleteTemporaryChallengePhoto(first);
  assert.ok(!state.files.has(failedOriginal), 'release is a recovery opportunity even without another adoption');
  assert.equal(state.files.get(live), 'live photo', 'other live destination remains protected');
  assert.ok(state.files.has('file:///cache/ImagePicker/unrelated.jpg'));
  await state.adapter.deleteTemporaryChallengePhoto(live);
});

test('persistent metadata and deletion failures do not count an overlapping original twice', async () => {
  const state = productionAdapter();
  const original = 'file:///cache/ImagePicker/fresh.jpg';
  state.failures.deletion = true;
  await assert.rejects(state.adapter.adoptTemporaryChallengePhoto(original));
  state.failures.create = false;
  state.failures.write = true;

  const result = state.adapter.cleanupAbandonedChallengePhotos();
  assert.equal(result.attempted, 2, 'both actual retry attempts remain counted');
  assert.equal(result.remaining, 1, 'one unresolved original, with no duplicate pending count');
  assert.ok(state.files.has(original));
  assert.ok(state.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('removing normal operation retry triggers reproduces the lost original across restart', async () => {
  const { state, oldOriginal } = await recoverThroughNextCapture(source => {
    const changed = source.replace(/^\s+retryInitializationCleanup\(currentStore(?:, uri)?\);$/gm, '\n  /* retry trigger removed */');
    assert.notEqual(changed, source, 'mutation must remove normal adoption/release retry calls');
    return changed;
  });
  assert.ok(state.files.has(oldOriginal), 'positive normal-capture regression fails when triggers are removed');
  const restart = productionAdapter({ files: state.files, failures: state.failures });
  assert.equal(restart.adapter.cleanupAbandonedChallengePhotos().remaining, 0);
  assert.ok(restart.files.has(oldOriginal), 'without triggers restart has lost the sole ownership entry');
});

function captureThroughProduction(state, overrides = {}) {
  const identity = { provider: 'bundled-mlkit', classifierRevision: 'com.google.mlkit:image-labeling:17.0.9', runtimeRevision: 'android-36', ruleRevision: 'freed-photo-targets-v1', modelWeightsRevision: null };
  let launches = 0;
  const options = {
    expectedLabels: ['flower'], isCurrent: () => true,
    getCapabilities: async () => ({ cameraAvailable: true, classifierAvailable: true, identity, supportedTargetIds: ['flower'], validatedPhotoTargets: [] }),
    preparePhotoCapture: state.adapter.prepareTemporaryChallengePhotoCapture,
    requestPermission: async () => ({ granted: true }),
    launchCamera: async () => {
      launches++;
      const uri = `file:///cache/ImagePicker/new-camera-${launches}.jpg`;
      state.files.set(uri, 'new photo');
      return { canceled: false, assets: [{ uri }] };
    },
    adoptPhoto: state.adapter.adoptTemporaryChallengePhoto,
    deletePhoto: state.adapter.deleteTemporaryChallengePhoto,
    classifyPhoto: async () => ({ available: true, matched: true, outcome: 'matched', identity, labels: ['flower'], matchedLabels: ['flower'], confidence: .8, message: 'Target found.' }),
    cancelPhoto: async () => true, onStatus: () => {}, onClassification: () => {}, onPermissionDenied: () => {},
    ...overrides
  };
  return { run: () => state.runtime.runChallengePhotoCapture(options), launches: () => launches };
}

test('actual full-backlog admission prevents native camera and preserves legacy ownership until recovery', async () => {
  const state = productionAdapter();
  state.failures.create = false;
  state.failures.deletion = true;
  const originals = Array.from({ length: 140 }, (_, index) => `file:///cache/ImagePicker/legacy-${index}.jpg`);
  for (const uri of originals) state.files.set(uri, 'legacy photo');
  const manifest = 'file:///cache/freed-challenge-photos-v1/owned.json';
  state.files.set(manifest, JSON.stringify(originals));
  const capture = captureThroughProduction(state);
  assert.equal(await capture.run(), 'unavailable');
  assert.equal(capture.launches(), 0, 'actual admission must reject before native camera creates a new original');
  assert.equal(state.adapter.cleanupAbandonedChallengePhotos().remaining, 140);
  assert.deepEqual(JSON.parse(state.files.get(manifest)), originals);

  state.failures.deletion = false;
  assert.equal(await capture.run(), 'matched');
  assert.equal(capture.launches(), 1);
  assert.equal(JSON.parse(state.files.get(manifest)).length, 12, 'cleanup stays capped at 128 while admission uses free capacity');
  assert.ok(state.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('actual unwritable admission blocks repeated new captures and protects an existing live destination', async () => {
  const state = productionAdapter();
  state.failures.create = false;
  const live = await state.adapter.adoptTemporaryChallengePhoto('file:///cache/ImagePicker/fresh.jpg');
  state.failures.write = true;
  const capture = captureThroughProduction(state);
  for (let index = 0; index < 20; index++) assert.equal(await capture.run(), 'unavailable');
  assert.equal(capture.launches(), 0);
  assert.equal(state.files.get(live), 'photo');
  assert.equal(JSON.parse(state.files.get('file:///cache/freed-challenge-photos-v1/owned.json')).length, 1);

  state.failures.write = false;
  assert.equal(await capture.run(), 'matched');
  assert.equal(capture.launches(), 1);
  assert.equal(state.files.get(live), 'photo');
  await state.adapter.deleteTemporaryChallengePhoto(live);
});

test('already-open camera storage failure cleans every late fresh return and blocks another camera until safe registration', async () => {
  const state = productionAdapter();
  state.failures.create = false;
  let finish;
  let launched;
  const began = new Promise(resolve => { launched = resolve; });
  const camera = new Promise(resolve => { finish = resolve; });
  const controller = new AbortController();
  const first = captureThroughProduction(state, { signal: controller.signal, launchCamera: () => { launched(); return camera; } });
  const running = first.run();
  await began;
  controller.abort();
  assert.equal(await running, 'cancelled');
  state.failures.write = true;
  state.failures.deletion = true;
  const originals = ['file:///cache/ImagePicker/late-one.jpg', 'file:///cache/ImagePicker/late-two.jpg'];
  for (const uri of originals) state.files.set(uri, 'late photo');
  finish({ canceled: false, assets: originals.map(uri => ({ uri })) });
  await new Promise(resolve => setTimeout(resolve, 0));
  for (const uri of originals) assert.ok(state.deleted.includes(uri), 'each already-returned fresh original gets fallback cleanup');
  const second = captureThroughProduction(state);
  assert.equal(await second.run(), 'unavailable');
  assert.equal(second.launches(), 0);
  assert.equal(state.adapter.cleanupAbandonedChallengePhotos().remaining, 2, 'both unresolved originals remain uniquely counted; copies never began');

  state.failures.write = false;
  state.failures.deletion = false;
  assert.equal(await second.run(), 'matched');
  for (const uri of originals) assert.ok(!state.files.has(uri));
  assert.ok(state.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('admission bypass mutation makes the full-backlog camera-launch protection fail', async () => {
  const state = productionAdapter({ mutateAdapter: source => {
    const changed = source.replace('export function prepareTemporaryChallengePhotoCapture(): boolean {', 'export function prepareTemporaryChallengePhotoCapture(): boolean { return true;');
    assert.notEqual(changed, source, 'mutation must bypass the actual storage admission');
    return changed;
  } });
  state.failures.create = false;
  state.failures.deletion = true;
  const originals = Array.from({ length: 140 }, (_, index) => `file:///cache/ImagePicker/full-${index}.jpg`);
  for (const uri of originals) state.files.set(uri, 'legacy photo');
  const manifest = 'file:///cache/freed-challenge-photos-v1/owned.json';
  state.files.set(manifest, JSON.stringify(originals));
  const capture = captureThroughProduction(state);
  assert.equal(await capture.run(), 'unavailable');
  assert.equal(capture.launches(), 1);
  assert.throws(() => assert.equal(capture.launches(), 0, 'full backlog must prevent camera launch'), /full backlog must prevent camera launch/);
  assert.deepEqual(JSON.parse(state.files.get(manifest)), originals, 'late fallback cannot truncate legacy ownership');
  assert.equal(state.adapter.cleanupAbandonedChallengePhotos().remaining, 141, 'late original is counted in addition to the complete legacy backlog');
});

test('unreadable existing ownership blocks actual capture and is preserved until reads recover', async () => {
  const state = productionAdapter();
  state.failures.create = false;
  const original = 'file:///cache/ImagePicker/fresh.jpg';
  const manifest = 'file:///cache/freed-challenge-photos-v1/owned.json';
  const registered = JSON.stringify([original]);
  state.files.set(manifest, registered);
  state.failures.read = true;
  const capture = captureThroughProduction(state);
  assert.equal(await capture.run(), 'unavailable');
  assert.equal(capture.launches(), 0);
  assert.equal(state.files.get(manifest), registered, 'unknown ownership cannot be overwritten with empty metadata');
  assert.ok(state.files.has(original));
  assert.equal(state.adapter.cleanupAbandonedChallengePhotos().metadataUnavailable, true);

  state.failures.read = false;
  assert.equal(await capture.run(), 'matched');
  assert.equal(capture.launches(), 1);
  assert.ok(!state.files.has(original));
  assert.ok(state.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});

test('inventory failure after deletion retains accurate attempted count and blocks admission', () => {
  const state = productionAdapter();
  state.failures.create = false;
  const original = 'file:///cache/ImagePicker/fresh.jpg';
  state.files.set('file:///cache/freed-challenge-photos-v1/owned.json', JSON.stringify([original]));
  state.failures.listFrom = 2;
  const result = state.adapter.cleanupAbandonedChallengePhotos();
  assert.equal(result.attempted, 1, 'a later inventory error cannot erase the completed retry attempt');
  assert.equal(result.remaining, 1, 'unknown namespace inventory remains explicitly unresolved');
  assert.equal(result.metadataUnavailable, true);
  assert.ok(!state.files.has(original));
  assert.equal(state.adapter.prepareTemporaryChallengePhotoCapture(), false);
  state.failures.listFrom = 0;
  assert.equal(state.adapter.prepareTemporaryChallengePhotoCapture(), true);
  assert.ok(state.files.has('file:///cache/ImagePicker/unrelated.jpg'));
});
