# Apple platform purchase deployment — 2026-10-05

Deployed only `getApplePurchaseCheckoutContext` and `verifyAppleStorePurchase` to `freed-7d5ee`, `asia-south1`, Node.js 22, codebase `freed`. Both are ACTIVE. They bind only the five existing Apple verification secrets; no Google credential or new billing key was created. Current iOS checkout and verification callers use these endpoints. Android keeps the existing separately gated verifier.

Connected password, Google and Apple accounts are required for the new endpoints. UID-derived checkout tokens and the shared ownership, restore, deletion, idempotency and entitlement checks are preserved. App Check remains enforced; verification consumes limited-use tokens. Independent source review found no Important/Critical defect. Three readiness/wrapper tests plus client routing/contracts and backend compilation passed.

| Function | State | Revision |
|---|---|---|
| getApplePurchaseCheckoutContext | ACTIVE | getapplepurchasecheckoutcontext-00001-cox |
| verifyAppleStorePurchase | ACTIVE | verifyapplestorepurchase-00001-kuy |

Live unauthenticated empty-data probes returned HTTP 401 UNAUTHENTICATED from both endpoints. This confirms the live rejection boundary, not positive App Check or store checkout. Valid Apple secret structure is distinct from Apple API authorization: prior production TEST authorization returned 401 and remains an explicit release gate. Signed-device sandbox purchases, restore, renewal, cancellation, grace, expiry, revocation and ownership still require evidence.

The isolated package contains seven compiled dependencies plus a two-export entrypoint, SDK-derived manifest and lockfile. No environment or private-key files were staged. The source manifest and deployment/live readbacks are kept with the task ledger. Uploaded archive hash comparison remains pending.


Sandbox routing correction: current signed StoreKit witness is bounded-parsed only for an exact Sandbox environment hint. That hint selects the Sandbox transport; it never grants ownership or access. The unchanged provider still fetches Apple’s authoritative transaction, SDK-verifies API and device signatures, compares identity and enforces product/bundle/account/expiry/revocation plus durable claim ownership. Requests without a Sandbox hint retain Production-first routing and never treat unauthorized errors as fallback reasons. One deadline covers all work. Meaningful RED showed a valid Sandbox witness stopped at hypothetical Production401; green direct Sandbox verifies both signatures. Invalid/forged signatures, identities, expiry/revocation and foreign-owner claim tests remain denied. Independent review found no Important/Critical defect; full backend248passed/10emulator-skips. Narrow verifier redeployment is underway. Actual signed sandbox purchase and Production authorization remain unproven.
