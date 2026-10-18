# Prepared Apple verification configuration

`apple-roots/` contains the three public Apple trust certificates downloaded from [Apple PKI](https://www.apple.com/certificateauthority/). The manifest records their origins, SHA-256 digests, subjects, and validity dates. Preparation verified that each is an unexpired, self-issued CA with a valid self-signature.

`apple-root-cas-base64.json` is the JSON array of base64 DER certificates expected by FREED's server configuration. Apple's [server library instructions](https://github.com/apple/app-store-server-library-node#obtaining-apple-root-certificates) require these roots when verifying signed transaction and notification data.

The existing FREED App Store ID is `6816637268`. On 2026-10-04, the owner-approved Apple verifier configuration was uploaded to `freed-7d5ee` Secret Manager: `APPLE_STORE_APP_ID`, `APPLE_STORE_ROOT_CAS_BASE64`, `APPLE_STORE_ISSUER_ID`, `APPLE_STORE_KEY_ID`, and `APPLE_STORE_PRIVATE_KEY`, each at version 1. The private-key readback matches the approved custody fingerprint; private values remain outside the repository. See the sanitized [custody receipt](../../docs/validation/artifacts/2026-10-04-momentum/apple-secret-manager-custody.json).

FREED is now linked to the owner's approved open Google billing account ending `0ECFDB`. The Google Play service-account credential, production Functions deployment, and live App Check/store evidence remain incomplete. The current checkout-context implementation requires both Apple and Google verifier readiness, so these Apple secrets alone do not enable checkout. Keep provider credentials outside the repository and client build; do not create placeholder credentials to bypass the readiness gate.

After deployment, verify real sandbox purchases, renewals, cancellation through paid expiry, hold/grace, refund/revocation, restore and ownership conflicts. Prepared certificates alone do not close those release gates.
