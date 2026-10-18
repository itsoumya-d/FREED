import assert from "node:assert/strict";
import { test } from "node:test";
import { beginEmailAccountAccess, submitEmailAccountAccess } from "../src/lib/account-access-flow";
import { createFirebaseAuthAdapter } from "../src/lib/firebase-client";
import { AuthIdentityFlowError, createAuthIdentityCoordinator } from "../src/lib/social-auth-flow";

function boundary() {
  let current: { uid: string; isAnonymous: boolean; email?: string; getIdToken: () => Promise<string> } | null = { uid: "guest-owner", isAnonymous: true, getIdToken: async () => "unused-fixture-token" };
  const calls: string[] = [];
  const coordinator = createAuthIdentityCoordinator({
    currentUser: () => current,
    signInAnonymously: async () => { throw new Error("Unexpected guest creation"); },
    beforeLink: async () => { calls.push("purchase-fence"); },
    signInWithCredential: async (credential: { email: string; password: string }) => {
      calls.push("sign-in"); current = { uid: "existing-email-owner", isAnonymous: false, email: credential.email, getIdToken: async () => "unused-fixture-token" }; return { user: current };
    },
    linkWithCredential: async (user, credential: { email: string; password: string }) => {
      calls.push("link"); current = { ...user, isAnonymous: false, email: credential.email }; return { user: current };
    },
    signOut: async () => { calls.push("sign-out"); current = null; }
  });
  const adapter = createFirebaseAuthAdapter({
    currentUser: () => current,
    sendSignInLinkToEmail: async () => {}, isSignInWithEmailLink: () => false,
    signInWithEmailLink: async () => { throw new Error("Unexpected email link"); },
    createGoogleCredential: () => ({}), createAppleCredential: () => ({}),
    createEmailCredential: (email, password) => ({ email, password }),
    signInWithCredential: async credential => {
      const result = await coordinator.signInWithCredential(credential as { email: string; password: string });
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    },
    linkWithCredential: async credential => {
      const result = await coordinator.linkCurrentCredential(credential as { email: string; password: string });
      if (!result.ok) throw new AuthIdentityFlowError(result.reason);
      return { user: result.user };
    }
  });
  return { adapter, coordinator, calls, current: () => current };
}

test("guest email sign-in offers switching before credentials and never enrolls or links a submitted email", async () => {
  const value = boundary();
  assert.equal(beginEmailAccountAccess("sign-in", value.adapter.getAccountSummary()), "guest-switch");
  assert.deepEqual(value.calls, []);
  const result = await submitEmailAccountAccess(value.adapter, "sign-in", { email: "unused@example.com", password: "fixture-password" });
  assert.deepEqual(result, { status: "switch-required" });
  assert.deepEqual(value.calls, []);
  assert.equal(value.current()?.uid, "guest-owner");
  assert.equal(value.current()?.isAnonymous, true);
});

test("existing email sign-in starts only after explicit guest sign-out and accepts a valid legacy password", async () => {
  const value = boundary();
  assert.equal(beginEmailAccountAccess("sign-in", value.adapter.getAccountSummary()), "guest-switch");
  assert.deepEqual(value.calls, []);
  await value.coordinator.signOut(); // Represents the user's explicit Switch press.
  assert.equal(beginEmailAccountAccess("sign-in", value.adapter.getAccountSummary()), "sign-in");
  const result = await submitEmailAccountAccess(value.adapter, "sign-in", { email: "existing@example.com", password: "sixchr" });
  assert.equal(result.status, "completed");
  if (result.status === "completed") assert.equal(result.result.ok, true);
  assert.deepEqual(value.calls, ["sign-out", "sign-in"]);
  assert.equal(value.current()?.uid, "existing-email-owner");
});

test("email signup links and fences the guest account instead of changing its purchase owner", async () => {
  const value = boundary();
  assert.equal(beginEmailAccountAccess("create", value.adapter.getAccountSummary()), "create");
  const result = await submitEmailAccountAccess(value.adapter, "create", { email: "new@example.com", password: "fixture-password" });
  assert.equal(result.status, "completed");
  if (result.status === "completed") assert.equal(result.result.ok, true);
  assert.deepEqual(value.calls, ["purchase-fence", "link"]);
  assert.equal(value.current()?.uid, "guest-owner");
  assert.equal(value.current()?.isAnonymous, false);
});

test("guest email signup keeps the stronger creation password policy", async () => {
  const value = boundary();
  const result = await submitEmailAccountAccess(value.adapter, "create", { email: "new@example.com", password: "sixchr" });
  assert.equal(result.status, "completed");
  if (result.status === "completed") assert.equal(result.result.status, "invalid");
  assert.deepEqual(value.calls, []);
  assert.equal(value.current()?.isAnonymous, true);
});
