import assert from "node:assert/strict";
import test from "node:test";
import * as notifications from "./subscription-notifications.js";

const api = notifications;

function responseRecorder() {
  let code = 0;
  let result: unknown;
  const response = { status: (value: number) => { code = value; return response; }, json: (value: unknown) => { result = value; } };
  return { response, code: () => code, result: () => result };
}

test("Apple HTTP transport rejects non-POST, non-JSON, and oversized bodies before loading credentials", async () => {
  let loads = 0;
  const handler = api.createAppleSubscriptionHttpHandler(() => { loads += 1; throw new Error("must not load"); });
  for (const [request, expected] of [
    [{ method: "GET", headers: {}, body: {} }, 405],
    [{ method: "POST", headers: { "content-type": "text/plain" }, body: {} }, 415],
    [{ method: "POST", headers: { "content-type": "application/json" }, rawBody: Buffer.alloc(65 * 1024), body: {} }, 413]
  ] as const) {
    const recorded = responseRecorder();
    await handler(request, recorded.response);
    assert.equal(recorded.code(), expected);
  }
  assert.equal(loads, 0);
});

test("missing credentials fail closed with a fixed retryable Apple reply", async () => {
  const handler = api.createAppleSubscriptionHttpHandler(() => { throw new Error("private-key-value"); });
  const recorded = responseRecorder();
  await handler({ method: "POST", headers: { "content-type": "application/json" }, body: { signedPayload: "private-jws" } }, recorded.response);
  assert.equal(recorded.code(), 503);
  assert.deepEqual(recorded.result(), { status: "unavailable" });
  assert.doesNotMatch(JSON.stringify(recorded.result()), /private/);
});

test("Apple verification rejection returns a fixed 400 and successful duplicate returns 200", async () => {
  for (const [status, code] of [["rejected", 400], ["duplicate", 200]] as const) {
    const handler = api.createAppleSubscriptionHttpHandler(() => ({ processApple: async () => ({ status }) }));
    const recorded = responseRecorder();
    await handler({ method: "POST", headers: { "content-type": "application/json" }, body: { signedPayload: "private-jws" } }, recorded.response);
    assert.equal(recorded.code(), code);
    assert.deepEqual(recorded.result(), { status });
  }
});

test("Apple transport has a hard response deadline for a stalled processor", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const handler = api.createAppleSubscriptionHttpHandler(() => ({ processApple: () => new Promise(() => undefined) }), 5);
  const recorded = responseRecorder();
  const pending = handler({ method: "POST", headers: { "content-type": "application/json" }, body: { signedPayload: "private-jws" } }, recorded.response);
  await new Promise<void>((resolve) => setImmediate(resolve));
  context.mock.timers.tick(5);
  await pending;
  assert.equal(recorded.code(), 503);
  assert.deepEqual(recorded.result(), { status: "unavailable" });
});

test("Google transient failures retry with a fixed error rather than exposing payloads or credentials", async () => {
  const handler = api.createGoogleSubscriptionMessageHandler(() => ({ processGoogle: async () => ({ status: "unavailable" }) }));
  await assert.rejects(handler({ source: "trusted-topic", type: "pubsub", data: { message: { messageId: "event", data: "private-token" } } }), /^Error: Subscription processing temporarily unavailable\.$/);
});

test("Google transport forwards only the authenticated event envelope and acknowledges permanently rejected notifications", async () => {
  let envelope: unknown;
  const handler = api.createGoogleSubscriptionMessageHandler(() => ({ processGoogle: async (value: unknown) => {
    envelope = value;
    return { status: "rejected" };
  } }));
  await handler({ source: "trusted-topic", type: "pubsub", data: { message: { messageId: "event", data: "encoded" } } });
  assert.deepEqual(envelope, { source: "trusted-topic", type: "pubsub", messageId: "event", data: "encoded" });
});

test("actual deployed functions bind the expected triggers, region, timeouts, and existing secrets", () => {
  assert.equal(typeof api.appleSubscriptionNotifications, "function");
  assert.equal(typeof api.googlePlaySubscriptionNotifications, "function");
  assert.equal(typeof api.appleSubscriptionNotificationsSandbox, "function");
  assert.equal(api.GOOGLE_PLAY_SUBSCRIPTION_TOPIC_DEFAULT, "freed-google-play-subscriptions");
  assert.equal(api.SUBSCRIPTION_RECEIPT_COLLECTION, "purchase_notification_receipts");
  assert.deepEqual(api.SUBSCRIPTION_NOTIFICATION_SECRET_NAMES, [
    "APPLE_STORE_ISSUER_ID", "APPLE_STORE_KEY_ID", "APPLE_STORE_PRIVATE_KEY", "APPLE_STORE_APP_ID",
    "APPLE_STORE_ROOT_CAS_BASE64", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"
  ]);
  const apple = api.appleSubscriptionNotifications.__endpoint;
  const google = api.googlePlaySubscriptionNotifications.__endpoint;
  const sandbox = api.appleSubscriptionNotificationsSandbox.__endpoint;
  assert.deepEqual(apple.region, ["asia-south1"]);
  assert.equal(apple.timeoutSeconds, 30);
  assert.deepEqual(apple.httpsTrigger?.invoker, ["public"]);
  assert.deepEqual(sandbox.httpsTrigger?.invoker, ["public"]);
  assert.equal(google.eventTrigger?.eventType, "google.cloud.pubsub.topic.v1.messagePublished");
  assert.equal(google.timeoutSeconds, 30);
  assert.equal(google.eventTrigger?.retry, true);
  assert.deepEqual(apple.secretEnvironmentVariables?.map((secret) => secret.key), api.SUBSCRIPTION_NOTIFICATION_SECRET_NAMES.slice(0, 5));
  assert.deepEqual(sandbox.secretEnvironmentVariables?.map((secret) => secret.key), api.SUBSCRIPTION_NOTIFICATION_SECRET_NAMES.slice(0, 5));
  assert.deepEqual(google.secretEnvironmentVariables?.map((secret) => secret.key), ["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]);
});
