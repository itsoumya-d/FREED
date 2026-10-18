# Momentum screen presentation receipt

2026-10-03. This is source and automated-component evidence for the screen package, not completion of the 64-surface / 109-feature native and live-service verification plan.

## Implemented source

- Extracted Home into `src/components/MomentumToday.tsx`; retained Home's recovery/controller callbacks in `src/features/freed-app.tsx`.
- Replaced the old oversized Home next-step composition with real Monday–Sunday calendar dates, an honest protection setup/coverage row, a compact recorded-streak companion, primary action, and a two-column category-colored practice grid. The four initially visible tiles expand to all six; the daily pledge is separate from the six-practice count. Existing saved-reset, check-in, pledge and reset priorities remain.
- Selecting an earlier date loads that day's recorded habits. Historical checkboxes are disabled and guarded against mutation; future dates cannot be selected; the primary action returns to today. Dates, numbers, duration units and authored labels use the active locale. Compact widths and larger text can stack or scroll.
- Rebuilt RecoveryHero with the original progress companion and a fill driven only by the real supplied milestone progress. No seeded streak or fake recovery metric.
- Extracted breathing presentation into `MomentumBreathingView.tsx` and a monotonic pause clock into `momentum-breathing-clock.ts`. Retained all three actual cadences and native haptic toggle. Countdown uses active elapsed time, pause freezes elapsed time and spatial scale, resume continues the same phase, cadence changes reset the session, and focus/background loss pauses it. Original calm companion and rings follow the phase. Reduce Motion suppresses spatial scale.
- Welcome uses the original welcome companion. Paywall uses the companion and bold native type while preserving every provider price, readiness/busy guard, monthly/yearly equality disclosure, purchase/restore/manage action, free continuation, legal link, and return callback.
- Setup and account access/reauthentication use larger body/input type and shared surfaces. Setup footer becomes scroll content for short displays or larger text. All account modes, fields, validation, identity ownership, passwords and consent paths remain.
- Library tiles use the four practice categories; search, article metadata, custom-reset gating and all actions remain. Profile retains every disclosure/form and uses the service agent's ownership-scoped membership summary: access-through means verified access, never an inferred renewal. Cached expiry says “Verified access ended.”
- Shared presentation migration removes legacy hard-coded green/white/amber tints from monolith screens, applies runtime theme surfaces and 24-point gutters, and strengthens typography. This reaches quiz, plan, app selection, progress, Shield, article, custom reset, coach, check-in, slip, reminders, backup, accountability, privacy and nested states without changing their controller/business logic.
- Urgent intercept uses the calm companion. Completed challenge content can scroll and uses the celebrate companion. Unlock copy is conditional on saving a helpful reset rather than claiming an unlock is already ready.
- Removed unused legacy Home-specific presentation helpers. Native route layouts/APIs remain owned by root/service packages.

## Verification

- TDD: watched the three new Home behavior tests fail on the empty presentation, then pass. Watched two active-time pause/reset tests fail on a zero-time clock, then pass.
- Final focused command: `jest tests/ui/momentum-today.test.tsx tests/ui/momentum-breathing-clock.test.tsx tests/ui/premium-offer.test.tsx tests/ui/library-screen.test.tsx tests/ui/account-identity-text.test.tsx tests/ui/protection-limited-exit.test.tsx --runInBand --watch=false`: **6 suites, 65 tests passed**. Includes real count/label checks across all ten languages and both themes.
- `node --test tests/quiz-accessibility-source.test.js`: **3 tests passed**.
- Latest `npm run typecheck`: **passed**, exit 0. Earlier concurrent snapshots caught in-progress JSX transforms and locale formatter typing errors; these were corrected before the latest green run.
- Ran the whole `npm run test:ui` command twice. First: 17/18 suites and 105 tests passed; PremiumOffer could not import decorative expo-image under the suite's existing Expo native mock. Scoped the decorative companion boundary in that test; purchase behavior remains real. Second: 17/18 suites, 131/132 tests passed; only the localization worker's new body17 test was caught before its implementation. Its worker subsequently implemented the default. The latest focused screen run is green; the root integration pass owns a fresh complete-suite run after all packages finish.

## Evidence still required

No simulator or physical-device proof was produced by this worker. Root owns coordinated native launch/capture to avoid two agents driving the same simulator. Light/dark rendered layout, ten-locale device rendering, XL Dynamic Type, safe areas, full-flow recording/scrubbing, native back paths, measured release FPS, Android layout, physical protection/camera/sensors, live backend/store ownership and sandbox billing remain unverified by this receipt. Source/component tests do not satisfy those requirements.

## Broad composition completion and review follow-up

The owner's later steering explicitly rejected a tint-only migration. The source now has individually composed route/form headers with the original interactive companion, 63 category-aware panel uses, 30 colored section headings, five preserving Progress disclosures, adaptive metric/control groups, colored Shield navigation tiles, and contextual Profile disclosure/actions. Account modes, setup stages, private/custom challenge detail, ad states and legal document renderers share the same vocabulary. Restrained contexts use compact companion placement and suppress decorative idle movement; hidden disclosure children carry explicit companion visibility. Root owns the companion motion, canonical logo, native chrome and real breathing/Lottie phase binding.

[The source treatment map](./momentum-surface-treatment-map.json) gives one exact source/renderer/treatment entry for all 64 inventoried surfaces. Existing native review cells remain unproven; this map is not a 64-screen runtime pass or a 109-feature device proof.

Additional regression fixes are retained:

- Home refreshes its clock on focus/foreground. Each practice click and queued state write checks a fresh local date; toggling reads the current day's real completion and records that same captured time. Past selected dates remain read-only. The primary action returns to the actual current day if its old view crosses midnight.
- No recorded start renders standalone localized “Start today.” Root's native first-capture findings were addressed with a compact in-row limitation disclosure (all original truthful detail remains), roughly 144-point recorded hero at ordinary text, concise actual elapsed display/full accessibility hint, and measured safe-area/native-tab bottom content buffering. Native screenshots must confirm the final geometry.
- Custom reset titles, rationale, steps and spoken choice labels retain raw private text while authored titles continue translating. Root's real breathing/Lottie controller remains intact.
- During the in-progress header extraction, accountability enable/last-contact information was identified as missing before final review. Both were restored in the native setting header and covered by enable/busy behavior regression. Reminder/backup/privacy/accountability original input/control expressions were compared read-only with the original source: no missing expressions were found in those four expanded forms.

Final focused replay, run as one process after the source changes: **11 suites / 83 tests passed**, Jest measured 28.4 seconds, with a bounded 60-second test/hook guard. Paths: momentum-sections, momentum-today, momentum-day-boundaries, private-challenge-presentation, momentum-breathing-clock, premium-offer, account-identity-text, library-screen, protection-limited-exit, encrypted-dns-section and dns-race. The first new disclosure/native-setting/no-start/rollover/privacy tests were observed failing before their implementation. The Home limitation-disclosure test was separately red/green.

An intermediate whole UI run under severe host memory pressure had 18 passing suites and three failing suites: Preferences' new native artwork fixture boundary, the in-progress native switch accessibility fix, and one Spanish paywall cleanup hook exceeding 15 seconds. The relevant presentation regressions subsequently passed in focused replay; the localization owner separately replayed its Preferences cases. These intermediate failures and host timing are retained rather than reclassified as native failures or a green whole-suite result.

Read-only presentation audit after the scoped replay found no remaining concrete control/private-field regression in this package. Intentional discoverability change: Progress's secondary reports/privacy snapshot now require opening their labeled disclosure; native walkthrough scripts must exercise those headers. Physical layout, XL text, all ten native locales, native back/keyboard paths, measured release motion/FPS, real protection, store sandbox and live service evidence remain root/integration obligations.
