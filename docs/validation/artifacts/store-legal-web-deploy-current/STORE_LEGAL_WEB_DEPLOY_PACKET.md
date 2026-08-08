# Store Legal Web Deploy Packet: store-legal-web-deploy-current

Generated: 2026-07-22T02:46:10.365Z
Result: static-export-ready-deploy-blocked
Static export ready: true
Hosted URLs verified: false
Ready for approved deploy: false
Deploy blocked by: dns-not-resolving, eas-project-id-not-configured, eas-account-not-logged-in, eas-project-not-linked, eas-legal-web-readiness-stale

## Public URLs

| Route | Public URL | Static HTML | SHA-256 | Hosted Status |
| --- | --- | --- | --- | --- |
| /privacy | https://freedrecovery.app/privacy | dist/privacy.html | sha256-009b086671a37b3bee3e9e28bb54677f688d94e49e2cbd4ae27cf67236de430d | not reachable |
| /support | https://freedrecovery.app/support | dist/support.html | sha256-0e98e4c0bb4cd639ace95dba0a1c4f5ce83f6fa273be1a04aeffd631ed049b9d | not reachable |
| /account-deletion | https://freedrecovery.app/account-deletion | dist/account-deletion.html | sha256-65562cdd19c3325cd7796865d5f76abb114d4bb627a370d59dc33e60b8091e6b | not reachable |

## Manual Static Hosting Handoff

- Deploy root: `dist`
- Clean URL routing ready: true
- Store legal URL entry allowed after deploy/audit: false

| Route | Required Mapping | Static HTML | SHA-256 |
| --- | --- | --- | --- |
| /privacy | /privacy -> /privacy.html | dist/privacy.html | sha256-009b086671a37b3bee3e9e28bb54677f688d94e49e2cbd4ae27cf67236de430d |
| /support | /support -> /support.html | dist/support.html | sha256-0e98e4c0bb4cd639ace95dba0a1c4f5ce83f6fa273be1a04aeffd631ed049b9d |
| /account-deletion | /account-deletion -> /account-deletion.html | dist/account-deletion.html | sha256-65562cdd19c3325cd7796865d5f76abb114d4bb627a370d59dc33e60b8091e6b |

| Config | Source | Exported | Source SHA-256 | Export SHA-256 |
| --- | --- | --- | --- | --- |
| netlify-cloudflare-clean-url-redirects | public/_redirects | dist/_redirects | sha256-c74f827165029e1a5d58b362ed5e39ad5784672d8f677ed6251d9ff21f0745ae | sha256-c74f827165029e1a5d58b362ed5e39ad5784672d8f677ed6251d9ff21f0745ae |
| netlify-cloudflare-crawler-headers | public/_headers | dist/_headers | sha256-38a658e0add51b5d95ee41e0625fb8a1b8118bd018a2d32755c576ef70e0e225 | sha256-38a658e0add51b5d95ee41e0625fb8a1b8118bd018a2d32755c576ef70e0e225 |
| vercel-clean-url-rewrites | vercel.json | repo-root only | sha256-d1521eb6aba607080aa7f61edf071b4f47b3d605f71da0cddd8a30153c6a9fce | n/a |

- Upload the deploy root contents as the site root, not the repository root.
- Netlify and Cloudflare Pages can use the exported _redirects and _headers files in the deploy root.
- Vercel can use vercel.json cleanUrls, rewrites, and crawler headers from the repository root.
- Any other static host must serve /privacy, /support, and /account-deletion as direct HTTPS 2xx HTML without requiring .html suffixes.

Post-deploy audit order:

- Confirm freedrecovery.app DNS points to the selected static host.
- Wait for TLS certificate issuance on https://freedrecovery.app.
- Run npm run audit:store-legal-hosted -- --report docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json.
- Run npm run evidence:store-legal-web-deploy -- --run-id store-legal-web-deploy-current --output-dir docs/validation/artifacts/store-legal-web-deploy-current.
- Run npm run status:launch -- --run-id launch-status-current --output-dir docs/validation/artifacts/launch-status-current.

## Static Hosting Bundle

- Bundle dir: `docs/validation/artifacts/store-legal-web-deploy-current/static-hosting-bundle`
- Archive created: true
- Archive: `docs/validation/artifacts/store-legal-web-deploy-current/freed-store-legal-web-static-bundle.zip`
- Archive SHA-256: `sha256-e3429564e5d015cb0d0c37ed0dc5db8bb5c70610675ab6e3394052b4bd6a8330`
- Manifest: `docs/validation/artifacts/store-legal-web-deploy-current/static-hosting-bundle/static-hosting-manifest.json`
- Manifest SHA-256: `sha256-77323eb122ae54e95cbd13a2b745f90441247d064edf6e49308ac108f223c531`
- Included files: 8
- Total bytes: 82282

| Kind | Target | Bytes | SHA-256 |
| --- | --- | --- | --- |
| legal-route-html | privacy.html | 26133 | sha256-009b086671a37b3bee3e9e28bb54677f688d94e49e2cbd4ae27cf67236de430d |
| legal-route-html | support.html | 24300 | sha256-0e98e4c0bb4cd639ace95dba0a1c4f5ce83f6fa273be1a04aeffd631ed049b9d |
| legal-route-html | account-deletion.html | 24067 | sha256-65562cdd19c3325cd7796865d5f76abb114d4bb627a370d59dc33e60b8091e6b |
| hosting-route-config | _redirects | 201 | sha256-c74f827165029e1a5d58b362ed5e39ad5784672d8f677ed6251d9ff21f0745ae |
| hosting-route-config | _headers | 482 | sha256-38a658e0add51b5d95ee41e0625fb8a1b8118bd018a2d32755c576ef70e0e225 |
| hosting-route-config | vercel.json | 1361 | sha256-d1521eb6aba607080aa7f61edf071b4f47b3d605f71da0cddd8a30153c6a9fce |
| bundle-manifest | static-hosting-manifest.json | 5280 | sha256-77323eb122ae54e95cbd13a2b745f90441247d064edf6e49308ac108f223c531 |
| bundle-readme | STATIC_HOSTING_README.md | 458 | sha256-1e084f5586793196899ae9cd4e2a3c7efe0626f000c21da45b375b7ea7026a0c |

## Deployment Commands

Run these after choosing the static host and configuring the production domain:

```bash
npm run export:web
npm run audit:store-legal-web -- --report docs/validation/artifacts/store-legal-web-current/store-legal-web-export-audit.json
npm run eas:deploy:legal-web -- --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json
FREED_LEGAL_WEB_DEPLOY_APPROVED=ready-to-deploy-legal-pages npm run eas:deploy:legal-web -- --deploy --report docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json
npm run audit:store-legal-hosted -- --report docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json
npm run status:launch -- --run-id launch-status-current --output-dir docs/validation/artifacts/launch-status-current
```

## DNS And Hosting Checklist

- Select the static hosting target for the Expo web export and attach the custom domain freedrecovery.app.
- Create the provider-required apex A/AAAA/ALIAS/ANAME or CNAME records for freedrecovery.app.
- Optionally route www.freedrecovery.app to freedrecovery.app with HTTPS redirect.
- Wait for DNS propagation and TLS certificate issuance before entering URLs in App Store Connect or Play Console.
- Verify /privacy, /support, and /account-deletion return direct HTTPS 2xx HTML without noindex.
- Rerun the hosted legal URL audit and refresh launch status after deployment.

## Legal Web Deploy Env Template

- Template: `docs/validation/artifacts/store-legal-web-deploy-current/LEGAL_WEB_DEPLOY_ENV.template.env`
- SHA-256: `sha256-b9c577207f29d3ae4510eb523587c1f85ccd0852aee27b9482862420e8dc00ff`
- Keys: `EAS_PROJECT_ID`, `EXPO_PROJECT_ID`, `EXPO_OWNER`, `EXPO_TOKEN`
- Approval env: FREED_LEGAL_WEB_DEPLOY_APPROVED=ready-to-deploy-legal-pages
- Active approval prefilled: false

## EAS Deploy Readiness

- Artifact: docs/validation/artifacts/store-legal-web-deploy-current/eas-legal-web-deploy-readiness.json
- Generated: 2026-06-11T03:03:18.666Z
- Result: blocked-before-deploy
- Source freshness: stale-source-report
- Usable for current source reports: false
- Ready for approved deploy: false
- Ready for current approved deploy: false
- Deployment attempted: false
- EAS account logged in: false
- EAS project ID configured: false
- EAS project ID source: app.config.js:env-projectId-marker
- EAS project ID format: env-missing
- EAS project linked: false
- Approval env: FREED_LEGAL_WEB_DEPLOY_APPROVED=ready-to-deploy-legal-pages
- Approval set now: false
- Source freshness reason: web-export-report-newer-than-eas-readiness
- Newer source report: web-export-report (2026-07-22T02:46:09.941Z)
- EAS deploy blocked by: eas-project-id-not-configured, eas-account-not-logged-in, eas-project-not-linked, eas-legal-web-readiness-stale
- Boundary: EAS legal web deploy readiness only. This does not prove DNS ownership, custom-domain attachment, TLS issuance, hosted URL availability, legal review, store-console entry, platform approval, sandbox purchases, or physical-device evidence.

## Current Hosted Failures

- hosted-fetch-privacy: https://freedrecovery.app/privacy could not be fetched: fetch failed; code=ENOTFOUND; host=freedrecovery.app
  - Next: Deploy the static web export, verify DNS/CDN routing, then rerun the hosted legal URL audit.
- hosted-fetch-support: https://freedrecovery.app/support could not be fetched: fetch failed; code=ENOTFOUND; host=freedrecovery.app
  - Next: Deploy the static web export, verify DNS/CDN routing, then rerun the hosted legal URL audit.
- hosted-fetch-account-deletion: https://freedrecovery.app/account-deletion could not be fetched: fetch failed; code=ENOTFOUND; host=freedrecovery.app
  - Next: Deploy the static web export, verify DNS/CDN routing, then rerun the hosted legal URL audit.

## Boundary

Deployment handoff only. This does not prove DNS ownership, TLS issuance, hosted URL availability, legal review, store-console entry, platform approval, sandbox purchases, or physical-device evidence.

Do not enter these URLs in store-console production fields until the hosted audit passes and launch status is refreshed.

