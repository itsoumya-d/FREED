# FREED Store Web Export Current State

Generated: 2026-06-07

This folder records the current static web export proof for store-crawler URLs. It is a local launch-support artifact only; production still needs the exported site deployed at `https://freedrecovery.app` and verified from the public internet.

## Command

```bash
npm run export:web
```

Result: passed. Expo exported static web files into `dist/`.

Expo reported these static routes:

- `/`
- `/privacy`
- `/support`
- `/_sitemap`
- `/+not-found`
- `/account-deletion`

## Store-Crawler Files

| Route | Exported file | Size bytes | SHA-256 |
| --- | --- | ---: | --- |
| `/` | `dist/index.html` | 36367 | `baa4a1f3d2bd4cb387896b96537f48389bd06cba056881bf339e8195470ea904` |
| `/privacy` | `dist/privacy.html` | 26133 | `1f1a79a1ae7e218f02be4e7e646ebb50a41a58518d9921378be8ce97aaf263a6` |
| `/support` | `dist/support.html` | 24300 | `7c6a8857435a304473cac7836a381203245de725a64d9038546c8f269c8b80d7` |
| `/account-deletion` | `dist/account-deletion.html` | 24067 | `0b1cd2b89189f20f2946f738c100ebc50e7d1207f8607697f68a2f70a86124db` |
| `/_sitemap` | `dist/_sitemap.html` | 18485 | `8693c8dc06b70fb65a6df7e17b1ca3f01b5fc595892ad10b6fb8e37cf3361dec` |

## Text Signals Verified In Export

- `dist/privacy.html` contains `FREED Privacy Policy`, `support@freedrecovery.app`, and the public URLs `https://freedrecovery.app/privacy`, `https://freedrecovery.app/support`, and `https://freedrecovery.app/account-deletion`.
- `dist/support.html` contains `FREED Support`, `support@freedrecovery.app`, Android/iOS protection setup help, and Core 3 billing product IDs.
- `dist/account-deletion.html` contains `FREED Account Deletion`, `support@freedrecovery.app`, and the public deletion URL.

## Remaining Store Requirement

Deploy the current `dist/` output to the configured public host, then verify the public URLs in Google Play Console and App Store Connect before production submission.
