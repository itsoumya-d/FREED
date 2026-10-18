# FREED feature verification from the terminal

The canonical runner links every row in the [99-feature ledger](../validation/artifacts/2026-10-02-native-ui-testflight/feature-ledger.json) to related local tests, native UI smoke flows, and explicit execution obligations. The generated catalog has 297 feature-specific scenarios and 527 required checks. TestFlight is an iOS-only requirement. Run it from the FREED repository:

```sh
node scripts/run-feature-verification.js --mode list
node scripts/run-feature-verification.js --mode all --plan
node scripts/run-feature-verification.js --mode local
node --test tests/feature-test-manifest.test.js
```

`--feature feature-048` selects one exact feature; `--flow breathing` selects the features associated with one UI flow. All test files under `tests/` ending in `.test.ts`, `.test.js`, or `.test.mjs` run in local mode unless a feature/flow is selected. TypeScript uses the existing `scripts/run-ts-entry.js` wrapper. Tests run sequentially, with bounded child memory and a default three-minute timeout per file; use `--timeout-ms 600000` when a slow machine needs ten minutes. The runner continues after a failure so the report includes the remaining results.

| Mode | What executes | What a pass establishes |
|---|---|---|
| `local` | Repository test files, one process at a time | Related local logic and contract checks; some existing suites inspect source contracts. This does not establish native UI or live service execution. |
| `emulator` | Functions build, then Auth/Firestore/Storage/Functions emulators on `demo-freed-feature-verification`, tests at concurrency 1 | Isolated backend behavior. Full feature scenarios still require receipts; skipped emulator tests remain incomplete. |
| `ios` / `android` | Receipt validation; Maestro only with `--run-ui` plus a disposable fixture | Native flow smoke plus artifact-backed full scenario proof. A successful screen flow alone stays blocked. |
| `live` | Validates staging/sandbox execution receipts | Real deployed service behavior tied to a deployment and isolated environment. The runner performs no production writes, real mail delivery or purchases. |
| `device` | Validates signed physical-device receipts | Native permissions, enforcement, sensors, store callbacks, accessibility and measured motion. Simulator video never satisfies this mode. |
| `all` | Runs local tests and validates all available receipts | Every required layer is assessed; missing evidence remains explicit. Emulator and device control require their separate commands. |
| `list` / `--plan` | Writes the catalog or a report without executing tests/devices/services | A complete list of obligations; every execution status is `not-run`. |

Reports are written only beneath `docs/validation/artifacts/<run-id>/`. Each report has a JSON file, a concise Markdown ledger, per-suite logs and SHA-256 hashes. `requestedSummary` covers the chosen mode; `allRequiredChecks` includes every layer; `fullFeatureSummary` reports complete features. Do not describe the local percentage as full feature coverage. Counts parsed from custom legacy test output are observed counts, not an instrumented line/branch coverage measurement.

The statuses are `passed`, `failed`, `blocked`, and `not-run`. There is no success-by-skip status. Exit code `0` means requested checks passed, `1` means a failed process/assertion, and `2` means blocked or not-run checks. `--allow-incomplete` allows an exploratory blocked report to exit `0`; it never changes statuses, removes denominators, or suppresses failures.

## Native UI smoke on a disposable fixture

The 47 [Maestro flows](../../.maestro/flows/README.md) use current visible/accessibility labels and React Native `testID` selectors. They include navigation, onboarding, account validation/reset forms, check-in and slip saving, breathing, Library/articles, progress, Shield preferences/diagnostics, backup, privacy, reminders and Premium free exit. Store/server effects and destructive actions require dedicated receipts beyond these smoke assertions. A flow cannot prove every state of its associated features.

Maestro reads the native accessibility tree and maps React Native `testID` to an ID selector. It can exercise an installed standalone binary without adding a dependency inside FREED. See the official [React Native guide](https://docs.maestro.dev/get-started/supported-platform/react-native), [device targeting](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/specify-and-start-devices), and [report options](https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts).

Install the CLI using the official [Maestro installation instructions](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli). Java 17 or newer is required. The runner looks for `FREED_MAESTRO_BIN`, `~/.maestro/bin/maestro`, a Homebrew install, then `maestro` on PATH.

Create a **new**, explicitly disposable simulator or emulator and install the final app build on it. The runner never creates, erases or clears a device. It explicitly refuses the owner's existing iPhone simulator `20494937-BC1B-427D-92B4-914FD9C1848D`. Coordinate native control with anyone else using the Simulator before running a flow.

Save an isolation file containing the actual new target ID:

```json
{
  "schemaVersion": "freed-disposable-ui-fixture-v1",
  "deviceId": "REPLACE_WITH_NEW_DISPOSABLE_DEVICE_ID",
  "platform": "ios",
  "disposable": true,
  "dataOwner": "test-only",
  "services": "disabled",
  "allowRealEmail": false,
  "allowRealPurchases": false,
  "allowRealMessages": false
}
```

The example is a format illustration and is not device evidence. `services` can be `disabled`, `emulator`, or `sandbox`; it must describe the installed build's actual configuration. `external-service` flows are blocked when services are disabled. Account creation/verification is additionally restricted to the Auth emulator and uses a disposable `example.invalid` address. Do not label a production-connected build as sandbox. Isolate accounts, contact recipients, mailboxes, store tester accounts and backend collections before running a service-dependent scenario.

```sh
node scripts/run-feature-verification.js --mode ios --feature feature-047 \
  --run-ui --device DISPOSABLE_DEVICE_ID --isolation fixture.json
node scripts/run-feature-verification.js --mode android --flow root-navigation \
  --run-ui --device DISPOSABLE_EMULATOR_ID --isolation fixture.json
```

Maestro `launchApp` can clear app data or the entire Keychain when requested; the official [launchApp reference](https://docs.maestro.dev/reference/commands-available/launchapp) documents those options. These flows use navigation links without either reset. `local-write` flows change only disposable local history. Deletion smoke stops at confirmation; store smoke does not complete checkout; accountability smoke never sends a message. Do not run a flow folder directly on the owner's device.

## Full execution receipts

Use `--mode list` to inspect a feature's exact `requirements[].id` and `assertions[]`. Store actual execution receipts and sanitized artifacts together. The receipt file uses this envelope:

```json
{
  "schemaVersion": "freed-feature-execution-receipts-v1",
  "sanitized": true,
  "receipts": []
}
```

Append one receipt for each actual requirement. A passing receipt must have: `requirementId`, `status: "passed"`, recent `generatedAt` (within 72 hours), the SHA-256 of the installed binary as `appBuildSha256`, the platform, actual device identity for native checks, and every required assertion with `status: "passed"` and an artifact path. `artifacts` contains relative paths and actual SHA-256 hashes. Supply `--build-sha256` for the current installed binary; passed receipts are blocked without that current-build binding. The validator rejects missing files, symlinks, traversal paths, changed hashes, stale timestamps, wrong platforms and mismatched builds. Source inspection and operator-authored plans are not runtime evidence.

```json
{
  "requirementId": "feature-048:ios",
  "status": "passed",
  "generatedAt": "ACTUAL_EXECUTION_UTC_TIME",
  "appBuildSha256": "ACTUAL_64_CHARACTER_BINARY_HASH",
  "platform": "ios",
  "device": { "id": "ACTUAL_DISPOSABLE_DEVICE_ID", "physical": false },
  "assertions": [
    { "id": "feature-048:scenario-1", "status": "passed", "artifact": "checkin-values.log" },
    { "id": "feature-048:scenario-2", "status": "passed", "artifact": "same-day-update.log" },
    { "id": "feature-048:scenario-3", "status": "passed", "artifact": "restart-redaction.log" }
  ],
  "artifacts": [
    { "path": "checkin-values.log", "sha256": "ACTUAL_ARTIFACT_HASH" },
    { "path": "same-day-update.log", "sha256": "ACTUAL_ARTIFACT_HASH" },
    { "path": "restart-redaction.log", "sha256": "ACTUAL_ARTIFACT_HASH" }
  ]
}
```

This intentionally invalid illustration must be replaced by real output; the runner does not generate passing scenario receipts from a checklist. A blocked or failed receipt instead supplies its status and a concrete reason. Live receipts additionally require `service.environment`, `service.deployment`, and `service.sandbox: true`. Device receipts require `device.physical: true` and a signed installed build. Artifact hashes bind recorded evidence; they do not replace review of whether the artifact actually demonstrates its assertion.

```sh
node scripts/run-feature-verification.js --mode live --evidence receipts.json \
  --build-sha256 ACTUAL_BINARY_SHA256
node scripts/run-feature-verification.js --mode device --evidence receipts.json \
  --build-sha256 ACTUAL_BINARY_SHA256
node scripts/run-feature-verification.js --mode all --evidence receipts.json \
  --build-sha256 ACTUAL_BINARY_SHA256
```

## UI states, accessibility and motion

For each screen and control, exercise default/empty, selected/unselected, loading/busy, disabled, success, error, offline, cancellation, restart/background/return, permission denied/revoked and account-changed states when applicable. Explicitly record a state's precondition, action and observable outcome; do not substitute source text. Repeat at large Dynamic Type/font scale and with the keyboard shown. Check VoiceOver/TalkBack labels, focus order, hit targets, contrast, route Back behavior and reachable free/safety actions. Each physical UI requirement explicitly includes `motion-normal`, `motion-reduced`, `large-text`, `keyboard-and-back`, and `accessibility` assertions.

For motion, capture a native frame trace using Instruments/xctrace on iOS or Perfetto/Android frame metrics on Android. A physical UI receipt must include `motion.measured: true`, tool identity, at least ten seconds, frame count, target refresh rate at least 60 Hz, p95 frame time at most 120% of the refresh budget, dropped frames at most 1%, and the hashed trace artifact. The matching normal/reduced-motion assertions must be backed by their observed artifacts. A 30 fps or 60 fps screen recording is visual evidence and does not measure app rendering performance. Keep GPU work bounded on the shared 8 GB Mac; run a single platform and flow at a time.

The existing `scripts/performance-profile-evidence.js`, `scripts/ios-physical-device-evidence.js`, `scripts/android-real-browser-evidence.js`, `scripts/store-ad-sandbox-evidence.js`, and service smoke scripts can provide supporting artifacts. Use their documented isolated targets and inspect their result/blocked fields; generating a packet or template does not establish success.

## Current execution evidence

The current aggregate is recorded in [local-verification-current.json](../validation/artifacts/2026-10-02-feature-coverage/local-verification-current.json): **66 of 66 discovered suite files have passing execution records**, with 583 observed individual passing test outputs, zero failures and zero skipped cases. All 99 related local ledger checks pass. This combines the complete62-file execution with affected-only reruns, new Quiz/breathing/motion suites and the installed Expo dispatch regression; it does not imply a redundant full rerun. The earlier core execution passed279/279 in95seconds. Complete native/live/physical feature coverage remains0 of99.

These records span source versions. The [destination refresh](../validation/artifacts/2026-10-02-feature-coverage/router-destination-refresh/affected-suite-results.json) executes the installed SDK converter and binds native navigation, feature links, app-shell and Quiz checks to their actual stable before/after source snapshots after `[screen]` became `[destination]`. Earlier core/model runs remain historical evidence and are not retroactively labeled exact proof of the substantially changed app or installed binary. Top-level legacy `sourceSha256` fields are aggregation-time fingerprints; only per-suite `executionSourceSnapshot` fields establish captured execution-time source identity.

The [failure-resolution receipt](../validation/artifacts/2026-10-02-feature-coverage/failure-resolution.json) preserves the exact earlier causes and changes: old custom-tab assumptions, omitted Foundation exports, obsolete lifetime-product expectations, old DNS diagnostics, lexical Quiz selection checks, and home-directory prefixes in native command metadata. Earlier failed/timeout summaries remain in their original reports. The current gates resolve real export surfaces and native semantics, and retain tests rejecting missing auth/AppCheck, missing tabs, absent radio semantics and inactive launch products. Logs and command metadata now redact local home-profile prefixes.

The current live-service/account setup, disabled remote flags, missing private credentials, store sandbox and signed physical-device proof remain separate dependencies. Neither this catalog nor successful local contracts establish a deployed feature, TestFlight installation, sensor verification, protection enforcement or 60 fps device result.
