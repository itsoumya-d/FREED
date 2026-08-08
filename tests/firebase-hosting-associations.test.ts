import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const associationModulePath = "scripts/lib/firebase-email-link-association.js";

assert.equal(
  existsSync(associationModulePath),
  true,
  "Hosting association generation must be available before a Firebase Hosting deploy."
);

const association = require("../scripts/lib/firebase-email-link-association.js") as {
  ANDROID_APP_LINK_HOST: string;
  APPLE_APP_LINK_PATH: string;
  ANDROID_APP_LINK_PATH: string;
  assertFirebaseEmailLinkAssociationConfig: (env: Record<string, string | undefined>) => {
    androidSha256: string;
    appleTeamId: string;
  };
  writeFirebaseEmailLinkAssociationFiles: (
    publicDir: string,
    env: Record<string, string | undefined>
  ) => { assetLinksPath: string; appleAppSiteAssociationPath: string };
};

assert.equal(typeof association.assertFirebaseEmailLinkAssociationConfig, "function");
assert.equal(typeof association.writeFirebaseEmailLinkAssociationFiles, "function");
assert.equal(association.ANDROID_APP_LINK_HOST, "freed-7d5ee.firebaseapp.com");
assert.equal(association.ANDROID_APP_LINK_PATH, "/__/auth/links");
assert.equal(association.APPLE_APP_LINK_PATH, "/__/auth/links");

assert.throws(
  () => association.assertFirebaseEmailLinkAssociationConfig({}),
  /FREED_ANDROID_APP_LINK_SIGNING_SHA256 is not configured[\s\S]*FREED_IOS_DEVELOPMENT_TEAM is not configured/
);
assert.throws(
  () =>
    association.assertFirebaseEmailLinkAssociationConfig({
      FREED_ANDROID_APP_LINK_SIGNING_SHA256: "not-a-certificate",
      FREED_IOS_DEVELOPMENT_TEAM: "bad-team"
    }),
  /must be exactly 64 hexadecimal characters[\s\S]*ten-character Apple Team ID/
);

const outputDir = mkdtempSync(join(tmpdir(), "freed-firebase-links-"));
const generated = association.writeFirebaseEmailLinkAssociationFiles(outputDir, {
  FREED_ANDROID_APP_LINK_SIGNING_SHA256: "aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99",
  FREED_IOS_DEVELOPMENT_TEAM: "AB12CD34EF"
});
const assetLinks = JSON.parse(readFileSync(generated.assetLinksPath, "utf8"));
const appleAppSiteAssociation = JSON.parse(readFileSync(generated.appleAppSiteAssociationPath, "utf8"));

assert.deepEqual(assetLinks, [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "app.freed.recovery",
      sha256_cert_fingerprints: ["AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"]
    }
  }
]);
assert.deepEqual(appleAppSiteAssociation, {
  applinks: {
    apps: [],
    details: [{ appID: "AB12CD34EF.app.freed.recovery", components: [{ "/": "/__/auth/links" }] }]
  }
});

console.log("firebase hosting association tests passed");
