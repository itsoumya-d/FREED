# App Store Metadata Draft

## App Information

- Name: FREED
- Subtitle: Recovery-first adult blocker
- Bundle ID: app.freed.recovery
- Category: Health & Fitness
- Privacy Policy URL: https://freedrecovery.app/privacy
- Support URL: https://freedrecovery.app/support
- Account deletion URL: https://freedrecovery.app/account-deletion

## Description

FREED helps you break explicit-content and doomscroll loops with recovery-first protection. It combines adult-domain blocking, selected app limits, Screen Time or Accessibility-based handoffs, and real-world recovery challenges so you can get back to the life you meant to live.

FREED does not rely on shame or traps. Protection setup explains each permission, sends you directly to the required system authorization screen, and confirms activation with a protection test before the app marks setup complete.

Premium unlocks no-ad interventions, adaptive recovery challenges, deeper local analytics, and CLARA recovery patterns.

## Keywords

recovery, blocker, adult blocker, porn blocker, screen time, focus, habits, self control, accountability, digital wellbeing

## Review Notes

- FREED uses Family Controls, DeviceActivity, ManagedSettings, and Safari Content Blocker for recovery and parental-control-style self-protection.
- The app does not inspect native third-party app screens on iOS. Selected apps/sites are handled through opaque Screen Time tokens and system shielding.
- Safari content-blocker rules contain reviewed adult-domain and web short-form URL rules only.
- Optional DNS Settings are used only if the app has Apple's approved DNS Settings entitlement. FREED does not include a packet-tunnel provider, full VPN, packet inspection, or HTTPS interception.
- Camera, motion, location, and notifications are requested only for user-initiated challenges or reminders.
- Core 3 launch products: `freed_premium_yearly`, `freed_premium_monthly`, `freed_premium_lifetime`.

## Screenshot Set

Current IAP review screenshots are checked in under `store/screenshots/` and mapped by `store/screenshots/manifest.json`.

Store listing screenshot capture requirements and draft benefit copy are tracked in `store/screenshots/listing-screenshot-plan.md`. Keep public listing screenshots separate from the Core 3 IAP review screenshots and separate from physical-device protection evidence.

Required before submission:

- Onboarding goals
- App selection
- Paywall with Core 3 plans only
- Protection setup checklist
- Activation test passed
- Main dashboard
- Intercept/recovery challenge
- Shield/settings screen
