# Review access read-contract deployment — 2026-10-05

Deployed only `getReviewAccess` to `freed-7d5ee`, `asia-south1`, codebase `freed`, Node.js 22. It is ACTIVE at revision `getreviewaccess-00001-yum`, updated `2026-10-05T00:33:14.731119465Z`. All 20 pre-existing Cloud Functions records are exactly unchanged; the project has 21 ACTIVE functions. No review account, review metadata grant, credential or license was provisioned, and no credential sharing occurred.

## Contract and authority

The connected authenticated caller sends no payload (`undefined` or `null`). Exact response: `{reviewAccessVersion:1, ownerUid:verifiedUID, access:'none'|'review', expiresAt:null|canonicalISO, capabilities:[]|['ad-free','premium-features']}`. Auth and App Check are required. Password, google.com and apple.com are the connected provider allowlist; anonymous/custom/missing/unknown providers are rejected. Any client payload, including owner, version, expiry, capabilities or private answers, is rejected before database access.

Separate review capability comes only from `backend_jobs/<verifiedUid>_review-access-v1` with exactly `uid`, `kind:'review-access-v1'`, `status:'active'|'revoked'`, `createdAt` and `expiresAt`. The adapter requires durable Firestore timestamps. Active owned records must have creation at or before current server time, future expiry, and total lifetime at most 14 days. Missing, revoked, expired, malformed, future-created or wrong-owner records return `none`, null expiry and empty capabilities. Capabilities are derived from the fixed validated kind/status and cannot be supplied by a caller or record field. No renewal/write endpoint exists. Reads cannot extend a deadline.

This metadata grants no paid product, receipt validation, purchase/custom claim or native billing authority. It contains no private recovery content. Getter reads the deletion fence and record transactionally, then consumes its UID-specific 10-per-minute rate counter. Deleting/cooldown accounts are fenced before any rate write. Only that rate control may be written by the getter.

The existing dispatcher performed zero notification actions for this backend_jobs kind. The existing expiry sweep removed expired review metadata, and existing deployed UID deletion selection removed the owned review marker while preserving another owner's marker. These were real emulator adapter/workflow tests, rather than a claim that production asynchronous TTL deletion was observed. No new collection, index, secret, project-level IAM grant or AI rollout was required.

## Source and live deployment evidence

Reviewed prepared source SHA-256: `7642e5e45d0377d1060f3b6556faec84cbd1befdb22b9dbe08a08503f1615062` (SHA-256 of the sorted compact JSON file-hash map). Actual active deployed source ZIP SHA-256: `8c506af649ba5c7774952d24a8541e71ff15ee4f0297d5eb9bec00d207818ddf`.

The resolved deployed archive was fetched through a read-only authenticated API and all eight package members matched: five compiled JavaScript files, package.json, package-lock.json and SDK-derived functions.yaml. The archive advertises only `getReviewAccess`, with zero parameters, no environment/private-key files. Live metadata confirms region/codebase/runtime, maxInstances 5 and zero secret environment variables. The matching uploaded adapter proves connected Auth and `enforceAppCheck:true`; App Check is not misrepresented as a separate Cloud Functions metadata flag.

The Firebase CLI created standard public callable transport. Read-only service IAM contains only allUsers/roles/run.invoker. Auth/App Check remains enforced inside the callable. No manual IAM mutation or secret access was performed for the new endpoint.

Three live POST probes passed: a valid unauthenticated null envelope returned HTTP 401 UNAUTHENTICATED, missing data envelope returned HTTP 400 INVALID_ARGUMENT, and malformed JSON returned HTTP 400. No real account or personal data was involved. Authenticated production success, positive signed-device App Check, reviewer sign-in and UI capability behavior remain pending. The deployed getter alone does not prove those scenarios.

## Isolated tests and admin revocation correction

The initial missing-callable red suite failed 10/10 meaningfully. Final focused/export tests passed 11/11; affected Auth/Firestore/Storage emulator tests passed 72/72; full backend `npm test` in the isolated Node.js 22 copy passed 240/240. There were zero final failures or skips. One earlier affected harness run passed 69/72 but failed three existing core-data source-read tests with ENOENT because its cwd was the temporary project root. Correcting cwd to the isolated functions directory resolved them without application source changes. No broad shared-checkout gate ran for this task.

A separate private admin script is outside the repository with mode 0600 and SHA-256 `3e0ed7b00fbeb0631f30a8fb731a255423b54dafc5df3b8e31be4904484860ed`. Root independently reviewed its revocation correction. Enabled/connected Auth eligibility applies only to provisioning. Revocation can validate the approved UID and exact owned review marker, then update only status even if Auth is disabled, missing or no longer connected. It preserves UID, kind, creation and expiry. Offline SDK-only mocks reproduced the original issue (19 cases: 9 passed/10 failed) and the corrected script passed 19/19. They also verify provisioning rejects those identities, approval checks precede credential/network access, no overwrite/implicit renewal, owner/shape/lifetime fences and idempotent revocation. Network and real credential calls were forbidden in this harness; synthetic offline approval fixtures were removed.

The script's technical approval is distinct from authorization to create an actual reviewer account, grant review access or share credentials. No such human approval exists yet. Future account creation, 14-day review access and sharing only to Apple/Google App Review must be explicitly bound in a fresh approval. No email was sent and no deliverability claim was made.

## Frozen source hashes

| File | SHA-256 |
| --- | --- |
| functions/src/contracts.ts | 81c33cc06e8a896dcfc98f6fbed4ae39f37e438fdd208287e8bb4ae5d657218c |
| functions/src/foundation.test.ts | de2d3e5c7812d95cddd80224ecde8948ba389ef109c780905ff75955f3d92a72 |
| functions/src/foundation.ts | d6dafd824d86ada4047f67f0d2cfb268bd8407751c3e1b394893d1cc0cc23b94 |
| functions/src/review-access.ts | a49ddbbdc053635335449527abea9be404f40e35629c01c8d3666c6469c8298c |
| functions/src/review-access-firebase.ts | 01fc4d11465f170c3fa96621f311d4484f1ff1e046e51a3957bcf88de3011f28 |
| functions/src/review-access.test.ts | fc28cf1115e552514fa501f19a31a9e9081b50cfec209115c256b05f6893242e |
| functions/src/review-access-emulator.test.ts | 6758dc13756f48b61fdea03f5470f63f8e63fca77426d1dd8b14abcae99b740d |

All unowned backend inputs and the four client privacy modules match their task baselines. Shared UI/native source was not edited. No commits were created. [Sanitized live verification](artifacts/2026-10-05-review-access-deployment/live-verification.json), test receipts and deployment logs are in the matching artifact directory; no private values are stored there.

## Offline reviewer-account plan; human approval pending

The revised dedicated reviewer plan uses display name `FREEDAppReview` and owner-controlled public support alias `soumyadebnath1661+freedappreview@gmail.com`, as explicitly directed in the human session. The original planned UID and password candidate remain private and unchanged; public receipts expose only the planned UID hash `3f8ee2749a843657586ae2ee698024b5abde5d41dc6f28defa1bd7358bd680a8`. The earlier unsupported hosting-mailbox proposal is superseded. No actual account, verification email, metadata grant or credential sharing has occurred.

Private metadata plan SHA-256: `2936079d4012039cac762c8be4a4bbf1f0534ea71b958b6df804b063d0ae399c`. Private creator SHA-256: `56e3334d5eace9cedbbb7a145bddaa8ec2bcfc7f61a06205b2690b5fa707334b`. Root's independent reviewer approved the frozen creator repair and revised plan. The password file and script remain mode 0600 outside the repository. No password values are copied here. Public redacted plan contents have a different hash from the exact private approval-bound plan; the private hash above binds the actual candidate.

Creation uses the supported Admin `createUser` API only after a fresh exact human approval, at most 60 minutes old, binding the plan hash, creator hash, exact private planned UID/email, normal account creation, actual Firebase verification-email delivery and owner completion, normal native candidate-password proof, 14-day review access, and sharing only to Apple app6816637268 / Google package app.freed.recovery App Review. The proposed approval remains `humanApproval:false`, `approvedAt:null`. No current operator credential, SDK or network is accessed before that gate. Initial creation remains `emailVerified:false`; no Admin-forged verification, custom claims, MFA, private history, data copying, NativeActor linking or client bypass is introduced. The normal customer Continue/verify-later behavior is unchanged. Real owner inbox verification before reviewer sharing is a dedicated handoff requirement, rather than a new customer verified-email gate.

## Creator uncertainty and manual reconciliation boundary

Before any create attempt, the creator exclusively creates a mode-0600 private intent and fsyncs its file and parent directory. The intent binds the exact operation/plan/creator/credential/approval hashes, UID/email and start timestamp. Any existing, corrupt or incomplete intent blocks another create, including after restart. The real intent is absent because no actual operation ran.

A successful SDK acknowledgment remains `created-unconfirmed`. Any post-attempt failure is `indeterminate` and explicitly means creation may have committed. Existing intent yields `existing-intent-blocked`. Only errors before a create attempt yield `refused-before-create`. No automatic retry, adoption, deletion, password rotation/reset, grant, sharing or confirmation exists. Exact planned-UID readback checks email/name/password-provider/enabled/no-MFA/no-claims and server creation time against the intent window only as diagnostics. Matching public properties or timestamps cannot establish ownership or reusable credentials.

Root must manually reconcile provenance and exact planned identity, then obtain real normal signed-native password sign-in using the bound private candidate, real owner email verification and independent Root review before any grant or scoped sharing. Claimed proof booleans, old tokens, public-property matches or failed sign-in cannot confirm access. Ambiguous identities remain blocked; they are never adopted or deleted. The private manual reconciliation procedure is outside the repository and performs no operation. Extension still requires a new explicit human admin approval; the client cannot renew review access.

Meaningful old-code red fixtures failed 18/18. The corrected creator passes 19/19 offline SDK/mock outcome cases: success remains unconfirmed, committed-but-response-lost, UID/email collisions, wrong UID/email/provider, disabled identity, claims/MFA/creation-time mismatches, failed readback, write/fsync failure before zero create/SDK calls, incomplete/corrupt intents, restart duplicates after success/loss, and untrusted password-proof input. There are zero destructive calls or real network/private-candidate accesses. Thirteen fresh approval-boundary cases pass and verify zero SDK/current-credential/network/private-password reads before approval. All synthetic approval, credential and intent fixtures were removed. No real intent, account, email, review license or sharing was created during testing.

[Redacted public plan](artifacts/2026-10-05-review-access-deployment/reviewer-account-public-plan.json), [sanitized repaired-creator receipt](artifacts/2026-10-05-review-access-deployment/creator-indeterminate-repair-receipt.json), [outcome cases](artifacts/2026-10-05-review-access-deployment/creator-outcome-green.json) and [approval boundaries](artifacts/2026-10-05-review-access-deployment/creator-preapproval-green.json) contain metadata only. Callable/application source remains frozen; this repair changed only the private creator and its offline plan/receipts. Actual operations still require human approval, normal proof and scoped handoff; technical review does not authorize them.
