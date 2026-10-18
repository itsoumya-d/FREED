# FREED core protection and store completion implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task by task. Preserve the shared dirty checkout; use independent verification/build copies and bounded file ownership. The user has already requested implementation, so continue authorized work without another execution-mode question.

**Goal:** Deliver the easiest truthful protection → reset → verified outcome journey, configure the required services and stores, and provide a signed internal build for real-device testing.

**Architecture:** Native enforcement owns targets, permission state, handoffs and access expiry. Recovery state owns one durable completion and derived progress. Server services own authenticated encrypted storage, consented delivery and verified purchase state; advertisements never create adult-domain unlock authority.

**Tech stack:** Expo55, React Native0.83.6, TypeScript, Expo Router, Reanimated, compatible Lottie, Firebase Native/Auth/AppCheck/Functions, existing Swift/Kotlin protection modules, native store billing and Google Mobile Ads.

**Spec:** [Product journeys and gaps](../../implementation/2026-10-04-product-journeys-and-gaps.md). [109 feature journeys](../../implementation/2026-10-04-feature-journey-map.md). The accepted 64-surface Momentum direction and ten-language scope remain in force.

## Global constraints

- Keep Expo55 and React Native0.83.6.
- Retain English, Hindi, Spanish, Portuguese, French, German, Arabic, Japanese, Korean and Simplified Chinese; migrate saved Bengali to System.
- Retain the approved kite identity, original companion and shared light/dark palettes. Keep real prices, labels and counters as text.
- Preserve Today/Protect/Progress/Profile peer navigation, drafts, existing recovery records, product IDs and purchase ownership.
- Adult-domain filtering remains protected through ads, resets, purchases and temporary app access windows.
- Native iOS Shorts/Reels interception is outside the supported release; browser and whole-app alternatives must be explicit.
- Public Android and iOS per-surface interception stays off under the October5 coordinated scope; experimental validation cannot silently enable it.
- Rewarded ads require explicit choice; Premium and SOS request none; decline/failure keeps free recovery reachable.
- Do not change permissions, private keys, legally binding terms or user data beyond explicit authorization. Verify exact FREED app/project IDs before console writes.
- Preserve mandatory failed/blocked evidence. Local tests, static signatures, VM checks and screenshots cannot replace device, store or performance scenarios.

## Review focus

1. Permission loss or network change: protection must become degraded/unsupported, never remain falsely healthy. Device task checks Wi-Fi/cellular, private DNS/relay, revoke, restart and reboot.
2. Interrupted/reset/replayed intervention: preserve unrelated valid leases and never create a completion or unlock through back/dismiss. Native task checks duplicate callbacks, stale generation, expiry and target mismatch.
3. Account collision or restore: preserve history and purchase ownership without accepting backup data as entitlement. Store/service task checks anonymous linking, permanent fences and deletion failures.
4. No ad, consent or service: every free user can still reach local recovery; SOS and paid users never invoke the SDK. Ad task checks real no-fill/close/background/Premium changes.
5. Arabic/large text/small screen: preserve drafts, mirror native navigation after an explicit restart and retain essential actions. Visual task reviews both themes and all languages on each platform.

## Task 1 Map the product and every feature

**Files:** `docs/implementation/2026-10-04-product-journeys-and-gaps.md`, `2026-10-04-feature-journey-map.md`, `2026-10-04-feature-journey-map.json`; existing `scripts/lib/feature-test-manifest.js` and `docs/implementation/screen-review-matrix.json` remain authoritative inventories.

**Consumes:** The current `buildManifest(ledger)` catalog and user-approved design scope. **Produces:** All109 controls/outcomes/platforms/dependencies, a support matrix and a prioritized gap ledger.

- [x] Read the catalog, actual native/service adapters and current verification receipts; separate catalog existence from real functionality.
- [x] Research Opal/QUITTR plus one sec/ScreenZen intervention and setup flows with Appllama; preserve original artwork.
- [x] Document native-app/browser/DNS limits and the policy-compatible monetization boundary.
- [x] Create all109 journey entries using the same manifest factory as verification.
- [x] Visually inspect four newly fetched one sec/ScreenZen setup screens. Preserve clear current target/mode/value summaries and a concise trigger preview; this does not establish their native enforcement.

Verify count without mutating app source:

```sh
node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync("docs/implementation/2026-10-04-feature-journey-map.json"));if(x.features!==109||new Set(x.rows.map(r=>r.id)).size!==109)process.exit(1);console.log("109 unique journeys")'
```

## Task 2 Repair native entry and validate supported enforcement

**Files:** Existing `src/components/ProtectionFeatureSetup.tsx`, `EncryptedDnsSection.tsx`, `src/features/freed-app.tsx`, `src/lib/native-intervention.ts`, `focus-shield.ts`, `encrypted-dns.ts`, `protection-readiness.ts`; existing `modules/freed-protection` implementations and Screen Time extensions. Reuse current adapters rather than inventing a second authority.

**Consumes:** Saved target choices, native authorization/configuration and a validated intervention. **Produces:** Truthful coverage, supported activation, one outcome and target-specific native expiry.

- [x] Expose adult-website activation independently of app limits; Android explicit consent applies the real filter.
- [x] Keep configured/enabled/health distinct and surface supported DNS setup on iOS.
- [x] Publish pending native interventions durably before supported iOS26.5 handoff; keep older-system fallback and strict lease/generation checks.
- [x] Preserve privacy-safe, guarded, fixed Safari native envelopes and host scope.
- [ ] On a signed test phone, enable website protection and selected-app rules independently. Record consent, system return and native state before and after each action.
- [ ] Run the safe adult-category test and normal browsing over Wi-Fi and cellular, then permission loss, restart, reboot, conflicting transport and real native window expiry.
- [ ] Test the actual Safari site permission/message path and supported Shorts/Reels URL rules. Leave the release gate off if any required behavior or review is missing.
- [ ] Test Android selected Shorts/Reels detection in each supported app/browser version and device locale. Capture the separate prominent disclosure and consent before Accessibility access. Confirm ordinary videos, messages and navigation are not intercepted.
- [ ] Record explicit unsupported iOS native-Shorts presentations; validate the whole-app alternative. Do not turn a saved preset into a fake enabled state.

Use the existing fixture-bound runner; it must reject owner devices and receipts from another installed binary:

```sh
node scripts/run-feature-verification.js --mode list
node scripts/run-feature-verification.js --mode all --plan --report docs/validation/artifacts/core-journey-plan/requirements.json
```

Execute selected native flows only with an actual disposable fixture receipt and its installed binary hash. Complete native/device requirements in the generated manifest rather than marking a smoke flow as the whole feature.

## Task 3 Validate monetization and store ownership

**Files:** `src/lib/monetization.ts`, `native-monetization-adapter.ts`, `native-iap-adapter.ts`, `src/features/freed-app.tsx`; `functions/src/purchase-firebase.ts`, `purchase.ts`, `subscription-notifications.ts`. Existing product IDs and ownership classes remain.

**Consumes:** Verified membership/expiry, native store metadata, consent and foreground reset eligibility. **Produces:** Actual store price/period, validated purchase state and honest SDK ad outcome.

- [x] Native Google/Apple/email entry stays available; public OAuth configuration is durable and native production validation rejects missing/mismatched inputs.
- [x] Internal TestFlight profile enables real Google sample units through the compiled channel; public release preflight rejects internal/test configuration.
- [x] Ad presentation requires explicit choice, real SDK events and repeated eligibility checks. Paid/SOS/cancel/background and duplicates are guarded.
- [x] Sandbox signed Apple TEST delivery is verified; it produces no purchase mutation. Both App Store callback destinations are V2.
- [ ] Approve/apply prepared FREED-only Play billing access and create a server-held verifier key. Keep other apps and account-wide permissions unchanged.
- [ ] Deploy combined checkout/verification and Google notification services only after configuration validation succeeds; verify their source and transport boundaries.
- [ ] Verify real prices and eligible offers from the two stores; keep checkout disabled if metadata/verification is unavailable.
- [ ] On real sample-ad builds, record consent refusal, no fill, timeout, early close, complete reward, background, cancel, duplicate/late callback and paid-state change. Assert no ad on SOS and no adult-domain release.
- [ ] Run sandbox purchase, pending, cancellation, renewal, grace/hold, expiry, restore, plan change and refund/revocation with account collision/ownership cases. Access continues only through verified expiry or a verified allowed grace interval.
- [ ] Resolve Production Apple TEST401 with authorization evidence; a Sandbox success cannot clear the Production gate.

Supported existing tests and actual controller/SDK fixtures are listed in the feature journey map. Run modified ownership/ad suites plus backend emulators after a code change; do not replace missing transaction evidence with a fabricated entitlement.

## Task 4 Complete Firebase delivery and data behavior

**Files:** Corrected `functions/src/foundation.ts`, `foundation-expiry.test.ts`, `adult-feed.ts`, `adult-feed.test.ts`; existing backend source, rules and declarations. Receipt: `docs/implementation/2026-10-04-foundation-deployment.md`.

**Consumes:** Verified Firebase Auth/AppCheck, client consent, opaque encrypted data and store-signed events. **Produces:** Bounded authenticated service results and retained source/evidence receipts.

- [x] Enable the specifically approved billing link; configure default Storage, App Attest, narrow runtime/build permissions, deny-all client data rules, active TTL fields and ready indexes.
- [x] Correct numeric expiry writes and Timestamp duplicate reads; retain legacy numeric data. Targeted red/green and216-test emulator suite pass.
- [x] Publish20,376 validated hostnames while omitting eight unsupported suffix-wide rules without weakening malformed/exception/wildcard/protected-site gates.
- [x] Deploy18 scoped functions with downloaded source binding,39 HTTP rejection probes and signed Sandbox Apple delivery. Preserve separate source revisions for feed endpoints.
- [ ] Verify a signed-device authenticated readiness/feed request. Administrative public-data verification is not client AppCheck proof.
- [ ] Exercise encrypted upload/finalization/download/restore/delete with ownership, generation mismatch, interrupted save, quota and account-deletion fences; record actual object cleanup and temporary-camera cleanup.
- [ ] Obtain a securely stored online coach provider key, then deploy/test loading, cancellation, retry, quota, offline and error paths without disclosing private input in logs.
- [ ] Validate consented reminder/push delivery on a test account and native device; no messages to partners or real users are sent as a side effect of setup.

Existing focused repository checks:

```sh
node scripts/run-ts-entry.js tests/firebase-foundation.test.ts
node scripts/run-ts-entry.js tests/firebase-functions-contract.test.ts
node scripts/privacy-safety-audit.js
```

Full backend emulators run in an independent copy under the supported Node22 runtime, with public certificate fixtures retained. Do not run source-repairing broad Core tests in the shared checkout.

## Task 5 Finish console declarations from actual behavior

**Destinations:** FREED Firebase `freed-7d5ee`; Apple app6816637268/bundle`app.freed.recovery`; Play developer7120618648526345593/app4973054839707244779/package`app.freed.recovery`.

**Consumes:** Current privacy/review answer sheets, published support/legal pages, actual SDK data use and the supported capability matrix. **Produces:** Accurate saved console settings and screenshots/readbacks.

- [x] Verify live Firebase provider and App Attest configuration, Apple signing capabilities/profiles and V2 notification destinations.
- [x] Confirm the existing Soumya tester belongs to Internal with access to builds; do not invite additional people or notify all testers.
- [x] Save Play's actual contains-ads declaration, Productivity category, established support contact and URLs as review drafts. Government, financial and health declarations are also saved;6/11 initial tasks complete.
- [ ] Fill app access, target audience, content rating, data safety, government/financial/health declarations from the verified behavior. At an actual legally binding terms step, obtain the required specific acceptance rather than guessing.
- [ ] Add required Accessibility/DNS foreground-service declarations only against the actual release artifact and representative device recording. Do not claim disability-tool eligibility for a general self-control app.
- [ ] Configure monthly/yearly products and renewal/notification routing consistently with existing IDs and store metadata; verify account contracts, availability and publication state instead of inventing a price or entitlement.
- [ ] Stop before security-sensitive billing grants/key creation until the concrete scope is approved. Store private material outside the repository and in Secret Manager; read back permission scope and deployed bindings.

## Task 6 Verify every presentation and interaction

**Files:** Existing shared design system, `src/components/PreferencesScreen.tsx`, `WelcomeScreen.tsx`, `MomentumCompanion.tsx`, locale registry/catalog, current screen matrix and Maestro selectors.

**Consumes:** Approved visual target, persisted preferences/drafts, current activity/service state and supported platform capabilities. **Produces:** Reviewable native recordings and the full64×10×2×2 surface matrix.

- [x] Compact native settings widgets, language flag sheet, bounded companion interaction and adaptive welcome implemented; local suites pass.
- [x] Native Today, Profile, account, Preferences and language anchors observed; Light/Dark persistence and cold-start return checked.
- [ ] Verify normal SE-size welcome without scrolling, both themes, large text with accessible overflow, all ten languages and Arabic restart/draft preservation.
- [ ] Record companion entrance, tap reaction, phase-linked breathing, earned celebration and Reduce Motion; verify focus/background stops and no obstruction of important controls.
- [ ] Execute cold start, deep links, tab retention, push/pop, modal/sheet dismissal, permission return, purchase origin return, keyboard and Android hardware back.
- [ ] Review every catalog surface/state for clipping, contrast, screen-reader semantics,44-point targets, unavailable states and truthful metrics. Keep blocked rows visible.
- [ ] Measure release launch/frame/memory behavior on the slowest supported physical devices. A heavily loaded Simulator recording cannot establish release performance.

## Task 7 Deliver the signed internal build and handoff

**Files:** `scripts/build-ios-release-archive.js`, `scripts/lib/ios-safari-focus-shield-contract.js`, `tests/ios-safari-focus-shield-contract.test.js`, internal profile/native materialization and current source/binary receipts.

**Consumes:** The tested source, six correct distribution profiles, public native inputs and original compiled artifact. **Produces:** Signed IPA, source/binary-bound report, accepted screenshots and verified TestFlight processing/Internal access.

- [x] Fresh native compile, archive and export succeeded with the correct Google/internal/test/DNS inputs and no runtime resolver change.
- [x] Diagnose stale single-native-message inspection: actual source/archive have one fixed configuration handshake plus one fixed intervention. Correct fail-closed AST validation;46 archive/source mutation tests,19 adjacent tests and selftests pass.
- [ ] Replace expired build2 with a new coordinated source snapshot and signed archive/IPA. The earlier temporary archive directory is no longer present; rebuild in the durable ignored workspace and inspect all original signing/resource/authority checks. The unsigned current protection library and DeviceActivity extension compile successfully.
- [ ] Capture actual current screens at accepted device dimensions after the machine's memory pressure clears. Exclude fabricated activity, health, price or membership state; inspect before upload.
- [ ] Upload with App Store CLI to app6816637268, verify VALID processing and Internal availability, add concrete What to Test notes, and leave public App Store/Play release gated.
- [ ] Deliver the plan, feature map, source/binary receipts, test results, TestFlight state and exact unresolved credentials/device/policy gates. Do not call complete local checks100% app readiness.

Review the plan against the spec before each phase transition. Source, task ownership, external effects and mandatory evidence remain explicit. Reuse suitable isolated workspaces and preserve the shared checkout.
