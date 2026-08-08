"use strict";

const {
  ANDROID_APP_LINK_HOST,
  ANDROID_APP_LINK_PATH,
  assertFirebaseEmailLinkAssociationConfig
} = require("./lib/firebase-email-link-association");

function main() {
  try {
    const config = assertFirebaseEmailLinkAssociationConfig(process.env);
    console.log("Firebase Hosting email-link association preflight passed.");
    console.log(`Android: https://${ANDROID_APP_LINK_HOST}${ANDROID_APP_LINK_PATH} (${config.androidSha256})`);
    console.log(`iOS: ${config.appleTeamId}.app.freed.recovery`);
  } catch (error) {
    console.error("Firebase Hosting email-link association preflight failed.");
    console.error(error instanceof Error ? error.message : "Association configuration is invalid.");
    console.error("Set the production Android signing SHA-256 and the existing Apple Team ID; do not use debug or placeholder values.");
    process.exitCode = 1;
  }
}

main();
