# FREED Release Validation Evidence

These files are required before release gates can pass. They must be created from real device, real-browser, normal-browsing corpus, performance profiling, store/ad sandbox, or deployed AI backend smoke runs. Do not set pass markers from intent or desk review.

Store completed evidence JSON files in `docs/validation/evidence/`.
Store supporting screenshots, videos, logs, tickets, or profiler reports in `docs/validation/artifacts/` or reference a real HTTPS QA/report URL.
Copy starting templates from `docs/validation/templates/`, then replace every placeholder with real device, profiler, store, ad, screenshot, video, log, ticket, or report data before moving the file into `docs/validation/evidence/`.
Use `npm run evidence:scaffold -- --run-id <date-or-qa-run>` to create a safe draft package under `docs/validation/artifacts/<run-id>/` without writing placeholders into the release-gated evidence folder.
Scaffolded drafts are refused inside `docs/validation/evidence/`; use `docs/validation/artifacts/<run-id>/draft-evidence` or another non-gated draft folder.
Evidence capture helper `--output-dir` paths are guarded the same way: helpers must write under `docs/validation/artifacts/<run-id>/`, not a URL, flag, shell-syntax path, placeholder, path outside the workspace, a random workspace folder, or `docs/validation/evidence/`.
The scaffold also writes `CAPTURE_PLAN.md`, a per-gate checklist generated from `scripts/validation-evidence-specs.json` plus the release preflight contract so QA can capture every production env value, required check, field, command proof, artifact, release blocker group, and normal-browsing allow/block URL without manually reconciling docs.
Validate drafts in place with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence`; only move completed JSON files into `docs/validation/evidence/` after the draft command passes.
Promote a passing draft package with `npm run evidence:promote -- --from docs/validation/artifacts/<run-id>/draft-evidence`; the command validates every file first and refuses to copy anything if a draft is incomplete.
For the same reason, promotion refuses to use `docs/validation/evidence/` as its draft source.
Follow `docs/validation/evidence-runbook.md` for the exact capture steps, artifact expectations, and field-by-field rules for each evidence file.
Release env-file commands must use local production env-file paths such as `.env.production` or `secrets/prod.env`. The actual npm scripts and evidence validator both reject unsafe `--env-file` or `FREED_RELEASE_ENV_FILE` values, including URL-shaped, flag-shaped, shell-syntax, template, placeholder, missing-value, validation evidence/artifact folder, or unknown release env-file arguments.
For a full release run, prefer `npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/<run-id>` so the verifier adds sanitized JSON report paths to the release preflight, hosted legal URL audit, upload-signed Android APK build, upload-signed Android AAB build, signed iOS Release archive/IPA build, deployed backend, Supabase, adult-feed, analytics, notification, AI, purchase smoke commands, and final strict release-readiness audit, then fails if any report is missing, malformed, has the wrong schema, has nonzero failures, lacks an expected proof section, omits required proof values for hosted privacy/support/account-deletion URLs, Android upload signing, Play Console readiness, APK/AAB ABI/bundle/hash/size, iOS distribution signing/IPA/export/extension/entitlement/Safari-rule proof, endpoint paths, privacy/rejection booleans, timeout bounds, or checked secret-key-name arrays, omits a required deployed smoke result ID including configured AI retention smoke, has smoke result rows that disagree with summary counts, or omits required preflight `blockerGroups`. The release preflight JSON includes `blockerGroups` so QA can see which release blocker group each failed preflight check holds open, which env keys/reports/evidence remain required, that Android signing still needs the upload-signed APK and AAB build reports, and that iOS physical-device validation still needs the signed Release archive/IPA report without storing secret values. The verifier rejects inconsistent group status, missing required reports, missing preflight IDs, wrong-group failed checks, or pass/fail counts that do not match the checks. The final `audit:release:strict` report must be strict, warning-free, count-consistent, and include the full release-readiness gate set as passing; `npm run audit:release` self-checks that the verifier's expected gate manifest exactly matches the audit gate order. Direct preflight, hosted legal URL audit, APK/AAB/iOS archive build, smoke, or release-readiness `--report` paths must be `.json` files under `docs/validation/artifacts/<run-id>` without existing file/symlink path components; verifier artifact directories must also be under `docs/validation/artifacts/<run-id>` without existing file/symlink path components, and must not be URLs, flags, shell-syntax paths, placeholders, or validation evidence-folder case variants.
The evidence scaffold, draft validator, and promotion CLIs also fail on unknown flags or missing option values, and the draft validator rejects unsafe `--evidence-dir` values such as URLs, paths outside the workspace, shell-syntax paths, template placeholders, or `docs/validation/evidence/` itself, so a typo cannot silently fall back to the default evidence directory or re-validate release-gated files as a draft.

Run:

```sh
npm run evidence:requirements
npm run status:launch -- --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/launch-status
npm run audit:store-catalog -- --report docs/validation/artifacts/<run-id>/store-launch-catalog-audit.json
npm run audit:permission-flow -- --report docs/validation/artifacts/<run-id>/permission-flow-source-audit.json
npm run audit:store-legal -- --report docs/validation/artifacts/<run-id>/store-legal-policy-audit.json
npm run evidence:artifact-privacy
npm run evidence:scaffold -- --dry-run
npm run evidence:templates
npm run evidence:ios-devices -- --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/ios-device-discovery
npm run evidence:ios-physical-device -- --device <udid-or-name> --adult-host <real-adult-host> --app <signed-freed-app-or-ipa> --short-form-url <youtube-shorts-url> --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/ios-physical-device-capture
npm run evidence:android-devices -- --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/android-device-discovery
npm run qa:android-install -- --device <serial> --apk android/app/build/outputs/apk/release/app-release.apk --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/android-install-qa --require-upload-signing
npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/android-real-browser-capture
npm run evidence:android-real-browser -- --device <serial> --scenario focused-search --focused-search-query "pornography video" --output-dir docs/validation/artifacts/<run-id>/android-focused-search-capture
npm run evidence:android-real-browser -- --device <serial> --scenario synced-feed --adult-domain-feed-host <synced-feed-only-adult-host> --dns-guard-proof --output-dir docs/validation/artifacts/<run-id>/android-synced-feed-capture
npm run evidence:android-real-browser -- --device <serial> --scenario none --dns-guard-restart-proof --output-dir docs/validation/artifacts/<run-id>/android-dns-guard-restart-capture
npm run evidence:normal-browsing-corpus -- --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/normal-browsing-corpus-capture
npm run evidence:performance-profile -- --ios-device <udid-or-name> --android-device <serial> --android-background-cpu-proof --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/performance-profile-capture
npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/store-ad-sandbox-capture
npm run evidence:ai-backend-smoke -- --release-env-file <production-env-file> --run-id <run-id> --output-dir docs/validation/artifacts/<run-id>/ai-backend-smoke-capture
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/release-env-preflight-report.json
npm run audit:store-legal-hosted -- --report docs/validation/artifacts/<run-id>/store-legal-hosted-url-audit.json
npm run build:android-apk:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/android-apk-build-report.json
npm run build:android-aab:upload-signed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/android-aab-build-report.json
npm run build:ios-archive:release -- --report docs/validation/artifacts/<run-id>/ios-release-archive-report.json
npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/backend-readiness-smoke-report.json
npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/supabase-schema-smoke-report.json
npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/adult-domain-feed-smoke-report.json
npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/analytics-ingestion-smoke-report.json
npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/remote-notification-smoke-report.json
npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/purchase-verification-smoke-report.json
npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/ai-backend-smoke-report.json
npm run audit:release:strict -- --report docs/validation/artifacts/<run-id>/release-readiness-report.json
npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence
npm run evidence:promote -- --from docs/validation/artifacts/<run-id>/draft-evidence
npm run evidence:validation
npm run verify:release -- --env-file <production-env-file> --artifact-dir docs/validation/artifacts/<run-id>
```

`npm run evidence:requirements` prints the schema-versioned machine-readable requirement list from `scripts/validation-evidence-specs.json`, the same spec data consumed by the validator, plus `generatedAt`, `productionEnvChecklist`, `handoffDocuments`, `handoffDocumentCommands`, and `productionBlockerGroups` for the remaining release-audit gates; use it for QA handoff so check names, target files, required fields, production env checklist values, canonical capture/report/validation/promotion commands, sanctioned smoke commands, required env groups, and required numeric profile fields stay in sync with the actual gate.
`npm run status:launch` writes a sanitized `freed-release-launch-status-v1` JSON plus Markdown dashboard from the current preflight report and local handoff packets. It does not read secret env files, submit to stores, deploy services, or mark release evidence as passing; use it as the operator checklist before running the real production-env and device/store evidence steps.
`npm run audit:store-catalog` writes a sanitized `freed-store-launch-catalog-audit-v1` report proving the local Core 3 store catalog, App Store CSV, Play CSV, IAP screenshot manifest, listing screenshot capture plan, disabled future SKUs, and screenshot hashes/dimensions are aligned before console entry. It is a local catalog precheck only and does not prove App Store Connect or Play Console products exist or pass sandbox purchases.
`npm run audit:permission-flow` writes a sanitized `freed-permission-flow-source-audit-v1` report proving the checked-in source still enforces the strict Android and iOS permission order, exact OS routing surfaces, Android Usage Access reason/config activity, required-row app-return refresh/auto-advance behavior, optional Android notification/Private DNS return continuation, zero-app Android selection recovery, and activation diagnostics gate. It is a source-level contract only; it does not prove physical-device permission grants, browser blocking, Safari extension state, or store review approval.
`npm run audit:store-legal` writes a sanitized `freed-store-legal-policy-audit-v1` report proving the checked-in privacy policy, public legal routes, App Store privacy answers, Play Data Safety sheet, store metadata, platform policy packs, and submit checklist remain internally aligned. It is a local legal/metadata precheck only and does not prove hosted page availability, legal review, console answers, platform approval, sandbox purchases, or physical-device evidence.
The production env checklist carries the same private evidence warning as generated draft packages: Do not put App Store private keys, Play service accounts, Supabase service-role keys, Redis tokens, push credentials, maintenance secrets, access tokens, purchase receipts, raw purchase tokens, or AI provider keys in any evidence JSON.
`npm run evidence:templates` checks that every template still includes the gate-specific field examples QA needs for iOS physical-device, Android real-browser, normal-browsing corpus, performance, store/ad sandbox, and AI backend smoke captures, verifies checked-in draft packages under `docs/validation/artifacts/*/draft-evidence` still align their draft JSON, `requirements.json`, and `CAPTURE_PLAN.md` with the current evidence spec, and verifies this README plus `docs/validation/evidence-runbook.md` still include the shared capture-helper, report-artifact, draft validation, promotion, and final verification commands.
`npm run evidence:artifact-privacy` scans checked validation artifact JSON/Markdown/text under `docs/validation/artifacts` and fails if shareable local artifacts contain `/Users/...`, `/home/...`, Windows `C:\Users\...` profile paths, raw Apple device names, or CoreDevice hostnames; use `node -- scripts/validation-artifact-privacy-audit.js --fix` only for mechanical path redaction to `~` before reviewing the diff, and regenerate stale device-list artifacts with redacted labels.
`npm run evidence:validation` and `npm run evidence:validation:draft -- <draft-dir>` also fail any evidence JSON that contains local home-profile paths, so final promoted evidence cannot rely on a checked-artifact scan alone.
`npm run evidence:ios-devices` performs bounded Xcode device discovery and records whether a physical iPhone is ready. `npm run evidence:ios-physical-device` refuses simulator/offline targets unless `--plan-only` is used, then collects Family Controls, App Group, Complete Data Protection, Screen Time selection/limit/shield/relock, adult-domain Safari Content Blocker, and iOS 15.4+ Safari Focus Shield evidence. App-package proof must include the embedded Shield Configuration, Shield Action, DeviceActivity Monitor, Safari Content Blocker, and Safari Focus Shield targets and prove the absence of packet-tunnel/packet-inspection entitlements. Content Blocker evidence covers adult-domain rules; Safari Focus Shield evidence separately covers approved short-form routes, the background-worker native relay, Universal Link recovery, and raw-path nonretention. Prepare App Review notes from `docs/store-policy/ios-screen-time-safari-dns-review.md`. Challenge evidence remains physical-device-only and covers on-device Vision, motion/steps, foreground location, no media upload, and no timer-only bypass.
`npm run qa:android-install` proves the release candidate APK can be installed and launched on the physical Android device before browser/protection QA begins. Android APK build reports now include an `installHandoff` block with the copied APK path, matching install QA command, Android protection QA command, generated `ANDROID_APK_INSTALL_HANDOFF.md` path beside the copied APK, strict protection flow order (`android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test`), and the activation-readiness rule that adult domains must be blocked while normal browsing is allowed before activation is saved. The install QA script writes a sanitized `freed-android-install-qa-report-v1` report under the run artifact folder with the same structured `protectionHandoff.flowOrderSteps`, `flowOrder`, proof flags, protection QA command, and `activationReadinessRule`; final Android evidence must fill `android.installQaRunId`, `android.installQaArtifact`, and `checks.androidInstallLaunchQa=true` from that local report. This is download/install evidence, not a replacement for Play upload signing or the Android protection evidence below.

`npm run evidence:android-devices` runs bounded `adb devices -l` discovery, writes `android-device-discovery.json` plus `adb-devices.txt`, and reports ready devices, emulator-like targets, and the next physical-browser command. It is a setup handoff only: the discovery artifact keeps `evidenceSatisfied=false` and does not prove physical-device status, upload-signed install, Accessibility/Usage Access/VPN consent, DNS Guard, normal browsing, blocking, or challenge verification.

`npm run evidence:android-real-browser` collects physical Android browser screenshots/logcat/top-activity artifacts, audits every captured PNG for nonblank rendered content, writes `android-real-browser-evidence-fill-template.json` with concrete run IDs plus helper-captured artifacts and false checks, and can also capture focused browser search before-navigation proof with `--scenario focused-search`, synced adult-domain feed Accessibility handoff proof with `--scenario synced-feed --adult-domain-feed-host <synced-feed-only-adult-host>`, DNS Guard state/probe plus visible intervention proof with `--dns-guard-proof`, DNS Guard reboot/package-update restart proof with `--dns-guard-restart-proof`, optional Back-button cleanup proof with `--back-stack-check`, local Play policy proof with `--play-policy-proof`, plus manually prepared configured app before-limit allow, over-limit shield, short-form threshold, earned-unlock app-allow/relock, and browser-sourced earned-unlock no-app-unlock launches with `--app-scenario`; pass `--earned-unlock-minutes` so the manifest labels the duration field used by release evidence. Use `--plan-only` to write a non-promotable `capture-manifest.json`, `android-real-browser-evidence-fill-template.json`, and `CAPTURE_NOTES.md` with `evidenceSatisfied=false` before hardware is ready. The Android permission wizard artifact must also prove zero-app continue was disabled, setup launched app selection, returning from app selection auto-synced selected packages to native protection, at least one selected app count was recorded, setup auto-advanced after native package sync, and FREED refreshed plus auto-advanced after VPN consent, Usage Access, and Accessibility returns. The final evidence must also include separate physical-device challenge verification proof for fresh-camera ML Kit labels, no base64/EXIF media payload, temporary photo cleanup, motion samples, Activity Recognition/steps, and accurate foreground location fixes. The Android challenge proof artifacts must be local JSON reports with `sanitized=true`: `freed-challenge-photo-report-v1`, `freed-challenge-motion-report-v1`, `freed-challenge-steps-report-v1`, and `freed-challenge-location-report-v1`; their run IDs, platform, metrics, on-device/on-demand checks, timer-only bypass rejection, no-retention checks, and foreground/no-raw-coordinate location proof must match the evidence row. Run `--app-scenario browser-earned-unlock --adult-url <real-adult-url>` to label the proof that a browser/adult-domain challenge window does not pause a configured Android app shield. Run `--app-scenario short-form-both` for YouTube Shorts, then repeat `--app-scenario short-form` with `--short-form-package com.instagram.android --short-form-label "Instagram Reels"` and `--app-scenario short-form --short-form-package <installed TikTok package> --short-form-label "TikTok For You"` where the TikTok package is `com.zhiliaoapp.musically`, `com.ss.android.ugc.trill`, or `com.tiktok`. Short-form manifests label the release fields for `android.shortFormInterventionId=short-form:youtube-shorts`, `android.instagramReelsInterventionId=short-form:instagram-reels`, and `android.tiktokFeedInterventionId=short-form:tiktok-feed`; each short-form run must also record observed package foreground usage below the configured daily app limit in `android.shortFormUsageBeforeLimitMinutes`, `android.instagramReelsUsageBeforeLimitMinutes`, and `android.tiktokFeedUsageBeforeLimitMinutes`, proving the handoff came from the sustained short-form threshold rather than the broader app shield. YouTube Shorts, Instagram Reels, and TikTok For You evidence must additionally include local `freed-short-form-surface-report-v1` selected/focused surface reports with `sanitized=true` in `android.shortFormSelectedSurfaceArtifact`, `android.instagramReelsSelectedSurfaceArtifact`, and `android.tiktokFeedSelectedSurfaceArtifact`; each report must match run ID, package, intervention, timing metrics, use Accessibility node-tree confirmation, and prove no screenshot/frame analysis before setting the matching selected-surface verified flag to true. Chrome/Firefox/Edge/Samsung adult-intent, focused-search, and focused-WebView artifacts must use local `freed-android-browser-intercept-report-v1` JSON reports with `sanitized=true` proving Accessibility event use, URL/search-field observation, FREED intervention launch before navigation, host/redacted-host-only storage, no screenshot/OCR loops, no packet inspection, and no MITM HTTPS; focused-search reports must also prove the raw query was not persisted. Synced-feed manifests identify the reviewed host and suggest `android.adultDomainFeedAccessibilityArtifact`; `--dns-guard-proof` writes Private DNS/VPN state, DNS probe diagnostics, and a local `freed-dns-guard-block-report-v1` JSON report with `sanitized=true` for `android.dnsGuardBlockArtifact` and `android.adultDomainFeedDnsGuardArtifact`, then captures an activity screenshot, notification shade screenshot, notification dump, and UI dump for manual `android.dnsGuardInterventionVisible=true` review. QA must pair that with native status version/checksum/domain count plus a local `freed-dns-guard-lifecycle-report-v1` JSON report with `sanitized=true` in `android.dnsGuardLifecycleArtifact`; both DNS reports must match run ID, host, resolver, and counter metrics and prove DNS-only routing, no full-traffic proxying, no MITM HTTPS, no packet payload inspection, visible recovery-path proof, and synced-feed usage where applicable. `--dns-guard-restart-proof` writes boot/package, VPN, connectivity, service, and logcat diagnostics for `android.dnsGuardRestart*` fields and forces a paired native status capture so QA can verify user-enabled restart eligibility/result text without relying on a synthetic toggle; final restart and skipped-restart artifacts must be local `freed-dns-guard-restart-report-v1` JSON reports with `sanitized=true`, no raw diagnostics, matching run IDs/action/result/skipped reason, no silent VPN prompt, no consent bypass, and no full-traffic proxy/MITM/payload-inspection checks. Back-stack manifests include `*-after-back` screenshot/activity artifacts for `android.backStackCleanupArtifact`; manual QA must confirm Back did not restore the blocked browser/app page or handoff activity. Play policy artifacts must be local `freed-android-play-policy-report-v1` JSON reports generated from `docs/store-policy/android-accessibility-and-fgs-disclosure.md`, native manifest declarations, and the AccessibilityService XML with `sanitized=true`, source SHA-256 hashes, complete AccessibilityService disclosure/config/manifest signals, DNS Guard special-use FGS disclosure signals, and `playPolicyProofUsableForManualEvidence=true`; concrete Play Console review IDs are still required separately in `android.playPolicyAccessibilityReviewId` and `android.playPolicySpecialUseFgsReviewId`. It refuses emulator targets plus placeholder/local/insecure URLs/hosts, and does not mark evidence as passing.
Both platform helper manifests now include the permission wizard evidence fields. Before promotion, QA must attach `ios.permissionWizardArtifact` or `android.permissionWizardArtifact` as a local `freed-permission-wizard-report-v1` JSON report with `sanitized=true`, use the exact `permissionWizardFlowOrder`, and prove the production permission explanation summary covered monitoring only selected apps/sites, blocking known adult domains, and opening recovery challenges for harmful site/search/app-limit threshold attempts before Test Protection passed and Activation Complete became available. iOS promotion also requires Screen Time authorization, FamilyActivityPicker, and Safari Settings return-refresh plus auto-advance checks. Android promotion additionally requires `android.appSelectionZeroAppContinueDisabled=true`, `android.appSelectionReturnFromSetup=true`, `android.appSelectionReturnAutoSync=true`, `android.appSelectionReturnNativePackageSyncConfirmed=true`, `android.appSelectionReturnSelectedAppCount>0`, VPN consent return-refresh, Usage Access return-refresh, Accessibility return-refresh, and matching Android-only checks in the permission-wizard report. After recording the physical-device setup, use `npm run evidence:permission-wizard -- --platform android|ios --run-id <permission-wizard-run-id> --report docs/validation/artifacts/<run-id>/permission-wizard-report.json --test-protection-passed` with the required confirmation flags to write that sanitized report; the helper refuses missing flow/privacy confirmations and still does not replace the final physical-device evidence file.
`npm run evidence:normal-browsing-corpus` generates `normal-browsing-corpus-matrix.csv` plus `normal-browsing-browser-checklist.md` for iOS Safari plus Android Chrome, Firefox, Edge, and Samsung Internet from the release template's real external URL sets, rejects placeholder/local/insecure manual browser targets, writes pending `normal-browsing-browser-summary.template.json`, per-browser `browser-report-templates/*.template.json`, and `normal-browsing-evidence-fill-template.json` handoff files with exact counts, and exports the shared classifier corpus separately to `classifier-corpus-static.csv` as static classifier proof. The capture manifest stays sanitized with `evidenceSatisfied=false` until real physical-browser QA fills and validates `normal-browsing-corpus.json`; every browser result starts pending manual QA.
`npm run evidence:performance-profile` creates a physical-device profiling matrix and optional safe device metadata for the performance gate; it refuses placeholder/local/insecure normal-browsing URLs, captures Android routing proof automatically for no full-traffic proxy / no packet inspection / no MITM HTTPS review, can sample Android package-specific background CPU with `--android-background-cpu-proof`, writes `performance-profile-evidence-fill-template.json` with concrete run IDs plus optional helper-captured routing/background-CPU artifacts, requires network-speed and DNS-latency report artifact fields with `sanitized=true` alongside their run IDs, and leaves threshold plus no continuous screenshot/OCR or continuous image-classification pass decisions to the real 30+ minute profiler/network run plus manual QA. Use `--skip-device-metadata` only to write a pending packet before hardware is available; that manifest keeps `evidenceSatisfied=false` and does not prove physical-device status or performance thresholds.
`npm run evidence:store-ad-sandbox` creates the purchase/restore/rewarded-ad/privacy-review sandbox matrix with sanctioned command handoffs, preloads non-secret Core 3 product/entitlement/ad-unit context from `--release-env-file`, writes `store-ad-sandbox-evidence-fill-template.json` with the pending yearly/monthly/lifetime launch-product matrix, writes `paywall-launch-scope-report.template.json` with the required local `freed-paywall-launch-scope-report-v1` shape for `store.paywallLaunchScopeArtifact`, writes `STORE_APP_RECORD_ACTION_PACKET.json` / `.md` with the exact draft app-record fields, Browser action-time confirmation token, Apple agreement prerequisite, no-production hard stops, and current source hashes for store metadata plus the listing screenshot plan, writes `ADMOB_ACTION_PACKET.json` / `.md` plus `ADMOB_ENV_PATCH.template.env` with the confirmed-action AdMob app/rewarded-unit setup order and blank production env keys, writes `store-console-product-setup-report.template.json` with the required local `freed-store-console-product-setup-report-v1` shape, read-only Browser app-record readiness fields, and redacted App Store Connect / Play Console evidence-artifact rows for `store.consoleProductSetupArtifact`, writes `rewarded-ad-request-report.template.json` with the required local `freed-rewarded-ad-request-report-v1` shape for `store.rewardedAdRequestArtifact`, writes `store-intervention-flow-report.templates.json` with the required local `freed-store-intervention-flow-report-v1` shapes for the free rewarded gate, rewarded completion, ad-failure fallback, and premium no-ad challenge-entry artifacts, writes `store-privacy-disclosure-report.template.json` with the required local `freed-store-privacy-disclosure-report-v1` shape for `store.privacyDisclosureArtifact`, lets explicit CLI flags override env-file values, rejects placeholder/local/private/insecure purchase-verification endpoints plus URL credentials, query strings, and fragments when provided, requires the deployed `/api/purchases/verify` route path, keeps an explicit no-raw-receipts/no-raw-tokens/no-secrets policy, and leaves the capture manifest at `evidenceSatisfied=false` until real sandbox QA fills and validates `store-ad-sandbox.json`.
`npm run evidence:ai-backend-smoke` creates the deployed AI smoke/eval/redaction/fallback matrix with sanctioned command handoffs, preloads non-secret AI endpoint, optional retention endpoint, and model context from `--release-env-file`, writes `ai-backend-smoke-evidence-fill-template.json` with pending final-shape evidence fields, lets explicit CLI flags override env-file values, rejects placeholder/local/private/insecure AI or retention endpoints plus URL credentials, query strings, and fragments when provided, requires `/api/clara`, `/api/challenges`, and optional `/api/retention` route paths, keeps `evidenceSatisfied=false` until real deployed-endpoint QA fills the evidence, and keeps an explicit no-raw-prompts/no-transcripts/no-provider-secrets policy.
`npm run evidence:validation:draft` runs the same validator against a non-gated draft folder via `--evidence-dir`, while keeping `npm run evidence:validation` reserved for release-gated files in `docs/validation/evidence/`.
`npm run evidence:promote` is fail-closed: it validates the draft folder, refuses existing target overwrites unless `--force` is provided, and copies the six JSON files only after every validation gate passes.

## Common Fields

Every evidence file must include:

- `validatedAt`: UTC ISO timestamp at or before the evidence run, for example `2026-05-12T09:00:00.000Z`; future timestamps are rejected.
- `tester`: person or team that ran the validation.
- `build`: app version/build identifier.
- `device` or `environment`: real device, OS, or sandbox environment.
- `evidence`: non-empty array of unique screenshot, video, log, ticket, or report references. Each entry must be an existing non-empty file under `docs/validation/artifacts/` or an HTTPS URL to a real QA/report artifact. Remote evidence URLs must not use local, private-network, reserved documentation, placeholder hosts such as `your-*`/`sample`/`todo`, `.internal`/`.localhost`, or generic public webpages that do not reference a QA/report/artifact path.
- `checks`: object where every required check is `true`.

Copied template placeholder values such as `QA`, `path/to/...`, `configured-server-model`, generic device/model labels, sample domains/packages, sandbox transaction IDs, redacted token placeholders, angle-bracket placeholders like `<production-env-file>`, template env files like `.env.production.example` or `.env.example`, or `changeme` text are rejected by `npm run evidence:validation`.
Evidence command fields that include `-- --env-file` must use a real local env-file path such as `.env.production` or `secrets/prod.env`; URLs, extra flags, shell syntax, validation evidence/artifact folders, and template env files are rejected.
Run, report, review, and ticket IDs must be concrete machine-readable identifiers: no prose, whitespace, single words like `run`/`report`/`review`, template-ish `example`/`placeholder` values, or duplicate proof IDs within the same evidence file.
Store/ad and AI backend smoke evidence reject sensitive field names anywhere in the JSON payload, and they also reject obvious raw receipt, token, credential, URL, or domain text pasted into neutral notes fields. Put redacted proof in referenced artifacts instead of evidence JSON.
Native browsing evidence must also use URLs/hosts that match FREED's classifier expectations: normal-browsing URLs must classify as allowed, and intercepted adult hosts must classify as blocked while avoiding app-owned, fixture, and documentation hosts.
iOS and Android native evidence must include explicit physical-device identity fields inside the platform object; `ios.isPhysicalDevice` and `android.isPhysicalDevice` must be true, and simulator or emulator wording is rejected for physical-device gates.

## Required Files

`ios-physical-device.json`:

```json
{
  "validatedAt": "2026-05-12T00:00:00.000Z",
  "tester": "QA",
  "build": "1.0.0 (100)",
  "device": "iPhone model, iOS version, entitlement-approved Apple ID",
  "evidence": ["path/to/screen-time-video-or-ticket"],
  "ios": {
    "isPhysicalDevice": true,
    "deviceModel": "iPhone 15 Pro",
    "osVersion": "iOS 18.4",
    "permissionWizardRunId": "<ios-permission-wizard-run-id>",
    "permissionWizardArtifact": "path/to/local-freed-permission-wizard-report-v1.json",
    "permissionWizardFlowOrder": "onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete",
    "permissionExplanationShown": true,
    "permissionExplanationSummary": "FREED needs permission to monitor only selected apps and sites through platform APIs, block known adult domains, and open a recovery challenge when a harmful site, search, or app-limit threshold is reached.",
    "permissionWizardTestProtectionPassed": true,
    "familyControlsEntitlementTeamId": "<apple-team-id>",
    "familyControlsEntitlementArtifact": "path/to/local-freed-ios-app-package-proof-v1.json",
    "appGroupProvisioningProfileId": "<app-group-provisioning-profile-id>",
    "appGroupProvisioningArtifact": "path/to/local-freed-ios-app-package-proof-v1.json",
    "completeDataProtectionEntitlement": "NSFileProtectionComplete",
    "completeDataProtectionEntitlementArtifact": "path/to/local-freed-ios-app-package-proof-v1.json",
    "familyControlsAuthorizationRunId": "<family-controls-authorization-run-id>",
    "familyControlsAuthorizationArtifact": "path/to/family-controls-authorization-recording-or-report",
    "familyControlsStatus": "approved",
    "familyActivityPickerRunId": "<family-activity-picker-run-id>",
    "familyActivityPickerArtifact": "path/to/family-activity-picker-recording-or-report",
    "selectedApplicationTokenCount": 1,
    "selectedCategoryTokenCount": 1,
    "selectedWebDomainTokenCount": 1,
    "selectedShieldTokensRunId": "<selected-shield-tokens-run-id>",
    "selectedShieldTokensArtifact": "path/to/selected-shield-tokens-report",
    "appLimitScheduled": true,
    "selectedAppDailyLimitMinutes": 30,
    "selectedAppDailyLimitActivityName": "freed.selectedAppDailyLimit",
    "selectedAppDailyLimitEventName": "freed.selectedAppDailyLimitReached",
    "selectedAppDailyLimitReachedToday": true,
    "selectedAppDailyLimitReachedDate": "2026-05-12",
    "selectedAppDailyLimitRunId": "<selected-app-daily-limit-threshold-run-id>",
    "selectedAppDailyLimitArtifact": "path/to/local-selected-app-daily-limit-freed-ios-screen-time-app-limit-report-v1.json",
    "managedSettingsFilterRunId": "<managed-settings-filter-run-id>",
    "managedSettingsFilterArtifact": "path/to/managed-settings-filter-recording-or-report",
    "safariContentBlockerEmbedded": true,
    "safariContentBlockerIdentifier": "app.freed.recovery.safari-content-blocker",
    "safariContentBlockerBuildRunId": "<safari-content-blocker-build-run-id>",
    "safariContentBlockerBuildArtifact": "path/to/local-freed-ios-app-package-proof-v1.json",
    "safariContentBlockerReloadRunId": "<safari-content-blocker-reload-run-id>",
    "safariContentBlockerReloadArtifact": "path/to/local-safari-content-blocker-reload-freed-ios-safari-content-blocker-report-v1.json",
    "safariContentBlockerVersion": "freed-feed-2026-05-12",
    "safariContentBlockerChecksum": "fnv1a32:1a2b3c4d",
    "safariContentBlockerRuleCount": 1200,
    "safariContentBlockerEnabled": true,
    "safariContentBlockerAdultBlockRunId": "<safari-content-blocker-adult-block-run-id>",
    "safariContentBlockerAdultBlockArtifact": "path/to/local-safari-adult-block-freed-ios-safari-content-blocker-report-v1.json",
    "safariContentBlockerShortFormUrl": "https://youtube.com/shorts/dQw4w9WgXcQ",
    "safariContentBlockerShortFormBlockRunId": "<safari-content-blocker-short-form-block-run-id>",
    "safariContentBlockerShortFormBlockArtifact": "path/to/local-safari-short-form-block-freed-ios-safari-content-blocker-report-v1.json",
    "safariShortFormChallengeHandoffRunId": "<safari-short-form-challenge-handoff-run-id>",
    "safariShortFormChallengeHandoffArtifact": "path/to/safari-short-form-challenge-handoff-recording-or-report",
    "safariShortFormChallengeHandoffSource": "ios-safari-short-form",
    "safariShortFormChallengeHandoffMatchedRule": "short-form:youtube-shorts",
    "safariShortFormChallengeHandoffHost": "youtube.com",
    "safariShortFormChallengeHandoffRawPathStored": false,
    "safariShortFormChallengeHandoffNativeUnlockActive": false,
    "safariShortFormChallengeHandoffSelectedShieldsStayedActive": true,
    "safariShortFormChallengeHandoffAdultFilterStillActive": true,
    "earnedUnlockAppAllowRunId": "<earned-unlock-app-allow-run-id>",
    "earnedUnlockAppAllowArtifact": "path/to/local-earned-unlock-app-allow-freed-ios-earned-unlock-report-v1.json",
    "earnedUnlockRelockRunId": "<earned-unlock-relock-run-id>",
    "earnedUnlockRelockArtifact": "path/to/local-earned-unlock-relock-freed-ios-earned-unlock-report-v1.json",
    "earnedUnlockDurationMinutes": 15,
    "earnedUnlockActivityName": "freed.earnedUnlockWindow",
    "earnedUnlockSelectedTokenCount": 2,
    "earnedUnlockAdultFilterStillActive": true,
    "earnedUnlockSourceHost": "screen-time-shield.freed.local",
    "earnedUnlockRejectedSourceRunId": "<earned-unlock-rejected-source-run-id>",
    "earnedUnlockRejectedSourceArtifact": "path/to/local-earned-unlock-rejected-source-freed-ios-earned-unlock-report-v1.json",
    "earnedUnlockRejectedSourceHost": "pornhub.com",
    "earnedUnlockRejectedSelectedShieldsStayedActive": true,
    "earnedUnlockRejectedAdultFilterStillActive": true,
    "shieldActionInterventionId": "shield-action-run-id",
    "shieldActionHandoffRunId": "<shield-action-handoff-run-id>",
    "shieldActionHandoffArtifact": "path/to/shield-action-handoff-recording-or-report",
    "deviceActivityName": "night-guard",
    "deviceActivityNightGuardRunId": "<device-activity-night-guard-run-id>",
    "deviceActivityNightGuardArtifact": "path/to/device-activity-night-guard-report",
    "normalBrowsingRunId": "<normal-browsing-run-id>",
    "normalBrowsingArtifact": "path/to/ios-normal-browsing-recording-or-report",
    "adultInterceptRunId": "<adult-intercept-run-id>",
    "adultInterceptArtifact": "path/to/ios-adult-intercept-recording-or-report",
    "normalBrowsingAllowedUrl": "https://youtube.com/results?search_query=workout",
    "adultInterceptedHost": "pornhub.com"
  },
  "checks": {
    "permissionSetupWizard": true,
    "familyControlsAuthorization": true,
    "familyActivityPicker": true,
    "managedSettingsAdultFilter": true,
    "safariContentBlockerReloaded": true,
    "safariContentBlockerEnabled": true,
    "safariContentBlockerAdultBlock": true,
    "safariContentBlockerShortFormBlock": true,
    "safariShortFormChallengeHandoff": true,
    "selectedShieldTokens": true,
    "selectedAppDailyLimitThreshold": true,
    "earnedUnlockAllowsSelectedApps": true,
    "earnedUnlockRejectsNonScreenTimeSource": true,
    "earnedUnlockAutoRelock": true,
    "shieldActionHandoff": true,
    "deviceActivityNightGuard": true,
    "normalBrowsingAllowed": true,
    "adultAttemptIntercepted": true
  }
}
```

iOS evidence must include concrete run IDs and artifact references for the full permission wizard flow, Family Controls entitlement/provisioning, Family Controls authorization, FamilyActivityPicker selection, immediate post-picker selected-target daily-limit monitor scheduling, selected shield token proof, selected Screen Time target daily-limit threshold shielding, ManagedSettings adult filter, Safari Content Blocker signed-target embedding, synced-feed reload with version/checksum/rule count, Safari adult-block proof, Safari web short-form block proof, Safari/web short-form challenge handoff proof, earned-unlock selected-app allow behavior, earned-unlock rejected non-Screen-Time source behavior, earned-unlock automatic relock after expiry, Shield Action handoff, DeviceActivity Night Guard, normal browsing, and adult interception. The permission wizard proof must be a local `freed-permission-wizard-report-v1` JSON report with `sanitized=true` showing recovery goals/onboarding, app selection, paywall, explicit protection explanation, guided permission setup, Test Protection, and Activation Complete in that order, with `ios.permissionExplanationShown=true`, `ios.permissionExplanationSummary` including selected-app/site monitoring, known adult-domain blocking, and harmful site/search/app-limit threshold recovery-challenge copy, `ios.permissionWizardTestProtectionPassed=true`, no hidden monitoring, no screenshot/OCR loop, and no raw selected targets or raw domain list stored in the report. The FamilyActivityPicker proof must also capture `ios.familyActivityPickerAppLimitScheduledImmediately=true` with the `freed.selectedAppDailyLimit` activity and `freed.selectedAppDailyLimitReached` event names immediately after tokens are saved. Selected Screen Time threshold evidence must include a local `freed-ios-screen-time-app-limit-report-v1` JSON report with `sanitized=true` matching run ID, activity/event names, reached date, selected token counts, daily-limit minutes, selected-target shielding, adult-filter continuity, no continuous screen read, no packet tunnel, no packet inspection, and no MITM HTTPS. Safari/web short-form handoff evidence must record `ios.safariShortFormChallengeHandoffSource=ios-safari-short-form`, a matching `short-form:*` rule, a host-only handoff host, `ios.safariShortFormChallengeHandoffRawPathStored=false`, `ios.safariShortFormChallengeHandoffNativeUnlockActive=false`, `ios.safariShortFormChallengeHandoffSelectedShieldsStayedActive=true`, and `ios.safariShortFormChallengeHandoffAdultFilterStillActive=true`. Earned-unlock evidence must also record `ios.earnedUnlockActivityName=freed.earnedUnlockWindow`, `ios.earnedUnlockSelectedTokenCount` equal to the selected Screen Time token count, `ios.earnedUnlockAdultFilterStillActive=true`, `ios.earnedUnlockSourceHost=screen-time-shield.freed.local`, `ios.earnedUnlockRejectedSourceHost` from a real blocked browser/adult-domain source, `ios.earnedUnlockRejectedSelectedShieldsStayedActive=true`, and `ios.earnedUnlockRejectedAdultFilterStillActive=true`, proving the unlock paused only selected app shields from the Screen Time shield handoff while adult web filtering stayed configured and non-Screen-Time sources could not pause selected shields. The earned-unlock allow, rejected-source, and relock artifacts must be local `freed-ios-earned-unlock-report-v1` JSON reports with `sanitized=true` matching run IDs, source hosts, duration, selected-token count, source-scoped Screen Time behavior, rejected browser/adult-source behavior, auto-relock behavior, no continuous screen read, no packet tunnel, no packet inspection, and no MITM HTTPS. It must also record the app-group provisioning profile used for the physical-device run.

`android-real-browser.json`:

```json
{
  "validatedAt": "2026-05-12T00:00:00.000Z",
  "tester": "QA",
  "build": "1.0.0 (100)",
  "device": "Android model, Android version",
  "evidence": ["path/to/browser-validation-report"],
  "android": {
    "isPhysicalDevice": true,
    "deviceModel": "Pixel 8 Pro",
    "osVersion": "Android 15",
    "permissionWizardRunId": "<android-permission-wizard-run-id>",
    "permissionWizardArtifact": "path/to/local-freed-permission-wizard-report-v1.json",
    "permissionWizardFlowOrder": "onboarding-goals>app-selection>paywall>protection-explanation>permission-setup>test-protection>activation-complete",
    "permissionExplanationShown": true,
    "permissionExplanationSummary": "FREED needs permission to monitor only selected apps and sites through platform APIs, block known adult domains, and open a recovery challenge when a harmful site, search, or app-limit threshold is reached.",
    "permissionWizardTestProtectionPassed": true,
    "accessibilityServiceEnabled": true,
    "accessibilityPermissionRunId": "<accessibility-permission-run-id>",
    "accessibilityPermissionArtifact": "path/to/local-android-accessibility-freed-android-permission-report-v1.json",
    "usageStatsAuthorized": true,
    "usageAccessPermissionRunId": "<usage-access-permission-run-id>",
    "usageAccessPermissionArtifact": "path/to/local-android-usage-access-freed-android-permission-report-v1.json",
    "usageStatsObservedPackages": 3,
    "usageStatsTodayMinutes": 22,
    "testedBrowserPackages": [
      "com.android.chrome",
      "org.mozilla.firefox",
      "com.microsoft.emmx",
      "com.sec.android.app.sbrowser"
    ],
    "chromeInterceptRunId": "<chrome-intercept-run-id>",
    "chromeInterceptArtifact": "path/to/local-chrome-freed-android-browser-intercept-report-v1.json",
    "firefoxInterceptRunId": "<firefox-intercept-run-id>",
    "firefoxInterceptArtifact": "path/to/local-firefox-freed-android-browser-intercept-report-v1.json",
    "edgeInterceptRunId": "<edge-intercept-run-id>",
    "edgeInterceptArtifact": "path/to/local-edge-freed-android-browser-intercept-report-v1.json",
    "samsungInternetInterceptRunId": "<samsung-internet-intercept-run-id>",
    "samsungInternetInterceptArtifact": "path/to/local-samsung-internet-freed-android-browser-intercept-report-v1.json",
    "focusedBrowserSearchRunId": "<focused-browser-search-run-id>",
    "focusedBrowserSearchArtifact": "path/to/local-focused-search-freed-android-browser-intercept-report-v1.json",
    "focusedBrowserSearchRedactedHost": "focused-search.app.freed.local",
    "focusedBrowserSearchMatchedRule": "focused-search:pornography",
    "focusedBrowserSearchRawQueryStored": false,
    "focusedWebViewPackage": "app.freed.qawebview",
    "focusedWebViewRunId": "<focused-webview-run-id>",
    "focusedWebViewArtifact": "path/to/local-focused-webview-freed-android-browser-intercept-report-v1.json",
    "configuredAppShieldPackages": [
      "com.instagram.android",
      "com.zhiliaoapp.musically",
      "com.ss.android.ugc.trill",
      "com.tiktok",
      "com.google.android.youtube"
    ],
    "configuredAppShieldPackage": "com.instagram.android",
    "configuredAppShieldDailyLimitMinutes": 30,
    "configuredAppShieldUsageBeforeLimitMinutes": 20,
    "configuredAppShieldBeforeLimitAllowRunId": "<configured-app-before-limit-allow-run-id>",
    "configuredAppShieldBeforeLimitAllowArtifact": "path/to/local-configured-app-before-limit-freed-android-app-intervention-report-v1.json",
    "configuredAppShieldUsageAtInterventionMinutes": 31,
    "configuredAppShieldRunId": "<configured-app-shield-run-id>",
    "configuredAppShieldArtifact": "path/to/local-configured-app-shield-freed-android-app-intervention-report-v1.json",
    "configuredAppShieldInterventionId": "configured-app:com.instagram.android",
    "shortFormPackage": "com.google.android.youtube",
    "shortFormThresholdSeconds": 90,
    "shortFormBelowThresholdSeconds": 60,
    "shortFormBelowThresholdAllowRunId": "<short-form-below-threshold-allow-run-id>",
    "shortFormBelowThresholdAllowArtifact": "path/to/local-youtube-shorts-below-threshold-freed-android-app-intervention-report-v1.json",
    "shortFormAtInterventionSeconds": 95,
    "shortFormUsageBeforeLimitMinutes": 20,
    "shortFormRunId": "<short-form-sustained-intervention-run-id>",
    "shortFormArtifact": "path/to/local-youtube-shorts-sustained-freed-android-app-intervention-report-v1.json",
    "shortFormSelectedSurfaceArtifact": "path/to/local-youtube-shorts-freed-short-form-surface-report-v1.json",
    "shortFormSelectedSurfaceVerified": true,
    "shortFormInterventionId": "short-form:youtube-shorts",
    "instagramReelsPackage": "com.instagram.android",
    "instagramReelsAtInterventionSeconds": 95,
    "instagramReelsUsageBeforeLimitMinutes": 20,
    "instagramReelsRunId": "<instagram-reels-sustained-intervention-run-id>",
    "instagramReelsArtifact": "path/to/local-instagram-reels-sustained-freed-android-app-intervention-report-v1.json",
    "instagramReelsSelectedSurfaceArtifact": "path/to/local-instagram-reels-freed-short-form-surface-report-v1.json",
    "instagramReelsSelectedSurfaceVerified": true,
    "instagramReelsInterventionId": "short-form:instagram-reels",
    "tiktokFeedPackage": "com.zhiliaoapp.musically",
    "tiktokFeedAtInterventionSeconds": 95,
    "tiktokFeedUsageBeforeLimitMinutes": 20,
    "tiktokFeedRunId": "<tiktok-feed-sustained-intervention-run-id>",
    "tiktokFeedArtifact": "path/to/local-tiktok-for-you-sustained-freed-android-app-intervention-report-v1.json",
    "tiktokFeedSelectedSurfaceArtifact": "path/to/local-tiktok-for-you-freed-short-form-surface-report-v1.json",
    "tiktokFeedSelectedSurfaceVerified": true,
    "tiktokFeedInterventionId": "short-form:tiktok-feed",
    "earnedUnlockAppAllowRunId": "<earned-unlock-app-allow-run-id>",
    "earnedUnlockAppAllowArtifact": "path/to/local-earned-unlock-app-allow-freed-android-earned-unlock-report-v1.json",
    "earnedUnlockRelockRunId": "<earned-unlock-relock-run-id>",
    "earnedUnlockRelockArtifact": "path/to/local-earned-unlock-relock-freed-android-earned-unlock-report-v1.json",
    "earnedUnlockDurationMinutes": 15,
    "earnedUnlockSourcePackage": "com.instagram.android",
    "earnedUnlockRelockUsageMinutes": 31,
    "browserEarnedUnlockNoAppUnlockRunId": "<browser-earned-unlock-no-app-unlock-run-id>",
    "browserEarnedUnlockNoAppUnlockArtifact": "path/to/local-browser-earned-unlock-no-app-unlock-freed-android-browser-earned-unlock-report-v1.json",
    "browserEarnedUnlockSourceHost": "pornhub.com",
    "browserEarnedUnlockNativeAppUnlockActive": false,
    "browserEarnedUnlockConfiguredAppStillShielded": true,
    "browserEarnedUnlockAdultFilterStillActive": true,
    "dnsGuardResolver": "1.1.1.1",
    "dnsGuardBlockRunId": "<dns-guard-block-run-id>",
    "dnsGuardBlockArtifact": "path/to/local-freed-dns-guard-block-report-v1.json",
    "dnsGuardInterventionVisible": true,
    "dnsGuardLifecycleArtifact": "path/to/local-freed-dns-guard-lifecycle-report-v1.json",
    "dnsGuardSessionQueries": 4,
    "dnsGuardBlockedQueries": 1,
    "dnsGuardAllowedQueries": 3,
    "dnsGuardServfailResponses": 0,
    "dnsGuardMalformedPackets": 0,
    "dnsGuardRestartRunId": "<dns-guard-restart-run-id>",
    "dnsGuardRestartArtifact": "path/to/local-dns-guard-restart-started-freed-dns-guard-restart-report-v1.json",
    "dnsGuardRestartAction": "BOOT_COMPLETED",
    "dnsGuardRestartResult": "started",
    "dnsGuardRestartUserEnabled": true,
    "dnsGuardRestartEligible": true,
    "dnsGuardRestartSkippedRunId": "<dns-guard-restart-skipped-run-id>",
    "dnsGuardRestartSkippedArtifact": "path/to/local-dns-guard-restart-skipped-freed-dns-guard-restart-report-v1.json",
    "dnsGuardRestartSkippedReason": "user-disabled",
    "dnsGuardRestartNoSilentPromptConfirmed": true,
    "adultDomainFeedVersion": "freed-feed-2026-05-12",
    "adultDomainFeedChecksum": "fnv1a32:1a2b3c4d",
    "adultDomainFeedDomainCount": 1200,
    "adultDomainFeedStatusRunId": "<adult-domain-feed-status-run-id>",
    "adultDomainFeedStatusArtifact": "path/to/local-android-adult-domain-feed-status-report-v1.json",
    "adultDomainFeedAccessibilityRunId": "<adult-domain-feed-accessibility-classifier-run-id>",
    "adultDomainFeedAccessibilityArtifact": "path/to/local-synced-feed-accessibility-freed-android-browser-intercept-report-v1.json",
    "adultDomainFeedDnsGuardRunId": "<adult-domain-feed-dns-guard-classifier-run-id>",
    "adultDomainFeedDnsGuardArtifact": "path/to/local-synced-feed-freed-dns-guard-block-report-v1.json",
    "nativeHandoffInterventionId": "android-handoff-run-id",
    "backStackCleanupRunId": "<back-stack-cleanup-run-id>",
    "backStackCleanupArtifact": "path/to/back-stack-cleanup-recording-or-report",
    "normalBrowsingRunId": "<normal-browsing-run-id>",
    "normalBrowsingArtifact": "path/to/android-normal-browsing-recording-or-report",
    "playPolicyAccessibilityReviewId": "<play-accessibility-policy-review-id>",
    "playPolicyAccessibilityArtifact": "path/to/local-freed-android-play-policy-report-v1.json",
    "playPolicySpecialUseFgsReviewId": "<play-special-use-fgs-review-id>",
    "playPolicySpecialUseFgsArtifact": "path/to/local-freed-android-play-policy-report-v1.json",
    "normalBrowsingAllowedUrl": "https://youtube.com/results?search_query=workout",
    "adultInterceptedHost": "pornhub.com"
  },
  "checks": {
    "permissionSetupWizard": true,
    "accessibilityPermissionFlow": true,
    "usageAccessPermissionFlow": true,
    "chromeAdultIntentIntercept": true,
    "firefoxAdultIntentIntercept": true,
    "edgeAdultIntentIntercept": true,
    "samsungInternetAdultIntentIntercept": true,
    "focusedBrowserSearchIntercept": true,
    "focusedWebViewIntercept": true,
    "configuredAppShieldBeforeLimitAllowed": true,
    "configuredAppShieldIntercept": true,
    "configuredAppShieldDailyLimitReached": true,
    "shortFormBelowThresholdAllowed": true,
    "shortFormSustainedIntercept": true,
    "instagramReelsSustainedIntercept": true,
    "tiktokFeedSustainedIntercept": true,
    "earnedUnlockAllowsConfiguredApp": true,
    "earnedUnlockAutoRelock": true,
    "browserEarnedUnlockDoesNotUnlockApps": true,
    "normalBrowsingAllowed": true,
    "dnsGuardAdultDomainBlocked": true,
    "dnsGuardInterventionVisible": true,
    "dnsGuardRestartPolicyVerified": true,
    "nativeAdultDomainFeedSynced": true,
    "nativeHandoffBackStackClean": true,
    "playPolicyAccessibilityReviewed": true,
    "playPolicySpecialUseFgsReviewed": true
  }
}
```

For Android synced adult-domain feed proof, `android.adultDomainFeedStatusArtifact` must be a local `freed-android-adult-domain-feed-status-report-v1` JSON report with `sanitized=true`, matching feed version/checksum/domain count, cached native feed proof, Accessibility and DNS Guard sync checks, no raw domain list, no normal-browsing host storage, and no screenshot or packet inspection. `android.adultDomainFeedAccessibilityArtifact` must be a local `freed-android-browser-intercept-report-v1` JSON report with `sanitized=true`, matching the synced-feed run ID/browser package/host, `adult-domain-feed:*` rule prefix, and native feed source checks.

The Android DNS Guard VPN-consent permission artifact must include the native settings route list with Accessibility, app notification settings, Usage Access, the Usage Access config rationale category, Network, app-details, and system settings fallback routes plus `settingsFallbackRoutesCaptured=true`, proving FREED can route users to the closest available Android permission surface on OEM builds without silently bypassing consent or looping prompts. On Android 13+, native status and Profile evidence must expose `androidNotificationPermissionRequired`/`androidNotificationPermissionGranted`, and `android-notification-permission-report.json` must prove the optional recovery-notification row requests the Android runtime notification prompt before routing to `android.settings.APP_NOTIFICATION_SETTINGS` when notifications remain off. The app-selection step must also prove Android cannot continue with zero selected app timers, and that returning from setup-launched app selection auto-syncs selected packages to native protection before setup advances. The Accessibility permission artifact must additionally include `androidSettingsRouteComponent` targeting FREED's `FreedAccessibilityService` and the current helper's `androidSettingsRouteOpenedAt`, matching the Profile > Native Protection target-component and last-route timestamp status text after the settings return. The Usage Access artifact must also capture the Settings-displayed FREED Usage Access reason/config activity, proving the user sees the aggregate-app-timer boundary before returning to setup.

Android evidence must include concrete run IDs and artifact references for the full permission wizard flow, Accessibility permission, Usage Access permission, Android 13+ notification permission, Chrome/Firefox/Edge/Samsung Internet intercepts, focused browser search interception before navigation with `focusedBrowserSearchRedactedHost=focused-search.app.freed.local`, focused WebView interception, opt-in configured app shield below-limit allow behavior, opt-in configured app shield over-limit interruption, sustained YouTube Shorts below-threshold allow and threshold intercept behavior, sustained Instagram Reels and TikTok For You intervention behavior, earned-unlock app allow behavior, earned-unlock automatic relock after expiry, browser/adult-domain earned-unlock no-app-unlock proof, DNS Guard blocking plus `android.dnsGuardInterventionVisible=true`, DNS Guard lifecycle counters, DNS Guard restart policy after reboot/package update plus skipped restart after manual stop or VPN revocation, native adult-domain feed sync/classifier proof, native handoff back-stack cleanup, and normal browsing. It must also include `android.installQaRunId`, `android.installQaArtifact`, and `checks.androidInstallLaunchQa=true` from a local `freed-android-install-qa-report-v1` report proving a physical-device install and launch of an upload-signed APK, APK hash/size, verified non-debug APK signature, package metadata, top-activity match, screenshot/UI dump artifacts, the required protection handoff command, and the required permission-wizard report command. The Accessibility, Usage Access, and notification artifact fields must be local `freed-android-permission-report-v1` JSON reports with `sanitized=true`; the Accessibility report must match the run ID and prove user-granted enabled service state, captured Settings state, `androidSettingsRouteOpened=android.settings.ACCESSIBILITY_DETAILS_SETTINGS`, current-helper `androidSettingsRouteOpenedAt`, `androidSettingsRouteComponent` targeting FREED's `FreedAccessibilityService`, FREED service component matching, no hidden monitoring, no overlay requirement, no screenshot/OCR analysis, and no packet inspection; the Usage Access report must match the run ID, public `android.settings.USAGE_ACCESS_SETTINGS` route, current-helper `androidSettingsRouteOpenedAt`, explicit `Android Settings > Special app access > Usage access > FREED` user toggle path, `usageStatsAuthorized`, aggregate observed package count/name/minute fields, no silent grant or package-specific deep-link claim, no raw usage event storage, no screenshot analysis, and no packet inspection; the notification report must match the run ID, prove `android.notificationPermissionRequired=true`, `android.notificationPermissionGranted=true`, runtime prompt shown, native status captured before and after the prompt, app notification settings fallback only when denied, no silent grant, no notification-listener requirement, no notification history storage, no DNS history storage, and no packet inspection. The Chrome/Firefox/Edge/Samsung, focused-search, and focused-WebView artifact fields must be local `freed-android-browser-intercept-report-v1` JSON reports with `sanitized=true` matching run IDs/packages/hosts/rules with Accessibility event, no screenshot/OCR, no packet-inspection, and no MITM checks. The configured-app below-limit, configured-app over-limit, YouTube Shorts below-threshold, YouTube Shorts sustained, Instagram Reels sustained, and TikTok For You sustained artifact fields must be local `freed-android-app-intervention-report-v1` JSON reports with `sanitized=true` matching run IDs, package names, intervention IDs when blocked, UsageStats/timing metrics, expected allow/block outcome, app-limit or short-form threshold checks, paired selected-surface proof for sustained short-form blocks, and no screenshot/OCR/frame-analysis/packet-inspection checks. The earned-unlock app allow and relock artifacts must be local `freed-android-earned-unlock-report-v1` JSON reports with `sanitized=true` matching run IDs, source package, bounded duration, relock usage metrics, same-package source-scoped unlock behavior, adult-filter continuity, no browser-source unlock, and no screenshot/OCR/frame-analysis/packet-inspection checks. The browser/adult-source no-app-unlock artifact must be a local `freed-android-browser-earned-unlock-report-v1` JSON report with `sanitized=true` matching run ID, source host, configured app package, earned-unlock duration, daily app limit, native app unlock inactive, configured app still shielded, adult filter still active, and no screenshot/OCR/frame-analysis/packet-inspection checks. The permission wizard proof must be a local `freed-permission-wizard-report-v1` JSON report with `sanitized=true` showing recovery goals/onboarding, app selection, paywall, explicit protection explanation, guided permission setup, Test Protection, and Activation Complete in that order, with `android.permissionExplanationShown=true`, `android.permissionExplanationSummary` including selected-app/site monitoring, known adult-domain blocking, and harmful site/search/app-limit threshold recovery-challenge copy, `android.permissionWizardTestProtectionPassed=true`, no hidden monitoring, no screenshot/OCR loop, and no raw selected targets or raw domain list stored in the report. Use `npm run evidence:android-real-browser -- --device <serial> --scenario none --permission-proof` to capture the Android Accessibility/Usage Access/notification app-op diagnostics artifact, then use `npm run evidence:android-real-browser -- --device <serial> --scenario none --native-status-proof` after opening FREED to Profile > Native Protection to capture UsageStats metrics, adult-domain feed version/checksum/domain count, Private DNS, notification permission state, last settings route/timestamp, and DNS Guard resolver/lifecycle/restart diagnostics before filling `android.accessibilityPermissionArtifact`, `android.usageAccessPermissionArtifact`, `android.notificationPermissionArtifact`, `android.usageStatsAuthorized`, `android.usageStatsObservedPackages`, `android.usageStatsTodayMinutes`, `android.adultDomainFeedStatusArtifact`, `android.dnsGuardLifecycleArtifact`, `android.dnsGuardSessionQueries`, `android.dnsGuardBlockedQueries`, `android.dnsGuardAllowedQueries`, `android.dnsGuardServfailResponses`, and `android.dnsGuardMalformedPackets`. `android.dnsGuardLifecycleArtifact` must be a local `freed-dns-guard-lifecycle-report-v1` JSON report with `sanitized=true` matching resolver/counter metrics plus DNS-only, no full-traffic proxy, no MITM HTTPS, and no packet payload inspection checks. Use `npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --scenario none --dns-guard-proof` or the synced-feed variant to capture DNS Guard probe output plus the visible notification/activity artifacts before filling `android.dnsGuardInterventionVisible=true`. `android.dnsGuardBlockArtifact` and `android.adultDomainFeedDnsGuardArtifact` must be local `freed-dns-guard-block-report-v1` JSON reports with `sanitized=true` matching run ID, host, resolver, counter metrics, DNS-only/no-MITM/no-payload-inspection checks, visible recovery-path proof, and `syncedAdultDomainFeedUsed=true` for the synced-feed DNS Guard artifact. Use `npm run evidence:android-real-browser -- --device <serial> --scenario none --dns-guard-restart-proof` after a real reboot or package update, and again after manual stop or VPN revocation, to capture `android.dnsGuardRestartRunId`, `android.dnsGuardRestartArtifact`, `android.dnsGuardRestartAction`, `android.dnsGuardRestartResult`, `android.dnsGuardRestartUserEnabled`, `android.dnsGuardRestartEligible`, `android.dnsGuardRestartSkippedRunId`, `android.dnsGuardRestartSkippedArtifact`, `android.dnsGuardRestartSkippedReason`, and `android.dnsGuardRestartNoSilentPromptConfirmed`; `android.dnsGuardRestartArtifact` and `android.dnsGuardRestartSkippedArtifact` must be local `freed-dns-guard-restart-report-v1` JSON reports with `sanitized=true`, no raw diagnostics, matching run IDs/action/result/skipped reason, no silent VPN prompt, no consent bypass, and no full-traffic proxy/MITM/payload-inspection checks. Use `npm run evidence:android-real-browser -- --device <serial> --scenario none --focused-webview-proof` with `app.freed.qawebview` to capture `android.focusedWebViewPackage`, `android.focusedWebViewRunId`, and `android.focusedWebViewArtifact`; use `npm run evidence:android-real-browser -- --scenario none --play-policy-proof` to create the local Android policy artifact. It must also include `usageStatsAuthorized=true`, aggregate selected-app UsageStats diagnostics covering every distinct package used by the configured-app, YouTube Shorts, Instagram Reels, and TikTok proof flows, `focusedBrowserSearchRawQueryStored=false`, the configured app daily limit plus observed before/at-intervention usage minutes, configured short-form threshold seconds plus below/at-threshold observed seconds, each short-form app's observed usage before the run below the daily app limit, `android.earnedUnlockSourcePackage` matching the configured app package, `android.earnedUnlockRelockUsageMinutes` still at or above the daily limit, `android.browserEarnedUnlockSourceHost` from a real blocked browser/adult-domain source, `android.browserEarnedUnlockNativeAppUnlockActive=false`, `android.browserEarnedUnlockConfiguredAppStillShielded=true`, `android.browserEarnedUnlockAdultFilterStillActive=true`, Play policy review IDs, and artifact references for AccessibilityService disclosure and special-use foreground-service justification.

Android 13+ DNS Guard recovery evidence must also prove `POST_NOTIFICATIONS` is declared, native/Profile status exposes `androidNotificationPermissionRequired` and `androidNotificationPermissionGranted`, and the optional recovery-notification setup row attempts the runtime notification prompt before it deep-links to `android.settings.APP_NOTIFICATION_SETTINGS` when the DNS Guard visible intervention proof is promoted.

`normal-browsing-corpus.json`:

```json
{
  "validatedAt": "2026-05-12T00:00:00.000Z",
  "tester": "QA",
  "build": "1.0.0 (100)",
  "device": "iOS/Android model, OS version, browser list",
  "evidence": ["path/to/normal-browsing-corpus-report"],
  "normalBrowsing": {
    "classifierCorpusSource": "scripts/classifier-safety-corpus.ts",
    "classifierCorpusCaseCount": 49,
    "classifierCorpusPassCount": 49,
    "classifierCorpusFailedCount": 0,
    "browserMatrix": [
      {
        "platform": "ios",
        "isPhysicalDevice": true,
        "deviceModel": "iPhone 15 Pro",
        "osVersion": "iOS 18.4",
        "browserName": "Safari",
        "runId": "<ios-safari-normal-browsing-corpus-run-id>",
        "resultArtifact": "path/to/ios-safari-normal-browsing-results",
        "allowedUrlCount": 12,
        "recoverySearchUrlCount": 4,
        "adultBlockedUrlCount": 4,
        "allowedUrlPassCount": 12,
        "recoverySearchPassCount": 4,
        "adultBlockPassCount": 4,
        "falsePositiveCount": 0,
        "missedAdultBlockCount": 0,
        "passed": true
      },
      {
        "platform": "android",
        "isPhysicalDevice": true,
        "deviceModel": "Pixel 8 Pro",
        "osVersion": "Android 15",
        "browserName": "Chrome",
        "browserPackage": "com.android.chrome",
        "runId": "<android-chrome-normal-browsing-corpus-run-id>",
        "resultArtifact": "path/to/android-chrome-normal-browsing-results",
        "allowedUrlCount": 12,
        "recoverySearchUrlCount": 4,
        "adultBlockedUrlCount": 4,
        "allowedUrlPassCount": 12,
        "recoverySearchPassCount": 4,
        "adultBlockPassCount": 4,
        "falsePositiveCount": 0,
        "missedAdultBlockCount": 0,
        "passed": true
      }
    ],
    "allowedUrls": [
      "https://google.com/search?q=weather",
      "https://youtube.com/results?search_query=workout",
      "https://instagram.com/explore",
      "https://x.com/home",
      "https://coursera.org/learn/math",
      "https://netflix.com/browse",
      "https://store.steampowered.com/app/123",
      "https://notion.so/workspace",
      "https://wikipedia.org/wiki/Exercise",
      "https://open.spotify.com/",
      "https://github.com/features/actions",
      "https://roblox.com/discover"
    ],
    "recoverySearchUrls": [
      "https://duckduckgo.com/?q=porn+addiction+therapy",
      "https://google.com/search?q=porn+recovery+accountability",
      "https://google.com/search?q=accountability+software+porn+addiction",
      "https://duckduckgo.com/?q=quit+porn+support+group"
    ],
    "adultBlockedUrls": [
      "https://bing.com/search?q=porn",
      "https://pornhub.com",
      "https://google.com/search?q=free+explicit+videos",
      "https://xvideos.com"
    ]
  },
  "checks": {
    "googleAllowed": true,
    "youtubeAllowed": true,
    "instagramAllowed": true,
    "xTwitterAllowed": true,
    "educationAllowed": true,
    "streamingAllowed": true,
    "gamingAllowed": true,
    "productivityAllowed": true,
    "recoverySearchAllowed": true,
    "adultSearchStillBlocked": true
  }
}
```

`normalBrowsing.classifierCorpusSource` must be `scripts/classifier-safety-corpus.ts`; `classifierCorpusCaseCount` must equal the current shared classifier safety corpus length, `classifierCorpusPassCount` must equal that case count, and `classifierCorpusFailedCount` must be `0`.
`normalBrowsing.browserMatrix` must include at least iOS Safari plus Android Chrome, Firefox, Edge, and Samsung Internet on physical devices; every row must set `isPhysicalDevice=true`, be marked `passed=true`, include a concrete `runId`, point `resultArtifact` to an existing artifact or QA/report URL, cover the unique allowed, recovery-search, and adult-blocked URL counts in the same evidence file, report matching pass counts, and record `falsePositiveCount=0` plus `missedAdultBlockCount=0`. Each row's `resultArtifact` must be a local `freed-normal-browsing-browser-report-v1` JSON report with `sanitized=true` whose `runId`, platform, browser name/package, counts, and pass/no-false-positive/no-missed-block checks match the row. The helper-generated `normal-browsing-browser-checklist.md` should be used to verify every URL row before those counts are copied into evidence. Android browser proof must pair Chrome with `com.android.chrome`, Firefox with `org.mozilla.firefox`, Edge with `com.microsoft.emmx`, and Samsung Internet with `com.sec.android.app.sbrowser`.

`performance-profile.json`:

Thresholds enforced by `npm run evidence:validation`:

- `durationMinutes >= 30`
- `batteryDrainPercent >= 0`
- `batteryDrainPercent <= 8`
- `maxResidentMemoryMb > 0`
- `maxResidentMemoryMb <= 350`
- `maxDeviceTemperatureC > 0`
- `maxDeviceTemperatureC <= 42`
- `dnsLatencyP95Ms > 0`
- `dnsLatencyP95Ms <= 100`
- `downloadMbpsBefore > 0`
- `downloadMbpsDuring > 0`
- `downloadMbpsDuring >= 80%` of `downloadMbpsBefore`
- `noPacketInspection=true`, `noMitmHttps=true`, `noContinuousScreenshotOrOcr=true`, and `noContinuousImageClassification=true`
- `platformProfiles` includes physical-device iOS and Android rows that meet the same thresholds.

Every `platformProfiles` row must also include a concrete `runId`, a `profilerArtifact` that points to an existing profiler/report artifact or QA/report URL, background CPU run/artifact/percent at 5% or less, routing-proof run/artifact for no-full-traffic-proxy, no-packet-inspection, and no-MITM-HTTPS review, network-speed and DNS-latency run IDs, pass markers for normal browsing speed, thermals, battery drain, no foreground polling loop, no continuous screenshot/OCR analysis, no continuous image classification outside on-demand challenge submission, and `noFullTrafficProxyConfirmed=true`.
`routingProofArtifact` must be a local `freed-routing-proof-report-v1` JSON report with `sanitized=true` whose `runId`, `platform`, and `protectionMode` match the row and whose checks prove no full-traffic proxy, packet inspection, MITM HTTPS, continuous packet capture, or normal-browsing route change. Android reports additionally prove DNS-only VPN/Private DNS/proxy/route-table state with no remote traffic tunnel. iOS reports prove Screen Time/ManagedSettings/Safari operation with no packet tunnel or NetworkExtension packet tunnel. Network speed and DNS latency artifacts remain required performance measurements, but iOS release readiness does not require a DNS Settings profile.

```json
{
  "validatedAt": "2026-05-12T00:00:00.000Z",
  "tester": "QA",
  "build": "1.0.0 (100)",
  "device": "iOS/Android model and OS version",
  "evidence": ["path/to/performance-report"],
  "profile": {
    "durationMinutes": 60,
    "batteryDrainPercent": 4,
    "maxResidentMemoryMb": 220,
    "maxDeviceTemperatureC": 36.5,
    "dnsLatencyP95Ms": 40,
    "downloadMbpsBefore": 150,
    "downloadMbpsDuring": 148,
    "platformProfiles": [
      {
        "platform": "ios",
        "isPhysicalDevice": true,
        "deviceModel": "iPhone 15 Pro",
        "osVersion": "iOS 18.4",
        "protectionMode": "Screen Time ManagedSettings adult filter",
        "runId": "<ios-performance-profile-run-id>",
        "profilerArtifact": "path/to/ios-performance-profiler-report",
        "backgroundCpuRunId": "<ios-background-cpu-run-id>",
        "backgroundCpuArtifact": "path/to/ios-background-cpu-report",
        "backgroundCpuPercent": 2.5,
        "routingProofRunId": "<ios-routing-proof-run-id>",
        "routingProofArtifact": "path/to/local-ios-freed-routing-proof-report-v1.json",
        "networkSpeedRunId": "<ios-network-speed-run-id>",
        "networkSpeedArtifact": "path/to/ios-network-speed-report",
        "dnsLatencyRunId": "<ios-dns-latency-run-id>",
        "dnsLatencyArtifact": "path/to/ios-dns-latency-report",
        "durationMinutes": 60,
        "batteryDrainPercent": 4,
        "maxResidentMemoryMb": 220,
        "maxDeviceTemperatureC": 36.5,
        "dnsLatencyP95Ms": 40,
        "downloadMbpsBefore": 150,
        "downloadMbpsDuring": 148,
        "normalBrowsingSpeedAcceptable": true,
        "noOverheating": true,
        "noBatteryDrainRegression": true,
        "noForegroundPollingLoopObserved": true,
        "noFullTrafficProxyConfirmed": true,
        "noPacketInspectionConfirmed": true,
        "noMitmHttpsConfirmed": true,
        "noContinuousScreenshotOrOcrConfirmed": true,
        "noContinuousImageClassificationConfirmed": true
      },
      {
        "platform": "android",
        "isPhysicalDevice": true,
        "deviceModel": "Pixel 8 Pro",
        "osVersion": "Android 15",
        "protectionMode": "DNS Guard DNS-only fallback",
        "runId": "<android-performance-profile-run-id>",
        "profilerArtifact": "path/to/android-performance-profiler-report",
        "backgroundCpuRunId": "<android-background-cpu-run-id>",
        "backgroundCpuArtifact": "path/to/android-background-cpu-report",
        "backgroundCpuPercent": 2.5,
        "routingProofRunId": "<android-routing-proof-run-id>",
        "routingProofArtifact": "path/to/local-android-freed-routing-proof-report-v1.json",
        "networkSpeedRunId": "<android-network-speed-run-id>",
        "networkSpeedArtifact": "path/to/android-network-speed-report",
        "dnsLatencyRunId": "<android-dns-latency-run-id>",
        "dnsLatencyArtifact": "path/to/android-dns-latency-report",
        "durationMinutes": 60,
        "batteryDrainPercent": 4,
        "maxResidentMemoryMb": 230,
        "maxDeviceTemperatureC": 36.5,
        "dnsLatencyP95Ms": 40,
        "downloadMbpsBefore": 150,
        "downloadMbpsDuring": 148,
        "normalBrowsingSpeedAcceptable": true,
        "noOverheating": true,
        "noBatteryDrainRegression": true,
        "noForegroundPollingLoopObserved": true,
        "noFullTrafficProxyConfirmed": true,
        "noPacketInspectionConfirmed": true,
        "noMitmHttpsConfirmed": true,
        "noContinuousScreenshotOrOcrConfirmed": true,
        "noContinuousImageClassificationConfirmed": true
      }
    ]
  },
  "checks": {
    "normalBrowsingSpeedAcceptable": true,
    "noOverheating": true,
    "noBatteryDrainRegression": true,
    "dnsOnlyRoutingConfirmed": true,
    "noForegroundPollingLoopObserved": true,
    "noPacketInspection": true,
    "noMitmHttps": true,
    "noContinuousScreenshotOrOcr": true,
    "noContinuousImageClassification": true
  }
}
```

`store-ad-sandbox.json`:

```json
{
  "validatedAt": "2026-05-12T00:00:00.000Z",
  "tester": "QA",
  "build": "1.0.0 (100)",
  "environment": "App Store sandbox, Play Billing test configuration, AdMob rewarded sandbox unit",
  "evidence": ["path/to/store-ad-sandbox-report"],
  "store": {
    "storeProvider": "native-iap",
    "iosProductId": "freed_premium_yearly",
    "androidProductId": "freed_premium_yearly",
    "purchaseVerifyEndpoint": "https://api.your-production-domain.example/api/purchases/verify",
    "releasePreflightCommand": "npm run preflight:release-env -- --env-file <production-env-file>",
    "releasePreflightRunId": "<release-env-preflight-run-id>",
    "releasePreflightArtifact": "path/to/release-env-preflight-report",
    "iosPurchaseRunId": "<ios-purchase-sandbox-run-id>",
    "iosPurchaseArtifact": "path/to/ios-purchase-recording-or-report",
    "iosPurchaseTransactionId": "1000001234567890",
    "iosRestoreRunId": "<ios-restore-sandbox-run-id>",
    "iosRestoreArtifact": "path/to/ios-restore-recording-or-report",
    "iosRestoreTransactionId": "1000001234567891",
    "androidPurchaseRunId": "<android-purchase-sandbox-run-id>",
    "androidPurchaseArtifact": "path/to/android-purchase-recording-or-report",
    "androidOrderId": "GPA.1234-5678-9012-34567",
    "androidRestoreRunId": "<android-restore-sandbox-run-id>",
    "androidRestoreArtifact": "path/to/android-restore-recording-or-report",
    "androidPurchaseTokenHash": "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "entitlementId": "premium",
    "purchaseSmokeCommand": "npm run smoke:purchase-verification",
    "paywallScopeRunId": "<paywall-launch-scope-run-id>",
    "paywallLaunchScopeArtifact": "path/to/local-freed-paywall-launch-scope-report-v1.json",
    "consoleProductSetupRunId": "<store-console-product-setup-run-id>",
    "consoleProductSetupArtifact": "path/to/local-freed-store-console-product-setup-report-v1.json",
    "purchaseVerificationReportId": "<purchase-verification-report-id>",
    "purchaseVerificationArtifact": "path/to/purchase-verification-report",
    "purchaseVerificationPassCount": 6,
    "purchaseVerificationFailedCount": 0,
    "restoreVerificationReportId": "<restore-verification-report-id>",
    "restoreVerificationArtifact": "path/to/restore-purchase-verification-smoke-report",
    "restoreVerificationPassCount": 6,
    "restoreVerificationFailedCount": 0,
    "rewardedAdUnitId": "admob-rewarded-unit-or-test-unit",
    "rewardedAdFormat": "rewarded",
    "rewardedAdResponseId": "<loaded-admob-response-id>",
    "rewardedAdRequestArtifact": "path/to/local-freed-rewarded-ad-request-report-v1.json",
    "noInterstitialOrBannerAdRequestsConfirmed": true,
    "freeRewardedInterventionRunId": "<free-rewarded-intervention-run-id>",
    "freeRewardedInterventionArtifact": "path/to/local-freed-store-intervention-flow-report-v1.json",
    "freePostAdChallengeLatencyMs": 1800,
    "rewardedAdCompletionRunId": "<rewarded-ad-completion-run-id>",
    "rewardedAdCompletionArtifact": "path/to/local-freed-store-intervention-flow-report-v1.json",
    "adFailureFallbackRunId": "<ad-failure-fallback-run-id>",
    "adFailureFallbackArtifact": "path/to/local-freed-store-intervention-flow-report-v1.json",
    "premiumNoAdInterventionRunId": "<premium-no-ad-intervention-run-id>",
    "premiumNoAdInterventionArtifact": "path/to/local-freed-store-intervention-flow-report-v1.json",
    "premiumNoRewardedAdRequested": true,
    "premiumNoAdLatencyMs": 1200,
    "adRequestNonPersonalized": true,
    "adRequestCountryCode": "<country-code>",
    "privacyDisclosureReviewId": "<app-store-play-privacy-review-id>",
    "privacyDisclosureArtifact": "path/to/local-freed-store-privacy-disclosure-report-v1.json"
  },
  "checks": {
    "iosPurchaseSandbox": true,
    "iosRestoreSandbox": true,
    "androidPurchaseSandbox": true,
    "androidRestoreSandbox": true,
    "releaseEnvPreflightPassed": true,
    "purchaseVerificationSmokePassed": true,
    "receiptOrEntitlementVerified": true,
    "rewardedAdLoaded": true,
    "rewardedOnlyAdFormat": true,
    "rewardedAdNonPersonalizedRequest": true,
    "rewardedAdCountryContextRecorded": true,
    "noInterstitialOrBannerAdsRequested": true,
    "storePrivacyDisclosureReviewed": true,
    "paywallCore3OnlyShown": true,
    "storeConsoleProductsConfigured": true,
    "freeStreakRiskContextShown": true,
    "freeRewardedAdBeforeChallenge": true,
    "freePostAdChallengeGenerated": true,
    "rewardedAdCompletionGrantsChallenge": true,
    "adFailureFallbackUnlocksChallenge": true,
    "premiumNoRewardedAdRequested": true,
    "premiumNoAdInterventionStartsChallenge": true
  }
}
```

`store.rewardedAdUnitId` must use a real AdMob rewarded unit format like `ca-app-pub-0000000000000000/0000000000`; Google sample publisher IDs and generic test labels are rejected. When release env values provide rewarded reset ad units, the evidence ad unit must match one of those configured units. `store.rewardedAdFormat` must be `rewarded`, `store.noInterstitialOrBannerAdRequestsConfirmed` must be `true`, and evidence must omit banner/interstitial/app-open/native ad unit or request fields. `store.rewardedAdRequestArtifact` must point to a local `freed-rewarded-ad-request-report-v1` JSON artifact under `docs/validation/artifacts/` with `sanitized=true`, matching rewarded ad unit, loaded AdMob response ID, coarse country code, rewarded format, non-personalized request mode, no interstitial/banner/app-open/native ad request, no advertising ID, no precise location, no raw device identifier, and no ad-network secret proof.

`store.adRequestNonPersonalized` must be `true`, matching FREED's privacy-first AdMob request mode.

`store.adRequestCountryCode` must be a real ISO 3166-1 alpha-2 country code, recording coarse release QA/ad-mediation context without precise location or recovery data; reserved or placeholder codes such as `ZZ` are rejected.

`store.privacyDisclosureReviewId` must be a concrete App Store / Play privacy-disclosure review ticket/report ID. `store.privacyDisclosureArtifact` must point to a local `freed-store-privacy-disclosure-report-v1` JSON artifact under `docs/validation/artifacts/` with `sanitized=true`, a matching `reviewId`, iOS and Android platforms reviewed, App Store privacy and Play Data safety surfaces reviewed, source hashes for `docs/privacy-data-map.md` plus both store-policy packs, and true checks for billing, purchase verification, rewarded ads, non-personalized ads, aggregate analytics opt-in, no tracking, no advertising ID permission, no raw receipts/tokens, no store credentials or ad-network secrets, no sensitive recovery content sharing, and no challenge media upload.

`store.storeProvider` must be `native-iap` or `revenuecat` and match the release build's configured monetization provider. `store.purchaseVerifyEndpoint` must match the configured purchase verification endpoint when that release env value is present. `store.iosProductId` and `store.androidProductId` must match a configured Core 3 launch product ID, while `store.iosLaunchProductIds`, `store.androidLaunchProductIds`, and `store.launchProductSandboxMatrix` must prove yearly, monthly, and lifetime only. Each matrix row must also point its purchase and restore verification artifact fields to local `purchase-verification-smoke-v1` reports that release validation can inspect. Future family/accountability/AI-coach SKUs are rejected for v1 evidence. `store.paywallLaunchScopeArtifact` must point to a local `freed-paywall-launch-scope-report-v1` JSON artifact with `sanitized=true`, matching `store.paywallScopeRunId`, current source hashes for the paywall and monetization files, Core 3 plan/product IDs visible only, future product IDs hidden, yearly value-anchor proof, visible restore, enabled purchase buttons, server-verification copy, premium no-ad copy, and no future upsell checks. `store.consoleProductSetupArtifact` must point to a local `freed-store-console-product-setup-report-v1` JSON artifact with `sanitized=true`, matching `store.consoleProductSetupRunId`, source hashes for the product catalog, App Store IAP CSV, Play product CSV, screenshot manifest, a read-only Browser app-record readiness report path/hash proving the Play app record, App Store Connect app record, and Apple license-agreement readiness, Core 3 products only, App Store subscription group and lifetime non-consumable setup, Play base plans and lifetime one-time non-consumable setup, screenshots/localizations, server-verification metadata, redacted App Store Connect and Play Console evidence artifacts with matching hashes, inactive future SKUs, no extra active products, and draft/internal/TestFlight-only status until evidence passes. `store.entitlementId` must match the configured premium entitlement ID and use a machine-readable entitlement ID format. Purchase and restore evidence must include concrete iOS and Android run IDs, artifact references, report IDs, at least six purchase-verification smoke passes covering endpoint validation, unknown product rejection, yearly/monthly/lifetime fake-token rejection, and malformed JSON rejection, plus zero failures. Free rewarded intervention, rewarded completion, ad-failure fallback, and premium no-ad intervention evidence must each point to a local `freed-store-intervention-flow-report-v1` JSON artifact under `docs/validation/artifacts/` with `sanitized=true`, a matching run ID, the expected flow type, supportive/no-punitive copy checks, no raw ad or entitlement payloads, and the relevant challenge-access result. `store.freePostAdChallengeLatencyMs` must be between 0 and 5000 and match the free intervention report latency to prove free users enter challenge mode after ad completion. `store.premiumNoRewardedAdRequested=true` and `store.premiumNoAdLatencyMs` between 0 and 3000, matching the premium intervention report latency, prove premium users reach challenge mode immediately without making a rewarded-ad request.

Store/ad evidence must omit raw receipts, purchase tokens, private customer identifiers, ad-network secrets, and store-verification credentials, even when they appear inside freeform QA notes or nested helper metadata. Store only sanitized transaction IDs, SHA-256 token hashes, entitlement IDs, run IDs, and artifact references.

`store.releasePreflightCommand` must be `npm run preflight:release-env`, optionally with `-- --env-file <production-env-file>`, and must include a concrete `store.releasePreflightRunId` plus `store.releasePreflightArtifact` proving the release env passed before store/ad sandbox capture. Add `--report docs/validation/artifacts/<run-id>/release-env-preflight-report.json` when running the command if you want a sanitized JSON artifact, but do not include that extra flag in the evidence command field.
`store.purchaseSmokeCommand` must be `npm run smoke:purchase-verification`, optionally with `-- --env-file <production-env-file>`. Add `--report docs/validation/artifacts/<run-id>/purchase-verification-smoke-report.json` when running the command; `store.purchaseVerificationArtifact` and `store.restoreVerificationArtifact` must point to local sanitized JSON reports so release validation can inspect `purchase-verification-smoke-v1.contractProof`, Core 3 yearly/monthly/lifetime fake-known `PASS` result rows, matching `launchProductIdsChecked`, and no-secret echo proof, but do not include the report flag in the evidence command field.
Store evidence must attach local purchase and restore verification smoke JSON reports with `sanitized=true`, `contractProof` for `/api/purchases/verify`, endpoint validation, bounded timeout, `syntheticOnly=true`, matching `launchProductIdsChecked`, unknown-product/Core 3 fake-token/malformed-JSON rejection proof, no raw token/receipt/order/package echo, checked server-secret key names, and `secretValuesOmitted=true`.

`ai-backend-smoke.json`:

```json
{
  "validatedAt": "2026-05-12T00:00:00.000Z",
  "tester": "QA",
  "build": "1.0.0 (100)",
  "environment": "Production AI backend smoke run",
  "evidence": ["path/to/ai-backend-smoke-report"],
  "ai": {
    "coachEndpoint": "https://your-deployed-origin.example/api/clara",
    "challengeEndpoint": "https://your-deployed-origin.example/api/challenges",
    "model": "<remote-provider-model-id>",
    "releasePreflightCommand": "npm run preflight:release-env -- --env-file <production-env-file>",
    "releasePreflightRunId": "<release-env-preflight-run-id>",
    "releasePreflightArtifact": "path/to/release-env-preflight-report",
    "safetyEvalCommand": "npm run eval:ai-safety",
    "smokeCommand": "npm run smoke:ai-backend",
    "safetyEvalReportId": "<ai-safety-eval-report-id>",
    "safetyEvalArtifact": "path/to/ai-safety-eval-report",
    "safetyEvalCaseCount": 10,
    "safetyEvalFailedCount": 0,
    "smokeReportId": "<ai-backend-smoke-report-id>",
    "smokeReportArtifact": "path/to/ai-backend-smoke-report",
    "coachSmokeRunId": "<coach-endpoint-smoke-run-id>",
    "coachSmokeArtifact": "path/to/coach-endpoint-smoke-report",
    "challengeSmokeRunId": "<challenge-endpoint-smoke-run-id>",
    "challengeSmokeArtifact": "path/to/challenge-endpoint-smoke-report",
    "smokeEndpointPassCount": 2,
    "smokeEndpointFailCount": 0,
    "challengePersonalizationRunId": "<challenge-personalization-smoke-run-id>",
    "challengePersonalizationArtifact": "path/to/challenge-personalization-report",
    "challengePersonalizationProfileCount": 2,
    "challengeRiskForecastProfileCount": 2,
    "challengeSessionDurationBucketProfileCount": 1,
    "challengeRecentFailureProfileCount": 1,
    "freeChallengePremiumCount": 0,
    "noCoordinateFieldsRunId": "<no-coordinate-fields-run-id>",
    "noCoordinateFieldsArtifact": "path/to/no-coordinate-fields-report",
    "noSensitiveEchoSampleCount": 2,
    "noSensitiveEchoRunId": "<no-sensitive-echo-run-id>",
    "noSensitiveEchoArtifact": "path/to/no-sensitive-echo-report",
    "redactionReportId": "<ai-redaction-report-id>",
    "redactionArtifact": "path/to/ai-redaction-report",
    "crisisFallbackRunId": "<crisis-fallback-run-id>",
    "crisisFallbackArtifact": "path/to/crisis-fallback-report",
    "providerFallbackRunId": "<provider-fallback-run-id>",
    "providerFallbackArtifact": "path/to/provider-fallback-report"
  },
  "checks": {
    "aiSafetyEvalPassed": true,
    "releaseEnvPreflightPassed": true,
    "coachSmokePassed": true,
    "challengeSmokePassed": true,
    "challengePersonalizationVerified": true,
    "riskForecastPersonalizationVerified": true,
    "sessionDurationBucketPersonalizationVerified": true,
    "recentFailureCountPersonalizationVerified": true,
    "freeChallengePremiumExcluded": true,
    "noCoordinateFields": true,
    "noSensitiveEcho": true,
    "crisisFallbackVerified": true,
    "fallbackBehaviorVerified": true
  }
}
```

`ai.releasePreflightCommand` must be `npm run preflight:release-env`, optionally with `-- --env-file <production-env-file>`, and must include a concrete `ai.releasePreflightRunId` plus `ai.releasePreflightArtifact` proving the release env passed before AI smoke capture. Add `--report docs/validation/artifacts/<run-id>/release-env-preflight-report.json` when running the command if you want a sanitized JSON artifact, but do not include that extra flag in the evidence command field.
`ai.safetyEvalCommand` and `ai.smokeCommand` must be `npm run eval:ai-safety` and `npm run smoke:ai-backend`, optionally with `-- --env-file <production-env-file>`. Add `--report docs/validation/artifacts/<run-id>/ai-backend-smoke-report.json` when running the AI backend smoke command; `ai.smokeReportArtifact` must point to that local sanitized JSON report so release validation can inspect `ai-backend-smoke-v1.contractProof`, required `PASS` result rows, and no-secret echo proof, but do not include the report flag in the evidence command field.
AI evidence must record safety eval and backend smoke report IDs/artifacts, at least 10 safety eval cases with 0 failures, both deployed endpoint smoke cases with 0 failures, concrete coach/challenge smoke run IDs/artifacts, a challenge-personalization smoke run covering at least 2 context-rich profile shapes with weather/location-permission signals, aggregate urge-risk forecast signals, a coarse app/short-form session-duration bucket, aggregate recent failed-reset count, and no latitude/longitude fields, an explicit no-coordinate-fields run ID/artifact with `checks.noCoordinateFields=true`, `ai.challengeRiskForecastProfileCount>=2` with `checks.riskForecastPersonalizationVerified=true`, `ai.challengeSessionDurationBucketProfileCount>=1` with `checks.sessionDurationBucketPersonalizationVerified=true`, `ai.challengeRecentFailureProfileCount>=1` with `checks.recentFailureCountPersonalizationVerified=true`, 0 premium-only challenges for the free profile, at least 2 no-sensitive-echo samples, and concrete no-sensitive-echo, redaction, crisis fallback, and provider fallback run IDs/artifacts. `ai.smokeReportArtifact` must include `sanitized=true`, `contractProof` for `/api/clara`, `/api/challenges`, optional `/api/retention`, required `PASS` result rows for configured model, CLARA, challenge, and personalization checks, bounded timeouts, configured-model proof, personalization proof, no-sensitive-echo/no-coordinate proof, checked server-secret key names, and `secretValuesOmitted=true`. If `EXPO_PUBLIC_RETENTION_ENDPOINT` is configured, also record `ai.retentionEndpoint`, `ai.retentionSmokeRunId`, `ai.retentionSmokeArtifact`, `checks.retentionAggregateOnlyVerified=true`, at least 3 deployed endpoint smoke passes, a required retention `PASS` result row, and at least 3 no-sensitive-echo samples. The evidence endpoints must match configured `EXPO_PUBLIC_AI_COACH_ENDPOINT`, `EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT`, and optional `EXPO_PUBLIC_RETENTION_ENDPOINT`, and `ai.model` must match configured `OPENAI_MODEL` or `GEMINI_MODEL`, when those release env values are present.
AI evidence must omit raw prompts, raw user inputs, private notes, full conversation transcripts, unredacted model responses, sensitive URLs/domains, and provider API keys, even when pasted into neutral summary fields. Put sanitized summaries and redacted reports in artifacts instead.
