# Momentum protection and membership service receipt

Implementation date: 2026-10-03. Package owner: Momentum services agent. The owner's existing uncommitted checkout was preserved; no commit, reset, stash, production rollout, real purchase, provider account change, or deployment was performed.

## Implemented changes

- `src/lib/native-iap-adapter.ts`: before opening a charge sheet, validate the exact product's freshly fetched billed-price metadata through the existing store-price normalizer. The paywall guard alone previously allowed a direct iOS adapter caller to open checkout without a price. Server checkout readiness, same-owner verification, existing-membership restoration, original Apple binding, and deferred Android plan replacement retain their existing contracts.
- `functions/src/premium-state.ts`: authenticated current-claim projection issues a fresh bounded client read receipt while preserving source timestamp ordering, same-UID/status fences, and the exact signed store/grace expiry. A multi-day Apple grace claim older than 24 hours previously yielded unusably stale client evidence despite a successful authenticated refresh. This is a server read receipt, not new store verification.
- `src/lib/premium-entitlement.ts`: `getMembershipSummary(value, now, expectedOwner)` exposes active, expired verified access, revoked, inactive, verification-required, or absent proof; monthly/yearly/lifetime plan; platform; and verified access-through. Another UID receives an empty summary. Stale or future-invalid verification cannot promise future access. Renewal is explicitly unknown, next charge is null, and legacy lifetime renewal is not applicable. The current server contract supplies no renewal/cancellation metadata; expiry is never represented as a renewal date.
- `src/lib/native-intervention.ts`, `src/lib/protection-capabilities.ts`: native Android surface/package, iOS token, and browser-domain scopes must match their rule and source. Consuming a malformed or missing surface scope now discards the event instead of allowing fallback to a broader package unlock. Existing identity-bound native claim, freshness and single-consumption boundaries remain in place; coarse Safari links still carry no native authority.
- Android surface rollout: new pure `FreedFocusShieldPolicy.kt` and context adapter `FreedFocusShieldRollout.kt` require native build approval (or explicit preview on a debuggable binary), runtime rollout, and user-selected enabled preset rules. Accessibility's per-surface detection and outstanding short-form checks enforce the gate. Calibration is gated and cancelled on disabled rollout. Adult URL filtering and whole-app limit scheduling remain independent. Saved rules and recovery data are retained.
- Native module/JS bridge: separate surface build capability and runtime enabled/reason fields; `configureFocusShieldRollout`; presentation exposes release-gated, permission-required, ready, or unsupported native inspection. iOS Screen Time and Safari paths remain supported; individual native iOS Shorts/Reels inspection remains unsupported.
- `src/lib/firebase-native.ts`: clear stale Android runtime rollout at startup, default RemoteConfig `android_surface_interception_enabled` to false, and synchronize only a remotely sourced boolean after successful fetch. Missing startup/configuration or fetch failures leave the native runtime disabled. Native build gating cannot be lifted by RemoteConfig.
- Plugin, app config and checked-in Android manifest: separate surface release/preview metadata, production false. `FREED_FOCUS_SHIELD_DEV_PREVIEW=true` is an explicit future QA build opt-in, honored only on a debuggable binary; it does not activate runtime rollout by itself.
- Feature manifest: focused tests attached to existing rows 20–22, 28, 36, 65–66, 83, 85, and 106. Historical ledger and 109-row catalog remain intact. Native policy wrapper is discovered by the local suite runner. Narrow existing core/native-checkout fixtures now include valid billed prices before testing receipt or plan-change behavior.

## Red/green evidence

Observed failures before fixes:

1. Direct native checkout with absent/malformed/wrong-product metadata returned purchased instead of unavailable.
2. A surface event preserved a package/iOS/browser scope and consumption admitted a missing surface scope.
3. Membership summary function was absent.
4. Android UI model advertised native surface support solely from Accessibility capability.
5. Native surface build/policy metadata was absent.
6. Feature manifest did not include the focused regressions.
7. Authenticated current-claim refresh yielded stale offline evidence during still-valid multi-day grace.

Verified local commands:

| Command / suite | Result |
| --- | --- |
| `npm --prefix functions test` | Final: 209 total; 204 passed, 0 failed, 5 emulator-only skipped. Includes same-owner purchase, guest transfer, cancellation through exact expiry, signed grace, hold/pause, refunds/revocation, old-event races, restore and plan change. |
| `tests/native-iap-lifecycle.test.ts` | 10/10 passed, including new direct metadata guard. |
| `tests/native-checkout-readiness.test.ts` | 5/5 passed after priced fixtures; original transferred Apple account binding and deferred callbacks remain correct. |
| `tests/native-intervention-authority.test.ts` | 4/4 passed: scope binding, freshness, deduplication, invalid-scope discard. |
| `tests/premium-server-refresh.test.ts` | Passed: claim older than 24 hours remains usable through signed grace after authenticated read, offline TTL remains 24 hours, exact grace expiry, invalid/future source timestamp, nonverified lifecycle state, foreign UID, normal paid claim and original latest-plan ordering. |
| `tests/membership-summary.test.ts` | Passed: active expiry, exact expiry, stale proof, owner fence, revoked/inactive, future invalid proof, unknown renewal and legacy lifetime. |
| `tests/focus-shield-rollout.test.ts` | Passed: old binary fails closed, explicit gate evidence, permission loss, supported iOS alternative with unsupported native inspection. |
| `tests/focus-shield-build-gate.test.js` | Passed: default-false native production flag, separate preview flag, metadata idempotency, default-false RemoteConfig. |
| `modules/freed-protection/tests/run-focus-shield-policy-tests.js` | Pure Kotlin build/runtime/opt-in truth table passed. This is source policy evidence, not device interception evidence. |
| `tests/feature-test-manifest.test.js` | 16/16 passed after mappings. Intermediate runs of its 2-second child-process fixture timed out under concurrent native compilation; its classification assertions remained unchanged and the bounded fixture deadline was increased to 10 seconds. Final rerun passed 16/16. |
| `tests/store-pricing.test.ts`, `premium-entitlement.test.ts`, `paywall-presenter.test.ts` | Passed: localized regular base amount, no advertised unapproved trial, owner-bound 24h cache, exact store expiry, progress preservation. |
| `tests/launch-foundation.test.ts`, `launch-purchases.test.ts`, `launch-entitlement-contract.test.ts`, `paywall-navigation.test.ts` | Passed: monthly/yearly equal capabilities, store metadata and checkout identity, strict verification envelopes, safe originating navigation. |
| `tests/encrypted-dns.test.ts` | Passed: separate configured/enabled/healthy, malformed/old binaries unavailable, public Families provider only, gated presentation. |
| `modules/freed-protection/tests/run-encrypted-dns-tests.js` | Swift configuration/enablement/unknown-health and Kotlin policy/bootstrap/protection/reply cases passed on serial rerun. First concurrent Kotlin compile hit its 60s timeout; not silently counted as passed. |
| `tests/native-intervention-links.test.ts` | 6/6 passed: scoped coarse Safari handoff, exact HTTPS fragment route, no forged native authority, explicit user-tapped fallback. |
| `tests/firebase-native-runtime.test.ts`, `firebase-repository-config.test.ts` | Passed; existing Firebase boundaries and endpoint configuration preserved. |

## Remaining integrated and external evidence

- Integrated typecheck runs during concurrent localization work were blocked by TS7006 in `src/i18n/runtime.ts:22`; earlier transient JSX transform errors in the UI worker's owned file were reported to that worker. No service TypeScript error was reported. Root owns the final integrated typecheck.
- Full core command passed the updated Android capability fixture and initial protection/classifier/recovery cases, then stopped at an obsolete native ShieldConfiguration copy assertion `/Category-wide recovery/` (test `iOS shield handoff and Safari Focus Shield stay scoped and App Store safe`, around core line 7715). Localization owner was informed. Substantive native scope assertions were preserved; no full core success is claimed here.
- The Node-discovered pure Kotlin wrapper had one 60s compilation timeout under concurrent load after the direct harness passed. Its compiler deadline was bounded at 120s for final serial verification; final status is recorded below.
- Native module Android compilation, fresh binary walkthrough, physical foreground interception/permission-loss/reboot/unlock expiry, signed Screen Time/DNS, real resolver traces, and App Store/Play sandbox lifecycle remain root/external verification obligations. These local results do not establish them.
- Five backend emulator-only tests are unproven in this receipt. Store/provider readiness and actual localized storefront eligibility must be validated in authorized sandbox fixtures. No production flags were enabled.
- Recovery progress and baseline protection were not tied to premium expiry; existing expiry/revocation tests preserve recovery history. No service ad gate was added; existing protection-triggered and SOS flows bypass rewarded ads.

## Primary policy references consulted

Google's [AccessibilityService policy](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en-EN) requires the applicable declaration/approval and prominent disclosure. Deterministic user-defined behavior is not a grant of approval to this app; release gating remains pending actual policy/device proof.

Apple's [ApplicationToken documentation](https://developer.apple.com/documentation/ManagedSettings/ApplicationToken) describes token-based restriction/filtering. This package retains FREED's existing Screen Time and Safari capability boundaries and does not infer an API for native third-party screen inspection.

## Final verification updates

- Final integrated `npm run typecheck` exited 0 after the localization callback fix.
- Node-discovered native Kotlin policy wrapper passed 1/1 in 9.6 seconds after its bounded compiler deadline adjustment; the earlier timeout remains recorded above.
- Fresh full core rerun passed the repaired native Shield assertions, then failed `release env preflight validates production store ad and AI configuration`: the fixture Android upload-keystore/keytool inspection failed. Root owns this signing preflight follow-up; no full core success is claimed.
- A fresh backend run after projection had 209 tests: 203 passed, one failed, five emulator-only skipped. The sole failure asserted total streaming-test wall time below 100 milliseconds; observed 152 milliseconds while the provider correctly rejected. The test now checks the actual request AbortSignal and streaming-body cancellation with a separate bounded guard, retaining exact failure/privacy semantics; Final rerun passed: 209 total, 204 passed, 0 failed, five emulator-only skipped.

- Final focused replay passed native checkout 10/10, native intervention authority 4/4, membership summary, refreshed server proof, and gated capability presentation.
- `functions/src/purchase.test.ts` changes only the streaming test evidence: actual AbortSignal/body-cancel outputs replace the load-sensitive elapsed-wall-time heuristic. Provider implementation is unchanged.
- Final backend TypeScript build passed as part of the 209-test run. No server endpoint or product identifier changed.

## Authorized review-fix package and source freeze — 2026-10-03

The previously reported offer-selection, encoded source/rule agreement, and native claimed-lease gaps are now implemented. This section supersedes the earlier read-only handoff that marked them unapplied.

- `store-pricing.ts` exports one validated Android base-offer selector returning the localized regular billed amount and its exact offer token. Both display normalization and checkout use it. It rejects conflicting `id`/`productId`, blank offer tokens, unpriced candidates, and multi-phase introductory offers masquerading as a no-intro base plan. Android subscription checkout cannot fall back to an implicit offer on older SDK metadata. Grandfathered lifetime restore/one-time identity contracts remain intact.
- `native-intervention.ts` binds actual supported source packages to the encoded configured-app/short-form rule; TikTok aliases use the existing canonical mapping. Missing, unsupported, malformed, or different sources do not receive native identity or unlock-source authority. Malformed rule strings are rejected rather than repaired into another valid rule. The coordinator discards these payloads. Coarse Safari handoffs remain browser-only.
- Android `FreedNativeUnlockPolicy.kt` stages a native-private claimed-target lease when the JS coordinator consumes the event, before the challenge runs. The lease is valid for 20 minutes (15-minute custom challenge plus delivery/pause allowance), requires the exact ID/package/surface rule, and checks both wall and monotonic time plus boot identity. Grant duration is bounded at 120 minutes. First fulfillment is recorded once; exact retries only acknowledge an existing non-extending grant, while changed expiries, other targets, expired leases, missing IDs and reboot/rollback cannot grant.
- `FreedNativeUnlockStore.kt` persists native-only lease/fulfillment receipts. Consumed IDs and staged authority share one committed preference edit under the same lock. Failed preference commits restore the touched memory keys because SharedPreferences can otherwise change memory despite failed persistence. Package and per-surface receipt evidence is separate from recovery/backup records; multiple actual valid surface receipts are retained. Legacy/unreceipted surface pauses fail closed. Package/surface expiry and invalid-request handling preserve other already-valid targets.
- Android grant calls return `nativeUnlockGrantAccepted` and the canonical `nativeUnlockGrantInterventionId`; current getter UUIDs are `activeUnlockInterventionId` and `activeFocusShieldUnlockInterventionId`, matched against the actual target/expiry and current permission/rollout. Getters never issue new authority. The JS bridge forwards a surface grant's third identity argument and strips malformed UUID evidence.
- iOS retains its existing three-argument source/claimed-envelope/expiry authorization and shield behavior. The granted scope's UUID is stored privately and returned through the same positive acknowledgment and package getter field only while authorized and active; no opaque token or selector is exposed by these new getter fields. Swift source frontend parsing passed. The iOS surface path remains unsupported.
- Root owns the business caller changes: durable verified completion history, explicit request for this completion, acknowledgment plus matching native getter evidence before recording a native earned window, and removal of ledger-driven grants/automatic clearing. These root changes are not claimed as worker-authored code.

Focused red/green evidence for this package:

| Check | Final result |
| --- | --- |
| `tests/native-iap-lifecycle.test.ts` | 13/13 passed. Reproduced incorrect first-offer token and conflicting alias acceptance before fixes; legacy missing-token checkout now opens zero charge sheets. |
| `tests/store-pricing.test.ts` | Passed, including multi-phase introductory metadata rejection. |
| `tests/native-intervention-authority.test.ts` | 5/5 passed, including encoded source disagreement, missing/unsupported source, malformed rule/package, authority removal and valid TikTok alias. |
| `tests/native-intervention-links.test.ts` | 6/6 passed; Safari route/source behavior preserved. |
| `tests/native-checkout-readiness.test.ts` | 5/5 passed; original transferred Apple binding, readiness and deferred callbacks preserved. |
| `tests/native-unlock-policy.test.js` | 1/1 passed; compiles the real production pure Kotlin policy and exercises early consumption plus bounded challenge delay, wrong identity/target/surface, single fulfillment, non-extending replay, expiry, boot and rollback. This is not physical-device enforcement proof. |
| `tests/native-unlock-bridge.test.ts` | Passed; missing/invalid identity cannot invoke the surface grant, valid identity reaches the native boundary, malformed UUID evidence is stripped, and unsupported iOS surface requests do not substitute a package request. |
| `tests/feature-test-manifest.test.js` | 16/16 passed; native policy/bridge suites wired into existing rows 28 and 36, catalog remains 109 rows. |
| `xcrun swiftc -frontend -parse modules/freed-protection/ios/FreedProtectionModule.swift` | Passed after acknowledgment and getter additions; full native iOS build remains root-owned. |
| Direct Android offline `:freed-protection:compileReleaseKotlin` | Failed during dependency configuration before module compilation: Lottie requested uncached Android Gradle Plugin 7.2.2. Root's build-helper dependency path must verify the final native source; no compile success claimed here. |
| Integrated typecheck during concurrent root UI work | Failed on companion pose/help/cue/snapshot interface mismatches, `remainingRemoteReplies` and the ad-stage comparison in root-owned UI. No service TypeScript error reported; root owns final integrated success. |

Production-source freeze: **2026-10-03 15:57:42 +0530**, last worker edits in Android store/module. iOS source last edited **15:43:55 +0530**; native IAP last edited **15:46:02 +0530**. No source edit is planned after this freeze; later receipt updates are documentation only. Root must rebuild Android APK and native iOS/JS artifacts after these changes, then bind the actual tested binary/source fingerprint. All mandatory live-store, signed permission, real network and physical enforcement evidence remains separate.

Frozen SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `src/lib/store-pricing.ts` | `d3b51b1eab00de6c879a4aa71e6406b97ed1aff393511b75f63077897e2d1eb3` |
| `src/lib/native-iap-adapter.ts` | `17599e252bad3d34335603fb6770c842590412e0811b93e27e096eeb1869ca67` |
| `src/lib/native-intervention.ts` | `b6ee15162a322105b55d277be05539d6dcb479d9e5ce0754da03c2aa1bffabce` |
| `src/lib/protection-capabilities.ts` | `5ed181bc81d17ba45bcebfaf4155f8ebe1677ba1dbefe3f09cfd90146e9896bd` |
| `modules/freed-protection/src/index.ts` | `a98538e8cd93fde48f0c8a850add6b7b0858695260de7d2f4b5bb2edc903361d` |
| `FreedNativeUnlockPolicy.kt` | `6aff633f1c6c8b1a5ac82fe9b23f662acd77be470a69c9b2d99cbf309d118b15` |
| `FreedNativeUnlockStore.kt` | `36b8b2dd5c689c8133060097e864ad426a112bf3e89070a67ec8ecbe5da6cfcf` |
| `FreedProtectionModule.kt` | `208fa1f2ea4a847b84b452f74e1f1c85334094377b5529a87d717885d78665df` |
| `FreedAccessibilityService.kt` | `4ec445878d1a3cb0708c66afdfea357ce1bdbef27c4b469ac950ab27c1414d57` |
| `FreedFocusShieldRules.kt` | `3c1a5282b8c8c8c695303b4bff6b287a7ed39196fcf0cc4f7a8ebf0811086a5b` |
| `FreedProtectionModule.swift` | `6b2a78c09f1c71d5327e2520fcc021d687b9a6ec5fc77153058a486da332c5b5` |

## Authorized outbound privacy package — 2026-10-03

The Apple request form terms observed by the release owner prohibit sending framework-derived device/usage data beyond the individual device, including for advertising measurement. This package closes the concrete outbound boundaries identified in the read-only review. It does not assert approval of the app, accept the terms, submit an entitlement request, or claim physical-device/store evidence.

`projectRecoveryStateForOffDevice` is the central pure projection. Framework provenance is recognized independently across iOS-token scope, Screen Time/Family Controls/DeviceActivity source/rule metadata and synthetic Screen Time hosts before hydration can discard extra metadata. Automatic app/browser/search interceptions are conservatively omitted from the outbound own-data dataset. Legacy app archives cannot be separated reliably, so those counts and minute buckets are omitted. Native earned windows and their mixed count/minute archives stay local. Challenge completions remain own verified actions, with native source-host linkage stripped. `lastProtectedAt` is recomputed from retained own actions rather than carried across from device events. Unclassified archived AI replies can summarize mixed local history, so outbound backup retains user-authored chat input and keeps those replies local. Private check-ins, slips, habits, pledges, authored plans, verified tool/exercise actions and FREED's own foreground sessions retain their existing portable behavior. Private note text is never classified as framework provenance merely because the person mentions Screen Time.

Local state, record paths, archive calculations, dashboards, native enforcement, and the frozen native grant/receipt package are unchanged. The projection never writes or mutates its input. Legacy encrypted inbound restore continues to retain local history; export alone applies the new filter.

Outbound boundaries now use projected state:

- CLARA recomputes its count and recent signals from the own-data subset. `CoachContext.exportState` and `exportDay` are local-only builder inputs and are never serialized. A missing trusted state yields an unknown count rather than carrying a mixed count.
- Remote challenges require `RecoveryProfile.exportState`, recompute own counts and forecasts, omit automatic interception category/surface/scope context, and serialize only the existing bounded action-history fields. Missing state uses the existing local fallback before contacting a provider. Local challenge ranking continues to use full local inputs.
- Remote retention uses `buildOffDeviceRetentionRequest`; its counts, patterns, momentum and forecast are rebuilt from own data. Local retention remains full local behavior.
- Sponsor and support-circle reports rebuild their aggregate summary from own data and label the count **Self-reported urge moments**. Partner messages replace a synthetic framework host with the existing generic risk-moment label. Native compose remains an explicit user action.
- Generic HTTP analytics uses the distinct `freed-own-data-analytics-v1` dataset, with no device-block/usage-window fields or invented zero counters pretending to measure device usage. The existing ingestion adapter accepts and validates that schema, rejects a device counter under its own-data label, and stores only the own-data fields. Existing legacy schema parsing is retained for compatibility. Firebase UTC check-in/completion counters already contain own actions; its provider receives projected state without changing pending-request/lineage/receipt semantics.
- Encrypted portable mapping projects before encryption. Decryption tests inspect the actual outgoing plaintext as well as ciphertext roundtrip behavior. Encryption itself does not authorize exporting framework data.

Caller integration remains owned by Root: supply current recovery state/day to CoachPanel and ChallengeScreen; use the self-report count label in the report preview. The exact two export disclosure strings were delivered to the localization owner, who confirmed all ten catalogs: `Self-reported urge moments: {{count}}` and `Private notes, contacts, browsing details, and device protection history are not included.` Core fixtures needing the new trusted remote input contract were reported to Root; this worker did not edit core.

Focused verification (serial, no SDK/device build):

| Check | Result |
| --- | --- |
| `tests/off-device-recovery-privacy.test.ts` | 3/3 async transport/crypto tests passed, plus synchronous metadata, projection, raw/archive count, own-note/action retention, and independent own-dataset invariance assertions. Actual CLARA/challenge/retention dispatch, HTTP/custom analytics, encrypted portable plaintext, legacy inbound retention, source immutability and missing-context fallback exercised. New tests reproduced missing central projection, unknown AI derivative retention, mixed-provenance masking, and unsupported own-schema ingestion before the respective fixes. |
| `tests/backup-crypto.test.ts` | 9/9 passed. |
| `tests/automatic-backup.test.ts` | 26/26 passed. |
| `tests/recovery-analytics-snapshot.test.ts` | 6/6 passed, including durable Firebase pending request and receipt counters. |
| `tests/analytics-reconciliation.test.ts` | 5/5 passed. |
| `tests/recovery-data-accuracy.test.ts` | 18/18 passed. Two old export fixtures first failed under the authorized new contract; they now supply trusted context and assert outbound device exclusions while preserving original full local count/window assertions and own action/session accuracy. |
| `tests/feature-test-manifest.test.js` | 16/16 passed. New privacy suite mapped to AI/report/analytics/backup/accountability obligations; catalog remains 109 rows. |
| Final integrated `npm run typecheck` | Failed only on Root-owned `FreedScreen`/`Screen` journal union at `app/flow/[destination].tsx:15`, `app/onboarding/[destination].tsx:6`, and `freed-app.tsx:8040,8322`. No export service TypeScript error reported. Root owns integrated repair/verification. |

Production JS source freeze is **2026-10-03 18:42:14 +0530** (privacy helper and accountability last edits). Later test/receipt edits do not alter that production freeze. No native source, SDK, provider/store account, deployed endpoint or rollout flag was changed in this package. Root must bind newly rebuilt JS/native artifacts to the final source and complete caller/core/integration checks before relying on this package for release attestation. No full-suite, current binary, live provider or physical-device proof is claimed here.

| Frozen production file | SHA-256 |
| --- | --- |
| `recovery-signal-privacy.ts` | `fa794f59191d07bb8cf76319e54aeb077dde55ec576ac2f60bb517b0bc698f8e` |
| `recovery-backup.ts` | `70a41e90c51b9d9cb8160cff1bd53371c2c948c52279717eae8304d6d29aa895` |
| `ai-coach.ts` | `d7942a1154034cdd95558f3c8574c7bce6ba91f67934e4b4d8923c5b44109b62` |
| `recovery-engine.ts` (type-only interface addition) | `cf76320bc56b08b35bd7384789b61ee3a05805b4d2cb8abc8f0091df4cb2f8e3` |
| `challenge-generator.ts` | `f007f3d803ae13a93643f3731c4ce61869fca9cac45768a6bd30b37bbe0f7579` |
| `retention-orchestrator.ts` | `4bd51eaaf00655f2a1aadb9f13ecfa6890b4d2a15dc41c3af104c6e733e0e272` |
| `accountability.ts` | `01966d8478257c08f8f7ec043c434abdffcb9c617f48ca542875807ecaf8d386` |
| `recovery-analytics.ts` | `a8549f261d42cb7f3c56902b2aa644167a499130ec7a9930e4cbcdd16ec4693b` |
| `recovery-analytics-ingestion.ts` | `4c556b278dc4d5f18bcb3974c8fde142791d765b9937440ef7e2bd26f102d603` |
