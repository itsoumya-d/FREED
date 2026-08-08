# Task 11 app shell report

## Test-first evidence

- Added `tests/app-shell.test.ts` before production changes.
- RED observed: the new test failed because `freed-app.tsx` had no import of `ROOT_DESTINATIONS` and retained the five-tab model.
- GREEN: `node -- scripts/run-ts-entry.js tests/app-shell.test.ts` passes after the shell change.

## Files changed

- `src/features/freed-app.tsx`
- `tests/app-shell.test.ts`

## Verification

- Focused app-shell test: pass
- `npm run typecheck`: pass
- `npm run test:core`: pass
- `npm run audit:accessibility`: pass

## Limitations

- Native capability limits are unchanged. The Shield hub routes setup through the existing full-screen native setup flow; it does not duplicate permission or picker controls.
- The recovery-tools Library is a full-screen route opened from Today and returns explicitly to Today.

## P1 follow-up: live Profile recovery controls

- Added focused assertions before implementation. RED observed because the active `ProfileScreen` rendered a button that only cleared a pending Firebase email link and did not render the backup, privacy, reminder, or accountability controls.
- The active Profile now reuses `RecoveryBackupCard`; its established adapter-based completion calls `completeEmailLink` with the entered email and pending link, clears the pending link only after a successful result, and keeps it on cancellation or failure.
- Restored the active Profile's retention, encrypted backup, privacy/support and deletion, reminder, accountability, and support-circle controls without reintroducing Focus Shield/native protection configuration.
- Follow-up verification: focused app-shell test, `npm run test:firebase-native`, `npm run test:firebase-runtime`, `npm run typecheck`, `npm run test:core`, and `npm run audit:accessibility` all pass.
