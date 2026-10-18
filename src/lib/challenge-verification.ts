import type { RecoveryChallenge } from "./recovery-engine";
import { LOCAL_PHOTO_TARGETS, normalizeChallengeRule } from './challenge-rules';

export type ChallengeVerificationKind = "timer" | "motion" | "steps" | "location" | "photo" | "connection" | "unavailable";

export type ChallengeVerificationRequirement = {
  kind: ChallengeVerificationKind;
  label: string;
  detail: string;
  minElapsedSec: number;
  minMotionSamples?: number;
  minSteps?: number;
  minDistanceMeters?: number;
  minLocationSamples?: number;
  maxLocationAccuracyMeters?: number;
  expectedPhotoLabels?: string[];
  minPhotoConfidence?: number;
};

export type ChallengeVerificationEvidence = {
  elapsedSec: number;
  motionSamples?: number;
  steps?: number;
  distanceMeters?: number;
  locationSamples?: number;
  bestLocationAccuracyMeters?: number;
  photoMatched?: boolean;
  photoLabels?: string[];
  photoConfidence?: number;
  connectionActionComplete?: boolean;
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

const MIN_PHOTO_CONFIDENCE = 0.45;
const MIN_LOCATION_SAMPLES = 2;
const MAX_LOCATION_ACCURACY_METERS = 80;

export function getChallengeVerificationRequirement(challenge: RecoveryChallenge): ChallengeVerificationRequirement {
  const minElapsedSec = Math.max(1, challenge.durationSec);
  const rule = normalizeChallengeRule(challenge.verification);
  if (!rule) return { kind: 'unavailable', label: 'Verification unavailable', detail: 'Choose a new reset with a supported verification rule.', minElapsedSec };
  if (rule.kind === 'photo') return { kind: 'photo', label: 'Photo target matched', detail: 'Take a fresh photo of the requested object. It is checked on this device.', minElapsedSec,
    expectedPhotoLabels: [...LOCAL_PHOTO_TARGETS[rule.targetId]], minPhotoConfidence: .65 };
  if (rule.kind === 'motion') return { kind: 'motion', label: 'Device movement observed', detail: 'FREED observes phone movement during this activity. It does not count or verify exercise repetitions.', minElapsedSec, minMotionSamples: rule.minMotionSamples };
  if (rule.kind === 'steps') return { kind: 'steps', label: 'Steps observed', detail: 'Carry the phone to count steps during this reset.', minElapsedSec, minSteps: rule.minSteps };
  if (rule.kind === 'location') return { kind: 'location', label: 'Movement observed', detail: 'Foreground distance is checked without saving route history.', minElapsedSec,
    minDistanceMeters: rule.minDistanceMeters, minLocationSamples: MIN_LOCATION_SAMPLES, maxLocationAccuracyMeters: MAX_LOCATION_ACCURACY_METERS };
  if (rule.kind === 'connection') return { kind: 'connection', label: 'Connection action confirmed', detail: 'Confirm the connection action when you return.', minElapsedSec };
  return { kind: 'timer', label: 'Activity recorded', detail: 'Stay with the reset, then confirm that you finished. A timer cannot prove physical activity.', minElapsedSec };
}

export function isChallengeVerificationSatisfied(
  requirement: ChallengeVerificationRequirement,
  evidence: ChallengeVerificationEvidence
): boolean {
  if (requirement.kind === "unavailable") return false;
  const finiteNonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (!finiteNonnegative(evidence.elapsedSec) || !finiteNonnegative(requirement.minElapsedSec) || evidence.elapsedSec < requirement.minElapsedSec) return false;

  if (requirement.kind === "motion") {
    return finiteNonnegative(evidence.motionSamples) && evidence.motionSamples >= (requirement.minMotionSamples ?? 1);
  }

  if (requirement.kind === "steps") {
    return finiteNonnegative(evidence.steps) && evidence.steps >= (requirement.minSteps ?? 1);
  }

  if (requirement.kind === "location") {
    if (!finiteNonnegative(evidence.locationSamples) || !finiteNonnegative(evidence.distanceMeters) || !finiteNonnegative(evidence.bestLocationAccuracyMeters)) return false;
    if (evidence.locationSamples < (requirement.minLocationSamples ?? MIN_LOCATION_SAMPLES)) return false;
    if ((evidence.bestLocationAccuracyMeters ?? Number.POSITIVE_INFINITY) > (requirement.maxLocationAccuracyMeters ?? MAX_LOCATION_ACCURACY_METERS)) {
      return false;
    }
    return (evidence.distanceMeters ?? 0) >= (requirement.minDistanceMeters ?? 1);
  }

  if (requirement.kind === "photo") {
    if (evidence.photoMatched !== true) return false;
    const expectedLabels = requirement.expectedPhotoLabels ?? [];
    if (expectedLabels.length === 0) return false;
    if (!finiteNonnegative(evidence.photoConfidence) || evidence.photoConfidence > 1 || evidence.photoConfidence < (requirement.minPhotoConfidence ?? MIN_PHOTO_CONFIDENCE)) return false;
    return evidence.photoLabels?.some((label) => expectedLabels.some((expected) => photoLabelMatches(label, expected))) === true;
  }

  if (requirement.kind === "connection") {
    return evidence.connectionActionComplete === true;
  }

  return true;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const earthRadiusMeters = 6_371_000;
  const lat1 = degreesToRadians(a.latitude);
  const lat2 = degreesToRadians(b.latitude);
  const deltaLat = degreesToRadians(b.latitude - a.latitude);
  const deltaLon = degreesToRadians(b.longitude - a.longitude);
  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function normalizePhotoLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function photoLabelMatches(observedValue: string, expectedValue: string): boolean {
  const observed = normalizePhotoLabel(observedValue);
  const expected = normalizePhotoLabel(expectedValue);
  if (!observed || !expected) return false;
  return observed === expected;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
