import assert from "node:assert/strict";

import {
  createFirebaseAuthAdapter,
  getFirebaseAppCheckProviderConfig,
  getFirebaseClientReadiness,
  getFirebaseEmailLinkReadiness,
  getFirebaseMessagingRegistrationContract,
  isFirebaseEmailLinkCallbackUrl
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

  const emailLinkDisabled = getFirebaseEmailLinkReadiness({ EXPO_PUBLIC_FIREBASE_ENV: "production" });
  const emailLinkWrongCallback = getFirebaseEmailLinkReadiness({
    EXPO_PUBLIC_FIREBASE_ENV: "production",
    EXPO_PUBLIC_FIREBASE_EMAIL_LINK_ASSOCIATION_READY: "deployed-and-verified",
    EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL: "https://freed-7d5ee.firebaseapp.com/auth/callback"
  });
  const emailLinkReady = getFirebaseEmailLinkReadiness({
    EXPO_PUBLIC_FIREBASE_ENV: "production",
    EXPO_PUBLIC_FIREBASE_EMAIL_LINK_ASSOCIATION_READY: "deployed-and-verified",
    EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL: "https://freed-7d5ee.web.app/auth/callback"
  });
  assert.equal(emailLinkDisabled.ready, false);
  assert.ok(emailLinkDisabled.missing.some((issue) => issue.includes("EXPO_PUBLIC_FIREBASE_EMAIL_LINK_ASSOCIATION_READY")));
  assert.equal(emailLinkWrongCallback.ready, false);
  assert.ok(emailLinkWrongCallback.missing.some((issue) => issue.includes("freed-7d5ee.web.app/auth/callback")));
  assert.equal(emailLinkReady.ready, true);
  assert.equal(emailLinkReady.callbackUrl, "https://freed-7d5ee.web.app/auth/callback");
  assert.equal(isFirebaseEmailLinkCallbackUrl("https://freed-7d5ee.web.app/auth/callback?mode=signIn&oobCode=valid"), true);
  assert.equal(isFirebaseEmailLinkCallbackUrl("https://freed-7d5ee.web.app/intervention?mode=signIn&oobCode=valid"), false);

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

  assert.deepEqual(emailLink, {
    ok: false,
    status: "unconfigured",
    reason: "Firebase email-link sign-in is unavailable until Hosting app-link association is deployed and verified."
  });
  assert.deepEqual(hostedEmailLink, {
    ok: false,
    status: "unconfigured",
    reason: "Firebase email-link sign-in is unavailable until Hosting app-link association is deployed and verified."
  });
  assert.deepEqual(completed, {
    ok: false,
    status: "unconfigured",
    reason: "Firebase email-link sign-in is unavailable until Hosting app-link association is deployed and verified."
  });
  assert.equal(google.ok, true);
  assert.equal(google.uid, "firebase-user-2");
  assert.equal(token, "firebase-id-token");
  assert.deepEqual(registration, {
    installationId: "firebase-installation-id",
    token: "fcm-registration-token",
    recoveryContentIncluded: false
  });
  assert.equal(JSON.stringify(calls).includes("firebase-id-token"), false);
  assert.equal(calls.some((call) => call.name === "sendSignInLinkToEmail"), false);
  assert.equal(calls.some((call) => call.name === "signInWithEmailLink"), false);
  assert.equal(JSON.stringify(registration).includes("recovery"), true);
  assert.equal(JSON.stringify(registration).includes("reflection"), false);

  const enabledEmailSender = createFirebaseAuthAdapter(
    {
      sendSignInLinkToEmail: async (email, settings) => {
        calls.push({ name: "enabledSendSignInLinkToEmail", values: [email, settings] });
      },
      isSignInWithEmailLink: () => false,
      signInWithEmailLink: async () => ({ user: { uid: "unused-user", getIdToken: async () => "unused-token" } }),
      createGoogleCredential: () => null,
      createAppleCredential: () => null,
      signInWithCredential: async () => ({ user: { uid: "unused-user", getIdToken: async () => "unused-token" } }),
      currentUser: () => null
    },
    { emailLinkReady: true }
  );
  assert.deepEqual(await enabledEmailSender.requestEmailLink("person@example.com", { continueUrl: "freed://auth/callback" }), {
    ok: false,
    status: "invalid",
    reason: "Firebase email links must return to the FREED auth callback."
  });
  assert.deepEqual(
    await enabledEmailSender.requestEmailLink("person@example.com", {
      continueUrl: "https://freed-7d5ee.web.app/auth/callback"
    }),
    { ok: true, status: "sent" }
  );

  const asyncLinkValidator = createFirebaseAuthAdapter({
    sendSignInLinkToEmail: async () => undefined,
    isSignInWithEmailLink: async () => false,
    signInWithEmailLink: async () => ({ user: { uid: "unexpected-user", getIdToken: async () => "unexpected-token" } }),
    createGoogleCredential: () => null,
    createAppleCredential: () => null,
    signInWithCredential: async () => ({ user: { uid: "unexpected-user", getIdToken: async () => "unexpected-token" } }),
    currentUser: () => null
  }, { emailLinkReady: true });
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
