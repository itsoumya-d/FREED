# FREED Supabase Current State

Generated: 2026-06-07

This is a read-only account-state snapshot for the production backend launch blocker. It contains project refs and statuses only; it does not contain Supabase keys, service-role credentials, anon JWTs, Redis tokens, maintenance secrets, or user data.

## Account State

- Organization: `anio ai`
- Organization id: `ektqabkdxsvleeipxmqq`

Known projects:

| Project | Ref | Region | Status | Created |
| --- | --- | --- | --- | --- |
| `anio_ai` | `apoxvenuvpgehgsqtbqo` | `ap-south-1` | `INACTIVE` | `2025-08-21T01:35:03.582607Z` |
| `itsoumya-d's Project` | `okjvivlbawbfdacetsez` | `us-west-1` | `INACTIVE` | `2025-08-21T00:53:34.949531Z` |

## Current Packet

- Report: `supabase-deployment-packet.json`
- Schema: `freed-supabase-deployment-packet-v1`
- Result: `13 pass, 1 warn, 0 fail`
- Warning: production Supabase project selection is pending.

## Launch Implication

FREED cannot pass `production-backend-infrastructure`, `production-adult-domain-feed`, `production-analytics-ingestion`, `production-monetization`, `production-notification-backend`, or backend smoke gates until an active production Supabase project is selected or created.

Do not deploy migrations or Edge Functions into the inactive projects above unless the owner explicitly chooses one, confirms it is the FREED production project, and restores it to active/healthy status first.

## Next Account Action

Choose one path:

- Create a new production Supabase project named for FREED in organization `anio ai` after cost confirmation.
- Restore one existing inactive project, confirm billing/region/ownership, rename or document it as the FREED production project, then rerun the deployment packet with `--project-ref <ref> --project-status active`.

After an active project exists, use the handoff in `docs/backend/production-backend.md`: link the project, apply migrations, set secrets from a production env file outside git, deploy `adult-domain-feed-sync` and `analytics-retention-cleanup`, then run the sanitized backend smoke reports.
