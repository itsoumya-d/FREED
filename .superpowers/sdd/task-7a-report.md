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

## Dynamic limited-use option correction

The option evaluator now treats only literal `true` and literal `false` as proven values. A direct dynamic value or an asserted dynamic boolean is unknown and rejected for non-deletion callables; deletion still requires literal `true`. Fixtures cover both dynamic forms.

Verification: `npm run test:firebase-repository`, `npm run test:firebase-functions`, `npm --prefix functions run build`, and `npm run typecheck` passed.

## Fail-closed export and option re-review

The AST policy extractor now discovers only top-level values created by the locally imported `firebase-functions/v2/https` `onCall` binding, including aliases. It resolves both direct exports and `export { localName }` re-exports, and unwraps parenthesized, `as`, and `satisfies` initializers. Callable options are evaluated in declaration order: a spread makes a prior policy unprovable until a later explicit `true` replaces it. The UID guard is accepted only as a direct callback-body expression or variable initializer, never from a nested callback or conditional branch.

Fixtures prove re-exported and aliased/wrapped insecure callables are detected, later option spreads fail, final explicit options can restore a safe policy, and nested/conditional UID calls fail. `npm run test:firebase-repository`, `npm run test:firebase-functions`, `npm --prefix functions run build`, and `npm run typecheck` passed.

## Effective policy and export resolution re-review

Callable discovery now trusts only the local `onCall` binding imported from `firebase-functions/v2/https`; direct exports and named local re-exports are both resolved, including aliased/parenthesized/`as`/`satisfies` initializers. Object options are evaluated in order, with spreads invalidating a prior explicit security value until a later explicit property restores it. A consumed limited-use token followed by a spread is also rejected for non-deletion callables. UID validation is restricted to direct callback statements or variable initializers, excluding nested callbacks and conditional branches.

Fixtures cover every one of those failure modes. `npm run test:firebase-repository`, `npm run test:firebase-functions`, `npm --prefix functions run build`, and `npm run typecheck` passed.

## Limited-use App Check certainty correction

Non-deletion callables must now prove `consumeAppCheckToken` is absent or explicitly false. Any unknown effective value from an object spread fails closed, even when `enforceAppCheck: true` is explicitly restored later. Account deletion still requires a provably true limited-use option. The former prior-spread fixture now deliberately rejects.

Verification: `npm run test:firebase-repository`, `npm run test:firebase-functions`, `npm --prefix functions run build`, and `npm run typecheck` passed.

## Syntax-aware callable re-review

The source-level extractor now uses the TypeScript AST and accepts only actual exported variable declarations initialized by `onCall`. It inspects actual object-literal booleans and actual `requireUid(request.auth?.uid)` call expressions in callback bodies. Adversarial fixtures confirm that comments or string literals cannot provide fake App Check/UID policy tokens, and string/comment text cannot create a fake callable declaration.

Verification: `npm run test:firebase-repository`, `npm run test:firebase-functions`, `npm --prefix functions run build`, and `npm run typecheck` passed.
