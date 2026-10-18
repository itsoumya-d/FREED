# FREED privacy console closure

The current Apple form is incomplete. It selects four data types (Purchase History, User ID, Product Interaction and Device ID), and all four still show Set Up. Publish is disabled. The current Firebase account flow also handles email addresses and provider profile names; these must be reconciled with the final declaration. No privacy answer was published during this inspection.

## Source boundaries to reconcile against the signed candidate

| Data | Current source/service behavior | Declaration check |
| --- | --- | --- |
| Account identity | Firebase Google, Apple and email authentication; required real account entry, with customer email verification allowed later by explicit choice | Email, provider name and UID; app functionality and account linkage. Include SDK collection, not only app-local storage. |
| Offer/review metadata | UID-scoped versioned markers; offer marker retained until account cleanup, review marker bounded14 days | Linked User ID and app functionality; no purchase/native-unlock claim from review access. |
| Verified purchase | Purchase ownership/expiry read deployed; checkout/verifier services remain gated on genuine credentials/readiness | Purchase History, linked to the owning account when enabled; store payment-card details are handled outside FREED. |
| Analytics | Optional absolute UTC-day check-in/challenge counts tied to UID, bounded14-day retention | Linked Product Interaction if the actual candidate enables this opt-in path. Legacy Supabase aggregate/report descriptions are not the current Firebase payload. |
| Push | Opt-in UID, installation ID and FCM token with private-friendly kind/route payload | Identifier collection/functionality and actual delivery behavior; no recovery text in push payloads. |
| Encrypted backup | Optional device-encrypted envelope; backend cannot receive passphrase or decrypt it | Reconcile retained ciphertext, identity and metadata against each store's collection definition; do not equate encryption with an automatic disclosure exemption. |
| Private recovery | Local drafts, reflections, check-ins, slips, recorded practices and progress; four remote coach/challenge/retention providers remain unregistered | Local data alone is distinct from enabled off-device processing. Any later cloud rollout requires per-feature consent/readiness and amended disclosures. |
| Camera/motion/location | Challenge verification and optional context have separate consent and cleanup requirements | Inspect actual enabled routes; do not declare media upload, precise location or fitness export from the mere presence of a sensor SDK. |
| Ads | Internal sample Google Mobile Ads; optional rewarded entry, explicit SDK callback, no blocked target/private context passed | Include actual SDK identifier, impression, diagnostics and network-derived data behavior. Non-personalized ads alone do not establish zero collection. |
| DNS | Local classification plus Cloudflare Families ordinary/DoH resolver; domain processing is independent of app navigation | Describe resolver processing and privacy accurately. Inspect resolver/SDK policies rather than asserting no off-device domains because local history is private. |

Apple requires app and third-party collection to be considered, defines collection by off-device access beyond real-time servicing, and requires linked/purpose answers for each selected type. [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## Remaining actions

1. Bind actual SDK versions, generated manifests, public build flags and the final UI/service source to the signed candidate.
2. Reconcile the installed SDK disclosures and native/runtime paths with the current Firebase data map; retain source citations for each answer.
3. Save complete Apple and Play drafts, then read them back. Publishing remains separate from entering a draft.
4. Execute named consent/refusal, signed service, deletion and cleanup scenarios. An entered declaration is not execution evidence.

Current related receipts: [console/auth state](2026-10-05-console-and-auth-gaps.md), [review metadata deployment](2026-10-05-review-access-deployment.md), [all109 feature journeys](2026-10-04-feature-journey-map.md). Store decisions must use the tested candidate's behavior, not superseded local-first/Supabase packets.
