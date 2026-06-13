# Android Post-Paywall Protection Recovery

## Objective

Make FREED's Android post-paywall protection setup simple, understandable, non-cluttered, and actually functional on a USB-debugging physical Android device.

## Original Request

The user said the app is excellent before the paywall, but after the paywall the "turn on real permission" screen is cluttered, scrolling, confusing, and the continue/actions do not work. They want the Android device tested through USB debugging, real permission routing fixed, real adult-content blocking verified safely, and later engagement screens audited after activation.

## Intake Summary

- Input shape: `recovery`
- Audience: Android users who have just passed the paywall and need protection activated without confusion.
- Authority: `approved`
- Proof type: `demo`
- Completion proof: a physical-device walkthrough proves paywall-to-activation setup works with one clear next action, required Android permissions route correctly, app return refreshes state, Test Protection passes, real adult-domain/search host attempts are blocked or routed to challenge, and normal browsing remains allowed.
- Goal oracle: USB Android physical-device walkthrough plus sanitized host-level protection evidence.
- Likely misfire: polishing the setup screen or adding more diagnostics without proving that the permissions and actual blocking work on device.
- Blind spots considered: release APK is currently stale because local release builds hit CMake exit 137; proof should use debug-device builds first and keep release/store work separate. Adult-content proof must avoid explicit screenshots, raw browsing history, and private user data.
- Existing plan facts: use a one-step wizard, debug-device builds, host-level adult-domain proof, and audit post-setup engagement screens only after Android setup proof is green.

## Goal Oracle

The oracle for this goal is:

`On a USB-debugging physical Android device, a debug build completes the post-paywall protection setup through a one-step wizard, routes each required OS permission correctly, auto-refreshes and advances on return, runs Test Protection successfully, blocks or challenges real adult-domain/search host attempts, and allows normal browsing, with sanitized host-level evidence only.`

The PM must keep comparing task receipts to this oracle. Planning, discovery, a passing tiny slice, or a clean-looking board is not enough. The goal finishes only when a final Judge/PM audit maps receipts and verification back to this oracle and records `full_outcome_complete: true`.

## Goal Kind

`recovery`

## Current Tranche

First recover the Android post-paywall setup and protection activation path. Use debug-device builds for the fast proof loop. Keep Play-ready APK/AAB, EAS auth, App Store / Play Store launch, payments, legal hosting, and release signing outside this tranche unless they directly block physical-device setup proof.

After Android setup proof is green, audit the post-activation engagement screens and queue only the highest-impact verified fixes needed for a coherent usable app.

## Non-Negotiable Constraints

- Main setup surface must not be a cluttered scrolling diagnostics page.
- Default setup path must show one clear next action at a time.
- Android OS consent cannot be bypassed; the app must open the exact settings/consent surface, refresh on return, and advance automatically.
- Diagnostics, policy text, counters, and route details belong behind an Advanced/Details affordance.
- Physical-device adult blocking proof must be host-level and sanitized: no explicit-content screenshots, raw browsing history, private user data, or adult media capture.
- Debug-device builds are acceptable for the first proof loop.
- Current release APK/AAB readiness remains separate because local release builds hit CMake exit 137 on this host.

## Stop Rule

Stop only when a final audit proves the full original outcome is complete.

Do not stop after planning, discovery, or Judge selection if a safe Worker task can be activated.

Do not stop after a single verified Worker package when the broader owner outcome still has safe local follow-up work. Advance the board to the next highest-leverage safe Worker package and continue unless a phase, risk, rejected-verification, ambiguity, or final-completion review is due.

Do not create one Worker/Judge pair per repeated UI control, permission row, helper, or evidence artifact. Put repeated same-shape work into one Worker package and review the package as a whole.

Do not stop because a slice needs owner input, credentials, production access, destructive operations, or policy decisions. Mark that exact slice blocked with a receipt, create the smallest safe follow-up or workaround task, and continue all local, non-destructive work that can still move the goal toward the full outcome.

## Slice Sizing

Safe means bounded, explicit, verified, and reversible. It does not mean tiny.

A good task is the largest safe useful slice.

Small is not the goal. Useful is the goal.

A Worker should finish the whole assigned slice. A Judge should judge the whole assigned slice. A PM should reorient the board when tasks are safe but not moving the outcome.

Tiny tasks are allowed when the failure is isolated, the risk is high, the scope is unknown, or the tiny task unlocks a larger slice. Tiny tasks are bad when they keep happening, do not change behavior, only add wrappers/contracts/proof files, or avoid the real milestone.

## Canonical Board

Machine truth lives at:

`docs/goals/android-setup-activation-recovery/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/android-setup-activation-recovery/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available and mention a newer version without blocking.
4. Re-check the intake: original request, input shape, authority, proof, blind spots, existing plan facts, and likely misfire.
5. Work only on the active board task.
6. Assign Scout, Judge, Worker, or PM according to the task.
7. Write a compact task receipt.
8. Update the board.
9. If safe local work remains, choose the next largest reversible Worker package and continue unless blocked.
10. Review at phase, risk, rejected-verification, ambiguity, or final-completion boundaries; do not review every small Worker by habit.
11. Finish only with a Judge/PM audit receipt that maps receipts and verification back to the original user outcome and records `full_outcome_complete: true`.
