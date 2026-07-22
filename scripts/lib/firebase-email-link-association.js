"use strict";

const { mkdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const ANDROID_APP_LINK_HOST = "freed-7d5ee.firebaseapp.com";
const ANDROID_APP_LINK_PATH = "/__/auth/links";
const APPLE_APP_LINK_PATH = "/__/auth/links";
const ANDROID_APPLICATION_ID = "app.freed.recovery";
const ANDROID_SIGNING_SHA256_ENV = "FREED_ANDROID_APP_LINK_SIGNING_SHA256";
const APPLE_TEAM_ID_ENV = "FREED_IOS_DEVELOPMENT_TEAM";
const ANDROID_DEBUG_CERT_SHA256 = "FAC61745DC0903786FB9EDE62A962B399F7348F0BB6F899B8332667591033B9C";

function readReleaseValue(env, key) {
  const value = env?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeSha256(value) {
  return String(value || "").replace(/[^a-f0-9]/gi, "").toUpperCase();
}

function formattedSha256(value) {
  return normalizeSha256(value).match(/.{2}/g)?.join(":") || "";
}

function firebaseEmailLinkAssociationIssues(env = process.env) {
  const rawFingerprint = readReleaseValue(env, ANDROID_SIGNING_SHA256_ENV);
  const fingerprint = normalizeSha256(rawFingerprint);
  const appleTeamId = readReleaseValue(env, APPLE_TEAM_ID_ENV);
  const issues = [];

  if (!rawFingerprint) {
    issues.push(`${ANDROID_SIGNING_SHA256_ENV} is not configured`);
  } else if (!/^[A-F0-9]{64}$/.test(fingerprint)) {
    issues.push(`${ANDROID_SIGNING_SHA256_ENV} must be exactly 64 hexadecimal characters (colon separators are allowed)`);
  } else if (fingerprint === ANDROID_DEBUG_CERT_SHA256) {
    issues.push(`${ANDROID_SIGNING_SHA256_ENV} must not be the Android debug certificate fingerprint`);
  }

  if (!appleTeamId) {
    issues.push(`${APPLE_TEAM_ID_ENV} is not configured`);
  } else if (!/^[A-Z0-9]{10}$/.test(appleTeamId)) {
    issues.push(`${APPLE_TEAM_ID_ENV} must be a ten-character Apple Team ID using uppercase letters and digits`);
  }

  return issues;
}

function assertFirebaseEmailLinkAssociationConfig(env = process.env) {
  const issues = firebaseEmailLinkAssociationIssues(env);
  if (issues.length > 0) {
    throw new Error(`Firebase email-link Hosting association is not ready:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }

  return {
    androidSha256: formattedSha256(readReleaseValue(env, ANDROID_SIGNING_SHA256_ENV)),
    appleTeamId: readReleaseValue(env, APPLE_TEAM_ID_ENV)
  };
}

function associationDocuments(config) {
  return {
    assetLinks: [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_APPLICATION_ID,
          sha256_cert_fingerprints: [config.androidSha256]
        }
      }
    ],
    appleAppSiteAssociation: {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${config.appleTeamId}.${ANDROID_APPLICATION_ID}`,
            components: [{ "/": APPLE_APP_LINK_PATH }]
          }
        ]
      }
    }
  };
}

function writeFirebaseEmailLinkAssociationFiles(publicDir, env = process.env) {
  const config = assertFirebaseEmailLinkAssociationConfig(env);
  const documents = associationDocuments(config);
  const root = resolve(publicDir);
  const wellKnown = join(root, ".well-known");
  const assetLinksPath = join(wellKnown, "assetlinks.json");
  const appleAppSiteAssociationPath = join(root, "apple-app-site-association");

  mkdirSync(wellKnown, { recursive: true });
  writeFileSync(assetLinksPath, `${JSON.stringify(documents.assetLinks, null, 2)}\n`);
  writeFileSync(appleAppSiteAssociationPath, `${JSON.stringify(documents.appleAppSiteAssociation, null, 2)}\n`);

  return { assetLinksPath, appleAppSiteAssociationPath, config };
}

module.exports = {
  ANDROID_APP_LINK_HOST,
  ANDROID_APP_LINK_PATH,
  APPLE_APP_LINK_PATH,
  ANDROID_APPLICATION_ID,
  ANDROID_SIGNING_SHA256_ENV,
  APPLE_TEAM_ID_ENV,
  associationDocuments,
  assertFirebaseEmailLinkAssociationConfig,
  firebaseEmailLinkAssociationIssues,
  writeFirebaseEmailLinkAssociationFiles
};
