# Native UI / TestFlight evidence — 2026-10-02

Evidence-worker baseline during root integration of native routing, authentication and challenges. This directory does not certify a final binary or public release. Keep earlier receipts unchanged; append final build/service/device outcomes here.

## Fresh observed facts

- Reports use seven local calendar days through next midnight. UTC-midnight fixtures caused a false Kolkata failure; fixtures now use independent local Date boundaries across normal, March and November windows. Exact no-overlap/cross-start/cross-end/open-at-boundary assertions remain.
- Archived epoch minute zero falls on December 31 in negative-offset zones. The alias-normalization fixture now queries the epoch instant's actual local day, preserving duplicate rejection.
- Accuracy 18/18, snapshot 6/6, reconciliation 5/5 and frozen calendar/rollback/DST pass in UTC, Kolkata, New York, London and Sydney; see timezone-validation-final.json.
- Core schedule/slip/snapshot fixtures now express intended local hours. Production report/counter behavior was unchanged. Initial broader/transient failures remain in logs.
- The previous source audit failed stale custom-navigation/SOS checks. Updated checks parse actual native tabs, all four SOS headers, controller action and route. Mutation validation rejects missing/duplicate labels or disconnected SOS action/route. This remains a source precheck.
- Live billing is enabled/linked; Functions and Storage inventories are empty at capture. Six Remote Config defaults remain false, version 1. Required cloud APIs are enabled. Secret metadata listing is denied.
- Seven exact server-only secrets are required. App ID and Apple public trust roots exist in inspected local files; issuer ID, key ID, private key, Google Play service account JSON and OpenAI key are absent there. Deployed presence is IAM-unknown. No secret version/value was accessed.
- Local distribution identity exists for the expected team. Six cached FREED profiles are development profiles; main app/three Screen Time targets contain development Family Controls capability, all six share the app group. No cached FREED App Store distribution profile was found.
- Production npm audit has 16 high advisories through Expo tooling from node-forge signature verification. Binary reachability was not proved; no dependencies were edited.

## Receipts

feature-ledger.json covers 99 feature rows with separate Android/iOS local, native preview, live, physical, blocked and unsupported states. source-control-inventory.json lists control labels/source locations and marks dormant legacy controls.

timezone-validation-final.json and local-feature-validation.json contain exact isolated suites/logs. core-timezone-validation-final.json will contain final root-integrated full core outcomes. source-audit-summary.json preserves the original capture; accessibility-detector-validation.json and updated logs document the changed source checks.

backend-readiness-readonly.json contains sanitized live metadata. secret-readiness-presence.json publishes names/presence only. ios-signing-metadata.json publishes profile class/capability/expiry metadata without certificates/private keys. dependency-audit.json binds current counts/advisory to a lockfile hash.

## Remaining proof

Root must append final source/binary checksums, build/install/navigation results and deployed backend inventory/smoke. Physical Android DNS/Accessibility/limits and iOS Screen Time/Safari remain pending. Physical sensors, actual store sandbox lifecycle, production App Check, native second-device encrypted backup and APNs/FCM need real device/service evidence.

TestFlight requires inspecting the actual distribution archive/exported IPA: effective entitlements and embedded profiles for main app and all five extensions, same team/app group, Family Controls distribution approval, Associated Domains/Apple sign-in and effective APNs environment. Then record export/upload/processing and installed build. Identity metadata or a simulator build alone proves none of those outcomes.

This worker made no commit, deployment, console/billing mutation or secret-value access. Prior dirty production changes, original recovery data and earlier evidence were preserved.
