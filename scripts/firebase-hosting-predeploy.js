"use strict";

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");
const {
  assertFirebaseEmailLinkAssociationConfig,
  writeFirebaseEmailLinkAssociationFiles
} = require("./lib/firebase-email-link-association");

function exportWeb() {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), "node_modules/expo/bin/cli"), "export", "-p", "web"], {
    cwd: process.cwd(),
    env: { ...process.env, CI: "1", EXPO_NO_TELEMETRY: "1" },
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Expo web export failed with exit code ${result.status ?? "unknown"}.`);
}

function main() {
  try {
    assertFirebaseEmailLinkAssociationConfig(process.env);
    exportWeb();
    const generated = writeFirebaseEmailLinkAssociationFiles(resolve(process.cwd(), "dist"), process.env);
    console.log("Firebase Hosting email-link association files generated after Expo web export.");
    console.log(`- ${generated.assetLinksPath}`);
    console.log(`- ${generated.appleAppSiteAssociationPath}`);
  } catch (error) {
    console.error("Firebase Hosting predeploy blocked before deployment.");
    console.error(error instanceof Error ? error.message : "Firebase Hosting association preparation failed.");
    console.error("Do not deploy email-link hosting until the signed Android SHA-256 and Apple Team ID are configured and verified.");
    process.exitCode = 1;
  }
}

main();
