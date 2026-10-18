# FREED console and authentication closure

The current product is a digital wellbeing and recovery app. Productivity is the primary store category; mental and behavioral support, relaxation and recorded exercise are declared health features. Native enforcement, recovery and membership are separate authorities. A store setup checkbox is not feature execution evidence.

## Verified configuration

| Area | Verified state | Remaining work |
| --- | --- | --- |
| Firebase | Billing active; default Storage, App Attest, rules, TTL and indexes configured; 21 ACTIVE functions | Signed-client positive calls, ownership, backup, push and deletion execution |
| Offer metadata | Two owner-scoped endpoints deployed; connected Auth and App Check required; first acknowledgement immutable; 10/minute limits | Cross-device UI and signed-client proof; metadata grants no purchase or unlock authority |
| Review capability | Read-only owner-scoped `getReviewAccess` deployed with Auth/App Check and bounded14-day records; no client grant/renewal route | Fresh specific approval, real normal account/capability provisioning, signed-client proof and scoped store sharing; no account/license exists yet |
| iOS App Check client | Native startup/header/environment repaired and reviewed; five isolated native-config checks pass; existing App ID capability and main profile refreshed | Compile actual main startup, inspect signed production environment and prove physical client requests |
| Google Auth | Enabled; public client identifiers match native service configuration | Signed-device sign-in, cancellation, collision and linking |
| Email Auth | Enabled; default reset/verification templates and hosted action handler available | Actual delivery, verification, reset and interrupted-flow tests |
| Apple native Auth | Enabled; ID-token and nonce flow can use the existing native registration | Real-device sign-in/linking proof |
| Apple token revocation | OAuth code-flow configuration absent | Genuine Services ID and separate Sign in with Apple key, then Firebase configuration and deletion/revocation proof |
| Android link association | Inspected APK signing identities are Firebase-registered | Hosted Asset Links matches neither inspected APK signer; bind actual release/Play signer and verify cold/warm delivery |
| iOS link association | AASA contains the expected team and bundle | Signed-device cold/warm delivery |
| Apple subscriptions | Existing monthly/yearly SKUs share group level1 and ten localizations each; billing key/callbacks configured; sandbox signed TEST delivered | Annual review screenshot absent (`MISSING_METADATA`), replace stale monthly screenshot; Google verifier dependency, production TEST401, sandbox lifecycle and signed-client price/checkout evidence |
| Google subscriptions | Android Publisher API enabled; Play Console has no products | Approved FREED-only verifier access/key, billing-enabled signed package, monthly/yearly products and lifecycle proof |
| TestFlight | Build 2 validated and export compliance cleared, then expired because it predates privacy/UI corrections | New coordinated source freeze, signed build, processing and actual Internal availability |
| Play setup | 6/11 initial tasks complete as review drafts | Reviewer access, audience, rating, Data safety and current Store Listing |

The completed Play drafts are privacy policy, ads Yes, Productivity and public contact details, government app No, no financial services, and health features: mental/behavioral support, relaxation, and activity/fitness. No production publication or app-review submission was performed.

## Apple sign-in and deletion sequence

Native ID-token sign-in and authorization-code revocation have different requirements. Empty Services ID/key fields do not alone prove native Apple sign-in is broken. Firebase requires code-flow configuration for its authorization-code revocation API. The App Store billing key is not a Sign in with Apple key. [Firebase native configuration](https://firebase.google.com/docs/auth/cpp/apple), [iOS token revocation](https://firebase.google.com/docs/auth/ios/apple#token_revocation).

1. Restore the authenticated Apple Developer browser session; its separate login page is open for the owner.
2. Confirm primary Sign in with Apple App ID `app.freed.recovery` under team `R5RX8WP8ZC`.
3. Prepare a genuine associated Services ID and dedicated Sign in with Apple key. Domain: `freed-7d5ee.firebaseapp.com`. Return URL: `https://freed-7d5ee.firebaseapp.com/__/auth/handler`.
4. Obtain the specific approval required for the new credential/access action, then retain private custody outside the repository and configure Firebase's genuine `clientId`, allowed bundle, team, key ID and private key.
5. Exercise native sign-in, account collision/linking, fresh reauthentication, Apple token revocation and Firebase account deletion. A configured provider cannot close these scenarios without execution.

October5 authenticated Developer portal readback confirms FREED's Sign in with Apple capability is enabled as a primary App ID. The only existing SIWA key is associated with another app, and no FREED SIWA custody receipt exists; it must not be repurposed or revoked. No FREED Services ID appears in the current list. A dedicated FREED credential/Services ID configuration is being prepared before the specific security-access approval.

The dedicated Services ID `app.freed.recovery.auth` and key “FREED Firebase Sign In” are prepared at their Register screens. Specific approval for creation and FREED Firebase code-flow configuration is pending; neither was registered.

The App Check server registration does not replace native setup. Official Firebase guidance requires the App Attest environment `production`; its sandbox environment is not accepted. RNFirebase requires native provider registration before Firebase configuration and JavaScript initialization before backend use. The audit baseline lacked the native registration/header/environment, and its main distribution profile had no App Attest entitlement. The repair below preserves server enforcement and adds no simulator/debug-token bypass. The public App Store Connect capability API rejected `APP_ATTEST` as an unsupported enum without creating it, so the existing Developer portal was used. [Firebase App Attest setup](https://firebase.google.com/docs/app-check/ios/app-attest-provider), [RNFirebase setup](https://rnfirebase.io/app-check/usage).

Developer portal save/readback now confirms App Attest enabled on FREED only. The new main distribution profile `XS9BWQ68H5` uses the existing approved certificate and preserves Family Controls, Complete Protection and the app group. Its entitlement permits both development and production; the app's signed entitlement must choose production. Profile bytes are outside the repository and installed in Xcode's normal profile locations. Old profile files and all five extension profiles/private keys are preserved. No new private key was created. The first validator incorrectly expected a scalar profile value; inspecting the real allowed-value array corrected validation without another profile creation. [Profile receipt](artifacts/2026-10-05-console-closure/apple-app-attest-profile.json). Native startup/config source and signed positive client proof are still pending.

Native startup is now repaired and independently reviewed. A durable Expo config plugin registers the RNFirebase factory before the one guarded default Firebase configuration, exposes the ObjC class through the bridging header and declares production App Attest. Five checks pass, including actual isolated clean Expo55 prebuild and repeat regeneration preserving current Google/universal links and QA code. The installed RNFB25.1 plugin's duplicate initialization was reproduced and normalized. The archive gate now extracts the environment from actual signed-main entitlements and rejects missing/development/profile-array values. Three gate tests and selftest pass. An earlier gate receipt was superseded after independent review found the source no longer contained its check; the corrected hash is stable across sequential reruns. [Current source/test/review receipt](artifacts/2026-10-05-app-check-native-startup/receipt.json). Whole-app native compilation, signed artifact inspection and positive physical client App Check still require execution.

Actual unsigned Release iPhoneOS26.5 main-app compilation now succeeds with the reviewed startup/header/environment inputs. The native Mach-O and log are hash-bound. JavaScript bundling was skipped and the workspace still contains an older UI snapshot; this is native compilation only, not current UI, runtime, signed service or TestFlight proof. [Native compile receipt](artifacts/2026-10-05-app-check-native-startup/native-compile.json). Final source copy, signing and positive physical calls remain.

Apple subscription readback confirms `freed_premium_monthly` (`6816653511`) is Ready to Submit, with existing US billing price USD9.99, and `freed_premium_yearly` (`6816643239`) is Missing Metadata, with existing US annual price USD39.99. Prices were preserved; these administrative values are not StoreKit device-price proof. Both have ten expected language localizations and group level1. Both review notes now reflect required real-account entry, verified checkout readiness, optional rewarded access and ad-free basic Help; the obsolete guest-checkout wording is removed. Annual lacks a review screenshot; monthly has an older Complete screenshot. Capture the current native paywall after the UI source freeze and provide accurate replacement evidence for both. No subscription was submitted for review.

## Email and hosting boundaries

Default Firebase reset and verification do not require custom-domain DNS setup. The canonical hosting callback exists. `freed-landing` belongs to the same project, but its domain is not authorized for Auth and `/auth/callback` there returns 404; do not silently repoint the current callback. Email-link sign-in stays gated until the correct signed Android association and cold/warm device delivery are verified. Its readiness marker is `deployed-and-verified`, not a generic boolean.

## Reviewer access and audience

Google's current form explicitly requires access to restricted functionality and says reviewers cannot create accounts, make purchases or use trials. FREED's new required-login flow therefore needs a dedicated legitimate reusable review account and truthful access instructions. Do not substitute a personal account, fake a verified purchase, or mark the app unrestricted. No review credential artifact is currently known.

The published terms currently allow 13+, while the launch packet targets adults. Audience preference has been requested; no audience declaration or public age-term change has been made. The audience form is also blocked by incomplete reviewer sign-in details. [Google reviewer access guidance](https://support.google.com/googleplay/android-developer/answer/9859455#app_access).

## Release sequence

1. Finish the UI-owned setup/login/catalogue/reset flow and integrate the explicit native guard/schedule contract.
2. Close the credential, reviewer, signer and privacy gaps using the actual final configuration.
3. Build from an agreed source snapshot, with private signing material outside the repository and binaries in ignored durable workspace storage.
4. Capture the current native screens, upload accepted screenshot sizes and the new signed internal builds, and verify processing and installability.
5. Execute physical filtering, normal browsing, permission loss, network changes, reboot, native expiry, sensors, store sandbox, backup and account scenarios. Keep failed or blocked checks visible.

Cloudflare Families requires device resolver configuration, not a website zone. DNS cannot launch FREED or separate Shorts/Reels HTTPS paths. Public native Shorts/Reels remains off on both platforms; supported whole-app shielding and independently reviewed browser behavior must be described accurately. [Cloudflare setup](https://developers.cloudflare.com/1.1.1.1/setup/).

Android's unfiltered ordinary upstream defaults were corrected to Families `.3`, with ordinary Cloudflare `.1` interception preserved. The focused actual-source routing/privacy/health checks and independent scoped review pass. The encrypted Families resolver was already correct. Network fallback establishes local-feed coverage only, and captive pause remains visible. Current live DNS/device enforcement tests remain pending; no Cloudflare dashboard zone was added.

A bounded wire-format DoH check from the development Mac passed for two public test domains: Families returned `0.0.0.0` for Cloudflare's safe `nudity.testcategory.com` test and normal nonzero IPv4 answers for `example.com`, both HTTP200 with normal TLS/hostname verification. This establishes public resolver availability and expected test categorization from that Mac only; it does not test FREED's VPN, native configuration, a phone, bypasses or app navigation. [Resolver receipt](artifacts/2026-10-05-console-closure/cloudflare-families-resolver.json).

Apple category readback now matches the approved positioning: primary Productivity, secondary Health and Fitness. Two erroneous rating fields were corrected to health/wellness topics Yes and loot boxes No; all other content answers and age overrides remain for the final audience/content review.

Actual Release device-SDK builds of the protection library and DeviceActivity extension pass. Native source bytes match the scoped review; CocoaPods-generated snapshot project paths are bound separately. These are unsigned components, not an installable app or proof of physical enforcement. Final caller/UI source and signed builds remain pending.
