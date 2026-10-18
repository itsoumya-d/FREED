# FREED premium rebuild execution receipt

Approved implementation plan from this conversation. Work remains on codex/freed-publication-ready, preserving pre-existing uncommitted changes.

## Expanded review after user feedback, 2026-10-03

The user explicitly says both platforms remain unready: later screens, language layouts, pricing and Screen Time setup are inconsistent. The original objective remains active. Do not treat catalog completeness, earlier 89 passing local suites, or the first native screens as whole-app acceptance.

The [screen matrix](screen-review-matrix.json) tracks 64 routes, nested surfaces and UI states, with 1,280 language/theme cells. Runtime cells start unexecuted and require evidence; physical and Android-runtime limits remain explicit.

Concrete defects found and being repaired:

- A retained hidden Splash route re-ran a timer after provider state changes, redirecting quiz/forms/sheets. Replaced with a focused one-shot initialization hook; component test passes, exact failed native quiz case is rerunning.
- Mobile settings used dynamic environment lookup that Expo does not inline. Added an audited literal public-client accessor and wired Firebase/AI/monetization. Actual Expo transform test passes with an empty device environment and does not include server secret sentinels.
- Android introductory/free pricing could replace regular billed pricing, and non-price text could enable checkout. Pricing worker has red/green reproductions and is finishing the responsive all-language offer matrix.
- Unsupported Screen Time still advertised Allow; limited continuation was hidden inside Help. Added truthful support presentation, visible limited continuation and refresh behavior. Simulator capabilities now reject Screen Time/ManagedSettings enforcement.
- Offer/permission screens used a separate old palette. Mapped to shared semantic colors and fixed status-bar selection.
- Localized clock digits were rejected. Bengali, Arabic, Persian, Devanagari and full-width inputs now normalize before bounded time validation.
- Applied the four-point spacing scale to 286 numeric UI spacing properties; expanded long-label choices and steppers; added RTL directional icons and prose/credential input direction handling.
- Native iOS Shield now has generated copy in all ten languages, shared appearance/language preferences, and the original passage icon. Swift language policy and complete UIKit typecheck pass; physical rendering remains unverified.
- Public website branding now uses the canonical symbol and palette. Text, links and terms are preserved; these local changes have not been deployed.

Current native ownership: ios_walkthrough controls the disposable iOS simulator/build and broad screen inspection; android_build_verify preserves its completed prior APK snapshot and audits Android permission paths; retained_drafts owns paywall/pricing fixes. Root owns shared layout, locale/runtime and controller fixes. No production account, purchase, message or deployment writes were made.

## Implemented

- Persistent System/Light/Dark and ten-language preferences, native pickers, top onboarding controls, localized navigation, RTL restart behavior and web direction/theme support.
- Original vector F/passage mark, matte passage artwork, recovery hero, Library search/tools, common localized UI primitives, consistent palette and native brand resources.
- Full authored-copy catalog: 2,240 source strings + 41 semantic strings per locale. Latest strict inventory 2,161/2,161 phrases including native messages and permission resources; rerun after final edits.
- Native optional Cloudflare Families encrypted DNS, explicit consent, safe status model, protected Android DoH/no plaintext fallback, iOS configuration/enablement/unknown health. Production activation and DNS entitlement remain gated.
- Adult-domain protection outranks ordinary browsing exceptions in JS, Kotlin and extension rules.
- Retained bounded drafts, durable explicit saves, cleanup retry without duplicate records, explicit local draft deletion.
- Optional validated CLARA locale and explicit local-mode precedence.
- QA emulator routing for Auth and Functions; development-only, fixed local hosts, no production AppCheck/RemoteConfig startup in the fixture.
- Feature catalog now 109 rows with scenario/receipt obligations. Strict localization and component checks added to release/CI gates.

## Verification observed

- TypeScript checks passed repeatedly after implementation and review fixes.
- Core 279/279 and native source audits: performance 29/29, accessibility 7/7, privacy 31/31.
- Component suite 63/63, plus regressions for stale DNS refresh, Arabic-device LTR, missing web Appearance setter, template capture safety and prototype keys.
- Demo Firebase emulators under Node 22: 208 passed, 0 failed/skipped. Unit-only run: 203 passed, 5 intentional emulator skips. Canonical scenario receipts remain blocked, not fabricated.
- Cloudflare public resolver: published adult and malware test domains blocked, ordinary example.com resolves. Account domain overview was empty; no zone/account setup is required by this public resolver.
- iOS builds passed, but initial Debug build lacked its JS bundle. Explicit FORCE_BUNDLING handling and a QA marker are being verified in the final standalone build.
- Native permission resources validated on disk and correctly attached only to the host application; generator is idempotent.
- Android isolated Kotlin tests passed. APK compile in progress; disposable AVD boot is blocked by HV_DENIED, so no Android runtime enforcement claim.

## Remaining work

- Complete latest standalone iOS install, inspect all reachable screens and record motion/theme/language walkthroughs; preserve build-bound screenshots and results.
- Finish Android APK compile/inspection and record unavailable runtime prerequisites.
- Complete fresh full-local run: earlier core process timed out under build contention after 190 passing assertions and no failures; retry uses 600-second suite budget.
- Reconcile final release/evidence report and current dependency advisories. No claim of 100% feature or physical-device coverage.

## External release gates

Signed physical-device Screen Time/DNS/VPN/sensor proof, actual store sandbox callbacks, measured release performance, production provider/secrets/runtime/signing, and dependency advisories remain independent unmet requirements. The Cloudflare account has no website zones; an owned domain is needed only for optional website DNS setup, not Families filtering.
