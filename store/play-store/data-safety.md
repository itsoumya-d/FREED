# FREED Google Play Data Safety Answer Sheet

Last reviewed: 2026-06-06

Use this sheet when filling Play Console > App content > Data safety for `app.freed.recovery`. It is based on `docs/privacy-data-map.md`, `store/privacy-policy.md`, the Android policy pack, and the production environment actually enabled for release. Google defines collection as transmitting user data off device, while local-only on-device access/processing does not need to be disclosed as collected.

Official source checked: https://support.google.com/googleplay/android-developer/answer/10787469

## Summary Answers

- Does the app collect or share any required user data types? Yes, for store purchase verification, rewarded ads, optional aggregate analytics, optional remote AI, optional hosted encrypted backup sync, optional account/auth backup sync, optional remote notifications, and optional weather context when enabled.
- Is all collected user data encrypted in transit? Yes, production endpoints must be HTTPS and release preflight rejects unsafe endpoints.
- Can users request data deletion? Yes. Users can delete local recovery data in Profile and request server/hosted-sync deletion through https://freedrecovery.app/account-deletion or `support@freedrecovery.app` until authenticated account deletion is live.
- Is the app committed to the Families policy? No. FREED should be positioned for adult recovery/digital wellbeing and not submitted as a child-directed or Families app.
- Independent security review badge? No, unless a MASA or equivalent review is completed later.

## Data Types To Declare

| Play data type | Collected | Shared | Required or optional | Purposes | Notes |
| --- | --- | --- | --- | --- | --- |
| Purchase history | Yes | Yes, with store/payment processors for purchase validation | Required for premium purchase/restore | App functionality; fraud prevention, security, and compliance; account management | Includes product ID, platform, entitlement status, and hashed transaction/order/token identifiers. Raw receipts and purchase tokens must not be stored in evidence or echoed to the app. |
| Device or other IDs | Yes | Yes, with AdMob/FCM/APNs/store providers where enabled | Required for rewarded ads/push/store verification when those features are used | App functionality; advertising or marketing for rewarded ads; fraud prevention, security, and compliance | FREED does not request Android Advertising ID permissions. Rewarded ads must be non-personalized in FREED's request flow, but ad and push SDK/provider identifiers still need conservative disclosure. |
| App interactions | Yes, only if remote analytics sharing is explicitly enabled | No, except service providers | Optional | Analytics; app functionality; personalization | Aggregate-only counts such as challenge completions, app opens, streak buckets, and coarse trigger categories. Remote sharing is off until explicit current-version opt-in and a production-safe endpoint are configured. |
| Other user actions | Yes, only if remote analytics, AI, retention, or backend audit events are enabled | No, except service providers | Optional | App functionality; analytics; personalization; fraud prevention, security, and compliance | Redacted/coarse recovery events only. No raw URLs, browsing history, private notes, exact search text, screenshots, contacts, payment cards, or provider secrets. |
| User IDs | Yes, only if hosted encrypted backup sync, Supabase Auth, or account-like restore is enabled | No, except service providers | Optional | App functionality; account management; security | Use only public Supabase client auth on device and server-side authenticated storage for encrypted envelopes. |
| Email address | Yes, only if user signs in for hosted sync or sends support/deletion requests through app handoff | No, except service providers | Optional | Account management; app functionality; developer communications | Do not include support contacts in analytics, AI, or ad payloads. |
| Approximate location | Yes, only if challenge weather context is enabled | No, except service providers | Optional | App functionality; personalization | Disabled by default. If enabled, coordinates are rounded before provider request and exact coordinates are not sent to AI or stored. |
| Diagnostics | Yes, only if production diagnostics/performance telemetry is enabled in a future build | No, except service providers | Optional | Analytics; app functionality | Current validation profiles are QA evidence, not production user telemetry. Do not mark diagnostics collected unless a production crash/performance service is enabled. |

## Data Types Not Collected For V1 Local-First Protection

- Web browsing history: DNS host questions and browser/search fields are processed locally for protection. FREED does not upload raw browsing history, full URLs, URL paths, query strings, fragments, or search text.
- Photos and videos: challenge photos are fresh camera captures processed on device, with no base64/EXIF upload and best-effort temporary file deletion.
- Audio files: no microphone permission and no audio capture.
- Contacts: accountability/support handoffs are user-initiated SMS/email actions and contact details stay local unless the user sends a message outside FREED.
- Health info and fitness info: steps, motion, and challenge verification signals are on-device and challenge-scoped; no Health Connect history sync.
- Precise location: foreground location is challenge-scoped and local unless optional coarse weather context is enabled; exact coordinates are not stored or sent to AI.
- Installed apps: selected Android packages and iOS Screen Time token counts are local/native protection configuration and not sent off device.
- Other user-generated content: private slip notes, reflections, custom challenges, and recovery backup plaintext stay local; hosted sync stores only encrypted envelopes.
- Files and docs, calendar, messages, race/ethnicity, political/religious beliefs, sexual orientation, credit score, and payment card details: not collected by FREED.

## Security Practices And Deletion

- Encryption in transit: answer Yes for every production endpoint.
- Data deletion mechanism: answer Yes. Use https://freedrecovery.app/account-deletion, `support@freedrecovery.app`, and in-app Profile local deletion. Hosted sync deletion must remove encrypted envelopes, purchase audit records where legally allowed, analytics events within retention policy, AI audit summaries, push tokens, and backend job/idempotency rows tied to the request.
- Data retention: local recovery state is user-controlled; backend analytics/audit/AI/push/backup rows must follow the retention periods in `docs/backend/supabase-schema.sql` and cleanup route evidence.
- Optional features must update this sheet before release if they change from disabled to enabled: hosted encrypted backup sync, remote analytics, remote AI, remote retention, remote community, weather context, crash analytics, or any new ad/analytics SDK behavior.
