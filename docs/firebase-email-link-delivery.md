# Firebase Email-Link Delivery Gate

Firebase email-link configuration has two distinct URLs:

- `ActionCodeSettings.url` is the post-action continue URL: `https://freed-7d5ee.web.app/auth/callback`.
- `ActionCodeSettings.linkDomain` is the mobile delivery host: `freed-7d5ee.firebaseapp.com`. Firebase Auth opens the native association at `https://freed-7d5ee.firebaseapp.com/__/auth/links`.

The native path is intentionally disabled until the deployed Hosting association files and signed native builds have been verified together. Never substitute the continue URL for `linkDomain`.

## Release inputs and Hosting deployment

Provide these non-secret production release inputs outside git:

- `FREED_ANDROID_APP_LINK_SIGNING_SHA256`: the SHA-256 fingerprint of the certificate that signs the Android build actually installed for this check. Do not use the debug certificate. For Play-distributed builds, use the Play App Signing certificate if it is the installed signer.
- `FREED_IOS_DEVELOPMENT_TEAM`: the existing ten-character Apple Team ID used by the signed main app.

Run the fail-closed preflight before deployment:

```sh
FREED_ANDROID_APP_LINK_SIGNING_SHA256=<production-sha256> \
FREED_IOS_DEVELOPMENT_TEAM=<apple-team-id> \
npm run preflight:firebase-email-links
```

`firebase deploy --only hosting:web` runs `npm run prepare:firebase-hosting` automatically. That predeploy command exports the Expo web app, then writes these generated files into `dist`:

- `dist/.well-known/assetlinks.json`
- `dist/apple-app-site-association`

It refuses to deploy when either release input is missing, malformed, or uses the Android debug certificate. Do not hand-author or commit a certificate fingerprint or Apple Team ID to replace this generation step.

After deployment, fetch both exact Firebase Auth link-domain endpoints and confirm that their JSON matches the current signing identities and is served as `application/json`:

```sh
curl --fail --silent --show-error --location https://freed-7d5ee.firebaseapp.com/.well-known/assetlinks.json
curl --fail --silent --show-error --location https://freed-7d5ee.firebaseapp.com/apple-app-site-association
```

In Firebase Authentication, authorize the continue URL domain and configure `freed-7d5ee.firebaseapp.com` as the Firebase Auth email-link `linkDomain`. Confirm the delivery URL reaches exactly `/__/auth/links`; keep the continue URL as the post-action callback, not as the mobile delivery host.

## Physical verification gate

Before setting the app readiness marker, verify both cases on freshly installed, signed release candidates. Simulator/debug checks do not satisfy this gate. On a killed-app launch, FREED routes the pending link to Profile and asks for the email address again; it intentionally does not retain account email locally just to complete a link.

1. Android: install the signed APK/AAB variant whose certificate fingerprint was emitted into `assetlinks.json`. Send an email link, force-stop the app, open the link for a cold start, then repeat while the app is running/backgrounded for a warm delivery. Confirm Android resolves the verified HTTPS App Link to FREED rather than a browser and that the Firebase session completes.
2. iOS: install an Ad Hoc/TestFlight/App Store candidate signed by the Apple Team ID emitted into `apple-app-site-association`. Repeat the cold-start and warm-link checks. Confirm the Universal Link opens FREED and the Firebase session completes.
3. Repeat after any change to the Hosting domain, callback path, Android signing certificate, Apple Team ID, app identifier, or Firebase Auth authorized-domain configuration.

Only after the deployed domain responses and both platform checks are recorded may the production build environment set:

```dotenv
EXPO_PUBLIC_FIREBASE_EMAIL_LINK_ASSOCIATION_READY=deployed-and-verified
```

Build a new signed app after setting the marker; it is a compile-time public gate, not proof by itself. Remove the marker (or set any other value) immediately if the association contract changes or verification expires. The UI and native adapter fail closed while the marker is absent, so they do not advertise a usable email-link path prematurely.
