# T002 — Verification and tooling truth (Scout, read-only)

Date: 2026-09-26. Harness: Claude Code (PM fallback — GoalBuddy-native `agent_type` dispatch
is not available in this harness, so the PM performed the Scout task directly under the
Scout read-only contract; no product file was edited).

## 1. Commands that were actually run, and results

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** exit=0 — green baseline |
| `npm run audit:runtime-data` | **PASS** 12 gate / 0 fail — but see §5, it is a source-string audit |
| `npm run test:core` … `test:firebase-email-links` (10 suites) | run in background; status recorded in the receipt |
| `adb devices -l` | `List of devices attached` — **empty**, nothing connected |
| `~/Library/Android/sdk/emulator/emulator -list-avds` | `PrimerAuditApi36` — one AVD exists, none booted |
| `xcrun simctl list devices available` | iOS 18.2 runtime present; iPhone 16 Pro / Pro Max / 16 / Plus / SE, iPad Pro / Air / mini — **all Shutdown** |
| `xcodebuild -version` | Xcode 26.5 (Build 17F42) |

## 2. Test runner reality (decisive for D3)

There is **no jest, no vitest, no RN test library** in `dependencies` / `devDependencies`.
The suites are plain TS files executed by a bespoke esbuild runner:

```
node -- scripts/run-ts-entry.js tests/<name>.test.ts
```

Assertions use `node:assert/strict` (e.g. `tests/core.test.ts:1`), and a suite signals
failure by throwing / `process.exit(1)`.

**Frozen-clock capability: available, but only by dependency-passing, not by mocking.**
There is no `jest.useFakeTimers()` and no module-mock layer, so a frozen-time test must
supply time as an argument. The derivation layer is already shaped for it:
`src/lib/recovery-state.ts` consistently declares `day: Date | string = new Date()` on its
derivations (`isSleepModeActive:1223`, `isWorkHoursModeActive:1227`, `isWeekendModeActive:1231`,
`getActiveBlockedAppPackages:1238`, `calculateStreakDaysFrom:1274`, `countAttemptsForDay:1286`,
`getDailyHabitCompletionsForDay:1291`, `getDailyCheckInForDay:1423`, `summarizeCheckIns:1564`),
so a deterministic test can pass an explicit timestamp. Timezone is injectable through the
process environment (`TZ=America/New_York node -- scripts/run-ts-entry.js …`), which the runner
forwards to the child `node` process, so DST and timezone-change scenarios are testable today
without new tooling.

Consequence for slices: a frozen-time test is a **new `tests/*.test.ts` file plus a new
`test:*` script**, run with an explicit `TZ=` prefix. No new dependency is permitted or needed.

## 3. Gate gap: two suites are orphaned

`tests/app-shell.test.ts` and `tests/design-system.test.ts` exist but appear in **zero**
`package.json` scripts (`grep -c` → `0` for both). They are never executed by any gate, so
D1 currently reports green while two authored suites are dead weight. Any slice that touches
the app shell or design system must wire these into a script before claiming coverage.

Existing scripts: `test:core`, `test:firebase-foundation|functions|migration|config|repository|native|runtime|privacy|email-links`,
plus `test:firebase-emulator` (`npm --prefix functions run test:emulator`). There is **no
aggregate `npm test`** — a full gate means enumerating them.

## 4. Device reachability (decisive for D4/D5)

- **Android**: `adb` present at `~/Library/Android/sdk/platform-tools/adb`; no device attached;
  one AVD (`PrimerAuditApi36`) available to boot. Android native claims are therefore
  *provable with effort* (boot AVD → `npm run qa:android-install` / `smoke:android-emulator`).
- **iOS**: simulator runtimes installed but nothing booted; Xcode 26.5 present; project has
  `ios/FREED.xcodeproj` plus extension targets `FREEDDeviceActivityMonitor`,
  `FREEDSafariContentBlocker`, `FREEDSafariFocusShield`, `FREEDShieldAction`,
  `FREEDShieldConfiguration`. iOS claims are *provable with effort* (`build:ios-simulator`,
  `smoke:ios-simulator`).
- Repo already ships evidence tooling that T006/T007 should reuse rather than reinvent:
  `evidence:android-devices`, `evidence:android-real-browser`, `evidence:ios-devices`,
  `evidence:ios-physical-device`, `evidence:permission-wizard`, `smoke:android-emulator`,
  `smoke:ios-simulator`, `audit:permission-flow`, `audit:android-classifier`,
  `evidence:store-ad-sandbox`, `audit:accessibility`, `audit:performance`, `audit:privacy`.

**Verdict for the D5 rule:** a booted emulator / simulator *is* reachable in this environment,
so `unproven` is not automatically admissible for anything the simulators can exercise.
Physical-device-only behaviors (real Device Activity reporting, real Safari Content Blocker
network behavior, real Play Store install, IAP with a real account) remain the legitimate
`blocked-with-receipt` class.


## 5. What the existing "data integrity" assurance actually is

`scripts/runtime-data-integrity-audit.js` passes 12/12, but every check is a
`readFileSync` + `String.includes()` assertion over source text (e.g.
`appSurface.includes("onManagePlan={() => setScreen(\"paywall\")}")`). It proves that
*strings exist in files*, never that a value is computed correctly at runtime. Several other
`audit:*` scripts share that shape. This is why a green repo does not imply D3 accuracy — and
it is the central proof gap this board now closes with executed frozen-time tests.

## 6. Persistence surface (decisive for D6)

Only one file matches storage primitives: `src/lib/recovery-storage.ts` (62 lines). State
normalization / deserialization lives in `src/lib/recovery-state.ts` (2,342 lines, with
fallback coercion around :1119-1120). `expo-sqlite` is a dependency but is not referenced from
`src/` / `app/` / `store/`, so the user-visible derivation surface is governed by the
key-value / JSON path in those two files. A D6 backcompat test should therefore be written as
"a pre-change serialized payload hydrates to identical values".

## 7. Size reality for slice sizing

`src/features/freed-app.tsx` is now **11,002 lines** (T001 recorded 9,241 — the file grew
during this worktree's uncommitted work), `recovery-state.ts` 2,342, `recovery-engine.ts` 552,
`retention-orchestrator.ts` 413. One shared UI file means Worker slices must carry tight
`allowed_files`, and the board must not run parallel Workers.

## 8. Candidate follow-ups surfaced while scouting (not fixed here)

1. Orphan suites `app-shell` / `design-system` are ungated (D1).
2. No aggregate `npm test`; gates are enumerated by hand and easy to under-run (D1).
3. `audit:*` scripts give false assurance because they assert on source text, not behavior (D3).
4. `calculateStreakDaysFrom` (`src/lib/recovery-state.ts:1274-1284`) divides elapsed local
   midnight-to-midnight milliseconds by a fixed 86,400,000 — see T005 for the executed repro.
