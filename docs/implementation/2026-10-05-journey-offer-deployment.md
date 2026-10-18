# Journey offer metadata deployment — 2026-10-05

Deployed only `getJourneyOfferState` and `acknowledgeJourneyOffer` to Firebase project `freed-7d5ee`, region `asia-south1`, codebase `freed`, Node.js 22. The independently reviewed prepared source SHA-256 is `40a415b0eec8ea0f336a3edacbdae29bdc4ca880fbf8fb52ba285702895daece`. Both functions are ACTIVE. Deployment completed at 2026-10-05 05:05 IST (2026-10-04 23:35 UTC).

## Scope and authority

This seam records whether a connected account has acknowledged version 1 of the journey offer. Getter input has no payload and the response is exactly `{offerVersion:1, acknowledged:boolean}`. Acknowledgement accepts only `{offerVersion:1, decision:'free'|'purchased', eventId}`, where the ID matches `^journey_[a-f0-9]{32}$`. Unknown fields, caller-supplied UID/owner, private answers, unsupported versions and malformed IDs are rejected.

Both callables enforce App Check and derive the owner exclusively from verified Firebase Auth. The connected provider allowlist is password, google.com and apple.com; anonymous/custom/missing/unknown providers are rejected. Existing anonymous foundation/Auth behavior remains unchanged. Free local continuation remains independent of successful acknowledgement synchronization.

The permanent marker is `backend_jobs/<verifiedUid>_journey-offer-v1`, with only `uid`, `kind:'journey-offer-v1'`, `status:'free'|'purchased'` and `createdAt`. It has no expiry, event ID, entitlement, unlock, purchase authority, or recovery/health answers. The first acknowledgement determines immutable status/time. The `purchased` label does not verify billing or grant access.

Getter and acknowledgement each use their existing UID-specific 10-per-minute rate counter. Existing-marker acknowledgement retries consume the acknowledgement counter, first writes consume it once, over-limit requests preserve the marker, and the next window accepts retries. Both endpoints honor the account-deletion fence. Existing deployed UID deletion cleanup selects the marker through `backend_jobs`; real emulator cleanup removed only the deleted UID marker. Existing notification dispatch performed zero actions for this kind, and the expiry sweep left a marker without `expiresAt` intact.

## Deployment evidence

The temporary deployment package advertised exactly these two entry points through a static SDK-derived manifest. It contained five compiled JavaScript files, package metadata, lockfile and manifest. It contained zero secret parameters. No old functions were redeployed or deleted; an exact readback of all 18 pre-existing Cloud Functions records was unchanged, leaving 20 ACTIVE functions total.

| Function | State | Active revision | Actual deployed source ZIP SHA-256 |
| --- | --- | --- | --- |
| getJourneyOfferState | ACTIVE | getjourneyofferstate-00001-wis | 31e3b70c4edf3444daba092feee62ca5af3bbfc7a431a68a6e5bf833481a55d6 |
| acknowledgeJourneyOffer | ACTIVE | acknowledgejourneyoffer-00001-tac | 31e3b70c4edf3444daba092feee62ca5af3bbfc7a431a68a6e5bf833481a55d6 |

For each active function, its resolved uploaded source archive was fetched through an authenticated read-only API call. All five compiled JavaScript hashes plus package.json, package-lock.json and functions.yaml matched the reviewed package. The archive advertised exactly two callables, zero parameters, no private key or environment files. Live metadata confirms Node.js 22, asia-south1, codebase freed, maxInstances 5 and zero secret environment variables. Auth/connected-provider and `enforceAppCheck:true` are evidenced by the matching uploaded adapter, rather than a fabricated platform App Check field.

The Firebase CLI created the standard public callable transport. Read-only Cloud Run IAM readback contains only `roles/run.invoker` for `allUsers` on each new service; handler Auth/App Check remains enforced. No manual IAM mutation, new project-level grant, new secret, AI callback, AI key or AI rollout was performed. Existing secret values were not accessed for this deployment.

## Verification and limits

All compilation and affected backend tests ran in the isolated temporary copy. Meaningful initial red fixtures failed 8/8 before the seam; connected-read refinement failed 2/9; retry-rate refinement failed 2/10. Final focused tests passed 11/11. Final affected Auth/Firestore/Storage emulator tests passed 59/59, with zero failures or skips. They covered strict shape/provider/owner failures, rate windows, concurrent first acknowledgements, immutable retries, deletion/cooldown, non-actionable job dispatch and non-expiring marker retention. No broad shared-checkout gates were run for this task. An earlier broad core run had used shared source; it was reported separately and was no longer running before this task.

Six live POST probes used only empty or synthetic metadata envelopes without Auth/App Check. Each callable returned HTTP 401 UNAUTHENTICATED for its otherwise-valid envelope, HTTP 400 INVALID_ARGUMENT for a missing data envelope, and HTTP 400 for malformed JSON. These prove live rejection boundaries. They do not prove an authenticated strict-parser success or successful attestation. No real account, private recovery content or purchase ownership event was created by these probes.

Successful calls from a connected account in the signed app, positive device App Check, and the cross-device once-per-account UI scenario remain pending. Deployment and metadata acknowledgement do not prove purchase/renewal lifecycle, billing authority, or future optional cloud AI readiness. Cloud AI remains disabled; base backend readiness is insufficient to enable sensitive content requests. Future cloud AI requires explicit owner consent and per-feature service readiness.

## Frozen source hashes

| File | SHA-256 |
| --- | --- |
| functions/src/contracts.ts | 0ebbfb3c5cd504571d7f4aab2e8f4d212cbdf41d186be9243eb120545d2cd399 |
| functions/src/foundation.ts | 56db26bc03f0fce80d6e8948b1245ee0858aef1180e0ac8c2f890e90f9d43e91 |
| functions/src/foundation.test.ts | 97a4bb796feffd81803504357f3f99c8134872b3bfb9551365fc50d449cc4467 |
| functions/src/journey-offer.ts | 2283acc9e754a57d93b59b691a145086c95eea028154e68e80ab784460c36c03 |
| functions/src/journey-offer-firebase.ts | 187b1fb9627139bed31d65e4a38eef7be50d200f384c9295a244b30066f76bd6 |
| functions/src/journey-offer.test.ts | 180a32f6bd7e546bd042c13a660095dbdff0b0d73b48af75dc809c1be88a5a0f |
| functions/src/journey-offer-emulator.test.ts | 803d7702ff9ce50b4eb00fd446fabb5ca0452724bc0ef41e3f72d3ae3240d7bc |

Only the bounded journey seam and its contract/export/tests were edited in application backend source. `core-data.ts`, `index.ts` and the four frozen client privacy modules retained their task-baseline hashes. Shared UI/native source was not changed. No commits were created.

Sanitized receipts, source/config hashes, complete selected test output and deployment output are in [the deployment artifact directory](artifacts/2026-10-05-journey-offer-deployment/live-verification.json). Private tokens and credentials remain outside the repository; the durable evidence contains no secret values.
