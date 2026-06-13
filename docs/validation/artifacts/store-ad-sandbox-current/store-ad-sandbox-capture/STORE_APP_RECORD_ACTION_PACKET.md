# Store App Record Action Packet: store-ad-sandbox-current-store-app-record-action

This packet is for creating or identifying draft app records only. It is not approval to submit for review, publish, roll out, or create paid products.

## Current Readiness

- Result: blocked-before-hosted-legal-urls
- Browser report: `docs/validation/artifacts/store-console-browser-current/store-console-browser-readiness.json`
- Browser report hash: `sha256-646db056da1f73f6a16e5a16fad4b2f4b9c5918a67cf08e55157187a86ae06ab`
- Hosted legal report: `docs/validation/artifacts/store-legal-hosted-current/store-legal-hosted-url-audit.json`
- Hosted legal report hash: `sha256-beb04c914899d5446402aeb1e53a659f7d7e2ec0fba1ec3f9d98301e4b696cd3`
- Hosted legal result: fail
- Hosted legal URLs verified: false
- Store legal URL entry allowed: false
- Read-only Browser inspection: true
- Store mutation during Browser check: false
- Google Play app record: unconfirmed
- App Store Connect app record: unconfirmed
- Apple license agreement: unconfirmed

## Required Confirmation

Before any browser-side app-record creation, confirm: `confirm-draft-store-app-record-creation-only`.

Confirm before creating draft Google Play Console and/or App Store Connect app records for FREED using the fields in this packet. This is not approval to submit for review, publish, roll out, or create paid products.

## Hard Stops

- Do not enter privacy/support/account-deletion URLs into Play Console or App Store Connect until the hosted legal URL audit passes for every public route.
- Do not click Submit for Review, Send for Review, Publish, Promote to production, Start rollout, or equivalent production actions.
- Do not create subscriptions, one-time products, AdMob apps, or production releases until the read-only Browser readiness report proves both app records exist and the Apple agreement is accepted.
- Do not proceed inside App Store Connect while the Apple Developer Program License Agreement is pending unless the Account Holder is the person accepting that agreement.
- Do not paste account emails, team IDs, developer IDs, service-account JSON, private keys, purchase receipts, or raw screenshots into evidence.

## Action Order

| Step | Platform | Operator | Current status | Action |
| --- | --- | --- | --- | --- |
| hosted-legal-url-validation | legal-web | Static hosting/DNS owner | fail | Deploy and verify https://freedrecovery.app/privacy, /support, and /account-deletion before entering legal URLs in store console fields. |
| apple-license-agreement | app-store-connect | Apple Account Holder | unconfirmed | Accept the pending Apple Developer Program License Agreement if App Store Connect still shows that blocker. |
| google-play-app-record | google-play-console | Google Play Console admin | unconfirmed | Create or identify the FREED draft app record for package app.freed.recovery. |
| app-store-connect-app-record | app-store-connect | App Store Connect admin after agreement acceptance | unconfirmed | Create or identify the FREED app record for bundle ID app.freed.recovery. |
| read-only-readiness-recheck | browser-evidence | Codex Browser read-only inspection | blocked-before-console-product-setup | Rerun npm run evidence:store-console-browser with both app records present and agreement accepted, with no store mutation performed during that read-only check. |

## Google Play Draft App Record

Destination: Google Play Console > All apps > Create app

| Field | Value |
| --- | --- |
| appName | FREED |
| defaultLanguage | English (United States) |
| appOrGame | App |
| freeOrPaid | Free download with in-app purchases |
| packageName | app.freed.recovery |
| category | Health & Fitness |
| targetAudience | Adults/recovery audience; not child-directed and not submitted to Families. |
| appAccess | No restricted login required for reviewer access to core app surfaces. |
| privacyPolicyUrl | https://freedrecovery.app/privacy |
| supportEmail | support@freedrecovery.app |
| accountDeletionUrl | https://freedrecovery.app/account-deletion |

## App Store Connect App Record

Destination: App Store Connect > Apps > New App

| Field | Value |
| --- | --- |
| platform | iOS |
| name | FREED |
| primaryLanguage | English (U.S.) |
| bundleId | app.freed.recovery |
| sku | app.freed.recovery |
| category | Health & Fitness |
| privacyPolicyUrl | https://freedrecovery.app/privacy |
| supportUrl | https://freedrecovery.app/support |
| supportEmail | support@freedrecovery.app |

## After App Records Exist

- Read-only Browser readiness: `npm run evidence:store-console-browser -- --play-console-observed --play-freed-app-present --app-store-connect-observed --app-store-freed-app-present --app-store-agreement-accepted`
- Regenerate sandbox packet: `npm run evidence:store-ad-sandbox -- --release-env-file <production-env-file> --run-id store-ad-sandbox-current --output-dir docs/validation/artifacts/store-ad-sandbox-current/store-ad-sandbox-capture`
- Next product evidence template: `store-console-product-setup-report.template.json`

