import { readPhotoCapabilities, readPhotoClassification, samePhotoIdentity, unavailablePhoto, type PhotoClassification, type PhotoCapabilities } from "./challenge-photo-contract";
import { distanceMeters, isChallengeVerificationSatisfied, type ChallengeVerificationEvidence, type GeoPoint } from "./challenge-verification";

export type VerificationCallbackContext = {
  sessionKey: string | null;
  active: boolean;
  completed: boolean;
  mounted: boolean;
  foregroundEpoch: number;
};

/** Native callbacks can be queued after unsubscribe. A foreground epoch also rejects
 * callbacks from the previous watch after pause/resume, before effect cleanup runs.
 * A camera operation deliberately survives the foreground pause caused by camera UI.
 */
export function createVerificationCallbackFence(readContext: () => VerificationCallbackContext, foregroundOnly = true) {
  const started = { ...readContext() };
  let cancelled = false;
  const eligible = started.sessionKey !== null && started.active && started.mounted && !started.completed;
  return {
    isCurrent() {
      const current = readContext();
      return eligible && !cancelled && current.mounted && !current.completed && current.sessionKey === started.sessionKey &&
        (!foregroundOnly || (current.active && current.foregroundEpoch === started.foregroundEpoch));
    },
    cancel() { cancelled = true; }
  };
}

export type VerificationAggregateEvidence = {
  motionSamples: number;
  steps: number;
  distanceMeters: number;
  locationSamples: number;
  bestLocationAccuracyMeters?: number;
};
const finiteNonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const bounded = (value: unknown, max: number) => finiteNonnegative(value) ? Math.min(value, max) : 0;

/** Holds only aggregate proof. Origins and sensor high-water marks belong to one
 * foreground subscription and never appear in read(), storage or process restoration.
 */
export function createVerificationSensorAccumulator(initial: Partial<ChallengeVerificationEvidence> = {}) {
  const evidence: VerificationAggregateEvidence = {
    motionSamples: Math.floor(bounded(initial.motionSamples, 9999)),
    steps: Math.floor(bounded(initial.steps, 100_000)),
    distanceMeters: bounded(initial.distanceMeters, 100_000),
    locationSamples: Math.floor(bounded(initial.locationSamples, 9999)),
    ...(finiteNonnegative(initial.bestLocationAccuracyMeters) ? { bestLocationAccuracyMeters: Math.min(initial.bestLocationAccuracyMeters, 100_000) } : {})
  };
  let motionGeneration = 0; let stepsGeneration = 0; let locationGeneration = 0;
  return {
    read: (): VerificationAggregateEvidence => ({ ...evidence }),
    startMotion() {
      const generation = ++motionGeneration;
      let cancelled = false; let previousMagnitude: number | null = null;
      return {
        observe(sample: { x: number; y: number; z: number }) {
          if (cancelled || generation !== motionGeneration || ![sample.x, sample.y, sample.z].every(Number.isFinite)) return false;
          const magnitude = Math.hypot(sample.x, sample.y, sample.z);
          const delta = previousMagnitude === null ? 0 : Math.abs(magnitude - previousMagnitude);
          previousMagnitude = magnitude;
          if (delta <= 0.18 || evidence.motionSamples >= 9999) return false;
          evidence.motionSamples += 1; return true;
        },
        cancel() { cancelled = true; previousMagnitude = null; }
      };
    },
    startSteps() {
      const generation = ++stepsGeneration; const segmentBase = evidence.steps;
      let cancelled = false; let highWater = 0;
      return {
        observe(cumulativeSteps: number) {
          if (cancelled || generation !== stepsGeneration || !finiteNonnegative(cumulativeSteps)) return false;
          highWater = Math.max(highWater, Math.floor(cumulativeSteps));
          const total = Math.min(segmentBase + highWater, 100_000);
          if (total === evidence.steps) return false;
          evidence.steps = total; return true;
        },
        cancel() { cancelled = true; }
      };
    },
    startLocation(maxAccuracyMeters: number) {
      const generation = ++locationGeneration; const segmentBase = evidence.distanceMeters;
      let cancelled = false; let origin: GeoPoint | null = null; let segmentDistance = 0;
      return {
        observe(sample: { latitude: number; longitude: number; accuracy?: number | null }): "accepted" | "accuracy" | "invalid" | "cancelled" {
          if (cancelled || generation !== locationGeneration) return "cancelled";
          if (!Number.isFinite(sample.latitude) || !Number.isFinite(sample.longitude) || Math.abs(sample.latitude) > 90 || Math.abs(sample.longitude) > 180) return "invalid";
          const accuracy = sample.accuracy;
          if (finiteNonnegative(accuracy)) evidence.bestLocationAccuracyMeters = Math.min(evidence.bestLocationAccuracyMeters ?? accuracy, accuracy);
          if (!finiteNonnegative(accuracy) || !finiteNonnegative(maxAccuracyMeters) || accuracy > maxAccuracyMeters) return "accuracy";
          const point = { latitude: sample.latitude, longitude: sample.longitude };
          origin ??= point;
          segmentDistance = Math.max(segmentDistance, distanceMeters(origin, point));
          evidence.distanceMeters = Math.min(segmentBase + segmentDistance, 100_000);
          evidence.locationSamples = Math.min(evidence.locationSamples + 1, 9999);
          return "accepted";
        },
        cancel() { cancelled = true; origin = null; }
      };
    }
  };
}

export type ChallengePhotoResult = PhotoClassification;
type CameraResult = { canceled: boolean; assets?: readonly { uri?: string | null }[] | null };
export type ChallengePhotoCaptureOptions = {
  expectedLabels: string[]; minPhotoConfidence?: number; isCurrent: () => boolean;
  getCapabilities: () => Promise<PhotoCapabilities>;
  preparePhotoCapture: () => boolean | Promise<boolean>;
  requestPermission: () => Promise<{ granted: boolean }>; launchCamera: () => Promise<CameraResult>;
  adoptPhoto: (uri: string) => Promise<string>;
  classifyPhoto: (uri: string, expectedLabels: string[], operationId: string) => Promise<ChallengePhotoResult>;
  cancelPhoto: (operationId: string) => void | Promise<unknown>;
  deletePhoto: (uri: string) => void | Promise<void>;
  signal?: AbortSignal; inferenceTimeoutMs?: number;
  onStatus: (message: string) => void; onClassification: (result: ChallengePhotoResult) => void;
  onPermissionDenied: () => void | Promise<void>;
};
// Process-wide authority survives hook remounts. Aborting camera UI does not release
// it: a late camera result must still be adopted/deleted before another camera opens.
let captureAuthority: object | null = null;
let photoSequence = 0;
export async function runChallengePhotoCapture(options: ChallengePhotoCaptureOptions): Promise<"stale" | "unavailable" | "permission-denied" | "cancelled" | "matched" | "uncertain"> {
  if (!options.isCurrent()) return 'stale';
  if (captureAuthority) { options.onStatus('Camera or on-device image classification is unavailable on this device.'); return 'unavailable'; }
  const authority = {}; captureAuthority = authority;
  const operationId = `photo-${Date.now()}-${++photoSequence}`;
  let abortListener: (()=>void) | undefined;
  const cancelled = new Promise<'cancelled'>(resolve => {
    abortListener = () => { void Promise.resolve().then(()=>options.cancelPhoto(operationId)).catch(()=>{}); resolve('cancelled'); };
    if (options.signal?.aborted) abortListener(); else options.signal?.addEventListener('abort',abortListener,{once:true});
  });
  const current = () => options.isCurrent() && !options.signal?.aborted;
  const work = (async () => {
    try {
      if (!current()) return 'stale' as const;
      const capabilities = readPhotoCapabilities(await options.getCapabilities());
      if (!current()) return 'stale' as const;
      if (!capabilities.cameraAvailable || !capabilities.classifierAvailable) { options.onStatus('Camera or on-device image classification is unavailable on this device.'); return 'unavailable' as const; }
      let storageReady = false;
      try { storageReady = typeof options.preparePhotoCapture === 'function' && await options.preparePhotoCapture(); }
      catch { /* Unwritable ownership fails closed before permission/camera. */ }
      if (!current()) return 'stale' as const;
      if (!storageReady) { options.onStatus('On-device image classification is unavailable in this build.'); return 'unavailable' as const; }
      const permission = await options.requestPermission();
      if (!current()) return 'stale' as const;
      if (!permission.granted) { await options.onPermissionDenied(); return 'permission-denied' as const; }
      const result = await options.launchCamera();
      const uris = Array.from(new Set((result.assets ?? []).flatMap(asset => typeof asset.uri === 'string' && asset.uri ? [asset.uri] : [])));
      const adopted: string[] = [];
      try {
        // Adoption registers only fresh app-owned capture paths, including delayed,
        // cancelled and stale returns. Cleanup never guesses ownership of a URI.
        let adoptionFailed = false;
        for (const uri of uris) {
          try { adopted.push(await options.adoptPhoto(uri)); }
          catch { adoptionFailed = true; }
        }
        if (adoptionFailed) {
          if (current()) options.onStatus('On-device image classification is unavailable in this build.');
          return current() ? 'unavailable' as const : 'stale' as const;
        }
        if (!current()) return 'stale' as const;
        if (result.canceled || !adopted[0]) { options.onStatus('Photo capture cancelled.'); return 'cancelled' as const; }
        options.onStatus('Classifying the photo on this device...');
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<null>(resolve => { timer=setTimeout(()=>{void Promise.resolve().then(()=>options.cancelPhoto(operationId)).catch(()=>{});resolve(null);},options.inferenceTimeoutMs ?? 8500); });
        let raw: PhotoClassification | null | 'cancelled';
        try { raw = await Promise.race([options.classifyPhoto(adopted[0],options.expectedLabels,operationId),deadline,cancelled]); }
        finally { clearTimeout(timer); }
        if (!current()) return 'stale' as const;
        if (!raw || raw === 'cancelled') { options.onStatus('On-device image classification is unavailable in this build.'); return 'unavailable' as const; }
        const parsed = readPhotoClassification(raw);
        const classification = samePhotoIdentity(parsed.identity,capabilities.identity) ? parsed : unavailablePhoto();
        const matched = classification.available && isChallengeVerificationSatisfied({kind:'photo',label:'',detail:'',minElapsedSec:0,
          expectedPhotoLabels:options.expectedLabels,minPhotoConfidence:options.minPhotoConfidence ?? .65},
          {elapsedSec:0,photoMatched:classification.matched,photoLabels:classification.matchedLabels,photoConfidence:classification.confidence});
        options.onClassification(matched ? classification : {...classification,matched:false, outcome: classification.available ? 'uncertain' : classification.outcome,
          message:classification.available ? 'The requested object is uncertain. Try a clearer photo or choose another reset.' : classification.message});
        return classification.outcome === 'cancelled' ? 'cancelled' as const : !classification.available ? 'unavailable' as const : matched ? 'matched' as const : 'uncertain' as const;
      } finally {
        for (const uri of adopted) { try { await options.deletePhoto(uri); } catch { /* Owned manifest retains failures for restart/retry. */ } }
      }
    } finally { if (captureAuthority === authority) captureAuthority=null; }
  })();
  // Late camera continuation owns cleanup and authority even after the UI has returned.
  work.catch(()=>{});
  try { return await Promise.race([work,cancelled]); }
  finally { if(abortListener) options.signal?.removeEventListener('abort',abortListener); }
}
