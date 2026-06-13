import assert from "node:assert/strict";

import {
  CHALLENGE_ENGINE_FAMILIES,
  CHALLENGE_TEMPLATES,
  getChallengeEngineFamilyCoverage,
  inferChallengeEngineFamilies
} from "../src/data/challenge-templates";
import {
  distanceMeters,
  getChallengeVerificationRequirement,
  isChallengeVerificationSatisfied
} from "../src/lib/challenge-verification";
import { challengeLibrary, type RecoveryChallenge } from "../src/lib/recovery-engine";

type AuditEntry = {
  id: string;
  status: "pass" | "fail";
  evidence: string;
};

function result(id: string, status: "pass" | "fail", evidence: string): AuditEntry {
  return { id, status, evidence };
}

function runCase(id: string, fn: () => string): AuditEntry {
  try {
    return result(id, "pass", fn());
  } catch (error) {
    return result(id, "fail", error instanceof Error ? error.message : "assertion failed");
  }
}

function challenge(overrides: Partial<RecoveryChallenge>): RecoveryChallenge {
  return {
    id: "audit-challenge",
    title: "Audit challenge",
    category: "reset",
    durationSec: 60,
    intensity: "medium",
    premium: false,
    icon: "Activity",
    why: "Audit-only recovery challenge.",
    steps: ["Start.", "Finish."],
    ...overrides
  };
}

const checks = [
  runCase("physical-effort-requires-motion", () => {
    const requirement = getChallengeVerificationRequirement(
      challenge({
        id: "audit-pushups",
        title: "20 controlled pushups",
        category: "physical",
        durationSec: 90,
        intensity: "strong",
        steps: ["Plant your hands.", "Lower slowly."]
      })
    );

    assert.equal(requirement.kind, "motion");
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 90, motionSamples: 0 }), false);
    assert.equal(
      isChallengeVerificationSatisfied(requirement, { elapsedSec: 90, motionSamples: requirement.minMotionSamples }),
      true
    );
    return "Physical effort fails closed until accelerometer movement samples meet the threshold.";
  }),
  runCase("outdoor-walk-requires-location", () => {
    const templateWalk = CHALLENGE_TEMPLATES.find((item) => item.title.toLowerCase().includes("walk outside"));
    assert.ok(templateWalk, "walk outside template exists");
    const requirement = getChallengeVerificationRequirement(templateWalk);

    assert.equal(requirement.kind, "location");
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: templateWalk.durationSec, distanceMeters: 1, locationSamples: 2, bestLocationAccuracyMeters: 20 }), false);
    assert.equal(
      isChallengeVerificationSatisfied(requirement, {
        elapsedSec: templateWalk.durationSec,
        distanceMeters: requirement.minDistanceMeters,
        locationSamples: 1,
        bestLocationAccuracyMeters: 20
      }),
      false
    );
    assert.equal(
      isChallengeVerificationSatisfied(requirement, {
        elapsedSec: templateWalk.durationSec,
        distanceMeters: requirement.minDistanceMeters,
        locationSamples: requirement.minLocationSamples,
        bestLocationAccuracyMeters: 120
      }),
      false
    );
    assert.equal(
      isChallengeVerificationSatisfied(requirement, {
        elapsedSec: templateWalk.durationSec,
        distanceMeters: requirement.minDistanceMeters,
        locationSamples: requirement.minLocationSamples,
        bestLocationAccuracyMeters: 20
      }),
      true
    );
    return "Outdoor walking templates require accurate foreground location fixes and distance instead of a passive timer or noisy GPS jump.";
  }),
  runCase("indoor-reset-can-require-steps", () => {
    const requirement = getChallengeVerificationRequirement(
      challenge({
        id: "audit-clean-desk",
        title: "Clean your desk for 3 minutes",
        category: "reset",
        durationSec: 180,
        steps: ["Move papers into one stack.", "Tidy the desk surface."]
      })
    );

    assert.equal(requirement.kind, "steps");
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 180, steps: 0 }), false);
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 180, steps: requirement.minSteps }), true);
    return "Movement-style indoor resets require pedometer evidence before completion.";
  }),
  runCase("generic-walk-uses-steps", () => {
    const requirement = getChallengeVerificationRequirement(
      challenge({
        id: "audit-indoor-walk",
        title: "Walk 40 steps around your room",
        category: "reset",
        durationSec: 120,
        steps: ["Carry the phone.", "Walk around the room until the counter moves."]
      })
    );

    assert.equal(requirement.kind, "steps");
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 120, steps: 0 }), false);
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 120, steps: requirement.minSteps }), true);
    return "Generic walking resets use pedometer evidence instead of requesting foreground location.";
  }),
  runCase("specific-photo-targets-require-camera-label-match", () => {
    const requirement = getChallengeVerificationRequirement(
      challenge({
        id: "audit-flower-photo",
        title: "Take a photo of a flower nearby",
        category: "reset",
        durationSec: 60,
        icon: "Camera",
        steps: ["Find a flower.", "Take a fresh camera photo."]
      })
    );

    assert.equal(requirement.kind, "photo");
    assert.ok(requirement.expectedPhotoLabels?.includes("flower"));
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 60, photoMatched: false }), false);
    assert.equal(
      isChallengeVerificationSatisfied(requirement, {
        elapsedSec: 60,
        photoMatched: true,
        photoLabels: ["flower"],
        photoConfidence: 0.2
      }),
      false
    );
    assert.equal(
      isChallengeVerificationSatisfied(requirement, {
        elapsedSec: 60,
        photoMatched: true,
        photoLabels: ["flower"],
        photoConfidence: 0.91
      }),
      true
    );
    return "Specific photo challenges fail closed until native on-device labels match the target.";
  }),
  runCase("photo-label-lexicon-covers-core-outdoor-quests", () => {
    const targets = [
      ["flower", "Take a picture of a flower nearby"],
      ["tree", "Photograph a tree outside"],
      ["sky", "Take a photo of the sky"],
      ["dog", "Take a picture of a dog outside"]
    ] as const;

    for (const [label, title] of targets) {
      const requirement = getChallengeVerificationRequirement(
        challenge({
          id: `audit-${label}-photo`,
          title,
          category: "reset",
          icon: "Camera",
          steps: ["Use the camera.", "Capture the target."]
        })
      );
      assert.equal(requirement.kind, "photo", `${label} should be photo-verified`);
      assert.ok(requirement.expectedPhotoLabels?.includes(label), `${label} label missing`);
    }
    return "Photo verification recognizes flower, tree, sky, and dog target labels.";
  }),
  runCase("connection-requires-explicit-action", () => {
    const requirement = getChallengeVerificationRequirement(
      challenge({
        id: "audit-partner",
        title: "Message your accountability partner",
        category: "connection",
        durationSec: 90,
        icon: "MessageCircleHeart",
        steps: ["Send the check-in.", "Return to FREED."]
      })
    );

    assert.equal(requirement.kind, "connection");
    assert.match(requirement.detail, /Complete the connection action/);
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 90, connectionActionComplete: false }), false);
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 90, connectionActionComplete: true }), true);
    return "Connection challenges require an explicit user action before completion, without depending only on a configured partner.";
  }),
  runCase("quiet-breathing-stays-timer-verified", () => {
    const breathing = challengeLibrary.find((item) => item.id === "breathing-478");
    assert.ok(breathing, "breathing challenge exists");
    const requirement = getChallengeVerificationRequirement(breathing);

    assert.equal(requirement.kind, "timer");
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: 1 }), false);
    assert.equal(isChallengeVerificationSatisfied(requirement, { elapsedSec: requirement.minElapsedSec }), true);
    return "Calm breathing uses a timer gate, avoiding unnecessary sensor access.";
  }),
  runCase("production-challenge-families-covered", () => {
    const coverage = getChallengeEngineFamilyCoverage();
    for (const family of CHALLENGE_ENGINE_FAMILIES) {
      assert.ok(coverage[family] > 0, `${family} family has no local templates`);
    }
    return `Local templates cover production families: ${CHALLENGE_ENGINE_FAMILIES.join(", ")}.`;
  }),
  runCase("custom-challenge-families-inferred", () => {
    const families = inferChallengeEngineFamilies({
      title: "Late-night accountability relapse reset",
      category: "connection",
      durationSec: 90,
      intensity: "strong",
      contexts: ["high-urge", "late-night"],
      why: "Break secrecy during a relapse urge before the next step.",
      steps: ["Message your accountability partner.", "Get out of bed.", "Wait before unlocking."]
    });
    for (const family of ["social", "emergency", "anti-relapse", "late-night", "quick-reset"] as const) {
      assert.ok(families.includes(family), `${family} family was not inferred for custom challenge text`);
    }
    return "Custom and fallback challenge text can be mapped into production families before scoring.";
  }),
  runCase("distance-helper-uses-real-world-scale", () => {
    const meters = distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.001 });
    assert.ok(meters > 100 && meters < 120);
    return "GPS distance helper converts coordinates to realistic meters.";
  })
];

const failed = checks.filter((entry) => entry.status === "fail");

console.log("# FREED challenge verification audit");
console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
