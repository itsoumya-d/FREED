# Android reviewer P1/P2 repair receipt

Applied six owned Android files after checking every baseline hash. All 16 previously owned/new files in review-frozen-hashes.json match the isolated verified snapshot. No other shared source, UI, bridge, iOS, backend, resource, Gradle or test file was changed. No commits.

P1: FreedAppGuardModePolicy now gives independent strict or the matching active native timed PACKAGE window precedence over an earned lease. Actual service lease lookup, package/surface grant acceptance, final acknowledgments, package getter and per-target status evidence use the same native hard guard. Hard windows do not remove or renew stored receipts: an unrelated package remains eligible, and an old matching receipt becomes effective after the window only until its original expiry. Package source remains exact native allowlisted application/package input; host, URL and category inputs never enter fulfillment.

P2: actual daily-limit callback cancels on reset/disconnection/mode changes. Its actual scheduleAppLimitCheck fallback now requires the current live foreground, installed static target, daily mode, enabled runtime and absence of an effective matching lease. Its immediate expired branch rechecks live foreground and current appGuardShouldInterrupt before launching. Cached LAST_FOREGROUND_PACKAGE cannot authorize a launch.

Red evidence: timed-guard-mode-red.log and timed-guard-runtime-red.log reproduce the matching timed-window bypass. timed-guard-authority-complete-red.log replays the original shared source with current tests and reports five failures: service lease remained effective, package status UUID/expiry remained exposed, matching surface evidence remained exposed, new grant was acknowledged, and native fulfillment was called. timed-guard-deadline-complete-red.log executes BOTH original runnable and original helper and reproduces a launch while live root is null.

Green evidence: runtime runner now extracts the real callback, schedule helper, cancellation helpers, recheck and app guard policy. It covers null/different live roots with deliberately stale cached foreground, matching effective lease, mode/reset changes, eligible real deadline, lease-before-boundary, live boundary recheck, unrelated target, window ending, stale timers and preserved native configuration. New authority runner extracts the real module grant lambda, getter/status-suppression helpers and real service lease getters; local Android/private-proof adapters provide platform inputs. Independent existing native-unlock policy runner exercises production private ID/freshness/replay/expiry policy. No mocked output is described as native device evidence.

## Commands and results

- `node modules/freed-protection/tests/run-app-guard-mode-policy-tests.js` — exit 0; review-guard-mode-final.log
- `node modules/freed-protection/tests/run-app-guard-runtime-tests.js` — exit 0; review-guard-runtime-final.log
- `node modules/freed-protection/tests/run-app-guard-authority-tests.js` — exit 0; review-guard-authority-final.log
- `node modules/freed-protection/tests/run-android-handoff-tests.js` — exit 0; review-handoff-final.log
- `node modules/freed-protection/tests/run-dns-requested-handoff-tests.js` — exit 0; review-dns-handoff-final.log
- `node modules/freed-protection/tests/run-app-schedule-policy-tests.js` — exit 0; review-schedule-final.log
- `node modules/freed-protection/tests/run-native-unlock-policy-tests.js` — exit 0; review-unlock-policy-final.log
- `node modules/freed-protection/tests/run-protection-reset-policy-tests.js` — exit 0; review-reset-policy-final.log
- Cached SDK scoped Kotlin compile from scoped-compile-command.json — exit 0, JVM 17, actual Android36/Expo cached jars, real public Kotlin source and resource-name-only temporary symbols. review-scoped-compile-result.json records the result; no Gradle build.

## Changed hashes

| Owned path | SHA-256 |
|---|---|
| modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt | b22d6b3b85125160dfd6b268b912f01c82ee85ea69ffafdfa52026d714ed6bee |
| modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt | 96065e0cd242cd6fc4c0ff3a7ae9d239d17c5d2117aec5deff5719f03326c689 |
| modules/freed-protection/android/src/main/java/app/freed/protection/FreedAppGuardModePolicy.kt | 0d02c42aa3888899564461bc9162246234d77e509e268efd34cbcfa77ef9b014 |
| modules/freed-protection/android/src/test/java/app/freed/protection/FreedAppGuardModePolicyCases.kt | db22f468cd91be6534d39b5c35d9239d243142b73f2e0ac47d2e406f6cbe2197 |
| modules/freed-protection/tests/run-app-guard-runtime-tests.js | 3836ae4b3132cad99136e1a3c4c70f279aa00fa35805c3b252d42f948ca241a3 |
| modules/freed-protection/tests/run-app-guard-authority-tests.js | a78d287f9e59c71ee48c90662cf17ada01d6d368d98a8d8ead3ae0c4800643ee |

Full baseline/final hashes: review-changed-hashes.json. Entire frozen native ownership: review-frozen-hashes.json. Exact diff: review-repairs.patch.

Limitations: no emulator/device/signed application, live Firebase, purchase, network DNS, notification-delivery or measured physical blocking execution. SDK typecheck uses temporary resource symbols, so it is not Android packaging validation. Parent owns heavy native build and shared source audit predicates. The three pre-existing exact-source compatibility predicates previously reported remain outside this repair ownership; none was weakened.
