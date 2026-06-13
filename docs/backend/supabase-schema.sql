-- FREED production backend schema slice.
-- Apply in Supabase/PostgreSQL for aggregate-only analytics ingestion,
-- reviewed adult-domain feed publication, encrypted recovery backup sync,
-- sanitized store verification audit records, redacted AI backend smoke/usage
-- events, and backend job runs.
--
-- These tables intentionally store no raw browsing URLs, private notes,
-- support contacts, receipts, purchase tokens, screenshots, transcripts,
-- provider prompts, provider API keys, passphrases, or precise location.
-- Server routes use service-role credentials only; never expose
-- SUPABASE_SERVICE_ROLE_KEY or provider secrets through EXPO_PUBLIC_* variables.

create extension if not exists pgcrypto;

create or replace function public.freed_jsonb_has_forbidden_normalized_keys(payload jsonb, forbidden_keys text[])
returns boolean
language plpgsql
immutable
as $function$
declare
  normalized_key text;
  child_value jsonb;
begin
  if payload is null then
    return false;
  end if;

  if jsonb_typeof(payload) = 'object' then
    for normalized_key, child_value in
      select regexp_replace(lower(entry.item_key), '[^a-z0-9]', '', 'g'), entry.item_value
      from jsonb_each(payload) as entry(item_key, item_value)
    loop
      if normalized_key = any(forbidden_keys) then
        return true;
      end if;
      if public.freed_jsonb_has_forbidden_normalized_keys(child_value, forbidden_keys) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(payload) = 'array' then
    for child_value in
      select entry.item_value from jsonb_array_elements(payload) as entry(item_value)
    loop
      if public.freed_jsonb_has_forbidden_normalized_keys(child_value, forbidden_keys) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$function$;

create table if not exists public.recovery_analytics_events (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null check (schema_version = 'aggregate-v5'),
  generated_for_date_key date not null,
  consent_version text not null,
  user_opted_in_at timestamptz not null,
  data_retention_days integer not null check (data_retention_days between 1 and 30),
  snapshot jsonb not null,
  received_at timestamptz not null default now(),
  expires_at timestamptz generated always as (received_at + make_interval(days => data_retention_days)) stored,
  constraint recovery_analytics_events_privacy_flags check (
    snapshot #>> '{privacy,aggregateOnly}' = 'true'
    and snapshot #>> '{privacy,excludesPrivateNotes}' = 'true'
    and snapshot #>> '{privacy,excludesBrowsingDetails}' = 'true'
    and snapshot #>> '{privacy,excludesSupportContacts}' = 'true'
  ),
  constraint recovery_analytics_events_schema_match check (
    snapshot ->> 'schemaVersion' = schema_version
  ),
  constraint recovery_analytics_events_no_raw_payload_keys check (
    not public.freed_jsonb_has_forbidden_normalized_keys(snapshot, array[
      'attempts',
      'attempthistory',
      'relapserecords',
      'dailycheckins',
      'dailyhabits',
      'reflection',
      'reflections',
      'privatereflection',
      'note',
      'notes',
      'privatenotes',
      'privatejournal',
      'contact',
      'contacts',
      'supportcircle',
      'supportcontacts',
      'accountability',
      'accountabilitycontacts',
      'messagetemplate',
      'phone',
      'phonenumber',
      'email',
      'emailaddress',
      'useremail',
      'url',
      'urls',
      'rawurl',
      'rawhost',
      'host',
      'hostname',
      'hosts',
      'domain',
      'domains',
      'browsinghistory',
      'browserhistory',
      'visitedurl',
      'conversationtranscript',
      'transcript',
      'transcripts',
      'token',
      'accesstoken',
      'refreshtoken',
      'idtoken',
      'authtoken',
      'jwt',
      'apikey',
      'secret',
      'servicerolekey',
      'purchasetoken',
      'rawpurchasetoken',
      'googlepurchasetoken',
      'receipt',
      'receipts',
      'receiptdata',
      'rawreceipt',
      'iosreceipt',
      'appstorereceipt',
      'transactionreceipt'
    ])
  ),
  constraint recovery_analytics_events_production_metrics check (
    jsonb_typeof(snapshot -> 'productionMetrics') = 'object'
    and (snapshot #>> '{productionMetrics,appOpens}') is not null
    and (snapshot #>> '{productionMetrics,appForegroundMinutes}') is not null
    and (snapshot #>> '{productionMetrics,blockedAttempts}') is not null
    and case
      when jsonb_typeof(snapshot #> '{productionMetrics,blockedAttemptSourceBreakdown}') = 'array' then
        jsonb_array_length(snapshot #> '{productionMetrics,blockedAttemptSourceBreakdown}') = 5
        and jsonb_path_exists(snapshot #> '{productionMetrics,blockedAttemptSourceBreakdown}', '$[*] ? (@.source == "browser")')
        and jsonb_path_exists(snapshot #> '{productionMetrics,blockedAttemptSourceBreakdown}', '$[*] ? (@.source == "search")')
        and jsonb_path_exists(snapshot #> '{productionMetrics,blockedAttemptSourceBreakdown}', '$[*] ? (@.source == "manual-check")')
        and jsonb_path_exists(snapshot #> '{productionMetrics,blockedAttemptSourceBreakdown}', '$[*] ? (@.source == "panic-button")')
        and jsonb_path_exists(snapshot #> '{productionMetrics,blockedAttemptSourceBreakdown}', '$[*] ? (@.source == "app")')
      else false
    end
    and (snapshot #>> '{productionMetrics,challengeCompletions}') is not null
    and (snapshot #>> '{productionMetrics,earnedUnlocks}') is not null
    and (snapshot #>> '{productionMetrics,unlockFrequencyPerWeek}') is not null
    and case
      when jsonb_typeof(snapshot #> '{productionMetrics,streakHistory}') = 'array' then
        jsonb_array_length(snapshot #> '{productionMetrics,streakHistory}') = 7
        and not jsonb_path_exists(snapshot #> '{productionMetrics,streakHistory}', '$[*] ? (!exists(@.dateKey) || !exists(@.streakDays) || !exists(@.relapseResets))')
      else false
    end
    and (snapshot #>> '{productionMetrics,relapseResetRate}') is not null
    and (snapshot #> '{productionMetrics,daysSinceLastRelapse}') is not null
    and jsonb_typeof(snapshot #> '{productionMetrics,hourlyUrgePattern}') = 'array'
    and jsonb_typeof(snapshot #> '{productionMetrics,challengeSuccessByCategory}') = 'array'
    and (snapshot #>> '{productionMetrics,recoveryScore}') is not null
  )
);

create index if not exists recovery_analytics_events_generated_for_date_key_idx
  on public.recovery_analytics_events (generated_for_date_key);

create index if not exists recovery_analytics_events_expires_at_idx
  on public.recovery_analytics_events (expires_at);

alter table public.recovery_analytics_events enable row level security;

create table if not exists public.adult_domain_feed_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  checksum text not null unique,
  generated_at timestamptz not null,
  domain_count integer not null check (domain_count between 1 and 50000),
  safari_rule_count integer not null default 0 check (safari_rule_count between 0 and 50000),
  rejected_normal_domain_count integer not null default 0 check (rejected_normal_domain_count >= 0),
  source_reports jsonb not null default '[]'::jsonb,
  readiness jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint adult_domain_feed_versions_source_reports_array check (
    jsonb_typeof(source_reports) = 'array'
  ),
  constraint adult_domain_feed_versions_readiness_object check (
    jsonb_typeof(readiness) = 'object'
  )
);

create index if not exists adult_domain_feed_versions_generated_at_idx
  on public.adult_domain_feed_versions (generated_at desc);

create index if not exists adult_domain_feed_versions_checksum_idx
  on public.adult_domain_feed_versions (checksum);

alter table public.adult_domain_feed_versions enable row level security;

create table if not exists public.encrypted_recovery_backups (
  user_hash text primary key check (user_hash ~ '^sha256-[0-9a-f]{64}$'),
  envelope_version integer not null check (envelope_version = 1),
  envelope jsonb not null,
  backup_created_at timestamptz not null,
  device_hash text check (device_hash is null or device_hash ~ '^sha256-[0-9a-f]{64}$'),
  client_modified_at timestamptz,
  synced_at timestamptz not null default now(),
  retention_days integer not null default 365 check (retention_days between 1 and 365),
  expires_at timestamptz generated always as (synced_at + make_interval(days => retention_days)) stored,
  constraint encrypted_recovery_backups_envelope_shape check (
    envelope ->> 'app' = 'FREED'
    and (envelope ->> 'version')::integer = envelope_version
    and envelope #>> '{kdf,name}' = 'PBKDF2-SHA256'
    and envelope #>> '{cipher,name}' = 'AES-GCM'
    and envelope ? 'payload'
  ),
  constraint encrypted_recovery_backups_no_raw_payload_keys check (
    not (
      envelope ?| array[
        'state',
        'attempts',
        'relapseRecords',
        'dailyCheckIns',
        'privateNotes',
        'supportCircle',
        'messageTemplate',
        'url',
        'urls',
        'domain',
        'domains',
        'transcript',
        'receipt',
        'purchaseToken',
        'passphrase',
        'apiKey'
      ]
    )
  )
);

create index if not exists encrypted_recovery_backups_synced_at_idx
  on public.encrypted_recovery_backups (synced_at desc);

create index if not exists encrypted_recovery_backups_expires_at_idx
  on public.encrypted_recovery_backups (expires_at);

alter table public.encrypted_recovery_backups enable row level security;

create table if not exists public.purchase_verification_events (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('ios', 'android')),
  store_environment text not null check (store_environment in ('sandbox', 'production')),
  product_id text not null,
  entitlement_id text not null,
  verification_status text not null check (verification_status in ('granted', 'rejected', 'error')),
  transaction_id_hash text,
  order_id_hash text,
  purchase_token_hash text,
  failure_code text,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint purchase_verification_events_hash_shape check (
    (transaction_id_hash is null or transaction_id_hash ~ '^sha256-[0-9a-f]{64}$')
    and (order_id_hash is null or order_id_hash ~ '^sha256-[0-9a-f]{64}$')
    and (purchase_token_hash is null or purchase_token_hash ~ '^sha256-[0-9a-f]{64}$')
  )
);

create index if not exists purchase_verification_events_verified_at_idx
  on public.purchase_verification_events (verified_at desc);

create index if not exists purchase_verification_events_product_status_idx
  on public.purchase_verification_events (product_id, verification_status);

alter table public.purchase_verification_events enable row level security;

create table if not exists public.ai_backend_events (
  id uuid primary key default gen_random_uuid(),
  route text not null check (route in ('clara', 'challenges', 'retention', 'smoke')),
  provider text not null,
  model text not null,
  request_kind text not null,
  safety_eval_passed boolean,
  redaction_passed boolean not null default true,
  crisis_fallback_used boolean not null default false,
  prompt_token_count integer check (prompt_token_count is null or prompt_token_count >= 0),
  response_token_count integer check (response_token_count is null or response_token_count >= 0),
  payload_summary jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint ai_backend_events_payload_summary_object check (
    jsonb_typeof(payload_summary) = 'object'
  ),
  constraint ai_backend_events_no_sensitive_payload_keys check (
    not (
      payload_summary ?| array[
        'rawPrompt',
        'prompt',
        'privateNotes',
        'transcript',
        'url',
        'urls',
        'domain',
        'domains',
        'receipt',
        'purchaseToken',
        'apiKey'
      ]
    )
  )
);

create index if not exists ai_backend_events_route_received_at_idx
  on public.ai_backend_events (route, received_at desc);

create index if not exists ai_backend_events_expires_at_idx
  on public.ai_backend_events (expires_at);

alter table public.ai_backend_events enable row level security;

create table if not exists public.backend_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (
    job_name in (
      'adult-domain-feed-sync',
      'analytics-retention-cleanup',
      'ai-backend-smoke',
      'purchase-verification-smoke',
      'performance-evidence-ingest'
    )
  ),
  idempotency_key text not null unique,
  status text not null check (status in ('started', 'succeeded', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint backend_job_runs_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint backend_job_runs_no_sensitive_metadata_keys check (
    not (
      metadata ?| array[
        'rawUrl',
        'privateNotes',
        'transcript',
        'receipt',
        'purchaseToken',
        'apiKey',
        'serviceRoleKey'
      ]
    )
  )
);

create index if not exists backend_job_runs_job_started_idx
  on public.backend_job_runs (job_name, started_at desc);

alter table public.backend_job_runs enable row level security;

-- FREED backend tables are service-role only. RLS stays enabled as defense in
-- depth, while public client roles are explicitly denied Data API access.
revoke all on table public.recovery_analytics_events from anon, authenticated, public;
revoke all on table public.adult_domain_feed_versions from anon, authenticated, public;
revoke all on table public.encrypted_recovery_backups from anon, authenticated, public;
revoke all on table public.purchase_verification_events from anon, authenticated, public;
revoke all on table public.ai_backend_events from anon, authenticated, public;
revoke all on table public.backend_job_runs from anon, authenticated, public;

grant select, insert, update, delete on table public.recovery_analytics_events to service_role;
grant select, insert, update, delete on table public.adult_domain_feed_versions to service_role;
grant select, insert, update, delete on table public.encrypted_recovery_backups to service_role;
grant select, insert, update, delete on table public.purchase_verification_events to service_role;
grant select, insert, update, delete on table public.ai_backend_events to service_role;
grant select, insert, update, delete on table public.backend_job_runs to service_role;

-- Deployable Supabase Edge Function / cron jobs are provided in supabase/functions:
-- 1. adult-domain-feed-sync: fetch reviewed source lists, reject normal-domain
--    leaks, and publish sanitized adult_domain_feed_versions metadata without
--    storing or returning the full adult-domain list.
-- 2. analytics-retention-cleanup: delete rows from tables where expires_at < now(),
--    including expired encrypted_recovery_backups rows when hosted sync is enabled.
-- 3. ai-backend-smoke and purchase-verification-smoke: write sanitized run
--    summaries only, never raw prompts, receipts, tokens, or provider secrets.
--
-- Recommended Redis/Upstash usage:
-- - rate limits for public API routes,
-- - adult-domain feed sync locks,
-- - idempotency keys for store verification,
-- - short-lived smoke/evidence job coordination.
-- Redis must not cache browsing history, recovery notes, screenshots,
-- transcripts, support contacts, receipts, purchase tokens, or precise
-- location.
