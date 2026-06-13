# iOS Screen Time, Safari, And DNS Settings Review Pack

Last reviewed: 2026-05-17

This pack is the App Store review source for FREED's iOS protection architecture. Attach the final entitlement approval, provisioning, signed-target, Safari reload, and physical-device QA artifacts to `docs/validation/evidence/ios-physical-device.json`.

Apple sources to refresh before submission:

- Screen Time API documentation: https://developer.apple.com/documentation/ScreenTimeAPIDocumentation
- Managed Settings framework documentation: https://developer.apple.com/documentation/ManagedSettings
- Device Activity framework documentation: https://developer.apple.com/documentation/DeviceActivity
- Safari Content Blocker documentation: https://developer.apple.com/documentation/SafariServices/creating-a-content-blocker
- NetworkExtension DNS Settings documentation: https://developer.apple.com/documentation/networkextension/dns-settings

## Review Position

FREED uses Apple-supported Screen Time, Safari Content Blocker, and optional DNS Settings APIs for wellness protection. FREED does not use invasive monitoring to inspect other apps.

Review-safe purpose:

- Let the user authorize Screen Time protection with Family Controls.
- Let the user choose apps, app categories, or web domains with FamilyActivityPicker.
- Apply ManagedSettings adult web filtering.
- Shield selected Screen Time targets after a configured daily threshold.
- Run DeviceActivity schedules for Night Guard and selected-target daily limits.
- Reload Safari Content Blocker rules for adult-domain and web short-form path blocking in Safari.
- Optionally apply matched-domain encrypted DNS settings only when Apple has approved the `dns-settings` entitlement and the user enables the system profile.

Explicit platform boundaries:

- FREED cannot and does not read third-party app screens on iOS.
- FREED cannot and does not detect Instagram Reels, TikTok, or YouTube Shorts inside native third-party apps on iOS.
- FREED cannot and does not inject into Instagram, TikTok, YouTube, Safari, or other apps.
- FREED does not use Accessibility-style surveillance on iOS.
- FREED does not take screenshots, run OCR, or perform continuous image classification for protection.
- FREED does not use `NEPacketTunnelProvider`, `NETunnelProviderManager`, or `NEVPNManager`.
- FREED does not full-tunnel traffic, inspect packets, proxy normal traffic, or MITM HTTPS.

## Screen Time Entitlement Request

Use this copy for Family Controls entitlement and App Review notes:

> FREED is a recovery and digital-wellness app that uses Apple's Screen Time frameworks to help users voluntarily block adult web content and interrupt selected apps during high-risk periods. The app requests Family Controls authorization, lets the user choose Screen Time targets with FamilyActivityPicker, applies ManagedSettings adult web filtering, and uses DeviceActivity schedules or thresholds to shield selected targets. FREED receives opaque Screen Time tokens and threshold events only; it does not read third-party app screens, messages, browsing history, or in-app content.

Screen Time data boundary:

- Stored: selected opaque Screen Time token payloads, selected token counts, configured daily-limit minutes, schedule names, earned-unlock expiry.
- Not stored: other app screens, in-app content, browsing history, private messages, raw Safari page contents.
- Sent off device: none from Screen Time protection in the current local-first build.

## Safari Content Blocker

FREED's Safari extension is a Content Blocker, not a page-reading Safari Web Extension. It provides Safari with compiled JSON rules.

Review-safe purpose:

- Block known adult domains and adult redirect domains in Safari.
- Block web short-form paths such as YouTube Shorts, Instagram Reels web URLs, and TikTok For You web URLs in Safari.
- Reload the reviewed adult-domain feed through the containing app and shared app group.

Safari data boundary:

- Safari receives rules in advance.
- FREED does not inspect page contents.
- FREED does not receive users' Safari browsing history from the content blocker.
- Safari web short-form rules apply to web URLs only; iOS native app Reels/Shorts/TikTok behavior is handled by Screen Time app-level limits, not in-app detection.
- Approved Safari/web short-form challenge redirects may open FREED through the registered `freed` URL scheme with `freed://intervention?...`; this is a first-party challenge handoff only, stores host-only surface metadata, and does not pause Screen Time shields.

Suggested App Review note:

> FREED includes a Safari Content Blocker extension for adult-domain and web short-form URL rules. The extension uses Safari's content-blocking rule model and does not read Safari browsing history or page contents. It is a low-latency first-line browser protection layer; native third-party app behavior is managed through user-selected Screen Time shields instead of app-screen inspection.

## Optional DNS Settings

FREED treats iOS DNS Settings as optional and entitlement-gated. Safari Content Blocker and Screen Time remain the primary iOS protection layers.

Review-safe purpose:

- Add an encrypted DNS-over-HTTPS configuration for explicit adult-domain suffixes only.
- Use `NEDNSSettingsManager` with explicit `matchDomains` and `matchDomainsNoSearch=true`.
- Let iOS and the user decide whether the saved DNS profile is enabled.

Explicit DNS Settings exclusions:

- No all-domain DNS profile.
- No packet tunnel.
- No VPN manager.
- No default traffic route.
- No TLS interception.
- No HTTP/HTTPS proxy.
- No packet payload inspection.
- No raw browsing history persistence.

Suggested entitlement/App Review note:

> FREED may use NetworkExtension DNS Settings only if Apple approves the `dns-settings` entitlement. The app configures DNS-over-HTTPS for explicit adult-domain suffixes and does not create a packet tunnel, VPN, proxy, or all-traffic route. The system/user must enable the profile before it affects DNS resolution. If the entitlement or profile is unavailable, FREED falls back to Screen Time and Safari Content Blocker protection.

## Challenge Verification

Challenge verification permissions are separate from protection permissions and are requested only when a challenge needs them.

- Camera: fresh photo challenge verification through on-device Vision labels. The app requests no base64 or EXIF payload and deletes the temporary camera file on a best-effort basis after classification.
- Motion/steps: walking or exercise challenge verification through foreground motion and pedometer samples. The current build does not sync HealthKit history.
- Foreground location: outdoor movement challenge verification while the challenge is active.

Explicit exclusions:

- No continuous camera analysis or image classification.
- No continuous screen capture or screenshot analysis.
- No OCR.
- No background location tracking for protection.
- No HealthKit history sync or export in the current build.
- No challenge media upload in the current local-first build.
- No persistent challenge-photo library or gallery import.

## Required Release Evidence

iOS physical-device evidence must include:

- `ios.familyControlsEntitlementTeamId`
- `ios.familyControlsEntitlementArtifact`
- `ios.appGroupProvisioningProfileId`
- `ios.appGroupProvisioningArtifact`
- `ios.completeDataProtectionEntitlement=NSFileProtectionComplete`
- `ios.completeDataProtectionEntitlementArtifact`
- `ios.familyControlsAuthorizationRunId`
- `ios.familyControlsAuthorizationArtifact`
- `ios.familyActivityPickerRunId`
- `ios.familyActivityPickerArtifact`
- `ios.familyActivityPickerAppLimitScheduledImmediately=true`
- `ios.familyActivityPickerAppLimitActivityName=freed.selectedAppDailyLimit`
- `ios.familyActivityPickerAppLimitEventName=freed.selectedAppDailyLimitReached`
- `ios.selectedShieldTokensRunId`
- `ios.selectedShieldTokensArtifact`
- `ios.selectedAppDailyLimitReachedToday=true`
- `ios.selectedAppDailyLimitReachedDate`
- `ios.selectedAppDailyLimitRunId`
- `ios.selectedAppDailyLimitArtifact`
- `ios.managedSettingsFilterRunId`
- `ios.managedSettingsFilterArtifact`
- `ios.safariContentBlockerBuildRunId`
- `ios.safariContentBlockerReloadRunId`
- `ios.safariContentBlockerAdultBlockRunId`
- `ios.safariContentBlockerShortFormBlockRunId`
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

Optional DNS Settings evidence, if enabled for the release build, must prove the `dns-settings` entitlement/provisioning status, explicit matched domains, user-enabled DNS profile state, no packet tunnel/full VPN provider, and no full traffic proxying.

Do not promote iOS release evidence until the artifacts prove the App Review notes match the signed build and the actual physical-device behavior.
