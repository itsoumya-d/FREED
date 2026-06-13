# FREED Evidence Draft: 2026-05-13-release-evidence

This folder is a working area for QA evidence capture. Draft JSON files here do not satisfy release gates.

Fill each draft with real device, store, ad, performance, or backend proof.
Store supporting artifacts under docs/validation/artifacts/2026-05-13-release-evidence/ and reference them from JSON with repo-relative paths such as docs/validation/artifacts/2026-05-13-release-evidence/screen-recording.mov, or use production-safe HTTPS QA/report URLs.
Remote evidence URLs must use real QA/report/artifact paths and must not use URL credentials or fragments, localhost, private/reserved IPs, `.local`, `.internal`, `.localhost`, `.example`, `.test`, `.invalid`, or placeholder host text such as `your-*`, `sample`, or `todo`; signed QA artifact query strings are allowed only for evidence links, never for production API endpoint fields.

Validate drafts with `npm run evidence:validation:draft -- <this-folder>/draft-evidence` before promotion.
When every draft is fully real and draft validation passes, promote with `npm run evidence:promote -- --from <this-folder>/draft-evidence`.
Use `CAPTURE_PLAN.md` in this package as the generated per-gate checklist. It is derived from the same spec as the validator.
Use the capture helper commands below to create pending QA matrices and device metadata before filling draft JSON evidence.

Draft files:
- draft-evidence/ios-physical-device.json -> docs/validation/evidence/ios-physical-device.json
- draft-evidence/android-real-browser.json -> docs/validation/evidence/android-real-browser.json
- draft-evidence/normal-browsing-corpus.json -> docs/validation/evidence/normal-browsing-corpus.json
- draft-evidence/performance-profile.json -> docs/validation/evidence/performance-profile.json
- draft-evidence/store-ad-sandbox.json -> docs/validation/evidence/store-ad-sandbox.json
- draft-evidence/ai-backend-smoke.json -> docs/validation/evidence/ai-backend-smoke.json
- CAPTURE_PLAN.md -> per-gate capture checklist from scripts/validation-evidence-specs.json

Capture helper commands:

```sh
npm run evidence:ios-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-device-discovery
npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-physical-device-capture
npm run evidence:android-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-device-discovery
npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-install-qa --require-upload-signing
npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-real-browser-capture
npm run evidence:normal-browsing-corpus -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/normal-browsing-corpus-capture
npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/performance-profile-capture
npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/store-ad-sandbox-capture
npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-capture
```

Release-env helper behavior:
- `npm run evidence:ios-devices` is a setup handoff only; use it to confirm a trusted physical iPhone name or UDID, but keep `evidenceSatisfied=false` and do not promote it as iOS release evidence.
- Pass `--app <signed-freed-app-or-ipa>` to generate local `ios-app-package-proof.json` (`freed-ios-app-package-proof-v1`, `sanitized=true`); use it for entitlement/app-group/Complete Data Protection/Safari build support only when `packageProofUsableForManualEvidence=true`, `entitlementFailures`, `safariRuleFailures`, and `missingOrMismatchedExtensions` are empty, the app and extensions pass Family Controls/app-group/Complete Data Protection checks, Safari rule signals include adult-domain plus YouTube Shorts / Instagram Reels / TikTok For You web rules with all-block actions, and no packet tunnel/packet inspection entitlements are present.
- Use `ios-physical-device-evidence-fill-template.json` from the helper as the pending final-shape handoff, but keep every check false and every artifact blank until entitlement-approved physical-device recordings or QA reports prove the behavior.
- In the FamilyActivityPicker recording, tap Done after selecting tokens and immediately capture FREED/native status showing `ios.familyActivityPickerAppLimitScheduledImmediately=true` with the `freed.selectedAppDailyLimit` activity and `freed.selectedAppDailyLimitReached` event names.
- Capture the Safari/web short-form challenge handoff separately from the Content Blocker proof: the artifact must show source `ios-safari-short-form`, a matching `short-form:*` rule, host-only storage, `RawPathStored=false`, no native unlock, selected shields still active, and adult filtering still active.
- Attach physical iPhone challenge-verification artifacts for Vision camera labels, no base64/EXIF photo payload, temporary-photo cleanup, motion samples, pedometer steps, and accurate foreground location fixes before setting the challenge verification checks.
- `npm run evidence:android-devices` is a setup handoff only; use it to pick a ready hardware serial, but keep `evidenceSatisfied=false` and do not promote it as Android release evidence.
- Run `npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --require-upload-signing` on Android hardware first, then fill `android.installQaRunId`, `android.installQaArtifact`, and `checks.androidInstallLaunchQa=true` from the local `freed-android-install-qa-report-v1` report before promoting Android real-browser evidence.
- Use `android-real-browser-evidence-fill-template.json` from the helper as the pending final-shape handoff, preserving concrete run IDs and helper-captured artifacts while keeping every check false until physical Android QA, DNS Guard review, challenge verification, and Play policy review are complete.
- Attach Android hardware challenge-verification artifacts for ML Kit camera labels, no base64/EXIF photo payload, temporary-photo cleanup, motion samples, Activity Recognition/steps, and accurate foreground location fixes before setting the challenge verification checks.
- Add `--permission-proof` to a physical-device run, or run `--scenario none --permission-proof`, to generate `android-permission-proof.txt`/`.json` plus local Accessibility, Usage Access, notification, and DNS Guard consent permission reports; pair it with the FREED native status/profile screenshot before filling UsageStats and notification prompt metrics.
- Open FREED to Profile > Native Protection, then add `--native-status-proof` or run `--scenario none --native-status-proof` to capture `android-native-status.png`, UI text, and UI hierarchy for UsageStats metrics, adult-domain feed status, Private DNS, and DNS Guard resolver diagnostics.
- After enabling DNS Guard, reboot the physical device or update the app package, then run `npm run evidence:android-real-browser -- --device <serial> --scenario none --dns-guard-restart-proof` to capture `android.dnsGuardRestartRunId`, `android.dnsGuardRestartArtifact`, restart action/result/user-enabled/eligible fields, and the paired native status text; repeat after manual stop or VPN revocation for the skipped-restart artifact and reason.
- Run `npm run evidence:android-real-browser -- --device <serial> --scenario none --focused-webview-proof` with the installed `app.freed.qawebview` fixture to collect `android.focusedWebViewPackage`, `android.focusedWebViewRunId`, and `android.focusedWebViewArtifact`.
- Run `npm run evidence:android-real-browser -- --scenario none --play-policy-proof` to package the Android Accessibility/DNS Guard disclosure pack and manifest declarations for `android.playPolicyAccessibilityArtifact` and `android.playPolicySpecialUseFgsArtifact`; concrete Play Console review IDs are still required.
- Run `npm run evidence:android-real-browser -- --device <serial> --scenario synced-feed --adult-domain-feed-host <synced-feed-only-adult-host> --dns-guard-proof` with a reviewed synced-feed-only adult host to collect `android.adultDomainFeedAccessibilityArtifact`, `android.dnsGuardBlockArtifact`, `android.dnsGuardInterventionVisible=true`, and `android.adultDomainFeedDnsGuardArtifact`; pair it with native feed status proof.
- Run `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --scenario none --app-scenario browser-earned-unlock --configured-app-package com.instagram.android --configured-app-label Instagram` after completing a browser/adult-domain challenge to prove `android.browserEarnedUnlockNativeAppUnlockActive=false`, `android.browserEarnedUnlockConfiguredAppStillShielded=true`, and `android.browserEarnedUnlockAdultFilterStillActive=true`.
- Run `--app-scenario short-form-both` for YouTube Shorts to collect the below-threshold and sustained-intercept fields, then repeat the sustained helper flow with `--app-scenario short-form --short-form-package com.instagram.android --short-form-label "Instagram Reels"` and `--app-scenario short-form --short-form-package <installed TikTok package> --short-form-label "TikTok For You"` where the TikTok package is `com.zhiliaoapp.musically`, `com.ss.android.ugc.trill`, or `com.tiktok`; keep each app's observed foreground usage below the configured daily app limit and fill `android.shortFormUsageBeforeLimitMinutes`, `android.instagramReelsUsageBeforeLimitMinutes`, and `android.tiktokFeedUsageBeforeLimitMinutes`, plus selected-surface proof fields for YouTube, Instagram, and TikTok, so the proof cannot be mistaken for a broad app-limit shield.
- `normal-browsing-browser-summary.template.json` precomputes pending `normalBrowsing.browserMatrix` rows with exact URL counts; fill device details, artifacts, pass counts, zero failure counts, and `passed=true` only after physical-browser QA passes every matrix row.
- `browser-report-templates/*.template.json` gives each browser row a pending `freed-normal-browsing-browser-report-v1` shape with `sanitized=true`; complete these as local JSON result artifacts before copying paths into `normalBrowsing.browserMatrix[].resultArtifact`.
- `normal-browsing-evidence-fill-template.json` mirrors the final evidence shape but starts with false checks and blank pass fields so it remains a handoff aid, not release evidence.
- Keep `--android-background-cpu-proof` on the physical Android helper run to sample package-specific `dumpsys cpuinfo`, write `android-background-cpu-proof.txt`/`.json`, and prefill the Android background CPU artifact plus maximum parsed percent for QA review.
- Use `performance-profile-evidence-fill-template.json` from the helper as the pending final-shape handoff, preserving concrete run IDs and helper-captured artifacts while keeping every threshold metric blank and every check false until the real profiler, DNS, speed, and routing QA passes.
- Android routing proof is captured automatically for no-full-traffic-proxy, no-packet-inspection, and no-MITM-HTTPS review; still attach DNS latency, download-speed, DNS failover, SERVFAIL fallback, VPN revocation, continuous screenshot/OCR absence, continuous image-classification absence, and full profiler artifacts before promotion.
- `--release-env-file` preloads non-secret store provider, Core 3 product IDs, entitlement, purchase endpoint, rewarded-ad unit, and coarse country context into the sanitized capture manifest.
- `store-ad-sandbox-evidence-fill-template.json` mirrors the final evidence shape with the Core 3 launch-product matrix, but keeps artifacts/counts blank and checks false until real sandbox QA fills them.
- `paywall-launch-scope-report.template.json` gives QA the local `freed-paywall-launch-scope-report-v1` shape for proving only Core 3 products are shown, future SKUs are hidden, yearly is the value anchor, restore is visible, and purchase buttons are enabled.
- `store-console-product-setup-report.template.json` gives QA the local `freed-store-console-product-setup-report-v1` shape for proving App Store Connect and Play Console have only Core 3 products configured, future SKUs inactive, screenshots/localizations attached, and draft/internal/TestFlight-only status until evidence passes.
- Explicit store/ad CLI flags override release env-file values, `releaseEnvFileLoaded=true` records the preload, and helper artifacts must still omit raw receipts, Play tokens, customer IDs, store credentials, and ad-network secrets.
- `--release-env-file` preloads non-secret coach endpoint, challenge endpoint, optional retention endpoint, and model context into the sanitized capture manifest.
- `ai-backend-smoke-evidence-fill-template.json` mirrors the final evidence shape with configured non-secret context, but keeps artifacts/counts blank and checks false until real deployed-endpoint QA fills them.
- Explicit AI helper CLI flags override release env-file values, `releaseEnvFileLoaded=true` records the preload, and helper artifacts must still omit raw prompts, transcripts, private notes, sensitive URLs/domains, unredacted model output, and provider API keys.

Useful commands:

```sh
npm run evidence:requirements
npm run evidence:templates
npm run evidence:ios-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-device-discovery
npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ios-physical-device-capture
npm run evidence:android-devices -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-device-discovery
npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-install-qa --require-upload-signing
npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/android-real-browser-capture
npm run evidence:normal-browsing-corpus -- --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/normal-browsing-corpus-capture
npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/performance-profile-capture
npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/store-ad-sandbox-capture
npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id 2026-05-13-release-evidence --output-dir docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-capture
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/release-env-preflight-report.json
npm run audit:store-legal-hosted -- --report docs/validation/artifacts/2026-05-13-release-evidence/store-legal-hosted-url-audit.json
npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/android-apk-build-report.json
npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/android-aab-build-report.json
npm run build:ios-archive:release -- --report docs/validation/artifacts/2026-05-13-release-evidence/ios-release-archive-report.json
npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/backend-readiness-smoke-report.json
npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/supabase-schema-smoke-report.json
npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/adult-domain-feed-smoke-report.json
npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/analytics-ingestion-smoke-report.json
npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/remote-notification-smoke-report.json
npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/purchase-verification-smoke-report.json
npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/2026-05-13-release-evidence/ai-backend-smoke-report.json
npm run audit:release:strict -- --report docs/validation/artifacts/2026-05-13-release-evidence/release-readiness-report.json
npm run evidence:validation:draft -- docs/validation/artifacts/2026-05-13-release-evidence/draft-evidence
npm run evidence:promote -- --from docs/validation/artifacts/2026-05-13-release-evidence/draft-evidence
npm run evidence:validation
npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/2026-05-13-release-evidence
npm run audit:release
```
