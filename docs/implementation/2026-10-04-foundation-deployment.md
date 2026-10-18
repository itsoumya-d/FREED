# FREED foundation deployment — 4 October 2026

All 16 foundation functions and the Apple production/sandbox notification endpoints are deployed and ACTIVE in `freed-7d5ee`, `asia-south1`, codebase `freed`, Node.js 22. Downloaded source archives for all 18 functions match their recorded compiled files, package, lockfile, and SDK-derived deployment manifest. The two feed functions use revision 2; the other 16 remain on revision 1. No functions were deleted.

Evidence: [deployment receipt](artifacts/2026-10-04-foundation-deployment/deployment-receipt.json), [versioned live source bindings](artifacts/2026-10-04-foundation-deployment/all-live-source-bindings-final.json).

## Corrections verified before deployment

- `functions/src/foundation.ts` normalizes expiry to Firestore `Timestamp` on transaction writes and milliseconds on transaction reads. Its real callable/adapter regression tests reproduced numeric TTL fields and incorrect duplicate handling before the fix; all three focused tests pass, including legacy numeric expiry, the exact expiry boundary, rate limiting, and deletion fences.
- `functions/src/adult-feed.ts` omits only exact ABP rules recognized as ICANN or private public suffixes at the approved-source parsing boundary. `canonicalDomain` remains strict for all other consumers. Malformed rules, exceptions, wildcards, unknown suffixes, protected normal sites, empty feeds, authority, size, timeout, and ordered-header gates remain enforced. The focused red run failed 2 of 18 tests; the green run passed all 18.
- The final compile-then-test run under Node 22 with isolated Auth, Firestore, and Storage emulators passed **216/216, zero skips**. Shared UI, native source, and builds were not modified.

[Full final test log](artifacts/2026-10-04-foundation-deployment/backend-node22-feed-final-emulator-tests.log), [revision 1 manifest](artifacts/2026-10-04-foundation-deployment/source-manifest-v1-foundation.json), [revision 2 manifest](artifacts/2026-10-04-foundation-deployment/source-manifest.json).

## Live infrastructure and boundaries

| Item | Verified state |
| --- | --- |
| Client callables | Twelve retain Firebase Auth plus App Check. Missing/invalid App Check probes return JSON HTTP 401. |
| Scheduled functions | Four enabled jobs use compute-account OIDC and private service invocation. Unsigned HTTP probes return 403. |
| Apple webhooks | Both are public HTTP transports with signature verification. Wrong method/content type/signature probes return fixed 405/415/400 replies. |
| Client data rules | Firestore and Storage deny-all rules read back with the exact verified source hashes. |
| Retention configuration | Ten configured Firestore TTL fields ACTIVE; three composite indexes READY. Configuration readback does not prove actual timed deletion. |
| Backup Storage | New default bucket `freed-7d5ee.firebasestorage.app` in `ASIA-SOUTH1`; it was empty before policy setup. Recovery-backups prefix lifecycle expiry is 400 days, and default soft-delete retention is disabled. Actual backup mutation/signing/deletion scenarios require authenticated-device proof. |
| App Attest | FREED iOS app, existing Apple team `R5RX8WP8ZC`, configured/read back with 3600-second token TTL. |
| Runtime/build access | Default compute account has default-database-conditioned Datastore access, a narrow Auth read/delete and FCM-send custom role, App Check token verification, backup-bucket object access, self-only `signBlob`, source-bucket read access, artifact-repository write access, and logs write access. Apple secret access is scoped to the five existing secrets. No Editor or project-wide Storage/Admin grants were added. |
| Build artifacts | New Functions artifact repository has seven-day image cleanup. |

All **37 initial live rejection probes** passed, followed by two checks after the feed revision. The first failed readiness create left its Cloud Run invocation policy unset; service-scoped public callable transport was restored, and Auth/App Check rejection was verified afterward. [HTTP evidence](artifacts/2026-10-04-foundation-deployment/live-negative-http-checks.json), [post-feed checks](artifacts/2026-10-04-foundation-deployment/feed-v2-http-boundary-checks.json).

Firebase App Attest uses the registered Apple team and a configurable TTL. TestFlight/App Store distribution always uses production App Attest regardless of the explicit entitlement setting; development builds have a different configuration requirement. No entitlement/profile changes were made here. [Firebase registration documentation](https://firebase.google.com/docs/reference/appcheck/rest/v1/projects.apps.appAttestConfig), [Apple distribution behavior](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.devicecheck.appattest-environment).

## Public feed publication and coverage

The corrected deployed refresh successfully published `oisd-nsfw-small-765c579402614895` at **2026-10-04 10:14:22 UTC**. Live Firestore metadata, the 337,775-byte Storage object, and the exact deployed core retrieval implementation agree on **20,376 canonical domains** and payload SHA-256 `765c579402614895acf4c1eb69023f0e58d1ee6cdb80d43b87082d1631975468`. Freshness, count, checksum, and source authority validation passed against the real public data.

Eight unsupported suffix-wide upstream ABP rules were deliberately omitted: `||adult^`, `||porn^`, `||sex^`, `||xxx^` (ICANN TLDs), and `||co.cz^`, `||cpanel.site^`, `||in.net^`, `||mex.com^` (private public suffixes). They are never admitted as blocked hostnames. This is supported hostname coverage rather than every upstream ABP rule. Existing bundled/public baseline protection remains a separate source of protection.

[Current-source diagnostics](artifacts/2026-10-04-foundation-deployment/public-feed-rejection-categories.json), [live data integrity](artifacts/2026-10-04-foundation-deployment/public-feed-live-data-integrity.json), [actual-data core retrieval proof](artifacts/2026-10-04-foundation-deployment/public-feed-core-retrieval-proof.json). The positive retrieval proof uses authenticated administrative reads of public metadata/object data and the deployed core reader; a signed-device Auth/App Check client call is still unverified.

## Apple notification evidence

- Production: `https://asia-south1-freed-7d5ee.cloudfunctions.net/appleSubscriptionNotifications`
- Sandbox: `https://asia-south1-freed-7d5ee.cloudfunctions.net/appleSubscriptionNotificationsSandbox`

Root independently configured and read back both destinations as V2 for app `6816637268`, bundle `app.freed.recovery`, before TEST requests. The Sandbox request was accepted; Apple's status reported **SUCCESS at 2026-10-04 09:59:01.773 UTC**, with matching Cloud Run **HTTP 200 at 09:59:02.250708 UTC**. The actual decoder authenticated the signed TEST payload and returned `null`, taking the no-purchase-mutation path.

Production TEST requests returned **HTTP 401 twice** with the existing approved key. This is an unresolved production authorization result; its cause is not inferred. [Apple documents 401 as invalid request authorization](https://developer.apple.com/documentation/appstoreserverapi/request-a-test-notification). The successful Sandbox TEST proves signed server notification delivery, not purchase ownership or renewal/refund/revocation behavior.

[Sanitized Apple API/delivery receipt](artifacts/2026-10-04-foundation-deployment/apple-test-delivery.json), [HTTP delivery correlation](artifacts/2026-10-04-foundation-deployment/apple-test-http-delivery-logs.json). Private key/JWT/test-token/signed-payload values are absent from the repository and receipts. Opaque TEST tokens remain only in a mode-0600 temporary file outside the repository.

## Remaining gates

`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and `OPENAI_API_KEY` are absent; Google Play access/key approval remains pending. Purchase/checkout/verification, AI, and Google subscription notification endpoints were not deployed, and their missing-provider gates were not removed. The current combined checkout contract also keeps new Apple checkout dependent on the required verifier configuration. DeviceCheck fallback lacks its separate Apple key/configuration; no replacement key was generated.

Signed-device App Check and authenticated client mutation/retrieval, encrypted-backup signing and ownership/deletion, push delivery, and actual store purchase/renewal/refund/revocation scenarios still need their own evidence. These deployments and tests do not establish complete app or TestFlight readiness. Native archive, distribution, Family Controls, and TestFlight evidence remain root-owned work.
