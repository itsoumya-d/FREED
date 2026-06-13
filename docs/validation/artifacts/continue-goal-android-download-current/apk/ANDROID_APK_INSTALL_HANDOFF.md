# FREED Android APK Install Handoff

Generated for the current local QA APK artifact.

## Artifact

- Type: APK
- Path: `docs/validation/artifacts/continue-goal-android-download-current/apk/FREED-release-arm64.apk`
- Timestamped copy: `docs/validation/artifacts/continue-goal-android-download-current/apk/FREED-release-arm64-20260607-045732.apk`
- SHA-256: `46d591b620740cbb4b65280c64c67ed75401aa93b39d36316b63af94352903b7`
- Size: 56.4 MB
- ABIs: arm64-v8a
- Package: `app.freed.recovery`
- Main activity: `app.freed.recovery/.MainActivity`
- React Native bundle: present
- Hermes runtime: present
- JavaScriptCore runtime: absent

## Release Boundary

Local Android side-load QA only. This APK is signed with the Android Debug certificate and uses the local Google sample AdMob app id fallback, so it is not a Play Console upload artifact and not production release evidence.

Play upload still requires an upload-signed AAB from `npm run build:android-aab:upload-signed` or the EAS production app-bundle path after production env preflight passes.

## Install And Protection QA

1. Attach one physical Android device with USB debugging enabled, or pass a concrete `--device <serial>`.
2. Run install QA:

```sh
npm run qa:android-install -- --apk docs/validation/artifacts/continue-goal-android-download-current/apk/FREED-release-arm64.apk --run-id android-install-20260607-053820 --output-dir docs/validation/artifacts/android-install-20260607-053820/android-install-qa
```

3. In FREED, complete the permission checklist in this order:

```text
android-native-adult-domain-feed>android-dns-guard>android-usage-access>android-accessibility>android-doomscroll-apps>activation-test
```

Android still requires explicit user consent for VPN, Usage Access, and Accessibility; FREED opens the closest supported OS settings page and refreshes on return.
4. Run protection QA on the same device:

```sh
npm run evidence:android-real-browser -- --device <serial> --adult-url <real-adult-url> --permission-proof --native-status-proof --dns-guard-proof --run-id android-install-20260607-053820 --output-dir docs/validation/artifacts/android-install-20260607-053820/android-real-browser-capture
```

5. Activation rule: Activation is saved only after native status confirms DNS Guard, Usage Access, Accessibility, selected app packages, and the activation test confirms adult domains are blocked while normal browsing is allowed.
6. Do not treat this APK as activation-ready until install QA and Android protection evidence both pass on physical hardware.
