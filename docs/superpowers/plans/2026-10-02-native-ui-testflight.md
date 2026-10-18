# FREED native UI and complete-feature TestFlight implementation

Approved by the user on 2026-10-02. The full plan is in the conversation; this file records the execution sequence and interfaces.

Goal: verify every current feature, improve all non-paywall screens, complete Apple/Google/email accounts on both platforms, connect production services, and publish an owner TestFlight build.

Constraints: preserve current recovery data and all existing changes; keep the paywall appearance and two-plan catalog unchanged; never imply physical protection or live service proof from static checks; no public release before phone validation.

- [ ] Baseline: local-calendar report fixtures; truthful per-platform feature evidence; dependency exposure assessment.
- [ ] Native navigation: one persistent app controller, four NativeTabs with per-tab stacks, full-attention root flows, native back behavior, one-tap SOS.
- [ ] Accounts: coordinated Apple/Google/email signup, login, reset, verification, linking, recent auth and deletion; Android Apple uses Firebase OAuth.
- [ ] Challenge lifecycle: foreground time, resumable durable sessions, aggregate verification, explicit connection confirmation, capability alternatives, once-only completion.
- [ ] Screen polish: semantic light/dark surfaces, native typography and controls, reduced repetition, purposeful motion and all failure states; Appllama reference research and simulator recordings.
- [ ] Firebase services: recheck billing, configure credentials and App Check, deploy required services, prove live behavior before enabling flags.
- [ ] Release: fresh terminal/backend/native verification, distribution entitlements/signing, explicit TestFlight profile, upload and owner group.

Integration interfaces: AccountAccessScreen owns account UI with onConnected(email), onSkip and linkExisting. Challenge session hook returns durable session, elapsedSec, start/resume/pause/abandon/claimCompletion. Native route renderer consumes the shared app controller without mounting another copy of its effects.

Execution receipt: docs/runbooks/native-ui-testflight-progress.md. Root coordinates route/UI work, independent workers own auth, challenge helpers, and evidence. Final build receipts must include source/build hashes; owner/device and secure-credential dependencies remain explicit.
