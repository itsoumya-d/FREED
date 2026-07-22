# Firebase foundation

The Firebase production project is `freed-7d5ee`. Its default Firestore database
already exists in `asia-south1` with deletion protection enabled. Android and iOS
app settings live in native Google service files, not in environment variables.
Firebase client IDs, sender IDs, and API keys are public identifiers. Firebase
Admin and service-account material must never be included in `EXPO_PUBLIC_*`.

## Environments

`production` maps to `freed-7d5ee`. `staging` maps to the intended
`freed-staging-7d5ee` alias, but that Google project is not provisioned because
creation returned project-quota code 8. Do not repurpose another project, copy
production credentials, attach billing, or deploy the staging alias until the
quota blocker is resolved.

## Data boundary

Firestore and Storage rules deny every direct client request. Local recovery
state, challenge media, journals, passphrases, and encrypted recovery packages
must not be written to Firestore or Storage by this app. Any future backend path
must use the Admin SDK, accept a reviewed minimum payload, and receive a separate
privacy review.

## Retention and TTL

There are no Firebase collections in this foundation, so there is no TTL policy
to deploy. Before adding any Admin-backed operational collection, define a
field-specific Firestore TTL policy in the console/API, document its retention
period, and prove that it cannot contain recovery content. TTL is not represented
by `firestore.indexes.json`.

## App Check and Functions

Clients use Play Integrity on Android and App Attest with DeviceCheck fallback on
iOS. Debug App Check requires an explicit non-production build setting. Enforcement
stays disabled until physical provider registration completes. The
`firebaseFoundation` callable is data-free; deployment remains blocked while
production billing is disabled.

## Authentication and backup integration

The native UI uses `https://freed-7d5ee.web.app/auth/callback` only as the
Firebase email-link continue URL. Configure
`freed-7d5ee.firebaseapp.com` as the Firebase Auth `linkDomain`; its exact
native delivery path is `/__/auth/links`. Enable Email link authentication and
authorize/configure both Firebase Auth domains before release. Apple and
Google credential-exchange interfaces are present in the native adapter, but
their provider registration and client IDs remain release prerequisites.

The legacy Supabase sync environment variables remain only for existing
server-side compatibility and smoke coverage. The native Firebase UI will send
an ID token only to the separate
`EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT`, which remains unset until
a Firebase-ID-token-verifying backend is deployed. The current callable does
not receive backup content.
