import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getFirestore } from "firebase-admin/firestore";
import { getPurchaseCheckoutContext, PURCHASE_SECRET_NAMES } from "./purchase-firebase.js";
import { PurchaseProviderError, validateStoreVerifierConfiguration } from "./purchase.js";

const appleKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const googleKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const appleConfig = {
  issuerId: "dc3488ba-d22b-4c80-bd5c-bc07163431ef", keyId: "KEYID12345", privateKey: appleKey,
  appAppleId: "1234567890", rootCertificatesBase64: JSON.stringify([readFileSync("src/test-fixtures/apple-root-ca-g3.cer").toString("base64")])
};
const googleConfig = { type: "service_account", project_id: "freed-project", private_key_id: "a".repeat(40),
  private_key: googleKey, client_email: "purchases@freed-project.iam.gserviceaccount.com", client_id: "123456789012345678901" };

test("checkout readiness parses real signing keys and trusted certificates before giving store identity", () => {
  assert.doesNotThrow(() => validateStoreVerifierConfiguration(appleConfig, JSON.stringify(googleConfig)));
  for (const invalid of [
    { ...appleConfig, issuerId: "non-uuid-issuer" },
    { ...appleConfig, privateKey: "-----BEGIN PRIVATE KEY-----\ninvalid\n-----END PRIVATE KEY-----" },
    { ...appleConfig, privateKey: googleKey },
    { ...appleConfig, rootCertificatesBase64: JSON.stringify([Buffer.from("fake-certificate").toString("base64")]) }
  ]) assert.throws(() => validateStoreVerifierConfiguration(invalid, JSON.stringify(googleConfig)), PurchaseProviderError);
  assert.throws(() => validateStoreVerifierConfiguration(appleConfig, JSON.stringify({ ...googleConfig, private_key: appleKey })), PurchaseProviderError);
});

test("checkout callable refuses missing verifier config and binds every purchase secret", async () => {
  const db = getFirestore();
  const collection = db.collection;
  const environment = Object.fromEntries(PURCHASE_SECRET_NAMES.map(name => [name, process.env[name]]));
  db.collection = (() => ({ doc: () => ({ get: async () => ({ exists: false }) }) })) as unknown as typeof db.collection;
  const values = [appleConfig.issuerId, appleConfig.keyId, appleConfig.privateKey, appleConfig.appAppleId, appleConfig.rootCertificatesBase64, JSON.stringify(googleConfig)];
  const request = { data: undefined, auth: { uid: "guestUid123", token: { firebase: { sign_in_provider: "anonymous" } } } };
  try {
    PURCHASE_SECRET_NAMES.forEach((name, index) => { process.env[name] = values[index]; });
    const context = await (getPurchaseCheckoutContext as any).run(request);
    assert.match(context.appAccountToken, /^[0-9a-f-]{36}$/);
    assert.match(context.obfuscatedAccountId, /^[0-9a-f]{64}$/);
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = "{}";
    await assert.rejects(() => (getPurchaseCheckoutContext as any).run(request), (error: any) => error.code === "unavailable");
    const bound = (getPurchaseCheckoutContext as any).__endpoint.secretEnvironmentVariables.map((entry: { key: string }) => entry.key);
    assert.deepEqual(bound, [...PURCHASE_SECRET_NAMES]);
  } finally {
    db.collection = collection;
    for (const name of PURCHASE_SECRET_NAMES) {
      if (environment[name] === undefined) delete process.env[name];
      else process.env[name] = environment[name];
    }
  }
});
