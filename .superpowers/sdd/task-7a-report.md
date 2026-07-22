# Task 7A follow-up review fixes

## Transaction ordering

`runProtectedMutation` now fetches rate-limit and idempotency documents before its first write. The shared `mutate` wrapper uses that helper, so readiness, aggregate analytics, backup metadata, push-token registration, and deletion follow Firestore's all-reads-before-writes requirement. A strict in-memory transaction harness throws on any read after write and exercises each operation name.

## Callable readiness

The deleted `firebaseFoundation` callable has been removed from the native client. `callFirebaseBackendReadiness` initializes native App Check and calls the actual Auth + App Check-protected `backendReadiness` endpoint. It does not downgrade failed Auth/App Check checks to a fallback call.

## Emulator reproducibility

`functions/package.json` pins `firebase-tools` to `14.7.0`, whose supported engine range includes Node 22. The emulator command uses `./node_modules/.bin/firebase`, builds before startup, and runs read-only compiled tests after emulator startup. It has no global CLI or unpinned `npx` dependency.

## Verification

- `npm --prefix functions test`: 9 passing tests.
- `npm --prefix functions run test:emulator`: Auth, Firestore, Storage, and Functions emulators started; all six Functions loaded; 9 tests passed; command exited 0.
- `npm run test:firebase-runtime` and `npm run typecheck`: passed.

The emulator host used Node 26 locally; production deployment remains Node 22 by `functions/package.json` and was not attempted.

## Repository policy re-review

The repository configuration test now reads `functions/src/index.ts`, verifies the Node 22 v2 Functions target, and requires App Check for every callable. It also requires the shared Firebase Auth UID gate and limited-use App Check token consumption for account deletion. The previous test-first execution failed with `ENOENT` because it attempted to read the removed `functions/index.js` entrypoint.

Verification after the assertion update:

- `npm run test:firebase-repository`: passed.
- `npm run test:firebase-functions`: passed.
- `npm --prefix functions run build`: passed.
- `npm run typecheck`: passed.
- `npm run test:firebase-config` and `npm run test:firebase-privacy`: passed.

## Callable-policy extractor re-review

The repository test now extracts every exported `onCall` declaration from the TypeScript source using balanced option/body blocks. It checks each discovered callable for App Check enforcement and the shared UID gate, regardless of whitespace or option-property order. The deletion policy is exclusive: `requestAccountDeletion` must consume a limited-use token and every other callable must not. Deliberate bad fixtures prove failures for missing App Check, missing UID gating, and a non-deletion limited-use token.

Verification: `npm run test:firebase-repository`, `npm run test:firebase-functions`, `npm --prefix functions run build`, and `npm run typecheck` passed.
