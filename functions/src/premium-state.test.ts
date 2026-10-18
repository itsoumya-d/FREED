import assert from "node:assert/strict";
import test from "node:test";
import { createGooglePlayProvider } from "./purchase.js";
import { premiumEntitlementFromClaims } from "./premium-state.js";

const NOW = Date.parse("2026-10-01T10:00:00Z");
const timestamp = (millis:number) => ({toMillis:()=>millis});

test("server entitlement requires same-owner verified unexpired claim and exposes no raw store reference",()=>{
  const entitlement = premiumEntitlementFromClaims("owner",[{
    uid:"owner",provider:"google-play",productId:"freed_premium_monthly",status:"verified",verifiedAt:timestamp(NOW),entitlementExpiresAt:timestamp(NOW+3600000),storeReferenceHash:"a".repeat(64)
  }],NOW);
  assert.equal(entitlement?.productId,"freed_premium_monthly");
  assert.equal(entitlement?.expiresAt,"2026-10-01T11:00:00.000Z");
  assert.equal(Object.keys(entitlement!).includes("storeReferenceHash"),false);
  assert.equal(premiumEntitlementFromClaims("other",[{uid:"owner",provider:"apple",productId:"freed_premium_yearly",status:"verified",verifiedAt:timestamp(NOW),entitlementExpiresAt:timestamp(NOW+3600000)}],NOW),null);
  for(const status of ["inactive","revoked"]){
    assert.equal(premiumEntitlementFromClaims("owner",[{uid:"owner",provider:"apple",productId:"freed_premium_yearly",status,verifiedAt:timestamp(NOW),entitlementExpiresAt:timestamp(NOW+3600000)}],NOW),null);
  }
});

test("Play cancellation retains paid access until the exact paid expiry",async()=>{
  const provider=createGooglePlayProvider(JSON.stringify({type:"service_account",project_id:"project-safe",private_key_id:"key-safe",private_key:"-----BEGIN PRIVATE KEY-----\ntest-only\n-----END PRIVATE KEY-----",client_email:"play@project-safe.iam.gserviceaccount.com",client_id:"client-safe"}),{
    getAuthorizationHeaders:async()=>({authorization:"Bearer test-only-access"}),
    fetch:async()=>Response.json({subscriptionState:"SUBSCRIPTION_STATE_CANCELED",acknowledgementState:"ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",lineItems:[{productId:"freed_premium_monthly",expiryTime:"2026-10-01T11:00:00.000Z"}]}),
  },()=>NOW);
  const result=await provider.verify({productId:"freed_premium_monthly",purchaseToken:"test-purchase-token-123456789"});
  assert.equal(result.expiresAt,NOW+3600000);
});

test("authenticated current claim projection refreshes bounded offline proof without changing signed access expiry", () => {
  const checkedAt = NOW + 36 * 3600000;
  const signedGraceExpiry = NOW + 72 * 3600000;
  const oldActive = { uid: "owner", provider: "apple", productId: "freed_premium_monthly", status: "verified", verifiedAt: timestamp(NOW), entitlementExpiresAt: timestamp(signedGraceExpiry) };
  const fresh = premiumEntitlementFromClaims("owner", [oldActive], checkedAt);
  assert.equal(fresh?.verifiedAt, new Date(checkedAt).toISOString(), "A successful authenticated server refresh is a new offline-proof issuance.");
  assert.equal(fresh?.expiresAt, new Date(signedGraceExpiry).toISOString(), "Refreshing proof must not extend the provider-authenticated access deadline.");
  const latest = premiumEntitlementFromClaims("owner", [oldActive, { ...oldActive, productId: "freed_premium_yearly", verifiedAt: timestamp(NOW + 3600000) }], checkedAt);
  assert.equal(latest?.productId, "freed_premium_yearly", "Original claim verification ordering still selects the newest plan.");
  assert.equal(premiumEntitlementFromClaims("owner", [oldActive], signedGraceExpiry), null, "A current server response cannot reissue expired grace.");
});
