# T008 — Calendar-correct streak and day-range math (Worker, write-enabled)

Ran 2026-09-27 as the first Worker slice on this board. Consumed T005's measured broken rows and
T007's user-end reproduction (U5/U6) as the spec. Stayed inside `allowed_files`:
`src/lib/recovery-state.ts`, `src/lib/recovery-analytics.ts`, `tests/recovery-time.test.ts` (new),
`package.json`. No new dependency. No file outside the four was written.

## What was wrong, in one line

Three sites turned local wall-clock days into a count by dividing by a fixed 86,400,000 ms, while a
local day is 23, 24 or 25 hours around a DST transition. `floor` lost a day on the 23-hour day and
`dayMs += 86_400_000` duplicated a label and dropped the last day. The wrong streak was then
**persisted** on every app open, and a backwards device clock zeroed it outright.

## Changes

| # | Site | Before | After |
| --- | --- | --- | --- |
| 1 | `recovery-state.ts` new `localDateKeyToUtcMs` + `localDateKeyDiffDays` (1206-1232) | none | Parse the `YYYY-MM-DD` key, reject impossible keys (`2026-13-45`, `2026-02-30`) instead of letting `Date.UTC` roll them forward, and diff on UTC arithmetic, which has no DST. |
| 2 | `calculateStreakDaysFrom` (was `floor((localMidnight(day) − localMidnight(start)) / 86_400_000)`) | off by one for every user whose streak spans the device's own DST transition | `localDateKeyDiffDays(startedKey, dayKey)`, clamped at 0. |
| 3 | `touchRecoveryState` | recomputed and **wrote** the derived streak every open; a clock earlier than `lastOpenedAt` yielded 0 and persisted 0 | Detect `openedAt < lastOpenedAt` (clock moved backwards), clamp to `max(stored, derived)`, never move the `lastOpenedAt` watermark backwards, and still write the corrected value so a legacy bad number self-heals upward. |
| 4 | `recovery-analytics.ts` `dateKeysForRange` | `for (dayMs += 86_400_000)` | Parse keys, step with `setDate(+1)`, compare date keys (string-comparable ISO), bounded loop. |
| 5 | `recovery-analytics.ts` `dayDifference` | `Math.round(localMidnightDiff / 86_400_000)` | delegates to `localDateKeyDiffDays` (same answer, one definition of a day). |
| 6 | `recovery-analytics.ts` `daysSinceLastRelapse` | local-midnight ms difference / 86_400_000 | calendar key diff, clamped at 0. |
| 7 | `package.json` | no frozen-time time suite | `"test:recovery-time": "node -- scripts/run-ts-entry.js tests/recovery-time.test.ts"` |

After this slice **no `floor` or fixed-step day math is left in `src/`**: the only remaining
`86_400_000` division in the whole tree is `recovery-analytics-ingestion.ts:781`, which already uses
`Math.round` (DST-tolerant), and the six T005 "not yet examined" files contain **zero** per-day ms
constants.

## The permanent suite: `tests/recovery-time.test.ts` (228 lines, `node:assert`, existing runner)

Assertions and their expected values — every one must hold in **every** timezone, and the file is
executed under five of them:

- Helper: `('2026-01-01','2026-04-11') = 100`, reverse `-100`, `('2026-03-07','2026-03-08') = 1`,
  `('2026-10-31','2026-11-01') = 1`, malformed/invalid keys `= 0`.
- Streak across each zone's own transition: `2026-01-01 09:00 → 2026-04-11 09:00 = 100` (crosses US
  2026-03-08, London 2026-03-29 and Sydney 2026-04-05 depending on `TZ`), cross-checked against an
  independent oracle built only from `Date.UTC(year, month, day)` of the components.
- Southern-hemisphere: `2026-09-05 → 2026-10-05 = 30` (Sydney's spring forward).
- Transition day itself counts as exactly 1 on both the 23-hour and the 25-hour day.
- **U6 agreement**: with one pledge per calendar day, `getPledgeStreakDays = 31` and
  `calculateStreakDaysFrom = 30`, i.e. `pledgeStreak − 1 === recoveryStreak`. The two numbers the UI
  shows side by side can no longer disagree for one user on one day.
- **U5 rollback clamp**: stored `streakDays 30 / best 34`, opened 11 days earlier → still `30`, best
  still `34`, `lastOpenedAt` unchanged; a later open still counts forward (`40`).
- **D6 backcompat**: a legacy payload carrying the pre-fix bad `streakDays: 99` hydrates with the
  stored value untouched (no silent mutation at load) *and* the check-in record survives; the next
  open heals it to `101` at `2026-04-12`, and XP rises by exactly `12*2 + 4*2` for the two recovered
  streak days.
- **7-day windows over a DST boundary** (the two T005 backlog rows): analytics `streakHistory` yields
  7 unique buckets `2026-10-29 … 2026-11-04` with the reset on index 3, `daysSinceLastRelapse = 3`,
  `currentStreakDays = 307`; Sydney shape `2026-10-01 … 2026-10-07`; `summarizeCheckIns` total stays
  `7`.
- Milestone follows the corrected number (`30` → "30-day milestone", `29` → target 30).

## Negative control (proof the suite is not a tautology)

Temporarily reverting the helper to the old fixed-ms formula and re-running:

```
TZ=America/New_York ->  99 !== 100
TZ=Australia/Sydney ->  -101 !== -100
```

Both match T005's predicted broken rows. Reverted; full transcript in
`artifacts/t008/t008-negative-control.log`.

## Verification (exit codes captured directly, not through a pipe)

```
npm run typecheck                              exit=0  fail_lines=0
test:core                                      exit=0  fail_lines=0
audit:runtime-data                             exit=0  fail_lines=0
TZ=America/New_York test:recovery-time         exit=0
TZ=Europe/London test:recovery-time            exit=0
TZ=Australia/Sydney test:recovery-time         exit=0
TZ=UTC test:recovery-time                      exit=0
TZ=Asia/Kolkata test:recovery-time             exit=0
```

`Europe/London` and `UTC` were added beyond the slice's required NY/Kolkata pair.
Raw logs: `artifacts/t008/t008-verification.log`.

## Deliberately NOT in this slice (nothing silently dropped)

- **The other streak number on the same screen.** `stop_if` forbade touching
  `src/features/freed-app.tsx`, so the header/summary "Day Streak" rendering is untouched. Its
  *input* (`state.streakDays` / `calculateStreakDaysFrom`) is now correct, which removes the numeric
  disagreement measured in T007 U6, but the product decision "which streak is THE streak" is still
  open and is already an `ambiguities_for_judge` item on T007's receipt.
- **Pledge local-day semantics.** `hasPledgedOnDate` keys on the *local* date, so a user who pledges
  in Kolkata and then flies to New York sees "Take Today's Pledge" again. That is now internally
  consistent (streak math agrees), but choosing local-day vs UTC-day semantics is a product call, not
  a Worker fix.
- No `ANALYTICS_SCHEMA_VERSION` or remote payload shape change (would have tripped `stop_if`).
- iOS/Android native layers untouched; no user-end re-drive of the fixed build was performed in this
  slice (see next step).

## Observation for the Judge while writing the test

`hydrateRecoveryState` **drops** a `dailyCheckIns` record whose `mood` is not one of
`low | steady | energized | stressed` (measured: 1 record in, 0 out). Records written by this app can
always hydrate, so this is not a live defect, but it means any future enum widening silently
deletes stored history rather than defaulting it. Worth a standing rule for the schema-migration
slice.
