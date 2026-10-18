# 2026-10-02 protection coverage evidence

Initial read-only technical audit, followed by authorized bounded implementation fixes. See `docs/testing/protection-coverage.md` for the original coverage snapshot and `FIX_RECEIPT.md` for the corrected source, tests, and remaining device limits.

- `source-manifest.json`: SHA-256 source snapshot (53 files, modified workspace).
- `test-results.json`: exact commands, start time, exit code, log hashes.
- Seven focused existing test/audit logs: 49 classifier cases, 17 source parity gates, 26 protection/native contract tests pass.
- `reproduce-captive-readiness.cjs` and log: failing safety characterization, paused DNS filtering incorrectly reports ready.
- `reproduce-safari-stale-route.cjs` and log: failing safety characterization, deferred short-form shield can cover a newly allowed route.
- `ios-dns-settings-sdk-evidence.txt`: installed iPhoneOS 26.5 SDK header evidence for optional NEDNSSettingsManager API availability.

The original fixture failures are evidence of the pre-fix bugs, not failures of the seven existing suites. Their separate green logs show the corrected behavior. This directory establishes no live-browser, physical-device, distribution-signing, backend, App Store, Play Store, or universal blocking success.
