# Task 12: Dependency security refresh report

## Changes

- Ran the approved non-forced `npm audit fix`, refreshing compatible Babel 7, `ws`, `js-yaml`, and `brace-expansion` lockfile entries.
- Updated the existing `shell-quote` override from `1.8.4` to `1.10.0`. This is the narrow compatible resolution for the React Native transitive advisory and does not change React Native (`0.83.6`) or the Expo SDK major (55).
- Aligned direct Expo SDK 55 packages to the patch versions required by Expo's compatibility check. The Expo SDK remains 55 (`expo` `~55.0.28`).

Files changed:

- `package.json`
- `package-lock.json`

## Commands and results

| Command | Result |
| --- | --- |
| `npm audit --omit=dev --json` before refresh | Failed: 7 production vulnerabilities (1 low, 6 high). |
| `npm audit fix --dry-run --json` | Identified only compatible updates: Babel 7, `ws`, `js-yaml`, and `brace-expansion`. |
| `npm audit fix` | Completed; changed 25 packages. It left the React Native transitive `shell-quote` advisory, whose automatic remediation would require an incompatible React Native downgrade. |
| `npm audit --omit=dev` final | Passed: `found 0 vulnerabilities`. |
| `node node_modules/expo/bin/cli install --check` | Passed: `Dependencies are up to date`. This invokes the installed Expo SDK 55 CLI directly after `npx` attempted to resolve a new Expo CLI despite the installed package being present. |
| `npm run typecheck` | Passed (`tsc --noEmit`). |
| `npm run test:core` | Passed on the authoritative post-install run (the duplicate verification invocation was stopped). |
| `git diff --check -- package.json package-lock.json` | Passed. |
| `npm audit --json` | Development-only finding remains: 1 low-severity `esbuild` advisory. Its fix requires breaking `esbuild@0.28.1`; it was intentionally not forced. |

## Self-review

- The production audit is clean without `npm audit fix --force`.
- React Native remains `0.83.6`; no downgrade occurred.
- Expo remains SDK major 55; all Expo edits are compatible patch updates required by Expo's own checker.
- Only dependency manifests/lockfile were changed. Protected `docs/validation/artifacts/**` files were not modified, staged, or included.

## Concerns

- `npm audit` (including development dependencies) retains one low `esbuild` advisory; npm marks the available remediation as semver-major. It is development-only and outside the non-breaking constraint.
- The local `npx expo` resolver attempted to fetch Expo 57 because the package-manager environment did not expose the local Expo bin link. The installed SDK 55 CLI check passed directly.
