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
