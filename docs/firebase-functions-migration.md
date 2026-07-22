# Firebase Functions migration slice (pre-cutover)

This repository is in a dual-run, pre-cutover state. Firebase Functions use Node 22 and `asia-south1`, but no production deployment or data import is authorized. The legacy Supabase and Upstash runtime remains the source of truth until all gates below are met.

## Server-only data boundary

Firestore and Storage mobile rules deny every direct read and write. Only Firebase Admin code may touch these collections:

| Collection | Allowed server record |
| --- | --- |
| `aggregate_analytics` | bounded daily counters only |
| `backup_metadata` | backup identifier, encrypted byte count, and ciphertext SHA-256; never envelope bytes |
| `purchase_audits` | server-side purchase verification audit metadata |
| `redacted_ai_events` | event category and redacted result only |
| `backend_jobs` | backend work queue metadata |
| `rate_limits`, `idempotency`, `leases` | transactional controls with `expiresAt` TTL |
| `push_tokens` | installation and FCM token after local permission |
| `deletion_tombstones` | deletion request state, retained for 30 days |
| `adult_feed_metadata` | publication/version/checksum provenance only |

The callable allowlist is `backendReadiness`, `ingestAggregateAnalytics`, `registerEncryptedBackupMetadata`, `registerPushToken`, and `requestAccountDeletion`. Each requires Firebase Auth and App Check. The deletion callable requests a limited-use App Check token, which deliberately returns `failed-precondition` in the Emulator Suite because token consumption cannot be represented there. Callables reject raw hosts/URLs, recovery text, receipts, notes, accessibility data, and backup envelopes.

## Local verification

Run `npm --prefix functions test` for TypeScript compilation and the isolated Admin transaction harness. It validates idempotency, per-user rate limits, and leases without project credentials. `npm --prefix functions run test:emulator` is the optional Emulator Suite command; it needs a locally installed Firebase CLI/JDK and does not contact production. Emulator Auth/App Check is not proof of deployed App Check enforcement.

The checked-in `firebase.json` configures Auth, Firestore, Functions, Storage, Hosting and UI emulators. No deploy command is included in this slice.

## Migration and removal gate

`npm run plan:firebase-migration` is planning-only. It reports prerequisite *names* without printing credentials or reading exports. `scripts/firebase-migration-plan.ts` preserves a legacy UUID as the intended Firebase Auth UID and builds idempotent per-table count/checksum manifests. For encrypted envelopes it retains only byte count and SHA-256 in the manifest; any future privileged byte transfer must verify those values and must never decode the envelope.

Actual export/import is blocked until all conditions hold:

1. External Supabase export credentials are supplied only to an approved execution environment, and a verified export manifest exists.
2. The Google quota issue is resolved and a separate staging Firebase project exists; production service files are never used for staging.
3. Staging billing/deployment permissions exist, the transfer is reconciled with per-table counts and checksums, and a rollback rehearsal succeeds.
4. Dual-write/incremental synchronization runs through a 30-day rollback window with an explicit cutover approval.
5. Only after the 30-day window may legacy Supabase/Upstash runtime code and credentials be removed in a separate review.

`npm run audit:firebase-runtime-boundary` prevents Supabase or Upstash access from being added to Firebase server/client/migration paths. It intentionally does not fail existing legacy paths before this removal gate.
