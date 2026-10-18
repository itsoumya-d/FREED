# Purpose-led recovery data receipt

2026-10-03. Writer: calendar_practices. Implementation now stable for the next single-writer handoff. No UI, native handler, off-device builder, or core.test edits; no commits or subagents.

## Final contracts

`DailyCheckIn` and `DailyCheckInInput` keep existing keys and allow `mood`, `urgeLevel`, and `sleepQuality` to be null. `checkInCompleted?` and `journalSaved?` are additive type fields for raw legacy/source compatibility; hydration always writes explicit booleans. `isCheckInCompleted(record)` requires BOTH explicit mood and urge and respects explicit false. Sleep is optional. `hasSavedJournal(record)` requires nonempty saved text and respects explicit false. Legacy records infer purpose from their explicit values, without supplying missing mood/urge/sleep defaults.

`recordCheckInForDate(state, input, dateKey, at:Date=new Date())` validates the live local date and rejects missing mood or urge with `checkin-unanswered`. `recordJournalForDate(state, reflection:string, dateKey, at:Date=new Date())` rejects a stale date or empty text; retains existing answers, identity, creation time and check-in purpose. It saves journal text/purpose only; root chooses whether its save flow also records the journal practice. Unchecking a journal habit never deletes text.

Recovery drafts add `journal: {reflection:string}` under `freed.recovery.draft.journal.v1`; both check-in and journal drafts require their authored date. `getRetainedJournalDraftDate(storage,todayKey)` supports recovery after midnight. Check-in drafts accept null answers. `purgeRecoveryDrafts` removes all form drafts plus `freed.recovery.breathing-session.v1`, tries every removal, and reports failures. Scratch/session keys never enter RecoveryState or backups.

`PersonalDailyPlan` is `{dateKey,checkInRequired:true,practiceKeys:DailyHabitKey[],createdAt,updatedAt,recordedAt:string|null}`. RecoveryState adds `personalPlanPreferences:{practiceKeys,updatedAt}` and `personalDailyPlans:PersonalDailyPlan[]`. Defaults suggest exercise and meditation; either/both can be replaced or removed. All six existing practice keys remain available.

- `getPersonalDailyPlan(state,date:Date|string,now:Date|number=new Date())`: stored dated targets; ephemeral default only for today; null for future or historical dates with no retained plan.
- `updatePersonalDailyPlan(state,practiceKeys:readonly DailyHabitKey[],dateKey,at:Date=new Date())`: current date only, at most two known keys; updates that date and future preferences, never past targets.
- `markPersonalPlanDate(state,at:Date|string=new Date())`: pins the first record and never rewrites existing targets. Check-in, habit, pledge, slip, challenge reset and blocking-attempt record paths invoke it. At most 400 dated plans are retained; older missing targets remain unknown instead of taking today's denominator.

`ToolCompletionInput` requires `{sessionId,toolId,title,category,startedAt:Date|string|number,activeDurationSec,dateKey}` and optionally `{helpfulness:'helped'|'still-urging'|'unknown',practiceKey:DailyHabitKey}`. `recordToolCompletion(state,input,at:Date=new Date())` validates the write date, identity, positive finite observed duration, and duration no greater than wall time since start. Completion date is the explicitly validated finish date; a session can span midnight when the controller supplies that finish date. The caller owns observation of foreground/active time; this contract does not infer it from wall time.

A receipt stores id/session/tool/title/category/start/finish/authored date/active seconds and optional explicit helpfulness/practice choice. RecoveryState adds `toolCompletions` (400 retained details) and durable `toolCompletionSessionIds` (identity-only replay fence). A matching session is a no-op, including after receipt/history pruning. No default practice is marked; only explicit `practiceKey` records that self report. No native event, unlock, or protection timestamp is granted.

Tool resets enter existing challenge/reset history using `source:'tool'`, `toolId`, `dateKey`, observed `durationSec`, and `outcome:'unknown'` when helpfulness was not answered. `completedChallenges` retains its legacy field name and includes these real reset completions. Tool completion bypasses recordChallengeCompletion's lastProtectedAt side effect.

## Snapshot and archive additions

`RecoveryDaySnapshot` adds `checkInCompleted`, `journalSaved`, `plan:PersonalDailyPlan|null`, `plannedPractices`, `plannedTaskCount:number|null`, `completedPlannedTasks:number|null`, `resetRecords:ChallengeCompletion[]`, and `toolReceipts:ToolCompletionReceipt[]`. Targets are one check-in plus the stored selected practices. Completed plan tasks use check-in purpose plus selected self-reported practice completions. Null historical targets have no fabricated denominator.

`RecoveryActivityArchive.toolCompletionMinutes` is `Record<UTCminute,Record<authoredDateKey,categoryOutcomeCounts>>`. It retains no session IDs, notes or titles. Tool range counts use the authored date; UTC aggregate analytics use the UTC minute. Lifetime completion totals include each reset once. Existing challenge/native minute interpretation is unchanged. This additive archive field must be consciously retained or excluded by root's privacy export projection; encrypted spread-and-hydrate backups preserve it.

State version and backup version remain 1. Missing additive fields hydrate to defaults; existing explicit answer values and stored record date keys remain intact. Summary/check-in XP/badges/UTC check-in counts exclude journal-only records. Numeric average fields keep their existing zero sentinel protocol, average only actual answered fields, and never use absent sleep as a low-sleep signal.

## Verification

New focused suites are green: journal/check-in 7 tests, personal plans 5 tests, tool receipts 4 tests (16 total). Observed red cases included absent purpose flags, nullable draft rejection, journal upgrading an explicit false purpose, incomplete scratch purge, missing plan totals, and tool timezone/cap counts returning 0 instead of 401. Final tool test covers 401 sessions, both detail caps, India-to-Los Angeles timezone change, exact 401 authored-day and UTC counts, and durable session replay no-op.

Existing recovery-time, recovery-day-snapshot (7 tests), recovery-day-write and recovery-drafts suites pass. No further broad/core reruns are requested at this handoff.

Broader regression run: core stopped at `challenge generation request uses recovery signals without browsing details` with the sibling privacy fence's unavailable export context. Recovery-data-accuracy was 16/18: `Firebase answered-feedback DTO excludes unknown history without relabeling it` could not capture a request without export context, and `aggregate archive and cumulative progress survive encryption and legacy-compatible hydration` expected privacy-projected attempt/unlock archives to remain. These are reported to root and were not repaired by weakening the new off-device fence.

The first integrated typecheck reported nullable consumers in recovery-analytics.ts (urge comparisons), urge-risk-forecast.ts (urge/sleep comparisons), and freed-app.ts Coach CheckInContext, plus root's in-flight journal route and PracticeDetail interface changes. Root confirmed it is repairing these consumers; owned contract modules produced no errors. Final integrated UI, native, privacy-projection, purchase and complete-suite verification remain root work.
