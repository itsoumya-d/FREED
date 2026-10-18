# Adult-Domain Feed — Live Deployment (Firebase Hosting, $0)

STATUS: DEPLOYED AND LIVE as of 2026-08-26.

- Endpoint: https://freed-landing.web.app/api/adult-domain-feed
- Custom-domain form (once DNS is live): https://freedrecovery.app/api/adult-domain-feed
- Current content: 21,394 reviewed domains (OISD NSFW Small), checksum `fnv1a32:0a9268b0`

## How it works (no server, no cost)

Instead of a serverless route (Cloud Functions requires the Blaze billing
plan), the feed is a **static JSON file** served by Firebase Hosting on the
free Spark plan:

1. `scripts/build-adult-feed-static.ts` fetches OISD NSFW Small, normalizes
   domains through the app's own `createAdultDomainFeed` (same normalization,
   allowlist stripping, 50k cap, and FNV checksum as the client), and writes
   `website/adult-domain-feed.json`.
2. Firebase Hosting serves it at `/api/adult-domain-feed` via a rewrite
   (firebase.json, `landing` target).
3. Devices fetch it every 12h on foreground; the client validates freshness
   (≤48h), checksum, and size, and falls back to the embedded seed on any
   problem (fail-safe).

## Refresh cadence

The feed's `generatedAt` must be newer than 48h. Refresh paths:

- **Automatic (recommended):** `.github/workflows/refresh-adult-feed.yml`
  rebuilds + redeploys daily at 03:00 UTC. One-time setup: add a Firebase
  service-account JSON (role: Hosting Admin) as the GitHub secret
  `FIREBASE_SERVICE_ACCOUNT` on github.com/itsoumya-d/FREED.
- **Manual:** `npm run deploy:landing`

## Client env

- `.env.example` (dev): `EXPO_PUBLIC_ADULT_DOMAIN_FEED_ENDPOINT=https://freed-landing.web.app/api/adult-domain-feed`
- `.env.production.example`: `https://freedrecovery.app/api/adult-domain-feed`
- EAS builds: set the same key in `eas.json` env or project secrets.

## Verified

- `GET /api/adult-domain-feed` → 200, valid JSON, checksum matches content.
- `resolveAdultDomainFeed()` against the live endpoint returns
  `provider=remote` with 21,394 domains and no warnings.

## Why not the alternatives

- Cloud Functions route (`app/api/adult-domain-feed+api.ts`): needs Blaze
  billing (card) — deferred until the user opts into Google Cloud billing.
- Vercel: also viable, but Firebase Hosting needed no new account/auth.
