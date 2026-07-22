import assert from "node:assert/strict";
import test from "node:test";

import {
  APPLE_BUNDLE_ID,
  GOOGLE_PACKAGE_NAME,
  PurchaseAccessError,
  PurchaseProviderError,
  createAppleStoreProvider,
  createGooglePlayProvider,
  createPurchaseVerificationService,
  deriveAppleAppAccountToken,
  hashStoreReference,
  normalizeGoogleAuthorizationHeaders,
  parseVerifyStorePurchaseRequest,
  type AppleLibraryBoundary,
  type CoreProductId,
  type PurchaseClaimInput,
  type VerifiedStorePurchase
} from "./purchase.js";

const NOW = Date.parse("2026-07-22T12:00:00.000Z");
const UID = "firebaseUid123";
const PRODUCTS = ["freed_premium_monthly", "freed_premium_yearly", "freed_premium_lifetime"] as const;

test("purchase request parser accepts only the exact bounded platform union", () => {
  const ios = {
    platform: "ios",
    productId: "freed_premium_monthly",
    transactionId: "2000001234567890",
    clientEventId: "purchase_event_123",
    restore: false
  };
  const android = {
    platform: "android",
    productId: "freed_premium_lifetime",
    purchaseToken: "play-token_1234567890",
    clientEventId: "restore_event_1234",
    restore: true
  };
  assert.deepEqual(parseVerifyStorePurchaseRequest(ios), ios);
  assert.deepEqual(parseVerifyStorePurchaseRequest(android), android);

  for (const invalid of [
    { ...ios, receipt: "unsigned" },
    { ...ios, transactionId: "not numeric" },
    { ...ios, bundleId: APPLE_BUNDLE_ID },
    { ...ios, productId: "attacker_product" },
    { ...ios, restore: "false" },
    { ...android, purchaseToken: "short" },
    { ...android, accessToken: "client-oauth-token" },
    { ...android, packageName: GOOGLE_PACKAGE_NAME },
    { ...android, transactionId: "2000001234567890" },
    { ...android, purchaseToken: "x".repeat(8 * 1024), clientEventId: "x".repeat(9 * 1024) },
    null,
    []
  ]) {
    assert.throws(() => parseVerifyStorePurchaseRequest(invalid), /purchase payload/i);
  }
});

test("verification grants only after provider proof and durable same-owner claim", async () => {
  const claims: PurchaseClaimInput[] = [];
  const service = createPurchaseVerificationService({
    now: () => NOW,
    authorize: async () => "allowed",
    apple: provider("ios", "2000001234567890", "freed_premium_monthly", NOW + 60_000),
    google: rejectingProvider(),
    claimVerifiedPurchase: async (claim) => {
      claims.push(claim);
      return "claimed";
    }
  });
  const result = await service.verify(UID, {
    platform: "ios",
    productId: "freed_premium_monthly",
    transactionId: "2000001234567890",
    clientEventId: "purchase_event_123",
    restore: false
  });
  assert.deepEqual(result, {
    active: true,
    entitlementId: "premium",
    productId: "freed_premium_monthly",
    platform: "ios",
    status: "verified",
    expiresAt: "2026-07-22T12:01:00.000Z"
  });
  assert.equal(claims.length, 1);
  assert.equal(claims[0]?.uid, UID);
  assert.equal(claims[0]?.storeReferenceHash, hashStoreReference("2000001234567890"));
  assert.equal(JSON.stringify(claims).includes("2000001234567890"), false);
});

test("rate limit, duplicate event, deletion fence, provider failure, and claim failure never grant", async () => {
  for (const authorization of ["duplicate", "rate-limited", "account-deleting"] as const) {
    let providerCalls = 0;
    const service = createPurchaseVerificationService({
      now: () => NOW,
      authorize: async () => authorization,
      apple: { verify: async () => { providerCalls += 1; throw new Error("must not run"); } },
      google: rejectingProvider(),
      claimVerifiedPurchase: async () => "claimed"
    });
    if (authorization === "duplicate") {
      assert.equal((await service.verify(UID, iosRequest())).active, false);
    } else {
      await assert.rejects(() => service.verify(UID, iosRequest()), PurchaseAccessError);
    }
    assert.equal(providerCalls, 0);
  }

  for (const failure of [
    new PurchaseProviderError("rejected"),
    new PurchaseProviderError("unavailable"),
    new Error("private transaction 2000001234567890")
  ]) {
    const result = await createPurchaseVerificationService({
      now: () => NOW,
      authorize: async () => "allowed",
      apple: { verify: async () => { throw failure; } },
      google: rejectingProvider(),
      claimVerifiedPurchase: async () => "claimed"
    }).verify(UID, iosRequest());
    assert.equal(result.active, false);
    assert.equal(JSON.stringify(result).includes("2000001234567890"), false);
  }

  for (const claimResult of ["conflict", "account-deleting", "unavailable"] as const) {
    const result = await createPurchaseVerificationService({
      now: () => NOW,
      authorize: async () => "allowed",
      apple: provider("ios", "2000001234567890", "freed_premium_monthly", NOW + 60_000),
      google: rejectingProvider(),
      claimVerifiedPurchase: async () => claimResult
    }).verify(UID, iosRequest());
    assert.equal(result.active, false);
    assert.notEqual(result.status, "verified");
  }
});

test("same reference can restore to its owner while a cross-UID race is rejected", async () => {
  const owners = new Map<string, string>();
  const claim = async (input: PurchaseClaimInput) => {
    const owner = owners.get(input.storeReferenceHash);
    if (owner && owner !== input.uid) return "conflict" as const;
    if (owner === input.uid) return "owned" as const;
    owners.set(input.storeReferenceHash, input.uid);
    return "claimed" as const;
  };
  const makeService = () => createPurchaseVerificationService({
    now: () => NOW,
    authorize: async () => "allowed",
    apple: provider("ios", "2000001234567890", "freed_premium_monthly", NOW + 60_000),
    google: rejectingProvider(),
    claimVerifiedPurchase: claim
  });
  assert.equal((await makeService().verify(UID, iosRequest())).active, true);
  assert.equal((await makeService().verify(UID, { ...iosRequest(), restore: true, clientEventId: "restore_event_1234" })).active, true);
  assert.equal((await makeService().verify("otherFirebaseUid", { ...iosRequest(), clientEventId: "other_event_12345" })).active, false);
});

test("Apple provider uses the official client and cryptographic verifier boundary", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const expectedToken = deriveAppleAppAccountToken(UID);
  const boundary = appleBoundary(calls, () => appleDecoded({ appAccountToken: expectedToken }));
  const provider = createAppleStoreProvider(appleConfig(), boundary, () => NOW);
  const verified = await provider.verify({
    transactionId: "2000001234567890",
    productId: "freed_premium_monthly",
    expectedAppAccountToken: expectedToken
  });
  assert.equal(verified.storeReference, "2000001234567890");
  assert.equal(verified.productId, "freed_premium_monthly");
  assert.equal(verified.expiresAt, NOW + 60_000);
  assert.deepEqual(calls.map((call) => call.kind), ["client", "api", "verifier", "verify"]);
  assert.deepEqual(calls[0], {
    kind: "client",
    environment: "Production",
    issuerId: "issuer-12345678",
    keyId: "KEYID12345",
    privateKey: "-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----",
    bundleId: APPLE_BUNDLE_ID
  });
  assert.equal(calls[2]?.enableOnlineChecks, true);
  assert.equal(calls[2]?.appAppleId, 1234567890);
  assert.equal((calls[2]?.rootCertificates as Buffer[])[0]?.toString(), "root-one");
});

test("Apple subscription ownership is fenced by the stable original transaction", async () => {
  const transactionId = "2000001234567899";
  const originalTransactionId = "2000001234567890";
  const provider = createAppleStoreProvider(
    appleConfig(),
    appleBoundary([], () => appleDecoded({ transactionId, originalTransactionId })),
    () => NOW
  );
  const verified = await provider.verify({
    transactionId,
    productId: "freed_premium_monthly",
    expectedAppAccountToken: deriveAppleAppAccountToken(UID)
  });
  assert.equal(verified.storeReference, originalTransactionId);
  assert.equal(verified.orderReference, transactionId);
});

test("Apple verification rejects unsigned, tampered, wrong identity, revoked, expired, and wrong type data", async () => {
  const expectedToken = deriveAppleAppAccountToken(UID);
  const invalidDecoded = [
    appleDecoded({ bundleId: "attacker.app" }),
    appleDecoded({ appAppleId: 999 }),
    appleDecoded({ productId: "freed_premium_yearly" }),
    appleDecoded({ transactionId: "2000009999999999" }),
    appleDecoded({ environment: "Sandbox" }),
    appleDecoded({ revocationDate: NOW - 1 }),
    appleDecoded({ expiresDate: NOW - 1 }),
    appleDecoded({ type: "Non-Consumable" }),
    appleDecoded({ inAppOwnershipType: "FAMILY_SHARED" }),
    appleDecoded({ appAccountToken: "00000000-0000-4000-8000-000000000000" }),
    appleDecoded({ purchaseDate: Number.NaN })
  ];
  for (const decoded of invalidDecoded) {
    const provider = createAppleStoreProvider(appleConfig(), appleBoundary([], () => decoded), () => NOW);
    await assert.rejects(() => provider.verify({
      transactionId: "2000001234567890",
      productId: "freed_premium_monthly",
      expectedAppAccountToken: expectedToken
    }), PurchaseProviderError);
  }
  for (const verifierFailure of ["unsigned", "tampered", "wrong-root", "malformed-jws"]) {
    const provider = createAppleStoreProvider(appleConfig(), appleBoundary([], () => { throw new Error(verifierFailure); }), () => NOW);
    await assert.rejects(() => provider.verify({
      transactionId: "2000001234567890",
      productId: "freed_premium_monthly",
      expectedAppAccountToken: expectedToken
    }), PurchaseProviderError);
  }
});

test("Apple falls back to Sandbox only for an exact not-found or environment mismatch", async () => {
  for (const allowedReason of ["not-found", "environment-mismatch"] as const) {
    const environments: string[] = [];
    const boundary = appleBoundary([], () => appleDecoded({ environment: "Sandbox" }));
    boundary.createClient = (input) => {
      environments.push(input.environment);
      return {
        getTransactionInfo: async () => {
          if (input.environment === "Production") throw Object.assign(new Error("safe"), { appleFallbackReason: allowedReason });
          return { signedTransactionInfo: "signed.sandbox.transaction" };
        }
      };
    };
    boundary.isNotFoundOrEnvironmentMismatch = (error) =>
      (error as { appleFallbackReason?: string }).appleFallbackReason === allowedReason;
    const result = await createAppleStoreProvider(appleConfig(), boundary, () => NOW).verify({
      transactionId: "2000001234567890",
      productId: "freed_premium_monthly",
      expectedAppAccountToken: deriveAppleAppAccountToken(UID)
    });
    assert.equal(result.environment, "Sandbox");
    assert.deepEqual(environments, ["Production", "Sandbox"]);
  }

  for (const failure of [new Error("timeout"), new Error("bad-signature"), new Error("unauthorized")]) {
    let sandboxCalled = false;
    const boundary = appleBoundary([], () => appleDecoded());
    boundary.createClient = (input) => ({ getTransactionInfo: async () => {
      if (input.environment === "Sandbox") sandboxCalled = true;
      throw failure;
    } });
    boundary.isNotFoundOrEnvironmentMismatch = () => false;
    await assert.rejects(() => createAppleStoreProvider(appleConfig(), boundary, () => NOW).verify({
      transactionId: "2000001234567890",
      productId: "freed_premium_monthly",
      expectedAppAccountToken: deriveAppleAppAccountToken(UID)
    }), PurchaseProviderError);
    assert.equal(sandboxCalled, false);
  }
});

test("Apple API and cryptographic verification each have a hard timeout", async () => {
  const boundary = appleBoundary([], () => appleDecoded());
  boundary.createClient = () => ({ getTransactionInfo: async () => new Promise(() => undefined) });
  const startedAt = Date.now();
  await assert.rejects(() => createAppleStoreProvider(appleConfig(), boundary, () => NOW, 5).verify({
    transactionId: "2000001234567890",
    productId: "freed_premium_monthly",
    expectedAppAccountToken: deriveAppleAppAccountToken(UID)
  }), PurchaseProviderError);
  assert.ok(Date.now() - startedAt < 100);

  const verifyBoundary = appleBoundary([], () => new Promise<Record<string, unknown>>(() => undefined) as never);
  const verificationStartedAt = Date.now();
  await assert.rejects(() => createAppleStoreProvider(appleConfig(), verifyBoundary, () => NOW, 5).verify({
    transactionId: "2000001234567890",
    productId: "freed_premium_monthly",
    expectedAppAccountToken: deriveAppleAppAccountToken(UID)
  }), PurchaseProviderError);
  assert.ok(Date.now() - verificationStartedAt < 100);
});

test("Google subscriptions use OAuth scope, exact encoded v2 path, and active line-item state", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const provider = createGooglePlayProvider(googleServiceAccount(), {
    getAuthorizationHeaders: async (json, scopes) => {
      calls.push({ kind: "auth", json, scopes });
      return { authorization: "Bearer server-only" };
    },
    fetch: async (url, init) => {
      calls.push({ kind: "fetch", url, init });
      return jsonResponse({
        subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        latestOrderId: "GPA.hash-me",
        lineItems: [{ productId: "freed_premium_monthly", expiryTime: "2026-07-22T12:01:00.000Z" }]
      });
    }
  }, () => NOW);
  const verified = await provider.verify({ productId: "freed_premium_monthly", purchaseToken: "token/with+reserved?chars_123" });
  assert.equal(verified.expiresAt, NOW + 60_000);
  assert.deepEqual(calls[0]?.scopes, ["https://www.googleapis.com/auth/androidpublisher"]);
  assert.equal(calls[1]?.url,
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/app.freed.recovery/purchases/subscriptionsv2/tokens/token%2Fwith%2Breserved%3Fchars_123");
  const init = calls[1]?.init as RequestInit;
  assert.equal(init.method, "GET");
  assert.equal(init.redirect, "error");
});

test("official Google Auth Headers are normalized without losing authorization", () => {
  assert.deepEqual(
    normalizeGoogleAuthorizationHeaders(new Headers({ Authorization: "Bearer server-only" })),
    { authorization: "Bearer server-only" }
  );
  assert.deepEqual(
    normalizeGoogleAuthorizationHeaders({ Authorization: "Bearer server-only" }),
    { authorization: "Bearer server-only" }
  );
});

test("Google subscription verification rejects wrong product, state, or expiry", async () => {
  const valid = {
    subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    lineItems: [{ productId: "freed_premium_yearly", expiryTime: "2026-07-22T12:01:00.000Z" }]
  };
  for (const body of [
    { ...valid, subscriptionState: "SUBSCRIPTION_STATE_PENDING" },
    { ...valid, subscriptionState: "SUBSCRIPTION_STATE_PAUSED" },
    { ...valid, subscriptionState: "SUBSCRIPTION_STATE_ON_HOLD" },
    { ...valid, subscriptionState: "SUBSCRIPTION_STATE_CANCELED", lineItems: [{ ...valid.lineItems[0], expiryTime: "2026-07-22T11:59:00.000Z" }] },
    { ...valid, acknowledgementState: "ACKNOWLEDGEMENT_STATE_UNSPECIFIED" },
    { ...valid, lineItems: [{ productId: "freed_premium_monthly", expiryTime: "2026-07-22T12:01:00.000Z" }] },
    { ...valid, lineItems: [{ productId: "freed_premium_yearly", expiryTime: "not-a-date" }] },
    { ...valid, lineItems: [{ productId: "freed_premium_yearly", expiryTime: "2026-07-22T11:59:00.000Z" }] },
    { ...valid, lineItems: [valid.lineItems[0], valid.lineItems[0]] }
  ]) {
    const provider = googleProviderReturning(body);
    await assert.rejects(() => provider.verify({ productId: "freed_premium_yearly", purchaseToken: "play-token_1234567890" }), PurchaseProviderError);
  }
});

test("Google verified-response mismatches remain rejected rather than provider-unavailable", async () => {
  const provider = googleProviderReturning({
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    lineItems: [{ productId: "freed_premium_yearly", expiryTime: "2026-07-22T12:01:00.000Z" }]
  });
  await assert.rejects(
    () => provider.verify({ productId: "freed_premium_monthly", purchaseToken: "play-token_1234567890" }),
    (error: unknown) => error instanceof PurchaseProviderError && error.status === "rejected"
  );
});

test("Google lifetime uses products v2 and requires purchased, unconsumed, unrefunded quantity", async () => {
  const requests: string[] = [];
  const valid = {
    purchaseStateContext: { purchaseState: "PURCHASED" },
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
    orderId: "GPA.hash-me",
    purchaseCompletionTime: "2026-07-22T11:59:00Z",
    productLineItem: [{
      productId: "freed_premium_lifetime",
      productOfferDetails: { quantity: 1, refundableQuantity: 1, consumptionState: "CONSUMPTION_STATE_YET_TO_BE_CONSUMED" }
    }]
  };
  const provider = createGooglePlayProvider(googleServiceAccount(), {
    getAuthorizationHeaders: async () => ({ authorization: "Bearer server-only" }),
    fetch: async (url) => { requests.push(String(url)); return jsonResponse(valid); }
  }, () => NOW);
  assert.equal((await provider.verify({ productId: "freed_premium_lifetime", purchaseToken: "play-token_1234567890" })).expiresAt, null);
  assert.match(requests[0] ?? "", /\/purchases\/productsv2\/tokens\//);

  for (const body of [
    { ...valid, purchaseStateContext: { purchaseState: "PENDING" } },
    { ...valid, purchaseStateContext: { purchaseState: "CANCELLED" } },
    { ...valid, acknowledgementState: "ACKNOWLEDGEMENT_STATE_UNSPECIFIED" },
    { ...valid, productLineItem: [{ ...valid.productLineItem[0], productId: "freed_premium_monthly" }] },
    { ...valid, productLineItem: [{ ...valid.productLineItem[0], productOfferDetails: { ...valid.productLineItem[0].productOfferDetails, quantity: 2 } }] },
    { ...valid, productLineItem: [{ ...valid.productLineItem[0], productOfferDetails: { ...valid.productLineItem[0].productOfferDetails, refundableQuantity: 0 } }] },
    { ...valid, productLineItem: [{ ...valid.productLineItem[0], productOfferDetails: { ...valid.productLineItem[0].productOfferDetails, consumptionState: "CONSUMPTION_STATE_CONSUMED" } }] }
  ]) {
    const invalid = googleProviderReturning(body);
    await assert.rejects(() => invalid.verify({ productId: "freed_premium_lifetime", purchaseToken: "play-token_1234567890" }), PurchaseProviderError);
  }
});

test("Google provider fails closed for timeout, redirect, non-JSON, oversized, malformed, and HTTP errors", async () => {
  const failures: Array<(url: string | URL, init?: RequestInit) => Promise<Response>> = [
    async () => new Promise<Response>(() => undefined),
    async () => Response.redirect("https://attacker.example", 302),
    async () => new Response("not-json", { status: 200, headers: { "content-type": "text/plain" } }),
    async () => new Response("x".repeat(512 * 1024 + 1), { status: 200, headers: { "content-type": "application/json" } }),
    async () => new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
    async () => jsonResponse({ error: "private token play-token_1234567890" }, 401),
    async () => jsonResponse({ error: "provider down" }, 503)
  ];
  for (const fetch of failures) {
    const provider = createGooglePlayProvider(googleServiceAccount(), {
      getAuthorizationHeaders: async () => ({ authorization: "Bearer server-only" }),
      fetch
    }, () => NOW, 5);
    await assert.rejects(
      () => provider.verify({ productId: "freed_premium_monthly", purchaseToken: "play-token_1234567890" }),
      (error: unknown) => error instanceof PurchaseProviderError && !String(error).includes("play-token")
    );
  }
});

test("Google deadline remains active until a streaming response body fully closes", async () => {
  const token = "play-token_stream-timeout_123";
  const provider = createGooglePlayProvider(googleServiceAccount(), {
    getAuthorizationHeaders: async () => ({ authorization: "Bearer server-only" }),
    fetch: async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
        // Intentionally never close: the provider deadline must cancel this body.
      }
    }), { status: 200, headers: { "content-type": "application/json" } })
  }, () => NOW, 5);
  const startedAt = Date.now();
  await assert.rejects(
    Promise.race([
      provider.verify({ productId: "freed_premium_monthly", purchaseToken: token }),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`test guard leaked ${token}`)), 100))
    ]),
    (error: unknown) => error instanceof PurchaseProviderError && !String(error).includes(token)
  );
  assert.ok(Date.now() - startedAt < 100, "the configured provider deadline must include body streaming");
});

function iosRequest() {
  return {
    platform: "ios" as const,
    productId: "freed_premium_monthly" as const,
    transactionId: "2000001234567890",
    clientEventId: "purchase_event_123",
    restore: false
  };
}

function provider(platform: "ios" | "android", storeReference: string, productId: CoreProductId, expiresAt: number | null) {
  return { verify: async (): Promise<VerifiedStorePurchase> => ({ platform, storeReference, productId, expiresAt }) };
}

function rejectingProvider() {
  return { verify: async (): Promise<never> => { throw new PurchaseProviderError("rejected"); } };
}

function appleConfig() {
  return {
    issuerId: "issuer-12345678",
    keyId: "KEYID12345",
    privateKey: "-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----",
    appAppleId: "1234567890",
    rootCertificatesBase64: JSON.stringify([Buffer.from("root-one").toString("base64")])
  };
}

function appleDecoded(overrides: Record<string, unknown> = {}) {
  return {
    transactionId: "2000001234567890",
    originalTransactionId: "2000001234567890",
    productId: "freed_premium_monthly",
    bundleId: APPLE_BUNDLE_ID,
    appAppleId: 1234567890,
    environment: "Production",
    type: "Auto-Renewable Subscription",
    inAppOwnershipType: "PURCHASED",
    purchaseDate: NOW - 1_000,
    signedDate: NOW - 500,
    expiresDate: NOW + 60_000,
    ...overrides
  };
}

function appleBoundary(calls: Array<Record<string, unknown>>, decode: () => Record<string, unknown>): AppleLibraryBoundary {
  return {
    createClient(input) {
      calls.push({ kind: "client", ...input });
      return { getTransactionInfo: async (transactionId) => {
        calls.push({ kind: "api", transactionId });
        return { signedTransactionInfo: "signed.apple.transaction" };
      } };
    },
    createVerifier(input) {
      calls.push({ kind: "verifier", ...input });
      return { verifyAndDecodeTransaction: async (signed) => {
        calls.push({ kind: "verify", signed });
        return decode();
      } };
    },
    isNotFoundOrEnvironmentMismatch: () => false
  };
}

function googleServiceAccount() {
  return JSON.stringify({
    type: "service_account",
    project_id: "freed-project",
    private_key_id: "private-key-id",
    private_key: "-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----\n",
    client_email: "play-verifier@freed-project.iam.gserviceaccount.com",
    client_id: "1234567890"
  });
}

function googleProviderReturning(body: unknown) {
  return createGooglePlayProvider(googleServiceAccount(), {
    getAuthorizationHeaders: async () => ({ authorization: "Bearer server-only" }),
    fetch: async () => jsonResponse(body)
  }, () => NOW);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

assert.deepEqual(PRODUCTS, ["freed_premium_monthly", "freed_premium_yearly", "freed_premium_lifetime"]);
