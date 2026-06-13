# Store Legal Web Deploy Packet: store-legal-web-deploy-current

Generated: 2026-06-11T03:03:27.637Z
Result: static-export-ready-deploy-blocked
Static export ready: true
Hosted URLs verified: false
Ready for approved deploy: false
Deploy blocked by: dns-not-resolving, eas-project-id-not-configured, eas-account-not-logged-in, eas-project-not-linked

## Public URLs

| Route | Public URL | Static HTML | SHA-256 | Hosted Status |
| --- | --- | --- | --- | --- |
| /privacy | https://freedrecovery.app/privacy | dist/privacy.html | sha256-23d6a477278fc04fe0269378c83b8fe040224878c5d5e8668d8a95694de81e5b | not reachable |
| /support | https://freedrecovery.app/support | dist/support.html | sha256-dc41a86b82ca7fca3a8096de5ace864ef22924f08c02519545fdef1fbb66cc69 | not reachable |
| /account-deletion | https://freedrecovery.app/account-deletion | dist/account-deletion.html | sha256-89316b39748a776f2fac427af59ccc8eced7a2bfe6e9b7ad35de07a6f7ac9c99 | not reachable |

## Manual Static Hosting Handoff

- Deploy root: `dist`
- Clean URL routing ready: true
- Store legal URL entry allowed after deploy/audit: false

| Route | Required Mapping | Static HTML | SHA-256 |
| --- | --- | --- | --- |
| /privacy | /privacy -> /privacy.html | dist/privacy.html | sha256-23d6a477278fc04fe0269378c83b8fe040224878c5d5e8668d8a95694de81e5b |
| /support | /support -> /support.html | dist/support.html | sha256-dc41a86b82ca7fca3a8096de5ace864ef22924f08c02519545fdef1fbb66cc69 |
| /account-deletion | /account-deletion -> /account-deletion.html | dist/account-deletion.html | sha256-89316b39748a776f2fac427af59ccc8eced7a2bfe6e9b7ad35de07a6f7ac9c99 |

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
- Archive SHA-256: `sha256-d0362e54847dd15d0585e58fa7c81e6ee3209eee1410b2987aa22ac94d761633`
- Manifest: `docs/validation/artifacts/store-legal-web-deploy-current/static-hosting-bundle/static-hosting-manifest.json`
- Manifest SHA-256: `sha256-00a9ccda77f2f2b10f2f73e029afb5c7ea053c36ef3296c2eaee5f4d734574ae`
- Included files: 8
- Total bytes: 82282

| Kind | Target | Bytes | SHA-256 |
| --- | --- | --- | --- |
| legal-route-html | privacy.html | 26133 | sha256-23d6a477278fc04fe0269378c83b8fe040224878c5d5e8668d8a95694de81e5b |
| legal-route-html | support.html | 24300 | sha256-dc41a86b82ca7fca3a8096de5ace864ef22924f08c02519545fdef1fbb66cc69 |
| legal-route-html | account-deletion.html | 24067 | sha256-89316b39748a776f2fac427af59ccc8eced7a2bfe6e9b7ad35de07a6f7ac9c99 |
| hosting-route-config | _redirects | 201 | sha256-c74f827165029e1a5d58b362ed5e39ad5784672d8f677ed6251d9ff21f0745ae |
| hosting-route-config | _headers | 482 | sha256-38a658e0add51b5d95ee41e0625fb8a1b8118bd018a2d32755c576ef70e0e225 |
| hosting-route-config | vercel.json | 1361 | sha256-d1521eb6aba607080aa7f61edf071b4f47b3d605f71da0cddd8a30153c6a9fce |
| bundle-manifest | static-hosting-manifest.json | 5280 | sha256-00a9ccda77f2f2b10f2f73e029afb5c7ea053c36ef3296c2eaee5f4d734574ae |
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
- Source freshness: current
- Usable for current source reports: true
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
- EAS deploy blocked by: eas-project-id-not-configured, eas-account-not-logged-in, eas-project-not-linked
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

