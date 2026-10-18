import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import * as flows from "../src/lib/social-auth-flow";

const googleUser = {
  user: {
    id: "google-user",
    name: "Person",
    email: "person@example.com",
    photo: null,
    familyName: null,
    givenName: "Person"
  },
  scopes: ["openid", "email"],
  idToken: "google-identity-token",
  serverAuthCode: null
};

function googleFlow(platform: string, response: unknown) {
  const calls: string[] = [];
  const flow = flows.createGoogleSignInFlow({
    platform: () => platform,
    webClientId: () => "web-client-id",
    loadSdk: async () => ({
      configure: (options: { webClientId: string; offlineAccess: boolean }) => {
        assert.equal(options.webClientId, "web-client-id");
        assert.equal(options.offlineAccess, false);
        calls.push("configure");
      },
      hasPlayServices: async () => { calls.push("play-services"); return true; },
      signIn: async () => { calls.push("sign-in"); return response; }
    })
  });
  return { flow, calls };
}

test("Google cancellation response never becomes a missing-token error", async () => {
  const { flow } = googleFlow("ios", { type: "cancelled", data: null });
  const result = await flow.signIn();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "cancelled");
});

test("Google success reads the current SDK data payload and skips Play Services on iOS", async () => {
  const { flow, calls } = googleFlow("ios", { type: "success", data: googleUser });
  assert.deepEqual(await flow.signIn(), {
    ok: true,
    token: { provider: "google", idToken: "google-identity-token" },
    email: "person@example.com"
  });
  assert.deepEqual(calls, ["configure", "sign-in"]);
});

test("Google checks Android Play Services before opening sign-in", async () => {
  const { flow, calls } = googleFlow("android", { type: "success", data: googleUser });
  assert.equal((await flow.signIn()).ok, true);
  assert.deepEqual(calls, ["configure", "play-services", "sign-in"]);
});

test("Google still accepts the older direct user response", async () => {
  const { flow } = googleFlow("ios", googleUser);
  const result = await flow.signIn();
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.token, { provider: "google", idToken: "google-identity-token" });
});

test("Google rejects missing identity tokens rather than using an access token", async () => {
  const { flow } = googleFlow("android", {
    type: "success", data: { ...googleUser, idToken: null, accessToken: "not-an-identity-token" }
  });
  const result = await flow.signIn();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "error");
});

test("Google web and missing-client builds never load the native SDK", async () => {
  for (const config of [{ platform: "web", clientId: "web-client-id" }, { platform: "ios", clientId: null }]) {
    let loads = 0;
    const flow = flows.createGoogleSignInFlow({
      platform: () => config.platform,
      webClientId: () => config.clientId,
      loadSdk: async () => { loads += 1; throw new Error("Native SDK unavailable"); }
    });
    const result = await flow.signIn();
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unavailable");
    assert.equal(loads, 0);
  }
});

test("Google native cancellation error codes return cancellation without exposing SDK errors", async () => {
  for (const code of ["-1", "12501", "SIGN_IN_CANCELLED"]) {
    const flow = flows.createGoogleSignInFlow({
      platform: () => "ios",
      webClientId: () => "web-client-id",
      loadSdk: async () => ({
        configure() {},
        hasPlayServices: async () => true,
        signIn: async () => { throw Object.assign(new Error("secret-token"), { code }); }
      })
    });
    const result = await flow.signIn();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "cancelled");
      assert.doesNotMatch(result.message, /secret-token/);
    }
  }
});

test("Apple sends SHA256 hex to Apple and retains the raw nonce and authorization code for Firebase", async () => {
  const requestedNonces: string[] = [];
  const flow = flows.createAppleSignInFlow({
    platform: () => "ios",
    isAvailable: async () => true,
    randomBytes: async (size: number) => {
      assert.equal(size, 32);
      return Uint8Array.from({ length: 32 }, (_, index) => index);
    },
    sha256: async (value: string) => createHash("sha256").update(value).digest("hex"),
    signIn: async ({ nonce }: { nonce: string }) => {
      requestedNonces.push(nonce);
      return {
        user: "apple-user", identityToken: "apple-identity-token", authorizationCode: "apple-revocation-code",
        email: "person@privaterelay.appleid.com", fullName: null, realUserStatus: 1, state: null
      };
    }
  });
  const result = await flow.signIn();
  assert.deepEqual(requestedNonces, ["6c86c6aac5fb24bcf5d9939cb7d7d5645ce39418f449e03b262dd4fa14b4b92b"]);
  assert.deepEqual(result, {
    ok: true,
    token: {
      provider: "apple", identityToken: "apple-identity-token",
      nonce: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      authorizationCode: "apple-revocation-code"
    },
    email: "person@privaterelay.appleid.com"
  });
});

test("Apple recognizes Expo request cancellation", async () => {
  const flow = flows.createAppleSignInFlow({
    platform: () => "ios",
    isAvailable: async () => true,
    randomBytes: async () => new Uint8Array(32),
    sha256: async (value: string) => createHash("sha256").update(value).digest("hex"),
    signIn: async () => { throw Object.assign(new Error("cancelled"), { code: "ERR_REQUEST_CANCELED" }); }
  });
  const result = await flow.signIn();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "cancelled");
});

test("Apple unavailability does not create a nonce or open an account flow", async () => {
  let randomCalls = 0;
  let requestCalls = 0;
  const flow = flows.createAppleSignInFlow({
    platform: () => "android",
    isAvailable: async () => true,
    randomBytes: async () => { randomCalls += 1; return new Uint8Array(32); },
    sha256: async () => "0".repeat(64),
    signIn: async () => { requestCalls += 1; return {}; }
  });
  const result = await flow.signIn();
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "unavailable");
  assert.equal(randomCalls, 0);
  assert.equal(requestCalls, 0);
});

type TestUser = { uid: string; isAnonymous: boolean };

function authBoundary(initialUser: TestUser | null = null) {
  let currentUser = initialUser;
  const calls: string[] = [];
  const api = {
    currentUser: () => currentUser,
    signInAnonymously: async () => {
      calls.push("anonymous");
      currentUser = { uid: "guest-uid", isAnonymous: true };
      return { user: currentUser };
    },
    signInWithCredential: async (credential: string) => {
      assert.equal(credential, "provider-credential");
      calls.push("sign-in");
      currentUser = { uid: "account-uid", isAnonymous: false };
      return { user: currentUser };
    },
    linkWithCredential: async (user: TestUser, credential: string) => {
      assert.equal(credential, "provider-credential");
      assert.equal(user.uid, currentUser?.uid);
      calls.push("link");
      currentUser = { uid: user.uid, isAnonymous: false };
      return { user: currentUser };
    },
    reauthenticateWithCredential: async (user: TestUser, credential: string) => {
      assert.equal(credential, "provider-credential");
      assert.equal(user.uid, currentUser?.uid);
      calls.push("reauthenticate");
      return { user };
    },
    signOut: async () => { calls.push("sign-out"); currentUser = null; }
  };
  return { api, calls, setCurrentUser: (user: TestUser | null) => { currentUser = user; } };
}

function identityCoordinator(api: ReturnType<typeof authBoundary>["api"]) {
  return flows.createAuthIdentityCoordinator(api);
}

test("opening the local-first app does not create an account through coordinator construction", () => {
  const { api, calls } = authBoundary();
  identityCoordinator(api);
  assert.deepEqual(calls, []);
  assert.equal(api.currentUser(), null);
});

test("an explicit guest request keeps either an existing guest or signed-in user", async () => {
  for (const isAnonymous of [true, false]) {
    const existing = { uid: "existing-uid", isAnonymous };
    const { api, calls } = authBoundary(existing);
    const coordinator = identityCoordinator(api);
    assert.strictEqual(await coordinator.ensureGuest(), existing);
    assert.deepEqual(calls, []);
  }
});

test("concurrent explicit guest requests share one initialization and UID", async () => {
  const { api, calls, setCurrentUser } = authBoundary();
  let finishGuest!: (value: { user: TestUser }) => void;
  api.signInAnonymously = () => {
    calls.push("anonymous");
    return new Promise((resolve) => { finishGuest = resolve; });
  };
  const coordinator = identityCoordinator(api);
  const first = coordinator.ensureGuest();
  const second = coordinator.ensureGuest();
  assert.strictEqual(first, second);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["anonymous"]);
  const guest = { uid: "guest-uid", isAnonymous: true };
  setCurrentUser(guest);
  finishGuest({ user: guest });
  assert.strictEqual(await first, guest);
  assert.strictEqual(await second, guest);
});

test("a failed guest initialization can be retried without poisoning the identity queue", async () => {
  const { api, calls } = authBoundary();
  const realAnonymous = api.signInAnonymously;
  let firstAttempt = true;
  api.signInAnonymously = async () => {
    if (firstAttempt) { firstAttempt = false; throw new Error("network-offline"); }
    return realAnonymous();
  };
  const coordinator = identityCoordinator(api);
  await assert.rejects(coordinator.ensureGuest(), /network-offline/);
  assert.equal((await coordinator.ensureGuest()).uid, "guest-uid");
  assert.deepEqual(calls, ["anonymous"]);
});

test("provider linking upgrades the anonymous account while retaining its UID", async () => {
  const { api, calls } = authBoundary({ uid: "original-guest", isAnonymous: true });
  const result = await identityCoordinator(api).signInWithCredential("provider-credential");
  assert.deepEqual(result, {
    ok: true, operation: "linked", user: { uid: "original-guest", isAnonymous: false }
  });
  assert.equal(api.currentUser()?.uid, "original-guest");
  assert.deepEqual(calls, ["link"]);
});

test("a provider request waits for a pending guest then links instead of replacing it", async () => {
  const { api, calls, setCurrentUser } = authBoundary();
  let finishGuest!: () => void;
  api.signInAnonymously = () => {
    calls.push("anonymous");
    return new Promise((resolve) => {
      finishGuest = () => {
        const user = { uid: "guest-created-in-flight", isAnonymous: true };
        setCurrentUser(user);
        resolve({ user });
      };
    });
  };
  const coordinator = identityCoordinator(api);
  const pendingGuest = coordinator.ensureGuest();
  const pendingProvider = coordinator.signInWithCredential("provider-credential");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["anonymous"]);
  finishGuest();
  await pendingGuest;
  assert.deepEqual(await pendingProvider, {
    ok: true, operation: "linked", user: { uid: "guest-created-in-flight", isAnonymous: false }
  });
  assert.deepEqual(calls, ["anonymous", "link"]);
});

test("a credential owned by another account leaves the guest intact and returns an explicit conflict", async () => {
  const guest = { uid: "original-guest", isAnonymous: true };
  const { api, calls } = authBoundary(guest);
  api.linkWithCredential = async () => {
    calls.push("link");
    throw Object.assign(new Error("provider-secret-token"), { code: "auth/credential-already-in-use" });
  };
  const result = await identityCoordinator(api).signInWithCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "account-conflict");
    assert.doesNotMatch(result.message, /provider-secret-token/);
  }
  assert.strictEqual(api.currentUser(), guest);
  assert.deepEqual(calls, ["link"]);
});

test("a provider request without a guest performs ordinary sign-in without creating a guest", async () => {
  const { api, calls } = authBoundary();
  const result = await identityCoordinator(api).signInWithCredential("provider-credential");
  assert.deepEqual(result, {
    ok: true, operation: "signed-in", user: { uid: "account-uid", isAnonymous: false }
  });
  assert.deepEqual(calls, ["sign-in"]);
});

test("a guest link rejects an SDK result that replaces the original UID", async () => {
  const { api, setCurrentUser } = authBoundary({ uid: "original-guest", isAnonymous: true });
  api.linkWithCredential = async () => {
    const user = { uid: "different-uid", isAnonymous: false };
    setCurrentUser(user);
    return { user };
  };
  const result = await identityCoordinator(api).signInWithCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
});

test("guest linking rejects a changed UID even if the SDK mutates the captured User object", async () => {
  const guest = { uid: "original-guest", isAnonymous: true };
  const { api } = authBoundary(guest);
  api.linkWithCredential = async () => {
    guest.uid = "replaced-guest";
    guest.isAnonymous = false;
    return { user: guest };
  };
  const result = await identityCoordinator(api).signInWithCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
});

test("reauthentication targets the existing permanent UID without sign-in or guest creation", async () => {
  const account = { uid: "original-account", isAnonymous: false };
  const { api, calls } = authBoundary(account);
  assert.deepEqual(await identityCoordinator(api).reauthenticateWithCredential("provider-credential"), {
    ok: true, operation: "reauthenticated", user: account
  });
  assert.strictEqual(api.currentUser(), account);
  assert.deepEqual(calls, ["reauthenticate"]);
});

test("a signed-out user or guest cannot reauthenticate by silently creating or replacing an account", async () => {
  for (const user of [null, { uid: "guest", isAnonymous: true }]) {
    const { api, calls } = authBoundary(user);
    const result = await identityCoordinator(api).reauthenticateWithCredential("provider-credential");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "sign-in-required");
    assert.deepEqual(calls, []);
  }
});

test("sign-out waits for guest initialization and ends with no account", async () => {
  const { api, calls } = authBoundary();
  const coordinator = identityCoordinator(api);
  const pendingGuest = coordinator.ensureGuest();
  const pendingSignOut = coordinator.signOut();
  await Promise.all([pendingGuest, pendingSignOut]);
  assert.equal(api.currentUser(), null);
  assert.deepEqual(calls, ["anonymous", "sign-out"]);
});

test("an explicit guest request after sign-out does not reuse guest initialization from before sign-out", async () => {
  const { api, calls } = authBoundary();
  const coordinator = identityCoordinator(api);
  const firstGuest = coordinator.ensureGuest();
  const signedOut = coordinator.signOut();
  const newGuest = coordinator.ensureGuest();
  assert.notStrictEqual(firstGuest, newGuest);
  await Promise.all([firstGuest, signedOut, newGuest]);
  assert.deepEqual(calls, ["anonymous", "sign-out", "anonymous"]);
  assert.equal(api.currentUser()?.isAnonymous, true);
});

test("ordinary sign-in cannot silently replace a permanent recovery account", async () => {
  const account = { uid: "original-account", isAnonymous: false };
  const { api, calls } = authBoundary(account);
  const result = await identityCoordinator(api).signInWithCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "sign-out-required");
  assert.strictEqual(api.currentUser(), account);
  assert.deepEqual(calls, []);
});

test("explicit provider linking keeps a permanent account UID instead of signing into another account", async () => {
  const { api, calls } = authBoundary({ uid: "original-account", isAnonymous: false });
  const result = await identityCoordinator(api).linkCurrentCredential("provider-credential");
  assert.deepEqual(result, { ok: true, operation: "linked", user: { uid: "original-account", isAnonymous: false } });
  assert.deepEqual(calls, ["link"]);
});

test("explicit linking without a current account cannot create a guest or sign in", async () => {
  const { api, calls } = authBoundary();
  const result = await identityCoordinator(api).linkCurrentCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "sign-in-required");
  assert.deepEqual(calls, []);
});

test("provider-already-linked is a truthful fixed failure rather than a false linked success", async () => {
  const account = { uid: "original-account", isAnonymous: false };
  const { api } = authBoundary(account);
  api.linkWithCredential = async () => { throw Object.assign(new Error("private-token-detail"), { code: "auth/provider-already-linked" }); };
  const result = await identityCoordinator(api).linkCurrentCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "provider-already-linked");
    assert.doesNotMatch(result.message, /private-token/);
  }
  assert.strictEqual(api.currentUser(), account);
});

test("every guest upgrade and explicit permanent link waits for the purchase-account fence", async () => {
  for (const isAnonymous of [true, false]) {
    const { api, calls } = authBoundary({ uid: "original-account", isAnonymous });
    const coordinator = flows.createAuthIdentityCoordinator({
      ...api,
      beforeLink: async (user: TestUser) => { assert.equal(user.uid, "original-account"); calls.push("fence"); }
    });
    const result = isAnonymous
      ? await coordinator.signInWithCredential("provider-credential")
      : await coordinator.linkCurrentCredential("provider-credential");
    assert.equal(result.ok, true);
    assert.deepEqual(calls, ["fence", "link"]);
  }
});

test("an unavailable fence leaves the existing identity intact and does not call provider linking", async () => {
  const account = { uid: "original-account", isAnonymous: true };
  const { api, calls } = authBoundary(account);
  const coordinator = flows.createAuthIdentityCoordinator({
    ...api,
    beforeLink: async () => { throw new Error("private-backend-detail"); }
  });
  const result = await coordinator.signInWithCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "link-unavailable");
    assert.doesNotMatch(result.message, /private-backend/);
  }
  assert.strictEqual(api.currentUser(), account);
  assert.deepEqual(calls, []);
});

test("an account change during the purchase fence prevents a stale provider link", async () => {
  const { api, calls, setCurrentUser } = authBoundary({ uid: "original-account", isAnonymous: true });
  const coordinator = flows.createAuthIdentityCoordinator({
    ...api,
    beforeLink: async () => { setCurrentUser({ uid: "different-account", isAnonymous: false }); }
  });
  const result = await coordinator.signInWithCredential("provider-credential");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
  assert.deepEqual(calls, []);
});

test("Google receives an explicit iOS client ID only on iOS while retaining the web client ID", async () => {
  for (const platform of ["ios", "android"]) {
    const options: object[] = [];
    const flow = flows.createGoogleSignInFlow({
      platform: () => platform, webClientId: () => "web-client-id", iosClientId: () => "real-ios-client-id",
      loadSdk: async () => ({
        configure: (value) => { options.push(value); }, hasPlayServices: async () => true,
        signIn: async () => ({ type: "success", data: googleUser })
      })
    });
    assert.equal((await flow.signIn()).ok, true);
    assert.deepEqual(options, [{ webClientId: "web-client-id", offlineAccess: false, ...(platform === "ios" ? { iosClientId: "real-ios-client-id" } : {}) }]);
  }
});

async function queuedAccountSwitch() {
  const boundary = authBoundary({ uid: "first-owner", isAnonymous: false });
  const coordinator = flows.createAuthIdentityCoordinator({
    ...boundary.api,
    createEmailCredential: () => "provider-credential",
    createUserWithEmailAndPassword: async () => { throw new Error("Unexpected account creation"); },
    linkWithProvider: async (user: TestUser) => { boundary.calls.push("provider-link"); return { user }; },
    reauthenticateWithProvider: async (user: TestUser) => { boundary.calls.push("provider-reauthenticate"); return { user }; }
  });
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const began = new Promise<void>(resolve => { started = resolve; });
  const holder = coordinator.performCurrentAccountAction("first-owner", async () => { started(); await held; });
  await began;
  const signOut = coordinator.signOut();
  const replacement = coordinator.signInWithCredential("provider-credential");
  return { ...boundary, coordinator, release, queued: Promise.all([holder, signOut, replacement]) };
}

test("an explicit credential link cannot attach to a different account that was queued ahead of it", async () => {
  const value = await queuedAccountSwitch();
  const pending = value.coordinator.linkCurrentCredential("provider-credential");
  value.release();
  await value.queued;
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
  assert.deepEqual(value.calls, ["sign-out", "sign-in"]);
});

test("credential reauthentication cannot confirm the replacement account from an earlier queue entry", async () => {
  const value = await queuedAccountSwitch();
  const pending = value.coordinator.reauthenticateWithCredential("provider-credential");
  value.release();
  await value.queued;
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
  assert.deepEqual(value.calls, ["sign-out", "sign-in"]);
});

test("explicit native provider linking cannot attach to the replacement account from an earlier queue entry", async () => {
  const value = await queuedAccountSwitch();
  const pending = value.coordinator.signInWithProvider("apple.com", { linkExisting: true });
  value.release();
  await value.queued;
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
  assert.deepEqual(value.calls, ["sign-out", "sign-in"]);
});

test("native provider reauthentication cannot confirm the replacement account from an earlier queue entry", async () => {
  const value = await queuedAccountSwitch();
  const pending = value.coordinator.reauthenticateWithProvider("apple.com");
  value.release();
  await value.queued;
  const result = await pending;
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "user-changed");
  assert.deepEqual(value.calls, ["sign-out", "sign-in"]);
});
