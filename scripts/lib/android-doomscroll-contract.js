#!/usr/bin/env node

const assert = require("node:assert/strict");

const INSTAGRAM_ANDROID_PACKAGE = "com.instagram.android";
const TIKTOK_PRIMARY_ANDROID_PACKAGE = "com.zhiliaoapp.musically";
const TIKTOK_ANDROID_PACKAGE_ALIASES = ["com.ss.android.ugc.trill", "com.tiktok"];
const TIKTOK_ANDROID_PACKAGES = [TIKTOK_PRIMARY_ANDROID_PACKAGE, ...TIKTOK_ANDROID_PACKAGE_ALIASES];
const YOUTUBE_ANDROID_PACKAGE = "com.google.android.youtube";

const YOUTUBE_SHORTS_RULE = "short-form:youtube-shorts";
const INSTAGRAM_REELS_RULE = "short-form:instagram-reels";
const TIKTOK_FEED_RULE = "short-form:tiktok-feed";

const DEFAULT_SHORT_FORM_PACKAGE = YOUTUBE_ANDROID_PACKAGE;

const SHORT_FORM_RELEASE_PROFILES = {
  [YOUTUBE_ANDROID_PACKAGE]: {
    artifactField: "android.shortFormArtifact",
    atInterventionSecondsField: "android.shortFormAtInterventionSeconds",
    belowThresholdArtifactField: "android.shortFormBelowThresholdAllowArtifact",
    belowThresholdRunIdField: "android.shortFormBelowThresholdAllowRunId",
    belowThresholdSecondsField: "android.shortFormBelowThresholdSeconds",
    interventionId: YOUTUBE_SHORTS_RULE,
    interventionIdField: "android.shortFormInterventionId",
    packageField: "android.shortFormPackage",
    runIdField: "android.shortFormRunId",
    selectedSurfaceArtifactField: "android.shortFormSelectedSurfaceArtifact",
    selectedSurfaceVerifiedField: "android.shortFormSelectedSurfaceVerified",
    surface: "YouTube Shorts",
    usageBeforeLimitField: "android.shortFormUsageBeforeLimitMinutes",
  },
  [INSTAGRAM_ANDROID_PACKAGE]: {
    artifactField: "android.instagramReelsArtifact",
    atInterventionSecondsField: "android.instagramReelsAtInterventionSeconds",
    interventionId: INSTAGRAM_REELS_RULE,
    interventionIdField: "android.instagramReelsInterventionId",
    packageField: "android.instagramReelsPackage",
    runIdField: "android.instagramReelsRunId",
    selectedSurfaceArtifactField: "android.instagramReelsSelectedSurfaceArtifact",
    selectedSurfaceVerifiedField: "android.instagramReelsSelectedSurfaceVerified",
    surface: "Instagram Reels",
    usageBeforeLimitField: "android.instagramReelsUsageBeforeLimitMinutes",
  },
  [TIKTOK_PRIMARY_ANDROID_PACKAGE]: {
    artifactField: "android.tiktokFeedArtifact",
    atInterventionSecondsField: "android.tiktokFeedAtInterventionSeconds",
    interventionId: TIKTOK_FEED_RULE,
    interventionIdField: "android.tiktokFeedInterventionId",
    packageField: "android.tiktokFeedPackage",
    runIdField: "android.tiktokFeedRunId",
    selectedSurfaceArtifactField: "android.tiktokFeedSelectedSurfaceArtifact",
    selectedSurfaceVerifiedField: "android.tiktokFeedSelectedSurfaceVerified",
    surface: "TikTok For You",
    usageBeforeLimitField: "android.tiktokFeedUsageBeforeLimitMinutes",
  },
  [TIKTOK_ANDROID_PACKAGE_ALIASES[0]]: {
    artifactField: "android.tiktokFeedArtifact",
    atInterventionSecondsField: "android.tiktokFeedAtInterventionSeconds",
    interventionId: TIKTOK_FEED_RULE,
    interventionIdField: "android.tiktokFeedInterventionId",
    packageField: "android.tiktokFeedPackage",
    runIdField: "android.tiktokFeedRunId",
    selectedSurfaceArtifactField: "android.tiktokFeedSelectedSurfaceArtifact",
    selectedSurfaceVerifiedField: "android.tiktokFeedSelectedSurfaceVerified",
    surface: "TikTok For You",
    usageBeforeLimitField: "android.tiktokFeedUsageBeforeLimitMinutes",
  },
  [TIKTOK_ANDROID_PACKAGE_ALIASES[1]]: {
    artifactField: "android.tiktokFeedArtifact",
    atInterventionSecondsField: "android.tiktokFeedAtInterventionSeconds",
    interventionId: TIKTOK_FEED_RULE,
    interventionIdField: "android.tiktokFeedInterventionId",
    packageField: "android.tiktokFeedPackage",
    runIdField: "android.tiktokFeedRunId",
    selectedSurfaceArtifactField: "android.tiktokFeedSelectedSurfaceArtifact",
    selectedSurfaceVerifiedField: "android.tiktokFeedSelectedSurfaceVerified",
    surface: "TikTok For You",
    usageBeforeLimitField: "android.tiktokFeedUsageBeforeLimitMinutes",
  },
};

function shortFormReleaseProfile(packageName) {
  return SHORT_FORM_RELEASE_PROFILES[String(packageName).trim().toLowerCase()] || null;
}

module.exports = {
  DEFAULT_SHORT_FORM_PACKAGE,
  INSTAGRAM_ANDROID_PACKAGE,
  INSTAGRAM_REELS_RULE,
  SHORT_FORM_RELEASE_PROFILES,
  TIKTOK_ANDROID_PACKAGE_ALIASES,
  TIKTOK_ANDROID_PACKAGES,
  TIKTOK_FEED_RULE,
  TIKTOK_PRIMARY_ANDROID_PACKAGE,
  YOUTUBE_ANDROID_PACKAGE,
  YOUTUBE_SHORTS_RULE,
  shortFormReleaseProfile,
};

if (require.main === module && process.argv.includes("--self-test")) {
  assert.equal(DEFAULT_SHORT_FORM_PACKAGE, YOUTUBE_ANDROID_PACKAGE);
  assert.deepEqual(TIKTOK_ANDROID_PACKAGES, [TIKTOK_PRIMARY_ANDROID_PACKAGE, ...TIKTOK_ANDROID_PACKAGE_ALIASES]);
  assert.equal(shortFormReleaseProfile(YOUTUBE_ANDROID_PACKAGE).interventionId, YOUTUBE_SHORTS_RULE);
  assert.equal(shortFormReleaseProfile(INSTAGRAM_ANDROID_PACKAGE).interventionId, INSTAGRAM_REELS_RULE);
  for (const packageName of TIKTOK_ANDROID_PACKAGES) {
    assert.equal(shortFormReleaseProfile(packageName).interventionId, TIKTOK_FEED_RULE);
    assert.equal(shortFormReleaseProfile(packageName).selectedSurfaceVerifiedField, "android.tiktokFeedSelectedSurfaceVerified");
  }
  console.log("android-doomscroll-contract self-test: pass");
}
