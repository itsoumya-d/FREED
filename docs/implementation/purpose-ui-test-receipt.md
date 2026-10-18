# Purpose-flow UI behavioral tests — 2026-10-03

This package writes only `tests/ui/purpose-tools.test.tsx`, `tests/ui/purpose-protection-purchase.test.tsx` and this report. No application, core, native, source-gate or existing test files were edited. No commits or subagents were created.

## Coverage and boundaries

`purpose-tools.test.tsx` renders the real JournalScreen, FunctionalBreathingScreen, ToolCompletionView, recovery draft hook and breathing session/monotonic clock. Its illustrated MomentumBreathingView is replaced by a callback-compatible control fixture. Companion artwork/icons and native lifecycle/haptic/storage boundaries are mocked; elapsed-time, receipt, save and cleanup behavior are real. Modern Jest timers advance Date and performance time together. A real i18next provider and actual theme palette are used with the preference boundary configured to light mode.

It checks:

- Journal opens into writing, never invents mood/urge answers, and requires authored words before saving.
- Exact private Unicode/whitespace input survives navigation, failed saving and retry; successful saving clears scratch space.
- Journal scratch erasure after a durable commit must remain retryable without another durable write.
- A reopened draft after midnight retains its authored day and words, requires explicit transfer, and saves only the same note under today's date.
- Haptic preference changes leave actual active time advancing.
- Explicit pause, background and waiting after foreground are excluded from duration; resumption is explicit.
- Finishing before midnight and saving afterwards passes the original finish date and Date timestamp to the durable callback.
- Meditation marking and helpfulness are optional user choices; neither is invented.
- Failed breathing saving retains its receipt and allows identical retry; later save taps do not duplicate the durable callback.
- A durable breathing save followed by scratch cleanup failure reports saved state and retries only cleanup.

`purpose-protection-purchase.test.tsx` keeps the real purpose permission/readiness contracts, ProtectionFeatureSetup, account operation gate, paywall presenter and PremiumOffer. It mocks only system permission/settings APIs, remote feed synchronization, store metadata, Firebase-native readiness boundaries and decorative artwork. A stateful parent publishes observed fresh native status after refresh rather than granting permission from a click.

It checks:

- Apple website policy setup authorizes/applies the policy without choosing app targets.
- Denied authorization remains incomplete and recovery exit stays reachable.
- Android app-only setup routes to package selection with no feed or website requirements.
- Previously selected Android packages synchronize through app-only setup even while DNS remains unset.
- Store-localized prices cannot enable checkout until current-owner server readiness resolves.
- Empty inventory and network failure show distinct actionable messages.
- A stale prior-owner readiness response cannot enable the newly signed-in owner's checkout.
- Busy checkout rejects repeated purchase while Continue with Free remains reachable.

## Observed results

Command:

```sh
npx jest --runInBand --watch=false tests/ui/purpose-tools.test.tsx tests/ui/purpose-protection-purchase.test.tsx
```

Latest result after root repairs: **18 passed / 0 failed, 18 total** across both suites (Jest runtime 2.05 seconds). Protection/purchase suite: **8/8 passed**. Tools suite: **10/10 passed**. The preceding run had 16 passed / 2 failed and exposed the production defects below. Initial assertion-only mismatches from exact text-content matching were corrected to pattern matching before reporting those genuine failures.

`npm run typecheck` passed with both new test files.

## Production bugs reported to root and repaired

1. **Journal scratch cleanup retry is unreachable.** `JournalScreen.tsx` disables `journal-save` whenever `draft.committed` is true. A durable save followed by `removeItem` failure leaves the draft committed and displays “try Save again,” but the disabled control cannot invoke the hook's already-deduplicated cleanup retry. Test: “Journal cleanup failure allows cleanup retry without a second durable write.” After a second press, navigation remains uncalled and the draft remains in storage.
2. **Breathing offers an unrecorded exit after recording already succeeded.** `ToolCompletionView.tsx` retains “Leave without recording” after its durable callback succeeds and cleanup fails. Its saved-state alert and Continue action are truthful, but that alternative action falsely describes an already-recorded session. Test: “scratch cleanup failure after durable breathing save is truthful and Continue retries only cleanup.” Hide or relabel the unsaved-discard action once `savedVisible` is true.

Root repaired Journal/CheckIn disabled expressions so a committed entry with a cleanup error can retry cleanup through the already-deduplicated draft hook. Root also hides the unsaved-discard action once breathing `savedVisible` is true. The tests were retained without weakening either expectation. The fresh post-repair focused run passes all 18 tests; `npm run typecheck` also passes on the current sources.

## Uncertified behavior

These are behavioral component tests, not native visual/animation captures, actual App Store/Play billing, Firebase server verification, permission prompts, installed Android picker UI or real blocking evidence. App picker coverage exercises the purpose-specific routing/sync boundary; the monolith's actual picker screen remains in root's integration denominator. Only English/light-mode UI is rendered here; translation topology and other theme/device evidence are owned elsewhere.


## Reset-latch caller repair — October 4

Root added `tests/ui/protection-reactivation.test.tsx` for the explicit user action: rendering the resume screen does not activate native configuration; a failed press shows repair guidance; recovery exit remains reachable. Three separate contract tests verify strict acknowledgment, activation → serialized sync → fresh status ordering, truthful inactive results, and off-by-default new schedules with preserved stored choices.

The full current UI run passed **28 suites / 221 tests**. The intent/readiness suite passed **15 tests**, including cached active fields overridden by the reset latch. TypeScript and the separate current-source web export passed. Read-only caller review found no actionable issue. These checks do not prove native reset races, socket teardown, extension enforcement, or physical-device behavior.
