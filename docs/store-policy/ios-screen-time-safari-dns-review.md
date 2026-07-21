# iOS Screen Time And Safari Review Pack

Last reviewed: 2026-07-21

This pack is the App Store review source for FREED's iOS protection architecture. Attach final entitlement approval, provisioning, signed-target, Safari extension, and physical-device QA artifacts to `docs/validation/evidence/ios-physical-device.json`.

Apple sources to refresh before submission:

- Screen Time API documentation: https://developer.apple.com/documentation/ScreenTimeAPIDocumentation
- Managed Settings framework documentation: https://developer.apple.com/documentation/ManagedSettings
- Device Activity framework documentation: https://developer.apple.com/documentation/DeviceActivity
- Safari Content Blocker documentation: https://developer.apple.com/documentation/SafariServices/creating-a-content-blocker
- Safari Web Extension documentation: https://developer.apple.com/documentation/SafariServices/creating-a-safari-web-extension

## Review Position

FREED uses Apple-supported Screen Time, Safari Content Blocker, and Safari Web Extension APIs for voluntary wellness protection. FREED does not use NetworkExtension and does not use invasive monitoring to inspect other apps.

Review-safe purpose:

- Let the user authorize Screen Time protection with the Family Controls entitlement.
- Let the user choose apps, app categories, or web domains with FamilyActivityPicker.
- Apply ManagedSettings adult web filtering.
- Shield selected Screen Time targets after a configured daily threshold.
- Run DeviceActivity schedules for Night Guard, selected-target limits, and exact relock.
- Load adult-domain rules through Safari Content Blocker.
- Use Safari Focus Shield to pause approved YouTube Shorts, Instagram Reels, and TikTok For You web routes.

Explicit platform boundaries:

- FREED cannot and does not read third-party app screens on iOS.
- FREED cannot and does not detect Instagram Reels, TikTok, or YouTube Shorts inside native third-party apps on iOS.
- FREED does not inject into native Instagram, TikTok, YouTube, or other apps.
- FREED does not use Accessibility-style surveillance on iOS.
- FREED does not take screenshots, run OCR, or perform continuous image classification for protection.
- FREED does not use `NEPacketTunnelProvider`, `NETunnelProviderManager`, or `NEVPNManager`.
- FREED does not include a packet-tunnel provider.
- FREED does not full-tunnel traffic.
- No VPN manager is used.
- No TLS interception is used.
- No packet tunnel, VPN manager, full traffic proxying, packet inspection, or MITM HTTPS is used.

## Screen Time Entitlement Request

Suggested Family Controls entitlement and App Review note:

> FREED is a recovery and digital-wellness app that uses Apple's Screen Time frameworks to help users voluntarily block adult web content and interrupt selected apps during high-risk periods. The app requests Family Controls authorization, lets the user choose Screen Time targets with FamilyActivityPicker, applies ManagedSettings adult web filtering, and uses DeviceActivity schedules or thresholds to shield selected targets. FREED receives opaque Screen Time tokens and threshold events only; it does not read third-party app screens, messages, browsing history, or in-app content.

Screen Time data boundary:

- Stored: selected opaque Screen Time token payloads, aggregate target counts, configured limit minutes, schedule identifiers, and earned-unlock expiry/scope.
- Not stored: other app screens, in-app content, browsing history, private messages, or raw Safari page contents.
- Sent off device: none from Screen Time protection in the current local-first build.

The shield action publishes one atomic App Group record. An earned unlock is accepted only for a selected Screen Time token. Application and web-domain unlocks use ManagedSettings category-policy exception sets so unrelated direct targets and category shields remain active. Category recovery is explicitly category-wide. Expiry and risk-window reconciliation restore the exact selected shields.

## Safari Content Blocker

FREED's Content Blocker receives only compiled adult-domain JSON rules. It does not execute page JavaScript.

- Safari receives adult-domain rules in advance.
- FREED does not inspect page contents through the Content Blocker.
- FREED does not receive users' Safari browsing history.
- The containing app reloads reviewed adult-domain rules through the shared App Group.

Suggested App Review note:

> FREED includes a Safari Content Blocker for reviewed adult-domain rules. The Content Blocker does not read Safari browsing history or page contents. Short-form web recovery is implemented separately through the narrowly scoped Safari Focus Shield extension.

## Safari Focus Shield

Safari Focus Shield is a manifest-version-3 Safari Web Extension with a minimum Safari/iOS version of 15.4. Its host access is limited to YouTube, Instagram, TikTok, and the first-party recovery link domain; it does not request all-site access.

- The content script recognizes only approved short-form routes and replaces those pages with an accessible recovery pause.
- Client-side navigation is covered through history events and a DOM observer.
- The content script sends only an allowlisted `{host, rule}` pair to the extension runtime.
- A nonpersistent background service worker validates the pair and alone calls native messaging.
- The native extension handler independently validates the same host/rule mapping and publishes a privacy-safe pending record.
- Recovery opens `https://intervention.freed.app/intervention` as a Universal Link with coarse host/rule metadata; no original URL, path, query, page text, or browsing history is stored.
- Safari Focus Shield never creates a native-app Screen Time unlock.

Suggested App Review note:

> FREED's Safari Focus Shield pauses three named short-form web surfaces. A content script renders the pause, a background service worker relays only a validated host/rule pair to the containing extension, and an explicit first-party Universal Link opens a local recovery challenge. The extension does not collect browsing history or arbitrary page content.

## Challenge Verification

Challenge-verification permissions are separate from protection permissions and are requested only when a challenge needs them.

- Camera: fresh photo verification through on-device Vision labels, with no base64/EXIF payload and best-effort temporary-file deletion.
- Motion/steps: foreground walking or exercise verification. The current build does not sync HealthKit history.
- Foreground location: outdoor movement verification while the challenge is active.

Explicit exclusions:

- No continuous camera analysis, screen capture, screenshots, OCR, or image classification for protection.
- No background location tracking for protection.
- No HealthKit history sync or export in the current build.
- No challenge media upload in the current local-first build.
- No gallery/media-library import or persistent challenge-photo library.

## Required Release Evidence

iOS physical-device evidence must include:

- `ios.familyControlsEntitlementArtifact`
- `ios.appGroupProvisioningArtifact`
- `ios.completeDataProtectionEntitlement=NSFileProtectionComplete`
- `ios.familyControlsAuthorizationArtifact`
- `ios.familyActivityPickerArtifact`
- `ios.familyActivityPickerAppLimitScheduledImmediately=true`
- `ios.familyActivityPickerAppLimitActivityName=freed.selectedAppDailyLimit`
- `ios.familyActivityPickerAppLimitEventName=freed.selectedAppDailyLimitReached`
- `ios.selectedAppDailyLimitArtifact`
- `ios.managedSettingsFilterArtifact`
- `ios.safariContentBlockerBuildRunId`
- `ios.safariContentBlockerReloadRunId`
- `ios.safariContentBlockerAdultBlockRunId`
- `ios.safariFocusShieldShortFormBlockRunId`
- `ios.safariShortFormChallengeHandoffSource=ios-safari-short-form`
- `ios.safariShortFormChallengeHandoffRawPathStored=false`
- `ios.safariShortFormChallengeHandoffNativeUnlockActive=false`
- `ios.earnedUnlockAppAllowRunId`
- `ios.earnedUnlockActivityName=freed.earnedUnlockWindow`
- `ios.earnedUnlockRelockRunId`
- `ios.shieldActionHandoffRunId`
- `ios.deviceActivityNightGuardRunId`
- `ios.normalBrowsingRunId`
- `ios.adultInterceptRunId`

Do not promote iOS release evidence until the artifacts prove the App Review notes match the signed build and actual physical-device behavior.
