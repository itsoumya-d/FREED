// Generated with node scripts/localization-audit.js --write-catalog.
// Static copy inventory; category and occurrence evidence are for translation work.
// Exclusions follow references from exported freed-app declarations.
export const SOURCE_COPY_CATALOG = {
  "excludedDeclarations": [
    "getInitialScreenForRecoveryState",
    "habitLibrary",
    "formatElapsedSince",
    "formatCompactDurationMs",
    "PaywallScreen",
    "FocusShieldSection",
    "AccountScreen",
    "getProtectionPermissionStatusColor",
    "getProtectionPermissionStatusLabel",
    "formatRecoveryDate",
    "getMembershipCapabilityLabels",
    "LegacyProfileScreen",
    "openAppSettingsForPermission",
    "deleteTemporaryChallengePhoto"
  ],
  "entries": [
    {
      "source": ". Enabling stores your passphrase securely on this device and uploads encrypted progress after changes. Keep a copy of your passphrase for another device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4561,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": ". Recorded activity",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 38,
          "kind": "literal-candidate",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "). That setting can block DNS Guard from restarting.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3601,
          "kind": "jsx",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{activity}} · {{durationSec}} seconds",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1766,
          "kind": "template-candidate",
          "surface": "buildTemplatesFromSeed"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "{{APP_CHECK_DEBUG_PROVIDER_ENV}} is forbidden for production builds",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 597,
          "kind": "template-candidate",
          "surface": "getFirebaseClientReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "{{APP_CHECK_DEBUG_TOKEN_ENV}} is required when debug App Check is enabled",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 599,
          "kind": "template-candidate",
          "surface": "getFirebaseClientReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "{{avgForwardMs}} ms avg lookup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3616,
          "kind": "template-candidate",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{count}} day",
      "occurrences": [
        {
          "file": "src/components/RecoveryHero.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "RecoveryHero"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{count}} days",
      "occurrences": [
        {
          "file": "src/components/RecoveryHero.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "RecoveryHero"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{count}} recorded protection events",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 49,
          "kind": "literal-candidate",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{count}} second",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 29,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{count}} seconds",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 29,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{customChallengeCount}} saved",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 25,
          "kind": "template-candidate",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{EMAIL_LINK_ASSOCIATION_READY_ENV}} must equal {{EMAIL_LINK_ASSOCIATION_READY_VALUE}} only after Hosting association deployment and signed-device verification",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 637,
          "kind": "template-candidate",
          "surface": "getFirebaseEmailLinkReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "{{EMAIL_LINK_DOMAIN_ENV}} must equal the production-safe Firebase Auth link domain {{FIREBASE_EMAIL_LINK_DOMAIN}} without a scheme, path, port, query, or fragment",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 633,
          "kind": "template-candidate",
          "surface": "getFirebaseEmailLinkReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "{{explanation}} App protection does not inspect in-app content. Test device blocking separately.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 32,
          "kind": "template-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{label}} time",
      "occurrences": [
        {
          "file": "src/components/NativeTimeInput.tsx",
          "line": 16,
          "kind": "template-candidate",
          "surface": "NativeTimeInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{label}} timed out after {{timeoutMs}}ms.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 581,
          "kind": "template-candidate",
          "surface": "fetchStoreProviderResponse"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{minutesLeft}} min {{appLabel}} unlock; adult web stays blocked",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3522,
          "kind": "template-candidate",
          "surface": "formatUnlock"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{minutesLeft}} min challenge window; adult web stays blocked; app shields stay active",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3526,
          "kind": "template-candidate",
          "surface": "formatUnlock"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{minutesLeft}} min Screen Time unlock; adult web stays blocked",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3524,
          "kind": "template-candidate",
          "surface": "formatUnlock"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{nativeDailyLimit}} minutes",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 87,
          "kind": "template-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{selectedCount}} selected",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1066,
          "kind": "template-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{targetCount}} selected apps",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 69,
          "kind": "template-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{targetCount}} selected targets",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 69,
          "kind": "template-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{title}} can be finished later. Continuing setup: {{title2}}.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2364,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{title}} is still not complete. Finish the opened setup step and return to FREED; setup will continue automatically.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2356,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{title}} is unavailable in this build. Install a signed native FREED build or review the platform entitlement/setup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1986,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{title}}, {{count}} minute",
      "occurrences": [
        {
          "file": "src/components/ChallengePresentation.tsx",
          "line": 7,
          "kind": "literal-candidate",
          "surface": "ChallengeOption"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{title}}, {{count}} minutes",
      "occurrences": [
        {
          "file": "src/components/ChallengePresentation.tsx",
          "line": 7,
          "kind": "literal-candidate",
          "surface": "ChallengeOption"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{trialDays}}-day free trial for eligible new subscribers, then {{billed}} per month.",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 256,
          "kind": "template-candidate",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "{{trialDays}}-day free trial for eligible new subscribers, then {{billed}} per year.",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 244,
          "kind": "template-candidate",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "{{value1}} · {{confidence}} data confidence{{value3}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3116,
          "kind": "template-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{value1}} · {{n}} min",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1754,
          "kind": "template-candidate",
          "surface": "buildTemplatesFromSeed"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "{{value1}} · {{n}} rounds",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1750,
          "kind": "template-candidate",
          "surface": "buildTemplatesFromSeed"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "{{value1}} · {{n}}s",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1758,
          "kind": "template-candidate",
          "surface": "buildTemplatesFromSeed"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "{{value1}} · {{value2}} · {{networkResolverCount}} network fallback{{value4}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3616,
          "kind": "template-candidate",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{value1}} {{value2}}. Choose another reset.",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 47,
          "kind": "template-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{value1}} min app break available on request",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6881,
          "kind": "template-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "{{value1}} Purchases owned by this guest account stay with it and will not move to the account you sign in to. Recovery history stays on this device.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 297,
          "kind": "template-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "{{value1}} sign-in could not open. Try again.",
      "occurrences": [
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 65,
          "kind": "template-candidate",
          "surface": "SocialSignInButtons"
        }
      ],
      "category": "account"
    },
    {
      "source": "• Blocked lookups return \"not found\"; your normal browsing and streaming stay untouched.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2557,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "• FREED checks website addresses you look up against its adult-domain list on-device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2555,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "• FREED never proxies, reads, or stores your other internet traffic or page contents.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2556,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "• Protection is incomplete: website blocking or app interruptions may be off until you finish setup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2614,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "• Still available: recovery challenges, progress, check-ins, breathing and local CLARA guidance.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2613,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "1 · Poor sleep — 5 · Restful sleep. Tap again to leave unanswered.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6218,
          "kind": "jsx",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "1–3 years",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 553,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "2-min reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5958,
          "kind": "copy-property",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "2-minute productive sprint",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2025,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "20 controlled pushups",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 109,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "3 slow breaths",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5956,
          "kind": "copy-property",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "3-2-1 gratitude ladder",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1873,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "4-7-8 breathing",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 420,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1654,
          "kind": "literal-candidate",
          "surface": "LEGACY_ID_BY_PREFIX"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "4-7-8 breathing reset",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 120,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "4-7-8 Relax",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 67,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "4-7-8 Relaxing Breath",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 29,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "4–7 years",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 553,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "5-year review",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 707,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "8+ years",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 553,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "A comfortable breathing pause",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "A comfortable movement pause",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 18,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "A completed reset is waiting to be saved. Your receipt was preserved.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8366,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "A free pause at your own pace.",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 18,
          "kind": "attribute",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "A gentle exhale pause",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "A native expiry relock could not be installed. Existing protection remains in effect.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 650,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "A new day has started. Keep this draft and move it to today's entry.",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 31,
          "kind": "jsx",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "A practice you chose for today's plan.",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "a repeatable cue",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 526,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "A reset link is on its way if this email has an account. Reset your password, then return here to confirm.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 92,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "A rule-based estimate from local logs and schedules. It is not a measured relapse probability or a clinical prediction.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3122,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "A second gentle inhale is optional; never force it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 485,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "A signed-in account is required. Choose an account method to continue.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 197,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "A simple physical pause creates distance from the automatic tap.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 488,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 292,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "A single valid email credential is required.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 690,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "A slip is a data point, not a verdict. What you log and how you read it decides the trend.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 57,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "A slip is data, not a verdict.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6312,
          "kind": "attribute",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "A slip is data, not a verdict. Take one clean action now: breathe, drink water, and write what happened before the urge. We will adjust the plan from that pattern. Clean action right now restarts your recovery.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 530,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "A slip is data, not a verdict. The recent pattern points to {{value1}}, so the next move is specific: create distance, do one two-minute reset, and change the environment before making another decision.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 526,
          "kind": "template-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "A small action helps you prepare for the next difficult moment.",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 65,
          "kind": "literal-candidate",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "A small connection can make the next safe step easier.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 498,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 302,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "A specific next step makes the automatic loop less powerful.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 483,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 287,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "A stable selector is highlighted and waiting for explicit confirmation.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 503,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "A starting point that belongs to you. Next, choose the protection you need.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1003,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "A supported sign-in must be connected to this account before it can be confirmed.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 108,
          "kind": "jsx",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "A valid {{provider}} identity credential is required.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 703,
          "kind": "template-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "A valid account email and password are required.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 698,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "About {{seconds}} seconds",
      "occurrences": [
        {
          "file": "src/components/ResetChoicePicker.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "ResetChoicePicker"
        }
      ],
      "category": "main"
    },
    {
      "source": "Access check timed out.",
      "occurrences": [
        {
          "file": "src/lib/guided-reset-access.ts",
          "line": 110,
          "kind": "literal-candidate",
          "surface": "createGuidedResetAccessController"
        }
      ],
      "category": "main"
    },
    {
      "source": "Access through {{date}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7054,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Accessibility permission was revoked, so calibration stopped and no selector was stored.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 404,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 166,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Accessibility Service",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 265,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Accessibility service observes supported browser and focused WebView URL/search text only.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 130,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Accessibility service stopped, so calibration ended and no selector was stored.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 413,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 418,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Accessibility service was interrupted, so calibration stopped and no selector was stored.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 390,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "account",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account access is unavailable in this build. Check your connection and retry in the iOS or Android app.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 161,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Account access is unavailable in this build. You can continue with progress on this device.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 161,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Account confirmation could not be completed. Check your connection and try again.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 54,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Account confirmation could not be completed. Try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 718,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Account connected. Choose a passphrase and upload an encrypted backup to save it remotely.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4406,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account deletion",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 92,
          "kind": "copy-property",
          "surface": "PrivacyPolicyPage"
        },
        {
          "file": "src/features/legal-pages.tsx",
          "line": 150,
          "kind": "copy-property",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Account deletion confirmation is already open.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8288,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account deletion could not start. Local data was kept on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4802,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account deletion covers associated hosted backups, optional analytics, push registrations, service records and purchase ownership data through the service deletion process. FREED does not promise instantaneous provider authorization revocation or complete erasure of retained copies. Store and Google records follow their own terms.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 224,
          "kind": "literal-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Account Deletion Help",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4860,
          "kind": "attribute",
          "surface": "PrivacySupportCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7122,
          "kind": "attribute",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account deletion started. Cloud removal is processing and local data was cleared.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4799,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account deletion was not accepted.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4798,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account deletion was requested. Device cleanup could not finish. Return to Profile and use Delete local data.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8283,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account email",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4588,
          "kind": "attribute",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account link could not be completed.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4402,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4409,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account link could not be sent.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4421,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4423,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account link opened. Enter the email address that requested it, then complete sign-in.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4461,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account linking safety check is unavailable.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 920,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Account password",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 104,
          "kind": "attribute",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Account unavailable",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 70,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Account, membership and app preferences",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7076,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Accountability",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 57,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Accountability Partner",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4950,
          "kind": "attribute",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Accountability Plan",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5182,
          "kind": "literal-candidate",
          "surface": "membershipPlanLabels"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activate protection before installing selected-app schedules.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1636,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Activation test confirmed the reviewed adult-domain feed is unchanged before checking native readiness.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2322,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activation test could not refresh native permission/feed status. Try again after returning from system settings.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2335,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activation test could not refresh the adult-domain feed sync, but current native permission/feed status was checked.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2318,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activation test could not run native diagnostics. Return from system settings, then run Test Protection again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1870,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activation test refreshed the reviewed adult-domain feed before checking native readiness.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2320,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activation test used embedded adult-domain protection after feed sync warning: {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2315,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Active guards: {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "template-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Active timed and strict guards affect supported distracting apps, including apps outside your manual selection. Ending one guard keeps overlapping guards in effect.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3824,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "activity",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 45,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activity estimate",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3015,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activity estimate based on streak, completed challenges, and today&apos;s recorded attempts. It is not a clinical measurement or a probability of recovery.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3020,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activity Estimates",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3326,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 45,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 45,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Activity Recognition, sensors, and steps",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 508,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Activity recorded",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 53,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Ad-free resets and recovery challenges",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 42,
          "kind": "literal-candidate",
          "surface": "benefits"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Adaptive signals",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 46,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "ADAPTIVE SIGNALS",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3303,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Add",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2798,
          "kind": "attribute",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Add a sign-in to this account. Your purchases keep the same owner.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 292,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Add Contact",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5158,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Add friction before the pattern builds.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 503,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_HEADLINES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 310,
          "kind": "literal-candidate",
          "surface": "RETENTION_HEADLINE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Add it to your calendar instantly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1170,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add one anchor habit per block.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2113,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add one feeling word.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1220,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add one trigger per column.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1082,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add the next one you'll create today.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1117,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add what they say about you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 753,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add what they say about your resilience.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 978,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add what you see, hear, and feel.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1064,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add who is around you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1065,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add why each one matters to you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 666,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add: 'I'm proud you came back.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1289,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Add: 'thought of you.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1152,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Adds separate adult-domain rules in Safari. Apple's adult web policy can work independently.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 88,
          "kind": "copy-property",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Ads, payments, and permissions",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 119,
          "kind": "copy-property",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "adult content",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult Search Test",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3936,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult web filter",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 144,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Adult website protection",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult website protection · {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3673,
          "kind": "template-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult websites",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 53,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain blocking is separate and stays available even if you do not select any app timers.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1135,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain DNS filtering is active. Normal browsing stays direct.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 9,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 628,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Adult-domain DNS Guard",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 227,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Adult-domain feed {{value1}} synced to native protection.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 789,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Adult-domain feed is unchanged; native protection kept the cached reviewed feed.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7711,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain feed sync could not complete; embedded adult-domain protection remains available.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7718,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain feed sync could not complete.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1947,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain feed sync fell back safely: {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1937,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain feed sync fell back safely: {{warning}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7707,
          "kind": "template-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain feed sync is paused while FREED protection is disabled.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 790,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Adult-domain feed synced from the reviewed remote source.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7709,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain filtering is paused for network sign-in. Finish sign-in, then test protection again.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1687,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Adult-domain list loaded and synced to native protection.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1943,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Adult-domain protection preserves normal browsing and keeps intervention challenges ad-free.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3848,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Advanced",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3712,
          "kind": "jsx",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 104,
          "kind": "attribute",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Advanced diagnostics",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3891,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "After saving, select FREED · Cloudflare Families encrypted DNS in iOS DNS settings, then return and check settings again. Saving a configuration does not enable it or verify network blocking.",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 74,
          "kind": "jsx",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "After scrolling social media",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 557,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Aggregate analytics sharing is on. Send a snapshot when you are ready.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7387,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7395,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Aggregate snapshot saved.{{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7457,
          "kind": "template-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Aggregate snapshot was not accepted. Retry when connected.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7457,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Agree and continue",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 119,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "AI Coach",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5183,
          "kind": "literal-candidate",
          "surface": "membershipPlanLabels"
        }
      ],
      "category": "main"
    },
    {
      "source": "AI Coach Plan",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5183,
          "kind": "literal-candidate",
          "surface": "membershipPlanLabels"
        }
      ],
      "category": "main"
    },
    {
      "source": "Aim for six full cycles per minute.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 595,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "All features",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8490,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 8496,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 13,
          "kind": "attribute",
          "surface": "FeatureDirectory"
        },
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 62,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "All required setup rows are ready. Running the local configuration check now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2373,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "All tools and practices",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 68,
          "kind": "jsx",
          "surface": "MomentumToday"
        },
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "literal-candidate",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Allow app timers",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 28,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Allow connection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 27,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Allow Screen Time",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 21,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 21,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Allowed sites",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2767,
          "kind": "literal-candidate",
          "surface": "AlwaysAllowSection"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 22,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Allowed sites ·",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3709,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Allowed sites unavailable",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2764,
          "kind": "attribute",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Allowed: normal browsing",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3368,
          "kind": "literal-candidate",
          "surface": "VerdictCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "allowlist",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 22,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Allows FREED to request Apple's adult web filter, shield selected apps or domains, and relock after Screen Time-sourced earned unlocks.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 138,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Already have an account? Sign in",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 354,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Also mark meditation completed",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 20,
          "kind": "attribute",
          "surface": "ToolCompletionView"
        },
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 20,
          "kind": "jsx",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Alternate knees slowly if comfortable; seated knee lifts are an option.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 178,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Alternate nostril breath",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 492,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Alternate sides each rep.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 380,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Always-allow list saved with {{count}} domain.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 818,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Always-allow list saved with {{count}} domains.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 818,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Always-allow list sync is paused while FREED protection is disabled.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 819,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Always-on VPN is configured for another app (",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3601,
          "kind": "jsx",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "An accepted request means deletion is in progress, not that every server or provider copy is erased. If rejected or interrupted, retry or contact support. If accepted but device cleanup fails, return to Profile and use Delete Local Data.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 183,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        },
        {
          "file": "src/features/legal-pages.tsx",
          "line": 216,
          "kind": "literal-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "An optional change of environment offers a pause from the current loop. Stay indoors or seated if preferred.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 137,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "An optional identity reflection makes space to write your reasons during an urge. You choose what to share.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 148,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "An urge is not a command. It is a temporary spike in your brain's reward system, and it follows a predictable arc: it climbs, it peaks, and then it falls. Most people misread the peak as permanent, which is exactly when they give in. Naming the arc — \"this is the crest, the fall is next\" — converts an emergency into weather.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 20,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "analytics",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Analytics endpoint is not configured for this build yet.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7388,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7396,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Analytics records have a configured 14-day expiry: day counters expire 14 days after their UTC-day boundary, and snapshot and receipt metadata 14 days after writing. Expiry makes records eligible for TTL deletion; physical deletion may occur later.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 131,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Analytics sharing",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3247,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7110,
          "kind": "attribute",
          "surface": "ProfileScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Analytics sharing is not ready.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3261,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Analytics sync could not complete.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7456,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Analytics was not acknowledged for this saved snapshot. The pending request remains available for retry.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7452,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android Accessibility settings could not be opened. Open Android Settings > Accessibility > FREED Protection, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 308,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1059,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android activation needs at least one selected app timer so FREED can verify app interruption before setup completes.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1134,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android DNS-only VPN protection, called DNS Guard in the app, classifies DNS questions locally against the reviewed adult-domain feed. FREED does not full-tunnel traffic, inspect packet payloads beyond DNS questions, proxy normal browsing, decrypt HTTPS, or MITM connections.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 101,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Android exceptions apply only to FREED’s local ordinary-site rules. Known adult domains cannot be excepted. DNS queries still use Cloudflare Families, which may continue blocking the site. For a wrong block, open Privacy & support.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2770,
          "kind": "jsx",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android Focus Shield interrupts selected native-app surfaces using local selector fingerprints. FREED never keeps screen text, screenshots, or raw accessibility trees in recovery state.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 99,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android local exceptions only · Families filtering still applies",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 63,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android native activation diagnostics need attention.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1320,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android native activation diagnostics passed for DNS Guard, Accessibility, Usage Access, selected app timers, and domain classification.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1318,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android Network & internet settings",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 295,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android network settings could not be opened. Review Private DNS manually, then return to FREED and verify DNS Guard.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 390,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android notification settings could not be opened. Open Android Settings > Apps > FREED > Notifications, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 426,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android Private DNS is using encrypted DNS that this filter cannot inspect. Review Private DNS settings to use web filtering. App protection and recovery tools remain available.",
      "occurrences": [
        {
          "file": "src/lib/dns-guard-health.ts",
          "line": 24,
          "kind": "literal-candidate",
          "surface": "dnsGuardCoverageMessage"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android selected surface inspection is release-gated pending policy and device validation.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 72,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        },
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android settings",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1839,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android support covers DNS Guard/VpnService consent, Usage Access, AccessibilityService consent, selected app package configuration, activation tests, reboot behavior, and normal browsing allow cases.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 165,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Android Usage Access settings could not be opened. Open Android Settings > Special app access > Usage access > FREED, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 348,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android VPN consent could not be opened. Tap Start DNS Guard again, or restart the app and try once more.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 583,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android VPN consent is needed before FREED can start DNS Guard. Approve the system dialog, then FREED will retry DNS Guard when you return.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1701,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android VPN consent is needed before FREED can start DNS Guard. Approve the system dialog, then FREED will retry DNS Guard when you return.{{privateDnsNote}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1701,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android VPN permission approved. Starting DNS Guard now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2457,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android VPN permission is approved. Starting DNS Guard now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2189,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 2209,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android VPN settings could not open. Go to Android Settings > Network & internet > VPN, review any conflicting VPN, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 469,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Android will ask you to allow FREED as a VPN service next. You can turn DNS Guard off anytime in Shield settings.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2560,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Android's DNS settings need review before FREED can start web protection. App protection and recovery tools remain available.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 43,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Annual Premium",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5178,
          "kind": "literal-candidate",
          "surface": "membershipPlanLabels"
        }
      ],
      "category": "main"
    },
    {
      "source": "Another VPN app appears to be active. Android allows only one VPN at a time, so DNS Guard cannot run alongside it.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3596,
          "kind": "jsx",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Another VPN is using the connection FREED needs for web protection.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 48,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Anti-shame mantra round",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1911,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "App and browser interruption",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 264,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App and domain shields",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 155,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App break unavailable. Your completed activity is saved.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8417,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 8426,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "App configuration could not be saved while protection is resetting.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 695,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App configuration sync is paused while FREED protection is disabled.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 696,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App guard configuration saved. Native readiness is reported separately.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1502,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App guard configuration was cancelled. Retry saving.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7809,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "App guard mode",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3734,
          "kind": "attribute",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 104,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "App guard mode persistence could not be confirmed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1490,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App guard update failed. The previous configuration has been retained.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1497,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App guard update was not accepted. Existing native protection remains installed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1481,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App limits",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "App limits require a supported native iOS or Android build.",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 67,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "App limits use package IDs and foreground duration. App-limit setup does not request in-app content inspection.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 101,
          "kind": "literal-candidate",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App preferences",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7084,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "App protection",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "App protection: {{appStatus}} · review schedules",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 66,
          "kind": "template-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "App schedule configuration was rejected. Previous protection settings stay unchanged.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 762,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App schedules are off. Manual app limits stay configured separately.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 763,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App schedules are saved and the Accessibility service is connected. Local-time windows are checked on app events and while the screen is on.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 765,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App schedules are saved. Connect FREED Accessibility to enforce them.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 764,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "App schedules use local time while Accessibility is connected, restore after service reconnect, and recheck on screen-on. Device sleep can delay checks; no exact wake alarm is used.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 133,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "APP SELECTION",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1063,
          "kind": "jsx",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "App shields",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3232,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store bundle id mismatch.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 435,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store entitlement is not active.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 436,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store product id mismatch.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 434,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store server API credentials are not configured.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 404,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store transaction response",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 425,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store transaction verification",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 418,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store verification failed.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 421,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "App Store verification returned {{status}}.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 423,
          "kind": "template-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Apple",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Apple account confirmation requires the native FREED app.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 144,
          "kind": "literal-candidate",
          "surface": "revokeAppleAuthorizationForDeletion"
        }
      ],
      "category": "account"
    },
    {
      "source": "Apple and Google credentials are exchanged natively when their sign-in providers are configured; this app does not open browser OAuth flows.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4646,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Apple authorization revocation could not be confirmed. Check account service configuration and try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 112,
          "kind": "literal-candidate",
          "surface": "runAndroidApple"
        }
      ],
      "category": "account"
    },
    {
      "source": "Apple exposes opaque Screen Time tokens; FREED does not read other app screens or browsing history.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 139,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Apple ID",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 284,
          "kind": "literal-candidate",
          "surface": "getSubscriptionTermsDisclosure"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Apple Screen Time selection",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1066,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Apple sign-in could not be completed. Try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 785,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Apple will ask you to confirm. Its authorization will be revoked before account deletion.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 102,
          "kind": "jsx",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Applies Apple's low-latency adult-content web policy without packet inspection or screen-capture analysis.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 149,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Approve access in Apple's prompt. You may be asked for your passcode or Face ID.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 21,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Approve each request on your device. FREED checks the result when you return and opens the next step for you.",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 67,
          "kind": "jsx",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Approve Screen Time authorization before applying the web filter.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 587,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Approve Screen Time authorization before choosing protected apps.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 878,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Approve Screen Time authorization before scheduling Night Guard.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 761,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "apps",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "articles",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 31,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Ask a question, not a favor",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1191,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask for prayer or wishes",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 931,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask for support without details.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 943,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask for the strength of the next minute.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1961,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask how they are doing too.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1221,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask one follow-up before responding.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1204,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask one open question about their day.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1904,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask one thoughtful question.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1202,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask whether they are available to talk.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2145,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ask: what advice would you give now?",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 803,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Attempts",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3004,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Authenticated Firebase purchase verification is unavailable.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7551,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Authenticated Firebase services are unavailable.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 378,
          "kind": "literal-candidate",
          "surface": "getFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Auto-renews at the price and interval shown. No free trial. Charged to your {{account}} at confirmation.",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 290,
          "kind": "template-candidate",
          "surface": "getSubscriptionTermsDisclosure"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Automated guidance · not therapy or emergency care",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5993,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Automated guidance · not therapy or emergency care. Cloud chat is optional and uses a daily allowance.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6006,
          "kind": "jsx",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Automatic backup enabling was cancelled.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 198,
          "kind": "literal-candidate",
          "surface": "createAutomaticBackupController"
        },
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 208,
          "kind": "literal-candidate",
          "surface": "createAutomaticBackupController"
        },
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 319,
          "kind": "literal-candidate",
          "surface": "enableAutomaticBackup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Automatic backup has been stopped.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 194,
          "kind": "literal-candidate",
          "surface": "createAutomaticBackupController"
        }
      ],
      "category": "main"
    },
    {
      "source": "Automatic backup is",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4561,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Automatic backup is unavailable on this platform.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Automatic schedules are unavailable in this installed build.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Available locally",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 78,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Avg sleep",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3074,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Avg urge",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3073,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Back",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5995,
          "kind": "attribute",
          "surface": "CoachPanel"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 6139,
          "kind": "attribute",
          "surface": "CheckInScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 6314,
          "kind": "attribute",
          "surface": "SlipLogScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 6908,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 8843,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 315,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 21,
          "kind": "jsx",
          "surface": "BasicMovementScreen"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 17,
          "kind": "jsx",
          "surface": "FeatureDirectory"
        },
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 28,
          "kind": "attribute",
          "surface": "JournalScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Back to account options",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 314,
          "kind": "attribute",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Back to Android Settings",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 29,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt",
          "line": 98,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Back to Library",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3994,
          "kind": "attribute",
          "surface": "ArticleReaderScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3994,
          "kind": "attribute",
          "surface": "ArticleReaderScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Back to safety",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6849,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        },
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Back to Safety",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6573,
          "kind": "attribute",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Back to sign in",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 357,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Back to Today",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 46,
          "kind": "attribute",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Back to Welcome",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 364,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Backup action could not complete.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4386,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Backup cancelled.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 272,
          "kind": "literal-candidate",
          "surface": "abortableWait"
        },
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 273,
          "kind": "literal-candidate",
          "surface": "abortableWait"
        }
      ],
      "category": "main"
    },
    {
      "source": "Backup could not be saved. Current recovery history was preserved.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8232,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Backup package",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4492,
          "kind": "attribute",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Backup upload retries ended. Recovery data remains on this device.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 43,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Backup: {{phase}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4575,
          "kind": "template-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Balanced",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3783,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3793,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3803,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3814,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Basic movement",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 18,
          "kind": "attribute",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Basic support is available without cloud chat.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Be brutally honest in both.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 701,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Be honest with yourself",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 13,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Be specific, not generic.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 960,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Before DNS Guard starts",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2549,
          "kind": "attribute",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Before use",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 7,
          "kind": "copy-property",
          "surface": "APP_GUARD_MODES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Before use pauses selected individual applications immediately after you save the mode and native authorization is ready. The default alone does not activate it.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 102,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Before-use interruption for selected Android packages.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Before-use pause for selected individual iOS applications.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Begin before the timer ends.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 686,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Begin Breathing",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        },
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Behavior",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 42,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Belly breathing",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 510,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Belly-laugh out loud if you can.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1980,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Best",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3003,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Best reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3310,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Big or small, no judging.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 752,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Billed monthly",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 255,
          "kind": "copy-property",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Billed yearly",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 243,
          "kind": "literal-candidate",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Billed yearly · about {{value1}}/month",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 242,
          "kind": "template-candidate",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Billing and purchases",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 171,
          "kind": "copy-property",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Binaural beats focus reset",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2063,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "block",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Block adult websites, pause urges, and build healthier habits.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 947,
          "kind": "literal-candidate",
          "surface": "WelcomeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Block supported adult websites. App selection is optional.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Blocked by mistake?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6564,
          "kind": "literal-candidate",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Blocked host: {{host}}",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 19,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "Blocked: adult intent",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3368,
          "kind": "literal-candidate",
          "surface": "VerdictCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Blocks known adult domains at DNS lookup time without routing all device traffic through FREED.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 232,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "body reset",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 520,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_TAGS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 336,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Body scan write-up",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 809,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Bodyweight rows",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 349,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Bookend your day with one promise",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1930,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Boredom",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6304,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Boredom & idle time",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 557,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "boundary",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Box (4-4-4-4)",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 67,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Box breathing",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 438,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Box Breathing (4-4-4-4)",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 30,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Brace your core and squeeze glutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 87,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Brain fog & low drive",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 561,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "branch",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Break free. Make room for you.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 946,
          "kind": "literal-candidate",
          "surface": "WelcomeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "breath",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 25,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Breathe",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4127,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        },
        {
          "file": "src/features/library-screen.tsx",
          "line": 23,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 25,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 38,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Breathe gently at a comfortable pace.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1492,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 160,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Breathe gently at a comfortable pace. Avoid forcing or holding your breath. Choose another reset if this feels uncomfortable.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 554,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Breathe gently at your own pace.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Breathe in for four seconds, hold for seven, then breathe out for eight.",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 29,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Breathe in slowly, then exhale longer.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 472,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 276,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Breathe in. Breathe out.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 23,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedInterventionActivity.kt",
          "line": 126,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Breathe into that spot.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 182,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Breathing reset",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Breathing session finished",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Browse dated records and past practices.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 44,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 44,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Brush slowly for two full minutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1474,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Brush teeth",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1463,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Brush teeth and stretch for 2 minutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1847,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Build and save a personal guided activity.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 30,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 30,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Build identity, not just willpower",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 28,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Build resets that match your real life.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4065,
          "kind": "jsx",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Build your personalized 24h plan",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2101,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "builder",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 30,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "BUILT-IN AND OPTIONAL CLOUD GUIDANCE",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6000,
          "kind": "jsx",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Built-in guidance stays on this device.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Buy lifetime · {{headline}}",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 275,
          "kind": "template-candidate",
          "surface": "getPaywallPrimaryActionLabel"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Calculated from your logged activity. This index does not measure clinical recovery.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3198,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "calendar",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 44,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Calf raises",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 385,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Calibrated surface",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 45,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Calibration stopped because the selected app was left. No selector was stored.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 306,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Calibration timed out after five minutes. No selector was stored; retry or choose a vetted preset.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 269,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Call a friend",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 846,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Call and say you just need a minute.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 857,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Call someone older than 60",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1892,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Call without an agenda.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1903,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "calm",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 25,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 38,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Calm",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4139,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Calm a craving",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 23,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Camera and on-device ML Kit labels",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 497,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Camera and on-device Vision labels",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 458,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Camera and photo classifier",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "Camera, motion, steps, and location",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 535,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "can't stay safe",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 497,
          "kind": "literal-candidate",
          "surface": "isCrisisSupportInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cancel",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 32,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 5144,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 428,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "src/components/NativeTimeInput.tsx",
          "line": 16,
          "kind": "jsx",
          "surface": "NativeTimeInput"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Cancel in {{manage}} before renewal; access continues through the paid period.",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 291,
          "kind": "template-candidate",
          "surface": "getSubscriptionTermsDisclosure"
        }
      ],
      "category": "premium"
    },
    {
      "source": "cannot stay safe",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 498,
          "kind": "literal-candidate",
          "surface": "isCrisisSupportInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "Carry the act with you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1324,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Carry the phone to count steps during this reset.",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 49,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Carry the warmth with you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1255,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Carry your phone while you take a few steps.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Center the object in a fresh camera photo.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "chair",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "challenge",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 29,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 30,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Challenge",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 24,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Challenge Complete",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6878,
          "kind": "jsx",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Challenge Mix",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3775,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Challenge verification",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 534,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Change your environment",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 476,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 280,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Changing place interrupts the cue and gives the urge time to settle.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 478,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 282,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Charge the phone outside the bedroom.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1846,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Charge your phone outside the bedroom.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1643,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Check",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3919,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Check a URL and review permission health.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 23,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Check actual browsing",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 116,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        },
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 56,
          "kind": "attribute",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Check actual browsing before relying on protection. You can change settings anytime from Protect.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 34,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Check configuration",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 36,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 56,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Check device support",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 37,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Check native permissions, feed readiness and local URL classification.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 36,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Check permissions and a URL",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 109,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Check settings again",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2679,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        },
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 114,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        },
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 115,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Check the fridge for what you have.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2017,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Check your connection and try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1505,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Check your email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 291,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Check your email for the FREED account link.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4421,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Check your store for renewal and cancellation details.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7070,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "check-in",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 333,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "main"
    },
    {
      "source": "Check-in and journal",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 45,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Checking access. Connect your account and retry when ready.",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "jsx",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Checking available resets…",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6862,
          "kind": "jsx",
          "surface": "ChallengeScreen"
        },
        {
          "file": "src/components/ResetChoicePicker.tsx",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "ResetChoicePicker"
        }
      ],
      "category": "main"
    },
    {
      "source": "Checking configuration…",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 52,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Checking email verification",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Checking membership",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 75,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Checking secure checkout…",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 61,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Checking settings…",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 114,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Checking verification…",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Checking your device settings. Setup continues when the permission is approved.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2527,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a calming audio track you already have.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2073,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Choose a circle, square or triangle.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a clear, safe place to walk.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a comfortable movement you can do safely.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 12,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a comfortable shower temperature.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a daily limit for the apps you selected.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 24,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Choose a date",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 33,
          "kind": "attribute",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a device reset or an account deletion request. Account deletion requests server removal before device cleanup and sign-out; acceptance means deletion is in progress.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 196,
          "kind": "attribute",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Choose a different reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6909,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a guided recovery activity.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 29,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 29,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a new reset with a supported verification rule.",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 45,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a seated or standing position.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 18,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a short walk, gentle stretch or comfortable movement. Stop whenever you need to.",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 19,
          "kind": "jsx",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a social media boundary for today.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose a stronger password with at least 8 characters.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1503,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Choose a valid Night Guard start and end time.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 776,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Choose access when starting",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 78,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose an existing trusted contact; FREED does not assign a sponsor.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2144,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Choose apps",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3720,
          "kind": "attribute",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 23,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 30,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Choose apps and a daily limit; complete required permission steps.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose at least one app to protect. Returning to app selection now; FREED will sync and continue setup when you return.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2051,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose at least one app. We'll save your selection and check protection.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 30,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Choose built-in guidance or consented cloud chat if available.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2093,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Choose distracting apps and when to pause them. Website filtering is optional.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose individual applications in Apple's native picker for app guards. FREED receives selection counts and keeps opaque tokens on this device. Categories and domains remain independent legacy scope.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3731,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose individual applications in Apple’s picker. Categories and domains remain available to older policies but cannot enable this app guard.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 63,
          "kind": "copy-property",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Choose language, theme and accessibility preferences.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 59,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 59,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose one detail that you had not noticed before.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose one guided activity, or use a basic tool now.",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 32,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose one next step that feels manageable.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2095,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Choose one small action that supports it.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 482,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 286,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Choose one small action: notice something nearby, move gently, or contact someone you trust.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 546,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose one trusted person.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 497,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 301,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Choose reminder timing and permission.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 55,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 55,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose something you enjoy and can comfortably eat.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1457,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Choose the apps and schedules you want FREED to protect. Native authorization stays in protection setup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3705,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose the apps FREED can interrupt.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1072,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose the boundary you want to keep today.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 11,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose up to two practices for your day. You can still use every tool.",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose water at a comfortable temperature, if you want.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1357,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1610,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Choose what fits you. You can go back and change an answer.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 987,
          "kind": "jsx",
          "surface": "QuizScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose what to protect",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 23,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 30,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Choose what you need. Status reflects this device and your current account.",
      "occurrences": [
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 13,
          "kind": "attribute",
          "surface": "FeatureDirectory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose your billing",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 178,
          "kind": "jsx",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Choose your practices",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 66,
          "kind": "jsx",
          "surface": "MomentumToday"
        },
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "literal-candidate",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Choose your protection targets.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1072,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Circle the most repeated trigger.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 737,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "CLARA",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 26,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 28,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 28,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "CLARA is thinking...",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6042,
          "kind": "jsx",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "CLARA offers automated guidance, not therapy.",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 172,
          "kind": "jsx",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "CLARA: up to 20 remote replies per day",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 45,
          "kind": "literal-candidate",
          "surface": "benefits"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Clarity",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2909,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Clear your phone notifications.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1595,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "clock",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Close",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "attribute",
          "surface": "MomentumToday"
        },
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 52,
          "kind": "attribute",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Close and return",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6492,
          "kind": "attribute",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Close breathing exercise",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 20,
          "kind": "attribute",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Close Premium offer and continue with Free",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 150,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Close setup",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 99,
          "kind": "attribute",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Close the app and breathe.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1153,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Close the app the second the timer rings.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1981,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Close your eyes and scan toes to head.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 819,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Close your eyes wherever you are.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1959,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Cloud backup is unavailable. Your recovery data stays on this device.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 39,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud chat",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 23,
          "kind": "jsx",
          "surface": "ClaraCloudControls"
        },
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 24,
          "kind": "attribute",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud chat consent",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7111,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud chat has reached its testing allowance. Built-in guidance remains available.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 12,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud chat is off while this account is being deleted.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud chat is unavailable. Built-in guidance remains available.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 10,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud replies left today: {{remaining}} of {{limit}}",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud reply received",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 9,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cloud-chat operation changed.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1028,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "coach",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 28,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Coherent breathing",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 456,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "cold",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cold face dunk",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1600,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "cold shower",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1657,
          "kind": "literal-candidate",
          "surface": "LEGACY_ID_BY_PREFIX"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Cold shower",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 403,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 15,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Come back after five minutes.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 138,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Comfortable breathing",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 28,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Comfortable breathing pause",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 565,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Comfortable water pause",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1348,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1601,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "commitment",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Compare side by side.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 997,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Compare to one from a month ago.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2057,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Compassion letter",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 758,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Complete Email Link",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4640,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Complete one honest check-in, then choose one small action for the next hour.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 508,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_ACTIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 316,
          "kind": "literal-candidate",
          "surface": "RETENTION_ACTION_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Complete the protection goal you selected. Website and app protection work independently.",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Completed reset could not be saved. Your completion receipt is kept for retry.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8389,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Completed resets",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 47,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Completion and helpfulness are your recorded experience.",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 47,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Compliment a stranger genuinely",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1242,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Compliment three people",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 897,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Confidence & energy",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 549,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configuration check needs attention: local adult-domain block and normal-site allow checks both failed.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1860,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configuration check needs attention: the local adult-domain check did not block.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1862,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configuration check needs attention: the normal-site allow check did not pass.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1864,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configuration check passed. Native permission, feed and local classification checks are ready. This does not verify real browser or network blocking.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1866,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configuration not saved",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 69,
          "kind": "literal-candidate",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configuration ready",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 34,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 56,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Configuration saved",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 69,
          "kind": "literal-candidate",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configured · check sync in settings",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 68,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configured · review permission",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 67,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Configured app blocking is off.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 713,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Configured app blocking is ready for {{count}} app.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 715,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Configured app blocking is ready for {{count}} apps.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 715,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Configured app limit reached.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 315,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 655,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1518,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Configured app packages can be interrupted by Accessibility and UsageStats when the user opts in.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 132,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Configured app schedule is active.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 314,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 654,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Configured time windows for supported distracting Android packages.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 27,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Confirm",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 33,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 434,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Confirm Account & Data Deletion",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4839,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Confirm account deletion",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Confirm Apple sign-in to finish deleting your account.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 150,
          "kind": "literal-candidate",
          "surface": "revokeAppleAuthorizationForDeletion"
        }
      ],
      "category": "account"
    },
    {
      "source": "Confirm Delete",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4850,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Confirm password",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 349,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 350,
          "kind": "attribute",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 105,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Confirm the account connected to FREED before deleting it. Cancelling keeps your account and purchases connected.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Confirm the connection action when you return.",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 52,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Confirm the current account before deleting hosted data.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1002,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Confirm your selection and daily limit in the picker.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 24,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Confirming purchase",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 83,
          "kind": "literal-candidate",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Confirming purchase…",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 129,
          "kind": "literal-candidate",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Confirming your account",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 110,
          "kind": "attribute",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Confirming your account…",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 110,
          "kind": "jsx",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connect",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4129,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect an account before checkout",
      "occurrences": [
        {
          "file": "src/components/FunctionalPaywallScreen.tsx",
          "line": 30,
          "kind": "literal-candidate",
          "surface": "FunctionalPaywallScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect an account before checkout.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7556,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect an account before deleting hosted account data.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8290,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect an account to make your guest purchases recoverable.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7058,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect an email address before requesting verification.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 757,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connect another sign-in",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 288,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connect Apple, Google or email",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7060,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect Apple, Google or email whenever you are ready.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7058,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect Apple, Google, or email to continue. Your recovery history stays on this device. Encrypted backup is optional.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 292,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connect email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 289,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 290,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 323,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 353,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connect Google, Apple, or email before enabling automatic backup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8181,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect the owning account to verify Premium",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7045,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connect your account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 288,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connected sign-ins and sign out",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7080,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connecting with {{value1}}…",
      "occurrences": [
        {
          "file": "src/lib/social-login-presenter.ts",
          "line": 25,
          "kind": "template-candidate",
          "surface": "presentSocialLogin"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connecting your account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Connecting your account…",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "connection",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connection action",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connection action confirmed",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 52,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connection running · filtering inactive",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3616,
          "kind": "literal-candidate",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Connection, privacy and protection health",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3714,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Consent, privacy and deletion controls",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7109,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Contact",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 154,
          "kind": "copy-property",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Contacting account service",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "contacts",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 57,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 34,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Continue · {{selectedCount}} selected",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1139,
          "kind": "template-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue and verify later",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 358,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Continue anyway",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2625,
          "kind": "attribute",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue preview",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 32,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Continue saved reset",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue to account",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1010,
          "kind": "attribute",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue to setup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1139,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue using recovery tools",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 117,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        },
        {
          "file": "src/components/ProtectionReactivation.tsx",
          "line": 16,
          "kind": "jsx",
          "surface": "ProtectionReactivation"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue with Apple",
      "occurrences": [
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 90,
          "kind": "attribute",
          "surface": "SocialSignInButtons"
        },
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 97,
          "kind": "jsx",
          "surface": "SocialSignInButtons"
        },
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 105,
          "kind": "attribute",
          "surface": "SocialSignInButtons"
        }
      ],
      "category": "account"
    },
    {
      "source": "Continue with Free",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 133,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Continue with limited protection",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 34,
          "kind": "jsx",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue without full protection?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2610,
          "kind": "attribute",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continue: {{title}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1817,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continuing required setup in order: {{title}}.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1982,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Continuing setup: {{title}}.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2365,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cook from start to finish without phone.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1561,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Cook something simple",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1549,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Cool the water only if it feels safe and comfortable for you.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Costs vs. cravings list",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 690,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Counted exhale",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 546,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Covers selected apps; Shorts and Reels cannot be separated within an app.",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 64,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 66,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Cravings behave like waves: they rise, crest, and pass whether or not you act on them.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 18,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Cravings run on dopamine and stress hormones. Movement runs on them too — but it converts them. A brisk ten-minute walk raises dopamine and serotonin through healthy channels, drops cortisol, and reliably reduces cue reactivity, which is the brain's knee-jerk pull toward old habits.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Create",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4528,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Create account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 353,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Create account with email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 323,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Create your account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 289,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Crossbody arm stretch each side.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 252,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "cup",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Current",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3002,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Current step {{value1}} of 3: {{value2}}.",
      "occurrences": [
        {
          "file": "src/components/RecoveryPath.tsx",
          "line": 64,
          "kind": "literal-candidate",
          "surface": "RecoveryPath"
        }
      ],
      "category": "main"
    },
    {
      "source": "Custom",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 25,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Custom challenges are part of Premium and are stored locally as your own recovery actions.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4068,
          "kind": "jsx",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Custom reset",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 30,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 30,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Custom Reset Builder",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4053,
          "kind": "literal-candidate",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "d streak ·",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5041,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily check-in",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 66,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily Check-In",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6136,
          "kind": "literal-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily concern",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 999,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily foreground-time limit per selected Android package.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 28,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily limit",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3754,
          "kind": "attribute",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/lib/app-guard.ts",
          "line": 8,
          "kind": "copy-property",
          "surface": "APP_GUARD_MODES"
        },
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 110,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily limit ·",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3707,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily plan",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 5,
          "kind": "literal-candidate",
          "surface": "module"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 36,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 38,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 38,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "FeatureDirectory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily pledge recorded",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 46,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily practice",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1006,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily Recovery Plan",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4290,
          "kind": "attribute",
          "surface": "RetentionPlanCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily selected-target threshold event for chosen Screen Time tokens.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 28,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily threshold event for selected individual iOS applications.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 28,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Daily-limit registration readback did not match selected targets and threshold.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1790,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "dark",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 59,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "data",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 56,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 58,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Data deletion",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 194,
          "kind": "attribute",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Data deletion and privacy requests can be sent to {{SUPPORT_EMAIL}}. Public pages: {{PRIVACY_URL}}, {{SUPPORT_URL}}, and {{ACCOUNT_DELETION_URL}}.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 133,
          "kind": "template-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Data FREED uses on device",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 96,
          "kind": "copy-property",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "days, and this note remains private on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6332,
          "kind": "jsx",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Decide if a 10-minute escape is worth it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 703,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Decide if that's the trade you want.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1015,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Decrease {{label}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3496,
          "kind": "template-candidate",
          "surface": "SettingStepper"
        }
      ],
      "category": "main"
    },
    {
      "source": "Decrease Daily limit",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 110,
          "kind": "attribute",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Deep CLARA coach session",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2082,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Deep focus mode",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3835,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Deep Inhale",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 31,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Deep relationships",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 549,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Deeper reports and estimated forecasts",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 43,
          "kind": "literal-candidate",
          "surface": "benefits"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Default allow, precise block",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3855,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "delete",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 58,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Delete Account & Data",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4839,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4840,
          "kind": "attribute",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Delete Account & Data requests removal of your signed-in Firebase account and hosted data before this device is cleared. Delete Local Data affects only this device. System permissions remain controlled by iOS or Android Settings.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4812,
          "kind": "jsx",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Delete guest account and data",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 102,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Delete local app data",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 204,
          "kind": "copy-property",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Delete Local Data",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4850,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4853,
          "kind": "attribute",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Delete or hide one app you don't love.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1594,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Delete Remote Backup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4735,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Deleting local data does not automatically cancel App Store or Google Play subscriptions. Manage subscription cancellation in the store account that purchased premium.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 208,
          "kind": "literal-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Derived from your streak, self-reported sleep and urges, and challenge outcomes. These are estimates, not clinical measurements.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3329,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Describe one specific future scene.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1063,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Describe the life you are building.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 632,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Describe the morning routine.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 718,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Describe the relationships.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 719,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Detect openings of selected apps to apply your whole-app guards. You choose whether to open FREED recovery. Native Shorts and Reels inspection is experimental and outside the public release.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 2,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "Detects supported browser address fields, selected app launches, and sustained short-form loops for challenge handoff.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 269,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Development preview · {{value1}}",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 51,
          "kind": "template-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Device mode: {{mode}} · {{value2}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3736,
          "kind": "template-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Device mode: {{mode}}. Configured: {{value2}}. Authorized: {{value3}}. Ready: {{value4}}. Device blocking: not tested.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 107,
          "kind": "template-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Device movement observed",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 48,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Device permissions activate supported protection. Your recovery tools remain available before setup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1008,
          "kind": "jsx",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Device protection is available in the Android and iPhone apps.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 32,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Device status could not refresh. Check settings again before relying on protection.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 39,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "DeviceActivity registration readback did not match the requested window.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1660,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "DeviceActivity scheduling is unavailable in this build.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 812,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "DeviceActivity threshold events",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 173,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Diagnostics",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 23,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Did this help?",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 18,
          "kind": "jsx",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Dim the lights in your room.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1845,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Direct Safari extension settings are unavailable on this iOS version.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1172,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Discard this guided reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7015,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Discipline",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2908,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "DISCIPLINE RULES",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3744,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS & health",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS filters whole domains. It cannot separate YouTube Shorts from other YouTube pages or filter mixed content inside apps.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 102,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard blocks supported adult domains. It does not inspect every page or content inside apps.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 101,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard can block supported adult website lookups.",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 61,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard could not finish starting on its own. Tap Continue to run it again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2459,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard did not start automatically after returning to FREED. Tap Continue to start it again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2190,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard did not start automatically. Tap Continue to start it again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2210,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard health",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3587,
          "kind": "literal-candidate",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard is inactive because strict Private DNS is enabled. FREED preserves encrypted DNS; local recovery and enabled app shields remain available.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedDnsGuardPolicy.kt",
          "line": 54,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "DNS Guard is inactive because this network uses encrypted Private DNS. FREED preserves it; local recovery and enabled app shields remain available.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedDnsGuardPolicy.kt",
          "line": 55,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "DNS Guard is inactive because this network's DNS privacy state could not be verified. Reconnect and retry; local recovery and enabled app shields remain available.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedDnsGuardPolicy.kt",
          "line": 56,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "DNS Guard is now active.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2237,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 2264,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard is running, but adult-domain filtering is paused for network sign-in. Finish sign-in, then test protection again.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1697,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "DNS Guard permission",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 119,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS Guard settings",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 108,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "DNS-only VPN permission",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 228,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Do not send passwords, private recovery notes, raw receipts, purchase tokens, screenshots containing sensitive content, or full browsing history.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 158,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Do that thing for 5 minutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1100,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Domain exceptions",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 107,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Don't edit, just send it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1186,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Don't fish for response.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1323,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Done",
      "occurrences": [
        {
          "file": "src/components/NativeTimeInput.tsx",
          "line": 16,
          "kind": "jsx",
          "surface": "NativeTimeInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "Doomscroll app limits",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 275,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Double-inhale breath",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 474,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Down dog, walk feet up, rise to stand.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 308,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Download Backup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4709,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Draft restored. Your history changes when you save.",
      "occurrences": [
        {
          "file": "src/hooks/use-recovery-draft.ts",
          "line": 89,
          "kind": "literal-candidate",
          "surface": "useRecoveryDraft"
        }
      ],
      "category": "main"
    },
    {
      "source": "Draw 3 columns: morning, afternoon, night.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1080,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Draw two columns: Cost / Reward.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 700,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Dream journal entry",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1053,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drink a glass of cool water slowly.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 487,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 291,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Drink full glass of water",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1330,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drink it slowly, fully present.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1341,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drink water alongside.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1459,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drive one knee toward your chest.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 177,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drive through the front heel to stand.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 379,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drive up through the floor and repeat.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 107,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drop chest, push back up, jump feet to hands.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 124,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drop one supportive reply.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 927,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Drop to the floor in pushup position.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 86,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "During protection setup, Apple’s picker lets you choose the actual apps, categories and websites. FREED will check the authorization and selected targets before showing protection as active.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1130,
          "kind": "jsx",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Each selected package uses its daily foreground duration.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 31,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "early friction",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 520,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_TAGS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 335,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Earned unlock cleared. FREED protection is active again.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1028,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Earned unlock cleared. FREED shields are active again.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 719,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Earned unlock expired. FREED is relocking the selected app.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 244,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 863,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Earned unlock request is expired or invalid. Existing Screen Time protection remains in effect.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 619,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Earned unlock request was rejected. Current protection and valid unlocks stay unchanged.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 961,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 997,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Earned unlock source is not a supported app. FREED kept app shields active and adult-domain filtering protected.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 976,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Earned unlock window is active. Adult-domain filtering stays protected.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 996,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Earned unlocks and challenge intensity are saved on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3747,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Eat a real snack",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1446,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Eat slowly, no screen.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1458,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Edit selected applications and guard mode",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 105,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Editing {{date}}",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 30,
          "kind": "literal-candidate",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Effective date: October 5, 2026",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 87,
          "kind": "attribute",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "email",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 336,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Email address",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4999,
          "kind": "literal-candidate",
          "surface": "AccountabilitySettingsCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 5110,
          "kind": "literal-candidate",
          "surface": "AccountabilitySettingsCard"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 337,
          "kind": "attribute",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Email deletion request",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 198,
          "kind": "copy-property",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Email Link",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4619,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Email privacy support",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 91,
          "kind": "copy-property",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Email support",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 148,
          "kind": "copy-property",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Email-link sign-in is disabled until the signed app-link association is deployed and physically verified.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4394,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4414,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4651,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Embedded adult-domain fallback is loaded; production activation is waiting for a reviewed remote feed version.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1848,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Emergency strict mode",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3829,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Empty 10 lines of inbox.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1596,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Enable app protection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 29,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Enable automatic backup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4564,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Enable cloud chat",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 30,
          "kind": "jsx",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Enable cloud chat? Messages you send are processed by Google through FREED. Browsing activity, journal entries, photos and Screen Time data are not attached. Processing may happen outside your country. Google applies its service processing and retention terms.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 27,
          "kind": "jsx",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Enable for the next 7 days.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1642,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Enable FREED Accessibility protection before starting calibration.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 134,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Enable FREED Protection in Android Accessibility settings.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1707,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Enable FREED Protection in Android Accessibility settings.{{privateDnsNote}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1707,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Enable FREED Safari Blocker to block known adult websites in Safari.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 25,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Enable Sharing",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3286,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Enabled in system settings",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 70,
          "kind": "literal-candidate",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Encrypted Backup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4467,
          "kind": "attribute",
          "surface": "RecoveryBackupCard"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 56,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 56,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Encrypted backup, consent and deletion",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7088,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "end my life",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 496,
          "kind": "literal-candidate",
          "surface": "isCrisisSupportInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "End with a slow walk back home.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 344,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Energized",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6127,
          "kind": "literal-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Energy",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2910,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Enter a URL or search URL",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3903,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Enter a valid account email address.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 794,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Enter a valid domain, like example.com.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2741,
          "kind": "literal-candidate",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Enter a valid email address.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 723,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 742,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1502,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Enter the email address used for the link.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 814,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Enter the email and password for your FREED account.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 294,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Enter your backup passphrase to enable automatic backup on this device.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Evening reflection",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4227,
          "kind": "literal-candidate",
          "surface": "ReminderSettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "exercise",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 26,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 36,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exercise",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3799,
          "kind": "attribute",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 8503,
          "kind": "copy-property",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 36,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 12,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exercise & movement",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 565,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exercise changes the brain chemistry that cravings hijack — quickly, and on your side.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 44,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Exercise could not be saved. Your choice is still here. Try again.",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 21,
          "kind": "jsx",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exercise recorded for today.",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 20,
          "kind": "jsx",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exhale",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 28,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        },
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 29,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        },
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 30,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exhale as you push.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 116,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exhale for 4 counts.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 450,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Exhale for eight.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 127,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Exhale gently and feel the belly fall.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 522,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Exhale gently with an optional quiet sound.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 540,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Exhale slowly and fully through the mouth.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 486,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Exhale slowly for 6 counts.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 557,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Exhale through nose for 5 counts.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 468,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Exhale through the nose for 5 seconds.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 594,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Explore recovery tools",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "EXPO_PUBLIC_FIREBASE_AUTH_CONTINUE_URL must equal {{FIREBASE_EMAIL_LINK_CALLBACK_URL}}",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 629,
          "kind": "template-candidate",
          "surface": "getFirebaseEmailLinkReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "EXPO_PUBLIC_FIREBASE_ENV must be either production or staging",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 589,
          "kind": "literal-candidate",
          "surface": "getFirebaseClientReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "export",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 56,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Export, restore and configure optional encrypted sync.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 56,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 56,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Export, restore and optional encrypted sync",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7108,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Faith, values & self-respect",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 549,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "family",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 57,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Family Controls entitlement or ManagedSettings capability is missing from this iOS build.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 107,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Family Plan",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5181,
          "kind": "literal-candidate",
          "surface": "membershipPlanLabels"
        }
      ],
      "category": "main"
    },
    {
      "source": "Family Support Circle",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5069,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "FamilyActivityPicker requires iOS 16+ and the FamilyControls framework.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 985,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FamilyControls and ManagedSettings",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 134,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FamilyControls authorization error: {{error}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 564,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FamilyControls requires iOS 16+ and the Apple entitlement.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 574,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Fill in the blank honestly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1132,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Fill in the blank truthfully.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1288,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Filtering active",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3616,
          "kind": "literal-candidate",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Filtering happens through Screen Time settings; raw URLs are not stored by FREED.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 150,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Filtering is paused because this network needs a sign-in. It resumes automatically once the network is reachable.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3591,
          "kind": "jsx",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Filtering paused for this network's sign-in page. Normal browsing stays direct.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 8,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 626,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Find a {{targetId}}",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "template-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a {{targetId}} nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "template-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a branch",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a branch nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a chair",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a chair nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a clock",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a clock nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a cup",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a cup nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a familiar shape",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a flower",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a flower nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a fruit",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a fruit nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a houseplant or tree outside.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1576,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Find a person, pet, or trusted friend nearby.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 890,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Find a plant",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a plant nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a quiet minute",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 14,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a quiet moment and open your private Journal.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a shoe",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a shoe nearby.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find a sturdy table edge or low bar.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 359,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Find a window or doorway.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1997,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Find something",
      "occurrences": [
        {
          "file": "src/components/ResetChoicePicker.tsx",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "ResetChoicePicker"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find the nearest staircase.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 286,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Find where it sits in your body.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 182,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Find your pet or a friend's.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1269,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Finish account deletion confirmation before signing out.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8190,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Finish required protection setup before entering FREED on this device. Adult blocking and app interruptions need the required native permissions first.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2424,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Finish verification and try saving the reset again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6835,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Finish with a butterfly stretch.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 243,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Finish your chosen protection",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Finish: 'I exist to ___.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2164,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Firebase {{provider}} linking could not be completed.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 858,
          "kind": "template-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase {{provider}} sign-in could not be completed.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 841,
          "kind": "template-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase account deletion was not accepted.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8280,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Firebase account service is not configured.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 215,
          "kind": "literal-candidate",
          "surface": "journeyAuthObserver"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase Auth session persistence is native. The client must not create Firestore documents, upload local recovery content, or bundle Firebase Admin credentials. Messaging registration contains only installation and FCM token identifiers.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 611,
          "kind": "literal-candidate",
          "surface": "getFirebaseClientReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase checkout is unavailable in this build.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 90,
          "kind": "literal-candidate",
          "surface": "ensureFirebaseGuestSession"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase client event ID prefix is invalid.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 894,
          "kind": "literal-candidate",
          "surface": "createFirebaseClientEventId"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase did not return a user identity.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1470,
          "kind": "copy-property",
          "surface": "authenticatedResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase email link could not be completed.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 824,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase email link could not be sent.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 807,
          "kind": "copy-property",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase email links must return to the FREED auth callback.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 795,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase email-link sign-in is only enabled for the production Firebase environment",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 627,
          "kind": "literal-candidate",
          "surface": "getFirebaseEmailLinkReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase email-link sign-in is unavailable until Hosting app-link association is deployed and verified.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 539,
          "kind": "literal-candidate",
          "surface": "EMAIL_LINK_ASSOCIATION_UNCONFIGURED_REASON"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase has not acknowledged this aggregate snapshot schema and revision.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 972,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase is not configured.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 396,
          "kind": "literal-candidate",
          "surface": "initializeFirebaseClient"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase native modules require an iOS or Android custom build.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 399,
          "kind": "copy-property",
          "surface": "initializeFirebaseClient"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase native startup could not complete.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 436,
          "kind": "copy-property",
          "surface": "initializeFirebaseClient"
        }
      ],
      "category": "account"
    },
    {
      "source": "Firebase staging project {{STAGING_PROJECT_ID}} is not provisioned (Google project-quota blocker). Do not use production credentials for staging.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 593,
          "kind": "template-candidate",
          "surface": "getFirebaseClientReadiness"
        }
      ],
      "category": "account"
    },
    {
      "source": "Fix adult website protection",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Fix app protection",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Floss if available.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1475,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "flower",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Focus Shield calibration is not running.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 92,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 186,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield calibration needs a valid local rule ID and Android package.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 127,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield calibration was cancelled.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 157,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield calibration was cancelled. No selector was stored.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 430,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield earned unlock is active only for the matching surface rule. Package limits and adult-domain protection stay active.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 929,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield kept protection active because the surface unlock scope or expiry was invalid.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 931,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield matched a configured surface rule.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1596,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield native capabilities are unavailable in this preview build. Test calibration and rule enforcement in a signed Android or iOS device build.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 131,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield permission was revoked. Re-enable FREED Protection in Accessibility settings.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 77,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield rejected an invalid or unsupported local rule.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 878,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield rollout status refreshed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 837,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield rule saved locally on this device.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 885,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Focus Shield unavailable",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3880,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Fold forward and let your head hang.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 231,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Follow a comfortable pace without holding your breath.",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 28,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Follow a comfortable pace.",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        },
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Follow four equal phases: breathe in, hold, breathe out, then hold.",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 30,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Follow their next-step recommendation.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2147,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "for a calm hour",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2192,
          "kind": "literal-candidate",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "for a fresh morning",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2211,
          "kind": "copy-property",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "for a rising urge",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2187,
          "kind": "literal-candidate",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "For adults 18+. Account required. Basic help included.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 954,
          "kind": "literal-candidate",
          "surface": "WelcomeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "for late-night moments",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2188,
          "kind": "literal-candidate",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "For restore issues, include the platform and product ID if visible: freed_premium_yearly or freed_premium_monthly. Never send raw purchase tokens or full receipts by email.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 175,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "for the afternoon dip",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2212,
          "kind": "copy-property",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "for the evening wind-down",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2213,
          "kind": "copy-property",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "forecast",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 51,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Foreground activity, accelerometer, and step samples are used for challenge completion only; FREED does not run background fitness monitoring or sync Health Connect history.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 513,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Foreground distance is checked without saving route history.",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 50,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Foreground location",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 480,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 519,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Foreground motion and pedometer samples are used for challenge completion only; FREED does not sync HealthKit history or run background fitness monitoring.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 474,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Forgive yourself out loud",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1276,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Forgot password?",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 351,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 105,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Free basic movement",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 28,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Free the VPN connection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 47,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Free users may see rewarded ads before some recovery challenges. FREED does not include Android Advertising ID permission in the release manifest, and ad requests must use non-personalized request options where supported.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 122,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 354,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "src/components/BrandLogo.tsx",
          "line": 8,
          "kind": "attribute",
          "surface": "BrandLogo"
        },
        {
          "file": "src/components/BrandLogo.tsx",
          "line": 10,
          "kind": "jsx",
          "surface": "BrandLogo"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED Accessibility protection is enabled for supported browsers, focused WebView fields, and opted-in app timers.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1693,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED Accessibility protection is enabled for supported browsers, focused WebView fields, and opted-in app timers.{{privateDnsNote}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1693,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED Account Deletion",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 195,
          "kind": "attribute",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED account deletion request",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 198,
          "kind": "literal-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED app settings could not open.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2876,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED app settings opened. Find Safari > Extensions in Settings, enable {{extensionName}}, then return to continue setup.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1002,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED applies Apple's adult-content filter on this iPhone.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 22,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED blocked an explicit site before the page loaded.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6601,
          "kind": "literal-candidate",
          "surface": "interventionBodyForAttempt"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED blocks adult domains and adult search intent. Normal web stays open; Android app shields are opt-in.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3858,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED cannot finish \"{{value1}}\" on this device right now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2612,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED cannot silently grant Accessibility, Usage Access, VPN, Screen Time, or Safari content-blocker authority. The app should redirect to the required operating-system surface and resume setup after the user returns.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 167,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED caught an explicit search before it could turn into a scroll loop.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6598,
          "kind": "literal-candidate",
          "surface": "interventionBodyForAttempt"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED companion",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 34,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedNativeCompanion.kt",
          "line": 23,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED content-blocker rules were not found.",
      "occurrences": [
        {
          "file": "src/i18n/native-ios-content-blocker-catalog.json",
          "line": 2,
          "kind": "native-resource",
          "surface": "native-ios-resource"
        },
        {
          "file": "ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift",
          "line": 48,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED could not confirm complete protection cleanup. Local deletion must wait; retry the reset.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 661,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED could not load content-blocker rules.",
      "occurrences": [
        {
          "file": "src/i18n/native-ios-content-blocker-catalog.json",
          "line": 3,
          "kind": "native-resource",
          "surface": "native-ios-resource"
        },
        {
          "file": "ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift",
          "line": 57,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED could not verify this network’s DNS settings. Web filtering is inactive. Refresh the check or try another network.",
      "occurrences": [
        {
          "file": "src/lib/dns-guard-health.ts",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "dnsGuardCoverageMessage"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 6,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 156,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 597,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 633,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard is filtering DNS-level adult domains with resolver failover.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1699,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard is filtering DNS-level adult domains with resolver failover.{{privateDnsNote}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1699,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard is running with DNS-only adult-domain filtering.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 614,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard is user-enabled and eligible to restore after reboot or app update, but it is not currently running.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1703,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard is user-enabled and eligible to restore after reboot or app update, but it is not currently running.{{privateDnsNote}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1703,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard stopped.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 644,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard was user-enabled, but Android VPN permission must be reviewed before it can restart.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1705,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED DNS Guard was user-enabled, but Android VPN permission must be reviewed before it can restart.{{privateDnsNote}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1705,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED filters website addresses on your phone using Android's local VPN connection.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 27,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED help desk",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 144,
          "kind": "attribute",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED interception is disabled. Device permission settings are unchanged.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 199,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED is a recovery and digital self-control app for blocking explicit adult-domain access, interrupting selected app loops, and guiding users into recovery challenges.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 89,
          "kind": "attribute",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED keeps a limited-protection banner on Home until the configuration check passes. You can reopen setup from that banner at any time.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2617,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED observes phone movement during this activity. It does not count or verify exercise repetitions.",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 48,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED opens",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3233,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED paused a selected app",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 12,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED paused a selected app or short-form loop so you can take one recovery action before continuing.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6595,
          "kind": "literal-candidate",
          "surface": "interventionBodyForAttempt"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED paused this high-risk moment so you can take one recovery action now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6603,
          "kind": "literal-candidate",
          "surface": "interventionBodyForAttempt"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED Premium",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 162,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "FREED Privacy Policy",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 88,
          "kind": "attribute",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED privacy request",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 91,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED Protection",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 5,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED PROTECTION",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 20,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedInterventionActivity.kt",
          "line": 109,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED protection configuration and temporary access were cleared. Device permission settings are unchanged.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 660,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED protection configuration could not be enabled. Retry activation.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 676,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED protection configuration is enabled. Device permission settings are unchanged.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 675,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED protection notice",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 11,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED protection was reset while blocking rules were being prepared.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2428,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED protection was reset while blocking rules were being saved.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2448,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED protection was reset. Activate protection before syncing blocking rules.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 512,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 753,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 850,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2399,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED reads aggregate foreground duration for selected packages only, not in-app content or screen text.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 259,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED reads only Android's Private DNS mode/specifier setting for diagnostics; it does not read DNS history or change DNS settings silently.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 300,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED recovery interventions",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 10,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1505,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1560,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1651,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 1074,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 1100,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED recovery ready",
      "occurrences": [
        {
          "file": "src/i18n/native-ios-notification-catalog.json",
          "line": 2,
          "kind": "native-resource",
          "surface": "native-ios-resource"
        },
        {
          "file": "ios/FREEDShieldAction/ShieldActionExtension.swift",
          "line": 171,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED requests sensitive permissions only when needed: VPN/DNS Guard, Accessibility, and Usage Access on Android; Family Controls, DeviceActivity, ManagedSettings, and Safari Content Blocker on iOS; and camera, motion/activity, foreground location, or notifications only for matching challenges or reminders.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 124,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED screens need the shared application controller.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7157,
          "kind": "literal-candidate",
          "surface": "useFreedAppController"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED stores protection setup status, selected Android app package IDs or opaque iOS Screen Time tokens, adult-domain feed version and checksum, challenge history, streak state, settings, reminders, and premium entitlement state on the device.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 99,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED stores supported package IDs and usage duration, not in-app content.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 289,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED support",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4766,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED Support",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 145,
          "kind": "attribute",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED support request",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 148,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED tracks your recorded actions. It cannot measure dopamine or predict how your brain changes.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 550,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED turns this into the urge-risk forecast and your progress screen: when your logged slips cluster at 11pm on stressful days, the app can warn you before that window opens instead of judging you after it closes.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 61,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "FREED Usage Access",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 3,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED USAGE ACCESS",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 25,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt",
          "line": 55,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED uses Android's VPN permission for DNS filtering. DNS questions are classified on your device and resolved by the configured adult-content filtering provider. FREED does not inspect HTTPS content or proxy normal traffic. A competing VPN or Private DNS setting can affect coverage.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 119,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "FREED uses Usage Access only to read aggregate foreground time for selected app packages so your app timers can trigger recovery challenges. It does not read screen contents, messages, keystrokes, browsing history, or raw usage events.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 4,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 239,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 363,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1457,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt",
          "line": 72,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "FREED's backend does not persist chat prompts or full provider results. It keeps account-linked quota and request deduplication metadata. Deduplication records have a configured 7-day expiry; physical deletion may occur later. These controls do not set Google's content retention.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 114,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "FREED's breathing exercise and challenges exist precisely to fill those minutes. Each urge you surf weakens the circuit that produced it. Each one you act on trains the opposite. The wave always passes; the question is only what it leaves behind.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "FREED's DNS Guard uses Android's local VPN slot to route DNS resolver traffic (1.1.1.1 / 1.0.0.1) through a filter on your device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2551,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Front knee tracks over the ankle.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 378,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "fruit",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Future self interview",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 792,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Gentle",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3782,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Gentle (4-6)",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 67,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Gently move the device if comfortable.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 414,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1811,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2129,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 160,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Gently move your shoulders or hands within a comfortable range.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 17,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Gently rinse your hands or face; no immersion or breath hold.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1357,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1610,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Get started",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 952,
          "kind": "literal-candidate",
          "surface": "WelcomeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Give me one two-minute clean reset action.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5958,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Go back",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 970,
          "kind": "attribute",
          "surface": "QuizScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 1055,
          "kind": "attribute",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Go Back",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6400,
          "kind": "attribute",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Go Pro — guided resets without ads",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Goal alignment check",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1019,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "goals",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3930,
          "kind": "attribute",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google confirmation cancelled. Your account is still here.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 77,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Google could not confirm this account. Choose the Google account already connected to FREED.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 86,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Google Play access-token request",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 279,
          "kind": "literal-candidate",
          "surface": "createGooglePlayAccessToken"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play access-token request failed.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 448,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play access-token response",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 282,
          "kind": "literal-candidate",
          "surface": "createGooglePlayAccessToken"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play account",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 284,
          "kind": "literal-candidate",
          "surface": "getSubscriptionTermsDisclosure"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Google Play package name does not match FREED configuration.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 457,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play product is not purchased.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 502,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play purchase response",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 486,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play purchase verification",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 479,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play Store > Payments & subscriptions > Subscriptions",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 287,
          "kind": "literal-candidate",
          "surface": "getSubscriptionTermsDisclosure"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Google Play subscription is not active.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 496,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play verification credentials are not configured.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 454,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play verification failed.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 482,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play verification returned {{status}}.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 484,
          "kind": "template-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google Play verification returned malformed JSON.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 487,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Google processing and retention follow the applicable service terms and configuration. FREED does not promise a fixed Google retention period or zero retention. Turning cloud chat off stops future messages; a request already sent may finish. Built-in guidance remains available.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 113,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Google sign-in is unavailable in this build. You can continue with local progress and try again after updating FREED.",
      "occurrences": [
        {
          "file": "src/lib/social-login-presenter.ts",
          "line": 29,
          "kind": "literal-candidate",
          "surface": "presentSocialLogin"
        },
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 80,
          "kind": "literal-candidate",
          "surface": "SocialSignInButtons"
        }
      ],
      "category": "account"
    },
    {
      "source": "Grab keys and step outside.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 213,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Grab the bin liner.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1439,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Gratitude list",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 655,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Group sponsor message",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1293,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Guard",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4325,
          "kind": "jsx",
          "surface": "RetentionPlanCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Guard mode rejected",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 81,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "guard time",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 520,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_TAGS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 330,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Guest account signed out. Choose the sign-in for your existing account. Your recovery history stays on this device.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 189,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Guest account signed out. Enter your existing account email and password. Your recovery history stays on this device.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 189,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Guide me through 3 slow grounding breaths.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5956,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Guided progress could not be erased. Try again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8247,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Guided reset",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 24,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 29,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 29,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "HALT check",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5960,
          "kind": "copy-property",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hamstring + shoulder release",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 247,
          "kind": "copy-property",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Haptic cues",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 40,
          "kind": "jsx",
          "surface": "MomentumBreathingView"
        },
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 40,
          "kind": "attribute",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Help me evaluate if I am Hungry, Angry, Lonely, or Tired right now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5960,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Help me understand this urge and choose a useful next action.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5957,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Help now",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        },
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 64,
          "kind": "jsx",
          "surface": "MomentumToday"
        },
        {
          "file": "src/components/UrgeSupportButton.tsx",
          "line": 8,
          "kind": "jsx",
          "surface": "UrgeSupportButton"
        }
      ],
      "category": "main"
    },
    {
      "source": "Help now: open urge support",
      "occurrences": [
        {
          "file": "src/components/UrgeSupportButton.tsx",
          "line": 8,
          "kind": "attribute",
          "surface": "UrgeSupportButton"
        }
      ],
      "category": "main"
    },
    {
      "source": "Help rate",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3229,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Helpful",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3203,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hi, I am CLARA. Tell me what is happening, and we will pick the next clean action together.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5902,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hide advanced diagnostics",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3890,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hide help",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 63,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hide password",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 344,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 104,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Hide setup help",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 62,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "High",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3794,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3804,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3815,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "High stress & pressure",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 557,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hip opener stretch flow",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 238,
          "kind": "copy-property",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "history",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 44,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hold",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 29,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        },
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 30,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hold a conversational pace.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 343,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Hold Empty",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 30,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hold on — your streak is worth protecting",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 18,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "Hold on. You are still in control.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 21,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedInterventionActivity.kt",
          "line": 117,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Hold one second at the top.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 397,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Hold opposite elbows, sway gently.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 250,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Hold steady, breathe through the nose.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 143,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Hold tall posture for 30 seconds.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1626,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Hold without holding your breath.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 197,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Honor it for the next hour.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1134,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "How long has this cycle been a struggle?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 552,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "How protection works",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 91,
          "kind": "jsx",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "How urges peak and fade",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 15,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Hug someone in your house",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 880,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "hurt myself",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 495,
          "kind": "literal-candidate",
          "surface": "isCrisisSupportInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "I am having an intense urge right now. Guide me through it.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5950,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "I am with you. Choose the next clean action, not the whole future. One breath, one decision, one minute where you act like the person you are becoming.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 561,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "I can't sleep and night urges are loud.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5959,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "I completed exercise today",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 20,
          "kind": "jsx",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "I had a slip. Help me reset without shame and learn from what triggered it.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5953,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "I have an account",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 953,
          "kind": "literal-candidate",
          "surface": "WelcomeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "I reached out",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7009,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "I saw the recent risk moment around {{host}}. FREED protected the streak; now let us protect your mood too. Pick one small reset and come back to the day you wanted.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 558,
          "kind": "template-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "I understand",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2568,
          "kind": "attribute",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "I'm Done",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7017,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "I've verified my email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 358,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Identify the lie",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 985,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Identity is built with evidence. Every completed challenge, every surfed urge, every honest check-in is a vote for the person you are becoming. No single vote decides the election — FREED's streak and progress screens exist to make the accumulating evidence visible.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 35,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Identity notes",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 27,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "If an account uses this email, a password reset link is on its way. Check your inbox and spam folder.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 296,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "If hosted encrypted backup sync is enabled, FREED sends encrypted backup envelopes only. FREED does not receive the user's passphrase.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 115,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Imagine a friend in your shoes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 768,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Imagine a future you 90 days clean.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 802,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "In Profile, choose Delete Account & Data and confirm the signed-in account, including any required recent sign-in or Apple confirmation. FREED requests server-side account and account-linked data deletion before clearing this device and signing out.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 182,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        },
        {
          "file": "src/features/legal-pages.tsx",
          "line": 215,
          "kind": "literal-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "In Profile, choose Delete Local Data and confirm. FREED first asks native protection to stop DNS Guard, risk-window monitoring, blocked app configuration and earned unlock windows. After native acknowledgment, it clears local recovery history, drafts, guided progress and cloud-chat consent, and disables automatic backup. If cleanup fails, follow the retry instructions. This device reset does not delete your account, hosted backups or exported copies. System permissions remain controlled by iOS or Android Settings.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 207,
          "kind": "literal-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Increase {{label}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3501,
          "kind": "template-candidate",
          "surface": "SettingStepper"
        }
      ],
      "category": "main"
    },
    {
      "source": "Increase Daily limit",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 110,
          "kind": "attribute",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Inhale",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 28,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        },
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 29,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        },
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 30,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Inhale arms up, exhale fold forward.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 306,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale deeply through the nose.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 538,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale for 4 counts.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 448,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 556,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale for four.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 127,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Inhale slowly through the left.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 503,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale so only the belly hand rises.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 521,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale through nose for 5 counts.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 467,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale through the nose for 4 counts.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 431,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale through the nose for 5 seconds.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 593,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Inhale through the nose.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 484,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "insight",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 48,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Intensity",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3779,
          "kind": "attribute",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4136,
          "kind": "attribute",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid aggregate analytics day counts.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 964,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid aggregate analytics snapshot.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 958,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid cloud-chat request.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1029,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid ECDSA signature component length.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 171,
          "kind": "literal-candidate",
          "surface": "derEcdsaToJose"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid ECDSA signature length.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 160,
          "kind": "literal-candidate",
          "surface": "derEcdsaToJose"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid ECDSA signature R marker.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 161,
          "kind": "literal-candidate",
          "surface": "derEcdsaToJose"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid ECDSA signature S marker.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 165,
          "kind": "literal-candidate",
          "surface": "derEcdsaToJose"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid ECDSA signature.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 158,
          "kind": "literal-candidate",
          "surface": "derEcdsaToJose"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid Firebase account deletion response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1053,
          "kind": "literal-candidate",
          "surface": "parseFirebaseAccountDeletionResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid Firebase AI callable response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1394,
          "kind": "literal-candidate",
          "surface": "invalidAiResponse"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid Firebase purchase callable response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1445,
          "kind": "literal-candidate",
          "surface": "invalidPurchaseResponse"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid Firebase push registration response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1046,
          "kind": "literal-candidate",
          "surface": "parseFirebasePushRegistrationResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid Google Play package name.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 390,
          "kind": "literal-candidate",
          "surface": "validateRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid journey offer decision.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 915,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid journey offer response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 145,
          "kind": "literal-candidate",
          "surface": "parseJourneyOfferState"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid membership response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 934,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 943,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid purchase identity response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 928,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Invalid review access response.",
      "occurrences": [
        {
          "file": "src/lib/review-access.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "parseReviewAccessSnapshot"
        },
        {
          "file": "src/lib/review-access.ts",
          "line": 18,
          "kind": "literal-candidate",
          "surface": "parseReviewAccessSnapshot"
        }
      ],
      "category": "main"
    },
    {
      "source": "Invalid reviewed adult-domain feed response.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 542,
          "kind": "literal-candidate",
          "surface": "parseFirebaseReviewedAdultDomainFeed"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 548,
          "kind": "literal-candidate",
          "surface": "parseFirebaseReviewedAdultDomainFeed"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 557,
          "kind": "literal-candidate",
          "surface": "parseFirebaseReviewedAdultDomainFeed"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 565,
          "kind": "literal-candidate",
          "surface": "parseFirebaseReviewedAdultDomainFeed"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 568,
          "kind": "literal-candidate",
          "surface": "parseFirebaseReviewedAdultDomainFeed"
        }
      ],
      "category": "account"
    },
    {
      "source": "iOS cannot inspect native-app screens. Focus Shield uses Screen Time selections for apps and the Safari Focus Shield extension for supported short-form routes; Safari Content Blocker remains adult-domain-only.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 125,
          "kind": "copy-property",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "iOS native activation diagnostics need attention.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2671,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "iOS native activation diagnostics passed for Screen Time, ManagedSettings, DeviceActivity, selected targets, and Safari domain rules.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2670,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "iOS native-app limit: FREED cannot inspect native-app screens or calibrate individual in-app surfaces. Use opaque Screen Time app/category tokens instead.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 115,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "iOS reports a selected-target threshold event; it does not report independent per-app duration.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 31,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "iOS settings are unavailable in this build.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1183,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "iOS Simulator cannot enforce this DNS layer. Use a real iPhone with a properly signed build.",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 73,
          "kind": "jsx",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "iOS support covers Family Controls authorization, ManagedSettings web filtering, FamilyActivityPicker target selection, DeviceActivity limits, Safari Content Blocker reload, shield actions, and activation tests.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 166,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "is unavailable",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "It helped",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "RecoveryHistory"
        },
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Journal",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8775,
          "kind": "copy-property",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/features/library-screen.tsx",
          "line": 27,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 27,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 13,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        },
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 29,
          "kind": "attribute",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Journal practice",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Journaling & reflection",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 565,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Journey read accepts no payload.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 910,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Jump back to start.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 160,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Jump feet wide while raising arms overhead.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 159,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Jumping jacks",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 148,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Keep breathing gently without a hold.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 576,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Keep breathing gently; skip holds or counting, or choose another reset.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 433,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 451,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 469,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 487,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 505,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 523,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 541,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 559,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 578,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 596,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 127,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Keep built-in guidance",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 31,
          "kind": "jsx",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Keep current history",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 9013,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Keep Going {{pct}}%",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7017,
          "kind": "template-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Keep guest account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 329,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Keep it tiny — small wins compound.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1941,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Keep knees over ankles, breathe slowly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 196,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Keep logging check-ins and reset outcomes to build a useful pattern.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3117,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Keep the breath easy; there is no need to hold it.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Keep the phone out of reach and let the urge rise and fall for two minutes. You only need to protect the next choice.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 464,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_CLARA_COPY"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 265,
          "kind": "literal-candidate",
          "surface": "CLARA_REPLY_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Keep the phone out of reach for two minutes.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 477,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 281,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Keep this list for a hard day.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 754,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Keep trying",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2621,
          "kind": "attribute",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Keep your chest tall, weight in heels.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 106,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Keep your phone out of reach if possible. Choose a quiet reset and a comfortable breathing pace.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 538,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Keep your purchases connected to an account. Encrypted backup is optional, and recovery works without signing in.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 292,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Keeps Instagram, YouTube, TikTok, X, and Reddit interruptions tied to configured limits and source-scoped app or short-form earned unlocks.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 288,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Keeps the DNS Guard recovery-challenge notification visible on Android 13+ when Android blocks a background challenge launch.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 247,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "kill myself",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 490,
          "kind": "literal-candidate",
          "surface": "isCrisisSupportInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "Known gaps: networks that resolve only over IPv6 or encrypted DNS (DoH/DoT) can bypass DNS-level filtering.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3621,
          "kind": "jsx",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lace up your shoes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 341,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "language",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 59,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Language & appearance",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 59,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 59,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Last opened a message draft {{lastContacted}}.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4950,
          "kind": "template-candidate",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Last saved {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4575,
          "kind": "template-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lasting change comes from who you believe you are, not from how hard you resist.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 31,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Late night",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6304,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Late night in bed",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 557,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Launch products are yearly and monthly Premium, with the same features. Purchases and refunds are handled by Google Play or App Store billing. FREED verifies purchases before granting Premium.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 174,
          "kind": "literal-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Lean forward over your right knee, breathe.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 241,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "learn",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 31,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "learning latency",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3616,
          "kind": "literal-candidate",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Leave the phone in the room.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1826,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Leave without recording",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 23,
          "kind": "jsx",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Leaves this guided reset.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6908,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Let FREED interrupt selected apps and blocked browser attempts with a recovery reset.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 29,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Let FREED protect the apps and websites you choose.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 21,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Let the body register the warmth.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 893,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Let your breath set a comfortable rhythm.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 558,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 577,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Lets FREED cross-check same-day foreground time for selected apps so limits survive app switches and service restarts.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 258,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Lets iOS shield selected apps, categories, or domains after the configured daily limit without reading in-app screens.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 183,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Lets the user choose which apps, categories, or domains can be shielded during high-risk windows.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 166,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Letter to future you",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 621,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Letter to your inner child",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1036,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "LEVEL",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3025,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lie back or sit upright.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 466,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Lie underneath and grip with both hands.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Lifetime Premium",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5180,
          "kind": "literal-candidate",
          "surface": "membershipPlanLabels"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lift knees high one at a time.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 269,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Light jog",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 331,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Link another provider or manage this account.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7058,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Link another sign-in",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7060,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lion's breath",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 528,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "List 3 reasons you started this path.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 615,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "List 3 specific things, not generic ones.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 665,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "List 3 wins from this week.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 751,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "List 5 hard things you've already gotten through.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 977,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "List breakfast, lunch, and dinner.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2016,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "List things you've already overcome",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 967,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "List your last three slips by time of day.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 734,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Listen at a comfortable volume.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2074,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Listen more than you speak.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1905,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Listen to a strong song",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1514,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Listen to their full answer.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1203,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Load the website list that FREED uses to block adult content.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 26,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Loading price…",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 49,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Loading prices from your store…",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 234,
          "kind": "jsx",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Loading store prices…",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 59,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Loads the reviewed adult-domain feed into Android DNS Guard before website protection is ready.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 92,
          "kind": "copy-property",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Loads the reviewed adult-domain feed into Safari as a first-line blocker for known explicit sites; production activation does not rely on the embedded seed alone.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 198,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Loads the reviewed remote adult-domain feed into Android Accessibility and DNS Guard before activation; the embedded seed remains a local fallback only.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 221,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Local classification checks passed without saving a blocked attempt. Finish the required permission and feed rows, then run this again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1875,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local classification checks passed, but current readiness changed. Review the required permission/feed rows, then run Test Protection again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1874,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local contacts only. FREED opens SMS or email when you choose to share.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5080,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local drafts could not be erased. Check device storage and try again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8245,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local export available · sync off",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 68,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local only · sharing off",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 69,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local recovery data could not be deleted.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4782,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local recovery data deleted from this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4779,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local storage unavailable",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7186,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Local VpnService fallback routes only configured DNS resolver IPs and never proxies full traffic.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 135,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Lock the date in.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1237,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Log Slip Safely",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7099,
          "kind": "attribute",
          "surface": "ProfileScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 32,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 32,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lonely",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6304,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Long Exhale",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 31,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Look around from where you are.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Look at how far you have come.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2055,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Look at your progress photo",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2044,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Look for that shape in objects around you.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Look up and don't multitask.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1998,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Low",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3792,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3802,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3813,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 6129,
          "kind": "literal-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lower slowly without bouncing.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 398,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Lower slowly.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 116,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Lower stimulation and move the phone away from where you rest. Tired moments need a gentler boundary, not more pressure.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 466,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_CLARA_COPY"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 267,
          "kind": "literal-candidate",
          "surface": "CLARA_REPLY_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Lower with control until chest is two fists from the ground.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 88,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Lower with control.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 362,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Main trigger",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6336,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Make a few gentle movements that feel comfortable.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 18,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Make a trusted check-in",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 496,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 300,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Make plans with family this week",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1225,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Make relapse data useful",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 54,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Make the bed",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1394,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Make them concrete and small.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1115,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Malformed verification request.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 375,
          "kind": "literal-candidate",
          "surface": "validateRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Manage account providers and sign-out.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 53,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Manage contacts and support-circle reports.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 57,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 57,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Manage membership",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7093,
          "kind": "attribute",
          "surface": "ProfileScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 8490,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 54,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 54,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Manage subscription",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 250,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "ManagedSettings adult-content policy",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 145,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "ManagedSettings adult-content web filter paused.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 735,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "ManagedSettings automatic adult-content web filter requested.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 597,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "ManagedSettings web filtering is unavailable in this build.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 606,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 744,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Mark completed or undo your record.",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 57,
          "kind": "attribute",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Mark which one is most under threat now.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1031,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "media",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "meditation",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 38,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Meditation",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 38,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 14,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Medium",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4140,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Membership could not be confirmed. Try again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8162,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 8171,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Membership options available",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 76,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Mental clarity & focus",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 549,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Message",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6550,
          "kind": "jsx",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Message partner",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6994,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Message template",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5019,
          "kind": "attribute",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Message your accountability partner",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 164,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Messages you send can use Google-hosted CLARA.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Milestones and achievements",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3023,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "min ·",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 34,
          "kind": "jsx",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "min read",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4001,
          "kind": "jsx",
          "surface": "ArticleReaderScreen"
        },
        {
          "file": "src/features/library-screen.tsx",
          "line": 41,
          "kind": "jsx",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "MINDFUL RESET",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6486,
          "kind": "literal-candidate",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Mindfulness",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 16,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Minutes",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4147,
          "kind": "attribute",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Missing App Store transaction id.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 406,
          "kind": "literal-candidate",
          "surface": "verifyApplePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Missing Google Play product id or purchase token.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 459,
          "kind": "literal-candidate",
          "surface": "verifyGooglePurchase"
        }
      ],
      "category": "main"
    },
    {
      "source": "Missing or invalid App Store transaction id.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 384,
          "kind": "literal-candidate",
          "surface": "validateRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Missing or invalid Google Play purchase token.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 387,
          "kind": "literal-candidate",
          "surface": "validateRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Missing product id.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 381,
          "kind": "literal-candidate",
          "surface": "validateRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Mode options are unavailable in this installed build. Existing daily limits remain available.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3741,
          "kind": "jsx",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 106,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Momentum",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3311,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "month",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 50,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Monthly growth",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3165,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 50,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 50,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "MONTHLY GROWTH",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3187,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Monthly or yearly · same features",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7045,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Monthly Premium",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5179,
          "kind": "literal-candidate",
          "surface": "membershipPlanLabels"
        }
      ],
      "category": "main"
    },
    {
      "source": "mood",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Mood timeline",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1070,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "More support for your recovery.",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 162,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Morning reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4226,
          "kind": "literal-candidate",
          "surface": "ReminderSettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Motion sensor",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "Motion sensors and pedometer",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 469,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Mountain climbers",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 166,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Move",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4126,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        },
        {
          "file": "src/features/library-screen.tsx",
          "line": 28,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 26,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 38,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Move distracting apps out of reach during your protected time.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Move the phone out of reach",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 491,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 295,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Move the phone out of reach and contact a trusted person for a brief check-in. Support can make the next safe action easier.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 467,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_CLARA_COPY"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 268,
          "kind": "literal-candidate",
          "surface": "CLARA_REPLY_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Move your body",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 12,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Move your body if it shows up.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1527,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "movement",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 26,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 36,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Movement also does something subtler: it proves agency. A craving says you have no choice; choosing to move your body is a physical demonstration that you do. That proof matters more in the moment than any argument.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 48,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Movement observed",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 50,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Name",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5094,
          "kind": "attribute",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Name one healthy way to meet it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1099,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Name the emotion that fits each spot.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 821,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Name the next safe step",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 481,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 285,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Name the pattern before it names the day.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6136,
          "kind": "attribute",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Name the urge, then surf it",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 175,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Name what you need for the next ten minutes.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 482,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 286,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Native account service unavailable.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 214,
          "kind": "literal-candidate",
          "surface": "journeyAuthObserver"
        }
      ],
      "category": "account"
    },
    {
      "source": "Native adult-domain feed loaded: {{nativeAdultFeedCount}} reviewed domains.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1846,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native Android activation diagnostics could not run.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 280,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Native app guard configuration",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 64,
          "kind": "literal-candidate",
          "surface": "buildProtectionPermissionPlan"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 66,
          "kind": "literal-candidate",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Native app guard mode was rejected.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 51,
          "kind": "literal-candidate",
          "surface": "syncNativeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native diagnostics could not run.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2330,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 2331,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native diagnostics need attention: {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1872,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native expiry relock readback did not match.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1928,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Native feed sync",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 217,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Native network check ready",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 71,
          "kind": "literal-candidate",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native protection build",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 310,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Native schedule configuration was rejected.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 60,
          "kind": "literal-candidate",
          "surface": "syncNativeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native scheduling is configured. Check active guards and device enforcement.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native setup target",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1035,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native sleep schedule is configured.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Native status exposes only the feed version, checksum, and domain count; FREED does not store browsing history.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 222,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Native status reports {{focusShieldRuleCount}} local rule{{value2}}, but {{count}} loaded. Refresh stale rules before relying on them.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 87,
          "kind": "template-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Native strict app guard configuration was rejected.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 61,
          "kind": "literal-candidate",
          "surface": "syncNativeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Need help?",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 63,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Needs attention",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3736,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/components/IOSWebsiteProtectionSetup.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "IOSWebsiteProtectionSetup"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "actionFor"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 73,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        },
        {
          "file": "src/components/ProtectionLayers.tsx",
          "line": 7,
          "kind": "literal-candidate",
          "surface": "labels"
        }
      ],
      "category": "main"
    },
    {
      "source": "needs data",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3104,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Needs setup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2928,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Network blocking not verified",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 71,
          "kind": "literal-candidate",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Network check needs attention",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 71,
          "kind": "literal-candidate",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "NEXT BEST ACTION",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4295,
          "kind": "jsx",
          "surface": "RetentionPlanCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Next schedule change: {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "template-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Next week",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 34,
          "kind": "attribute",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Night guard",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4228,
          "kind": "literal-candidate",
          "surface": "ReminderSettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Night Guard could not be scheduled: {{error}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 802,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Night Guard is scheduled. FREED will apply Screen Time filtering during the risk window.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 502,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Night Guard schedule stopped.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 833,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Night Guard scheduled from {{value1}} to {{value2}}.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 795,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Night shutdown ritual",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1835,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Night urges",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5959,
          "kind": "copy-property",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "No active earned unlock",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3517,
          "kind": "literal-candidate",
          "surface": "formatUnlock"
        }
      ],
      "category": "main"
    },
    {
      "source": "No adult content",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 11,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "No Android settings screen accepted the request.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1786,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "No articles match your search.",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 45,
          "kind": "jsx",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "No background location tracking is used; exact coordinates are not sent to AI or stored as recovery history.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 485,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 524,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "No camera roll access, media upload, continuous camera analysis, continuous image classification, screen-capture analysis, or OCR is used.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 463,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "No check-in answers recorded.",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 45,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "No checkout",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 51,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "No continuous camera, image classification, screenshot, OCR, or background location analysis is used.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 540,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "No features match your search. Try another word.",
      "occurrences": [
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 16,
          "kind": "jsx",
          "surface": "FeatureDirectory"
        }
      ],
      "category": "main"
    },
    {
      "source": "No fishing — just give and close the chat.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 909,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "No gallery/media-library access, media upload, continuous camera analysis, continuous image classification, screen-capture analysis, or OCR is used.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 502,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "No helpfulness feedback recorded",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "No native protection status is available yet.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3893,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "No phone, just attention.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1271,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "No records are available for this date. Missing a task does not log a setback.",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 44,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "No schedules are enabled.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "No Screen Time targets were selected. Choose at least one app before activation can finish.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 961,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "No signals yet",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3009,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "No social media",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 16,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "No store prices were returned. Check the signed app, store account and product availability, then retry.",
      "occurrences": [
        {
          "file": "src/components/FunctionalPaywallScreen.tsx",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "FunctionalPaywallScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Normal Web Allowlist",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3868,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Not enabled in system settings",
      "occurrences": [
        {
          "file": "src/components/EncryptedDnsSection.tsx",
          "line": 70,
          "kind": "literal-candidate",
          "surface": "EncryptedDnsSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Not enough data",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3339,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Not enough data for an estimate",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3112,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Not enough data yet",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3017,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Not now",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2564,
          "kind": "attribute",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Not selected",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1007,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Note how each one felt impossible at the time.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 979,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Note the environment for each.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 736,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Note the feeling right before each.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 735,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "notes",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 27,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notice five nearby objects",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notice five ordinary objects, one at a time.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notice five things around you.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 138,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notice five things you have not seen before.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 215,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice how it changes your state.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 910,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice how you feel without expecting a change.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1272,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2000,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice one object for a few quiet moments.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notice one specific thing about someone.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1252,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice the body shift after writing.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 667,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice the body soften.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 771,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice the leaves and texture.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1578,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice the small relief.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1238,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice the sound, smell, and temperature.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1493,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice the temperature in the throat.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1342,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice the urge without expecting it to fade on a schedule.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1867,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 182,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice three different sounds.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1509,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice where it sits in the body.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1866,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Notice your breath without forcing it.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notice your shoulders soften.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1187,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "notification",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 55,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notification payloads contain route/kind metadata only, not streaks, slips, URLs, or private notes.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 449,
          "kind": "literal-candidate",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Notifications and guided challenge sensors are optional. Protection settings are available in Protect.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2681,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Notifications contain route/kind metadata and a redacted blocked host only; FREED does not store notification history or full DNS history.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 248,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Off",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3812,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "off or not acknowledged",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Off-device export context is unavailable. Use local challenges.",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 248,
          "kind": "literal-candidate",
          "surface": "buildChallengeGenerationRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Offer a real, full hug.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 891,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "OISD NSFW Small",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 435,
          "kind": "copy-property",
          "surface": "REVIEWED_FEED_SOURCE"
        }
      ],
      "category": "account"
    },
    {
      "source": "Older reset details are no longer retained. Their recorded totals are preserved.",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 47,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "On iOS, FREED uses Family Controls, ManagedSettings, DeviceActivity, FamilyActivityPicker, and Safari Content Blocker rules to apply Screen Time and Safari restrictions. FREED receives opaque selected target tokens and counts, not the user's full app or browsing history.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 102,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "One clear minute now makes the next hard moment easier.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6150,
          "kind": "jsx",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "One payment, no renewal",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 266,
          "kind": "copy-property",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "One step at a time. You are making room for a better day.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 36,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedNativeCompanion.kt",
          "line": 33,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "One trusted person can be one tap away during a risk moment.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4950,
          "kind": "literal-candidate",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Only aggregate counts and rates are sent after consent. Notes, raw URLs, contacts, receipts, and transcripts stay off the payload.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3257,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Only DNS questions are classified locally; FREED does not MITM HTTPS or proxy normal traffic.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 233,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Only hug if both people want to; stop whenever either wishes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 892,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Only selected opaque tokens and counts are stored in the shared app group.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 167,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Only the challenged Screen Time app is unlocked. Unrelated guards and adult web filtering stay active.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2323,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Only the offline fallback is available. Website protection is waiting for the reviewed adult-domain feed. Check your connection and retry this step.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 56,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 17,
          "kind": "copy-property",
          "surface": "feature"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open a fresh note.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2163,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open a note to plan the next day.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2111,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open a note.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 149,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open a notes app or paper.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 613,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open a window",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1480,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open accessibility",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 29,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open adult-category test",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 116,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        },
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 58,
          "kind": "jsx",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open app limits",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3880,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open basic movement",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 12,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open breathing",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6048,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open CLARA in the FREED app.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2092,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open Cloudflare's safe adult-category test page: it should be blocked when that filtering layer works. Then open example.com: it should load. These links open your browser; FREED does not observe the result or mark protection verified.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 116,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        },
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 57,
          "kind": "jsx",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open FREED Protection under downloaded or installed apps, turn it on, then return here.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 29,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open FREED to begin a local recovery challenge.",
      "occurrences": [
        {
          "file": "src/i18n/native-ios-notification-catalog.json",
          "line": 3,
          "kind": "native-resource",
          "surface": "native-ios-resource"
        },
        {
          "file": "ios/FREEDShieldAction/ShieldActionExtension.swift",
          "line": 172,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open FREED to complete a recovery challenge. No overlays, screenshots, or OCR are used.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 14,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1666,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open FREED to complete a recovery challenge. Normal browsing stays direct.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 17,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 1090,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open guided breathing",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 14,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open Help for available options on this device.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 37,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open it fully.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1491,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open journal",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6048,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open Journal",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 13,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open mouth wide, stick out tongue.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 539,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open normal website test",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 116,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        },
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 59,
          "kind": "jsx",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open Private DNS settings",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3631,
          "kind": "literal-candidate",
          "surface": "DnsGuardHealthSection"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 54,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open Protect",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7105,
          "kind": "attribute",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open Protect for this optional setting.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 69,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open Safari settings",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 25,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open Settings → Screen Time.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1640,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open the selected app, then tap the temporary FREED edge handle.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 452,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 130,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open the verification link in your email, then come back to confirm. Your account and purchases are connected.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 298,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Open this feature from All features.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8496,
          "kind": "jsx",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Open to any page.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1542,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open usage access",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 28,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open VPN settings",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3626,
          "kind": "literal-candidate",
          "surface": "DnsGuardHealthSection"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 53,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open VPN settings and disconnect the other VPN, then return here. We'll check the connection and start protection.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 49,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Open your 'strong me' playlist.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1524,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your accountability chat.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1218,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your accountability contact.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 839,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your eyes and act on it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1962,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your goals list or note.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1029,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your home screen.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1593,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your recovery group or forum.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 924,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your saved comedy playlist.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1978,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your saved reasons note.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 785,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your sponsor or group thread.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1304,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Open your streak screen.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2054,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Opened an Android settings fallback. Go to Accessibility > downloaded or installed services > FREED Protection, enable it, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 307,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1058,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened an Android settings fallback. Review Network & internet > Private DNS, then return to FREED and verify DNS Guard.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 389,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened Android Accessibility settings. Choose FREED Protection under downloaded or installed services, enable it, approve Android's request, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 306,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1057,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened Android app settings as a fallback. Enable FREED notifications, then return so recovery challenges stay visible.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 425,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened Android notification settings for FREED. Allow notifications so DNS Guard recovery challenges stay visible if Android blocks a background launch.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 424,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened Android Private DNS settings. Review strict encrypted DNS, then return to FREED and verify DNS Guard.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 388,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened Android settings fallback. Go to Network & internet > VPN, review any conflicting VPN, then return to FREED and retry the connection request.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 468,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened Android VPN settings. Disconnect another VPN or review its always-on setting, then return to FREED and retry the connection request.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 467,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened the Android Usage Access list. Select FREED, turn on Allow usage access, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 347,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opened Usage Access for FREED. Turn on Allow usage access, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 346,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opening iOS Settings so you can review FREED permissions. If Safari blocking is still needed, enable FREED Safari Blocker in Settings > Safari > Extensions, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1029,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opening iOS Settings.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1047,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Opening Safari settings. Turn on FREED Safari Blocker, then return here.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1993,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Opens Apple sign-in. You can cancel and keep using FREED.",
      "occurrences": [
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 106,
          "kind": "attribute",
          "surface": "SocialSignInButtons"
        }
      ],
      "category": "account"
    },
    {
      "source": "Opens Google sign-in. You can cancel and keep using FREED.",
      "occurrences": [
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 80,
          "kind": "literal-candidate",
          "surface": "SocialSignInButtons"
        }
      ],
      "category": "account"
    },
    {
      "source": "Opens immediate recovery support without an ad.",
      "occurrences": [
        {
          "file": "src/components/UrgeSupportButton.tsx",
          "line": 8,
          "kind": "attribute",
          "surface": "UrgeSupportButton"
        }
      ],
      "category": "main"
    },
    {
      "source": "Opens secure Apple sign-in. You can cancel and keep using FREED.",
      "occurrences": [
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 91,
          "kind": "attribute",
          "surface": "SocialSignInButtons"
        }
      ],
      "category": "account"
    },
    {
      "source": "Optional breathing gives you a quiet activity to focus on. Keep a comfortable pace, skip any holds or counting, and switch resets if needed. No particular feeling or urge change is guaranteed.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 428,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 446,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 464,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 482,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 500,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 518,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 536,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 554,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 573,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 591,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1862,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2071,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Optional contact offers a chance to connect with a trusted person. Ask for consent and accept no response; you can switch resets.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 837,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 854,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 871,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 888,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 905,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 922,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 939,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 956,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1148,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1165,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1182,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1199,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1216,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1233,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1250,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1267,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1284,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1302,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1319,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1900,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2142,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Optional contact with your accountability partner offers company during an urge. Ask for consent and accept no response.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 170,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Optional data sent to FREED servers",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 107,
          "kind": "copy-property",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Optional encrypted backup needs a passphrase. Create a backup before uploading or restoring.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4366,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Optional movement offers a break from the screen. Choose a comfortable pace and fewer repetitions; quiet or seated movement is welcome. Stop or switch resets whenever needed. Motion evidence records device movement, not exercise form or repetitions.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 84,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 102,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 120,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 138,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 156,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 174,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 192,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 210,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 228,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 266,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 284,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 303,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 321,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 339,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 357,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 375,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 393,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1824,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 115,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Optional observation lets you notice an urge while you decide what to do next. No feeling or outcome is guaranteed.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 126,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 181,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Optional schedules",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 106,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Optional seated device movement gives you a quiet pause. Move your device only if comfortable, or choose another reset. Motion evidence records device movement, not water exposure, shoulder exercise, form or repetitions.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 413,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1810,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2128,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 159,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "or use email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 322,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Outdoor",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3789,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Outdoor challenge verification",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 479,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 518,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Parasympathetic breathing",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 565,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Partner name",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4983,
          "kind": "attribute",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Passphrase",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4474,
          "kind": "attribute",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Password",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 341,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 343,
          "kind": "attribute",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 104,
          "kind": "jsx",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Past days are read-only.",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 43,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pat dry and sit comfortably.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1357,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1610,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "patterns",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 46,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 48,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pause",
      "occurrences": [
        {
          "file": "src/components/RecoveryPath.tsx",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "DEFAULT_STAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pause complete",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6514,
          "kind": "literal-candidate",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pause Exercise",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        },
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pause on the one that hits hardest.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 787,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pause or choose another reset if device movement is uncomfortable.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 414,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1811,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2129,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 160,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pause or stop if you feel discomfort.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 17,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pause. Breathe.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6500,
          "kind": "attribute",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pay attention to your feet hitting the floor.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1828,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "per month",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 254,
          "kind": "literal-candidate",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "per year",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 239,
          "kind": "literal-candidate",
          "surface": "describeLaunchPlanPricing"
        }
      ],
      "category": "premium"
    },
    {
      "source": "permission is denied",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "permission is unavailable",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "Permission status is checked on this device. Test actual blocking before relying on protection.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 118,
          "kind": "jsx",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "permissions",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 23,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Personal insight",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 48,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 48,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "PERSONAL INSIGHT",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3065,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Personalize my suggestions",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7097,
          "kind": "attribute",
          "surface": "ProfileScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pet or animal time",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1259,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "phone boundary",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 520,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_TAGS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 331,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Phone in another room",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1377,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Phone number",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4999,
          "kind": "literal-candidate",
          "surface": "AccountabilitySettingsCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 5110,
          "kind": "literal-candidate",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Phoneless walk in the building",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1816,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Photo challenge verification",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 457,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 496,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Photo target matched",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 46,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Photo Verified",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6983,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Photos are checked on your device with Apple Vision or bundled ML Kit. Photos are not uploaded. ML Kit may send operational SDK metrics.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 103,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Physical distance adds enough friction to make the next choice deliberate.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 493,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 297,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Physio Sigh",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 67,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Physiological Sigh",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 31,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pick a book you already love.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1541,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick a different chair or wall.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1372,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick a friend you haven't talked to in weeks.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1150,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick a friend, parent, or mentor.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 958,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick a grandparent, aunt, or family friend.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1902,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick a trusted contact.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1184,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick one action that protects it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1032,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick one reset.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6857,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pick one safe person.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1167,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick one surface or corner.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1421,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick one task you have avoided.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2035,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick one trusted person.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 941,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick protein + something crunchy.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1456,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick someone whose life interests you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1201,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick someone whose opinion you respect.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 873,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick the apps, categories or websites you want help stepping away from.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 23,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Pick the easiest thing in the fridge.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1559,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick the most charged track.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1525,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick the value most under attack right now.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 683,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick the warmest person on your list.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 856,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick three people you appreciate.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 907,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick which one you'll act on.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 998,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pick your trusted person.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 171,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Picture giving in right now in detail.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1012,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Picture how you'll feel in 10 minutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1013,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Picture waking up tomorrow.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1014,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Picture yourself at age 7.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1046,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Picture yourself five years free of this.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 717,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pin it to the home screen.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2166,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Place forearms on the floor, elbows under shoulders.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 140,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Place one hand on chest, one on belly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 520,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Place the phone across the room.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 492,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 296,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "plan",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Plan one fix for the worst column.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1083,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Plan progress {{value1}} percent.",
      "occurrences": [
        {
          "file": "src/components/RecoveryPath.tsx",
          "line": 65,
          "kind": "literal-candidate",
          "surface": "RecoveryPath"
        }
      ],
      "category": "main"
    },
    {
      "source": "Plan tomorrow's meals",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2006,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Plank hold",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 130,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "plant",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Plant or watering moment",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1566,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Plant your hands.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 116,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Please wait a moment before sending another cloud message.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Please wait…",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "pledge",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pledge recorded",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "literal-candidate",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Post or share where you are right now.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 925,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pour a full glass of cold water.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1340,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Practical step: write one sentence in your check-in that starts with \"I am the kind of person who…\". Make it small and true. Then collect proof. Willpower gets you through tonight; identity gets you through the year.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Practice",
      "occurrences": [
        {
          "file": "src/components/RecoveryPath.tsx",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "DEFAULT_STAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Practices",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 46,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Practices, reminders and personal suggestions",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7074,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Pray, meditate, or simply be silent.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1960,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Preferred reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 999,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "premium",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 54,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Premium access inactive",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7044,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Premium access revoked",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7044,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Premium available",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 76,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Premium billing plan",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 181,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Premium builder",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Premium plans are processed by Apple App Store or Google Play billing. FREED activates premium only after server-side Purchase verification succeeds.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 123,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Premium sponsor session",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2134,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Premium tools",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 164,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Prepare protection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 26,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Prepare web protection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 26,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Preparing your ad…",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Press & hold while you pause and breathe",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6519,
          "kind": "literal-candidate",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Press up onto the balls of your feet.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 396,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Press your back flat against a wall.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 194,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Preview builds can show Focus Shield setup copy, but they cannot inspect native app surfaces or enforce device shields.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 140,
          "kind": "copy-property",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Preview FREED",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 32,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Preview only · purchases unavailable",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 55,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Previous native relock restoration could not be confirmed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1882,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Previous week",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 34,
          "kind": "attribute",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Price unavailable",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 49,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Primary support email: {{SUPPORT_EMAIL}}. Include the platform, app version, device model, and whether the issue is Android, iOS, Google Play, App Store, TestFlight, billing, or protection setup.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 157,
          "kind": "template-candidate",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "privacy",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Privacy",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 253,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Privacy & support",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 58,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 58,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Privacy & Support",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4810,
          "kind": "attribute",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Privacy and deletion",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 179,
          "kind": "copy-property",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Privacy contact and deletion support: {{SUPPORT_EMAIL}}.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 232,
          "kind": "template-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Privacy controls are ready.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4753,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Privacy policy",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 149,
          "kind": "copy-property",
          "surface": "SupportPage"
        },
        {
          "file": "src/features/legal-pages.tsx",
          "line": 199,
          "kind": "copy-property",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Privacy Policy",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4821,
          "kind": "attribute",
          "surface": "PrivacySupportCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7120,
          "kind": "attribute",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "PRIVACY-SAFE SNAPSHOT",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3222,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Private DNS guidance",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 42,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 294,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Private DNS state is reported for QA because strict Private DNS can affect DNS Guard resolver behavior.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 134,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Private journal note",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 32,
          "kind": "attribute",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Private note",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6370,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Private notes, contacts, browsing details, and device protection history are not included.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5045,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "private pattern",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 506,
          "kind": "literal-candidate",
          "surface": "cleanCoachPatternSignal"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 507,
          "kind": "literal-candidate",
          "surface": "cleanCoachPatternSignal"
        }
      ],
      "category": "main"
    },
    {
      "source": "Processing stays on device and is limited to app package, focused URL/search fields, labels, and scroll events.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 270,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Procrastination & fatigue",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 561,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Product id is not configured for FREED premium.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 382,
          "kind": "literal-candidate",
          "surface": "validateRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Profile",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 13,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Profile and settings",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 13,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Progress",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 12,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 44,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 45,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 46,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 48,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 49,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 50,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 51,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "FeatureDirectory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Progress stays on this device. You can connect an account later in Profile.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 364,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Promise one small thing for today.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 633,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Protect",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 11,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 21,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 22,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 23,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "FeatureDirectory"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 46,
          "kind": "attribute",
          "surface": "ProtectOverview"
        },
        {
          "file": "src/components/RecoveryPath.tsx",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "DEFAULT_STAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protect {{label}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1092,
          "kind": "template-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protect Safari",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 25,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Protect selected apps during chosen time windows.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 21,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protect sleep and lower stimulation tonight.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 504,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_HEADLINES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 311,
          "kind": "literal-candidate",
          "surface": "RETENTION_HEADLINE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Protect today's progress and the next clean day.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 502,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_HEADLINES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 307,
          "kind": "literal-candidate",
          "surface": "RETENTION_HEADLINE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Protect your attention",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 16,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protect your browsing",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 27,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Protected",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3202,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1006,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection activation could not be saved. Retry after the current reset finishes.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 494,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Protection controls",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 11,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "PROTECTION ENGAGED",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6486,
          "kind": "literal-candidate",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection health",
      "occurrences": [
        {
          "file": "src/components/ProtectionLayers.tsx",
          "line": 10,
          "kind": "attribute",
          "surface": "ProtectionLayers"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection is paused after reset. Explicitly resume it before applying app guards.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 45,
          "kind": "literal-candidate",
          "surface": "syncNativeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection permission action completed.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1904,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection permission could not be completed.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1916,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection rules could not sync. Check status before relying on them.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7813,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection setup",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 43,
          "kind": "jsx",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection setup could not be enabled. Recovery tools remain available. Try again.",
      "occurrences": [
        {
          "file": "src/components/ProtectionReactivation.tsx",
          "line": 14,
          "kind": "jsx",
          "surface": "ProtectionReactivation"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection setup help",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 162,
          "kind": "copy-property",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Protection status changed since the last configuration check. Run the configuration check again before activation can finish.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1868,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 2405,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection stays off until you choose to set it up again.",
      "occurrences": [
        {
          "file": "src/components/ProtectionReactivation.tsx",
          "line": 11,
          "kind": "attribute",
          "surface": "ProtectionReactivation"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection was cleared",
      "occurrences": [
        {
          "file": "src/components/ProtectionReactivation.tsx",
          "line": 11,
          "kind": "attribute",
          "surface": "ProtectionReactivation"
        }
      ],
      "category": "main"
    },
    {
      "source": "Protection was turned off or changed in system settings. Re-run setup to reactivate on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7772,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Psychology",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 29,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Public deletion URL",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 228,
          "kind": "copy-property",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Pull chest toward the edge, squeeze shoulder blades.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 361,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pull shoulders back.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1625,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Pump arms in opposition to legs.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 270,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Purchase verification failed.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 344,
          "kind": "literal-candidate",
          "surface": "failed"
        },
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 534,
          "kind": "literal-candidate",
          "surface": "verifyPurchasePayload"
        }
      ],
      "category": "main"
    },
    {
      "source": "Purchase verification sends store transaction metadata to FREED's server so Apple or Google can verify entitlement before premium is activated. FREED does not receive full payment card details.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 110,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Push up slowly if comfortable; wall pushups are an option.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 89,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Put a fresh liner in.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1442,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Put back only what truly belongs.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1424,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Put it face-down, set a 30-minute timer.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1389,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Put the phone down and move to another room for two minutes. Changing place interrupts the automatic loop.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 463,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_CLARA_COPY"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 264,
          "kind": "literal-candidate",
          "surface": "CLARA_REPLY_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Put the phone down and take three slow breaths. A brief pause gives you room to choose the next action.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 462,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_CLARA_COPY"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 263,
          "kind": "literal-candidate",
          "surface": "CLARA_REPLY_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Put the phone down.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 138,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 472,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 487,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 276,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 291,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Put the phone outside the bedroom before the evening wind-down begins.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 510,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_ACTIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 318,
          "kind": "literal-candidate",
          "surface": "RETENTION_ACTION_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Put your phone away from the places where urges usually rise.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 11,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Put your phone down. Choose one short reset. You can stop whenever you need.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 534,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Put your phone on Do Not Disturb.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 212,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Quick recovery reset",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 328,
          "kind": "literal-candidate",
          "surface": "normalizeChallenge"
        }
      ],
      "category": "main"
    },
    {
      "source": "Rate your mood in each from 1-10.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1081,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Re-frame this urge as a signal",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1087,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Reach both arms overhead.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1624,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Reach out another way",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6994,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "React context is unavailable.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 178,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 291,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 326,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 373,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 409,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 448,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 488,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 632,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 655,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 670,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 685,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 735,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 753,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 778,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 807,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 831,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 871,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 904,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 952,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1020,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 1042,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Read and self-report any of the six daily practices; choose up to two for today.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read attention-boundary instructions and record your own day.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read boundary instructions and record your own daily practice.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 35,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read calm practice instructions and optionally open breathing.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 38,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 38,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read comfortable shower instructions and record your practice.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read each goal slowly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1030,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read each line out loud.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 786,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read for 10 minutes",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1531,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read it as if it already happened.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1066,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read it back as a third party.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 702,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read it back to yourself.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 770,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read it out loud.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1133,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 149,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read movement instructions and record your own exercise.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 36,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read privacy information, get help and manage deletion.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 58,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 58,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read recovery articles and open tools.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 31,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 31,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read reflection instructions and open private writing.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Read the disclosure, then tap OK on Android's connection request. Only one VPN can run at a time.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 27,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Read the list out loud, slowly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 980,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read the list out loud.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1886,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read them back.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1116,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read them out loud, slowly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 616,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read three other recent posts.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 926,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read without checking the time.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1543,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Read your why",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 775,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Ready - last sent {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2926,
          "kind": "template-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Ready to send",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2927,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Real blocking requires native platform APIs that are unavailable in Expo Go or web preview.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 315,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Receive what they offer.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 944,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "RECLAIM YOUR FOCUS & CLARITY",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 925,
          "kind": "jsx",
          "surface": "SplashScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record a 60-second honest update.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1185,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Record a 60-second voice message.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 874,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Record a difficult moment and plan your next step.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 32,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 32,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record an optional daily commitment.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record check-ins and resets to build your monthly report.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3190,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record exercise",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 20,
          "kind": "literal-candidate",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record how you feel to understand your patterns.",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record mood, urges and sleep.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record the activity and optionally tell us whether it helped.",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 17,
          "kind": "jsx",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record the practice you chose for today.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Record this practice only when it reflects your day.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 11,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 16,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Records that may be retained",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 220,
          "kind": "copy-property",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Records your confirmation. FREED cannot confirm message delivery.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7009,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 55,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Recovery accountability check-in",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1208,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Recovery backup restored. Membership and device permissions keep their current verified state.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8231,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery community check-in",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 914,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Recovery content is not permitted in Firebase callable payloads.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 993,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Recovery history",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 44,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 44,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery notification visibility",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 238,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Recovery path.",
      "occurrences": [
        {
          "file": "src/components/RecoveryPath.tsx",
          "line": 62,
          "kind": "literal-candidate",
          "surface": "RecoveryPath"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery progress",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 12,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery reminders",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 443,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Recovery Reminders",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4233,
          "kind": "attribute",
          "surface": "ReminderSettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery reminders could not be scheduled.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7903,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery Tools",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 31,
          "kind": "attribute",
          "surface": "LibraryScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 31,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 31,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Recovery tools remain available while protection is off.",
      "occurrences": [
        {
          "file": "src/components/ProtectionReactivation.tsx",
          "line": 13,
          "kind": "jsx",
          "surface": "ProtectionReactivation"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reflect on what happened before this moment.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2094,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Refresh protection status",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2678,
          "kind": "attribute",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Refresh setup",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        },
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 37,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Refresh your routine",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 15,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Registered time windows for selected individual iOS applications.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 27,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "relapse",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 32,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reminders",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 55,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "remote",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "REMOTE ANALYTICS",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3251,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remote analytics sharing is off.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7416,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7421,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "remote challenge endpoint",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 89,
          "kind": "literal-candidate",
          "surface": "getChallengeGenerationReadiness"
        },
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 356,
          "kind": "literal-candidate",
          "surface": "fetchRemoteChallenges"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remote challenge endpoint is not configured.",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 354,
          "kind": "literal-candidate",
          "surface": "fetchRemoteChallenges"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remote challenge generator request",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 371,
          "kind": "literal-candidate",
          "surface": "fetchRemoteChallenges"
        }
      ],
      "category": "main"
    },
    {
      "source": "remote challenge provider or endpoint",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 86,
          "kind": "literal-candidate",
          "surface": "getChallengeGenerationReadiness"
        }
      ],
      "category": "main"
    },
    {
      "source": "remote coach endpoint",
      "occurrences": [
        {
          "file": "src/lib/ai-coach.ts",
          "line": 132,
          "kind": "literal-candidate",
          "surface": "getCoachReadiness"
        },
        {
          "file": "src/lib/ai-coach.ts",
          "line": 201,
          "kind": "literal-candidate",
          "surface": "fetchRemoteCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remote coach endpoint is not configured.",
      "occurrences": [
        {
          "file": "src/lib/ai-coach.ts",
          "line": 199,
          "kind": "literal-candidate",
          "surface": "fetchRemoteCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "remote coach provider or endpoint",
      "occurrences": [
        {
          "file": "src/lib/ai-coach.ts",
          "line": 129,
          "kind": "literal-candidate",
          "surface": "getCoachReadiness"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remote coach request",
      "occurrences": [
        {
          "file": "src/lib/ai-coach.ts",
          "line": 216,
          "kind": "literal-candidate",
          "surface": "fetchRemoteCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remote coach returned an empty reply.",
      "occurrences": [
        {
          "file": "src/lib/ai-coach.ts",
          "line": 221,
          "kind": "literal-candidate",
          "surface": "fetchRemoteCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "remote feed unavailable",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1937,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 2315,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remove",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5138,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remove {{domain}} from local exceptions",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2807,
          "kind": "template-candidate",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Remove everything that doesn't belong.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1422,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Repeat each one three times slowly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1924,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Repeat one previously helpful reset before the next risk window.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 511,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_ACTIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 319,
          "kind": "literal-candidate",
          "surface": "RETENTION_ACTION_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "report",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 49,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 50,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Report this block as a mistake",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6559,
          "kind": "attribute",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Request {{value1}} min app break",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6889,
          "kind": "template-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Request hosted data deletion",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 212,
          "kind": "copy-property",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Requesting an app break for the original app…",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8405,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Requires Firebase sign-in and a second confirmation. Cloud deletion must start before local data is cleared.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4841,
          "kind": "attribute",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Research on urge surfing shows that a typical craving loses most of its intensity within 15 to 30 minutes if it is not fed. You do not have to defeat the urge. You only have to outlast it, and the wave does most of the work for you.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Resend verification email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 358,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "reset",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 29,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 332,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4130,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 25,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 26,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 27,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 28,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 29,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 30,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 31,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 32,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "FeatureDirectory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reset after slip",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5953,
          "kind": "copy-property",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reset and repeat clean rounds.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 326,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Reset could not be saved. Try saving again; your completion receipt is kept.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6841,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reset Moment",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6312,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reset name",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4085,
          "kind": "attribute",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reset your password",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 291,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Resets",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3143,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "resets ·",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5041,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Resonant 6-breath",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 583,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Rest comfortably; gentle breathing or a quiet pause is optional.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1848,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Rest your feet on the floor.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Restless sleep quality",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 561,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "restore",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 56,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Restore",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4554,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Restore backup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 9014,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Restore purchases",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 249,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Restore recovery history?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 9009,
          "kind": "jsx",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Resume guided reset",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Resume protection setup",
      "occurrences": [
        {
          "file": "src/components/ProtectionReactivation.tsx",
          "line": 15,
          "kind": "jsx",
          "surface": "ProtectionReactivation"
        }
      ],
      "category": "main"
    },
    {
      "source": "Resume reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7011,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Resuming setup allows your saved app limits and schedules to sync on this device. Website filtering still needs its own setup.",
      "occurrences": [
        {
          "file": "src/components/ProtectionReactivation.tsx",
          "line": 12,
          "kind": "jsx",
          "surface": "ProtectionReactivation"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retention, deletion, and contact",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 128,
          "kind": "copy-property",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Retry",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 48,
          "kind": "jsx",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retry access check",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retry account access",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 361,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Retry connection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 56,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Retry discarding saved reset",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retry recording exercise",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 20,
          "kind": "literal-candidate",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retry saving",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8983,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retry saving access",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retry saving answers",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8980,
          "kind": "attribute",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Retry store prices",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 241,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Return after the timer.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1510,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Return here to record the movement you completed.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 12,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Return to FREED before opening Safari settings.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2858,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Return to FREED setup",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 28,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt",
          "line": 88,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Return to FREED.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 171,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Return to the FREED app after.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 842,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Return to today",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 40,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Return when comfortable; stop or switch resets whenever needed.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1829,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Return when you feel ready.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Returned from Android settings. Refreshing protection setup now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7972,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Returns to the Library.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3994,
          "kind": "attribute",
          "surface": "ArticleReaderScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Returns to the previous onboarding step.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1056,
          "kind": "attribute",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Returns to the previous screen.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5995,
          "kind": "attribute",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Returns without saving.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6139,
          "kind": "attribute",
          "surface": "CheckInScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 6314,
          "kind": "attribute",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review a local rule-based estimate when enough signals exist.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 51,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 51,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review access",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 71,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        },
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 33,
          "kind": "jsx",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review access accepts no payload.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1018,
          "kind": "literal-candidate",
          "surface": "createFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "Review adult website protection",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 24,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review aggregate counts and optional sharing controls.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 52,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review app protection",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 24,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review estimates based on your own recorded activity.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 45,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 45,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review filtering coverage, provider and connection health.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 24,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review local ordinary-site exceptions and wrong-block support.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 22,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review my routine",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6048,
          "kind": "literal-candidate",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review optional goals and preferred resets.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review patterns from your local check-ins.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 48,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 48,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review Private DNS settings, then return here and check protection again.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 44,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Review recorded risk windows and helpful resets.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 46,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review the last week of recorded activity.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 49,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 49,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review the monthly report from your recorded activity.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 50,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 50,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review verified access and membership options.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 54,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 54,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review website filtering and its independent coverage.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review website protection",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3694,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Review your suggested retention plan.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reviewed adult-domain feed",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 216,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Reviewed adult-domain feed synced to native protection.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1939,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Reviewed adult-domain feed was unchanged and native protection kept the cached feed.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1941,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Rewrite until it feels true.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2165,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Rinse and look at yourself in the mirror.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1476,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Rising tone: breathe in. Falling tone: breathe out. Short tone: hold.",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 41,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "risk",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 51,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Roll shoulders back five times each direction.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 233,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Roll up slowly, then shoulder rolls.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 251,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "routine",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Run in place",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 258,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Runtime details appear while DNS Guard runs on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3617,
          "kind": "literal-candidate",
          "surface": "DnsGuardHealthSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "Safari adult-domain blocker synced with {{ruleCount}} entries. Short-form web paths are handled by Safari Focus Shield.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 529,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari adult-domain rules",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 189,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 190,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker requires at least one adult-domain rule.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2419,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rule {{value1}} is missing a url-filter.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2478,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rule {{value1}} must be an object.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2471,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rule {{value1}} must use a block action.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2485,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rules could not be synced: {{error}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 540,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rules payload cannot be empty.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2411,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rules payload exceeds the 50,000 rule safety limit.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2414,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rules payload is empty.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2403,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker rules payload must be a JSON array.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2408,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Content Blocker state needs device verification: {{safariContentBlockerStateError}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1852,
          "kind": "template-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Safari extension settings opened. Enable {{extensionName}}, then return to continue setup.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1001,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari Focus Shield requested a local recovery challenge.",
      "occurrences": [
        {
          "file": "ios/FREEDSafariFocusShield/SafariWebExtensionHandler.swift",
          "line": 83,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "main"
    },
    {
      "source": "Safari has embedded fallback rules; production activation is waiting for reviewed Safari feed provenance.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1856,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Safari receives a domain rule list only; FREED does not inspect page contents.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 199,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Safari rules are loaded, but FREED Safari Blocker is disabled. Enable it in iOS Settings > Safari > Extensions, then return and run the configuration check.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1854,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Safari settings could not open directly. Open Settings, choose Apps → Safari → Extensions, and enable FREED Safari Blocker.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2657,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Safari settings could not open. Open Settings → Apps → Safari → Extensions.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 92,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Safari settings could not open. Return to FREED and try again.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1003,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Same Premium features in both plans.",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 179,
          "kind": "jsx",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Save and share it with your accountability partner.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2114,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Save and Start",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4195,
          "kind": "attribute",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save and Start Again",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6396,
          "kind": "attribute",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save Check-In",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6272,
          "kind": "attribute",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save completed reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6849,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save guard mode",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3739,
          "kind": "attribute",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 106,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save journal note",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 34,
          "kind": "jsx",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save plan",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save session",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save the completed reset before starting another.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7472,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save the note for hard moments.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 805,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Save the note for next time.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 668,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Save this draft before opening another entry.",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 38,
          "kind": "literal-candidate",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Save your reflection in Journal, then review your daily record.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saved app guard",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 64,
          "kind": "copy-property",
          "surface": "buildProtectionPermissionPlan"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 66,
          "kind": "copy-property",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Saved breathing session restored. Begin to resume.",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 67,
          "kind": "jsx",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saved exercise progress could not be erased. Check device storage and try again; recovery history was kept.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8253,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saved locally. Draft cleanup could not finish. Check device storage and try Save again.",
      "occurrences": [
        {
          "file": "src/hooks/use-recovery-draft.ts",
          "line": 75,
          "kind": "literal-candidate",
          "surface": "useRecoveryDraft"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saved mode",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3738,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "saved on",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saved progress could not be removed. Retry discarding it before starting another guided reset.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7496,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saved Resets",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4183,
          "kind": "literal-candidate",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saved. Native status confirms whether the mode is ready.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3740,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Saving a note preserves your check-in answers. It does not log a setback.",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 35,
          "kind": "jsx",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Say silently: 'this is an urge'.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1865,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Say what is hard right now.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 875,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Say: 'I am building, not failing.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1921,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Say: 'I can choose the next minute.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1923,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Say: 'I forgive you for ___.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1287,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Say: 'This urge is not who I am.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1922,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Say: this is an urge.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 182,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "schedule",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 21,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Schedule a coffee or walk with a friend",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1157,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Schedule it on your phone now.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1942,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Scheduled",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 9,
          "kind": "copy-property",
          "surface": "APP_GUARD_MODES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Scheduled mode uses registered local time windows. iOS covers only selected individual applications; Android windows cover supported distracting packages.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 102,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Schedules",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 21,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Schedules are saved. Complete app authorization to enforce them.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Schedules local check-in and Night Guard reminders if the user opts in.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 448,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "score",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 45,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "screen time",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 20,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Screen Time {{context}} shield requested a recovery intervention.",
      "occurrences": [
        {
          "file": "ios/FREEDShieldAction/ShieldActionExtension.swift",
          "line": 142,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "main"
    },
    {
      "source": "Screen Time access wasn't approved. Try again, or open Help for other options.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1906,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Screen Time adult-content web filter is active.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 500,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time authorization has not been granted.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 420,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 505,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time authorization is available. Apply the adult-content web filter to activate protection.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 419,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 504,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time authorization request completed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 556,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time authorization was not granted by the system.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 557,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time can block supported adult websites.",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 59,
          "kind": "literal-candidate",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Screen Time permission was revoked. Authorize Family Controls again to restore selected shields.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 109,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time picker closed. Choose at least one app, category, or web domain before activation can finish.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 932,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 937,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 965,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time picker could not open. Return to FREED setup and try choosing protected apps again.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 891,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time protection",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 133,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time target chosen during setup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1034,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Screen Time targets saved and the selected app guard installed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 957,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time targets saved. Native app guard readiness needs attention before activation.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 959,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Screen Time unlock identity does not match the claimed intervention. Existing Screen Time protection remains in effect.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 637,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Search all features",
      "occurrences": [
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 14,
          "kind": "attribute",
          "surface": "FeatureDirectory"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 14,
          "kind": "attribute",
          "surface": "FeatureDirectory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Search recovery articles",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 32,
          "kind": "attribute",
          "surface": "LibraryScreen"
        },
        {
          "file": "src/features/library-screen.tsx",
          "line": 32,
          "kind": "attribute",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Seated device movement pause",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 404,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1802,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2120,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 153,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Seated movement break",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 17,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Secure checkout is unavailable. Try again later.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7558,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Secure checkout unavailable",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 63,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        },
        {
          "file": "src/components/FunctionalPaywallScreen.tsx",
          "line": 31,
          "kind": "literal-candidate",
          "surface": "FunctionalPaywallScreen"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Secure local backup storage is unavailable.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 256,
          "kind": "literal-candidate",
          "surface": "createAutomaticBackupSecureKeyStore"
        }
      ],
      "category": "main"
    },
    {
      "source": "Secure randomness is unavailable for this Firebase operation.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 898,
          "kind": "literal-candidate",
          "surface": "createFirebaseClientEventId"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1572,
          "kind": "literal-candidate",
          "surface": "fillSecureRandom"
        }
      ],
      "category": "account"
    },
    {
      "source": "See milestones based on recorded activity.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "See my starting point",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 990,
          "kind": "literal-candidate",
          "surface": "QuizScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "See what you recorded and which actions helped.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2965,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Select At Least 1 App",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1139,
          "kind": "literal-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Select at least one Android app timer to finish protection setup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2142,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Select at least one item in Apple's picker, then tap Done.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 23,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Select FREED and allow usage access, then return here.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 28,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Select the apps where you want a daily limit and a moment to pause.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 30,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected app daily limit",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 172,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected app guard needs attention: {{error}}",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 858,
          "kind": "template-candidate",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected app guard settings saved. Review native readiness before relying on protection.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 861,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected app interruption",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 99,
          "kind": "copy-property",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected app packages",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 276,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected app timers are unavailable in this build. Install a signed Android build, then return to setup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2156,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selected app timers could not sync to native protection.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1967,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selected app timers synced to native protection.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1964,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selected applications pause immediately once the saved mode, authorization and native guard are ready.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 29,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selected apps",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3719,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selected apps are already synced. Continuing protection setup automatically.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2151,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selected apps are saved. Syncing app timers to native protection now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2160,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selected individual applications",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 61,
          "kind": "copy-property",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected package IDs and native guard state only.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 67,
          "kind": "literal-candidate",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected-app DeviceActivity scheduling is unavailable in this build.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1672,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected-app schedule configuration could not be encoded.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1607,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected-app schedule configuration saved. Native registrations determine readiness.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1629,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected-app schedule persistence could not be confirmed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1615,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected-app schedule update was rejected. The existing configuration remains installed.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1597,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selected-app schedules could not be installed. The previous configuration has been retained.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1624,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Selecting an app does not block it immediately. The daily timer applies after permissions and native configuration are ready. Schedules are separate optional blocking windows.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 102,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Selector saved locally. Current immediate enforcement remains limited to vetted presets.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 600,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "self harm",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 493,
          "kind": "literal-candidate",
          "surface": "isCrisisSupportInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "Self-reported urge moments: {{attempts}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5043,
          "kind": "template-candidate",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Send",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6552,
          "kind": "attribute",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Send a brief message asking for a check-in.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 497,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 301,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Send a meme that means something",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1140,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send a message that fits them.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1322,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send appreciation",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 948,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send each a specific, real compliment.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 908,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send it before the inner editor speaks.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 876,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send it before you can over-think.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1169,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send it. Don't wait for a reply.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 961,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send love to someone hurting",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1311,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send message",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5986,
          "kind": "attribute",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Send one meme or photo that fits them.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1151,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send Report",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5061,
          "kind": "literal-candidate",
          "surface": "AccountabilitySettingsCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 5132,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Send reset email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 353,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Send Snapshot",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3294,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Send your current streak day.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1219,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send: 'I need a reset moment.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 840,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send: 'Need a check-in. Hard moment.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1305,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Send: I need a reset.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 171,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sending aggregate snapshot…",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7429,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Server Deletion help remains available on the hosted account-deletion page and through support if you cannot sign in.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4815,
          "kind": "jsx",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "server secret must not be public: {{key}}",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1526,
          "kind": "template-candidate",
          "surface": "publicFirebaseSecretIssues"
        }
      ],
      "category": "account"
    },
    {
      "source": "Session progress could not be kept. Stay here and save your result before leaving.",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 67,
          "kind": "jsx",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Session saved",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 15,
          "kind": "literal-candidate",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Session saved. Resume-state cleanup could not finish. Try Continue again.",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Set a 10-minute timer to start.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 685,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set a 2-minute timer.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2036,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set a 5-minute prep timer for tonight.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2019,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set a phone bedtime",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1630,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set daily limit",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 24,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Set Downtime to start tonight.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1641,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set the glass down and breathe.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1343,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set the guard reminder, then keep the phone outside the highest-risk room tonight.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 507,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_ACTIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 315,
          "kind": "literal-candidate",
          "surface": "RETENTION_ACTION_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Set the note aside and breathe.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 822,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set the phone down for 30 seconds.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 788,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Set up",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 18,
          "kind": "literal-candidate",
          "surface": "actionFor"
        }
      ],
      "category": "main"
    },
    {
      "source": "Set up adult website protection",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Set up app protection",
      "occurrences": [
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "actionAccessibilityLabel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Set your daily app limit",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 24,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Setbacks recorded",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3231,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 48,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Setting up…",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 52,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "settings",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 59,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Settings > your name > Subscriptions",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 288,
          "kind": "literal-candidate",
          "surface": "getSubscriptionTermsDisclosure"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Settings couldn't open. Find Safari → Extensions in Settings and enable FREED Safari Blocker.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1908,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Setup choice could not be kept for a settings return. Recovery tools remain available.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7205,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Shadow box",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 313,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Shame says a slip erases everything. Data says a slip is a sample with a timestamp, a trigger, and a context. People who recover longest are not the ones who never slip — they are the ones who mine every slip for the pattern behind it.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 59,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Share my recent messages for conversation context",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 34,
          "kind": "jsx",
          "surface": "ClaraCloudControls"
        },
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 34,
          "kind": "attribute",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Shared app-group storage is unavailable for Safari Content Blocker rules.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 2423,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Sharing configured · check readiness",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 69,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Shield and DeviceActivity extensions must be added as app targets before App Store release.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 459,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "shoe",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "generated-target-copy",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Short-form filtering and calibration are unavailable in this release. Use app limits to protect time in distracting apps.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3880,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Show advanced diagnostics",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3890,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Show password",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 344,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 104,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Show setup help",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 62,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "shower",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 39,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Shows protection notices for supported blocks. FREED recovery opens only when you choose.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 13,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1654,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Shows when FREED blocks an adult-domain DNS request. Recovery opens only when you choose.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 16,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 1077,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Shows when FREED's DNS-only adult-domain filter is active.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 7,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt",
          "line": 600,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Sign and date the page.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 634,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sign in",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 353,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign in before uploading an automatic backup.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 38,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sign in to an existing account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 291,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign in to Firebase before deleting your account and hosted data.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8274,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sign in to your account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 288,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign in with email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 323,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 324,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign in with Google",
      "occurrences": [
        {
          "file": "src/components/SocialSignInButtons.native.tsx",
          "line": 79,
          "kind": "attribute",
          "surface": "SocialSignInButtons"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign in with the account that owns your purchases. Recovery history stays on this device.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 292,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign it with today's date.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1049,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sign out",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7060,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sign out of guest account",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7060,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sign-in cancelled. Choose another method or return to Welcome.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 141,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 220,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign-in cancelled. You can choose another method or continue for now.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 141,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 220,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign-in could not be completed. Try again.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 148,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign-in was cancelled.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1497,
          "kind": "copy-property",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Sign-out could not complete. Try again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8206,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "signals",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 46,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Signed in",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 70,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Signed iOS or Android app",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 311,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Signed out. Recovery history stays on this device. Sign in again and restore purchases to recover your membership.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8204,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Signing out of the guest account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Signing out of the guest account…",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 360,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Signing out…",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8195,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Simulate a high-risk adult URL trigger to test the Intercept screen, breathing timer, and earned unlock loop on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3944,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Simulate Adult Intercept",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3947,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "SIMULATION SANDBOX",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3938,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sit back like there is a chair behind you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 105,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sit comfortably and breathe at your natural pace.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 575,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sit comfortably and close your eyes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1864,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sit comfortably and let your shoulders relax.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        },
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sit comfortably with your device, away from water.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 414,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1811,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2129,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 160,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sit cross-legged on the floor.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 240,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sit down and eat it slowly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1562,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sit upright, soft jaw.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 430,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sit with them for 5 full minutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1270,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Skip feedback",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6893,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Skip for now",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 364,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Skip jumps; rise slowly, or use seated arm movement.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 125,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "sleep",
      "occurrences": [
        {
          "file": "functions/src/ai.ts",
          "line": 334,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep Guard",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2912,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep mode ·",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3708,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep mode {{sleepStartTime}}-{{sleepEndTime}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3830,
          "kind": "template-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep on it. Honor it tomorrow.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1943,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sleep quality (optional)",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6217,
          "kind": "literal-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep quality {{level}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6228,
          "kind": "template-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep schedule needs authorization or is off.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep start",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3832,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sleep, work, weekend and strict guards cover only retained individual application selections. FREED cannot select every installed app. Ending one guard keeps overlapping guards in effect.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3824,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Slide down until your thighs are parallel to the floor.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 195,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "slip",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 32,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Slip trigger",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3309,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Slip window",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3308,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Slips",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3144,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3205,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Slower breathing creates a short pause before the next action.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 473,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 277,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Slowly roll up vertebra by vertebra.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 232,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Smart guard",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4274,
          "kind": "jsx",
          "surface": "ReminderSettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Smile and move on.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1254,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Smooth the pillow flat.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1406,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Snapshot could not be saved. Recovery history stays on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7465,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "social",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 40,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Social",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3809,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Social anxiety & numbness",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 561,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Social media",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6304,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Some purchase audit records, fraud-prevention records, tax records, refund or chargeback records, and security logs may need to be retained for legal retention or compliance. FREED does not retain raw receipts or raw purchase tokens in user-facing evidence.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 223,
          "kind": "literal-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Sound cues",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 41,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        },
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 41,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Sound cues are unavailable. You can continue with the visual guide.",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 67,
          "kind": "literal-candidate",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Source: {{host}}",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 15,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1678,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Speak honestly about where you are.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2146,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Speak one kind thought to it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1579,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Splash cold water on face",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1347,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "sponsor",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 57,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Squeeze glutes and brace abs.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 142,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stable local selector found. Confirm to save it, or cancel to discard it.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 31,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 498,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Stair climb",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 276,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand and fold forward, soft knees.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 249,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand and stretch tall",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1613,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand at the top of your mat.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 305,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand back and admire it.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1407,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand in front of a mirror.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1286,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand near a wall for balance.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 395,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand or sit comfortably. Relax your shoulders and notice your feet touching the ground.",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 19,
          "kind": "jsx",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Stand outside for two minutes",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1497,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand still and look up at the sky.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1508,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand tall and reach both arms overhead.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 230,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand tall, feet hip-width apart.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 268,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand tall, feet shoulder-width apart.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 104,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand tall, feet together, arms at sides.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 158,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand up and leave the current room.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 477,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 281,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Stand up and listen.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1526,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand up immediately.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1370,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1623,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand with feet shoulder-width, hands up.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 323,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stand, then squat down and place hands on floor.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 122,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Start challenge",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Start free reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6572,
          "kind": "attribute",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Start free trial",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 274,
          "kind": "literal-candidate",
          "surface": "getPaywallPrimaryActionLabel"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Start in a high plank, hands under shoulders.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 176,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Start one short breathing or environment reset now, then keep the phone out of reach.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 509,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_ACTIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 317,
          "kind": "literal-candidate",
          "surface": "RETENTION_ACTION_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Start practice",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "literal-candidate",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Start recovery",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 24,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 313,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 652,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedInterventionActivity.kt",
          "line": 133,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Start today",
      "occurrences": [
        {
          "file": "src/components/RecoveryHero.tsx",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "RecoveryHero"
        }
      ],
      "category": "main"
    },
    {
      "source": "Start today's check-in",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2986,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        },
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 44,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Start with the next clean hour.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 502,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_HEADLINES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 308,
          "kind": "literal-candidate",
          "surface": "RETENTION_HEADLINE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Starting FREED DNS Guard… The tunnel comes up in a moment.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 616,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Starting protection…",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 55,
          "kind": "literal-candidate",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Stay light on the balls of your feet.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 271,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stay light on the toes, breathe.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 325,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stay loose and breathe with the rhythm.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 161,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stay on the line until you feel steady.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 858,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stay seated in a comfortable position.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 17,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Stay there for at least 5 minutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1373,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stay tight and breathe steadily.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 179,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stay where you are for two quiet minutes.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 492,
          "kind": "literal-candidate",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 296,
          "kind": "literal-candidate",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Stay with the reset, then confirm that you finished. A timer cannot prove physical activity.",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 53,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Steady",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6126,
          "kind": "literal-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Step {{stage}} of {{total}}",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 44,
          "kind": "template-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Step {{value1}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4166,
          "kind": "template-candidate",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Step back to plank, lower, upward dog.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 307,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Step counter",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "Step one leg back, lower the back knee.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 377,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Step outside, no phone.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1507,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Step outside.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 138,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Step your feet back into a plank if comfortable.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 123,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Steps observed",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 49,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Still need support",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Still Need Support",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6892,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Still needed support",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Stop before you are out of breath.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 289,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stop or choose another reset whenever needed.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1357,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1610,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stop waiting",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6047,
          "kind": "jsx",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Stop when comfortable; the timer is a guide.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1544,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2076,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stop when it rings — or keep going if rolling.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2038,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Stop whenever you need.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Store price unavailable",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 64,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        },
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 89,
          "kind": "literal-candidate",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Store prices are unavailable. Retry before subscribing.",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 239,
          "kind": "literal-candidate",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Store prices could not load. Check your connection and retry.",
      "occurrences": [
        {
          "file": "src/components/FunctionalPaywallScreen.tsx",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "FunctionalPaywallScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Straighten your body in one line.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 141,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "streak",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "streak will restart at 0 today. Your personal best stays at",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6332,
          "kind": "jsx",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Stress",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6304,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Stressed",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6128,
          "kind": "literal-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Stretch routine",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 220,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Strict guard: {{value1}} · {{value2}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3825,
          "kind": "template-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Strict Private DNS can change DNS Guard resolver behavior, so FREED guides you to review it before release or device QA.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 299,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Strip the sheets straight.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1404,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Strong",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3784,
          "kind": "copy-property",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 4141,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Subscribe · {{headline}} {{cadence}}",
      "occurrences": [
        {
          "file": "src/lib/store-pricing.ts",
          "line": 276,
          "kind": "template-candidate",
          "surface": "getPaywallPrimaryActionLabel"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Subscribe · {{price}} {{cadence}}",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 85,
          "kind": "literal-candidate",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Subscribe in the iOS or Android app",
      "occurrences": [
        {
          "file": "src/lib/paywall-presenter.ts",
          "line": 57,
          "kind": "literal-candidate",
          "surface": "presentPaywallPlan"
        }
      ],
      "category": "premium"
    },
    {
      "source": "subscription",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 54,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Suggest a meal or a call.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1236,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Suggest a specific day and time.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1168,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "suggestions",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 42,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "support",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 58,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 337,
          "kind": "approved-display-tag",
          "surface": "RETENTION_FOCUS_TAG_CATALOG"
        }
      ],
      "category": "main"
    },
    {
      "source": "Support",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4829,
          "kind": "attribute",
          "surface": "PrivacySupportCard"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7119,
          "kind": "attribute",
          "surface": "ProfileScreen"
        },
        {
          "file": "src/features/legal-pages.tsx",
          "line": 200,
          "kind": "copy-property",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Support-circle reports",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 44,
          "kind": "literal-candidate",
          "surface": "benefits"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Support, legal information and app version",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7089,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7104,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Surf the craving like a wave",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1854,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Sustained short-form session detected. FREED is redirecting to an earned-reset challenge.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt",
          "line": 1581,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Switch — close left, exhale right.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 504,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Switch rooms",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1360,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Switch sides, hold each for 30 seconds.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 242,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Switch to an existing account",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 330,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Take a comfortable breath in and let it out slowly.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take a cool water pause",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 486,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 290,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Take a few nearby steps",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 19,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take a free breathing pause.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 25,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take a fresh photo of the requested object. It is checked on this device.",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 46,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take a guided reset",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6568,
          "kind": "attribute",
          "surface": "InterceptScreen"
        },
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 32,
          "kind": "attribute",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take a moment to rest before deciding what comes next.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 18,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take a short walk or try comfortable basic movement.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 12,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take one calm step.",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 334,
          "kind": "literal-candidate",
          "surface": "normalizeChallenge"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take one comfortable action, then choose what you want to do next.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 9,
          "kind": "copy-property",
          "surface": "timed"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take one new full-face photo.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2056,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Take out the trash",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1429,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Take Photo",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6983,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take three slow breaths",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 471,
          "kind": "copy-property",
          "surface": "AI_APPROVED_CHALLENGES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 275,
          "kind": "copy-property",
          "surface": "APPROVED_CHALLENGE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Take today's pledge",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 43,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "literal-candidate",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take two gentle inhales, then a longer exhale.",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 31,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take verification photo",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6958,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Take your phone in hand.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1387,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Talk",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 28,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 38,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Talk it through",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 26,
          "kind": "copy-property",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Talk it through with local CLARA support.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 28,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 28,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Talk to CLARA...",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5972,
          "kind": "attribute",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Talking to someone trusted",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 565,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Tap Confirm Account & Data Deletion to start deleting cloud account data, then clear this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4791,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Tap Confirm Delete to clear local recovery data from this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4772,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Tap the surface to calibrate. Only its stable view fingerprint stays on this device.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 30,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 405,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Tap to greet your companion.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 35,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedNativeCompanion.kt",
          "line": 28,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Tell that younger self they are safe.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1048,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Tell them in a low-stakes way.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1253,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Tell them today is hard.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 942,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Terms",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 255,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Terms of Service",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7121,
          "kind": "attribute",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Test Intercept & Circuit Breaker",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3941,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Text a parent, sibling, or cousin.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1235,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "text accountability partner",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1658,
          "kind": "literal-candidate",
          "surface": "LEGACY_ID_BY_PREFIX"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Text accountability partner",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 828,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Thank them honestly after.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1307,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Thank them honestly before hanging up.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 859,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Thanks — noted on this device",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6564,
          "kind": "literal-candidate",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "That domain is already on the local exception list.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2745,
          "kind": "literal-candidate",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "That sign-in belongs to an existing account.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 297,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "That target has no allowlisted resource ID, role, and ancestor roles. Retry or choose a vetted preset.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 490,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The 4-count hold is optional; skip it whenever needed.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 449,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "The 7-count hold is optional; skip it whenever needed.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 432,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 127,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "The active app no longer exposes a usable Accessibility tree. No selector was stored.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 480,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The Android VPN approval dialog should be on screen now. Tap OK so FREED can start DNS Guard, which routes DNS resolver IPs only for adult-domain blocking.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 579,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The app break could not be confirmed or recorded. Your completed activity is saved; check Protect for current status.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8435,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "The app guard could not sync. Check permissions and targets, then retry saving this mode.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 83,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "The backup could not be uploaded. Recovery data remains on this device.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 42,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "The before-use default is inactive until you save a guard mode.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3740,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "The browser could not open. Open the test address in your browser and check the result.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 87,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        },
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "The challenged application authority is no longer available.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 663,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The connection didn't start in time. Retry, or check whether another VPN is active.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2485,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "The connection hasn't started. Retry, or check whether another VPN is active.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2652,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "The difference is framing. \"I can't watch that\" sounds like deprivation imposed from outside. \"I don't watch that\" sounds like a fact about who you are. Reframing from can't to don't has been shown to measurably improve refusal rates.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 34,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "The effect is fast. Studies find measurable reductions in craving intensity after even five to ten minutes of moderate movement, with the strongest effects for outdoor walking and brief intense effort like stairs or jumping jacks.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "The email or password is incorrect. Try again or reset your password.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1499,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1500,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1501,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "The guest account could not be signed out. Try again before switching accounts.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 181,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "The iOS DeviceActivity activity limit would be exceeded.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 1646,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The local exception list is full (200 domains).",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2749,
          "kind": "literal-candidate",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "The local Focus Shield rule store is degraded or stale. Remove and re-add affected rules.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 80,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The method is simple. After a slip, log three things: the time window, the trigger (boredom, stress, loneliness, late night), and the missing guardrail. One slip is noise. Three slips with the same trigger are a route map, and routes can be blocked.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 60,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "The native application break could not be persisted. Previous protection was retained.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 681,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The password could not be confirmed. Try again.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 70,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "The passwords do not match. Enter them again.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 237,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "The photo is checked on this device, then deleted.",
      "occurrences": [
        {
          "file": "src/data/momentum-resets.ts",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "MOMENTUM_RESET_TEMPLATES"
        }
      ],
      "category": "main"
    },
    {
      "source": "The plan for this date was not retained. Available practice records are shown below.",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 46,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "The practical move: when an urge hits, start a timer, take three slow breaths, and describe the sensation like a reporter — where it lives in your body, how strong it is out of ten. Observing an urge reliably shrinks it faster than fighting it.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 22,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "The preview keeps recovery state local and does not simulate device-wide monitoring.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 316,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The public account deletion URL is {{ACCOUNT_DELETION_URL}}. Contact support if you cannot access the app.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 231,
          "kind": "template-candidate",
          "surface": "AccountDeletionPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "The recovery account changed or analytics is unavailable.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7433,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "The recovery account changed or secure checkout is unavailable. Try again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8158,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "The recovery account changed. Try this action again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-native.ts",
          "line": 385,
          "kind": "literal-candidate",
          "surface": "getFirebaseCallableContracts"
        }
      ],
      "category": "account"
    },
    {
      "source": "The recovery backup could not be encrypted on this device.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 41,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "The reframe that matters: you are not a person who failed. You are an analyst holding a new data point. Analysts adjust the plan and continue. That is also, not coincidentally, exactly what your streak statistics do — they keep counting.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 62,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "The reset email could not be sent.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 93,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "The reset email could not be sent. Try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 750,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "The Safari Focus Shield extension is unavailable in this iOS build, so supported short-form web routes cannot hand off to recovery.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 112,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The saved analytics window changed. Retry sync; recovery history stays on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7447,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "The secure local backup key could not be accessed.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 40,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "The secure local backup key could not be removed.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 220,
          "kind": "literal-candidate",
          "surface": "createAutomaticBackupController"
        }
      ],
      "category": "main"
    },
    {
      "source": "The secure local backup key could not be saved.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 206,
          "kind": "literal-candidate",
          "surface": "createAutomaticBackupController"
        }
      ],
      "category": "main"
    },
    {
      "source": "The selected app did not expose a usable Accessibility tree. Retry there or choose a vetted preset.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 384,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The selector did not pass local safety checks. Nothing was stored; retry or choose a vetted preset.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 587,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The signed-in account changed. Cancel and confirm deletion again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8267,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "The signed-in account changed. Try backup again after confirming your account.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 44,
          "kind": "literal-candidate",
          "surface": "MESSAGES"
        }
      ],
      "category": "main"
    },
    {
      "source": "The system reports only that selected opaque Screen Time tokens crossed a duration threshold.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 184,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The temporary Accessibility overlay could not be created. No selector was stored.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 285,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedFocusShieldCalibration.kt",
          "line": 468,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "The verification email could not be sent. Try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 763,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "The VPN dialog could not open, so FREED opened its app info page instead. Return and tap Start DNS Guard again; if it keeps failing, restart the phone and try once more.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 581,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "These choices become Android app guard targets. On iOS, you will choose the actual apps and websites in Apple's Screen Time picker during setup.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1077,
          "kind": "jsx",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Think of someone going through something hard.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1321,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "This account is unavailable. Contact FREED support.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1507,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "This action could not be completed. Check your connection and try again.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 164,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "This action could not be saved. Your previous record is safe. Try again.",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 67,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "This action could not open on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4761,
          "kind": "literal-candidate",
          "surface": "PrivacySupportCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "This Android build does not expose the Accessibility-backed Focus Shield capability.",
      "occurrences": [
        {
          "file": "src/lib/protection-capabilities.ts",
          "line": 75,
          "kind": "literal-candidate",
          "surface": "getFocusShieldCapabilityModel"
        }
      ],
      "category": "protection"
    },
    {
      "source": "This build needs native protection support to finish setup.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 37,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "This check does not open websites or verify real browser or network blocking.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 36,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "This data is not permitted in Firebase AI callable payloads.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1390,
          "kind": "literal-candidate",
          "surface": "invalidAiRequest"
        }
      ],
      "category": "account"
    },
    {
      "source": "This data is not permitted in Firebase callable payloads.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1404,
          "kind": "literal-candidate",
          "surface": "assertCallablePayload"
        }
      ],
      "category": "account"
    },
    {
      "source": "This data is not permitted in Firebase purchase callable payloads.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1441,
          "kind": "literal-candidate",
          "surface": "invalidPurchaseRequest"
        }
      ],
      "category": "account"
    },
    {
      "source": "This deletes the guest account, hosted data, and recovery history on this device. This cannot be undone.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "This entry could not be saved. Your changes are still here. Free up space and try again.",
      "occurrences": [
        {
          "file": "src/hooks/use-recovery-draft.ts",
          "line": 66,
          "kind": "literal-candidate",
          "surface": "useRecoveryDraft"
        }
      ],
      "category": "main"
    },
    {
      "source": "This feature is unavailable in this build. Recovery tools remain available.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 45,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "This installed build does not support the saved app guard mode.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 53,
          "kind": "literal-candidate",
          "surface": "syncNativeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "This is not a valid Firebase email sign-in link.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 694,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        },
        {
          "file": "src/lib/firebase-client.ts",
          "line": 816,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "This is why FREED's challenges lean physical — cold showers, walks, stretches, exercise snacks. You are not distracting yourself. You are giving the reward system a better offer at the exact moment it is listening.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 49,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "This is your own exercise record. It does not verify a guided session or unlock protected apps.",
      "occurrences": [
        {
          "file": "src/components/BasicMovementScreen.tsx",
          "line": 19,
          "kind": "jsx",
          "surface": "BasicMovementScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This link could not open. Check your connection and try again.",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 93,
          "kind": "literal-candidate",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "This optional activity gives you a concrete task away from the current loop. Adapt it to your space and comfort, or choose another reset.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1338,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1356,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1368,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1385,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1402,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1419,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1437,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1454,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1471,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1488,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1505,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1522,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1539,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1557,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1574,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1591,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1609,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1621,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1638,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1843,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1976,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1995,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2014,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2033,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "This optional reflection makes space to write or notice what matters to you. You choose what to share; no outcome is guaranteed.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 611,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 629,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 646,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 663,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 681,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 698,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 715,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 732,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 749,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 766,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 783,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 800,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 817,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 975,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 993,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1010,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1027,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1044,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1061,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1078,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1095,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1112,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1129,
          "kind": "copy-property",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1881,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1919,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1938,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1957,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2052,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2090,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2109,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2161,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "This permission is requested only when a matching recovery challenge needs it.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2081,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This permission isn't available in the installed build. Open Help for your options.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2654,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This photo target is still being validated. Choose a different reset.",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 41,
          "kind": "copy-property",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "This platform does not support local site exceptions. If an ordinary site is blocked, open Privacy & support for wrong-block help.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2764,
          "kind": "jsx",
          "surface": "AlwaysAllowSection"
        }
      ],
      "category": "main"
    },
    {
      "source": "This replaces this device’s history with the selected backup. Create a backup of current progress first if you want to keep both. Membership and device permissions are checked separately.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 9010,
          "kind": "jsx",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "This request already reached the service. Send a new message to continue.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "This reset could not be saved. Try again after checking storage.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6696,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This reset interrupts the loop and gives your mind time to settle.",
      "occurrences": [
        {
          "file": "src/lib/challenge-generator.ts",
          "line": 335,
          "kind": "literal-candidate",
          "surface": "normalizeChallenge"
        }
      ],
      "category": "main"
    },
    {
      "source": "This reset is unavailable right now. Choose one of the alternatives below.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6694,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This saved reset needs a supported verification rule. Choose a new reset.",
      "occurrences": [
        {
          "file": "src/lib/challenge-capability.ts",
          "line": 37,
          "kind": "copy-property",
          "surface": "getChallengeCapability"
        }
      ],
      "category": "main"
    },
    {
      "source": "this setup step",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2612,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This sign-in method is unavailable right now. Try another method.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1506,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "This snapshot uses aggregate counts and rates. Private notes, contacts, and browsing details are excluded.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3225,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This step could not finish. Your recovery tools remain available. Try again.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 73,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "This step couldn't finish. Try again, or open Help for details.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1915,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 2409,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This step hasn't completed yet. You can retry or open Help.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2655,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "This step is still incomplete. Approve the request in system settings, then return and check again.",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 72,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Three small wins log",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1104,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Throw jab-cross, then a hook.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 324,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Tidy your digital space",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1583,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Tidy your space",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1411,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "time",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 21,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 55,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Time in this cycle",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 998,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Times use this device's local clock. Equal start and end times create no active window.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3826,
          "kind": "jsx",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Timing, permission and daily prompts",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7085,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 7098,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Tired",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6304,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "To keep this guest account recoverable, connect an Apple, Google, or email sign-in that is not already used by another account.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 331,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "to next",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3032,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "To protect you from explicit content and doomscroll loops, FREED needs these permissions to monitor only selected apps and sites through platform APIs, block known adult domains, and open a recovery challenge when a harmful site, search, or app-limit threshold is reached.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 39,
          "kind": "literal-candidate",
          "surface": "PROTECTION_PERMISSION_EXPLANATION"
        }
      ],
      "category": "protection"
    },
    {
      "source": "To sign in, first switch away from this guest account.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 297,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Today",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 10,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Today recovery plan",
      "occurrences": [
        {
          "file": "src/design-system/navigation.ts",
          "line": 10,
          "kind": "copy-property",
          "surface": "ROOT_DESTINATIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Toggles FREED app timer protection for {{label}}.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1093,
          "kind": "template-candidate",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Too many attempts. Wait a little before trying again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 1504,
          "kind": "literal-candidate",
          "surface": "authErrorResult"
        }
      ],
      "category": "account"
    },
    {
      "source": "Top-Off Inhale",
      "occurrences": [
        {
          "file": "src/components/FunctionalBreathingScreen.tsx",
          "line": 31,
          "kind": "copy-property",
          "surface": "FunctionalBreathingScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Toss it. Notice the lighter weight.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1441,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Track clouds or birds with your eyes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1999,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Trigger pattern map",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 724,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Trusted contacts and help when you need it",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7075,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Trusted contacts and support-circle reports",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7103,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Try a comfortable breath. You can stop whenever you need.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 542,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Try comfortable movement and optionally record exercise yourself.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 26,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Tuck the corners properly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1405,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Turn Off",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3286,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Turn off automatic backup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4564,
          "kind": "literal-candidate",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Turn on FREED Safari Blocker, then return here. On older iPhones, find Safari → Extensions in Settings.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 25,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Turn on protection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 22,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Turn on web protection",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 22,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Turning this off stops future messages. A request already sent may finish. Built-in guidance remains available.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 28,
          "kind": "jsx",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Two-minute prayer or pause",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1949,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Type",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4123,
          "kind": "attribute",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Unavailable in this build",
      "occurrences": [
        {
          "file": "src/components/ProtectionFeatureSetup.tsx",
          "line": 114,
          "kind": "literal-candidate",
          "surface": "ProtectionFeatureSetup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Unavailable on this platform · wrong-block help available",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 63,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Unclench your hands, exhale slowly, and choose one small task for the next five minutes. A simple action can lower the pressure.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 465,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_CLARA_COPY"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 266,
          "kind": "literal-candidate",
          "surface": "CLARA_REPLY_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Under 1 year",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 553,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "Underneath, write the actual truth.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 996,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Understand urges",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5957,
          "kind": "copy-property",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "Unlock",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3763,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Unsupported on iOS · wrong-block help available",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 63,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Unsupported purchase platform.",
      "occurrences": [
        {
          "file": "src/lib/purchase-verification.ts",
          "line": 378,
          "kind": "literal-candidate",
          "surface": "validateRequest"
        }
      ],
      "category": "main"
    },
    {
      "source": "Updating protection…",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3701,
          "kind": "jsx",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/components/ProtectOverview.tsx",
          "line": 47,
          "kind": "jsx",
          "surface": "ProtectOverview"
        }
      ],
      "category": "main"
    },
    {
      "source": "Upgrade",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4071,
          "kind": "attribute",
          "surface": "CustomChallengeScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 5074,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Upload Backup",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4678,
          "kind": "jsx",
          "surface": "RecoveryBackupCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Urge Control",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2911,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Urge estimate",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3088,
          "kind": "attribute",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 51,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 51,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "URGE ESTIMATE",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3109,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Urge journal entry",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 638,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Urge level",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6189,
          "kind": "literal-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Urge level {{level}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6200,
          "kind": "template-candidate",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Urge Passed",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6891,
          "kind": "attribute",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Urge right now",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5950,
          "kind": "copy-property",
          "surface": "CoachPanel"
        }
      ],
      "category": "main"
    },
    {
      "source": "URL",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 23,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 23,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "URL Check",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3715,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 3895,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Usage Access",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 254,
          "kind": "literal-candidate",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Usage Access could not open, so FREED app info is open instead. App info cannot enable this permission. Go to Android Settings > Special app access > Usage access > FREED, allow access, then return to FREED.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 343,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Usage Access is controlled by Android Settings. After enabling FREED, return to setup so the activation test can verify protection.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 27,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt",
          "line": 80,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Usage Access lets FREED cross-check selected app timers without reading in-app content.",
      "occurrences": [
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt",
          "line": 131,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Usage access lets FREED know when your selected apps reach their daily limit.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 28,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Usage Access stays limited to app timers.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 26,
          "kind": "native-resource",
          "surface": "native-android-resource"
        },
        {
          "file": "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt",
          "line": 63,
          "kind": "native-resource",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Usage timer checks",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 253,
          "kind": "copy-property",
          "surface": "buildLegacyProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Use a backup passphrase of 8 to 512 characters.",
      "occurrences": [
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 193,
          "kind": "literal-candidate",
          "surface": "createAutomaticBackupController"
        },
        {
          "file": "src/lib/automatic-backup.ts",
          "line": 316,
          "kind": "literal-candidate",
          "surface": "enableAutomaticBackup"
        }
      ],
      "category": "main"
    },
    {
      "source": "Use a different email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 357,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Use a password with at least 8 characters.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 724,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Use at least 8 characters.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 346,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Use Delete Local Data in Profile for this device, or Delete Account & Data to request account and account-linked hosted data deletion. Store and Google records follow their own terms. Some purchase, fraud-prevention, security, tax, refund or chargeback records may require legal retention.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 132,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Use draft today",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 31,
          "kind": "jsx",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Use each step and a handrail if available.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 288,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Use fewer repetitions if comfortable; stop or switch resets whenever needed.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 116,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Use guided breathing if helpful, then record the time you took.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 14,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Use headphones if comfortable; keep eyes open if preferred.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2075,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Use right thumb to close right nostril.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 502,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Use the FREED iOS or Android app to sign in with Google or Apple.",
      "occurrences": [
        {
          "file": "src/lib/social-login-presenter.ts",
          "line": 27,
          "kind": "literal-candidate",
          "surface": "presentSocialLogin"
        }
      ],
      "category": "account"
    },
    {
      "source": "Use the pattern without judging yourself.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 503,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_HEADLINES"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 309,
          "kind": "literal-candidate",
          "surface": "RETENTION_HEADLINE_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "Use this page for privacy requests, store review contact, account deletion, billing help, and protection setup issues.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 146,
          "kind": "attribute",
          "surface": "SupportPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Use your email to keep your account recoverable.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 293,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Uses Apple FamilyControls authorization when entitlement is granted.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 456,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Uses foreground app events to enforce configured daily limits for selected packages.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Uses foreground app events to enforce the saved guard mode for selected packages.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 100,
          "kind": "literal-candidate",
          "surface": "buildProtectionPermissionPlan"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Uses ManagedSettings web content policy for adult filtering.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 457,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Uses Safari extensions with explicit host access for adult-domain and short-form web protection.",
      "occurrences": [
        {
          "file": "modules/freed-protection/ios/FreedProtectionModule.swift",
          "line": 458,
          "kind": "native-output",
          "surface": "native-user-facing-output"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Values check",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 673,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Verification email sent. Check your inbox and spam folder.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 265,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 274,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Verification required",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 74,
          "kind": "literal-candidate",
          "surface": "getFeatureStatus"
        }
      ],
      "category": "main"
    },
    {
      "source": "Verification unavailable",
      "occurrences": [
        {
          "file": "src/lib/challenge-verification.ts",
          "line": 45,
          "kind": "copy-property",
          "surface": "getChallengeVerificationRequirement"
        }
      ],
      "category": "main"
    },
    {
      "source": "Verified access ended",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7044,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Verified Premium access",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7044,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Verifies a fresh photo challenge only when the user opens the camera for that challenge.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 462,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 501,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Verifies outdoor movement challenges with accurate foreground location samples only after the user starts that challenge.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 484,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 523,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Verifies walking, outdoor movement, exercise, or photo challenges only when the user starts that challenge.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 539,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Verifies walking, step, or exercise challenges only while the active challenge is running.",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 473,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 512,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Verify Action",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7017,
          "kind": "literal-candidate",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Verify membership to open this report.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8490,
          "kind": "jsx",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Verify your email",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 291,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "View history",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 61,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "View milestones and recovery history",
      "occurrences": [
        {
          "file": "src/components/RecoveryHero.tsx",
          "line": 25,
          "kind": "attribute",
          "surface": "RecoveryHero"
        }
      ],
      "category": "main"
    },
    {
      "source": "View this day",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 52,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Visit",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3922,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Voice memo of where you are",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1174,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Voice note to mentor",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 863,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "VPN permission granted! Starting DNS Guard now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2233,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "VPN permission was denied. Tap Start DNS Guard to try again.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2240,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Wait before doing anything else.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 171,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Wait for a reply before doing anything.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1306,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Wait for any reply before doing anything else.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 841,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Waiting for the native adult-domain feed to sync before activation.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1849,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Wake",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3833,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Walk at your own pace, no destination.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 214,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk away without looking back.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1390,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk corridors, stairs, or the block.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1827,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk for two minutes to warm up.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 342,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk it to another room or drawer.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1388,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "walk outside",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1655,
          "kind": "literal-candidate",
          "surface": "LEGACY_ID_BY_PREFIX"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk outside",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 202,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk outside for five minutes",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 131,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Walk to a different room.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1371,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk to the dumpster or curb.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1440,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk to the nearest window.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1490,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk to the sink.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1473,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walk up and down at a steady pace.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 287,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Walking and exercise verification",
      "occurrences": [
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 468,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        },
        {
          "file": "src/lib/protection-permissions.ts",
          "line": 507,
          "kind": "copy-property",
          "surface": "sharedOnDemandPermissionSteps"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Wall sit",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 184,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "want to die",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 499,
          "kind": "literal-candidate",
          "surface": "isCrisisSupportInput"
        }
      ],
      "category": "main"
    },
    {
      "source": "Wash hands.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1560,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Watch a 5-minute laugh clip",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1968,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Watch exactly five minutes.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1979,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Watch one ad — start this guided challenge",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Watch the sky for 5 minutes",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1987,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Water at a comfortable temperature is optional; keep your device dry.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 414,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1811,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        },
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2129,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Water it slowly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1577,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "We'll apply the filter and take you to app selection.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 22,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "We'll prepare the list, then open Android's connection request.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 26,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "We'll send a secure link to reset your password.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 295,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Web filtering is inactive. Check DNS Guard health in Shield to resolve this network’s settings.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2268,
          "kind": "literal-candidate",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Web filtering is inactive. Return to protection setup to check the connection.",
      "occurrences": [
        {
          "file": "src/lib/dns-guard-health.ts",
          "line": 28,
          "kind": "literal-candidate",
          "surface": "dnsGuardCoverageMessage"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Web filtering is paused. Sign in to this Wi-Fi network; FREED will check it again afterward.",
      "occurrences": [
        {
          "file": "src/lib/dns-guard-health.ts",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "dnsGuardCoverageMessage"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Web safety",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3846,
          "kind": "literal-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "websites",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 19,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 22,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "week",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 49,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Weekend adventure mode",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3841,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Weekly Report",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3135,
          "kind": "literal-candidate",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 49,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 49,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 26,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Weekly sponsor report",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 5037,
          "kind": "jsx",
          "surface": "AccountabilitySettingsCard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Welcome back",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 290,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "What did I do just before this urge?",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 648,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "What FREED will do",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6329,
          "kind": "literal-candidate",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "What happened right before it? What would make the next hour safer?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6379,
          "kind": "attribute",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "What happened? What helped? What do you need next?",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 32,
          "kind": "attribute",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "What happens next",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 52,
          "kind": "attribute",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "What helps you reset and ground fastest?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 564,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "What is one small action you can complete now?",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 515,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_CHECK_INS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 324,
          "kind": "literal-candidate",
          "surface": "RETENTION_CHECK_IN_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "What is the first safer move when the pattern appears?",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 516,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_CHECK_INS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 325,
          "kind": "literal-candidate",
          "surface": "RETENTION_CHECK_IN_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "What is the smallest change that would make the next hour easier?",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 514,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_CHECK_INS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 323,
          "kind": "literal-candidate",
          "surface": "RETENTION_CHECK_IN_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "What is your main reason for changing?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 548,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "What small barrier would make the next risky tap less automatic?",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 517,
          "kind": "literal-candidate",
          "surface": "AI_REMOTE_RETENTION_CHECK_INS"
        },
        {
          "file": "functions/src/ai.ts",
          "line": 326,
          "kind": "literal-candidate",
          "surface": "RETENTION_CHECK_IN_CATALOG"
        }
      ],
      "category": "account"
    },
    {
      "source": "What story am I telling myself?",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 650,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "What symptoms affect your daily life most?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 560,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "What this means for you:",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 2554,
          "kind": "jsx",
          "surface": "ProtectionSetupScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "What triggered you? What helped?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6254,
          "kind": "attribute",
          "surface": "CheckInScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "What unmet need is hiding behind this urge?",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1097,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "What would relapse cost me tomorrow?",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 651,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "When are urges most likely to strike?",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 556,
          "kind": "literal-candidate",
          "surface": "quiz"
        }
      ],
      "category": "main"
    },
    {
      "source": "when bored",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2189,
          "kind": "literal-candidate",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "when feeling alone",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2191,
          "kind": "literal-candidate",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "when stressed",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2190,
          "kind": "literal-candidate",
          "surface": "buildAll"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "When you need a moment",
      "occurrences": [
        {
          "file": "src/features/library-screen.tsx",
          "line": 31,
          "kind": "attribute",
          "surface": "LibraryScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Where do I feel it in my body?",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 649,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Why movement helps cravings",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 41,
          "kind": "copy-property",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Why this works for you",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4104,
          "kind": "attribute",
          "surface": "CustomChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Willpower is a sprinter. Identity is a marathon runner. Studies on self-control consistently find that people who rely on raw resistance burn out, while people who see themselves as \"someone who doesn't do that anymore\" barely experience a fight at all.",
      "occurrences": [
        {
          "file": "src/data/library-articles.ts",
          "line": 33,
          "kind": "literal-candidate",
          "surface": "LIBRARY_ARTICLES"
        }
      ],
      "category": "articles"
    },
    {
      "source": "Wim Hof rounds",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 564,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Win review",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 741,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Windows use the local device clock. Overlapping guards stay independent. A ready schedule can be outside its active window.",
      "occurrences": [
        {
          "file": "src/lib/app-guard.ts",
          "line": 30,
          "kind": "literal-candidate",
          "surface": "describeAppGuard"
        }
      ],
      "category": "main"
    },
    {
      "source": "Wipe it down quickly.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1423,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "With analytics consent, FREED sends absolute UTC-day counts of check-ins and completed challenges for a 14-day window, plus schema and consent versions, opt-in time, and lineage, revision and snapshot identifiers. Records link to your authenticated account UID. Derived rates, streak summaries and challenge categories stay local. Raw URLs, search text, private notes, exact selected app tokens and exact coordinates are excluded.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 111,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "With cloud-chat consent, messages you deliberately send to CLARA are processed by Google Cloud's Gemini service through FREED. If you choose to share conversation context, up to six recent user-authored messages may be included. Browsing activity, journal entries, photos and Screen Time data are not automatically attached. Challenge selection and retention planning stay local. Processing may happen outside your country.",
      "occurrences": [
        {
          "file": "src/features/legal-pages.tsx",
          "line": 112,
          "kind": "literal-candidate",
          "surface": "PrivacyPolicyPage"
        }
      ],
      "category": "legal"
    },
    {
      "source": "Work at a comfortable pace; pauses are welcome.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2037,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Work end",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3839,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Work hours {{workStartTime}}-{{workEndTime}}",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3836,
          "kind": "template-candidate",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Work start",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3838,
          "kind": "attribute",
          "surface": "ShieldScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Worst-case rehearsal",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1002,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 4128,
          "kind": "copy-property",
          "surface": "CustomChallengeScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 27,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 27,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 38,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Write 'Dear future me…'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 631,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write 1 thing you are looking forward to.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1885,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write 2 people you appreciate today.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1884,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write 3 things you have right now.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1883,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write a permission slip",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1121,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write a private reflection directly.",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 27,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 27,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Write a short shopping list.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2018,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write down the next few activities you choose.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2112,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write it in one sentence.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1098,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write one action that honors it today.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 684,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write one honest reflection about what helped or felt difficult.",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 13,
          "kind": "literal-candidate",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Write one specific promise for tomorrow.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1940,
          "kind": "literal-candidate",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write the answer in their voice.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 804,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write the date and the time.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 614,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write the thought driving the urge.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 995,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write three reasons",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 142,
          "kind": "copy-property",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "write three reasons you quit",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1656,
          "kind": "literal-candidate",
          "surface": "LEGACY_ID_BY_PREFIX"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write three reasons you quit",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 603,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write three wins from this morning.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1114,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write what is on your mind. Your note stays private on this device.",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 29,
          "kind": "attribute",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Write what they have done for you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 959,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write what you wish someone had told you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1047,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write what you would tell them.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 769,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write what you would tell today's you.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 720,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write where you feel tight or loose.",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 820,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write who benefits.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 149,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Write why you started.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 149,
          "kind": "literal-candidate",
          "surface": "challengeLibrary"
        }
      ],
      "category": "main"
    },
    {
      "source": "Write your one purpose sentence",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 2153,
          "kind": "copy-property",
          "surface": "CURATED_EXTRAS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "Write: 'I give myself permission to ___.'",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 1131,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "XP",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 3029,
          "kind": "jsx",
          "surface": "AnalyticsScreen"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "search-keyword",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 47,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Yoga sun salutations",
      "occurrences": [
        {
          "file": "src/data/challenge-templates.ts",
          "line": 294,
          "kind": "literal-candidate",
          "surface": "SEEDS"
        }
      ],
      "category": "challenges"
    },
    {
      "source": "You are still here. Logging this gives the recovery engine a cleaner pattern and starts the next honest streak now.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6325,
          "kind": "jsx",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "You can explore recovery tools here.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 32,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "You can stop whenever you need",
      "occurrences": [
        {
          "file": "src/components/MomentumBreathingView.tsx",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "MomentumBreathingView"
        }
      ],
      "category": "main"
    },
    {
      "source": "You control what FREED protects.",
      "occurrences": [
        {
          "file": "src/components/ProtectionSetupView.tsx",
          "line": 35,
          "kind": "jsx",
          "surface": "ProtectionSetupView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6332,
          "kind": "jsx",
          "surface": "SlipLogScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your account changed. Close this screen and try again.",
      "occurrences": [
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 46,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 60,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 62,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        },
        {
          "file": "src/components/AccountReauthenticationScreen.tsx",
          "line": 82,
          "kind": "literal-candidate",
          "surface": "AccountReauthenticationScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your account changed. Return to account options and try again.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 175,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 195,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 224,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 254,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 271,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        },
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 279,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your account could not be refreshed. Try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 774,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your account is connected",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 288,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your app boundary is active. Choose Start recovery to get support.",
      "occurrences": [
        {
          "file": "src/i18n/native-android-catalog.json",
          "line": 22,
          "kind": "native-resource",
          "surface": "native-android-resource"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your app break was confirmed. Protection returns when it ends.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8432,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your choice works for this session, but could not be saved on this device. Retry saving before your next restart.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 8081,
          "kind": "copy-property",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your cloud chat preference could not be saved. Cloud chat stays off until it is saved.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 37,
          "kind": "jsx",
          "surface": "ClaraCloudControls"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your completed activity is saved. How you feel is optional.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6890,
          "kind": "jsx",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your completed reset is ready to save.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6849,
          "kind": "jsx",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your completed reset is waiting to be saved. Try saving again after checking storage.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7493,
          "kind": "literal-candidate",
          "surface": "FreedAppProvider"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your daily cloud reply allowance is used. Built-in guidance remains available.",
      "occurrences": [
        {
          "file": "src/components/ClaraCloudControls.tsx",
          "line": 11,
          "kind": "literal-candidate",
          "surface": "STATUS"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your daily plan",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 66,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your daily plan is recorded. Support stays available whenever you need it.",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your daily record",
      "occurrences": [
        {
          "file": "src/lib/practice-definitions.ts",
          "line": 11,
          "kind": "copy-property",
          "surface": "practiceDefinitions"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your device's store confirms the subscription and final charge.",
      "occurrences": [
        {
          "file": "src/components/PremiumOffer.tsx",
          "line": 115,
          "kind": "attribute",
          "surface": "PremiumOffer"
        }
      ],
      "category": "premium"
    },
    {
      "source": "Your draft could not be kept on this device. Free up space and try again before leaving.",
      "occurrences": [
        {
          "file": "src/hooks/use-recovery-draft.ts",
          "line": 56,
          "kind": "literal-candidate",
          "surface": "useRecoveryDraft"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your draft could not be loaded. Check device storage and try again.",
      "occurrences": [
        {
          "file": "src/hooks/use-recovery-draft.ts",
          "line": 36,
          "kind": "literal-candidate",
          "surface": "useRecoveryDraft"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your draft stays on this device until you save.",
      "occurrences": [
        {
          "file": "src/hooks/use-recovery-draft.ts",
          "line": 89,
          "kind": "literal-candidate",
          "surface": "useRecoveryDraft"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your email account could not be created. Try again.",
      "occurrences": [
        {
          "file": "src/lib/firebase-client.ts",
          "line": 733,
          "kind": "literal-candidate",
          "surface": "createFirebaseAuthAdapter"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your email is not verified yet. Open the link in your email, then check again.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 285,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your FREED account",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7065,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your goal",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 998,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        },
        {
          "file": "src/features/freed-app.tsx",
          "line": 1006,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your guest account is still here",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 291,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your interrupted activity is ready to resume.",
      "occurrences": [
        {
          "file": "src/components/FunctionalToday.tsx",
          "line": 32,
          "kind": "copy-property",
          "surface": "FunctionalToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your journal entries",
      "occurrences": [
        {
          "file": "src/components/JournalScreen.tsx",
          "line": 37,
          "kind": "literal-candidate",
          "surface": "JournalScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "YOUR NEXT STEP",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 65,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "your partner",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6550,
          "kind": "literal-candidate",
          "surface": "InterceptScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your plan could not be saved. If the day changed, close this sheet and choose today’s practices again.",
      "occurrences": [
        {
          "file": "src/components/MomentumToday.tsx",
          "line": 72,
          "kind": "jsx",
          "surface": "MomentumToday"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your progress stays on this device while you connect an account.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 364,
          "kind": "jsx",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your protection is still active. Choose how to start.",
      "occurrences": [
        {
          "file": "src/components/GuidedResetOffer.tsx",
          "line": 32,
          "kind": "literal-candidate",
          "surface": "GuidedResetOffer"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your recorded days",
      "occurrences": [
        {
          "file": "src/components/RecoveryHistory.tsx",
          "line": 33,
          "kind": "jsx",
          "surface": "RecoveryHistory"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your recovery history stays private on this device.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7065,
          "kind": "attribute",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your Recovery Preferences",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1003,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your required permissions and local configuration checks passed on this device.",
      "occurrences": [
        {
          "file": "src/lib/protection-setup-presenter.ts",
          "line": 34,
          "kind": "copy-property",
          "surface": "presentProtectionSetup"
        }
      ],
      "category": "protection"
    },
    {
      "source": "Your reset is complete. Choose what helps next.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 6884,
          "kind": "jsx",
          "surface": "ChallengeScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your routine",
      "occurrences": [
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "feature-copy",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/lib/feature-catalogue.ts",
          "line": 41,
          "kind": "literal-candidate",
          "surface": "FEATURE_DEFINITIONS"
        },
        {
          "file": "src/components/FeatureDirectory.tsx",
          "line": 25,
          "kind": "literal-candidate",
          "surface": "FocusedFeatureContent"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your safety matters more than the streak. If you might hurt yourself or cannot stay safe, contact emergency help now. In the U.S., call or text 988 for crisis support; if there is immediate danger, call emergency services or go to the nearest ER. Stay near another person while you get support.",
      "occurrences": [
        {
          "file": "src/lib/recovery-engine.ts",
          "line": 521,
          "kind": "literal-candidate",
          "surface": "generateCoachReply"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your selection stays with Apple.",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 1130,
          "kind": "jsx",
          "surface": "AppSelectionScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your session could not be saved. The result is still here. Try again.",
      "occurrences": [
        {
          "file": "src/components/ToolCompletionView.tsx",
          "line": 21,
          "kind": "literal-candidate",
          "surface": "ToolCompletionView"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your sign-in is connected. Continue to return to FREED.",
      "occurrences": [
        {
          "file": "src/components/AccountAccessScreen.tsx",
          "line": 292,
          "kind": "literal-candidate",
          "surface": "AccountAccessScreen"
        }
      ],
      "category": "account"
    },
    {
      "source": "Your space",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 7065,
          "kind": "literal-candidate",
          "surface": "ProfileScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "YOUR STARTING POINT",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 976,
          "kind": "jsx",
          "surface": "QuizScreen"
        }
      ],
      "category": "main"
    },
    {
      "source": "Your trigger",
      "occurrences": [
        {
          "file": "src/features/freed-app.tsx",
          "line": 998,
          "kind": "literal-candidate",
          "surface": "PlanCalculationScreen"
        }
      ],
      "category": "main"
    }
  ]
} as const;
