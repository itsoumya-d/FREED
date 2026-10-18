# Purpose-led purchase and native navigation review

Read-only production review, 2026-10-03. No production/native/config changes or tests performed.

## Existing chain and gaps

1. `PaywallScreen` (`freed-app.tsx:1117`) loads `fetchLaunchStorePrices` and passes per-product presentations to `PremiumOffer`. `presentPaywallPlan` (`paywall-presenter.ts:32–42`) matches the exact product and a store-formatted price, but `canPurchase` currently checks pricing alone. A selected product can therefore enable Subscribe while the verification service is unavailable.
2. The native adapter protects the real financial boundary: before requesting purchase, it initializes listeners, calls server checkout context, refreshes exact product pricing/base-plan offer, verifies existing membership ownership, and only then requests purchase (`native-iap-adapter.ts:311–374`). Retain all of these checks. UI preflight is advisory and must not replace adapter revalidation.
3. `fetchStorePrices` returns `[]` when native initialization fails (`native-iap-adapter.ts:306–308`); `fetchLaunchStorePrices` also returns `[]` for unsupported mode/provider (`monetization.ts:274–280`). An empty normalized list cannot distinguish an empty store catalog from failed connection, absent SDK, or invalid product pricing. Product fetch rejections remain errors. The UI must not diagnose empty results as network failure or missing store publication without more evidence.
4. Free/X exits are disabled during busy work (`PremiumOffer.tsx:129,147`; PaywallScreen onClose guard). The return resolver sends first-run users toward account/setup (`paywall-navigation.ts:32–34`), conflicting with the newly approved immediate free recovery path.

## Minimal recommended API

Keep price availability and checkout readiness separate:

```ts
type CheckoutReadiness =
  | { status: 'checking' | 'unavailable' | 'error'; ownerUid: null; message?: string }
  | { status: 'ready'; ownerUid: string };

// Existing price eligibility remains exact-product, store-localized and native-only.
const canPurchase = selectedPresentation.canPurchase
  && checkoutReadiness.status === 'ready'
  && checkoutReadiness.ownerUid === getFirebaseAccountScope()
  && !busy;
```

Expose this final eligibility to `PremiumOffer` as `purchaseAvailability` (or an explicit `canPurchase` plus checkout status/message). Its Subscribe rendering **and** both controller press guards must use the conjunction. Keep plan display independent: real prices can remain visible while checkout is unavailable. Never substitute fabricated prices or an enabled preview checkout.

For preflight use existing native APIs:

```ts
const api = await getFirebaseCallableContracts({ ensureGuest: true });
if (!api) /* unavailable */;
await api.getCheckoutContext(); // validated owner-binding response; discard identity from display state
```

`getCheckoutContext` validates the response UUID/hash (`firebase-client.ts:898–905`). The server enforces Auth/App Check, rejects deletion tombstones, parses actual verifier keys/certificates and returns derived account identity (`functions/src/purchase-firebase.ts:66–75`). It does not prove the subsequent store transaction will succeed. It may persist the signed-in account's permanent purchase fence; it is not a side-effect-free health query. `backendReadiness` is broader service diagnostics and should not substitute for this purchase-specific contract.

Retain a `loading/ready/error` price state, or add `unavailable` for an empty normalized result. Describe empty/missing-selected-product results as price unavailable; describe rejected fetches as loading failed, using confirmed error codes only if distinguishing network. Keep retry actions for both independent failures. A missing yearly price must not be rescued by a monthly product being present.

## Owner and stale-result rules

- Begin an account operation before preflight; after `ensureGuest`, use `bindCreatedGuest(getFirebaseAccountSummary().anonymous)` so only the deliberate null→anonymous transition is adopted. Assert the operation remains current after server response.
- Scope readiness to the resulting owner UID. Clear it on retry, account change, paywall remount and relevant invalidation. Compare the live UID again on press; stale readiness cannot enable another owner's purchase.
- Callable transport already captures UID and checks it before/after the response (`firebase-native.ts:346–368`). It exports a synchronous scope reader but no general React auth subscription. Do not assume the reader itself causes rerenders; pass an account revision/scope from root if needed and retain live press checks.
- Existing membership action captures the account gate and paywall navigation token (`freed-app.tsx:8353–8380`). Preserve its owner assertion, guest binding and navigation ownership. If Free is enabled while awaiting confirmation, allow the operation to finish safely but show its notices/redirect only in the owning paywall generation; root currently gates redirect but not every notice.
- First-run Free returns `main`; preserve a non-onboarding return origin. Do not require sign-in or completed protection setup merely to leave the paywall.

## Native theme and tabs

`app/_layout.tsx:17–28` already bridges resolved mode into React Navigation `DarkTheme`/`DefaultTheme`, with themed native stack/card/text/border colors. `useAppTheme` obtains resolved preference mode, and the preference provider applies native Appearance. This part of the new plan is already present.

`app/(tabs)/_layout.tsx` uses actual `NativeTabs` and the four peer routes; Shield remains the route while its visible label is Protect. It currently supplies an opaque `colors.bg` tab background. Installed Expo 55 typings support native `blurEffect` values `systemDefault`, `systemChromeMaterialLight`, and `systemChromeMaterialDark`; use native material rather than custom translucent layers. Supplying an opaque background can hide visible blur, so review iOS background treatment together with native material and resolved mode. Keep a suitable opaque Android surface. Visual material correctness and tab theme changes still need fresh native evidence.
