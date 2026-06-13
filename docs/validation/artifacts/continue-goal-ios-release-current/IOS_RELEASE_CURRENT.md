# FREED iOS Release Archive Current State

Generated: 2026-06-07

This folder records the current App Store archive gate result for FREED. It is a launch-blocker snapshot only, not release evidence.

## Current result

- Report: `ios-release-archive-report.json`
- Schema: `freed-ios-release-archive-report-v1`
- Result: `fail`
- Failing rows: 7
- Immediate blocker: `FREED_IOS_DEVELOPMENT_TEAM` or `APPLE_TEAM_ID` is not configured as a 10-character Apple team ID.
- `teamIdConfigured`: `false`
- No archive or IPA was produced in this run.

## Command used

```bash
npm run build:ios-archive:release -- --report docs/validation/artifacts/continue-goal-ios-release-current/ios-release-archive-report.json
```

## Required signing inputs before retry

- `FREED_IOS_DEVELOPMENT_TEAM` or `APPLE_TEAM_ID` for the Apple Developer team.
- Apple Distribution signing access for the main app and embedded extensions.
- App Store/TestFlight provisioning coverage for:
  - `app.freed.recovery`
  - `app.freed.recovery.shield-configuration`
  - `app.freed.recovery.shield-action`
  - `app.freed.recovery.device-activity-monitor`
  - `app.freed.recovery.safari-content-blocker`
- Family Controls entitlement approval for the app and Screen Time extensions.
- App Group `group.app.freed.recovery` on the app and all extensions.
- Complete Data Protection entitlement on the app and all extensions.

After these inputs are available, rerun the command above. A launch-ready report must pass archive, export, signing, bundle ID, entitlement, embedded-extension, Safari content-blocker, and IPA hash checks.
