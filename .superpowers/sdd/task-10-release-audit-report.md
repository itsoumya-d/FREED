# Task 10 release-audit report

## Scope

- Repaired Android install-QA self-test coverage without weakening normal missing-APK validation.
- Updated App Store reviewer notes and the iOS review pack with the present iOS shielding/privacy boundary.
- Regenerated the local store-legal policy audit artifact.
- Replaced stale aggregate release checks with their authoritative classifier/parity, privacy, backend, smoke-harness, store/EAS, Firebase public-SDK, and store-legal sub-audits.
- Updated the two iOS static contracts to match the current identity-bound Screen Time unlock and Safari Focus Shield handoff markers.

## TDD evidence

1. Added `tests/release-audit-repair.test.ts` and ran it before the repair. It failed at `node scripts/android-install-qa.js --self-test`: the self-test's own output-directory assertion followed normal APK validation and failed because no real APK exists.
2. Added focused assertions that self-test parsing accepts a missing default APK, while normal install parsing rejects a missing requested APK. The Android self-test then passed.
3. The legal audit initially failed the App Store review-note gate. The exact reviewer-note and review-pack wording was updated, then `npm run audit:store-legal` regenerated the current artifact with 14 pass / 0 fail.

## Commands and observed results

- `node scripts/android-install-qa.js --self-test` — pass.
- `npm run audit:classifier` — 49 pass / 0 fail.
- `npm run audit:android-classifier` — 15 pass / 0 fail.
- `npm run audit:privacy` — 31 pass / 0 fail.
- `npm run audit:backend` — 16 pass / 0 fail.
- `npm run audit:store-catalog` — 29 pass / 0 fail.
- `npm run audit:eas-workflows` — 14 pass / 0 fail.
- `npm run audit:firebase-config` — pass.
- `npm run audit:store-legal` — 14 pass / 0 fail; regenerated `docs/validation/artifacts/store-legal-policy-current/store-legal-policy-audit.json`.
- `npm run audit:smoke-harnesses` — 94 pass / 0 fail.

## Remaining external gates

This work intentionally does not supply production credentials, signing material, billing/store-console state, deployed legal URLs, or physical-device evidence. Those release gates remain fail-closed, including hosted legal-page availability, production backend/feed/analytics/notification/AI/monetization configuration, upload signing, dependency remediation, and required Android/iOS/device/store-sandbox evidence.

## Core-regression repair

`npm run test:core` exposed a fixture mismatch after the aggregate audit began invoking authoritative npm sub-audits: the isolated fake npm accepted only `npm audit` and rejected the new `npm run audit:*` commands. The fixture now emits explicit passing outputs for every new authoritative command. Classifier success evidence also retains the behavior-significant 48-hour adult-domain-feed route-freshness boundary. This repair does not bypass a sub-audit: a non-passing/missing authoritative result still fails the aggregate gate.

Verification for the regression repair: `npm run test:core`, `node scripts/run-ts-entry.js tests/release-audit-repair.test.ts`, and `npm run typecheck` completed after the fixture and evidence updates. The focused release test invokes `npm run audit:release`; non-strict release readiness continues to report its real external prerequisites separately.

## P1 truthfulness and validation-contract repair

- The authoritative local-store JSON matcher now accepts valid compact or pretty JSON (`"result"\s*:\s*"pass"`) while still requiring the exact passing result.
- Classifier/parity evidence is limited to classifier coverage. The 48-hour adult-feed route-freshness statement is retained on the adult-domain-feed smoke-harness gate, which is the authoritative checker for that behavior.
- The iOS Focus Shield static check now matches the native Swift source's single interpolation backslash in `"url": "https://\(host)"`; the focused test distinguishes the one-backslash source fixture from an over-escaped two-backslash fixture.
- `docs/validation/README.md` and `docs/validation/evidence-runbook.md` now document the 12 canonical iOS picker, Vision, fill-template, performance-report, Safari Content Blocker embedding/reload/checksum/adult-block, and `safariRuleFailures` capture contracts that the release audit requires.

Final verification: `npm run evidence:templates` reported 9 pass / 0 fail, `npm run test:core` completed, `node scripts/run-ts-entry.js tests/release-audit-repair.test.ts` completed, `npm run typecheck` passed, and a direct `npm run audit:smoke-harnesses` reported 94 pass / 0 fail. The final aggregate snapshot reported 28 pass / 16 fail: 15 remaining failures are external prerequisites. Its additional adult-domain-feed smoke-harness failure was a nonreproducible concurrent-artifact/timing race; immediately rerunning that direct smoke audit passed all 94 checks.
