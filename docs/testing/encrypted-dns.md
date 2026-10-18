# Optional encrypted DNS

FREED has an opt-in Cloudflare Families DNS-over-HTTPS configuration at `https://family.cloudflare-dns.com/dns-query`. Both build flags and the saved user choice default off. Release capability remains disabled until signed iOS provisioning and physical Android/iOS network evidence are reviewed. The local test results below do not establish device coverage.

## Build configuration

Register `./modules/freed-protection/app.plugin.js` in Expo's plugin array with `{ releaseEnabled: false, devPreview: false }`. An explicit `devPreview: true` enables the native preview only in an iOS Debug or debuggable Android build. It still reports `releaseEnabled: false` and must be labeled unverified. A Release/TestFlight build does not inherit preview permission.

The plugin adds `dns-settings` to `com.apple.developer.networking.networkextension` only when a build flag is enabled. It preserves unrelated Network Extension entitlement values. With both flags off, it removes the DNS entitlement and writes false capability flags to the iOS Info.plist and Android application metadata. Apple signing/provisioning must authorize the entitlement for a physical iOS preview; adding the plist/entitlement source is not evidence that signing permits it. Regenerate native configuration before building when flags change.

## Bridge contract

`getEncryptedDnsStatus(): Promise<EncryptedDnsStatus>` reloads native state. `configureEncryptedDns({ enabled: boolean, provider: 'cloudflare-families' }): Promise<EncryptedDnsStatus>` saves or removes the explicit choice. No other provider or arbitrary URL is accepted.

| Field | Meaning |
| --- | --- |
| `supported` | This platform and build permit the implementation; operation/permission errors remain separately reported. Simulator iOS and builds with both flags off return false. |
| `releaseEnabled` | The native release flag is enabled. A user preference or JavaScript flag cannot enable it. |
| `configured` | iOS: the app-owned Families DNS profile exists on the latest successful read; after a failed/gated read, the last saved state is retained with an error/gate reason. Android: the user has saved the encrypted upstream choice. This is not coverage. |
| `enabled` | iOS: the saved profile matches the provider and `NEDNSSettingsManager.isEnabled` is true after reloading. Android: opted in, build allowed, running tunnel, no VPN/Private DNS/captive conflict. This is not a traffic-health claim. |
| `healthy` | Always null on iOS. Android: the last validated DoH reply succeeded/failed within 60 seconds; otherwise null. It does not verify every app's DNS path. |
| `reason` | Stable reason code, or null. Examples: `encrypted-dns-release-gated`, `ios-dns-settings-enable-required`, `ios-dns-preferences-save-failed`, `android-vpn-consent-required`, `android-other-vpn-active`, `android-encrypted-dns-resolver-failed`. |
| `provider` | Always `cloudflare-families`. |
| `requiresSettings` | A saved configuration needs OS enablement or conflict/consent recovery. |

The shared presentation model keeps an enabled iOS profile and any enabled development preview in `unverified`. It reserves `active` for enabled, healthy, release-enabled status. Old native binaries, Expo Go/web, missing methods, and malformed native responses cannot report encryption as enabled. A failed status read reports `native-status-check-failed`; a timed-out read does not establish that a previously enabled OS profile has been removed.

## Native behavior and limits

iOS uses `NEDNSSettingsManager`, `NEDNSOverHTTPSSettings`, the fixed Families URL, and explicit bootstrap server addresses. Saving is separate from enablement: the person must select the configuration in Settings. Refresh status after returning from Settings. Disabling removes only this app's DNS configuration. Operations load the preferences before changes and reload after saving/removing. Concurrent operations return an in-progress reason. Health remains unknown because the manager has no resolver/traffic health API. iOS 26+ explicitly sets `allowFailover = false`; older supported systems use their encrypted DNS settings behavior without an app-added plaintext fallback. VPNs, managed settings, app-owned resolvers, and OS policy can affect actual usage, so an enabled profile is not proof of comprehensive filtering.

Android reuses the existing IPv4 UDP DNS-only `VpnService`. Captured, locally allowed queries use HTTPS DNS wireformat with normal certificate-chain/hostname verification. OkHttp sockets are protected before connecting; refusal closes the socket. Literal Families IP bootstrap avoids querying the provider hostname through the VPN. Redirects, proxies, and connection retry are disabled. Response size, MIME type, transaction ID, response flags, question echo, and successful/NXDOMAIN response codes are validated. An encrypted resolver error produces local DNS SERVFAIL, without entering the plaintext resolver race or network-DNS fallback. UDP sends are synchronized with the encrypted opt-in so already-queued plaintext work cannot send after the preference is saved. Disabling encryption intentionally restores the existing guard's transport choice.

Private DNS in strict/opportunistic/unknown state remains a conflict and is never changed by FREED. Another active or other always-on VPN is not replaced by `configureEncryptedDns`; the choice stays saved with a conflict status. When VPN approval is pending, use the existing `applyAdultContentFilter` approval flow, then refresh status. DoH is not a full-traffic VPN: apps' own HTTPS/TLS DNS, custom resolver routes, and IPv6 DNS can bypass this existing service's coverage. The current Android literal bootstrap uses IPv4, so IPv6-only/NAT64 behavior remains unverified and may fail closed. A captive network can block DoH; FREED does not switch that opt-in to plaintext to sign in. No HTTP hostname probe starts while the encrypted option is selected.

Cloudflare receives DNS queries and the network source IP as the third-party resolver. Families applies its own adult/malware categories; a FREED local allowlist cannot override a provider block. DNS encryption does not make an app anonymous or prevent browser/app traffic from using other DNS routes.

## Local verification

Run the bridge/presentation/plugin tests:

```sh
node scripts/run-ts-entry.js tests/encrypted-dns.test.ts
```

Run the real production Swift/Kotlin policy and protected-socket harnesses, using Xcode Command Line Tools and `kotlinc`/Java:

```sh
node modules/freed-protection/tests/run-encrypted-dns-tests.js
```

The harness creates temporary files, compiles the production policies, executes the cases, and removes them. It never loads real DNS preferences, signs, boots a simulator, or installs an app. Cases cover saved-but-disabled iOS profiles, unknown health, errors, disabled build capability, Android resolver failure without plaintext fallback, Private DNS/other-VPN conflicts, socket protection refusal, literal bootstrap, rejected redirects/MIME/oversize/transaction/question mismatches, and bounded response reads. The TypeScript suite was first observed failing because the encrypted DNS bridge was absent, then passed with the implementation.

The DNS manager/controller has also been typechecked against the installed physical iPhone SDK in Swift 5 mode with Debug preview code enabled. The Android upstream/configuration sources have been typechecked with the installed API 36 SDK and the cached OkHttp 4.12/Okio jars. These isolated checks do not replace the complete app build.

## Physical-device evidence before release

- Confirm the signed iOS app and provisioning profile both authorize `dns-settings`; test save, Settings enablement, return-to-app refresh, disable/removal, denied authorization, and configuration errors on a physical iPhone. Capture configuration and OS enablement separately. Do not label a successful save as healthy.
- On physical Android, test the approval flow, a conflicting VPN/always-on VPN, all Private DNS states, captive Wi-Fi, Wi-Fi/cellular changes, stop/restart, and loss of resolver connectivity. Observe outgoing traffic to confirm no DNS UDP/53 fallback while opted in, including queries queued during a toggle. Confirm socket protection failure yields a reported failure.
- Use Cloudflare's documented category test domains and a harmless normal-browsing corpus with fresh DNS/cache state. Verify provider false positives and local allowlist limits. Exercise app-owned DoH/custom DNS/IPv6 paths to document bypasses.
- Measure lookup latency, power use, response sizes, and IPv6-only networks. Keep the release flag false until these results and signing evidence have been reviewed.

## Official references

- [Apple DNS settings](https://developer.apple.com/documentation/networkextension/dns-settings): system encrypted DNS configuration and explicit user enablement.
- [Apple NEDNSSettingsManager](https://developer.apple.com/documentation/networkextension/nednssettingsmanager) and [isEnabled](https://developer.apple.com/documentation/networkextension/nednssettingsmanager/isenabled): preferences and actual configuration enablement.
- [Apple Network Extension entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.networking.networkextension): signing capability.
- [Android VPN guide](https://developer.android.com/develop/connectivity/vpn): one VPN per user/profile, system approval, and protected sockets to avoid circular routing.
- [Android LinkProperties](https://developer.android.com/reference/android/net/LinkProperties): current network Private DNS state.
- [Cloudflare Families setup](https://developers.cloudflare.com/1.1.1.1/setup/) and [DoH wireformat requests](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/): fixed Families endpoint and DNS-message HTTPS transport.
- [Cloudflare resolver addresses](https://developers.cloudflare.com/1.1.1.1/infrastructure/network-operators/): Families bootstrap addresses.
