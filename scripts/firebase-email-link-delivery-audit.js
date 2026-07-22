"use strict";

const { existsSync, readFileSync } = require("node:fs");

function source(path) {
  return readFileSync(path, "utf8");
}

function run() {
  const checks = [];
  const check = (id, ok, detail, next) => checks.push({ id, ok, detail, next });
  const androidManifest = source("android/app/src/main/AndroidManifest.xml");
  const iosEntitlements = source("ios/FREED/FREED.entitlements");
  const firebase = JSON.parse(source("firebase.json"));
  const aliases = JSON.parse(source(".firebaserc"));
  const packageJson = JSON.parse(source("package.json"));
  const firebaseClient = source("src/lib/firebase-client.ts");
  const firebaseNative = source("src/lib/firebase-native.ts");
  const appSurface = source("src/features/freed-app.tsx");
  const generator = source("scripts/lib/firebase-email-link-association.js");
  const docsPath = "docs/firebase-email-link-delivery.md";
  const hosting = firebase.hosting?.find((entry) => entry.target === "web");

  check(
    "android-app-link-route",
    /<intent-filter android:autoVerify="true">[\s\S]*<action android:name="android\.intent\.action\.VIEW"\/>[\s\S]*<category android:name="android\.intent\.category\.DEFAULT"\/>[\s\S]*<category android:name="android\.intent\.category\.BROWSABLE"\/>[\s\S]*<data android:scheme="https" android:host="freed-7d5ee\.firebaseapp\.com" android:pathPrefix="\/__\/auth\/links"\/>[\s\S]*<\/intent-filter>/.test(androidManifest),
    "Main activity claims the Firebase Auth linkDomain delivery path with Android auto verification.",
    "Keep the exact Firebase Auth link domain and /__/auth/links path in the MainActivity intent filter."
  );
  check(
    "android-fallback-schemes",
    /<data android:scheme="freed"\/>/.test(androidManifest) && /<data android:scheme="app\.freed\.recovery"\/>/.test(androidManifest),
    "Existing freed and app.freed.recovery deep-link schemes remain declared.",
    "Do not remove fallback schemes while adding the verified HTTPS route."
  );
  check(
    "ios-universal-link-route",
    /<string>applinks:intervention\.freed\.app<\/string>/.test(iosEntitlements) &&
      /<string>applinks:freed-7d5ee\.firebaseapp\.com<\/string>/.test(iosEntitlements),
    "Main app keeps the intervention association and adds the Firebase Auth Universal Link domain.",
    "Keep the intervention entitlement and the freed-7d5ee.firebaseapp.com association on the main app target."
  );
  check(
    "hosting-association-predeploy",
    Array.isArray(hosting?.predeploy) &&
      hosting.predeploy.includes("npm run prepare:firebase-hosting") &&
      !hosting.ignore?.includes("**/.*") &&
      packageJson.scripts?.["preflight:firebase-email-links"] === "node -- scripts/firebase-hosting-preflight.js" &&
      packageJson.scripts?.["prepare:firebase-hosting"] === "node -- scripts/firebase-hosting-predeploy.js",
    "Firebase Hosting runs the fail-closed Expo export and association generation predeploy without ignoring .well-known files.",
    "Keep the Hosting predeploy hook and do not re-add a blanket dotfile ignore."
  );
  check(
    "hosting-association-content-types",
    hosting?.headers?.some(
      (entry) =>
        entry.source === "/.well-known/assetlinks.json" &&
        entry.headers?.some((header) => header.key === "Content-Type" && header.value === "application/json")
    ) &&
      hosting?.headers?.some(
        (entry) =>
          entry.source === "/apple-app-site-association" &&
          entry.headers?.some((header) => header.key === "Content-Type" && header.value === "application/json")
      ),
    "Android Asset Links and Apple App Site Association files are served as JSON ahead of SPA rewrites.",
    "Keep explicit JSON headers for both association endpoints."
  );
  check(
    "association-input-validation",
    /FREED_ANDROID_APP_LINK_SIGNING_SHA256/.test(generator) &&
      /FREED_IOS_DEVELOPMENT_TEAM/.test(generator) &&
      /must not be the Android debug certificate fingerprint/.test(generator) &&
      /writeFirebaseEmailLinkAssociationFiles/.test(generator),
    "Association files are generated from validated, non-secret release inputs rather than checked-in certificate or Team values.",
    "Provide the production signing SHA-256 and existing Apple Team ID only through release environment inputs."
  );
  check(
    "firebase-auth-link-domain",
    /FIREBASE_EMAIL_LINK_DOMAIN = "freed-7d5ee\.firebaseapp\.com"/.test(firebaseClient) &&
      /FIREBASE_EMAIL_LINK_PATH = "\/__\/auth\/links"/.test(firebaseClient) &&
      /EXPO_PUBLIC_FIREBASE_EMAIL_LINK_DOMAIN/.test(firebaseClient) &&
      /linkDomain: emailLinkDomain/.test(firebaseClient) &&
      !/linkDomain: options\.continueUrl/.test(firebaseClient) &&
      Array.isArray(aliases.targets?.["freed-7d5ee"]?.hosting?.web) &&
      aliases.targets["freed-7d5ee"].hosting.web.includes("freed-7d5ee"),
    "The validated Firebase Auth linkDomain, not the continue URL, drives native delivery and the deployed Hosting target serves its association files.",
    "Keep freed-7d5ee.firebaseapp.com authorized/configured as Firebase Auth linkDomain and deploy the web Hosting target before enabling email links."
  );
  check(
    "email-link-fail-closed-adapter",
    /getFirebaseEmailLinkReadiness/.test(firebaseClient) &&
      /EXPO_PUBLIC_FIREBASE_EMAIL_LINK_ASSOCIATION_READY/.test(firebaseClient) &&
      /emailLinkUnconfiguredResult/.test(firebaseClient) &&
      /FIREBASE_EMAIL_LINK_CALLBACK_URL/.test(firebaseClient) &&
      /const emailLinkReadiness = getFirebaseEmailLinkReadiness\(\);[\s\S]*emailLinkReady: emailLinkReadiness\.ready,[\s\S]*emailLinkDomain: emailLinkReadiness\.linkDomain/.test(firebaseNative),
    "The native Auth adapter refuses email-link send and completion until the association marker is explicitly production-ready.",
    "Set the public association marker only after deployed association and signed-device verification."
  );
  check(
    "cold-warm-link-delivery-contract",
    /const consumeFirebaseEmailLink = React\.useCallback\([\s\S]*isFirebaseEmailLinkDeliveryUrl\(url\)[\s\S]*setPendingFirebaseEmailLink\(url\);[\s\S]*setTab\("profile"\);[\s\S]*setScreen\("main"\);/.test(appSurface) &&
      /if \(consumeFirebaseEmailLink\(url\)\) return;[\s\S]*Linking\.getInitialURL\(\)[\s\S]*Linking\.addEventListener\("url"/.test(appSurface) &&
      /pendingFirebaseEmailLink=\{pendingFirebaseEmailLink\}/.test(appSurface) &&
      /Email-link sign-in is disabled until the signed app-link association is deployed and physically verified\./.test(appSurface),
    "The root app routes verified cold-start getInitialURL and warm-link events to Profile, where the user completes the pending link without retaining their email address.",
    "Physically verify both cold and warm email-link delivery on signed iOS and Android builds."
  );

  const docs = existsSync(docsPath) ? source(docsPath) : "";
  check(
    "physical-verification-runbook",
    /signed/i.test(docs) && /cold/i.test(docs) && /warm/i.test(docs) && /assetlinks/i.test(docs) && /apple-app-site-association/i.test(docs),
    "The runbook calls out signed-build, deployed-domain, cold-start, and warm-link checks.",
    `Add ${docsPath} before enabling the email-link readiness marker.`
  );

  const failed = checks.filter((entry) => !entry.ok);
  console.log("# Firebase email-link delivery audit");
  for (const entry of checks) {
    console.log(`${entry.ok ? "PASS" : "FAIL"} ${entry.id}: ${entry.detail}`);
    if (!entry.ok) console.log(`  Next: ${entry.next}`);
  }
  console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
  if (failed.length > 0) process.exitCode = 1;
}

run();
