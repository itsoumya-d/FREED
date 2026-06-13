# FREED Store Submission Checklist

## Build And Credentials

- Create real App Store Connect and Play Console app records for `app.freed.recovery`.
- Use `store/console-launch-packet.md` as the console setup source of truth for product IDs, privacy forms, review notes, declarations, and evidence gates.
- Before creating app records through the signed-in browser, generate `STORE_APP_RECORD_ACTION_PACKET.md` with `npm run evidence:store-ad-sandbox` and require the action-time confirmation token `confirm-draft-store-app-record-creation-only`. Stop after draft app records exist, then rerun the read-only Browser readiness report before product setup.
- Configure EAS credentials or local signing for iOS distribution and Android upload signing.
- Run `npm run eas:build:internal` for internal validation, then `npm run eas:build:production` for store artifacts.
- Capture public App Store and Play listing screenshots from the submitted signed build family using `store/screenshots/listing-screenshot-plan.md`; keep those assets separate from Core 3 IAP review screenshots and physical-device evidence.
- Keep `submit.production.android.releaseStatus` as `draft` until release evidence passes.
- Run `npm run eas:submit:production -- --dry-run` before any production-profile submit. The `scripts/eas-submit-guard.js` wrapper must report a passing draft/internal-safe command, or the owner must explicitly set `FREED_STORE_PRODUCTION_SUBMIT_APPROVED=strict-release-evidence-pass` only after all strict release evidence passes.

## Products

- Create yearly and monthly subscriptions plus a lifetime non-consumable/one-time product using `store/store-products.json`.
- Configure server-side App Store and Google Play verification credentials.
- Run sandbox purchase, restore, rewarded ad, and premium no-ad evidence before promoting release evidence.

## Privacy And Policy

- Host the checked-in Expo routes `app/privacy.tsx`, `app/support.tsx`, and `app/account-deletion.tsx` at the public Privacy Policy, Support, and account deletion URLs. The policy text source remains `store/privacy-policy.md`. Run `npm run export:web` and confirm the static export contains direct route HTML before entering the URLs in the consoles.
- Fill Play Data Safety from `store/play-store/data-safety.md` and App Store privacy details from `store/app-store/app-privacy.md`, then cross-check both against `docs/privacy-data-map.md` plus the optional remote features actually enabled in production env.
- Submit Android AccessibilityService, VpnService, and special-use foreground service declarations using `store/play-store/metadata.md` and `docs/store-policy/android-accessibility-and-fgs-disclosure.md`.
- Submit iOS Screen Time/Safari/DNS review notes using `store/app-store/metadata.md` and `docs/store-policy/ios-screen-time-safari-dns-review.md`.

## Evidence Gates

- `npm run typecheck`
- `npm run test:core`
- `npm run evidence:templates`
- `npm run preflight:release-env -- --env-file <prod-env>`
- `npm run verify:release -- --env-file <prod-env> --artifact-dir docs/validation/artifacts/<run-id>`

Production submission must wait for physical-device Android/iOS evidence, normal browsing corpus, performance profile, store/ad sandbox, AI backend smoke, and strict release audit pass.
