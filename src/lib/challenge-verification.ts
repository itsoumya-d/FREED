import type { RecoveryChallenge } from "./recovery-engine";

export type ChallengeVerificationKind = "timer" | "motion" | "steps" | "location" | "photo" | "connection";

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
  const text = `${challenge.title} ${challenge.steps.join(" ")}`.toLowerCase();
  const minElapsedSec = Math.max(1, challenge.durationSec);

  if (challenge.category === "connection") {
    return {
      kind: "connection",
      label: "Connection action",
      detail: "Complete the connection action before FREED marks this complete.",
      minElapsedSec
    };
  }

  const expectedPhotoLabels = getExpectedPhotoLabels(text);
  if (requiresPhotoEvidence(text) && expectedPhotoLabels.length > 0) {
    return {
      kind: "photo",
      label: "Photo verified",
      detail: `Take a fresh photo. FREED checks on-device labels for ${expectedPhotoLabels.slice(0, 3).join(", ")}.`,
      minElapsedSec,
      expectedPhotoLabels,
      minPhotoConfidence: MIN_PHOTO_CONFIDENCE
    };
  }

  if ((challenge.category === "reset" || challenge.category === "physical") && requiresLocationMovement(text)) {
    return {
      kind: "location",
      label: "Movement verified",
      detail: "Move away from your starting point. FREED verifies foreground distance with accurate fixes, not route history.",
      minElapsedSec,
      minDistanceMeters: challenge.durationSec >= 300 ? 20 : 10,
      minLocationSamples: MIN_LOCATION_SAMPLES,
      maxLocationAccuracyMeters: MAX_LOCATION_ACCURACY_METERS
    };
  }

  if (challenge.category === "physical") {
    return {
      kind: "motion",
      label: "Motion verified",
      detail: "Keep the phone with you. FREED looks for real device movement during the reset.",
      minElapsedSec,
      minMotionSamples: challenge.intensity === "strong" ? 10 : 6
    };
  }

  if (challenge.category === "reset" && requiresStepMovement(text)) {
    return {
      kind: "steps",
      label: "Steps verified",
      detail: "Carry the phone while you move so FREED can count real steps.",
      minElapsedSec,
      minSteps: challenge.durationSec >= 180 ? 24 : 12
    };
  }

  return {
    kind: "timer",
    label: "Timer verified",
    detail: "Stay with the reset until the timer finishes.",
    minElapsedSec
  };
}

export function isChallengeVerificationSatisfied(
  requirement: ChallengeVerificationRequirement,
  evidence: ChallengeVerificationEvidence
): boolean {
  if (evidence.elapsedSec < requirement.minElapsedSec) return false;

  if (requirement.kind === "motion") {
    return (evidence.motionSamples ?? 0) >= (requirement.minMotionSamples ?? 1);
  }

  if (requirement.kind === "steps") {
    return (evidence.steps ?? 0) >= (requirement.minSteps ?? 1);
  }

  if (requirement.kind === "location") {
    if ((evidence.locationSamples ?? 0) < (requirement.minLocationSamples ?? MIN_LOCATION_SAMPLES)) return false;
    if ((evidence.bestLocationAccuracyMeters ?? Number.POSITIVE_INFINITY) > (requirement.maxLocationAccuracyMeters ?? MAX_LOCATION_ACCURACY_METERS)) {
      return false;
    }
    return (evidence.distanceMeters ?? 0) >= (requirement.minDistanceMeters ?? 1);
  }

  if (requirement.kind === "photo") {
    if (evidence.photoMatched !== true) return false;
    const expectedLabels = requirement.expectedPhotoLabels ?? [];
    if (expectedLabels.length === 0) return false;
    if ((evidence.photoConfidence ?? 0) < (requirement.minPhotoConfidence ?? MIN_PHOTO_CONFIDENCE)) return false;
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

function requiresLocationMovement(text: string): boolean {
  const hasOutdoorContext = /\b(outside|outdoors?|street|road|park|grass|tree|sky|sunlight|cafe|store|building|nearby|neighborhood|block)\b/.test(text);
  const hasMovementIntent = /\b(walk|walking|stroll|step|go|move|travel|explore|around|away|leave|visit|circle|loop|distance|meters?|metres?|blocks?)\b/.test(text);
  return hasOutdoorContext && hasMovementIntent;
}

function requiresPhotoEvidence(text: string): boolean {
  return /\b(photo|picture|photograph|camera|capture)\b/.test(text);
}

function requiresStepMovement(text: string): boolean {
  return /\b(walk|walking|stroll|step|steps|pace|paces|stairs|room|hallway|desk|clean|tidy|move|moving|lap|laps)\b/.test(text);
}

function getExpectedPhotoLabels(text: string): string[] {
  const labelGroups: Array<[RegExp, string[]]> = [
    [/\b(flowers?|blossoms?|petals?)\b/, ["flower", "plant", "flora", "petal", "blossom"]],
    [/\b(trees?|leaves|leaf|branches?)\b/, ["tree", "plant", "forest", "leaf", "branch"]],
    [/\bgrass|lawn\b/, ["grass", "plant", "field", "lawn"]],
    [/\bsky|cloud|sunlight|sun|sunrise|sunset\b/, ["sky", "cloud", "sun", "sunlight", "horizon"]],
    [/\bdog|puppy|canine\b/, ["dog", "canine", "animal", "pet"]],
    [/\bcafe|coffee shop|store|shop\b/, ["cafe", "coffee", "shop", "store", "building"]],
    [/\bstreet|road|building|outside|outdoors\b/, ["street", "road", "building", "outdoor"]]
  ];

  const labels = new Set<string>();
  labelGroups.forEach(([pattern, group]) => {
    if (pattern.test(text)) group.forEach((label) => labels.add(label));
  });
  return Array.from(labels);
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
  if (observed.includes(expected) || expected.includes(observed)) return true;
  const observedTokens = new Set(observed.split(" ").filter(Boolean));
  return expected.split(" ").some((token) => observedTokens.has(token));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
