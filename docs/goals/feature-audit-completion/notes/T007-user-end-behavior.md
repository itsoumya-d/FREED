# T007 — User-end observed behavior (Scout, read-only)

Date: 2026-09-27. Method: run the app on the most reachable runtime and record what actually
happens, with the command and its real output behind every claim. Nothing in this note is
inferred from reading code except where a row is explicitly labelled *static*.

## 0. Which runtime was actually reachable (this decides the reach of the whole note)

| Runtime | Attempted | Real outcome |
| --- | --- | --- |
| Android emulator (AVD `PrimerAuditApi36`, API 36, arm64) | `~/Library/Android/sdk/emulator/emulator -avd PrimerAuditApi36 -no-window -no-audio -no-boot-anim -gpu host` | **Fails to boot.** Log: `HVF error: HV_DENIED` → `qemu-system-aarch64-headless: failed to initialize HVF: Invalid argument` → `WARNING \| QEMU main loop exits abnormally with code 1` |
| Same AVD, software rendering forced | `... -no-window -no-audio -no-boot-anim -no-accel -gpu swiftshader_indirect -read-only` | **Same failure, identical `HVF error: HV_DENIED`** — the AVD image is arm64, so `-no-accel` cannot substitute. `adb devices` stays `List of devices attached` (empty) in both attempts. |
| Android debug build | `cd android && JAVA_HOME=$(/usr/libexec/java_home -v 17) ./gradlew assembleDebug --console=plain` | **Running green**: configuration succeeded, `:app:configureCMakeDebug[arm64-v8a]`, `:react-native-reanimated:buildCMakeDebug`, `:expo-modules-core:buildCMakeDebug` and `:app:*` tasks executed with no error. Autolinking log records `:react-native-google-mobile-ads:android.minSdk using custom value: 24` |
| iOS Simulator | `xcrun simctl boot 380E0D11-D964-4B0C-9866-0E9D1CF6455B` → `iPhone 16 Pro (…) (Booted)` | **Booted and usable** |
| iOS app build for simulator | `npm run build:ios-simulator -- --log /tmp/t007-ios-build.log` → `xcodebuild -workspace ios/FREED.xcworkspace -scheme FREED -configuration Debug -sdk iphonesimulator -destination id=380E0D11-… -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO …build` | running; result recorded below |
| Physical Android device | `adb devices` | none attached |
| Physical iOS device | `xcrun simctl list devices` / no `xcrun devicectl` device | none attached |

**Consequence, stated plainly so the board does not over-claim:** iOS Simulator is the runtime
this machine can actually walk the app on. The Android emulator is *not* reachable from this
sandbox — not because the repo is broken, but because the hypervisor refuses to hand QEMU a
guest (`HV_DENIED`), and that refusal survives every flag combination this machine supports.
Android therefore gets a build-level verdict plus static observations here, and its user-end
walk is a **blocked-with-receipt** row naming the missing thing: a host with Apple Hypervisor
Framework access (or a USB device with USB debugging).

One useful number fell out of the failed-elsewhere path: the Android floor is **API 24**, read
from the live autolinking log rather than from a guess, which closes the G2 question from T006
with a measurement — the floor exists, it is just inherited from Expo rather than declared here.

## 1. Gate scripts run for this note (green, but see what they actually assert)

| Command | Output | Reading |
| --- | --- | --- |
| `node -- scripts/run-ts-entry.js tests/app-shell.test.ts` | no output, `exit=0` | passes — but the file is `readFileSync(... "src/features/freed-app.tsx")` + `assert.match(source, …)`. It asserts strings exist in source; it never renders a screen |
| `node -- scripts/run-ts-entry.js tests/design-system.test.ts` | no output, `exit=0` | same shape |

So the two "UI" suites T002 flagged as orphaned are green **and still cannot prove a single UI
state**, because there is no renderer, no jest, no testing-library anywhere in `package.json`.
That is the structural reason D2 evidence has to come from a device screenshot and not from a

## 2. The runtime that was actually walked: exported web build driven under Chrome (CDP)

| # | Command (verbatim) | Real output |
| --- | --- | --- |
| 1 | `npm run export:web` (`CI=1 EXPO_NO_TELEMETRY=1 expo export -p web`) | `Web node_modules/expo-router/entry.js … 91.5%`, `…/@expo/router-server/node/render.js … 98.2%`, `/account-deletion (24KB)`, **`Exported: /tmp/t007-web`** |
| 2 | `node /tmp/t007-serve.js /tmp/t007-web 41738` | `serving /tmp/t007-web on 41738` — static host for the exported bundle (`index.html` 21 328 B, `privacy.html`, `support.html`, `account-deletion` pre-rendered) |
| 3 | `"/Applications/Google Chrome.app/…/Google Chrome" --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/t007-profile --window-size=390,844 about:blank` then `curl http://127.0.0.1:9333/json/version` | `"Browser": "Chrome/154.0.8037.57"`, `"Protocol-Version": "1.3"` |
| 4 | `node /tmp/t007-drive.mjs '{"skipSplash":true}'` (harness in `artifacts/t007/t007-drive.mjs`; Node 24 global `WebSocket`, no new dependency) | `TZ: "Asia/Calcutta" \| now: Sun Sep 27 2026 06:11:59 GMT+0530 (India Standard Time)` + `{"step":"01-cold-start","shot":"01-cold-start.png","visibleText":"FREED CLINICALLY BACKED RECOVERY …"}` |

Why this counts as user-end evidence and not a reading exercise: the screens were produced by a real
browser running the real bundle, driven by real pointer events (`Input.dispatchMouseEvent` press/release
at the target's measured `getBoundingClientRect()` centre — e.g. `{"clickAttempt":"Continue with 3 Apps","clicked":true,"x":208.99,"y":784,"w":172.86,"h":18}`),
persisted through the app's own store, and photographed (`Page.captureScreenshot` → `artifacts/t007/*.png`).
Timezone was changed with `Emulation.setTimezoneOverride`, the same primitive a QA harness uses.

What this runtime **cannot** show, stated so nobody over-claims: the shield service, Screen Time /
Managed Settings surfaces, local notifications, in-app purchases, and any on-device enforcement. The app
itself says so on-screen (§4 U8). Android user-end remains blocked-external (`HV_DENIED`, §0) and iOS
user-end turned out to be blocked by a red simulator build (§4 U10).

Harness limitation recorded as a fact: **forging persisted state does not reach this app's store.** After
writing pledges `["2026-09-26","2026-09-25","2026-09-24"]` and `recoveryStartedAt=2026-09-26T18:40:00.000Z`
straight into `localStorage["freed.recovery.state.v1"]` and reloading, the post-load dump read
`{"localToday":"2026-09-27","pledgeKeys":[],"habitKeys":["2026-09-27:cold-shower"],"start":"2026-09-27T00:47:45.667Z"}`
— the app's own async `expo-sqlite/localStorage` backend won the race and rewrote what I had written
(`artifacts/t007/t007-seed.js` kept for whoever wants to retry it properly). Every clock/timezone number
below therefore comes from writes the **app itself** made through its UI, which is the stronger path anyway.

test run: this repo has no UI runtime harness at all.

## 3. Every screen a user reaches, with the text the build actually rendered

`visibleText` is `document.body.innerText` — i.e. literally what is on the screen. Screenshots alongside.

| Screen | Rendered text (verbatim, truncated where long) | Screenshot |
| --- | --- | --- |
| Splash (SSR + client) | `FREED` `RECLAIM YOUR FOCUS & CLARITY` — brand only, no clinical wording | `01-cold-start.png` (SSR text of `index.html`) |
| Welcome / value props | `FREED` `CLINICALLY BACKED RECOVERY` `Break free. Protect your streak.` `Zero-Latency DNS Filter — Blocks adult domains on-device without slowing your network.` `10-Second Mindful Intercept — Breaks the impulse loop before dopamine hijacks control.` `100% Private & On-Device — Your browsing activity never leaves your phone.` `Start My Recovery` `Skip Assessment` | `click-1-Start-My-Recovery.png` |
| Assessment q1 | `1/5 RECOVERY ASSESSMENT What is your main reason for changing? 1 Mental clarity & focus 2 Confidence & energy 3 Deep relationships 4 Faith, values & self-respect` | `click-1-Start-My-Recovery.png` |
| App selection | `APP SELECTION 3 selected Choose the apps FREED can interrupt. These choices become Android app timers and short-form guards. On iOS, you will choose the actual apps and websites in Apple's Screen Time picker during setup. Instagram Native setup target TikTok … X … Reddit … YouTube … Adult-domain blocking is separate and stays available even if you do not select any app timers. Continue with 3 Apps` | `click-1-Skip-Assessment.png` |
| Paywall | `Unlock Full Recovery Uncapped on-device protection, unlimited Clara AI coaching, and deep neurochemical progress analytics. ★ ★ ★ ★ ★ 4.8/5 · 14,000+ Streaks Protected "FREED is the first tool that stopped me in my tracks when dopamine hijacked my brain. The 10-second intercept and on-device blocker are unmatched." — Marcus K. · Clean 142 Days 7-DAY ZERO-RISK TRIAL Today: Instant Full Access Unlocked Day 5: Friendly reminder notification before trial ends Day 7: Membership begins · Cancel anytime in 1 tap Plan Comparison Capability Free Pro On-Device DNS Firewall Basic Military-Grade App & Web…` | `click-2-Continue-with-3-Apps.png` |
| Protection setup | `Turn on real protection … monitor only selected apps and sites through platform APIs, block known adult domains, and open a recovery challenge when a harmful site, search, or app-limit threshold is reached.` `Focus Shield Web Capability Preview builds can show Focus Shield setup copy, but they cannot inspect native app surfaces or enforce device shields.` `Focus Shield native capabilities are unavailable in this preview build. Test calibration and rule enforcement in a signed Android or iOS device build.` `Permission checklist … FREED avoids continuous screen capture, OCR, packet inspection, and full-traffic proxying.` `Next required step: Native protection build 0/1 … UNAVAILABLE` `Challenge verification ON DEMAND — Camera, motion, steps, and location …` `Recovery reminders ON DEMAND — … Notification payloads contain route/kind metadata only, not streaks, slips, URLs, or private notes.` `Adult content blocking Android uses FREED DNS Guard permission for device-level adult-domain blocking. iOS uses Screen Time and Managed Settings where available.` `Enable Adult Block` `Enable App Timer` `Enable Usage Access` `Run Activation Test` | `t007-paywall.json` → `click-2-Continue-with-3-Apps.png` (earlier visit) |
| Today (main) | `FREED 0 M T W T F S S Today's Progress View All 0% Complete Day Streak 0 Habits Done 0/6 Days to 90 90 Take Today's Pledge Renew your commitment daily Summary View All 0 Day Streak 0/6 Habits Done 90 Days to 90 0 Karma Points Neurochemical Reset 0% Stage 1: Breaking Craving Loop Day 0 of 90 Today's Habits 0/6 No adult content Cold shower Exercise Meditation Journal No social media ADULT-CONTENT FREE 0h 03m 56s First clean day 0/1 … Adult-only protection active Google, YouTube, Instagram, X, education, games — daily browsing is untouched. Recovery score: 0% Emergency Urge Support Open Recovery Tools Today Shield Progress Profile` | `click-3-Continue.png` |
| Today after 1 habit | same, `Habits Done 1/6`; `Day Streak` still `0`, `% Complete` still `0`, `Karma Points` still `0` | `habit-toggled.png` |
| Today after pledge | `Today's pledge is locked in 1-day pledge streak · tap for your check-in` — header `Day Streak 0` unchanged | `click-1-Take-Today-s-Pledge.png` |
| Shield tab | `Shield Protection health Protection unsupported here Native protection is available in an iOS or Android device build. Open protection setup Apps & schedules … Focus Shield Web Capability Preview … Web safety Adult-domain protection preserves normal browsing and keeps intervention challenges ad-free. Advanced diagnostics Default allow, precise block FREED blocks adult domains and adult search intent. Normal web stays open; Android app shields are opt-in. Always allow these sites … Your list outranks every other rule. … Daily limit - 30 + minutes/day Unlock - 10 + minutes earned Shorts guard - 90 + seconds sustained Challenge Mix Intensity Gentle Balanced Strong …` | `click-4-Shield.png` |

Two things fell out of the plain walk that no source reading produced: the day-strip letters **reorder with
the device timezone** (`M T W T F S S` under `Asia/Kolkata` vs `S M T W T F S` under `Pacific/Midway`), and the
`ADULT-CONTENT FREE` timer is monotonic across those same jumps (`0h 47m 29s → 1h 01m 12s`) — so the timer is
instant-based while everything labelled "day", "streak", "habits" is calendar-key based. That contrast is the
whole U5 defect in one sentence.

## 4. U5 — the streak / day-boundary defect, reproduced at the user end with before-and-after values

Procedure, all through the app's own UI and its own store (no forged state):

1. `node /tmp/t007-drive.mjs '{"tz":"Asia/Kolkata","clicks":["Take Today''s Pledge"]}'` → the app stored
   `{"pledgeKeys":["2026-09-27"],"habitKeys":["2026-09-27:cold-shower"]}` and rendered
   `Today's pledge is locked in — 1-day pledge streak`.
2. With **that identical stored state**, re-open the app under a different device timezone
   (`Emulation.setTimezoneOverride` + `Page.reload`, same `--user-data-dir`, clicks only to reach Today):

| Device timezone | `localToday` in page | stored `pledgeKeys` (unchanged) | pledge card shown | `Habits Done` | header `Day Streak` |
| --- | --- | --- | --- | --- | --- |
| `Asia/Kolkata` (UTC+05:30) | 2026-09-27 | `["2026-09-27"]` | `pledge is locked in` | **1/6** | 0 |
| `America/New_York` (UTC−04:00, DST) | 2026-09-26 | `["2026-09-27"]` | **gone — back to `Take Today's Pledge`** | **0/6** | 0 |
| `Pacific/Midway` (UTC−11:00) | 2026-09-26 | `["2026-09-27"]` | **gone — back to `Take Today's Pledge`** | **0/6** | 0 |

Commands: the three runs saved as `artifacts/t007/t007-cmp-Asia_Kolkata.log`,
`t007-cmp-America_New_York.log`, `t007-cmp-Pacific_Midway.log`; the cells above are greps of those files.

What a user experiences: they lock in today's pledge, fly west (or cross a DST boundary), and the locked-in
pledge has vanished from Today while the habit checklist is blank again — and they are invited to pledge a
**second time for the same UTC day**. Going the other way is worse: a pledge written at 23:40 in UTC+05:30
carries `dateKey=2026-09-27`, and `getPledgeStreakDays` walks `getLocalDateKey(cursor)` backwards from local
today (`src/lib/recovery-state.ts:2223-2236`), so a key permanently one day ahead of the cursor never matches
again — that pledge is orphaned in storage. Meanwhile the `ADULT-CONTENT FREE` timer in the same header keeps
counting (`1h 01m 00s`), so the screen tells the user "clean for an hour" and "you have done nothing today"
at the same moment.

This is the user-end confirmation of the T005 class: `getLocalDateKey` (`src/lib/recovery-state.ts:1197-1204`)
is local wall-clock, records persist the local key computed at write time, and nothing stores the timezone
that produced the key. The fix therefore has to be a Worker slice with a DST/timezone regression test, not a
copy tweak — which is exactly T008's charter.

## 5. Findings register (user-end evidence only; U-IDs avoid collision with T006's G-rows)

| ID | Finding | First-order evidence | Severity / owner |
| --- | --- | --- | --- |
| U1 | The first screen asserts `CLINICALLY BACKED RECOVERY`, `Zero-Latency DNS Filter / Blocks adult domains on-device`, `100% Private & On-Device — Your browsing activity never leaves your phone`. No study/consent artefact in the repo backs the clinical claim; the privacy claim is contradicted by the shipped Firebase/AdMob/RevenueCat surface (T003 blocker). | `click-1-Start-My-Recovery.png`, §3 | **D3 blocker**; copy + privacy path |
| U2 | Paywall ships unverifiable social proof: `4.8/5 · 14,000+ Streaks Protected`, named testimonial `— Marcus K. · Clean 142 Days`, `deep neurochemical progress analytics`, plan table grading `On-Device DNS Firewall: Basic` vs `Military-Grade`. | §3 paywall row, `click-2-Continue-with-3-Apps.png` | Store-rejection risk; `audit:paywall-launch-scope` is green while this text ships — its assertions need review |
| U3 | Copy promises `keeps intervention challenges ad-free` while the artifact bakes an AdMob app id whose fallback is Google's **public test id** `ca-app-pub-3940256099942544~3347511713`; `ext.freedGoogleMobileAdsUsesLocalTestAppId` (`android/build.gradle:23`) is **read nowhere**, so nothing fails when a test id ships. | `t007-manifest.txt` meta `com.google.android.gms.ads.APPLICATION_ID`; grep of `UsesLocalTestAppId` → only its definition | Small high-value Worker slice + copy reconciliation |
| U4 | Setup copy says FREED monitors `only selected apps and sites` and `avoids continuous screen capture, OCR, packet inspection, and full-traffic proxying`, but the shipped accessibility config reads every app's window content: `canRetrieveWindowContent=true`, `notificationTimeout=250`, `accessibilityEventTypes=0x00401830` (includes text-changed `0x10`, window-state-changed `0x20`), `accessibilityFlags=0x50`, **no `packageNames` filter at all**. | `aapt2 dump xmltree --file res/xml/freed_accessibility_service.xml` → `t007-manifest.txt` | **D3/privacy blocker**; Play accessibility-API policy needs disclosure that matches the real surface |
| U5 | Day-boundary/timezone defect: one stored state renders a different Today depending on device timezone; a pledge written at UTC+05:30 becomes unreachable after a westward shift and can be duplicated. | §4 table + three `.log`s | **D1 defect class → feeds T008** |
| U6 | Two streak numbers on one screen: header `Day Streak 0` vs pledge card `1-day pledge streak`. The header value is the stored counter (`state.streakDays`), which stayed `0` through a completed habit, a locked-in pledge and three timezone changes — the number the app asks the user to protect never advances from their own history. | `click-1-Take-Today-s-Pledge.png`, `habit-toggled.png`, `t007-pledge-kl.log` (`streakDays: 0` with `pledgeKeys:["2026-09-27"]`) | Worker slice, same file/class as U5 |
| U7 | T006 **G2 closed by measurement**: artifact floor is `android:minSdkVersion="24"`, `targetSdkVersion="36"`, compileSdk 36 — declared nowhere in the repo (`grep minSdkVersion android/build.gradle` → no hits; `app/build.gradle:171` reads `rootProject.ext.minSdkVersion`, an Expo autolinking default). | `t007-manifest.txt:7-9`, `t007-apk-badging.txt` `package:`/`targetSdkVersion:` | Toolchain default, not a product decision → PM/Judge note |
| U8 | T006 **G5 amended**: the shipped APK enforces through **two** mechanisms — `app.freed.protection.FreedAccessibilityService` **and** `app.freed.protection.FreedVpnService` (`<action android:name="android.net.VpnService">`, `android:foregroundServiceType="specialUse"`, `PROPERTY_SPECIAL_USE_FGS_SUBTYPE="User-enabled DNS-only VPN fallback for adult-domain filtering without full traffic proxying"`), plus `FreedVpnAutostartReceiver`. The "on-device DNS" promise therefore has a real implementation path; accessibility is the reactive second path. Both are Play-policy sensitive (VPN declaration, specialUse FGS justification, accessibility use). | `t007-manifest.txt` service blocks | Corrects the T006 matrix; store-policy owner |
| U9 | Plumbing gaps visible only in the artifact: **no `SYSTEM_ALERT_WINDOW`** anywhere in the merged manifest while the intercept UI is an Activity (`FreedInterventionActivity`), so an intervention raised from the background leans on Android 10+ background-activity-start rules with only `USE_FULL_SCREEN_INTENT` declared; and **no `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`**, corroborating T006 **G4** — the paywall's own `Day 5: Friendly reminder notification before trial ends` cannot be timed on Android 12+. Also declared: `ACCESS_FINE_LOCATION`, `ACTIVITY_RECOGNITION`, `CAMERA`, `PACKAGE_USAGE_STATS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `com.android.vending.BILLING`, `c2dm.permission.RECEIVE`, `READ_GSERVICES`, `BIND_GET_INSTALL_REFERRER_SERVICE`, ~15 vendor badge permissions. `QUERY_ALL_PACKAGES` count = 0 (good). | `t007-apk-badging.txt`; `grep -c SYSTEM_ALERT_WINDOW t007-manifest.txt` → 0 | Native owner + data-safety form |
| U10 | **iOS Simulator build is red in this worktree**: `error: The file “RCTAppDependencyProvider.h” couldn't be opened because there is no such file. (in target 'ReactAppDependencyProvider' from project 'Pods')` → `** BUILD FAILED ** (2 failures)`; the failing `CpHeader` source `ios/build/generated/ios/ReactAppDependencyProvider/RCTAppDependencyProvider.h` does not exist (`ls ios/build/generated/ios` → empty). `ios/Pods` is gitignored (`ios/.gitignore:30`, `git ls-files ios/Pods` → 0 files), so the local Pods tree is stale against `react-native 0.83.6`. Unblocking action is `pod install` in `ios/` — a write the Scout contract forbids. **iOS user-end = blocked, receipt attached.** | `t007-ios-build-failure.txt` | Prerequisite for any iOS evidence on this board; one command, needs write permission |
| U11 | Android build path is green but expensive: `BUILD SUCCESSFUL in 43m 53s`, `874 actionable tasks`, `app-debug.apk = 283 875 785 B` for `arm64-v8a armeabi-v7a x86 x86_64`. Release scripts already pin `--arch arm64-v8a`, so size is a debug-shape fact, not a defect — but 44 minutes is the true cost of any Android change here. | `t007-apk-result.txt`, `t007-apk-badging.txt` | PM planning input |
| U12 | Offline behaviour **not measured**: `Network.emulateNetworkConditions {offline:true}` also kills loopback, so the reload produced Chrome's own `ERR_INTERNET_DISCONNECTED` page and the app never rendered. Needs a device with airplane mode. Do not score this either way. | `offline-reload.png`, `t007-shield.log` | Method-blocked row |

## 6. blocked-with-receipt rows, in the form the card asked for

| Behaviour on the T007 list | Status | The thing that is missing |
| --- | --- | --- |
| Native shield / intercept / DNS enforcement, app-timer behaviour, notification-driven check-in | **blocked-external** | A device. Android emulator cannot boot here (`HVF error: HV_DENIED`, §0) and none is attached (`adb devices` empty); the iOS app will not build (§5 U10). The app names the same missing artefact itself: `Focus Shield native capabilities are unavailable in this preview build. Test calibration and rule enforcement in a signed Android or iOS device build.` |
| iOS screen-by-screen walk (Splash → Onboarding → Protection Setup → Dashboard) | **blocked-write-pending** | `pod install` in `ios/` (U10). The screens were walked on the exported web build instead — same `freed-app.tsx` screens, none of the native surfaces. |
| Offline / degraded-network UI | **method-blocked** | A device with airplane mode (U12). |
| Cold start, onboarding (assessment + app selection), paywall, protection setup, Today tab, Shield tab, pledge + habit interaction, day/streak under timezone change, deep-link contract | **observed** | — (this note) |

Deep links for whoever gets a device: the shipped manifest registers scheme `freed`, scheme
`app.freed.recovery`, and host `freed-7d5ee.firebaseapp.com` (`t007-manifest.txt:231,233,244`). In-app,
`Linking.getInitialURL()` / `Linking.addEventListener("url")` (`src/features/freed-app.tsx:10480-10488`)
route through `consumeFirebaseEmailLink → consumeProtectionSetupDeepLink → consumeDeepLinkIntervention`
(`:10473-10477`); the protection-setup form is `freed://protection-setup?source=usage-access-config` (the
return path emitted by `FreedUsageAccessConfigActivity.kt:114`), and the Safari-shield form needs
`source=<ios-safari-short-form>` plus a rule whose host matches (`src/lib/native-intervention.ts:106-128`).
T006 **G1** (`intervention.freed.app` → NXDOMAIN) still stands: whichever branch is meant to receive the
handoff, the domain it points at does not resolve.

## 7. Re-running this note

```
npm run export:web                                   # → exported web bundle
node artifacts/t007/t007-serve.js <export-dir> 41738
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --no-first-run --remote-debugging-port=9333 --user-data-dir=/tmp/t007-profile \
  --window-size=390,844 --hide-scrollbars about:blank &
node artifacts/t007/t007-drive.mjs '{"tz":"Asia/Kolkata","maxText":1200,"dumpState":true,\
  "clicks":["Skip Assessment","Continue with 3 Apps","Continue","Shield"]}'
```

Driver options: `tz` (CDP timezone override), `clicks[]` (visible-text prefix taps), `seedFile` (JS expr, see
the caveat in §2), `dumpState`, `habit`, `reTz`, `offline`, `skipSplash`, `maxText`. `node` must be an nvm 24
binary for global `WebSocket`; no new dependency was added to the repo for any of this.





