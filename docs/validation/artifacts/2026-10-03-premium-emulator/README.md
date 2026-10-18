# Demo emulator execution, 2026-10-03

The startup fix completed actual Firebase Emulator Suite execution under Node **22.23.1** and Firebase CLI **14.7.0**, targeting only `demo-freed-feature-verification`. The Functions suite passed **208/208**, with zero failed or skipped cases. Function discovery loaded the public demo parameter without an interactive prompt. The emulator subprocess completed in about 37 seconds; no timeout increase was needed.

| Execution | Passed | Failed | Skipped | Evidence |
|---|---:|---:|---:|---|
| Startup regression before fix, expected red | 0 | 4 | 0 | [startup-regression-red.json](startup-regression-red.json) |
| Startup regression plus existing manifest contracts after fix | 19 | 0 | 0 | [startup-regression-green.json](startup-regression-green.json) |
| Corrected Functions unit run | 203 | 0 | 5 | [functions-unit.json](functions-unit.json) |
| Actual demo emulator run | 208 | 0 | 0 | [emulator.json](emulator.json) |

The five emulator-only cases verified preservation of two accounts when deletion identity/recent authentication is rejected, guest deletion and repeat fencing, rejection of an anonymous token after account linking, Firestore tombstone mutation fencing with anonymous aggregate preservation, and Storage sentinel/write/delete behavior. Unit-only execution correctly skipped these five cases; the emulator run executed all five.

The [canonical feature report](emulator.json) retains all **106 features** (99 baseline, seven appended premium). It reports **31 selected feature requirements blocked**, zero passed or failed requirements, and zero fully covered features. Those blockers require feature-specific assertion receipts; the backend suite does not create them. The canonical runner exited **2** for that incomplete coverage. The outer source-capture wrapper records the nonzero exit as `status: failed`; inspect the canonical report's passing `functions:emulator` suite and blocked requirements to distinguish incomplete coverage from a test failure.

The [execution source receipt](execution-source.json) captures stable before/after source hashes, the public demo fixture hash, runtime versions, and the canonical command. The [cleanup receipt](cleanup.json) confirms that ten checked emulator ports have no listeners and tracked emulator processes have exited. `.env.local` and `.secret.local` were absent before this work and remain absent. Java used a 384 MB heap limit, Node children a 512 MB limit, and tests one worker.

The first manual unit invocation used the workspace root instead of `functions`. It produced ten `ENOENT` failures for relative source/certificate-fixture reads (192 passed, ten failed, five skipped; 207 observed entries). That failed invocation remains in [functions-unit-initial-root-cwd.json](functions-unit-initial-root-cwd.json) and its log; the corrected run changes only the working directory. [summary.json](summary.json) lists the original failure names. This preserves execution history rather than replacing a failed result with passing evidence.

The CLI emitted its existing dependency-version warning, reported Java's `JAVA_TOOL_OPTIONS` message as a rules-runtime warning, and emitted a metadata lookup warning. Function definitions loaded and the suite completed despite these warnings. Pub/Sub was not started: the Google subscription trigger, notification scheduler, adult-feed refresh schedule, and deletion/record-cleanup schedules were ignored. Tests of their injected processors do not establish real delivery or deployed execution.

Storage explicitly diagnosed that this emulator accepted stale `ifGenerationMatch`, including after deletion. The adapter test observed this limitation and removed its synthetic object. Its passing result does **not** prove production GCS stale-write rejection.

No native build, simulator interaction, live email/message, store purchase, deployment, or signed physical-device verification was performed. Native UI, sandbox storefronts, live service behavior, physical protection, accessibility, and measured motion evidence remain incomplete.
