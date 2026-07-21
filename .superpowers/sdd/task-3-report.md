# Task 3 report: Android temporary Focus Shield calibration

## Status

Implemented a five-minute, service-owned Android calibration flow using only `TYPE_ACCESSIBILITY_OVERLAY`. A small FREED edge handle opens the selector, the selector hit-tests the active Accessibility node tree at the user's touch point, highlights an eligible target, and persists only after the user presses the native Confirm button.

Calibration accepts only the package-specific view IDs already allowlisted by the Focus Shield contract, plus a non-empty class/role and ancestor-role hints. Missing trees and targets that offer only text or screen position return `unsupported-tree` and store nothing. No manifest permission, permanent overlay, remote selector, iOS, React UI, or Firebase behavior was added.

Custom calibration fingerprints can be saved locally, but Task 2 enforcement still acts immediately only on vetted preset rules. The native success message says this explicitly rather than claiming arbitrary-app blocking.

## TDD evidence

### Initial RED

Added the three focused source-contract tests before production code, then ran:

```text
npm run test:core
```

Observed exit 1 at the first new test:

```text
FAIL Android Focus Shield calibration uses a five-minute Accessibility overlay without broad overlay permission
The input did not match /CALIBRATION_TIMEOUT_MS\s*=\s*5\s*\*\s*60_000L/
Input: ''
```

This was the expected missing-feature failure: `FreedFocusShieldCalibration.kt` did not exist.

### Lifecycle-race RED

Reviewing the first green implementation found a real start/cancel ordering issue: a bridge cancellation could arrive before the service's posted session-start callback. A focused assertion requiring main-thread queued teardown was added first. The next run failed at:

```text
FAIL Android Focus Shield calibration bridge exposes terminal cleanup states
The input did not match /internal fun stopFocusShieldCalibration...Looper...handler.post/
```

The service teardown now posts to its main Handler when called off-main, preserving start/cancel ordering, while the bridge reports cancellation immediately.

### GREEN

Subsequent core runs showed all Task 3 cases passing:

```text
PASS Android Focus Shield calibration uses a five-minute Accessibility overlay without broad overlay permission
PASS Android Focus Shield calibration stores only confirmed stable selector fingerprints
PASS Android Focus Shield calibration bridge exposes terminal cleanup states
```

The full core command continues past the Focus Shield tests and exits 1 later on the existing unrelated release-preflight fixture. That fixture expects the debug-keystore certificate error but now fails earlier because its temporary `FREED_ANDROID_UPLOAD_STORE_FILE` does not exist. No signing, preflight, fixture, or release configuration file was changed in Task 3.

## Implementation

- Added an in-memory calibration bridge tied by weak reference to the live `FreedAccessibilityService`.
- Rejects start unless Accessibility protection is enabled and the service is connected; it never requests draw-over-other-apps permission.
- Creates a branded edge handle and full-screen selector as temporary `TYPE_ACCESSIBILITY_OVERLAY` windows.
- Limits every session to exactly five minutes from overlay creation.
- Hit-tests `rootInActiveWindow` recursively using `getBoundsInScreen` and touch screen coordinates.
- Never reads node text or content descriptions and never retains an `AccessibilityNodeInfo` after hit-testing.
- Requires an exact package-specific allowlisted `viewIdResourceName`, node class/role, and non-empty ancestor roles.
- Keeps only the sanitized fingerprint fields supported by the existing local rule store: package, view ID, role, ancestor roles, and optional normalized bounds.
- Requires an explicit native Confirm action before calling `FreedFocusShieldRules.configure`.
- Removes all overlay views and candidate/session state on confirm, cancel, timeout, leaving the target app, service interruption, permission unbind/revocation, and service destruction.
- Exposes typed bridge states including `success`, `timeout`, `unsupported-tree`, `revoked-permission`, `app-switched`, and `service-interrupted` while retaining the existing states.
- Returns retry/preset guidance for unsupported trees and persists no rule on every unsupported/failure path.

## Modified files

- `modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt` (new)
- `modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt`
- `modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt`
- `modules/freed-protection/src/index.ts`
- `src/lib/focus-shield.ts`
- `tests/core.test.ts`
- `.superpowers/sdd/task-3-report.md`

## Verification

### TypeScript

```text
npm run typecheck
```

Result: exit 0 (`tsc --noEmit`).

### Android Kotlin compile

From `android`:

```text
ANDROID_HOME=/Users/soumyadebnath16/Library/Android/sdk ./gradlew :freed-protection:compileDebugKotlin
```

Result: exit 0, `BUILD SUCCESSFUL`, 45 actionable tasks (1 executed, 44 up-to-date).

### Core suite

```text
npm run test:core
```

Task 3 and prior Focus Shield tests: pass.

Overall result: exit 1 only at the unrelated pre-existing `release env preflight validates production store ad and AI configuration` fixture described above. Full-core status is therefore not reported as green.

### Source hygiene

`git diff --check` passes. The Android manifest still has neither `SYSTEM_ALERT_WINDOW` nor `USE_FULL_SCREEN_INTENT`, and `android:isAccessibilityTool` remains `false`.

## Physical-device follow-up

No physical-device validation is claimed. Device acceptance should verify overlay placement/touch behavior, active-window tree availability, vendor-ROM window event ordering, exact allowlisted view IDs in current YouTube/Instagram/TikTok builds, every teardown trigger, and that unsupported Compose/WebView trees return `unsupported-tree` without storing a rule.

## Blocking review follow-up

Review identified three integration defects in the first Task 3 commit:

1. A start callback already queued on the service Handler could still create an overlay after cancellation, interruption, unbind, destruction, or bridge-reported permission revocation.
2. The session ignored every event from FREED's package after reaching the target, so opening the actual FREED application could be mistaken for an overlay-origin event instead of an app switch.
3. The module bridge locally widened `FocusShieldCalibrationResult` while the central shared contract retained the old state union.

### Follow-up RED

Regression tests were added before the fixes. `npm run test:core` exited 1 at:

```text
FAIL Android Focus Shield calibration invalidates queued starts before terminal teardown
The input did not match /focusShieldCalibrationGeneration\s*=\s*AtomicLong/
```

The additional review tests also specify that only a FREED event whose exact window ID resolves to `TYPE_ACCESSIBILITY_OVERLAY` is ignored, and that every native state lives in the central Focus Shield contract.

### Follow-up implementation

- Added an atomic service generation counter. Each requested start captures a generation and checks it inside the posted callback before creating any session or overlay.
- `stopFocusShieldCalibration` invalidates the generation synchronously before it posts main-thread view teardown. This covers cancel, `onInterrupt`, `onUnbind`, `onDestroy`, and bridge permission revocation even when no session has been installed yet.
- Session-origin terminal results—including timeout, app switch, unsupported tree, confirmation, and selector cancellation—also invalidate the generation before clearing the service session.
- Replaced the blanket FREED-package exemption with exact Accessibility window discrimination. Overlay-origin events must match a window whose ID equals the event window ID and whose type is `TYPE_ACCESSIBILITY_OVERLAY`; a real FREED application window therefore produces `app-switched` after the target has been observed.
- Moved all native calibration states into `src/lib/focus-shield.ts`. The module bridge now imports and re-exports the central request/state/result types without a local duplicate union.

### Follow-up verification

- All six Task 3 source/behavior tests pass, including queued-start invalidation, window-aware app-switch handling, and central contract coverage.
- `npm run typecheck`: exit 0.
- `ANDROID_HOME=/Users/soumyadebnath16/Library/Android/sdk ./gradlew :freed-protection:compileDebugKotlin`: exit 0, `BUILD SUCCESSFUL`.
- Full `npm run test:core`: continues past all Task 3 tests and exits 1 only at the same unrelated release-signing fixture documented above.

Physical-device validation remains necessary for OEM Accessibility window enumeration behavior. Overlay-origin events are ignored only when their window type is proven; all other departure decisions require a separately confirmed active/focused application window.

## Second blocking review follow-up

A second review identified three remaining fail-closed gaps:

1. An invalid-request start and the native module's missing-React-context start returned terminal results without first invalidating an older queued or active calibration.
2. The edge-handle `addView` was covered by the outer start catch, but the selector overlay was added later from a click listener with no WindowManager exception boundary.
3. Any non-target package event could still end calibration, including transient System UI, IME, content, text, and scroll events while the selected app remained foreground.

### Second follow-up RED

Source/behavior regressions were added first. The initial run exited 1 at the foreground-window requirement:

```text
FAIL Android Focus Shield distinguishes its overlay events from a real FREED app switch
The input did not match /AccessibilityEvent\.TYPE_WINDOW_STATE_CHANGED/
```

During the first green review, a stricter overlay cleanup assertion was added and observed failing because overlay references were assigned only after `WindowManager.addView` returned:

```text
FAIL Android Focus Shield overlay attachment failures terminate and clean the session
edge.indexOf("handleView = handle") < edge.indexOf("addOverlayView(handle, params)") was false
```

This proved a partially attached view could not be found by terminal cleanup if `addView` threw after attaching it.

### Second follow-up implementation

- Added `FreedFocusShieldCalibrationBridge.failStart`. It calls `stopFocusShieldCalibration("failed", ...)` before publishing the failed result, so the service generation changes synchronously and any earlier posted start becomes stale.
- Invalid request parsing and the native module's unavailable React context both use `failStart`; neither can leave an older handle/session alive.
- Routed both WindowManager additions through `addOverlayView`, which catches every `Exception`, emits terminal `failed`, and runs normal overlay/candidate cleanup.
- Registers handle and selector view references before attempting `addView`, allowing cleanup to remove a view even if WindowManager partially attached it before throwing.
- App-switch evaluation now ignores content/text/scroll events and considers only `TYPE_WINDOW_STATE_CHANGED` or `TYPE_WINDOWS_CHANGED` transitions.
- A departure is emitted only when an active/focused `TYPE_APPLICATION` window can be resolved and its root package differs from the calibration target. Overlay, System UI, and IME window types cannot by themselves trigger departure; a real FREED or other application foreground window still tears down safely.

### Second follow-up verification

- All Task 3 tests pass, including the new failed-start generation simulation, guarded overlay attachment/cleanup assertions, and foreground application-window behavior matrix.
- `npm run typecheck`: exit 0.
- `ANDROID_HOME=/Users/soumyadebnath16/Library/Android/sdk ./gradlew :freed-protection:compileDebugKotlin`: exit 0, `BUILD SUCCESSFUL`.
- Full `npm run test:core`: passes all Task 3 tests and exits 1 only at the unchanged unrelated release-signing preflight fixture.

Physical-device validation is still required for OEM window metadata. If Accessibility does not expose an active/focused application window during a transition, calibration retains its five-minute timeout instead of using an unconfirmed package event to tear down.
