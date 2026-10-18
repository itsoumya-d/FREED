import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createVerificationCallbackFence,
  createVerificationSensorAccumulator,
  runChallengePhotoCapture,
  type VerificationCallbackContext,
  type ChallengePhotoCaptureOptions
} from "../src/lib/challenge-verification-runtime";

function context() {
  let current: VerificationCallbackContext = { sessionKey: "session-a", active: true, completed: false, mounted: true, foregroundEpoch: 0 };
  return { read: () => current, change: (patch: Partial<VerificationCallbackContext>) => { current = { ...current, ...patch }; } };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>(done => { resolve = done; });
  return { promise, resolve };
}

const identity = { provider: 'bundled-mlkit' as const, classifierRevision: 'com.google.mlkit:image-labeling:17.0.9', runtimeRevision: 'android-36', ruleRevision: 'freed-photo-targets-v1' as const, modelWeightsRevision: null };
const matchedPhoto = { outcome: "matched" as const, identity, available: true, matched: true, labels: ["flower"], matchedLabels: ["flower"], confidence: 0.8, message: "Target found." };
function photoOptions(overrides: Partial<ChallengePhotoCaptureOptions> = {}) {
  const published: unknown[] = [];
  const options: ChallengePhotoCaptureOptions = {
    expectedLabels: ["flower"], isCurrent: () => true,
    preparePhotoCapture: async () => true,
    getCapabilities: async () => ({ cameraAvailable: true, classifierAvailable: true, identity, supportedTargetIds: ["flower"], validatedPhotoTargets: [] }),
    requestPermission: async () => ({ granted: true }),
    launchCamera: async () => ({ canceled: false, assets: [{ uri: "temporary-photo" }] }),
    adoptPhoto: async uri => uri, cancelPhoto: async () => true, classifyPhoto: async () => matchedPhoto, deletePhoto: () => {},
    onStatus: () => {}, onClassification: result => { published.push(result); }, onPermissionDenied: async () => {},
    ...overrides
  };
  return { options, published };
}

test("a callback from an older same-kind session cannot write proof into the new session", () => {
  const life = context();
  const callback = createVerificationCallbackFence(life.read);
  const proof: number[] = [];
  life.change({ sessionKey: "session-b" });
  if (callback.isCurrent()) proof.push(12);
  assert.deepEqual(proof, []);
});

test("paused sensor callbacks remain rejected after foreground resumes", () => {
  const life = context(); const oldWatch = createVerificationCallbackFence(life.read);
  life.change({ active: false, foregroundEpoch: 1 });
  assert.equal(oldWatch.isCurrent(), false);
  life.change({ active: true, foregroundEpoch: 2 });
  assert.equal(oldWatch.isCurrent(), false);
  assert.equal(createVerificationCallbackFence(life.read).isCurrent(), true);
});

test("cleanup rejects pending permission and late native callbacks", () => {
  const life = context(); const callback = createVerificationCallbackFence(life.read);
  callback.cancel();
  assert.equal(callback.isCurrent(), false);
});

test("an in-flight camera result survives the camera's foreground pause", () => {
  const life = context(); const photo = createVerificationCallbackFence(life.read, false);
  life.change({ active: false, foregroundEpoch: 1 });
  assert.equal(photo.isCurrent(), true);
});

test("photo callbacks reject completion, unmount and a replaced session", () => {
  for (const patch of [{ completed: true }, { mounted: false }, { sessionKey: "session-b" }]) {
    const life = context(); const photo = createVerificationCallbackFence(life.read, false);
    life.change(patch);
    assert.equal(photo.isCurrent(), false);
  }
});

test("a step segment accumulates cumulative callbacks only once and keeps totals across resume", () => {
  const sensor = createVerificationSensorAccumulator({ steps: 20 });
  const first = sensor.startSteps();
  first.observe(4); first.observe(9); first.observe(9); first.observe(3);
  assert.equal(sensor.read().steps, 29);
  first.cancel();
  const resumed = sensor.startSteps(); resumed.observe(2); resumed.observe(6);
  assert.equal(sensor.read().steps, 35);
  first.observe(900);
  assert.equal(sensor.read().steps, 35);
});

test("invalid native step readings never erase or manufacture restored totals", () => {
  const sensor = createVerificationSensorAccumulator({ steps: 12 }); const segment = sensor.startSteps();
  for (const value of [NaN, Infinity, -1]) segment.observe(value);
  assert.equal(sensor.read().steps, 12);
  segment.observe(2.9);
  assert.equal(sensor.read().steps, 14);
});

test("motion keeps restored proof but a new watch starts with a fresh magnitude", () => {
  const sensor = createVerificationSensorAccumulator({ motionSamples: 4 });
  const first = sensor.startMotion();
  first.observe({ x: 0, y: 0, z: 1 }); first.observe({ x: 0, y: 0, z: 1.3 });
  first.cancel();
  const resumed = sensor.startMotion(); resumed.observe({ x: 0, y: 0, z: 3 });
  assert.equal(sensor.read().motionSamples, 5);
  first.observe({ x: 0, y: 0, z: 7 }); resumed.observe({ x: NaN, y: 0, z: 0 });
  resumed.observe({ x: 0, y: 0, z: 3.3 });
  assert.equal(sensor.read().motionSamples, 6);
});

test("location resume gets a fresh origin and does not count background travel", () => {
  const sensor = createVerificationSensorAccumulator({ distanceMeters: 10, locationSamples: 2, bestLocationAccuracyMeters: 12 });
  const first = sensor.startLocation(80);
  first.observe({ latitude: 0, longitude: 0, accuracy: 20 });
  first.observe({ latitude: 0, longitude: 0.0001, accuracy: 18 });
  assert.equal(Math.round(sensor.read().distanceMeters), 21);
  first.cancel();
  const resumed = sensor.startLocation(80);
  resumed.observe({ latitude: 0, longitude: 1, accuracy: 15 });
  assert.equal(Math.round(sensor.read().distanceMeters), 21);
  resumed.observe({ latitude: 0, longitude: 1.0001, accuracy: 10 });
  assert.equal(Math.round(sensor.read().distanceMeters), 32);
  assert.equal(sensor.read().locationSamples, 6);
  assert.equal(sensor.read().bestLocationAccuracyMeters, 10);
  assert.deepEqual(Object.keys(sensor.read()).sort(), ["bestLocationAccuracyMeters", "distanceMeters", "locationSamples", "motionSamples", "steps"]);
});

test("unknown or poor location accuracy and invalid coordinates never add movement", () => {
  const sensor = createVerificationSensorAccumulator(); const segment = sensor.startLocation(80);
  assert.equal(segment.observe({ latitude: 0, longitude: 0, accuracy: null }), "accuracy");
  assert.equal(segment.observe({ latitude: 0, longitude: 0, accuracy: 120 }), "accuracy");
  assert.equal(segment.observe({ latitude: NaN, longitude: 0, accuracy: 10 }), "invalid");
  assert.equal(segment.observe({ latitude: 91, longitude: 0, accuracy: 10 }), "invalid");
  assert.equal(sensor.read().locationSamples, 0);
  assert.equal(sensor.read().distanceMeters, 0);
});

test("a stale camera launch deletes every returned file without classifying or publishing", async () => {
  const life = context(); const photo = createVerificationCallbackFence(life.read, false);
  const launch = deferred<{ canceled: boolean; assets: { uri: string }[] }>();
  const launched = deferred<void>();
  const dir = await mkdtemp(join(tmpdir(), "freed-photo-test-"));
  const paths = [join(dir, "a.jpg"), join(dir, "b.jpg")];
  try {
    for (const path of paths) await writeFile(path, "temporary-camera-data");
    const flow = photoOptions({ isCurrent: photo.isCurrent,
      launchCamera: () => { launched.resolve(); return launch.promise; },
      classifyPhoto: async () => { throw new Error("Stale launch must never classify"); }, deletePhoto: uri => unlink(uri) });
    const running = runChallengePhotoCapture(flow.options);
    await launched.promise; life.change({ sessionKey: "session-b" });
    launch.resolve({ canceled: false, assets: paths.map(uri => ({ uri })) });
    assert.equal(await running, "stale");
    assert.deepEqual(flow.published, []);
    for (const path of paths) await assert.rejects(readFile(path), { code: "ENOENT" });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a classification finishing after session completion cannot publish photo proof", async () => {
  const life = context(); const photo = createVerificationCallbackFence(life.read, false);
  const classification = deferred<typeof matchedPhoto>(); const started = deferred<void>();
  const flow = photoOptions({ isCurrent: photo.isCurrent, classifyPhoto: () => { started.resolve(); return classification.promise; } });
  const running = runChallengePhotoCapture(flow.options);
  await started.promise; life.change({ completed: true }); classification.resolve(matchedPhoto);
  assert.equal(await running, "stale"); assert.deepEqual(flow.published, []);
});

test("camera pause still publishes a valid result for the current session", async () => {
  const life = context(); const photo = createVerificationCallbackFence(life.read, false);
  const flow = photoOptions({ isCurrent: photo.isCurrent, launchCamera: async () => {
    life.change({ active: false, foregroundEpoch: 1 }); return { canceled: false, assets: [{ uri: "temporary-photo" }] };
  } });
  assert.equal(await runChallengePhotoCapture(flow.options), "matched");
  assert.deepEqual(flow.published, [matchedPhoto]);
});

test('an uncertain or wrong target is reported honestly and its temporary capture is removed', async()=>{
  for (const result of [
    {...matchedPhoto,matched:false,matchedLabels:[]},
    {...matchedPhoto,matchedLabels:['plant']},
    {...matchedPhoto,confidence:.5},
  ]) {
    const files=new Set(['temporary-photo']);
    const flow=photoOptions({classifyPhoto:async()=>result,deletePhoto:uri=>{files.delete(uri);}});
    assert.equal(await runChallengePhotoCapture(flow.options),'uncertain');
    assert.equal(files.size,0);
  }
});

test("cancelling a camera result removes files returned with the cancelled result", async () => {
  const files = new Set(["cancelled-photo"]);
  const flow = photoOptions({ launchCamera: async () => ({ canceled: true, assets: [{ uri: "cancelled-photo" }] }), deletePhoto: uri => { files.delete(uri); } });
  assert.equal(await runChallengePhotoCapture(flow.options), "cancelled");
  assert.equal(files.size, 0); assert.deepEqual(flow.published, []);
});

test("classification failure still removes the temporary file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "freed-photo-error-")); const path = join(dir, "camera.jpg");
  try {
    await writeFile(path, "temporary-camera-data");
    const flow = photoOptions({ launchCamera: async () => ({ canceled: false, assets: [{ uri: path }] }),
      classifyPhoto: async () => { throw new Error("Classifier unavailable"); }, deletePhoto: uri => unlink(uri) });
    await assert.rejects(runChallengePhotoCapture(flow.options), /Classifier unavailable/);
    await assert.rejects(readFile(path), { code: "ENOENT" });
    assert.deepEqual(flow.published, []);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("hardware and permission failures never launch the camera or produce proof", async () => {
  const unavailable = photoOptions({ getCapabilities: async () => ({ cameraAvailable: true, classifierAvailable: false }),
    requestPermission: async () => { throw new Error("Unavailable hardware must not request permission"); } });
  assert.equal(await runChallengePhotoCapture(unavailable.options), "unavailable");
  assert.deepEqual(unavailable.published, []);
  const denied = photoOptions({ requestPermission: async () => ({ granted: false }),
    launchCamera: async () => { throw new Error("Denied permission must not launch camera"); } });
  assert.equal(await runChallengePhotoCapture(denied.options), "permission-denied");
  assert.deepEqual(denied.published, []);
});

test("session replacement during permission request cannot open settings or the camera", async () => {
  const life = context(); const photo = createVerificationCallbackFence(life.read, false);
  const permission = deferred<{ granted: boolean }>(); const asked = deferred<void>();
  const flow = photoOptions({ isCurrent: photo.isCurrent, requestPermission: () => { asked.resolve(); return permission.promise; },
    onPermissionDenied: async () => { throw new Error("Stale denial must not open settings"); },
    launchCamera: async () => { throw new Error("Stale permission must not launch camera"); } });
  const running = runChallengePhotoCapture(flow.options); await asked.promise;
  life.change({ sessionKey: "session-b" }); permission.resolve({ granted: false });
  assert.equal(await running, "stale"); assert.deepEqual(flow.published, []);
});
