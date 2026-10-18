# Premium preferences, localization and DNS verification

The catalog appends `feature-100` through `feature-106` to the original 99-row ledger. The ledger file and its original IDs stay unchanged. `--catalog baseline` selects the original rows; `--catalog premium` selects the seven additions; omitting the option includes both.

```sh
node --test tests/feature-test-manifest.test.js
node node_modules/jest/bin/jest.js --runInBand --watch=false
node scripts/run-feature-verification.js --mode local --catalog premium
node scripts/run-feature-verification.js --mode all --catalog premium --plan
node scripts/run-feature-verification.js --mode list --catalog premium
```

The runner discovers nested `.test.tsx` suites and dispatches them through Jest, one child process at a time. Existing `.test.ts`, `.test.js` and `.test.mjs` suites keep their original runners. Jest individual test totals are parsed independently of suite totals; skipped and todo cases remain incomplete. This is observed assertion coverage, not instrumented line or branch coverage.

| ID | Local behavior checked | Remaining native or service execution |
|---|---|---|
| 100 | Real committed preferences store, system/light/dark selection, palette change, storage errors and new-store hydration | Native device appearance changes, cold launch, Dynamic Type and accessibility |
| 101 | Matching non-empty resource topology for all ten languages, placeholder arguments, authored copy, preserved input/URLs and runtime date/number locale | Every route in each language, translated native accessibility labels and layout |
| 102 | Explicit Arabic restart, saved state on reload failure and Arabic to English/System direction transitions | Actual native RTL mount, mirrored navigation, keyboard, cold restart and preserved recovery data |
| 103 | Independent native capability and permission contracts | Grant/deny/revoke each DNS, Android app, iOS Screen Time and Safari layer separately |
| 104 | Missing or old native module, default release gate, no pre-consent mutation, decline and explicit provider configuration | Signed release configuration, native authorization and actual consent revocation |
| 105 | Configured/enabled/healthy distinction, degraded status, failed refresh, pause confirmation and duplicate action protection | Captive portal, conflicting VPN, resolver failure, normal/adult browsing, network change and measured latency |
| 106 | Loading/error disable checkout, retry avoids fabricated prices, supplied store currency remains exact and busy state prevents repeat actions | Sandbox storefront offers, retry success, store cancellation, restore and actual ownership |

UI tests use React Native Testing Library against the production components. Native Expo reload, Expo UI pickers, safe-area, router focus and the native DNS bridge are mocked at their boundaries. Preferences storage, localization runtime, DNS presentation and store-price presentation remain real. The iOS picker test verifies values and tagged choices sent across the native boundary; it does not establish the wheel's physical appearance or accessibility.

The GitHub workflow runs TypeScript, manifest checks and focused local contracts without credentials or device control. It uploads the actual logs and a separate plan containing every unexecuted obligation. A passing CI job cannot mark device protection, live store pricing or physical motion complete.

## Disposable native smoke

The new flows are `preferences-appearance`, `preferences-language`, `localization-rtl-restart`, `protection-layers`, `encrypted-dns-consent`, `encrypted-dns-status`, `encrypted-dns-release-gated` and `paywall-price-recovery`. They are authored scenarios and have not been executed as physical-device results. Use a new disposable, English/LTR fixture with test-only data; never point them at the owner's installed app or shared simulator.

```sh
node scripts/run-feature-verification.js --mode android --feature feature-100 \
  --run-ui --device DISPOSABLE_ID --isolation fixture.json
node scripts/run-feature-verification.js --mode ios --feature feature-105 \
  --run-ui --device DISPOSABLE_ID --isolation fixture.json
```

Android preferences use accessible radio row IDs. iOS appearance uses native segmented text, and language uses a native wheel. The iOS language and RTL flow branches inspect the visible picker only; all eleven wheel selections, both direction changes and restart remain explicit native receipt obligations. Android language choices are selected without native restarts in the completeness smoke; the separate RTL flow requests restart and restores English at the end.

The DNS consent flow opens and cancels a disclosure on a capable fixture, or records the disabled control on a gated fixture. It stops before accepting consent or native authorization. The release-gated flow specifically requires a default-off native build with no saved DNS configuration. It is an extra scenario; do not infer that every status smoke executes it. Pricing recovery requires a genuine sandbox unavailable-offering fixture and stops before checkout. Store-localized values, retry success and every alternative DNS state require their own bound scenario receipts.

Maestro supports [platform conditions](https://docs.maestro.dev/maestro-flows/flow-control-and-logic/conditions) and [checked/enabled state selectors](https://docs.maestro.dev/reference/selectors/state-selectors). Its smoke output remains separate from the runner's full-scenario requirements.

## Evidence contract

Use the [existing receipt format and isolation contract](feature-verification.md). Every non-local requirement retains its assertions, installed-build SHA-256, recent execution timestamp and hashed artifacts. Physical requirements still require a real signed device and measured frame trace. Missing, blocked, skipped and unselected obligations stay in the full denominator. A plan, generated fixture, mocked callback or screenshot of configured DNS never proves active encryption or filtering.

The [native DNS verification guide](encrypted-dns.md) describes isolated Swift/Kotlin policy harnesses. Their execution proves only the stated native policy and transport contracts; installed app behavior, OS consent and network enforcement stay separate.

## Current local execution

The [focused runner report](../validation/artifacts/2026-10-02-premium-verification/local.json) records 13 passing suite processes and all seven related local feature checks passing. The [Jest result](../validation/artifacts/2026-10-02-premium-verification/jest.json) records 49 passing UI/runtime cases across five suites, with zero failures or skipped tests. The [separate plan](../validation/artifacts/2026-10-02-premium-verification/obligations.json) retains all 37 requirements as unexecuted. Full native/live/physical verification remains zero of seven features; these reports do not contain device execution receipts.
