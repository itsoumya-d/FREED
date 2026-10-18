# Purpose-specific protection contracts — 2026-10-03

Implemented only the pure permission/readiness contracts and their focused test. Native enforcement, system permission decisions, diagnostics completion, route/setup UI and distribution remain owned elsewhere. No commits, resets, native edits or source-gate changes were made.

## Interface

`ProtectionIntent = 'websites' | 'apps' | 'both'` is exported from `src/lib/protection-permissions.ts` and re-exported by `src/lib/protection-readiness.ts`.

- `buildProtectionPermissionPlan(capability, status, intent?: ProtectionIntent): ProtectionPermissionStep[]`
- `getProtectionSetupReadiness(capability, status, selectedAppPackageCount, intent?: ProtectionIntent): ProtectionSetupReadiness`

Both default to `both`. Omitted/default combined intent returns the original permission plan, and its `activationReady` retains the exact original `permissionProgress.ready && adultFilterActive && appInterventionReady` calculation. Existing required Safari/feed/app requirements and existing provenance-gate behavior remain unchanged for this legacy combined path.

Readiness adds:

```ts
intent: ProtectionIntent;
websiteProtectionReady: boolean;
appLimitsReady: boolean;
safariCoverageReady: boolean;
websiteProtection: ProtectionFeatureReadiness;
appLimits: ProtectionFeatureReadiness;
safariCoverage: ProtectionFeatureReadiness;
```

```ts
type ProtectionFeatureStatus = 'On' | 'Off' | 'Needs attention' | 'Unavailable';
type ProtectionFeatureReadiness = {
  status: ProtectionFeatureStatus;
  ready: boolean;
  supported: boolean;
  scope: string;
  explanation: string;
};
```

Status derives from observed capability/readiness/configuration: unsupported capability yields `Unavailable`; actual readiness yields `On`; retained setup/active evidence with incomplete prerequisites yields `Needs attention`; an available unconfigured feature yields `Off`. All feature facts remain available regardless of the requested setup intent. Selecting a setup purpose does not enable/disable another feature or grant a system permission.

## Scoped requirements

| Intent/platform | Required setup | Optional additional coverage |
|---|---|---|
| Websites / iOS | Screen Time authorization; ManagedSettings adult web policy | Safari adult-domain extension/rules |
| Apps / iOS | Screen Time authorization; selected targets; DeviceActivity daily threshold monitor | No website/filter/feed requirements |
| Websites / Android | Reviewed native adult-domain feed; DNS-only VPN runtime and coverage | Recovery notification visibility; Private DNS review guidance |
| Apps / Android | Usage Access; Accessibility; configured native app packages | No DNS/feed/adult-filter requirements |

Scoped plans omit unrelated photo/motion/location/reminder on-demand steps. Website-only plans exclude all app-target/usage/accessibility/limit requirements. App-only plans exclude adult filters, feed synchronization, DNS Guard, Private DNS and Safari requirements.

Apple adult web policy can be ready without selected targets or Safari. Safari capability, extension enablement and rule-feed readiness are presented independently. A missing or disabled Safari extension therefore does not block `websites` activation, while legacy combined activation remains strict.

Feature website readiness requires explicit native `adultFilterActive === true`; a combined Screen Time active flag cannot establish whether the separate adult policy is enabled. The old adult-filter inference remains untouched for legacy callers. Android website feature readiness requires reviewed feed provenance even when the existing development fallback gate would accept an embedded feed on the legacy combined path. It also requires explicit ready DNS runtime and coverage, no captive pause, Private DNS off/absent, no active Private DNS, and no pending VPN consent. Stale active flags cannot override cancelled/pending consent. Android app readiness requires actual native Usage Access/Accessibility permission and native package configuration; locally selected package counts cannot substitute for it.

App scope explanations explicitly distinguish Android daily foreground-time limits per selected package from iOS selected-target threshold events over opaque app/category/domain tokens. They do not promise independent iOS per-app duration reporting or in-app content inspection.

## Verification

Observed initial red: nine intent/feature tests failed against the combined-only implementation. Additional red checks caught embedded-feed feature readiness, dependent Apple policy/monitor completion after authorization revocation, and ambiguous combined activity being inferred as website policy. Final focused checks passed:

- `node -- scripts/run-ts-entry.js tests/protection-intent.test.ts`: **14/14**.
- `node --test tests/protection-dns-safety.test.js`: **4/4**.
- `node -- scripts/run-ts-entry.js tests/protection-setup-flow.test.ts`: **9/9**.
- `node -- scripts/run-ts-entry.js tests/protection-permission-native.test.ts`: **5/5**.
- `node -- scripts/run-ts-entry.js tests/protection-setup-completion.test.ts`: **1/1**.

Total: **33 focused tests passed**. The whole core suite was deliberately not run per root's scoped verification instruction.

Final package typecheck reports four concurrent root route errors (`journal` missing from the `Screen` union in flow/onboarding/freed-app calls); no owned contract/test errors remain. Root was notified.

## Integration boundaries

The permission-plan audit inventories five new scoped English phrases; the per-feature scope/explanation metadata also contains new English text. Root must localize rendered metadata before claiming all-language completion. No locale or source-gate files were changed here. Status values are stable contract values; UI should map them to localized labels.

Legacy native combined activation diagnostics and setup completion remain unchanged. Feature setup should consume its scoped plan/readiness rather than interpret a combined website+apps diagnostic failure as failure of an unrelated feature. These source tests do not certify native permission prompts, actual website/app blocking, physical devices or release distribution.
