# Task40 Package A — review receipt, 12 October 2026

New standalone core is prepared for Root security/code review. It is **not integrated** into native mutation paths, account cleanup, services/extensions, bridge or UI and cannot establish a working friend lock or weakening enforcement. No commit, reset, stash, revert, device test, console access, installation or real Mac Keychain enrollment occurred. All native commands ran sequentially after Root explicitly released archive14; Task40 explicitly released its reservation after the last compiler/fixture child exited.

## Delivered contract

Fourteen new source/fixture/documentation/runner files: three Swift files, four Kotlin files, one neutral TS type contract, four native fixture files, guarded runner and API README. PIN is six ASCII digits twice; recovery key is 32 native-random bytes; salts are 16 bytes per verifier; PBKDF2-HMAC-SHA256 is fixed at 600,000 iterations. PIN/recovery counters reserve attempts durably, escalate 1/5/15/60 minutes after failures 5/6/7/8+, survive object/process recreation conservatively and never consult wall-clock time. Slow work is serial and off UI/enforcement locks through the native worker APIs.

Native prepare → PIN authorization → durable claim → native completion/readback and exact retry are bound to random operation ID, canonical native delta, configuration revision, mutation generation, lock revision and authorization generation. Cancel/rotation/invalidation reject replay; completed receipts never permit repeating the mutation. Credential rotation requires a different PIN, changes both verifiers/key and never touches filters or app authority.

Root's retained-journal correction is implemented: schema2 prepared/committed envelope retains bounded previous+candidate records and is never deleted after successful publication. Failed pre-commit restores prior credentials, including restart after failed immediate rollback. Final write/readback outage reports `commitOutcomeUnknown`; later readable phase/record resolves it. Prior verifiers stay protected in the envelope while only current verifiers authorize ordinary actions. Lost one-time key response can be repaired by rotating with the submitted new PIN. Optional native lock closing does not retroactively fail a verified commit. Missing witnessed record/journal, corruption and unavailability fail closed.

## Verified source checks

- Final Swift semantic RED: successfully compiled a retained temporary core with wrong-secret guard removed; failed at the intended wrong-secret assertion. `swift-red-final.log` preserves command, source/compiled hashes and runtime failure.
- Final Swift GREEN: real policy, KDF, secure-store transaction and injected Keychain adapter fixtures passed; native Mac framework compilation passed; arm64 iOS15.1 deployment typecheck against existing iPhoneOS26.5 SDK passed. `swift-green-final2.log`.
- Final Kotlin semantic RED: compiled temporary guard-removal baseline; failed at expected `INCORRECT_SECRET`. `kotlin-red-final.log`.
- Final Kotlin JVM GREEN: real policy, native JCA KDF, binary codec, transaction and encrypted AES-GCM envelope/adapter fixtures passed, including unavailable-provider rejection, bounded receipts, persistent throttle, concurrency, cancelled/stale scopes, failed/interrupted rotation, committed-outage restart and optional-close failure. `kotlin-green-final.log`.
- Final Android36 public adapter typecompile passed. `kotlin-public-types-final.log`. The preceding strengthened typecheck failed because `O_DIRECTORY` is absent from the public SDK; that attempt is retained in `kotlin-green-final.log` and superseded by public `O_RDONLY` + `fstat/S_ISDIR` + `fsync`. No private constant/API fallback was used.
- Bounded TS contract typecheck, Node runner syntax, owned-file whitespace checks and 26 compiled-source/file snapshot bindings passed. No full shared-repository suite was run or claimed by this bounded package.

The first source-binding sweep flagged the preserved, superseded Android adapter snapshot from the failed public typecheck because it correctly differs from current source. The corrected receipt validator explicitly labels that one archived snapshot as superseded, verifies all 26 current/retained bindings and all fourteen source hashes, and records the outcome in `final-source-bindings.json`; it does not represent the failed snapshot as a current pass.

## Exact source and evidence

`package-a-manifest.json` records all fourteen file SHA256 hashes, byte/line counts, shared HEAD (not a complete dirty-workspace identity), host OS, every retained log hash and retained fixture-binary hashes. `package-a.patch` is the complete new-file diff for those fourteen files. Its SHA256 is:

`695db415798c0f6b8b48290dc45616ee83d8217e76610712352084b62e4fd4d0`

`owned-status.txt` records only owned paths; all are new/untracked. Prior attempted native checks and temporary source snapshots remain preserved. Native GREEN source hashes were rechecked against current owned files. No evidence is bound to a signed product binary or phone.

## Remaining limits before integration

Android public PBKDF2WithHmacSHA256 provider support begins at API26 while this product declares minSdk24. Missing provider returns `cryptoUnavailable` and consumes the conservatively reserved attempt without granting authority. B/C/D must expose unsupported capability before enrollment; API24/25 support was not manufactured by lowering cost or adding custom crypto. Actual device provider/performance evidence remains unexecuted.

B/C must supply real installed adult baseline/readback, derive actual weakening deltas, guard every Task37 native mutation/service/reset/feed/exception route, preserve retained adult policy through private/account cleanup and runtime callbacks, and invalidate authorization on repair/newer configuration/account transition. The library cannot itself observe or transact OS mutations. D must keep secrets ephemeral, confirm only native readback, supply exact prepared retry identity and provide account-free management/disclosures.

Real device Keychain/Keystore write/durability, kill/reboot behavior, slow-device KDF latency, native mutation failure/rollback and callback races, reset/account retention, signed binary scope and phone enforcement are unexecuted. Core source tests confer no app-break authority, universal browser recovery or launch-readiness claim.
