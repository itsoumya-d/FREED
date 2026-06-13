# FREED Supabase Edge Functions

These functions are deployable Supabase cron/admin companions for the Expo API routes. They use Deno `Deno.serve`, server-only Supabase service-role credentials, and the same privacy boundary as the app backend.

`supabase/config.toml` sets `verify_jwt = false` for these two functions because cron callers do not carry Supabase user JWTs. Do not remove the in-function maintenance-secret check: every non-`OPTIONS` request still requires `BACKEND_MAINTENANCE_SECRET` or `CRON_SECRET` through `Authorization: Bearer ...` or `x-freed-maintenance-secret`.

## Functions

- `adult-domain-feed-sync`: fetches reviewed adult-domain source feeds, rejects normal-domain leaks, writes sanitized feed-version metadata to `adult_domain_feed_versions`, records a sanitized `backend_job_runs` row, and never returns or stores the full domain list.
- `analytics-retention-cleanup`: deletes only rows where `expires_at < now()` from aggregate/backend tables, records a sanitized `backend_job_runs` row, and returns table/count status only.

## Required Secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BACKEND_MAINTENANCE_SECRET` or `CRON_SECRET`
- `FREED_ADULT_DOMAIN_FEED_SOURCE_URLS` for feed sync, one reviewed HTTPS source per line: `oisd-nsfw|OISD NSFW|https://reviewed-feed-origin/path.txt`
- Optional `FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS` and `FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES` to bound each reviewed source fetch by time and response size.

Optional table/env overrides match `.env.production.example`: `SUPABASE_ANALYTICS_TABLE`, `SUPABASE_ADULT_FEED_TABLE`, `SUPABASE_RECOVERY_BACKUP_TABLE`, `SUPABASE_PURCHASE_AUDIT_TABLE`, `SUPABASE_AI_EVENTS_TABLE`, and `SUPABASE_JOB_RUNS_TABLE`.

When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, both functions acquire a short-lived Redis lock before running so scheduled cron invocations do not overlap. `FREED_EDGE_JOB_LOCK_TTL_MS` controls the lock TTL and `FREED_BACKEND_PROVIDER_TIMEOUT_MS` bounds Redis calls.

## Local Serve

```sh
supabase functions serve adult-domain-feed-sync --env-file supabase/functions/.env.local
supabase functions serve analytics-retention-cleanup --env-file supabase/functions/.env.local
```

## Deploy

```sh
supabase functions deploy adult-domain-feed-sync
supabase functions deploy analytics-retention-cleanup
```

The deploy commands rely on `supabase/config.toml` for `verify_jwt = false`. If deploying through a dashboard or MCP tool instead of the CLI, keep JWT verification disabled only for these cron/admin functions and preserve the custom maintenance-secret auth in the function body.

Call either function with `Authorization: Bearer <BACKEND_MAINTENANCE_SECRET>` or `x-freed-maintenance-secret: <BACKEND_MAINTENANCE_SECRET>`.

These functions do not do screenshot analysis, OCR, packet inspection, MITM HTTPS, full VPN routing, or raw browsing-history persistence.
