# FREED feature inventory and platform evidence

Reconciled 2026-10-02 during the native navigation rebuild. Current production/release readiness is **not complete**.

Current source addition, 2026-10-05: **public Basic Help** is an isolated local modal entered from startup hydration, Welcome, required/unavailable account access and the offer. It provides comfortable breathing without holds plus grounding, with immediate dismissal and no saved exercise, reward, native unlock, cloud, store or ad action. Account forms remain mounted beneath their nested help presentation. Normal private and paid routes still require the existing account/offer policy. Feature 30 now includes these explicit scenario obligations and `tests/ui/public-basic-help.test.tsx`; the current Momentum treatment map registers this presentation separately from its 65 route surfaces. Local tests do not certify iOS/Android modal presentation, keyboard/back paths, light/dark/RTL/large-text layout, accessibility or physical-device frame timing. Frozen v6/TestFlight 1.0(3) and Android evidence remain historical for this changed source.


The [platform ledger](validation/artifacts/2026-10-02-native-ui-testflight/feature-ledger.json) records Android and iOS local, emulator/simulator, live, physical-device, blocked, and unsupported status for every row below. The [source control inventory](validation/artifacts/2026-10-02-native-ui-testflight/source-control-inventory.json) records exact button/metric labels and source locations, including legacy-only controls. These are baseline receipts; final integration must append fresh binary/device evidence.

- **S**: source inspected; actual execution unverified.
- **L**: isolated local behavioral tests passed; native integration remains pending.
- **P**: final emulator/simulator and physical-device verification pending.
- **B**: live-service/signing/attestation requirement blocks this part.
- **U**: unsupported on the stated platform.
- **N/A**: platform does not expose that capability.

Source audits supplement behavioral/device evidence. They cannot prove permission approval, blocking in other apps, movement, purchases, attestation or backend delivery. Historical screenshots/builds do not certify the rewritten native shell.

Current evidence:

- [Timezone validation](validation/artifacts/2026-10-02-native-ui-testflight/timezone-validation-final.json): accuracy 18/18, snapshot 6/6, reconciliation 5/5 and frozen calendar/DST/rollback pass in UTC, Kolkata, New York, London and Sydney.
- [Core runs](validation/artifacts/2026-10-02-native-ui-testflight/core-timezone-validation-final.json): exact current successes/failures; earlier 278 core / 198 emulator counts are historical.
- [Feature tests](validation/artifacts/2026-10-02-native-ui-testflight/local-feature-validation.json): isolated local suites/logs only.
- [Live read-only backend](validation/artifacts/2026-10-02-native-ui-testflight/backend-readiness-readonly.json): billing enabled/linked; Functions 0, Storage buckets 0, all 6 Remote Config flags false at capture. Secret metadata denied.
- [Secret presence](validation/artifacts/2026-10-02-native-ui-testflight/secret-readiness-presence.json): five of seven required names absent from inspected local sources; deployed presence IAM-unknown.
- [Signing metadata](validation/artifacts/2026-10-02-native-ui-testflight/ios-signing-metadata.json): distribution identity exists; six FREED cached profiles are development; current distribution IPA/upload not proved.
- [Dependency audit](validation/artifacts/2026-10-02-native-ui-testflight/dependency-audit.json): **16 high production advisories**, propagated through Expo build tooling from node-forge <= 1.4.0; no patched version demonstrated. Native-binary reachability needs separate evidence. Old zero-advisory claim is false.
- [Historical release prep](validation/artifacts/2026-10-02-release-prep/progress-receipt.json): signed Android AAB/APK succeeded before current routing rewrite. Final build/install/checksum pending. Historical iOS paywall/launch captures prove only their captured build.

The onboarding summary presents quiz preferences, without brain-chemistry measurements or recovery-date prediction. Recovery score/growth/urge forecast are activity estimates; XP/milestones must match recorded events and low-data states. Prior neurochemical projection/reboot-path wording is retired.

## Detailed surfaces, controls and metrics

Columns summarize local evidence and outstanding native/device/live checks. Individual environment statuses and next scenarios are in the JSON ledger.


### Onboarding

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| splash/welcome | Brand/loading, start quiz, skip/free entry | S; P | S; P |
| quiz | Five goal/history/trigger/symptom/reset questions; option radios; Back/Next; step counter | S; P | S; P |
| planCalculation | Preparation progress; preference goal/trigger/reset/concern summary; Protect My Apps & Proceed | S; P | S; P |
| appSelection | Supported apps/package aliases; selection, Back, Continue | S; P | S; P |
| account sign-in | Google, Apple, continue without account, cancel/loading/disabled/error | S; P | S; P |
| account linking | Link another sign-in, collision notice, same-UID purchase ownership, Sign out | S; P | S; P |
| protectionSetup | Stage/step/progress, required authorization action, settings return/auto-advance | L; P | L; P |
| setup retry/fallback | Keep trying, Continue anyway, limited warning, Finish setup | L; P | L; P |

| email create/sign-in | Email/password/confirm password, Show/Hide password, Create account/Connect email/Sign in, Back/Already have an account/Skip for now/Cancel | S; P | S; P |
| email verification | Resend verification email, I have verified my email, Continue and verify later, busy/error/verification state | S; P | S; P |
| password reset | Forgot password, Send reset email, Check your email, Back to sign in, Use a different email | S; P | S; P |

### Protection

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| Android adult feed | Reviewed feed sync/checksum/304/stale fallback | S; P | N/A |
| Android DNS guard | Disclosure, Not now/I understand, start/stop, VPN/settings/health diagnostics | S; P | N/A |
| Android Private DNS | Open/Review Private DNS/network settings and strict-state check | L; P | N/A |
| Android Usage Access | Open Usage Access/settings, grant recheck and app-time limits | L; P | N/A |
| Android Accessibility | Authorize app intervention/settings return and service state | L; P | N/A |
| Android selected app limits | Daily limit, package choices/aliases, selected-app intervention | S; P | N/A |
| iOS Screen Time | Authorize Family Controls, apply/pause adult filter, Choose/Edit Apps | N/A | L; P |
| iOS app limit monitor | Daily limit, DeviceActivity, Night Guard/Stop Guard | N/A | S; P |
| iOS Safari adult blocker | Safari Settings enablement and adult-only domain rules | N/A | S; P |
| iOS Safari Focus Shield | Approved Shorts/Reels/For You web handoff and extension settings | N/A | L; P |
| iOS native-app surface inspection | Inspect/calibrate screens inside other native apps | S; P | U |
| Focus Shield presets | Enable/Preset On YouTube Shorts/Instagram Reels/TikTok For You | S; P | S; P |
| Focus Shield calibration | Calibrate, cancel calibration, saved local rules/remove | S; P | U |
| Focus Shield diagnostics | Rule count, health/degraded/revoked state, refresh/removal | S; P | S; P |
| always allow domains | Enter domain, Add, remove, persistence | S; P | S; P |
| URL diagnostics | Input, Check, Visit, Google/YouTube quick fill, Adult Search Test | S; P | S; P |
| discipline preferences | Daily limit, Unlock, Shorts guard, Intensity/Outdoor/Exercise/Social | S; P | S; P |
| strict/focus modes | Emergency strict and Deep focus toggles | S; P | S; P |
| sleep/work/weekend modes | Sleep start/Wake, Work start/end, enable toggles, Weekend adventure | S; P | S; P |
| earned unlock | Active duration/countdown, scoped helped challenge, expiry/relock | L; P | L; P |

### Today

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| native roots | Today/Shield/Progress/Profile tabs; per-tab push/back/restore | S; P | S; P |
| SOS/urge support | Urgent support entry from all roots; Back to Safety; reset continuation | S; P | S; P |
| daily pledge | Take pledge, pledged state/check-in, pledge streak | S; P | S; P |
| habit toggles | No adult content, Cold shower, Exercise, Meditation, Journal, No social media | S; P | S; P |
| dashboard metrics | Day Streak, Habits Done count/total, Days to 90, Karma Points, elapsed clock | L; P | L; P |
| week/milestones | Seven-day strip, current/best, next milestone and celebration | L; P | L; P |
| recovery shortcuts | Library/article, breathing/custom reset, CLARA/check-in, Progress/Profile | S; P | S; P |

### Recovery

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| intercept | Reason, streak/plan, Surf the Urge/Continue to Reset/Back to Safety | L; P | L; P |
| rewarded reset | Loading, Watch again, Continue without ad/pause, cancellation/reward/failure | L; P | L; P |
| challenge list | Adaptive category/title/intensity/steps, choose reset, Back | S; P | S; P |
| challenge completion | Keep Going/Verify Action/I'm Done, Urge Passed/Still Need Support/Saving | L; P | L; P |
| timer verification | Duration/countdown and finish gating | S; P | S; P |
| motion verification | Real samples, threshold, denied/unavailable state | S; P | S; P |
| steps verification | Pedometer/minimum steps, permission unavailable state | S; P | S; P |
| outdoor verification | On-demand location and measured sampled displacement | S; P | S; P |
| photo verification | Fresh camera, on-device label/confidence match, temporary cleanup | S; P | S; P |
| connection verification | Message Partner/I Reached Out | S; P | S; P |
| customChallenge | Upgrade, title/why/steps, Type/Intensity/Minutes, Save and Start | S; P | S; P |
| breathing | 4-7-8/box/physiological sigh, Begin/Pause, phases/haptics, Back | S; P | S; P |
| checkin | Mood/urge/sleep/reflection, Save Check-In, Back | L; P | L; P |
| slip log | Trigger/note, Save and Start Again/Go Back/Log Slip Safely | L; P | L; P |
| CLARA local | Input/send, reply/history, offline fallback/redaction/crisis links | S; P | S; P |
| CLARA remote | Up to 20 remote replies/day, quota/timeout/aggregate context | S; B, P | S; B, P |
| remote challenges | Server generation from answered feedback/preferences | S; B, P | S; B, P |
| remote retention | Next action/focus tags/suggested guard/local fallback | S; B, P | S; B, P |
| Library/article | Category/content/reset links, article scroll, Back to Library/Today | S; P | S; P |

### Progress

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| zero-state | No signals/Not enough data; no fabricated measured score | L; P | L; P |
| recovery score | Activity estimate; Current/Best/Attempts | L; P | L; P |
| XP/level/badges | XP/to-next/level; Honest Check-In, Seven Clean Days, Reset Practice, Urge Surfer, Protected Moment, Steady Rhythm, Honest Reset | L; P | L; P |
| insight metrics | Check-ins/7, average urge/sleep, strongest pattern | L; P | L; P |
| urge estimate | Premium score/level/confidence/action/window/drivers; low-data blank | S; P | S; P |
| weekly report | Risks/Resets/Slips/Check-ins, range/pattern/next focus | L; P | L; P |
| monthly growth | Premium activity index, Protected/Helpful/Check-ins/Slips, summary/range/experiment | L; P | L; P |
| snapshot metrics | Help rate/Peak risk/Reset rate/App shields/App opens/Unlock per week | L; P | L; P |
| extra snapshot values | Foreground minutes/source/category success/unlock minutes/streak-history/resets | L; P | L; P |
| analytics controls | Enable Sharing/Turn Off, Send Snapshot, busy/status/last-sent/retention | S; B, P | S; B, P |

### Profile

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| account/membership card | Connect/link provider/Sign out, Manage membership/Membership active | S; P | S; P |
| Premium authority | Equal yearly/monthly capabilities, expiry/revoke/offline cache/ad-free | L; P | L; P |
| recovery history | Lifetime protected attempts and private slip count/Log Slip Safely | L; P | L; P |
| reminders | Master On/Off; Morning/Evening/Night guard; Smart guard time/reason | S; P | S; P |
| daily plan | Next action/check-in prompt/focus tags/suggested guard time | S; P | S; P |
| local encrypted backup | Passphrase/text, Create/Restore Backup, wrong-passphrase/corruption | L; P | L; P |
| automatic backup | Enable/Turn off, securely stored passphrase, upload after changes/retry | S; B, P | S; B, P |
| hosted backup | Connect email/auth, Upload/Download Latest/Restore/Delete encrypted remote data | S; B, P | S; B, P |
| restore conflict | Keep current history/Restore backup explicit choice | L; P | L; P |
| email-link auth | Send link/pending-link/handoff/UID ownership | S; P | S; P |
| accountability partner | Enable, SMS/email, name/contact/template, Message Partner | S; P | S; P |
| sponsor report | Weekly aggregate preview, Send Report/premium upgrade | S; P | S; P |
| support circle | Add member/draft, SMS/email switch, name/contact, Send report/Remove | S; P | S; P |
| privacy/support links | Privacy/Support/Account Deletion Help/Terms | S; P | S; P |
| local deletion | Delete Local Data/Confirm Delete | S; P | S; P |
| account deletion | Delete Account & Data/confirmation/error/completion | S; B, P | S; B, P |
| Shield shortcut | Open Shield | S; P | S; P |

### Paywall

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| annual/monthly selection | Two equal-benefit radios, no trial/future plans, selection retained | L; P | L; P |
| price/subscribe | Store price/detail, Subscribe/busy, Retry store prices | L; P | L; P |
| free exit | Close/Continue with Free and correct origin | L; P | L; P |
| Restore purchases | Guest/account restore and ownership fence | L; P | L; P |
| Manage subscription | Native store manage/cancel and refresh state | L; P | L; P |
| benefit promises | Ad-free resets/challenges, deeper reports/estimated forecasts, support-circle reports, CLARA 20/day | L; P | L; P |
| legal actions | Privacy/Terms and free path | S; P | S; P |

### Platform

| Feature | Controls / metrics | Android | iOS |
| --- | --- | --- | --- |
| auth/App Check | Guest/linked UID, account fences, Play Integrity/App Attest | S; P | S; P |
| push notifications | FCM/APNs registration/refresh/delivery/open/disable consent | S; B, P | S; B, P |
| Firebase foundation | Rules/indexes/owner data/idempotency/rate limits/tombstones/storage policy | S; B, P | S; B, P |
| adult feed hosting | Reviewed feed/conditional HTTP/checksum/import | S; P | S; P |
| final release binary | Android upload-signed AAB/APK/Hermes; iOS five embedded extensions | S; P | S; P |
| TestFlight | Distribution archive/export/upload/processing/install | N/A | S; B, P |
| unsupported iOS inspection | Full VPN/HTTPS inspection/native third-party screen OCR | S; P | U |
| community workflows | Remote community/milestone sharing | S; B, P | S; B, P |

## Live and release gaps

1. Capture final native roots/push/back/state restore, free exits, large text, keyboard and cold launch on Android and iOS.
2. Root will append actual foundation deployment inventory/live smoke. Billing is enabled; older enable-Blaze blocker is stale. At this capture Functions/Storage are undeployed.
3. Exact secrets: APPLE_STORE_ISSUER_ID, APPLE_STORE_KEY_ID, APPLE_STORE_PRIVATE_KEY, APPLE_STORE_APP_ID, APPLE_STORE_ROOT_CAS_BASE64, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, OPENAI_API_KEY. Only app ID/trust roots are present locally. Secret metadata denial is not proof of deployed absence.
4. Physical Android DNS/Accessibility/limits and iOS Screen Time/Safari evidence remain necessary. Actual sensors, App Check, StoreKit/Play receipts and APNs/FCM need real devices/services.
5. Final iOS distribution archive/export must inspect main app and all five extensions, signing/team/profiles, app group, approved Family Controls distribution capability, associated domains/Apple sign-in and effective APNs environment. Record IPA checksum, upload result, processing/build number and TestFlight install.
6. Real store lifecycle: localized products, purchase/restore/renew/refund/revoke/expire/account ownership; real ad consent/reward/no-ad state. CLARA quota is implemented but remote path disabled/undeployed at capture.
7. Resolve dependency advisories or document approved disposition and actual shipped-binary reachability. An old clean report or source audit cannot replace the current audit.

Preserve original recovery data and earlier receipts. Promote fresh evidence tied to source hashes, final native binary checksum and observed scenario.
