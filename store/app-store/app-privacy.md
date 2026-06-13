# FREED App Store App Privacy Answer Sheet

Last reviewed: 2026-06-06

Use this sheet when filling App Store Connect > App Privacy for `app.freed.recovery`. It is based on `docs/privacy-data-map.md`, `store/privacy-policy.md`, the iOS policy pack, and the production environment actually enabled for release. Apple requires disclosure of data collected by FREED or third-party partners, including data collected for app functionality.

Official source checked: https://developer.apple.com/app-store/app-privacy-details/

## Tracking

- Data used to track users: No.
- FREED must not request ATT/IDFA for v1. Rewarded ads must stay recovery-gated and non-personalized. If a future ads or analytics configuration links FREED data with third-party data for targeted advertising, advertising measurement, or a data broker, this answer must change before release.

## Data Linked To The User

Declare these only when the corresponding production feature is enabled:

| Apple data type | Linked to user | Purpose | Production condition | Notes |
| --- | --- | --- | --- | --- |
| Purchases > Purchase History | Yes | App Functionality; Fraud Prevention; Account Management | Native IAP enabled | Product ID, entitlement status, platform, and hashed transaction/order/token identifiers. Raw receipts/tokens must remain server-only and redacted from logs/evidence. |
| Identifiers > User ID | Yes | App Functionality; Account Management; Fraud Prevention | Hosted sync/Supabase Auth or server entitlement account linkage enabled | Do not expose service-role keys or provider tokens to the client. |
| Contact Info > Email Address | Yes | Account Management; App Functionality; Developer Communications | Email auth, support, or deletion workflow collects email | Support/deletion contacts must not be included in analytics, ads, AI, or recovery reports. |
| Identifiers > Device ID | Yes where provider SDKs treat it as linked | App Functionality; Advertising; Fraud Prevention | AdMob rewarded ads, APNs/FCM push, or store/provider verification enabled | FREED does not use IDFA/ATT for v1; disclose provider device IDs conservatively when SDKs are enabled. |

## Data Not Linked To The User

Declare these only when the corresponding production feature is enabled and evidence proves the no-linkage boundary:

| Apple data type | Purpose | Production condition | Notes |
| --- | --- | --- | --- |
| Usage Data > Product Interaction | Analytics; App Functionality; Personalization | Explicit opt-in remote aggregate analytics or remote retention enabled | Aggregate-only counts and coarse trigger categories. No raw browsing details, URLs, private notes, contacts, or support emails. |
| Usage Data > Other Usage Data | App Functionality; Personalization | Remote AI/challenge personalization enabled | Redacted/coarse recovery context, local urge forecast level, challenge history summaries, and coarse intervention source only. |
| Diagnostics > Performance Data | Analytics; App Functionality | Production diagnostics/performance telemetry enabled later | Current QA performance evidence is not production user telemetry. Do not declare diagnostics unless a production service collects it. |
| Location > Coarse Location | App Functionality; Personalization | Optional challenge weather context enabled | Disabled by default. Coordinates are rounded before the weather request; exact coordinates are not stored or sent to AI. |

## Data Not Collected For V1 Local-First Protection

- Browsing History: Safari Content Blocker receives rule lists; FREED does not receive Safari browsing history or page contents. Android DNS/browser signals stay local unless converted into redacted aggregate opt-in analytics.
- Search History: raw explicit search text is classified locally and stored only as a redacted focused-search handoff; it is not sent off device.
- Sensitive Info: private slips, adult-content recovery context, reflections, check-ins, urge history, and custom challenges remain local unless transformed into coarse/redacted remote AI or aggregate analytics signals.
- User Content > Photos or Videos: challenge photos are fresh camera captures classified on device; no upload, base64, EXIF, gallery import, or persistent photo library.
- Health & Fitness: motion, step, and exercise verification are foreground challenge-scoped and local; no HealthKit history sync.
- Precise Location: foreground challenge verification is local; optional weather context uses rounded/coarse coordinates only if enabled.
- Contacts: accountability/support contacts remain local and user-initiated.
- Other User Content: backup plaintext is not collected; hosted backup sync stores only encrypted envelopes.
- Emails, SMS, calendar, files, payment card data, credit info, race/ethnicity, political/religious beliefs, and sexual orientation are not collected by FREED.

## Review Notes To Keep Aligned

- Family Controls, ManagedSettings, DeviceActivity, FamilyActivityPicker, and Safari Content Blocker are protection APIs, not third-party app screen reading.
- iOS Screen Time targets are opaque tokens and local counts. FREED cannot and does not inspect native third-party app screens, private messages, Reels/Shorts/TikTok content, or in-app content.
- Optional DNS Settings must stay disabled unless Apple grants the `dns-settings` entitlement and evidence proves matched-domain DNS without packet tunnel, VPN manager, full traffic proxying, packet inspection, or HTTPS interception.
- If remote community, crash analytics, additional ad networks, personalized ads, account profiles, or family/accountability/AI add-on SKUs are enabled after v1, update App Privacy before submitting that build.
