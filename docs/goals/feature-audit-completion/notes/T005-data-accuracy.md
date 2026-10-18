# T005 — Data accuracy table (Scout, read-only)

Executed 2026-09-26 with frozen timestamps against the **real repo modules** (scratch probes
`/tmp/t005-probe.ts`, `/tmp/t005-probe2.ts`, run through the repo's own runner:
`TZ=<zone> node -- scripts/run-ts-entry.js /tmp/t005-probe.ts`). Nothing here is a code-reading
guess unless the row says so. Zone matrix: `America/New_York`, `Europe/London`,
`Australia/Sydney` (DST) vs `Asia/Kolkata` + `UTC` (no DST) as controls.

## Headline

The app's headline number — the day streak — is **off by one for every user whose streak
spans one of the device's own DST transitions**, and the wrong value is **written to saved
state**, so it is not merely a display glitch. Everything downstream of it (best streak, XP,
level progress, milestones, badges, the 90-day reward bar, the stage label, and the number
shown to an accountability partner) inherits the same error. No-DST regions are unaffected,
which is exactly why this survives green CI: the suites run in one timezone and there is no
frozen-time DST test anywhere in the repo.

## Table

Verdict key: `accurate` = executed test passes in every zone tried · `broken` = wrong for some
reachable user (repro below) · `broken-inherited` = consumes a value with a proven-bad
derivation.

| Value | Source of truth | Derivation | Frozen-time test | User-visible wrong case | Verdict | Repair needed |
| --- | --- | --- | --- | --- | --- | --- |
| `streakDays` (home "Day Streak", `{streakDays} DAY STREAK`) | `recoveryStartedAt` | `calculateStreakDaysFrom` :1274-1283 = `floor((localMidnight(today) − localMidnight(start)) / 86_400_000)` | probe A: start 2026-01-01 09:00, open 2026-04-11 09:00 | NY/London show **99** instead of **100**; Sydney shows **57** instead of **58** across its own 2026-10-04 transition; Kolkata/UTC accurate | **broken** | Replace fixed-ms division with calendar-key math (`Date.UTC(y,m,d)` diff) |
| `bestStreakDays` | persisted state | `touchRecoveryState` :1975 `Math.max(best, currentStreak)` | probe B | Personal best latches **99**; a genuine 100-day record is never credited | **broken** | Same root fix; do not persist a value derived from a bad clock |
| Persisted `streakDays` | `hydrateRecoveryState` → storage | `touchRecoveryState` :1970-1978 writes the derived value back on every app open; `recovery-storage.ts` (62 lines) is the sink | probe A (returned value is the persisted value) | The wrong number survives restart and cannot be recovered after the transition day passes | **broken** | Fix must ship with a hydration/backcompat test (D6 overlap) |
| Recovery XP | derived `state` | `calculateRecoveryXp` :1296-1306 (`streakDays*12 + bestStreakDays*4`) | probe C | 1584 vs **1600** XP for identical history (−16 per lost day) | **broken** | Follows streak fix |
| Level / progress bar | derived XP | `calculateRecoveryLevel` :1309-1323 | probe D | Progress 0.6914 vs **0.7143**; can sit one level below the true level at a threshold | **broken** | Follows streak fix |
| Milestone card | `state.streakDays` | `getRecoveryMilestone` :1328-1355 | probe E/F | At a true 30 days it shows `29`, `Next milestone: 30 days`, `1 day until the next streak celebration.` — **the celebration never fires on the day it is earned** | **broken** | Follows streak fix |
| Badge "Seven Clean Days" | `state.streakDays` | `generateAchievementBadges` :1371-1376 (`progress: streakDays`, target 7) | inherits probe A input (same value, proven wrong) | Badge unlocks a day late for DST users | **broken-inherited** | Follows streak fix |
| "Day X of 90" + reward % + stage label | `streakDays` | `freed-app.tsx` :4379-4382 (`daysTo90`, `rewardPct`), :4526-4529 (stage thresholds) | inherits probe A input | Stage flip ("Stage 2: Dopamine Upregulation" …) and the 90-day reward percentage each lag one day | **broken-inherited** | Follows streak fix |
| Sponsor / accountability report | analytics `summary.streakDays` :485, :518 | `buildRecoveryAnalyticsSnapshot` :469-471 recomputes with the same function | probe A path; rendered at `freed-app.tsx` :6972 | A real human partner is told "99d streak" for a true 100-day streak | **broken** | Follows streak fix |
| Streak-history chart buckets | `recoveryStartedAt` + relapses | `dateKeysForRange` :241-251 iterates `dayMs += 86_400_000` | probe H/I (US 2026-11-01 fall-back), probe L (Sydney 2026-04-05) | A 7-day US range containing 2026-11-01 yields **6 unique labels** (duplicated `2026-11-01`, last day missing); Sydney duplicates on 2026-10-04; Kolkata/UTC accurate | **broken** | Walk days with `setDate(+1)` the way `getPledgeStreakDays` already does |
| Streak (pledge) vs streak (recovery) | `state.pledges` vs `recoveryStartedAt` | `getPledgeStreakDays` :2223-2236 (calendar walk) vs `calculateStreakDaysFrom` (ms math) | probe G | The same vocabulary shows **100** in one place and **99** in another for the same user on the same day | **broken** | One shared calendar-day helper for all streak math |
| Streak after a device clock rollback | `recoveryStartedAt` | :1282 returns `0` when `dayMs < startedMs`; `touchRecoveryState` persists it | probe O (every zone, DST-independent) | Phone clock jumps backward (flight, bad auto-time) → app silently displays **0 DAY STREAK** and re-zeroes daily counters | **broken** | Clamp: never lower a persisted streak on a backwards clock |
| Unlock grant length | `earnedUnlocks[].startedAt/expiresAt` | `recordEarnedUnlock` :1953 `startedMs + minutes*60_000` | probe P2: 90-minute grant on the 23-hour day measured as 90 minutes | none found | **accurate** | none |
| Unlock active check | same | `getActiveEarnedUnlock` :1935 (absolute instants) | probe P1: 01:30 + 90 min still active at 03:00 local on the short day | none found; the instant exactly equal to `expiresAt` is inactive (exclusive boundary) | **accurate** | document the exclusive boundary |
| Session duration | `appSessions[].durationSec` | `recordAppSessionEnd` :2018 | probe P3: 09:00:00 → 09:47:30 = 2850 s | none found | **accurate** | none |
| Foreground minutes | sum of session seconds | `safeCount(total/60)` :511 | probe P4: 2850 s → 48 min | 47.5 min rounds up to 48 — consistent, and should be described as approximate rather than exact | **accurate** | none |
| Attempts today | `attempts[].detectedAt` | `countAttemptsForDay` :1286 (`getLocalDateKey` equality) | probe P5 on the 23-hour day, 3 zones | none found | **accurate** | none |
| Weekly report totals | `attempts` in range | `generateWeeklyRecoveryReport` :1610 (`setDate` windows) | probe P7: 2 blocks on the transition day → 2, `range=2026-03-02 to 2026-03-08` | none found | **accurate** | none |
| `dayDifference` (chart fallback) | date keys | `recovery-analytics.ts` :253-258 `Math.round(diff/86_400_000)` | inferred from probe H data: `round` absorbs the ±1 h offset that defeats `floor` | none expected | **accurate** | none — this is why only the `floor` and `+=` sites fail |
| `daysSinceLastRelapse` | `relapseRecords[].occurredAt` | :366-370 local midnights then `safeCount` (rounds) | not executed — code path read | none expected | **accurate (code-path only)** | must be covered by the T008 test sweep |
| 7-day check-in window | `dailyCheckIns[].dateKey` | `summarizeCheckIns` :1564-1570 (`setDate(−6)` + key compare) | not executed — code path read | none expected | **accurate (code-path only)** | must be covered by the T008 test sweep |

## Root cause, in one line

Three sites convert local wall-clock days to a count using a **fixed 86,400,000 ms day**
(`recovery-state.ts:1283` `floor`, `recovery-analytics.ts:247` `+=`, and the same divisor at
`:370`), while the rest of the codebase already uses calendar-correct `setDate`/date-key math.
A local day is 23, 24, or 25 hours; only `floor` and fixed stepping turn that into a wrong
number.

## Repair shape the Worker must implement (no new dependency)

1. One shared helper: `getLocalDateKey` already exists; add a `localDateKeyDiffDays(aKey, bKey)`
   built on `Date.UTC(y, m, d)` of the parsed keys — UTC arithmetic has no DST, so the diff is
   an exact integer number of calendar days.
2. `calculateStreakDaysFrom` :1274-1284 and `dateKeysForRange` :241-251 must both route through
   calendar math (`setDate(+1)` stepping for ranges).
3. `touchRecoveryState` :1970-1978 must not lower a persisted streak when `openedAt` is earlier
   than the stored `lastOpenedAt` (clock rollback guard), and must keep writing the corrected
   value so the bad number self-heals on next open.
4. Every change needs a frozen-time regression test in a new `tests/` suite wired into a new
   `test:*` script, executed under `TZ=America/New_York` **and** `TZ=Asia/Kolkata`, plus a
   saved-data backcompat test proving an old serialized payload (with the pre-fix `streakDays`)
   hydrates without losing or resetting user progress.

## Values not yet examined (spawned as T008 — nothing silently dropped)

Sleep-stage/urge-forecast windows (`urge-risk-forecast.ts`), retention anniversary and
"days installed" counters (`retention-orchestrator.ts`), accountability partner `lastSeen`
age (`accountability.ts`), notification snooze/reminders (`remote-notifications.ts`), daily
unlock allowance counters, and membership/receipt age (`monetization.ts`,
`purchase-verification.ts`). These are the same defect class and must be swept with the
frozen-time harness T005 established.

## Note on probe hygiene

Three rows first reported WRONG because of bad probe fixtures (a missing seconds argument, a
month-index error, and non-blocking sample URLs). They were re-run with corrected fixtures and
are recorded as **accurate**. The accurate rows above are therefore genuine passes, not
assumptions.
