# Authorized Maestro repairs receipt

Changed exactly the 24 authorized flow files listed in `changed-hashes.json`; no UI, native, backend, controller, source-key, README, other flow or shared test was edited. No commits, external communication or native UI execution were performed. `flow-repairs.patch` compares each change to its independently saved starting bytes.

## Repairs

- DNS, allowlist, diagnostics, app preferences and schedules target their real `/shield/<section>` pages and suffixed native route markers. Multi-page diagnostics/platform-limit assertions navigate to every actual required page. Website setup uses the current `Review website protection` action.
- Generic setup explicitly requires the combined renderer fixture (saved intent both, reset latch false), reveals real setup help and refreshes. It then enters website and app renderers through their actual Protect setup buttons and requires `setup-websites` / `setup-apps` plus `feature-setup-refresh`. All three paths are mandatory; no optional branch conceals a missing renderer and no authorization/reactivation action is invoked.
- Breathing uses current Begin/Pause toggle ID, scrolls to mode controls, closes via `Close breathing exercise`, and proves return to Today. Help-now flows use the real Today control; Profile opens Protect; Library uses Recovery Tools; free custom builder retains Upgrade/free-return checks.
- Android app selection uses a specifically empty stored-package fixture, which the actual screen initializes to its three Instagram/TikTok/YouTube recommendations. It asserts checked YouTube, the real 3→2→3 selected labels, and off/on undo. iOS requires Apple's target explanation, no Android checkbox and enabled Continue to setup. No empty-selection or invented one-app count is claimed.
- Today metrics checks the active recorded-streak/history controls. Today practices enter each of six actual PracticeDetail views, assert mark done → mark not done → mark done undo, close, and return before the next case. The fixture explicitly starts with those current-day records unrecorded.
- Pledge saves an explicitly selected mood and urge first, opens the real tools sheet, requires an unrecorded pledge fixture, and asserts Pledge recorded. No conditional skip hides a disabled save or missing pledge action.
- Shortcuts exercise both the real Today and Library Breathe controls, using the current Today terminal return. Draft retention leaves through the real cross-platform no-save Back callback and reopens the same-local-day field; its fixture requires no existing draft/reflection.
- Local-write tags reflect own urge records, retained exercise progress and feature-choice settings. Fixture comments state English/native/platform/initial-state requirements; none of the files reset app data or Keychain or manufacture service/receipt evidence.

## Verification

Installed `yaml` parser: metadata + command arrays valid for **24/24 changed flows** and **58/58 complete flow inventory**.

Only the independent snapshot ran existing checks:

- `node --test tests/feature-test-manifest.test.js`: **exit 0, 16/16 pass** (`feature-test-manifest-final.log`).
- `node --test tests/momentum-review-plan.test.js`: **exit 1, 13/14 pass** (`momentum-review-plan-final.log`). The one stale test at line 69 requires `language-bn` and later the removed `language` container to remain in the repaired Root-owned `preferences-language.yaml`. Those selectors are correctly gone; this worker did not weaken or edit that test. Root must reconcile the inventory test with an isolated negative fixture.

Counts, commands and exact changed SHA-256 values are saved in `verification-summary.json` and `changed-hashes.json`.

## Unexecuted limitations

Native execution was not run. Parser/manifests do not establish installed-binary selector visibility, scrolling or OS permission behavior. Each flow still requires its declared disposable English fixture, selected current-day/saved-intent state, and native platform; DNS grant/filtering, store prices, purchase/account/service behavior and physical-device claims retain their separate evidence requirements. Existing OS Open-prompt handling and actual iOS/Android branches remain; no optional missing-control fallback was added.
