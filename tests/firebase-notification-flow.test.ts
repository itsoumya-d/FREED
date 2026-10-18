import assert from "node:assert/strict";
import test from "node:test";
import * as module from "../src/lib/firebase-notification-flow";

const api = module;
const TOKEN_A = "firebase-token-alpha-123456789";
const TOKEN_B = "firebase-token-bravo-123456789";
const TOKEN_C = "firebase-token-charlie-123456789";
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function deferred<Value>() { let resolve!: (value: Value) => void; const promise = new Promise<Value>((complete) => { resolve = complete; }); return { promise, resolve }; }

function pushBoundary() {
  let uid: string | null = "current-user";
  let granted = true;
  let refresh: ((token: string) => void) | null = null;
  const calls: string[] = [];
  const registrations: Array<{ uid: string; token: string }> = [];
  const dependencies = {
    permissionGranted: async () => { calls.push("permission"); return granted; },
    currentUid: () => uid,
    prepareDevice: async () => { calls.push("prepare-device"); },
    getToken: async () => { calls.push("get-token"); return TOKEN_A; },
    getInstallationId: async () => { calls.push("installation"); return "firebase-installation-id"; },
    onTokenRefresh: (listener: (token: string) => void) => { calls.push("subscribe"); refresh = listener; return () => { calls.push("unsubscribe"); refresh = null; }; },
    register: async (registration: { token: string }, owner: string) => { registrations.push({ uid: owner, token: registration.token }); return true; }
  };
  const controller = api.createFirebasePushTokenController(dependencies);
  return { controller, dependencies, calls, registrations, refresh: (token: string) => refresh?.(token), setUid: (value: string | null) => { uid = value; }, setGranted: (value: boolean) => { granted = value; } };
}

test("constructing push token coordination does not access permission, tokens, Auth, or network", () => {
  const value = pushBoundary();
  assert.deepEqual(value.calls, []);
  assert.deepEqual(value.registrations, []);
});

test("permission rejection and missing current identity prevent token acquisition and registration", async () => {
  for (const gate of ["argument", "os-permission", "account"]) {
    const value = pushBoundary();
    if (gate === "os-permission") value.setGranted(false);
    if (gate === "account") value.setUid(null);
    const result = await value.controller.start(gate !== "argument");
    assert.equal(result.status, gate === "account" ? "unavailable" : "permission-not-authorized");
    assert.equal(value.calls.includes("get-token"), false);
    assert.equal(value.calls.includes("subscribe"), false);
    assert.deepEqual(value.registrations, []);
  }
});

test("granted permission registers the current token and following rotations against the existing UID", async () => {
  const value = pushBoundary();
  assert.equal((await value.controller.start(true)).status, "registered");
  assert.deepEqual(value.registrations, [{ uid: "current-user", token: TOKEN_A }]);
  value.refresh(TOKEN_B);
  await flush();
  assert.deepEqual(value.registrations, [{ uid: "current-user", token: TOKEN_A }, { uid: "current-user", token: TOKEN_B }]);
  value.refresh(TOKEN_B);
  await flush();
  assert.equal(value.registrations.length, 2);
});

test("rotation callbacks recheck actual permission and current account before every registration", async () => {
  const value = pushBoundary();
  await value.controller.start(true);
  value.setGranted(false);
  value.refresh(TOKEN_B);
  await flush();
  assert.equal(value.registrations.length, 1);
  value.setGranted(true); value.setUid("different-user");
  value.refresh(TOKEN_C);
  await flush();
  assert.equal(value.registrations.length, 1);
});

test("permission revoked during device preparation cannot acquire a token or attach rotation listeners", async () => {
  const value = pushBoundary();
  const preparing = deferred<void>();
  value.dependencies.prepareDevice = () => preparing.promise;
  const initial = value.controller.start(true);
  await flush();
  value.setGranted(false);
  preparing.resolve();
  assert.equal((await initial).status, "permission-not-authorized");
  assert.equal(value.calls.includes("get-token"), false);
  assert.equal(value.calls.includes("subscribe"), false);
});

test("token rotations coalesce to the newest token while an older registration is running", async () => {
  const value = pushBoundary();
  const first = deferred<void>();
  let active = 0;
  let maximumActive = 0;
  value.dependencies.register = async (registration, owner) => {
    value.registrations.push({ uid: owner, token: registration.token });
    active += 1; maximumActive = Math.max(maximumActive, active);
    if (registration.token === TOKEN_A) await first.promise;
    active -= 1; return true;
  };
  const initial = value.controller.start(true);
  await flush();
  value.refresh(TOKEN_B); value.refresh(TOKEN_C);
  first.resolve();
  assert.equal((await initial).status, "registered");
  await flush();
  assert.deepEqual(value.registrations.map((entry) => entry.token), [TOKEN_A, TOKEN_C]);
  assert.equal(maximumActive, 1);
});

test("a rotation during initial token loading cannot be overwritten by its older result", async () => {
  const value = pushBoundary();
  const initialToken = deferred<string>();
  value.dependencies.getToken = () => initialToken.promise;
  const initial = value.controller.start(true);
  await flush();
  value.refresh(TOKEN_B);
  await flush();
  initialToken.resolve(TOKEN_A);
  await initial;
  assert.deepEqual(value.registrations.map((entry) => entry.token), [TOKEN_B]);
});

test("cleanup blocks queued rotations and never exposes token values through failures", async () => {
  const value = pushBoundary();
  await value.controller.start(true);
  value.dependencies.register = async () => { throw new Error(TOKEN_B); };
  value.refresh(TOKEN_B);
  await flush();
  value.controller.stop();
  value.refresh(TOKEN_C);
  await flush();
  assert.equal(value.calls.includes("unsubscribe"), true);
  assert.equal(value.registrations.length, 1);
});

function openBoundary() {
  let opened: ((message: unknown) => void) | null = null;
  let granted = true;
  let checkIns = 0;
  const calls: string[] = [];
  const initial = deferred<unknown>();
  const dependencies = {
    permissionGranted: async () => granted,
    getInitialNotification: () => { calls.push("initial"); return initial.promise; },
    onNotificationOpened: (listener: (message: unknown) => void) => { calls.push("subscribe"); opened = listener; return () => { calls.push("unsubscribe"); opened = null; }; }
  };
  return { dependencies, calls, initial, onCheckIn: () => { checkIns += 1; }, checkIns: () => checkIns, opened: (message: unknown) => opened?.(message), setGranted: (value: boolean) => { granted = value; } };
}

test("only granted permission attaches Firebase notification-open listeners", async () => {
  const value = openBoundary();
  value.setGranted(false);
  api.createFirebaseNotificationOpenListener(value.dependencies, value.onCheckIn);
  await flush();
  assert.deepEqual(value.calls, []);
});

test("initial and background-open notifications accept only checkin and dedupe message IDs", async () => {
  const value = openBoundary();
  api.createFirebaseNotificationOpenListener(value.dependencies, value.onCheckIn);
  await flush();
  value.opened({ messageId: "notification-1", data: { route: "checkin", url: "https://private.example" } });
  value.initial.resolve({ messageId: "notification-1", data: { route: "checkin" } });
  await flush();
  value.opened({ messageId: "notification-2", data: { route: "delete-account" } });
  value.opened({ messageId: "notification-3", data: { route: "https://wrong.example" } });
  value.opened({ data: { route: "checkin" } });
  assert.equal(value.checkIns(), 1);
  value.opened({ messageId: "notification-4", data: { route: "checkin" } });
  assert.equal(value.checkIns(), 2);
});

test("open-listener cleanup suppresses a late initial notification and unsubscribes SDK callbacks", async () => {
  const value = openBoundary();
  const stop = api.createFirebaseNotificationOpenListener(value.dependencies, value.onCheckIn);
  await flush();
  stop();
  value.initial.resolve({ messageId: "notification-1", data: { route: "checkin" } });
  await flush();
  assert.equal(value.checkIns(), 0);
  assert.equal(value.calls.includes("unsubscribe"), true);
});
