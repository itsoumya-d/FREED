# FREED functional corrections and TestFlight work

Owner requested actual activation, Google/Firebase sign-in, native settings, one-frame welcome, interactive companion, explicit test ads, every-feature usability, screenshots and TestFlight on October4. This supersedes the earlier UI freeze. SDK remains Expo55 / RN0.83.6.

## Concrete gaps found

1. Served QA bundles omitted public Google OAuth inputs; stale Android bundle also omitted current protection controls. Rebuild/provenance is mandatory.
2. Native Google/Firebase implementation existed; provider is enabled and matches native configuration. Native entry now stays visible with recoverable unavailable copy. Public IDs are durable in EAS/config templates and native TestFlight fails absent/mismatched input.
3. Default TestFlight disabled encrypted Families transport and sample ads. Explicit internal channel now enables supported DNS capability and real native SDK sample units; public production retains strict exclusion.
4. Native interceptor and ad screen used vague automatic ad presentation and simulated fallback delay. Explicit optional choice, immediate free recovery, Premium/SOS zero requests and cancellation/presentation gates replace it.
5. Android website consent saved consent without starting native filtering; explicit consent now starts native filtering.
6. iOS standalone DNS settings were hidden behind a ScreenTime-only presentation. Existing independent encrypted-DNS consent/OS status are now surfaced, without invented health.
7. Settings were oversized and repetitive; compact native groups and language sheet replace giant cards. Welcome fits normal small screens; large-text overflow remains accessible. Original companion has bounded eligible hop/wave with lifecycle/motion safeguards.
8. Shield primary only closed the blocked app. iOS26.5 supports openParentalControlsApp; guarded durable publication and failure isolation are implemented. Older OS retains documented close/notification fallback.
9. Invalid native grants revoked unrelated leases. Strict rejection now preserves them. Review caught two notification ordering races; shared lock now dispatches only after successful persistence while held. Scoped re-review approved.
10. Short-form interception remains platform/policy gated. DNS cannot distinguish URL paths or remove every adult image in mixed apps. Whole-app iOS shields and supported Safari rules have distinct setup/coverage.

## Evidence and limits

Root inspected23 Opal/QUITTR image references through the Appllama plugin/browser. Owned current-source changes preserve the approved identity and semantic palette. Focused UI43, rewarded19, config/auth/native SDK tests and native shield/reset fixtures pass; aggregate and native visual checks follow after integration.

Firebase google.com live configuration read confirms enabled=true and client-ID match; values/secrets withheld from reports. Cloudflare Families public resolver needs no website zone or Cloudflare account. Native routing/configuration and real-network checks remain necessary.

App Store CLI5.7 uses the existing FREED keychain profile and Apple Distribution identity. The capability gap was Development enabled with Distribution unchecked. Applying the previously approved Apple terms/request enabled distribution for main and all three Screen Time targets. Six new ACTIVE App Store profiles were decoded and installed: main MF6V3D2D36; shield action VY9ZQKWDR9; shield configuration UFSHKJ5C53; monitor K7YB9UJ6CR; Safari blocker7TN98LXST4; Safari Focus3QU7A9Y5QT. Main and three Screen Time profiles grant FamilyControls; all retain the expected App Group. Main grants dns-settings. Actual requested application entitlement remains only dns-settings, with no packet tunnel.

Store screenshots will use current actual app rendering and accepted device dimensions. TestFlight upload uses a signed internal native build, real sample ads and native billing unavailable states where service proofs are absent. It does not establish public launch readiness or complete physical/scenario evidence.

## Integrated source and native evidence

The isolated complete local runner passed173/173 suites and1,080 assertions with0failed/0skipped;109/109 requested local checks ran. This is local evidence, not complete feature scenario proof. Source comparison checked3,533 files against the verified snapshot; only two generated audit reports differ. New iOS26.5 Simulator native compile passed. A shared Metro transform cache initially served a deleted snapshot Router context with0routes; disabling cache stores in the temporary native workspace yields3,973 modules/22 actual app routes and all native Google inputs. No application resolver/source change was required. Corrected native rendering confirms Today, Profile, account Google/Apple/email/guest controls, native Preferences widgets, ten-language flag sheet, and persisted Light/Dark switching. Recordings and full-resolution captures are retained under the correction artifacts. Simulator observations are not physical blocking or performance evidence.

Live Firebase billing now confirms enabled on the previously approved account ending0ECFDB. Google provider remains enabled with the matching native web client. Foundation deployment is in progress; AI and combined store-verification endpoints remain gated by missing credentials/scenario evidence.

## Backend integration correction

A subsequent backend-only correction normalizes transaction expiry at the Firestore adapter: rate-limit and idempotency writes use Timestamp, and Timestamp reads become milliseconds for the existing pure mutation gate. Legacy numeric reads remain supported. Three targeted production-callable/transport-fixture tests and the complete212-test emulator suite pass. App and native inputs remain unchanged. Source binding explicitly separates this subsequent backend change from the earlier173-suite local app run. The18 scoped foundation/Apple webhook functions are ACTIVE with deployed-source binding and34 live negative HTTP checks. Private key values and callback payloads are excluded from reports. Combined checkout/verification, AI and Google notification functions remain undeployed pending credentials; successful deployment alone does not establish signed-device or lifecycle proof.

## Store validation and current build

The first signed1.0(1) upload failed Apple validation90849 because the Safari web extension lacked manifest icon entries. Source now includes numeric16/32/48/128 PNG entries derived from the unchanged original SVG, a folder-preserving Xcode resource entry, and generator regeneration. The inspector validates actual bundle resources with bounded PNG decoding and CRC/dimension/path checks.69 actual source/archive/rejected-package tests passed with0skips;21 adjacent tests and selftests passed. A resource-only1.0(2) archive retains the original executable UUIDs and main Hermes bundle, preserves all six entitlement dictionaries, is strictly deep-signature verified, and exported successfully through Xcode. Current inspection8/8passed; IPA SHA d443affbf43a5553e5754f18cd1192aceaf7d859014eaaaa9603c9bc5bd993c6. The second upload is in progress; availability is not claimed until processing/group readback.

Product journey and gap spec, implementation plan and109-item map were added after the latest core-protection request. Play Console remains draft; FREED-only verifier permission/key approval is pending. Public release and full supported scenario evidence remain incomplete.
