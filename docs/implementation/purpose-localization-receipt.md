# Functionality-led localization receipt

Completed 2026-10-03 in the shared checkout. No commits, component edits, native edits, configuration changes, or subagents.

Added 149 authored-source entries to each of the ten locale dictionaries: en, hi, es, pt, fr, de, ar, ja, ko, zh-Hans. Each write read the latest locale JSON immediately beforehand, added missing keys only, and asserted all previous source values were unchanged. Existing translations, including the other authorized chat's privacy additions, were preserved. Protect, Write and Move already had translations and were retained.

Coverage includes immediate-entry copy; Today actions and plans; check-in sleep/urge anchors; journal privacy, draft transfer and save scope; tool completion and optional feedback; retained-history limitations; independent website/app setup and technical scope explanations; Protect controls and status metadata; and empty-price/server-checkout/failure copy. Manual metadata scans added protection-readiness scopes/explanations and FunctionalToday reasons that the authored inventory did not discover.

Added `purpose` with 11 keys in each locale: `protectedEvents` and all six plural-category variants, `urgeValue`, `sleepValue`, `recorded`, `notRecorded`. Count and value arguments remain numeric for localization. `{{date}}. Recorded activity` supports the composed calendar accessibility label without translating private notes. Root changed the history consumers to the purpose namespace.

## Evidence

- Initial strict audit: 93 uncovered source phrases.
- After the initial/manual batch: 22 uncovered phrases from concurrent Protect/paywall/history refinements.
- Final `node scripts/localization-audit.js --strict`: passed, **0 uncovered**, **0 errors**, ten matching catalogs, 2,530 source keys and 2,326 inventoried distinct phrases.
- `node --test tests/localization-catalog.test.js`: **16/16 passed**.
- Temporary runtime probe through the actual i18n runtime: all ten locales passed protection count plural selection for 0/1/2/3/11/100, interpolated history values, composed recorded-date accessibility labels, and unchanged URL handling.

The existing UI runtime test's exact top-level namespace expectation needs the additive `purpose` entry; root owns that integrated test adjustment. Locale parity and runtime probes do not replace human linguistic review or native screen-reader evidence.

## Final bounded correction — 2026-10-04

Fresh audit found 16 new uncovered phrases after final root/native review. Added those and a complete sponsor-summary interpolation template (17 source entries per locale) across all ten languages. This covers first-use free recovery, FREED open counts, the message-draft date caption, website protection review, setup-state storage failure, customer-facing Protect explanations, schedule scope/local-time rules, session save state, and milestone labels.

Explicitly corrected `purpose.recorded` to **Completed** and `purpose.notRecorded` to **Not completed** in all ten locales, because a saved undo record is still a record. Every source write reread the latest JSON and verified all previous source values were unchanged, preserving the other chat's privacy translations. No component, native, test-source, or configuration edits.

Final fresh evidence:

- `node scripts/localization-audit.js --strict`: passed; **0 errors / 0 uncovered**, 2,547 source keys, 2,327 inventoried distinct phrases.
- `node --test tests/localization-catalog.test.js`: **16/16 passed**.
- Actual-runtime temporary probe: sponsor-summary numeric interpolation and the corrected completion labels passed in all ten languages.

## Native schedule and control completion — 2026-10-04

Added 23 missing source entries per locale across all ten languages: 20 fresh audit candidates and the human guard names Sleep, Work and Weekend. The existing generic time-label template was preserved. Copy covers daily-limit accessibility controls, native schedule configuration/service readiness, enforcement/reconnect/screen-on behavior, sleep-delay limitations, active guards and next-boundary templates, saved daily limit versus pending native sync, and sync failures. Displayed bridge outputs were translated through the source catalogs; no native implementation or test-source changes.

Each locale was read immediately before its additive write; all previously existing source values were asserted unchanged. Private and other-chat translations were preserved.

Evidence:

- Fresh strict localization audit: **0 errors / 0 uncovered**, 2,570 source keys and 2,348 inventoried distinct phrases.
- Existing localization catalog suite: **16/16 passed**.
- Actual-runtime temporary probe: all ten languages passed active guard-name rendering, next-boundary localized dates, saved-limit numeric interpolation, and Sleep start/Wake/Work start/Work end accessibility labels.

## Confirmed cleanup failure messages — 2026-10-04

Added the two requested customer-facing cleanup failures in all ten languages, including the library-metadata message absent from automatic inventory. The messages distinguish retained recovery records from an account-deletion request whose device cleanup failed. The latter uses each locale's existing Profile and Delete Local Data terminology. Latest JSON was read before additive writes and existing source values were asserted preserved. No native, component or interface edits.

Fresh `node scripts/localization-audit.js --strict`: passed, **0 errors / 0 uncovered**, 2,572 source keys.

## Explicit protection reactivation — 2026-10-04

Added all six new ProtectionReactivation UI phrases across the ten languages. Copy states that protection stays off until the user explicitly resumes setup, permits saved app limits/schedules to sync after that choice, keeps website filtering as separate setup, and preserves access to recovery tools while protection is off. Latest locale JSON was read immediately before additive writes; previous source values were asserted unchanged. No layout, interface, native source, or test-source edits.

Fresh strict audit reports **0 catalog errors** and **0 uncovered ProtectionReactivation phrases**. Three uncovered Android native outputs remain outside this worker's UI-only scope and were reported to root/native ownership:

- `App configuration sync is paused while FREED protection is disabled.` — FreedProtectionModule.kt:688
- `FREED protection configuration could not be enabled. Retry activation.` — FreedProtectionModule.kt:668
- `FREED protection configuration is enabled. Device permission settings are unchanged.` — FreedProtectionModule.kt:667

The global strict command exits 1 until those owner-managed native translations are present; this receipt does not claim a global green gate. At this audit snapshot, source dictionaries contain 2,589 entries.


## Final reset-latch language verification — October 4

The native owner merged the three additional Android service phrases after the six UI phrases were completed. The fresh strict audit now passes across all ten locales: **2,592 source keys, zero uncovered phrases, zero catalog errors**. All **16 localization catalog tests** pass. Previous strict-exit-1 entries above document the intermediate ownership handoff; those three gaps are now closed. Runtime layout, accessibility, and motion in every locale still need separate native evidence.
