# FREED Launch Pricing Economics

This is the v1 profitability handoff for the Core 3 launch products. It is a planning model, not a substitute for App Store Connect or Play Console financial reports. Before production submission, validate the actual proceeds, taxes, local price tiers, and eligibility status inside the store accounts.

Official fee references to review during account setup:

- Apple App Store Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Google Play service fees: https://support.google.com/googleplay/android-developer/answer/112622

## Launch Assumptions

- Store provider: native StoreKit 2 / Google Play Billing through `expo-iap`.
- Server verification: required before granting `premium`.
- Launch products: monthly, yearly, lifetime only.
- Future products disabled for v1: family, accountability, AI coach.
- Conservative fee model: 30% store fee.
- Optimized fee model: 15% store fee if FREED qualifies for Apple's Small Business Program and the applicable Google Play service-fee tier.
- Free-user monetization: rewarded ads before challenge entry only.
- Premium monetization: no rewarded ads before challenge entry.

## Core 3 Economics

| Plan | Product ID | Gross price | Conservative net at 30% | Optimized net at 15% | Role |
| --- | --- | ---: | ---: | ---: | --- |
| Monthly | `freed_premium_monthly` | USD 9.99 | USD 6.99 | USD 8.49 | Entry recurring |
| Yearly | `freed_premium_yearly` | USD 39.99 | USD 27.99 | USD 33.99 | Primary value |
| Lifetime | `freed_premium_lifetime` | USD 79.99 | USD 55.99 | USD 67.99 | Cashflow anchor |

The yearly plan is the primary value anchor: it is USD 3.33 per month equivalent and a 67% discount against twelve monthly payments at USD 9.99. The lifetime plan is positioned as a cashflow anchor with an 8-month breakeven against monthly and a 2-year breakeven against yearly.

## Release Checks

Keep the pricing model aligned across:

- `src/lib/monetization.ts`
- `store/store-products.json`
- `store/app-store/in-app-purchases.csv`
- `store/play-store/products.csv`
- `store/console-launch-packet.md`

Do not promote production until sandbox purchase, restore, server verification, rewarded ad, premium no-ad, and privacy-disclosure evidence passes in `docs/validation/evidence/store-ad-sandbox.json`.
