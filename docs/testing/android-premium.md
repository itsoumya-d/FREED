# Android premium integration verification

Evidence for the 2026-10-03 run is in
[`2026-10-03-premium-android`](../validation/artifacts/2026-10-03-premium-android/).
The existing dirty working tree was preserved. No native implementation changes,
signing configuration changes, uploads, purchases, account actions, or owner-device
operations were performed by this verification run.

This is a previous QA snapshot: further app fixes and screen sweeps are in
progress. It is a Debug artifact with development-only emulator/mock/local flags,
and must not be described as the current release.

## Build and packaged configuration

The full `:app:assembleDebug` arm64 Hermes build uses Node 22.23.1, JDK 17.0.19,
Gradle 9.0.0, Android Gradle Plugin 8.12.0, Kotlin 2.1.20, and SDK/build tools 36.
The app overrides NDK/CMake to 28.2.13676358/3.31.0; linked native dependencies
retain the root NDK 27.1.12297006 and use CMake 3.22.1. Gradle and native compiler workers are capped
at one; the JVM is capped at 2 GB and Kotlin compiles in-process. Exact arguments
and versions are recorded in `build-command.json` and `environment.json`.

The merged Debug manifest declares `supportsRtl=true` and all ten requested locales:
English, Hindi, Bengali, Spanish, Portuguese, French, German, Arabic, Japanese,
and Simplified Chinese. The VPN service remains non-exported and requires
`BIND_VPN_SERVICE`. The encrypted-DNS release and preview metadata entries are
absent in the checked-in native manifest; `FreedEncryptedDnsConfig.capability`
defaults missing values to false. This run does not enable either capability.
`merged-manifest-audit.json` records these actual merged values.

The final QA asset override uses a generated development bundle and a
temporary Gradle init script, preserving the existing dirty main asset bundle.
Its flags enable development-only Firebase emulators, mock monetization, a local
coach and challenge generator, and disable remote domain-feed sync.

The full native build passed in 30m14s (608 tasks). The final cached QA repackage
passed in 35s, and the packaged bundle matches the generated QA bundle exactly.
Defined DEX classes include the DNS/DoH/VPN implementation, Expo UI,
localization, and OkHttp 4.12.0. The packaged manifest/locales were inspected with
AAPT2, and the Android Debug v2 signature verifies.

- APK: `/tmp/freed-premium-android-qa-20261003/FREED-premium-debug-arm64-2026-10-03.apk`
- APK SHA-256: `9357940f087324a66093be1ca2f88886cfc47e232dfce50dfbb73d905a08e1d6`
- Native/dependency source hash: `f4c3515b445aca4c130c836601c4d4097473e2e8e1c5b8d1ffe0b878de769dbc`
- JavaScript input hash: `ca1900a6d95b3ebb945b9f2281a69863d7146defb753947a34b47d22e39a96f0`
- Embedded QA bundle SHA-256: `58738be36d2f6446b690741e3759bed9e074f9b63fe347b2ba137e7af8ef6a3e`

The temporary QA hook needed included-build scoping and earlier asset
registration: `projectsEvaluated` ran after AGP had snapshotted asset providers.
The failing attempts, correction, and successful bundle-equality verification
are recorded in `qa-init-fix.json`. The main tracked bundle remained unchanged.
The initial full build emitted an ASM instrumentation classpath warning for Expo
classes and API deprecation warnings. The final DEX contains Expo AppContext;
device runtime verification remains unavailable.

## Kotlin DNS behavior

The production Kotlin policies and protected-socket factory compile and pass the
existing executable encrypted-DNS and DNS-readiness harnesses. Evidence is in
`kotlin-dns-harness.json` and `kotlin-dns-harness.log`.

The cases cover encrypted resolver failure without plaintext fallback, explicit
plaintext behavior when encryption is disabled, Private DNS and other-VPN
conflicts, unavailable capability, protected unconnected sockets, socket refusal
and closure, literal Families bootstrap, bounded body reads, and rejection of
redirects, incorrect MIME, oversized responses, transaction mismatch, changed
questions, and unsupported reply codes. These are JVM behavior checks; they do
not establish packet routing or filtering on an Android device.

## Runtime limits

A new disposable API 36 arm64 AVD was created for this run. Both its normal boot
and an `-accel off` attempt failed before Android started with `HVF error:
HV_DENIED` and `failed to initialize HVF: Invalid argument`. The emulator launcher
returned zero after QEMU reported an internal exit code of one; that shell result
is not boot evidence. The fixture was deleted after the attempts. Existing AVDs
and devices were not opened or reset. No app was installed, and no VPN route,
Private DNS setting, OS locale, or notification permission was changed.

Native Auth previously lacked emulator routing while Functions alone used
localhost. The parent integration now routes both services to `10.0.2.2` in
explicit Android development emulator mode and skips production AppCheck and
Remote Config startup. The native Google configuration still uses a production
project label, so a Functions emulator started with a demo project ID may reject
the project route. Treat that mismatch as unavailable local backend integration,
not permission to fall back to a production service. Release-mode emulator flags
fail closed.

No Android root-screen, Private DNS, captive-network, VPN consent, live IPv4 DNS,
IPv6/NAT64, or real DoH enforcement claim is made. Keep encrypted-DNS release and
preview flags off until the device evidence described in
[`encrypted-dns.md`](encrypted-dns.md) is collected.
