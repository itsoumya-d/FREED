import assert from "node:assert/strict";
import test from "node:test";
import { createFirebaseAuthAdapter } from "../src/lib/firebase-client";
import { AuthIdentityFlowError, createAuthIdentityCoordinator } from "../src/lib/social-auth-flow";

function boundary(anonymous = false, uid = "current-recovery-user") {
  let tokenReads = 0;
  let user = {
    uid, isAnonymous: anonymous, email: anonymous ? null : "person@example.com",
    providerData: anonymous ? [] : [{ providerId: "apple.com" }],
    getIdToken: async () => { tokenReads += 1; return "private-identity-token"; }
  };
  const calls: string[] = [];
  const sdk = {
    currentUser: () => user,
    signInAnonymously: async () => { calls.push("anonymous"); return { user }; },
    beforeLink: async () => { calls.push("fence"); },
    signInWithCredential: async (_credential: unknown) => { calls.push("sign-in"); return { user }; },
    linkWithCredential: async (_current: typeof user, _credential: unknown) => {
      calls.push("link"); user = { ...user, isAnonymous: false }; return { user };
    }
  };
  const coordinator = createAuthIdentityCoordinator(sdk);
  const native = {
    currentUser: () => user,
    sendSignInLinkToEmail: async () => undefined,
    isSignInWithEmailLink: (link: string) => link.includes("oobCode="),
    signInWithEmailLink: async () => ({ user }),
    createGoogleCredential: (idToken: string) => ({ providerId: "google.com", idToken }),
    createAppleCredential: (identityToken: string, nonce?: string) => ({ providerId: "apple.com", identityToken, nonce }),
    createEmailCredential: (email: string, password: string) => ({ providerId: "password", email, password }),
    createEmailLinkCredential: (email: string, emailLink: string) => ({ providerId: "password", email, emailLink }),
    signInWithCredential: async (credential: unknown) => {
      const result = await coordinator.signInWithCredential(credential);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    linkWithCredential: async (credential: unknown) => {
      const result = await coordinator.linkCurrentCredential(credential);
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    }
  };
  const adapter = createFirebaseAuthAdapter(native, { emailLinkReady: true, emailLinkDomain: "freed-7d5ee.firebaseapp.com" });
  return { sdk, native, adapter, calls, current: () => user, tokenReads: () => tokenReads };
}

test("explicit provider linking preserves the existing UID and is distinct from ordinary sign-in", async () => {
  const value = boundary();
  const result = await value.adapter.linkProviderCredential("google", { idToken: "private-google-token" });
  assert.deepEqual(result, { ok: true, status: "linked", uid: "current-recovery-user" });
  assert.deepEqual(value.calls, ["fence", "link"]);
});

test("sign-in refuses to replace a permanent account with a fixed actionable result", async () => {
  const value = boundary();
  const result = await value.adapter.exchangeProviderCredential("google", { idToken: "private-google-token" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "sign-out-required");
  assert.match(result.reason ?? "", /sign out/);
  assert.deepEqual(value.calls, []);
});

test("the native-to-public Auth bridge retains the fixed account-conflict explanation", async () => {
  const value = boundary(true);
  value.sdk.linkWithCredential = async () => { throw Object.assign(new Error("private-google-token"), { code: "auth/credential-already-in-use" }); };
  const result = await value.adapter.exchangeProviderCredential("google", { idToken: "private-google-token" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "account-conflict");
  assert.equal(result.reason, "This sign-in belongs to another account. Choose how to continue before switching accounts.");
  assert.doesNotMatch(JSON.stringify(result), /private-google-token/);
});

test("account summaries read only current identity metadata without fetching tokens or creating guests", () => {
  const value = boundary();
  assert.deepEqual(value.adapter.getAccountSummary(), {
    signedIn: true, anonymous: false, email: "person@example.com", providers: ["apple.com"]
  });
  assert.deepEqual(value.calls, []);
  assert.equal(value.tokenReads(), 0);
  const guest = boundary(true);
  assert.deepEqual(guest.adapter.getAccountSummary(), { signedIn: true, anonymous: true, email: null, providers: [] });
  assert.deepEqual(guest.calls, []);
});

test("a valid short custom Firebase UID still appears signed in when reading the account summary", () => {
  const value = boundary();
  const adapter = createFirebaseAuthAdapter({ ...value.native, currentUser: () => ({ ...value.current(), uid: "u" }) });
  assert.equal(adapter.getAccountSummary().signedIn, true);
  assert.equal(value.tokenReads(), 0);
});

test("link success accepts valid custom Firebase UIDs rather than treating them as credential tokens", async () => {
  const value = boundary(false, "u");
  assert.deepEqual(await value.adapter.linkProviderCredential("google", { idToken: "private-google-token" }), {
    ok: true, status: "linked", uid: "u"
  });
});

test("email password and email-link credentials link to the same current account", async () => {
  for (const input of [
    { email: " Person@Example.com ", password: "private-password" },
    { email: "person@example.com", emailLink: "https://freed-7d5ee.firebaseapp.com/__/auth/action?oobCode=valid" }
  ]) {
    const value = boundary();
    const result = await value.adapter.linkProviderCredential("email", input);
    assert.deepEqual(result, { ok: true, status: "linked", uid: "current-recovery-user" });
    assert.deepEqual(value.calls, ["fence", "link"]);
  }
});

test("an ambiguous or invalid email credential does not construct a provider link", async () => {
  const value = boundary();
  for (const input of [
    { email: "bad-email", password: "private-password" },
    { email: "person@example.com", password: "private-password", emailLink: "https://freed-7d5ee.firebaseapp.com/__/auth/action?oobCode=valid" },
    { email: "person@example.com", emailLink: "https://wrong.example/action?oobCode=valid" }
  ]) assert.equal((await value.adapter.linkProviderCredential("email", input)).ok, false);
  assert.deepEqual(value.calls, []);
});

test("email linking honors the existing deployed-association readiness gate", async () => {
  const value = boundary();
  const adapter = createFirebaseAuthAdapter(value.native);
  const result = await adapter.linkProviderCredential("email", {
    email: "person@example.com", emailLink: "https://freed-7d5ee.firebaseapp.com/__/auth/action?oobCode=valid"
  });
  assert.equal(result.status, "unconfigured");
  assert.deepEqual(value.calls, []);
});
