# Contextual companion receipt — 2026-10-03

## Delivered package

- `src/components/MomentumCompanion.tsx`: compatible entry point, accessible contextual-help native page sheet, lifecycle gating, motion preference integration, cue presentation and deduplication.
- `src/components/KiteCompanionRig.tsx`: offline SVG identity with 18 distinct silhouettes and independent Reanimated body, arm, leg, eyes, mouth and prop groups. The generated pose-reference sheet and active master were visually inspected before constructing the geometry.
- `src/lib/companion-policy.ts`: pose/variant resolution, scene-family selection, motion gate and bounded cue ledger.
- `tests/companion-policy.test.ts`, `tests/ui/companion.test.tsx`: lifecycle/registry behavior and rendered help/cue interactions.

The 18 poses are welcome, guide, listen, plan, shield, focus, breathe, move, write, read, connect, rest, reassure, celebrate, waiting, repair, secure and saved. Focus, breathe, rest and reassure sit with crossed legs. Other poses vary limb geometry and body lean. Props include a clipboard, notebook and pencil, shield, hourglass, open book, heart, moon, flag, clock, wrench, lock and saved receipt. The rig remains the same geometry when motion is disabled; it does not substitute a transformed PNG.

## Public interfaces

`MomentumCompanion` still accepts `variant`, `width`, `height`, `interactive`, `visible` and `idle`.

New optional props: `pose: CompanionPose`, `category: CompanionCategory`, `context: string`, `help: CompanionHelp`, `cue: CompanionCue`, `phaseProgress: SharedValue<number>`, `scene: boolean`, `motionEnabled: boolean`, `backdrop: React.ReactNode`.

The component re-exports `CompanionPose`, `CompanionCategory`, `CompanionCue`, `CompanionHelp` and `CompanionVariant`. `MomentumCompanionProps` is exported. Categories accept recovery, protection, practice, learning, planning, account, commitment, movement, reflection and calm.

Help is `{title, body, actions?: [{label, onPress}]}`. At most two actions are displayed. Opening help awards nothing and invokes no action until its corresponding button is selected. Generic callers receive translated help keyed by their resolved pose. Technical context identifiers appear only in diagnostic test IDs, never in spoken accessibility labels.

A cue is `{id, pose, earned?: boolean}`. Only active visible callers consume it. The module registry survives React remounts and bounds transient IDs to 256; saved/celebrate poses default to earned. Earned IDs persist in the bounded `freed.companion.seen-earned.v1` SQLite-backed localStorage ledger when storage is available. Persistence failure still prevents replay in the current process; it cannot guarantee restart deduplication. Clearing/replacing a cue immediately restores the base pose. Its one 1800 ms presentation-expiry timer is cancelled during lifecycle changes and unmount.

## Motion and accessibility

- Spatial transforms and blinking run on the UI thread. No recurring frame timer runs on JavaScript.
- Existing `useMotionSettings` supplies foreground, navigation focus, viewport-visible and live OS Reduce Motion gates. The policy adds `motionEnabled` and committed `preferences.companionMotion === 'off'` gating through the nullable preference reader.
- Every owned animation is cancelled and restored to neutral when its gate closes or the component unmounts.
- Welcome uses one bounded gesture per context in the process registry. Earned reactions require a caller cue following a real durable save; this component never writes recovery outcomes.
- `phaseProgress` drives the breathing body's bounded 3.5% scale when allowed.
- The help sheet is static, scrollable, themed, safe-area padded, uses a header role and selectable body, exposes explicit close and Android request-close paths, and closes when the screen becomes inactive.
- Scenes and any supplied backdrop stay inside the component's bounded frame with no pointer interception.

## Verification evidence

Test-first failures were observed for the missing cue policy, absent contextual-help interaction, a cleared cue incorrectly retaining its saved pose, and a saved cue without an explicit earned flag failing restart deduplication. Each now passes.

- `node -- scripts/run-ts-entry.js tests/companion-policy.test.ts`: passed, including all lifecycle gates, variant/scene resolution, inactive cue deferral, remount/restart deduplication, invalid IDs, bounded capacity, corrupted/unwritable storage and default earned saved cues.
- `npx jest --runInBand --watch=false tests/ui/companion.test.tsx`: 5 passed, covering contextual help under Reduce Motion, explicit action selection, offscreen interaction, pose-specific default help, cleared-cue/remount behavior and background dismissal.
- `npm run typecheck`: passed after the package edits.
- `node -- scripts/localization-audit.js --strict --json`: zero errors and zero uncovered phrases after converting SVG transforms to standard comma-separated syntax.
- Rendered actual static SVG geometry into `.cache/companion-qa/rig-atlas.png` and inspected all 18 poses at once. Rendering uses a DOM SVG adapter and static animation values, so this is geometric evidence, not a native runtime animation capture.
- Full `npm run test:ui` was run: initial integration result was 14 suites passed / 10 failed (98 tests passed / 1 failed). Nine suites failed at the new root-owned backdrop's expo-image native import boundary: premium-offer, account-identity-text, protection-limited-exit, dns-race, library-screen, momentum-sections, encrypted-dns-section, momentum-day-boundaries and momentum-today. Preferences-screen's old exact accessibility-name expectation was the remaining failure. These were reported to the root task for shared test integration; they are not concealed as a passing whole-suite result.

## Remaining verification boundaries

Physical/native frame-rate measurement, full-motion recordings, VoiceOver/TalkBack page-sheet focus behavior, dynamic-type extremes and release-device performance are not certified by this package's local tests. Root owns native capture/build checks and shared-screen viewport integration. Raster backdrops/pose atlases are produced separately by root. This package does not add remote services, purchases or a recovery-outcome authority.

## Review follow-up: centralized lifecycle and deletion

The review follow-up moves viewport gating into `MomentumCompanion` itself using the existing root-owned `useCompanionViewport` hook and a non-collapsible measured wrapper. Direct Welcome/Profile/Section callers now share the same offscreen gate as wrapped headers. Parent visibility, native focus/foreground, OS Reduce Motion and committed motion preferences still gate the rig. Opening contextual help separately pauses the original rig and its viewport polling while leaving the help sheet available; closing it resumes only eligible motion. Hidden direct callers defer cue consumption until their own viewport becomes visible and expose no offscreen help button.

New export: `clearCompanionPresentationHistory(): void` from `@/components/MomentumCompanion`. Root can call it during explicit local-data deletion. It erases the optional earned ledger first and resets the process registry only after successful erasure. Deletion failure throws to root and leaves deduplication state intact. Registry instances also expose `clear()` for this behavior; adapters can use `removeItem`, with an empty-ledger write fallback for storage that only supports `setItem`.

Observed test-first failures: helper opening did not stop the original rig; a direct offscreen instance animated and consumed its cue; process history could not be cleared; registry clear was absent. Follow-up focused UI passed 8/8 tests (the original five plus helper pause/resume, central viewport cue deferral and explicit module-history reset). Policy tests pass with durable/transient registry erasure and observable failed deletion that preserves process deduplication. Strict localization remains zero errors / zero uncovered strings. The final package typecheck reported only four errors in root's new recovery-companion-cue.ts line 14: missing dailyHabitCompletions and derived implicit-any parameters. Root was notified; no owned avatar-file errors were reported. Final integrated typechecking and whole-suite/native checks remain owned by root.
