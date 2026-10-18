# Companion preferences and copy receipt

Completed in the shared working tree on 2026-10-03. No commits, resets or source-catalog rewrites.

## API and behavior

- `AppPreferences.companionMotion: 'system' | 'off'`, exported `CompanionMotionPreference`, default `system`. Old records and malformed values normalize to `system`; existing theme/language settings remain intact.
- `useAppPreferences().preferences.companionMotion` and `update({ companionMotion })` use the existing durable preference store. A failed write retains committed settings and emits `error: 'save'`; retry clears the error after saving.
- `useOptionalAppPreferences()` returns nullable provider state for companion rendering outside the provider. The required hook retains its missing-provider error.
- Preferences includes an accessible native switch labelled Contextual animation, with checked state and a localized explanation that OS Reduce Motion remains authoritative. Preferences header uses `pose="guide" context="preferences"`.

## Translation contract

All ten catalogs add only `companion`, with 131 non-empty strings each: `poses.<pose>.label/helpTitle/helpBody` for all 18 poses; `practices.<key>.title/detail/step1/step2/step3` for all six practices and `guidedLabel` on the three guided-action practices; help/motion/history/calendar/practice/save controls; mood/urge/sleep endpoints; midnight draft notice/action.

Interpolations: `recordedOn`, `recordedStart`, `viewingDate` use `{{date}}`; `resetCount`, `protectedCount`, `slipCount` use `{{count}}`. History streak remains a label, without interpolation. `noHistory` means no activity recorded for the day. Existing locale strings and authored-source catalogs were preserved.

## Verification

- Store tests observed red for missing additive field, normalization and durable motion persistence; green **7/7** (`node -- scripts/run-ts-entry.js tests/app-preferences.test.ts`).
- Native switch test observed red for missing control; final focused Preferences UI green **12/12**, including save failure and retry. An intermediate accessibility query failure exposed missing explicit `accessible`; fixed in native control.
- Native protection preference synchronization and web provider regression tests each passed (**2/2**).
- Locale runtime exact namespace expectation observed red after the additive namespace; updated that expectation only. Final runtime topology/nonempty/interpolation/formatting tests green **27/27**.
- Latest source localization catalog run **15/16**: namespace consistency passed; strict authored coverage reports seven SVG transform strings in `KiteCompanionRig.tsx` as untranslated template candidates. These are non-user-facing transforms; root/avatar owners notified for audit correction.
- Typecheck during concurrent integration reported pending avatar exports/props only (`CompanionPose/Help/Cue`, `pose/context/scene`). Integrated typecheck and full UI suite belong to root and must be rerun on the completed branch.

These are local source and UI test receipts, not device or native runtime evidence. Translation parity does not certify human linguistic review.
