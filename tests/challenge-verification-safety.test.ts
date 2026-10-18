import assert from "node:assert/strict";
import test from "node:test";
import { isChallengeVerificationSatisfied } from "../src/lib/challenge-verification";
const timer = { kind: "timer" as const, label: "Timer", detail: "", minElapsedSec: 10 };
test("invalid numeric elapsed never completes timer verification", () => {
  for (const elapsedSec of [Number.NaN, Number.POSITIVE_INFINITY, -1]) assert.equal(isChallengeVerificationSatisfied(timer, { elapsedSec }), false);
});
test("nonfinite sensor, distance, accuracy and confidence cannot stand in for evidence", () => {
  assert.equal(isChallengeVerificationSatisfied({ ...timer, kind: "motion", minMotionSamples: 6 }, { elapsedSec: 10, motionSamples: Infinity }), false);
  assert.equal(isChallengeVerificationSatisfied({ ...timer, kind: "location", minDistanceMeters: 10, minLocationSamples: 2, maxLocationAccuracyMeters: 80 },
    { elapsedSec: 10, distanceMeters: Infinity, locationSamples: 2, bestLocationAccuracyMeters: NaN }), false);
  assert.equal(isChallengeVerificationSatisfied({ ...timer, kind: "photo", expectedPhotoLabels: ["flower"], minPhotoConfidence: 0.45 },
    { elapsedSec: 10, photoMatched: true, photoLabels: ["flower"], photoConfidence: NaN }), false);
});
