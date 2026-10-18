# FREED TestFlight 1.0 (5)

The previous paywall was restored exactly from the saved version before the October7 compact redesign. Other current app changes remain included. This build is available to the existing Internal TestFlight group.

- App Store Connect build: `e4bfc70d-1a14-4a96-b6f2-74e438693673`.
- Processing: VALID; internal state: IN_BETA_TESTING; unexpired, read back from Apple.
- Source snapshot SHA256: `5772fb60c13e22cfb197d2f01eb2f27e58dd90bbb414a10f9e6bd8a41b399bfe` (950 public inputs).
- Previous PremiumOffer source SHA256: `a8a184900a9aee8558547604cdeac6dde0d672d5419d7c0f5a47ec9510421df4`.
- IPA SHA256: `e079208068e623bb05e6fb1012db703675e0e91d184cbe87d38e27bd65e169bb`.

The actual signed IPA has encrypted DNS release capability enabled, development preview disabled, effective dns-settings entitlement and production App Attest. Strict signature verification and all eight existing release packaging gates passed. Sample AdMob units remain selected for internal testing. QA instrumentation is absent.

This is an internal testing milestone. Physical blocking, actual account/service/purchase flows and public-release performance evidence remain unverified. DNS configuration still must be selected by the user in iOS Settings; a saved configuration cannot establish enabled filtering. The unrelated website-setup source test still expects an obsolete 0 / 2 display counter; its failure remains visible. No public App Store submission occurred.

Open TestFlight → FREED → install/update 1.0 (5).
