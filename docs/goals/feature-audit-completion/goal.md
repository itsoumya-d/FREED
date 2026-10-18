# Goal Charter — FREED Full Feature Audit & Production Completion

## Original request

Perform a complete audit of this codebase and bring every existing feature to 100%
functional, production-quality status — UI, interactions, and motion/animation systems
included. Do NOT integrate real ads yet. Work proceeds in three phases: (1) Discovery —
walk the entire codebase including native layers and produce a feature inventory BEFORE
touching any code; (2) Gap analysis — missing/broken/half-implemented/inconsistent work,
cross-platform parity gaps, UI/UX and motion inconsistencies, placeholders/mocks/TODOs;
(3) Fix & complete — every button/gesture/interaction works, every UI state handled
(loading/empty/error/success), every animation smooth and consistent with the design
system, cross-platform parity. Real ad network integration is explicitly EXCLUDED; ad
surfaces use test/mock ad units so flows behave as if ads are live, with clear markers
for where the real SDK swaps in later.

Deliverables: (a) Phase-1 feature inventory as a checklist, (b) summary of what was
broken/missing and what was fixed, (c) confirmation of test-ad placeholders used with a
clear marker/TODO for future real ad SDK integration.

### Reaffirmed and widened — 2026-09-26 intake round

The user restated the goal with three new mandatory dimensions and asked for fixes, not
a report:

> "Research about all the features we are providing to this app... all the mobile app
> features especially. Deep down their functionality, how they actually function, how the
> functionality should work. And every feature and functionality, and the data accuracy is
> there or not. If there are some data accuracy problems or some problem, I want you to fix
> that. Understand each and every code — what the code purpose is, what native features it
> needs, what functionality it needs, everything about the code. Then practically, every
> single feature, every single functionality, how it will work on the user end. What feature
> in Android and iOS does not work. What data it was showing, like the streaks and all the
> features — is this accurate for all users or not. Where we need improvement to make the
> functionality 100% ready, and then do it."

Resolved intake answers from the diagnostic round:

1. **Board ownership** — extend THIS board as the single source of work; do not open a
   competing board over the same files.
2. **Proof ceiling** — deterministic time-frozen tests are the gate for every derived value;
   native-only behavior additionally requires real adb/emulator/simulator evidence; a claim
   with no reachable device is recorded `blocked` with a receipt, never silently "verified".
3. **Blast radius** — full (shared TS/state layer, persistence/derivation layer including
   storage-schema migration, `modules/`, `ios/`, `android/`, `functions/`), but only inside a
   Judge-specced slice, each gated by tests **plus** an "existing saved data still loads
   correctly" migration test.

## Interpreted outcome

Every feature that exists in FREED works end-to-end on both platforms with complete UI
state coverage, polished motion consistent with the design system, and mock/test ad
surfaces marked for later real-SDK swap-in — proven by a receipt-backed feature
inventory plus green per-platform verification.

## Intake classification

- Input shape: `existing_plan` (user supplied a detailed 3-phase plan; preserve it,
  validate it, then execute it as bounded Worker slices)
- Authority: `requested`
- Proof type: `artifact` (inventory checklist + fix summary) backed by `test`/`demo`
  evidence per feature
- Audience: consumer app users; quality bar is "best in category", not "technically works"

## Goal oracle

The live signal that keeps pressure on this goal:

1. Per-platform verification is green (typecheck/lint/tests/build commands discovered in
   T002 — do not assume them).
2. The feature inventory shows every discovered feature at status `working`, each with
   evidence covering its interaction paths and empty/loading/error/success states, or is
   explicitly `blocked` with a receipt naming the missing requirement.
3. Every ad surface contains a test/mock unit plus a machine-findable marker comment
   (e.g. `TODO(AD-SDK):`) naming where real integration goes.
4. **Data accuracy (new):** every user-visible derived value — streaks, best/current
   streak, counters, totals, success counts, slip counts, days-installed, timers,
   countdowns, reset/unlock allowances, usage minutes, level/tier, progress percentages,
   reminders, and any charted history — has a named single source of truth and a
   deterministic test proving it stays correct across local-midnight crossing, timezone
   change, DST transition, device clock change, app kill/reboot, reinstall/restore, and a
   second device on the same account. Any value that fails is fixed, not documented.
5. **Native capability truth (new):** every feature that needs a native capability has a
   declared requirement (permission, API, background mode, OS-version floor) and a stated
   degradation path when that capability is denied or unavailable.
6. **Per-platform verdict (new):** every feature carries an explicit `Android: working |
   broken | degraded | unproven` and `iOS: working | broken | degraded | unproven` verdict,
   where `unproven` is only admissible with a receipt naming the missing device/simulator.
7. **Saved-data safety (new):** no slice may change the persistence schema or derivation
   logic without a test proving a real pre-change saved payload still loads and displays
   the same values it did before.
8. Final Judge audit maps receipts to the original outcome.

Cadence: re-check after each Worker package and at final audit.

## Non-negotiable constraints

- NO real ad network SDK integration. Test/mock ad units only, visually and behaviorally
  realistic, each marked with a `TODO(AD-SDK)`-style marker pointing at the future swap-in.
- Inventory BEFORE code changes (Phase 1 precedes Phase 3; no skipping to fixes).
- Cross-platform parity: iOS and Android must behave consistently; native folders
  (`ios/`, `android/`) and native modules (`modules/`) are in scope alongside the shared
  TS/JS layer (`app/`, `src/`, `store/`), backend (`functions/`, Firebase, Supabase).
- Complete existing features; do not invent net-new features.
- All four UI states (loading/empty/error/success) per interactive surface.
- Motion must match the project's design system (`design/`), not ad-hoc animation.
- Quality bar: best-in-category consumer polish.
- **No derived user-facing number may remain unproven.** If a streak/counter/stat cannot be
  shown correct by a deterministic test, that is a gap to fix, not a caveat to ship.
- **Day boundaries are local-calendar, not floating/UTC-millisecond, arithmetic** unless a
  receipt justifies otherwise and a DST + timezone-change test proves it safe.
- **Persisted-data compatibility is sacred.** Any storage-key, schema, or serialization
  change ships with a migration plus a "pre-change payload still loads" test. Users must not
  lose streaks, history, entitlements, or settings because we refactored.
- **Native claims need devices.** A native capability is only `working` with real
  adb/emulator/simulator evidence. When no device is reachable, mark the task `blocked` with
  a receipt naming the missing requirement and continue other local work.
- **One board, one writer.** This board owns these files; do not schedule slices that fight
  `docs/goals/android-setup-activation-recovery/` over the same protection/activation files
  without a receipt recording the coordination.

## Likely misfire (PM must audit against this)

- Doing the audit and stopping without executing fixes (planning-is-not-completion).
- Rewriting or inventing features instead of completing what exists.
- Integrating a real ad SDK "because it was easier".
- Fixing one platform while regressing the other.
- Marking a feature done with stubbed states, missing error handling, or janky motion.
- Assuming verification commands that were never discovered/verified.
- **Reporting** on data accuracy instead of fixing it — the user's instruction ends with
  "and then do it".
- Proving a streak on a happy path and declaring it "accurate for all users"; accuracy claims
  need the boundary cases (midnight, DST, timezone move, clock change, reinstall, reboot,
  second device).
- Equating "the number on screen looks right" with "the number is derived correctly" — a stale
  or double-incremented render can display a plausible value while the stored state is wrong.
- Accepting "works on my emulator" as cross-platform truth.
- Fixing one feature's logic while destroying another feature's previously saved data.

## Blind spots considered

- This is an Expo/React Native app with native `ios/` + `android/` folders — "Swift/
  Kotlin parity" here means the shared TS layer plus native modules behaving identically
  on both platforms, not two separate codebases.
- Verification tooling is unknown until mapped (tests exist under `tests/`; scripts exist
  in `package.json` / `scripts/`).
- "100% functional" is unbounded until the inventory exists — the tranche bounds it:
  successive verified slices until every inventory row is working or blocked-with-receipt.
- An older goal `docs/goals/android-setup-activation-recovery/` exists; PM must check for
  overlapping in-flight work before scheduling conflicting slices.
- Ad-surface locations are unknown until discovery; they may be stubs, mocks, or absent.
- **Accuracy is a trust question, not just an arithmetic question.** Users can move their
  device clock backward or forward; the app must decide per value whether it trusts wall
  clock, monotonic uptime, or persisted anchors — and that decision has not been made
  explicitly anywhere.
- T001 found the entire UI lives in one ~9,241-line `src/features/freed-app.tsx` state
  machine, so a "single source of truth" for streaks/counters may not exist; the same value
  can be derived in several places with different rules.
- T001 left the canonical-backend question open (Vercel routes vs Firebase Functions for
  purchases/analytics/AI). Whether a stat is device-local or server-derived changes what
  "accurate for all users" even means, and it changes multi-device behavior.
- The two platforms are not symmetric at the OS level: Android usage-stats/DNS/VPN-style
  filtering, overlay, and notification-grant rules differ materially from iOS Device
  Activity/Screen Time extensions, share-extension limits, and App-Bound Domains. Some
  "same feature" may be technically or policy-wise impossible on one side; the honest output
  is a per-platform verdict plus a product decision, not a fake parity claim.
- A physical iOS device or booted simulator may not be reachable in this environment; iOS-only
  native claims may have to land as `blocked`-with-receipt rather than verified.
- The worktree is already dirty (incl. `docs/completion-audit.md` and validation artifacts),
  so "current behavior" must be read from the working tree, not from `HEAD`.

## Tranche definition

Discover the complete feature inventory, validate acceptance criteria per feature, then
complete successive safe verified Worker slices (largest-first by user impact) until
every inventory row is `working` with state + motion evidence, test-ad markers are in
place, and the three deliverables exist. Then final audit.

Widened tranche (2026-09-26): discovery now must also produce (a) a per-value data-accuracy
verdict table, (b) a native-capability requirement matrix, and (c) per-platform
Android/iOS verdicts including observed user-end behavior; execution continues through
successive verified Worker slices until every defect found by those three maps is fixed,
with saved-data migration safety proven on each slice that touches persistence.

## Current board sequencing

`state.yaml` remains machine truth; this is the intended order only:

1. `T001` **done** — feature inventory (58 features / 20 domains).
2. `T002` **active** — verification + tooling truth, now including frozen-clock test
   capability, headless store harness availability, and adb/simulator reachability.
3. `T005` queued — per-value data-accuracy verdict table (streaks, counters, timers,
   totals) under midnight / timezone / DST / clock-change / reboot / reinstall / second
   device.
4. `T006` queued — native-capability requirement matrix + Android and iOS verdicts.
5. `T007` queued — observed user-end behavior walkthrough.
6. `T003` queued (Judge) — validate, rank defects by user harm, spec the first bounded
   Worker slice with `allowed_files` / `verify` / `stop_if`.
7. `T004` queued (Worker) — first fix slice; PM queues further Worker slices as needed.
8. `T999` queued (Judge) — final audit; the only path to `full_outcome_complete: true`.

## Continuation

```text
Codex:       /goal Follow docs/goals/feature-audit-completion/goal.md.
Claude Code: /goalbuddy Follow docs/goals/feature-audit-completion/goal.md.
```
