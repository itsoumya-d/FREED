# Task 4 — iOS safe shield handoff and scoped unlock

## Outcome

Implemented an App Store-safe iOS Screen Time recovery handoff and Safari Focus Shield. A blocked Screen Time surface now publishes one atomic, privacy-safe pending-intervention record in the shared App Group and raises a generic local notification. The app consumes that record and can grant an earned unlock only for the exact challenged application, web domain, or category token. Unrelated shields and adult-domain filtering remain active.

Safari short-form surfaces are handled by a Safari Web Extension rather than a static Content Blocker redirect. The extension recognizes only approved YouTube Shorts, Instagram Reels, and TikTok For You routes, handles client-side navigation, replaces the page with an accessible recovery surface, sends a validated host/rule pair to the native extension handler, and opens the app through the explicit `https://intervention.freed.app/intervention` Universal Link. The bundled Content Blocker remains limited to adult-domain blocking.

## Implementation details

- `FREEDShieldAction` encodes FamilyControls tokens into an opaque scope and atomically writes the complete pending record under `freed.pendingIntervention.record` before scheduling a generic notification.
- `FreedProtectionModule` validates and sanitizes pending scope data, retains the scope across pending-record acknowledgement, fails closed without a valid Screen Time scope, and applies/ends/risk-revokes an unlock without dropping unrelated shields.
- `FREEDDeviceActivityMonitor` restores scoped shields at interval end and preserves unrelated application, category, and web-domain selections during an active scoped unlock.
- `FREEDShieldConfiguration` distinguishes category-wide recovery from single app/domain recovery in the shield copy.
- `FREEDSafariFocusShield` contains an MV3 manifest with exact host access, a client-side route observer and accessible overlay, and a native handler that accepts only explicit host/rule mappings. It requests no broad web access, Network Extension capability, ad/rewarded-video behavior, or private API.
- The host app entitlement includes `applinks:intervention.freed.app`, and the Safari extension target is embedded in the Xcode project.
- The TypeScript bridge sanitizes native pending scope before returning it to JavaScript.

## TDD and verification evidence

The source-contract test was added first. The first `npm run test:core` run failed at the new contract because the Safari Focus Shield files did not yet exist (`false !== true`), establishing the red phase.

Final focused verification:

- `npm run test:core` — pass.
- `npm run typecheck` — pass.
- iOS Simulator SDK `swiftc -typecheck -warnings-as-errors` — pass for `ShieldActionExtension.swift`, `ShieldConfigurationExtension.swift`, `DeviceActivityMonitorExtension.swift`, and `SafariWebExtensionHandler.swift`.
- `plutil -lint` — pass for the Xcode project, app/extension property lists, and entitlements.
- Safari extension `manifest.json` JSON parse — pass.
- `git diff --check` — pass.

## Full iOS build note

The first workspace build exposed missing generated CocoaPods support files (`Pods-FREED.debug.xcconfig` / `Pods/Manifest.lock`). `pod install` generated and synchronized those files, but the CocoaPods processes did not exit normally. A subsequent full `xcodebuild` workspace attempt produced no diagnostic output and was stopped after a bounded wait of roughly two minutes, so a successful full app build is **not claimed**. No Hermes-specific compiler or linker failure was observed; CocoaPods did temporarily rewrite the Hermes checksum and an unrelated content-blocker plist key, and both incidental edits were removed from this change.

## Release follow-up

Before device/App Store validation, serve a matching AASA file for `intervention.freed.app`, provision the associated-domain entitlement and extension App Group for the distribution team, enable the Safari extension, and validate notification-denied as well as notification-allowed recovery on a physical FamilyControls-capable device. The shared pending record remains the recovery source of truth when notification delivery is unavailable.
