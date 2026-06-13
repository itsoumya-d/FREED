# FREED Privacy Policy

Effective date: June 6, 2026

FREED is a recovery and digital self-control app for blocking explicit adult-domain access, interrupting selected app loops, and guiding users into recovery challenges. This policy is mirrored in the public `/privacy` Expo route at https://freedrecovery.app/privacy for App Store Connect and Google Play Console.

## Data FREED Uses On Device

- Protection setup status, selected app package IDs or opaque Screen Time tokens, adult-domain feed version/checksum/count, challenge history, streak state, settings, reminders, and premium entitlement state.
- Android Accessibility is used only after user consent to detect supported browser URL/search fields, selected app package launches, selected short-form surfaces, and bounded scroll events for recovery handoff.
- Android DNS Guard uses a DNS-only VPN permission to classify DNS questions locally against the reviewed adult-domain feed. FREED does not full-tunnel traffic, inspect packets, proxy normal traffic, or MITM HTTPS.
- iOS uses Family Controls, DeviceActivity, ManagedSettings, and Safari Content Blocker rules to apply Screen Time and Safari restrictions. FREED receives opaque selected target tokens and counts, not the user's full app or browsing history.

## Optional Data Sent To FREED Servers

- Purchase verification sends store transaction metadata to FREED's server so Apple or Google can verify entitlement before premium is activated.
- If the user opts into analytics sharing, FREED sends aggregate recovery metrics only, such as counts, rates, streak summaries, and challenge completion categories. Raw URLs, search text, private notes, exact selected app tokens, and exact coordinates are not sent.
- If AI coaching or remote challenge generation is enabled, FREED sends redacted recovery context. Raw URLs/domains, private notes, exact coordinates, raw prompts, receipts, and contact details are excluded.
- If encrypted backup sync is enabled, FREED sends encrypted backup envelopes only. FREED does not receive the user's passphrase.

## Ads And Payments

Free users may see rewarded ads before some recovery challenges. Ad requests must use non-personalized request options where supported. FREED does not include Android Ad ID permission in the release manifest.

Premium plans are processed by Apple App Store or Google Play billing. FREED receives store verification metadata, but not the user's full payment card details.

## Permissions

FREED requests sensitive permissions only when needed:

- VPN/DNS Guard, Accessibility, and Usage Access during Android protection setup.
- Family Controls, DeviceActivity, ManagedSettings, and Safari Content Blocker during iOS protection setup.
- Camera, motion/activity, foreground location, and notifications only for matching challenges or reminders.

## Retention And Deletion

Local recovery data stays on the device unless the user enables an optional remote feature. Server-side purchase audit, analytics, AI event, notification, and encrypted backup records must follow the retention windows documented in the backend schema and release evidence. Users can use the in-app support/deletion controls or the public account deletion route at https://freedrecovery.app/account-deletion.

## Contact

Privacy contact: support@freedrecovery.app

Public support URL: https://freedrecovery.app/support

Public account deletion URL: https://freedrecovery.app/account-deletion
