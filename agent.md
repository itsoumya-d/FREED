# FREED product charter

Approved product revision: 2026-10-13, publishable recovery, earned app time and complete usability. This version replaces the universal-only public-release requirement with declared, verified coverage on both platforms. Retain the 2026-10-08 earned-time policy, Android repair, local challenges and friend-held adult-protection lock. Audience: adults 18+ seeking to interrupt compulsive browsing and scrolling. Category: digital wellbeing, app/website blocking, and guided recovery; not medical treatment.

14 October setup clarification: turning on Adult websites starts one guided setup immediately. Show one current task and its actual repair/result; keep DNS selection and Safari recovery setup in that journey rather than sending users a separate test checklist. Request required native prompts through supported APIs and retain explicit system/provider consent. Settings return refreshes owner-fenced observed state. Necessary OS choices remain guided when the platform cannot make them automatically. Friend-lock setup and management belong beside adult protection once native mutation enforcement is ready; never show Locked from a UI preference alone. The user rejected further manual phone-test/Mirroring requests; continue source work and record unavailable phone evidence without manufacturing passes.

Current execution priority, explicitly confirmed by the user: make challenges, recovery entry and app blocking work first; Android appearance/login repairs follow. The accepted friend lock and focused screen repairs remain in scope after the core journey. Read docs/product/2026-10-11-android-recovery-friend-lock.md alongside this charter.

13 October design-research amendment: use the connected Mobbin library through the global `mobbin-mobile-design` skill. Keep the established theme and artwork. Prefer recognizable icons, compact native controls, one primary action and progressive disclosure over repeated explanatory paragraphs. Keep essential requirements, eligibility, consent, prices and failures visible. Study actual reference images before adapting a pattern; a reference or polished layout cannot establish protection, motion or device success. Core recovery and native enforcement still come first.

Latest challenge-page steering: use genuine Google sample rewarded ads in internal builds, repair their complete consent/access/load/show/reward/save path, and make the Calm/Breathe, Move and Find chooser a coherent part of the original kite art style. Requirements, available app-time reward and unavailable verification methods must remain understandable before an activity starts. The requested browser names/platforms are retained in docs/product/requested-browser-coverage-20261011.json; that list records requests, not verified availability or coverage. Native crashes, failed activation and missing ad evidence must be repaired before calling the new journey functional.

## The product users buy

FREED connects protection to a useful action:

**Set a boundary → reach it → pause in FREED → resolve access → complete a useful activity → save once → deliberately start a short app break → native protection returns.**

Subscriptions and rewarded sessions fund this experience. A DNS resolver configuration by itself is infrastructure, not a finished commercial product. Measure whether people can complete this journey, understand what is protected, and regain control. Do not count ad views or repeated blocked attempts as recovery achievements.

## Declared browser behavior and release condition — version 3

The first public release must prove browser recovery in Safari on iOS and Chrome on Android, plus the complete selected-app allowance, activity, earned-window and relocking journey on both platforms. Blocking is independent of membership. A supported recovery page, native barrier or notification provides one clear Open Challenge action; automatic entry is also accepted where supported.

Publish only claims supported by public APIs, store eligibility and device evidence for the declared browser, OS, permissions and network conditions. Other paths are explicitly verified recovery, blocking only, unsupported or untested. A system error page or manually finding the app icon does not satisfy recovery. Newly installed browsers require their own evidence before being advertised. Unsupported optional paths no longer block the minimum verified release; they must remain outside its claims. Preserve the older automatic-only and universal version-2 contracts and failed evidence as historical records, never reinterpret them as version-3 passes.

13 October search-boundary clarification: ordinary search-result links/titles should remain available, with protection and recovery when opening a protected destination. The new recovery mode avoids imposing SafeSearch, without promising particular search-engine results. Families itself imposes SafeSearch, and existing OS filtering may also preempt DNS. Migrate a protection mode only after replacement blocking, ordinary browsing and recovery are demonstrated; retain rollback. Never remove working protection merely to force a redirect demonstration.

Separate these capabilities:

1. A rule is saved.
2. The operating system enables it.
3. Network/app enforcement works.
4. A covered interruption is detected.
5. FREED opens by the promised method.
6. Access is correctly resolved.
7. A real challenge completes and saves once.
8. An eligible native app window starts and relocks.

Cloudflare Families supplies public filtering endpoints. This architecture does not require a website zone, Worker, or dashboard DNS records. Device routing, encrypted-DNS bypasses, private browsing, network changes, and mixed-content limitations require independent tests.

Apple's URL-filtering path does not execute the app and does not automatically cover nonparticipating networking stacks. DNS supplies no universal foreground-app callback. Android restricts background activity launch. Never bypass these limits using private APIs, certificate interception, unrelated permissions, or supervised/child-only deployment for ordinary adult customers.

## Commercial recovery journey

- Premium: enter a guided session without ads, then choose Breathe, Find, or Move.
- Free: explicitly choose one rewarded ad for one guided session, Go Premium, or ad-free basic help.
- Unknown entitlement: retry verification or use basic help; do not presume free status and serve an ad.
- Earned interrupted session: resume or replace the activity without another ad. Preserve genuine earned access through recoverable storage errors.
- Ads only appear in foreground FREED after clear opt-in. Earn access only from genuine SDK reward evidence. Skips, errors, unavailability, and duplicate callbacks do not manufacture access.
- Use sample AdMob units in internal builds. Do not send sensitive recovery or browsing information to ad SDKs or use it for targeting.
- Show the chosen app-time offer and challenge requirements before an ad. No eligible extra time means recovery tools, not an ad promising unavailable app access.
- Review the complete reward chain for AdMob eligibility before production ads. Renaming an external benefit does not establish policy compliance.

## Challenges and evidence

Selection uses local deterministic templates with authored revisions, explicit category, duration, verification metadata, environment, and accessibility alternatives. Translation must not alter verification.

- Breathe: comfortable exercise, actual foreground time, pause/resume, optional sound/haptics.
- Move: gentle/seated choices with honest self-report or clearly described supported sensor evidence.
- Find: fresh camera capture and on-device matching. A generic plant result cannot verify a flower. A photograph cannot prove someone touched grass.
- Photo targets remain unavailable until each provider passes the agreed held-out evaluation: at least 95% measured precision and 85% recall, with sample size and errors reported. Uncertain/unsupported results offer retry or replacement without another ad.
- No cloud photo endpoint or paid vision fallback. Delete temporary captures across success, failure, cancellation, interruption, and restart.
- Persist one completion per session with the template revision and actual evidence. Update Today, Progress, milestones, and reminders from saved records, not ad impressions or blocked-attempt counts.

## Earned app time

First setup teaches an editable 30-minute daily allowance (existing valid range 5–240 minutes). Before-use and scheduled rules remain available. Selected apps can share a rule, but usage must be labeled combined across those apps. New selections remain off until explicitly activated and natively acknowledged.

Version 2 offers **5, 10 or 20 minutes** (20 added by the user on 11 October), chosen before starting the challenge. The default daily extra-time cap is **20 minutes per rule**, with allowed settings Off, 5, 10, 20, 30, or 60 minutes. Cap increases take effect the next day; lowering the cap stops further grants without extending or silently cancelling an active window. Premium does not bypass limits, caps, or overlapping rules.

Only explicit **Start my 5-minute break**, **Start my 10-minute break**, or **Start my 20-minute break** after durable live completion starts a continuous native window. Starting consumes the full granted duration from that day's extra-time cap; merely completing a challenge does not. Leaving the app does not pause the window. Unlock only the originating app, never every app in its group. Other app/group restrictions and adult-web filtering remain installed.

Bind an offer and grant to the original owner, native interception/application authority, group revision, configuration generation, scope epoch, budget day, chosen duration, and challenge requirements. Native time and receipts are authoritative. Exact retries return the original deadline and spend once. Account changes, restored history, duplicate callbacks, rule edits, timezone changes, and clock changes cannot manufacture or reset earned authority. Relock while FREED is closed.

Keep version 1 immutable for historical data and active 120-/300-second leases until their original expiry. Never reinterpret a v1 lease as a longer v2 grant. An older binary lacking v2 offers recovery tools and an update explanation, not a silently different reward.

| Activity | Five-minute offer | Ten-minute offer | Evidence |
| --- | --- | --- | --- |
| Breathe | 60 seconds | 120 seconds | Active comfortable exercise time; pause/background excluded |
| Move | 60 seconds or 30 steps | 120 seconds or 60 steps | Honest timer/self-report or supported observed steps |
| Find | One validated object | Two different validated objects | Fresh local target matches; only evaluated targets |

Support quiet, indoor and seated alternatives. Observed steps may support time away from the screen; elapsed background time alone never proves movement. Ten-minute Find is unavailable without two supported targets. Replacement preserves the earned guided session. Basic grounding, writing, and support remain available without earned app time.

Adult websites remain protected after every ad and challenge. Adult-site recovery ends with a safe activity, never an adult-content unlock. Restored history, browser pages, incoming URLs, and stale completion callbacks confer no native authority.

## Friend-held adult-protection lock

The accepted lock covers adult-site protection only. Use a six-digit PIN entered twice by a trusted person and a separate high-entropy recovery key retained on their own device. Confirm only native storage/readback; native mutation paths enforce authorization for every in-app weakening operation, including DNS removal, weaker resolver settings, exceptions and protection resets. A UI switch or reusable JavaScript unlocked flag is insufficient. Repairs and stronger protection remain usable.

Keep verifiers in native Keychain/Keystore-backed protected storage with persistent throttling. No plaintext secrets, cloud records, logging or portable backups. Native action authorization is scoped to the requested change and its exact retries. Email/account passwords, device biometrics, purchases and expiry do not override the friend's code. Recovery rotates the code/key without automatically disabling filtering.

Keep device-level adult filtering and the lock through sign-out and account deletion. Delete account/private history and hosted records as required, while providing a minimal account-free device-protection management destination and clear retention disclosures. Account switching and history restoration cannot clear the lock or transfer intervention authority. OS removal of permissions/DNS or uninstall remains outside FREED's guarantee; do not describe this as tamper-proof parental management.

## Daily experience and membership

Keep Today, Protect, Progress, and Profile as peer tabs. Today gives protection status and one useful next action. Protect shows concise coverage and setup/repair/test actions. Progress shows recorded activity and what helped. Profile/settings provide predictable account, routine, membership, preference, privacy, and support destinations.

| Surface | Responsibility |
| --- | --- |
| Welcome/first rule | Explain allowance → challenge → break; select apps, review cap, activate, and test |
| Account | Required Apple/Google/email, visible callback/result, retry and linking recovery |
| Today | Protection, active/resumable reset, check-in, tools, native-confirmed break countdown |
| Protect/rule editor | Real selected apps first, one rule/cap summary, pending state, one Activate/Update action |
| Interruption/access | Why the boundary occurred, eligible originating app, remaining extra time, access choices |
| Challenge | Requirements, progress, pause, replacement, cancellation and honest evidence |
| Completion | Saved result, optional helpfulness, explicit start-break or leave-blocked action |
| Progress | Shared date selection, actual records, helpful actions, one next adjustment |
| Journal | List → reader → Edit; distinct draft, local photos, saved/error state |
| Settings | Predictable account/membership/preferences/privacy/support; direct Sign out |
| Membership | Genuine prices, equal monthly/yearly benefits, pinned actions, restore/manage/terms |

Retain the 109 engineering obligations with an entry, action, observable result, failure/retry, and return destination for each. Remove duplicate headings and empty group rows; keep DNS in a resumable primary setup sequence and diagnostics in Protection details. Green On needs observed evidence, never merely saved intent. Preserve the light palette; use neutral dark grouped surfaces and restrained accents. Motion explains an actual state and stops off-screen/backgrounded, with Reduce Motion respected.

Onboarding separately demonstrates blocking and recovery entry. Permission denial does not trap the user or remove basic support. Login remains required for the account experience. All app-owned copy and accessibility states support English, Hindi, Spanish, Portuguese, French, German, Arabic, Japanese, Korean, and Simplified Chinese.

Preserve the approved Momentum identity and existing paywall. Monthly and yearly plans retain equal Premium capabilities, actual store prices, clear renewal terms, Restore/Manage actions, owner verification, and paid access through verified expiry. Expiry preserves history and baseline protection. Sell only supported, evidenced benefits; do not invent forecasts or unsupported interception capabilities to enlarge a paywall.

## Definition of ready

Capture complete flows tied to source, signed binary, device/OS, network, and scenario. Verify coverage and handoff separately; free/Premium/unknown access; real sample-ad reward/skip/failure; challenge evidence and persistence; v2 native 300/600/1200-second expiry, originating-app scope and daily caps; account isolation; purchases; local photo cleanup; accessibility; languages; both themes; and interruption recovery. Preserve and test legacy v1 expiry separately.

Passing compilation/source tests is not phone proof. A private testing candidate is not public launch readiness. Missing mandatory declared-path handoff, enforcement, entitlement, purchase, service or performance evidence keeps release blocked. Unverified optional browsers cannot be advertised as supported.

## 11 October daily-rule setup amendment

The user confirmed this example: choose Instagram, set a 30-minute daily allowance, then complete an activity for another 5, 10 or20 minutes once that allowance runs out. The first allowance remains usable without a challenge. Each earned window ends automatically; the next window requires another completed activity and must fit the remaining daily extra-time cap.

The default extra-time cap stays 20 minutes per rule. A 20-minute window uses the same comfortable 120 active seconds, 60 observed steps or two distinct evaluated photo targets as a 10-minute window. The saved preferred window is a default, not permission to unlock. The app shows the activity requirement and available reward before an ad, then requires an explicit Start break after durable completion. New binaries must advertise 20-minute support before the interface offers it. Existing leases, spent budgets, overlapping restrictions, ownership and adult filtering remain unchanged.

Implementation contract: .superpowers/sdd/2026-10-11-android-recovery-friend-lock/earned-window-20-contract.md. This amendment records the intended product; it is not a readiness claim.

## 12 October physical-first acceptance correction

The user requires iPhone Mirroring tests of the actual installed signed app. Layout fixtures with a different source/native host or OS cannot stand as matching product evidence. Record the installed version and OS, distinguish fixture captures from signed-device captures, wait for settled navigation before screenshot judgment, and keep the full relevant window visible. Do not assume the newer iOS native header/picker appearance matches an older simulator.

Current physical12 baseline still fails selected-app activation and has clipped previews and conflicting status. Source repairs await a signed replacement and device verification. Preserve the existing saved challenge during these tests; do not clear earned access simply to force another ad. Website/app status across Today and Protect must use the same owner-fenced observed model, with pending/failed setup distinct from working enforcement.

## 12 October commercial journey and delivery amendment

The user approved the browser-recovery/earned-time/UI plan. Its product is Set protection → encounter a boundary → open FREED → resolve access → complete a useful activity → save once → explicitly start eligible app time → native protection returns. Subscriptions fund ad-free guided recovery; free users explicitly choose one rewarded video for a guided session, Premium, or ad-free basic help. Unknown membership never triggers ads. A previously earned session resumes or replaces without another ad. Adult websites never unlock. Check native app-time eligibility before advertising an app break.

Automatic opening or one clear Open FREED action is accepted, across every available requested browser. This supersedes the older automatic-only release condition without weakening browser coverage. Keep blocking, detecting, handoff, access, completion and native expiry as separate proven capabilities. The existing registry retains 66 requested products / 102 requested platform combinations; unavailable/discontinued/non-phone products do not become passing mobile tests. Phone core comes first; desktop recovery and monetization are a later track. Repair the desktop extension's adult-rule pause and false-success state before publication.

Correction to prior video-selector assessment: Google's documented test-only `ft_ctype: video_app_install` can be forwarded by the installed rewarded SDK's networkExtras on both platforms. Use genuine Google demo units/test mode and Google-only requests; no-fill remains a real result. This is not a production selector and does not govern mediated third-party creatives. Device video rendering, earned/dismissed callbacks and durable access must be evidenced, never simulated by an application-owned video. Production reward-chain eligibility remains a gate.

Photo verification and challenge selection stay local. Require at least 100 positive and 100 confusing-negative held-out images per target/provider, separate from calibration, alongside the 95% precision/85% recall thresholds. Two validated targets per platform are required for the longer Find offer. Targets lacking evidence remain unavailable.

Every one of the 86 existing review units and every shared/inline component receives purpose, reference image, inventory, primary action, observable saved result, failure recovery, return destination, accessibility and source/binary/device evidence. Preserve the approved identity/home/paywall; refine readable natural-height layouts, native controls, restrained dark surfaces, truthful status and contextual motion. Baseline review cells remain 3,440, plus new destinations. Passing source tests cannot mark phone cells complete.

Current baseline: physical12 failed app activation; reviewed source changes await a fresh signed candidate. Candidate13 is preserved and was interrupted before upload after the cross-consumer recovery race was identified. Reconcile partial task28 work, fix the race, and preserve source/binary binding before rebuilding. The complete approved implementation sequence is recorded in docs/product/2026-10-12-browser-recovery-implementation.md.
