import assert from "node:assert/strict";

import {
  createFirebaseAuthAdapter,
  getFirebaseAppCheckProviderConfig,
  getFirebaseClientReadiness,
  getFirebaseMessagingRegistrationContract
} from "../src/lib/firebase-client";

async function run() {
  const production = getFirebaseClientReadiness({
    EXPO_PUBLIC_FIREBASE_ENV: "production"
  });
  const staging = getFirebaseClientReadiness({
    EXPO_PUBLIC_FIREBASE_ENV: "staging"
  });
  const leakedCredential = getFirebaseClientReadiness({
    EXPO_PUBLIC_FIREBASE_ENV: "production",
    EXPO_PUBLIC_FIREBASE_SERVICE_ACCOUNT_JSON: "must-never-be-bundled"
  });

  assert.equal(production.ready, true);
  assert.equal(production.projectId, "freed-7d5ee");
  assert.equal(production.functionsRegion, "asia-south1");
  assert.deepEqual(getFirebaseAppCheckProviderConfig("android", production), {
    provider: "playIntegrity",
    debugToken: undefined
  });
  assert.deepEqual(getFirebaseAppCheckProviderConfig("ios", production), {
    provider: "appAttestWithDeviceCheckFallback",
    debugToken: undefined
  });
  assert.equal(staging.ready, false);
  assert.ok(staging.missing.some((issue) => issue.includes("Google project-quota blocker")));
  assert.equal(leakedCredential.ready, false);
  assert.ok(leakedCredential.missing.some((issue) => issue.includes("EXPO_PUBLIC_FIREBASE_SERVICE_ACCOUNT_JSON")));

  const calls: Array<{ name: string; values: unknown[] }> = [];
  const adapter = createFirebaseAuthAdapter({
    sendSignInLinkToEmail: async (email, settings) => {
      calls.push({ name: "sendSignInLinkToEmail", values: [email, settings] });
    },
    isSignInWithEmailLink: (link) => link.includes("oobCode="),
    signInWithEmailLink: async (email, link) => {
      calls.push({ name: "signInWithEmailLink", values: [email, link] });
      return { user: { uid: "firebase-user-1", getIdToken: async () => "firebase-id-token" } };
    },
    createGoogleCredential: (idToken, accessToken) => ({ provider: "google", idToken, accessToken }),
    createAppleCredential: (identityToken, nonce) => ({ provider: "apple", identityToken, nonce }),
    signInWithCredential: async (credential) => {
      calls.push({ name: "signInWithCredential", values: [credential] });
      return { user: { uid: "firebase-user-2", getIdToken: async () => "firebase-id-token" } };
    },
    currentUser: () => ({ uid: "firebase-user-2", getIdToken: async () => "firebase-id-token" })
  });

  const emailLink = await adapter.requestEmailLink(" Person@Example.com ", {
    continueUrl: "freed://auth/callback"
  });
  const hostedEmailLink = await adapter.requestEmailLink("person@example.com", {
    continueUrl: "https://freed-7d5ee.web.app/auth/callback"
  });
  const completed = await adapter.completeEmailLink({
    email: "person@example.com",
    emailLink: "https://freed-7d5ee.firebaseapp.com/__/auth/action?oobCode=valid"
  });
  const google = await adapter.exchangeProviderCredential("google", { idToken: "google-id-token" });
  const token = await adapter.getCurrentIdToken();
  const registration = getFirebaseMessagingRegistrationContract({
    installationId: "firebase-installation-id",
    token: "fcm-registration-token"
  });

  assert.deepEqual(emailLink, { ok: true, status: "sent" });
  assert.deepEqual(hostedEmailLink, { ok: true, status: "sent" });
  assert.equal(completed.ok, true);
  assert.equal(completed.uid, "firebase-user-1");
  assert.equal(google.ok, true);
  assert.equal(google.uid, "firebase-user-2");
  assert.equal(token, "firebase-id-token");
  assert.deepEqual(registration, {
    installationId: "firebase-installation-id",
    token: "fcm-registration-token",
    recoveryContentIncluded: false
  });
  assert.equal(JSON.stringify(calls).includes("firebase-id-token"), false);
  assert.equal(JSON.stringify(registration).includes("recovery"), true);
  assert.equal(JSON.stringify(registration).includes("reflection"), false);

  const asyncLinkValidator = createFirebaseAuthAdapter({
    sendSignInLinkToEmail: async () => undefined,
    isSignInWithEmailLink: async () => false,
    signInWithEmailLink: async () => ({ user: { uid: "unexpected-user", getIdToken: async () => "unexpected-token" } }),
    createGoogleCredential: () => null,
    createAppleCredential: () => null,
    signInWithCredential: async () => ({ user: { uid: "unexpected-user", getIdToken: async () => "unexpected-token" } }),
    currentUser: () => null
  });
  const invalidAsyncEmailLink = await asyncLinkValidator.completeEmailLink({
    email: "person@example.com",
    emailLink: "https://freed-7d5ee.firebaseapp.com/__/auth/action?oobCode=invalid"
  });
  assert.deepEqual(invalidAsyncEmailLink, {
    ok: false,
    status: "invalid",
    reason: "This is not a valid Firebase email sign-in link."
  });

  console.log("firebase foundation tests passed");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
