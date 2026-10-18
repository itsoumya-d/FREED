# Social Login Setup (Google + Apple)

The app ships with a skippable backup-account step between the paywall and
protection setup (`AccountScreen`). Buttons appear only when the provider is
configured; otherwise the screen shows an explanatory note plus Skip.

## Google

1. Play Console / Firebase: add your release SHA-1 (and debug SHA-1) to the
   Android app in Firebase console, then re-download
   `android/app/google-services.json`.
2. Create an OAuth **Web** client ID (type "Web application") in Google Cloud
   console → Credentials. This is the `webClientId` RN SDK needs.
3. Env vars for EAS/prebuild:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com`
   - `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<id>`
4. Run `npx expo prebuild` once (or let EAS build apply config plugins) so the
   `@react-native-google-signin/google-signin` plugin injects the iOS URL
   scheme into Info.plist. The plugin is added by `app.config.js` only when
   `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is set.
5. Enable the Google provider in Firebase Console → Authentication → Sign-in
   method.

## Apple (iOS)

- Entitlement `com.apple.developer.applesignin = Default` is already present in
  `ios/FREED/FREED.entitlements`.
- Enable "Sign In with Apple" for the App ID in the Apple developer portal and
  regenerate provisioning profiles.
- Enable the Apple provider in Firebase Console → Authentication → Sign-in
  method.
- `signInWithApple()` generates a random nonce (hex) and hands both the token
  and nonce to the existing Firebase credential exchange
  (`exchangeProviderCredential("apple", …)`).

## Testing without accounts

The account step is fully skippable ("Skip for now"), and the app remains
local-first. Email-link sign-in stays available later under
Profile → Recovery Backup once the signed app-link association is verified.
