import assert from "node:assert/strict";
import test from "node:test";
import { createAuthIdentityCoordinator } from "../src/lib/social-auth-flow";
import { createFirebaseAuthAdapter } from "../src/lib/firebase-client";

function identity(anonymous = true) {
  let user: { uid: string; isAnonymous: boolean } | null = { uid: "guest-purchase-owner", isAnonymous: anonymous };
  const calls: string[] = [];
  const api = {
    currentUser: () => user,
    signInAnonymously: async () => ({ user: user! }),
    signInWithCredential: async () => { calls.push("sign-in"); return { user: user! }; },
    beforeLink: async () => { calls.push("fence"); },
    linkWithCredential: async () => { calls.push("credential-link"); user = { ...user!, isAnonymous: false }; return { user }; },
    createEmailCredential: (email: string, password: string) => ({ email, password }),
    createUserWithEmailAndPassword: async () => { calls.push("create"); user = { uid: "new-email-owner", isAnonymous: false }; return { user }; },
    signInWithProvider: async () => { calls.push("oauth-sign-in"); user = { uid: "apple-owner", isAnonymous: false }; return { user }; },
    linkWithProvider: async () => { calls.push("oauth-link"); user = { ...user!, isAnonymous: false }; return { user }; },
    signOut: async () => { calls.push("sign-out"); user = null; }
  };
  return { api, calls, coordinator: createAuthIdentityCoordinator(api), current: () => user };
}

test("creating an email account fences and links the guest purchase owner", async () => {
  const value = identity();
  const result = await value.coordinator.createEmailAccount("person@example.com", "private-password");
  assert.equal(result.ok, true);
  assert.equal(value.current()?.uid, "guest-purchase-owner");
  assert.deepEqual(value.calls, ["fence", "credential-link"]);
});

test("creating an email account cannot replace a permanent identity", async () => {
  const value = identity(false);
  assert.deepEqual(await value.coordinator.createEmailAccount("person@example.com", "private-password"), {
    ok: false, reason: "sign-out-required", message: "Link an additional sign-in method to this account, or sign out before switching accounts."
  });
  assert.deepEqual(value.calls, []);
});

test("email account creation after explicit sign-out uses native account creation", async () => {
  const value = identity();
  await value.coordinator.signOut();
  assert.equal((await value.coordinator.createEmailAccount("person@example.com", "private-password")).ok, true);
  assert.deepEqual(value.calls, ["sign-out", "create"]);
});

test("Apple OAuth fences guest linking and refuses silent permanent account replacement", async () => {
  const value = identity();
  assert.equal((await value.coordinator.signInWithProvider("apple.com")).ok, true);
  assert.equal(value.current()?.uid, "guest-purchase-owner");
  assert.deepEqual(value.calls, ["fence", "oauth-link"]);
  assert.equal((await value.coordinator.signInWithProvider("apple.com")).ok, false);
  assert.deepEqual(value.calls, ["fence", "oauth-link"]);
});

test("Apple OAuth does not launch after ownership fencing fails", async () => {
  const value = identity();
  value.api.beforeLink = async () => { throw new Error("service unavailable"); };
  const result = await value.coordinator.signInWithProvider("apple.com");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "link-unavailable");
  assert.deepEqual(value.calls, []);
});

test("sign-out waits for the complete native OAuth operation", async () => {
  const value = identity();
  let finish!: () => void;
  let started!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  const linked = new Promise<void>(resolve => { started = resolve; });
  value.api.linkWithProvider = async () => { value.calls.push("oauth-link"); started(); await held; return { user: value.current()! }; };
  const pending = value.coordinator.signInWithProvider("apple.com");
  await linked;
  const signOut = value.coordinator.signOut();
  assert.deepEqual(value.calls, ["fence", "oauth-link"]);
  finish();
  assert.equal((await pending).ok, true);
  await signOut;
  assert.deepEqual(value.calls, ["fence", "oauth-link", "sign-out"]);
});

function adapterBoundary() {
  const calls: string[] = [];
  let user = { uid: "email-owner", isAnonymous: false, email: "person@example.com", emailVerified: false, providerData: [{ providerId: "password" }], getIdToken: async () => "private-token" };
  const native = {
    currentUser: () => user,
    sendSignInLinkToEmail: async () => undefined,
    isSignInWithEmailLink: () => false,
    signInWithEmailLink: async () => ({ user }),
    createGoogleCredential: () => null,
    createAppleCredential: () => null,
    createEmailCredential: (email: string, password: string) => ({ email, password }),
    signInWithCredential: async () => ({ user }),
    createEmailAccount: async () => { calls.push("create"); return { user }; },
    sendPasswordResetEmail: async (email: string) => { calls.push(`reset:${email}`); },
    sendEmailVerification: async () => { calls.push("verify"); },
    reloadCurrentUser: async () => { calls.push("reload"); user = { ...user, emailVerified: true }; return { user }; }
  };
  return { native, calls, adapter: createFirebaseAuthAdapter(native) };
}

test("password reset uses a normalized email and never changes the current identity", async () => {
  const value = adapterBoundary();
  assert.deepEqual(await value.adapter.requestPasswordReset(" Person@Example.com "), { ok: true, status: "sent" });
  assert.deepEqual(value.calls, ["reset:person@example.com"]);
  assert.equal(value.adapter.getAccountSummary().signedIn, true);
  assert.equal((await value.adapter.requestPasswordReset("bad-email")).status, "invalid");
  assert.deepEqual(value.calls, ["reset:person@example.com"]);
});

test("password reset does not reveal whether an email account exists", async () => {
  const value = adapterBoundary();
  value.native.sendPasswordResetEmail = async () => { throw Object.assign(new Error("secret"), { code: "auth/user-not-found" }); };
  assert.deepEqual(await value.adapter.requestPasswordReset("person@example.com"), { ok: true, status: "sent" });
});

test("verification and refresh expose email verification without token reads", async () => {
  const value = adapterBoundary();
  assert.equal(value.adapter.getAccountSummary().emailVerified, false);
  assert.deepEqual(await value.adapter.sendEmailVerification(), { ok: true, status: "sent" });
  assert.equal((await value.adapter.reloadAccount()).ok, true);
  assert.equal(value.adapter.getAccountSummary().emailVerified, true);
  assert.deepEqual(value.calls, ["verify", "reload"]);
});

test("email creation validates secure password before contacting native auth", async () => {
  const value = adapterBoundary();
  for (const password of ["", "short"]) assert.equal((await value.adapter.createEmailAccount({ email: "person@example.com", password })).status, "invalid");
  assert.deepEqual(value.calls, []);
});

test("recent email authentication targets the current account and does not sign in again", async () => {
  const value = adapterBoundary();
  const adapter = createFirebaseAuthAdapter({ ...value.native, reauthenticateWithCredential: async () => { value.calls.push("reauth"); return { user: value.native.currentUser() }; } });
  assert.equal((await adapter.reauthenticateProviderCredential("email", { email: "person@example.com", password: "private-password" })).ok, true);
  assert.deepEqual(value.calls, ["reauth"]);
});

test("an anonymous account cannot use reauthentication to create a permanent identity", async () => {
  const value = adapterBoundary();
  const adapter = createFirebaseAuthAdapter({ ...value.native, currentUser: () => ({ ...value.native.currentUser(), isAnonymous: true }), reauthenticateWithCredential: async () => { value.calls.push("reauth"); return { user: value.native.currentUser() }; } });
  const result = await adapter.reauthenticateProviderCredential("google", { idToken: "private-google-token" });
  assert.equal(result.code, "sign-in-required");
  assert.deepEqual(value.calls, []);
});

test("sensitive account confirmation holds the identity queue until revocation completes", async () => {
  const value = identity(false);
  let finish!: () => void;
  let started!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  const actionStarted = new Promise<void>(resolve => { started = resolve; });
  const operation = value.coordinator.performCurrentAccountAction("guest-purchase-owner", async () => { value.calls.push("revoke"); started(); await held; });
  await actionStarted;
  const signOut = value.coordinator.signOut();
  assert.deepEqual(value.calls, ["revoke"]);
  finish();
  assert.equal((await operation).ok, true);
  await signOut;
  assert.deepEqual(value.calls, ["revoke", "sign-out"]);
});

test("stale sensitive account confirmation cannot run against another user", async () => {
  const value = identity(false);
  const result = await value.coordinator.performCurrentAccountAction("another-owner", async () => { value.calls.push("revoke"); });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
  assert.deepEqual(value.calls, []);
});
