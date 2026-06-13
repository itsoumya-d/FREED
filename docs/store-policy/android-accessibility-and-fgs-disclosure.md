# Android Accessibility And DNS Guard Policy Pack

Last reviewed: 2026-05-18

This pack is the release-review source for FREED's Android AccessibilityService and DNS Guard special-use foreground service. Attach the final signed-copy export, screenshots, and Play Console decisions to `docs/validation/evidence/android-real-browser.json` as `android.playPolicyAccessibilityArtifact` and `android.playPolicySpecialUseFgsArtifact`.

Policy sources to refresh before submission:

- Google Play User Data policy, including Accessibility API disclosure/declaration requirements: https://support.google.com/googleplay/android-developer/answer/9888170
- Android foreground service type guidance, including `specialUse` and `android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE`: https://developer.android.com/develop/background-work/services/fgs/service-types

## AccessibilityService Declaration

FREED uses AccessibilityService for relapse-interruption protection, not as a disability assistance feature. The Play Console AccessibilityService declaration must say that the service is user-enabled, explicit opt-in, and required to detect only high-risk recovery moments from supported surfaces selected by the user.

Review-safe purpose:

- Detect adult-site or adult-search attempts from supported browser address/search fields, including raw focused search text before navigation.
- Detect adult-site attempts from focused WebView URL/search fields in vetted WebView contexts.
- Detect selected doomscroll app foreground sessions from selected app packages.
- Detect sustained YouTube Shorts, Instagram Reels, and TikTok For You loops from selected short-form labels, resource-id signals where exposed, and bounded scroll events after the configured threshold. YouTube Shorts, Instagram Reels, and TikTok For You handoff requires the selected surface to still be visible at the threshold deadline.
- Open FREED's supportive challenge handoff when thresholds are reached.

Observed data boundary:

- Selected app packages.
- Supported browser package name.
- Focused URL/search field text when the node is editable, focused, or accessibility-focused; high-confidence raw adult search text is converted to a redacted local focused-search handoff instead of storing the query.
- Focused WebView URL/search field text only when the context is a WebView URL/search surface.
- Selected short-form labels, short-form resource identifiers where exposed, and bounded scroll events.
- Aggregate same-day foreground duration from user-enabled Usage Access.

Explicit exclusions:

- No screenshots.
- No OCR.
- No continuous screen capture.
- No raw page text scraping.
- No keyboard logging.
- No hidden monitoring.
- No overlay permission.
- No packet inspection.
- No MITM HTTPS.
- No sale or sharing of AccessibilityService data.
- No raw path/query persistence; native handoff stores host-level redacted URLs only.

User controls:

- FREED explains the AccessibilityService before sending the user to Android settings.
- The user can enable or disable the service in system settings at any time.
- App shields are limited to FREED's supported doomscroll package allowlist and the user's selected packages/modes.
- Earned unlocks pause only the selected supported app package that produced the challenge, source-less or unsupported native unlock attempts fail closed, and automatic relock restores protection.

Suggested Play Console declaration text:

> FREED uses AccessibilityService only after explicit user opt-in to protect users from selected adult-content and doomscroll relapse moments. The service reads supported browser address/search fields, focused WebView URL/search fields, selected app package foreground changes, selected short-form labels or resource identifiers where exposed, and bounded scroll events. When raw browser search text shows high-confidence adult intent, FREED converts it to a redacted local focused-search handoff instead of storing the query. YouTube Shorts, Instagram Reels, and TikTok For You scroll thresholds are tied to selected short-form surface signals instead of broad app scrolling, and that selected surface must still be visible when the threshold deadline fires. It does not capture screenshots, perform OCR, log keystrokes, inspect page contents, read private messages, or collect raw browsing history. When a configured risk threshold is reached, FREED opens a supportive recovery challenge. Data processing stays on device except aggregate/redacted recovery metrics the user explicitly enables.

## In-App Disclosure Copy

Use this copy in the permission setup and policy evidence artifact:

> To protect you from explicit content and doomscroll loops, FREED needs Accessibility permission to detect selected app launches, supported browser address/search fields, and sustained Shorts/Reels/TikTok For You loops after your configured threshold while the selected short-form surface is visible. FREED can detect high-confidence adult search text before navigation, but saves only a redacted focused-search summary. FREED does not take screenshots, read private messages, inspect page contents, log keystrokes, or sell this data. Processing stays on device and only recovery-safe, redacted attempt summaries are saved.

## Foreground Service Special Use Declaration

FREED's Android DNS Guard is a user-enabled DNS-only VPN fallback for adult-domain filtering. It is not a full-device traffic proxy. The manifest must keep:

- `android.permission.FOREGROUND_SERVICE_SPECIAL_USE`
- `android.permission.POST_NOTIFICATIONS`
- `android:foregroundServiceType="specialUse"`
- `android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE`

Current subtype value:

> User-enabled DNS-only VPN fallback for adult-domain filtering without full traffic proxying.

Review-safe purpose:

- Keep DNS Guard alive only while the user has started adult-domain protection.
- Intercept DNS questions locally.
- Classify domains against the synced adult-domain feed.
- Return NXDOMAIN for adult-classified domains.
- Forward allowed DNS questions to configured resolver IPs with primary/secondary failover.
- Return bounded SERVFAIL responses for answerable malformed DNS questions or resolver outage instead of silently hanging DNS clients.

Explicit DNS Guard exclusions:

- No full traffic proxy.
- No default route such as `0.0.0.0/0` or `::/0`.
- No TLS interception.
- No HTTPS MITM.
- No packet payload inspection beyond DNS questions.
- No raw browsing history persistence.
- No background start unless DNS Guard was explicitly user-enabled and existing Android VPN consent is still valid.

Runtime controls and evidence:

- The service uses a persistent foreground notification while DNS Guard is active.
- On Android 13+, FREED declares notification permission, reports whether it is required/granted, asks through the runtime notification prompt first, and opens app notification settings only if the permission remains denied so recovery handoffs stay visible when background activity starts are restricted.
- The user can stop DNS Guard from FREED or Android VPN settings.
- Native status exposes Android Private DNS mode/specifier plus last successful resolver/failure for QA.
- FREED can open Android Network & internet settings so users and QA can review strict Private DNS before rerunning DNS Guard verification; FREED does not change Private DNS settings silently.
- Native status exposes DNS Guard session counts (queries, blocked, allowed, SERVFAIL, malformed), uptime, last session duration, and stop reason for long-running lifecycle QA without storing normal browsing hosts.
- DNS Guard can restart after device reboot or app update only when the user previously enabled it and `VpnService.prepare()` confirms existing Android VPN consent; manual stop and Android VPN revocation clear that user-enabled restart intent.
- Native status exposes whether DNS Guard is user-enabled, whether restart is eligible, and the last restart action/result/skip reason for QA.
- Performance evidence must prove no full-traffic proxying, low DNS latency, low background CPU, and acceptable battery/thermal impact.

Suggested Play Console declaration text:

> FREED uses a foreground service with the special-use subtype for a user-enabled DNS-only VPN fallback. The service is active only while DNS Guard is running, shows a persistent notification, routes only configured DNS resolver IPs, classifies DNS questions locally against FREED's adult-domain feed, blocks adult-classified domains, and forwards allowed DNS upstream. After reboot or app update, FREED restores DNS Guard only if the user previously enabled it and Android VPN consent is still valid; manual stop or VPN revocation clears that restart intent. FREED does not route all device traffic, inspect packet payloads, decrypt HTTPS, or MITM connections.

## Data Safety Mapping

For the Play Data safety form and release review:

- AccessibilityService data category: app activity and web browsing signals only as on-device processing for user-requested safety protection.
- DNS Guard data category: DNS host/domain questions processed locally for adult-domain filtering.
- Sharing: none for AccessibilityService/DNS Guard data.
- Sale: none.
- Security practices: No raw URL path/query persistence; host-level redaction; remote analytics disabled by default; optional remote analytics must be aggregate-only and explicit opt-in.
- Retention: local recovery history is user-controlled; native pending interventions are freshness-windowed and consumed into redacted local state with allowlisted app-package unlock sources only.

## Challenge Verification Permissions

Challenge verification permissions are separate from Android AccessibilityService and DNS Guard. They are requested only when a user starts a challenge that needs that signal.

- Camera: fresh photo challenge verification through on-device ML Kit labels. The app requests no base64 or EXIF payload and deletes the temporary camera file on a best-effort basis after classification. The Android config, source manifest, and generated release manifests remove microphone, overlay, Ad ID, legacy storage, media image/video/audio, selected-media, media-location, and all-files storage permissions from shipped builds.
- Activity Recognition, sensors, and steps: walking or exercise challenge verification while the active challenge is running.
- Foreground location: outdoor movement challenge verification while the challenge is active.

Explicit exclusions:

- No gallery or media-library access.
- No media upload in the current local-first build.
- No persistent challenge-photo library.
- No continuous camera analysis, image classification, screen capture, screenshot analysis, or OCR.
- No background fitness monitoring or Health Connect history sync.
- No background location tracking for protection.

## Required Release Evidence

Android real-browser evidence must include:

- `android.accessibilityPermissionRunId`
- `android.accessibilityPermissionArtifact`
- `android.playPolicyAccessibilityReviewId`
- `android.playPolicyAccessibilityArtifact`
- `android.playPolicySpecialUseFgsReviewId`
- `android.playPolicySpecialUseFgsArtifact`
- DNS Guard routing proof with no full traffic proxy.
- Android 13+ notification permission/status proof for visible DNS Guard recovery handoffs.
- Performance proof for background CPU, battery, thermals, DNS latency, and download-speed degradation.

Do not promote Android release evidence until the artifacts prove the submitted Play Console declarations match this document and the signed build.
