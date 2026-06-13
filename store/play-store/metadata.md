# Google Play Metadata Draft

## App Information

- App name: FREED
- Package name: app.freed.recovery
- Short description: Recovery-first adult blocker and app loop interrupter.
- Category: Health & Fitness
- Privacy Policy URL: https://freedrecovery.app/privacy
- Support URL: https://freedrecovery.app/support
- Account deletion URL: https://freedrecovery.app/account-deletion

## Full Description

FREED helps you stop explicit-content and doomscroll loops with recovery-first protection.

Set up adult-domain blocking, choose the apps that tend to pull you into loops, and let FREED guide you into a recovery challenge when you hit a risky site, search, or app-limit threshold. FREED focuses on helping you recover in the moment instead of trapping or shaming you.

Protection setup sends you directly to the required Android permission screens, then checks that adult-domain blocking, normal-site access, Usage Access, Accessibility, and selected app timers are ready before activation completes.

Premium unlocks no-ad interventions, adaptive recovery challenges, deeper local analytics, and CLARA recovery patterns.

## Play Console Declarations

### AccessibilityService

FREED uses AccessibilityService only after explicit user consent to detect supported browser address/search fields, selected app package launches, selected short-form surfaces such as Shorts/Reels/For You, and bounded scroll events after configured thresholds. This is core app functionality for adult-domain and app-loop recovery handoff. FREED does not perform continuous screenshot analysis, OCR, overlay trapping, keylogging, or ad fraud behavior. FREED does not include Android Ad ID permission.

### VpnService

FREED uses VpnService as DNS Guard for local DNS-domain classification against a reviewed adult-domain feed. FREED does not route normal traffic to a monetized remote proxy, inspect packet payloads, alter ad traffic, MITM HTTPS, or collect browsing history.

### Foreground Service Special Use

FREED's DNS Guard service remains visible while protection is active so adult-domain DNS blocking can continue reliably. The release evidence must prove visible foreground service lifecycle behavior and no silent VPN permission prompt after reboot/restart.

## Data Safety Draft

- Data collected: store purchase verification metadata when premium is purchased/restored; optional aggregate analytics only after opt-in; optional redacted AI context if remote AI is enabled; optional encrypted backup envelopes if backup sync is enabled.
- Data not collected: raw browsing history, full URLs, raw search text, screenshots, camera roll media, microphone audio, exact background location, Android Ad ID, private notes, and payment card details.
- Data sharing: store verification with Apple/Google; optional ad delivery through AdMob rewarded ads; optional backend providers only as disclosed in privacy policy.

## Launch Products

- `freed_premium_monthly`
- `freed_premium_yearly`
- `freed_premium_lifetime`

Family/accountability/AI coach SKUs are disabled for v1.

## Screenshot Set

Use `store/screenshots/listing-screenshot-plan.md` for Google Play listing screenshot capture requirements, draft benefit copy, source-build boundaries, and retake rules. Keep public listing screenshots separate from the Core 3 IAP review screenshots in `store/screenshots/manifest.json` and separate from physical-device protection evidence.
