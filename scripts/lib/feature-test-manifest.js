const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LEDGER_PATH = 'docs/validation/artifacts/2026-10-02-native-ui-testflight/feature-ledger.json';
const MODES = ['local', 'emulator', 'ios', 'android', 'live', 'device', 'all', 'list'];
const OWNER_SIMULATOR = '20494937-BC1B-427D-92B4-914FD9C1848D';
const liveNumbers = new Set([5,6,9,37,51,52,53,64,65,66,71,72,73,74,80,82,83,85,86,87,89,90,91,92,93,94,96,97,98,99]);
const androidOnly = new Set([9,10,11,12,13,14,21]);
const iosOnly = new Set([15,16,17,18,19,94,95]);
const nonMotion = new Set([9,19,41,42,43,44,51,52,53,89,90,91,92,93,94,95,96]);

// Local contracts never substitute for the native/device scenario obligations.
const DEFINITIONS = {
  1: ['native-navigation,app-shell', 'onboarding-welcome', 'cold launch resolves saved onboarding', 'welcome starts assessment', 'free entry returns to Today without old onboarding history'],
  2: ['core,native-navigation', 'onboarding-quiz', 'all five questions accept every option', 'Back retains the previous answer', 'restart preserves only committed onboarding preferences'],
  3: ['core,recovery-data-accuracy', 'onboarding-plan', 'answered goal and triggers appear in plan', 'calculation progress ends with a reachable action', 'no measured brain chemistry or projected recovery date is claimed'],
  4: ['core,protection-setup-flow', 'onboarding-app-selection', 'selected package aliases map to supported targets', 'Back retains selection and zero selection disables Continue', 'iOS selections remain opaque Screen Time tokens'],
  5: ['social-auth-flow,social-login-presenter,account-operation', 'account-options', 'provider login connects the expected UID', 'cancel or provider failure clears loading and permits free exit', 'stale provider result cannot replace a newer account'],
  6: ['firebase-auth-linking,social-auth-flow,account-operation', 'account-options', 'link provider keeps guest UID and purchase owner', 'collision presents an explicit guest switch choice', 'sign out and delayed results preserve local recovery history'],
  7: ['protection-setup-flow,protection-permission-native', 'protection-setup', 'required stages advance only after actual authorization', 'denial and settings return show truthful status', 'revocation and restart refresh native authorization'],
  8: ['protection-setup-flow,protection-permission-native', 'protection-setup', 'retry is bounded and Continue anyway remains reachable', 'limited protection is visibly inactive', 'warning clears only after measured native activation'],
  9: ['core,protection-android-routing', 'shield-diagnostics', 'reviewed feed validates checksum and conditional HTTP response', 'stale or malformed feed keeps safe fallback', 'native import enforces adult corpus while normal corpus passes'],
  10: ['protection-permission-native,protection-dns-safety,core', 'shield-health', 'disclosure permits Not now without starting VPN', 'start and stop reflect real DNS routing and health', 'physical failover VPN coexistence and latency meet measured limits'],
  11: ['protection-permission-native,protection-dns-safety,protection-setup-flow', 'shield-health', 'Private DNS action opens correct OEM settings', 'strict DNS state is read again on return', 'denied revoked and unreachable settings remain truthful'],
  12: ['protection-permission-native,core', 'protection-setup', 'Usage Access permission is detected after settings return', 'selected app threshold produces a native intervention', 'denial revocation and reboot never fabricate app usage'],
  13: ['protection-permission-native,protection-android-routing', 'protection-setup', 'Accessibility state is read from native service', 'real browser handoff reaches the matching reset', 'revocation stops unsupported interception and refreshes health'],
  14: ['core,protection-android-routing', 'shield-preferences', 'selected package and alias limit uses configured duration', 'unselected app remains unaffected at threshold', 'restart and day boundary preserve intended limits'],
  15: ['protection-permission-native,protection-setup-flow', 'shield-health', 'signed Family Controls grant enables adult filter', 'Choose Apps uses opaque picker targets and cancel preserves state', 'pause or revoke removes claimed protection'],
  16: ['core,protection-permission-native', 'shield-preferences', 'DeviceActivity threshold applies selected shields', 'Night Guard schedule handles overnight day transitions', 'Stop Guard reboot and revocation remove or restore only authorized shields'],
  17: ['protection-safari-routing', 'shield-health', 'Safari extension enablement is accurately shown', 'adult domains are blocked on physical Safari', 'normal corpus opens without full VPN or HTTPS inspection claims'],
  18: ['protection-safari-routing,native-intervention-links', 'shield-diagnostics', 'Shorts Reels and For You rules match approved Safari surfaces', 'signed universal link hands off once to matching reset', 'normal pages and denied extension settings remain unaffected'],
  19: ['protection-safari-routing,challenge-capability', 'platform-limits', 'iOS native third party screen inspection is explicitly unsupported', 'Screen Time target picker remains an available alternative', 'no OCR calibration or native inspection is falsely reported successful'],
  20: ['core,protection-android-routing,protection-safari-routing,focus-shield-rollout,focus-shield-build-gate,focus-shield-native-policy', 'shield-diagnostics', 'each preset toggles its named surface rule', 'platform specific supported route is described honestly', 'selected native Android and Safari iOS surfaces enforce rules'],
  21: ['protection-android-routing,core,focus-shield-rollout,focus-shield-build-gate,focus-shield-native-policy', 'shield-diagnostics', 'calibration saves matched Android selector locally', 'cancel and Remove undo only intended calibration', 'false positive corpus remains navigable after restart'],
  22: ['protection-permission-native,protection-android-routing,focus-shield-rollout,focus-shield-native-policy', 'shield-diagnostics', 'rule count and native service health reconcile', 'refresh detects permission loss and degraded storage', 'removal and corruption never claim active enforcement'],
  23: ['core', 'shield-allowlist', 'valid normalized domain is added once and survives restart', 'invalid domain and duplicate input are rejected', 'allow rule never overrides an explicit adult match'],
  24: ['core,recovery-data-accuracy,analytics-reconciliation', 'shield-url-check', 'Google and YouTube diagnostics classify known normal URLs', 'adult and malformed diagnostic inputs render explicit verdict', 'manual checks receive no real protection credit'],
  25: ['core', 'shield-preferences', 'daily limit unlock and preferences update within bounds', 'all supported choices persist through restart', 'native settings use committed preferences without inventing permission'],
  26: ['core,protection-permission-native', 'shield-preferences', 'strict and Deep focus switches commit supported target expansion', 'switching off removes only intended restriction', 'permission loss and restart show actual enforced state'],
  27: ['core,recovery-time,native-app-schedules,app-schedule-native-policy,app-schedule-native-wiring', 'shield-schedules', 'sleep work and weekend toggles preserve clock inputs', 'overnight DST and day boundaries resolve correctly', 'restart schedules only authorized native activity', 'native background boundaries preserve manual and overlapping guards without a running React screen'],
  28: ['challenge-session,challenge-completion-receipt,core,native-intervention-authority,native-unlock-policy,native-unlock-bridge', 'challenge-list', 'helped challenge unlock scopes the fresh protected target', 'expiry countdown relocks supported native targets', 'historical restore or wrong target never authorizes a live unlock'],
  29: ['native-navigation,paywall-navigation,native-intervention-links', 'root-navigation', 'each tab has a single correct root', 'push and Back restore the originating tab', 'cold launch terminal reset removes old onboarding or recovery history'],
  30: ['native-intervention-links,challenge-session,core', 'urgent-support', 'urgent action opens immediately from every root', 'free users can reach Back to Safety and reset tools', 'SOS does not grant native protection credit or require an ad', 'public Basic Help opens from hydrating startup welcome required or unavailable account and unacknowledged offer without protected route access', 'public breathing excludes background and lost focus returns paused and respects Reduce Motion ten languages RTL large text and immediate native Back', 'public support dismisses without account completion history reward cloud store ad or native unlock; account drafts and active operation fence remain mounted'],
  31: ['recovery-time,recovery-data-accuracy,core', 'today-pledge', 'pledge increments once for local day', 'repeat tap rollback and DST never duplicate streak', 'pledged state and check-in route survive restart'],
  32: ['core,recovery-data-accuracy,recovery-time', 'today-habits', 'each habit toggles and total reconciles', 'untoggle decrements exactly once', 'restart and day roll show the correct local daily state'],
  33: ['recovery-data-accuracy,recovery-time,analytics-reconciliation', 'today-metrics', 'zero and known-event streak habit and points reconcile', 'elapsed clock uses the actual recovery start', 'days to milestone is distance rather than medical projection'],
  34: ['recovery-time,recovery-data-accuracy,core', 'today-metrics', 'week strip reflects all seven local dates', 'slip retains best while restarting current streak', 'next milestone and celebration do not duplicate after restart'],
  35: ['native-navigation,paywall-navigation', 'recovery-shortcuts', 'all recovery shortcuts push correct native routes', 'Back returns to originating root', 'Library article and paywall flows do not duplicate shell'],
  36: ['native-intervention-links,challenge-session,challenge-completion-receipt,native-intervention-authority,native-unlock-policy,native-unlock-bridge', 'intercept', 'fresh native event shows matching reason once', 'Surf Urge Continue Reset and Back Safety follow correct route', 'stale or untrusted link cannot grant target authority'],
  37: ['ad-consent,launch-purchases,core', 'rewarded-reset', 'consent and loading resolve to supported ad status', 'cancel failure Watch again and free continuation clear busy state', 'reward callback is unique and native SOS interventions bypass ads'],
  38: ['core,challenge-selection-key,challenge-capability', 'challenge-list', 'known preferences shape category intensity and steps', 'choose and Back return to same list without accidental completion', 'unsupported sensor choices present honest alternatives'],
  39: ['challenge-session,challenge-completion-receipt,challenge-verification-runtime', 'challenge-list', 'completion waits for verified action and explicit outcome', 'helped and need-support outcomes save once with correct XP', 'restart retry and concurrent callbacks cannot duplicate completion'],
  40: ['challenge-session,challenge-verification-runtime,challenge-verification-safety', 'challenge-list', 'timer gates finish until required active duration', 'background pause and reentry preserve measured active seconds', 'elapsed wall clock alone cannot satisfy foreground activity'],
  41: ['challenge-capability,challenge-verification-runtime,challenge-session', 'challenge-list', 'real accelerometer samples satisfy expected motion threshold', 'permission denied unavailable and timeout offer safe alternative', 'synthetic count or background time cannot pass measured motion'],
  42: ['challenge-capability,challenge-verification-runtime,challenge-session', 'challenge-list', 'native pedometer records minimum fresh steps', 'denied or unsupported step sensor offers truthful alternative', 'historical baseline and restored steps never satisfy new challenge'],
  43: ['challenge-capability,challenge-verification-runtime,challenge-verification-safety', 'challenge-list', 'on demand samples use displacement and accuracy threshold', 'denied cancelled and low accuracy location stay incomplete', 'no background tracking is started or claimed'],
  44: ['challenge-verification-runtime,challenge-verification-safety,challenge-capability', 'challenge-list', 'fresh camera evidence reaches implemented on-device model path', 'cancel error and label mismatch do not complete challenge', 'temporary image is cleaned and pending integration stays blocked'],
  45: ['challenge-session,challenge-capability', 'challenge-list', 'partner action opens native compose only by user request', 'cancel or return does not claim message delivery', 'explicit reached-out action alone confirms connection challenge'],
  46: ['premium-entitlement,core,challenge-capability', 'custom-reset', 'free path opens reachable upgrade and returns safely', 'entitled title why steps type intensity and minutes save', 'caps persistence and list inclusion reconcile without duplicate reset'],
  47: ['breathing-cadence,challenge-session,recovery-time', 'breathing', 'all breathing modes follow declared phase durations', 'Begin Pause background and restart control running state', 'haptics reduced motion and timed phase transitions work on device'],
  48: ['recovery-data-accuracy,recovery-time,recovery-drafts,core', 'checkin-save', 'all mood urge sleep values and private reflection save', 'same local day updates instead of duplicate records', 'restart summary redaction and Back without save are correct'],
  49: ['recovery-data-accuracy,recovery-time,recovery-drafts,core', 'slip-save', 'trigger and private note save once', 'current streak resets while personal best remains', 'risk hours and private report reconcile after restart'],
  50: ['core,firebase-feature-runtime,off-device-recovery-privacy', 'clara-local', 'input send and history reply render with native keyboard', 'offline timeout and cancel preserve a safe local reply', 'redaction and reviewed crisis scenarios provide appropriate links'],
  51: ['firebase-feature-runtime,firebase-functions-contract,core,off-device-recovery-privacy', 'clara-local', 'deployed AppCheck secret and model answer a disposable test prompt', '20 per local day quota and timeout have visible fallback', 'aggregate context excludes private notes browsing and support contacts'],
  52: ['firebase-feature-runtime,firebase-functions-contract,core,off-device-recovery-privacy', 'challenge-list', 'enabled deployed callable uses answered feedback preferences', 'disabled flag error and quota keep local fallback', 'generated challenge obeys reviewed safety and capability constraints'],
  53: ['firebase-feature-runtime,core,off-device-recovery-privacy', 'profile-plan', 'remote plan uses explicitly supplied aggregate context', 'disabled unavailable and stale response keep local plan', 'privacy and account ownership boundaries are enforced'],
  54: ['native-navigation,core', 'library-articles', 'every article is readable and scrollable to end', 'all reset category links reach intended tool', 'Back Library and Back Today preserve correct native root'],
  55: ['recovery-data-accuracy,analytics-reconciliation', 'progress-zero', 'fresh fixture shows No signals and Not enough data', 'no measured score is fabricated from missing events', 'known first event transitions only relevant metrics'],
  56: ['recovery-data-accuracy,recovery-analytics-snapshot', 'progress-reports', 'current best attempts and activity estimate reconcile', 'current risk and reset events affect intended values', 'estimate is never labelled clinical measurement'],
  57: ['recovery-data-accuracy,analytics-reconciliation,core', 'progress-reports', 'known fixtures unlock every documented badge', 'XP cap cumulative totals and migration are correct', 'manual diagnostic or SOS event receives no protection credit'],
  58: ['recovery-data-accuracy,recovery-analytics-snapshot,recovery-time', 'progress-reports', 'local week oracle matches check-ins average urge and sleep', 'strongest pattern uses sufficient actual samples', 'thin data and DST boundaries remain explicit'],
  59: ['premium-entitlement,recovery-data-accuracy,core', 'progress-reports', 'entitled urge estimate explains level confidence and drivers', 'free and low-data states are honest and reachable', 'estimate never becomes measured clinical probability'],
  60: ['recovery-analytics-snapshot,recovery-data-accuracy,recovery-time,off-device-recovery-privacy', 'progress-reports', 'weekly risks resets slips and check-ins match independent fixture', 'archive DST and unknown answers preserve boundaries', 'private text is absent from shareable report'],
  61: ['premium-entitlement,recovery-analytics-snapshot,recovery-data-accuracy', 'progress-reports', 'known month and archive totals match independent oracle', 'free gate and zero state render accurately', 'growth activity index is not clinical projection'],
  62: ['analytics-reconciliation,recovery-analytics-snapshot,recovery-time', 'progress-reports', 'help rate peak risk reset rate and app totals use correct denominators', 'DST repeated hour and history caps reconcile', 'unlocks per week excludes invalid historical authority'],
  63: ['recovery-analytics-snapshot,analytics-reconciliation,backup-crypto,off-device-recovery-privacy', 'progress-reports', 'foreground intervals and category success reconcile', 'archive rollback and overlaps do not duplicate minutes', 'portable own actions exclude device history while legacy restore preserves local records'],
  64: ['firebase-feature-runtime,firebase-privacy-audit,analytics-reconciliation,off-device-recovery-privacy', 'analytics-consent', 'sharing requires explicit consent and can turn off', 'send snapshot handles busy retry and retention receipt', 'deployed multi-device lineage rejects private payload and stale owner'],
  65: ['account-operation,premium-entitlement,social-auth-flow,membership-summary', 'account-options', 'account card shows current provider and verified membership', 'link sign out and manage preserve intended navigation', 'delayed account request cannot change newer membership owner'],
  66: ['premium-entitlement,launch-entitlement-contract,launch-purchases,native-iap-lifecycle,membership-summary,premium-server-refresh', 'paywall-plans', 'monthly and yearly have equal capabilities', 'verified renew restore refund and revoke control access', 'offline cache and owner fences cannot invent Premium authority'],
  67: ['recovery-data-accuracy,analytics-reconciliation', 'profile-history', 'archived protected attempts and slip counts reconcile', 'Log Slip Safely opens private form', 'diagnostic and SOS history never inflate protection count'],
  68: ['firebase-notification-flow,firebase-native-runtime,recovery-time', 'profile-reminders', 'master morning evening night and smart schedules persist', 'grant denial revocation DST and restart resolve actual schedules', 'device delivery and tap open correct route without invented remote success'],
  69: ['core,firebase-feature-runtime', 'profile-plan', 'known signals produce expected next action and focus tags', 'answered check-in changes supported guard suggestion', 'remote disabled state clearly retains local fallback'],
  70: ['backup-crypto,core,durable-state-cell,off-device-recovery-privacy', 'backup-local', 'passphrase encrypts portable actual history', 'wrong passphrase corrupt data and cancelled restore change nothing', 'native crypto roundtrip keeps history without granting old unlock authority'],
  71: ['automatic-backup,account-operation,durable-state-cell,off-device-recovery-privacy', 'backup-local', 'enable stores passphrase in native secure store only', 'changes upload once with bounded retry and abort', 'turn off account switch and deletion remove obsolete passphrase'],
  72: ['firebase-feature-runtime,backup-crypto,account-operation,off-device-recovery-privacy', 'backup-hosted', 'upload download restore and delete use encrypted owner bucket', 'generation signed URL and account fence prevent stale restore', 'second disposable device restores only with correct passphrase'],
  73: ['durable-state-cell,automatic-backup,account-operation', 'backup-local', 'Keep current history leaves all state unchanged', 'explicit Restore backup replaces only intended recovery state', 'stale download and account switch cannot apply old owner backup'],
  74: ['firebase-email-link-delivery-audit,firebase-hosting-associations,firebase-auth-linking', 'account-options', 'actual disposable mailbox receives signed account link', 'native association and pending link handoff resolve expected UID', 'wrong owner expired and cancelled links preserve current history'],
  75: ['core,firebase-privacy-audit,off-device-recovery-privacy', 'profile-accountability', 'enable SMS email name contact and template persist', 'native compose opens only after explicit user action', 'cancel consent and private fields never trigger automatic send'],
  76: ['premium-entitlement,core,firebase-privacy-audit,off-device-recovery-privacy', 'profile-accountability', 'weekly aggregate preview excludes private details', 'free upgrade and entitled report compose both return safely', 'Send Report requires explicit recipient action and never sends automatically'],
  77: ['core,premium-entitlement,firebase-privacy-audit,off-device-recovery-privacy', 'profile-accountability', 'member cap add remove and persistence are correct', 'SMS email and draft validate consent and recipient', 'aggregate native compose cancel leaves recovery history unchanged'],
  78: ['native-navigation,firebase-hosting-associations', 'privacy-support', 'Privacy Support Terms and deletion help are reachable', 'live linked pages contain matching release policies', 'native browser return restores Profile and scroll position'],
  79: ['durable-state-cell,account-operation,automatic-backup,native-protection-reset-bridge,protection-reset-native-policy,protection-reset-native-wiring,dns-runtime-ownership-native,protection-reset-ios,cleanup-source-contract', 'deletion-local', 'cancel deletion preserves local and secure data', 'explicit confirmation purges recovery and stored backup key', 'in-flight async writes cannot resurrect deleted data', 'owned native configuration reset is acknowledged before local erasure; failure preserves drafts and permits retry'],
  80: ['account-operation,firebase-functions-contract,automatic-backup,native-protection-reset-bridge,protection-reset-native-policy,protection-reset-native-wiring,dns-runtime-ownership-native,protection-reset-ios,cleanup-source-contract', 'deletion-account', 'cancel and failed deletion preserve truthful current status', 'deployed tombstone removes owner ciphertext and auth state', 'late callbacks and second device cannot resurrect deleted owner data', 'accepted hosted deletion and failed device cleanup remain distinct and retryable'],
  81: ['native-navigation', 'profile-shield', 'Open Shield chooses the native Shield root', 'Back cannot revive a stale duplicate Profile shell', 'subsequent tabs keep correct root identities'],
  82: ['paywall-presenter,paywall-navigation', 'paywall-plans', 'yearly monthly radio selection is mutually exclusive', 'real localized currency cadence and price match store', 'selection survives large font changes and offers no phantom trial'],
  83: ['paywall-presenter,native-checkout-readiness,native-iap-lifecycle,launch-purchases,native-debug-fixture,store-pricing', 'paywall-plans', 'store price loading retry and unavailable states are reachable', 'sandbox Subscribe cancel failure and busy have correct transitions', 'server verified receipt alone enables purchased membership'],
  84: ['paywall-navigation,native-navigation,paywall-presenter', 'paywall-free-exit', 'Close and Continue with Free return to every origin', 'native Back and large text retain reachable free exit', 'busy confirmation prevents unsafe duplicate checkout'],
  85: ['launch-purchases,native-iap-lifecycle,premium-entitlement,membership-summary,premium-server-refresh', 'paywall-plans', 'guest and linked owner restore use valid sandbox receipt', 'invalid expired and other-owner receipt are rejected', 'AppCheck and server entitlement authority survive cancellation and restart'],
  86: ['native-iap-lifecycle,launch-purchases', 'paywall-plans', 'Manage Subscription opens correct native store management', 'cancel and return refresh actual membership state', 'refund or revoke does not keep stale verified Premium'],
  87: ['launch-entitlement-contract,premium-entitlement,launch-foundation', 'paywall-plans', 'each promised benefit has implemented entitled control', 'disabled remote CLARA never claims live remote availability', 'free local support remains usable after upgrade cancellation'],
  88: ['paywall-presenter,paywall-navigation', 'paywall-legal', 'Privacy and Terms open current live pages', 'browser return retains selected plan', 'free continuation remains reachable at large font sizes'],
  89: ['firebase-native-runtime,firebase-auth-linking,firebase-config-audit,firebase-emulator-routing,native-debug-fixture', 'account-options', 'signed physical AppAttest or Play Integrity token is enforced', 'guest linked and stale owner callables obey account fence', 'missing invalid and revoked AppCheck proof is rejected'],
  90: ['firebase-notification-flow,firebase-native-runtime', 'profile-reminders', 'consented signed APNs or FCM registration refreshes token', 'actual remote delivery and open match intended check-in route', 'disabled flag or withdrawn consent stops claimed remote delivery'],
  91: ['firebase-foundation,firebase-functions-contract,firebase-repository-config', null, 'emulator rules indexes storage and owner constraints pass', 'idempotency rate limits and tombstones reject invalid writes', 'live deployed functions and bucket inventory match signed build config'],
  92: ['core,protection-android-routing', 'shield-diagnostics', 'hosted reviewed feed returns valid version checksum', 'conditional HTTP and stale fallback follow import contract', 'device native enforcement is separately proved with normal corpus'],
  93: ['android-bytecode-inspection,ios-admob-build-config,launch-foundation', 'root-navigation', 'final binary hash matches installed tested source revision', 'Android upload signature Hermes and AAB APK integrity pass', 'iOS required five extensions and entitlement signatures are embedded'],
  94: ['firebase-release-gates,launch-foundation', null, 'distribution archive and export match signed app profile', 'upload accepted and build processing completes in App Store Connect', 'TestFlight install launches the identical processed build on signed device'],
  95: ['protection-safari-routing,challenge-capability', 'platform-limits', 'full VPN HTTPS and third party OCR claims remain unsupported', 'supported Safari and Screen Time scope is accurately shown', 'absence of packet tunnel entitlement never masquerades as inspection'],
  96: ['firebase-feature-runtime,firebase-privacy-audit', null, 'remote community remains disabled without reviewed consent', 'unavailable or abused sharing fails closed', 'provider moderation and revocable consent proof precede any live claim'],
  97: ['account-access-auth,account-access-flow,account-operation,firebase-auth-linking', 'account-validation', 'email password confirmation and Show Hide have correct native behavior', 'invalid email short or mismatched password never creates account', 'guest linking collision loading cancellation and autofill retain owner'],
  98: ['account-access-auth,account-operation', 'account-verification', 'disposable mailbox receives verification link once per request', 'reload detects actual current user verified state', 'resend error later continuation and stale owner are handled safely'],
  99: ['account-access-auth,account-access-flow', 'account-reset-validation', 'invalid email reset is rejected without delivery', 'disposable mailbox reset returns nonenumerating Check email response', 'Back to sign in different email cancel and keyboard preserve flow'],
};

// New obligations are appended here; the historical ledger stays immutable.
const PREMIUM_CATALOG = [
  { id: 'feature-100', category: 'Preferences', feature: 'System, light and dark appearance', controlsOrMetrics: 'Appearance choice, committed storage and device theme', nextVerification: 'all three appearance choices, storage failure recovery, device changes and a cold restart', suites: ['tests/app-preferences.test.ts', 'tests/ui/preferences-screen.test.tsx', 'tests/ui/preferences-native-picker.test.tsx', 'tests/ui/preferences-web-provider.test.tsx', 'tests/ui/rtl-preference.test.tsx', 'tests/ui/native-preference-sync.test.tsx'], flow: 'preferences-appearance', acceptance: ['System follows actual device appearance while explicit light and dark remain fixed', 'all three choices persist after cold restart without changing recovery history', 'a failed storage write preserves the last committed selection and exposes a retryable error', 'large text and native accessible picker controls keep every option reachable'] },
  { id: 'feature-101', category: 'Localization', feature: 'Ten-language resource and authored-string completeness', controlsOrMetrics: 'en, hi, es, pt, fr, de, ar, ja, ko and zh-Hans', nextVerification: 'every supported language on all app routes, translated accessibility labels and parameterized numbers and dates', suites: ['tests/app-preferences.test.ts', 'tests/ui/localization-runtime.test.tsx', 'tests/source-translation.test.ts', 'tests/ui/preferences-screen.test.tsx', 'tests/ui/preferences-native-picker.test.tsx', 'tests/shield-localizations.test.js', 'tests/native-localizations.test.js', 'tests/android-presentation-localization.test.js', 'tests/localization-catalog.test.js', 'tests/store-localizations.test.js', 'tests/native-companion.test.js', 'tests/shield-action-localizations.test.js'], flow: 'preferences-language', acceptance: ['all ten languages have non-empty common, preferences, DNS and authored-source keys', 'each language selection survives restart and all native accessible choices are reachable', 'known authored copy translates while URLs identifiers and private input values are preserved', 'dates numbers interpolated content and every app route render without missing keys or clipped text'] },
  { id: 'feature-102', category: 'Localization', feature: 'Arabic RTL and explicit layout restart', controlsOrMetrics: 'Saved language, resolved system locale, reading direction and restart action', nextVerification: 'LTR to Arabic and Arabic to LTR or System with restart, restart failure, mirrored navigation and preserved input', suites: ['tests/app-preferences.test.ts', 'tests/ui/preferences-screen.test.tsx', 'tests/ui/localization-runtime.test.tsx', 'tests/ui/preferences-native-picker.test.tsx'], flow: 'localization-rtl-restart', acceptance: ['Arabic selection saves before offering an explicit RTL restart', 'LTR and System choices resolve the real device locale before deciding whether a direction restart is needed', 'successful restart applies mirrored native layout and preserves committed preferences and recovery data', 'restart failure keeps the saved preference and a reachable retry without fabricating applied layout'] },
  { id: 'feature-103', category: 'Protection', feature: 'Independent protection layer status', controlsOrMetrics: 'Website DNS, Android app intervention, iOS Screen Time and Safari', nextVerification: 'permission granted denied revoked and restart for each supported layer independently', suites: ['tests/protection-permission-native.test.ts', 'tests/protection-dns-safety.test.js', 'tests/encrypted-dns.test.ts'], flow: 'protection-layers', acceptance: ['each supported protection layer displays its own actual authorization configuration and runtime health', 'one failed or denied layer never hides an active independent layer or claims total protection', 'permission revocation pause and restart refresh each native layer without inferred success', 'unsupported iOS packet inspection remains explicit while Safari Screen Time and local recovery remain reachable'] },
  { id: 'feature-104', category: 'Protection', feature: 'Opt-in encrypted DNS consent and release gate', controlsOrMetrics: 'Explicit consent, reviewed provider, native capability and release configuration', nextVerification: 'fresh no-consent fixture, decline, consent, gated build, provider policy and authorization denial', suites: ['tests/encrypted-dns.test.ts', 'tests/protection-dns-safety.test.js', 'tests/ui/encrypted-dns-section.test.tsx', 'tests/ui/dns-race.test.tsx'], flow: 'encrypted-dns-consent', acceptance: ['fresh install does not start encrypted DNS before explicit informed consent', 'declining consent remains usable and release gate prevents activation even after consent', 'consent alone never reports native authorization or active encrypted DNS', 'missing module older binary invalid provider and revoked consent fail closed with truthful status'] },
  { id: 'feature-105', category: 'Protection', feature: 'Encrypted DNS runtime health and failure behavior', controlsOrMetrics: 'Configured enabled active degraded captive portal VPN conflict and stopped states', nextVerification: 'physical resolver success failure captive portal conflicting VPN background restart and stop with sanitized network traces', suites: ['tests/encrypted-dns.test.ts', 'tests/protection-dns-safety.test.js', 'tests/ui/encrypted-dns-section.test.tsx'], flow: 'encrypted-dns-status', acceptance: ['configured profile enabled setting and verified active runtime remain distinct states', 'captive portal VPN conflict timeout and malformed resolver reply never report active protection', 'disable revoke background restart and network change refresh the measured native state', 'physical normal browsing blocked adult domain and latency traces establish actual enforcement without silent plaintext downgrade'] },
  { id: 'feature-106', category: 'Premium', feature: 'Unavailable, retry and store-localized pricing', controlsOrMetrics: 'Monthly yearly loading error store currency subscribe and free exit', nextVerification: 'sandbox storefront currency, unavailable offering, retry success, cancellation and preserved plan selection', suites: ['tests/paywall-presenter.test.ts', 'tests/launch-purchases.test.ts', 'tests/ui/premium-offer.test.tsx', 'tests/store-pricing.test.ts', 'tests/native-iap-lifecycle.test.ts'], flow: 'paywall-price-recovery', live: true, acceptance: ['unavailable or loading store prices disable subscription and keep free continuation reachable', 'retry reloads actual store prices without fabricating a fallback amount or starting checkout', 'monthly and yearly show the exact store-localized currency amount and billing period with equal capabilities', 'busy failure cancellation and restore preserve plan ownership and truthful entitlement'] },
  { id: 'feature-107', category: 'Recovery', feature: 'Retained drafts and durable form saves', controlsOrMetrics: 'Check-in, setback and custom reset drafts', nextVerification: 'edit each form, navigate back, restart, commit, cleanup failure and local deletion', suites: ['tests/recovery-drafts.test.ts', 'tests/ui/recovery-draft.test.tsx'], flow: 'recovery-drafts', acceptance: ['unfinished form values survive navigation and restart without creating history', 'check-in drafts apply only to their local date while custom and setback drafts remain bounded', 'failed durable saves keep fields and errors; retry never duplicates a committed record', 'explicit local data deletion removes all drafts while preferences remain independent'] },
  { id: 'feature-108', category: 'Recovery', feature: 'Localized Library search and tools', controlsOrMetrics: 'Search, empty results, articles and recovery shortcuts', nextVerification: 'search titles and categories in each selected language, clear search and open tools', suites: ['tests/ui/library-screen.test.tsx', 'tests/ui/localization-runtime.test.tsx'], flow: 'library-search', acceptance: ['search matches localized article titles and categories', 'empty search results do not hide recovery tools', 'clearing search restores all local articles', 'article and tool actions preserve the originating native stack'] },
  { id: 'feature-109', category: 'Localization', feature: 'Native permission translations', controlsOrMetrics: 'Ten permission-string resources, host bundle and system app languages', nextVerification: 'inspect installed localized resources and permission dialogs under each supported system app language', suites: ['tests/native-localizations.test.js', 'tests/localization-catalog.test.js', 'tests/shield-localizations.test.js', 'tests/ui/native-preference-sync.test.tsx'], flow: 'native-permission-locales', acceptance: ['all ten permission resource files resolve and have complete descriptions', 'native localized resources belong to the host app rather than monitor extensions', 'system app-language declarations include all ten supported languages', 'actual system permission dialogs use the configured system app language without claiming unsupported vendor localization'] },
];

function suitePath(name) {
  const extension = ['protection-android-routing', 'protection-safari-routing', 'protection-dns-safety', 'android-bytecode-inspection', 'ios-admob-build-config', 'firebase-release-gates', 'focus-shield-build-gate', 'focus-shield-native-policy', 'native-unlock-policy', 'app-schedule-native-policy', 'app-schedule-native-wiring', 'protection-reset-native-policy', 'protection-reset-native-wiring', 'dns-runtime-ownership-native', 'protection-reset-ios', 'cleanup-source-contract'].includes(name) ? 'js' : 'ts';
  return `tests/${name}.test.${extension}`;
}

function buildManifest(ledger) {
  if (!Array.isArray(ledger.rows) || !ledger.rows.length) throw new Error('Feature ledger has no rows.');
  const seen = new Set();
  const features = [...ledger.rows, ...PREMIUM_CATALOG].map(row => {
    if (seen.has(row.id)) throw new Error(`Duplicate ledger feature ${row.id}`);
    seen.add(row.id);
    const number = Number(row.id.replace('feature-', ''));
    const definition = row.acceptance ? ['', row.flow, ...row.acceptance] : DEFINITIONS[number];
    if (!definition) throw new Error(`Missing explicit scenario mapping for ${row.id}. Add it before claiming coverage.`);
    const [suiteNames, flow, ...acceptance] = definition;
    const suites = [...(row.suites || suiteNames.split(',').map(suitePath)), ...(number === 30 ? ['tests/ui/public-basic-help.test.tsx'] : []), ...(!nonMotion.has(number) ? [suitePath('motion-policy')] : []), ...(flow ? [suitePath('native-router-dispatch')] : [])];
    const platforms = androidOnly.has(number) ? ['android'] : iosOnly.has(number) ? ['ios'] : ['ios', 'android'];
    const scenarios = acceptance.map((expected, index) => ({ id: `${row.id}:scenario-${index + 1}`, expected }));
    const requirements = [{ id: `${row.id}:local`, mode: 'local', suites, assertions: suites.map(suite => `behavioral-suite:${suite}`), nextAction: `node scripts/run-feature-verification.js --mode local --feature ${row.id}` }];
    if (liveNumbers.has(number) || row.live) {
      requirements.push({ id: `${row.id}:emulator`, mode: 'emulator', suites: ['functions:emulator'], assertions: scenarios.map(s => s.id), nextAction: `node scripts/run-feature-verification.js --mode emulator --feature ${row.id} --evidence receipts.json`, receiptRequired: true });
      requirements.push({ id: `${row.id}:live`, mode: 'live', assertions: scenarios.map(s => s.id), nextAction: `Use isolated staging/sandbox credentials and collect ${row.nextVerification}; then --mode live --evidence <artifact-backed-receipts.json>.`, receiptRequired: true });
    }
    for (const platform of platforms) {
      requirements.push({ id: `${row.id}:${platform}`, mode: platform, platform, flow, assertions: scenarios.map(s => s.id), nextAction: flow ? `Run --mode ${platform} --feature ${row.id} --run-ui --device <isolated-id> --isolation <fixture.json>; append full scenario receipts.` : `Collect final ${platform} execution receipts for ${row.nextVerification}.`, receiptRequired: true });
      const motion = !nonMotion.has(number);
      requirements.push({ id: `${row.id}:device:${platform}`, mode: 'device', platform, motion, assertions: [...scenarios.map(s => s.id), ...(motion ? ['motion-normal', 'motion-reduced', 'large-text', 'keyboard-and-back', 'accessibility'] : [])], nextAction: `Use a disposable signed physical ${platform} device and capture ${row.nextVerification}${motion ? ', frame timing, Reduce Motion, accessibility and large text' : ''}.`, receiptRequired: true });
    }
    return { id: row.id, ...(row.acceptance ? { catalog: 'premium-verification' } : {}), category: row.category, feature: row.feature, controls: row.controlsOrMetrics, nextVerification: row.nextVerification, platforms, flow, suites, scenarios, requirements };
  });
  return { schemaVersion: 'freed-feature-test-manifest-v1', ledgerPath: LEDGER_PATH, baselineFeatureCount: ledger.rows.length, additionalFeatureCount: PREMIUM_CATALOG.length, coverageMeaning: 'Passing local contracts or Maestro smoke does not prove all native, live, physical, visual or motion behavior. All required checks stay in the denominator.', features };
}

function summarize(results) {
  const summary = { total: results.length, passed: 0, failed: 0, blocked: 0, notRun: 0, passedPercent: 0, complete: false };
  for (const result of results) {
    if (result.status === 'passed') summary.passed++;
    else if (result.status === 'failed') summary.failed++;
    else if (result.status === 'blocked') summary.blocked++;
    else summary.notRun++;
  }
  summary.passedPercent = summary.total ? Math.round(summary.passed * 10000 / summary.total) / 100 : 0;
  summary.complete = summary.total > 0 && summary.passed === summary.total;
  return summary;
}

function validateReceipt(receipt, requirement, baseDirectory, expected = {}) {
  const reject = reason => ({ valid: false, reason });
  if (receipt.requirementId !== requirement.id || receipt.status !== 'passed') return reject('Receipt does not identify this passed requirement.');
  if (!/^[a-f0-9]{64}$/i.test(receipt.appBuildSha256 || '')) return reject('Receipt requires SHA-256 identity of the actual installed app build.');
  if (expected.appBuildSha256 && expected.appBuildSha256 !== receipt.appBuildSha256) return reject('Receipt build identity does not match the current requested build.');
  const timestamp = Date.parse(receipt.generatedAt);
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60000 || Date.now() - timestamp > (expected.maxAgeHours || 72) * 3600000) return reject('Receipt is missing a recent valid execution timestamp.');
  if (requirement.platform && receipt.platform !== requirement.platform) return reject('Receipt platform does not match requirement.');
  if (['ios', 'android', 'device'].includes(requirement.mode) && (!receipt.device || !receipt.device.id)) return reject('Native receipt requires actual device identity.');
  if (requirement.mode === 'device' && receipt.device?.physical !== true) return reject('A physical device is required; simulator video or screenshots do not prove physical behavior.');
  if (requirement.mode === 'live' && (!receipt.service?.environment || receipt.service?.sandbox !== true || !receipt.service?.deployment)) return reject('Live receipt requires isolated sandbox/staging environment and deployment identity.');
  if (requirement.motion) {
    const motion = receipt.motion;
    if (!motion || motion.measured !== true || !['instruments', 'perfetto', 'xctrace', 'android-frame-metrics'].includes(motion.tool) || !(motion.durationSeconds >= 10) || !(motion.frameCount > 0) || !(motion.targetRefreshHz >= 60) || !(motion.p95FrameMs > 0) || !(motion.p95FrameMs <= 1000 / motion.targetRefreshHz * 1.2) || !(motion.droppedFramePercent >= 0 && motion.droppedFramePercent <= 1) || !motion.artifact) return reject('Measured native frame trace with 60 Hz or higher target, frame counts, p95 timing and dropped-frame limits is required; recording fps is not motion proof.');
  }
  if (!Array.isArray(receipt.artifacts) || !receipt.artifacts.length) return reject('Receipt requires hashed execution artifacts.');
  const hashes = new Map();
  for (const artifact of receipt.artifacts) {
    if (typeof artifact.path !== 'string' || path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes('..') || !/^[a-f0-9]{64}$/i.test(artifact.sha256 || '')) return reject('Receipt artifact must be a safe relative path and SHA-256.');
    const absolute = path.resolve(baseDirectory, artifact.path);
    let stat;
    try { stat = fs.lstatSync(absolute); } catch { return reject(`Missing receipt artifact ${artifact.path}`); }
    if (stat.isSymbolicLink() || !stat.isFile()) return reject('Receipt artifact must be a real file, never a symlink.');
    const real = fs.realpathSync(absolute);
    const relative = path.relative(fs.realpathSync(baseDirectory), real);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return reject('Receipt artifact escapes its evidence directory.');
    const digest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    if (digest !== artifact.sha256) return reject(`Receipt artifact hash mismatch: ${artifact.path}`);
    hashes.set(artifact.path, digest);
  }
  if (requirement.motion && !hashes.has(receipt.motion.artifact)) return reject('Motion trace must be included in hashed receipt artifacts.');
  for (const assertion of requirement.assertions) {
    const observed = receipt.assertions?.find(item => item.id === assertion);
    if (!observed || observed.status !== 'passed' || !hashes.has(observed.artifact)) return reject(`Missing artifact-backed assertion: ${assertion}`);
  }
  return { valid: true, reason: 'All required assertions have recent build-bound hashed execution artifacts.' };
}

function evaluateRequirement(requirement, context) {
  if (!requirement.receiptRequired && requirement.mode === 'local') {
    const results = (requirement.suites || []).map(suite => context.suites?.[suite]);
    if (!results.length || results.some(result => !result)) return { status: 'not-run', reason: 'Required behavioral test suite has not run.' };
    if (results.some(result => result.status === 'failed')) return { status: 'failed', reason: 'A required behavioral test suite failed.' };
    if (results.some(result => result.status !== 'passed')) return { status: 'not-run', reason: 'Required behavioral suite did not pass.' };
    return { status: 'passed', reason: 'Related local behavioral contracts passed. Native/live/device obligations remain separate.' };
  }
  const smoke = requirement.flow ? context.flows?.[requirement.flow] : null;
  if (smoke?.status === 'failed') return { status: 'failed', uiSmoke: 'failed', reason: 'Maestro assertions failed. Inspect the flow log and screenshots.' };
  if (requirement.mode === 'emulator' && context.suites?.['functions:emulator']?.status === 'failed') return { status: 'failed', reason: 'Firebase emulator behavioral test suite failed.' };
  const entry = context.receipts?.find(item => (item.receipt || item).requirementId === requirement.id);
  if (entry) {
    const receipt = entry.receipt || entry;
    if (receipt.status === 'failed') return { status: 'failed', reason: 'Scenario execution receipt reports failure.', uiSmoke: smoke?.status || 'not-run' };
    if (['blocked', 'not-run'].includes(receipt.status)) return { status: receipt.status, reason: receipt.reason || 'Execution not completed.', uiSmoke: smoke?.status || 'not-run' };
    if (!context.expected?.appBuildSha256) return { status: 'blocked', reason: 'Provide --build-sha256 for the current installed build before accepting a passed scenario receipt.', uiSmoke: smoke?.status || 'not-run' };
    const validation = validateReceipt(receipt, requirement, entry.baseDirectory || context.evidenceDirectory || process.cwd(), context.expected);
    return { status: validation.valid ? 'passed' : 'blocked', reason: validation.reason, uiSmoke: smoke?.status || 'not-run' };
  }
  return { status: 'blocked', uiSmoke: smoke?.status || 'not-run', reason: 'Required full-scenario execution receipt is missing. UI smoke, local tests, source inspection and unavailable services cannot satisfy this check.' };
}

function parseArgs(argv) {
  const options = { mode: 'local', feature: null, catalog: null, report: null, evidence: null, appBuildSha256: null, runUi: false, device: null, isolation: null, flow: null, plan: false, allowIncomplete: false, timeoutMs: 180000, help: false };
  for (let index = 0; index < argv.length; index++) {
    const option = argv[index];
    const next = () => { const value = argv[++index]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`); return value; };
    if (option === '--mode') options.mode = next();
    else if (option === '--feature') options.feature = next();
    else if (option === '--catalog') options.catalog = next();
    else if (option === '--report') options.report = next();
    else if (option === '--evidence') options.evidence = next();
    else if (option === '--build-sha256') options.appBuildSha256 = next();
    else if (option === '--device') options.device = next();
    else if (option === '--isolation') options.isolation = next();
    else if (option === '--flow') options.flow = next();
    else if (option === '--timeout-ms') options.timeoutMs = Number(next());
    else if (option === '--run-ui') options.runUi = true;
    else if (option === '--plan') options.plan = true;
    else if (option === '--allow-incomplete') options.allowIncomplete = true;
    else if (option === '--help' || option === '-h') options.help = true;
    else throw new Error(`Unknown option ${option}`);
  }
  if (!MODES.includes(options.mode)) throw new Error(`Unknown mode ${options.mode}; choose ${MODES.join(', ')}.`);
  if (options.catalog && !['baseline', 'premium'].includes(options.catalog)) throw new Error('--catalog must be baseline or premium.');
  if (options.feature && !/^feature-\d{3}$/.test(options.feature)) throw new Error('--feature must use an exact ledger ID, such as feature-048.');
  if (options.appBuildSha256 && !/^[a-f0-9]{64}$/i.test(options.appBuildSha256)) throw new Error('--build-sha256 requires 64 hexadecimal characters.');
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 1800000) throw new Error('--timeout-ms must be from 1000 to 1800000.');
  if (options.runUi && !['ios', 'android'].includes(options.mode)) throw new Error('--run-ui requires explicit ios or android mode.');
  if (options.runUi && (!options.device || !options.isolation)) throw new Error('UI execution requires an explicit disposable --device and --isolation fixture receipt.');
  if (options.runUi && (!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(options.device) || options.device.includes(','))) throw new Error('UI execution accepts one single explicit device ID; multi-device lists are refused.');
  if (options.runUi && options.device.toUpperCase() === OWNER_SIMULATOR) throw new Error('Owner simulator is preserved; choose a fresh isolated test simulator.');
  return options;
}

function countTestResults(output) {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  const jestSummaries = [...clean.matchAll(/^Tests:\s+(.+)$/gm)];
  if (jestSummaries.length) {
    const summary = jestSummaries[jestSummaries.length - 1][1];
    const count = label => Number(summary.match(new RegExp(`(\\d+) ${label}(?:,|$)`))?.[1] || 0);
    return { passed: count('passed'), failed: count('failed'), skipped: count('skipped') + count('todo') };
  }
  const summary = field => {
    const matches = [...clean.matchAll(new RegExp(`(?:#|ℹ) ${field} (\\d+)`, 'g'))];
    return matches.length ? Number(matches[matches.length - 1][1]) : null;
  };
  return { passed: summary('pass') ?? (clean.match(/^PASS /gm) || []).length, failed: summary('fail') ?? (clean.match(/^FAIL /gm) || []).length, skipped: summary('skipped') ?? (clean.match(/# SKIP/g) || []).length };
}

function validateIsolation(fixture, options) {
  const valid = fixture.schemaVersion === 'freed-disposable-ui-fixture-v1' && fixture.deviceId === options.device && fixture.platform === options.mode && fixture.disposable === true && fixture.dataOwner === 'test-only' && ['disabled', 'emulator', 'sandbox'].includes(fixture.services) && fixture.allowRealEmail === false && fixture.allowRealPurchases === false && fixture.allowRealMessages === false;
  return { valid, reason: valid ? 'Fixture is explicitly disposable and forbids real communications and production purchases.' : 'Isolation receipt must bind this disposable device, test-only data, disabled/emulator/sandbox services, and no real email, purchase or message actions.' };
}

module.exports = { LEDGER_PATH, MODES, OWNER_SIMULATOR, buildManifest, summarize, validateReceipt, evaluateRequirement, parseArgs, countTestResults, validateIsolation };
