# Google Play Metadata Draft

## App Information

- App name: FREED
- Package name: app.freed.recovery
- Short description: Recovery-first adult blocker and app loop interrupter.
- Category: Health & Fitness
- Support email: soumyadebnath1661@gmail.com
- Privacy Policy URL: https://freed-landing.web.app/privacy
- Support URL: https://freed-landing.web.app/support
- Account deletion URL: https://freed-landing.web.app/account-deletion

## Full Description

FREED helps you stop explicit-content and doomscroll loops with recovery-first protection.

Set up adult-domain blocking, choose the apps that tend to pull you into loops, and let FREED guide you into a recovery challenge when you hit a risky site, search, or app-limit threshold. FREED focuses on helping you recover in the moment instead of trapping or shaming you.

Protection setup sends you directly to the required Android permission screens, then checks that adult-domain blocking, normal-site access, Usage Access, Accessibility, and selected app timers are ready before activation completes.

Keep recovery support close: use urgent SOS, breathing exercises, check-ins, recovery challenges, reminders, and a private record of your progress. Permission setup opens the closest supported system page and checks the result when you return. Protection status reflects the permissions and services actually active on your device.

FREED Premium offers monthly and annual billing with the same benefits: ad-free recovery resets and challenges, deeper reports, estimated forecasts, and support-circle reports. Store prices are shown in your local currency. Neither plan has a free trial. Restore purchases or manage your subscription from the membership screen. Cancelling keeps access through the paid period; when paid access expires or is revoked, eligible free resets use rewarded ads again. Urgent SOS remains ad-free.

CLARA provides automated guidance rather than therapy. Remote replies are limited to three per day for free users and twenty per day for Premium; local guidance stays available when the remote service is unavailable. Recovery scores and forecasts are estimates based on recorded behavior, with an insufficient-data state when there is not enough history.

Core recovery tools work without account signup. Account linking and encrypted cloud backup are optional. Device protection still requires the permissions explained during setup.

## Play Console Declarations

### AccessibilityService

FREED uses AccessibilityService only after explicit user consent to detect supported browser address/search fields, selected app package launches, selected short-form surfaces such as Shorts/Reels/For You, and bounded scroll events after configured thresholds. This is core app functionality for adult-domain and app-loop recovery handoff. FREED does not perform continuous screenshot analysis, OCR, overlay trapping, keylogging, or ad fraud behavior. FREED does not include Android Ad ID permission.

### VpnService

FREED uses VpnService as DNS Guard for local DNS-domain classification against a reviewed adult-domain feed. FREED does not route normal traffic to a monetized remote proxy, inspect packet payloads, alter ad traffic, MITM HTTPS, or collect browsing history.

### Foreground Service Special Use

FREED's DNS Guard service remains visible while protection is active so adult-domain DNS blocking can continue reliably. The release evidence must prove visible foreground service lifecycle behavior and no silent VPN permission prompt after reboot/restart.

## Data Safety Draft

- Data collected: account identifiers and an optional email for account linking; store purchase verification metadata when Premium is purchased/restored; optional aggregate analytics after opt-in; optional redacted AI context; opt-in encrypted recovery backup envelopes; opt-in push tokens and service diagnostics; rewarded-ad SDK data as disclosed in the privacy policy.
- Plaintext browsing inputs, private notes and camera media are excluded from analytics and remote AI payloads. A cloud backup may contain encrypted recovery records, including locally recorded manual inputs; the backup key remains on the device or with the user's passphrase. Native protection configuration and Premium authority are not restored from that backup.
- Payment card information is handled by the store. Android advertising-ID permissions are removed. Exact background location and microphone audio are not collected.
- Data sharing: store verification with Apple/Google; optional ad delivery through AdMob rewarded ads; optional backend providers only as disclosed in privacy policy.

## Launch Products

- `freed_premium_monthly`
- `freed_premium_yearly`

US base prices are $9.99/month and $39.99/year, localized by the store. Both subscriptions include all current Premium capabilities. Additional tiers, standalone feature products, and introductory offers are outside this launch.

## Screenshot Set

Use `store/screenshots/listing-screenshot-plan.md` for Google Play listing screenshot capture requirements, benefit copy, source-build boundaries, and retake rules. Keep public listing screenshots separate from monthly/annual IAP review screenshots and physical-device protection evidence. Capture final assets from the tested release build before submission.
