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

## Review follow-up

The post-review implementation closes four gaps without changing Android production sources:

- Safari MV3 content code now sends only `{ host, rule }` to `background.js`. The background service worker independently allowlists the exact rule/host pairs, supplies the fixed native message type/source, and is the only JavaScript context that calls `sendNativeMessage`.
- Both the app-side shield application and the Device Activity monitor use the public Managed Settings category policy overloads with exact `except:` application/web-domain token sets. An earned app or domain unlock therefore remains excluded even when its enclosing category shield is active.
- The Safari Focus Shield target and manifest now require iOS/Safari 15.4, and `background.js` is included in the extension resources. The host app deployment target remains unchanged.
- The stale iOS NetworkExtension DNS Settings contract was removed from the TypeScript bridge, feed sync, setup UI, env/preflight/verifier checks, release audits, and current policy/store documentation. Android DNS Guard capability and entry-point assertions remain in the source-contract suite, and `git diff --name-only` reports no Android production file changes.

Review tests were written first. The new source contracts initially failed because `background.js`, MV3 background wiring, category `except:` policies, and DNS-retirement conditions were absent. During the subsequent full `npm run test:core` run, the review-specific Safari/exclusion and iOS-DNS-retirement tests passed, as did the updated release-env preflight test; the parent requested that the still-running suite be interrupted before completion, so this follow-up does not claim a fresh complete core-suite pass. No new full workspace build was started. Final handoff-only checks completed with `git diff --check` clean, no remaining active iOS DNS Settings method/env/check identifiers outside negative regression assertions, and no Android production paths in the diff.
