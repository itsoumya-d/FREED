# FREED Guard — Chrome Extension (MV3)

Desktop companion blocker for the FREED recovery app. Blocks adult domains with
`declarativeNetRequest` static rules compiled from the same reviewed adult-domain
feed the mobile apps use, and redirects blocked navigations to a calm, branded
interstitial instead of a raw browser error.

## Architecture

```
extension/
├── manifest.json            MV3 · declarativeNetRequest + storage + alarms
├── rules/
│   ├── adult-blocklist.json Generated DNR rules (requestDomains per domain)
│   └── metadata.json        Version/checksum provenance (mirrors app feed contract)
├── background.js            Service worker: pause timers, custom-rule sync
├── blocked/                 Branded interstitial + 4-7-8 breathing exercise
├── popup/                   Status + "Emergency breather" (5-min pause)
└── options/                 User always-block / always-allow lists (dynamic rules)
```

Key decisions:

- **One rule per domain** using `requestDomains` (matches subdomains too) — compact,
  fast, and identical suffix semantics to the mobile classifier feed.
- **Hard cap 25 000 rules** — safely under Chrome's guaranteed minimum of 30k enabled
  static rules so the ruleset can never fail to enable as the feed grows.
- **Redirect interstitial** for `main_frame`, silent block for subresources.
- **User allows outrank everything** via priority-10 dynamic allow rules; custom
  blocks use priority-2 dynamic redirect rules. Dynamic rules capped at 4 000.
- **Honest pausing**: only a single 5-minute "Emergency breather" is offered and each
  pause taken today is counted in the popup — consistent with the product's
  habit-forming posture.

## Build

```bash
npm run build:extension-rules              # from embedded reviewed seed list
node -- scripts/run-ts-entry.js scripts/build-extension-rules.ts --feed feed.json
# where feed.json = { "domains": ["..."] } (same shape as /api/adult-domain-feed payload)
```

The `--feed` flag swaps in the production reviewed feed when the endpoint is live;
the embedded seed list is the fallback source of truth until then.

## Load locally

1. `npm run build:extension-rules`
2. Chrome → `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select `extension/`

## Web Store checklist

- [ ] Replace seed ruleset with production reviewed-feed build (`--feed`)
- [ ] Store listing copy mirrors app disclosure: DNS/domain-list blocking only, no
      browsing-history collection, all recovery state stays local
- [ ] Privacy tab: single purpose (adult-domain blocking), no remote code, no analytics
- [ ] Screenshots: popup + interstitial + options at required sizes
- [ ] Zip contents of `extension/` (not the folder itself)

## Privacy posture

No browsing history ever leaves the browser. Matched-domain telemetry does not exist;
the service worker stores only pause state and rule counts. Custom lists live in
`chrome.storage.local` on-device.
