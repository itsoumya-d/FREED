# Bounded protection fixes — 2026-10-02

This follow-up implements the explicitly authorized corrections from the initial audit. The original `source-manifest.json`, failed logs, and audit remain the before evidence. `fix-source-manifest.json` identifies the corrected source; it is still a modified workspace, not an installed release binary.

## Behavior repaired

- Captive-network sign-in still bypasses local adult DNS classification temporarily, but native status, activation diagnostics, permission readiness, and setup readiness report adult filtering inactive. Pause/resume emits a runtime event; resume restores coverage only when the service is running and effective DNS privacy permits the transport.
- Safari's DOMContentLoaded callback evaluates the current route. A page that changed from Shorts to an ordinary watch route before readiness remains allowed.
- The DNS-only VpnService declares `SUPPORTS_ALWAYS_ON=false`. The generated merged app manifest confirms the setting. No complete traffic tunnel was added.
- `allowFamily(AF_INET6)` preserves ordinary IPv6 traffic on the underlying network. IPv6 DNS/media traffic remains outside this IPv4 DNS filtering layer; this is a coverage limitation, not a full-proxy capability.
- Public `ConnectivityManager`/`LinkProperties` APIs determine effective Private DNS state. The app's own VPN properties do not mask underlying privacy requirements. Ambiguous underlying networks use conservative state: any strict/encrypted or unknown candidate prevents plaintext DNS.
- Strict Private DNS, active opportunistic encrypted DNS, and unknown DNS privacy keep DNS Guard inactive. Startup, network changes, auto-restart eligibility, and every upstream send are gated. If privacy changes while running, the interface is stopped so ordinary OS networking can resume. OS privacy settings are never changed. Accessibility app shields and local recovery remain available.

The remaining network limits still apply: browser/app DoH, cached/direct-IP access, arbitrary resolvers, encrypted mixed-domain media, and unsupported browser fields cannot be promised blocked. Optional iOS DNS settings remain documented and unimplemented.

## Native fields for UI integration

| Field | Meaning |
| --- | --- |
| `active` | Existing aggregate protection availability; may remain true for enabled Accessibility while adult DNS filtering is unavailable. |
| `adultFilterActive` | Adult-domain filtering is currently active; false during captive pause or incompatible/unknown DNS privacy. |
| `dnsGuardRuntimeReady` | Service lifecycle state only; never use as a universal blocking or activation success claim. |
| `dnsGuardCoverageReady` | Running service, no captive pause, compatible effective DNS privacy. This still does not prove interception in every browser/app. |
| `dnsGuardCaptivePaused` | Temporary sign-in pause; complete sign-in and verify the resumed status. |
| `privateDnsMode` | `off`, `opportunistic`, `hostname`, or `unknown`, from public effective-network state. |
| `privateDnsActive` | Optional Boolean: absent when unknown, true for active encrypted/strict state, false for known off. |
| `dnsGuardCoverageIssueCode` | Empty when coverage is ready, otherwise the precise condition below. |

Issue codes: `android-private-dns-strict-unsupported`, `android-private-dns-encrypted-unsupported`, `android-private-dns-state-unknown`, `android-dns-guard-captive-paused`, `android-dns-guard-not-running`.

Runtime events additionally include `adultFilterActive`, `dnsGuardCoverageReady`, and `dnsGuardCaptivePaused`. Refresh status on every event, including pause/resume. Show an actionable inactive DNS state while retaining local/app-shield controls; do not direct users to weaken encrypted DNS or enable unsupported lockdown.

## Verification

The two original fixtures changed from assertion failures to successful output:

```json
{"captivePaused":true,"adultFilterActive":false,"activationReady":false}
{"currentPath":"/watch","normalRouteAllowed":true,"staleShieldRendered":false}
```

- `tests/protection-dns-safety.test.js`: 4 tests passed, covering pause/resume, strict/opportunistic/unknown privacy readiness, IPv6/lockdown configuration, and the real Safari script in the lifecycle fixture.
- Production `FreedDnsGuardPolicy.kt` and dependency-free `FreedDnsGuardPolicyCases.kt` compiled with `kotlinc`, then executed with `java -jar`; both commands exited 0. The cases exercise running/stopped, pause/resume, strict/opportunistic/unknown, unsupported values, and diagnostic identity.
- Classifier audit: 49 passed; Android source parity: 17 passed. Existing protection setup/permission/intervention/Android-routing/Safari-routing suites: 26 tests passed. Exact post-fix commands and log hashes are in `fix-test-results.json`; setup/permission green logs are also retained.
- Android `:freed-protection:compileDebugKotlin` used one worker, no parallel build, 1 GB JVM, in-process Kotlin compilation. Initial compile passed. The final compile log verifies the current native source.
- Android `:app:processDebugMainManifest` used the same bounded settings and passed. `android-merged-vpn-service.xml` contains the extracted generated service and its always-on opt-out.

Gradle reports existing plugin deprecations and Android manifest merge warnings. `allNetworks` is a public but deprecated fallback API; it is retained for compatibility with Android 24+ and conservative handling when a VPN obscures the underlying default network. The adapter and live network transitions are not proven by JVM policy tests alone.

Physical Android tests must still verify effective strict/automatic DNS states, interface teardown/network continuity, IPv6/NAT64, captive pause/resume, installed-browser interception, OEM permissions, reboot and real native-app thresholds. Physical iOS Screen Time/extension/signing validation also remains outstanding. Other repository failures belong to the root's broader test report; these focused passes do not claim the entire application suite passed.
