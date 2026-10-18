# FREED product journeys and functional gaps

FREED is a digital wellbeing and self-control app combining adult-website protection, distraction limits, and recovery practices. Its primary job is to interrupt unwanted behavior and make the next helpful action easy. The protection and reset journey takes priority over statistics, decorative motion, or account creation. This document incorporates the October 4 request for Shorts and Reels blocking, ad-supported free use, challenges, and complete console setup.

## Market and positioning

The recommended primary store category is Productivity, with Health and Fitness as the relevant secondary Apple category where appropriate. This is a product recommendation based on the current core job, rather than a medical classification.

Appllama research identifies three neighboring groups. Opal, AppBlock, Jomo and BePresent focus on app limits and schedules. One sec and ScreenZen emphasize an intentional pause before access. QUITTR and Brainbuddy emphasize adult-content recovery and daily continuity. FREED should combine effective controls with a brief, compassionate reset; a habit dashboard supports this job. Catalog revenue estimates are not proof of market size or a forecast for FREED.

Research already covers 23 Opal/QUITTR screen references. On October 5, four additional screens were visually inspected: one sec `oth_ve2lc` / `oth_a8bm0` and ScreenZen `oth_iewuk` / `oth_cor0j`. One sec changes a compact trigger-to-intervention preview with the selected timing; ScreenZen separates targets, daily limit, mindful pause and time windows, displaying the current value beside each control. FREED uses the same clarity with its existing Before use / Daily limit / Scheduled modes and explicit native Apply acknowledgement. This is a design inference from those four screens, not proof of either app's enforcement or a complete review of its catalog. Their imagery and watermarks are research material and are not application assets.

## Supported behavior and unavoidable limits

| User goal | iOS | Android | Required product behavior |
| --- | --- | --- | --- |
| Block adult websites across ordinary device DNS traffic | Configurable Families encrypted DNS and Safari adult-domain rules | Local DNS/VPN guard and reviewed domain data | Separate configured, OS-enabled and measured health; explain bypasses and test real browsing. |
| Block only Shorts/Reels inside native YouTube/Instagram | Screen Time shields expose apps/domains/categories, not individual native screens | Accessibility detection remains an experimental implementation requiring disclosures, Play review and device evidence | Public per-surface activation stays off on both platforms under the October 5 shared plan. Offer the supported selected-whole-app alternative. |
| Block Shorts/Reels in a browser | Safari web extension can operate on supported sites with user-granted access; it is not a Chrome iOS extension | Supported-browser detection/controls need their own device matrix | Separate browser setup from native apps. A saved rule is not enforcement. |
| Open FREED immediately after a block | A Screen Time shield action can open the controlling app on iOS26.5+ after the user presses its action; older systems need the supported notification/manual path | Foreground handoff depends on consent, Accessibility/background-start rules and device behavior | Explain the actual trigger. Do not promise a universal automatic redirect. |
| Open FREED because DNS rejected a website | DNS has no application-launch command | A local guard may observe a rejected query, but foreground launch is a separate OS-controlled operation | DNS protection works independently of intervention navigation. Provide immediate support from FREED. |
| Remove every adult image/video inside mixed-content apps | Domain filtering cannot classify every encrypted in-app item | Same limit for DNS-based filtering | Avoid a total-content-removal claim. Use whole-app rules where that is the chosen supported protection. |

These are architectural limits rather than missing Cloudflare dashboard toggles. [Apple ShieldSettings](https://developer.apple.com/documentation/managedsettings/shieldsettings), [shield action opening](https://developer.apple.com/documentation/managedsettings/shieldactionresponse/openparentalcontrolsapp), [Play Accessibility policy](https://support.google.com/googleplay/android-developer/answer/10964491?hl=en).

## First setup

1. Welcome states the purpose in one viewport at normal text size. Language and appearance are available immediately. The October 5 coordinated flow requires a real Google, Apple or email account for the app journey; it must still expose immediate basic Help/SOS without an advertisement. Earlier guest-onboarding wording is superseded.
2. The user chooses adult websites, selected apps, or a combination. Each target shows its supported platform route before requesting a permission. Public Shorts/Reels activation remains off.
3. Adult-website setup explains the DNS transport and opens the required system consent/settings. App limits use a separate Screen Time or Android permission flow. Browser rules use a separate extension flow.
4. Return from system settings refreshes native state. The interface displays configuration, permission and measured health independently.
5. The user tests `nudity.testcategory.com` and `example.com` on the real device. A local classifier check is labeled as configuration evidence, not a browsing result.
6. Today shows the remaining setup action or current truthful protection summary. Basic Help/SOS remains accessible without a purchase. Guided licensed sessions use the separately validated free-ad, paid or review-access path; membership does not establish native app-unlock authority.

For Families filtering, use `1.1.1.3`, `1.0.0.3` and `https://family.cloudflare-dns.com/dns-query`. No website zone or Cloudflare account is required. Cloudflare Gateway custom block pages are a different managed-device product requiring additional certificate/traffic configuration; setting a website redirect rule cannot redirect encrypted requests to arbitrary sites. [Families setup](https://developers.cloudflare.com/1.1.1.1/setup/), [Gateway block-page requirements](https://developers.cloudflare.com/cloudflare-one/reusable-components/custom-pages/gateway-block-page/).

## Intervention and reset

The desired journey is attempt → supported native/browser block → validated pending intervention → foreground FREED → membership/consent decision → reset challenge → actual verification → outcome → durable completion → target-specific access window where allowed → native expiry. DNS filtering stays enforced independently and is never released by an advertisement or challenge.

An untrusted deep link cannot create unlock authority. The target and expiry originate from native/server truth; stale, mismatched or replayed requests must fail without disturbing unrelated valid protection. Back, dismiss, backgrounding and permission loss cannot complete a challenge. Only one verified completion updates Today, history, milestones and reminders.

Free monetization needs a policy-compatible format. The currently implemented rewarded path is explicit opt-in. Google requires a genuine decline/skip path that preserves normal use, so it cannot be changed into a compulsory rewarded-ad gate. Premium and SOS never request ads. No fill, consent refusal, timeout or interruption keeps a free reset reachable. If a future non-rewarded interstitial is chosen, it needs its own placement, frequency, dismissal, consent and policy review; it is not interchangeable with the existing reward callback. The app must not send blocked targets, browsing history, private reflections or Screen Time data to an ad SDK. [Google rewarded-ad policy](https://support.google.com/admob/answer/7313578), [rewarded format behavior](https://support.google.com/admob/answer/7372450).

## Daily use and connected features

| Family | Easy entry and user action | Data and outcome | Current boundary |
| --- | --- | --- | --- |
| Today | One next action, protection row, compact practice tiles, accessible help | Shows recorded activity; a completed practice updates the same history | Native English/theme anchors reviewed; full matrix incomplete. |
| Protect | Choose target, enable supported control, set limits/schedules/exceptions, test and repair | Native authorization and enforcement determine status | Signing/capabilities configured; physical routing, restart and expiry need proof. |
| Recovery | Pause/breathe/move/write/check in or record a slip; stop safely | Retained drafts and explicit completed/cancelled outcomes | Local contracts pass; sensors/camera/real interruptions require device tests. |
| Coach and challenges | Clear offline/service/quota state; choose local guidance when online service is unavailable | Private input is handled under the feature disclosure, never translated as UI copy | AI credential absent; online deployment remains disabled. |
| Library | Search localized titles, open an article, retain position | Reading state and preferences stay local | Local behavior verified; all-language device review incomplete. |
| Progress | History first, earned milestones, reports and labeled estimates | Derived from durable recovery records, not invented counters | Native and large-text/RTL scenario evidence incomplete. |
| Profile/account | Required real Google, Apple or email entry; collision/reset/retry states; immediate basic Help remains separate | Linking preserves local history and purchase ownership | Task1 local model/controller proof passes; real provider completion still needs signed-device evidence. |
| Reminders/accountability | Choose schedule/consent, inspect preview, share deliberately | Private-friendly notifications; contacts and reports only through explicit actions | Services configured; push delivery and ownership tests remain. |
| Backup/deletion | Link account, encrypt with passphrase, upload/restore or delete with clear confirmation | Ciphertext-only server storage; restore cannot grant Premium/unlocks | Infrastructure/live boundaries verified; authenticated end-to-end mutations remain. |
| Membership | Compare real monthly/yearly store prices, restore/manage, continue free | Verified entitlement lifecycle; cancellation retains the paid period | Combined verifier credential gate currently blocks checkout. |
| Preferences/support | Native System/Light/Dark, ten native language names/flags, motion, legal/support links | Preferences persist; Arabic offers an explicit safe restart; private drafts remain unchanged | Native widgets and flags reviewed; complete screen matrix remains. |

[All 109 feature interactions and expected outcomes](2026-10-04-feature-journey-map.md) and [machine-readable map](2026-10-04-feature-journey-map.json) retain every catalog item, its controls, platform, flow and remaining verification.

## Navigation and presentation

Today, Protect, Progress and Profile remain four peer tabs with independent history. Details push from their origin. Short choices use native sheets; reset tasks use self-contained flows. Onboarding completion removes obsolete history. Purchases return to the requesting feature, and SOS opens immediately from every root.

The approved kite identity, colorful practice categories, bold readable type and shared light/dark palettes remain. The companion explains a task and reacts to earned events or a deliberate interaction. Urgent support, purchases and destructive actions stay restrained. Motion stops out of focus/background and respects Reduce Motion. Artwork never replaces a real price, permission result, verification result or counter.

## Gaps and current evidence

| Priority | Gap | Correction or required next evidence |
| --- | --- | --- |
| P0 | Literal native iOS Shorts-only and universal immediate DNS redirect promise is unsupported | Use the matrix above in product claims and setup. Test supported whole-app/browser paths; do not enable a fictional toggle. |
| P0 | Adult activation/Google entry and internal native flags were missing from served QA builds | Corrected controls, public OAuth inputs, independent DNS setup and Android consent activation implemented; fresh native/signed bundle includes them. |
| P0 | Firebase originally had no deployed backend | Billing, Storage, App Attest and the original18 scoped services configured with exact receipts; October5 offer/review metadata endpoints bring the total to21 ACTIVE. Signed-client success still needs execution. |
| P0 | Numeric expiry broke Firestore TTL and duplicate reads | Timestamp adapter correction; legacy numeric reads retained and tested. |
| P0 | Reviewed feed failed on unsupported suffix-wide rules | Host-only parser preserves safety and omits eight unsupported entries; live 20,376-domain publication verified. |
| P0 | Store verification credentials incomplete | Prepared FREED-only Play access/key still needs explicit approval; purchase/checkout/Google notification deployment remains disabled. |
| P0 | Production Apple TEST request unauthorized | Sandbox signed delivery succeeded; Production 401 remains unresolved and is not inferred away. |
| P0 | Online coach credential absent | Keep honest offline support; obtain a server-held provider key before deployment and delivery tests. |
| P1 | Native visual/interruption/performance evidence incomplete | Complete device recordings, small screen/large text/RTL/screen-reader checks and 2,560 platform-language-theme surface reviews. |
| P1 | Google Play draft setup incomplete | Latest confirmed readback is 6/11 tasks, including accurate health declarations; reviewer access, audience, rating, Data safety and current listing remain. |
| P1 | TestFlight replacement and screenshots pending | Build 2 passed validation and export compliance, then was expired because it predates the UI/privacy corrections. Package the coordinated source freeze, upload and verify actual Internal availability; capture current native screens at accepted sizes. |

Historical integration evidence was173 suites/1,080 assertions with109 local checks, before the current UI/native corrections. Original backend evidence was216 Node22 emulator tests and39 negative live boundary checks. The October5 review endpoint has a240-test isolated backend receipt, downloaded source binding and three rejection probes. These are separate source revisions and must not be added into a current app coverage percentage. Signed Sandbox Apple TEST delivery is independently verified; Production401 remains unresolved. Physical blocking, normal browsing, permission loss, reboot, native expiry, ads, purchases and release performance need their own evidence.

The shared dirty checkout and other chat's changes are preserved. Console changes are restricted to FREED IDs and the verified project. Private keys, signed payloads and TEST tokens stay outside repository artifacts.

## October 5 coordinated completion work

The other UI chat owns the newly approved shared setup/login/offer/recovery flow. This chat owns the bridge, native guards, backend and store closure; shared broad source-generating checks are stopped. Three native guard modes use explicit configuration acknowledgement and independent runtime readiness. Legacy missing modes stay daily-limit, empty selections never activate a default guard, and independent strict/timed guards retain their own state. iOS schedule configuration explicitly binds timing to retained selected application tokens; Android package arrays cannot be treated as iOS token selection. App-only temporary breaks require fresh native authority and accepted native relock registration.

The four native Firebase feature modules no longer register or implicitly enable remote coach/challenge/retention callbacks. Local mode cannot dispatch off device. This fixes an automatic context upload found in build 2; its expiry prevents recommending that old binary for testing. Future cloud support requires separate owner-scoped consent and deployed per-feature readiness, with user-initiated requests. The foundation readiness response does not prove AI or checkout readiness.

The Android Publisher API is enabled in freed-7d5ee. Play metadata is saved as review drafts: ads Yes, Productivity category and public contact details, government app No, financial services None. Subscriptions remain unavailable until a billing-enabled signed Android package is uploaded. FREED-only service-account billing access/key approval is still pending; no credential or account-wide access has been created.

Native guard closure (October 5): both platform packages passed independent scoped review after repairs to restored iOS lease authority, Android hard timed-guard precedence and stale daily timer fallback. Public bridge tests pass for the exact mode API and iOS/Android schedule scope isolation. Actual unsigned Release device-SDK builds of the iOS protection library and DeviceActivity extension pass. Full app, real device, store, performance and all-surface evidence remain pending.

The UI-owned task1 real-account/offer bootstrap, task2 feature-directory/forms and task3 explicit guard/schedule flow passed their scoped reviews. Task4 guided sessions, SDK presentation lifecycle and native-break caller integration are in progress; task5 localization/full presentation review follows. No final UI source freeze or current installable recommended TestFlight replacement exists yet. [Current console/auth gates](2026-10-05-console-and-auth-gaps.md), [offer deployment](2026-10-05-journey-offer-deployment.md), [review capability deployment](2026-10-05-review-access-deployment.md).

Android's ordinary DNS defaults were still the unfiltered Cloudflare resolver. The bounded October5 correction switches upstream defaults to Families `1.1.1.3` / `1.0.0.3`, retaining interception routes for the old `.1` endpoints. The actual-source JVM routing regression failed before correction and passes afterward; six focused native/health/privacy checks and independent scoped review pass. Encrypted Families transport is unchanged. Underlying-network fallback preserves local classifier/feed coverage but cannot establish Families category filtering; captive sign-in pauses classification and shows paused coverage. [Source hashes and verification](artifacts/2026-10-05-dns-families-correction/receipt.json). No real-device resolver, VPN or ordinary-browsing proof is added by these local checks.
