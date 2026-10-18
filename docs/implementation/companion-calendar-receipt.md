# Companion calendar and practices receipt

Date: 2026-10-03. Package owner: calendar_practices. No commits or changes outside the assigned package and this receipt.

## Delivered APIs

- `buildRecoveryDaySnapshot(state, date: Date, now: Date | number = new Date())`: selected local date key; today/read-only/future flags; six typed practice records with original date key; completed count; pledge; check-in; dated reset count (including archive); retained slips; protected and risk counts; availability of recorded activity; nullable historical streak with retained start and as-of timestamp.
- `recoveryDateSelection(date, now)` / `resolveRecoveryDateSelection(selection, now)`: `{mode:'today'}` follows midnight; `{mode:'history',date}` remains pinned. Future or invalid selection resolves to today. Invalid direct snapshot inputs raise explicit RangeError. Future snapshots expose no recorded activity.
- `practiceDefinitions` / `getPracticeDefinition`: preserve six stored keys; categories, source instructions and optional guided destination (`check-in`, `movement`, `breathing`). Pledge is separate. A guided tool never marks a practice automatically.
- `MomentumToday`: preserves existing required props; adds optional `snapshot`, `onPracticeAction(key)`, `companionPose`, `companionContext`, `companionHelp`, `companionCue`. `onAction`, `onHabitToggle`, and `onPledge` accept `void | Promise<void>` and show failure without fabricating completion.
- `RecoveryHero`: preserves existing props; optional same companion props, snapshot and companionVisible. Historical views use only snapshot streak and hide current milestone progress. Hero motion is viewport gated and hidden while a practice/picker modal covers it.
- `PracticeDetail`: modal reading surface with translated instructions, contextual companion, optional guided action, and mark/undo. Both actions check the selected local day against live Date.now at press time. Completion remains parent controlled.

## Calendar behavior

Monday-first weeks browse backward and forward up to the current week, with a visible week range, full accessible date labels, future disabled dates and Return to today. Choosing dates uses installed `@expo/ui/datetimepicker` on iOS/Android with maximum date and staged Done/Cancel. Its web adapter returns null; web therefore uses an accessible month-grid fallback with previous/next month, future guards and staged Done/Cancel. No dependency or native configuration changed.

## Evidence and boundaries

Behavioral red runs observed missing previous-week/detail controls; historical hero incorrectly showed current 12-day streak; future snapshot exposed one future practice; invalid selection incorrectly became historical; web lacked month-grid dates. These were followed by passing focused runs.

Pure snapshot suite: seven passing tests cover all selected-day data, archived counts, retained slip intervals, unknown/stale historical streak bounds, midnight selection, practice mapping, future and invalid dates.

Focused UI suite covers week browsing, detail reading versus self report, historical write guards, unknown historical hero, failed durable callback, native date staging/future guards, committed mark/undo, midnight detail guards and web month fallback. Final focused UI result: eight tests passed, including the web fallback red-to-green check.

Original MomentumToday/day-boundaries/hero suites passed together with the initial new suite (34 tests). Broader UI run after shared avatar interfaces settled: 173 passed and one preferences-screen contextual accessibility-label expectation failed; later backdrop changes briefly caused shared expo-image mock import failures, reported to root. The root owns integrated test-boundary fixes and final full-suite verification.

Typecheck passed after avatar API exports landed and again after the month fallback.

Historical streak is intentionally unavailable before the earliest retained start or slip. previousStreakDays may be stale and cannot reconstruct a missing start. Undated cumulative challenge totals are never assigned to a historical day. Day fields describe retained recorded data; capped records cannot certify that no activity ever occurred. No iOS/Android physical runtime, screenshot, motion recording, native picker interaction or slow-device performance verification was performed by this package; root's integrated native verification remains required.
