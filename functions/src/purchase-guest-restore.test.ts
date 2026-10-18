import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import { test } from "node:test";
import { commitVerifiedPurchaseClaim, type PurchaseClaimDocument, type PurchaseClaimTransactionStore } from "./purchase-firebase.js";
import { createAppleStoreProvider, createGooglePlayProvider, createPurchaseVerificationService, deriveAppleAppAccountToken, hashStoreReference,
  parseVerifyStorePurchaseRequest, validateStoreVerifierConfiguration, PurchaseInputError, PurchaseProviderError,
  type AppleLibraryBoundary, type PurchaseClaimInput } from "./purchase.js";

const NOW = Date.parse("2026-10-01T12:00:00.000Z");
const oldUid = "anonymousOldGuest";
const newUid = "anonymousRestoreGuest";
const reference = "2000001234567890";
const referenceHash = hashStoreReference(reference);
const baseClaim = { uid: newUid, provider: "apple", productId: "freed_premium_monthly", storeReferenceHash: referenceHash, verifiedAt: NOW, expiresAt: NOW + 60_000 } as PurchaseClaimInput;
const restoreClaim = { ...baseClaim, restore: true, restoreWitnessVerified: true, initialOwnershipVerified: true,
  restoreContext: { expectedOwnerUid: oldUid, ownerIsAnonymous: true, targetAuthenticated: true, targetIsAnonymous: true } } as PurchaseClaimInput;

function claimStore() {
  let persisted: PurchaseClaimDocument | undefined = { uid: oldUid, provider: "apple", productId: "freed_premium_monthly", storeReferenceHash: referenceHash, status: "verified" };
  const fences = new Map<string, "linking" | "permanent">();
  const deleting = new Set<string>();
  const writes: PurchaseClaimInput[] = [];
  const reads: string[] = [];
  const store = {
    readDeletionTombstone: async (uid: string) => { reads.push(`deletion:${uid}`); return deleting.has(uid); },
    readAccountFence: async (uid: string) => { reads.push(`fence:${uid}`); return fences.get(uid); },
    readClaim: async (hash: string) => persisted?.storeReferenceHash === hash ? persisted : undefined,
    writeClaimAndAudit: async (claim: PurchaseClaimInput) => { writes.push(claim); persisted = { uid: claim.uid, provider: claim.provider, productId: claim.productId, storeReferenceHash: claim.storeReferenceHash, ...(claim.storeAccountTokenHash ? { storeAccountTokenHash: claim.storeAccountTokenHash } : {}), status: "verified" }; }
  } as PurchaseClaimTransactionStore;
  return { store, fences, deleting, writes, reads, getPersisted: () => persisted };
}

test("verified store witness transfers only a still-anonymous unfenced owner atomically", async () => {
  const fixture = claimStore();
  assert.equal(await commitVerifiedPurchaseClaim(fixture.store, restoreClaim), "transferred");
  assert.equal(fixture.getPersisted()?.uid, newUid);
  assert.equal(fixture.reads.includes(`deletion:${oldUid}`), true);
  assert.equal(fixture.reads.includes(`deletion:${newUid}`), true);
  assert.equal(fixture.reads.includes(`fence:${oldUid}`), true);
  assert.equal(fixture.reads.includes(`fence:${newUid}`), true);
});

test("numeric Apple guesses, linked owner, linking fence, missing identity and deletion never transfer", async () => {
  for (const modification of ["no-witness", "linked", "fenced", "missing-target", "owner-deleting", "target-deleting"] as const) {
    const fixture = claimStore();
    const input = { ...restoreClaim } as any;
    if (modification === "no-witness") input.restoreWitnessVerified = false;
    if (modification === "linked") input.restoreContext = { ...input.restoreContext, ownerIsAnonymous: false };
    if (modification === "fenced") fixture.fences.set(oldUid, "linking");
    if (modification === "missing-target") input.restoreContext = { ...input.restoreContext, targetAuthenticated: false };
    if (modification === "owner-deleting") fixture.deleting.add(oldUid);
    if (modification === "target-deleting") fixture.deleting.add(newUid);
    assert.notEqual(await commitVerifiedPurchaseClaim(fixture.store, input), "transferred");
    assert.equal(fixture.writes.length, 0);
    assert.equal(fixture.getPersisted()?.uid, oldUid);
  }
});

test("two restore requests authorized against one anonymous owner cannot both win after ownership changes", async () => {
  const fixture = claimStore();
  let queue = Promise.resolve();
  const transaction = async (uid: string) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await commitVerifiedPurchaseClaim(fixture.store, { ...restoreClaim, uid }); }
    finally { release(); }
  };
  const results = await Promise.all([transaction(newUid), transaction("concurrentRestoreGuest")]);
  assert.deepEqual(results, ["transferred", "conflict"]);
  assert.equal(fixture.getPersisted()?.uid, newUid);
});

test("client cannot supply server ownership flags alongside a signed witness", () => {
  assert.throws(() => parseVerifyStorePurchaseRequest({ ...iosRequest(), restoreWitnessVerified: true }), PurchaseInputError);
  assert.throws(() => parseVerifyStorePurchaseRequest({ ...iosRequest(), ownerIsAnonymous: true }), PurchaseInputError);
  assert.throws(() => parseVerifyStorePurchaseRequest({ ...iosRequest(), signedTransactionInfo: "not-a-signed-jws" }), PurchaseInputError);
  assert.throws(() => parseVerifyStorePurchaseRequest({ ...iosRequest(), signedTransactionInfo: `${"a".repeat(65_536)}.b.c` }), PurchaseInputError);
});

const trusted = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const attacker = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
function jws(claims: Record<string, unknown>, key = trusted.privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const input = `${header}.${payload}`;
  return `${input}.${sign("sha256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
const transaction = { transactionId: reference, originalTransactionId: reference, productId: "freed_premium_monthly", bundleId: "app.freed.recovery", appAppleId: 1234567890,
  environment: "Production", type: "Auto-Renewable Subscription", inAppOwnershipType: "PURCHASED", purchaseDate: NOW - 1000, signedDate: NOW - 500, expiresDate: NOW + 60_000,
  appAccountToken: deriveAppleAppAccountToken(oldUid) };
function appleBoundary(): AppleLibraryBoundary {
  return {
    createClient: () => ({ getTransactionInfo: async () => ({ signedTransactionInfo: jws(transaction) }) }),
    createVerifier: () => ({ verifyAndDecodeTransaction: async signed => {
      const [header, payload, signature] = signed.split(".");
      if (!verify("sha256", Buffer.from(`${header}.${payload}`), { key: trusted.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature!, "base64url"))) throw new Error("Invalid signed store witness.");
      return JSON.parse(Buffer.from(payload!, "base64url").toString()) as Record<string, unknown>;
    } }), isNotFoundOrEnvironmentMismatch: () => false
  };
}
function appleConfig() { return { issuerId: "issuer-id-1234", keyId: "KEYID12345", privateKey: "-----BEGIN PRIVATE KEY-----\nconfiguration-fixture\n-----END PRIVATE KEY-----", appAppleId: "1234567890", rootCertificatesBase64: JSON.stringify([Buffer.from("fixture-root").toString("base64")]) }; }
function iosRequest() { return { platform: "ios", productId: "freed_premium_monthly", transactionId: reference, restore: true, clientEventId: "guest_restore_event_123" }; }

test("Apple SDK witness must be cryptographically valid and exactly match the authoritative API identity", async () => {
  const provider = createAppleStoreProvider(appleConfig(), appleBoundary(), () => NOW);
  const witness = jws(transaction);
  const verified = await provider.verify({ transactionId: reference, productId: "freed_premium_monthly", expectedAppAccountToken: deriveAppleAppAccountToken(newUid), restore: true, signedTransactionInfo: witness });
  assert.equal((verified as any).restoreWitnessVerified, true);
  assert.equal(verified.storeReference, reference);
  for (const invalid of [jws(transaction, attacker.privateKey), jws({ ...transaction, originalTransactionId: "2000009999999999" }), jws({ ...transaction, productId: "freed_premium_yearly" })]) {
    await assert.rejects(() => provider.verify({ transactionId: reference, productId: "freed_premium_monthly", expectedAppAccountToken: deriveAppleAppAccountToken(newUid), restore: true, signedTransactionInfo: invalid }), PurchaseProviderError);
  }
  const numericOnly = await provider.verify({ transactionId: reference, productId: "freed_premium_monthly", expectedAppAccountToken: deriveAppleAppAccountToken(newUid), restore: true });
  assert.equal(numericOnly.restoreWitnessVerified, false);
  assert.equal(numericOnly.initialOwnershipVerified, false);
});

test("signed guest restore service persists only hashes and server-derived proof, never raw JWS", async () => {
  const fixture = claimStore();
  const witness = jws(transaction);
  const service = createPurchaseVerificationService({ now: () => NOW, authorize: async () => "allowed",
    apple: createAppleStoreProvider(appleConfig(), appleBoundary(), () => NOW), google: { verify: async () => { throw new Error("Not a Google request"); } },
    claimVerifiedPurchase: async input => commitVerifiedPurchaseClaim(fixture.store, { ...input, restoreContext: (restoreClaim as any).restoreContext }) });
  const result = await service.verify(newUid, { ...iosRequest(), signedTransactionInfo: witness });
  assert.equal(result.active, true);
  assert.equal(fixture.getPersisted()?.uid, newUid);
  assert.equal(JSON.stringify(fixture.writes).includes(witness), false);
  assert.equal(JSON.stringify(fixture.writes).includes(reference), false);
});

test("Google secret-token restore remains authoritative and cancellation preserves the paid expiry", async () => {
  const token = "secret-google-owned-token-123456789";
  const oldToken = "secret-previous-google-token-123456";
  const provider = createGooglePlayProvider(JSON.stringify({ type: "service_account", client_email: "purchases@freed-project.iam.gserviceaccount.com", client_id: "1234567890", private_key_id: "fixture-key-id", private_key: "-----BEGIN PRIVATE KEY-----\nfixture-key\n-----END PRIVATE KEY-----", project_id: "freed-project" }), {
    getAuthorizationHeaders: async () => ({ authorization: "Bearer fixture-authorization-value" }),
    fetch: async () => new Response(JSON.stringify({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED", acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED", linkedPurchaseToken: oldToken,
      lineItems: [{ productId: "freed_premium_monthly", expiryTime: new Date(NOW + 60_000).toISOString() }] }), { status: 200, headers: { "content-type": "application/json" } })
  }, () => NOW);
  const result = await provider.verify({ productId: "freed_premium_monthly", purchaseToken: token });
  assert.equal(result.expiresAt, NOW + 60_000);
  assert.equal((result as any).restoreWitnessVerified, true);
  assert.equal((result as any).linkedStoreReference, oldToken);
});

test("keyless or unusable verifier configuration cannot authorize checkout readiness", () => {
  assert.throws(() => validateStoreVerifierConfiguration(appleConfig(), ""), PurchaseProviderError);
  assert.throws(() => validateStoreVerifierConfiguration({ ...appleConfig(), issuerId: "", keyId: "", privateKey: "" }, "{}"), PurchaseProviderError);
});


test("permanent restore targets accept guests only after a signed-in session; source fences never reopen", async () => {
  const target = claimStore();
  target.fences.set(newUid, "permanent");
  assert.equal(await commitVerifiedPurchaseClaim(target.store, {
    ...restoreClaim, restoreContext: { ...restoreClaim.restoreContext!, targetIsAnonymous: false }
  }), "transferred");
  for (const [ownerFence, targetFence, anonymous] of [
    ["permanent", undefined, false], [undefined, "linking", false], [undefined, "permanent", true]
  ] as const) {
    const fixture = claimStore();
    if (ownerFence) fixture.fences.set(oldUid, ownerFence);
    if (targetFence) fixture.fences.set(newUid, targetFence);
    assert.equal(await commitVerifiedPurchaseClaim(fixture.store, {
      ...restoreClaim, restoreContext: { ...restoreClaim.restoreContext!, targetIsAnonymous: anonymous }
    }), "conflict");
    assert.equal(fixture.writes.length, 0);
  }
});

test("same-UID owned purchases remain usable behind either account fence without a restore witness", async () => {
  for (const fence of ["linking", "permanent"] as const) {
    const fixture = claimStore();
    fixture.fences.set(oldUid, fence);
    assert.equal(await commitVerifiedPurchaseClaim(fixture.store, { ...baseClaim, uid: oldUid }), "owned");
  }
});

test("unclaimed Apple numeric IDs need checkout account binding or a signed device witness", async () => {
  let writes = 0;
  const store: PurchaseClaimTransactionStore = {
    readDeletionTombstone: async () => false, readAccountFence: async () => undefined,
    readClaim: async () => undefined, writeClaimAndAudit: async () => { writes++; }
  };
  assert.equal(await commitVerifiedPurchaseClaim(store, { ...baseClaim, initialOwnershipVerified: false, restore: true, restoreWitnessVerified: false }), "conflict");
  assert.equal(writes, 0);
  assert.equal(await commitVerifiedPurchaseClaim(store, { ...baseClaim, initialOwnershipVerified: true }), "claimed");
});

test("request bounds accept a signed 64KiB Apple witness while Android stays below 16KiB", () => {
  const request = { ...iosRequest(), signedTransactionInfo: `${"a".repeat(63_000)}.b.c` };
  assert.deepEqual(parseVerifyStorePurchaseRequest(request), request);
  assert.throws(() => parseVerifyStorePurchaseRequest({ platform: "android", productId: "freed_premium_monthly", purchaseToken: "a".repeat(17_000), restore: true, clientEventId: "restore_event_123" }), PurchaseInputError);
});

test("Apple witness mismatch cannot replace a revoked or expired authoritative store transaction", async () => {
  for (const invalid of [{ ...transaction, revocationDate: NOW - 100 }, { ...transaction, expiresDate: NOW - 100 }]) {
    const boundary = appleBoundary();
    boundary.createClient = () => ({ getTransactionInfo: async () => ({ signedTransactionInfo: jws(invalid) }) });
    const provider = createAppleStoreProvider(appleConfig(), boundary, () => NOW);
    await assert.rejects(() => provider.verify({ transactionId: reference, productId: "freed_premium_monthly", expectedAppAccountToken: deriveAppleAppAccountToken(newUid), restore: true, signedTransactionInfo: jws(transaction) }), PurchaseProviderError);
  }
});

test("transferred Apple lineage restores only to its existing UID without a device witness", async () => {
  const fixture = claimStore();
  await fixture.store.writeClaimAndAudit({ ...baseClaim, storeAccountTokenHash: hashStoreReference(deriveAppleAppAccountToken(oldUid)) } as PurchaseClaimInput);
  const service = createPurchaseVerificationService({
    now: () => NOW, authorize: async () => "allowed",
    apple: createAppleStoreProvider(appleConfig(), appleBoundary(), () => NOW), google: { verify: async () => { throw new Error(); } },
    claimVerifiedPurchase: input => commitVerifiedPurchaseClaim(fixture.store, input)
  });
  assert.equal((await service.verify(newUid, iosRequest())).active, true);
  assert.equal((await service.verify("otherUid", iosRequest())).active, false);
  assert.equal((fixture.writes[1] as any).storeAccountTokenHash, hashStoreReference(deriveAppleAppAccountToken(oldUid)));
});

test("signed Apple plan change retains transferred same-UID ownership and original account binding", async () => {
  const fixture = claimStore();
  const oldTokenHash = hashStoreReference(deriveAppleAppAccountToken(oldUid));
  await fixture.store.writeClaimAndAudit({ ...baseClaim, storeAccountTokenHash: oldTokenHash });
  const yearly = { ...transaction, productId: "freed_premium_yearly", transactionId: "2000001234567891" };
  const boundary = appleBoundary();
  boundary.createClient = () => ({ getTransactionInfo: async () => ({ signedTransactionInfo: jws(yearly) }) });
  const service = createPurchaseVerificationService({ now: () => NOW, authorize: async () => "allowed",
    apple: createAppleStoreProvider(appleConfig(), boundary, () => NOW), google: { verify: async () => { throw new Error(); } },
    claimVerifiedPurchase: input => commitVerifiedPurchaseClaim(fixture.store, input) });
  const payload = { ...iosRequest(), productId: "freed_premium_yearly", transactionId: yearly.transactionId, restore: false, signedTransactionInfo: jws(yearly) };
  assert.equal((await service.verify(newUid, payload)).active, true);
  assert.equal(fixture.getPersisted()?.productId, "freed_premium_yearly");
  assert.equal(fixture.getPersisted()?.storeAccountTokenHash, oldTokenHash);
  assert.equal((await service.verify("otherUid", payload)).active, false);
});

test("a signed new Apple transaction bound to another UID cannot create an unclaimed lineage", async () => {
  let writes = 0;
  const store: PurchaseClaimTransactionStore = {
    readDeletionTombstone: async () => false, readAccountFence: async () => undefined,
    readClaim: async () => undefined, writeClaimAndAudit: async () => { writes++; }
  };
  assert.equal(await commitVerifiedPurchaseClaim(store, { ...baseClaim, initialOwnershipVerified: false, restoreWitnessVerified: true, restore: false }), "conflict");
  assert.equal(writes, 0);
});

test("Apple account UUID case cannot turn a caller-bound first purchase into a foreign lineage", async () => {
  const uppercase = { ...transaction, appAccountToken: deriveAppleAppAccountToken(newUid).toUpperCase() };
  const boundary = appleBoundary();
  boundary.createClient = () => ({ getTransactionInfo: async () => ({ signedTransactionInfo: jws(uppercase) }) });
  const provider = createAppleStoreProvider(appleConfig(), boundary, () => NOW);
  const verified = await provider.verify({ transactionId: reference, productId: "freed_premium_monthly", expectedAppAccountToken: deriveAppleAppAccountToken(newUid), signedTransactionInfo: jws(uppercase), restore: false });
  assert.equal(verified.initialOwnershipVerified, true);
  assert.equal(verified.storeAccountTokenHash, hashStoreReference(deriveAppleAppAccountToken(newUid)));
});
