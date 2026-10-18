# FREED launch implementation — 2026-10-01

Authority: the user-approved FREED complete functionality and store launch plan in this chat.

Configuration: app.freed.recovery; Firebase freed-7d5ee / asia-south1; monthly USD 9.99 and annual USD 39.99; no trial; identical full Premium benefits; guest checkout and later account linking; real rewarded ads with Premium/SOS bypass; Firebase USD 25 budget alerts at 50/80/100 percent.

Ruling: implement in the existing codex/freed-publication-ready checkout. Its 83-file uncommitted implementation is an input to the approved plan, and a fresh worktree would omit it. Preserve all pre-existing changes; do not reset or commit unrelated work.

## Execution ledger

- A — baseline, dependency remediation, and feature ledger: in progress.
- B — Firebase provisioning and account identity: pending.
- C — store billing and entitlement lifecycle: pending.
- D — accurate data and truthful UI: pending.
- E — native backup, Firebase providers, notifications, consent/rewarded ads: pending.
- F — signed builds, device evidence, store setup, upload/review/publication: pending.

## Confirmed external prerequisites

- Firebase billing is still disabled as of the implementation preflight.
- Physical-device and store sandbox evidence must be collected before public release.
- Required owner-only billing/legal/credential actions must remain explicit; do not invent credentials, review contacts, approvals, or successful test receipts.

## Initial verification

- Branch: codex/freed-publication-ready; HEAD 2ad7993.
- Prior audit: core compilation fails on missing isRewardedAdSdkConfigured; typecheck additionally fails on CryptoHost cast; backend timeout test is timing-sensitive.
- Prior audit: Firebase callable/runtime contracts and calendar/DST tests passed; all must be preserved.

## Verified implementation receipts

- Foundation behavioral test failed on missing monthly Premium capabilities, then passed after monthly/annual capability parity and the ad-SDK configuration helper were implemented. Typecheck passed after secure-random typing repair.
- Functions timeout test now uses a virtual deadline; full Functions suite passed. New server CLARA quotas use durable purchase claims (Free 3/Premium 20 per UTC day), not client Premium flags.
- Native backup crypto: nine behavioral tests; Swift/JCA/legacy-HMAC vectors; iOS bridge typecheck; Android native module compilation. Real rebuilt-device proof remains pending.
- Dependency remediation: valid clean npm ci/npm ls tree, zero production advisories, four actual router/navigation query tests, successful Android Metro and web exports. One low development-only esbuild advisory remains.
- Native purchase tests retain verified expiry and localized prices, bind checkout identity, and pass Android base-plan offer tokens. Cached entitlement tests cover expiry, the 24-hour offline bound, revocation, rollback, and saved progress.
- Ad consent now fails closed on consent/initialization error. No-ad fallback remains usable and does not invent an SDK reward.
- Firebase console: Anonymous and Google sign-in enabled; project-facing name FREED and its existing owner support email selected. Android debug/upload SHA-1 and SHA-256 fingerprints registered. Apple/email-link and Play signing fingerprints remain to finish.
- Firebase feature providers are lazy; tested callable payloads, deduplicated analytics events, reviewed-feed integrity, immutable encrypted backup upload/finalize/download.

Ruling: user instructed keeping Firebase billing OFF until the early audience grows. Blaze activation was not performed; the prepared billing tab was closed. Continue app/free Firebase/store setup. Cloud Functions/Storage deployment and public paid launch require either a separately selected free backend or later billing activation. Backend preference question is pending; do not silently remove advertised functionality or bypass server purchase verification.

Ruling update: the user subsequently stated they updated Firebase. A newly opened live FREED console shows Billing plan: Blaze; the MCP environment billing flag was stale. The owner performed activation; agent did not commit the billing upgrade. Continue the approved Firebase backend architecture and do not start alternative hosting. Verify real service/API and secret availability before deployment claims.

- Social login SDK configs refreshed from Firebase after Google enablement: actual Android OAuth clients for upload/debug and the iOS client/callback scheme are now in native config; public local environment values updated without touching server secrets.

Implementation receipts and remaining blockers are appended here as work is verified.

## 2026-10-01 production configuration and functionality

- Firebase console now confirms Google, Apple, Anonymous, Email/Password and email-link provider settings enabled. Native Google OAuth/callback configuration is refreshed. Apple revocation credentials and physical sign-in evidence remain pending.
- The owner-selected Blaze plan is visible, but the linked Firebase Payment account shows an overdue/missing-valid-payment warning. Secret Manager requests return billing-required errors, preventing Functions deployment and production purchase verification. The owner payment page and action request are prepared; no payment or financial commitment was made by the agent.
- Firestore rules/indexes and Remote Config deployed and read back successfully. Remote service feature flags stay disabled pending production proof. New TTL overrides remain to deploy; Storage bucket provisioning and Functions deployment remain blocked.
- Verified entitlement ownership, guest purchase/account linking fences, expiry/24-hour offline access, renewal/refund/revocation/grace/hold processing, restored transaction ownership and Android plan replacements are implemented. Latest Functions unit suite: 196 passes, two emulator-dependent skips; live store sandbox scenarios remain unverified.
- Recovery activity archives preserve counts beyond display caps. Analytics sends durable retryable snapshots with guarded lineage/window reconciliation. Automatic encrypted backup uses secure key storage and persisted-state checks; restored backup data cannot grant Premium.
- The native iOS app now launches after configuring Firebase before Expo startup and supplying Google's official sample AdMob app ID only for Simulator. Distribution builds require real application IDs. This Simulator receipt is not a physical-device or signed-store receipt.
- Public support/privacy/deletion contacts now use the authorized soumyadebnath1661@gmail.com. Existing hosted legal pages were rebuilt, deployed and checked live. Store metadata uses two equal-benefit plans, no trial and manual publication; store submissions remain pending.

## 2026-10-01 setup and paywall redesign

- User explicitly requested easier native setup and an Appllama-inspired paywall. Studied 39 actual reference images; IDs/pattern notes are in research/2026-10-01-setup-paywall.
- Replaced the lengthy iOS setup wall and Android-only presentation with one shared current-step screen, a visible action, progress and optional Help. Native permission approval automatically proceeds through verified required stages; actual activation diagnostics remain mandatory.
- Added iOS 26.2+ public Safari extension settings routing with older-system public app settings fallback. Screen Time waits for the user's decision. Picker cancellation resolves and swipe dismissal cannot strand its promise. Android consent callback no longer blocks the UI thread while waiting for the service.
- Fixed unknown Safari state routing, Android settings-return step identity, initial VPN consent continuation and repeated-action protection. Bounded Android startup waiting releases retry controls. iOS daily-limit preference persists before authorization/selection so the picker schedules the saved value.
- Membership presentation now uses short benefits, two selectable store-priced plans, one primary action and one-tap free dismissal, with light/dark and larger-text layouts. Pricing and verified checkout/restore controllers remain authoritative.
- Focused receipts: six setup-flow behavioral tests, five native permission adapter tests, compiled Swift Safari-routing tests, explicit picker/daily-limit source contracts, focused Swift typecheck and Android protection module compilation passed. First redesigned setup Simulator build and screenshot succeeded. Final integrated themes/paywall/flow evidence is being collected; physical authorization and real store checkout remain required.

- Android route follow-up: Usage Access targets FREED's exported system detail page, with OEM list fallback; Accessibility opens the public services list because Android reserves the exact-detail action for privileged apps. VPN conflict recovery opens actual VPN settings. Three explicit route source contracts and focused Kotlin compilation passed. Runtime/evidence validators now require the public route plus genuinely enabled FREED service identity; unobserved capture fields remain unconfirmed.
- Final integrated native build succeeded, including the saved-limit fix. Simulator recovered after failed installs/launches; recorded the real permission-error, retry/help and acknowledged limited-protection flow at 30 fps. The recording tool rejects 60 fps, so this is a navigation receipt, not a 60 fps performance claim. Simulator could not approve Screen Time; no activation or physical permission proof is claimed.
- Created FREED Android/iOS AdMob app records and one rewarded recovery-reset unit each in the owner's existing account. Public IDs are configured locally. Published app-ads.txt matching the console-generated publisher record and verified its hosted content. App review/store linking, consent-message configuration, account payment/address hold and live rewarded-ad proof remain pending.

## 2026-10-02 continuation

- Owner deferred payment resolution and requested continuing all other work. Billing warning and the Secret Manager billing-required rejection were verified again; no financial action was taken.
- Owner restored App Store Connect access. Existing owner contact fields were reused for FREED; core review sign-in is optional and manual publication is selected. Marketing/review draft copy was reconciled with two equal-benefit plans, no trial, estimates and actual native permission boundaries. Save/readback verification is in progress. No review submission or public release was performed.
- Checkout navigation now uses a session token. A verified result can update the same account's entitlement while a reminder, urgent intervention or subsequent paywall keeps navigation ownership. Five focused navigation tests pass.
- Local calendar week now recomputes its date window on day changes; New York and Kolkata DST/rollback tests pass.
- Node 22 cancelled a real-time timeout test because its unreferenced timer did not keep the test process alive. Virtual deadlines now test abort timing without altering production transport timeouts. The full server suite with Firestore/Storage emulators passes 198 tests, with zero failures/cancellations/skips. Storage emulator does not enforce all GCS generation preconditions; live GCS proof remains required.
- Fresh iOS Simulator native compilation succeeded. Latest client bundle/navigation and appearance checks are being collected against this build. No physical Android device was connected; the paired iPhone is disconnected.
- VPN conflict recovery now opens the actual VPN settings page and remains actionable; initial normal VPN replacement still uses the direct system consent prompt. Safari prepares missing rules before opening extension settings.

- Apple draft save confirmed before leaving the version page. Owner review contact was reused, Sign-in required is unchecked, and manual release is selected. Subscription group English localization now displays FREED Premium. Annual upfront availability was confirmed in all 175 current supported regions; monthly 12-month commitment was not configured. Annual display copy is FREED Premium Annual / All Premium features, billed yearly. No free trial.
- Equal service-level edit is prepared for the owner after the drag-only editor rejected automation. The Chrome extension screenshot chooser requires Allow access to file URLs; no permission was changed by the agent. Its connection reset on retry. Screenshot review upload and later browser steps remain pending.

- Android release retry now observes actual Ninja object-log changes while keeping the absolute 45-minute deadline and 10-minute idle deadline. AGP directly invokes Ninja and ignored CMAKE_BUILD_PARALLEL_LEVEL; CMake pools now enforce the requested job limit. Actual pool depth=1 and one compiler were observed. Three real child-process progress/stall/deadline tests and the helper self-test pass; the signed AAB retry is still running.
- Fresh full core: 278 passing checks. Audit guards now test the shared setup/paywall and durable analytics behavior; strict default-shell result is 25 pass/12 outstanding environment, production, dependency and hardware gates. Fresh canonical hosted legal audit passes all 18 checks.
- Monthly Apple availability is confirmed in 175 current regions, localization and review notes saved and read back. Annual/monthly screenshot uploads are blocked by both Chrome extensions' local-file URL permission. An owner action request is pending; no extension permission was changed.
- Runtime evidence confirms monthly price selection, one-tap Free exit returning to Profile, and reachable Restore/Manage/Privacy/Terms after one scroll. paywall-monthly.png was actually Profile and must not be used as a paywall receipt; the correct image is paywall-monthly-confirmed.png.
- A fresh Simulator crash report identifies _xpc_api_misuse inside SafariServices shared connection initialization reached by concurrent background blocker-status calls. Native callback entry now runs on MainActor with the existing exactly-once/deadline wrapper; its compiled Swift test reproduced the actor violation before the change and all four native routing/callback tests now pass. Simulator rebuild and repeated-start runtime proof remain pending. Live Dynamic Type changes clipped native text although a fresh mount wrapped correctly; the two display views now remeasure on font-scale changes, with final runtime validation pending.
- The dependency audit changed since earlier receipts: GHSA-86w9-cpqp-85rv now covers node-forge<=1.4.0, and npm's latest is still1.4.0. Source/tree inspection finds it in Expo tooling, with updates disabled and no app/Functions import; this is not binary attestation or a patched dependency. The zero-advisory gate remains failed. Do not downgrade the aligned native stack or install an unreviewed upstream patch as an audit workaround.

- Final Android AAB built successfully with configured upload signing, production AdMob IDs, arm64 and Hermes. Size 46,979,303 bytes; SHA-256 169e79cb101e5529d040c1cdfbc9e4375ca480a997776434d77ffff5d97ca520. Independent jarsigner verification reports no unsigned entries, and the actual certificate matches the configured upload certificate. Header inspection confirms executable Hermes bytecode. The builder previously relied on .hbc filenames; it now checks actual header bytes, with real compiler and misleading-extension tests. Seven Android build/inspection tests pass. Upload remains blocked by Chrome extension file access; no internal/public release was published.
- Final iOS native rebuild succeeded from cache; latest JS bundle SHA-256 is 5182f828b6a65d84491188b12930f0e197561c631bef4d54268cd7179b77a5b6. Reinstalled without deleting the data container. A real live text-size increase now wraps correctly; native accessibility state preserves Monthly checked. Final action reachability and repeated startup checks are being collected.
- Google Play privacy URL was not persisted by the first synthetic input attempt. It was entered and saved using focused browser input, then verified after reload. The revised 1961-character two-plan description was saved as a listing draft and read back after reload. Local metadata removes obsolete lifetime/Core 3 references and distinguishes encrypted backup records from plaintext analytics/AI inputs.

- Configured strict audit now reports 27 pass/10 fail. Remaining failures require Firebase secrets/deployed production evidence, an upstream dependency patch, physical browser/protection/performance evidence, and store/ad sandbox/AI smoke proof. Local configuration alone is not release completion.
- Created a separate empty FREEDLaunchApi36 Android test AVD without touching PrimerAuditApi36. Emulator startup is blocked by host Hypervisor.framework HV_DENIED / Invalid argument, despite kern.hv_support=1; no Android runtime success is claimed. The signed APK is available for an actual connected device. No host security settings, privileged entitlements, or virtualization protections were changed.
- The final iOS paywall preserved Monthly through a live accessibility-large increase and return to normal size. Restore/Manage and the inline Subscribe/Free controls remained reachable. Free exit returned to Profile. Screenshots are linked in the current progress receipt.

- Final verification after build-helper and typography changes: typecheck exit0; full core suite exit0 with278 PASS/0 FAIL; seven Android build/bytecode tests pass. iOS final native process remained running after two cold launches and a live large-text increase/decrease. The Google Store Contact edit was prepared but subsequent page snapshots timed out; no edited contact value is claimed. Chrome file-access question and owner-only production/device/store steps remain pending.

- Continued launch work: monthly IAP review screenshot uploaded and saved through the restored Chrome connection. Monthly purchase options now show individual App Store purchase / multiseat Not Allowed. Annual notes were filled but screenshot/Save were not confirmed after Chrome disconnected; owner reconnect request remains pending. No additional file permission was changed by the agent.
- Replaced reference-app IAP assets with real final FREED Simulator captures and updated checksums/dimensions. The manifest describes two launch plans and still requires validation against the exact signed review build. Catalog audit passes25 checks.
- Prepared three public Apple trust roots from Apple PKI, verified CA/self-signature/expiry, and saved their manifest plus the expected base64 array. Public App Store ID and trust-root configuration are prepared locally; private keys were not created, and Secret Manager still returns billing-required403.
- Safari handoff now uses the exact existing Firebase HTTPS route with source/rule/host in its fragment, so coarse recovery metadata is not sent in Hosting requests. Unexpected origins/routes/credentials/ports/query metadata/duplicate parameters are rejected; direct freed:// fallback remains explicit. Six behavioral tests pass. The static fallback makes no remote calls and cannot grant Premium or native unlock authority.
- The existing Firebase web site was deployed from a checksummed successful export. Auto association was disabled and both root/well-known Apple association files are generated identically for exact auth/intervention paths. Live200/equality/scope verification and refreshed native/mobile builds are in progress; physical signed-device delivery remains required. Retired intervention.freed.app was removed from active native domain permissions and current contracts.
