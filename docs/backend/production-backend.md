# FREED Production Backend Deployment Packet

This packet is the store-launch handoff for the production backend blockers: `production-backend-infrastructure`, `production-adult-domain-feed`, `production-analytics-ingestion`, `production-notification-backend`, `production-monetization`, and `production-ai-backend`.

Do not paste real secrets into this file, release evidence, screenshots, pull requests, or store-review notes. Keep service-role keys, Redis tokens, maintenance secrets, provider keys, private keys, receipts, purchase tokens, push tokens, and user payloads only in the production secret manager or the local release env file used for smoke checks.

## Supabase Project

Use one production Supabase project for the app backend and one separate development project or branch for rehearsal. Production must have a real HTTPS project URL, a production anon key for public lockout proof, and a server-only service-role key used only by backend routes, smoke scripts, Supabase Edge Functions, and CI/release automation.

Apply the migrations in this order:

1. `supabase/migrations/20260518000100_freed_backend_core.sql`
2. `supabase/migrations/20260520000100_harden_analytics_privacy_keys.sql`

Default CLI handoff after selecting the active production project:

```sh
supabase link --project-ref <production-project-ref>
supabase db push
supabase secrets set --env-file <production-env-file>
```

`docs/backend/supabase-schema.sql` mirrors the expected production schema for review and smoke-test comparison. If Supabase migration history differs from these filenames, link the equivalent reviewed production migrations in the final evidence package and keep the schema smoke passing.

The production schema must include these service-role-only tables:

- `recovery_analytics_events`
- `adult_domain_feed_versions`
- `encrypted_recovery_backups`
- `purchase_verification_events`
- `ai_backend_events`
- `backend_job_runs`

Each table must keep RLS enabled, revoke `anon`, `authenticated`, and `public`, and grant read/write access only to `service_role`. Public anon credentials are configured only so `npm run smoke:supabase-schema` can prove those backend tables are locked out.

## Edge Functions

Deploy both Supabase Edge Functions after migrations and secrets are configured:

```sh
supabase functions deploy adult-domain-feed-sync
supabase functions deploy analytics-retention-cleanup
```

`supabase/config.toml` deliberately sets `verify_jwt = false` for `adult-domain-feed-sync` and `analytics-retention-cleanup` because scheduled cron/admin callers do not carry a Supabase user JWT. That is not an open endpoint: every non-`OPTIONS` request must still pass BACKEND_MAINTENANCE_SECRET or CRON_SECRET via `Authorization: Bearer <secret>` or `x-freed-maintenance-secret`.

The Edge Functions must use only `SUPABASE_SERVICE_ROLE_KEY`, maintenance-secret auth, reviewed adult-domain feed source URLs, optional Upstash Redis locks, bounded provider timeouts, and sanitized `backend_job_runs` metadata. They must not return the full domain list, raw browsing history, screenshots, OCR text, private notes, receipts, purchase tokens, push tokens, provider credentials, or service-role secrets.

## Required Production Env

Create a real production env file outside validation artifacts, docs, screenshots, and git. Start from `.env.production.example`, replace placeholder values, and run the preflight before any expensive release checks.

Core backend and Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `BACKEND_MAINTENANCE_SECRET` or `CRON_SECRET`
- `SUPABASE_ANALYTICS_TABLE=recovery_analytics_events`
- `SUPABASE_ADULT_FEED_TABLE=adult_domain_feed_versions`
- `SUPABASE_RECOVERY_BACKUP_TABLE=encrypted_recovery_backups`
- `SUPABASE_PURCHASE_AUDIT_TABLE=purchase_verification_events`
- `SUPABASE_AI_EVENTS_TABLE=ai_backend_events`
- `SUPABASE_JOB_RUNS_TABLE=backend_job_runs`
- `FREED_BACKEND_PROVIDER_TIMEOUT_MS`
- `FREED_BACKEND_PROVIDER_RESPONSE_MAX_BYTES`
- `FREED_SUPABASE_SCHEMA_SMOKE_TIMEOUT_MS`

Redis/Upstash:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `FREED_EDGE_JOB_LOCK_TTL_MS`

Adult-domain feed:

- `EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT=https://<deployed-origin>/api/adult-domain-feed`
- `EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED=true`
- `FREED_ADULT_DOMAIN_FEED_SOURCE_URLS` with reviewed `id|label|https://source-url` entries
- `FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS`
- `FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES`
- `FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS`
- `FREED_ADULT_DOMAIN_FEED_SMOKE_TIMEOUT_MS`

Analytics and readiness:

- `EXPO_PUBLIC_ANALYTICS_ENDPOINT=https://<deployed-origin>/api/analytics`
- `EXPO_PUBLIC_ANALYTICS_TIMEOUT_MS`
- `EXPO_PUBLIC_ANALYTICS_RESPONSE_MAX_BYTES`
- `FREED_ANALYTICS_SMOKE_TIMEOUT_MS`
- `FREED_ANALYTICS_SUPABASE_TIMEOUT_MS`
- `EXPO_PUBLIC_BACKEND_READINESS_ENDPOINT=https://<deployed-origin>/api/backend/readiness`
- `EXPO_PUBLIC_BACKEND_READINESS_TIMEOUT_MS`

Purchases, AI, and notifications:

- `EXPO_PUBLIC_PURCHASE_VERIFY_ENDPOINT=https://<deployed-origin>/api/purchases/verify`
- `FREED_PURCHASE_VERIFY_PROVIDER_TIMEOUT_MS`
- `FREED_PURCHASE_VERIFY_PROVIDER_RESPONSE_MAX_BYTES`
- `APP_STORE_BUNDLE_ID`, `APP_STORE_ISSUER_ID`, `APP_STORE_KEY_ID`, and `APP_STORE_PRIVATE_KEY` or `APP_STORE_PRIVATE_KEY_BASE64`
- `GOOGLE_PLAY_PACKAGE_NAME` and `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` or `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64`
- `FREED_AI_PROVIDER`, `OPENAI_API_KEY` and `OPENAI_MODEL`, or `GEMINI_API_KEY` and `GEMINI_MODEL`
- `REMOTE_NOTIFICATION_DISPATCH_SECRET`
- FCM credentials: `FCM_SERVER_KEY`, or `FCM_ACCESS_TOKEN` plus `FIREBASE_PROJECT_ID`, or `FIREBASE_SERVICE_ACCOUNT_JSON`
- APNs production credentials: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_ENV=production`, and `APNS_PRIVATE_KEY` or `APNS_PRIVATE_KEY_BASE64`

Never define `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, `EXPO_PUBLIC_UPSTASH_*`, `EXPO_PUBLIC_REMOTE_NOTIFICATION_DISPATCH_SECRET`, store provider private keys, AI provider keys, APNs private keys, FCM server credentials, or maintenance secrets.

## Smoke Evidence

Use a fresh run id such as `2026-06-06-prod-backend` and store only sanitized JSON reports under `docs/validation/artifacts/<run-id>/`.

```sh
npm run evidence:supabase-deploy-packet -- --report docs/validation/artifacts/<run-id>/supabase-deployment-packet.json
npm run preflight:release-env -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/release-env-preflight-report.json
npm run smoke:backend-readiness -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/backend-readiness-smoke-report.json
npm run smoke:supabase-schema -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/supabase-schema-smoke-report.json
npm run smoke:adult-domain-feed -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/adult-domain-feed-smoke-report.json
npm run smoke:analytics-ingestion -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/analytics-ingestion-smoke-report.json
npm run smoke:remote-notifications -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/remote-notification-smoke-report.json
npm run smoke:purchase-verification -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/purchase-verification-smoke-report.json
npm run smoke:ai-backend -- --env-file <production-env-file> --report docs/validation/artifacts/<run-id>/ai-backend-smoke-report.json
```

Expected evidence boundaries:

- `supabase-deployment-packet.json` has `sanitized=true`, inventories the local migration/function/config file hashes, confirms RLS/revoke/service-role-only table contracts, confirms the `verify_jwt = false` plus maintenance-secret Edge Function boundary, imports the canonical release blocker/env checklist handoff for backend, adult-feed, analytics, notifications, monetization, and AI, records required deploy/smoke commands, and keeps the live Supabase project target pending until an active FREED production project is explicitly selected.
- `release-env-preflight-report.json` has `sanitized=true`, rejects placeholder values, rejects server-secret leakage through `EXPO_PUBLIC_*`, and marks Supabase, Redis, adult-domain feed, analytics, purchases, AI, notifications, and signing env groups ready.
- `backend-readiness-smoke-report.json` proves `/api/backend/readiness` returns `Cache-Control: no-store`, `returnsSecrets=false`, checked key names only, and no secret values.
- `supabase-schema-smoke-report.json` proves the six backend tables and required columns are visible to service-role credentials, public anon clients are denied, `limit=0` is used, and no row payloads or secrets are echoed.
- `adult-domain-feed-smoke-report.json` proves reviewed-source freshness, required headers, checksum/ETag behavior, conditional 304, Safari content-blocker export, source-size bounds, and metadata-only source reports.
- `analytics-ingestion-smoke-report.json` proves aggregate-only analytics ingestion with opt-in privacy boundaries and no raw URLs, screenshots, private notes, contact details, tokens, receipts, or browsing history.
- `remote-notification-smoke-report.json` proves unauthorized rejection and preset-only payload validation without sending a push.
- `purchase-verification-smoke-report.json` proves the deployed `/api/purchases/verify` endpoint fails closed for synthetic invalid products/tokens, redacts receipt/token/order/package values, checks only server-secret key names, and returns no provider secrets.
- Store, AI, physical-device, and performance reports must pass before production submission, even if the backend reports pass.

## Launch Decision

Do not submit production builds until all of these are true:

- `npm run audit:backend` reports `16 pass, 0 fail`.
- `npm run audit:release:strict -- --report docs/validation/artifacts/<run-id>/release-readiness-strict-report.json` reports no failures.
- Production env preflight and every backend smoke report above has `failCount=0`.
- Android and iOS physical-device protection evidence has been captured.
- Store sandbox yearly, monthly, and lifetime purchases verify server-side and restore correctly.
- Privacy policy, Play Data Safety, App Store privacy answers, Accessibility/VPN/Screen Time/Safari review notes, and screenshot evidence match the actual production behavior.
