# FREED Launch Runbook — Remaining Gates (Phase 4)

Generated after Phase 1–3 fixes. Code-side gates are green; every remaining
failure below requires **your accounts, credentials, deployed infrastructure,
or physical devices**. Work top-down: each step unblocks the ones under it.

Current audit baseline:

```bash
npm run audit:release            # 31 pass / 14 fail (all ops-dependent)
set -a; source ~/.freed/android-upload/freed-upload.env; set +a   # flips android-signing to pass
```

---

## Step 1 — Domain `freedrecovery.app` (unblocks 2 gates)

**Status:** NXDOMAIN — the domain is not registered or nameservers are not set.

1. Register `freedrecovery.app` (Google Domains/Squarespace, Cloudflare, or Namecheap).
2. Point DNS at your host:
   - **Firebase Hosting** (repo already ships `firebase.json` hosting of `dist/`
     with `/privacy`, `/support`, `/account-deletion` static routes):
     ```bash
     npm run export:web
     npm run prepare:firebase-hosting
     npx firebase-tools deploy --only hosting --project freed-7d5ee
     # then add the custom domain in Firebase Console → Hosting → Add custom domain
     # (A records / TXT verification as instructed by the console)
     ```
3. Verify and re-audit:
   ```bash
   curl -I https://freedrecovery.app/privacy      # expect 200 text/html
   npm run audit:store-legal-hosted
   npm run audit:release
   ```
✅ Clears `store-legal-hosted-url-validation`.

## Step 2 — Backend runtime choice (unblocks 4 gates)

The repo is dual-wired; pick ONE path and finish it.

### Option A · Firebase (recommended — code is complete)
Blocked today on billing/quota for project `freed-7d5ee`.
1. Enable Blaze (pay-as-you-go) on `freed-7d5ee`; resolve the staging-project
   quota error or delete `freed-staging-7d5ee` from `.firebaserc`.
2. Deploy functions:
   ```bash
   npm --prefix functions run build
   npx firebase-tools deploy --only functions,firestore:rules,storage --project freed-7d5ee
   ```
3. Set function secrets (Cloud Secret Manager):
   ```bash
   for S in OPENAI_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY \
            UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN \
            BACKEND_MAINTENANCE_SECRET APP_STORE_ISSUER_ID APP_STORE_KEY_ID \
            APP_STORE_PRIVATE_KEY GOOGLE_PLAY_SERVICE_ACCOUNT_JSON; do
     npx firebase-tools functions:secrets:set $S --project freed-7d5ee
   done
   ```
4. Client env (`.env.production`): point
   `EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT`,
   `EXPO_PUBLIC_ANALYTICS_ENDPOINT`, `EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT`,
   `EXPO_PUBLIC_AI_COACH_ENDPOINT`, `AI_CHALLENGE_ENDPOINT`,
   `EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT` at the deployed URLs.
✅ Clears `production-backend-infrastructure`, `production-analytics-ingestion`,
   `production-notification-backend` (after adding APNs/FCM keys per Step 4),
   `production-adult-domain-feed`.

### Option B · Supabase + Upstash (legacy path)
1. Create/reactivate a Supabase project → run:
   ```bash
   psql "$DATABASE_URL" -f supabase/migrations/20260518000100_freed_backend_core.sql
   psql "$DATABASE_URL" -f supabase/migrations/20260520000100_harden_analytics_privacy_keys.sql
   npx supabase functions deploy adult-domain-feed-sync analytics-retention-cleanup
   ```
2. Fill the same env names above with Supabase/Upstash values.
3. Host the Expo API routes (`app/api/*`) via `eas deploy` or any Node host.

## Step 3 — Adult-domain feed sources (with Step 2)

Set server-side env (NOT `EXPO_PUBLIC_`):
```
FREED_ADULT_DOMAIN_FEED_SOURCE_URLS=oisd-nsfw|OISD NSFW|https://... \
  stevenblack-f|StevenBlack f|https://...
EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true
```
Allowed families only: `oisd-nsfw`, `stevenblack-*`, `cloudflare-family-*`,
`freed-custom-*`. Review each list manually before enabling.
Then rebuild the extension ruleset from the live feed:
```bash
curl -s "$FEED_ENDPOINT" > /tmp/feed.json
node -- scripts/run-ts-entry.js scripts/build-extension-rules.ts --feed /tmp/feed.json
```

## Step 4 — Store & ads credentials (unblocks 2 gates)

| Credential | Where to get | Env var(s) |
|---|---|---|
| AdMob app IDs ×2 | apps.admob.com → Apps | `EXPO_PUBLIC_ADMOB_APP_ID_IOS/_ANDROID` |
| Rewarded units ×2 | AdMob → Ad units | `EXPO_PUBLIC_ADMOB_REWARDED_RESET_UNIT_ID_IOS/_ANDROID` |
| App Store Server API | ASC → Users & Access → Integrations | `APP_STORE_ISSUER_ID/KEY_ID/PRIVATE_KEY` |
| Play service account | Play Console → API access | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| APNs signing key | developer.apple.com → Keys | `APNS_KEY_ID/TEAM_ID/..._PRIVATE_KEY`, `APNS_ENV=production` |
| FCM server key | Firebase console → Cloud Messaging | `FCM_*` or service-account JSON |
| Dispatch secret | generate: `openssl rand -hex 32` | `REMOTE_NOTIFICATION_DISPATCH_SECRET` |

Then validate sandboxes and capture evidence (Step 6).

## Step 5 — EAS builds

```bash
npx eas-cli login
npx eas-cli init --project freed           # records EAS_PROJECT_ID / EXPO_OWNER in eas.json flow
eas build --profile internal --platform android     # AAB/APK via cloud (bypasses local CMake OOM)
eas build --profile internal --platform ios         # ad-hoc QA device build
npm run evidence:eas-build-handoff
```
Keep submissions on the internal/draft track (`scripts/eas-submit-guard.js`
enforces this until strict release evidence passes).

## Step 6 — Device & sandbox evidence (clears 6 gates)

With real credentials + hardware:
```bash
npm run evidence:android-real-browser        # android-real-browser-validation
npm run evidence:normal-browsing-corpus      # normal-browsing-corpus-validation
npm run evidence:performance-profile         # performance-validation
npm run evidence:store-ad-sandbox            # store-ad-sandbox-validation
npm run smoke:ai-backend && npm run eval:ai-safety   # ai-backend-smoke-validation
# iOS physical device requires Apple's Family Controls entitlement approval:
npm run evidence:ios-devices && npm run evidence:ios-physical-device
```

## Step 7 — Apple Family Controls entitlement (iOS blocking)

Submit the request (draft note already written):
`docs/store-policy/ios-screen-time-safari-dns-review.md` — App Store Connect →
 Certificates → request `com.apple.developer.family-controls` for
`app.freed.recovery` (+ the four Screen Time extension targets). Approval is a
hard prerequisite for iOS device validation and TestFlight distribution.

## Step 8 — Store declarations

- **Play Console**: App content → complete the **VpnService declaration**
  (category: Parental control/content filtering; attach ≤90s demo video showing
  DNS Guard blocking an adult domain while normal browsing stays open), the
  **Accessibility API declaration**, Data Safety form (drafted in
  `store/play-store/data-safety.md`), target API latest.
- **App Store**: privacy nutrition labels (`store/app-store/app-privacy.md`),
  review notes referencing the Family Controls entitlement pack.

## Final gate check

```bash
set -a; source ~/.freed/android-upload/freed-upload.env; set +a
npm run preflight:release-env && npm run audit:release
npm run verify:release
```
