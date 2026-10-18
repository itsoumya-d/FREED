# T006 — Native capability requirement matrix (Scout, read-only)

Gathered by reading the real native surface, not the product copy. Sources actually read:
`android/app/src/main/AndroidManifest.xml`,
`modules/freed-protection/android/src/main/AndroidManifest.xml`, the Kotlin files in
`modules/freed-protection/android/src/main/java/app/freed/protection/` (module is 2014 lines),
`modules/freed-protection/ios/FreedProtectionModule.swift` (1933 lines), the five extension
`Info.plist` + `.entitlements` pairs under `ios/`, the `PBXNativeTarget` list in
`ios/FREED.xcodeproj/project.pbxproj`, `modules/freed-protection/src/index.ts`,
`android/build.gradle`, `android/app/build.gradle`, and
`src/lib/{protection-capabilities,purchase-verification,monetization,recovery-reminders}.ts`.

Verdict vocabulary: **declared-real** = permission/API/OS-floor present in the build and the
implementation calls the real framework, with no app-level stand-in found; **degraded** = real
but weaker than the product copy implies; **broken** = a required piece is missing or wrong;
**blocked-external** = cannot be proven or completed from this machine, needs the named
external artifact. Rows only a running device can settle say **"runtime proof owed → T007"**,
because an emulator and iOS simulators are reachable here, so `unproven` is not an honest
final verdict.

## Matrix

| Capability | Platform | API / framework | Permission or entitlement, where declared | OS floor | Enforcement layer | Degradation when denied / unavailable | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App & website restrictions ("Screen Time"-class blocking) | iOS | `FamilyControls` + `ManagedSettings` (`ManagedSettingsStore` :56, shield calls :203-315), `AuthorizationCenter.shared.requestAuthorization(for: .individual)` :173 | `com.apple.developer.family-controls = true` in `ios/FREED/FREED.entitlements` and again in the DeviceActivityMonitor, ShieldConfiguration and ShieldAction entitlements | `IPHONEOS_DEPLOYMENT_TARGET = 15.1` (pbxproj :892); code gates `#available(iOS 15.0)` ×16, `16.0` ×4 | **OS-level** system-and-content filter via ManagedSettings | `#if canImport(ManagedSettings)` else-branch returns `"ManagedSettings web filtering is unavailable in this build."` :229/:315 and the capability flags report false | declared-real; runtime proof owed → T007. **blocked-external for store publish:** Family Controls needs an Apple-approved entitlement request |
| App time limits / usage events | iOS | `DeviceActivityCenter().startMonitoring/stopMonitoring` with named `appLimit`/`riskWindow`/`earnedUnlock` activities :354-437; `FamilyActivitySelection` persisted into the shared app group; `FamilyActivityPicker` presented | Same entitlement + extension point `com.apple.deviceactivity.monitor-extension` | iOS 15 | **OS-level** (monitor extension wakes on schedule events) | `startMonitoring` is wrapped in `try`; status reports `scheduled`/`appLimitScheduled` false so the UI can state "not active" | declared-real; runtime proof owed → T007 |
| Shield message on a blocked app | iOS | `ShieldConfigurationExtension`, `ShieldActionExtension` | points `com.apple.ManagedSettingsUI.shield-configuration-service`, `com.apple.ManagedSettings.shield-action-service` | iOS 15 | **OS-level** (the extension supplies message + action URL) | Generic shield if the extension is not enabled | declared-real |
| Safari content blocking (adult domains) | iOS | `SFContentBlockerManager.reloadContentBlocker` :1489, `getStateOfContentBlocker` :1516; rules from the shared app group with bundled `blockerList.json` fallback | point `com.apple.Safari.content-blocker`; app-group `group.app.freed.recovery` on both sides | iOS 15 | **OS-level while the user leaves the extension on** | State is polled, so the app can tell the truth when the extension is off instead of pretending | declared-real; the "extension disabled" path needs runtime proof → T007 |
| Short-form feed shield + challenge handoff (Shorts / Reels / TikTok) | iOS | MV3 Safari web extension (`SafariWebExtensionHandler`), native relay to `app.freed.recovery`, Universal Link `https://intervention.freed.app/intervention` | point `com.apple.Safari.web-extension`; `applinks:intervention.freed.app` in `ios/FREED/FREED.entitlements`; host permission and allowed-domain list asserted by `scripts/lib/ios-safari-focus-shield-contract.js:13,22` and re-checked by `scripts/build-ios-release-archive.js:1307` | iOS 15.4 (MV3, per `docs/research-and-architecture.md:150`) | OS-level block, but the handoff needs a live public host | none implemented: if the link does not resolve the shield still blocks the surface and the user has **no route to the recovery challenge** | **broken (integration)**. Measured: `curl https://intervention.freed.app/.well-known/apple-app-site-association` → `000`; `host intervention.freed.app` → `NXDOMAIN`; independent Google DNS `https://dns.google/resolve?name=intervention.freed.app&type=A` → `Status: 3` with SOA authority `freed.app.` at registrar-servers.com, so the parent domain **is** registered and delegated and only this subdomain is unconfigured. Control taken in the same minute: `https://freed-7d5ee.firebaseapp.com/.well-known/apple-app-site-association` → **200**, proving egress and TLS work here. Repair = publish the DNS record and host `apple-app-site-association` (**blocked-external**: needs DNS/hosting access) |
| Deep links / Universal Links | iOS + Android | Expo `Linking` + Firebase auth continue link | `applinks:intervention.freed.app`, `applinks:freed-7d5ee.firebaseapp.com`; Android `MainActivity` filters for `freed://`, `app.freed.recovery://` and autoVerify https on `freed-7d5ee.firebaseapp.com/__/auth/links` | iOS 15 / Android 12 for verified links | OS-level | custom-scheme fallback (`freed://`) keeps in-app links alive when verification fails | half broken: the Firebase half is live (200), the intervention half is the NXDOMAIN row above, and **no Android `autoVerify` filter exists for `intervention.freed.app`**, so the same handoff is undeclared on Android too |
| Push / remote notifications | both | `expo-notifications` ~55.0.x | iOS `aps-environment` in `FREED.entitlements` (observed value **`development`**); Android `NotificationsService` receiver with `BOOT_COMPLETED` in the app manifest | iOS 15 / Android 12 | OS-level | token registration fails closed and the app keeps local reminders | degraded, and **blocked-external** for distribution: `aps-environment = development` cannot deliver on TestFlight/App Store builds; needs the distribution profile + APNs key as a receipt |
| Local recovery reminders | both | `expo-notifications` `SchedulableTriggerInputTypes.DAILY` with `channelId`, channel created at `src/lib/recovery-reminders.ts:244` | Android channel `REMINDER_CHANNEL_ID`; **no `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` permission anywhere in the repo** (grep for `SCHEDULE_EXACT_ALARM`, `setExactAndAllowWhileIdle`, `useAlarmClock` returns nothing) | iOS 15 / Android 12 | OS-level, **inexact** on Android 12+ | reminders can land minutes late under battery optimisation; nothing in the UI says so | degraded (documented): either declare and request exact alarms or state "around this time" in the copy. Runtime proof of drift → T007 |
| Usage statistics (which apps, how long) | Android | `UsageEvents`/`queryUsageStats` + `usageStatsTodayMinutes(...)` reporting, dedicated `FreedUsageAccessConfigActivity` with `USAGE_ACCESS_CONFIG` action and `USAGE_ACCESS_REASON` metadata, plus a `Settings.ACTION_USAGE_ACCESS_SETTINGS` fallback intent | `PACKAGE_USAGE_STATS` signature\|installation in the module manifest with `tools:ignore="ProtectedPermissions"`; module gradle sets `namespace 'app.freed.protection'` and `compileSdk = 36` | module declares no minSdk (module gradle sets only `namespace`/`compileSdk`, and the app takes `minSdkVersion rootProject.ext.minSdkVersion` :171, i.e. the Expo SDK default); the app manifest pins `versionCode 2`, `versionName "0.1.0"` | **observation only** — reading usage stats blocks nothing on Android | app asks via the dedicated config activity; when absent, surfaces report unavailable rather than zero | declared-real; note **the Android OS floor is nowhere declared explicitly** in the repo (the charter asks for an explicit floor) → gap G2 |
| Android Focus Shield (blocking a launch) | Android | `FreedAccessibilityService` (window-state changed events, `resolveBlockingTarget`, `shouldReportFocus`, `buildInterventionIntent` starting `FreedInterventionActivity` with `FLAG_ACTIVITY_NEW_TASK`, `noHistory`, `excludeFromRecents`), allowlist `SUPPORTED_BLOCKED_APP_PACKAGES`, plus `FreedShieldsStateStore` and `FreedDnsGuardStore` in `MODE_BLOCK` | `BIND_ACCESSIBILITY_SERVICE` on the service, `android:canRetrieveWindowContent="true"`, `android:isAccessibilityTool="false"`, `notificationTimeout=250`, `FLAG_HAS_CAPABILITY_DISABLE` on the service and `FLAG_DISABLE_IN_ACCESSIBILITY_PERMISSION_SCREEN` on the settings activity | module-manifest values as listed; runtime floor = app minSdk (Expo default) | **semi-enforcement, not OS-level**: FREED reacts to window changes and raises its own activity; no `performGlobalAction` and no OS-level launch prevention, so Home/recents/second-user paths are not covered by the platform | if the service is off, `getProtectionCapabilities` reports the degraded shape at `src/lib/protection-capabilities.ts:174` and the UI must say blocking is inactive | declared-real as a mechanism; the strength claim needs runtime proof → T007. **blocked-external for store publish:** Play requires an accessibility-service use-case declaration and justification |
| Android DNS-only content filter | Android | `FreedVpnService extends ReactNativeModulePackage/VpnService` documented in-code as a "DNS-only Android VPN service that filters DNS responses for adult content domains" | `BIND_VPN_SERVICE` on the service, `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_SPECIAL_USE`, `foregroundServiceType="specialUse"` with `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` = "DNS-only adult content filtering VPN for user-consented app blocking", `RECEIVE_BOOT_COMPLETED` + `MY_PACKAGE_REPLACED` receivers for boot autostart | as declared | **OS-level** for DNS responses it sees; it does not filter HTTPS content beyond the resolved host | user can decline the VPN consent dialog; `autostartEnabled()` reports the persisted intent rather than claiming enforcement | declared-real; runtime proof owed → T007. **blocked-external for store publish:** Play's special-use foreground-service-type justification must be filed |
| Purchases / premium entitlement | both | `expo-iap ^3.4.4`; receipts verified **server-side** in `src/lib/purchase-verification.ts` against Apple's real endpoints (`https://api.storekit.itunes.apple.com/in/note/transactions`, sandbox variant `https://api.storekit-sandbox.itunes.apple.com` :408) and Google Play (`https://androidpublisher.googleapis.com/androidpublisher/v3/...:verify` :467-468) using an OAuth service-account flow with scope `https://www.googleapis.com/auth/androidpublisher` (:255-269) | iOS: `com.apple.developer.applesignin` (Default) already present in the app entitlements; Android: no billing permission needed for Play Billing, but the service-account key must exist at runtime | iOS 15 / Expo default minSdk | server-side verification, so a client-side store cannot fake entitlement | verification failure must fall back to "not premium"; that path needs runtime proof → T007 | declared-real. **blocked-external:** three product ids are hardcoded in `src/lib/monetization.ts:121,130,139` (`freed_premium_yearly`, `freed_premium_monthly`, `freed_premium_lifetime`) and **no `.storekit` configuration file exists anywhere in the repo** (`find . -name '*.storekit'` → empty), so purchases cannot be tested locally at all; needs App Store Connect products + a StoreKit test config, and Play Console products + service-account JSON, as receipts |
| Rewarded / interstitial ads | both | `react-native-google-mobile-ads ^16.3.3` | Android manifest meta-data `com.google.android.gms.ads.APPLICATION_ID` = `${freedGoogleMobileAdsAndroidAppId}` resolved by `android/app/build.gradle:178` as `admobAndroidAppId ?: debugAdmobAndroidAppId`, where the fallback is Google's **official sample/test app id** `ca-app-pub-3940256099942544~3347511713` (`android/build.gradle:13-21`) plus a `freedGoogleMobileAdsUsesLocalTestAppId` flag; `com.google.android.gms.permission.AD_ID` is explicitly removed (`tools:node="remove"`) | iOS 15 / Expo default minSdk | SDK-level | build never breaks on a missing id because of the test-app-id fallback, and `src/lib/monetization.ts:344` recognises the test prefix | declared-real and correctly test-only, so it satisfies the "test/mock ids allowed" constraint; **but D7 is not met**: `grep -rn 'TODO(AD-SDK)' src modules ios android` returns **0** markers, so no ad surface is findably pending |
| Biometric / device-owner lock | both | **none** | no `expo-local-authentication`, `LocalAuthentication`, `BiometricPrompt`, `USE_BIOMETRIC` or `USE_FINGERPRINT` anywhere (grep across `src`, `modules`, `ios`, `android` returns nothing) | n/a | n/a | n/a | capability **does not exist**. Any copy implying biometric protection is a false claim; T007 must check the protection screens' wording against this row |
| Data-protection and privacy declarations | both | iOS `com.apple.developer.default-data-protection = NSFileProtectionComplete` on the app and every extension; app-group `group.app.freed.recovery` shared by the app, content blocker, focus shield and shield extensions; Android `android:allowBackup="false"`, `android:dataExtractionRules`, and `firebaseAnalyticsCollectionEnabled` / `firebaseCrashlyticsCollectionEnabled` / `adIdPersistenceEnabled` / `adsMarketingReasonsEnabled` all false, plus AD_ID removed | as listed | iOS 15 | OS-level at-rest protection; Android backup transport disabled | n/a | declared-real; the privacy manifest and Data-safety form alignment is a separate external receipt |

## Gaps worth a slice

- **G1 (broken, integration):** the iOS Safari Focus Shield handoff Universal Link host `intervention.freed.app` does not resolve, while the shield contract and the release-archive builder both *require* that domain. A blocked user has no working escape into the recovery challenge. Owner: DNS + `apple-app-site-association` hosting (external); the in-repo half is adding the Android `autoVerify` filter for the same host.
- **G2 (gap, declared):** no explicit Android OS floor. `minSdkVersion` comes only from `rootProject.ext.minSdkVersion` (Expo default) and `targetSdk/compileSdk = 36`; iOS has `15.1` in the pbxproj but `app.json` declares no `deploymentTarget`. The charter asks for an explicit floor per platform.
- **G3 (gap, D7):** zero `TODO(AD-SDK)` markers despite four ad-backed surfaces.
- **G4 (degraded):** Android reminders run on an inexact daily trigger with no exact-alarm permission; the copy must not promise an exact minute.
- **G5 (degraded):** Android enforcement is accessibility-reactive, not OS-level; the copy must not claim blocked apps cannot be opened.

## Blocked-with-receipt (external artifacts, named exactly)

| Need | Why it blocks | Artifact required from the owner |
| --- | --- | --- |
| Apple Family Controls entitlement approval | `com.apple.developer.family-controls` is requested by four targets; Apple grants it only on an approved entitlement request, so no archive can be uploaded for review without it | Screenshot/ID of the approved entitlement request for App ID `app.freed.recovery`, plus the matching provisioning profiles |
| Distribution push | `aps-environment` is `development`; TestFlight/App Store builds cannot receive notifications | APNs key (`.p8`) + the App Store/Ad Hoc provisioning profile, or confirmation that EAS manages the key |
| `intervention.freed.app` | NXDOMAIN; the shield handoff and the iOS associated-domain contract both depend on it | DNS record + hosted `/.well-known/apple-app-site-association` with team/bundle IDs for `app.freed.recovery` |
| Store products | three product ids are referenced with no `.storekit` config and no Play products | App Store Connect product list + a StoreKit test configuration file; Play Console products + service-account JSON readable by `purchase-verification.ts` |
| Play Console declarations | accessibility service, usage-access and special-use foreground service are all policy-reviewed | the filled Play Console declarations (accessibility use case, usage-access justification, special-use FGS justification) and the Data safety form answers |

## Spawned tasks

- **T009** — Worker: close G3 by giving every ad-backed surface a findable `TODO(AD-SDK)`
  marker with its real test unit id, so D7 can be graded honestly. No external dependency.
- **T007** — Scout (already queued): the runtime half of this matrix. G1/G2 and the
  "runtime proof owed → T007" rows in the table above are exactly its checklist; it must
  reproduce each native row on the emulator/simulator or state which single external artifact
  blocks the row.

## Device reachability (commands run for this receipt, real output)

| Command | Real output | What it proves |
| --- | --- | --- |
| `adb devices` | `adb: command not found` on PATH; `/Users/soumyadebnath16/Library/Android/sdk/platform-tools/adb devices` → `* daemon started successfully` / `List of devices attached` (empty) | Android toolchain present at a known absolute path, **no device or emulator currently attached** |
| `~/Library/Android/sdk/emulator/emulator -list-avds` | `PrimerAuditApi36` | one bootable API-36 AVD exists → Android rows are **provable here** once T007 boots it |
| `xcrun simctl list devices booted` | `-- iOS 18.2 --`, `-- iOS 18.5 --`, `-- iOS 26.5 --` with no entries | nothing currently booted |
| `xcrun simctl list devices available` | `iPhone 16 Pro (380E0D11-…) (Shutdown)`, `iPhone 16 Pro Max`, `iPhone 16`, `iPhone 16 Plus`, `iPhone SE (3rd gen)` | iOS app-level rows are **provable here** |
| `xcrun simctl list runtimes` | `iOS 18.2 (22C150)`, `iOS 18.5 (22F77)`, `iOS 26.5 (23F73)` | runtimes above the 15.1 floor are installed |
| `xcodebuild -version` | `Xcode 26.5 / Build version 17F42` | archives and extension builds can be attempted here |
| `java -version` | `java version "23.0.1"` | Gradle/AGP can run here |

**The device-availability receipt this board needed:** iOS **Family Controls / Device Activity /
ManagedSettings enforcement cannot be proven on any simulator** — shield extensions and
usage-capability authorization are device-only and the four targets need an Apple-approved
family-controls entitlement in the provisioning profile, which this machine does not hold. So
the iOS shield rows land as `blocked-external` naming exactly that artifact (plus a physical
device on iOS 15.1+), which is the only `unproven`-class verdict this board is allowed to book.
Everything else — Android Focus Shield, DNS guard, usage access, notifications, reminders, and
all iOS app-level screens — is provable here and must not be left unproven.

## Per-platform verdict list

Static verdicts below are backed by the declarations cited in the matrix. `→ T007` means the
runtime half is owed by T007 on the API-36 AVD or an iPhone 16 Pro sim; `blocked-external` rows
name their artifact in the table above. Features with no native capability inherit T001's wiring
status on both platforms (they are listed for completeness, not re-adjudicated here).

| Feature (T001 row) | Android verdict | iOS verdict |
| --- | --- | --- |
| Root layout/router, index route, in-app screen state machine, legal/utility routes | working (JS layer; → T007) | working (JS layer; → T007) |
| Splash, Welcome, Quiz, Paywall | working; → T007 | working; → T007 |
| Protection setup wizard | **degraded by design and provable**: real grant flows exist (`FreedUsageAccessConfigActivity`, accessibility settings, VPN consent); → T007 must confirm each grant is honoured | **broken for the handoff half** (G1 NXDOMAIN link) and otherwise declared-real; grant flow = `AuthorizationCenter` + Safari extension toggle |
| Home dashboard, Panic / urge intercept entry, Intercept screen, Breathing exercise | working; → T007 | working; → T007 |
| Recovery challenge, Challenge verification, Custom challenge | working; → T007 | degraded: the only route from an OS shield into the challenge is the G1 dead link |
| Daily check-in, Private slip log | working (T005 shows the streak math is broken — same on both platforms) | same |
| CLARA coach chat, Analytics dashboard, Urge-risk forecast, Opt-in aggregate sharing, Monthly growth report | working; → T007 | working; → T007 |
| Library, Article reader | working; → T007 | working; → T007 |
| Plan model & capabilities | working | working |
| Purchase verification, Restore purchase | degraded here: cannot be exercised without Play Console products + service-account key (blocked-external) | degraded: no `.storekit` config exists, so nothing is purchasable locally (blocked-external) |
| Native protection bridge | declared-real, → T007 | declared-real, → T007 |
| iOS Screen Time shield | **does not exist on Android by platform law** (see policy list) | declared-real, `blocked-external` for device proof (entitlement + physical device) |
| Adult-domain feed sync | declared-real via `FreedVpnService` DNS filter + `FreedDnsGuardStore`; → T007 | declared-real via content blocker + focus shield; blocker-list reload → T007 on sim, shield enforcement blocked-external |
| Community features | stubbed / fail-closed by design (T001) | same |
| Local reminders | **degraded**: inexact daily alarm, no exact-alarm permission (G4); → T007 measures drift | working (calendar trigger is reliable on iOS); → T007 |
| Remote push dispatch | degraded until a real sender + keys exist; receiver wiring is real | **broken for distribution**: `aps-environment = development`; blocked-external |
| Rewarded reset ad (the only ad surface) | declared-real with Google's sample app id; **D7 gap G3** (no `TODO(AD-SDK)` marker) | same |
| Encrypted backup export/import, Hosted sync, Firebase email-link sign-in, Account deletion | working; the email-link host's AASA answers 200 → T007 | working; `applinks:freed-7d5ee.firebaseapp.com` present and the AASA resolves |
| Biometric lock (not a feature today) | code absent | code absent |

## Four-state classification (as the card required)

- **Code absent:** biometric/device-owner lock (no dependency, no API call anywhere); interstitial /
  banner / native ad surfaces (only the rewarded reset ad exists — T001 already recorded this);
  Android equivalent of the iOS Screen Time shield (see policy list); exact-alarm permission;
  StoreKit test configuration file; `apple-app-site-association` hosting for the intervention host.
- **Code present, permission not granted at rest:** every Android grant is user-issued at runtime
  (usage access, accessibility bind, VPN consent, notification POST_NOTIFICATIONS) — the manifests
  declare them and the app detects their absence, which is the correct shape; the same is true on
  iOS for `AuthorizationCenter` and the two Safari extension toggles. None of these is a code defect.
- **Blocked by platform policy (needs a product decision or a filing, not a code fix):**
  1. iOS has no API that lets a third-party app prevent an app launch outside Family Controls, and
     Apple restricts `com.apple.developer.family-controls` to apps whose primary purpose is
     parental controls / screen time — FREED must either own that framing in its App Store
     metadata or accept weaker iOS enforcement. Product decision required.
  2. Android has no iOS-style OS-enforced app shield. Accessibility-based blocking is policy-reviewed
     (Play requires a declared use case and `isAccessibilityTool` truthfulness — the repo honestly
     sets `false`), and overlays/`SYSTEM_ALERT_WINDOW` were deliberately not used. So Android
     enforcement is inherently semi-enforcement; the copy must say so. Product decision required.
  3. iOS blocks third-party DNS/VPN filtering for content purposes without a special-entitlement
     justification; the iOS side therefore leans on ManagedSettings web policy + Safari content
     blocker, which cannot filter in-app browsers of other apps. Accept as platform limit.
  4. Simulators cannot host Family Controls authorization or shield extensions → device-only proof.
- **Unverified for lack of a device (with the receipt above):** only the iOS Family Controls /
  Device Activity / ManagedSettings enforcement rows.

## Candidate blocked tasks, each naming the exact missing requirement

1. **T009 (created):** every ad surface needs a `TODO(AD-SDK)` marker + its test unit id. Missing
   requirement: none external — the marker contract itself (D7) is unmet (0 markers).
2. **T010-style external task for the owner (not created here, no repo file can fix it):** publish
   DNS + `/.well-known/apple-app-site-association` for `intervention.freed.app` for App ID
   `app.freed.recovery`; the in-repo follow-on (add the Android `autoVerify` filter for that host in
   `android/app/src/main/AndroidManifest.xml`) belongs to a later Worker slice once DNS exists.
3. **Owner task:** Apple Family Controls entitlement request + physical iOS 15.1+ device for shield
   proof; distribution APNs key/profile to replace `aps-environment = development`.
4. **Owner task:** App Store Connect + Play Console products for `freed_premium_yearly|monthly|lifetime`
   plus a committed `.storekit` test config and a readable service-account key.
5. **G2 (small Worker slice, safe now):** pin explicit OS floors — add `expo.ios.deploymentTarget`
   (or leave pbxproj as the single source and document it) and pin `android.minSdkVersion` in
   `app.json`/`android/gradle.properties` so the floor is stated rather than inherited from Expo.
