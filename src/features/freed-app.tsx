import { recoveryDnsAudienceResolution } from '@/lib/recovery-dns-availability';
import { makeEarnedTimeReference, readEarnedTimeReference, writeEarnedTimeReference, clearEarnedTimeReference, recoverEarnedTimeReference, EARNED_TIME_REFERENCE_PREFIX } from '@/lib/earned-time-reference';
import { prepareLiveEarnedAppTimeGrant, presentNativeAppBreak, isEarnedOfferAdFeasible, type LiveEarnedOfferSelection, type PresentedNativeAppBreak, type LiveEarnedBreakOrigin } from '@/lib/live-earned-app-time';
import { captureEarnedResetTemplate, matchesEarnedResetTemplate, getEarnedResetChoices, getEarnedResetNativeRequirement } from '@/lib/earned-reset-templates';
import { useEarnedChallengeEvidence } from '@/hooks/useEarnedChallengeEvidence';
import type { EarnedChallengeEvidenceReceipt } from '../../modules/freed-protection/src/earned-challenge-evidence';
import { useEarnedTimeOffer } from '@/hooks/useEarnedTimeOffer';
import { EarnedTimeOfferPicker, EarnedTimeCountdown } from '@/components/EarnedTimeOfferPicker';
import { validateEarnedAppTimeGrantReceipt, type EarnedAppTimeOffer } from '../../modules/freed-protection/src/earned-app-time';
import { captureMomentumRewardTemplate, currentMomentumRewardTemplate, matchesMomentumRewardTemplate } from '@/lib/momentum-reward-templates';
import { prepareLiveResetGroupReward, liveResetOwnerCurrent, type LiveResetBreakOrigin } from '@/lib/live-reset-reward';
import { getResetRewardCapSeconds } from '@/lib/reset-reward-policy';
import { validateResetAppGroupRewardReceipt } from '../../modules/freed-protection/src/reset-app-group-reward';
import { disableAdultProtection } from '@/lib/adult-protection-control';
import { websiteSetupWriter } from '@/lib/website-protection-operations';
import { useEncryptedDns } from '@/hooks/use-encrypted-dns';
import { cleanupAbandonedChallengePhotos } from "../lib/challenge-photo-files";
import { BasicHelpPresentation } from "@/components/BasicHelp";
import { GuidedResetOffer } from '@/components/GuidedResetOffer';
import { ResetChoicePicker } from '@/components/ResetChoicePicker';
import { ChallengeActivityScene } from '@/components/ChallengeActivityScene';
import { CoachConversationLayout } from '@/components/CoachConversationLayout';
import { ClaraCompactHeader } from '@/components/ClaraCompactHeader';
import { ClaraConsentSheet } from '@/components/ClaraConsentSheet';
import { OwnerPrivateDraftContext, createOwnerPrivateDraftStorage, useOwnerPrivateDraftStorage } from '@/lib/owner-private-drafts';
import { createJournalRepository, type JournalRepository, type JournalLegacyDraft, type JournalEntry } from '@/lib/journal-repository';
import { createJournalMediaRuntime } from '@/lib/journal-media-runtime';
import type { JournalMediaStore } from '@/lib/journal-media';
import { purgeJournalOwner } from '@/lib/journal-lifecycle';
import { executeAccountDeletion, loadAccountDeletionReceipt, saveAccountDeletionReceipt, type AccountDeletionReceipt } from '@/lib/account-deletion-receipt';
import { readConfirmedAccountCleanupReceipt } from '@/lib/account-cleanup-metadata';
import { AccountDeletionDestination } from '@/components/AccountDeletionDestination';
import { JournalBackupFiles } from '@/components/JournalBackupFiles';
import { createEncryptedJournalArchive, restoreJournalOrRecoveryBackup, decodedRecoveryTextArchive, type DecodedJournalArchive } from '@/lib/journal-archive';
import { buildJournalTextBackup } from '@/lib/journal-text-backup';
import { getJournalBackupFiles } from '@/lib/journal-backup-files-runtime';
import { restoreWholeAppArchive, beginOwnerRestoreDeletion, completeOwnerRestoreDeletion } from '@/lib/whole-app-restore';
import { confirmedAppGroupGrant } from '@/lib/app-group-intervention';
import { trustedPrivateOwner } from '@/lib/trusted-private-owner';
import {ClaraCloudControls} from '@/components/ClaraCloudControls';
import {readCloudChatConsent,saveCloudChatConsent,replyWithClaraConversation,type ClaraConversationReply,type CloudChatConsent} from '@/lib/clara-conversation';
import {getRandomBytesAsync} from 'expo-crypto';
import { useGuidedResetAccess } from '@/hooks/useGuidedResetAccess';
import { useReviewAccess } from '@/hooks/useReviewAccess';
import { resolveGuidedTier, shouldOfferGuidedReset, type GuidedTier } from '@/lib/guided-reset-access';
import { hasReviewAccess, type ReviewAccessSnapshot } from '@/lib/review-access';
import { FeatureDirectory, FocusedFeatureContent } from '@/components/FeatureDirectory';
import { BasicMovementScreen } from '@/components/BasicMovementScreen';
import { FEATURE_DEFINITIONS, FEATURE_DESTINATIONS, parseFeatureId, type FeatureId } from '@/lib/feature-catalogue';
import { createAccountFlowFence, type AccountFlowControl, createOfferDecisionStore, configureJourneyMetadataAdapter, createFirebaseJourneyMetadataAdapter, getJourneyOwner, getJourneyDestination, guardJourneyRoute, type JourneyPolicy, type JourneyAuthSnapshot, type JourneyMembershipSnapshot } from '@/lib/user-journey';
import { ProtectionReactivation } from "@/components/ProtectionReactivation";
import { resumeProtectionAfterReset } from "@/lib/protection-reactivation";
import {reserveNativeCleanup,readNativeCleanupOperation,executeStoredNativeCleanup} from '@/lib/account-cleanup-metadata';
import { createLatestSerialJob } from "@/lib/latest-serial-job";
import { buildNativeAppScheduleConfiguration } from "@/lib/app-schedules";
import { APP_GUARD_MODES, describeAppGuard, getAppGuardPackages, syncNativeAppGuard } from "@/lib/app-guard";
import { NativeTimeInput } from "@/components/NativeTimeInput";
import { PROTECTION_INTENT_STORAGE_KEY, getStoredProtectionIntent, storeProtectionIntent } from "@/lib/protection-intent-storage";
import type { ProtectionIntent } from "@/lib/protection-readiness";
import { ProtectionFeatureSetup } from "@/components/ProtectionFeatureSetup";
import { ProtectOverview } from "@/components/ProtectOverview";
import { AppGroupsScreen } from '@/components/AppGroupsScreen';
import { AdvancedProtectionScreen } from '@/components/AdvancedProtectionScreen';
import { useAppGroups } from '@/hooks/use-app-groups';
import type { AppGroupsSnapshot } from '@/lib/app-groups-contract';
import { FunctionalPaywallScreen } from "@/components/FunctionalPaywallScreen";
import { recordToolCompletion } from "@/lib/tool-completion";
import { updatePersonalDailyPlan } from "@/lib/personal-daily-plan";
import { recordJournalForDate } from "@/lib/recovery-day-write";
import { useRecoveryReminders } from '@/hooks/use-recovery-reminders';
import { RecoveryHistory } from "@/components/RecoveryHistory";
import type { ProgressRecordActions } from '@/components/RecoveryRecordedSummary';
import { JournalScreen } from "@/components/JournalScreen";
import { FunctionalBreathingScreen } from "@/components/FunctionalBreathingScreen";
import { FunctionalToday, type FunctionalTodayProps } from "@/components/FunctionalToday";
import { getRecoveryCompanionCue } from "@/lib/recovery-companion-cue";
import type { CompanionCue } from "@/components/MomentumCompanion";
import { CompanionBackdrop } from "@/components/CompanionBackdrop";
import { buildRecoveryDaySnapshot, recoveryDateSelection, resolveRecoveryDateSelection, type RecoveryDateSelection } from "@/lib/recovery-day-snapshot";
import { recordCheckInForDate } from "@/lib/recovery-day-write";
import { MomentumSettingHeader } from '@/components/MomentumSettingHeader';
import { MomentumPageHeader, MomentumSection, MomentumMetricStrip, MomentumVisibility, useMomentumBottomPadding } from '@/components/MomentumPageHeader';
import { getPracticePalette, type PracticeCategory } from '@/design-system/app-palette';
import { ChallengeOption, ChallengeText } from '@/components/ChallengePresentation';
import { MomentumCompanion, clearCompanionPresentationHistory } from '@/components/MomentumCompanion';
import { MomentumBreathingView } from '@/components/MomentumBreathingView';
import { createBreathingClock } from '@/components/momentum-breathing-clock';
import { recordPracticeToggle } from '@/components/record-practice-toggle';
import { useTodayClock } from '@/components/use-today-clock';
import { MomentumToday, type MomentumHabit } from '@/components/MomentumToday';
import { LibraryScreen } from '@/features/library-screen';
import { EncryptedDnsSection } from '@/components/EncryptedDnsSection';
import { ProtectionLayers } from '@/components/ProtectionLayers';
import { RecoveryHero } from '@/components/RecoveryHero';
import { OnboardingPreferences } from '@/components/OnboardingPreferences';
import { appI18n, translateSource, localizedElapsed } from '@/i18n/runtime';
import { Link, router, useFocusEffect, useGlobalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react-native';
import { Pressable, Text, TextInput, View, Alert } from '@/components/Localized';
import { getChallengeSelectionKey } from "@/lib/challenge-selection-key";
import { BrandLogo } from "@/components/BrandLogo";
import { RecoveryPath } from "@/components/RecoveryPath";
import { getBreathingPhase } from "@/lib/breathing-cadence";
import { getBreathingArtworkProgress, getBreathingArtworkTiming } from "@/lib/breathing-artwork";
import { isDnsGuardFiltering, dnsGuardCoverageMessage } from "@/lib/dns-guard-health";
import { useChallengeVerification } from "@/hooks/useChallengeVerification";
import { useAppTheme } from "@/design-system/use-app-theme";
import { AccountAccessHost } from "@/components/AccountAccessHost";
import { AccountReauthenticationScreen } from "@/components/AccountReauthenticationScreen";
import { useChallengeSession } from "@/hooks/useChallengeSession";
import { useRecoveryDraft } from "@/hooks/use-recovery-draft";
import { useInitialRoute } from '@/hooks/use-initial-route';
import { normalizeClockTimeInput } from '@/lib/localized-input';
import { RECOVERY_DRAFT_LIMITS, RECOVERY_DRAFT_STORAGE_KEYS, RECOVERY_TOOL_SESSION_STORAGE_KEYS, purgeRecoveryDrafts, getRetainedCheckInDraftDate } from "@/lib/recovery-drafts";
import { getChallengeCapability, readChallengeCapabilities, selectCapableChallengeSet, selectResetChoices, type ChallengeCapabilities } from "@/lib/challenge-capability";
import { useFreedNavigation } from "@/features/use-freed-navigation";
import { freedProfileSectionPath, freedProfileSectionTitle, parseFreedProfileSection, type FreedProfileSection, freedShieldSectionPath, freedShieldSectionTitle, type FreedShieldSection } from '@/lib/native-navigation';
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { File as ExpoFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { Accelerometer, Pedometer, type AccelerometerMeasurement } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Switch, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing as ReanimatedEasing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import {
  springs,
  haptics,
  motionLayout,
  AnimatedSmoothProgress,
  SpringPressable
} from "@/lib/motion";
import Svg, { Circle } from "react-native-svg";
import {
  ProtectionCapability,
  ProtectionActivationDiagnostics,
  ProtectionStatus,
  applyAdultContentFilter,
  applyEarnedUnlockWindow,
  grantResetAppGroupBreak,
  grantEarnedAppTimeBreak,
  getEarnedAppTimeGrant,
  prepareEarnedAppTimeOffer,
  isEarnedAppTimeAvailable,
  isResetAppGroupRewardMethodAvailable,
  applyFocusShieldEarnedUnlock,
  cancelFocusShieldCalibration,
  classifyChallengePhoto,
  getChallengePhotoCapabilities,
  configureBlockedAppPackages,
  configureAppSchedules,
  configureAppGuardMode,
  configureFocusShieldRule,
  configureUserAllowedDomains,
  clearEarnedUnlockWindow,
  resetProtectionConfiguration,
  setAppGroupActionScope,
  prepareNativeAccountCleanup, executeNativeAccountCleanup,
  isAppGroupBindingConfirmed,
  suspendAppGroupOperations,
  activateProtectionConfiguration,
  clearPendingIntervention,
  getFocusShieldCalibration,
  getProtectionCapabilities,
  getPendingIntervention,
  getProtectionStatus,
  listFocusShieldRules,
  openPrivateDnsSettings,
  openUsageAccessSettings,
  openProtectionSettings,
  openSafariExtensionSettings,
  openVpnSettings,
  addVpnConsentListener,
  addDnsGuardRuntimeListener,
  presentFamilyActivityPicker,
  requestProtectionAuthorization,
  removeFocusShieldRule,
  runActivationDiagnostics,
  startFocusShieldCalibration,
  startRiskWindowMonitoring,
  stopAdultContentFilter,
  stopRiskWindowMonitoring,
  recoveryDnsPilot
} from "freed-protection";
import {
  Activity,
  Calendar,
  Users,
  ChevronDown,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Camera,
  Check,
  CircleUserRound,
  Dumbbell,
  FileLock,
  Flame,
  Footprints,
  Home,
  LifeBuoy,
  Lock,
  Mail,
  MessageCircleHeart,
  Moon,
  NotebookPen,
  Play,
  Shield,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  Target,
  TimerReset,
  Trash2,
  Trophy,
  Send,
  Waves,
  X
} from "lucide-react-native";
import { ChevronLeft, ChevronRight } from '@/components/DirectionalIcons';
import React from "react";
import { createAccountOperationGate } from "@/lib/account-operation";
import { SocialSignInButtons } from "@/components/SocialSignInButtons";
import { PremiumOffer } from "@/components/PremiumOffer";
import { createPaywallNavigationSession, resolvePaywallReturn, type PaywallNavigationToken } from "@/lib/paywall-navigation";
import { ProtectionSetupView } from "@/components/ProtectionSetupView";
import { useOfferTheme } from "@/components/offer-theme";
import { canAutoStartDnsGuard, decideSetupAdvance, hasPrivateDnsSetupConflict, hasVpnSetupConflict, presentProtectionSetup, safariSetupAction } from "@/lib/protection-setup-presenter";
import {
  cancelAutomaticBackupSync, disableAutomaticBackup, enableAutomaticBackup,
  getAutomaticBackupStatus, subscribeAutomaticBackupStatus, syncAutomaticRecoveryBackup
} from "@/lib/automatic-backup";

import { colors, gradients, radii, shadow, starField, typography } from "@/constants/design";
import { LIBRARY_ARTICLES, type LibraryArticle } from "@/data/library-articles";
import { ROOT_DESTINATIONS, type RootDestinationId } from "@/design-system/navigation";
import { useSmoothedValue, useMotionSettings } from "@/design-system/motion";
import { getLayoutClass } from "@/design-system/theme";
import {
  hasReviewedNativeAdultDomainFeed,
  hasReviewedSafariAdultDomainFeed,
  isReviewedAdultDomainFeedRequired,
  nativeAdultDomainFeedReadyForActivation,
  safariAdultDomainFeedReadyForActivation
} from "@/lib/adult-domain-feed-provenance";
import {
  buildAccountabilityDeepLink,
  buildSponsorReport,
  buildSponsorReportDeepLink,
  buildSupportCircleReportDeepLink,
  hasUsableAccountabilityPartner,
  hasUsableSupportCircleMember
} from "@/lib/accountability";
import { syncNativeAdultDomainFeed } from "@/lib/adult-domain-feed-sync";
import { useGuidedResetLink } from '@/hooks/use-guided-reset-link';
import { createRecoveryEntryPresentation } from '@/lib/recovery-entry-presentation';
import { redactCoachText, replyWithCoach, createCoachSendController } from "@/lib/ai-coach";
import {
  BlockingAttempt,
  ClassificationResult,
  classifyUrl,
  createBlockingAttempt,
  createPanicInterventionAttempt,
  DEFAULT_ALLOWED_NORMAL_DOMAINS
} from "@/lib/blocking-engine";
import {
  buildChallengeContextSignals,
  fetchChallengeWeatherContext,
  getChallengeWeatherContextConfig,
  permissionStatusToChallengeSignal
} from "@/lib/challenge-context";
import {
  FOCUS_SHIELD_PRESETS,
  createFocusShieldPresetRule,
  type FocusShieldCalibrationState
} from "@/lib/focus-shield";
import {
  createEncryptedRecoveryBackup,
  getRecoveryBackupReadiness,
  restoreEncryptedRecoveryBackup
} from "@/lib/recovery-backup";
import {
  deleteHostedRecoveryBackup,
  downloadEncryptedRecoveryBackup,
  getRecoveryBackupClientSyncReadiness,
  uploadEncryptedRecoveryBackup
} from "@/lib/recovery-backup-client-sync";
import {
  createFirebaseClientEventId,
  getFirebaseClientReadiness,
  getFirebaseEmailLinkReadiness,
  isFirebaseEmailLinkDeliveryUrl,
  type FirebaseAccountDeletionResult
} from "@/lib/firebase-client";
import {
  getFirebaseCallableContracts,
  getFirebaseNativeAuthAdapter,
  registerFirebasePushTokenAfterPermission,
  stopFirebasePushTokenRotation,
  revokeAppleAuthorizationForDeletion,
  signOutFirebaseAccount,
  getFirebaseAccountSummary,
  getFirebaseAccountScope,
  listenFirebaseNotificationOpens,
  startFirebaseClient,
  getFirebaseAuthSnapshot,
  subscribeFirebaseAuthSnapshot,
  getFirebaseNativeAccountSessionSnapshot, subscribeFirebaseNativeAccountSession, getFirebaseNativeAccountAdmission, retireFirebaseNativeAccountSession, reconcileFirebaseNativeAccountSession, withFirebaseNativeAccountCleanup,
  retryFirebaseAuthSnapshot
} from "@/lib/firebase-native";
import { hasVerifiedPremium, getMembershipSummary, sanitizePremiumEntitlement, PREMIUM_OFFLINE_TTL_MS } from "@/lib/premium-entitlement";
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle
} from "@/lib/social-login";
import { safeUserFacingMessage } from "@/lib/user-facing-error";
import {
  ANALYTICS_CONSENT_VERSION,
  buildRecoveryAnalyticsSnapshot,
  prepareAnalyticsSnapshotState, prepareAnalyticsPendingSnapshot, stageAnalyticsPendingSnapshot, applyPendingAnalyticsSnapshotReceipt, applyAnalyticsSnapshotRecovery,
  getAnalyticsSharingReadiness,
  getConfiguredAnalyticsEndpoint,
  sendGatedAnalyticsPayload,
  type AnalyticsSharingReadiness,
  type RecoveryAnalyticsSnapshot
} from "@/lib/recovery-analytics";
import { generateAdaptiveChallengeSet } from "@/lib/challenge-generator";
import {
  distanceMeters,
  getChallengeVerificationRequirement,
  isChallengeVerificationSatisfied,
  type ChallengeVerificationRequirement
} from "@/lib/challenge-verification";
import {
  fetchLaunchStorePrices,
  getLaunchPremiumPlans,
  getMonetizationConfig,
  getPremiumCapabilities,
  purchasePremiumPlan,
  restorePremiumPurchases,
  type LaunchPremiumPlanId,
  type MonetizationPlatform,
  type PremiumCapabilitySet,
  type PremiumPlanId
} from "@/lib/monetization";
import { getSubscriptionTermsDisclosure, type StoreProductPrice } from "@/lib/store-pricing";
import { getSubscriptionManagementUrl, presentPaywallPlan, type PaywallPriceStatus } from "@/lib/paywall-presenter";
import { configureNativeMonetizationRuntime } from "@/lib/native-monetization-runtime";
import {
  appPackageForEarnedUnlockSource,
  createDeepLinkInterventionAttempt,
  isIosScreenTimeShieldSource,
  unlockSourceForAttempt,
  type NativeInterventionAttempt
} from "@/lib/native-intervention";
import { canonicalAppBreakStartedAt, getPresentedEarnedUnlock, nativeGrantConfirmsUnlock, requiresNativeUnlockConfirmation } from '@/lib/native-unlock-confirmation';
import {
  getSelectedScreenTimeTargetCount,
  getProtectionActivationRecoveryStep,
  PROTECTION_PERMISSION_EXPLANATION,
  type ProtectionPermissionStep,
  type ProtectionPermissionStatus
} from "@/lib/protection-permissions";
import {
  consumePendingInterventionOnce,
  createPendingInterventionTracker,
  getFocusShieldCapabilityModel,
  getProtectionChallengeCompletionDecision,
  summarizeFocusShieldRules,
  type FocusShieldRuleSummary
} from "@/lib/protection-capabilities";
import { getProtectionSetupReadiness } from "@/lib/protection-readiness";
import { createProtectionRefreshCoordinator, type ProtectionReadTicket } from "@/lib/website-protection-operations";
import { canFinishProtectionSetup } from '@/lib/protection-setup-completion';
import {
  ChallengeHistorySignal,
  ChallengeContextSignal,
  ChallengeFeedbackOutcome,
  ChallengePreferenceSignal,
  InterventionContextSignal,
  RecoveryChallenge,
  buildInterventionContextFromAttempt,
  calculateRecoveryScore,
  challengeLibrary,
  generateChallengeSet,
  inferPreferredChallengeCategories
} from "@/lib/recovery-engine";
import {
  getSmartReminderSuggestion,
  listenForReminderResponses,
  parseClockTime,
  type SmartReminderSuggestion
} from "@/lib/recovery-reminders";
import { requestAndroidRecoveryNotificationVisibility } from "@/lib/recovery-notification-permission";
import {
  buildRetentionRequest,
  createLocalRetentionPlan,
  generateRetentionPlan,
  type RetentionPlan
} from "@/lib/retention-orchestrator";
import {
  buildLocalUrgeRiskForecast,
  type LocalUrgeRiskForecast
} from "@/lib/urge-risk-forecast";
import {
  DOOMSCROLL_APP_OPTIONS,
  INSTAGRAM_ANDROID_PACKAGE,
  TIKTOK_PRIMARY_ANDROID_PACKAGE,
  YOUTUBE_ANDROID_PACKAGE,
  addCustomRecoveryChallenge,
  calculateRecoveryLevel,
  calculateStreakDaysFrom,
  buildChallengePreferenceSignal,
  completeOnboarding,
  countAttemptsForDay,
  countRecoveryRiskMomentsForDay,
  getCurrentRecoveryStreakDays,
  getLifetimeProtectedAttemptCount,
  createDefaultRecoveryState,
  createCustomRecoveryChallenge,
  clearProtectionActivation,
  generateAchievementBadges,
  generateMonthlyGrowthReport,
  generateRecoveryInsight,
  generateWeeklyRecoveryReport,
  getActiveBlockedAppPackages,
  getDailyCheckInForDay,
  getDailyHabitCompletionsForDay,
  getLocalDateKey,
  getRecoveryMilestone,
  hasProtectionActivationForPlatform,
  hasProtectionSetupFallback,
  markOnboardingPaywallPresented,
  markProtectionSetupFallback,
  markAccountStepCompleted,
  markVpnDisclosureAcknowledged,
  markProtectionActivated,
  recordEarnedUnlock,
  recordDailyHabitCompletion,
  recordAccountabilityContact,
  recordAppSessionEnd,
  recordAppSessionStart,
  recordBlockedDomainFeedback,
  recordBlockingAttempt,
  recordChallengeCompletion,
  recordCoachMessages,
  recordDailyCheckIn,
  recordDailyPledge,
  recordRelapse,
  recordSupportCircleContact,
  removeSupportCircleMember,
  summarizeCheckIns,
  updateAccountabilityPartner,
  updateAnalyticsSharingSettings,
  updateDisciplineSettings,
  updateSupportCircleMember,
  setPremiumPlan,
  setVerifiedPremiumEntitlement,
  touchRecoveryState,
  hasPledgedOnDate,
  getPledgeStreakDays
} from "@/lib/recovery-state";
import type {
  AccountabilityPartner,
  AchievementBadge,
  AnalyticsSharingSettings,
  CheckInSummary,
  CustomChallengeInput,
  DailyCheckIn,
  DailyHabitKey,
  DailyCheckInInput,
  DisciplineSettings,
  EarnedUnlock,
  MonthlyGrowthReport,
  RecoveryLevel,
  RecoveryMilestone,
  RecoveryState,
  RelapseRecordInput,
  ReminderPreferences,
  ReminderPreferenceUpdate,
  SupportCircleMember,
  ProtectionActivationPlatform,
  ProtectionSetupFallbackReason,
  WeeklyRecoveryReport
} from "@/lib/recovery-state";
import { usePersistentRecoveryState } from "@/lib/recovery-storage";

type Screen =
  | "splash"
  | "welcome"
  | "quiz"
  | "planCalculation"
  | "appSelection"
  | "paywall"
  | "account"
  | "protectionSetup"
  | "library"
  | "main"
  | "intercept"
  | "ad"
  | "challenge"
  | "breathing"
  | "checkin"
  | "journal"
  | "coach"
  | "slip"
  | "customChallenge"
  | "article" | "features" | "movement" | "feature";
type Tab = RootDestinationId;

const FREED_PRIVACY_POLICY_URL = "https://freed-landing.web.app/privacy";
const FREED_ACCOUNT_DELETION_URL = "https://freed-landing.web.app/account-deletion";
const FREED_SUPPORT_EMAIL = "soumyadebnath1661@gmail.com";
const showQaControls = typeof __DEV__ !== "undefined" && __DEV__;

function getRuntimeMonetizationPlatform(): MonetizationPlatform {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") return Platform.OS;
  return "unknown";
}

function getRuntimeProtectionActivationPlatform(): ProtectionActivationPlatform {
  if (Platform.OS === "ios" || Platform.OS === "android") return Platform.OS;
  return "web-preview";
}

function isProtectionSetupDeepLink(url: string | null | undefined) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "freed:") return false;
    return parsed.hostname === "protection-setup" || parsed.pathname.replace(/^\/+/, "") === "protection-setup";
  } catch {
    return false;
  }
}

function getInitialScreenForRecoveryState(state: RecoveryState): Screen {
  return state.hasCompletedOnboarding ? "main" : "welcome";
}

function hasNativeProtectionActivationRevoked(
  protectionCapability: ProtectionCapability | null,
  protectionStatus: ProtectionStatus | null,
  selectedAppPackageCount: number,
  platform: ProtectionActivationPlatform
) {
  if (platform === "web-preview") return false;
  if (!protectionCapability || !protectionStatus) return true;
  if (protectionCapability.platform !== platform) return true;

  const readiness = getProtectionSetupReadiness(protectionCapability, protectionStatus, selectedAppPackageCount);
  if (readiness.activationReady) return false;

  return true;
}

const recommendedProtectedAppPackages = [
  INSTAGRAM_ANDROID_PACKAGE,
  TIKTOK_PRIMARY_ANDROID_PACKAGE,
  YOUTUBE_ANDROID_PACKAGE
];

function completeOnboardingWithSelectedApps(
  state: RecoveryState,
  answers: string[],
  blockedAppPackages = state.disciplineSettings.blockedAppPackages
) {
  const onboarded = completeOnboarding(state, answers);
  return updateDisciplineSettings(onboarded, {
    blockedAppPackages
  });
}

function ensureOnboardingComplete(state: RecoveryState) {
  return state.hasCompletedOnboarding
    ? state
    : completeOnboardingWithSelectedApps(state, state.answers, state.disciplineSettings.blockedAppPackages);
}

const quiz = [
  {
    question: "What is your main reason for changing?",
    options: ["Mental clarity & focus", "Confidence & energy", "Deep relationships", "Faith, values & self-respect"]
  },
  {
    question: "How long has this cycle been a struggle?",
    options: ["Under 1 year", "1–3 years", "4–7 years", "8+ years"]
  },
  {
    question: "When are urges most likely to strike?",
    options: ["Late night in bed", "High stress & pressure", "Boredom & idle time", "After scrolling social media"]
  },
  {
    question: "What symptoms affect your daily life most?",
    options: ["Brain fog & low drive", "Procrastination & fatigue", "Social anxiety & numbness", "Restless sleep quality"]
  },
  {
    question: "What helps you reset and ground fastest?",
    options: ["Exercise & movement", "Parasympathetic breathing", "Journaling & reflection", "Talking to someone trusted"]
  }
];

const iconMap = {
  Activity,
  Dumbbell,
  Footprints,
  MessageCircleHeart,
  NotebookPen,
  Snowflake,
  Waves
};

const habitLibrary: Array<{ key: DailyHabitKey; label: string; accent: string }> = [
  { key: "adult-content-boundary", label: "No adult content", accent: colors.mint },
  { key: "cold-shower", label: "Cold shower", accent: colors.sky },
  { key: "exercise", label: "Exercise", accent: colors.peach },
  { key: "meditation", label: "Meditation", accent: colors.mintLight },
  { key: "journal", label: "Journal", accent: colors.yellow },
  { key: "social-media-boundary", label: "No social media", accent: colors.peach }
];

function formatElapsedSince(startedAt: string | null, nowMs = Date.now()) {
  if (!startedAt) return "Start today";
  const startMs = Date.parse(startedAt);
  if (!Number.isFinite(startMs) || nowMs < startMs) return "0h 00m 00s";

  const totalSeconds = Math.floor((nowMs - startMs) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

function formatCompactDurationMs(value: number | undefined) {
  const totalSeconds = Math.max(0, Math.floor((value ?? 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function tap() {
  haptics.tap();
}

function FreedLogo({ compact = false }: { compact?: boolean }) {
  return <BrandLogo compact={compact} />;
}

function AppBackground({ children }: { children: React.ReactNode }) {
  const { colors, mode } = useAppTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {children}
    </View>
  );
}

function PillButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  testID
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger" | "success";
  icon?: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isSuccess = variant === "success";
  const pressScale = useSharedValue(1);
  const { spatialMotion } = useMotionSettings();
  const pressScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }]
  }));

  const backgroundColor = isPrimary
    ? colors.mint
    : isSuccess
    ? colors.accentTint
    : isDanger
    ? `${colors.red}22`
    : colors.surface2;

  const borderColor = isPrimary
    ? "transparent"
    : isDanger
    ? `${colors.red}66`
    : isSuccess
    ? colors.accent
    : colors.border;

  const textColor = isPrimary
    ? colors.onAccent
    : isDanger
    ? colors.red2
    : isSuccess
    ? colors.mint
    : colors.text;

  const content = (
    <Pressable
      testID={testID}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={() => {
        tap();
        onPress();
      }}
      onPressIn={() => {
        pressScale.value = spatialMotion ? withTiming(0.97, { duration: 120 }) : 1;
      }}
      onPressOut={() => {
        pressScale.value = spatialMotion ? withTiming(1, { duration: 120 }) : 1;
      }}
      style={{
        minHeight: 56,
        borderRadius: 16,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        opacity: disabled ? 0.42 : 1,
        backgroundColor,
        borderWidth: isPrimary ? 0 : 1.2,
        borderColor,
        paddingHorizontal: 24,
        paddingVertical: 12,
        boxShadow: "none"
      }}
    >
      {icon}
      <Text
        selectable={false}
        style={{
          color: textColor,
          fontSize: 16,
          fontWeight: typography.heavy,
          textAlign: "center",
          flexShrink: 1
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  return <Animated.View style={pressScaleStyle}>{content}</Animated.View>;
}

function Card({ children, gradient, style, category = 'reflection', title, collapsible, initiallyExpanded }: {
  children: React.ReactNode; gradient?: readonly [string, string] | readonly [string, string, string]; style?: object;
  category?: PracticeCategory; title?: string; collapsible?: boolean; initiallyExpanded?: boolean;
}) {
  return <MomentumSection category={category} title={title} style={style} collapsible={collapsible} initiallyExpanded={initiallyExpanded}>{children}</MomentumSection>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  const { colors, gradients, typography } = useAppTheme();
  return (
    <Card style={{ flex: 1, minHeight: 90 }} gradient={[`${color}22`, colors.surface]} category="reflection">
      <Text
        selectable
        style={{
          color: colors.text,
          fontSize: 26,
          fontWeight: typography.heavy,
          fontVariant: ["tabular-nums"]
        }}
      >
        {value}
      </Text>
      <Text selectable={false} style={{ color, marginTop: "auto", fontWeight: typography.bold, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </Text>
    </Card>
  );
}


function InlineNotice({
  tone,
  message,
  actionLabel,
  onAction
}: {
  tone: "error" | "success" | "info";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const toneColor = tone === "error" ? colors.red : tone === "success" ? colors.mint : colors.sky;
  const Icon = tone === "error" ? LifeBuoy : tone === "success" ? Check : Bell;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : "text"}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderRadius: radii.lg,
        borderWidth: 1.3,
        borderColor: `${toneColor}55`,
        backgroundColor: `${toneColor}14`,
        padding: 12
      }}
    >
      <Icon color={toneColor} size={18} />
      <Text selectable style={{ color: colors.text2, flex: 1, lineHeight: 19 }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={() => {
            tap();
            onAction();
          }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text selectable style={{ color: toneColor, fontWeight: typography.bold }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 36, gap: 12 }} category="reflection">
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface2,
          marginBottom: 4
        }}
      >
        {icon}
      </View>
      <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: typography.heavy, textAlign: "center" }}>
        {title}
      </Text>
      <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 24 }}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: 8, alignSelf: "stretch" }}>
          <PillButton label={actionLabel} onPress={onAction} variant="ghost" />
        </View>
      ) : null}
    </Card>
  );
}

// Animated SVG circle for progress rings; animates strokeDashoffset so ring
// fills ease in instead of jumping when values change.
const AnimatedRingCircle = Animated.createAnimatedComponent(Circle);

function useRingOffset(circumference: number, pct: number) {
  const offset = useSharedValue(circumference);
  const { spatialMotion } = useMotionSettings();
  React.useEffect(() => {
    offset.value = spatialMotion ? withTiming(circumference * (1 - Math.max(0, Math.min(100, pct)) / 100), {
      duration: 220,
      easing: ReanimatedEasing.bezier(0.25, 0.1, 0.25, 1)
    }) : circumference * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return () => cancelAnimation(offset);
  }, [circumference, pct, offset, spatialMotion]);
  return useAnimatedProps(() => ({
    strokeDashoffset: offset.value
  }));
}

function ProgressRing({ value, size = 152 }: { value: number; size?: number }) {
  const { colors, gradients, typography } = useAppTheme();
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * 2 * radius;
  const animatedProps = useRingOffset(circumference, value);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <AnimatedRingCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.mint}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <Text selectable style={{ color: colors.text, fontSize: 34, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
        {value}%
      </Text>
      <Text selectable style={{ color: colors.text3, fontSize: 11, fontWeight: typography.bold }}>
        recovery
      </Text>
    </View>
  );
}

function SplashScreen({ onDone, hold = false, onHelp }: { onDone: () => void; hold?: boolean; onHelp?: () => void }) {
  const { t } = useTranslation();
  const { colors, gradients, typography } = useAppTheme();
  useInitialRoute(!hold, onDone);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 20 }}>
        <MomentumCompanion pose="welcome" context="splash" scene={false} variant="welcome" width={112} height={112} interactive />
        <View style={{ transform: [{ scale: 1.08 }] }}>
          <FreedLogo />
        </View>
        <Text selectable={false} style={{ color: colors.text3, letterSpacing: 2.4, fontSize: 12, fontWeight: typography.bold }}>
          RECLAIM YOUR FOCUS & CLARITY
        </Text>
        <ActivityIndicator color={colors.mint} style={{ marginTop: 28 }} />
        {onHelp ? <PillButton label={t("publicHelp.entry")} variant="ghost" onPress={onHelp} /> : null}
      </SafeAreaView>
    </AppBackground>
  );
}

function WelcomeScreen({ onStart, onSkip, onHelp }: { onStart: () => void; onSkip: () => void; onHelp?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { height, width, fontScale } = useWindowDimensions();
  const [availableHeight, setAvailableHeight] = React.useState(height);
  const compact = availableHeight < 700 || width < 360;
  const illustrationSize = fontScale > 1.5 ? 96 : compact ? 96 : 112;
  const copy = (key: string, fallback: string) => t(key, { defaultValue: fallback });
  return <AppBackground><SafeAreaView style={{ flex: 1 }}>
    <ScrollView testID="welcome-content" onLayout={event => setAvailableHeight(event.nativeEvent.layout.height)} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingVertical: compact ? 12 : 24, gap: compact ? 8 : 20, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><BrandLogo compact /><OnboardingPreferences compact /></View>
      <View style={{ gap: 12 }}>
        <Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: compact ? 32 : 36, lineHeight: compact ? 38 : 44, fontWeight: '800', letterSpacing: -.6 }}>{copy('welcome.title', 'Break free.\nMake room for you.')}</Text>
        <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{copy('welcome.purpose', 'Set app limits. Complete a reset, then request a 5- or 10-minute app break.')}</Text>
        <View testID="welcome-earned-time-example" style={{ gap: 4, padding: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface }}>
          <Text translate={false} accessibilityRole="header" style={{ color: colors.text2, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{copy('welcome.exampleTitle', 'Example rule')}</Text>
          <Text translate={false} accessibilityLabel={t('welcome.exampleFlowSpoken', { defaultValue: 'After {{dailyMinutes}} minutes, complete a reset to request {{shortMinutes}} or {{longMinutes}} more minutes in that app.', dailyMinutes: 30, shortMinutes: 5, longMinutes: 10 })} style={{ color: colors.text, fontSize: 15, lineHeight: 22, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{t('welcome.exampleFlow', { defaultValue: '{{dailyMinutes}} min daily → reset → {{shortMinutes}} or {{longMinutes}} min', dailyMinutes: 30, shortMinutes: 5, longMinutes: 10 })}</Text>
          <Text translate={false} style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }}>{t('welcome.exampleCap', { defaultValue: '{{extraMinutes}} min extra each day. Edit limits in Protect.', extraMinutes: 20 })}</Text>
          <Text translate={false} style={{ color: colors.text2, fontSize: 14, lineHeight: 20 }}>{copy('welcome.adultWebsitesStayBlocked', 'Adult websites stay blocked.')}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'center' }}><MomentumCompanion pose="welcome" context="welcome" scene={false} width={illustrationSize} height={illustrationSize} interactive /></View>
      <View style={{ gap: 8 }}>
        {onHelp ? <PillButton label={t("publicHelp.entry")} variant="ghost" onPress={onHelp} /> : null}
        <PillButton label={copy('welcome.getStarted', 'Get started')} onPress={onStart} testID="onboarding-start" />
        <Pressable testID="onboarding-personalize" accessibilityRole="button" onPress={onSkip} style={({ pressed }) => ({ minHeight: 44, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .65 : 1 })}><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center' }}>{copy('welcome.existingAccount', 'I have an account')}</Text></Pressable>
        <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: 'center' }}>{copy('welcome.requiredAccess', 'For adults 18+. Account required. Basic help included.')}</Text>
      </View>
    </ScrollView>
  </SafeAreaView></AppBackground>;
}

function QuizScreen({ index, answers, onAnswer, onBack }: {
  index: number; answers: string[]; onAnswer: (answer: string) => void; onBack: () => void;
}) {
  const { colors } = useAppTheme();
  const reduceMotion = !useMotionSettings().spatialMotion;
  const step = quiz[index];
  const [selection, setSelection] = React.useState<string | null>(answers[index] ?? null);
  React.useEffect(() => setSelection(answers[index] ?? null), [index, answers]);
  return <AppBackground><SafeAreaView style={{ flex: 1 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 24 }}>
      <BackButton onPress={onBack} accessibilityLabel="Go back" />
      <AnimatedSmoothProgress progressPercent={(index / quiz.length) * 100} color={colors.mint} style={{ flex: 1 }} />
      <Text style={{ color: colors.text2, fontSize: 14, fontVariant: ["tabular-nums"] }}>{index + 1}/{quiz.length}</Text>
      <OnboardingPreferences compact />
    </View>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 24, gap: 20, flexGrow: 1 }}>
      <Text style={{ color: colors.mint, fontSize: 13, fontWeight: "700", letterSpacing: 1 }}>YOUR STARTING POINT</Text>
      <Animated.View key={index} entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.duration(160)} style={{ gap: 24 }}>
        <MomentumPageHeader pose={(["guide", "listen", "reassure", "listen", "plan"] as const)[index]} context={`quiz-${index}`} title={step.question} category="reflection" variant="welcome" />
        <View style={{ gap: 12 }}>{step.options.map((option, optionIndex) => {
          const selected = selection === option;
          return <Pressable key={option} testID={`quiz-option-${optionIndex}`} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{ selected }} onPress={() => { if (selection !== option) { tap(); setSelection(option); } }} style={({ pressed }) => ({ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 16, padding: 16, borderRadius: 20, backgroundColor: selected ? colors.accentTint : pressed ? colors.surface2 : colors.surface, borderWidth: selected ? 1.5 : 1, borderColor: selected ? colors.mint : colors.border })}>
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: selected ? 0 : 1.5, borderColor: colors.text3, backgroundColor: selected ? colors.mint : "transparent", alignItems: "center", justifyContent: "center" }}>{selected ? <Check color={colors.onAccent} size={16} /> : null}</View>
            <Text style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: selected ? "600" : "400" }}>{option}</Text>
          </Pressable>;
        })}</View>
      </Animated.View>
      <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>Choose what fits you. You can go back and change an answer.</Text>
    </ScrollView>
    <View style={{ padding: 24, borderTopWidth: 1, borderTopColor: colors.border }}>
      <PillButton label={index === quiz.length - 1 ? "See my starting point" : "Continue"} disabled={!selection} onPress={() => { if (selection) onAnswer(selection); }} testID="quiz-continue" />
    </View>
  </SafeAreaView></AppBackground>;
}

function PlanCalculationScreen({ answers, onContinue }: { answers: string[]; onContinue: () => void }) {
  const { colors } = useAppTheme();
  const preferences = [
    ["Your goal", answers[0]], ["Time in this cycle", answers[1]], ["Your trigger", answers[2]],
    ["Daily concern", answers[3]], ["Preferred reset", answers[4]]
  ];
  return <AppBackground><SafeAreaView style={{ flex: 1 }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 24, gap: 24, flexGrow: 1 }}>
<MomentumPageHeader pose="plan" context="planCalculation" title={"Your Recovery Preferences"} description={"A starting point that belongs to you. Next, choose the protection you need."} category="commitment" variant="welcome" />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><BrandLogo compact /><OnboardingPreferences compact /></View>
      
      <RecoveryPath progress={1 / 3} activeStage={1} stages={["Your goal", "Protection", "Daily practice"]} compact caption="Your answers guide reset suggestions. They do not measure brain chemistry or predict recovery dates." />
      <View style={{ backgroundColor: colors.surface, borderRadius: 20, overflow: "hidden" }}>{preferences.map(([label, value], index) => <View key={label} style={{ padding: 16, gap: 4, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border }}><Text style={{ color: colors.text2, fontSize: 13 }}>{label}</Text><Text style={{ color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: "500" }}>{value || "Not selected"}</Text></View>)}</View>
      <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>Device permissions activate supported protection. Your recovery tools remain available before setup.</Text>
    </ScrollView>
    <View style={{ padding: 24, borderTopWidth: 1, borderTopColor: colors.border }}><PillButton label="Continue to account" onPress={onContinue} testID="onboarding-protect" /></View>
  </SafeAreaView></AppBackground>;
}

function AppSelectionScreen({
  initialPackages,
  onBack,
  onContinue
}: {
  initialPackages: string[];
  onBack: () => void;
  onContinue: (packages: string[]) => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const reduceMotion = !useMotionSettings().spatialMotion;
  const [selectedPackages, setSelectedPackages] = React.useState<string[]>(
    initialPackages.length > 0 ? initialPackages : recommendedProtectedAppPackages
  );
  const selectedSet = React.useMemo(() => new Set(selectedPackages), [selectedPackages]);
  const selectedCount = selectedPackages.length;
  const packageDetailForPlatform =
    Platform.OS === "android"
      ? null
      : Platform.OS === "ios"
      ? "Screen Time target chosen during setup"
      : "Native setup target";
  const requiresAndroidAppSelection = Platform.OS === "android";
  const togglePackage = React.useCallback(
    (androidPackage: string) => {
      setSelectedPackages((current) =>
        current.includes(androidPackage)
          ? current.filter((item) => item !== androidPackage)
          : [...current, androidPackage]
      );
    },
    []
  );

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 24 }}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous onboarding step."
            style={{ width: 44, height: 44, borderRadius: 15, borderCurve: "continuous", backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft color={colors.text2} size={20} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.2 }}>
              APP SELECTION
            </Text>
            <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy, marginTop: 4, fontVariant: ["tabular-nums"] }}>
              {Platform.OS === "ios" ? "Apple Screen Time selection" : `${selectedCount} selected`}
            </Text>
          </View>
        </View>

        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 36 }}>
<MomentumPageHeader pose="guide" context="appSelection" title={Platform.OS === "ios" ? "Choose your protection targets." : "Choose the apps FREED can interrupt."} category="commitment" variant="welcome" />
          <LinearGradient colors={gradients.hero} style={{ borderRadius: 24, borderCurve: "continuous", padding: 24, borderWidth: 1, borderColor: colors.accent, gap: 12 }}>
            <TimerReset color={colors.mint} size={36} />
            
            <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>
              These choices become Android app guard targets. On iOS, you will choose the actual apps and websites in Apple's Screen Time picker during setup.
            </Text>
          </LinearGradient>

          {Platform.OS !== "ios" ? <Card category="reflection">
            <View style={{ gap: 12 }}>
              {DOOMSCROLL_APP_OPTIONS.map((option, optionIndex) => {
                const selected = selectedSet.has(option.androidPackage);
                return (
                  <Animated.View
                    key={option.androidPackage}
                    entering={reduceMotion ? undefined : FadeIn.duration(160)}
                  >
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Protect ${option.label}`}
                      accessibilityHint={`Toggles FREED app timer protection for ${option.label}.`}
                      accessibilityState={{ checked: selected }}
                      onPress={() => {
                        tap();
                        togglePackage(option.androidPackage);
                      }}
                      style={({ pressed }) => ({
                        minHeight: 58,
                        borderRadius: 20,
                        borderCurve: "continuous",
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: selected ? colors.accentTint : colors.surface2,
                        borderWidth: 1.2,
                        borderColor: selected ? colors.accent : colors.surface2,
                        transform: [{ scale: pressed ? 0.985 : 1 }]
                      })}
                    >
                      <View style={{ width: 30, height: 30, borderRadius: 11, borderCurve: "continuous", backgroundColor: selected ? colors.mint : colors.border, alignItems: "center", justifyContent: "center" }}>
                        {selected ? <Check color={colors.onAccent} size={17} strokeWidth={3.5} /> : <Shield color={colors.text3} size={15} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
                          {option.label}
                        </Text>
                        <Text selectable style={{ color: colors.text3, marginTop: 4, fontSize: 12 }}>
                          {packageDetailForPlatform ?? option.androidPackage}
                        </Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Card> : <View style={{ gap: 12, padding: 24, backgroundColor: colors.surface, borderRadius: 20 }}><ShieldCheck color={colors.mint} size={28} /><Text style={{ color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "700" }}>Your selection stays with Apple.</Text><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>During protection setup, Apple’s picker lets you choose the actual apps, categories and websites. FREED will check the authorization and selected targets before showing protection as active.</Text></View>}

          <Text selectable style={{ color: colors.text3, lineHeight: 19, textAlign: "center" }}>
            {requiresAndroidAppSelection
              ? "Android activation needs at least one selected app timer so FREED can verify app interruption before setup completes."
              : "Adult-domain blocking is separate and stays available even if you do not select any app timers."}
          </Text>

          <PillButton
            label={Platform.OS === "ios" ? "Continue to setup" : selectedCount > 0 ? `Continue · ${selectedCount} selected` : "Select At Least 1 App"}
            onPress={() => onContinue(selectedPackages)}
            icon={<ChevronRight color={colors.bg} size={19} />}
            disabled={requiresAndroidAppSelection && selectedCount <= 0}
          />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

function PaywallScreen({
  onSubscribe,
  onClose,
  onRestore,
  busy,
  notice
}: {
  onSubscribe: (planId: LaunchPremiumPlanId) => void;
  onClose: () => void;
  onRestore: () => void;
  busy?: boolean;
  notice?: string | null;
}) {
  const [plan, setPlan] = React.useState<LaunchPremiumPlanId>("yearly");
  const platform = React.useMemo(() => getRuntimeMonetizationPlatform(), []);
  const launchPlans = React.useMemo(() => getLaunchPremiumPlans({ platform }), [platform]);
  const [storePrices, setStorePrices] = React.useState<StoreProductPrice[]>([]);
  const [priceStatus, setPriceStatus] = React.useState<PaywallPriceStatus>("loading");
  const [priceError, setPriceError] = React.useState<string | null>(null);
  const [priceRetry, setPriceRetry] = React.useState(0);
  const [managementMessage, setManagementMessage] = React.useState<string | null>(null);
  const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;
  const managementUrl = getSubscriptionManagementUrl(platform);
  const presentations = launchPlans.map((item) => ({
    ...item,
    id: item.id === "monthly" ? "monthly" as const : "yearly" as const,
    presentation: presentPaywallPlan({
      planId: item.id === "monthly" ? "monthly" : "yearly",
      productId: item.productId,
      storePrices,
      status: priceStatus,
      platform,
      isDevelopment
    })
  }));
  const selectedPresentation = presentations.find((item) => item.id === plan)?.presentation;

  React.useEffect(() => {
    let active = true;
    setPriceStatus("loading");
    setPriceError(null);
    fetchLaunchStorePrices({ platform })
      .then((prices) => {
        if (!active) return;
        setStorePrices(prices);
        setPriceStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        setStorePrices([]);
        setPriceStatus("error");
        setPriceError(safeUserFacingMessage(error, "Store prices could not load. Check your connection and retry."));
      });
    return () => { active = false; };
  }, [platform, priceRetry]);

  const manageSubscription = () => {
    if (!managementUrl) return;
    setManagementMessage(null);
    void Linking.openURL(managementUrl).catch(() => {
      setManagementMessage("Subscription settings could not open. Manage your membership in your device's store account.");
    });
  };

  const offerTheme = useOfferTheme();
  const { mode } = useAppTheme();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <PremiumOffer
        plans={presentations}
        selectedPlan={plan}
        onSelectPlan={setPlan}
        onSubscribe={() => { if (!busy && selectedPresentation?.canPurchase) onSubscribe(plan); }}
        onClose={() => { if (!busy) onClose(); }}
        onRestore={onRestore}
        onManage={manageSubscription}
        canManage={Boolean(managementUrl)}
        onRetryPrices={() => { setPriceStatus("loading"); setPriceRetry(current => current + 1); }}
        priceStatus={priceStatus}
        priceError={priceError}
        busy={busy}
        notice={notice}
        managementMessage={managementMessage}
        previewMessage={platform === "web" || platform === "unknown"
          ? isDevelopment ? "Preview pricing only. Subscribe in the Android or iPhone app." : "Subscriptions are available in the Android or iPhone app." : null}
        terms={platform === "ios" || platform === "android"
          ? getSubscriptionTermsDisclosure(platform)
          : "Monthly and annual memberships renew automatically. Your device's store shows the final charge and cancellation options before purchase."}
      />
    </>
  );
}

type ProtectionRefreshResult = {
  superseded?: boolean;
  readTicket?: ProtectionReadTicket;
  capability: ProtectionCapability | null;
  status: ProtectionStatus | null;
};

function buildProtectionActivationSignature(
  capability: ProtectionCapability | null,
  status: ProtectionStatus | null,
  selectedAppPackageCount: number
) {
  return JSON.stringify({
    platform: capability?.platform ?? "unknown",
    screenTime: capability?.screenTime === true,
    managedSettings: capability?.managedSettings === true,
    accessibility: capability?.accessibility === true,
    dnsFiltering: capability?.dnsFiltering === true,
    usageStats: capability?.usageStats === true,
    safariContentBlocker: capability?.safariContentBlocker === true,
    localVpnFallback: capability?.localVpnFallback === true,
    mode: status?.mode ?? "unknown",
    authorized: status?.authorized === true,
    active: status?.active === true,
    adultFilterActive: status?.adultFilterActive === true,
    appInterventionAuthorized: status?.appInterventionAuthorized === true,
    usageStatsAuthorized: status?.usageStatsAuthorized === true,
    appLimitScheduled: status?.appLimitScheduled === true,
    selectedApplications: status?.selectedApplications ?? 0,
    selectedCategories: status?.selectedCategories ?? 0,
    selectedWebDomains: status?.selectedWebDomains ?? 0,
    selectedScreenTimeTokenCount: status?.selectedScreenTimeTokenCount ?? 0,
    blockedApplications: status?.blockedApplications ?? 0,
    selectedAppPackageCount,
    dnsGuardRuntimeReady: status?.dnsGuardRuntimeReady === true,
    dnsGuardStartCount: status?.dnsGuardStartCount ?? 0,
    vpnConsentRequired: status?.vpnConsentRequired === true,
    privateDnsMode: status?.privateDnsMode ?? "unknown",
    androidNotificationPermissionRequired: status?.androidNotificationPermissionRequired === true,
    androidNotificationPermissionGranted: status?.androidNotificationPermissionGranted !== false,
    adultDomainFeedVersion: status?.adultDomainFeedVersion ?? "",
    adultDomainFeedChecksum: status?.adultDomainFeedChecksum ?? "",
    adultDomainFeedDomainCount: status?.adultDomainFeedDomainCount ?? 0,
    safariContentBlockerVersion: status?.safariContentBlockerVersion ?? "",
    safariContentBlockerChecksum: status?.safariContentBlockerChecksum ?? "",
    safariContentBlockerRuleCount: status?.safariContentBlockerRuleCount ?? 0,
    safariContentBlockerEnabled: status?.safariContentBlockerEnabled === true
  });
}

function FocusShieldSection({
  protectionCapability,
  protectionStatus,
  onRefresh
}: {
  protectionCapability: ProtectionCapability | null;
  protectionStatus: ProtectionStatus | null;
  onRefresh: () => Promise<ProtectionRefreshResult>;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [rules, setRules] = React.useState<FocusShieldRuleSummary[]>([]);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [calibrationState, setCalibrationState] = React.useState<FocusShieldCalibrationState>("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const capabilityModel = React.useMemo(
    () => getFocusShieldCapabilityModel(protectionCapability, protectionStatus, rules),
    [protectionCapability, protectionStatus, rules]
  );
  const enforcementReady = capabilityModel.available && capabilityModel.surfaceState === "ready" && protectionStatus?.focusShieldRuleStoreHealth !== "degraded";
  const calibrationActive = calibrationState === "calibrating" || calibrationState === "ready";

  const refreshRules = React.useCallback(async () => {
    if (protectionCapability?.platform !== "android") {
      setRules([]);
      return;
    }
    try {
      const nativeRules = await listFocusShieldRules();
      setRules(summarizeFocusShieldRules(nativeRules));
    } catch {
      setMessage("Focus Shield local rules could not be loaded. Refresh native protection and try again.");
    }
  }, [protectionCapability?.platform]);

  React.useEffect(() => {
    void refreshRules();
  }, [refreshRules, protectionStatus?.focusShieldRuleCount]);

  React.useEffect(() => {
    if (protectionCapability?.platform !== "android") return;
    let cancelled = false;
    getFocusShieldCalibration()
      .then((result) => {
        if (cancelled) return;
        setCalibrationState(result.state);
        if (result.message) setMessage(result.message);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [protectionCapability?.platform]);

  React.useEffect(() => {
    if (!calibrationActive) return;
    let cancelled = false;
    const poll = () => {
      getFocusShieldCalibration()
        .then((result) => {
          if (cancelled) return;
          setCalibrationState(result.state);
          setMessage(result.message ?? `Calibration ${result.state.replace(/-/g, " ")}.`);
          if (result.state === "success") {
            void refreshRules();
            void onRefresh();
          }
        })
        .catch(() => {
          if (!cancelled) setMessage("Calibration status could not be refreshed.");
        });
    };
    poll();
    const timer = setInterval(poll, 1_200);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [calibrationActive, onRefresh, refreshRules]);

  const enablePreset = React.useCallback(
    async (preset: (typeof FOCUS_SHIELD_PRESETS)[number]) => {
      if (!enforcementReady) return;
      const rule = createFocusShieldPresetRule(preset.id, `preset-${preset.id}`);
      if (!rule) return;
      setBusyAction(`enable:${preset.id}`);
      try {
        const result = await configureFocusShieldRule(rule);
        setMessage(result.message);
        await Promise.all([refreshRules(), onRefresh()]);
      } catch {
        setMessage(`${preset.displayName} could not be enabled.`);
      } finally {
        setBusyAction(null);
      }
    },
    [enforcementReady, onRefresh, refreshRules]
  );

  const beginCalibration = React.useCallback(
    async (preset: (typeof FOCUS_SHIELD_PRESETS)[number]) => {
      if (!enforcementReady || !capabilityModel.calibrationAvailable) return;
      setBusyAction(`calibrate:${preset.id}`);
      try {
        const result = await startFocusShieldCalibration({
          ruleId: `custom-${preset.id}`,
          packageName: preset.packageName,
          displayLabel: `${preset.displayName} calibrated`
        });
        setCalibrationState(result.state);
        setMessage(result.message ?? `Calibration ${result.state.replace(/-/g, " ")}.`);
      } catch {
        setCalibrationState("failed");
        setMessage(`${preset.displayName} calibration could not start.`);
      } finally {
        setBusyAction(null);
      }
    },
    [enforcementReady, capabilityModel.calibrationAvailable]
  );

  const cancelCalibration = React.useCallback(async () => {
    setBusyAction("cancel-calibration");
    try {
      const result = await cancelFocusShieldCalibration();
      setCalibrationState(result.state);
      setMessage(result.message ?? "Focus Shield calibration cancelled.");
    } catch {
      setMessage("Focus Shield calibration could not be cancelled.");
    } finally {
      setBusyAction(null);
    }
  }, []);

  const removeRule = React.useCallback(
    async (rule: FocusShieldRuleSummary) => {
      setBusyAction(`remove:${rule.id}`);
      try {
        const removed = await removeFocusShieldRule(rule.id);
        setMessage(removed ? `${rule.displayLabel} removed.` : `${rule.displayLabel} was not found in local protection.`);
        await Promise.all([refreshRules(), onRefresh()]);
      } catch {
        setMessage(`${rule.displayLabel} could not be removed.`);
      } finally {
        setBusyAction(null);
      }
    },
    [onRefresh, refreshRules]
  );

  return (
    <Card gradient={capabilityModel.available ? gradients.mint : undefined} category="reflection">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <ShieldCheck color={capabilityModel.available ? colors.mint : colors.text3} size={24} />
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
            Focus Shield
          </Text>
          <Text selectable style={{ color: colors.text3, marginTop: 4, textTransform: "capitalize" }}>
            {capabilityModel.platform} capability
          </Text>
        </View>
      </View>
      <Text selectable style={{ color: colors.text2, lineHeight: 24, marginBottom: 12 }}>
        {capabilityModel.description}
      </Text>

      {capabilityModel.platform === "android" ? (
        <>
          <Text selectable style={{ color: colors.text3, fontWeight: typography.heavy, letterSpacing: 0.8, marginBottom: 8 }}>
            SUPPORTED PRESETS
          </Text>
          <View style={{ gap: 12, marginBottom: 12 }}>
            {FOCUS_SHIELD_PRESETS.map((preset) => {
              const saved = rules.some((rule) => rule.presetId === preset.id || rule.id === `preset-${preset.id}`);
              const enabled = enforcementReady && rules.some((rule) => rule.enabled && (rule.presetId === preset.id || rule.id === `preset-${preset.id}`));
              return (
                <View key={preset.id} style={{ borderRadius: 16, padding: 12, backgroundColor: colors.surface2, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                        {preset.displayName}
                      </Text>
                      <Text selectable style={{ color: colors.text3, fontSize: 12, marginTop: 4 }}>
                        Local rule · {preset.packageName}
                      </Text>
                    </View>
                    {enabled ? <Check color={colors.mint} size={20} /> : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <PillButton
                        label={enabled ? "Preset On" : saved ? "Preset saved" : "Enable"}
                        variant="ghost"
                        disabled={!enforcementReady || saved || busyAction !== null}
                        onPress={() => void enablePreset(preset)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PillButton
                        label="Calibrate"
                        variant="ghost"
                        disabled={!enforcementReady || !capabilityModel.calibrationAvailable || calibrationActive || busyAction !== null}
                        onPress={() => void beginCalibration(preset)}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Text selectable style={{ color: calibrationActive ? colors.yellow : colors.text3, flex: 1, fontWeight: typography.bold }}>
              Calibration: {calibrationState.replace(/-/g, " ")}
            </Text>
            {calibrationActive ? (
              <Pressable
                onPress={() => void cancelCalibration()}
                disabled={busyAction !== null}
                accessibilityRole="button"
                accessibilityLabel="Cancel Focus Shield calibration"
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accentTint }}
              >
                <Text selectable style={{ color: colors.yellow, fontWeight: typography.heavy }}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>

          <Text selectable style={{ color: colors.text3, fontWeight: typography.heavy, letterSpacing: 0.8, marginBottom: 8 }}>
            LOCAL RULES ({rules.length})
          </Text>
          {rules.length === 0 ? (
            <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
              No local Focus Shield rules yet. Enable a supported preset or calibrate a selected surface.
            </Text>
          ) : (
            <View style={{ gap: 8, marginBottom: 12 }}>
              {rules.map((rule) => (
                <View key={rule.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 12, backgroundColor: colors.surface2 }}>
                  <View style={{ flex: 1 }}>
                    <Text selectable style={{ color: colors.text, fontWeight: typography.bold }}>{rule.displayLabel}</Text>
                    <Text selectable style={{ color: colors.text3, fontSize: 12, marginTop: 4 }}>
                      {rule.kind} · {rule.enabled ? enforcementReady ? "enabled" : "saved; enforcement unavailable" : "paused"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void removeRule(rule)}
                    disabled={busyAction !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${rule.displayLabel}`}
                    style={{ width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${colors.red}22` }}
                  >
                    <Trash2 color={colors.red2} size={17} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}

      {capabilityModel.platform === "ios" ? (
        <View style={{ gap: 12, marginBottom: 12 }}>
          <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>Native YouTube Shorts and Instagram Reels surfaces are unavailable on iOS. Use whole-app Screen Time limits, or the Safari Focus Shield extension for supported web paths.</Text>
          <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>Safari's browser pause stays paused until you resume it in the extension. It is separate from an earned native Screen Time unlock; completing a challenge does not grant temporary Safari access.</Text>
          <PillButton testID="focus-shield-safari-settings" label="Open Safari Focus Shield settings" variant="ghost" disabled={protectionCapability?.safariContentBlocker !== true || busyAction !== null} onPress={() => {
            setBusyAction("safari-settings");
            void openSafariExtensionSettings("focus-shield").then(onRefresh).catch(() => setMessage("Safari settings could not open. Open Settings → Apps → Safari → Extensions.")).finally(() => setBusyAction(null));
          }} />
        </View>
      ) : null}
      {message ? (
        <Text selectable style={{ color: colors.mint, lineHeight: 19, marginBottom: 12, fontWeight: typography.bold }}>
          {message}
        </Text>
      ) : null}
      {capabilityModel.diagnostics.map((diagnostic) => (
        <Text key={diagnostic} selectable style={{ color: colors.yellow, lineHeight: 19, marginTop: 4 }}>
          {diagnostic}
        </Text>
      ))}
    </Card>
  );
}

function AccountScreen({
  onDone,
  onSkip,
  linkExisting = false
}: {
  onDone: (email: string | null) => void;
  onSkip: () => void;
  linkExisting?: boolean;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [busyProvider, setBusyProvider] = React.useState<"google" | "apple" | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = React.useState(false);
  const googleConfigured = isGoogleSignInConfigured();
  const accountMounted = React.useRef(true);

  React.useEffect(() => {
    let active = true;
    accountMounted.current = true;
    isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
      accountMounted.current = false;
    };
  }, []);

  const runProviderSignIn = React.useCallback(
    (provider: "google" | "apple") => {
      if (busyProvider) return;
      setBusyProvider(provider);
      setMessage(null);
      void (async () => {
        try {
          const result = provider === "google" ? await signInWithGoogle() : await signInWithApple();
          if (!accountMounted.current) return;
          if (!result.ok) {
            if (result.reason !== "cancelled") setMessage(result.message);
            return;
          }
          const adapter = getFirebaseNativeAuthAdapter();
          const exchange = linkExisting ? adapter.linkProviderCredential : adapter.exchangeProviderCredential;
          const authResult = await exchange(
            result.token.provider,
            result.token.provider === "google"
              ? { idToken: result.token.idToken }
              : { identityToken: result.token.identityToken, nonce: result.token.nonce }
          );
          if (!accountMounted.current) return;
          if (authResult.ok) {
            onDone(getFirebaseAccountSummary().email ?? result.email);
          } else {
            setMessage(authResult.code === "account-conflict" && getFirebaseAccountSummary().anonymous
              ? "That sign-in belongs to another recovery account. Connect a different Google/Apple account or email to this guest account to keep your purchases recoverable."
              : safeUserFacingMessage(authResult.reason, "Sign-in could not be completed."));
          }
        } catch (error) {
          setMessage(safeUserFacingMessage(error, "Sign-in could not be completed."));
        } finally {
          setBusyProvider(null);
        }
      })();
    },
    [busyProvider, onDone, linkExisting]
  );

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 16 }}><MomentumPageHeader pose="secure" context="account" title={linkExisting ? "Connect another sign-in" : "Connect your account"} category="reflection" variant="welcome" compact />
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.accentTint, borderWidth: 1.5, borderColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
              <Shield color={colors.mint} size={30} />
            </View>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: typography.heavy, textAlign: "center", marginTop: 20 }}>
              {linkExisting ? "Connect another sign-in" : "Connect your account"}
            </Text>
            <Text style={{ color: colors.text2, lineHeight: 22, textAlign: "center", marginTop: 8 }}>
              {linkExisting ? "Link a sign-in to this recovery account. Your purchases keep the same owner." : "Keep your purchases connected to an account and set up optional encrypted backup in Profile. Recovery also works without signing in."}
            </Text>
          </View>

          <SocialSignInButtons
            googleAvailable={googleConfigured}
            appleAvailable={appleAvailable}
            busyProvider={busyProvider}
            onGoogle={() => runProviderSignIn("google")}
            onApple={() => runProviderSignIn("apple")}
          />

          {message ? (
            <Text style={{ color: colors.yellow, textAlign: "center", lineHeight: 20 }}>{message}</Text>
          ) : null}

          <PillButton label="Skip for now" variant="ghost" onPress={onSkip} disabled={busyProvider !== null} />
          <Text style={{ color: colors.text3, fontSize: 12, textAlign: "center", lineHeight: 18 }}>
            Skipping keeps recovery progress on this device. You can add an account later in Profile → Encrypted Backup.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

function ProtectionSetupScreen({
  protectionCapability,
  protectionStatus,
  protectionSyncMessage,
  selectedAppPackageCount,
  appGuardMode,
  userAllowedDomains,
  appSelectionReturnPending,
  vpnDisclosureAcknowledged,
  onAcknowledgeVpnDisclosure,
  setupFallbackAcknowledged,
  onAcknowledgeSetupFallback,
  onRefresh,
  onSyncAppPackages,
  onChooseApps,
  onAppSelectionReturnHandled,
  onContinue, onOpenAdvancedProtection
}: {
  onOpenAdvancedProtection?: () => void;
  protectionCapability: ProtectionCapability | null;
  protectionStatus: ProtectionStatus | null;
  protectionSyncMessage: string | null;
  selectedAppPackageCount: number;
  appGuardMode?: DisciplineSettings['appGuardMode'];
  userAllowedDomains: string[];
  appSelectionReturnPending: boolean;
  vpnDisclosureAcknowledged: boolean;
  onAcknowledgeVpnDisclosure: () => void;
  setupFallbackAcknowledged: boolean;
  onAcknowledgeSetupFallback: (reason: ProtectionSetupFallbackReason) => void;
  onRefresh: () => Promise<ProtectionRefreshResult>;
  onSyncAppPackages: () => Promise<ProtectionStatus>;
  onChooseApps: () => void;
  onAppSelectionReturnHandled: () => void;
  onContinue: () => void;
}) {
  const { colors, gradients, typography, mode } = useAppTheme();
  const [busy, setBusy] = React.useState<"adult" | "apps" | "usage" | "settings" | "feed" | "sync-apps" | "test" | null>(null);
  const setupActionRunningRef = React.useRef(false);
  const appRulesNavigationPending = React.useRef(false);
  useFocusEffect(React.useCallback(() => {
    // The editor push retains setup. Returning releases navigation only, never
    // an in-flight native action or an acknowledgement of group activation.
    if (!appRulesNavigationPending.current) return;
    appRulesNavigationPending.current = false;
    setupActionRunningRef.current = false;
  }, []));
  const [setupActionError, setSetupActionError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [retryAdultStart, setRetryAdultStart] = React.useState(false);
  const [dnsGuardWaitExpired, setDnsGuardWaitExpired] = React.useState(false);
  const [setupDetailsExpanded, setSetupDetailsExpanded] = React.useState(false);
  const [activationTest, setActivationTest] = React.useState<{
    adultBlocked: boolean;
    normalAllowed: boolean;
    nativeReady: boolean;
    nativeChecked: boolean;
    nativeMessage: string;
    nativeIssues: string[];
    nativeDiagnostics: ProtectionActivationDiagnostics | null;
    statusSignature: string;
  } | null>(null);
  const setupAutoAdvanceRef = React.useRef<{
    fromStepId: string;
    continueAfterOptional?: boolean;
    testTriggered?: boolean;
    waitingForAppReturn?: boolean;
    returnedFromExternalStep?: boolean;
    waitingNoticeShown?: boolean;
  } | null>(null);
  const [vpnDisclosureOpen, setVpnDisclosureOpen] = React.useState(false);
  // Bounded recovery: a required Android step that cannot complete on this
  // device must never leave the user tapping a button that does nothing.
  const [setupBlockedSheetOpen, setSetupBlockedSheetOpen] = React.useState(false);
  const setupStepAttemptsRef = React.useRef<Record<string, number>>({});
  const dnsGuardAutoStartAttemptsRef = React.useRef(0);
  const dnsGuardLastAutoStartAtRef = React.useRef(0);
  const DNS_GUARD_MAX_AUTO_STARTS = 3;
  const DNS_GUARD_AUTO_START_MIN_GAP_MS = 2_000;

  const setupReadiness = React.useMemo(
    () => getProtectionSetupReadiness(protectionCapability, protectionStatus, selectedAppPackageCount, 'both', appGuardMode),
    [protectionCapability, protectionStatus, selectedAppPackageCount, appGuardMode]
  );
  const {
    selectedIosTargets,
    adultFilterActive,
    nativeAdultFeedCount,
    appInterventionReady,
    appCount,
    permissionPlan,
    permissionProgress,
    activationReady
  } = setupReadiness;
  const currentProtectionActivationSignature = React.useMemo(
    () => buildProtectionActivationSignature(protectionCapability, protectionStatus, selectedAppPackageCount),
    [protectionCapability, protectionStatus, selectedAppPackageCount, appGuardMode]
  );
  const activationTestMatchesCurrentStatus = activationTest?.statusSignature === currentProtectionActivationSignature;
  const activationTestPassed = Boolean(
    activationTest?.adultBlocked &&
      activationTest.normalAllowed &&
      activationTest.nativeChecked &&
      activationTest.nativeReady &&
      activationReady &&
      activationTestMatchesCurrentStatus
  );
  const activationComplete = activationReady && activationTestPassed;
  const nextRequiredStep = React.useMemo(
    () => permissionPlan.find((step) => step.required && step.status !== "complete") ?? null,
    [permissionPlan]
  );
  const adultFilterStep = React.useMemo(
    () =>
      permissionPlan.find((step) =>
        protectionCapability?.platform === "ios" ? step.id === "ios-adult-web-filter" : step.id === "android-dns-guard"
      ) ?? null,
    [permissionPlan, protectionCapability?.platform]
  );
  const appInterventionStep = React.useMemo(
    () =>
      permissionPlan.find((step) =>
        protectionCapability?.platform === "ios" ? step.id === "ios-screen-time-targets" : step.id === "android-accessibility"
      ) ?? null,
    [permissionPlan, protectionCapability?.platform]
  );
  const usageAccessStep = React.useMemo(
    () => permissionPlan.find((step) => step.id === "android-usage-access") ?? null,
    [permissionPlan]
  );
  const recoveryNotificationStep = React.useMemo(
    () => permissionPlan.find((step) => step.id === "android-recovery-notifications") ?? null,
    [permissionPlan]
  );
  const privateDnsStep = React.useMemo(
    () => permissionPlan.find((step) => step.id === "android-private-dns-guidance") ?? null,
    [permissionPlan]
  );
  const orderedSetupActionLabel = React.useCallback(
    (step: ProtectionPermissionStep | null, defaultLabel: string) => {
      if (!step?.required || !nextRequiredStep || nextRequiredStep.id === step.id) {
        return defaultLabel;
      }

      return `Continue: ${nextRequiredStep.title}`;
    },
    [nextRequiredStep]
  );
  const nativeProtectionPlatform =
    Platform.OS === "ios" ||
    Platform.OS === "android" ||
    protectionCapability?.platform === "ios" ||
    protectionCapability?.platform === "android";
  const privateDnsMode = protectionStatus?.privateDnsMode;
  const privateDnsActive = Boolean(privateDnsMode && privateDnsMode !== "off" && privateDnsMode !== "unknown");
  const privateDnsStrict = privateDnsMode === "hostname";
  const dnsGuardRuntimeNeedsAttention =
    protectionCapability?.platform === "android" &&
    protectionStatus?.adultFilterActive &&
    protectionStatus.dnsGuardRuntimeReady !== true;
  const androidRecoveryNotificationsNeedAttention =
    protectionCapability?.platform === "android" &&
    protectionStatus?.androidNotificationPermissionRequired === true &&
    protectionStatus.androidNotificationPermissionGranted === false;
  const androidSettingsReturnHintText =
    protectionCapability?.platform === "android" && protectionStatus?.androidSettingsRouteInstruction
      ? `${protectionStatus.androidSettingsRouteLabel ?? "Android settings"}: ${protectionStatus.androidSettingsRouteInstruction}`
      : null;
  const reviewedAdultFeedRequired = isReviewedAdultDomainFeedRequired();
  const rawNativeAdultFeedCount = protectionStatus?.adultDomainFeedDomainCount ?? 0;
  const rawSafariContentBlockerRuleCount = protectionStatus?.safariContentBlockerRuleCount ?? 0;
  const nativeAdultFeedProvenanceText =
    nativeAdultFeedCount > 0
      ? `Native adult-domain feed loaded: ${nativeAdultFeedCount} reviewed domains.`
      : reviewedAdultFeedRequired && rawNativeAdultFeedCount > 0
      ? "Embedded adult-domain fallback is loaded; production activation is waiting for a reviewed remote feed version."
      : "Waiting for the native adult-domain feed to sync before activation.";
  const safariAdultFeedProvenanceText =
    protectionCapability?.platform === "ios" && protectionStatus?.safariContentBlockerStateError
      ? `Safari Content Blocker state needs device verification: ${protectionStatus.safariContentBlockerStateError}`
      : protectionCapability?.platform === "ios" && protectionStatus?.safariContentBlockerEnabled === false
      ? "Safari rules are loaded, but FREED Safari Blocker is disabled. Enable it in iOS Settings > Safari > Extensions, then return and run the configuration check."
      : protectionCapability?.platform === "ios" && reviewedAdultFeedRequired && rawSafariContentBlockerRuleCount > 0 && !hasReviewedSafariAdultDomainFeed(protectionStatus)
      ? "Safari has embedded fallback rules; production activation is waiting for reviewed Safari feed provenance."
      : null;
  const activationTestMessage = activationTest
    ? !activationTest.adultBlocked && !activationTest.normalAllowed
      ? "Configuration check needs attention: local adult-domain block and normal-site allow checks both failed."
      : !activationTest.adultBlocked
      ? "Configuration check needs attention: the local adult-domain check did not block."
      : !activationTest.normalAllowed
      ? "Configuration check needs attention: the normal-site allow check did not pass."
      : activationTestPassed
      ? "Configuration check passed. Native permission, feed and local classification checks are ready. This does not verify real browser or network blocking."
      : !activationTestMatchesCurrentStatus
      ? "Protection status changed since the last configuration check. Run the configuration check again before activation can finish."
      : !activationTest.nativeChecked
      ? "Activation test could not run native diagnostics. Return from system settings, then run Test Protection again."
      : activationTest.nativeIssues.length > 0
      ? `Native diagnostics need attention: ${activationTest.nativeIssues.slice(0, 2).join(" ")}`
      : activationTest.nativeReady
      ? "Local classification checks passed, but current readiness changed. Review the required permission/feed rows, then run Test Protection again."
      : "Local classification checks passed without saving a blocked attempt. Finish the required permission and feed rows, then run this again."
    : null;
  const activationRecoveryStep = React.useMemo(
    () => getProtectionActivationRecoveryStep(permissionPlan, activationTest?.nativeDiagnostics),
    [activationTest?.nativeDiagnostics, permissionPlan]
  );

  const prepareSetupAutoAdvance = React.useCallback(
    (step: ProtectionPermissionStep, options: { waitingForAppReturn?: boolean; continueAfterOptional?: boolean } = {}) => {
      if (!step.required && !options.continueAfterOptional) return;
      setupAutoAdvanceRef.current = {
        fromStepId: step.id,
        continueAfterOptional: options.continueAfterOptional && !step.required,
        returnedFromExternalStep: options.waitingForAppReturn ? false : undefined,
        waitingForAppReturn: options.waitingForAppReturn
      };
    },
    []
  );

  const runAction = React.useCallback(
    (kind: "adult" | "apps" | "usage" | "settings", action: () => Promise<ProtectionStatus>) => {
      if (setupActionRunningRef.current) return;
      setupActionRunningRef.current = true;
      setSetupActionError(null);
      setBusy(kind);
      setActivationTest(null);
      action()
        .then((status) => {
          setNotice(safeUserFacingMessage(status.message, "Protection permission action completed."));
          if (setupAutoAdvanceRef.current?.fromStepId === "ios-screen-time" && status.authorized !== true) {
            setSetupActionError("Screen Time access wasn't approved. Try again, or open Help for other options.");
          } else if (status.safariExtensionSettingsOpened === false) {
            setSetupActionError("Settings couldn't open. Find Safari → Extensions in Settings and enable FREED Safari Blocker.");
          }
          if (kind === "adult" && Platform.OS === "android") {
            setRetryAdultStart(Boolean(status.vpnConsentRequired && !status.adultFilterActive));
          }
        })
        .catch((error) => {
          setSetupActionError("This step couldn't finish. Try again, or open Help for details.");
          setNotice(safeUserFacingMessage(error, "Protection permission could not be completed."));
        })
        .finally(() => {
          setupActionRunningRef.current = false;
          void onRefresh();
          setBusy(null);
        });
    },
    [onRefresh]
  );

  const runFeedSync = React.useCallback(() => {
    if (setupActionRunningRef.current) return;
    setupActionRunningRef.current = true;
    setBusy("feed");
    setActivationTest(null);

    void (async () => {
      try {
        const result = await syncNativeAdultDomainFeed();
        if (result.warning) {
          setNotice(`Adult-domain feed sync fell back safely: ${safeUserFacingMessage(result.warning, "remote feed unavailable")}`);
        } else if (result.provider === "remote") {
          setNotice("Reviewed adult-domain feed synced to native protection.");
        } else if (result.provider === "remote-cache") {
          setNotice("Reviewed adult-domain feed was unchanged and native protection kept the cached feed.");
        } else {
          setNotice("Adult-domain list loaded and synced to native protection.");
        }
        await onRefresh();
      } catch (error) {
        setNotice(safeUserFacingMessage(error, "Adult-domain feed sync could not complete."));
      } finally {
        setupActionRunningRef.current = false;
        setBusy(null);
      }
    })();
  }, [onRefresh]);

  const runAppPackageSync = React.useCallback(() => {
    if (setupActionRunningRef.current) return;
    if (protectionCapability?.appGroups === true) {
      if (AppState.currentState !== 'active') return;
      setupAutoAdvanceRef.current = null;
      appRulesNavigationPending.current = true;
      setupActionRunningRef.current = true;
      onChooseApps();
      return;
    }
    setupActionRunningRef.current = true;
    setBusy("sync-apps");
    setActivationTest(null);

    void (async () => {
      try {
        const status = await onSyncAppPackages();
        setNotice(safeUserFacingMessage(status.message, "Selected app timers synced to native protection."));
        await onRefresh();
      } catch (error) {
        setNotice(safeUserFacingMessage(error, "Selected app timers could not sync to native protection."));
      } finally {
        setupActionRunningRef.current = false;
        setBusy(null);
      }
    })();
  }, [onChooseApps, onRefresh, onSyncAppPackages, protectionCapability?.appGroups]);

  const runStepAction = React.useCallback(
    (step: ProtectionPermissionStep) => {
      if (setupActionRunningRef.current) return;
      let targetStep = step;
      const firstRequiredStep = permissionPlan.find((candidate) => candidate.required && candidate.status !== "complete") ?? null;
      if (targetStep.required && firstRequiredStep && firstRequiredStep.id !== targetStep.id) {
        targetStep = firstRequiredStep;
        setNotice(`Continuing required setup in order: ${targetStep.title}.`);
      }

      if (targetStep.status === "unavailable") {
        setNotice(`${targetStep.title} is unavailable in this build. Install a signed native FREED build or review the platform entitlement/setup.`);
        return;
      }

      if (protectionCapability?.appGroups === true && (targetStep.action === 'configure-app-guard' || targetStep.action === 'choose-ios-targets' || targetStep.action === 'choose-android-apps')) {
        runAppPackageSync();
        return;
      }

      if (targetStep.id === "ios-safari-content-blocker") {
        if (safariSetupAction(protectionStatus?.safariContentBlockerEnabled) === "settings") {
          prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true });
          setNotice("Opening Safari settings. Turn on FREED Safari Blocker, then return here.");
          runAction("settings", async () => {
            if ((protectionStatus?.safariContentBlockerRuleCount ?? 0) <= 0) await syncNativeAdultDomainFeed();
            return openSafariExtensionSettings();
          });
          return;
        }
        prepareSetupAutoAdvance(targetStep);
        runFeedSync();
        return;
      }

      if (targetStep.id === "android-dns-guard" && hasVpnSetupConflict(protectionStatus)) {
        prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true });
        runAction("settings", openVpnSettings);
        return;
      }

      if (targetStep.id === 'android-dns-guard' && hasPrivateDnsSetupConflict(protectionStatus)) {
        if (privateDnsStep) prepareSetupAutoAdvance(privateDnsStep, { waitingForAppReturn: true, continueAfterOptional: true });
        runAction('settings', openPrivateDnsSettings);
        return;
      }

      switch (targetStep.action) {
        case "configure-app-guard":
          prepareSetupAutoAdvance(targetStep);
          runAppPackageSync();
          return;
        case "sync-adult-domain-feed":
          prepareSetupAutoAdvance(targetStep);
          runFeedSync();
          return;
        case "apply-adult-filter":
          setDnsGuardWaitExpired(false);
          // Google Play requires a prominent in-app VPN disclosure with explicit
          // affirmative consent before the first VpnService use.
          if (Platform.OS === "android" && !vpnDisclosureAcknowledged) {
            setVpnDisclosureOpen(true);
            return;
          }
          prepareSetupAutoAdvance(targetStep, {
            waitingForAppReturn: Platform.OS === "android" && protectionStatus?.vpnConsentRequired !== false
          });
          dnsGuardAutoStartAttemptsRef.current = 0;
          runAction("adult", applyAdultContentFilter);
          return;
        case "request-authorization":
          prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: Platform.OS === "android" });
          runAction("apps", requestProtectionAuthorization);
          return;
        case "choose-ios-targets":
          prepareSetupAutoAdvance(targetStep);
          runAction("apps", presentFamilyActivityPicker);
          return;
        case "choose-android-apps":
          if (selectedAppPackageCount <= 0) {
            setupAutoAdvanceRef.current = null;
            setNotice("Choose at least one app to protect. Returning to app selection now; FREED will sync and continue setup when you return.");
            onChooseApps();
            return;
          }
          prepareSetupAutoAdvance(targetStep);
          runAppPackageSync();
          return;
        case "open-private-dns-settings":
          prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true, continueAfterOptional: true });
          runAction("settings", openPrivateDnsSettings);
          return;
        case "request-android-notification-permission":
          prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true, continueAfterOptional: true });
          runAction("settings", async () => {
            const status = await requestAndroidRecoveryNotificationVisibility();
            if (status.androidNotificationPermissionGranted === true) {
              void registerFirebasePushTokenAfterPermission(true);
            }
            return status;
          });
          return;
        case "open-usage-access-settings":
          prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true });
          runAction("usage", openUsageAccessSettings);
          return;
        case "open-settings":
          prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true });
          runAction("settings", openProtectionSettings);
          return;
        case "on-demand":
          setNotice("This permission is requested only when a matching recovery challenge needs it.");
          return;
      }
    },
    [
      onChooseApps,
      protectionCapability?.appGroups,
      permissionPlan,
      prepareSetupAutoAdvance,
      protectionStatus?.safariContentBlockerEnabled,
      protectionStatus?.safariContentBlockerRuleCount,
      protectionStatus?.otherVpnActive,
      protectionStatus?.alwaysOnVpnPackage,
      protectionStatus?.adultFilterActive,
      protectionStatus?.dnsGuardLastStopReason,
      protectionStatus?.vpnConsentRequired,
      runAction,
      runAppPackageSync,
      runFeedSync,
      selectedAppPackageCount,
      vpnDisclosureAcknowledged
    ]
  );

  // Capped, rate-limited auto-start for DNS Guard. The tunnel start is now
  // asynchronous on the native side (flags flip only after establish()), so the
  // wizard must never hammer applyAdultContentFilter in a tight retry loop.
  const attemptAdultStart = React.useCallback(
    (noticeText?: string, observedStatus = protectionStatus) => {
      if (busy !== null || !canAutoStartDnsGuard(vpnDisclosureAcknowledged, observedStatus)) return false;
      if (dnsGuardAutoStartAttemptsRef.current >= DNS_GUARD_MAX_AUTO_STARTS) {
        return false;
      }
      const now = Date.now();
      if (now - dnsGuardLastAutoStartAtRef.current < DNS_GUARD_AUTO_START_MIN_GAP_MS) {
        return false;
      }
      dnsGuardAutoStartAttemptsRef.current += 1;
      dnsGuardLastAutoStartAtRef.current = now;
      if (noticeText) setNotice(noticeText);
      runAction("adult", applyAdultContentFilter);
      return true;
    },
    [busy, runAction, vpnDisclosureAcknowledged, protectionStatus]
  );

  React.useEffect(() => {
    if (protectionStatus?.adultFilterActive) {
      dnsGuardAutoStartAttemptsRef.current = 0;
    }
  }, [protectionStatus?.adultFilterActive]);

  React.useEffect(() => {
    if (!appSelectionReturnPending || busy !== null) return;
    // Group editor return never replays legacy selection sync or navigates back
    // into the editor. Native group receipts own activation there.
    if (protectionCapability?.appGroups === true) {
      setupAutoAdvanceRef.current = null;
      onAppSelectionReturnHandled();
      return;
    }

    const appPackageStep = permissionPlan.find((step) => step.id === "android-doomscroll-apps") ?? null;
    if (!appPackageStep) {
      onAppSelectionReturnHandled();
      return;
    }

    if (selectedAppPackageCount <= 0) {
      setNotice("Select at least one Android app timer to finish protection setup.");
      onAppSelectionReturnHandled();
      return;
    }

    setupAutoAdvanceRef.current = { fromStepId: appPackageStep.id };
    onAppSelectionReturnHandled();

    if (appPackageStep.status === "complete") {
      setNotice("Selected apps are already synced. Continuing protection setup automatically.");
      return;
    }

    if (appPackageStep.status === "unavailable") {
      setNotice("Selected app timers are unavailable in this build. Install a signed Android build, then return to setup.");
      return;
    }

    setNotice("Selected apps are saved. Syncing app timers to native protection now.");
    runAppPackageSync();
  }, [
    appSelectionReturnPending,
    busy,
    protectionCapability?.appGroups,
    onAppSelectionReturnHandled,
    permissionPlan,
    runAppPackageSync,
    selectedAppPackageCount
  ]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const pending = setupAutoAdvanceRef.current;
      if (pending?.waitingForAppReturn && !pending.returnedFromExternalStep) {
        setupAutoAdvanceRef.current = {
          ...pending,
          returnedFromExternalStep: true,
          waitingNoticeShown: false
        };
      }
      onRefresh().then((refreshed) => {
        if (
          Platform.OS === "android" &&
          canAutoStartDnsGuard(vpnDisclosureAcknowledged, refreshed.status) &&
          (pending?.fromStepId === "android-dns-guard" || retryAdultStart)
        ) {
          setRetryAdultStart(false);
          if (!attemptAdultStart("Android VPN permission is approved. Starting DNS Guard now.", refreshed.status)) {
            setNotice("DNS Guard did not start automatically after returning to FREED. Tap Continue to start it again.");
          }
        }
      }).catch(() => undefined);
    });

    return () => subscription.remove();
  }, [attemptAdultStart, onRefresh, retryAdultStart]);

  React.useEffect(() => {
    if (!retryAdultStart || busy !== null || Platform.OS !== "android") return;

    if (protectionStatus?.adultFilterActive) {
      setRetryAdultStart(false);
      return;
    }

    if (protectionStatus?.vpnConsentRequired === false) {
      setRetryAdultStart(false);
      if (!attemptAdultStart("Android VPN permission is approved. Starting DNS Guard now.")) {
        setNotice("DNS Guard did not start automatically. Tap Continue to start it again.");
      }
    }
  }, [busy, protectionStatus?.adultFilterActive, protectionStatus?.vpnConsentRequired, retryAdultStart, attemptAdultStart]);

  // Listen for native VPN consent activity result (fires when user taps OK/Deny on system dialog)
  React.useEffect(() => {
    if (Platform.OS !== "android" || activationComplete) return;
    const subscription = addVpnConsentListener((event) => {
      dnsGuardAutoStartAttemptsRef.current = 0;
      const pending = setupAutoAdvanceRef.current;
      if (pending?.waitingForAppReturn) {
        setupAutoAdvanceRef.current = {
          ...pending,
          returnedFromExternalStep: true,
          waitingNoticeShown: false
        };
      }
      if (event.granted && !event.adultFilterActive && busy === null) {
        setRetryAdultStart(false);
        // Native already called startUserEnabledGuard for the grant; just refresh
        // and let the capped auto-start cover the fallback consent path.
        void onRefresh().then(refreshed => {
          attemptAdultStart("VPN permission granted! Starting DNS Guard now.", refreshed.status);
        }).catch(() => undefined);
      } else if (event.granted && event.adultFilterActive) {
        setRetryAdultStart(false);
        setNotice("DNS Guard is now active.");
        void onRefresh();
      } else if (!event.granted) {
        setNotice("VPN permission was denied. Tap Start DNS Guard to try again.");
        void onRefresh();
      }
    });
    return () => subscription.remove();
  }, [activationComplete, busy, onRefresh, attemptAdultStart]);

  // Listen for native DNS Guard runtime changes (emitted immediately when tunnel is established)
  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = addDnsGuardRuntimeListener((event) => {
      // Refresh on loss of coverage too; tunnel readiness alone is insufficient.
      void onRefresh();
      if (isDnsGuardFiltering(event)) {
        setRetryAdultStart(false);
        dnsGuardAutoStartAttemptsRef.current = 0;
        const pending = setupAutoAdvanceRef.current;
        if (pending?.waitingForAppReturn) {
          setupAutoAdvanceRef.current = {
            ...pending,
            returnedFromExternalStep: true,
            waitingNoticeShown: false
          };
        }
        setNotice("DNS Guard is now active.");
      } else if (event.dnsGuardCaptivePaused) {
        setNotice(dnsGuardCoverageMessage("android-dns-guard-captive-paused"));
      } else if (event.runtimeReady || event.stopReason === "private-dns-unsupported") {
        setNotice("Web filtering is inactive. Check DNS Guard health in Shield to resolve this network’s settings.");
      }
    });
    return () => subscription.remove();
  }, [onRefresh]);

  const runActivationTest = React.useCallback(() => {
    if (setupActionRunningRef.current) return;
    setupActionRunningRef.current = true;
    const adultSmokeHost = "pornhub.com";
    const normalSmokeHost = "www.khanacademy.org";
    const smokeOptions = { userAllowedDomains };
    const adultSmoke = classifyUrl(`https://${adultSmokeHost}`, smokeOptions);
    const normalSmoke = classifyUrl(`https://${normalSmokeHost}`, smokeOptions);
    setBusy("test");

    void (async () => {
      let syncResult: Awaited<ReturnType<typeof syncNativeAdultDomainFeed>> | null = null;
      let syncFailed = false;

      try {
        syncResult = await syncNativeAdultDomainFeed();
      } catch {
        syncFailed = true;
      }

      try {
        const [refreshResult, nativeDiagnostics] = await Promise.all([
          onRefresh(),
          runActivationDiagnostics(adultSmokeHost, normalSmokeHost, reviewedAdultFeedRequired)
        ]);
        const { capability, status } = refreshResult;
        const freshReadiness = getProtectionSetupReadiness(capability, status, selectedAppPackageCount, 'both', appGuardMode);
        const testedActivationSignature = buildProtectionActivationSignature(capability, status, selectedAppPackageCount);
        setActivationTest({
          adultBlocked: adultSmoke.verdict === "block" && nativeDiagnostics.adultBlocked,
          normalAllowed: normalSmoke.verdict === "allow" && nativeDiagnostics.normalAllowed,
          nativeReady: freshReadiness.activationReady && nativeDiagnostics.nativeChecksPassed,
          nativeChecked: nativeDiagnostics.checkedNativeLayer,
          nativeMessage: nativeDiagnostics.message,
          nativeIssues: nativeDiagnostics.issues ?? [],
          nativeDiagnostics,
          statusSignature: testedActivationSignature
        });

        if (syncResult?.warning) {
          setNotice(
            `Activation test used embedded adult-domain protection after feed sync warning: ${safeUserFacingMessage(syncResult.warning, "remote feed unavailable")}`
          );
        } else if (syncFailed) {
          setNotice("Activation test could not refresh the adult-domain feed sync, but current native permission/feed status was checked.");
        } else if (syncResult?.provider === "remote") {
          setNotice("Activation test refreshed the reviewed adult-domain feed before checking native readiness.");
        } else if (syncResult?.provider === "remote-cache") {
          setNotice("Activation test confirmed the reviewed adult-domain feed is unchanged before checking native readiness.");
        }
      } catch {
        setActivationTest({
          adultBlocked: adultSmoke.verdict === "block",
          normalAllowed: normalSmoke.verdict === "allow",
          nativeReady: false,
          nativeChecked: false,
          nativeMessage: "Native diagnostics could not run.",
          nativeIssues: ["Native diagnostics could not run."],
          nativeDiagnostics: null,
          statusSignature: currentProtectionActivationSignature
        });
        setNotice("Activation test could not refresh native permission/feed status. Try again after returning from system settings.");
      } finally {
        setupActionRunningRef.current = false;
        setBusy(null);
      }
    })();
  }, [currentProtectionActivationSignature, userAllowedDomains, onRefresh, reviewedAdultFeedRequired, selectedAppPackageCount, appGuardMode]);

  React.useEffect(() => {
    const pending = setupAutoAdvanceRef.current;
    const advance = decideSetupAdvance({ pending, steps: permissionPlan, busy: busy !== null,
      native: nativeProtectionPlatform, complete: activationComplete, ready: activationReady, testPassed: activationTestPassed });
    if (advance.action === "clear") { setupAutoAdvanceRef.current = null; return; }
    if (!pending || busy !== null || !nativeProtectionPlatform || activationComplete) return;

    const completedStep = permissionPlan.find((step) => step.id === pending.fromStepId);
    if (!completedStep) return;
    if (pending.waitingForAppReturn && !pending.returnedFromExternalStep && completedStep.status !== "complete") return;
    if (completedStep.status !== "complete" && !pending.continueAfterOptional) {
      if (!pending.waitingNoticeShown && completedStep.status !== "unavailable") {
        setupAutoAdvanceRef.current = { ...pending, waitingNoticeShown: true };
        setNotice(`${completedStep.title} is still not complete. Finish the opened setup step and return to FREED; setup will continue automatically.`);
      }
      return;
    }

    if (advance.action === "step") {
      setNotice(
        pending.continueAfterOptional && completedStep.status !== "complete"
          ? `${completedStep.title} can be finished later. Continuing setup: ${advance.step.title}.`
          : `Continuing setup: ${advance.step.title}.`
      );
      runStepAction(advance.step);
      return;
    }

    if (advance.action === "test") {
      setupAutoAdvanceRef.current = { fromStepId: completedStep.id, testTriggered: true };
      setNotice("All required setup rows are ready. Running the local configuration check now.");
      runActivationTest();
      return;
    }

    if (activationTestPassed) {
      setupAutoAdvanceRef.current = null;
    }
  }, [
    activationComplete,
    activationReady,
    activationTestPassed,
    busy,
    nativeProtectionPlatform,
    nextRequiredStep,
    permissionPlan,
    runActivationTest,
    runStepAction
  ]);

  const handleSetupContinue = React.useCallback(() => {
    if (activationComplete || !nativeProtectionPlatform) {
      if (!nativeProtectionPlatform) { onContinue(); return; }
      if (setupActionRunningRef.current) return;
      setupActionRunningRef.current = true;
      setBusy('test');
      void onRefresh().then(({ capability, status }) => {
        const fresh = getProtectionSetupReadiness(capability, status, selectedAppPackageCount, 'both', appGuardMode);
        const signature = buildProtectionActivationSignature(capability, status, selectedAppPackageCount);
        if (canFinishProtectionSetup(activationTest, fresh.activationReady, signature)) onContinue();
        else {
          setActivationTest(null);
          setNotice('Protection status changed since the last configuration check. Run the configuration check again before activation can finish.');
        }
      }).catch(() => {
        setActivationTest(null);
        setSetupActionError("This step couldn't finish. Try again, or open Help for details.");
      }).finally(() => { setupActionRunningRef.current = false; setBusy(null); });
      return;
    }

    if (nextRequiredStep) {
      runStepAction(nextRequiredStep);
      return;
    }

    if (activationReady && !activationTestPassed) {
      runActivationTest();
      return;
    }

    setNotice("Finish required protection setup before entering FREED on this device. Adult blocking and app interruptions need the required native permissions first.");
  }, [
    activationComplete,
    activationReady,
    activationTestPassed,
    nativeProtectionPlatform,
    nextRequiredStep,
    onContinue,
    runActivationTest,
    runStepAction,
    onRefresh,
    selectedAppPackageCount,
    appGuardMode,
    activationTest
  ]);

  const androidWizardStep = nextRequiredStep ?? (!activationTestPassed ? activationRecoveryStep : null);

  React.useEffect(() => {
    if (Platform.OS !== "android" || activationComplete) return;
    if (androidWizardStep?.id !== "android-dns-guard" && !retryAdultStart) return;

    const interval = setInterval(async () => {
      try {
        const refreshed = await onRefresh();
        if (
          canAutoStartDnsGuard(vpnDisclosureAcknowledged, refreshed.status) &&
          busy === null
        ) {
          setRetryAdultStart(false);
          // Consent exists but the tunnel is not up: attempt a capped restart.
          // When attempts are exhausted, leave a manual-recovery notice instead
          // of looping forever (the old crash-loop amplifier).
          if (!attemptAdultStart("Android VPN permission approved. Starting DNS Guard now.", refreshed.status)) {
            if (dnsGuardAutoStartAttemptsRef.current >= DNS_GUARD_MAX_AUTO_STARTS) {
              setNotice("DNS Guard could not finish starting on its own. Tap Continue to run it again.");
            }
          }
        }
      } catch {
        // silent
      }
    }, 1_200);

    return () => clearInterval(interval);
  }, [activationComplete, androidWizardStep?.id, busy, onRefresh, retryAdultStart, attemptAdultStart, vpnDisclosureAcknowledged]);

  const androidDnsGuardAwaitingRuntime =
    Platform.OS === "android" &&
    !hasVpnSetupConflict(protectionStatus) && !hasPrivateDnsSetupConflict(protectionStatus) &&
    androidWizardStep?.id === "android-dns-guard" &&
    !activationComplete &&
    protectionStatus?.vpnConsentRequired === false &&
    !protectionStatus?.adultFilterActive &&
    !protectionStatus?.dnsGuardLastStopReason;
  const androidDnsGuardStarting = androidDnsGuardAwaitingRuntime && !dnsGuardWaitExpired &&
    dnsGuardAutoStartAttemptsRef.current < DNS_GUARD_MAX_AUTO_STARTS;
  React.useEffect(() => {
    if (!androidDnsGuardAwaitingRuntime || dnsGuardWaitExpired) return;
    const timer = setTimeout(() => {
      setDnsGuardWaitExpired(true);
      setNotice("The connection didn't start in time. Retry, or check whether another VPN is active.");
    }, 12_000);
    return () => clearTimeout(timer);
  }, [androidDnsGuardAwaitingRuntime, dnsGuardWaitExpired]);
  const androidWizardAttempts = androidWizardStep ? setupStepAttemptsRef.current[androidWizardStep.id] ?? 0 : 0;
  const androidWizardStepBlocked = Boolean(
    !activationComplete &&
      androidWizardStep &&
      (androidWizardStep.status === "unavailable" || androidWizardAttempts >= 2)
  );
  const androidWizardBlockedReason: ProtectionSetupFallbackReason =
    androidWizardStep?.status === "unavailable"
      ? "native-capability-unavailable"
      : androidWizardStep?.id === "android-native-adult-domain-feed"
        ? "reviewed-feed-unavailable"
        : "activation-not-ready";
  const handleAndroidWizardPrimary = React.useCallback(() => {
    if (activationComplete || !nativeProtectionPlatform) {
      handleSetupContinue();
      return;
    }

    if (nextRequiredStep) {
      if (nextRequiredStep.status === 'unavailable') { void onRefresh(); return; }
      setupStepAttemptsRef.current[nextRequiredStep.id] =
        (setupStepAttemptsRef.current[nextRequiredStep.id] ?? 0) + 1;
      runStepAction(nextRequiredStep);
      return;
    }

    if (activationRecoveryStep && !activationTestPassed) {
      setupStepAttemptsRef.current[activationRecoveryStep.id] =
        (setupStepAttemptsRef.current[activationRecoveryStep.id] ?? 0) + 1;
      runStepAction(activationRecoveryStep);
      return;
    }

    if (activationReady && !activationTestPassed) {
      runActivationTest();
      return;
    }

    setNotice("Checking your device settings. Setup continues when the permission is approved.");
    void onRefresh();
  }, [
    activationComplete,
    activationReady,
    activationRecoveryStep,
    activationTestPassed,
    handleSetupContinue,
    nativeProtectionPlatform,
    nextRequiredStep,
    onRefresh,
    runActivationTest,
    runStepAction
  ]);

  // Google Play prominent VPN disclosure. Rendered in BOTH setup layouts —
  // the Android one-step wizard and the multi-step fallback — otherwise the
  // consent gate would silently dead-end the DNS Guard button on Android.
  const vpnDisclosureModal = (
    <Modal visible={vpnDisclosureOpen} transparent animationType="fade" onRequestClose={() => setVpnDisclosureOpen(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 420, borderRadius: 24, borderWidth: 1.2, borderColor: colors.border, backgroundColor: colors.surface, padding: 24, gap: 12 }}>
          <MomentumPageHeader pose="secure" context="dns-consent" title="Before DNS Guard starts" category="commitment" variant="calm" compact restrained />
          <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>
            FREED's DNS Guard uses Android's local VPN slot to route DNS resolver traffic (1.1.1.1 / 1.0.0.1) through a filter on your device.
          </Text>
          <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>
            What this means for you:
            {"\n"}• FREED checks website addresses you look up against its adult-domain list on-device.
            {"\n"}• FREED never proxies, reads, or stores your other internet traffic or page contents.
            {"\n"}• Blocked lookups return "not found"; your normal browsing and streaming stay untouched.
          </Text>
          <Text selectable style={{ color: colors.text3, lineHeight: 19 }}>
            Android will ask you to allow FREED as a VPN service next. You can turn DNS Guard off anytime in Shield settings.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <PillButton label="Not now" variant="ghost" onPress={() => setVpnDisclosureOpen(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <PillButton
                label="I understand"
                onPress={() => {
                  setVpnDisclosureOpen(false);
                  onAcknowledgeVpnDisclosure();
                  // Run directly rather than via runStepAction: the acknowledged
                  // flag updates asynchronously through the parent state.
                  const step = permissionPlan.find(item => item.id === "android-dns-guard");
                  if (step) prepareSetupAutoAdvance(step, { waitingForAppReturn: true });
                  dnsGuardAutoStartAttemptsRef.current = 0;
                  runAction("adult", applyAdultContentFilter);
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Honest degraded path. Strict activation stays incomplete
  // (`markProtectionActivated` is never called here) so every protection
  // surface keeps reporting the limitation until the real test passes.
  const setupBlockedFallbackModal = (
    <Modal
      visible={setupBlockedSheetOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setSetupBlockedSheetOpen(false)}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 24,
            borderWidth: 1.2,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 24,
            gap: 12
          }}
        >
          <MomentumPageHeader pose="reassure" context="protection-limited" title="Continue without full protection?" category="calm" variant="calm" compact restrained />
          <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>
            {`FREED cannot finish "${androidWizardStep?.title ?? "this setup step"}" on this device right now.`}
            {"\n"}• Still available: recovery challenges, progress, check-ins, breathing and local CLARA guidance.
            {"\n"}• Protection is incomplete: website blocking or app interruptions may be off until you finish setup.
          </Text>
          <Text selectable style={{ color: colors.text3, lineHeight: 19 }}>
            FREED keeps a limited-protection banner on Home until the configuration check passes. You can reopen setup from that banner at any time.
          </Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <PillButton label="Keep trying" variant="ghost" onPress={() => setSetupBlockedSheetOpen(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <PillButton
                label="Continue anyway"
                onPress={() => {
                  setSetupBlockedSheetOpen(false);
                  onAcknowledgeSetupFallback(androidWizardBlockedReason);
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  const setupTheme = useOfferTheme();
  const setupPresentation = presentProtectionSetup({
    platform: protectionCapability?.platform === "ios" || Platform.OS === "ios" ? "ios"
      : protectionCapability?.platform === "android" || Platform.OS === "android" ? "android" : "preview",
    step: androidWizardStep,
    complete: activationComplete,
    ready: activationReady,
    busy,
    dnsStarting: androidDnsGuardStarting,
    dnsFailed: dnsGuardWaitExpired || Boolean(protectionStatus?.dnsGuardRuntimeIssue || protectionStatus?.dnsGuardLastStopReason || protectionStatus?.otherVpnActive),
    vpnConflict: hasVpnSetupConflict(protectionStatus),
    privateDnsConflict: hasPrivateDnsSetupConflict(protectionStatus)
  });
  const setupIssue = setupActionError ?? (dnsGuardWaitExpired && androidWizardStep?.id === "android-dns-guard"
    ? "The connection hasn't started. Retry, or check whether another VPN is active."
    : androidWizardStep?.status === "unavailable"
    ? "This permission isn't available in the installed build. Open Help for your options."
    : androidWizardStepBlocked ? "This step hasn't completed yet. You can retry or open Help."
    : protectionStatus?.safariExtensionSettingsError && androidWizardStep?.id === "ios-safari-content-blocker"
      ? "Safari settings could not open directly. Open Settings, choose Apps → Safari → Extensions, and enable FREED Safari Blocker."
      : null);

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <ProtectionSetupView
        presentation={setupPresentation}
        busy={busy !== null || (androidDnsGuardStarting && androidWizardStep?.id === "android-dns-guard")}
        onContinue={handleAndroidWizardPrimary}
        steps={permissionPlan}
        showDetails={setupDetailsExpanded}
        onToggleDetails={() => setSetupDetailsExpanded(value => !value)}
        limited={androidWizardStepBlocked}
        onLimited={() => setSetupBlockedSheetOpen(true)}
        issue={setupIssue}
        details={(
          <View style={{ gap: 16 }}>
            {notice || protectionSyncMessage ? <Text selectable style={{ color: setupTheme.secondary, fontSize: 14, lineHeight: 24 }}>{notice ?? protectionSyncMessage}</Text> : null}
            {androidSettingsReturnHintText ? <Text style={{ color: setupTheme.secondary, fontSize: 14, lineHeight: 24 }}>{androidSettingsReturnHintText}</Text> : null}
            {activationTestMessage ? <Text selectable style={{ color: setupTheme.secondary, fontSize: 14, lineHeight: 24 }}>{activationTestMessage}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Refresh protection status" disabled={busy !== null} onPress={() => { void onRefresh(); }} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: setupTheme.accent, fontSize: 17, fontWeight: "700" }}>Check settings again</Text>
            </Pressable>
            {onOpenAdvancedProtection ? <PillButton label="Advanced protection" variant="ghost" onPress={onOpenAdvancedProtection} /> : null}
            <Text style={{ color: setupTheme.secondary, fontSize: 14, lineHeight: 24 }}>Notifications and guided challenge sensors are optional. Protection settings are available in Protect.</Text>
          </View>
        )}
      />
      {vpnDisclosureModal}
      {setupBlockedFallbackModal}
    </>
  );
}

function getProtectionPermissionStatusColor(status: ProtectionPermissionStatus) {
  switch (status) {
    case "complete":
      return colors.mint;
    case "needed":
      return colors.yellow;
    case "optional":
      return colors.sky;
    case "unavailable":
      return colors.text3;
  }
}

function getProtectionPermissionStatusLabel(status: ProtectionPermissionStatus) {
  switch (status) {
    case "complete":
      return "Ready";
    case "needed":
      return "Needed";
    case "optional":
      return "On demand";
    case "unavailable":
      return "Unavailable";
  }
}

function AlwaysAllowSection({
  supported = Platform.OS === "android",
  domains,
  onChange
}: {
  supported?: boolean;
  domains: string[];
  onChange: (domains: string[]) => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const addDomain = React.useCallback(() => {
    const host = draft
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
      .split("/")[0]
      .split("@")
      .pop()!
      .split(":")[0]
      .replace(/^www\./, "");
    if (!host.includes(".") || host.length < 4 || /[^a-z0-9.-]/.test(host)) {
      setError("Enter a valid domain, like example.com.");
      return;
    }
    if (domains.includes(host)) {
      setError("That domain is already on the local exception list.");
      return;
    }
    if (domains.length >= 200) {
      setError("The local exception list is full (200 domains).");
      return;
    }
    setError(null);
    setDraft("");
    onChange([...domains, host]);
  }, [draft, domains, onChange]);

  const removeDomain = React.useCallback(
    (host: string) => {
      onChange(domains.filter((item) => item !== host));
    },
    [domains, onChange]
  );

  if (!supported) return <Card category="commitment" title="Allowed sites unavailable"><Text testID="allowed-sites-unsupported" style={{ color: colors.text2, lineHeight: 24 }}>This platform does not support local site exceptions. If an ordinary site is blocked, open Privacy & support for wrong-block help.</Text></Card>;

  return (
    <Card category="commitment" title={"Allowed sites"}>
      
      <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 8 }}>
        Android exceptions apply only to FREED’s local ordinary-site rules. Known adult domains cannot be excepted. DNS queries still use Cloudflare Families, which may continue blocking the site. For a wrong block, open Privacy & support.
      </Text>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <TextInput
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (error) setError(null);
          }}
          onSubmitEditing={addDomain}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="shield-allow-domain"
          placeholder="example.com"
          placeholderTextColor={colors.text3}
          style={{
            flex: 1,
            minHeight: 48,
            borderRadius: 16,
            borderWidth: 1.4,
            borderColor: colors.border,
            color: colors.text,
            paddingHorizontal: 16,
            fontSize: 17,
            backgroundColor: colors.surface2
          }}
        />
        <PillButton label="Add" variant="ghost" onPress={addDomain} disabled={draft.trim().length === 0} />
      </View>
      {error ? <Text selectable style={{ color: colors.yellow, marginTop: 8 }}>{error}</Text> : null}
      {domains.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {domains.map((domain) => (
            <Pressable
              key={domain}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${domain} from local exceptions`}
              onPress={() => removeDomain(domain)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                borderWidth: 1.2,
                borderColor: colors.border,
                backgroundColor: colors.surface2,
                paddingVertical: 8,
                paddingHorizontal: 12,
                minHeight: 36
              }}
            >
              <Text selectable style={{ color: colors.text2, fontSize: 13 }}>{domain}</Text>
              <X color={colors.text3} size={12} strokeWidth={3} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

type HabitItem = { key: DailyHabitKey; label: string; done: boolean; accent: string; dateKey: string };

function HomeScreen({ nativeAppBreak, ...props }: FunctionalTodayProps & { nativeAppBreak?: PresentedNativeAppBreak | null }) {
  const { colors } = useAppTheme();
  return <View style={{ flex: 1 }}>{nativeAppBreak ? <View style={{ paddingHorizontal: 24, paddingVertical: 8, backgroundColor: colors.surface }}><Text translate={false} style={{ color: colors.text, fontWeight: '600' }}>{appI18n.t('earnedTime.appBreakLabel', { defaultValue: 'App break' })}</Text><EarnedTimeCountdown expiresAt={nativeAppBreak.expiresAt} /></View> : null}<FunctionalToday {...props} /></View>;
}

/** Public Progress and old report links share the same recorded-date presenter. */
function AnalyticsScreen(props: React.ComponentProps<typeof RetainedAnalyticsScreen> & ProgressRecordActions) {
  const { colors } = useAppTheme(); const bottomPadding = useMomentumBottomPadding();
  return <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingBottom: bottomPadding, gap: 24 }}>
    <MomentumPageHeader pose="read" context="progress" title="Progress" description="See what you recorded and which actions helped." category="reflection" variant="progress" compact />
    {props.focus && props.focus !== 'history' ? <Text testID="progress-unavailable-view" style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>This view is unavailable. Your recorded history is shown below.</Text> : null}
    <RecoveryHistory state={props.recoveryState} onCheckIn={props.onCheckIn} journalEntries={props.journalEntries} journalLegacySourceIds={props.journalLegacySourceIds} onOpenJournalEntry={props.onOpenJournalEntry} onStartReset={props.onStartReset} canRepeatReset={props.canRepeatReset} onBrowseResets={props.onBrowseResets} showSummary />
  </ScrollView>;
}

/** Retained for historical data obligations; unsupported report presentations are not mounted publicly. */
function RetainedAnalyticsScreen({
  focus,
  recoveryState,
  streakDays,
  bestStreakDays,
  completedChallenges,
  attemptsToday,
  premiumCapabilities,
  recoveryLevel,
  achievements,
  checkInSummary,
  checkInInsight,
  weeklyReport,
  monthlyGrowthReport,
  analyticsSnapshot,
  analyticsSharing,
  analyticsSharingReadiness,
  analyticsSendBusy,
  analyticsSendMessage,
  onCheckIn,
  onEnableAnalyticsSharing,
  onDisableAnalyticsSharing,
  onSendAnalyticsSnapshot,
  urgeRiskForecast,
  journalEntries = [],
  journalLegacySourceIds = []
}: {
  focus?: string;
  recoveryState: RecoveryState;
  streakDays: number;
  bestStreakDays: number;
  completedChallenges: number;
  attemptsToday: number;
  premiumCapabilities: PremiumCapabilitySet;
  recoveryLevel: RecoveryLevel;
  achievements: AchievementBadge[];
  checkInSummary: CheckInSummary;
  checkInInsight: string;
  weeklyReport: WeeklyRecoveryReport;
  monthlyGrowthReport: MonthlyGrowthReport;
  analyticsSnapshot: RecoveryAnalyticsSnapshot;
  analyticsSharing: AnalyticsSharingSettings;
  analyticsSharingReadiness: AnalyticsSharingReadiness;
  analyticsSendBusy: boolean;
  analyticsSendMessage: string | null;
  onCheckIn: () => void;
  onEnableAnalyticsSharing: () => void;
  onDisableAnalyticsSharing: () => void;
  onSendAnalyticsSnapshot: () => void;
  urgeRiskForecast: LocalUrgeRiskForecast;
  journalEntries?: readonly Readonly<JournalEntry>[];
  journalLegacySourceIds?: readonly string[];
}) {
  useTranslation();
  const { colors, gradients, typography } = useAppTheme();
  const bottomPadding = useMomentumBottomPadding();
  const score = calculateRecoveryScore(streakDays, completedChallenges, attemptsToday);
  const summaryStart = new Date(); summaryStart.setDate(summaryStart.getDate() - 6);
  const summaryStartKey = getLocalDateKey(summaryStart);
  const hasSleepSignals = recoveryState.dailyCheckIns.some(item => item.dateKey >= summaryStartKey && item.sleepQuality !== null);
  const hasCheckInSignals = checkInSummary.total > 0;
  const hasChallengeSignals = analyticsSnapshot.interventions.helpfulChallenges + analyticsSnapshot.interventions.stillUrgingChallenges > 0;
  const clarityScore = hasCheckInSignals
    ? Math.max(0, Math.min(100, Math.round(100 - checkInSummary.averageUrge * 16 + checkInSummary.steadyDays * 4)))
    : 0;
  const energyScore = hasSleepSignals ? Math.max(0, Math.min(100, Math.round(checkInSummary.averageSleep * 20))) : 0;
  const urgeControlScore = hasChallengeSignals
    ? analyticsSnapshot.interventions.challengeHelpRate
    : attemptsToday > 0
    ? Math.max(0, 100 - attemptsToday * 20)
    : 0;
  const sleepGuardScore = hasSleepSignals ? Math.max(0, Math.min(100, Math.round(checkInSummary.averageSleep * 20))) : 0;
  const hasAnySignals = hasCheckInSignals || hasChallengeSignals || attemptsToday > 0 || completedChallenges > 0;
  const forecastHasEnoughSignals = urgeRiskForecast.confidence !== "low";
  const hasMonthlySignals = monthlyGrowthReport.protectedMoments + monthlyGrowthReport.helpfulChallenges + monthlyGrowthReport.checkIns + monthlyGrowthReport.slips > 0;
  const bars = [
    ["Discipline", hasAnySignals ? score : null, colors.mint],
    ["Clarity", hasCheckInSignals ? clarityScore : null, colors.mintLight],
    ["Energy", hasSleepSignals ? energyScore : null, colors.peach],
    ["Urge Control", hasChallengeSignals || attemptsToday > 0 ? urgeControlScore : null, colors.peachLight],
    ["Sleep Guard", hasSleepSignals ? sleepGuardScore : null, colors.sky]
  ];
  const forecastAccent =
    urgeRiskForecast.level === "high" ? colors.peach : urgeRiskForecast.level === "elevated" ? colors.peachLight : colors.mint;
  const forecastGradient =
    urgeRiskForecast.level === "high" ? gradients.peach : urgeRiskForecast.level === "elevated" ? gradients.peach : gradients.mint;
  const peakRiskLabel =
    analyticsSnapshot.productionMetrics.peakUrgeHour === null
      ? "None"
      : `${String(analyticsSnapshot.productionMetrics.peakUrgeHour).padStart(2, "0")}:00`;
  const analyticsSharingReady = analyticsSharingReadiness.ready;
  const analyticsSharingStatus = analyticsSharing.enabled
    ? analyticsSharingReady
      ? analyticsSharing.lastSentAt
        ? `Ready - last sent ${new Date(analyticsSharing.lastSentAt).toLocaleDateString(appI18n.language, appI18n.language === "ar" ? { numberingSystem: "arab" } : {})}`
        : "Ready to send"
      : "Needs setup"
    : "Off";
  const analyticsGapText = analyticsSharingReadiness.gaps
    .slice(0, 2)
    .map((gap) => gap.replace(/-/g, " "))
    .join(", ");

  const summaryEnd = new Date();
  const summaryEndKey = getLocalDateKey(summaryEnd);
  const hasCompletedCheckInToday = buildRecoveryDaySnapshot(recoveryState, summaryEnd, summaryEnd).checkInCompleted;
  const recordedResets = analyticsSnapshot.interventions.completedChallenges;
  const helpfulResets = analyticsSnapshot.interventions.helpfulChallenges;
  const stillUrgingResets = analyticsSnapshot.interventions.stillUrgingChallenges;
  const unknownResets = Math.max(0, recordedResets - helpfulResets - stillUrgingResets);
  const lastHelpfulReset = recoveryState.challengeHistory
    .filter(record => {
      const key = record.source === 'tool' && record.dateKey ? record.dateKey : getLocalDateKey(record.completedAt);
      return record.outcome === 'helped' && key >= summaryStartKey && key <= summaryEndKey;
    })
    .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))[0];
  const nextAdjustment = lastHelpfulReset
    ? appI18n.t('progressPurpose.nextHelpfulReset', { title: lastHelpfulReset.title })
    : helpfulResets > 0
      ? appI18n.t('progressPurpose.nextHelpfulArchive')
      : stillUrgingResets > 0
        ? appI18n.t('progressPurpose.nextStillUrging')
        : unknownResets > 0
          ? appI18n.t('progressPurpose.nextUnknown')
          : checkInSummary.total > 0
            ? appI18n.t('progressPurpose.nextCheckins')
            : appI18n.t('progressPurpose.nextEmpty');
  const recordedCount = (value: number) => new Intl.NumberFormat(appI18n.language, appI18n.language === 'ar' ? { numberingSystem: 'arab' } : {}).format(value);
  const recordBody = { color: colors.text2, fontSize: 17, lineHeight: 26 } as const;
  const recordRow = { flexDirection: 'row', alignItems: 'center', gap: 16 } as const;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingBottom: bottomPadding, gap: 24 }}>
<MomentumPageHeader pose="read" context="progress" title={focus ? FEATURE_DEFINITIONS.find(f => { const d = FEATURE_DESTINATIONS[f.id]; return d.kind === "focus" && d.tab === "progress" && d.section === focus; })?.title ?? "Progress" : "Progress"} description="See what you recorded and which actions helped." category="reflection" variant="progress" compact />
      {!focus ? <>
      <RecoveryHistory state={recoveryState} onCheckIn={onCheckIn} journalEntries={journalEntries} journalLegacySourceIds={journalLegacySourceIds} />
      <View testID="progress-recorded-summary" style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, padding: 16, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Text testID="progress-summary-title" translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: typography.heavy }}>{appI18n.t('progressPurpose.recordedWeek')}</Text>
          <Text translate={false} style={recordBody}>{appI18n.t('progressPurpose.weekRange', { start: summaryStart.toLocaleDateString(appI18n.language, { month: 'short', day: 'numeric' }), end: summaryEnd.toLocaleDateString(appI18n.language, { month: 'short', day: 'numeric' }) })}</Text>
        </View>
        <View style={recordRow}><Text translate={false} style={{ flex: 1, ...recordBody }}>{appI18n.t('progressPurpose.checkins')}</Text><Text testID="progress-checkin-count" translate={false} selectable style={{ color: colors.text, fontSize: 26, fontWeight: typography.heavy, fontVariant: ['tabular-nums'] }}>{recordedCount(checkInSummary.total)}</Text></View>
        <View style={recordRow}><Text translate={false} style={{ flex: 1, ...recordBody }}>{appI18n.t('progressPurpose.resets')}</Text><Text testID="progress-reset-count" translate={false} selectable style={{ color: colors.text, fontSize: 26, fontWeight: typography.heavy, fontVariant: ['tabular-nums'] }}>{recordedCount(recordedResets)}</Text></View>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, gap: 12 }}>
          <Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: typography.bold }}>{appI18n.t('progressPurpose.feedbackTitle')}</Text>
          {[
            ['progress-helpful-count', appI18n.t('progressPurpose.helpful'), helpfulResets],
            ['progress-still-urging-count', appI18n.t('progressPurpose.stillUrging'), stillUrgingResets],
            ['progress-unknown-count', appI18n.t('progressPurpose.unknown'), unknownResets]
          ].map(([id, label, value]) => <View key={id} style={recordRow}><Text translate={false} style={{ flex: 1, ...recordBody }}>{label}</Text><Text testID={id as string} translate={false} selectable style={{ color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: typography.bold, fontVariant: ['tabular-nums'] }}>{recordedCount(value as number)}</Text></View>)}
        </View>
        {lastHelpfulReset ? <Text testID="progress-helpful-reset" translate={false} selectable style={recordBody}>{appI18n.t('progressPurpose.helpfulReset', { title: lastHelpfulReset.title })}</Text> : null}
        {checkInSummary.total === 0 && recordedResets === 0 ? <Text translate={false} style={recordBody}>{appI18n.t('progressPurpose.noRecords')}</Text> : null}
        <Text testID="progress-self-report-note" translate={false} style={recordBody}>{appI18n.t('progressPurpose.selfReportNote')}</Text>
        <PillButton label={hasCompletedCheckInToday ? appI18n.t('progressPurpose.reviewCheckin') : "Start today's check-in"} onPress={onCheckIn} />
      </View>
      <View testID="progress-next-adjustment" style={{ borderStartWidth: 3, borderStartColor: colors.accent, paddingStart: 16, gap: 8 }}>
        <Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: typography.heavy }}>{appI18n.t('progressPurpose.nextAdjustment')}</Text>
        <Text testID="progress-next-adjustment-copy" translate={false} style={recordBody}>{nextAdjustment}</Text>
      </View>
      <Card title={appI18n.t('progressPurpose.supportingDetails')} collapsible initiallyExpanded={false} category="reflection">
        <Text translate={false} style={recordBody}>{appI18n.t('progressPurpose.supportingNote')}</Text>
        {FEATURE_DEFINITIONS.filter(feature => feature.group === 'Progress').map(feature => <Pressable key={feature.id} testID={`progress-detail-${feature.id}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/flow/feature', params: { feature: feature.id } })} style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 8 }}><Text style={{ color: colors.accent, fontSize: 17, lineHeight: 26, fontWeight: typography.bold }}>{feature.title}</Text></Pressable>)}
      </Card>
      </> : <>
      {focus !== 'history' ? <Text translate={false} style={recordBody}>{appI18n.t('progressPurpose.supportingNote')}</Text> : null}
      <FocusedFeatureContent focus={focus}>
      <RecoveryHistory state={recoveryState} onCheckIn={onCheckIn} journalEntries={journalEntries} journalLegacySourceIds={journalLegacySourceIds} />
      
      <MomentumMetricStrip>
        <Metric label="Current" value={`${streakDays}d`} color={colors.mint} />
        <Metric label="Best" value={`${bestStreakDays}d`} color={colors.mint} />
        <Metric label="Attempts" value={`${attemptsToday}`} color={attemptsToday > 0 ? colors.peach : colors.mint} />
      </MomentumMetricStrip>
      {!hasAnySignals ? (
        <EmptyState
          icon={<BarChart3 color={colors.mint} size={28} />}
          title="No signals yet"
          message="Check-ins, challenges, and protected moments will build your recovery picture here. Start with today's check-in."
          actionLabel="Log today's check-in"
          onAction={onCheckIn}
        />
      ) : null}
      <Card title="Activity estimate" collapsible initiallyExpanded={false} gradient={gradients.mint} style={{ alignItems: "center", gap: 12 }} category="movement">
        {hasAnySignals ? <ProgressRing value={score} size={112} /> : (
          <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: typography.heavy }}>Not enough data yet</Text>
        )}
        <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 24, marginTop: 12 }}>
          Activity estimate based on streak, completed challenges, and today&apos;s recorded attempts. It is not a clinical measurement or a probability of recovery.
        </Text>
      </Card>
      <Card title="Milestones and achievements" collapsible initiallyExpanded={false} gradient={gradients.mint} category="movement">
        <Text selectable style={{ color: colors.mint, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
          LEVEL {recoveryLevel.level}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 8 }}>
          <Text selectable style={{ flex: 1, color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
            {recoveryLevel.xp} XP
          </Text>
          <Text selectable style={{ color: colors.text2, fontWeight: typography.bold, fontVariant: ["tabular-nums"] }}>
            {Math.max(0, recoveryLevel.nextLevelXp - recoveryLevel.xp)} to next
          </Text>
        </View>
        <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: "hidden", marginTop: 12 }}>
          <View style={{ width: `${Math.round(recoveryLevel.progress * 100)}%`, height: "100%", backgroundColor: colors.mint }} />
        </View>
        <View style={{ gap: 12, marginTop: 16 }}>
          {achievements.map((badge) => (
            <View key={badge.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: badge.earned ? colors.accentTint : colors.surface2
                }}
              >
                {badge.earned ? <Check color={colors.mint} size={17} strokeWidth={3} /> : <Target color={colors.text3} size={16} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                  {badge.title}
                </Text>
                <Text selectable style={{ color: colors.text2, fontSize: 12, marginTop: 4 }}>
                  {badge.earned ? "Unlocked" : `${badge.progress}/${badge.target} - ${badge.detail}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
      <Card gradient={gradients.sky} category="reflection" title={"PERSONAL INSIGHT"} collapsible initiallyExpanded={false}>
        
        <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: typography.heavy, marginTop: 8 }}>
          {checkInInsight}
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          {[
            ["Check-ins", `${checkInSummary.total}/7`, colors.sky],
            ["Avg urge", `${checkInSummary.averageUrge}`, colors.peach],
            ["Avg sleep", hasSleepSignals ? `${checkInSummary.averageSleep}` : "—", colors.mint]
          ].map(([label, value, color]) => (
            <View key={label as string} style={{ flex: 1, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.surface2, padding: 12 }}>
              <Text selectable style={{ color: color as string, fontSize: 20, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {value as string}
              </Text>
              <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold, marginTop: 4 }}>
                {label as string}
              </Text>
            </View>
          ))}
        </View>
      </Card>
      {premiumCapabilities.relapsePrediction ? (
        <Card title="Urge estimate" gradient={forecastGradient} category="movement">
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
            <View
              style={{
                width: 84,
                minHeight: 84,
                borderRadius: 20,
                backgroundColor: colors.border,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text selectable style={{ color: forecastAccent, fontSize: 30, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {forecastHasEnoughSignals ? urgeRiskForecast.score : "—"}
              </Text>
              <Text selectable style={{ color: colors.text3, fontSize: 11, fontWeight: typography.bold }}>
                {forecastHasEnoughSignals ? "estimate" : "needs data"}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text selectable style={{ color: forecastAccent, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
                URGE ESTIMATE
              </Text>
              <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: typography.heavy }}>
                {forecastHasEnoughSignals ? urgeRiskForecast.recommendedAction : "Not enough data for an estimate"}
              </Text>
              <Text selectable style={{ color: colors.text2, lineHeight: 20 }}>
                {forecastHasEnoughSignals
                  ? `${urgeRiskForecast.level.toUpperCase()} · ${urgeRiskForecast.confidence} data confidence${urgeRiskForecast.currentWindow ? ` · ${urgeRiskForecast.currentWindow}` : ""}`
                  : "Keep logging check-ins and reset outcomes to build a useful pattern."}
              </Text>
            </View>
          </View>
          <Text selectable style={{ color: colors.text3, fontSize: 12, lineHeight: 18, marginTop: 12 }}>
            A rule-based estimate from local logs and schedules. It is not a measured relapse probability or a clinical prediction.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {urgeRiskForecast.drivers.slice(0, 3).map((driver) => (
              <View key={driver} style={{ borderRadius: 999, backgroundColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold }}>
                  {driver}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      <Card category="movement" title={"Weekly Report"} collapsible initiallyExpanded={false}>
        
        <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.bold, marginBottom: 12 }}>
          {weeklyReport.rangeLabel}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          {[
            [appI18n.t('progressPurpose.protectionEvents'), `${weeklyReport.attempts}`, colors.peach],
            ["Resets", `${weeklyReport.completedChallenges}`, colors.mint],
            ["Slips", `${weeklyReport.slips}`, colors.peach],
            ["Check-ins", `${weeklyReport.checkIns}`, colors.sky]
          ].map(([label, value, color]) => (
            <View key={label as string} style={{ width: "48%", minHeight: 74, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.surface2, padding: 12 }}>
              <Text selectable style={{ color: color as string, fontSize: 20, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {value as string}
              </Text>
              <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold, marginTop: 4 }}>
                {label as string}
              </Text>
            </View>
          ))}
        </View>
        <Text selectable style={{ color: colors.text, lineHeight: 22, fontWeight: typography.bold }}>
          {weeklyReport.strongestPattern}
        </Text>
        <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 8 }}>
          {weeklyReport.nextFocus}
        </Text>
      </Card>
      {premiumCapabilities.deepRecoveryReports ? (
        <Card title="Monthly growth" gradient={gradients.mint} category="movement">
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
            <View
              style={{
                width: 76,
                minHeight: 76,
                borderRadius: 20,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.border
              }}
            >
              <Text selectable style={{ color: colors.mint, fontSize: 28, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {hasMonthlySignals ? monthlyGrowthReport.growthScore : "—"}
              </Text>
              <Text selectable style={{ color: colors.text3, fontSize: 11, fontWeight: typography.bold }}>
                activity
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.mint, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
                MONTHLY GROWTH
              </Text>
              <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: typography.heavy, marginTop: 8 }}>
                {hasMonthlySignals ? monthlyGrowthReport.summary : "Record check-ins and resets to build your monthly report."}
              </Text>
              <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.bold, marginTop: 8 }}>
                {monthlyGrowthReport.rangeLabel}
              </Text>
            </View>
          </View>
          <Text selectable style={{ color: colors.text3, fontSize: 12, lineHeight: 18, marginTop: 12 }}>
            Calculated from your logged activity. This index does not measure clinical recovery.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
            {[
              ["Protected", `${monthlyGrowthReport.protectedMoments}`, colors.mint],
              ["Helpful", `${monthlyGrowthReport.helpfulChallenges}`, colors.sky],
              ["Check-ins", `${monthlyGrowthReport.checkIns}`, colors.yellow],
              ["Slips", `${monthlyGrowthReport.slips}`, colors.peach]
            ].map(([label, value, color]) => (
              <View key={label as string} style={{ width: "48%", minHeight: 70, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.surface2, padding: 12 }}>
                <Text selectable style={{ color: color as string, fontSize: 20, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                  {value as string}
                </Text>
                <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold, marginTop: 4 }}>
                  {label as string}
                </Text>
              </View>
            ))}
          </View>
          <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 16 }}>
            {monthlyGrowthReport.nextExperiment}
          </Text>
        </Card>
      ) : null}
      <Card gradient={gradients.sky} category="commitment" title={"PRIVACY-SAFE SNAPSHOT"} collapsible initiallyExpanded={false}>
        
        <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: typography.heavy, marginTop: 8 }}>
          This snapshot uses aggregate counts and rates. Private notes, contacts, and browsing details are excluded.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          {[
            ["Help rate", hasChallengeSignals ? `${analyticsSnapshot.interventions.challengeHelpRate}%` : "—", colors.mint],
            [appI18n.t('progressPurpose.peakEventHour'), peakRiskLabel, colors.peach],
            ["Setbacks recorded", `${weeklyReport.slips}`, colors.sky],
            ["App shields", `${analyticsSnapshot.behavior.appInterceptions}`, colors.mint],
            ["FREED opens", `${analyticsSnapshot.productionMetrics.appOpens}`, colors.yellow],
            ["Unlock/wk", `${analyticsSnapshot.productionMetrics.unlockFrequencyPerWeek}`, colors.peach]
          ].map(([label, value, color]) => (
            <View key={label as string} style={{ width: "48%", minHeight: 74, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.surface2, padding: 12 }}>
              <Text selectable style={{ color: color as string, fontSize: 18, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {value as string}
              </Text>
              <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold, marginTop: 4 }}>
                {label as string}
              </Text>
            </View>
          ))}
        </View>
      </Card>
      <Card title="Analytics sharing" category="movement">
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
              REMOTE ANALYTICS
            </Text>
            <Text selectable style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: typography.heavy, marginTop: 8 }}>
              {analyticsSharingStatus}
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 20, marginTop: 8 }}>
              Only aggregate counts and rates are sent after consent. Notes, raw URLs, contacts, receipts, and transcripts stay off the payload.
            </Text>
            {analyticsSharing.enabled && !analyticsSharingReady ? (
              <Text selectable style={{ color: colors.yellow, lineHeight: 19, marginTop: 8, fontSize: 12, fontWeight: typography.bold }}>
                {analyticsGapText || "Analytics sharing is not ready."}
              </Text>
            ) : null}
            {analyticsSendMessage ?? analyticsSharing.lastSendMessage ? (
              <Text selectable style={{ color: analyticsSharing.lastSendStatus === "ok" ? colors.mint : colors.text3, lineHeight: 19, marginTop: 8, fontSize: 12, fontWeight: typography.bold }}>
                {analyticsSendMessage ?? analyticsSharing.lastSendMessage}
              </Text>
            ) : null}
          </View>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 20,
              backgroundColor: analyticsSharingReady ? colors.accentTint : colors.surface2,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {analyticsSharingReady ? <Check color={colors.mint} size={20} strokeWidth={3} /> : <BarChart3 color={colors.text3} size={20} />}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <PillButton
              label={analyticsSharing.enabled ? "Turn Off" : "Enable Sharing"}
              variant={analyticsSharing.enabled ? "ghost" : "primary"}
              disabled={analyticsSendBusy}
              onPress={analyticsSharing.enabled ? onDisableAnalyticsSharing : onEnableAnalyticsSharing}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label={analyticsSendBusy ? "Sending..." : "Send Snapshot"}
              variant="ghost"
              disabled={!analyticsSharingReady || analyticsSendBusy}
              onPress={onSendAnalyticsSnapshot}
            />
          </View>
        </View>
      </Card>
      {premiumCapabilities.advancedAnalytics ? (
        <Card gradient={gradients.mint} category="calm" title={"ADAPTIVE SIGNALS"} collapsible initiallyExpanded={false}>
          
          <View style={{ gap: 12, marginTop: 12 }}>
            {[
              [appI18n.t('progressPurpose.eventWindow'), weeklyReport.riskWindow, colors.peach],
              ["Slip window", weeklyReport.slipWindow, colors.peachLight],
              ["Slip trigger", weeklyReport.slipTrigger, colors.yellow],
              ["Best reset", weeklyReport.bestIntervention, colors.mint],
              ["Momentum", weeklyReport.momentum, colors.sky]
            ].map(([label, value, color]) => (
              <View key={label as string} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color as string }} />
                <Text selectable style={{ width: 92, color: colors.text3, fontSize: 12, fontWeight: typography.bold }}>
                  {label as string}
                </Text>
                <Text selectable style={{ flex: 1, color: colors.text, fontWeight: typography.heavy, lineHeight: 20 }}>
                  {value as string}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      <Card category="reflection" title={"Activity Estimates"} collapsible initiallyExpanded={false}>
        
        <Text selectable style={{ color: colors.text3, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
          Derived from your streak, self-reported sleep and urges, and challenge outcomes. These are estimates, not clinical measurements.
        </Text>
        <View style={{ gap: 12 }}>
          {bars.map(([label, value, color], index) => (
            <View key={label as string} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text selectable style={{ color: colors.text2, fontWeight: typography.bold }}>
                  {label as string}
                </Text>
                <Text selectable style={{ color: color as string, fontWeight: typography.heavy }}>
                  {value === null ? "Not enough data" : `${value as number}%`}
                </Text>
              </View>
              {value !== null ? <AnimatedHabitBar value={value as number} color={color as string} delayMs={index * 80} /> : null}
            </View>
          ))}
        </View>
      </Card>
      </FocusedFeatureContent></>}
    </ScrollView>
  );
}

function AnimatedHabitBar({ value, color }: { value: number; color: string; delayMs?: number }) {
  const { colors } = useAppTheme();
  const progress = useSmoothedValue(Math.max(0, Math.min(100, value)), 160);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.get()}%` }));
  return <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.surface3, overflow: "hidden" }}><Animated.View style={[{ backgroundColor: color, height: "100%" }, barStyle]} /></View>;
}

function VerdictCard({ result }: { result: ClassificationResult }) {
  const { colors, gradients, typography } = useAppTheme();
  const blocked = result.verdict === "block";
  return (
    <Card gradient={blocked ? gradients.danger : gradients.mint} category="reflection">
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {blocked ? <Lock color={colors.red} size={28} /> : <ShieldCheck color={colors.mint} size={28} />}
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
            {blocked ? "Blocked: adult intent" : "Allowed: normal browsing"}
          </Text>
          <Text selectable style={{ color: colors.text2, marginTop: 4 }}>
            {result.reason}
          </Text>
          <Text selectable style={{ color: colors.text3, marginTop: 8, fontSize: 12 }}>
            {result.host} - {Math.round(result.confidence * 100)}% - {result.matchedRule}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function SettingToggle({
  label,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, gradients, typography } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 60,
        gap: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderCurve: "continuous",
        backgroundColor: colors.surface2
      }}
    >
      <Text selectable style={{ color: colors.text, fontWeight: typography.bold, flex: 1 }}>
        {label}
      </Text>
      <Switch disabled={disabled} value={value} onValueChange={onChange} accessibilityLabel={label} accessibilityRole="switch" accessibilityState={{ checked: value, disabled }} trackColor={{ false: colors.surface3, true: colors.mint }} />
    </View>
  );
}

function SettingSegment<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.text2, fontWeight: typography.bold }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={{
                flexGrow: 1,
                flexBasis: '30%',
                minWidth: 88,
                minHeight: 44,
                paddingHorizontal: 12,
                paddingVertical: 12,
                borderRadius: 16,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.accentTint : colors.surface2,
                borderWidth: 1,
                borderColor: active ? colors.accent : colors.surface2
              }}
            >
              <Text selectable style={{ color: active ? colors.mint : colors.text2, fontWeight: typography.semibold, fontSize: 17, textAlign: 'center', flexShrink: 1 }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SettingStepper({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const setNext = (direction: -1 | 1) => onChange(Math.min(max, Math.max(min, value + direction * step)));
  return (
    <View style={{ flex: 1, minWidth: 140, minHeight: 104, borderRadius: 16, borderCurve: "continuous", padding: 16, backgroundColor: colors.surface2, gap: 12 }}>
      <Text selectable style={{ color: colors.text2, fontSize: 17, fontWeight: typography.bold }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.text, fontSize: 32, fontWeight: typography.heavy, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => setNext(-1)} style={{ minWidth: 44, minHeight: 44, padding: 8, borderRadius: 16, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: colors.border }}>
          <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, fontSize: 18 }}>
            -
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => setNext(1)} style={{ minWidth: 44, minHeight: 44, padding: 8, borderRadius: 16, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: colors.border }}>
          <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, fontSize: 18 }}>
            +
          </Text>
        </Pressable>
      </View>
      <Text selectable style={{ color: colors.text3, fontSize: 17, fontWeight: typography.bold }}>
        {suffix}
      </Text>
    </View>
  );
}

function SettingTimeInput(props: {label:string;value:string;onChange:(value:string)=>void}) { return <NativeTimeInput {...props} />; }

function formatUnlock(unlock: EarnedUnlock | null) {
  if (!unlock) return "No active earned unlock";
  const minutesLeft = Math.max(1, Math.ceil((Date.parse(unlock.expiresAt) - Date.now()) / 60_000));
  const appPackage = Platform.OS === "android" ? appPackageForEarnedUnlockSource(unlock.sourceAttemptHost) : undefined;
  const appLabel = appPackage ? labelForDoomscrollAppPackage(appPackage) : null;

  if (appLabel) return `${minutesLeft} min ${appLabel} unlock; adult web stays blocked`;
  if (Platform.OS === "ios" && isIosScreenTimeShieldSource(unlock.sourceAttemptHost)) {
    return `${minutesLeft} min Screen Time unlock; adult web stays blocked`;
  }
  return `${minutesLeft} min challenge window; adult web stays blocked; app shields stay active`;
}

function labelForDoomscrollAppPackage(packageName: string) {
  const normalized = packageName.trim().toLowerCase();
  return (
    DOOMSCROLL_APP_OPTIONS.find(
      (option) =>
        option.androidPackage === normalized ||
        (option.androidPackageAliases as readonly string[]).includes(normalized)
    )?.label ?? null
  );
}

function DnsGuardHealthSection({
  protectionCapability,
  protectionStatus,
  onRefresh
}: {
  protectionCapability: ProtectionCapability | null;
  protectionStatus: ProtectionStatus | null;
  onRefresh: () => Promise<ProtectionRefreshResult>;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [busy, setBusy] = React.useState<"vpn" | "dns" | null>(null);
  if (!protectionCapability || protectionCapability.platform !== "android" || !protectionStatus) {
    return null;
  }
  const runtimeReady = protectionStatus.dnsGuardRuntimeReady === true;
  const captivePaused = protectionStatus.dnsGuardCaptivePaused === true;
  const filtering = isDnsGuardFiltering({ ...protectionStatus, runtimeReady });
  const otherVpnActive = protectionStatus.otherVpnActive === true;
  const alwaysOnVpnPackage = protectionStatus.alwaysOnVpnPackage;
  const privateDnsStrict = protectionStatus.privateDnsMode === "hostname";
  const privateDnsBlocked = privateDnsStrict || protectionStatus.privateDnsActive === true ||
    protectionStatus.privateDnsMode === "opportunistic";
  const avgForwardMs = protectionStatus.dnsGuardAvgForwardMs;
  const networkResolverCount = protectionStatus.dnsGuardNetworkResolverCount ?? 0;
  const hasSignal = protectionStatus.dnsGuardRuntimeReady !== undefined || otherVpnActive || privateDnsStrict;
  if (!hasSignal) return null;

  const openVpnSettingsSafely = async () => {
    setBusy("vpn");
    try {
      await openVpnSettings();
    } finally {
      setBusy(null);
      await onRefresh();
    }
  };
  const openPrivateDnsSettingsSafely = async () => {
    setBusy("dns");
    try {
      await openPrivateDnsSettings();
    } finally {
      setBusy(null);
      await onRefresh();
    }
  };

  return (
    <Card category="reflection" title={"DNS Guard health"}>
      
      {captivePaused ? (
        <Text selectable style={{ color: colors.yellow, lineHeight: 20 }}>
          Filtering is paused because this network needs a sign-in. It resumes automatically once the network is reachable.
        </Text>
      ) : null}
      {otherVpnActive ? (
        <Text selectable style={{ color: colors.text2, lineHeight: 20, marginTop: captivePaused ? 6 : 0 }}>
          Another VPN app appears to be active. Android allows only one VPN at a time, so DNS Guard cannot run alongside it.
        </Text>
      ) : null}
      {alwaysOnVpnPackage ? (
        <Text selectable style={{ color: colors.text2, lineHeight: 20, marginTop: 8 }}>
          Always-on VPN is configured for another app ({alwaysOnVpnPackage}). That setting can block DNS Guard from restarting.
        </Text>
      ) : null}
      {privateDnsBlocked ? (
        <Text selectable style={{ color: colors.text2, lineHeight: 20, marginTop: 8 }}>
          {dnsGuardCoverageMessage(protectionStatus.dnsGuardCoverageIssueCode || "android-private-dns-encrypted-unsupported")}
        </Text>
      ) : null}
      {!filtering && !captivePaused && !privateDnsBlocked ? (
        <Text selectable style={{ color: colors.text2, lineHeight: 20, marginTop: 8 }}>
          {protectionStatus.dnsGuardRuntimeIssue ?? dnsGuardCoverageMessage(protectionStatus.dnsGuardCoverageIssueCode)}
        </Text>
      ) : null}
      <Text selectable style={{ color: colors.text3, lineHeight: 19, marginTop: 12 }}>
        {runtimeReady
          ? `${filtering ? "Filtering active" : "Connection running · filtering inactive"} · ${avgForwardMs ? `${avgForwardMs} ms avg lookup` : "learning latency"} · ${networkResolverCount} network fallback${networkResolverCount === 1 ? "" : "s"}`
          : "Runtime details appear while DNS Guard runs on this device."}
      </Text>
      {runtimeReady ? (
        <Text selectable style={{ color: colors.text3, lineHeight: 19, marginTop: 8 }}>
          Known gaps: networks that resolve only over IPv6 or encrypted DNS (DoH/DoT) can bypass DNS-level filtering.
        </Text>
      ) : null}
      {(otherVpnActive || alwaysOnVpnPackage) && (
        <View style={{ marginTop: 12 }}>
          <PillButton label={busy === "vpn" ? "Opening…" : "Open VPN settings"} variant="ghost" onPress={openVpnSettingsSafely} />
        </View>
      )}
      {privateDnsBlocked && (
        <View style={{ marginTop: 12 }}>
          <PillButton label={busy === "dns" ? "Opening…" : "Open Private DNS settings"} variant="ghost" onPress={openPrivateDnsSettingsSafely} />
        </View>
      )}
    </Card>
  );
}

function ShieldScreen({
  onAttempt,
  disciplineSettings,
  activeUnlock,
  onDisciplineChange,
  protectionCapability,
  protectionStatus,
  onRefreshProtection,
  onOpenProtectionSetup,
  onOpenRecovery,
  section,
  syncing,
  syncMessage,
  onRetryProtection, onWebsiteProtectionChange, groups, groupsPending, groupsError, groupsWaitingForOwner, getActionScope = () => null, initialGroupId, onOpenGroups, onOpenGroup, onAddGroup, onPermissions, onSafariSetup, onExceptions, onDiagnostics, onRefreshGroups, createOnOpen = false, onCreateRequestConsumed
}: {
  onRetryProtection?: () => void;
  onOpenRecovery?: () => void;
  onWebsiteProtectionChange?: (enabled: boolean) => void;
  groups?: AppGroupsSnapshot | null; getActionScope?: () => string | null; initialGroupId?: string;
  groupsPending?: boolean; groupsError?: string | null; groupsWaitingForOwner?: boolean;
  onRefreshGroups?: () => Promise<unknown>; createOnOpen?: boolean; onCreateRequestConsumed?: () => boolean;
  onOpenGroups?: () => void; onOpenGroup?: (groupId: string) => void; onAddGroup?: () => void; onPermissions?: () => void; onSafariSetup?: () => void; onExceptions?: () => void; onDiagnostics?: () => void;
  syncing?: boolean; syncMessage?: string | null;
  onAttempt: (url: string) => void;
  disciplineSettings: DisciplineSettings;
  activeUnlock: EarnedUnlock | null;
  onDisciplineChange: (update: Partial<Omit<DisciplineSettings, "updatedAt">>) => void;
  protectionCapability: ProtectionCapability | null;
  protectionStatus: ProtectionStatus | null;
  onRefreshProtection: () => Promise<ProtectionRefreshResult>;
  onOpenProtectionSetup: (intent?: ProtectionIntent) => void;
  section?: FreedShieldSection;
}) {
  const { colors, typography, mode } = useAppTheme();
  const bottomPadding = useMomentumBottomPadding();
  const { width, fontScale } = useWindowDimensions();
  const [input, setInput] = React.useState("https://google.com/search?q=productivity");
  const [result, setResult] = React.useState<ClassificationResult | null>(null);
  const [advancedDiagnosticsOpen, setAdvancedDiagnosticsOpen] = React.useState(false);
  const temporaryUnlock = Boolean(protectionStatus?.activeUnlockExpiresAt && Date.parse(protectionStatus.activeUnlockExpiresAt) > Date.now());
  const appGuard = describeAppGuard(protectionCapability, protectionStatus, disciplineSettings.appGuardMode);
  const websiteReadiness = getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'websites').websiteProtection;
  const protectionHealth = { title: `Adult website protection · ${translateSource(websiteReadiness.status)}`, detail: websiteReadiness.explanation };
  const blockedPackageSet = React.useMemo(() => new Set(disciplineSettings.blockedAppPackages), [disciplineSettings.blockedAppPackages]);
  const toggleBlockedPackage = React.useCallback(
    (androidPackage: string) => {
      const next = blockedPackageSet.has(androidPackage)
        ? disciplineSettings.blockedAppPackages.filter((item) => item !== androidPackage)
        : [...disciplineSettings.blockedAppPackages, androidPackage];
      onDisciplineChange({ blockedAppPackages: next });
    },
    [blockedPackageSet, disciplineSettings.blockedAppPackages, onDisciplineChange]
  );

  const sectionRow = (next: FreedShieldSection, detail: React.ReactNode) => {
    const category: PracticeCategory = next === 'apps' ? 'movement' : next === 'schedules' || next === 'dns' ? 'calm' : next === 'websites' ? 'commitment' : 'reflection';
    const palette = getPracticePalette(category, mode);
    return <Link key={next} href={freedShieldSectionPath(next) as Href} asChild withAnchor><Pressable testID={`shield-open-${next}`} accessibilityRole="button" accessibilityLabel={freedShieldSectionTitle(next)} onPress={tap} style={({ pressed }) => ({ width: width < 360 || fontScale > 1.3 ? '100%' : '48%', flexGrow: 1, minHeight: 120, padding: 16, gap: 8, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface, opacity: pressed ? .75 : 1 })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><ShieldCheck color={palette.ink} size={26} /><ChevronRight color={palette.ink} size={20} /></View>
      <Text style={{ color: palette.ink, fontSize: 17, lineHeight: 24, fontWeight: '800' }}>{freedShieldSectionTitle(next)}</Text><Text style={{ color: palette.ink, fontSize: 15, lineHeight: 24 }}>{detail}</Text>
    </Pressable></Link>;
  };

  const healthCard = <MomentumPageHeader pose={websiteReadiness.ready ? "shield" : "repair"} context="shield" title={protectionHealth.title} description={protectionHealth.detail} category="commitment" compact><PillButton label="Review website protection" onPress={() => onOpenProtectionSetup('websites')} /></MomentumPageHeader>;

  if (!section) return <ProtectOverview onOpenRecovery={onOpenRecovery} actionScope={getActionScope()} groups={groups} groupsPending={groupsPending} groupsError={groupsError} groupsWaitingForOwner={groupsWaitingForOwner} onOpenGroups={onOpenGroups} onOpenGroup={onOpenGroup} onAddGroup={onAddGroup} capability={protectionCapability} status={protectionStatus} settings={disciplineSettings} onSetup={onOpenProtectionSetup} onRequestedChange={onWebsiteProtectionChange} syncing={syncing} syncMessage={syncMessage} onRetry={onRetryProtection} />;
  if (section === 'advanced') return <AdvancedProtectionScreen capability={protectionCapability} status={protectionStatus} onPermissions={onPermissions ?? (() => onOpenProtectionSetup('apps'))} onSafariSetup={onSafariSetup} onExceptions={onExceptions ?? (() => router.push(freedShieldSectionPath('websites')))} onDiagnostics={onDiagnostics ?? (() => router.push(freedShieldSectionPath('diagnostics')))} />;
  if ((section === 'apps' || section === 'groups') && protectionCapability?.appGroups === true) {
    if (!groups) { let verified = false; try { verified = typeof JSON.parse(getActionScope() ?? 'null')?.[0] === 'string'; } catch {}
      return <View style={{padding:24,gap:16}}><Text>{verified ? 'Check device configuration' : 'Waiting for your account…'}</Text><PillButton label={verified ? 'Retry' : 'Connect Apple, Google or email'} onPress={() => { if (verified) void onRefreshGroups?.(); else onOpenGroups?.(); }} /></View>; }
    return <AppGroupsScreen getActionScope={getActionScope} onRefreshProtection={onRefreshProtection} initialGroupId={initialGroupId} createOnOpen={section === 'apps' && createOnOpen} onCreateRequestConsumed={onCreateRequestConsumed} mode={section === 'groups' ? 'groups' : 'apps'} onManageGroups={() => router.push(freedShieldSectionPath('groups'))} />;
  }

  return (
    <ScrollView testID={section ? `shield-detail-${section}` : "shield-overview"} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingBottom: bottomPadding, gap: 20, width: "100%", maxWidth: 640, alignSelf: "center" }}>
      {section ? <MomentumPageHeader pose={section === "schedules" ? "rest" : section === "dns" ? "secure" : section === "diagnostics" ? "repair" : section === "apps" ? "focus" : "shield"} context={`shield/${section}`} title={freedShieldSectionTitle(section)} category={section === "schedules" || section === "dns" ? "calm" : section === "websites" ? "commitment" : "movement"} variant="progress" compact /> : null}
      {syncing ? <Text accessibilityLiveRegion="polite" style={{color:colors.text2,lineHeight:24}}>Updating protection…</Text> : syncMessage ? <InlineNotice tone="error" message={syncMessage} actionLabel="Retry" onAction={onRetryProtection} /> : null}
      {!section ? <>
        <MomentumPageHeader pose="secure" context="dns-health" title={protectionHealth.title} description={protectionHealth.detail} compact />
        <ProtectionLayers capability={protectionCapability} status={protectionStatus} />
        <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>Choose the apps and schedules you want FREED to protect. Native authorization stays in protection setup.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sectionRow("apps", <>Daily limit · {disciplineSettings.dailyLimitMinutes} minutes/day</>)}
          {sectionRow("schedules", <>Sleep mode · {disciplineSettings.sleepStartTime}–{disciplineSettings.sleepEndTime}</>)}
          {sectionRow("websites", <>Allowed sites · {disciplineSettings.userAllowedDomains.length}</>)}

        </View>
        <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>Advanced</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sectionRow("dns", "Connection, privacy and protection health")}
          {sectionRow("diagnostics", "URL Check")}
        </View>
      </> : null}
      {section === "apps" ? <>
      <Card category="movement" title={"Selected apps"}>
        <PillButton label="Choose apps" onPress={() => onOpenProtectionSetup("apps")} />
        <Text style={{ color: colors.text2, lineHeight: 24 }}>{getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'both', disciplineSettings.appGuardMode).appLimits.scope}</Text>
        
        <View style={{ gap: 8 }}>
          {protectionCapability?.platform !== "ios" ? DOOMSCROLL_APP_OPTIONS.map((option) => (
            <SettingToggle
              key={option.androidPackage}
              label={option.label}
              value={blockedPackageSet.has(option.androidPackage)}
              onChange={() => toggleBlockedPackage(option.androidPackage)}
            />
          )) : <Text style={{ color: colors.text2, lineHeight: 24 }}>Choose individual applications in Apple's native picker for app guards. FREED receives selection counts and keeps opaque tokens on this device. Categories and domains remain independent legacy scope.</Text>}
        </View>
      </Card>
      <Card category="movement" title="App guard mode">
        <Text style={{ color: colors.text2, lineHeight: 24 }}>{appGuard.scope}</Text>
        <Text style={{ color: colors.text2, lineHeight: 24 }}>{`Device mode: ${appGuard.mode} · ${appGuard.ready ? 'Ready' : 'Needs attention'}`}</Text>
        {protectionCapability?.appGuardModes === true ? <>
          <SettingSegment label="Saved mode" value={disciplineSettings.appGuardMode} options={APP_GUARD_MODES.map(item => ({ ...item }))} onChange={appGuardMode => onDisciplineChange({ appGuardMode })} />
          <PillButton label="Save guard mode" onPress={() => onDisciplineChange({ appGuardMode: disciplineSettings.appGuardMode })} />
          <Text style={{ color: colors.text2, lineHeight: 24 }}>{disciplineSettings.appGuardModeConfiguredAt ? 'Saved. Native status confirms whether the mode is ready.' : 'The before-use default is inactive until you save a guard mode.'}</Text>
        </> : <Text style={{ color: colors.text2, lineHeight: 24 }}>Mode options are unavailable in this installed build. Existing daily limits remain available.</Text>}
        <Text style={{ color: colors.text2, lineHeight: 24 }}>{appGuard.explanation}</Text>
      </Card>
      <Card category="commitment" title={"DISCIPLINE RULES"}>
        
        <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: typography.heavy, marginTop: 8 }}>
          Earned unlocks and challenge intensity are saved on this device.
        </Text>
        <Text selectable style={{ color: colors.text2, marginTop: 8, lineHeight: 24 }}>
          {formatUnlock(activeUnlock)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
          <SettingStepper
            label="Daily limit"
            value={disciplineSettings.dailyLimitMinutes}
            suffix="minutes/day"
            min={5}
            max={240}
            step={5}
            onChange={(dailyLimitMinutes) => onDisciplineChange({ dailyLimitMinutes })}
          />
          <SettingStepper
            label="Unlock"
            value={disciplineSettings.unlockDurationMinutes}
            suffix="minutes earned"
            min={5}
            max={60}
            step={5}
            onChange={(unlockDurationMinutes) => onDisciplineChange({ unlockDurationMinutes })}
          />
        </View>

      </Card>

      <Card category="movement" title={"Challenge Mix"}>
        
        <View style={{ gap: 16 }}>
          <SettingSegment
            label="Intensity"
            value={disciplineSettings.challengeIntensity}
            options={[
              { label: "Gentle", value: "gentle" },
              { label: "Balanced", value: "balanced" },
              { label: "Strong", value: "strong" }
            ]}
            onChange={(challengeIntensity) => onDisciplineChange({ challengeIntensity })}
          />
          <SettingSegment
            label="Outdoor"
            value={disciplineSettings.outdoorChallengeFrequency}
            options={[
              { label: "Low", value: "low" },
              { label: "Balanced", value: "balanced" },
              { label: "High", value: "high" }
            ]}
            onChange={(outdoorChallengeFrequency) => onDisciplineChange({ outdoorChallengeFrequency })}
          />
          <SettingSegment
            label="Exercise"
            value={disciplineSettings.exercisePreference}
            options={[
              { label: "Low", value: "low" },
              { label: "Balanced", value: "balanced" },
              { label: "High", value: "high" }
            ]}
            onChange={(exercisePreference) => onDisciplineChange({ exercisePreference })}
          />
          <SettingSegment
            label="Social"
            value={disciplineSettings.socialChallengeFrequency}
            options={[
              { label: "Off", value: "off" },
              { label: "Low", value: "low" },
              { label: "Balanced", value: "balanced" },
              { label: "High", value: "high" }
            ]}
            onChange={(socialChallengeFrequency) => onDisciplineChange({ socialChallengeFrequency })}
          />
        </View>
      </Card>
      </> : null}
      {section === "schedules" ? <>
      <Card category="calm" title={"Modes"}>
        <Text style={{ color: colors.text2, lineHeight: 24 }}>{protectionCapability?.platform === "ios" ? "Sleep, work, weekend and strict guards cover only retained individual application selections. FREED cannot select every installed app. Ending one guard keeps overlapping guards in effect." : "Active timed and strict guards affect supported distracting apps, including apps outside your manual selection. Ending one guard keeps overlapping guards in effect."}</Text>
        {protectionCapability?.appSchedules === true ? <View style={{gap:8}}><Text style={{color:colors.text2,lineHeight:24}}>{`Strict guard: ${protectionStatus?.strictAppGuardEnabled ? 'saved on' : 'off or not acknowledged'} · ${protectionStatus?.strictAppGuardActive ? 'active' : 'inactive'}`}</Text><Text style={{color:colors.text2,lineHeight:24}}>{protectionStatus?.appSchedulesSupported !== true ? 'Automatic schedules are unavailable in this installed build.' : protectionStatus.appSchedulesServiceConnected !== true ? 'Schedules are saved. Complete app authorization to enforce them.' : protectionStatus.appSchedulesConfigured !== true ? 'No schedules are enabled.' : 'Native scheduling is configured. Check active guards and device enforcement.'}</Text>{protectionStatus?.activeAppScheduleIds?.length ? <Text style={{color:colors.text,lineHeight:24}}>{`Active guards: ${protectionStatus.activeAppScheduleIds.map(id => translateSource(id === 'sleep' ? 'Sleep' : id === 'work' ? 'Work' : 'Weekend')).join(', ')}`}</Text> : null}{protectionStatus?.nextAppScheduleBoundaryAt ? <Text style={{color:colors.text2,lineHeight:24}}>{`Next schedule change: ${new Date(protectionStatus.nextAppScheduleBoundaryAt).toLocaleString(appI18n.language)}`}</Text> : null}</View> : <Text style={{color:colors.text2,lineHeight:24}}>{protectionStatus?.scheduled ? 'Native sleep schedule is configured.' : 'Sleep schedule needs authorization or is off.'}</Text>}
        <Text style={{ color: colors.text2, lineHeight: 24 }}>Times use this device's local clock. Equal start and end times create no active window.</Text>
        
        <View style={{ gap: 12 }}>
          <SettingToggle disabled={protectionCapability?.appGuardModes !== true && protectionCapability?.platform !== "android"} label="Emergency strict mode" value={disciplineSettings.emergencyStrictMode} onChange={(emergencyStrictMode) => onDisciplineChange({ emergencyStrictMode })} />
          <SettingToggle disabled={protectionCapability?.platform !== "ios" && protectionCapability?.appSchedules !== true} label={`Sleep mode ${disciplineSettings.sleepStartTime}-${disciplineSettings.sleepEndTime}`} value={disciplineSettings.sleepModeEnabled} onChange={(sleepModeEnabled) => onDisciplineChange({ sleepModeEnabled })} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <SettingTimeInput label="Sleep start" value={disciplineSettings.sleepStartTime} onChange={(sleepStartTime) => onDisciplineChange({ sleepStartTime })} />
            <SettingTimeInput label="Wake" value={disciplineSettings.sleepEndTime} onChange={(sleepEndTime) => onDisciplineChange({ sleepEndTime })} />
          </View>
          <SettingToggle disabled={protectionCapability?.appGuardModes !== true && protectionCapability?.platform !== "android"} label="Deep focus mode" value={disciplineSettings.deepFocusModeEnabled} onChange={(deepFocusModeEnabled) => onDisciplineChange({ deepFocusModeEnabled })} />
          <SettingToggle disabled={protectionCapability?.appSchedules !== true} label={`Work hours ${disciplineSettings.workStartTime}-${disciplineSettings.workEndTime}`} value={disciplineSettings.workHoursEnabled} onChange={(workHoursEnabled) => onDisciplineChange({ workHoursEnabled })} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <SettingTimeInput label="Work start" value={disciplineSettings.workStartTime} onChange={(workStartTime) => onDisciplineChange({ workStartTime })} />
            <SettingTimeInput label="Work end" value={disciplineSettings.workEndTime} onChange={(workEndTime) => onDisciplineChange({ workEndTime })} />
          </View>
          <SettingToggle disabled={protectionCapability?.appSchedules !== true} label="Weekend adventure mode" value={disciplineSettings.weekendModeEnabled} onChange={(weekendModeEnabled) => onDisciplineChange({ weekendModeEnabled })} />
        </View>
      </Card>
      </> : null}
      {section === "websites" ? <>
      <Card category="commitment" title={"Web safety"}>
        
        <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 8 }}>Adult-domain protection preserves normal browsing and keeps intervention challenges ad-free.</Text>
      </Card>
      <Card category="commitment">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <ShieldCheck color={colors.mint} size={30} />
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
              Default allow, precise block
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 4 }}>
              FREED blocks adult domains and adult search intent. Normal web stays open; Android app shields are opt-in.
            </Text>
          </View>
        </View>
      </Card>
      <AlwaysAllowSection
        supported={protectionCapability?.platform === "android"}
        domains={disciplineSettings.userAllowedDomains}
        onChange={(userAllowedDomains) => onDisciplineChange({ userAllowedDomains })}
      />
      <Card category="commitment" title={"Normal Web Allowlist"}>
        
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DEFAULT_ALLOWED_NORMAL_DOMAINS.slice(0, 14).map((domain) => (
            <Text key={domain} selectable style={{ color: colors.mint, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              {domain}
            </Text>
          ))}
        </View>
      </Card>
      </> : null}
      {section === "focus-shield" ? <>
      <Card title="Focus Shield unavailable" category="commitment"><Text>Short-form filtering and calibration are unavailable in this release. Use app limits to protect time in distracting apps.</Text><PillButton label="Open app limits" onPress={() => router.push("/shield/apps")} /></Card>
      </> : null}
      {section === "dns" ? <>
      <ProtectionLayers capability={protectionCapability} status={protectionStatus} />
      {healthCard}
      <EncryptedDnsSection />
      <DnsGuardHealthSection protectionCapability={protectionCapability} protectionStatus={protectionStatus} onRefresh={onRefreshProtection} />
      </> : null}
      {section === "diagnostics" ? <>
      <Card category="commitment">
        <Pressable accessibilityRole="button" accessibilityLabel={advancedDiagnosticsOpen ? "Hide advanced diagnostics" : "Show advanced diagnostics"} onPress={() => setAdvancedDiagnosticsOpen((value) => !value)} style={{ minHeight: 48, justifyContent: "center" }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>Advanced diagnostics</Text>
        </Pressable>
        {advancedDiagnosticsOpen ? <Text selectable style={{ color: colors.text3, lineHeight: 20 }}>{protectionStatus?.message ?? "No native protection status is available yet."}</Text> : null}
      </Card>
      <Card category="commitment" title={"URL Check"}>
        
        <TextInput
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          testID="shield-url"
          placeholder="Enter a URL or search URL"
          placeholderTextColor={colors.text3}
          style={{
            minHeight: 54,
            borderRadius: 20,
            borderCurve: "continuous",
            borderWidth: 1.4,
            borderColor: colors.border,
            color: colors.text,
            paddingHorizontal: 16,
            fontSize: 17,
            backgroundColor: colors.surface2
          }}
        />
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <PillButton label="Check" variant="ghost" onPress={() => setResult(createBlockingAttempt(input, "manual-check").result)} />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton label="Visit" onPress={() => onAttempt(input)} />
          </View>
        </View>
      </Card>

      {result && <VerdictCard result={result} />}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <PillButton label="Google" variant="ghost" onPress={() => setInput("https://google.com")} />
        </View>
        <View style={{ flex: 1 }}>
          <PillButton label="YouTube" variant="ghost" onPress={() => setInput("https://youtube.com/results?search_query=workout")} />
        </View>
      </View>
      <PillButton label="Adult Search Test" variant="danger" onPress={() => onAttempt("https://google.com/search?q=porn")} />
      {showQaControls ? (
        <Card category="commitment" title={"SIMULATION SANDBOX"}>
          
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginTop: 4 }}>
            Test Intercept & Circuit Breaker
          </Text>
          <Text selectable style={{ color: colors.text2, lineHeight: 20, marginTop: 4 }}>
            Simulate a high-risk adult URL trigger to test the Intercept screen, breathing timer, and earned unlock loop on this device.
          </Text>
          <View style={{ marginTop: 12 }}>
            <PillButton label="Simulate Adult Intercept" onPress={() => onAttempt("https://pornhub.com")} />
          </View>
        </Card>
      ) : null}
      </> : null}
    </ScrollView>
  );
}

function BackButton({
  onPress,
  label = "Back",
  accessibilityLabel,
  hint
}: {
  onPress: () => void;
  label?: string;
  accessibilityLabel?: string;
  hint?: string;
}) {
  const { colors, gradients, typography } = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ width: 44, height: 44, borderRadius: 16, borderCurve: "continuous", backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}
    >
      <ChevronLeft color={colors.text2} size={20} />
    </Pressable>
  );
}

function ArticleReaderScreen({ article, onBack }: { article: LibraryArticle; onBack: () => void }) {
  const { colors, gradients, typography } = useAppTheme();
  const articleColor = [colors.mint, colors.sky, colors.peach, colors.mintLight][LIBRARY_ARTICLES.findIndex((item) => item.id === article.id) % 4];
  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingBottom: 48, gap: 16 }}>
<MomentumPageHeader pose="read" context="article" restrained title={article.title} description={article.summary} category="reflection" variant="calm" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BackButton onPress={onBack} label="Back to Library" accessibilityLabel="Back to Library" hint="Returns to the Library." />
              <Text selectable style={{ color: articleColor, fontWeight: typography.bold, letterSpacing: 1, fontSize: 12 }}>
                {article.tag.toUpperCase()}
              </Text>
            </View>
            
            <Text selectable style={{ color: colors.text2, fontSize: 14 }}>
              {article.readMinutes} min read
            </Text>
            
            <View style={{ gap: 16 }}>
              {article.paragraphs.map((paragraph, index) => (
                <View key={index}>
                  <Text selectable style={{ color: colors.text, lineHeight: 24, fontSize: 17 }}>
                    {paragraph}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}



function CustomChallengeScreen({
  premium,
  customChallenges,
  onBack,
  onUpgrade,
  onSave,
  onSaved
}: {
  premium: boolean;
  customChallenges: RecoveryChallenge[];
  onBack: () => void;
  onUpgrade: () => void;
  onSave: (input: CustomChallengeInput) => RecoveryChallenge;
  onSaved: (challenge: RecoveryChallenge) => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const draft = useRecoveryDraft("custom", { title: "", why: "", category: "reset", intensity: "medium", durationSec: 120, steps: ["", "", "", ""] });
  const { title, why, category, intensity, durationSec, steps } = draft.value;
  const setTitle = (title: string) => draft.update(current => ({ ...current, title }));
  const setWhy = (why: string) => draft.update(current => ({ ...current, why }));
  const setCategory = (category: RecoveryChallenge["category"]) => draft.update(current => ({ ...current, category }));
  const setIntensity = (intensity: RecoveryChallenge["intensity"]) => draft.update(current => ({ ...current, intensity }));
  const setDurationSec = (durationSec: number) => draft.update(current => ({ ...current, durationSec }));
  const setSteps = (update: (steps: string[]) => string[]) => draft.update(current => ({ ...current, steps: update(current.steps) }));
  const cleanedSteps = steps.map((step) => step.trim()).filter(Boolean);
  const canSave = premium && title.trim().length >= 4 && cleanedSteps.length > 0;

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: 24, paddingBottom: 32, gap: 16 }}>
<MomentumPageHeader pose="plan" context="customChallenge" title={"Custom Reset Builder"} category="movement" variant="welcome" />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              
              <Pressable onPress={onBack} style={{ width: 44, height: 44, borderRadius: 16, borderCurve: "continuous", backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                <X color={colors.text2} size={18} />
              </Pressable>
            </View>

            {!premium ? (
              <Card gradient={gradients.mint} category="movement">
                <Target color={colors.mint} size={34} />
                <Text selectable style={{ color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: typography.heavy, marginTop: 12 }}>
                  Build resets that match your real life.
                </Text>
                <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 8 }}>
                  Custom challenges are part of Premium and are stored locally as your own recovery actions.
                </Text>
                <View style={{ marginTop: 16 }}>
                  <PillButton label="Upgrade" onPress={onUpgrade} icon={<ChevronRight color={colors.bg} size={18} />} />
                </View>
              </Card>
            ) : (
              <>
                <Text selectable testID="custom-draft-notice" accessibilityRole={draft.error ? "alert" : undefined} style={{ color: draft.error ? colors.peach : colors.text2, lineHeight: 24 }}>
                  {draft.error ?? draft.notice}
                </Text>
                <Card category="movement">
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    editable={!draft.committed}
                    maxLength={RECOVERY_DRAFT_LIMITS.title}
                    placeholder="Reset name"
                    placeholderTextColor={colors.text3}
                    style={{
                      minHeight: 52,
                      borderRadius: 16,
                      borderCurve: "continuous",
                      borderWidth: 1.3,
                      borderColor: colors.border,
                      color: colors.text,
                      paddingHorizontal: 16,
                      backgroundColor: colors.surface2,
                      fontWeight: typography.bold
                    }}
                  />
                  <TextInput
                    value={why}
                    onChangeText={setWhy}
                    editable={!draft.committed}
                    maxLength={RECOVERY_DRAFT_LIMITS.why}
                    placeholder="Why this works for you"
                    placeholderTextColor={colors.text3}
                    multiline
                    style={{
                      minHeight: 84,
                      borderRadius: 16,
                      borderCurve: "continuous",
                      borderWidth: 1.3,
                      borderColor: colors.border,
                      color: colors.text,
                      padding: 16,
                      textAlignVertical: "top",
                      backgroundColor: colors.surface2,
                      marginTop: 12
                    }}
                  />
                </Card>
                <Card category="movement">
                  <SettingSegment
                    label="Type"
                    value={category}
                    options={[
                      { label: "Move", value: "physical" },
                      { label: "Breathe", value: "breathing" },
                      { label: "Write", value: "reflection" },
                      { label: "Connect", value: "connection" },
                      { label: "Reset", value: "reset" }
                    ]}
                    onChange={(value) => setCategory(value)}
                  />
                  <View style={{ height: 12 }} />
                  <SettingSegment
                    label="Intensity"
                    value={intensity}
                    options={[
                      { label: "Calm", value: "calm" },
                      { label: "Medium", value: "medium" },
                      { label: "Strong", value: "strong" }
                    ]}
                    onChange={(value) => setIntensity(value)}
                  />
                  <View style={{ height: 12 }} />
                  <SettingStepper
                    label="Minutes"
                    value={Math.round(durationSec / 60)}
                    min={1}
                    max={15}
                    step={1}
                    suffix="m"
                    onChange={(minutes) => setDurationSec(minutes * 60)}
                  />
                </Card>
                <Card category="movement" title={"Steps"}>
                  
                  <View style={{ gap: 8 }}>
                    {steps.map((step, index) => (
                      <TextInput
                        key={index}
                        value={step}
                        onChangeText={(value) => setSteps((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))}
                        editable={!draft.committed}
                        maxLength={RECOVERY_DRAFT_LIMITS.step}
                        placeholder={`Step ${index + 1}`}
                        placeholderTextColor={colors.text3}
                        style={{
                          minHeight: 48,
                          borderRadius: 16,
                          borderCurve: "continuous",
                          borderWidth: 1.3,
                          borderColor: colors.border,
                          color: colors.text,
                          paddingHorizontal: 16,
                          backgroundColor: colors.surface2
                        }}
                      />
                    ))}
                  </View>
                </Card>
                {customChallenges.length > 0 ? (
                  <Card category="movement" title={"Saved Resets"}>
                    
                    <View style={{ gap: 8 }}>
                      {customChallenges.slice(0, 4).map((challenge) => (
                        <Text translate={false} key={challenge.id} selectable style={{ color: colors.text2, lineHeight: 20 }}>
                          {challenge.title} - {Math.round(challenge.durationSec / 60)}m
                        </Text>
                      ))}
                    </View>
                  </Card>
                ) : null}
                <PillButton
                  label="Save and Start"
                  variant={canSave ? "success" : "ghost"}
                  onPress={() => {
                    if (!canSave) return;
                    const saved = draft.save(input => onSave({ ...input, steps: input.steps.map(step => step.trim()).filter(Boolean) }));
                    if (saved.ok) onSaved(saved.result);
                  }}
                  icon={<Check color={canSave ? colors.bg : colors.text2} size={18} />}
                />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
}

function ReminderSettingsCard({ reminders, busy, onChange, smartSuggestion, onRepair, onTest, testMessage, readable = true }: {
  reminders: ReminderPreferences; busy: boolean; onChange: (update: ReminderPreferenceUpdate) => void;
  smartSuggestion: SmartReminderSuggestion; onRepair?: () => Promise<unknown> | void; onTest?: () => Promise<unknown> | void; testMessage?: string | null; readable?: boolean;
}) {
  const { colors, typography } = useAppTheme();
  const change = (update: ReminderPreferenceUpdate) => { if (!busy && readable) onChange(update); };
  const items = [
    ['morningEnabled', 'morningTime', 'Morning reset'],
    ['eveningEnabled', 'eveningTime', 'Evening reflection'],
    ['guardEnabled', 'guardTime', 'Night guard']
  ] as const;
  const effectiveLabel = !readable ? 'Reminder settings could not be loaded. Existing reminders were kept.' : !reminders.enabled ? 'Reminders are off.' : reminders.effectiveStatus === 'active' ? 'Reminders are scheduled.'
    : reminders.effectiveStatus === 'quiet' ? 'Reminders are delivered quietly.'
      : reminders.effectiveStatus === 'permission-required' ? 'Reminders are requested. Notification access needs attention.'
        : reminders.effectiveStatus === 'failed' ? 'Reminders are requested. Scheduling needs attention.' : 'Reminders are requested. Checking delivery.';
  return <Card category="calm">
    {readable ? <MomentumSettingHeader pose="rest" context="profile/reminders" title="Recovery Reminders" description={reminders.statusMessage} category="calm" enabled={reminders.enabled} busy={busy} onChange={enabled => change({ enabled })} /> : <Text accessibilityRole="header" style={{color:colors.text,fontSize:21,fontWeight:'700'}}>Recovery Reminders</Text>}
    <Text testID="reminder-effective-status" accessibilityLiveRegion="polite" style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>{effectiveLabel}</Text>
    {readable ? <View style={{ gap: 16 }}>
      {items.map(([enabledKey, timeKey, title]) => <View key={enabledKey} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', minHeight: 48 }}><Text style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: typography.bold }}>{title}</Text><Switch accessible accessibilityRole="switch" accessibilityLabel={translateSource(title)} accessibilityState={{ checked: reminders[enabledKey], disabled: busy }} value={reminders[enabledKey]} disabled={busy} onValueChange={enabled => change({ [enabledKey]: enabled })} trackColor={{ false: colors.surface3, true: colors.accent }} /></View>
        <NativeTimeInput label={title} value={reminders[timeKey]} disabled={busy} onChange={time => change({ [timeKey]: time })} />
      </View>)}
    </View> : null}
    {readable && reminders.guardEnabled && smartSuggestion.guardTime !== reminders.guardTime ? <View style={{ gap: 8, paddingTop: 16 }}><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>{smartSuggestion.reason}</Text><Pressable testID="reminder-apply-suggestion" accessibilityRole="button" disabled={busy} onPress={() => change({ guardTime: smartSuggestion.guardTime })} style={{ minHeight: 44, justifyContent: 'center', opacity: busy ? .4 : 1 }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>Use suggested guard time</Text><Text translate={false} style={{ color: colors.text2, fontSize: 17 }}>{smartSuggestion.guardTime}</Text></Pressable></View> : null}
    <View style={{ gap: 8, paddingTop: 16 }}>
      {onRepair ? <Pressable testID="reminder-repair" accessibilityRole="button" disabled={busy} onPress={() => { if (!busy) void onRepair(); }} style={{ minHeight: 48, justifyContent: 'center', opacity: busy ? .4 : 1 }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>Retry reminder setup</Text></Pressable> : null}
      {onTest ? <Pressable testID="reminder-test" accessibilityRole="button" disabled={busy || !readable} onPress={() => { if (!busy && readable) void onTest(); }} style={{ minHeight: 48, justifyContent: 'center', opacity: busy ? .4 : 1 }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>Send test notification</Text></Pressable> : null}
      {testMessage ? <Text testID="reminder-test-status" accessibilityLiveRegion="polite" style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>{testMessage}</Text> : null}
    </View>
  </Card>;
}

function AnalyticsConsentCard({ sharing, readiness, busy = false, message, onEnable, onDisable, onSend }: {
  sharing: AnalyticsSharingSettings; readiness: AnalyticsSharingReadiness; busy?: boolean; message?: string | null;
  onEnable?: () => void; onDisable?: () => void; onSend?: () => void;
}) {
  const { colors } = useAppTheme();
  const status = !sharing.enabled ? 'Off' : !readiness.ready ? 'Needs setup' : sharing.lastSentAt ? appI18n.t('source.Ready - last sent {{date}}', { defaultValue: 'Ready - last sent {{date}}', date: new Date(sharing.lastSentAt).toLocaleDateString(appI18n.language) }) : 'Ready to send';
  const action = sharing.enabled ? onDisable : onEnable;
  return <View testID="profile-analytics-consent"><Card title="Analytics sharing" category="reflection">
    <Text style={{ color: colors.text, fontSize: 17, lineHeight: 26, fontWeight: '700' }}>{status}</Text>
    <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>Only aggregate counts and rates are sent after consent. Notes, raw URLs, contacts, receipts, and transcripts stay off the payload.</Text>
    {sharing.enabled && !readiness.ready ? <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>Analytics sharing is not ready.</Text> : null}
    {message ?? sharing.lastSendMessage ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text2, fontSize: 17, lineHeight: 26 }}>{message ?? sharing.lastSendMessage}</Text> : null}
    <PillButton label={sharing.enabled ? 'Turn Off' : 'Enable Sharing'} variant="ghost" disabled={busy || !action} onPress={() => { if (!busy) action?.(); }} />
    <PillButton label={busy ? 'Sending...' : 'Send Snapshot'} variant="ghost" disabled={busy || !sharing.enabled || !readiness.ready || !onSend} onPress={() => { if (!busy && sharing.enabled && readiness.ready) onSend?.(); }} />
  </Card></View>;
}

function RetentionPlanCard({ plan }: { plan: RetentionPlan }) {
  const { colors, gradients, typography } = useAppTheme();
  return (
    <Card gradient={[`${colors.mint}20`, colors.surface]} category="movement">
      <MomentumPageHeader pose="plan" context="profile/routine" compact title="Daily Recovery Plan" description={plan.headline} category="movement" variant="progress"></MomentumPageHeader>

      <View style={{ gap: 12 }}>
        <View style={{ borderRadius: 20, padding: 12, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border }}>
          <Text selectable style={{ color: colors.text3, fontWeight: typography.bold, marginBottom: 4 }}>
            NEXT BEST ACTION
          </Text>
          <Text selectable style={{ color: colors.text, lineHeight: 24, fontWeight: typography.bold }}>
            {plan.nextBestAction}
          </Text>
        </View>
        <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>
          {plan.checkInPrompt}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {plan.focusTags.map((tag) => (
            <Text
              selectable
              key={tag}
              style={{
                color: colors.mint,
                backgroundColor: colors.accentTint,
                borderWidth: 1,
                borderColor: colors.accent,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                fontWeight: typography.bold
              }}
            >
              {tag}
            </Text>
          ))}
          {plan.suggestedGuardTime ? (
            <Text selectable style={{ color: colors.sky, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Guard {plan.suggestedGuardTime}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function RecoveryBackupCard({
  recoveryState,
  onRestore,
  pendingFirebaseEmailLink,
  onPendingFirebaseEmailLinkHandled,
  onAutomaticBackupChange
}: {
  recoveryState: RecoveryState;
  onRestore: (state: RecoveryState) => void;
  pendingFirebaseEmailLink: string | null;
  onPendingFirebaseEmailLinkHandled: () => void;
  onAutomaticBackupChange?: (enabled: boolean, passphrase: string) => Promise<void>;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const readiness = getRecoveryBackupReadiness();
  const firebaseAuthReadiness = React.useMemo(() => getFirebaseClientReadiness(), []);
  const syncEndpointConfigured = firebaseAuthReadiness.ready || Boolean(process.env.EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT?.trim());
  const firebaseEmailLinkReadiness = React.useMemo(() => getFirebaseEmailLinkReadiness(), []);
  const authContinueUrl = firebaseEmailLinkReadiness.callbackUrl;
  const emailLinkEnabled = syncEndpointConfigured && firebaseAuthReadiness.ready && firebaseEmailLinkReadiness.ready;
  const [passphrase, setPassphrase] = React.useState("");
  const [backupText, setBackupText] = React.useState("");
  const [authEmail, setAuthEmail] = React.useState("");
  const [firebaseAuthConnected, setFirebaseAuthConnected] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const backupBusyRef = React.useRef(false);
  const backupGate = React.useRef(createAccountOperationGate(getFirebaseAccountScope));
  const backupAbort = React.useRef<AbortController | null>(null);
  const backupMounted = React.useRef(true);
  const backupAccountScope = getFirebaseAccountScope();
  const [authBusy, setAuthBusy] = React.useState(false);
  const [automaticStatus, setAutomaticStatus] = React.useState(getAutomaticBackupStatus);
  const [message, setMessage] = React.useState(readiness.status === "ready" ? "Optional encrypted backup needs a passphrase. Create a backup before uploading or restoring." : readiness.missing[0]);
  const disabled = busy || readiness.status !== "ready";
  const syncConfig = React.useMemo(
    () => ({
      endpointUrl: process.env.EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT,
      getAuthToken: () => getFirebaseNativeAuthAdapter().getCurrentIdToken()
    }),
    []
  );
  const syncReadiness = React.useMemo(() => getRecoveryBackupClientSyncReadiness(syncConfig), [syncConfig]);
  const syncDisabled = disabled || authBusy || !syncReadiness.ready || !firebaseAuthConnected;
  const runBackupAction = React.useCallback(
    (action: (operation: ReturnType<ReturnType<typeof createAccountOperationGate>["begin"]>, signal: AbortSignal) => Promise<void>) => {
      if (backupBusyRef.current) return;
      backupBusyRef.current = true;
      const operation = backupGate.current.begin();
      const abort = new AbortController();
      backupAbort.current = abort;
      setBusy(true);
      action(operation, abort.signal)
        .catch(error => { if (operation.isCurrent() && backupMounted.current) setMessage(safeUserFacingMessage(error, "Backup action could not complete.")); })
        .finally(() => { backupBusyRef.current = false; if (backupMounted.current) setBusy(false); });
    },
    []
  );
  const applyAuthUrl = React.useCallback((url: string | null) => {
    if (!url) return;
    if (!emailLinkEnabled) {
      setMessage("Email-link sign-in is disabled until the signed app-link association is deployed and physically verified.");
      return;
    }
    setAuthBusy(true);
    getFirebaseNativeAuthAdapter()
      .completeEmailLink({ email: authEmail, emailLink: url })
      .then((result) => {
        if (!result.ok) {
          setMessage(safeUserFacingMessage(result.reason, "Account link could not be completed."));
          return;
        }
        setFirebaseAuthConnected(true);
        setMessage("Account connected. Choose a passphrase and upload an encrypted backup to save it remotely.");
        onPendingFirebaseEmailLinkHandled();
      })
      .catch(() => setMessage("Account link could not be completed."))
      .finally(() => setAuthBusy(false));
  }, [authEmail, emailLinkEnabled, onPendingFirebaseEmailLinkHandled]);
  const requestEmailLink = React.useCallback(() => {
    if (!emailLinkEnabled) {
      setMessage("Email-link sign-in is disabled until the signed app-link association is deployed and physically verified.");
      return;
    }
    setAuthBusy(true);
    getFirebaseNativeAuthAdapter()
      .requestEmailLink(authEmail, { continueUrl: authContinueUrl })
      .then((result) => {
        setMessage(result.ok ? "Check your email for the FREED account link." : safeUserFacingMessage(result.reason, "Account link could not be sent."));
      })
      .catch(() => setMessage("Account link could not be sent."))
      .finally(() => setAuthBusy(false));
  }, [authEmail, authContinueUrl, emailLinkEnabled]);

  React.useEffect(() => {
    let active = true;
    setFirebaseAuthConnected(false);
    backupGate.current.invalidate();
    backupAbort.current?.abort();
    getFirebaseNativeAuthAdapter()
      .getCurrentIdToken()
      .then((token) => {
        if (active && getFirebaseAccountScope() === backupAccountScope) setFirebaseAuthConnected(Boolean(token));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [backupAccountScope]);

  React.useEffect(() => subscribeAutomaticBackupStatus(setAutomaticStatus), []);
  React.useEffect(() => {
    backupMounted.current = true;
    return () => { backupMounted.current = false; backupGate.current.invalidate(); backupAbort.current?.abort(); };
  }, []);
  const scopedSyncConfig = (operation: ReturnType<ReturnType<typeof createAccountOperationGate>["begin"]>, signal: AbortSignal) => ({
    ...syncConfig, signal,
    getAuthToken: async () => {
      operation.assertCurrent();
      const token = await getFirebaseNativeAuthAdapter().getCurrentIdToken();
      operation.assertCurrent();
      return token;
    }
  });


  React.useEffect(() => {
    if (pendingFirebaseEmailLink && emailLinkEnabled) {
      setMessage("Account link opened. Enter the email address that requested it, then complete sign-in.");
    }
  }, [emailLinkEnabled, pendingFirebaseEmailLink]);

  return (
    <Card gradient={[`${colors.sky}1F`, colors.surface]} category="reflection">
      <MomentumPageHeader pose="secure" context="profile/backup" compact restrained title="Encrypted Backup" description={message} category="reflection" variant="welcome"></MomentumPageHeader>

      <TextInput
        value={passphrase}
        onChangeText={setPassphrase}
        secureTextEntry
        testID="backup-passphrase"
        placeholder="Passphrase"
        placeholderTextColor={colors.text3}
        style={{
          minHeight: 48,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          paddingHorizontal: 16,
          backgroundColor: colors.surface2,
          marginBottom: 12
        }}
      />
      <TextInput
        value={backupText}
        onChangeText={setBackupText}
        multiline
        testID="backup-ciphertext"
        placeholder="Backup package"
        placeholderTextColor={colors.text3}
        textAlignVertical="top"
        style={{
          minHeight: 92,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          padding: 16,
          backgroundColor: colors.surface2,
          marginBottom: 12
        }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Pressable
          disabled={disabled}
          onPress={() =>
            runBackupAction(async (operation, signal) => {
              const backup = await createEncryptedRecoveryBackup(recoveryState, passphrase);
                  operation.assertCurrent();
              setBackupText(backup);
              setMessage("Encrypted backup created.");
            })
          }
          style={{
            flex: 1,
            minHeight: 46,
            borderRadius: 999,
            backgroundColor: colors.sky,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled ? 0.5 : 1
          }}
        >
          <Text selectable style={{ color: colors.bg, fontWeight: typography.heavy }}>
            Create
          </Text>
        </Pressable>
        <Pressable
          disabled={disabled || !backupText.trim()}
          onPress={() =>
            runBackupAction(async (operation, signal) => {
              const restored = await restoreEncryptedRecoveryBackup(backupText, passphrase);
                  operation.assertCurrent();
              onRestore(restored);
              setMessage("Backup opened. Confirm replacing local history to restore it.");
            })
          }
          style={{
            flex: 1,
            minHeight: 46,
            borderRadius: 999,
            backgroundColor: colors.border,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            opacity: disabled || !backupText.trim() ? 0.5 : 1
          }}
        >
          <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
            Restore
          </Text>
        </Pressable>
      </View>
      {onAutomaticBackupChange && Platform.OS !== "web" ? (
        <View style={{ marginTop: 16, gap: 12 }}>
          <Text selectable style={{ color: colors.text2, lineHeight: 20 }}>
            Automatic backup is {recoveryState.automaticBackupEnabled ? "on" : "off"}. Enabling stores your passphrase securely on this device and uploads encrypted progress after changes. Keep a copy of your passphrase for another device.
          </Text>
          <PillButton
            label={recoveryState.automaticBackupEnabled ? "Turn off automatic backup" : "Enable automatic backup"}
            variant="ghost"
            disabled={disabled || !firebaseAuthConnected}
            onPress={() => runBackupAction(async (operation, signal) => {
              await onAutomaticBackupChange(!recoveryState.automaticBackupEnabled, passphrase);
                  operation.assertCurrent();
              setPassphrase("");
              setMessage(recoveryState.automaticBackupEnabled ? "Automatic backup is off. The saved passphrase was removed from this device." : "Automatic backup enabled. Your progress is encrypted before upload.");
            })}
          />
          {recoveryState.automaticBackupEnabled ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text3, lineHeight: 18 }}>
            {automaticStatus.message ?? (automaticStatus.lastSyncedAt ? `Last saved ${new Date(automaticStatus.lastSyncedAt).toLocaleString()}` : `Backup: ${automaticStatus.phase}`)}
          </Text> : null}
        </View>
      ) : null}
      {syncEndpointConfigured ? (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          {emailLinkEnabled ? (
            <>
              <TextInput
                value={authEmail}
                onChangeText={setAuthEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Account email"
                placeholderTextColor={colors.text3}
                style={{
                  minHeight: 48,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.text,
                  paddingHorizontal: 16,
                  backgroundColor: colors.surface2,
                  marginBottom: 12
                }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
                <Pressable
                  disabled={disabled || authBusy}
                  onPress={requestEmailLink}
                  style={{
                    flexGrow: 1,
                    minWidth: 110,
                    minHeight: 42,
                    borderRadius: 999,
                    backgroundColor: colors.accentTint,
                    borderWidth: 1,
                    borderColor: colors.accent,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: disabled || authBusy ? 0.5 : 1
                  }}
                >
                  <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy }}>
                    Email Link
                  </Text>
                </Pressable>
                {pendingFirebaseEmailLink ? (
                  <Pressable
                    disabled={disabled || authBusy}
                    onPress={() => applyAuthUrl(pendingFirebaseEmailLink)}
                    style={{
                      flexGrow: 1,
                      minWidth: 150,
                      minHeight: 42,
                      borderRadius: 999,
                      backgroundColor: colors.accentTint,
                      borderWidth: 1,
                      borderColor: colors.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: disabled || authBusy ? 0.5 : 1
                    }}
                  >
                    <Text selectable style={{ color: colors.mint, fontWeight: typography.heavy }}>
                      Complete Email Link
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <Text selectable style={{ color: colors.text3, lineHeight: 18, marginBottom: 12 }}>
                Apple and Google credentials are exchanged natively when their sign-in providers are configured; this app does not open browser OAuth flows.
              </Text>
            </>
          ) : (
            <Text selectable style={{ color: colors.text2, lineHeight: 20, marginBottom: 12 }}>
              Email-link sign-in is disabled until the signed app-link association is deployed and physically verified.
            </Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Pressable
              disabled={syncDisabled}
              onPress={() =>
                runBackupAction(async (operation, signal) => {
                  const result = await uploadEncryptedRecoveryBackup(recoveryState, passphrase, scopedSyncConfig(operation, signal));
                  operation.assertCurrent();
                  setMessage(result.ok ? "Encrypted backup uploaded." : safeUserFacingMessage(result.reason, "Hosted sync could not upload."));
                })
              }
              style={{
                flexGrow: 1,
                minWidth: 120,
                minHeight: 44,
                borderRadius: 999,
                backgroundColor: colors.accentTint,
                borderWidth: 1,
                borderColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                opacity: syncDisabled ? 0.5 : 1
              }}
            >
              <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy }}>
                Upload Backup
              </Text>
            </Pressable>
            <Pressable
              disabled={syncDisabled}
              onPress={() =>
                runBackupAction(async (operation, signal) => {
                  const result = await downloadEncryptedRecoveryBackup(passphrase, scopedSyncConfig(operation, signal));
                  operation.assertCurrent();
                  if (result.ok && result.restoredState) {
                    onRestore(result.restoredState);
                    setMessage("Backup downloaded. Confirm replacing local history to restore it.");
                    return;
                  }
                  setMessage(safeUserFacingMessage(result.reason, "Hosted sync could not restore."));
                })
              }
              style={{
                flexGrow: 1,
                minWidth: 120,
                minHeight: 44,
                borderRadius: 999,
                backgroundColor: colors.accentTint,
                borderWidth: 1,
                borderColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                opacity: syncDisabled ? 0.5 : 1
              }}
            >
              <Text selectable style={{ color: colors.mint, fontWeight: typography.heavy }}>
                Download Backup
              </Text>
            </Pressable>
            <Pressable
              disabled={syncDisabled}
              onPress={() =>
                runBackupAction(async (operation, signal) => {
                  const result = await deleteHostedRecoveryBackup(scopedSyncConfig(operation, signal));
                  operation.assertCurrent();
                  setMessage(result.ok ? "Encrypted backup deleted from sync." : safeUserFacingMessage(result.reason, "Hosted sync could not delete."));
                })
              }
              style={{
                flexGrow: 1,
                minWidth: 120,
                minHeight: 44,
                borderRadius: 999,
                backgroundColor: colors.surface2,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
                opacity: syncDisabled ? 0.5 : 1
              }}
            >
              <Text selectable style={{ color: colors.text2, fontWeight: typography.heavy }}>
                Delete Remote Backup
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function PrivacySupportCard({
  onDeleteLocalData,
  onDeleteAccountAndData
}: {
  onDeleteLocalData: () => Promise<void> | void;
  onDeleteAccountAndData: () => Promise<FirebaseAccountDeletionResult>;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [message, setMessage] = React.useState("Privacy controls are ready.");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmAccountDelete, setConfirmAccountDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const openUrl = React.useCallback((url: string, fallback: string) => {
    Linking.openURL(url)
      .then(() => setMessage(fallback))
      .catch(() => setMessage("This action could not open on this device."));
  }, []);

  const supportUrl = React.useMemo(
    () =>
      `mailto:${encodeURIComponent(FREED_SUPPORT_EMAIL)}?subject=${encodeURIComponent("FREED support")}`,
    []
  );
  const runLocalDelete = React.useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setMessage("Tap Confirm Delete to clear local recovery data from this device.");
      return;
    }

    setBusy(true);
    Promise.resolve(onDeleteLocalData())
      .then(() => {
        setMessage("Local recovery data deleted from this device.");
        setConfirmDelete(false);
      })
      .catch((error) => setMessage(safeUserFacingMessage(error, "Local recovery data could not be deleted.")))
      .finally(() => setBusy(false));
  }, [confirmDelete, onDeleteLocalData]);

  const runAccountDelete = React.useCallback(() => {
    if (busy) return;
    if (!confirmAccountDelete) {
      setConfirmAccountDelete(true);
      setConfirmDelete(false);
      setMessage("Tap Confirm Account & Data Deletion to start deleting cloud account data, then clear this device.");
      return;
    }

    setBusy(true);
    Promise.resolve(onDeleteAccountAndData())
      .then((result) => {
        if (result.ok !== true) throw new Error("Account deletion was not accepted.");
        setMessage(result.status === "completed" ? "Account deletion completed. This account’s local data was removed." : "Account deletion started. Cloud completion is still processing; local data is kept until completion is confirmed.");
      })
      .catch((error) => {
        setMessage(safeUserFacingMessage(error, "Account deletion could not start. Local data was kept on this device."));
        setConfirmAccountDelete(false);
      })
      .finally(() => setBusy(false));
  }, [busy, confirmAccountDelete, onDeleteAccountAndData]);

  return (
    <Card gradient={[`${colors.mint}1F`, colors.surface]} category="commitment">
      <MomentumPageHeader pose="secure" context="profile/privacy" compact restrained title="Privacy & Support" description={message} category="commitment" variant="calm"></MomentumPageHeader>
      <Text selectable style={{ color: colors.text2, lineHeight: 24, marginBottom: 12 }}>
        Delete Account & Data requests removal of your signed-in Firebase account and hosted data before this device is cleared. Delete Local Data affects only this device. System permissions remain controlled by iOS or Android Settings.
      </Text>
      <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
        Server Deletion help remains available on the hosted account-deletion page and through support if you cannot sign in.
      </Text>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Privacy Policy"
              variant="ghost"
              icon={<FileLock color={colors.text2} size={18} />}
              onPress={() => openUrl(FREED_PRIVACY_POLICY_URL, "Privacy policy opened.")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Support"
              variant="ghost"
              icon={<LifeBuoy color={colors.text2} size={18} />}
              onPress={() => openUrl(supportUrl, "Support message opened.")}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <PillButton
              label={confirmAccountDelete ? "Confirm Account & Data Deletion" : "Delete Account & Data"}
              accessibilityLabel="Delete Account & Data"
              accessibilityHint="Requires Firebase sign-in and a second confirmation. Cloud deletion must start before local data is cleared."
              variant={confirmAccountDelete ? "danger" : "ghost"}
              disabled={busy}
              icon={<Trash2 color={confirmAccountDelete ? colors.white : colors.text2} size={18} />}
              onPress={runAccountDelete}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label={confirmDelete ? "Confirm Delete" : "Delete Local Data"}
              variant={confirmDelete ? "danger" : "ghost"}
              disabled={busy}
              accessibilityLabel="Delete Local Data"
              icon={<Trash2 color={confirmDelete ? colors.white : colors.text2} size={18} />}
              onPress={runLocalDelete}
            />
          </View>
        </View>
        <PillButton
          label="Account Deletion Help"
          variant="ghost"
          icon={<Mail color={colors.text2} size={18} />}
          onPress={() => openUrl(FREED_ACCOUNT_DELETION_URL, "Account deletion page opened.")}
        />
      </View>
    </Card>
  );
}

function AccountabilitySettingsCard({
  partner,
  supportCircle,
  recoveryState,
  canSendSponsorReport,
  canUseSupportCircle,
  onSendReport,
  onSendSupportCircleReport,
  onManagePlan,
  onSupportCircleChange,
  onSupportCircleRemove,
  onChange
}: {
  partner: AccountabilityPartner;
  supportCircle: SupportCircleMember[];
  recoveryState: RecoveryState;
  canSendSponsorReport: boolean;
  canUseSupportCircle: boolean;
  onSendReport: () => void;
  onSendSupportCircleReport: (memberId: string) => void;
  onManagePlan: () => void;
  onSupportCircleChange: (memberId: string, update: Partial<Omit<SupportCircleMember, "id" | "updatedAt" | "lastContactedAt">>) => void;
  onSupportCircleRemove: (memberId: string) => void;
  onChange: (update: Partial<AccountabilityPartner>) => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const enabledWithContact = hasUsableAccountabilityPartner(partner);
  const [draftSupportMemberIds, setDraftSupportMemberIds] = React.useState<string[]>([]);
  const lastContacted = partner.lastContactedAt
    ? new Date(partner.lastContactedAt).toLocaleDateString(appI18n.language, { month: "short", day: "numeric", ...(appI18n.language === "ar" ? { numberingSystem: "arab" } : {}) })
    : null;
  const sponsorReport = buildSponsorReport(recoveryState);
  const sponsorReportReady = enabledWithContact && canSendSponsorReport;
  const supportCircleIds = supportCircle.map((member) => member.id).join("|");
  React.useEffect(() => {
    setDraftSupportMemberIds((current) =>
      current.filter((id) => !supportCircle.some((member) => member.id === id)).slice(0, Math.max(0, 4 - supportCircle.length))
    );
  }, [supportCircle, supportCircleIds]);
  const supportDraftMembers = draftSupportMemberIds.map(
    (id) =>
      ({
        id,
        enabled: true,
        name: "",
        role: "family" as const,
        method: "sms" as const,
        contact: "",
        updatedAt: null,
        lastContactedAt: null
      } satisfies SupportCircleMember)
  );
  const visibleSupportCircle =
    supportCircle.length > 0 || supportDraftMembers.length > 0
      ? [...supportCircle, ...supportDraftMembers]
      : [
          {
            id: "support-draft-family",
            enabled: true,
            name: "",
            role: "family" as const,
            method: "sms" as const,
            contact: "",
            updatedAt: null,
            lastContactedAt: null
          }
        ];
  const canAddSupportMember = visibleSupportCircle.length < 4;
  const addSupportDraft = React.useCallback(() => {
    setDraftSupportMemberIds((current) => {
      if (supportCircle.length + current.length >= 4) return current;
      return [...current, `support-draft-${Date.now()}`];
    });
  }, [supportCircle.length]);
  const removeSupportDraft = React.useCallback((memberId: string) => {
    setDraftSupportMemberIds((current) => current.filter((id) => id !== memberId));
  }, []);

  return (
    <Card gradient={enabledWithContact ? gradients.mint : undefined} category="reflection">
      <MomentumSettingHeader pose="connect" context="profile/accountability" title="Accountability Partner" description={lastContacted ? `Last opened a message draft ${lastContacted}.` : "One trusted person can be one tap away during a risk moment."} category="reflection" enabled={partner.enabled} onChange={enabled => onChange({ enabled })} />

      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["sms", "email"] as const).map((method) => {
            const active = partner.method === method;
            return (
              <Pressable
                key={method}
                onPress={() => onChange({ method })}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 16,
                  borderCurve: "continuous",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors.accentTint : colors.surface2,
                  borderWidth: 1.3,
                  borderColor: active ? colors.mint : colors.border
                }}
              >
                <Text selectable style={{ color: active ? colors.mint : colors.text2, fontWeight: typography.heavy }}>
                  {method === "sms" ? "SMS" : "Email"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={partner.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="Partner name"
          placeholderTextColor={colors.text3}
          style={{
            minHeight: 52,
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1.3,
            borderColor: colors.border,
            color: colors.text,
            paddingHorizontal: 16,
            backgroundColor: colors.surface2
          }}
        />
        <TextInput
          value={partner.contact}
          onChangeText={(contact) => onChange({ contact })}
          placeholder={partner.method === "sms" ? "Phone number" : "Email address"}
          placeholderTextColor={colors.text3}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={partner.method === "sms" ? "phone-pad" : "email-address"}
          style={{
            minHeight: 52,
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1.3,
            borderColor: colors.border,
            color: colors.text,
            paddingHorizontal: 16,
            backgroundColor: colors.surface2
          }}
        />
        <TextInput
          value={partner.messageTemplate}
          onChangeText={(messageTemplate) => onChange({ messageTemplate })}
          multiline
          placeholder="Message template"
          placeholderTextColor={colors.text3}
          style={{
            minHeight: 92,
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1.3,
            borderColor: colors.border,
            color: colors.text,
            padding: 16,
            textAlignVertical: "top",
            backgroundColor: colors.surface2
          }}
        />
        <View style={{ borderRadius: 20, borderCurve: "continuous", padding: 12, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentTint, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ShieldCheck color={colors.mint} size={19} />
            <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, flex: 1 }}>
              Weekly sponsor report
            </Text>
          </View>
          <Text selectable style={{ color: colors.text2, lineHeight: 20 }}>
            {sponsorReport.summary.streakDays}d streak · {sponsorReport.summary.completedChallenges} resets · {sponsorReport.summary.checkIns} check-ins.
          </Text>
          <Text style={{ color: colors.text2, lineHeight: 24 }}>{`Self-reported urge moments: ${sponsorReport.summary.attempts}`}</Text>
          <Text selectable style={{ color: colors.text3, lineHeight: 19 }}>
            Private notes, contacts, browsing details, and device protection history are not included.
          </Text>
          <Pressable
            disabled={canSendSponsorReport && !enabledWithContact}
            onPress={canSendSponsorReport ? onSendReport : onManagePlan}
            style={{
              minHeight: 44,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: sponsorReportReady ? colors.mint : colors.border,
              alignItems: "center",
              justifyContent: "center",
              opacity: sponsorReportReady || !canSendSponsorReport ? 1 : 0.55
            }}
          >
            <Text selectable style={{ color: sponsorReportReady ? colors.bg : colors.text2, fontWeight: typography.heavy }}>
              {canSendSponsorReport ? "Send Report" : "Upgrade"}
            </Text>
          </Pressable>
        </View>
        <View style={{ borderRadius: 20, borderCurve: "continuous", padding: 12, backgroundColor: colors.accentTint, borderWidth: 1, borderColor: colors.accentTint, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <CircleUserRound color={colors.sky} size={19} />
            <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, flex: 1 }}>
              Family Support Circle
            </Text>
            {!canUseSupportCircle ? (
              <Pressable onPress={onManagePlan} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accentTint }}>
                <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy, fontSize: 12 }}>
                  Upgrade
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Text selectable style={{ color: colors.text3, lineHeight: 19 }}>
            Local contacts only. FREED opens SMS or email when you choose to share.
          </Text>
          {canUseSupportCircle ? (
            <View style={{ gap: 12 }}>
              {visibleSupportCircle.slice(0, 4).map((member) => {
                const ready = hasUsableSupportCircleMember(member);
                const persisted = supportCircle.some((item) => item.id === member.id);
                const draft = draftSupportMemberIds.includes(member.id);
                return (
                  <View key={member.id} style={{ gap: 8, borderRadius: 16, padding: 12, backgroundColor: colors.surface2 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        value={member.name}
                        onChangeText={(name) => onSupportCircleChange(member.id, { name, enabled: true })}
                        placeholder="Name"
                        placeholderTextColor={colors.text3}
                        style={{ flex: 1, minHeight: 44, borderRadius: 16, color: colors.text, paddingHorizontal: 12, backgroundColor: colors.surface2 }}
                      />
                      <Pressable
                        onPress={() => onSupportCircleChange(member.id, { method: member.method === "sms" ? "email" : "sms" })}
                        style={{ width: 70, minHeight: 44, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentTint }}
                      >
                        <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy }}>
                          {member.method === "sms" ? "SMS" : "Email"}
                        </Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={member.contact}
                      onChangeText={(contact) => onSupportCircleChange(member.id, { contact, enabled: true })}
                      placeholder={member.method === "sms" ? "Phone number" : "Email address"}
                      placeholderTextColor={colors.text3}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType={member.method === "sms" ? "phone-pad" : "email-address"}
                      style={{ minHeight: 44, borderRadius: 16, color: colors.text, paddingHorizontal: 12, backgroundColor: colors.surface2 }}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        disabled={!ready}
                        onPress={() => onSendSupportCircleReport(member.id)}
                        style={{
                          flex: 1,
                          minHeight: 40,
                          borderRadius: 999,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: ready ? colors.sky : colors.border,
                          opacity: ready ? 1 : 0.55
                        }}
                      >
                        <Text selectable style={{ color: ready ? colors.bg : colors.text2, fontWeight: typography.heavy }}>
                          Send Report
                        </Text>
                      </Pressable>
                      {persisted ? (
                        <Pressable onPress={() => onSupportCircleRemove(member.id)} style={{ minHeight: 40, borderRadius: 999, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.border }}>
                          <Text selectable style={{ color: colors.text2, fontWeight: typography.heavy }}>
                            Remove
                          </Text>
                        </Pressable>
                      ) : draft ? (
                        <Pressable onPress={() => removeSupportDraft(member.id)} style={{ minHeight: 40, borderRadius: 999, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.border }}>
                          <Text selectable style={{ color: colors.text2, fontWeight: typography.heavy }}>
                            Cancel
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
              {supportCircle.length > 0 && canAddSupportMember ? (
                <Pressable
                  onPress={addSupportDraft}
                  style={{ minHeight: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentTint }}
                >
                  <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy }}>
                    Add Contact
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function formatRecoveryDate(value: string | null) {
  if (!value) return "None yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "None yet";
  return date.toLocaleDateString(appI18n.language, { month: "short", day: "numeric" });
}

const membershipPlanLabels: Record<PremiumPlanId, { full: string; compact: string }> = {
  yearly: { full: "Annual Premium", compact: "Annual" },
  monthly: { full: "Monthly Premium", compact: "Monthly" },
  lifetime: { full: "Lifetime Premium", compact: "Lifetime" },
  family: { full: "Family Plan", compact: "Family" },
  accountability: { full: "Accountability Plan", compact: "Partner" },
  "ai-coach": { full: "AI Coach Plan", compact: "AI Coach" }
};

function getMembershipPlanLabel(recoveryState: RecoveryState, compact = false) {
  if (!recoveryState.premium) return "Free";
  const planId = recoveryState.premiumPlanId;
  if (!planId) return "Premium";
  return membershipPlanLabels[planId]?.[compact ? "compact" : "full"] ?? "Premium";
}

function getMembershipCapabilityLabels(capabilities: PremiumCapabilitySet) {
  const labels: string[] = [];
  if (capabilities.noAds) labels.push("No ads");
  if (capabilities.premiumChallenges) labels.push("Premium resets");
  if (capabilities.advancedAiCoach) labels.push("CLARA+");
  if (capabilities.sponsorAccountability) labels.push("Sponsor");
  if (capabilities.familySupport) labels.push("Family");
  return labels;
}

function LegacyProfileScreen({
  recoveryState,
  premium,
  premiumCapabilities,
  streakDays,
  bestStreakDays,
  attempts,
  relapseCount,
  lastRelapseAt,
  reminders,
  smartReminderSuggestion,
  retentionPlan,
  accountability,
  supportCircle,
  disciplineSettings,
  reminderBusy,
  onReminderChange,
  onAccountabilityChange,
  onSendSponsorReport,
  onSendSupportCircleReport,
  onSupportCircleChange,
  onSupportCircleRemove,
  onRestoreBackup,
  onDeleteLocalData,
  onDeleteAccountAndData,
  onManagePlan,
  onLogSlip,
  storageError,
  protectionCapability,
  protectionStatus,
  protectionSyncMessage,
  refreshProtectionStatus,
  pendingFirebaseEmailLink,
  onPendingFirebaseEmailLinkHandled
}: {
  recoveryState: RecoveryState;
  premium: boolean;
  premiumCapabilities: PremiumCapabilitySet;
  streakDays: number;
  bestStreakDays: number;
  attempts: BlockingAttempt[];
  relapseCount: number;
  lastRelapseAt: string | null;
  reminders: ReminderPreferences;
  smartReminderSuggestion: SmartReminderSuggestion;
  retentionPlan: RetentionPlan;
  accountability: AccountabilityPartner;
  supportCircle: SupportCircleMember[];
  disciplineSettings: DisciplineSettings;
  reminderBusy: boolean;
  onReminderChange: (update: Partial<ReminderPreferences>) => void;
  onAccountabilityChange: (update: Partial<AccountabilityPartner>) => void;
  onSendSponsorReport: () => void;
  onSendSupportCircleReport: (memberId: string) => void;
  onSupportCircleChange: (memberId: string, update: Partial<Omit<SupportCircleMember, "id" | "updatedAt" | "lastContactedAt">>) => void;
  onSupportCircleRemove: (memberId: string) => void;
  onRestoreBackup: (state: RecoveryState) => void;
  onDeleteLocalData: () => Promise<void> | void;
  onDeleteAccountAndData: () => Promise<FirebaseAccountDeletionResult>;
  onManagePlan: () => void;
  onLogSlip: () => void;
  storageError: string | null;
  protectionCapability: ProtectionCapability | null;
  protectionStatus: ProtectionStatus | null;
  protectionSyncMessage: string | null;
  refreshProtectionStatus: () => Promise<ProtectionRefreshResult>;
  pendingFirebaseEmailLink: string | null;
  onPendingFirebaseEmailLinkHandled: () => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [protectionBusy, setProtectionBusy] = React.useState(false);
  const [protectionActionMessage, setProtectionActionMessage] = React.useState<string | null>(null);
  const dnsGuardActive = Boolean(protectionStatus?.adultFilterActive ?? (protectionStatus?.active && protectionStatus.mode === "dns"));
  const dnsGuardRuntimeReady = protectionStatus?.dnsGuardRuntimeReady === true;
  const dnsGuardRuntimeNeedsAttention =
    protectionCapability?.platform === "android" &&
    dnsGuardActive &&
    !dnsGuardRuntimeReady;
  const screenTimeFilterActive = protectionStatus?.active && protectionStatus.mode === "screen-time";
  const screenTimeScheduleActive = Boolean(protectionStatus?.scheduled && protectionStatus.mode === "screen-time");
  const privateDnsMode = protectionStatus?.privateDnsMode;
  const privateDnsActive = Boolean(privateDnsMode && privateDnsMode !== "off" && privateDnsMode !== "unknown");
  const privateDnsStrict = privateDnsMode === "hostname";
  const reviewedAdultFeedRequired = isReviewedAdultDomainFeedRequired();
  const nativeAdultFeedReadyForActivation = nativeAdultDomainFeedReadyForActivation(protectionStatus);
  const safariAdultFeedReadyForActivation = safariAdultDomainFeedReadyForActivation(protectionStatus);
  const nativeAdultFeedReviewed = hasReviewedNativeAdultDomainFeed(protectionStatus);
  const safariAdultFeedReviewed = hasReviewedSafariAdultDomainFeed(protectionStatus);
  const nativeAdultFeedVersionLabel = nativeAdultFeedReviewed ? "Reviewed adult-domain feed" : "Embedded adult-domain fallback";
  const safariAdultFeedVersionLabel = safariAdultFeedReviewed ? "Reviewed Safari content-blocker rules" : "Embedded Safari content-blocker fallback";
  const nativeUnlockMinutes =
    protectionStatus?.activeUnlockExpiresAt
      ? Math.max(1, Math.ceil((Date.parse(protectionStatus.activeUnlockExpiresAt) - Date.now()) / 60_000))
      : null;
  const nativeUnlockLabel =
    nativeUnlockMinutes && protectionCapability?.platform === "ios"
      ? `${nativeUnlockMinutes}m Screen Time unlock`
      : nativeUnlockMinutes && protectionStatus?.activeUnlockSourcePackage
      ? `${nativeUnlockMinutes}m ${labelForDoomscrollAppPackage(protectionStatus.activeUnlockSourcePackage) ?? "app"} unlock`
      : nativeUnlockMinutes
      ? `${nativeUnlockMinutes}m unlock`
      : null;
  const dnsGuardTelemetryVisible =
    Boolean(protectionCapability?.localVpnFallback) &&
    (typeof protectionStatus?.dnsGuardSessionQueries === "number" ||
      typeof protectionStatus?.dnsGuardStartCount === "number" ||
      Boolean(protectionStatus?.dnsGuardLastStopReason));
  const dnsGuardLifecycleText = dnsGuardTelemetryVisible
    ? `DNS Guard session: ${protectionStatus?.dnsGuardSessionQueries ?? 0} quer${(protectionStatus?.dnsGuardSessionQueries ?? 0) === 1 ? "y" : "ies"}, ${protectionStatus?.dnsGuardBlockedQueries ?? 0} blocked, ${protectionStatus?.dnsGuardAllowedQueries ?? 0} allowed, ${protectionStatus?.dnsGuardServfailResponses ?? 0} SERVFAIL, ${protectionStatus?.dnsGuardMalformedPackets ?? 0} malformed. ${dnsGuardActive ? `Uptime ${formatCompactDurationMs(protectionStatus?.dnsGuardUptimeMs)}.` : `Last session ${formatCompactDurationMs(protectionStatus?.dnsGuardLastSessionDurationMs)}.`}${protectionStatus?.dnsGuardLastStopReason ? ` Last stop: ${protectionStatus.dnsGuardLastStopReason}.` : ""}`
    : null;
  const dnsGuardRestartText =
    protectionCapability?.localVpnFallback &&
    (typeof protectionStatus?.dnsGuardUserEnabled === "boolean" || protectionStatus?.dnsGuardLastAutoRestartResult)
      ? `DNS Guard restart: ${
          protectionStatus?.dnsGuardUserEnabled
            ? protectionStatus?.dnsGuardAutoRestartEligible
              ? "eligible after reboot or app update"
              : "waiting for VPN permission review"
            : "off"
        }.${protectionStatus?.dnsGuardLastAutoRestartResult ? ` Last check ${protectionStatus.dnsGuardLastAutoRestartResult}${protectionStatus.dnsGuardLastAutoRestartAction ? ` from ${protectionStatus.dnsGuardLastAutoRestartAction.replace("android.intent.action.", "")}` : ""}${protectionStatus.dnsGuardLastAutoRestartSkipReason ? ` (${protectionStatus.dnsGuardLastAutoRestartSkipReason})` : ""}.` : ""}`
      : null;
  const usageStatsObservedPackageNames = protectionStatus?.usageStatsObservedPackageNames ?? [];
  const usageStatsPackageBreakdown = Object.entries(protectionStatus?.usageStatsTodayMinutesByPackage ?? {})
    .filter(([packageName, minutes]) => usageStatsObservedPackageNames.includes(packageName) || minutes > 0)
    .sort(([left], [right]) => left.localeCompare(right));
  const usageStatsPackageBreakdownText =
    usageStatsPackageBreakdown.length > 0
      ? ` Package coverage: ${usageStatsPackageBreakdown
          .slice(0, 5)
          .map(([packageName, minutes]) => `${packageName} ${minutes}m`)
          .join(", ")}${usageStatsPackageBreakdown.length > 5 ? `, +${usageStatsPackageBreakdown.length - 5} more` : ""}.`
      : "";
  const androidSettingsRouteText =
    protectionCapability?.platform === "android" && protectionStatus?.androidSettingsRouteOpened
      ? `Last Android settings route: ${protectionStatus.androidSettingsRouteOpened.replace("android.settings.", "").replace(/_/g, " ").toLowerCase()}${protectionStatus.androidSettingsFallbackUsed ? " (fallback)" : ""}${protectionStatus.androidSettingsRouteOpenedAt ? ` at ${protectionStatus.androidSettingsRouteOpenedAt}` : ""}.${protectionStatus.androidSettingsRouteComponent ? ` Target Android settings component: ${protectionStatus.androidSettingsRouteComponent}.` : ""}${protectionStatus.androidSettingsRouteError ? ` ${protectionStatus.androidSettingsRouteError}` : ""}`
      : null;
  const screenTimeSelectionCount = getSelectedScreenTimeTargetCount(protectionStatus);
  const iosAppLimitScheduled = protectionCapability?.platform === "ios" && Boolean(protectionStatus?.appLimitScheduled);
  const iosAppLimitReachedToday = protectionCapability?.platform === "ios" && Boolean(protectionStatus?.appLimitReachedToday);
  const protectionDetail = protectionCapability?.localVpnFallback
    ? "DNS Guard handles adult domains. Accessibility can interrupt opted-in apps after configured limits or selected short-form thresholds. App and short-form earned unlocks pause only the package that earned them; browser challenge windows stay local."
    : protectionCapability?.managedSettings
    ? "Screen Time filtering uses Apple's ManagedSettings adult-content policy. Selected apps, categories, and domains can be shielded after the daily limit or during high-risk windows."
    : "Native protection controls appear here in signed iOS and Android device builds.";
  const membershipPlanLabel = getMembershipPlanLabel(recoveryState);
  const membershipCapabilities = getMembershipCapabilityLabels(premiumCapabilities);
  const sleepStartClock = parseClockTime(disciplineSettings.sleepStartTime) ?? { hour: 22, minute: 0 };
  const sleepEndClock = parseClockTime(disciplineSettings.sleepEndTime) ?? { hour: 6, minute: 0 };
  const runProtectionAction = React.useCallback(
    (action: () => Promise<ProtectionStatus>) => {
      setProtectionBusy(true);
      action()
        .then((status) => setProtectionActionMessage(status.message))
        .catch(() => setProtectionActionMessage("Protection action could not complete."))
        .finally(() => {
          void refreshProtectionStatus();
          setProtectionBusy(false);
        });
    },
    [refreshProtectionStatus]
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingBottom: 56, gap: 20 }}>
      <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy }}>
        Profile
      </Text>
      <Card gradient={gradients.mint} style={{ alignItems: "center", gap: 12 }} category="reflection">
        <MomentumCompanion pose="secure" context="profile" variant="progress" width={104} height={104} interactive />
        <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: typography.heavy }}>
          FREED Member
        </Text>
        <Text selectable style={{ color: colors.peach, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
          {streakDays} DAY STREAK
        </Text>
      </Card>

      <Card category="reflection">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
              Membership
            </Text>
            <Text selectable style={{ color: colors.text2, marginTop: 4 }}>
              {premium
                ? `${membershipPlanLabel} is active from a verified purchase or restore.`
                : "Free plan uses a rewarded reset before challenge mode."}
            </Text>
          </View>
          <Pressable
            onPress={premium ? undefined : onManagePlan}
            disabled={premium}
            accessibilityRole={premium ? undefined : "button"}
            accessibilityLabel={premium ? `${membershipPlanLabel} membership active` : "Upgrade to Premium"}
            style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: premium ? colors.mint : colors.surface2 }}
          >
            <Text selectable style={{ color: premium ? colors.bg : colors.text, fontWeight: typography.heavy }}>
              {premium ? "Active" : "Upgrade"}
            </Text>
          </Pressable>
        </View>
        {premium && membershipCapabilities.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {membershipCapabilities.map((label) => (
              <Text
                key={label}
                selectable
                style={{
                  color: colors.mint,
                  backgroundColor: colors.accentTint,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: typography.heavy
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Metric label="Protected" value={`${attempts.length}`} color={colors.mint} />
        <Metric label="Best" value={`${bestStreakDays}d`} color={colors.yellow} />
      </View>

      <Card gradient={[`${colors.peach}24`, colors.surface]} category="reflection">
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.accentTint, alignItems: "center", justifyContent: "center" }}>
            <TimerReset color={colors.peach} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
              Private Reset Log
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 4 }}>
              A slip is data, not a verdict. Log it honestly and FREED restarts the streak without losing the pattern.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, borderRadius: 16, padding: 12, backgroundColor: colors.surface2 }}>
            <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
              {relapseCount}
            </Text>
            <Text selectable style={{ color: colors.text3, marginTop: 4, fontWeight: typography.bold }}>
              Logged
            </Text>
          </View>
          <View style={{ flex: 1, borderRadius: 16, padding: 12, backgroundColor: colors.surface2 }}>
            <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: typography.heavy }}>
              {formatRecoveryDate(lastRelapseAt)}
            </Text>
            <Text selectable style={{ color: colors.text3, marginTop: 4, fontWeight: typography.bold }}>
              Latest
            </Text>
          </View>
        </View>
        <PillButton label="Log Slip Safely" variant="ghost" onPress={onLogSlip} icon={<NotebookPen color={colors.text2} size={18} />} />
      </Card>

      <Card gradient={storageError ? gradients.danger : gradients.mint} category="reflection" title={"Recovery Data"}>
        
        <Text selectable style={{ color: colors.text2, lineHeight: 24 }}>
          {storageError
            ? `Local save needs attention: ${storageError}`
            : "Streaks, check-ins, quiz answers, protected attempts, membership status, and challenge history are saved on this device."}
        </Text>
      </Card>

      <RetentionPlanCard plan={retentionPlan} />

      <RecoveryBackupCard
        recoveryState={recoveryState}
        onRestore={onRestoreBackup}
        pendingFirebaseEmailLink={pendingFirebaseEmailLink}
        onPendingFirebaseEmailLinkHandled={onPendingFirebaseEmailLinkHandled}
      />

      <PrivacySupportCard onDeleteLocalData={onDeleteLocalData} onDeleteAccountAndData={onDeleteAccountAndData} />

      <ReminderSettingsCard reminders={reminders} busy={reminderBusy} smartSuggestion={smartReminderSuggestion} onChange={onReminderChange} />

      <AccountabilitySettingsCard
        partner={accountability}
        supportCircle={supportCircle}
        recoveryState={recoveryState}
        canSendSponsorReport={premiumCapabilities.sponsorAccountability}
        canUseSupportCircle={premiumCapabilities.familySupport || premiumCapabilities.sponsorAccountability}
        onSendReport={onSendSponsorReport}
        onSendSupportCircleReport={onSendSupportCircleReport}
        onManagePlan={onManagePlan}
        onSupportCircleChange={onSupportCircleChange}
        onSupportCircleRemove={onSupportCircleRemove}
        onChange={onAccountabilityChange}
      />

      <FocusShieldSection
        protectionCapability={protectionCapability}
        protectionStatus={protectionStatus}
        onRefresh={refreshProtectionStatus}
      />

      <Card category="reflection" title={"Native Protection"}>
        
        <Text selectable style={{ color: colors.text2, lineHeight: 24, marginBottom: 12 }}>
          {protectionStatus?.message ?? "Checking platform protection status..."}
        </Text>
        {protectionActionMessage ? (
          <Text selectable style={{ color: colors.mint, lineHeight: 20, marginBottom: 12, fontWeight: typography.bold }}>
            {protectionActionMessage}
          </Text>
        ) : null}
        {protectionSyncMessage ? (
          <Text selectable style={{ color: colors.yellow, lineHeight: 20, marginBottom: 12, fontWeight: typography.bold }}>
            {protectionSyncMessage}
          </Text>
        ) : null}
        {androidSettingsRouteText ? (
          <Text selectable style={{ color: protectionStatus?.androidSettingsRouteError ? colors.yellow : colors.text3, lineHeight: 19, marginBottom: 12 }}>
            {androidSettingsRouteText}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <Text selectable style={{ color: protectionStatus?.active ? colors.mint : colors.text3, backgroundColor: protectionStatus?.active ? colors.accentTint : colors.surface2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
            {protectionStatus?.active ? "Active" : "Inactive"}
          </Text>
          <Text selectable style={{ color: colors.text2, backgroundColor: colors.surface2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
            {(protectionStatus?.mode ?? "checking").replace("-", " ")}
          </Text>
          {protectionCapability?.platform === "android" && protectionStatus?.androidNotificationPermissionRequired ? (
            <Text
              selectable
              style={{
                color: protectionStatus.androidNotificationPermissionGranted ? colors.mint : colors.yellow,
                backgroundColor: protectionStatus.androidNotificationPermissionGranted ? colors.accentTint : colors.accentTint,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                fontWeight: typography.bold
              }}
            >
              Recovery notifications {protectionStatus.androidNotificationPermissionGranted ? "on" : "off"}
            </Text>
          ) : null}
          {screenTimeScheduleActive ? (
            <Text selectable style={{ color: colors.yellow, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Scheduled
            </Text>
          ) : null}
          {screenTimeSelectionCount > 0 ? (
            <Text selectable style={{ color: colors.mint, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderCurve: "continuous", fontWeight: typography.bold, fontVariant: ["tabular-nums"] }}>
              {screenTimeSelectionCount} selected
            </Text>
          ) : null}
          {iosAppLimitScheduled ? (
            <Text selectable style={{ color: colors.sky, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              iOS app limit {protectionStatus?.dailyLimitMinutes ?? 20}m
            </Text>
          ) : null}
          {iosAppLimitReachedToday ? (
            <Text selectable style={{ color: colors.peach, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderCurve: "continuous", fontWeight: typography.bold }}>
              Limit reached today
            </Text>
          ) : null}
          {(protectionStatus?.blockedApplications ?? 0) > 0 ? (
            <Text selectable style={{ color: colors.peach, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderCurve: "continuous", fontWeight: typography.bold, fontVariant: ["tabular-nums"] }}>
              {protectionStatus?.blockedApplications} apps
            </Text>
          ) : null}
          {nativeUnlockLabel ? (
            <Text selectable style={{ color: colors.peach, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderCurve: "continuous", fontWeight: typography.bold }}>
              {nativeUnlockLabel}
            </Text>
          ) : null}
          {protectionStatus?.adultFilterStaysActiveDuringEarnedUnlock ? (
            <Text selectable style={{ color: colors.mint, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Adult filter on
            </Text>
          ) : null}
          {privateDnsMode ? (
            <Text selectable style={{ color: privateDnsStrict ? colors.yellow : colors.text2, backgroundColor: privateDnsStrict ? colors.accentTint : colors.surface2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Private DNS {privateDnsMode}
            </Text>
          ) : null}
          {protectionCapability?.platform === "android" && typeof protectionStatus?.dnsGuardRuntimeReady === "boolean" ? (
            <Text selectable style={{ color: dnsGuardRuntimeReady ? colors.mint : colors.yellow, backgroundColor: dnsGuardRuntimeReady ? colors.accentTint : colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              {dnsGuardRuntimeReady ? "DNS runtime ready" : "DNS runtime attention"}
            </Text>
          ) : null}
          {protectionStatus?.usageStatsAuthorized ? (
            <Text selectable style={{ color: colors.sky, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Usage Access
            </Text>
          ) : null}
          {protectionStatus?.adultDomainFeedDomainCount ? (
            <Text selectable style={{ color: colors.mint, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              {protectionStatus.adultDomainFeedDomainCount} domains
            </Text>
          ) : null}
          {protectionStatus?.safariContentBlockerRuleCount ? (
            <Text selectable style={{ color: protectionStatus.safariContentBlockerEnabled ? colors.mint : colors.yellow, backgroundColor: protectionStatus.safariContentBlockerEnabled ? colors.accentTint : colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Safari {protectionStatus.safariContentBlockerRuleCount} rules
            </Text>
          ) : null}
          {protectionStatus?.safariContentBlockerEnabled ? (
            <Text selectable style={{ color: colors.mint, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Safari blocker on
            </Text>
          ) : protectionStatus?.safariContentBlockerEnabled === false ? (
            <Text selectable style={{ color: colors.yellow, backgroundColor: colors.accentTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              Safari blocker off
            </Text>
          ) : null}
        </View>
        {protectionStatus?.adultDomainFeedVersion ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            {nativeAdultFeedVersionLabel} {protectionStatus.adultDomainFeedVersion}
            {protectionStatus.adultDomainFeedChecksum ? ` (${protectionStatus.adultDomainFeedChecksum})` : ""}
            {nativeAdultFeedReadyForActivation
              ? " is synced to native browser and DNS protection."
              : reviewedAdultFeedRequired
              ? " is present as a bounded local fallback; production activation waits for a reviewed remote feed."
              : " is synced to native browser and DNS protection."}
          </Text>
        ) : null}
        {protectionStatus?.safariContentBlockerVersion ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            {safariAdultFeedVersionLabel} {protectionStatus.safariContentBlockerVersion}
            {protectionStatus.safariContentBlockerChecksum ? ` (${protectionStatus.safariContentBlockerChecksum})` : ""}
            {safariAdultFeedReadyForActivation
              ? " are packaged for Safari, enabled, and reloaded through the native extension."
              : protectionStatus.safariContentBlockerEnabled === false
              ? " are packaged, but Safari reports the FREED content blocker is disabled. Enable it in Settings > Safari > Extensions."
              : reviewedAdultFeedRequired
              ? " are present as a bounded local fallback; production activation waits for reviewed Safari feed provenance."
              : " are packaged for Safari and reloaded through the native extension."}
          </Text>
        ) : null}
        {protectionStatus?.safariContentBlockerStateCheckedAt ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            Safari blocker state checked at {protectionStatus.safariContentBlockerStateCheckedAt}.
          </Text>
        ) : null}
        {protectionStatus?.safariContentBlockerStateError ? (
          <Text selectable style={{ color: colors.yellow, lineHeight: 19, marginBottom: 12, fontWeight: typography.bold }}>
            Safari blocker state needs device verification: {protectionStatus.safariContentBlockerStateError}
          </Text>
        ) : null}
        {protectionStatus?.safariContentBlockerLastReloadError ? (
          <Text selectable style={{ color: colors.yellow, lineHeight: 19, marginBottom: 12, fontWeight: typography.bold }}>
            Safari rule reload needs device verification: {protectionStatus.safariContentBlockerLastReloadError}
          </Text>
        ) : null}
        {iosAppLimitScheduled ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            iOS DeviceActivity monitors selected Screen Time targets and shields them after {protectionStatus?.dailyLimitMinutes ?? 20} minutes without inspecting app screens.
            {protectionStatus?.appLimitReachedToday
              ? ` Threshold reached ${protectionStatus.appLimitReachedDate ?? "today"}; selected shields should be active unless a Screen Time-sourced earned unlock is running.`
              : " Waiting for the daily threshold event."}
            {protectionStatus?.appLimitActivityName && protectionStatus?.appLimitEventName
              ? ` Monitor ${protectionStatus.appLimitActivityName} / ${protectionStatus.appLimitEventName}.`
              : ""}
            {protectionStatus?.earnedUnlockActivityName
              ? ` Earned unlock relock monitor ${protectionStatus.earnedUnlockActivityName}.`
              : ""}
          </Text>
        ) : null}
        {protectionCapability?.localVpnFallback && privateDnsActive ? (
          <Text selectable style={{ color: privateDnsStrict ? colors.yellow : colors.text3, lineHeight: 20, marginBottom: 12, fontWeight: typography.bold }}>
            {privateDnsStrict
              ? `Strict Private DNS${protectionStatus?.privateDnsSpecifier ? ` (${protectionStatus.privateDnsSpecifier})` : ""} is on. Keep Accessibility enabled and verify DNS Guard on this device because encrypted DNS can change resolver behavior.`
              : "Private DNS opportunistic mode is visible for QA. FREED keeps app interventions available while DNS Guard evidence confirms resolver behavior."}
          </Text>
        ) : null}
        {protectionCapability?.localVpnFallback && protectionStatus?.dnsGuardLastResolver ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            DNS Guard last forwarded through resolver {protectionStatus.dnsGuardLastResolver} of {protectionStatus.dnsGuardResolverCount ?? 2}.
          </Text>
        ) : null}
        {dnsGuardRuntimeNeedsAttention ? (
          <Text selectable style={{ color: colors.yellow, lineHeight: 19, marginBottom: 12, fontWeight: typography.bold }}>
            DNS Guard runtime needs attention: {protectionStatus?.dnsGuardRuntimeIssue ?? "start DNS Guard again, then run Test Protection before relying on device blocking."}
          </Text>
        ) : null}
        {dnsGuardLifecycleText ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            {dnsGuardLifecycleText}
          </Text>
        ) : null}
        {dnsGuardRestartText ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            {dnsGuardRestartText}
          </Text>
        ) : null}
        {protectionStatus?.usageStatsAuthorized ? (
          <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
            Usage Access sees {protectionStatus.usageStatsObservedPackages ?? 0} selected app package{(protectionStatus.usageStatsObservedPackages ?? 0) === 1 ? "" : "s"} today
            {typeof protectionStatus.usageStatsTodayMinutes === "number" ? ` (${protectionStatus.usageStatsTodayMinutes} min total).` : "."}
            {usageStatsPackageBreakdownText ? ` ${usageStatsPackageBreakdownText}` : ""}
          </Text>
        ) : null}
        {protectionCapability?.platform === "android" && privateDnsActive ? (
          <View style={{ marginBottom: 12 }}>
            <PillButton
              label={privateDnsStrict ? "Review Private DNS" : "Open Network DNS"}
              variant="ghost"
              disabled={protectionBusy}
              onPress={() => runProtectionAction(openPrivateDnsSettings)}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Authorize"
              variant="ghost"
              disabled={protectionBusy}
              onPress={() => {
                runProtectionAction(requestProtectionAuthorization);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Settings"
              variant="ghost"
              disabled={protectionBusy}
              onPress={() => {
                runProtectionAction(openProtectionSettings);
              }}
            />
          </View>
        </View>
        {protectionCapability?.localVpnFallback ? (
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <PillButton
                label={
                  dnsGuardActive
                    ? "DNS Guard On"
                    : protectionStatus?.vpnConsentRequired === false
                      ? "Retry DNS Guard"
                      : "Start DNS Guard"
                }
                variant="ghost"
                disabled={protectionBusy || Boolean(dnsGuardActive)}
                onPress={() => runProtectionAction(applyAdultContentFilter)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PillButton
                label="Stop DNS"
                variant="ghost"
                disabled={protectionBusy || !dnsGuardActive}
                onPress={() => runProtectionAction(stopAdultContentFilter)}
              />
            </View>
          </View>
        ) : null}
        {!protectionCapability?.localVpnFallback && protectionCapability?.managedSettings ? (
          <>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={screenTimeFilterActive ? "Filter On" : "Apply Filter"}
                  variant="ghost"
                  disabled={protectionBusy || Boolean(screenTimeFilterActive)}
                  onPress={() => runProtectionAction(applyAdultContentFilter)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <PillButton
                  label="Pause Filter"
                  variant="ghost"
                  disabled={protectionBusy || !screenTimeFilterActive}
                  onPress={() => runProtectionAction(stopAdultContentFilter)}
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={screenTimeScheduleActive ? "Night Guard On" : "Night Guard"}
                  variant="ghost"
                  disabled={protectionBusy || screenTimeScheduleActive}
                  onPress={() =>
                    runProtectionAction(() =>
                      startRiskWindowMonitoring(sleepStartClock.hour, sleepEndClock.hour, sleepStartClock.minute, sleepEndClock.minute)
                    )
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <PillButton
                  label="Stop Guard"
                  variant="ghost"
                  disabled={protectionBusy || !screenTimeScheduleActive}
                  onPress={() => runProtectionAction(stopRiskWindowMonitoring)}
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <PillButton
                  label={screenTimeSelectionCount > 0 ? "Edit Selection" : "Choose Apps"}
                  variant="ghost"
                  disabled={protectionBusy || !protectionStatus?.authorized}
                  onPress={() => runProtectionAction(presentFamilyActivityPicker)}
                />
              </View>
            </View>
          </>
        ) : null}
        <Text selectable style={{ color: colors.text3, lineHeight: 19, marginBottom: 12 }}>
          {protectionDetail}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            ["Screen Time", protectionCapability?.screenTime],
            ["Managed Settings", protectionCapability?.managedSettings],
            ["Accessibility", protectionCapability?.accessibility],
            ["DNS", protectionCapability?.dnsFiltering],
            ["DNS-only VPN", protectionCapability?.localVpnFallback]
          ].map(([label, active]) => (
            <Text key={label as string} selectable style={{ color: active ? colors.mint : colors.text3, backgroundColor: active ? colors.accentTint : colors.surface2, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, fontWeight: typography.bold }}>
              {label as string}
            </Text>
          ))}
        </View>
      </Card>

      <Card category="reflection" title={"Platform Plan"}>
        
        {[
          ["iOS Screen Time", "FamilyControls, ManagedSettings and shield extensions"],
          ["Safari/Web", "Managed web-content filter plus adult domain exceptions"],
          ["Android Browser", "Accessibility URL detection with native recovery handoff"],
          ["DNS-only Guard", "Private DNS guidance first; local VpnService routes DNS resolver IPs only"]
        ].map(([title, sub]) => (
          <View key={title} style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surface2 }}>
            <Shield color={colors.mint} size={22} />
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                {title}
              </Text>
              <Text selectable style={{ color: colors.text2, marginTop: 4 }}>
                {sub}
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

type CoachMessage = {
  role: "user" | "ai";
  text: string;
};

function CoachPanel({
  recoveryState,
  attempts,
  streakDays,
  attemptsToday,
  premium,
  slipsThisWeek,
  slipWindow,
  slipTrigger,
  initialMessages,
  onPersistMessages,
  onOpenAction,
  onBack
}: {
  recoveryState: RecoveryState;
  attempts: BlockingAttempt[];
  streakDays: number;
  attemptsToday: number;
  premium: boolean;
  slipsThisWeek: number;
  slipWindow: string;
  slipTrigger: string;
  initialMessages?: CoachMessage[];
  onPersistMessages?: (messages: CoachMessage[]) => void;
  onOpenAction?: (action:'breathe'|'journal'|'routine') => void;
  onBack: () => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [messages, setMessages] = React.useState<CoachMessage[]>(
    initialMessages && initialMessages.length > 0
      ? initialMessages
      : [{ role: "ai", text: "Hi, I am CLARA. Tell me what is happening, and we will pick the next clean action together." }]
  );
  const owner=getFirebaseAccountScope();
  const draft=useRecoveryDraft('coach',{text:'',ownerUid:owner},{ownerId:owner});
  const input=draft.value.text;
  const setInput=(text:string)=>draft.update({text,ownerUid:owner});
  const [sending,setSending]=React.useState(false);
  const [sendFailed,setSendFailed]=React.useState(false);
  const [saveFailed,setSaveFailed]=React.useState(false);
  const [usedOfflineFallback,setUsedOfflineFallback]=React.useState(false);
  const [cloudConsent,setCloudConsent]=React.useState(()=>readCloudChatConsent(localStorage,owner??''));
  const [consentSaveFailed,setConsentSaveFailed]=React.useState(false);
  const [cloudSettingsVisible,setCloudSettingsVisible]=React.useState(false);
  const [cloudResult,setCloudResult]=React.useState<ClaraConversationReply|null>(null);
  const messagesRef=React.useRef(messages);messagesRef.current=messages;
  const latest=React.useRef({recoveryState,attempts,streakDays,attemptsToday,premium,slipsThisWeek,slipWindow,slipTrigger,onPersistMessages,draft,cloudConsent});
  latest.current={recoveryState,attempts,streakDays,attemptsToday,premium,slipsThisWeek,slipWindow,slipTrigger,onPersistMessages,draft,cloudConsent};
  const sender=React.useMemo(()=>{
    const commit=(message:CoachMessage)=>{
      const next=[...messagesRef.current,message];
      latest.current.onPersistMessages?.(next);
      messagesRef.current=next;setMessages(next);
    };
    return createCoachSendController({
      isCurrent:()=>getFirebaseAccountScope()===owner,
      canRetryReply:reply=>latest.current.cloudConsent.enabled&&(reply as ClaraConversationReply).serviceState==='unavailable',
      reply:(user,isCurrent)=>replyWithClaraConversation(user,{...latest.current,locale:appI18n.language as import('@/lib/app-preferences').SupportedLanguage},{consent:latest.current.cloudConsent,messages:messagesRef.current.slice(0,Math.max(0,messagesRef.current.map(message=>message.role).lastIndexOf('user'))),guard:{ownerUid:owner??'',isCurrent:()=>isCurrent()&&latest.current.cloudConsent.enabled&&getFirebaseAccountScope()===owner},eventId:async()=>`clara_${Array.from(await getRandomBytesAsync(16),byte=>byte.toString(16).padStart(2,'0')).join('')}`}),
      onUser:user=>{commit({role:'user',text:user});if(latest.current.draft.value.text===user)latest.current.draft.update({text:'',ownerUid:owner});},
      onReply:reply=>{commit({role:'ai',text:reply.text});setCloudResult(reply as ClaraConversationReply);setUsedOfflineFallback(reply.provider!=='remote');},
      onPending:setSending,
      onError:code=>{setSendFailed(code==='service-failed');setSaveFailed(code==='save-failed');if(code===null)setUsedOfflineFallback(false);},
    });
  },[owner]);
  React.useEffect(()=>{sender.activate();return()=>sender.dispose();},[sender]);
  React.useEffect(()=>{setCloudConsent(readCloudChatConsent(localStorage,owner??''));setCloudResult(null);},[owner]);
  const changeCloudConsent=(next:CloudChatConsent)=>{
    sender.cancel();setCloudResult(null);
    try{saveCloudChatConsent(localStorage,owner??'',next);setCloudConsent(next);setConsentSaveFailed(false);}
    catch{setCloudConsent({...next,enabled:false});setConsentSaveFailed(true);}
  };
  const sendWith=(user:string)=>{void sender.send(user);};

  function send() {
    if (!input.trim() || sending) return;
    sendWith(input.trim());
  }

  const situationalChips = React.useMemo(() => {
    const list: Array<{ label: string; prompt: string }> = [];
    if (attemptsToday > 0) {
      list.push({ label: "Urge right now", prompt: "I am having an intense urge right now. Guide me through it." });
    }
    if (slipsThisWeek > 0 || streakDays === 0) {
      list.push({ label: "Reset after slip", prompt: "I had a slip. Help me reset without shame and learn from what triggered it." });
    }
    list.push(
      { label: "3 slow breaths", prompt: "Guide me through 3 slow grounding breaths." },
      { label: "Understand urges", prompt: "Help me understand this urge and choose a useful next action." },
      { label: "2-min reset", prompt: "Give me one two-minute clean reset action." },
      { label: "Night urges", prompt: "I can't sleep and night urges are loud." },
      { label: "HALT check", prompt: "Help me evaluate if I am Hungry, Angry, Lonely, or Tired right now." }
    );
    return list;
  }, [attemptsToday, slipsThisWeek, streakDays]);

  return (
    <CoachConversationLayout header={<ClaraCompactHeader onBack={onBack} onOpenSettings={() => setCloudSettingsVisible(true)} cloudEnabled={cloudConsent.enabled} state={cloudResult?.serviceState} error={consentSaveFailed} />} composer={<View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <TextInput
            value={input}
            multiline maxLength={1200}
            onChangeText={setInput}
            testID="clara-message"
        placeholder="Talk to CLARA..."
            placeholderTextColor={colors.text3}
            style={{ flex: 1, minHeight: 50, maxHeight: 120, backgroundColor: colors.surface, borderRadius: 24, borderCurve: "continuous", color: colors.text, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.3, borderColor: colors.border }}
            onSubmitEditing={() => {
              tap();
              send();
            }}
          />
          <Pressable
            onPress={() => {
              tap();
              send();
            }}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={sending || !input.trim()} accessibilityState={{disabled:sending || !input.trim(),busy:sending}}
            style={{ width: 50, height: 50, borderRadius: 25, borderCurve: "continuous", backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }}
          >
            {sending ? <ActivityIndicator color={colors.onAccent} /> : <Send color={colors.onAccent} size={18} />}
          </Pressable>
        </View>}>
        <ClaraConsentSheet visible={cloudSettingsVisible} onClose={() => setCloudSettingsVisible(false)}>
          <ClaraCloudControls consent={cloudConsent} onConsent={changeCloudConsent} state={cloudResult?.serviceState} quota={cloudResult?.quota} error={consentSaveFailed} />
        </ClaraConsentSheet>
        {messages.map((message, index) => {
          const user = message.role === "user";
          return (
            <View key={`${message.role}-${index}`} style={{ alignItems: user ? "flex-end" : "flex-start" }}>
              <View
                style={{
                  maxWidth: "88%",
                  borderRadius: 20,
                  borderCurve: "continuous",
                  padding: 16,
                  backgroundColor: user ? colors.accentTint : colors.surface,
                  borderWidth: 1,
                  borderColor: user ? colors.accent : colors.surface2
                }}
              >
                {!user && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <ShieldCheck color={colors.mint} size={14} />
                    
                  </View>
                )}
                <Text translate={message.role !== "user"} selectable style={{ color: colors.text, lineHeight: 24, fontWeight: typography.medium }}>
                  {message.text}
                </Text>
              </View>
            </View>
          );
        })}
        {sending ? (
          <View style={{ alignItems: "flex-start" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, borderCurve: "continuous", padding: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surface2 }}>
              <ActivityIndicator color={colors.mint} size="small" />
              <Text selectable style={{ color: colors.text2, fontWeight: typography.medium }}>
                CLARA is thinking...
              </Text>
            </View>
          </View>
        ) : null}
        {sending?<Pressable onPress={()=>sender.cancel()} accessibilityRole="button" style={{minHeight:48,justifyContent:'center'}}><Text style={{color:colors.accent,fontWeight:typography.bold}}>Stop waiting</Text></Pressable>:null}
        {cloudResult?.provider==='remote'&&cloudResult.action&&cloudResult.action!=='none'&&onOpenAction?<Pressable onPress={()=>onOpenAction(cloudResult.action as 'breathe'|'journal'|'routine')} style={{padding:16,minHeight:48,borderRadius:16,backgroundColor:colors.accentTint}}><Text style={{color:colors.accent,fontWeight:typography.bold}}>{cloudResult.action==='breathe'?'Open breathing':cloudResult.action==='journal'?'Open journal':'Review my routine'}</Text></Pressable>:null}
        {saveFailed || draft.error ? <InlineNotice tone="error" message={draft.error ?? "The conversation could not be saved. Your message is kept for retry."} actionLabel="Retry" onAction={()=>{if(draft.error)draft.retryStorage();if(saveFailed)void sender.retry();}} /> : null}
        {sendFailed ? (
          <InlineNotice
            tone="error"
            message="CLARA could not be reached. Check your connection and try again — meanwhile, three slow breaths still work."
            actionLabel="Retry"
            onAction={() => {
              void sender.retry();
            }}
          />
        ) : usedOfflineFallback && (!cloudResult?.serviceState || (cloudConsent.enabled && cloudResult.serviceState === 'unavailable')) ? (
          <InlineNotice
            tone="info"
            message="CLARA is offline right now, so this reply came from her built-in recovery guide."
            actionLabel="Retry"
            onAction={() => {
              void (cloudResult?.serviceState === 'unavailable' ? sender.retryReply() : sender.retry());
            }}
          />
        ) : null}
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {situationalChips.map((chip) => (
            <Pressable
              key={chip.label}
              onPress={() => {
                tap();
                sendWith(chip.prompt);
              }}
              disabled={sending}
              style={{
                backgroundColor: colors.accentTint,
                borderWidth: 1,
                borderColor: colors.accent,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderCurve: "continuous"
              }}
            >
              <Text selectable={false} style={{ color: colors.mint, fontSize: 13, fontWeight: typography.bold }}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

    </CoachConversationLayout>
  );
}

function CheckInScreen({
  todayCheckIn,
  onBack,
  onSave,
  onSaved
}: {
  todayCheckIn: DailyCheckIn | null;
  onBack: () => void;
  onSave: (input: DailyCheckInInput, dateKey: string) => void;
  onSaved: () => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const privateDraftContext = useOwnerPrivateDraftStorage();
  const [dateKey, setDateKey] = React.useState(() => getRetainedCheckInDraftDate(privateDraftContext?.storage ?? localStorage, getLocalDateKey(new Date())));
  const clock = useTodayClock(useMotionSettings().active);
  const todayKey = getLocalDateKey(new Date(clock));
  const dateChanged = dateKey !== todayKey;
  const transferredDraft = React.useRef<DailyCheckInInput & { reflection: string } | null>(null);
  const savedToday = todayCheckIn?.dateKey === dateKey ? todayCheckIn : null;
  const draft = useRecoveryDraft("checkin", { mood: savedToday?.mood ?? null, urgeLevel: savedToday?.urgeLevel ?? null,
    sleepQuality: savedToday?.sleepQuality ?? null, reflection: savedToday?.reflection ?? "" }, { dateKey });
  React.useEffect(() => { if (transferredDraft.current) { const kept = transferredDraft.current; transferredDraft.current = null; draft.update(kept); } }, [dateKey]);
  const { mood, urgeLevel, sleepQuality, reflection } = draft.value;
  const setMood = (mood: DailyCheckInInput["mood"]) => draft.update(current => ({ ...current, mood }));
  const setUrgeLevel = (urgeLevel: number) => draft.update(current => ({ ...current, urgeLevel }));
  const setSleepQuality = (sleepQuality: number | null) => draft.update(current => ({ ...current, sleepQuality }));
  const setReflection = (reflection: string) => draft.update(current => ({ ...current, reflection }));
  const moodOptions: Array<[DailyCheckInInput["mood"], string, string]> = [
    ["steady", "Steady", colors.mint],
    ["energized", "Energized", colors.sky],
    ["stressed", "Stressed", colors.peach],
    ["low", "Low", colors.peachLight]
  ];

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 36 }}>
<MomentumPageHeader pose={mood === "low" || mood === "stressed" ? "reassure" : "listen"} context="checkin" title={"Daily Check-In"} description="Name the pattern before it names the day." category="reflection" variant="progress" />
          {dateChanged ? <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 }}><Text translate={false} accessibilityRole="alert" style={{ color: colors.text2 }}>{appI18n.t("companion.dayChanged")}</Text><PillButton label={appI18n.t("companion.useDraftToday")} onPress={() => { transferredDraft.current = { ...draft.value }; setDateKey(getLocalDateKey(new Date())); }} /></View> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <BackButton onPress={onBack} label="Back" hint="Returns without saving." />
            
          </View>

          <Text selectable testID="checkin-draft-notice" accessibilityRole={draft.error ? "alert" : undefined} style={{ color: draft.error ? colors.peach : colors.text2, lineHeight: 24 }}>
            {draft.error ?? draft.notice}
          </Text>
          <Card gradient={gradients.mint} category="reflection">
            <Brain color={colors.mint} size={36} />
            
            <Text selectable style={{ color: colors.text2, lineHeight: 22, marginTop: 8 }}>
              One clear minute now makes the next hard moment easier.
            </Text>
          </Card>

          <Card category="reflection" title={"Mood"}>
            
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {moodOptions.map(([id, label, color]) => {
                const active = mood === id;
                return (
                  <Pressable
                    key={id}
                    testID={`checkin-mood-${id}`}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tap();
                      setMood(id);
                    }}
                    style={{
                      width: "48%",
                      borderRadius: 20,
                      borderCurve: "continuous",
                      padding: 16,
                      backgroundColor: active ? `${color}24` : colors.surface2,
                      borderWidth: 1.4,
                      borderColor: active ? color : colors.border
                    }}
                  >
                    <Text selectable style={{ color, fontWeight: typography.heavy }}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card category="calm" title={"Urge level"}>
            <Text translate={false} style={{ color: colors.text2, fontSize: 13 }}>{appI18n.t("companion.urgeLow")} · 0 — 5 · {appI18n.t("companion.urgeHigh")}</Text>
            
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((level) => {
                const active = urgeLevel === level;
                return (
                  <Pressable
                    key={level}
                    testID={`checkin-urge-${level}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`Urge level ${level}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tap();
                      setUrgeLevel(level);
                    }}
                    style={{ flex: 1, minHeight: 52, paddingVertical: 12, borderRadius: 16, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.mint : colors.surface2 }}
                  >
                    <Text selectable style={{ color: active ? colors.bg : colors.text2, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                      {level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card category="movement" title={"Sleep quality (optional)"}>
            <Text style={{ color: colors.text2, fontSize: 13 }}>1 · Poor sleep — 5 · Restful sleep. Tap again to leave unanswered.</Text>
            
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((level) => {
                const active = sleepQuality === level;
                return (
                  <Pressable
                    key={level}
                    testID={`checkin-sleep-${level}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`Sleep quality ${level}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tap();
                      setSleepQuality(sleepQuality === level ? null : level);
                    }}
                    style={{ flex: 1, minHeight: 52, paddingVertical: 12, borderRadius: 16, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.mint : colors.surface2 }}
                  >
                    <Text selectable style={{ color: active ? colors.bg : colors.text2, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                      {level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card category="reflection" title={"Reflection"}>
            
            <TextInput
              value={reflection}
              onChangeText={setReflection}
              editable={!draft.committed}
              maxLength={RECOVERY_DRAFT_LIMITS.reflection}
              multiline
              testID="checkin-reflection"
        placeholder="What triggered you? What helped?"
              placeholderTextColor={colors.text3}
              style={{
                minHeight: 112,
                borderRadius: 20,
                borderCurve: "continuous",
                borderWidth: 1.4,
                borderColor: colors.border,
                color: colors.text,
                padding: 16,
                textAlignVertical: "top",
                fontSize: 17,
                backgroundColor: colors.surface2
              }}
            />
          </Card>

          <PillButton
            label="Save Check-In"
            disabled={dateChanged || mood === null || urgeLevel === null || (draft.committed && !draft.error)}
            onPress={() => {
              const saved = draft.save(input => onSave(input, dateKey));
              if (saved.ok) onSaved();
            }}
            icon={<Check color={colors.bg} size={18} />}
          />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

function SlipLogScreen({
  currentStreak,
  bestStreakDays,
  onBack,
  onSave,
  onSaved
}: {
  currentStreak: number;
  bestStreakDays: number;
  onBack: () => void;
  onSave: (input: RelapseRecordInput) => void;
  onSaved: () => void;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const draft = useRecoveryDraft("slip", { trigger: "", note: "" });
  const { trigger, note } = draft.value;
  const setTrigger = (trigger: string) => draft.update(current => ({ ...current, trigger }));
  const setNote = (note: string) => draft.update(current => ({ ...current, note }));
  const triggerOptions = ["Late night", "Stress", "Boredom", "Social media", "Lonely", "Tired"];
  const streakLabel = `${currentStreak} ${currentStreak === 1 ? "day" : "days"}`;

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 36 }}>
<MomentumPageHeader pose="reassure" context="slip" restrained title={"Reset Moment"} description="A slip is data, not a verdict." category="calm" variant="calm" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BackButton onPress={onBack} label="Back" hint="Returns without saving." />
              
            </View>

            <Text selectable testID="slip-draft-notice" accessibilityRole={draft.error ? "alert" : undefined} style={{ color: draft.error ? colors.peach : colors.text2, lineHeight: 24 }}>
              {draft.error ?? draft.notice}
            </Text>
            <Card gradient={gradients.mint} category="calm">
              <TimerReset color={colors.mint} size={36} />
              
              <Text selectable style={{ color: colors.text2, lineHeight: 22, marginTop: 8 }}>
                You are still here. Logging this gives the recovery engine a cleaner pattern and starts the next honest streak now.
              </Text>
            </Card>

            <Card category="calm" title={"What FREED will do"}>
              
              <Text selectable style={{ color: colors.text2, lineHeight: 22 }}>
                Your {streakLabel} streak will restart at 0 today. Your personal best stays at {Math.max(bestStreakDays, currentStreak)} days, and this note remains private on this device.
              </Text>
            </Card>

            <Card category="calm" title={"Main trigger"}>
              
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {triggerOptions.map((option) => {
                  const active = trigger === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        tap();
                        setTrigger(active ? "" : option);
                      }}
                      style={{
                        width: "48%",
                        minHeight: 48,
                        borderRadius: 16,
                        borderCurve: "continuous",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 12,
                        backgroundColor: active ? colors.accentTint : colors.surface2,
                        borderWidth: 1.3,
                        borderColor: active ? colors.mint : colors.border
                      }}
                    >
                      <Text selectable style={{ color: active ? colors.mint : colors.text2, fontWeight: typography.heavy, textAlign: "center" }}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card category="calm" title={"Private note"}>
              
              <TextInput
                value={note}
                onChangeText={setNote}
                editable={!draft.committed}
                maxLength={RECOVERY_DRAFT_LIMITS.note}
                multiline
                testID="slip-note"
        placeholder="What happened right before it? What would make the next hour safer?"
                placeholderTextColor={colors.text3}
                style={{
                  minHeight: 118,
                  borderRadius: 20,
                  borderCurve: "continuous",
                  borderWidth: 1.4,
                  borderColor: colors.border,
                  color: colors.text,
                  padding: 16,
                  textAlignVertical: "top",
                  fontSize: 17,
                  backgroundColor: colors.surface2
                }}
              />
            </Card>

            <PillButton label="Save and Start Again" variant="success" onPress={() => {
              const saved = draft.save(onSave);
              if (saved.ok) onSaved();
            }} icon={<Check color={colors.bg} size={18} />} />
            <PillButton label="Go Back" variant="ghost" onPress={onBack} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
}

function InterceptScreen({
  attempt,
  premium,
  accountability,
  onMessagePartner,
  onReportWrongBlock,
  onContinue,
  onSponsoredReset,
  onClose
}: {
  attempt: BlockingAttempt;
  premium: boolean;
  membershipPlanLabel: string;
  streakDays: number;
  accountability: AccountabilityPartner;
  onMessagePartner: () => void;
  onReportWrongBlock?: (host: string, matchedRule: string, sourcePackage: string) => void;
  onContinue: () => void;
  onSponsoredReset: () => void;
  onClose: () => void;
}) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();
  const hasPartner = hasUsableAccountabilityPartner(accountability);
  const selfUrge = attempt.source === "panic-button";
  const manualCheck = attempt.source === "manual-check";
  const interventionBody = interventionBodyForAttempt(attempt);
  const dnsSource = attempt.sourcePackage === "android-dns";
  const [feedbackSent, setFeedbackSent] = React.useState(false);
  const [grounded, setGrounded] = React.useState(false);
  const [holdingProgress, setHoldingProgress] = React.useState(0);
  const [showLocalGuide, setShowLocalGuide] = React.useState(false);
  const holdIntervalRef = React.useRef<any>(null);
  const pauseMotion = useMotionSettings();
  React.useEffect(() => {
    if (!pauseMotion.active) { if (holdIntervalRef.current) clearInterval(holdIntervalRef.current); setHoldingProgress(0); }
    return () => { if (holdIntervalRef.current) clearInterval(holdIntervalRef.current); };
  }, [pauseMotion.active]);

  React.useEffect(() => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setFeedbackSent(false);
    setGrounded(false);
    setHoldingProgress(0);
    setShowLocalGuide(false);
  }, [attempt.detectedAt, attempt.host]);

  const startHold = () => {
    if (grounded) return;
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldingProgress(0);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / 3000) * 100));
      setHoldingProgress(pct);
      if (pct >= 100) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        setGrounded(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      }
    }, 100);
  };

  const endHold = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    if (!grounded) setHoldingProgress(0);
  };

  return (
    <AppBackground>
      <View testID="intercept-safe-area" style={{ flex: 1, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={{ flexShrink: 0, flexDirection: "row", gap: 12, alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ShieldCheck color={colors.mint} size={18} />
              <Text style={{ flexShrink: 1, color: colors.mint, fontWeight: typography.bold, fontSize: 13 }}>
                {selfUrge || manualCheck ? "MINDFUL RESET" : "PROTECTION ENGAGED"}
              </Text>
            </View>
            <Pressable
              onPress={() => { tap(); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel="Close and return"
              style={{ minWidth: 44, minHeight: 44, borderRadius: 16, borderCurve: "continuous", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}
            >
              <X color={colors.text2} size={18} />
            </Pressable>
          </View>

          <ScrollView testID="intercept-content" style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}>
            <MomentumPageHeader pose="reassure" context="intercept" title="Pause. Breathe." description={interventionBody} translateDescription={!selfUrge && !manualCheck} category="calm" variant="calm" compact restrained />

            <Pressable
              onPressIn={startHold}
              onPressOut={endHold}
              accessibilityRole="button"
              accessibilityLabel={appI18n.t("intercept.optionalPause")}
              accessibilityHint={appI18n.t("intercept.pauseHint")}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <View style={{ padding: 16, gap: 8, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: colors.border, backgroundColor: grounded ? colors.accentTint : colors.surface }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Brain color={colors.mint} size={20} />
                  <Text style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.bold }}>
                    {grounded ? "Pause complete" : appI18n.t("intercept.optionalPause")}
                  </Text>
                </View>
                {!grounded && <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" }}><View style={{ width: `${holdingProgress}%`, height: "100%", backgroundColor: colors.mint }} /></View>}
                <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>
                  {grounded ? appI18n.t("intercept.pauseHint") : "Press & hold while you pause and breathe"}
                </Text>
              </View>
            </Pressable>

            <View style={{ padding: 16, gap: 12, borderRadius: 20, borderCurve: "continuous", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Pressable
                onPress={() => { tap(); setShowLocalGuide(!showLocalGuide); }}
                accessibilityRole="button"
                accessibilityLabel={appI18n.t("intercept.localGuide")}
                accessibilityState={{ expanded: showLocalGuide }}
                style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Brain color={colors.mint} size={18} />
                <Text translate={false} style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.bold }}>{appI18n.t("intercept.localGuide")}</Text>
                <ChevronRight color={colors.text3} size={18} style={{ transform: [{ rotate: showLocalGuide ? "90deg" : "0deg" }] }} />
              </Pressable>
              {showLocalGuide && (
                <View style={{ gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text translate={false} style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>{appI18n.t("intercept.localAttribution")}</Text>
                  <Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{appI18n.t("intercept.notice")}</Text>
                  <Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{appI18n.t("intercept.breathe")}</Text>
                  <Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{appI18n.t("intercept.nextStep")}</Text>
                </View>
              )}
            </View>

            {hasPartner && (
              <Card style={{ padding: 16, gap: 12 }} category="calm">
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <MessageCircleHeart color={colors.mint} size={24} />
                  <Text style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.bold }}>Message {accountability.name || "your partner"}</Text>
                </View>
                <PillButton label="Send" variant="ghost" onPress={onMessagePartner} />
              </Card>
            )}

            {dnsSource && onReportWrongBlock && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report this block as a mistake"
                disabled={feedbackSent}
                onPress={() => { setFeedbackSent(true); onReportWrongBlock(attempt.host, attempt.result.matchedRule, "android-dns"); }}
                style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 12, justifyContent: "center", opacity: feedbackSent ? 0.55 : 1 }}
              >
                <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 19 }}>{feedbackSent ? "Thanks — noted on this device" : "Blocked by mistake?"}</Text>
              </Pressable>
            )}

            {<PillButton label="Take a guided reset" variant="ghost" onPress={onSponsoredReset} />}
          </ScrollView>

          <View testID="intercept-actions" style={{ flexShrink: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(12, insets.bottom), gap: 8, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}>
            <PillButton label="Start free reset" onPress={onContinue} variant="primary" icon={<Play color={colors.onAccent} size={18} fill={colors.onAccent} />} />
            <PillButton label="Back to Safety" variant="ghost" onPress={onClose} icon={<ShieldCheck color={colors.mint} size={18} />} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </AppBackground>
  );
}

function interventionBodyForAttempt(attempt: BlockingAttempt) {
  const matchedRule = attempt.result.matchedRule;
  if (attempt.source === "panic-button") {
    return appI18n.t("intercept.supportRequested");
  }
  if (attempt.source === "manual-check") {
    return appI18n.t("intercept.manualCheck");
  }
  if (
    attempt.source === "app" ||
    matchedRule.startsWith("configured-app:") ||
    matchedRule.startsWith("short-form:") ||
    matchedRule.startsWith("ios-screen-time-shield")
  ) {
    return "FREED paused a selected app or short-form loop so you can take one recovery action before continuing.";
  }
  if (attempt.result.category === "adult-search-intent") {
    return "FREED caught an explicit search before it could turn into a scroll loop.";
  }
  if (attempt.result.category === "adult") {
    return "FREED blocked an explicit site before the page loaded.";
  }
  return "FREED paused this high-risk moment so you can take one recovery action now.";
}

async function openAppSettingsForPermission(setStatus: (message: string) => void, permissionName: string) {
  setStatus(`${permissionName} permission is needed here. Opening app settings now.`);
  try {
    await Linking.openSettings();
  } catch {
    setStatus(`${permissionName} permission is needed here. Open system settings for FREED and allow it, then return to the challenge.`);
  }
}

function deleteTemporaryChallengePhoto(uri: string) {
  try {
    const file = new ExpoFile(uri);
    if (file.exists) file.delete();
  } catch {
    // Best-effort privacy cleanup; verification must not fail because cache deletion failed.
  }
}

function ChallengeScreen({
  sessionController,
  profile,
  selected,
  onBack,
  onDiscard,
  onMessagePartner,
  onComplete,
  onFeedback,
  onRequestBreak,
  breakNotice,
  canRequestUnlock = false,
  rewardSeconds = null,
  scopedReward = false,
  rewardLabelForChallenge,
  onRewardTemplateChosen,
  onBeforeRewardTemplateChosen,
  earnedOffer,
  earnedBreakExpiresAt,
  onRetryEarnedResume,
  nativeEvidenceOwnerScope,
  nativeEvidenceIsCurrent,
  onNativeEvidence
}: {
  canRequestUnlock?: boolean;
  rewardSeconds?: 120 | 300 | 600 | 1200 | null;
  earnedOffer?: EarnedAppTimeOffer | null;
  earnedBreakExpiresAt?: string | null;
  onRetryEarnedResume?: () => void;
  nativeEvidenceOwnerScope?: string|null;
  nativeEvidenceIsCurrent?:()=>boolean;
  onNativeEvidence?:(receipt:EarnedChallengeEvidenceReceipt)=>void;
  scopedReward?: boolean;
  rewardLabelForChallenge?: (challenge: RecoveryChallenge) => string | null;
  onRewardTemplateChosen?: (sessionId: string, challenge: RecoveryChallenge) => void;
  onBeforeRewardTemplateChosen?: (challenge: RecoveryChallenge) => boolean;
  onRequestBreak: () => void;
  breakNotice?: string | null;
  sessionController: ReturnType<typeof useChallengeSession>;
  profile: {
    exportState?: RecoveryState;
    streakDays: number;
    premium: boolean;
    attemptsToday: number;
    mood: "low" | "steady" | "energized" | "stressed";
    slipsThisWeek: number;
    slipWindow: string;
    slipTrigger: string;
    interventionContext: InterventionContextSignal | null;
    disciplinePreferences: ChallengePreferenceSignal | null;
    contextSignals: ChallengeContextSignal | null;
    riskForecast: LocalUrgeRiskForecast | null;
    challengeHistory: ChallengeHistorySignal[];
    recentFailureCount: number;
    preferredCategories: RecoveryChallenge["category"][];
    customChallenges: RecoveryChallenge[];
  };
  selected?: RecoveryChallenge;
  onBack: () => void;
  onDiscard: () => void;
  onMessagePartner?: (challenge: RecoveryChallenge) => Promise<boolean>;
  onFeedback: (sessionId: string, outcome: ChallengeFeedbackOutcome) => boolean;
  onComplete: (challenge: RecoveryChallenge, outcome: ChallengeFeedbackOutcome, receipt: { id: string; completedAtMs: number }) => boolean;
}) {
  const { colors, gradients, typography } = useAppTheme();
  const [challenge, setChallenge] = React.useState<RecoveryChallenge | null>(sessionController.session?.challenge ?? null);
  const [choosingReplacement, setChoosingReplacement] = React.useState(false);
  const [capabilities, setCapabilities] = React.useState<ChallengeCapabilities | null>(null);
  const [capabilityRetry, setCapabilityRetry] = React.useState(0);
  const [sessionNotice, setSessionNotice] = React.useState<string | null>(null);
  const connectionToken = React.useRef<string | null>(null);
  const initialSelectionUsed = React.useRef(false);
  const nativeVerification=useEarnedChallengeEvidence({session:sessionController.session,offer:earnedOffer,ownerScope:nativeEvidenceOwnerScope,active:sessionController.running,isCurrent:nativeEvidenceIsCurrent,onReceipt:onNativeEvidence});
  React.useEffect(() => {
    if (!challenge && !choosingReplacement && sessionController.hydrated && sessionController.session?.phase === "paused") setChallenge(sessionController.session.challenge);
  }, [sessionController.hydrated, sessionController.session?.id, choosingReplacement]);
  React.useEffect(() => {
    let alive = true;
    const permission = (value: { status: string; canAskAgain?: boolean }, available: boolean) => ({ available, permission: value.status === "granted" ? "granted" as const : value.status === "denied" ? "denied" as const : "undetermined" as const, canAskAgain: value.canAskAgain === true });
    const refresh = async () => {
      const result = await readChallengeCapabilities({
        motion: async () => permission(await Accelerometer.getPermissionsAsync(), await Accelerometer.isAvailableAsync()),
        steps: async () => permission(await Pedometer.getPermissionsAsync(), await Pedometer.isAvailableAsync()),
        location: async () => permission(await Location.getForegroundPermissionsAsync(), await Location.hasServicesEnabledAsync()),
        photo: async () => { const photo = await getChallengePhotoCapabilities(); return { ...permission(await ImagePicker.getCameraPermissionsAsync(), photo.cameraAvailable && photo.classifierAvailable), validatedPhotoTargets: photo.validatedPhotoTargets }; },
        connection: async () => ({ available: true, permission: "granted", canAskAgain: false })
      });
      if (alive) setCapabilities(result);
    };
    void refresh();
    const listener = AppState.addEventListener("change", state => { if (state === "active") { void refresh(); if (connectionToken.current) sessionController.markConnectionReturned(connectionToken.current); } });
    return () => { alive = false; listener.remove(); };
  }, [sessionController.markConnectionReturned, capabilityRetry]);
  const chooseChallenge = async (item: RecoveryChallenge) => {
    if (earnedOffer && !captureEarnedResetTemplate(item)) { setSessionNotice(appI18n.t('earnedTime.unavailableActivity', { defaultValue: 'This activity does not earn app time. Your guided reset is still available.' })); return; }
    const nativeChoice=earnedOffer&&getEarnedResetNativeRequirement(item);
    if ((!nativeChoice&&(!capabilities || !getChallengeCapability(item, capabilities).eligible)) || (item.premium && !profile.premium)) { setSessionNotice("This reset is unavailable right now. Choose one of the alternatives below."); return; }
    if(nativeVerification.enabled&&!await nativeVerification.cancel()){setSessionNotice(nativeVerification.status);return;}
    if (onBeforeRewardTemplateChosen?.(item) === false) { setSessionNotice(appI18n.t('earnedTime.resumeSaveFailed', { defaultValue: 'Your guided access is kept. Free some storage and retry saving this reset.' })); return; }
    const saved = sessionController.session ? sessionController.replace(item, sessionController.session.id) : sessionController.start(item);
    if (!saved) { setSessionNotice("This reset could not be saved. Try again after checking storage."); return; }
    const started = sessionController.getSnapshot().session;
    if (started) onRewardTemplateChosen?.(started.id, item);
    setChoosingReplacement(false); setSessionNotice(null); setChallenge(item);
  };
  React.useEffect(() => {
    if (!initialSelectionUsed.current && selected && capabilities && sessionController.hydrated && !sessionController.session && !challenge) { initialSelectionUsed.current = true; chooseChallenge(selected); }
  }, [selected?.id, capabilities, sessionController.hydrated]);
  const [locationPermission, setLocationPermission] = React.useState<ChallengeContextSignal["locationPermission"]>("unknown");
  const [weatherContext, setWeatherContext] = React.useState<Pick<ChallengeContextSignal, "weatherCondition" | "temperatureC">>({
    weatherCondition: null,
    temperatureC: null
  });
  const challengeProfile = React.useMemo(
    () => {
      const now = new Date();
      const contextSignals: ChallengeContextSignal = {
        ...(profile.contextSignals ?? {
          energyLevel: null,
          urgeLevel: null,
          sleepQuality: null,
          weatherCondition: null,
          temperatureC: null
        }),
        locationPermission,
        weatherCondition: weatherContext.weatherCondition ?? profile.contextSignals?.weatherCondition ?? null,
        temperatureC: weatherContext.temperatureC ?? profile.contextSignals?.temperatureC ?? null
      };
      return {
        exportState: profile.exportState,
        streakDays: profile.streakDays,
        premium: profile.premium,
        attemptsToday: profile.attemptsToday,
        mood: profile.mood,
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        timezoneOffsetMinutes: now.getTimezoneOffset(),
        slipsThisWeek: profile.slipsThisWeek,
        slipWindow: profile.slipWindow,
        slipTrigger: profile.slipTrigger,
        interventionContext: profile.interventionContext,
        disciplinePreferences: profile.disciplinePreferences,
        contextSignals,
        riskForecast: profile.riskForecast,
        challengeHistory: profile.challengeHistory,
        recentFailureCount: profile.recentFailureCount,
        preferredCategories: profile.preferredCategories,
        customChallenges: profile.customChallenges
      };
    },
    [
      profile.exportState,
      profile.attemptsToday,
      profile.challengeHistory,
      profile.customChallenges,
      profile.contextSignals,
      profile.disciplinePreferences,
      profile.interventionContext,
      profile.mood,
      profile.preferredCategories,
      profile.premium,
      profile.riskForecast,
      profile.recentFailureCount,
      profile.slipTrigger,
      profile.slipWindow,
      profile.slipsThisWeek,
      profile.streakDays,
      locationPermission,
      weatherContext.temperatureC,
      weatherContext.weatherCondition
    ]
  );
  const [options, setOptions] = React.useState<RecoveryChallenge[]>(() => generateChallengeSet(challengeProfile));
  const seconds = sessionController.elapsedSec;
  const [done, setDone] = React.useState(false);
  const connectionActionComplete = sessionController.connectionStage === "confirmed";
  const completionSubmittedRef = React.useRef(false);
  const [completionSubmitting, setCompletionSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(async (response) => {
        const permission = permissionStatusToChallengeSignal(response.status);
        if (cancelled) return;
        setLocationPermission(permission);
        if (permission !== "granted") {
          setWeatherContext({ weatherCondition: null, temperatureC: null });
          return;
        }

        const weatherConfig = getChallengeWeatherContextConfig();
        if (!weatherConfig.enabled) {
          setWeatherContext({ weatherCondition: null, temperatureC: null });
          return;
        }

        try {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const weather = await fetchChallengeWeatherContext({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          }, fetch, weatherConfig);
          if (!cancelled) setWeatherContext(weather);
        } catch {
          if (!cancelled) setWeatherContext({ weatherCondition: null, temperatureC: null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocationPermission("unavailable");
          setWeatherContext({ weatherCondition: null, temperatureC: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectionKey = getChallengeSelectionKey(challengeProfile, capabilities);
  React.useEffect(() => {
    let cancelled = false;
    if (!capabilities) return;
    setOptions(selectCapableChallengeSet(generateChallengeSet(challengeProfile), capabilities, { premium: profile.premium }));


    return () => {
      cancelled = true;
    };
  }, [selectionKey]);

  React.useEffect(() => {
    connectionToken.current = null;
    completionSubmittedRef.current = false;
    setCompletionSubmitting(false);
  }, [sessionController.session?.id]);
  const submitChallengeOutcome = React.useCallback(
    async (completedChallenge: RecoveryChallenge, outcome: ChallengeFeedbackOutcome) => {
      if (completionSubmittedRef.current) return;
      const snapshot = sessionController.getSnapshot();
      if (!snapshot.session) return;
      if(snapshot.session.phase!=="completed"&&nativeVerification.enabled){
        completionSubmittedRef.current=true;setCompletionSubmitting(true);
        const native=await nativeVerification.finish();
        if(!native||!earnedOffer||!sessionController.claimNativeCompletion(native,earnedOffer,outcome,snapshot.session.id)){completionSubmittedRef.current=false;setCompletionSubmitting(false);setSessionNotice(nativeVerification.status);return;}
      } else if (snapshot.session.phase !== "completed" && !sessionController.claimCompletion(verification.evidence, outcome, snapshot.session.id)) { setSessionNotice("Finish verification and try saving the reset again."); return; }
      const receipt = sessionController.getSnapshot().session!;
      completionSubmittedRef.current = true;
      setCompletionSubmitting(true);
      const saved = onComplete(completedChallenge, receipt.completion!.outcome, { id: receipt.id, completedAtMs: receipt.completion!.completedAtMs });
      if (saved) { setDone(true); setCompletionSubmitting(false); setSessionNotice(null); }
      if (!saved) { completionSubmittedRef.current = false; setCompletionSubmitting(false); setSessionNotice("Reset could not be saved. Try saving again; your completion receipt is kept."); }
    },
    [onComplete, sessionController.claimCompletion, sessionController.claimNativeCompletion, sessionController.getSnapshot,nativeVerification,earnedOffer]
  );
  const basicVerification = useChallengeVerification(challenge, seconds, Boolean(challenge && !done && sessionController.running&&!nativeVerification.enabled), connectionActionComplete, sessionController.session?.id, sessionController.session?.evidence, done || sessionController.session?.phase === "completed");
  const verification=nativeVerification.enabled?{...basicVerification,status:nativeVerification.status,progress:nativeVerification.progress,satisfied:nativeVerification.satisfied,photoBusy:nativeVerification.busy,capturePhoto:nativeVerification.capturePhoto}:basicVerification;
  React.useEffect(() => { if (sessionController.session && sessionController.running&&!nativeVerification.enabled) sessionController.recordEvidence(verification.evidence, sessionController.session.id); }, [verification.evidence, sessionController.session?.id, sessionController.running, sessionController.recordEvidence,nativeVerification.enabled]);

  if (challenge && sessionController.session?.phase === "completed" && !done) {
    return <AppBackground><SafeAreaView style={{ flex: 1 }}><ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16 }}><Text>Your completed reset is ready to save.</Text>{breakNotice ? <InlineNotice tone="info" message={breakNotice} /> : null}{onRetryEarnedResume ? <PillButton label={appI18n.t('earnedTime.retryRestore', { defaultValue: 'Retry app-time check' })} onPress={onRetryEarnedResume} variant="ghost" /> : null}{sessionNotice ? <InlineNotice tone="error" message={sessionNotice} /> : null}<PillButton label="Save completed reset" onPress={() => submitChallengeOutcome(challenge, "unknown")} /><PillButton label="Back to safety" variant="ghost" onPress={onBack} /></ScrollView></SafeAreaView></AppBackground>;
  }

  if (!challenge) {
    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 24, gap: 16 }}>
            <View style={{ flexDirection: appI18n.language === "ar" ? "row-reverse" : "row", alignItems: "center", gap: 12 }}>
              <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: typography.bold, textAlign: appI18n.language === "ar" ? "right" : "left" }}>Pick one reset.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Back to safety" onPress={onBack} style={{ width: 44, height: 44, borderRadius: 16, borderCurve: "continuous", backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
              <X color={colors.text2} size={19} />
              </Pressable>
            </View>
            
            {sessionNotice || sessionController.storageError ? <InlineNotice tone="error" message={sessionNotice ?? sessionController.storageError!} /> : null}
            <ResetChoicePicker loading={!earnedOffer && !capabilities} onRetry={() => { setCapabilities(null); setCapabilityRetry(value => value + 1); onRetryEarnedResume?.(); }} onBack={onBack} showUnavailableFind={Boolean(earnedOffer)} choices={earnedOffer ? getEarnedResetChoices(earnedOffer, choosingReplacement ? sessionController.session?.challenge.id : undefined) : capabilities ? selectResetChoices(challengeProfile, capabilities,{excludeId:choosingReplacement?sessionController.session?.challenge.id:undefined}) : []} onChoose={chooseChallenge} rewardLabel={rewardLabelForChallenge} />
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  if (done) {
    const breakMinutes = rewardSeconds ? rewardSeconds / 60 : scopedReward ? null : profile.disciplinePreferences?.unlockDurationMinutes ?? 10;
    const showBreak = canRequestUnlock && breakMinutes !== null;
    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1 }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 24 }}>
          <Card gradient={gradients.mint} style={{ alignItems: "center", paddingVertical: 32 }} category="movement">
            <MomentumCompanion pose="listen" context="challenge-outcome" idle={false} variant="calm" width={120} height={120} interactive />
            <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy, marginTop: 16 }}>
              Challenge Complete
            </Text>
            <Text selectable style={{ color: colors.peach, fontSize: 18, fontWeight: typography.heavy, marginTop: 8 }}>
              {showBreak ? earnedOffer ? appI18n.t("earnedTime.breakAvailable", { defaultValue: "Your {{minutes}}-minute app break is ready to request.", minutes: breakMinutes }) : appI18n.t("resetReward.available", { defaultValue: "{{minutes}} min app break available on request", minutes: breakMinutes }) : appI18n.t("companion.poses.guide.helpTitle")}
            </Text>
            <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 22, marginTop: 12 }}>
              Your reset is complete. Choose what helps next.
            </Text>
          </Card>
          {sessionNotice || sessionController.storageError ? <InlineNotice tone="error" message={sessionNotice ?? sessionController.storageError!} /> : null}
          {breakNotice ? <InlineNotice tone="info" message={breakNotice} /> : null}
          {onRetryEarnedResume ? <PillButton label={appI18n.t('earnedTime.retryRestore', { defaultValue: 'Retry app-time check' })} onPress={onRetryEarnedResume} variant="ghost" /> : null}
          {earnedBreakExpiresAt ? <EarnedTimeCountdown expiresAt={earnedBreakExpiresAt} /> : null}
          {showBreak ? <PillButton label={earnedOffer ? appI18n.t("earnedTime.startBreak", { defaultValue: "Start my {{minutes}}-minute break", minutes: breakMinutes }) : appI18n.t("resetReward.use", { defaultValue: "Use app for {{minutes}} minutes", minutes: breakMinutes })} onPress={onRequestBreak} /> : null}
          <Text style={{ color: colors.text2 }}>Your completed activity is saved. How you feel is optional.</Text>
          <PillButton label="Urge Passed" onPress={() => { if (!onFeedback(sessionController.session!.id, "helped")) setSessionNotice("Feedback could not be saved. Try again."); }} variant="ghost" />
          <PillButton label="Still Need Support" onPress={() => { if (!onFeedback(sessionController.session!.id, "still-urging")) setSessionNotice("Feedback could not be saved. Try again."); }} variant="ghost" />
          <PillButton label="Skip feedback" onPress={() => { if (!onFeedback(sessionController.session!.id, "unknown")) setSessionNotice("Your reset is saved. Cleanup could not finish; try again."); }} variant="ghost" />
        </ScrollView></SafeAreaView>
      </AppBackground>
    );
  }

  const max = Math.max(1, challenge.durationSec);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentContainerStyle={{ padding: 24, gap: 20, flexGrow: 1 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <BackButton onPress={() => { sessionController.pause(); onBack(); }} label="Back" hint="Leaves this guided reset." />
            <PillButton label={appI18n.t('resetChoices.replace', { defaultValue: 'Choose a different reset' })} variant="ghost" onPress={() => { sessionController.pause(); setChoosingReplacement(true); setChallenge(null); }} />

          </View>

          <View style={{ gap: 8 }}>
            <ChallengeText custom={challenge.id.startsWith("custom-")} accessibilityRole="header" style={{ color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: typography.bold }}>{challenge.title}</ChallengeText>
            <ChallengeText custom={challenge.id.startsWith("custom-")} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{challenge.why}</ChallengeText>
          </View>
          <ChallengeActivityScene challenge={challenge} elapsedSec={seconds} running={sessionController.running} progress={verification.progress} status={verification.status} rewardLabel={rewardLabelForChallenge?.(challenge)} />
          <View style={{ gap: 12 }}>
            {challenge.steps.map((step, index) => (
              <View key={`${challenge.id}-${index}`} style={{ borderStartWidth: 2, borderStartColor: colors.border, paddingStart: 16 }}>
                <ChallengeText custom={challenge.id.startsWith("custom-")} selectable style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{step}</ChallengeText>
              </View>
            ))}
          </View>

          {verification.requirement && (
            <Card category="movement" title={"VERIFICATION"}>
              
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ShieldCheck color={verification.satisfied ? colors.mint : colors.sky} size={25} />
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
                    {verification.requirement.label}
                  </Text>
                  <Text selectable style={{ color: colors.text2, lineHeight: 24, marginTop: 4 }}>
                    {verification.status}
                  </Text>
                  <Text selectable style={{ color: colors.text3, marginTop: 4 }}>
                    {verification.progress}
                  </Text>
                  {nativeVerification.enabled&&nativeVerification.photoTargets?<Text translate={false} style={{color:colors.text2,lineHeight:24}}>{appI18n.t('earnedProof.photoTargets',{defaultValue:'Requested objects: {{targets}}',targets:nativeVerification.photoTargets})}</Text>:null}
                  {nativeVerification.enabled&&nativeVerification.nextPhoto?<Text translate={false} style={{color:colors.text2,lineHeight:24}}>{nativeVerification.nextPhoto}</Text>:null}
                  {nativeVerification.enabled&&nativeVerification.state==='unavailable'?<PillButton label={nativeVerification.repairLabel} variant="ghost" onPress={()=>{if(!sessionController.running)sessionController.resume();void nativeVerification.retry();}}/>:null}
                  {verification.requirement.kind === "photo" && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Take verification photo"
                      disabled={verification.photoBusy}
                      onPress={() => {
                        tap();
                        void verification.capturePhoto();
                      }}
                      style={{
                        alignSelf: "flex-start",
                        minHeight: 44,
                        borderRadius: 21,
                        paddingHorizontal: 16,
                        marginTop: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: verification.satisfied ? colors.accentTint : colors.accentTint,
                        opacity: verification.photoBusy ? 0.68 : 1
                      }}
                    >
                      {verification.photoBusy ? (
                        <ActivityIndicator color={colors.sky} size="small" />
                      ) : (
                        <Camera color={verification.satisfied ? colors.mint : colors.sky} size={18} />
                      )}
                      <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                        {verification.photoBusy ? "Checking" : verification.satisfied ? "Photo Verified" : "Take Photo"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </Card>
          )}

          {challenge.category === "connection" && (
            <PillButton
              label={onMessagePartner ? "Message partner" : "Reach out another way"}
              variant="ghost"
              onPress={() => {
                const token = sessionController.beginConnectionAction();
                if (!token) return;
                connectionToken.current = token;
                if (onMessagePartner) void onMessagePartner(challenge).then(opened => {
                  if (!opened) setSessionNotice("The message composer could not open. You can reach out another way and confirm when you return.");
                });
                else sessionController.markConnectionReturned(token);
              }}
              icon={<MessageCircleHeart color={colors.text2} size={19} />}
            />
          )}

          {challenge.category === "connection" && sessionController.connectionStage === "returned" ? <PillButton label="I reached out" variant="ghost" onPress={() => { if (connectionToken.current) sessionController.confirmConnectionAction(connectionToken.current); }} accessibilityHint="Records your confirmation. FREED cannot confirm message delivery." /> : null}
          {sessionNotice || sessionController.storageError ? <InlineNotice tone="error" message={sessionNotice ?? sessionController.storageError!} /> : null}
          {!sessionController.running && !done ? <PillButton label="Discard this guided reset" variant="ghost" onPress={()=>{void nativeVerification.cancel().then(accepted=>{if(accepted)onDiscard();else setSessionNotice(nativeVerification.status);});}} /> : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 8, backgroundColor: colors.bg }}>
          {sessionController.running&&!done?<PillButton label={appI18n.t('earnedProof.pause',{defaultValue:'Pause reset'})} variant="ghost" onPress={()=>sessionController.pause()}/>:null}
          {!sessionController.running && !done ? <PillButton label="Resume reset" onPress={() => {
            if ((!nativeVerification.enabled&&(!capabilities || !getChallengeCapability(challenge, capabilities).eligible)) || (challenge.premium && !profile.premium)) { setSessionNotice("This reset is unavailable. Choose another reset."); return; }
            if (!sessionController.resume()) setSessionNotice("Reset progress could not resume. Try again."); else setSessionNotice(null);
          }} /> : null}
          <PillButton
            label={verification.satisfied ? "I'm Done" : seconds >= max ? "Verify Action" : appI18n.t("resetChoices.continue")}
            disabled={!verification.satisfied || verification.photoBusy || completionSubmitting}
            variant="success"
            onPress={() => submitChallengeOutcome(challenge, "unknown")}
          />
        </View>
      </SafeAreaView>
    </AppBackground>
  );
}

type BreathingMode = "478" | "box" | "sigh";

function ProfileScreen({ focus, section, recoveryState, premium, premiumCapabilities, streakDays, bestStreakDays, attempts, relapseCount, reminders, smartReminderSuggestion, retentionPlan, accountability, supportCircle, reminderBusy, analyticsSharing, analyticsSharingReadiness, analyticsSendBusy, analyticsSendMessage, onEnableAnalyticsSharing, onDisableAnalyticsSharing, onSendAnalyticsSnapshot, onReminderChange, onReminderRepair, onReminderTest, reminderTestMessage, reminderStateReadable = true, onAccountabilityChange, onSendSponsorReport, onSendSupportCircleReport, onSupportCircleChange, onSupportCircleRemove, onRestoreBackup, onDeleteLocalData, onDeleteAccountAndData, onManagePlan, onLogSlip, onOpenShield, pendingFirebaseEmailLink, onPendingFirebaseEmailLinkHandled, onConnectAccount, onSignOut, onAutomaticBackupChange, accountNotice, onPersonalize, ownerId, onExportFile, onImportFile, onDownloadTextBackup, unclaimedHistory, onAdoptHistory, signingOut = false, adPrivacyRequired = false, adPrivacyBusy = false, adPrivacyNotice, onAdPrivacyOptions }: {
  adPrivacyRequired?: boolean; adPrivacyBusy?: boolean; adPrivacyNotice?: string | null; onAdPrivacyOptions?: () => void;
  focus?: string; section?: FreedProfileSection; recoveryState: RecoveryState; premium: boolean; premiumCapabilities: PremiumCapabilitySet; streakDays: number; bestStreakDays: number; attempts: BlockingAttempt[]; relapseCount: number;
  reminders: ReminderPreferences; smartReminderSuggestion: SmartReminderSuggestion; retentionPlan: RetentionPlan; accountability: AccountabilityPartner; supportCircle: SupportCircleMember[]; reminderBusy: boolean;
  analyticsSharing?: AnalyticsSharingSettings; analyticsSharingReadiness?: AnalyticsSharingReadiness; analyticsSendBusy?: boolean; analyticsSendMessage?: string | null; onEnableAnalyticsSharing?: () => void; onDisableAnalyticsSharing?: () => void; onSendAnalyticsSnapshot?: () => void;
  onReminderChange: (update: ReminderPreferenceUpdate) => void; onReminderRepair?: () => Promise<unknown> | void; onReminderTest?: () => Promise<unknown> | void; reminderTestMessage?: string | null; reminderStateReadable?: boolean; onAccountabilityChange: (update: Partial<AccountabilityPartner>) => void; onSendSponsorReport: () => void; onSendSupportCircleReport: (memberId: string) => void;
  onSupportCircleChange: (memberId: string, update: Partial<Omit<SupportCircleMember, "id" | "updatedAt" | "lastContactedAt">>) => void; onSupportCircleRemove: (memberId: string) => void;
  onRestoreBackup: (state: RecoveryState) => void; onDeleteLocalData: () => Promise<void> | void; onDeleteAccountAndData: () => Promise<FirebaseAccountDeletionResult>; onManagePlan: () => void; onLogSlip: () => void; onOpenShield: () => void; pendingFirebaseEmailLink: string | null; onPendingFirebaseEmailLinkHandled: () => void;
  onConnectAccount: () => void; onSignOut: () => Promise<void>; onAutomaticBackupChange: (enabled: boolean, passphrase: string) => Promise<void>; accountNotice: string | null; onPersonalize: () => void;
  ownerId?: string | null; onExportFile?: (passphrase: string) => Promise<void>; onImportFile?: (passphrase: string) => Promise<boolean>;
  onDownloadTextBackup?: (passphrase: string) => Promise<void>;
  unclaimedHistory?: boolean; onAdoptHistory?: () => void; signingOut?: boolean;
}) {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const bottomPadding = useMomentumBottomPadding();
  const account = getFirebaseAccountSummary();
  const membership = getMembershipSummary(recoveryState.premiumEntitlement, Date.now(), getFirebaseAccountScope());
  const membershipLabels = {
    active: 'Verified Premium access', expired: 'Verified access ended', revoked: 'Premium access revoked', inactive: 'Premium access inactive',
    'verification-required': 'Connect the owning account to verify Premium', none: 'Monthly or yearly · same features'
  };
  const membershipDetail = appI18n.t(`momentum.membership.${membership.state}`, { defaultValue: membershipLabels[membership.state] });
  const page = section ?? parseFreedProfileSection(focus) ?? undefined;
  const [helpNotice, setHelpNotice] = React.useState<string | null>(null);
  const copy = (key: string, defaultValue: string) => t(`momentum.profileSettings.${key}`, { defaultValue });
  const title = (destination: FreedProfileSection) => copy(`sections.${destination}`, freedProfileSectionTitle(destination));
  const open = (destination: FreedProfileSection) => router.push(freedProfileSectionPath(destination));
  const row = (destination: FreedProfileSection, detail: string, Icon: typeof Shield) => <ProfileAction key={destination} label={title(destination)} detail={detail} onPress={() => open(destination)} Icon={Icon} testID={`profile-open-${destination}`} />;
  const accessThrough = membership.accessThrough ? appI18n.t('momentum.membership.accessThrough', { defaultValue: 'Access through {{date}}', date: new Date(membership.accessThrough).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric', ...(i18n.language === 'ar' ? { numberingSystem: 'arab' } : {}) }) }) : null;
  const notice = accountNotice ? <Text translate={false} testID="profile-account-notice" accessibilityLiveRegion="polite" style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{translateSource(accountNotice)}</Text> : null;
  const accountControls =
    <Card category="reflection" title={"Sign-in"}>
      <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24, marginTop: 8 }}>{account.signedIn && !account.anonymous ? "Link another provider or manage this account." : account.anonymous ? "Connect an account to make your guest purchases recoverable." : "Connect Apple, Google or email whenever you are ready."}</Text>
      {account.providers.length ? <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, marginTop: 8 }}>{account.providers.map(provider => provider === "google.com" ? "Google" : provider === "apple.com" ? "Apple" : provider === "password" ? "Email" : provider).join(" · ")}</Text> : null}
      <View style={{ gap: 12, marginTop: 16 }}><PillButton label={account.signedIn && !account.anonymous ? "Link another sign-in" : "Connect Apple, Google or email"} variant="ghost" onPress={onConnectAccount} disabled={signingOut} />{account.signedIn ? <PillButton label={signingOut ? 'Signing out…' : account.anonymous ? "Sign out of guest account" : "Sign out"} variant="ghost" disabled={signingOut} onPress={() => { void onSignOut(); }} /> : null}</View>
      {accountNotice ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text2, marginTop: 12, lineHeight: 22 }}>{accountNotice}</Text> : null}
    </Card>;

  return <ScrollView testID={`profile-page-${page ?? 'root'}`} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingBottom: bottomPadding, gap: 24 }}>
    {!page ? <MomentumPageHeader pose="secure" context="profile" title={account.signedIn && !account.anonymous ? "Your FREED account" : "Your space"} description={appI18n.t("uiRefinement.privacy")} category="reflection" variant="progress" compact /> : null}
    {(!page || page === 'account' || page === 'membership') ? <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', padding: 16, gap: 8 }}>
      {account.email ? <Text translate={false} selectable style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{account.email}</Text> : null}
      <Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{membershipDetail}</Text>
      {accessThrough ? <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{accessThrough}</Text> : null}
      {page === 'membership' && accessThrough ? <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{appI18n.t('momentum.membership.renewalUnknown', { defaultValue: 'Check your store for renewal and cancellation details.' })}</Text> : null}
      {page !== 'account' ? notice : null}
    </View> : notice}
    {!page ? <ProfileGroup>
      {row('routine', copy('routineDetail', 'Practices, reminders and personal suggestions'), Calendar)}
      {row('support-tools', copy('supportDetail', 'Trusted contacts and help when you need it'), Users)}
      {row('settings', copy('settingsDetail', 'Account, membership and app preferences'), Settings)}
      {row('data-privacy', copy('dataDetail', 'Encrypted backup, consent and deletion'), Lock)}
    </ProfileGroup> : null}
    {page === 'settings' ? <>
      <ProfileGroup>
        {row('account', copy('accountDetail', 'Connected sign-ins and sign out'), Users)}
        {row('membership', membershipDetail, Sparkles)}
      </ProfileGroup>
      <ProfileGroup>
        <ProfileAction label={copy('appPreferences', 'App preferences')} detail={copy('preferencesDetail', 'Language, appearance and companion motion')} onPress={() => router.push('/preferences')} Icon={Settings} testID="profile-open-preferences" />
        {row('reminders', copy('notificationsDetail', 'Timing, permission and daily prompts'), Bell)}
      </ProfileGroup>
      <ProfileGroup>
        {row('data-privacy', copy('dataDetail', 'Encrypted backup, consent and deletion'), Lock)}
        {row('help-about', copy('helpDetail', 'Support, legal information and app version'), LifeBuoy)}
      </ProfileGroup>
      {account.signedIn ? <Pressable testID="settings-sign-out" accessibilityRole="button" disabled={signingOut} accessibilityState={{ disabled: signingOut, busy: signingOut }} onPress={() => { if (!signingOut) void onSignOut(); }} style={{ minHeight: 52, paddingVertical: 12, justifyContent: 'center', opacity: signingOut ? .4 : 1 }}><Text style={{ color: colors.red, fontSize: 17, fontWeight: '700' }}>{signingOut ? 'Signing out…' : 'Sign out'}</Text></Pressable> : null}
    </> : null}
    {page === 'account' ? <>{accountControls}{unclaimedHistory && onAdoptHistory ? <Card title="Unclaimed history on this device"><Text style={{ color: colors.text2, lineHeight: 24 }}>This older history has no verified account owner. Choose explicitly whether to keep it for this account. Membership and protection permissions are checked separately.</Text><PillButton label="Review local history adoption" variant="ghost" onPress={onAdoptHistory} /></Card> : null}<ProfileGroup><ProfileAction label="Delete account" detail="Confirm deletion of this account and its private data" Icon={Users}
      testID="profile-delete-account" onPress={() => router.push('/account-deletion')} /></ProfileGroup></> : null}
    {page === 'membership' ? <ProfileGroup><ProfileAction label="Manage membership" detail={copy('membershipActionDetail', 'View plans, restore purchases or manage access')} onPress={onManagePlan} Icon={Sparkles} testID="profile-manage-membership" /></ProfileGroup> : null}
    {page === 'routine' ? <>
      <RetentionPlanCard plan={retentionPlan} />
      <ProfileGroup>
        <ProfileAction label="Personalize my suggestions" detail="Optional goals and preferred resets" onPress={onPersonalize} Icon={Target} />
        {row('reminders', copy('notificationsDetail', 'Timing, permission and daily prompts'), Bell)}
        <ProfileAction label="Log Slip Safely" detail={copy('historyDetail', 'A private reflection without losing your history')} onPress={onLogSlip} Icon={NotebookPen} />
      </ProfileGroup>
    </> : null}
    {page === 'support-tools' ? <ProfileGroup>
      {row('accountability', copy('accountabilityDetail', 'Trusted contacts and support-circle reports'), Users)}
      {row('help-about', copy('helpDetail', 'Support, legal information and app version'), LifeBuoy)}
      <ProfileAction label="Open Protect" detail="Protection, selected apps and schedules" onPress={onOpenShield} Icon={Shield} />
    </ProfileGroup> : null}
    {page === 'data-privacy' ? <ProfileGroup>
      {adPrivacyRequired && onAdPrivacyOptions ? <ProfileAction label={copy('adPrivacyOptions', 'Ad privacy options')} detail={copy('adPrivacyDetail', 'Review advertising privacy choices')} Icon={FileLock} testID="profile-ad-privacy-options" disabled={adPrivacyBusy} busy={adPrivacyBusy} onPress={() => { if (!adPrivacyBusy) onAdPrivacyOptions(); }} /> : null}
      {adPrivacyNotice ? <Text translate={false} accessibilityRole="alert" style={{ color: colors.text2 }}>{adPrivacyNotice}</Text> : null}
      {row('backup', copy('backupDetail', 'Export, restore and optional encrypted sync'), Lock)}
      {row('privacy', copy('privacyDetail', 'Consent, privacy and deletion controls'), FileLock)}
      <ProfileAction label="Delete account" detail="Confirm deletion of this account and its private data" Icon={Users}
        testID="privacy-delete-account" onPress={() => router.push('/account-deletion')} />
      <ProfileAction label="Analytics sharing" detail={copy('analyticsConsentDetail', 'Review optional aggregate sharing')} onPress={() => open('analytics-consent')} Icon={BarChart3} testID="profile-open-analytics-consent" />
      <ProfileAction label={copy('cloudChatConsent', 'Cloud chat consent')} detail={copy('cloudChatConsentDetail', 'Review optional CLARA cloud chat')} onPress={() => router.push('/flow/coach')} Icon={LifeBuoy} testID="profile-open-cloud-consent" />
    </ProfileGroup> : null}
    {page === 'analytics-consent' ? <AnalyticsConsentCard sharing={analyticsSharing ?? recoveryState.analyticsSharing} readiness={analyticsSharingReadiness ?? { ready: false, gaps: [] }} busy={analyticsSendBusy} message={analyticsSendMessage} onEnable={onEnableAnalyticsSharing} onDisable={onDisableAnalyticsSharing} onSend={onSendAnalyticsSnapshot} /> : null}
    {page === 'backup' ? onExportFile && onImportFile ? <JournalBackupFiles ownerId={ownerId ?? null} automaticEnabled={recoveryState.automaticBackupEnabled} onExport={onExportFile} onImport={onImportFile} onDownload={onDownloadTextBackup} onAutomaticChange={onAutomaticBackupChange} onConnect={onConnectAccount} /> : <RecoveryBackupCard recoveryState={recoveryState} onRestore={onRestoreBackup} onAutomaticBackupChange={onAutomaticBackupChange} pendingFirebaseEmailLink={pendingFirebaseEmailLink} onPendingFirebaseEmailLinkHandled={onPendingFirebaseEmailLinkHandled} /> : null}
    {page === 'reminders' ? <ReminderSettingsCard reminders={reminders} busy={reminderBusy} smartSuggestion={smartReminderSuggestion} onChange={onReminderChange} onRepair={onReminderRepair} onTest={onReminderTest} testMessage={reminderTestMessage} readable={reminderStateReadable} /> : null}
    {page === 'accountability' ? <AccountabilitySettingsCard partner={accountability} supportCircle={supportCircle} recoveryState={recoveryState} canSendSponsorReport={premiumCapabilities.sponsorAccountability} canUseSupportCircle={premiumCapabilities.familySupport || premiumCapabilities.sponsorAccountability} onSendReport={onSendSponsorReport} onSendSupportCircleReport={onSendSupportCircleReport} onManagePlan={onManagePlan} onSupportCircleChange={onSupportCircleChange} onSupportCircleRemove={onSupportCircleRemove} onChange={onAccountabilityChange} /> : null}
    {page === 'privacy' ? <PrivacySupportCard onDeleteLocalData={onDeleteLocalData} onDeleteAccountAndData={onDeleteAccountAndData} /> : null}
    {page === 'help-about' ? <>
      <ProfileGroup>
        <ProfileAction label="Support" detail={copy('contactHelp', 'Help with FREED and your account')} onPress={() => router.push('/support')} Icon={LifeBuoy} />
        <ProfileAction label="Privacy Policy" detail={copy('privacyPolicyDetail', 'How FREED handles your information')} onPress={() => router.push('/privacy')} Icon={FileLock} />
        <ProfileAction label="Terms of Service" detail={copy('termsDetail', 'Read the terms for using FREED')} onPress={() => { void Linking.openURL("https://freed-landing.web.app/terms").catch(() => setHelpNotice(copy('legalUnavailable', 'The terms could not open. Try again.'))); }} Icon={FileLock} />
        <ProfileAction label="Account Deletion Help" detail={copy('deletionHelpDetail', 'Steps for an account deletion request')} onPress={() => router.push('/account-deletion')} Icon={Users} />
      </ProfileGroup>
      {helpNotice ? <Text translate={false} accessibilityRole="alert" style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{helpNotice}</Text> : null}
      {Constants.nativeAppVersion ?? Constants.expoConfig?.version ? <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{copy('version', 'Version')} {Constants.nativeAppVersion ?? Constants.expoConfig?.version}{Constants.nativeBuildVersion ? ` (${Constants.nativeBuildVersion})` : ''}</Text> : null}
    </> : null}
  </ScrollView>;
}

function ProfileGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' }}>{children}</View>;
}

function ProfileAction({ label, detail, onPress, Icon, testID, disabled = false, busy = false }: { label: string; detail: string; onPress: () => void; Icon: typeof Shield; testID?: string; disabled?: boolean; busy?: boolean }) {
  const { colors } = useAppTheme();
  const { i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  return <Pressable translate={false} testID={testID} accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled, busy }} accessibilityLabel={translateSource(label)} accessibilityHint={translateSource(detail)} onPress={onPress} style={({ pressed }) => ({ padding: 16, minHeight: 64, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.surface2 : colors.surface })}>
    <Icon size={22} color={colors.text2} /><View style={{ flex: 1, gap: 4 }}><Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }}>{translateSource(label)}</Text><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }}>{translateSource(detail)}</Text></View><ChevronRight size={18} color={colors.text2} />
  </Pressable>;
}

const ADULT_FEED_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

type FreedAppContextValue = {
  renderScreen: (screen: Screen, tab: Tab, shieldSection?: FreedShieldSection, featureId?: string, profileSection?: FreedProfileSection) => React.ReactNode;
  startPanicIntervention: () => void;
  abandonActiveProtectionFlow: () => void;
  authSnapshot: JourneyAuthSnapshot;
  membershipSnapshot: JourneyMembershipSnapshot;
  reviewAccessSnapshot: ReviewAccessSnapshot | null;
  renderAccountDeletion: () => React.ReactNode;
};
const FreedAppContext = React.createContext<FreedAppContextValue | null>(null);
export function useFreedAppController() {
  const controller = React.useContext(FreedAppContext);
  if (!controller) throw new Error("FREED screens need the shared application controller.");
  return controller;
}
export function FreedRoute({ screen, tab = "today", shieldSection, featureId, profileSection }: { screen: Screen; tab?: Tab; shieldSection?: FreedShieldSection; featureId?: string; profileSection?: FreedProfileSection }) {
  return <View testID={screen === "main" ? `screen-main-${tab}${shieldSection ? `-${shieldSection}` : profileSection ? `-${profileSection}` : ""}` : `screen-${screen}`} collapsable={false} accessible={false} style={{ flex: 1 }}>{useFreedAppController().renderScreen(screen, tab, shieldSection, featureId, profileSection)}</View>;
}

export function FreedAppProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => { cleanupAbandonedChallengePhotos(); }, []);
  const [publicBasicHelp, setPublicBasicHelp] = React.useState(false);
  const { colors, gradients, typography } = useAppTheme();
  const { width } = useWindowDimensions();
  const journeyAuth = React.useSyncExternalStore(subscribeFirebaseAuthSnapshot, getFirebaseAuthSnapshot, getFirebaseAuthSnapshot);
  const nativeAccountSnapshot = React.useSyncExternalStore(subscribeFirebaseNativeAccountSession, getFirebaseNativeAccountSessionSnapshot, getFirebaseNativeAccountSessionSnapshot);
  const journeyOwner = trustedPrivateOwner(journeyAuth, getFirebaseAccountScope());
  const [privateViewLocked, setPrivateViewLocked] = React.useState(false);
  const privateCleanupOwner = React.useRef<string | null>(null);
  const [accountCleanupReceiptCache, setAccountCleanupReceiptCache] = React.useState<AccountDeletionReceipt | null>(null);
  const [cleanupCompletionToken, setCleanupCompletionToken] = React.useState<{ ownerUid: string; eventId: string } | null>(null);
  const accountCleanupReceipt = readConfirmedAccountCleanupReceipt(localStorage, journeyAuth, getFirebaseAccountScope(), accountCleanupReceiptCache);
  const privateLockedRef = React.useRef(privateViewLocked); privateLockedRef.current = privateViewLocked;
  const readPrivateOwner = () => {
    if (privateLockedRef.current) return null;
    const owner = getJourneyOwner(getFirebaseAuthSnapshot());
    return owner && getFirebaseAccountScope() === owner ? owner : null;
  };
  const { state: recoveryState, setRecoveryState, persistRecoveryState, hydrated, storageError, storageReady, retryRecoveryStateRead, rollbackPending, ownerCleanupPending, ownerStore, ownerLease,
    unclaimedLegacy, ownsLegacy, adoptLegacy, suspendOwner, resumeOwner } = usePersistentRecoveryState({ ownerId: privateViewLocked ? null : journeyOwner,
      readOwner: readPrivateOwner, authReady: journeyAuth.status !== 'hydrating', cleanupOwnerId: accountCleanupReceipt?.ownerUid ?? null });
  const showAccountCleanupRecovery = Boolean(accountCleanupReceipt && (accountCleanupReceipt.local !== 'completed' || ownerCleanupPending === 'account' ||
    (cleanupCompletionToken?.ownerUid === accountCleanupReceipt.ownerUid && cleanupCompletionToken.eventId === accountCleanupReceipt.eventId)));
  const privateDraftStorage = React.useMemo(() => createOwnerPrivateDraftStorage(localStorage, journeyOwner,
    () => !privateLockedRef.current && getJourneyOwner(getFirebaseAuthSnapshot()) === journeyOwner && getFirebaseAccountScope() === journeyOwner), [journeyOwner, privateViewLocked]);
  const journalResources = React.useRef<{ owner: string | null; repository: JournalRepository | null; media: JournalMediaStore | null; error: string | null }>({ owner: null, repository: null, media: null, error: null });
  const [journalRevision, refreshJournal] = React.useState(0);
  const [journalReaderRequest, setJournalReaderRequest] = React.useState<{ owner: string; entryId: string } | null>(null);
  if (journalResources.current.owner !== (privateViewLocked ? null : journeyOwner) || (journalResources.current.repository && !journalResources.current.repository.isActive())) {
    const old = journalResources.current;
    old.repository?.revoke();
    if (old.owner && old.media) {
      old.media.bindOwnerReferences(old.owner, () => createJournalRepository({ storage: localStorage, ownerId: old.owner! }).referencedFileNames());
      void old.media.cancelOwner(old.owner).catch(() => undefined);
    }
    const owner = privateViewLocked ? null : journeyOwner;
    try {
      const repository = owner ? createJournalRepository({ storage: localStorage, ownerId: owner }) : null;
      const media = old.media ?? createJournalMediaRuntime();
      if (owner && repository && media) media.bindOwnerReferences(owner, () => repository.referencedFileNames());
      journalResources.current = { owner, repository, media, error: null };
    } catch { journalResources.current = { owner, repository: null, media: old.media, error: 'Your journal could not be opened. Its saved data was kept. Try again.' }; }
  }
  const journalRepository = journalResources.current.repository, journalMedia = journalResources.current.media;
  const journalOwnerError = journalResources.current.error;
  const journalChanged = React.useCallback(() => { if (getFirebaseAccountScope() === journalResources.current.owner) refreshJournal(value => value + 1); }, []);
  const journalHistory = React.useMemo(() => { try { return journalRepository?.exportArchiveState() ?? { entries: [], processedSources: [], deletedLegacySources: [] }; }
    catch { return { entries: [], processedSources: [], deletedLegacySources: [] }; } }, [journalRepository, journalRevision, ownerLease, rollbackPending]);
  const legacyJournalNotes = React.useMemo(() => journeyOwner && !privateViewLocked && ownerLease?.ownerUid === journeyOwner ? recoveryState.dailyCheckIns : [], [journeyOwner, privateViewLocked, ownerLease, recoveryState.dailyCheckIns]);
  const journalLegacyDraft = React.useMemo<JournalLegacyDraft | undefined>(() => {
    if (!ownsLegacy || privateViewLocked) return undefined;
    try { const raw = localStorage.getItem('freed.recovery.draft.journal.v1'); if (!raw) return undefined;
      const data = JSON.parse(raw); return data?.kind === 'journal' && typeof data.dateKey === 'string' && typeof data.value?.reflection === 'string'
        ? { sourceId: `legacy-journal:${data.dateKey}`, dateKey: data.dateKey, text: data.value.reflection } : undefined;
    } catch { return undefined; }
  }, [ownsLegacy, privateViewLocked, journeyOwner]);
  const openJournalBackup = () => { setTab('profile'); router.push(freedProfileSectionPath('backup')); };
  const [companionCue, setCompanionCue] = React.useState<CompanionCue | undefined>();
  const lastCueState = React.useRef<RecoveryState | null>(null);
  React.useEffect(() => {
    if (!hydrated) return;
    const cue = getRecoveryCompanionCue(lastCueState.current, recoveryState);
    lastCueState.current = recoveryState;
    if (cue) setCompanionCue(cue);
  }, [hydrated, recoveryState]);
  const { screen, profileSection: currentProfileSection, auxiliaryRoute, deferredAuxiliaryRoute, deferAuxiliaryPresentation, resumeAuxiliaryPresentation, tab, setScreen: setNavigationScreen, replaceFeature, returnProfileSection, setTab, backFromTool } = useFreedNavigation();
  const recoveryEntryPresentation = React.useRef(createRecoveryEntryPresentation());
  recoveryEntryPresentation.current.reconcile(journeyOwner, ownerLease, screen);
  const setScreen = React.useCallback((next: Screen) => {
    recoveryEntryPresentation.current.requestScreen(next);
    setNavigationScreen(next);
  }, [setNavigationScreen]);
  const guidedRouteParams = useGlobalSearchParams<{ feature?: string; groupId?: string; create?: string; section?: string }>();
  const guidedRouteFeature = screen === "feature" ? parseFeatureId(guidedRouteParams.feature) : null;
  const [pendingFirebaseEmailLink, setPendingFirebaseEmailLink] = React.useState<string | null>(null);
  const journeyOfferStore = React.useRef(createOfferDecisionStore({
    getItem: key => typeof localStorage === "undefined" ? null : localStorage.getItem(key),
    setItem: (key, value) => { if (typeof localStorage === "undefined") throw new Error("Local storage unavailable"); localStorage.setItem(key, value); }
  }));
  const [journeyOfferRevision, refreshJourneyOffer] = React.useState(0);
  const [journeyMembership, setJourneyMembership] = React.useState<JourneyMembershipSnapshot>({ ownerUid: null, status: "unavailable" });
  const membershipOwnerChecked = journeyMembership.status !== "checking" ? journeyMembership.ownerUid : null;
  const [journeyRecoverySaveNotice, setJourneyRecoverySaveNotice] = React.useState<string | null>(null);
  const [journeyOfferSaveNotice, setJourneyOfferSaveNotice] = React.useState<{ ownerUid: string; message: string } | null>(null);
  const [quizIndex, setQuizIndex] = React.useState(0);
  const [activeAttempt, setActiveAttempt] = React.useState<NativeInterventionAttempt | null>(null);
  const [challengeBreakNotice, setChallengeBreakNotice] = React.useState<string | null>(null);
  const [basicHelpContext, setBasicHelpContext] = React.useState<string | null>(null);
  const activeAttemptRef = React.useRef(activeAttempt); activeAttemptRef.current = activeAttempt;
  const [selectedChallenge, setSelectedChallenge] = React.useState<RecoveryChallenge | null>(null);
  const [selectedArticle, setSelectedArticle] = React.useState<LibraryArticle | null>(null);
  const [protectionCapability, setProtectionCapability] = React.useState<ProtectionCapability | null>(null);
  const protectionReadback = React.useRef(createProtectionRefreshCoordinator<ProtectionRefreshResult>({ capability: null, status: null }));
  const protectionReadRevision = React.useSyncExternalStore(protectionReadback.current.subscribe, protectionReadback.current.getReadRevision, protectionReadback.current.getReadRevision);
  const [protectionStatus, setProtectionStatusRaw] = React.useState<ProtectionStatus | null>(null);
  const setProtectionStatus = React.useCallback((status: ProtectionStatus | null) => {
    protectionReadback.current.publishNative({ ...protectionReadback.current.getSnapshot(), status });
    setProtectionStatusRaw(status);
  }, []);
  const [protectionRefreshCompleted, setProtectionRefreshCompleted] = React.useState(false);
  const [protectionSyncMessage, setProtectionSyncMessage] = React.useState<string | null>(null);
  const adultDnsControl = useEncryptedDns();
  const [adultToggleBusy, setAdultToggleBusy] = React.useState(false);
  const adultToggleRequest = React.useRef(0);
  const adultToggleRunning = React.useRef(false);
  const [websiteActivationRequest, setWebsiteActivationRequest] = React.useState<{ id: number; scope: string } | null>(null);
  React.useEffect(() => { if (screen !== 'protectionSetup') setWebsiteActivationRequest(null); }, [screen]);
  const [protectionIntent, setProtectionIntentState] = React.useState<ProtectionIntent>(() => typeof localStorage === "undefined" ? "both" : getStoredProtectionIntent(localStorage));
  const setProtectionIntent = (intent: ProtectionIntent) => { setProtectionIntentState(intent); try { storeProtectionIntent(localStorage, intent); } catch { setProtectionSyncMessage("Setup choice could not be kept for a settings return. Recovery tools remain available."); } };
  const [appSelectionReturnToProtectionSetup, setAppSelectionReturnToProtectionSetup] = React.useState(false);
  const reminderController = useRecoveryReminders({ ownerId: privateViewLocked ? null : journeyOwner, hydrated, recoveryState, setRecoveryState, persistRecoveryState, storageReady, storageError, retryStorageRead: retryRecoveryStateRead });
  const reminderBusy = reminderController.busy;
  const [purchaseBusy, setPurchaseBusy] = React.useState(false);
  const [purchaseNotice, setPurchaseNotice] = React.useState<string | null>(null);
  const [analyticsSendBusy, setAnalyticsSendBusy] = React.useState(false);
  const analyticsBusyRef = React.useRef(false);
  const [analyticsSendMessage, setAnalyticsSendMessage] = React.useState<string | null>(null);
  const [unlockClockMs, setUnlockClockMs] = React.useState(Date.now());
  const [accountReturnToProfile, setAccountReturnToProfile] = React.useState(false);
  const accountFlowFence = React.useRef(createAccountFlowFence());
  const accountHostGeneration = React.useRef(0);
  const [accountFlowRevision, refreshAccountFlow] = React.useState(0);
  const beginAccountFlow = (): AccountFlowControl => {
    const wasActive = accountFlowFence.current.isActive();
    const control = accountFlowFence.current.begin();
    if (!wasActive) { retireFirebaseNativeAccountSession('native-account-flow'); refreshAccountFlow(value => value + 1); }
    return { isCurrent: control.isCurrent, complete: () => {
      if (!control.complete()) return false;
      void reconcileFirebaseNativeAccountSession();
      refreshAccountFlow(value => value + 1);
      return true;
    } };
  };
  const enterAccountFlow = () => {
    // Explicit entry creates a fresh presentation even when close and reopen
    // are batched. Widget interaction itself keeps the already mounted host.
    if (!accountFlowFence.current.isActive()) accountHostGeneration.current += 1;
    return beginAccountFlow();
  };
  const [accountNotice, setAccountNotice] = React.useState<string | null>(null);
  const deletionContinuation = React.useRef<{ expectedUid: string; resolve: (result: FirebaseAccountDeletionResult) => void; reject: (error: Error) => void } | null>(null);
  const [confirmingDeletion, setConfirmingDeletion] = React.useState(false);
  const [deletionBusy, setDeletionBusy] = React.useState(false);
  const [deletionReceiptRevision, refreshDeletionReceipt] = React.useState(0);
  const lastDeletionOwner = React.useRef<string | null>(null);
  const deletionBusyRef = React.useRef(false);
  const recoveryStateRef = React.useRef(recoveryState);
  recoveryStateRef.current = recoveryState;
  const signingOutRef = React.useRef(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [adoptingLegacy, setAdoptingLegacy] = React.useState(false);
  const privateSignoutOwner = React.useRef<string | null>(null);
  React.useEffect(() => {
    const signingOutOwner=privateSignoutOwner.current,auth=getFirebaseAuthSnapshot();
    if(signingOutOwner&&(journeyOwner&&journeyOwner!==signingOutOwner||auth.status!=='ready'||getFirebaseAccountScope()!==null&&getFirebaseAccountScope()!==signingOutOwner)){
      privateSignoutOwner.current=null;signingOutRef.current=false;setSigningOut(false);
    }
    if (!journeyOwner || (signingOutOwner && journeyOwner !== signingOutOwner) ||
      (privateCleanupOwner.current && journeyOwner !== privateCleanupOwner.current)) {
      privateCleanupOwner.current = null; privateLockedRef.current = false; setPrivateViewLocked(false);
    }
  }, [journeyOwner, privateViewLocked]);
  const membershipBusyRef = React.useRef(false);
  const accountOperationGate = React.useRef(createAccountOperationGate(getFirebaseAccountScope));
  const profileAccountOrigin = React.useRef<{ section: FreedProfileSection; owner: string; generation: number; operation: ReturnType<ReturnType<typeof createAccountOperationGate>['begin']> } | null>(null);
  const isProfileAccountOriginCurrent = () => {
    const origin = profileAccountOrigin.current;
    return Boolean(origin && origin.generation === accountHostGeneration.current && !accountFlowFence.current.isActive() && origin.operation.isCurrent() && getFirebaseAccountScope() === origin.owner && getJourneyOwner(getFirebaseAuthSnapshot()) === origin.owner);
  };
  React.useEffect(() => {
    if (screen === 'main' && currentProfileSection === profileAccountOrigin.current?.section) profileAccountOrigin.current = null;
  }, [screen, currentProfileSection]);
  const returnFromProfileAccount = () => {
    const origin = profileAccountOrigin.current;
    if (!origin) return false;
    const isCurrent = () => profileAccountOrigin.current === origin && isProfileAccountOriginCurrent();
    // AccountAccessScreen has already completed its fence before success/Cancel.
    if (isCurrent()) returnProfileSection(origin.section, isCurrent);
    return true;
  };
  const [pendingRecoveryRestore, setPendingRecoveryRestore] = React.useState<RecoveryState | null>(null);
  const pendingJournalRestore = React.useRef<{ owner: string; archive: DecodedJournalArchive } | null>(null);
  const [restoringBackup, setRestoringBackup] = React.useState(false);
  const restoringBackupRef = React.useRef(false);
  React.useEffect(() => { if (pendingJournalRestore.current && pendingJournalRestore.current.owner !== journeyOwner) {
    pendingJournalRestore.current = null; setPendingRecoveryRestore(null);
  } }, [journeyOwner]);
  const [restoreNotice, setRestoreNotice] = React.useState<string | null>(null);
  const pendingInterventionTracker = React.useRef(createPendingInterventionTracker());
  const adultFeedLastSyncRef = React.useRef<number | null>(null);
  const consumedDeepLinkIntervention = React.useRef<string | null>(null);
  const consumedProtectionSetupLink = React.useRef<string | null>(null);
  const isWide = width > 760;

  const {
    streakDays: savedStreakDays,
    bestStreakDays,
    completedChallenges,
    attempts,
    challengeHistory,
    customChallenges,
    relapseRecords,
    answers,
    reminders,
    accountability,
    supportCircle,
    disciplineSettings
  } = recoveryState;
  const membershipSnapshot: JourneyMembershipSnapshot = !journeyOwner || getFirebaseAccountScope() !== journeyOwner
    ? { ownerUid: null, status: "unavailable" }
    : hasVerifiedPremium(recoveryState.premiumEntitlement, unlockClockMs, journeyOwner)
      ? { ownerUid: journeyOwner, status: "verified-premium" }
      : journeyMembership.ownerUid === journeyOwner
        ? journeyMembership.status === "verified-premium" ? { ownerUid: journeyOwner, status: "unavailable" } : journeyMembership
        : { ownerUid: journeyOwner, status: "checking" };
  const reviewAccess = useReviewAccess(journeyOwner);
  const effectiveReview = hasReviewAccess(reviewAccess.snapshot, journeyOwner, Date.now());
  const guidedTier = resolveGuidedTier(journeyOwner, membershipSnapshot, reviewAccess.snapshot, Date.now());
  const refreshGuidedEligibility = async (isCurrent: () => boolean): Promise<GuidedTier> => {
    const owner = journeyOwner;
    if (!owner || getFirebaseAccountScope() !== owner || !isCurrent()) return "unknown";
    const contracts = await getFirebaseCallableContracts({ ensureGuest: false });
    if (!contracts || !isCurrent()) return "unknown";
    const [membership, review] = await Promise.all([contracts.getPremiumEntitlement(), reviewAccess.refresh()]);
    if (!isCurrent() || getFirebaseAccountScope() !== owner || review?.ownerUid !== owner) return "unknown";
    const evidence = sanitizePremiumEntitlement(membership.entitlement);
    if (membership.entitlement !== null && !evidence) return "unknown";
    const paid = hasVerifiedPremium(evidence, Date.now());
    const inactive = !evidence || evidence.status !== "verified" || (evidence.expiresAt !== null && Date.parse(evidence.expiresAt) <= Date.now());
    if (!paid && !inactive) return "unknown";
    setRecoveryState(current => setVerifiedPremiumEntitlement(current, evidence ? { ...evidence, ownerUid: owner } : null));
    setJourneyMembership({ ownerUid: owner, status: paid ? "verified-premium" : "free" });
    return hasReviewAccess(review, owner, Date.now()) ? "review" : paid ? "paid" : "free";
  };
  const guidedAccess = useGuidedResetAccess(journeyOwner, guidedTier, getRuntimeMonetizationPlatform(), screen === "ad" || screen === "challenge" || screen === "intercept" || (screen === "feature" && guidedRouteFeature === "guided-reset"), `${activeAttempt?.nativeInterventionId ?? activeAttempt?.detectedAt ?? "manual"}:${activeAttempt?.source ?? "manual"}:${JSON.stringify(activeAttempt?.scope ?? null)}:${selectedChallenge?.id ?? "recommended"}:${guidedRouteFeature ?? "none"}`, () => {
    const owner = getFirebaseAccountScope() === journeyOwner ? journeyOwner : null;
    const currentMembership: JourneyMembershipSnapshot = membershipSnapshot.status === "verified-premium" && !hasVerifiedPremium(recoveryState.premiumEntitlement, Date.now(), owner)
      ? { ownerUid: owner, status: "unavailable" } : membershipSnapshot;
    return resolveGuidedTier(owner, currentMembership, reviewAccess.snapshot, Date.now());
  }, { refreshEligibility: refreshGuidedEligibility, isChecking: () => membershipSnapshot.status === "checking" });
  const challengeSession = useChallengeSession({ ownerId: journeyOwner, active: screen === "challenge", access: guidedAccess });
  const [accessRetry, retryAccess] = React.useReducer(n => n + 1, 0);
  const challengeBreakOrigin = React.useRef<LiveEarnedBreakOrigin | null>(null);
  const guidedRecoveryInProgress = React.useRef<() => boolean>(() => false);
  guidedRecoveryInProgress.current = () => {
    const session = challengeSession.getSnapshot().session;
    return Boolean(journeyOwner && getFirebaseAccountScope() === journeyOwner &&
      (session?.ownerId === journeyOwner || guidedAccess.canEnter() || guidedAccess.busy || guidedAccess.repairNeeded));
  };
  const earnedResumeEpoch = React.useRef(0);
  const [earnedResumeRetry, retryEarnedResume] = React.useReducer(n => n + 1, 0);
  const [earnedResumeState, setEarnedResumeState] = React.useState<'idle' | 'checking' | 'ready' | 'retry' | 'unavailable'>('idle');
  React.useEffect(() => { setActiveAttempt(null); setSelectedChallenge(null); setBasicHelpContext(null); setChallengeBreakNotice(null); challengeBreakOrigin.current = null; earnedResumeEpoch.current++; setEarnedResumeState('idle'); }, [journeyOwner]);
  const licensedFeatures = effectiveReview || membershipSnapshot.status === "verified-premium";
  const premium = hasVerifiedPremium(recoveryState.premiumEntitlement, unlockClockMs, getFirebaseAccountScope());
  const streakDays = getCurrentRecoveryStreakDays(recoveryState);
  const attemptsToday = countRecoveryRiskMomentsForDay(recoveryState);
  const recoveryScore = calculateRecoveryScore(streakDays, completedChallenges, attemptsToday);
  const todayCheckIn = getDailyCheckInForDay(recoveryState);
  const checkInSummary = summarizeCheckIns(recoveryState);
  const checkInInsight = generateRecoveryInsight(recoveryState, attemptsToday);
  const weeklyReport = generateWeeklyRecoveryReport(recoveryState);
  const monthlyGrowthReport = generateMonthlyGrowthReport(recoveryState);
  const analyticsSnapshot = buildRecoveryAnalyticsSnapshot(recoveryState);
  const analyticsSharingReadiness = React.useMemo(
    () => getAnalyticsSharingReadiness(recoveryState.analyticsSharing),
    [recoveryState.analyticsSharing]
  );
  const urgeRiskForecast = buildLocalUrgeRiskForecast(recoveryState);
  const recoveryLevel = calculateRecoveryLevel(recoveryState);
  const recoveryMilestone = getRecoveryMilestone(recoveryState);
  const smartReminderSuggestion = getSmartReminderSuggestion(recoveryState);
  const localRetentionPlan = createLocalRetentionPlan(buildRetentionRequest(recoveryState));
  const [remoteRetentionPlan, setRemoteRetentionPlan] = React.useState<RetentionPlan | null>(null);
  const retentionPlan = remoteRetentionPlan ?? localRetentionPlan;
  const achievements = generateAchievementBadges(recoveryState);
  const lastRelapseAt = relapseRecords[0]?.occurredAt ?? null;
  const premiumCapabilities = React.useMemo(
    () => getPremiumCapabilities({ premium, planId: recoveryState.premiumPlanId }),
    [premium, recoveryState.premiumPlanId]
  );
  // Review licensing enables features, but never changes membership, checkout, or cloud AI authority.
  const reviewFeatureCapabilities: PremiumCapabilitySet = effectiveReview ? {
    ...premiumCapabilities, noAds: true, premiumChallenges: true, customChallenges: true,
    advancedAnalytics: true, relapsePrediction: true, deepRecoveryReports: true,
    sponsorAccountability: true, familySupport: true
  } : premiumCapabilities;
  const preferredCategories = React.useMemo(() => inferPreferredChallengeCategories(answers), [answers]);
  const activeInterventionContext = React.useMemo(
    () => buildInterventionContextFromAttempt(activeAttempt),
    [activeAttempt]
  );
  const challengePreferences = React.useMemo(
    () => buildChallengePreferenceSignal(disciplineSettings),
    [disciplineSettings]
  );
  const firebaseEmailLinkReadiness = React.useMemo(() => getFirebaseEmailLinkReadiness(), []);
  const activeUnlock = getPresentedEarnedUnlock(recoveryState.earnedUnlocks, protectionStatus, Platform.OS, unlockClockMs);
  const activeBlockedAppPackages = React.useMemo(
    () => getActiveBlockedAppPackages(disciplineSettings, new Date(unlockClockMs).toISOString()),
    [disciplineSettings, unlockClockMs]
  );
  const activeBlockedAppPackagesKey = activeBlockedAppPackages.join("|");

  const enableAggregateAnalyticsSharing = React.useCallback(() => {
    const endpointUrl = getConfiguredAnalyticsEndpoint();
    const now = new Date().toISOString();
    setRecoveryState((current) =>
      updateAnalyticsSharingSettings(
        current,
        {
          enabled: true,
          userOptedInAt: now,
          consentVersion: ANALYTICS_CONSENT_VERSION,
          endpointUrl,
          aggregateOnlySharing: true,
          privateNotesAllowed: false,
          browsingDataAllowed: false,
          supportContactSharingAllowed: false,
          dataRetentionDays: 14,
          lastSendStatus: "never",
          lastSendMessage: endpointUrl
            ? "Aggregate analytics sharing is on. Send a snapshot when you are ready."
            : "Analytics endpoint is not configured for this build yet."
        },
        now
      )
    );
    setAnalyticsSendMessage(
      endpointUrl
        ? "Aggregate analytics sharing is on. Send a snapshot when you are ready."
        : "Analytics endpoint is not configured for this build yet."
    );
  }, [setRecoveryState]);

  const disableAggregateAnalyticsSharing = React.useCallback(() => {
    const now = new Date().toISOString();
    setRecoveryState((current) =>
      updateAnalyticsSharingSettings(
        current,
        {
          enabled: false,
          userOptedInAt: null,
          consentVersion: null,
          endpointUrl: null,
          aggregateOnlySharing: true,
          privateNotesAllowed: false,
          browsingDataAllowed: false,
          supportContactSharingAllowed: false,
          dataRetentionDays: 0,
          lastSendStatus: "blocked",
          lastSendMessage: "Remote analytics sharing is off."
        },
        now
      )
    );
    setAnalyticsSendMessage("Remote analytics sharing is off.");
  }, [setRecoveryState]);

  const sendAggregateAnalyticsSnapshot = React.useCallback(async () => {
    if (analyticsBusyRef.current) return;
    analyticsBusyRef.current = true;
    const operation = accountOperationGate.current.begin();
    setAnalyticsSendBusy(true);
    setAnalyticsSendMessage("Sending aggregate snapshot…");
    try {
      if (Platform.OS !== "web" && (process.env.EXPO_PUBLIC_BACKEND_PROVIDER ?? "firebase") === "firebase") {
        const contracts = await getFirebaseCallableContracts({ ensureGuest: true });
        if (!contracts || !operation.bindCreatedGuest(getFirebaseAccountSummary().anonymous)) throw new Error("The recovery account changed or analytics is unavailable.");
      }
      operation.assertCurrent();
      let result: Awaited<ReturnType<typeof sendGatedAnalyticsPayload>> | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const captured = persistRecoveryState(current => prepareAnalyticsSnapshotState(current));
        const pending = await prepareAnalyticsPendingSnapshot(captured, captured.analyticsSharing);
        operation.assertCurrent();
        const staged = persistRecoveryState(current => stageAnalyticsPendingSnapshot(current, captured, pending));
        result = await sendGatedAnalyticsPayload(staged, staged.analyticsSharing);
        operation.assertCurrent();
        if (result.snapshotRecovery) {
          persistRecoveryState(current => applyAnalyticsSnapshotRecovery(current, staged, result!.snapshotRecovery!));
          if (attempt === 0) continue;
          throw new Error("The saved analytics window changed. Retry sync; recovery history stays on this device.");
        }
        if (result.accepted && result.snapshotReceipt) {
          persistRecoveryState(current => applyPendingAnalyticsSnapshotReceipt(current, staged, result!.snapshotReceipt!));
        } else if (result.accepted && (process.env.EXPO_PUBLIC_BACKEND_PROVIDER ?? "firebase") === "firebase") {
          throw new Error("Analytics was not acknowledged for this saved snapshot. The pending request remains available for retry.");
        }
        break;
      }
      if (!result) throw new Error("Analytics sync could not complete.");
      const message = result.accepted ? `Aggregate snapshot saved.${result.reason ? ` ${result.reason}` : ""}` : result.reason ?? "Aggregate snapshot was not accepted. Retry when connected.";
      const sentAt = new Date().toISOString();
      persistRecoveryState(current => updateAnalyticsSharingSettings(current, {
        lastSentAt: result.accepted ? sentAt : current.analyticsSharing.lastSentAt,
        lastSendStatus: result.status, lastSendMessage: message
      }, sentAt));
      setAnalyticsSendMessage(message);
    } catch (error) {
      if (operation.isCurrent()) setAnalyticsSendMessage(safeUserFacingMessage(error, "Snapshot could not be saved. Recovery history stays on this device."));
    } finally { analyticsBusyRef.current = false; setAnalyticsSendBusy(false); }
  }, [persistRecoveryState]);

  const startChallenge = React.useCallback((challenge?: RecoveryChallenge) => {
    const existing = challengeSession.getSnapshot().session;
    if (existing?.phase === "completed") {
      setProtectionSyncMessage("Save the completed reset before starting another."); return;
    }
    setChallengeBreakNotice(null);
    setSelectedChallenge(existing?.challenge ?? challenge ?? null);
    setScreen("ad");
  }, [challengeSession.getSnapshot, setScreen]);
  const startStandaloneChallenge = React.useCallback((challenge?: RecoveryChallenge) => {
    const origin = challengeBreakOrigin.current;
    if (origin?.earnedTime && origin.sessionId === guidedAccess.grant?.sessionId && guidedAccess.canEnter() && getFirebaseAccountScope() === journeyOwner &&
      liveResetOwnerCurrent(origin, journeyOwner, ownerLease, hydrated && storageReady) && origin.attempt?.nativeInterventionId === activeAttemptRef.current?.nativeInterventionId && JSON.stringify(origin.attempt?.scope) === JSON.stringify(activeAttemptRef.current?.scope)) {
      setSelectedChallenge(null); setScreen('challenge'); return;
    }
    setActiveAttempt(null); startChallenge(challenge);
  }, [startChallenge, journeyOwner, ownerLease, hydrated, storageReady, guidedAccess.grant?.sessionId]);
  const openGuidedRecovery = React.useCallback(() => {
    if (!hydrated || !storageReady || !journeyOwner || getFirebaseAccountScope() !== journeyOwner ||
      getJourneyOwner(getFirebaseAuthSnapshot()) !== journeyOwner || privateLockedRef.current || accountFlowFence.current.isActive() ||
      getJourneyDestination(getJourneyPolicy()) !== 'main') return;
    recoveryEntryPresentation.current.beginManual();
    const existing = challengeSession.getSnapshot().session;
    if ((existing && existing.ownerId === journeyOwner) || guidedAccess.canEnter()) {
      // A voluntary reset resumes the current receipt; it never replaces native
      // app authority or invents evidence that a website was intercepted.
      setScreen('challenge');
      return;
    }
    if (guidedAccess.busy || guidedAccess.repairNeeded) {
      setScreen('ad');
      return;
    }
    setActiveAttempt(null);
    setSelectedChallenge(null);
    startChallenge();
  }, [hydrated, storageReady, journeyOwner, challengeSession.getSnapshot, guidedAccess.canEnter,
    guidedAccess.busy, guidedAccess.repairNeeded, startChallenge, setScreen]);
  const enqueueWebsiteRecovery = useGuidedResetLink({
    ready: hydrated && storageReady && journeyOwner !== null &&
      !['splash', 'welcome', 'quiz', 'planCalculation', 'appSelection', 'account', 'paywall', 'protectionSetup', 'appGroups'].includes(screen) &&
      !auxiliaryRoute && !deferredAuxiliaryRoute,
    ownerKey: journeyOwner === null ? null : `${journeyOwner}:${ownerLease}`,
    isCurrent: () => journeyOwner !== null && getFirebaseAccountScope() === journeyOwner &&
      getJourneyOwner(getFirebaseAuthSnapshot()) === journeyOwner && !privateLockedRef.current && !accountFlowFence.current.isActive() &&
      getJourneyDestination(getJourneyPolicy()) === 'main',
    onOpen: openGuidedRecovery
  });
  const discardChallengeSession = React.useCallback(() => {
    const receipt = challengeSession.getSnapshot().session;
    const owner = receipt?.ownerId ?? challengeBreakOrigin.current?.ownerUid;
    if (owner) { try { clearEarnedTimeReference(localStorage, owner); } catch { return false; } }
    challengeBreakOrigin.current = null;
    earnedResumeEpoch.current++;
    if (!guidedAccess.beginDiscard(receipt?.id)) return false;
    challengeSession.abandon();
    if (challengeSession.getSnapshot().session) return false;
    return guidedAccess.clear();
  }, [challengeSession.getSnapshot, challengeSession.abandon, guidedAccess.beginDiscard, guidedAccess.clear]);
  const abandonActiveProtectionFlow = React.useCallback(() => {
    const receipt = challengeSession.getSnapshot().session;
    if (receipt?.phase === "completed" && receipt.completion) {
      try { persistRecoveryState(current => recordChallengeCompletion(current, receipt.challenge, new Date(receipt.completion!.completedAtMs).toISOString(), undefined, receipt.completion!.outcome, receipt.id, receipt.elapsedMs / 1000, receipt.completion?.provenance)); }
      catch { setProtectionSyncMessage("Your completed reset is waiting to be saved. Try saving again after checking storage."); challengeSession.pause(); setScreen("main"); return; }
    }
    challengeBreakOrigin.current = null;
    if (!discardChallengeSession()) { challengeSession.pause(); setProtectionSyncMessage("Saved progress could not be removed. Retry discarding it before starting another guided reset."); setScreen("main"); return; }
    setActiveAttempt(null); setSelectedChallenge(null); setScreen("main");
  }, [challengeSession.abandon, challengeSession.pause, challengeSession.getSnapshot, persistRecoveryState, discardChallengeSession]);

  const startPanicIntervention = React.useCallback(() => {
    const attempt = createPanicInterventionAttempt();
    setRecoveryState((current) => recordBlockingAttempt(current, attempt));
    setActiveAttempt(attempt);
    setScreen("intercept");
  }, [setRecoveryState]);

  // Opaque action scope stays in memory; read supersession does not revoke it.
  const nativePrivateReadState=React.useRef({hydrated,storageReady,ownerLease});nativePrivateReadState.current={hydrated,storageReady,ownerLease};
  const appGroupsMemorySuspended = React.useRef(false);
  const appGroupsSuspensionEpoch = React.useRef(0);
  const getProtectionActionScope = React.useCallback(() => {
    const unknown = () => { if (!appGroupsMemorySuspended.current) { appGroupsMemorySuspended.current = true; appGroupsSuspensionEpoch.current += 1; } return null; };
    const auth = getFirebaseAuthSnapshot(), owner = getJourneyOwner(auth), sdkOwner = getFirebaseAccountScope();
    if (!owner || owner !== sdkOwner || privateLockedRef.current || accountFlowFence.current.isActive()) return unknown();
    const readable=nativePrivateReadState.current;
    if(!readable.hydrated||!readable.storageReady||readable.ownerLease?.ownerUid!==owner||!readable.ownerLease.isCurrent())return unknown();
    const admission=getFirebaseNativeAccountAdmission();
    if(!admission||admission.ownerUid!==owner)return unknown();
    return admission.actionScope;
  }, []);
  const knownProtectionScope = getProtectionActionScope();
  const [websiteAudience, setWebsiteAudience] = React.useState<{scope:string;audience:string|null}|null>(null);
  const websiteAudienceRef = React.useRef(websiteAudience); websiteAudienceRef.current = websiteAudience;
  React.useEffect(() => {
    let alive = true, generation = 0, retries = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setWebsiteAudience(previous => previous?.scope === knownProtectionScope ? previous : null);
    const refresh = async () => {
      const epoch = ++generation, scope = getProtectionActionScope();
      if (!scope || scope !== knownProtectionScope) { if (alive) setWebsiteAudience(null); return; }
      const receipt = await recoveryDnsPilot.status(scope);
      if (!alive || epoch !== generation || getProtectionActionScope() !== scope) return;
      // Busy/timeout/error cannot consume an initial notification without its
      // audience. Keep resolution pending until an actual scoped status arrives.
      const resolution=recoveryDnsAudienceResolution(receipt);
      if (!resolution.resolved) {
        if (retries++ < 20) { if (retry) clearTimeout(retry); retry=setTimeout(()=>{void refresh();},1000); }
        return;
      }
      retries=0;
      // Native account-scoped metadata is authoritative; backups/preferences
      // cannot enroll another account for website recovery notifications.
      setWebsiteAudience({scope,audience:resolution.audience});
    };
    void refresh();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
    return()=>{alive=false;generation++;if(retry)clearTimeout(retry);subscription.remove();};
  }, [knownProtectionScope, protectionReadRevision, screen === 'protectionSetup', getProtectionActionScope]);

  const captureProtectionActionTicket = (scope: string) => {
    const epoch = appGroupsSuspensionEpoch.current, sdkOwner = getFirebaseAccountScope(), owner = getJourneyOwner(getFirebaseAuthSnapshot());
    return { isCurrent: () => {
      if (!protectionHostAlive.current) return false;
      const currentScope = getProtectionActionScope();
      return currentScope === scope && appGroupsSuspensionEpoch.current === epoch && getFirebaseAccountScope() === sdkOwner && getJourneyOwner(getFirebaseAuthSnapshot()) === owner;
    } };
  };
  const appGroups = useAppGroups(getProtectionActionScope);
  const [appGroupsSnapshotScope, setAppGroupsSnapshotScope] = React.useState<string | null>(null);
  const refreshAppGroupConfiguration = async () => {
    setAppGroupsSnapshotScope(null);
    const scope = getProtectionActionScope(); if (Platform.OS === 'web' || scope === null) { setAppGroupsSnapshotScope(null); return null; }
    const ticket = captureProtectionActionTicket(scope);
    const acknowledged = await setAppGroupActionScope(scope);
    if (!ticket.isCurrent()) return null;
    if (!isAppGroupBindingConfirmed(acknowledged)) { setAppGroupsSnapshotScope(null); return null; }
    appGroupsMemorySuspended.current = false;
    const status = await appGroups.refresh(); if (!ticket.isCurrent()) return null;
    if (status) setAppGroupsSnapshotScope(scope); return status;
  };
  React.useEffect(() => {
    let alive = true;
    setAppGroupsSnapshotScope(null);
    if (Platform.OS === 'web' || knownProtectionScope === null) { setAppGroupsSnapshotScope(null); return; }
    const ticket = captureProtectionActionTicket(knownProtectionScope);
    void (async () => { if (!isAppGroupBindingConfirmed(await setAppGroupActionScope(knownProtectionScope)) || !alive || !ticket.isCurrent()) return;
      appGroupsMemorySuspended.current = false;
      const status = await appGroups.refresh(); if (alive && status && ticket.isCurrent()) setAppGroupsSnapshotScope(knownProtectionScope); })();
    return () => { alive = false; };
  }, [knownProtectionScope, appGroupsSuspensionEpoch.current]);
  const visibleAppGroups = journeyOwner && knownProtectionScope === appGroupsSnapshotScope && !appGroupsMemorySuspended.current && !privateLockedRef.current ? appGroups.status : null;
  const nativeAppBreak = presentNativeAppBreak({ snapshot: visibleAppGroups, snapshotScope: appGroupsSnapshotScope, currentScope: knownProtectionScope, ownerUid: journeyOwner, sdkOwnerUid: getFirebaseAccountScope(), ownerLease, now: unlockClockMs });
  const appGroupRefreshRef = React.useRef(refreshAppGroupConfiguration); appGroupRefreshRef.current = refreshAppGroupConfiguration;
  React.useEffect(() => {
    if (screen === 'main' && tab === 'today' && knownProtectionScope !== null) void appGroupRefreshRef.current().catch(() => setAppGroupsSnapshotScope(null));
  }, [screen, tab, knownProtectionScope]);
  React.useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') { setUnlockClockMs(Date.now()); void appGroupRefreshRef.current().catch(() => setAppGroupsSnapshotScope(null)); }
      else setAppGroupsSnapshotScope(null);
    });
    return () => listener.remove();
  }, []);

  const appGroupAddBusy = React.useRef(false);
  const protectionRouteOrigin = React.useRef({ screen, tab, section: guidedRouteParams.section });
  protectionRouteOrigin.current = { screen, tab, section: guidedRouteParams.section };
  const openAppGroups = (requestedGroupId?: unknown) => {
    if (protectionCapability?.appGroups !== true) { setProtectionIntent('apps'); setScreen('protectionSetup'); return; }
    const liveJourneyOwner = getJourneyOwner(getFirebaseAuthSnapshot());
    const liveScope = getProtectionActionScope();
    if (!journeyOwner || liveJourneyOwner !== journeyOwner || getFirebaseAccountScope() !== journeyOwner || liveScope === null) { enterAccountFlow(); setScreen('account'); return; }
    const wellFormedGroupId = typeof requestedGroupId === 'string' && /^(legacy-default|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(requestedGroupId);
    const currentVisibleGroup = wellFormedGroupId && liveScope === knownProtectionScope && appGroupsSnapshotScope === liveScope && visibleAppGroups?.supported === true && visibleAppGroups.groups.some(group => group.id === requestedGroupId);
    router.push(currentVisibleGroup ? { pathname: freedShieldSectionPath('apps'), params: { groupId: requestedGroupId } } : freedShieldSectionPath('apps'));
  };
  const pendingAppsAddIntent = React.useRef<{ scope: string; ticket: { isCurrent: () => boolean }; issuedAt: number } | null>(null);
  const hasPendingAppsAddIntent = () => {
    const intent = pendingAppsAddIntent.current;
    if (!intent) return false;
    const age = Date.now() - intent.issuedAt;
    return age >= 0 && age <= 120_000 && intent.scope === getProtectionActionScope() && intent.ticket.isCurrent();
  };
  const consumePendingAppsAddIntent = () => {
    const accepted = hasPendingAppsAddIntent(); pendingAppsAddIntent.current = null; return accepted;
  };
  const addAppGroup = () => {
    const scope = getProtectionActionScope();
    if (appGroupAddBusy.current || hasPendingAppsAddIntent() || !scope || !journeyOwner || getFirebaseAccountScope() !== journeyOwner || protectionCapability?.appGroups !== true || !visibleAppGroups?.supported) return;
    const ticket = captureProtectionActionTicket(scope); if (!ticket.isCurrent()) return;
    pendingAppsAddIntent.current = { scope, ticket, issuedAt: Date.now() };
    // A route parameter is never authority to create a group or open the native picker.
    router.push(freedShieldSectionPath('apps'));
  };
  const openAdvancedProtection = () => router.push(freedShieldSectionPath('advanced'));
  const initialAppGroupId = typeof guidedRouteParams.groupId === 'string' && /^(legacy-default|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(guidedRouteParams.groupId) ? guidedRouteParams.groupId : undefined;
  const protectionHostAlive = React.useRef(true);
  React.useEffect(() => {
    protectionHostAlive.current = true;
    return () => { protectionHostAlive.current = false; appGroupsMemorySuspended.current = true; appGroupsSuspensionEpoch.current += 1; retireFirebaseNativeAccountSession('native-account-host-retired'); protectionReadback.current.invalidate(); };
  }, []);
  const projectGenericProtectionStatus = (status: ProtectionStatus | null): ProtectionStatus | null => {
    if (!status) return null;
    return { authorized: status.authorized, active: status.adultFilterActive === true, adultFilterActive: status.adultFilterActive,
      adultFilterRequested: status.adultFilterRequested, adultWebPolicyConfigured: status.adultWebPolicyConfigured,
      privateDnsMode: status.privateDnsMode, privateDnsActive: status.privateDnsActive, dnsGuardCoverageReady: status.dnsGuardCoverageReady,
      dnsGuardCoverageIssueCode: status.dnsGuardCoverageIssueCode, vpnConsentRequired: status.vpnConsentRequired,
      safariContentBlockerEnabled: status.safariContentBlockerEnabled, safariRecoveryObservation: status.safariRecoveryObservation, mode: status.mode, message: 'Check device configuration' };
  };
  const refreshProtectionStatus = React.useCallback(async (originTicket?: { isCurrent: () => boolean }): Promise<ProtectionRefreshResult> => {
    const scope = getProtectionActionScope();
    const epoch = appGroupsSuspensionEpoch.current;
    const owner = getFirebaseAccountScope();
    const journeyReadOwner = getJourneyOwner(getFirebaseAuthSnapshot());
    const accountGeneration = accountHostGeneration.current;
    const ticket = scope === null ? null : captureProtectionActionTicket(scope);
    const publicOnly = scope === null || appGroupsMemorySuspended.current || journeyReadOwner === null;
    const current = () => {
      if (!protectionHostAlive.current || getFirebaseAccountScope() !== owner || accountHostGeneration.current !== accountGeneration ||
        getJourneyOwner(getFirebaseAuthSnapshot()) !== journeyReadOwner || (originTicket && !originTicket.isCurrent())) return false;
      const currentScope = getProtectionActionScope();
      return appGroupsSuspensionEpoch.current === epoch && currentScope === scope && (!ticket || ticket.isCurrent());
    };
    if (!current()) return { capability: null, status: null, superseded: true };
    const request = protectionReadback.current.begin(current);
    const [capabilityResult, statusResult] = await Promise.allSettled([
      getProtectionCapabilities(),
      getProtectionStatus()
    ]);
    if (!current()) return { capability: null, status: null, superseded: true };
    if (!request.isCurrent()) return { ...protectionReadback.current.getSnapshot(), superseded: true };
    const capability = capabilityResult.status === "fulfilled" ? capabilityResult.value : null;
    const rawStatus = statusResult.status === "fulfilled" ? statusResult.value : null;
    const status = publicOnly ? projectGenericProtectionStatus(rawStatus) : rawStatus;
    if (!protectionReadback.current.publishRead(request, { capability, status }))
      return { ...protectionReadback.current.getSnapshot(), superseded: true };
    setProtectionCapability(capability);
    setProtectionStatusRaw(status);
    setProtectionRefreshCompleted(true);
    return { ...protectionReadback.current.getSnapshot(), readTicket: request };
  }, []);

  React.useEffect(() => {
    void refreshProtectionStatus();
  }, [refreshProtectionStatus]);

  React.useEffect(() => {
    configureJourneyMetadataAdapter(createFirebaseJourneyMetadataAdapter({
      currentOwner: () => { const account = getFirebaseAccountSummary(); return account.signedIn && !account.anonymous ? getFirebaseAccountScope() : null; },
      getContracts: () => getFirebaseCallableContracts({ ensureGuest: false }),
      createEventId: () => createFirebaseClientEventId("journey")
    }));
    void startFirebaseClient();
    return () => configureJourneyMetadataAdapter(null);
  }, []);

  React.useEffect(() => {
    if (!hydrated || screen !== "main" || !getFirebaseAccountSummary().signedIn) return;
    let cancelled = false;
    setRemoteRetentionPlan(null);
    void generateRetentionPlan(recoveryState).then(plan => {
      if (!cancelled) setRemoteRetentionPlan(plan);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [hydrated, screen, todayCheckIn?.dateKey, todayCheckIn?.mood, attempts.length, challengeHistory.length, relapseRecords.length, premium]);

  React.useEffect(() => {
    configureNativeMonetizationRuntime({
      platform: getRuntimeMonetizationPlatform(),
      verifyStorePurchase: async (payload) => {
        const contracts = await getFirebaseCallableContracts({ensureGuest:false});
        if (!contracts) throw new Error("Authenticated Firebase purchase verification is unavailable.");
        return contracts.verifyStorePurchase(payload);
      },
      getCheckoutContext: async () => {
        const account = getFirebaseAccountSummary();
        if (!account.signedIn || account.anonymous || !getFirebaseAccountScope()) throw new Error("Connect an account before checkout.");
        const contracts = await getFirebaseCallableContracts({ ensureGuest: false });
        if (!contracts) throw new Error("Secure checkout is unavailable. Try again later.");
        return contracts.getCheckoutContext({platform:Platform.OS === 'ios' ? 'ios' : 'android'});
      }
    }).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!hydrated || screen !== "paywall") return;
    setRecoveryState((current) => markOnboardingPaywallPresented(current));
  }, [hydrated, screen, setRecoveryState]);

  React.useEffect(() => {
    const timer = setInterval(() => setUnlockClockMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const localClockDay = new Date(unlockClockMs).toDateString();
  const localClockOffset = new Date(unlockClockMs).getTimezoneOffset();
  React.useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timer = setTimeout(() => setUnlockClockMs(Date.now()), Math.max(1, midnight.getTime() - now.getTime() + 25));
    return () => clearTimeout(timer);
  }, [localClockDay, localClockOffset]);

  React.useEffect(() => {
    const proof = sanitizePremiumEntitlement(recoveryState.premiumEntitlement);
    if (!proof || proof.status !== "verified") return;
    const deadline = Math.min(Date.parse(proof.verifiedAt) + PREMIUM_OFFLINE_TTL_MS, proof.expiresAt ? Date.parse(proof.expiresAt) : Infinity);
    if (deadline <= Date.now()) { setUnlockClockMs(Date.now()); return; }
    const timer = setTimeout(() => setUnlockClockMs(Date.now()), deadline - Date.now() + 1);
    return () => clearTimeout(timer);
  }, [recoveryState.premiumEntitlement?.verifiedAt, recoveryState.premiumEntitlement?.expiresAt, recoveryState.premiumEntitlement?.status]);

  const syncOwnerAutomaticBackup = React.useCallback(() => {
    const owner = getJourneyOwner(getFirebaseAuthSnapshot()), repository = journalResources.current.repository;
    if (!owner || privateLockedRef.current || getFirebaseAccountScope() !== owner || journalResources.current.owner !== owner || !repository?.isActive()) return;
    try { const archive = repository.exportArchiveState(); void syncAutomaticRecoveryBackup(recoveryStateRef.current, buildJournalTextBackup(owner, archive.entries, archive), owner); }
    catch { /* Invalid/unreadable journal is never silently omitted from a purported complete automatic backup. */ }
  }, []);
  React.useEffect(() => {
    if (!hydrated || !recoveryState.automaticBackupEnabled) return;
    const timer = setTimeout(() => {
      if (AppState.currentState === "active") syncOwnerAutomaticBackup();
    }, 2_000);
    return () => clearTimeout(timer);
  }, [hydrated, recoveryState, journalRevision, syncOwnerAutomaticBackup]);

  React.useEffect(() => {
    if (!hydrated) return;
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active" && recoveryStateRef.current.automaticBackupEnabled) syncOwnerAutomaticBackup();
      else if (state !== "active") cancelAutomaticBackupSync();
    });
    return () => { subscription.remove(); cancelAutomaticBackupSync(); };
  }, [hydrated, syncOwnerAutomaticBackup]);

  React.useEffect(() => {
    if (!hydrated) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const next = new Date();
      next.setHours(24, 0, 0, 20);
      timer = setTimeout(() => {
        const now = new Date().toISOString();
        setRecoveryState(current => touchRecoveryState(current, now));
        setUnlockClockMs(Date.now());
        schedule();
      }, Math.max(20, next.getTime() - Date.now()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [hydrated, setRecoveryState]);

  React.useEffect(() => {
    if (!hydrated || Platform.OS === "web" || !journeyOwner) return;
    const owner = journeyOwner;
    setJourneyMembership({ ownerUid: owner, status: "checking" });
    let running = false;
    let disposed = false;
    const initialTimeout = setTimeout(() => { if (!disposed && getFirebaseAccountScope() === owner) setJourneyMembership({ ownerUid: owner, status: hasVerifiedPremium(recoveryStateRef.current.premiumEntitlement, Date.now(), owner) ? "verified-premium" : "unavailable" }); }, 8_000);
    const refresh = async () => {
      if (running) return;
      running = true;
      let membershipConfirmed = false;
      let confirmedMembershipStatus: JourneyMembershipSnapshot["status"] = "unavailable";
      try {
        const accountScope = getFirebaseAccountScope();
        const token = await getFirebaseNativeAuthAdapter().getCurrentIdToken();
        if (!token && !recoveryStateRef.current.premiumEntitlement && !recoveryStateRef.current.premium) return;
        if (accountScope !== owner || getFirebaseAccountSummary().anonymous) return;
        const contracts = await getFirebaseCallableContracts({ ensureGuest: false });
        if (!contracts) return;
        const snapshot = await contracts.getPremiumEntitlement() as { entitlement?: unknown };
        if (disposed || (accountScope && getFirebaseAccountScope() !== accountScope)) return;
        const refreshScope = getFirebaseAccountScope();
        membershipConfirmed = true;
        const evidence = sanitizePremiumEntitlement(snapshot?.entitlement);
        confirmedMembershipStatus = evidence && hasVerifiedPremium(evidence) ? "verified-premium" : "free";
        if (evidence && hasVerifiedPremium(evidence)) {
          if (!disposed) setRecoveryState(current => setVerifiedPremiumEntitlement(current, { ...evidence, ownerUid: refreshScope! }));
          return;
        }
        // A successful authoritative response removes access immediately. A
        // restore may subsequently prove a different active store purchase.
        if (!disposed) setRecoveryState(current => setVerifiedPremiumEntitlement(current, evidence));
        // Store revalidation also retries unfinished/acknowledgement-pending purchases.
        const restored = await restorePremiumPurchases({ platform: getRuntimeMonetizationPlatform() });
        if (disposed || getFirebaseAccountScope() !== refreshScope) return;
        if (restored.verifiedEntitlement) { confirmedMembershipStatus = hasVerifiedPremium(restored.verifiedEntitlement) ? "verified-premium" : "free"; setRecoveryState(current => setVerifiedPremiumEntitlement(current, { ...restored.verifiedEntitlement!, ownerUid: refreshScope! })); }
      } catch {
        // Existing proof remains bounded by expiry and the 24-hour offline limit.
      } finally { running = false; clearTimeout(initialTimeout); if (!disposed && getFirebaseAccountScope() === owner) setJourneyMembership({ ownerUid: owner, status: membershipConfirmed ? confirmedMembershipStatus : hasVerifiedPremium(recoveryStateRef.current.premiumEntitlement, Date.now(), owner) ? "verified-premium" : "unavailable" }); }
    };
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 6 * 60 * 60_000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") { setUnlockClockMs(Date.now()); void refresh(); } });
    return () => { disposed = true; subscription.remove(); clearInterval(timer); clearTimeout(initialTimeout); };
  }, [hydrated, setRecoveryState, journeyOwner, accessRetry]);

  React.useEffect(() => {
    if (!hydrated) return undefined;

    if (AppState.currentState === "active") {
      setRecoveryState((current) => recordAppSessionStart(current));
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setRecoveryState((current) => recordAppSessionStart(current));
      }
      if (state === "inactive" || state === "background") {
        setRecoveryState((current) => recordAppSessionEnd(current));
      }
    });

    return () => {
      subscription.remove();
      setRecoveryState((current) => recordAppSessionEnd(current));
    };
  }, [hydrated, setRecoveryState]);

  React.useEffect(() => {
    if (!hydrated || !journeyOwner || getFirebaseAccountScope() !== journeyOwner) return undefined;
    const owner = journeyOwner;

    let cancelled = false;
    syncNativeAdultDomainFeed()
      .then(({ status, provider, warning }) => {
        if (!cancelled && getFirebaseAccountScope() === owner) {
          adultFeedLastSyncRef.current = Date.now();
          setProtectionStatus(status);
          setProtectionSyncMessage(
            warning
              ? `Adult-domain feed sync fell back safely: ${warning}`
              : provider === "remote"
              ? "Adult-domain feed synced from the reviewed remote source."
              : provider === "remote-cache"
              ? "Adult-domain feed is unchanged; native protection kept the cached reviewed feed."
              : null
          );
        }
      })
      .catch(() => {
        if (!cancelled && getFirebaseAccountScope() === owner) {
          setProtectionSyncMessage("Adult-domain feed sync could not complete; embedded adult-domain protection remains available.");
        }
      })
      .finally(() => {
        if (!cancelled && getFirebaseAccountScope() === owner) void refreshProtectionStatus();
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, journeyOwner, refreshProtectionStatus]);

  React.useEffect(() => {
    if (!hydrated || !journeyOwner || getFirebaseAccountScope() !== journeyOwner) return undefined;
    const owner = journeyOwner;

    let cancelled = false;
    const refreshWhenStale = () => {
      if (cancelled || getFirebaseAccountScope() !== owner) return;
      const lastSyncAt = adultFeedLastSyncRef.current;
      if (lastSyncAt !== null && Date.now() - lastSyncAt < ADULT_FEED_REFRESH_INTERVAL_MS) return;
      adultFeedLastSyncRef.current = Date.now();
      syncNativeAdultDomainFeed()
        .then(({ status }) => {
          if (!cancelled && getFirebaseAccountScope() === owner) setProtectionStatus(status);
        })
        .catch(() => undefined);
    };

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshWhenStale();
    });
    return () => { cancelled = true; subscription.remove(); };
  }, [hydrated, journeyOwner]);

  React.useEffect(() => {
    if (!hydrated) return;

    const platform = getRuntimeProtectionActivationPlatform();
    if (platform === "web-preview") return;
    if (!hasProtectionActivationForPlatform(recoveryState, platform)) return;
    if (!protectionRefreshCompleted) return;
    if (!hasNativeProtectionActivationRevoked(
      protectionCapability,
      protectionStatus,
      disciplineSettings.blockedAppPackages.length,
      platform
    )) {
      return;
    }

    setRecoveryState((current) =>
      hasProtectionActivationForPlatform(current, platform) ? clearProtectionActivation(current) : current
    );
    setProtectionSyncMessage("Protection was turned off or changed in system settings. Re-run setup to reactivate on this device.");
  }, [
    disciplineSettings.blockedAppPackages.length,
    hydrated,
    protectionCapability,
    protectionRefreshCompleted,
    protectionStatus,
    recoveryState.protectionActivatedAt,
    recoveryState.protectionActivationPlatform,
    screen,
    setRecoveryState
  ]);

  React.useEffect(() => {
    if (!hydrated) return undefined;

    // Native enforcement owns its durable window and expiry. Loading a local
    // history or a restored backup only reads truth; it cannot reissue a grant.
    void refreshProtectionStatus().catch(() => undefined);

  }, [
    hydrated,
    refreshProtectionStatus
  ]);

  const [appConfigSyncBusy, setAppConfigSyncBusy] = React.useState(false);
  const appConfigBusyEpoch = React.useRef(0);
  const appConfigBusyRequest = React.useRef(0);
  const appConfigReadScope = React.useRef({ hydrated, storageReady, ownerLease });
  appConfigReadScope.current = { hydrated, storageReady, ownerLease };
  const earnedAppOrigin = activeAttempt?.source === 'app' && (activeAttempt.scope?.kind === 'ios-app-group' || activeAttempt.scope?.kind === 'android-app-group');
  const originatingEarnedScope=activeAttempt?.scope?.kind==='ios-app-group'||activeAttempt?.scope?.kind==='android-app-group'?activeAttempt.scope:null;
  const originatingEarnedGroup = earnedAppOrigin && visibleAppGroups?.supported && originatingEarnedScope && visibleAppGroups.configurationGeneration===originatingEarnedScope.configurationGeneration && visibleAppGroups.scopeEpoch===originatingEarnedScope.scopeEpoch
    ? visibleAppGroups.groups.find(group=>group.id===originatingEarnedScope.groupId&&group.revision===originatingEarnedScope.groupRevision) : undefined;
  React.useEffect(()=>{if(earnedAppOrigin&&knownProtectionScope!==null)void appGroupRefreshRef.current().catch(()=>{});},[earnedAppOrigin,activeAttempt?.nativeInterventionId,knownProtectionScope]);
  const earnedOffer = useEarnedTimeOffer(earnedAppOrigin && activeAttempt && journeyOwner && getFirebaseAccountScope() === journeyOwner && ownerLease && knownProtectionScope !== null
    ? { ownerUid: journeyOwner, ownerLease, actionScope: knownProtectionScope, attempt: activeAttempt, storageReady: hydrated && storageReady } : null,
    {preferredBreakSeconds:originatingEarnedGroup?.preferredBreakSeconds??300,supportedBreakSeconds:originatingEarnedGroup?visibleAppGroups?.supportedBreakSeconds:undefined,initializeDefault:Boolean(originatingEarnedGroup&&!challengeBreakOrigin.current?.earnedTime&&!challengeSession.session)});
  React.useEffect(() => {
    if (!hydrated || !storageReady || !challengeSession.hydrated || !journeyOwner || getFirebaseAccountScope() !== journeyOwner || !ownerLease?.isCurrent() || knownProtectionScope === null) return;
    const session = challengeSession.getSnapshot().session;
    if (challengeBreakOrigin.current?.ownerUid === journeyOwner && challengeBreakOrigin.current.earnedTime && challengeBreakOrigin.current.nativeActionScope === knownProtectionScope && (!session || challengeBreakOrigin.current.sessionId === session.id)) return;
    const epoch = ++earnedResumeEpoch.current, owner = journeyOwner, lease = ownerLease, scope = knownProtectionScope;
    let reference;
    try { reference = readEarnedTimeReference(localStorage, owner); }
    catch { setEarnedResumeState('retry'); setChallengeBreakNotice(appI18n.t('earnedTime.resumeSaveFailed', { defaultValue: 'Your guided access is kept. Free some storage and retry saving this reset.' })); return; }
    if (!reference || (session && reference.sessionId !== session.id) || (!session && guidedAccess.grant?.sessionId !== reference.sessionId)) { setEarnedResumeState('idle'); return; }
    const isCurrent = () => epoch === earnedResumeEpoch.current && getFirebaseAccountScope() === owner && appConfigReadScope.current.ownerLease === lease && lease.isCurrent() && getProtectionActionScope() === scope;
    setEarnedResumeState('checking');
    setChallengeBreakNotice(appI18n.t('earnedTime.restoring', { defaultValue: 'Checking your original app-time offer with this device…' }));
    void recoverEarnedTimeReference({ reference, session, ownerUid: owner, ownerLease: lease, actionScope: scope, now: Date.now, isCurrent, bind: setAppGroupActionScope, prepare: prepareEarnedAppTimeOffer, lookup: getEarnedAppTimeGrant }).then(result => {
      if (!isCurrent()) return;
      if (!('origin' in result)) {
        setEarnedResumeState(result.status);
        setChallengeBreakNotice(appI18n.t(result.status === 'retry' ? 'earnedTime.restoreRetry' : 'earnedTime.restoreUnavailable', { defaultValue: result.status === 'retry' ? 'Your completed activity is kept. Retry checking this app break; no new break starts automatically.' : 'This original app-time offer is no longer available. Your activity is kept and the app stays protected.' })); return;
      }
      const origin = result.origin;
      if (session?.phase === 'completed' && session.completion) {
        try { persistRecoveryState(current => recordChallengeCompletion(current, session.challenge, new Date(session.completion!.completedAtMs).toISOString(), unlockSourceForAttempt(origin.attempt), session.completion!.outcome, session.id, session.elapsedMs / 1000, session.completion?.provenance)); origin.saved = true; }
        catch { setEarnedResumeState('retry'); setChallengeBreakNotice(appI18n.t('earnedTime.resumeSaveFailed', { defaultValue: 'Your guided access is kept. Free some storage and retry saving this reset.' })); return; }
      }
      if (!isCurrent()) return;
      challengeBreakOrigin.current = origin;
      setActiveAttempt(origin.attempt); setEarnedResumeState('ready');
      const restricted = result.status === 'committed' && origin.earnedTime?.grantReceipt?.effective === false;
      setChallengeBreakNotice(appI18n.t(restricted ? 'earnedTime.restricted' : result.status === 'committed' ? 'earnedTime.existingBreakRestored' : 'earnedTime.offerRestored', { defaultValue: restricted ? 'Your break was recorded, but another rule still restricts this app. No extra time was charged again.' : result.status === 'committed' ? 'Your existing app break was found. Its original end time is unchanged.' : 'Your original offer was verified. Finish your activity, then explicitly start or retry the break.' }));
      if (result.status === 'committed') { void refreshProtectionStatus(); void refreshAppGroupConfiguration(); }
    });
    return () => { if (epoch === earnedResumeEpoch.current) earnedResumeEpoch.current++; };
  }, [hydrated, storageReady, journeyOwner, ownerLease, knownProtectionScope, challengeSession.hydrated, challengeSession.session?.id, challengeSession.session?.phase, guidedAccess.grant?.sessionId, earnedResumeRetry]);


  type AppConfigInput = { settings: DisciplineSettings; isCurrent: () => boolean; readTicket?: ProtectionReadTicket; readCapability?: ProtectionCapability };
  const appConfigQueue = React.useRef<ReturnType<typeof createLatestSerialJob<AppConfigInput, ProtectionStatus>> | null>(null);
  if (!appConfigQueue.current) appConfigQueue.current = createLatestSerialJob(async (input, isLatest) => {
    const current = () => {
      if (!isLatest()) return false;
      if (input.isCurrent() && (!input.readTicket || input.readTicket.isCurrent())) return true;
      appConfigQueue.current?.invalidate();
      return false;
    };
    if (!current()) return null;
    const capability = await getProtectionCapabilities();
    if (!current()) return null;
    if (capability.appGroups === true) { input.readTicket = protectionReadback.current.begin(); input.readCapability = capability; }
    return syncNativeAppGuard(input.settings, capability, { readStatus: getProtectionStatus, configurePackages: configureBlockedAppPackages, configureMode: configureAppGuardMode, configureSchedules: configureAppSchedules }, current);
  });
  const syncAppProtection = React.useCallback(async (settings?: DisciplineSettings) => {
    const readScope = appConfigReadScope.current;
    const epoch = appGroupsSuspensionEpoch.current, generation = accountHostGeneration.current;
    let scope: string | null, sdkOwner: string | null, owner: string | null, ticket: { isCurrent: () => boolean } | null;
    const unavailable = () => { appConfigQueue.current!.invalidate(); return new Error('Connect the owning account and read saved app settings before syncing protection.'); };
    try {
      scope = getProtectionActionScope(); sdkOwner = getFirebaseAccountScope(); owner = getJourneyOwner(getFirebaseAuthSnapshot());
      ticket = scope === null ? null : captureProtectionActionTicket(scope);
    } catch { throw unavailable(); }
    const current = () => {
      try {
        const readable = appConfigReadScope.current;
        return scope !== null && owner !== null && owner === sdkOwner && readable.hydrated && readable.storageReady &&
          readable.ownerLease === readScope.ownerLease && readable.ownerLease?.ownerUid === owner && readable.ownerLease.isCurrent() &&
          protectionHostAlive.current && appGroupsSuspensionEpoch.current === epoch && getFirebaseAccountScope() === sdkOwner &&
          getJourneyOwner(getFirebaseAuthSnapshot()) === owner && accountHostGeneration.current === generation && ticket?.isCurrent() === true;
      } catch { return false; }
    };
    if (!current()) throw unavailable();
    const input: AppConfigInput = { settings: settings ?? recoveryStateRef.current.disciplineSettings, isCurrent: current };
    const job = appConfigQueue.current!.submit(input);
    const busyRequest = ++appConfigBusyRequest.current;
    appConfigBusyEpoch.current = epoch;
    setAppConfigSyncBusy(true);
    try {
      const status = await job.result ?? await appConfigQueue.current!.latestResult();
      if (!status) throw new Error('App guard configuration was cancelled. Retry saving.');
      if (!current()) throw new Error('App guard configuration was cancelled. Retry saving.');
      if (input.readTicket && !input.readTicket.isCurrent()) throw new Error('App guard status read was superseded. Check the current status.');
      const returned = scope === null || appGroupsMemorySuspended.current ? projectGenericProtectionStatus(status)! : status;
      if (job.isCurrent() && current()) {
        if (input.readTicket) {
          const snapshot = { capability: input.readCapability ?? null, status: returned };
          if (!protectionReadback.current.publishRead(input.readTicket, snapshot)) throw new Error('App guard status read was superseded. Check the current status.');
          setProtectionCapability(snapshot.capability); setProtectionStatusRaw(returned); setProtectionRefreshCompleted(true);
        } else setProtectionStatus(returned);
        setProtectionSyncMessage(null);
      }
      return returned;
    }
    catch (error) { if (job.isCurrent() && current() && (!input.readTicket || input.readTicket.isCurrent())) setProtectionSyncMessage('Protection rules could not sync. Check status before relying on them.'); throw error; }
    finally { if (appConfigBusyRequest.current === busyRequest && protectionHostAlive.current && appGroupsSuspensionEpoch.current === epoch) setAppConfigSyncBusy(false); }
  }, []);
  const saveAppGuardMode = React.useCallback(async (appGuardMode: DisciplineSettings['appGuardMode']) => {
    const saved = persistRecoveryState(current => updateDisciplineSettings(current, { appGuardMode }));
    recoveryStateRef.current = saved;
    return syncAppProtection(saved.disciplineSettings);
  }, [persistRecoveryState, syncAppProtection]);
  const appConfigurationKey = JSON.stringify({ packages: getAppGuardPackages(disciplineSettings, protectionCapability), limit: disciplineSettings.dailyLimitMinutes, shortForm: disciplineSettings.shortFormInterruptionSeconds,
    mode: disciplineSettings.appGuardMode, modeConfiguredAt: disciplineSettings.appGuardModeConfiguredAt,
    schedules: buildNativeAppScheduleConfiguration(disciplineSettings, protectionCapability?.platform === 'ios' ? 'ios' : 'android'), modern: protectionCapability?.appGuardModes === true, appGroups: protectionCapability?.appGroups === true });
  React.useEffect(() => {
    appConfigQueue.current?.invalidate();
    if (hydrated && storageReady) void syncAppProtection().catch(() => undefined);
  }, [hydrated, storageReady, ownerLease, knownProtectionScope, appGroupsSuspensionEpoch.current, appConfigurationKey, syncAppProtection]);


  // Keep the native always-allow list in sync with saved discipline settings.
  const userAllowedDomainsKey = React.useMemo(
    () => disciplineSettings.userAllowedDomains.join("|"),
    [disciplineSettings.userAllowedDomains]
  );
  React.useEffect(() => {
    if (!hydrated) return undefined;
    if (Platform.OS !== "android") return undefined;

    let cancelled = false;
    configureUserAllowedDomains(userAllowedDomainsKey ? userAllowedDomainsKey.split("|") : [])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) void refreshProtectionStatus();
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, userAllowedDomainsKey, refreshProtectionStatus]);

  React.useEffect(() => {
    if (!hydrated || !protectionCapability?.managedSettings || protectionCapability?.appSchedules === true) return undefined;

    let cancelled = false;
    const start = parseClockTime(disciplineSettings.sleepStartTime);
    const end = parseClockTime(disciplineSettings.sleepEndTime);
    const syncSleepSchedule =
      disciplineSettings.sleepModeEnabled && start && end && (start.hour !== end.hour || start.minute !== end.minute)
        ? startRiskWindowMonitoring(start.hour, end.hour, start.minute, end.minute)
        : stopRiskWindowMonitoring();

    syncSleepSchedule
      .then((status) => {
        if (!cancelled) setProtectionStatus(status);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) void refreshProtectionStatus();
      });

    return () => {
      cancelled = true;
    };
  }, [
    disciplineSettings.sleepEndTime,
    disciplineSettings.sleepModeEnabled,
    disciplineSettings.sleepStartTime,
    hydrated,
    protectionCapability?.managedSettings,
    protectionCapability?.appSchedules,
    refreshProtectionStatus,
    protectionStatus?.protectionConfigurationResetDisabled
  ]);

  const changeReminderPreferences = reminderController.changePreferences;

  const handleAttempt = React.useCallback(
    (url: string, source: BlockingAttempt["source"] = "manual-check") => {
      const attempt = createBlockingAttempt(url, source);
      if (attempt.result.verdict === "block") {
        setRecoveryState((current) => recordBlockingAttempt(current, attempt));
        setActiveAttempt(attempt);
        setScreen("intercept");
      } else {
        setActiveAttempt(attempt);
        setTab("shield");
        setScreen("main");
      }
    },
    [setRecoveryState]
  );

  const consumePendingIntervention = React.useCallback(() => {
    if (!hydrated) return;
    const scope = getProtectionActionScope();
    if (scope === null) return;
    const operation = accountOperationGate.current.begin();
    const ticket = captureProtectionActionTicket(scope);
    const presentation = recoveryEntryPresentation.current.capture();
    let groupBindingAccepted = false;

    // The coordinator claims the exact native ID, then gates UI handoff with isFreshPendingIntervention(pending).
    (async () => {
      if (Platform.OS !== 'web') groupBindingAccepted = isAppGroupBindingConfirmed(await setAppGroupActionScope(scope));
      if (!operation.isCurrent() || !ticket.isCurrent()) return null;
      if (!groupBindingAccepted) { setProtectionSyncMessage('This step could not finish. Your recovery tools remain available. Try again.'); return null; }
      return consumePendingInterventionOnce({
      tracker: pendingInterventionTracker.current,
      getPending: async () => { if (!ticket.isCurrent() || !operation.isCurrent()) return null; const pending = await getPendingIntervention(scope); return ticket.isCurrent() && operation.isCurrent() ? pending : null; },
      clearPending: async id => { if (!ticket.isCurrent() || !operation.isCurrent()) return false; const accepted = await clearPendingIntervention(id, scope); return ticket.isCurrent() && operation.isCurrent() && accepted; }
      });
    })()
      .then((attempt) => {
        if (!attempt) return;
        if (!operation.isCurrent() || !ticket.isCurrent()) return;
        if ((attempt.scope?.kind === 'android-app-group' || attempt.scope?.kind === 'ios-app-group') && (!groupBindingAccepted || !getJourneyOwner(getFirebaseAuthSnapshot()))) return;
        setRecoveryState((current) => recordBlockingAttempt(current, attempt));
        // Exact claims and truthful event accounting still complete. A delayed
        // same-owner native callback cannot take over a manual entry, replace
        // an existing earned session's app origin, or undo newer navigation.
        if (!recoveryEntryPresentation.current.canPresent(presentation) || guidedRecoveryInProgress.current()) return;
        setActiveAttempt(attempt);
        setScreen("intercept");
      })
      .catch(() => undefined);
  }, [hydrated, setRecoveryState, getProtectionActionScope]);

  const consumeDeepLinkIntervention = React.useCallback(
    (url: string | null) => {
      if (!hydrated || !url) return;
      const deepLinkKey = url.trim();
      if (!deepLinkKey || consumedDeepLinkIntervention.current === deepLinkKey) return;

      const attempt = createDeepLinkInterventionAttempt(deepLinkKey);
      if (!attempt) return;

      consumedDeepLinkIntervention.current = deepLinkKey;
      setRecoveryState((current) => recordBlockingAttempt(current, attempt));
      setActiveAttempt(attempt);
      setScreen("intercept");
    },
    [hydrated, setRecoveryState]
  );

  const consumeProtectionSetupDeepLink = React.useCallback(
    (url: string | null) => {
      if (!hydrated || !url || !isProtectionSetupDeepLink(url)) return false;

      const deepLinkKey = url.trim();
      if (deepLinkKey && consumedProtectionSetupLink.current === deepLinkKey) return true;

      consumedProtectionSetupLink.current = deepLinkKey;
      setProtectionSyncMessage("Returned from Android settings. Refreshing protection setup now.");
      setScreen("protectionSetup");
      void refreshProtectionStatus();
      return true;
    },
    [hydrated, refreshProtectionStatus]
  );

  const consumeFirebaseEmailLink = React.useCallback((url: string | null) => {
    if (!firebaseEmailLinkReadiness.ready || !isFirebaseEmailLinkDeliveryUrl(url)) return false;
    setPendingFirebaseEmailLink(url);
    setTab("profile");
    setScreen("main");
    return true;
  }, [firebaseEmailLinkReadiness.ready]);

  const messageAccountabilityPartner = React.useCallback(
    async (challenge?: RecoveryChallenge): Promise<boolean> => {
      const url = buildAccountabilityDeepLink(
        recoveryState.accountability,
        {
          streakDays: recoveryState.streakDays,
          host: activeAttempt?.host,
          challengeTitle: challenge?.title
        },
        Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios"
      );

      if (!url) return false;
      try { await Linking.openURL(url); return true; } catch { return false; }
    },
    [activeAttempt?.host, recoveryState.accountability, recoveryState.streakDays, setRecoveryState]
  );

  const sendSponsorReport = React.useCallback(() => {
    if (!reviewFeatureCapabilities.sponsorAccountability) {
      setScreen("paywall");
      return;
    }

    const url = buildSponsorReportDeepLink(
      recoveryState.accountability,
      recoveryState,
      Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios"
    );

    if (!url) return;

    Linking.openURL(url)
      .then(() => {
        setRecoveryState((current) => recordAccountabilityContact(current));
      })
      .catch(() => undefined);
  }, [reviewFeatureCapabilities.sponsorAccountability, recoveryState, setRecoveryState]);

  const sendSupportCircleReport = React.useCallback(
    (memberId: string) => {
      if (!reviewFeatureCapabilities.familySupport && !reviewFeatureCapabilities.sponsorAccountability) {
        setScreen("paywall");
        return;
      }

      const member = recoveryState.supportCircle.find((item) => item.id === memberId);
      if (!member) return;

      const url = buildSupportCircleReportDeepLink(
        member,
        recoveryState,
        Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios"
      );

      if (!url) return;

      Linking.openURL(url)
        .then(() => {
          setRecoveryState((current) => recordSupportCircleContact(current, memberId));
        })
        .catch(() => undefined);
    },
    [reviewFeatureCapabilities.familySupport, reviewFeatureCapabilities.sponsorAccountability, recoveryState, setRecoveryState]
  );

  const getJourneyPolicy = (): JourneyPolicy => {
    const current = recoveryStateRef.current;
    // Legacy progress is migratable; email and accountSkippedAt never authorize entry.
    const journey = current.journey.entry || current.journey.introCompletedAt ? current.journey
      : current.hasCompletedOnboarding ? { entry: "existing" as const, introCompletedAt: null } : current.journey;
    const liveOwner = getJourneyOwner(journeyAuth);
    const scopeMatches = liveOwner === getFirebaseAccountScope();
    const verifiedPremium = Boolean(liveOwner && scopeMatches && hasVerifiedPremium(current.premiumEntitlement, Date.now(), liveOwner));
    const awaitingMembership = liveOwner && scopeMatches && !verifiedPremium && membershipOwnerChecked !== liveOwner;
    return {
      auth: !hydrated || awaitingMembership ? { ...journeyAuth, status: "hydrating" }
        : scopeMatches ? journeyAuth : { ...journeyAuth, signedIn: false, ownerUid: null },
      journey, offerAcknowledged: Boolean(liveOwner && scopeMatches && journeyOfferStore.current.has(liveOwner)), verifiedPremium
    };
  };
  React.useEffect(() => {
    if (!journeyOwner) return;
    let current = true;
    const sync = () => { void journeyOfferStore.current.sync(journeyOwner).then(() => { if (current && getFirebaseAccountScope() === journeyOwner) refreshJourneyOffer(value => value + 1); }); };
    sync();
    const subscription = AppState.addEventListener("change", state => { if (state === "active") sync(); });
    return () => { current = false; subscription.remove(); };
  }, [journeyOwner]);
  const acknowledgeJourneyOffer = (decision: "free" | "verified-membership") => {
    const owner = getJourneyOwner(journeyAuth);
    if (!owner || owner !== getFirebaseAccountScope()) return;
    const result = journeyOfferStore.current.acknowledge(owner, decision);
    if (!result.saved) setJourneyOfferSaveNotice({ ownerUid: owner, message: "Your choice works for this session, but could not be saved on this device. Retry saving before your next restart." });
    refreshJourneyOffer(value => value + 1);
    void journeyOfferStore.current.sync(owner);
  };
  React.useEffect(() => {
    if (!hydrated) return;
    if (auxiliaryRoute) {
      if (accountFlowFence.current.isActive()) deferAuxiliaryPresentation();
      return;
    }
    if (deferredAuxiliaryRoute) {
      if (!accountFlowFence.current.isActive()) resumeAuxiliaryPresentation();
      return;
    }
    const policy = getJourneyPolicy();
    const guarded = guardJourneyRoute(screen, policy, accountFlowFence.current.isActive());
    if (guarded !== screen) setScreen(guarded);
    else if (screen === "account" && !accountReturnToProfile && !accountFlowFence.current.isActive() && getJourneyOwner(policy.auth) && !(profileAccountOrigin.current && isProfileAccountOriginCurrent())) setScreen(getJourneyDestination(policy));
    else if (screen === "paywall" && getJourneyDestination(policy) === "main" && ["splash", "welcome", "quiz", "planCalculation", "appSelection", "account"].includes(paywallNavigationRef.current.getOrigin() ?? "")) setScreen("main");
  }, [hydrated, auxiliaryRoute, deferredAuxiliaryRoute, deferAuxiliaryPresentation, resumeAuxiliaryPresentation, screen, journeyAuth, membershipOwnerChecked, recoveryState.journey, recoveryState.premiumEntitlement, accountReturnToProfile, journeyOfferRevision, accountFlowRevision]);

  const paywallNavigationRef = React.useRef(createPaywallNavigationSession<Screen>("splash"));
  React.useLayoutEffect(() => { paywallNavigationRef.current.update(screen); }, [screen]);
  const profilePaywallOrigin = React.useRef<{ section: FreedProfileSection; owner: string; navigation: PaywallNavigationToken<Screen>; operation: ReturnType<ReturnType<typeof createAccountOperationGate>['begin']> } | null>(null);
  const openProfilePaywall = (section?: FreedProfileSection) => {
    const owner = getJourneyOwner(getFirebaseAuthSnapshot());
    openPaywall();
    const navigation = paywallNavigationRef.current.capture();
    profilePaywallOrigin.current = section && owner && navigation && getFirebaseAccountScope() === owner ? { section, owner, navigation, operation: accountOperationGate.current.begin() } : null;
  };
  const postPaywallScreen = (origin = paywallNavigationRef.current.getOrigin()): Screen => {
    const current = recoveryStateRef.current;
    if (!getJourneyOwner(journeyAuth)) return "account";
    return resolvePaywallReturn({
      origin,
      protectionReady: hasProtectionActivationForPlatform(current, getRuntimeProtectionActivationPlatform()),
      limitedProtectionAcknowledged: hasProtectionSetupFallback(current, getRuntimeProtectionActivationPlatform()),
      accountStepDone: Boolean(getJourneyOwner(journeyAuth)),
      immediateRecovery: true
    });
  };

  const openPaywall = (featureId?: FeatureId) => {
    paywallNavigationRef.current.open(featureId);
    setScreen("paywall");
  };
  const returnFromPaywall = (navigation: PaywallNavigationToken<Screen> | null = paywallNavigationRef.current.capture()) => {
    if (!paywallNavigationRef.current.owns(navigation)) return;
    const feature = parseFeatureId(navigation?.featureId);
    if (feature) {
      const owner = getJourneyOwner(getFirebaseAuthSnapshot());
      const returnOperation = accountOperationGate.current.begin();
      replaceFeature(feature, () => returnOperation.isCurrent() && paywallNavigationRef.current.owns(navigation) && Boolean(owner) && getFirebaseAccountScope() === owner && getJourneyOwner(getFirebaseAuthSnapshot()) === owner);
      return;
    }
    const origin = profilePaywallOrigin.current;
    if (origin && origin.navigation.generation === navigation!.generation) {
      returnProfileSection(origin.section, () => profilePaywallOrigin.current === origin && origin.operation.isCurrent() && paywallNavigationRef.current.owns(navigation) && getFirebaseAccountScope() === origin.owner && getJourneyOwner(getFirebaseAuthSnapshot()) === origin.owner);
      return;
    }
    setScreen(postPaywallScreen(navigation!.origin));
  };

  const runMembershipAction = async (planId: LaunchPremiumPlanId | null) => {
    if (membershipBusyRef.current) return;
    const owner = getJourneyOwner(journeyAuth);
    if (!owner || owner !== getFirebaseAccountScope()) { setScreen("account"); return; }
    membershipBusyRef.current = true;
    const operation = accountOperationGate.current.begin();
    const navigation = paywallNavigationRef.current.capture();
    setPurchaseBusy(true);
    setPurchaseNotice(null);
    try {
      const platform = getRuntimeMonetizationPlatform();
      const config = getMonetizationConfig({ platform });
      if (platform !== "web" && config.mode !== "mock") {
        const contracts = await getFirebaseCallableContracts({ ensureGuest: false });
        if (!contracts || getFirebaseAccountSummary().anonymous || getFirebaseAccountScope() !== owner) throw new Error("The recovery account changed or secure checkout is unavailable. Try again.");
      }
      const result = planId ? await purchasePremiumPlan(planId, { platform }) : await restorePremiumPurchases({ platform });
      operation.assertCurrent();
      if (paywallNavigationRef.current.owns(navigation)) setPurchaseNotice(safeUserFacingMessage(result.message, "Membership could not be confirmed. Try again."));
      if (result.premium) {
        setRecoveryState(current => result.verifiedEntitlement
          ? setVerifiedPremiumEntitlement(current, { ...result.verifiedEntitlement, ownerUid: owner })
          : setPremiumPlan(current, result.provider === "mock", result.planId));
        const verified = result.verifiedEntitlement && hasVerifiedPremium({ ...result.verifiedEntitlement, ownerUid: owner }, Date.now(), owner);
        if (verified) { acknowledgeJourneyOffer("verified-membership"); if (paywallNavigationRef.current.owns(navigation)) returnFromPaywall(navigation); }
      }
    } catch (error) {
      if (operation.isCurrent() && paywallNavigationRef.current.owns(navigation)) setPurchaseNotice(safeUserFacingMessage(error, "Membership could not be confirmed. Try again."));
    } finally {
      membershipBusyRef.current = false;
      setPurchaseBusy(false);
    }
  };

  const changeAutomaticBackup = React.useCallback(async (enabled: boolean, passphrase: string) => {
    const owner = getJourneyOwner(getFirebaseAuthSnapshot());
    if (!owner || owner !== getFirebaseAccountScope()) throw new Error('Connect the owning account before changing automatic backup.');
    const operation = accountOperationGate.current.begin();
    if (enabled) {
      const account = getFirebaseAccountSummary();
      if (!account.signedIn || account.anonymous) throw new Error("Connect Google, Apple, or email before enabling automatic backup.");
      await enableAutomaticBackup(passphrase, owner);
    } else {
      await disableAutomaticBackup(owner);
    }
    operation.assertCurrent(); if (getJourneyOwner(getFirebaseAuthSnapshot()) !== owner) throw new Error('The backup owner changed. Review the current account.');
    setRecoveryState(current => ({ ...current, automaticBackupEnabled: enabled }));
  }, [setRecoveryState]);

  const signOutRecoveryAccount = React.useCallback(async () => {
    if (deletionBusyRef.current) throw new Error("Finish account deletion confirmation before signing out.");
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    const owner = getFirebaseAccountScope(), admission=getFirebaseNativeAccountAdmission(); privateSignoutOwner.current = owner;
    privateLockedRef.current=true;setPrivateViewLocked(true);
    let nativeCleanupState='unavailable';
    accountOperationGate.current.invalidate();
    const signoutOperation=accountOperationGate.current.begin();
    accountHostGeneration.current += 1;
    const hostGeneration=accountHostGeneration.current;
    let authTransitionCurrent=true,authInvalidations=0,signoutRequested=false;
    const sameAccount=()=>{const auth=getFirebaseAuthSnapshot();return getFirebaseAccountScope()===owner&&auth.status==='ready'&&auth.ownerUid===owner;};
    const currentAccount=()=>authTransitionCurrent&&signoutOperation.isCurrent()&&sameAccount();
    const ownsCurrentBusyState=()=>{const auth=getFirebaseAuthSnapshot();return accountHostGeneration.current===hostGeneration&&privateSignoutOwner.current===owner&&getFirebaseAccountScope()===owner&&auth.status==='ready'&&auth.ownerUid===owner;};
    const signedOutSnapshot=()=>{const auth=getFirebaseAuthSnapshot();return getFirebaseAccountScope()===null&&auth.status==='ready'&&!auth.signedIn&&auth.ownerUid===null;};
    const currentSignedOut=()=>{const auth=getFirebaseAuthSnapshot();return authTransitionCurrent&&signoutRequested&&privateSignoutOwner.current===owner&&accountHostGeneration.current===hostGeneration&&getFirebaseAccountScope()===null&&(signedOutSnapshot()||auth.status==='ready'&&auth.ownerUid===owner);};
    let releaseAuthTransition=()=>{};
    const recoverSameOwnerAbort=async()=>{
      if(!ownsCurrentBusyState()||!signoutOperation.isCurrent())return;
      // Recovery is a fresh admission, never continuation of the invalidated logout.
      const revision=authInvalidations;
      let fresh=null;try{fresh=await reconcileFirebaseNativeAccountSession();}catch{/* Keep the existing account retry reachable when native admission is unavailable. */}
      if(!ownsCurrentBusyState()||!signoutOperation.isCurrent())return;
      privateLockedRef.current=false;setPrivateViewLocked(false);
      if(authInvalidations===revision&&fresh&&getFirebaseNativeAccountAdmission()===fresh)resumeOwner();
      setScreen('account');setAccountNotice('Sign-out could not complete. Try again.');
    };
    profileAccountOrigin.current?.operation.cancel(); profileAccountOrigin.current = null;
    if (accountFlowFence.current.isActive()) accountFlowFence.current.begin().complete();
    protectionReadback.current.invalidate(); appConfigQueue.current?.invalidate();
    setPendingRecoveryRestore(null);
    setPendingFirebaseEmailLink(null);
    setAccountNotice("Signing out…");
    try {
      const observeTransition=()=>{if(!sameAccount()&&!(signoutRequested&&signedOutSnapshot())){authTransitionCurrent=false;authInvalidations++;}};
      releaseAuthTransition=subscribeFirebaseAuthSnapshot(observeTransition);observeTransition();
      let nativeOperation=null;
      try { if(owner){
        if(admission)nativeOperation=await reserveNativeCleanup({storage:localStorage,ownerUid:owner,reason:'sign-out',admission,isCurrent:()=>signoutOperation.isCurrent()&&getFirebaseAccountScope()===owner&&getFirebaseNativeAccountAdmission()===admission,prepare:prepareNativeAccountCleanup});
        else nativeOperation=await withFirebaseNativeAccountCleanup(owner,()=>signoutOperation.isCurrent()&&getFirebaseAccountScope()===owner,async(temporary,current,prepare)=>reserveNativeCleanup({storage:localStorage,ownerUid:owner,reason:'sign-out',admission:temporary,isCurrent:current,prepare}));
      } } catch { /* A native/metadata failure cannot block SDK logout. */ }
      if(!currentAccount()){await recoverSameOwnerAbort();return;}
      retireFirebaseNativeAccountSession('native-account-sign-out');
      if(nativeOperation){try{nativeCleanupState=(await executeStoredNativeCleanup({storage:localStorage,operation:nativeOperation,execute:executeNativeAccountCleanup})).state;}catch{/* Native cleanup remains unconfirmed. */}}
      if(!currentAccount()){await recoverSameOwnerAbort();return;}
      cancelAutomaticBackupSync();
      // Local cancellation happens now. Secure-key cleanup cannot hold actual Auth logout hostage.
      void disableAutomaticBackup(owner ?? undefined).catch(() => undefined);
      try { persistRecoveryState(current => ({ ...current, automaticBackupEnabled: false })); } catch { /* Auth logout still proceeds; retained owner data is never transferred. */ }
      journalResources.current.repository?.revoke();
      suspendOwner(); privateLockedRef.current = true; setPrivateViewLocked(true);
      setJourneyMembership({ ownerUid: null, status: 'unavailable' });
      setActiveAttempt(null); setSelectedChallenge(null); setBasicHelpContext(null); challengeBreakOrigin.current = null;
      if(!currentAccount()){await recoverSameOwnerAbort();return;}
      signoutRequested=true;
      await signOutFirebaseAccount();
      if(!currentSignedOut()){if(currentAccount())throw new Error('Firebase Auth has not confirmed sign-out. Try again.');await recoverSameOwnerAbort();return;}
      setAccountReturnToProfile(false);
      setScreen("welcome");
      setRemoteRetentionPlan(null);
      setAccountNotice(nativeCleanupState==='completed' ? 'Signed out. Your private history stays with its original account. Device adult-protection settings are retained.' : 'Signed out. Your private history stays with its original account. Native private cleanup needs retry; device adult-protection settings are retained.');
    } catch (error) {
      if(!currentAccount()){await recoverSameOwnerAbort();return;}
      if (owner) {
        const fresh=await reconcileFirebaseNativeAccountSession();
        if(!currentAccount()){await recoverSameOwnerAbort();return;}
        if(fresh&&currentAccount()&&getFirebaseNativeAccountAdmission()===fresh){privateLockedRef.current=false;setPrivateViewLocked(false);resumeOwner();}
      }
      if(currentAccount())setAccountNotice(safeUserFacingMessage(error, "Sign-out could not complete. Try again."));
    } finally { releaseAuthTransition();if(ownsCurrentBusyState()||currentSignedOut()||privateSignoutOwner.current===owner&&accountHostGeneration.current===hostGeneration&&signedOutSnapshot()){signingOutRef.current = false;setSigningOut(false);privateSignoutOwner.current=null;} }
  }, [persistRecoveryState, suspendOwner, resumeOwner, getProtectionActionScope]);

  const restoreRecoveryState = React.useCallback((restored: RecoveryState) => {
    const owner = getJourneyOwner(getFirebaseAuthSnapshot());
    if (!owner || owner !== getFirebaseAccountScope()) { setAccountNotice('Connect the owning account before restoring private history.'); return; }
    pendingJournalRestore.current = { owner, archive: { version: 1, exportedAt: new Date().toISOString(), recoveryState: restored, entries: [], photos: [], processedSources: [], deletedLegacySources: [] } };
    setRestoreNotice(null); setPendingRecoveryRestore(restored);
  }, []);

  const exportOwnerBackupFile = React.useCallback(async (passphrase: string) => {
    const owner = getJourneyOwner(getFirebaseAuthSnapshot()), repository = journalResources.current.repository;
    if (!owner || owner !== getFirebaseAccountScope() || !repository || journalResources.current.owner !== owner) throw new Error('Connect the owning account before exporting private history.');
    const operation = accountOperationGate.current.begin();
    const current = () => !privateLockedRef.current && operation.isCurrent() && getJourneyOwner(getFirebaseAuthSnapshot()) === owner && getFirebaseAccountScope() === owner && repository.isActive();
    const serialized = await createEncryptedJournalArchive({ ...repository.exportArchiveState(), ownerId: owner, media: journalResources.current.media, recoveryState: recoveryStateRef.current, passphrase, isCurrentOwner: current });
    await getJournalBackupFiles().share(serialized, current);
  }, []);
  const importOwnerBackupFile = React.useCallback(async (passphrase: string): Promise<boolean> => {
    const owner = getJourneyOwner(getFirebaseAuthSnapshot());
    if (!owner || owner !== getFirebaseAccountScope()) throw new Error('Connect the owning account before restoring private history.');
    const operation = accountOperationGate.current.begin();
    const current = () => !privateLockedRef.current && operation.isCurrent() && getJourneyOwner(getFirebaseAuthSnapshot()) === owner && getFirebaseAccountScope() === owner;
    const serialized = await getJournalBackupFiles().read(current); if (serialized === null) return false;
    const archive = await restoreJournalOrRecoveryBackup(serialized, passphrase);
    if (!current()) throw new Error('The backup owner changed. File import was stopped.');
    pendingJournalRestore.current = { owner, archive }; setRestoreNotice(null); setPendingRecoveryRestore(archive.recoveryState); return true;
  }, []);
  const downloadOwnerTextBackup = React.useCallback(async (passphrase: string) => {
    const owner = getJourneyOwner(getFirebaseAuthSnapshot());
    if (!owner || owner !== getFirebaseAccountScope()) throw new Error('Connect the owning account before restoring cloud text backup.');
    const operation = accountOperationGate.current.begin();
    const result = await downloadEncryptedRecoveryBackup(passphrase, { endpointUrl: process.env.EXPO_PUBLIC_FIREBASE_RECOVERY_BACKUP_SYNC_ENDPOINT,
      getAuthToken: async () => { operation.assertCurrent(); if (getJourneyOwner(getFirebaseAuthSnapshot()) !== owner) return null;
        const token = await getFirebaseNativeAuthAdapter().getCurrentIdToken(); operation.assertCurrent(); return getFirebaseAccountScope() === owner ? token : null; } });
    operation.assertCurrent(); if (getJourneyOwner(getFirebaseAuthSnapshot()) !== owner) throw new Error('The backup owner changed. Restore was stopped.');
    if (!result.ok || !result.restoredState) throw new Error('Cloud text backup could not be downloaded. Your local history was kept.');
    const archive = decodedRecoveryTextArchive(result.restoredState, result.restoredJournal, result.backupCreatedAt ?? new Date().toISOString());
    pendingJournalRestore.current = { owner, archive }; setRestoreNotice(null); setPendingRecoveryRestore(archive.recoveryState);
  }, []);
  const confirmRecoveryRestore = async () => {
    const pending = pendingJournalRestore.current, repository = journalResources.current.repository;
    if (!pendingRecoveryRestore || !pending || !repository || !ownerStore || restoringBackupRef.current) return;
    const { owner, archive } = pending, operation = accountOperationGate.current.begin();
    const current = () => !privateLockedRef.current && operation.isCurrent() && getJourneyOwner(getFirebaseAuthSnapshot()) === owner && getFirebaseAccountScope() === owner && journalResources.current.repository === repository;
    if (!current()) { setRestoreNotice('The backup owner changed. Review the current account and choose the file again.'); return; }
    restoringBackupRef.current = true; setRestoringBackup(true); cancelAutomaticBackupSync();
    try {
      const verified = ownerStore.readOwner(owner);
      const result = await restoreWholeAppArchive({ archive, storage: localStorage, recovery: ownerStore, repository, media: journalResources.current.media, isCurrentOwner: current,
        prepareRecovery: restored => recordAppSessionStart({ ...restored,
          signedInEmail: verified.signedInEmail, premiumEntitlement: verified.premiumEntitlement, premium: verified.premium,
          premiumPlanId: verified.premiumPlanId, premiumPlanAudience: verified.premiumPlanAudience, premiumActivatedAt: verified.premiumActivatedAt,
          protectionActivatedAt: verified.protectionActivatedAt, protectionActivationPlatform: verified.protectionActivationPlatform,
          protectionSetupFallback: verified.protectionSetupFallback, vpnDisclosureAcknowledgedAt: verified.vpnDisclosureAcknowledgedAt,
          automaticBackupEnabled: verified.automaticBackupEnabled, reminders: { ...restored.reminders, scheduledIds: verified.reminders.scheduledIds }
        }) });
      if (current()) { resumeOwner(); journalChanged(); pendingJournalRestore.current = null; setPendingRecoveryRestore(null);
        setAccountNotice(archive.omittedPhotoCount ? 'Text backup restored. Photos were excluded from automatic backup and were not restored.'
          : result.cleanupPending ? 'History restored. Unreferenced photo cleanup needs retry.' : 'Recovery history and journal restored. Membership and device permissions keep their current verified state.'); }
    } catch (error) { if (current()) { resumeOwner(); journalChanged(); setRestoreNotice(safeUserFacingMessage(error, 'Backup restore did not complete. Current history was preserved or rollback needs retry.')); } }
    finally { restoringBackupRef.current = false; setRestoringBackup(false); }
  };

  const deleteLocalRecoveryData = React.useCallback(async () => {
    const owner = trustedPrivateOwner(getFirebaseAuthSnapshot(), getFirebaseAccountScope());
    const operation = accountOperationGate.current.begin();
    const admission=getFirebaseNativeAccountAdmission();
    if(!owner)throw Error('Connect the owning account before erasing private history.');
    privateLockedRef.current=true;setPrivateViewLocked(true);suspendOwner();
    appConfigQueue.current?.invalidate();setAppConfigSyncBusy(false);
    let nativeOperation=null;
    if(!admission){try{nativeOperation=readNativeCleanupOperation(localStorage,owner,'local');}catch{/* Corrupt references cannot be guessed or rebound. */}}
    try { if(!nativeOperation)nativeOperation=await reserveNativeCleanup({storage:localStorage,ownerUid:owner,reason:'local',admission,isCurrent:()=>operation.isCurrent()&&getFirebaseAccountScope()===owner&&getFirebaseNativeAccountAdmission()===admission,prepare:prepareNativeAccountCleanup}); }catch{/* JS erasure remains independently available. */}
    operation.assertCurrent();retireFirebaseNativeAccountSession('native-account-local-erasure');
    let nativeComplete=false;
    if(nativeOperation){try{nativeComplete=(await executeStoredNativeCleanup({storage:localStorage,operation:nativeOperation,execute:executeNativeAccountCleanup})).state==='completed';}catch{/* Retain an exact-ID retry if the result is unavailable. */}}
    operation.assertCurrent();
      const restoreDeletionEpoch = owner ? beginOwnerRestoreDeletion(localStorage, owner, 'local') : null;
      if (owner) journalMedia?.bindOwnerReferences(owner, () => []);
      cancelAutomaticBackupSync(); await disableAutomaticBackup(owner ?? undefined); operation.assertCurrent();
      // Explicit current-owner deletion never enumerates or removes another account's private namespaces.
      if (owner) {
        const claim = ownerStore?.legacyClaimOwner();
        await purgeJournalOwner(createJournalRepository({ storage: localStorage, ownerId: owner }), journalMedia); operation.assertCurrent();
        const keys = [...Object.values(RECOVERY_DRAFT_STORAGE_KEYS), ...Object.values(RECOVERY_TOOL_SESSION_STORAGE_KEYS)];
        keys.forEach(key => localStorage.removeItem(`freed.private.owner.${encodeURIComponent(owner)}.${key}`));
        if (claim === owner || claim === `deleted:${owner}`) keys.forEach(key => localStorage.removeItem(key));
        for (const prefix of ['freed.guided.access.v1.', 'freed.challenge.session.v1.', EARNED_TIME_REFERENCE_PREFIX, 'freed.clara-consent.v1.']) localStorage.removeItem(prefix + encodeURIComponent(owner));
      }
      clearCompanionPresentationHistory();
      if (!discardChallengeSession()) throw new Error('Guided progress could not be erased. Try again.');
      setRemoteRetentionPlan(null); setPendingFirebaseEmailLink(null); setPendingRecoveryRestore(null); pendingJournalRestore.current = null;
      pendingInterventionTracker.current = createPendingInterventionTracker(); consumedDeepLinkIntervention.current = null;
      setActiveAttempt(null); setSelectedChallenge(null); setProtectionSyncMessage(null); lastCueState.current = null; setCompanionCue(undefined);
      if (owner) { ownerStore?.purgeOwner(owner); resumeOwner(); journalChanged(); }
      else persistRecoveryState(createDefaultRecoveryState());
      if (owner && restoreDeletionEpoch !== null) completeOwnerRestoreDeletion(localStorage, owner, restoreDeletionEpoch);
      privateLockedRef.current=false;setPrivateViewLocked(false);
      setAccountNotice(nativeComplete?'Private history erased. Device adult-protection settings are retained.':'Private history erased. Native private cleanup needs retry; device adult-protection settings are retained.');
      accountOperationGate.current.invalidate(); setProtectionIntentState('both'); setTab('today'); setScreen('welcome');
      void reconcileFirebaseNativeAccountSession();
  }, [ownerStore, journalMedia, resumeOwner, journalChanged, persistRecoveryState, challengeSession.abandon, challengeSession.getSnapshot, discardChallengeSession]);

  const cleanupDeletedOwner = React.useCallback(async (owner: string) => {
    const confirmedReceipt = loadAccountDeletionReceipt(localStorage, owner);
    if (confirmedReceipt?.cloud !== 'completed') throw new Error('Cloud deletion must be confirmed before local cleanup.');
    const presentationOwner=getFirebaseAccountScope();
    if(presentationOwner===owner||presentationOwner===null)setAccountCleanupReceiptCache(confirmedReceipt);
    if(confirmedReceipt.nativeCleanupId){
      let nativeOperation=null;try{nativeOperation=readNativeCleanupOperation(localStorage,owner,'account',confirmedReceipt.nativeCleanupId);}catch{/* Corrupt native metadata never blocks owner-specific JS erasure. */}
      if(nativeOperation){
        if(getFirebaseAccountScope()===owner)retireFirebaseNativeAccountSession('native-account-deleted');
        try{await executeStoredNativeCleanup({storage:localStorage,operation:nativeOperation,execute:executeNativeAccountCleanup});}catch{/* Native retry remains separate from current-owner JS erasure. */}
      }
    }

    const restoreDeletionEpoch = beginOwnerRestoreDeletion(localStorage, owner, 'account');
    journalMedia?.bindOwnerReferences(owner, () => []);
    const currentOwner = getFirebaseAccountScope();
    if (currentOwner === owner || currentOwner === null) { privateCleanupOwner.current = owner; cancelAutomaticBackupSync(); accountOperationGate.current.invalidate(); privateLockedRef.current = true; setPrivateViewLocked(true); suspendOwner(); }
    await disableAutomaticBackup(owner);
    const claim = ownerStore?.legacyClaimOwner();
    const repository = createJournalRepository({ storage: localStorage, ownerId: owner });
    await purgeJournalOwner(repository, journalMedia);
    ownerStore?.purgeOwner(owner);
    const keys = [...Object.values(RECOVERY_DRAFT_STORAGE_KEYS), ...Object.values(RECOVERY_TOOL_SESSION_STORAGE_KEYS)];
    for (const key of keys) localStorage.removeItem(`freed.private.owner.${encodeURIComponent(owner)}.${key}`);
    if (claim === owner || claim === `deleted:${owner}`) keys.forEach(key => localStorage.removeItem(key));
    for (const prefix of ['freed.guided.access.v1.', 'freed.challenge.session.v1.', EARNED_TIME_REFERENCE_PREFIX, 'freed.clara-consent.v1.']) localStorage.removeItem(prefix + encodeURIComponent(owner));
    if (getFirebaseAccountScope() === owner) await signOutFirebaseAccount();
    completeOwnerRestoreDeletion(localStorage, owner, restoreDeletionEpoch);
    if (getFirebaseAccountScope() === null) { privateLockedRef.current = false; setPrivateViewLocked(false); resumeOwner(); }
    if(getFirebaseAccountScope()===owner||getFirebaseAccountScope()===null)journalChanged();
  }, [ownerStore, journalMedia, suspendOwner, resumeOwner, journalChanged]);

  const deleteFirebaseAccountAndData = React.useCallback(async (): Promise<FirebaseAccountDeletionResult> => {
    const expectedUid = deletionContinuation.current?.expectedUid;
    const assertOwner = () => { if (!expectedUid || getFirebaseAccountScope() !== expectedUid) throw new Error("The signed-in account changed. Cancel and confirm deletion again."); };
    assertOwner();
    const oldReceipt=loadAccountDeletionReceipt(localStorage,expectedUid!);
    let nativeCleanupId=oldReceipt?.nativeCleanupId;
    if(oldReceipt?.cloud!=='completed'){
      const admission=getFirebaseNativeAccountAdmission();
      const nativeOperation=await reserveNativeCleanup({storage:localStorage,ownerUid:expectedUid!,reason:'account',admission,isCurrent:()=>getFirebaseAccountScope()===expectedUid&&getFirebaseNativeAccountAdmission()===admission,prepare:prepareNativeAccountCleanup});
      if(!nativeOperation)throw Error('Native private cleanup could not be prepared. Update this build or retry before deleting the account.');
      nativeCleanupId=nativeOperation.operationId;
      saveAccountDeletionReceipt(localStorage,{version:1,ownerUid:expectedUid!,eventId:oldReceipt?.eventId??createFirebaseClientEventId('deletion'),requestedAt:oldReceipt?.requestedAt??new Date().toISOString(),cloud:oldReceipt?.cloud??'unknown',local:oldReceipt?.local??'pending',nativeCleanupId});
    }
    accountOperationGate.current.invalidate();
    setPendingRecoveryRestore(null);
    await revokeAppleAuthorizationForDeletion();
    assertOwner();
    const contracts = await getFirebaseCallableContracts();
    if (!contracts) throw new Error("Sign in to Firebase before deleting your account and hosted data.");
    const eventId = createFirebaseClientEventId('deletion');
    lastDeletionOwner.current = expectedUid!; localStorage.setItem('freed.account.deletion.latest.v1', expectedUid!);
    try {
      const receipt = await executeAccountDeletion({ storage: localStorage, ownerUid: expectedUid!, eventId, nativeCleanupId,
        request: receiptEventId => { assertOwner(); return contracts.requestAccountDeletion({ expectedAccountUid: expectedUid!, clientEventId: receiptEventId }); },
        cleanup: cleanupDeletedOwner });
      if (receipt.cloud === 'completed') { setAccountCleanupReceiptCache(receipt); if (receipt.local === 'completed') setCleanupCompletionToken({ ownerUid: receipt.ownerUid, eventId: receipt.eventId }); }
      return { ok: true, status: receipt.cloud === 'completed' ? 'completed' : 'processing' };
    } finally { refreshDeletionReceipt(value => value + 1); }
  }, [cleanupDeletedOwner]);

  const requestConfirmedAccountDeletion = React.useCallback((): Promise<FirebaseAccountDeletionResult> => {
    if (deletionContinuation.current) return Promise.reject(new Error("Account deletion confirmation is already open."));
    const expectedUid = getFirebaseAccountScope();
    if (!expectedUid || getJourneyOwner(getFirebaseAuthSnapshot()) !== expectedUid) return Promise.reject(new Error("Connect a permanent account before deleting hosted account data."));
    return new Promise((resolve, reject) => { deletionContinuation.current = { expectedUid, resolve, reject }; setConfirmingDeletion(true); });
  }, []);

  const cleanupRetryBusy = React.useRef(false);
  const retryConfirmedAccountCleanup = async (receipt: AccountDeletionReceipt) => {
    const current=loadAccountDeletionReceipt(localStorage,receipt.ownerUid);
    if(!current||current.ownerUid!==receipt.ownerUid||current.eventId!==receipt.eventId||current.cloud!=='completed')throw Error('The confirmed cleanup reference changed.');
    if (cleanupRetryBusy.current) return;
    cleanupRetryBusy.current = true;
    try {
      if(current.nativeCleanupId){let operation=null;try{operation=readNativeCleanupOperation(localStorage,current.ownerUid,'account',current.nativeCleanupId);}catch{/* Original ID remains unavailable. */}if(operation)await executeStoredNativeCleanup({storage:localStorage,operation,execute:executeNativeAccountCleanup});}
      const completed = await executeAccountDeletion({ storage: localStorage, ownerUid: receipt.ownerUid, eventId: receipt.eventId,
        request: async () => { throw new Error('Confirmed cloud deletion must not request another account deletion.'); }, cleanup: cleanupDeletedOwner });
      if(getFirebaseAccountScope()===completed.ownerUid||getFirebaseAccountScope()===null){setAccountCleanupReceiptCache(completed);if(completed.local==='completed')setCleanupCompletionToken({ownerUid:completed.ownerUid,eventId:completed.eventId});}
    } finally { cleanupRetryBusy.current = false; refreshDeletionReceipt(value => value + 1); }
  };
  const renderAccountDeletion = () => {
    const account = getFirebaseAccountSummary();
    let owner = journeyOwner ?? (getFirebaseAccountScope() === null ? lastDeletionOwner.current : null);
    if (!owner && getFirebaseAccountScope() === null) { try { owner = localStorage.getItem('freed.account.deletion.latest.v1'); } catch { /* No receipt is fabricated. */ } }
    let receipt: AccountDeletionReceipt | null = accountCleanupReceipt;
    try { if (!receipt && owner) receipt = loadAccountDeletionReceipt(localStorage, owner); } catch { /* Retain unreadable storage for explicit retry. */ }
    void deletionReceiptRevision;
    let nativeCleanupState:'pending'|'completed'|'unavailable'|'unverified'='unverified';
    if(receipt?.nativeCleanupId){try{nativeCleanupState=readNativeCleanupOperation(localStorage,receipt.ownerUid,'account',receipt.nativeCleanupId)?.state??'unavailable';}catch{nativeCleanupState='unavailable';}}
    return <AccountDeletionDestination connected={Boolean(journeyOwner)} email={account.email} receipt={receipt} nativeCleanupState={nativeCleanupState} onRetryNativeCleanup={receipt?()=>retryConfirmedAccountCleanup(receipt!):undefined}
      onSupport={() => router.push('/support')}
      onManage={() => { void Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions').catch(() => setAccountNotice('Subscription settings could not open. Try again from your store.')); }}
      onConnect={() => { enterAccountFlow(); setScreen('account'); }} onDelete={async () => {
        if (receipt?.cloud === 'completed' && receipt.local !== 'completed') {
          await retryConfirmedAccountCleanup(receipt); return;
        }
        if (receipt && receipt.ownerUid !== getFirebaseAccountScope()) throw new Error('Connect the original account to retry its unconfirmed deletion.');
        await requestConfirmedAccountDeletion();
      }} />;
  };

  React.useEffect(() => {
    if (!hydrated) return undefined;

    consumePendingIntervention();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") consumePendingIntervention();
    });

    return () => {
      subscription.remove();
    };
  }, [consumePendingIntervention, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return undefined;

    const consumeFreedLink = (url: string | null) => {
      if (consumeFirebaseEmailLink(url)) return;
      if (consumeProtectionSetupDeepLink(url)) return;
      consumeDeepLinkIntervention(url);
    };

    let cancelled = false;
    Linking.getInitialURL()
      .then((url) => {
        if (!cancelled) consumeFreedLink(url);
      })
      .catch(() => undefined);

    const subscription = Linking.addEventListener("url", ({ url }) => {
      consumeFreedLink(url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [consumeDeepLinkIntervention, consumeFirebaseEmailLink, consumeProtectionSetupDeepLink, hydrated]);

  React.useEffect(() => {
    if (!hydrated || !reminders.enabled) return undefined;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    listenForReminderResponses((route) => {
      if (route !== "checkin") return;
      setTab("today");
      setScreen("checkin");
    })
      .then((dispose) => {
        if (cancelled) dispose();
        else cleanup = dispose;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [hydrated, reminders.enabled]);

  React.useEffect(() => {
    if (!hydrated || !storageReady || !journeyOwner || !knownProtectionScope || websiteAudience?.scope !== knownProtectionScope) return;
    const owner=journeyOwner, scope=knownProtectionScope;
    const isCurrent=()=>getFirebaseAccountScope()===owner && getProtectionActionScope()===scope && !privateLockedRef.current && !accountFlowFence.current.isActive();
    return listenFirebaseNotificationOpens(() => {
      if(reminders.enabled && isCurrent()){setTab('today');setScreen('checkin');}
    }, {
      isCurrent,
      readCurrentWebsiteAudience:()=>isCurrent() && websiteAudienceRef.current?.scope===scope ? websiteAudienceRef.current.audience : null,
      onWebsiteRecovery:enqueueWebsiteRecovery
    });
  }, [hydrated, storageReady, journeyOwner, knownProtectionScope, websiteAudience?.scope, websiteAudience?.audience, reminders.enabled, enqueueWebsiteRecovery, getProtectionActionScope]);


  React.useEffect(() => {
    const receipt = challengeSession.session;
    if (!hydrated || !challengeSession.hydrated || receipt?.phase !== "completed" || !receipt.completion) return;
    // A stored reference is inert until native revalidation. Keep its completion for repair/start/readback.
    try { if (readEarnedTimeReference(localStorage, receipt.ownerId)?.sessionId === receipt.id) return; }
    catch { setChallengeBreakNotice(appI18n.t('earnedTime.resumeSaveFailed', { defaultValue: 'Your guided access is kept. Free some storage and retry saving this reset.' })); return; }
    // A restored completion repairs recovery history only. It cannot create fresh native unlock authority.
    // The separately revalidated device-local reference above is not restored history.
    if (screen === "challenge") return;
    try {
      persistRecoveryState(current => recordChallengeCompletion(current, receipt.challenge, new Date(receipt.completion!.completedAtMs).toISOString(), undefined, receipt.completion!.outcome, receipt.id, receipt.elapsedMs / 1000, receipt.completion?.provenance));
      if (!discardChallengeSession()) return;
    } catch { setProtectionSyncMessage("A completed reset is waiting to be saved. Your receipt was preserved."); }
  }, [hydrated, challengeSession.hydrated, challengeSession.session?.id, challengeSession.session?.phase, screen, persistRecoveryState, challengeSession.abandon]);

  const requestWebsiteProtectionChange = (enabled: boolean) => {
    if (adultToggleRunning.current) return;
    if (enabled) {
      const scope = getProtectionActionScope();
      setWebsiteActivationRequest(scope ? { id: ++adultToggleRequest.current, scope } : null);
      setProtectionIntent('websites'); setScreen('protectionSetup'); return;
    }
    const scope = getProtectionActionScope();
    if (!scope) { setProtectionSyncMessage('Sign in before changing device protection.'); return; }
    const ticket = captureProtectionActionTicket(scope);
    Alert.alert('Turn off adult website protection?', 'Your selected apps and saved activities will stay unchanged.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Turn off', style: 'destructive', onPress: () => { void (async () => {
        if (adultToggleRunning.current || !ticket.isCurrent()) return;
        adultToggleRunning.current = true;
        const request = ++adultToggleRequest.current;
        setAdultToggleBusy(true); setProtectionSyncMessage(null);
        const current = () => protectionHostAlive.current && request === adultToggleRequest.current && ticket.isCurrent();
        try {
          const result = await websiteSetupWriter.enqueue(() => disableAdultProtection({
            isCurrent: current, stopPolicy: stopAdultContentFilter,
            removeDns: async () => { const operation = await adultDnsControl.configure(false); return { accepted: operation.accepted && !operation.superseded, status: await adultDnsControl.refresh() }; },
            readPolicy: async () => { const fresh = await refreshProtectionStatus(); return fresh.superseded ? null : fresh.status; },
            readDns: adultDnsControl.refresh,
          }));
          if (current()) {
            await refreshProtectionStatus();
            if (current() && result === 'needs-attention') setProtectionSyncMessage('Website protection could not be fully turned off. Review the remaining layers.');
          }
        } catch { if (current()) setProtectionSyncMessage('Website protection could not be fully turned off. Review the remaining layers.'); }
        finally { if (request === adultToggleRequest.current) { adultToggleRunning.current = false; if (protectionHostAlive.current) setAdultToggleBusy(false); } }
      })(); } },
    ]);
  };

  const getCompletedBreakAttempt = (sessionId: string, includeRequested = false): NativeInterventionAttempt | null => {
    const receipt = challengeSession.getSnapshot().session;
    const origin = challengeBreakOrigin.current;
    const currentAttempt = activeAttemptRef.current;
    if (!journeyOwner || getFirebaseAccountScope() !== journeyOwner || !origin?.saved || (!includeRequested && origin.breakRequested) ||
      origin.ownerUid !== journeyOwner || origin.sessionId !== sessionId || receipt?.id !== sessionId || receipt.ownerId !== journeyOwner || receipt.phase !== "completed" || !receipt.completion ||
      origin.attempt?.nativeInterventionId !== currentAttempt?.nativeInterventionId || JSON.stringify(origin.attempt?.scope) !== JSON.stringify(currentAttempt?.scope) ||
      !recoveryStateRef.current.challengeHistory.some(entry => entry.sessionId === sessionId && entry.completedAt === new Date(receipt.completion!.completedAtMs).toISOString()) ||
      !getProtectionChallengeCompletionDecision(origin.attempt, "unknown").grantEarnedUnlock) return null;
    if (origin.earnedTime) {
      const local = prepareLiveEarnedAppTimeGrant({ origin, session: receipt, owner: journeyOwner, ownerLease: appConfigReadScope.current.ownerLease, storageReady: appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady,
        currentAttempt, durableHistory: recoveryStateRef.current.challengeHistory, methodAvailable: isEarnedAppTimeAvailable() });
      if (!local.eligible) return null;
    } else if (origin.attempt?.scope?.kind === 'android-app-group' || origin.attempt?.scope?.kind === 'ios-app-group') {
      const local = prepareLiveResetGroupReward({ origin, session: receipt, owner: journeyOwner, ownerLease: appConfigReadScope.current.ownerLease, storageReady: appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady,
        currentAttempt, durableHistory: recoveryStateRef.current.challengeHistory, methodAvailable: isResetAppGroupRewardMethodAvailable() });
      if (!local.eligible) return null;
    }
    return origin.attempt;
  };
  const persistEarnedTemplateChoice = (challenge: RecoveryChallenge): boolean => {
    const origin = challengeBreakOrigin.current;
    if (!origin?.earnedTime) return true;
    if (!liveResetOwnerCurrent(origin, journeyOwner, appConfigReadScope.current.ownerLease, appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady) || getFirebaseAccountScope() !== journeyOwner || origin.earnedTime.request) return false;
    const template = captureEarnedResetTemplate(challenge);
    if (!template || !origin.earnedTime.receipt.offer || !matchesEarnedResetTemplate(challenge, template, origin.earnedTime.receipt.offer)) return false;
    try { writeEarnedTimeReference(localStorage, origin.ownerUid, makeEarnedTimeReference(origin, challenge)); return true; }
    catch { setChallengeBreakNotice(appI18n.t('earnedTime.resumeSaveFailed', { defaultValue: 'Your guided access is kept. Free some storage and retry saving this reset.' })); return false; }
  };
  const bindLiveRewardTemplate = (sessionId: string, challenge: RecoveryChallenge) => {
    const origin = challengeBreakOrigin.current;
    const session = challengeSession.getSnapshot().session;
    if (!origin || origin.rewardRequest || origin.sessionId !== sessionId || session?.id !== sessionId || session.challenge.id !== challenge.id ||
      !liveResetOwnerCurrent(origin, journeyOwner, appConfigReadScope.current.ownerLease, appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady) || getFirebaseAccountScope() !== journeyOwner) return;
    if (origin.earnedTime) { if (!origin.earnedTime.request) {origin.earnedTime.templateBinding = captureEarnedResetTemplate(challenge);origin.earnedTime.nativeEvidence=undefined;} }
    else origin.templateBinding = captureMomentumRewardTemplate(challenge);
  };
  const getChallengeRewardPreview = (challenge: RecoveryChallenge): 120 | 300 | 600 | 1200 | null => {
    const origin = challengeBreakOrigin.current;
    if (origin?.earnedTime) {
      const offer = origin.earnedTime.receipt.offer;
      const template = captureEarnedResetTemplate(challenge) ?? origin.earnedTime.templateBinding;
      return offer && Date.parse(offer.validUntil) > Date.now() && isEarnedAppTimeAvailable() && getFirebaseAccountScope() === journeyOwner && liveResetOwnerCurrent(origin, journeyOwner, appConfigReadScope.current.ownerLease, appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady) && origin.attempt?.nativeInterventionId === activeAttemptRef.current?.nativeInterventionId && JSON.stringify(origin.attempt?.scope) === JSON.stringify(activeAttemptRef.current?.scope) && matchesEarnedResetTemplate(challenge, template, offer) ? offer.requestedSeconds : null;
    }
    if (!origin || !isResetAppGroupRewardMethodAvailable() || !liveResetOwnerCurrent(origin, journeyOwner, appConfigReadScope.current.ownerLease, appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady) || getFirebaseAccountScope() !== journeyOwner ||
      !getProtectionChallengeCompletionDecision(origin.attempt, 'unknown').grantEarnedUnlock || !origin.attempt?.nativeInterventionId || origin.attempt.nativeInterventionId !== activeAttemptRef.current?.nativeInterventionId || JSON.stringify(origin.attempt.scope) !== JSON.stringify(activeAttemptRef.current?.scope) ||
      (origin.attempt.scope?.kind !== 'android-app-group' && origin.attempt.scope?.kind !== 'ios-app-group')) return null;
    const template = captureMomentumRewardTemplate(challenge) ?? (matchesMomentumRewardTemplate(challenge, origin.templateBinding) ? currentMomentumRewardTemplate(challenge) : null);
    return template && template.category !== 'find' ? getResetRewardCapSeconds(template.category, 1) : null;
  };
  const getChallengeRewardLabel = (challenge: RecoveryChallenge): string | null => {
    const kind = challengeBreakOrigin.current?.attempt?.scope?.kind;
    if (kind !== 'android-app-group' && kind !== 'ios-app-group') return null;
    const seconds = getChallengeRewardPreview(challenge);
    if (challengeBreakOrigin.current?.earnedTime) return seconds ? challenge.verification?.kind==='steps'?appI18n.t('earnedTime.previewSteps',{defaultValue:'{{minutes}}-minute break after {{steps}} observed steps',minutes:seconds/60,steps:challenge.verification.minSteps}):challenge.verification?.kind==='photo'?appI18n.t('earnedTime.previewPhotos',{defaultValue:'{{minutes}}-minute break after {{count}} fresh target matches',minutes:seconds/60,count:challengeBreakOrigin.current.earnedTime.receipt.offer?.requiredDistinctPhotoTargets}):appI18n.t('earnedTime.preview', { defaultValue: '{{minutes}}-minute break after {{seconds}} active seconds', minutes: seconds / 60, seconds: challenge.durationSec }) : appI18n.t('earnedTime.unavailableActivity', { defaultValue: 'This activity does not earn app time. Your guided reset is still available.' });
    return seconds ? appI18n.t('resetReward.preview', { defaultValue: '{{minutes}} min app break on request after this reset', minutes: seconds / 60 })
      : appI18n.t('resetReward.unavailable', { defaultValue: 'App break unavailable for this activity; the reset is still available.' });
  };
  const saveCompletedChallenge = (challenge: RecoveryChallenge, outcome: ChallengeFeedbackOutcome, receipt: { id: string; completedAtMs: number }): boolean => {
    const currentReceipt = challengeSession.getSnapshot().session;
    const completionOwner = journeyOwner;
    if (!completionOwner || getFirebaseAccountScope() !== completionOwner || !getProtectionActionScope() || accountFlowFence.current.isActive() || currentReceipt?.id !== receipt.id || currentReceipt.ownerId !== completionOwner || currentReceipt.challenge.id !== challenge.id || currentReceipt.completion?.completedAtMs !== receipt.completedAtMs || currentReceipt.phase !== "completed") return false;
    const origin = challengeBreakOrigin.current;
    const originalAttempt = origin?.ownerUid === completionOwner && origin.sessionId === receipt.id ? origin.attempt : null;
    try {
      persistRecoveryState(current => recordChallengeCompletion(current, challenge, new Date(receipt.completedAtMs).toISOString(), unlockSourceForAttempt(originalAttempt), outcome, receipt.id, currentReceipt.elapsedMs / 1000, currentReceipt.completion?.provenance));
    } catch {
      setProtectionSyncMessage("Completed reset could not be saved. Your completion receipt is kept for retry.");
      return false;
    }
    if (!guidedAccess.end(receipt.id)) return false;
    if (origin?.ownerUid === completionOwner && origin.sessionId === receipt.id) origin.saved = true;
    return true;
  };
  const requestCompletedAppBreak = async (sessionId: string): Promise<boolean> => {
    const completionAttempt = getCompletedBreakAttempt(sessionId);
    const receipt = challengeSession.getSnapshot().session;
    const origin = challengeBreakOrigin.current;
    const completionOwner = journeyOwner;
    if (!completionAttempt || !receipt || !origin || !completionOwner || origin.breakInFlight) return false;
    const actionScope = getProtectionActionScope();
    if (actionScope === null || origin.nativeActionScope!==undefined&&origin.nativeActionScope!==actionScope) return false;
    const actionTicket = captureProtectionActionTicket(actionScope);
    const isCurrent = () => actionTicket.isCurrent() && challengeBreakOrigin.current === origin && !accountFlowFence.current.isActive() && getCompletedBreakAttempt(sessionId, true) === completionAttempt;
    const groupScope = completionAttempt.scope?.kind === 'android-app-group' || completionAttempt.scope?.kind === 'ios-app-group' ? completionAttempt.scope : null;
    if (groupScope && origin.earnedTime) {
      const earned = origin.earnedTime, offer = earned.receipt.offer;
      const local = prepareLiveEarnedAppTimeGrant({ origin, session: receipt, owner: completionOwner, ownerLease: appConfigReadScope.current.ownerLease, storageReady: appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady,
        currentAttempt: activeAttemptRef.current, durableHistory: recoveryStateRef.current.challengeHistory, methodAvailable: isEarnedAppTimeAvailable() });
      if (!offer || !local.eligible || (earned.actionScope !== undefined && earned.actionScope !== actionScope)) return false;
      if (!earned.request) { earned.request = local.request; earned.actionScope = actionScope; }
      try { writeEarnedTimeReference(localStorage, completionOwner, makeEarnedTimeReference(origin)); }
      catch { setChallengeBreakNotice(appI18n.t('earnedTime.resumeSaveFailed', { defaultValue: 'Your guided access is kept. Free some storage and retry saving this reset.' })); return false; }
      const request = earned.request;
      origin.breakInFlight = true;
      setChallengeBreakNotice(appI18n.t('earnedTime.requesting', { defaultValue: 'Starting the break for your original app…' }));
      try {
        const binding = await setAppGroupActionScope(actionScope);
        if (!isCurrent()) return false;
        if (!isAppGroupBindingConfirmed(binding) || binding.generation !== offer.configurationGeneration || binding.scopeEpoch !== offer.scopeEpoch) { setChallengeBreakNotice(appI18n.t('earnedTime.retryBreak', { defaultValue: 'The app break was not confirmed. Retry uses the same request and never extends it.' })); return false; }
        const native = validateEarnedAppTimeGrantReceipt(await grantEarnedAppTimeBreak(request, actionScope, offer), request, offer);
        if (!isCurrent()) return false;
        if (!native?.accepted) { setChallengeBreakNotice(appI18n.t('earnedTime.retryBreak', { defaultValue: 'The app break was not confirmed. Retry uses the same request and never extends it.' })); return false; }
        earned.grantReceipt = Object.freeze(native); origin.breakRequested = true;
        if (Date.parse(native.expiresAt!) <= Date.now()) { setChallengeBreakNotice(appI18n.t('earnedTime.expired', { defaultValue: 'This app break has ended. Your completed activity is saved.' })); return false; }
        if (!native.effective) { setChallengeBreakNotice(appI18n.t('earnedTime.restricted', { defaultValue: 'Your break was recorded, but another rule still restricts this app. No extra time was charged again.' })); return false; }
        setChallengeBreakNotice(appI18n.t('earnedTime.confirmed', { defaultValue: 'Your {{minutes}}-minute break has started. Protection returns when it ends.', minutes: native.seconds! / 60 })); return true;
      } catch { if (isCurrent()) setChallengeBreakNotice(appI18n.t('earnedTime.retryBreak', { defaultValue: 'The app break was not confirmed. Retry uses the same request and never extends it.' })); return false; }
      finally { origin.breakInFlight = false; if (isCurrent()) { void refreshProtectionStatus(actionTicket); void refreshAppGroupConfiguration(); } }
    }
    if (groupScope) {
      const local = prepareLiveResetGroupReward({ origin, session: receipt, owner: completionOwner, ownerLease: appConfigReadScope.current.ownerLease, storageReady: appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady,
        currentAttempt: activeAttemptRef.current, durableHistory: recoveryStateRef.current.challengeHistory, methodAvailable: isResetAppGroupRewardMethodAvailable() });
      if (!local.eligible || (origin.rewardActionScope !== undefined && origin.rewardActionScope !== actionScope)) return false;
      if (!origin.rewardRequest) { origin.rewardRequest = local.request; origin.rewardActionScope = actionScope; }
      // Only native checks consumption/stacking. A lost reply replays these exact
      // immutable bytes and scope; it never chooses a new deadline or category.
      const request = origin.rewardRequest;
      origin.breakInFlight = true;
      setChallengeBreakNotice(appI18n.t('resetReward.requesting', { defaultValue: 'Requesting an app break for the original app…' }));
      try {
        const binding = await setAppGroupActionScope(actionScope);
        if (!isCurrent()) return false;
        if (!isAppGroupBindingConfirmed(binding) || binding.generation !== request.configurationGeneration || binding.scopeEpoch !== request.scopeEpoch) { setChallengeBreakNotice(appI18n.t('resetReward.retry', { defaultValue: 'App break not confirmed. Retry checks the same request without extending it.' })); return false; }
        const native = validateResetAppGroupRewardReceipt(await grantResetAppGroupBreak(request, actionScope), request);
        if (!isCurrent()) return false;
        if (!native?.accepted) {
          setChallengeBreakNotice(appI18n.t('resetReward.retry', { defaultValue: 'App break not confirmed. Retry checks the same request without extending it.' })); return false;
        }
        origin.rewardReceipt = Object.freeze(native); origin.breakRequested = true;
        if (Date.parse(native.expiresAt!) <= Date.now()) {
          setChallengeBreakNotice(appI18n.t('resetReward.expired', { defaultValue: 'This app break has ended. Your completed activity is saved.' })); return false;
        }
        if (!native.effective) {
          setChallengeBreakNotice(appI18n.t('resetReward.restricted', { defaultValue: 'This app break was accepted. Another rule still restricts the app. Your completed activity is saved.' })); return false;
        }
        setChallengeBreakNotice(appI18n.t('resetReward.confirmed', { defaultValue: 'Your {{minutes}} minute app break was confirmed. Protection returns when it ends.', minutes: native.seconds! / 60 })); return true;
      } catch {
        if (isCurrent()) setChallengeBreakNotice(appI18n.t('resetReward.retry', { defaultValue: 'App break not confirmed. Retry checks the same request without extending it.' })); return false;
      } finally { origin.breakInFlight = false; if (isCurrent()) void refreshProtectionStatus(actionTicket); }
    }
    // Retained nongroup legacy behavior keeps its existing duration/confirmation
    // contract. It does not become a version1 group reward or acquire group scope.
    origin.breakRequested = true;
    setChallengeBreakNotice("Requesting an app break for the original app…");
    const current = recoveryStateRef.current;
    const completionDecision = getProtectionChallengeCompletionDecision(completionAttempt, "unknown");
    const staged = recordEarnedUnlock(current, receipt.challenge, {
      startedAt: canonicalAppBreakStartedAt(new Date().toISOString(), Platform.OS),
      durationMinutes: current.disciplineSettings.unlockDurationMinutes,
      nativeInterventionId: completionAttempt.nativeInterventionId,
      sourceAttemptHost: completionAttempt.scope?.kind === "android-surface" ? undefined : unlockSourceForAttempt(completionAttempt)
    });
    const requestedUnlock = staged.earnedUnlocks.find(unlock => !current.earnedUnlocks.some(existing => existing.id === unlock.id));
    if (!requestedUnlock || !requiresNativeUnlockConfirmation(requestedUnlock, Platform.OS)) {
      setChallengeBreakNotice("App break unavailable. Your completed activity is saved."); return false;
    }
    try {
      if (!isAppGroupBindingConfirmed(await setAppGroupActionScope(actionScope)) || !isCurrent()) { setChallengeBreakNotice('App break unavailable. Your completed activity is saved.'); return false; }
      const status = completionDecision.applyFocusShieldScope && completionAttempt.scope?.kind === "android-surface"
        ? await applyFocusShieldEarnedUnlock(requestedUnlock.expiresAt, completionAttempt.scope, requestedUnlock.nativeInterventionId)
        : await applyEarnedUnlockWindow(requestedUnlock.expiresAt, requestedUnlock.sourceAttemptHost, requestedUnlock.nativeInterventionId);
      if (!isCurrent()) return false;
      if(status.nativeConfigurationError==='native-account-scoped-legacy-unavailable'){setChallengeBreakNotice('App break unavailable. Your completed activity is saved.');return false;}
      setProtectionStatus(status);
      if (!nativeGrantConfirmsUnlock(requestedUnlock, status, Platform.OS)) {
        setChallengeBreakNotice("App break unavailable. Your completed activity is saved."); return false;
      }
      persistRecoveryState(state => {
        if (!state.challengeHistory.some(entry => entry.sessionId === sessionId) || state.earnedUnlocks.some(unlock => unlock.id === requestedUnlock.id) || Date.parse(requestedUnlock.expiresAt) <= Date.now()) return state;
        return recordEarnedUnlock(state, receipt.challenge, { startedAt: requestedUnlock.startedAt, durationMinutes: requestedUnlock.durationMinutes, sourceAttemptHost: requestedUnlock.sourceAttemptHost, nativeInterventionId: requestedUnlock.nativeInterventionId });
      });
      setChallengeBreakNotice("Your app break was confirmed. Protection returns when it ends.");
      return true;
    } catch {
      if (isCurrent()) setChallengeBreakNotice("The app break could not be confirmed or recorded. Your completed activity is saved; check Protect for current status.");
      return false;
    } finally { if (isCurrent()) void refreshProtectionStatus(actionTicket); }
  };

  const renderAccountHost = (suspended = false): React.ReactNode => (
    <AccountAccessHost
      key={accountHostGeneration.current}
      visible={!suspended && (accountFlowFence.current.isActive() || (!auxiliaryRoute && !deferredAuxiliaryRoute && guardJourneyRoute(screen, getJourneyPolicy()) === "account"))}
      onFlowInteraction={beginAccountFlow}
      requiredEntry={!accountReturnToProfile || !getJourneyOwner(journeyAuth)}
      authUnavailableReason={journeyAuth.status === "unavailable" ? journeyAuth.reason : undefined}
      onRetryAuth={retryFirebaseAuthSnapshot}
      initialEmail={recoveryState.signedInEmail ?? ""}
      onSwitchAccount={async () => { await signOutRecoveryAccount(); setScreen("account"); }}
      linkExisting={accountReturnToProfile && getFirebaseAccountSummary().signedIn && !getFirebaseAccountSummary().anonymous}
      onConnected={(email) => {
        if (accountReturnToProfile && profileAccountOrigin.current && !isProfileAccountOriginCurrent()) return;
        setRecoveryState((current) => markAccountStepCompleted(current, { email }));
        setProtectionSyncMessage(email ? `Account connected for ${email}. Set up optional encrypted backup with a passphrase and upload in Profile.` : "Account connected. Set up optional encrypted backup with a passphrase and upload in Profile.");
        if (accountReturnToProfile) { setAccountNotice("Your account is connected"); setAccountReturnToProfile(false); if (!returnFromProfileAccount()) { setTab("profile"); setScreen("main"); } }
        else { const destination = getJourneyDestination(getJourneyPolicy()); setScreen(destination === "account" ? "account" : destination); }
      }}
      onSkip={() => {
        if (accountReturnToProfile && getJourneyOwner(journeyAuth)) { setAccountReturnToProfile(false); if (!returnFromProfileAccount()) setScreen("main"); }
        else { setAccountReturnToProfile(false); setScreen("welcome"); }
      }}
    />
  );

  const renderScreen = (screen: Screen, tab: Tab, shieldSection?: FreedShieldSection, featureId?: string, profileSection?: FreedProfileSection): React.ReactNode => {
    if (showAccountCleanupRecovery) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {renderAccountDeletion()}
      {accountCleanupReceipt?.local === 'completed' ? <PillButton label="Back to Welcome" onPress={() => { setCleanupCompletionToken(null); setScreen('welcome'); }} /> : null}
    </SafeAreaView>;
    if (rollbackPending) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
      <Text accessibilityRole="alert" style={{ color: colors.text, lineHeight: 24 }}>{ownerCleanupPending ? 'Private data cleanup is pending. Retry deletion before opening this history.' : 'An interrupted backup restore needs rollback before your private history can open. Saved data was kept.'}</Text>
      <PillButton label={ownerCleanupPending ? 'Retry local cleanup' : 'Retry backup rollback'} onPress={() => {
        if (ownerCleanupPending === 'account') router.push('/account-deletion');
        else if (ownerCleanupPending === 'local') { void deleteLocalRecoveryData().catch(error => setAccountNotice(safeUserFacingMessage(error, 'Private data cleanup needs retry before this history can open.'))); }
        else resumeOwner();
      }} />
    </SafeAreaView>;
    if (privateViewLocked) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
      <ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={{ color: colors.text, lineHeight: 24 }}>Signing out…</Text>
    </SafeAreaView>;
    const guarded = guardJourneyRoute(screen, getJourneyPolicy(), accountFlowFence.current.isActive());
    if (guarded !== screen) return renderScreen(guarded, tab, shieldSection, featureId, profileSection);
    const backFromFeature = () => { if (router.canGoBack()) router.back(); else router.replace("/flow/features"); };
    const openFeature = (id: FeatureId) => {
      const definition = FEATURE_DEFINITIONS.find(item => item.id === id)!;
      const destination = FEATURE_DESTINATIONS[id];
      if (definition.premium && !licensedFeatures) { openPaywall(id); return; }
      if (destination.kind === "guided") { startStandaloneChallenge(); return; }
      if (destination.kind === "screen") { if (id === "personalize") setQuizIndex(0); setScreen(destination.screen); return; }
      if (destination.kind === "shield") { router.push(`/shield/${destination.section}`); return; }
      if (destination.kind === "setup") { setProtectionIntent(destination.intent); setScreen("protectionSetup"); return; }
      if (destination.kind === "preferences") { router.push("/preferences"); return; }
      router.push({ pathname: "/flow/feature", params: { feature: id } });
    };
    let focusedSection: string | undefined;
    let initialPracticeKey: DailyHabitKey | undefined;
    let chosenProtectionGoal: ProtectionIntent | undefined;
    try { if (typeof localStorage !== "undefined" && localStorage.getItem(PROTECTION_INTENT_STORAGE_KEY)) chosenProtectionGoal = protectionIntent; } catch { /* A storage failure cannot invent a chosen protection goal. */ }
    if (screen === "feature") {
      const id = parseFeatureId(featureId);
      if (!id) screen = "features";
      else {
        const destination = FEATURE_DESTINATIONS[id];
        const definition = FEATURE_DEFINITIONS.find(item => item.id === id)!;
        if (definition.premium && !licensedFeatures && !(destination.kind === "focus" && destination.tab === "progress")) return <View style={{padding:24,gap:16}}><Text>Verify membership to open this report.</Text><PillButton label="Manage membership" onPress={() => { openPaywall(id); }} /><PillButton label="All features" onPress={() => setScreen("features")} /></View>;
        if (destination.kind === "screen") { screen = destination.screen; }
        else if (destination.kind === "guided") { screen = "ad"; }
        else if (destination.kind === "focus") { screen = "main"; tab = destination.tab; focusedSection = destination.section; }
        else if (destination.kind === "practice") { screen = "main"; tab = "today"; focusedSection = "practice"; initialPracticeKey = destination.key; }
        else if (destination.kind === "practices") { screen = "main"; tab = "today"; focusedSection = "practices"; }
        else return <View style={{padding:24,gap:16}}><Text>Open this feature from All features.</Text><PillButton label="All features" onPress={() => setScreen("features")} /></View>;
      }
    }
    if (screen === "features") {
      const readiness = getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'both', disciplineSettings.appGuardMode);
      return <AppBackground><SafeAreaView style={{flex:1}}><FeatureDirectory context={{platform:protectionCapability?.platform ?? (Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web" ? Platform.OS : "unknown"),auth:journeyAuth,membership:membershipSnapshot,reviewAccess:reviewAccess.snapshot,websiteStatus:readiness.websiteProtection.status,appStatus:readiness.appLimits.status,remindersEnabled:reminders.enabled,backupEnabled:recoveryState.automaticBackupEnabled,analyticsEnabled:recoveryState.analyticsSharing.enabled}} onOpen={openFeature} onBack={() => { if (router.canGoBack()) router.back(); else { setTab("today"); setScreen("main"); } }} /></SafeAreaView></AppBackground>;
    }
    if (screen === "movement") return <AppBackground><SafeAreaView style={{flex:1}}><BasicMovementScreen recordedDateKey={recoveryState.dailyHabits.find(item => item.dateKey === getLocalDateKey(new Date()) && item.key === "exercise" && item.completed)?.dateKey ?? null} recorded={recoveryState.dailyHabits.some(item => item.dateKey === getLocalDateKey(new Date()) && item.key === "exercise" && item.completed)} onRecord={dateKey => { const recordedAt = new Date(); if (dateKey !== getLocalDateKey(recordedAt)) throw new Error("The day changed. Try recording again."); persistRecoveryState(current => recordDailyHabitCompletion(current, {key:"exercise",label:"Exercise",completed:true}, recordedAt.toISOString())); }} onBack={backFromFeature} /></SafeAreaView></AppBackground>;
    if (screen === "splash") {
      return <SplashScreen onHelp={() => { if (!accountFlowFence.current.isActive()) setPublicBasicHelp(true); }} hold={getJourneyPolicy().auth.status === "hydrating"} onDone={() => setScreen(getJourneyDestination(getJourneyPolicy()))} />;
    }
    if (screen === "welcome") {
      return (
        <WelcomeScreen
          onHelp={() => { if (!accountFlowFence.current.isActive()) setPublicBasicHelp(true); }}
          onStart={() => { setQuizIndex(0); setRecoveryState(current => ({ ...current, journey: { entry: "new", introCompletedAt: null } })); setScreen("quiz"); }}
          onSkip={() => { enterAccountFlow(); setAccountReturnToProfile(false); setRecoveryState(current => ({ ...current, journey: { ...current.journey, entry: "existing" } })); setScreen("account"); }}
        />
      );
    }
    if (screen === "quiz") {
      return (
        <QuizScreen
          index={quizIndex}
          answers={answers}
          onBack={() => {
            if (quizIndex === 0) setScreen(getJourneyOwner(journeyAuth) && recoveryState.hasCompletedOnboarding ? "main" : "welcome");
            else setQuizIndex((index) => index - 1);
          }}
          onAnswer={(answer) => {
            setRecoveryState((current) => {
              const next = [...current.answers];
              next[quizIndex] = answer;
              return { ...current, answers: next };
            });
            if (quizIndex >= quiz.length - 1) setScreen("planCalculation");
            else setQuizIndex(quizIndex + 1);
          }}
        />
      );
    }
    if (screen === "planCalculation") {
      return (
        <PlanCalculationScreen
          answers={answers}
          onContinue={() => {
            if (answers.length !== quiz.length || answers.some(answer => !answer)) { setQuizIndex(0); setScreen("quiz"); return; }
            const completeIntro = (current: RecoveryState): RecoveryState => ({ ...ensureOnboardingComplete(current), journey: { entry: "new", introCompletedAt: new Date().toISOString() } });
            try { persistRecoveryState(completeIntro); } catch { setRecoveryState(completeIntro); setJourneyRecoverySaveNotice("Your answers are kept for this session, but could not be saved. Retry local saving before your next restart."); }
            if (!getJourneyOwner(journeyAuth)) enterAccountFlow();
            setScreen(getJourneyOwner(journeyAuth) ? "paywall" : "account");
          }}
        />
      );
    }
    if (screen === "appSelection") {
      return (
        <AppSelectionScreen
          initialPackages={disciplineSettings.blockedAppPackages}
          onBack={() => {
            if (appSelectionReturnToProtectionSetup) {
              setAppSelectionReturnToProtectionSetup(false);
              setScreen("protectionSetup");
              return;
            }
            setScreen(answers.length > 0 ? "planCalculation" : "welcome");
          }}
          onContinue={(packages) => {
            const returnToProtectionSetup = appSelectionReturnToProtectionSetup;
            setRecoveryState((current) => completeOnboardingWithSelectedApps(current, current.answers, packages));
            if (returnToProtectionSetup) {
              setScreen("protectionSetup");
              return;
            }
            setScreen(getJourneyDestination(getJourneyPolicy()));
          }}
        />
      );
    }
    if (screen === "paywall") {
      return (
        <FunctionalPaywallScreen
          onHelp={() => { if (!accountFlowFence.current.isActive()) setPublicBasicHelp(true); }}
          busy={purchaseBusy}
          notice={purchaseNotice}
          onSubscribe={(planId) => { void runMembershipAction(planId); }}
          onRestore={() => { void runMembershipAction(null); }}
          onClose={() => {
            acknowledgeJourneyOffer("free");
            returnFromPaywall();
          }}
        />
      );
    }
    // Account access belongs to the provider host, never an Expo route leaf.
    if (screen === "account") return null;
    if (screen === "protectionSetup") {
      if (protectionStatus?.protectionConfigurationResetDisabled === true) return <ProtectionReactivation onClose={() => {setTab('shield');setScreen('main');}} onResume={() => resumeProtectionAfterReset(activateProtectionConfiguration, syncAppProtection, refreshProtectionStatus)} />;
      if (protectionIntent !== "both") return <ProtectionFeatureSetup activationRequest={websiteActivationRequest} onActivationHandled={id => setWebsiteActivationRequest(current => current?.id === id ? null : current)} onOpenAdvancedProtection={openAdvancedProtection} getActionScope={getProtectionActionScope} nativeReadRevision={protectionReadRevision} intent={protectionIntent} capability={protectionCapability} status={protectionStatus} appCount={disciplineSettings.blockedAppPackages.length} onRefresh={refreshProtectionStatus} onChooseApps={() => { if (protectionCapability?.appGroups) openAppGroups(); else { setAppSelectionReturnToProtectionSetup(true); setScreen("appSelection"); } }} dailyLimitMinutes={disciplineSettings.dailyLimitMinutes} onDailyLimitChange={dailyLimitMinutes => persistRecoveryState(current => updateDisciplineSettings(current, { dailyLimitMinutes }))} appGuardMode={disciplineSettings.appGuardMode} onAppGuardSave={saveAppGuardMode} onSyncApps={() => protectionCapability?.appGuardModes === true ? saveAppGuardMode(recoveryStateRef.current.disciplineSettings.appGuardMode) : syncAppProtection()} onClose={() => { setTab("shield"); setScreen("main"); }} vpnDisclosureAcknowledged={Boolean(recoveryState.vpnDisclosureAcknowledgedAt)} onAcknowledgeVpnDisclosure={() => persistRecoveryState(current => markVpnDisclosureAcknowledged(current))} />;
      return (
        <ProtectionSetupScreen
          onOpenAdvancedProtection={openAdvancedProtection}
          protectionCapability={protectionCapability}
          protectionStatus={protectionStatus}
          protectionSyncMessage={protectionSyncMessage}
          selectedAppPackageCount={disciplineSettings.blockedAppPackages.length}
          appGuardMode={disciplineSettings.appGuardMode}
          userAllowedDomains={disciplineSettings.userAllowedDomains}
          appSelectionReturnPending={appSelectionReturnToProtectionSetup}
          vpnDisclosureAcknowledged={Boolean(recoveryState.vpnDisclosureAcknowledgedAt)}
          onAcknowledgeVpnDisclosure={() =>
            setRecoveryState((current) => markVpnDisclosureAcknowledged(current))
          }
          setupFallbackAcknowledged={hasProtectionSetupFallback(
            recoveryState,
            getRuntimeProtectionActivationPlatform()
          )}
          onAcknowledgeSetupFallback={(reason) => {
            setRecoveryState((current) =>
              markProtectionSetupFallback(current, getRuntimeProtectionActivationPlatform(), reason)
            );
            setProtectionSyncMessage(
              "Protection setup is incomplete on this device. FREED is running with the protection that is available."
            );
            setScreen("main");
          }}
          onRefresh={refreshProtectionStatus}
          onSyncAppPackages={() => protectionCapability?.appGuardModes === true ? saveAppGuardMode(recoveryStateRef.current.disciplineSettings.appGuardMode) : syncAppProtection()}
          onChooseApps={() => {
            if (protectionCapability?.appGroups === true) { openAppGroups(); return; }
            setAppSelectionReturnToProtectionSetup(true);
            setScreen("appSelection");
          }}
          onAppSelectionReturnHandled={() => setAppSelectionReturnToProtectionSetup(false)}
          onContinue={() => {
            setRecoveryState((current) =>
              markProtectionActivated(current, getRuntimeProtectionActivationPlatform())
            );
            setScreen("main");
          }}
        />
      );
    }
    if (screen === "library") {
      return (
        <AppBackground>
          <SafeAreaView style={{ flex: 1 }}>
            <LibraryScreen
              onBack={() => {
                setTab("today");
                setScreen("main");
              }}
              onBreathing={() => setScreen("breathing")}
              onChallenge={() => startStandaloneChallenge()}
              onCustomChallenge={() => setScreen("customChallenge")}
              onCoach={() => setScreen("coach")}
              onJournal={() => { setTab("today"); setScreen("journal"); }}
              onMove={() => setScreen("movement")}
              onOpenArticle={(article) => {
                setSelectedArticle(article);
                setScreen("article");
              }}
              customChallengeCount={customChallenges.length}
              customChallengesEnabled={reviewFeatureCapabilities.customChallenges}
            />
          </SafeAreaView>
        </AppBackground>
      );
    }
    if (screen === "article" && selectedArticle) {
      return (
        <ArticleReaderScreen
          article={selectedArticle}
          onBack={() => {
            setSelectedArticle(null);
            setScreen("library");
          }}
        />
      );
    }
    const helpContext = activeAttempt ? `${activeAttempt.source}:${activeAttempt.nativeInterventionId ?? activeAttempt.detectedAt}` : null;
    const interceptedOffer = screen === "intercept" && shouldOfferGuidedReset({ screen, source: activeAttempt?.source, basicHelp: Boolean(helpContext && basicHelpContext === helpContext), hasSessionAccess: false, completedReceipt: false });
    if (screen === "intercept" && activeAttempt && !interceptedOffer) {
      return (
        <InterceptScreen
          attempt={activeAttempt}
          premium={premiumCapabilities.noAds}
          membershipPlanLabel={getMembershipPlanLabel(recoveryState, true)}
          streakDays={streakDays}
          accountability={accountability}
          onMessagePartner={() => messageAccountabilityPartner()}
          onClose={abandonActiveProtectionFlow}
          onReportWrongBlock={(host, matchedRule, sourcePackage) => {
            setRecoveryState((current) => recordBlockedDomainFeedback(current, host, matchedRule, sourcePackage));
          }}
          onContinue={() => setScreen("breathing")}
          onSponsoredReset={() => startChallenge()}
        />
      );
    }
    const accessSession = challengeSession.session;
    const sessionAllowed = Boolean(accessSession && accessSession.phase === "paused" && guidedAccess.allows(accessSession.id));
    const canChoose = Boolean(guidedAccess.grant && !guidedAccess.cleanupPending && !accessSession) && (guidedAccess.grant?.kind === "reward" || guidedAccess.grant?.kind === guidedTier);
    const needsEarnedOffer = Boolean(earnedAppOrigin && !accessSession && !challengeBreakOrigin.current?.earnedTime && ["intercept", "ad", "challenge"].includes(screen));
    const availableEarnedSelection = needsEarnedOffer ? earnedOffer.current() : null;
    if ((needsEarnedOffer && !availableEarnedSelection) || (guidedAccess.cleanupPending && ["challenge", "ad", "intercept"].includes(screen)) || interceptedOffer || shouldOfferGuidedReset({ screen, hasSessionAccess: sessionAllowed || Boolean(canChoose), completedReceipt: accessSession?.phase === "completed" })) {
      const earnedRecommendation = availableEarnedSelection?.receipt.offer ? getEarnedResetChoices(availableEarnedSelection.receipt.offer)[0]?.challenge : null;
      const recommendation = accessSession?.challenge ?? earnedRecommendation ?? selectedChallenge ?? generateChallengeSet({ hour: new Date().getHours(), premium: licensedFeatures, streakDays, attemptsToday, mood: todayCheckIn?.mood ?? "steady" })[0];
      const currentProtection = getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'both', disciplineSettings.appGuardMode);
      const confirmedProtection = Boolean(activeAttempt && !["panic-button", "manual-check"].includes(activeAttempt.source) && protectionRefreshCompleted && (activeAttempt.source === "app" ? currentProtection.appLimitsReady : currentProtection.websiteProtectionReady));
      const reveal = (presentedOffer?: LiveEarnedOfferSelection) => {
        if (accessSession?.phase !== "completed" && !guidedAccess.canEnter()) return;
        const selectedOffer = earnedAppOrigin && !accessSession ? earnedOffer.current() ?? (presentedOffer && earnedOffer.isBound(presentedOffer) ? presentedOffer : null) : null;
        if (earnedAppOrigin && !accessSession && !selectedOffer && !challengeBreakOrigin.current?.earnedTime) return;
        if (!accessSession && journeyOwner && getFirebaseAccountScope() === journeyOwner && (!challengeBreakOrigin.current?.earnedTime || selectedOffer)) challengeBreakOrigin.current = { sessionId: guidedAccess.nextSessionId(), ownerUid: journeyOwner, nativeActionScope: getProtectionActionScope() ?? undefined, ownerLease: appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady ? appConfigReadScope.current.ownerLease : null, attempt: activeAttempt ? { ...activeAttempt, ...(activeAttempt.scope ? { scope: { ...activeAttempt.scope } } : {}) } : null,
          ...(selectedOffer ? { earnedTime: { receipt: selectedOffer.receipt, templateBinding: null } } : {}) };
        if (selectedOffer && challengeBreakOrigin.current?.earnedTime) {
          try { writeEarnedTimeReference(localStorage, journeyOwner!, makeEarnedTimeReference(challengeBreakOrigin.current)); }
          catch { setChallengeBreakNotice(appI18n.t('earnedTime.resumeSaveFailed', { defaultValue: 'Your guided access is kept. Free some storage and retry saving this reset.' })); }
          if (!earnedOffer.current()) setChallengeBreakNotice(appI18n.t('earnedTime.offerExpiredHelp', { defaultValue: 'Your guided reset is available. This app-time offer has ended, so the app stays protected.' }));
        }
        setSelectedChallenge(accessSession?.challenge ?? (selectedOffer ? null : selectedChallenge) ?? null); setScreen("challenge");
      };
      const recheckEarnedOffer = async (beforeAd = true) => {
        if (!needsEarnedOffer) return true;
        if (!earnedOffer.seconds) return false;
        await earnedOffer.select(earnedOffer.seconds);
        const selection = earnedOffer.current();
        const feasible = Boolean(selection && isEarnedOfferAdFeasible(selection.receipt, Date.now(), beforeAd ? undefined : 0));
        if (!feasible) setChallengeBreakNotice(appI18n.t('earnedTime.offerTooShort', { defaultValue: 'There is not enough time left for this offer. Use basic help or request a new offer.' }));
        return feasible;
      };
      return <AppBackground><GuidedResetOffer diagnostic={guidedAccess.diagnostic} adPrivacyRequired={guidedAccess.adPrivacyRequired} adPrivacyBusy={guidedAccess.adPrivacyBusy} adPrivacyNotice={guidedAccess.adPrivacyNotice} onAdPrivacyOptions={() => { void guidedAccess.openAdPrivacyOptions(); }} tier={guidedAccess.accessUnavailable ? "unknown" : guidedTier} protectionOrigin={confirmedProtection} challenge={recommendation} previewMode={accessSession || selectedChallenge ? "resume" : "choices"} busy={guidedAccess.busy || earnedOffer.status === 'loading'} accessBlocked={needsEarnedOffer && !availableEarnedSelection}
        earnedTimeOffer={needsEarnedOffer ? <EarnedTimeOfferPicker offer={earnedOffer} busy={guidedAccess.busy} onChoose={seconds => { void earnedOffer.select(seconds); }} /> : undefined} cleanupPending={guidedAccess.cleanupPending} onRetryCleanup={abandonActiveProtectionFlow} notice={challengeBreakNotice ?? guidedAccess.notice} repairNeeded={guidedAccess.repairNeeded} resumable={sessionAllowed || Boolean(canChoose) || accessSession?.phase === "completed"}
        onStart={() => { void (async () => { if (!await recheckEarnedOffer(false)) return; if (sessionAllowed || canChoose || accessSession?.phase === "completed" || guidedAccess.startLicensed()) reveal(); })(); }}
        onWatch={() => { void (async () => {
          if (!await recheckEarnedOffer()) return;
          const selectedOffer = needsEarnedOffer ? earnedOffer.current() : null;
          if (needsEarnedOffer && !selectedOffer) return;
          const offerEligible = () => !selectedOffer || (earnedOffer.isBound(selectedOffer) && isEarnedOfferAdFeasible(selectedOffer.receipt, Date.now()));
          if (await guidedAccess.watch(offerEligible)) reveal(selectedOffer ?? undefined);
        })(); }}
        onRepair={() => { if (guidedAccess.repair()) reveal(); else { retryAccess(); reviewAccess.retry(); } }}
        onRetry={() => { guidedAccess.reload(); retryAccess(); reviewAccess.retry(); }} onPro={() => openPaywall(parseFeatureId(featureId) ?? undefined)}
        onSafety={abandonActiveProtectionFlow} onHelp={() => { guidedAccess.invalidate(); if (activeAttempt) { setBasicHelpContext(helpContext); setScreen("intercept"); } else setScreen("breathing"); }} /></AppBackground>;
    }
    if (screen === "challenge") {
      return (
        <ChallengeScreen
          key={journeyOwner ?? "unavailable"}
          breakNotice={challengeBreakNotice}
          earnedOffer={challengeBreakOrigin.current?.earnedTime?.receipt.offer}
          earnedBreakExpiresAt={challengeBreakOrigin.current?.earnedTime?.grantReceipt?.expiresAt}
          nativeEvidenceOwnerScope={getProtectionActionScope()}
          nativeEvidenceIsCurrent={()=>{const origin=challengeBreakOrigin.current,admission=nativeAccountSnapshot.admission;return !!admission&&getFirebaseNativeAccountAdmission()===admission&&getProtectionActionScope()===admission.actionScope&&origin?.nativeActionScope===admission.actionScope&&!!origin?.earnedTime&&origin.sessionId===challengeSession.getSnapshot().session?.id&&getFirebaseAccountScope()===journeyOwner&&liveResetOwnerCurrent(origin,journeyOwner,appConfigReadScope.current.ownerLease,appConfigReadScope.current.hydrated&&appConfigReadScope.current.storageReady)&&origin.attempt?.nativeInterventionId===activeAttemptRef.current?.nativeInterventionId&&JSON.stringify(origin.attempt?.scope)===JSON.stringify(activeAttemptRef.current?.scope);}}
          onNativeEvidence={receipt=>{const origin=challengeBreakOrigin.current,session=challengeSession.getSnapshot().session;if(nativeAccountSnapshot.admission&&getFirebaseNativeAccountAdmission()===nativeAccountSnapshot.admission&&origin?.nativeActionScope===nativeAccountSnapshot.admission.actionScope&&getProtectionActionScope()===origin.nativeActionScope&&origin?.earnedTime&&session&&origin.sessionId===session.id&&receipt.session?.completionSessionId===session.id&&receipt.session.templateId===session.challenge.id&&receipt.session.offerId===origin.earnedTime.receipt.offer?.offerId&&getFirebaseAccountScope()===journeyOwner&&liveResetOwnerCurrent(origin,journeyOwner,appConfigReadScope.current.ownerLease,appConfigReadScope.current.hydrated&&appConfigReadScope.current.storageReady))origin.earnedTime.nativeEvidence=receipt;}}
          rewardSeconds={challengeSession.session ? getChallengeRewardPreview(challengeSession.session.challenge) : null}
          scopedReward={challengeBreakOrigin.current?.attempt?.scope?.kind === "android-app-group" || challengeBreakOrigin.current?.attempt?.scope?.kind === "ios-app-group"}
          rewardLabelForChallenge={getChallengeRewardLabel}
          onRewardTemplateChosen={bindLiveRewardTemplate}
          onBeforeRewardTemplateChosen={persistEarnedTemplateChoice}
          onRetryEarnedResume={earnedResumeState === 'retry' || earnedResumeState === 'unavailable' ? () => retryEarnedResume() : undefined}
          canRequestUnlock={Boolean(challengeSession.session && getCompletedBreakAttempt(challengeSession.session.id))}
          sessionController={challengeSession}
          profile={{
            exportState: recoveryState,
            streakDays,
            premium: licensedFeatures,
            attemptsToday,
            mood: todayCheckIn?.mood ?? "steady",
            slipsThisWeek: weeklyReport.slips,
            slipWindow: weeklyReport.slipWindow,
            slipTrigger: weeklyReport.slipTrigger,
            interventionContext: activeInterventionContext,
            disciplinePreferences: challengePreferences,
            contextSignals: buildChallengeContextSignals(todayCheckIn),
            riskForecast: urgeRiskForecast,
            challengeHistory,
            recentFailureCount: challengeHistory.filter((history) => history.outcome === "still-urging").slice(0, 10).length,
            preferredCategories,
            customChallenges: licensedFeatures ? customChallenges : []
          }}
          selected={selectedChallenge ?? undefined}
          onMessagePartner={hasUsableAccountabilityPartner(accountability) ? messageAccountabilityPartner : undefined}
          onBack={() => { challengeSession.pause(); setScreen("main"); }}
          onDiscard={abandonActiveProtectionFlow}
          onFeedback={(sessionId, outcome) => {
            const receipt = challengeSession.getSnapshot().session;
            if (!journeyOwner || getFirebaseAccountScope() !== journeyOwner || receipt?.id !== sessionId || receipt.phase !== "completed") return false;
            try { persistRecoveryState(current => ({ ...current, challengeHistory: current.challengeHistory.map(entry => entry.sessionId === sessionId ? { ...entry, outcome } : entry) })); }
            catch { return false; }
            if (!discardChallengeSession()) return false;
            challengeBreakOrigin.current = null;
            setActiveAttempt(null); setSelectedChallenge(null); setScreen(outcome === "still-urging" ? "coach" : "main"); return true;
          }}
          onComplete={saveCompletedChallenge}
          onRequestBreak={() => { const id = challengeSession.getSnapshot().session?.id; if (id) void requestCompletedAppBreak(id); }}
        />
      );
    }
    if (screen === "customChallenge") {
      return (
        <CustomChallengeScreen
          premium={licensedFeatures}
          customChallenges={customChallenges}
          onBack={backFromTool}
          onUpgrade={() => setScreen("paywall")}
          onSave={(input) => {
            const challenge = createCustomRecoveryChallenge(input);
            persistRecoveryState((current) => addCustomRecoveryChallenge(current, challenge));
            return challenge;
          }}
          onSaved={(challenge) => startStandaloneChallenge(challenge)}
        />
      );
    }
    if (screen === "breathing") return <FunctionalBreathingScreen completedSessionIds={recoveryState.toolCompletionSessionIds} onBack={backFromTool} onComplete={(input, completedAt) => persistRecoveryState(current => recordToolCompletion(current, input, completedAt))} onSupport={startPanicIntervention} />;
    if (screen === "journal") return <JournalScreen ownerId={privateViewLocked ? null : journeyOwner} repository={journalRepository ?? undefined} media={journalMedia}
      legacyNotes={legacyJournalNotes} legacyDraft={journalLegacyDraft} initialEntryId={!privateViewLocked && journalReaderRequest?.owner === journeyOwner && getFirebaseAccountScope() === journeyOwner ? journalReaderRequest.entryId : undefined} onInitialEntryHandled={entryId => setJournalReaderRequest(request => request?.owner === journeyOwner && request.entryId === entryId ? null : request)} onChange={journalChanged} onOpenBackup={openJournalBackup} onBack={backFromTool} />;
    if (screen === "coach") {
      return (
        <CoachPanel
          key={journeyOwner??'no-owner'}
          recoveryState={recoveryState}
          attempts={attempts}
          streakDays={streakDays}
          attemptsToday={attemptsToday}
          premium={premiumCapabilities.advancedAiCoach}
          slipsThisWeek={weeklyReport.slips}
          slipWindow={weeklyReport.slipWindow}
          slipTrigger={weeklyReport.slipTrigger}
          initialMessages={recoveryState.coachMessages.map(({ role, text }) => ({ role, text }))}
          onPersistMessages={(messages) => {
            persistRecoveryState((current) => recordCoachMessages(current, messages, redactCoachText));
          }}
          onOpenAction={action=>{if(action==='routine')openFeature('routine');else setScreen(action==='breathe'?'breathing':'journal');}}
          onBack={backFromTool}
        />
      );
    }
    if (screen === "checkin") {
      return (
        <CheckInScreen
          todayCheckIn={todayCheckIn}
          onBack={backFromTool}
          onSave={(input, dateKey) => {
            persistRecoveryState((current) => recordCheckInForDate(current, input, dateKey));
          }}
          onSaved={() => {
            setTab("today");
            setScreen("main");
          }}
        />
      );
    }
    if (screen === "slip") {
      return (
        <SlipLogScreen
          currentStreak={streakDays}
          bestStreakDays={bestStreakDays}
          onBack={backFromTool}
          onSave={(input) => {
            persistRecoveryState((current) => recordRelapse(current, input));
          }}
          onSaved={() => {
            setActiveAttempt(null);
            setTab("today");
            setScreen("main");
          }}
        />
      );
    }

    return (
      <AppBackground>
        <SafeAreaView edges={focusedSection ? ["top", "bottom", "left", "right"] : ["left", "right"]} style={{ flex: 1, alignSelf: "center", width: "100%", maxWidth: getLayoutClass(width) === "compact" ? 520 : 760 }}>
          {storageError ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
              <InlineNotice
                tone="error"
                message={`Local save needs attention: ${storageError} Recovery data still works in this session, but changes may not persist across restarts.`}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
          {focusedSection ? <PillButton label="Back" variant="ghost" onPress={backFromFeature} /> : null}
          {tab === "today" && (
            <HomeScreen
              nativeAppBreak={nativeAppBreak}
              openAllPractices={focusedSection === "practices"}
              initialPracticeKey={initialPracticeKey}
              onAllFeatures={() => setScreen("features")}
              protectionGoal={chosenProtectionGoal}
              onJournal={() => setScreen("journal")}
              onPlanChange={(keys, dateKey) => persistRecoveryState(current => updatePersonalDailyPlan(current, keys, dateKey))}
              companionCue={companionCue}
              protectionReadiness={getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'both', disciplineSettings.appGuardMode)}
              protectionCapability={protectionCapability}
              protectionStatus={protectionStatus}
              protectionSyncing={adultToggleBusy || appConfigSyncBusy && appConfigBusyEpoch.current === appGroupsSuspensionEpoch.current}
              protectionSyncMessage={protectionSyncMessage}
              protectionGroups={visibleAppGroups}
              protectionGroupsPending={appGroups.pending}
              protectionGroupsError={appGroups.error}
              protectionGroupsWaitingForOwner={appGroups.waitingForOwner}
              onBreathing={() => setScreen("breathing")}
              onStartReset={() => startStandaloneChallenge()}
              onMovement={() => setScreen("movement")}
              onCoach={() => setScreen("coach")}
              resumableChallengeTitle={challengeSession.session && (challengeSession.session.phase === "paused" || earnedResumeState !== 'idle' || challengeBreakOrigin.current?.earnedTime) ? challengeSession.session.challenge.title
                : challengeBreakOrigin.current?.earnedTime && guidedAccess.grant?.sessionId === challengeBreakOrigin.current.sessionId && guidedAccess.canEnter() && getFirebaseAccountScope() === journeyOwner && liveResetOwnerCurrent(challengeBreakOrigin.current, journeyOwner, ownerLease, hydrated && storageReady)
                  ? appI18n.t('earnedTime.resumeGuided', { defaultValue: 'Your guided reset' }) : undefined}
              onResumeChallenge={() => { setSelectedChallenge(null); setScreen("challenge"); }}
              recoveryState={recoveryState}
              streakDays={streakDays}
              recoveryScore={recoveryScore}
              completedChallenges={completedChallenges}
              todayCheckIn={todayCheckIn}
              milestone={recoveryMilestone}
              onCheckIn={() => setScreen("checkin")}
              premium={premium}
              onPanic={startPanicIntervention}
              onAttempt={(url) => handleAttempt(url)}
              onOpenLibrary={() => setScreen("library")}
              onOpenShield={() => setTab("shield")}
              onOpenProgress={() => setTab("progress")}
              onTakePledge={() => {
                persistRecoveryState((current) => recordDailyPledge(current));
              }}
              limitedProtectionMessage={
                !hasProtectionActivationForPlatform(recoveryState, getRuntimeProtectionActivationPlatform()) &&
                hasProtectionSetupFallback(recoveryState, getRuntimeProtectionActivationPlatform())
                  ? "Limited protection: setup could not be completed on this device. Recovery tools are available; website blocking and app interruptions may be off."
                  : null
              }
              onFinishProtectionSetup={() => setScreen("protectionSetup")}
              onHabitToggle={(habit) => {
                persistRecoveryState((current) => recordPracticeToggle(current, habit));
              }}
            />
          )}
          {tab === "progress" && (
            <AnalyticsScreen
              focus={focusedSection}
              recoveryState={recoveryState}
              streakDays={streakDays}
              bestStreakDays={bestStreakDays}
              completedChallenges={completedChallenges}
              attemptsToday={attemptsToday}
              premiumCapabilities={reviewFeatureCapabilities}
              recoveryLevel={recoveryLevel}
              achievements={achievements}
              checkInSummary={checkInSummary}
              checkInInsight={checkInInsight}
              weeklyReport={weeklyReport}
              monthlyGrowthReport={monthlyGrowthReport}
              analyticsSnapshot={analyticsSnapshot}
              analyticsSharing={recoveryState.analyticsSharing}
              analyticsSharingReadiness={analyticsSharingReadiness}
              analyticsSendBusy={analyticsSendBusy}
              analyticsSendMessage={analyticsSendMessage}
              onCheckIn={() => {
                setTab("today");
                setScreen("checkin");
              }}
              onEnableAnalyticsSharing={enableAggregateAnalyticsSharing}
              onDisableAnalyticsSharing={disableAggregateAnalyticsSharing}
              onSendAnalyticsSnapshot={sendAggregateAnalyticsSnapshot}
              urgeRiskForecast={urgeRiskForecast}
              journalEntries={journalHistory.entries}
              journalLegacySourceIds={journalHistory.processedSources}
              onOpenJournalEntry={entryId => {
                if (!journeyOwner || privateLockedRef.current || getFirebaseAccountScope() !== journeyOwner || !journalHistory.entries.some(entry => entry.id === entryId)) return;
                setJournalReaderRequest({ owner: journeyOwner, entryId }); setScreen('journal');
              }}
              canRepeatReset={reset => !challengeSession.getSnapshot().session && !reset.toolId && [...challengeLibrary, ...customChallenges].some(challenge => challenge.id === reset.id)}
              onStartReset={reset => {
                if (!journeyOwner || privateLockedRef.current || getFirebaseAccountScope() !== journeyOwner || reset.toolId || challengeSession.getSnapshot().session) return;
                const retained = [...challengeLibrary, ...customChallenges].find(challenge => challenge.id === reset.id);
                if (retained) startStandaloneChallenge(retained);
              }}
              onBrowseResets={challengeSession.session ? undefined : () => {
                if (journeyOwner && !privateLockedRef.current && getFirebaseAccountScope() === journeyOwner && !challengeSession.getSnapshot().session) startStandaloneChallenge();
              }}
            />
          )}
          {tab === "shield" && (
            <ShieldScreen
              onOpenRecovery={openGuidedRecovery}
              groups={visibleAppGroups}
              groupsPending={appGroups.pending}
              groupsError={appGroups.error}
              groupsWaitingForOwner={appGroups.waitingForOwner}
              getActionScope={getProtectionActionScope}
              initialGroupId={initialAppGroupId}
              createOnOpen={hasPendingAppsAddIntent()}
              onCreateRequestConsumed={consumePendingAppsAddIntent}
              onOpenGroups={openAppGroups}
              onOpenGroup={openAppGroups}
              onAddGroup={() => { void addAppGroup(); }}
              onRefreshGroups={refreshAppGroupConfiguration}
              onPermissions={() => { if (protectionCapability?.appGroups === true) openAppGroups(); else { setProtectionIntent('apps'); setScreen('protectionSetup'); } }}
              onSafariSetup={protectionCapability?.safariContentBlocker ? () => { void openSafariExtensionSettings(); } : undefined}
              onExceptions={() => router.push(freedShieldSectionPath('websites'))}
              onDiagnostics={() => router.push(freedShieldSectionPath('diagnostics'))}
              section={shieldSection}
              syncing={adultToggleBusy || appConfigSyncBusy && appConfigBusyEpoch.current === appGroupsSuspensionEpoch.current}
              syncMessage={protectionSyncMessage}
              onRetryProtection={() => { void syncAppProtection().catch(() => undefined); }}
              onAttempt={(url) => handleAttempt(url)}
              disciplineSettings={disciplineSettings}
              activeUnlock={activeUnlock}
              onDisciplineChange={(update) => { try { const saved = persistRecoveryState(current => updateDisciplineSettings(current, update)); recoveryStateRef.current = saved; } catch { setProtectionSyncMessage('App settings could not be saved. Retry before relying on protection.'); } }}
              protectionCapability={protectionCapability}
              protectionStatus={protectionStatus}
              onRefreshProtection={refreshProtectionStatus}
              onWebsiteProtectionChange={requestWebsiteProtectionChange}
              onOpenProtectionSetup={(intent = "both") => { if (intent === 'apps' && protectionCapability?.appGroups === true) openAppGroups(); else { setProtectionIntent(intent); setScreen("protectionSetup"); } }}
            />
          )}
          {tab === "profile" && (
            <ProfileScreen
              adPrivacyRequired={guidedAccess.adPrivacyRequired} adPrivacyBusy={guidedAccess.adPrivacyBusy} adPrivacyNotice={guidedAccess.adPrivacyNotice} onAdPrivacyOptions={() => { void guidedAccess.openAdPrivacyOptions(); }}
              focus={focusedSection}
              section={profileSection}
              onPersonalize={() => { setQuizIndex(0); setScreen("quiz"); }}
              recoveryState={recoveryState}
              premium={premium}
              premiumCapabilities={reviewFeatureCapabilities}
              streakDays={streakDays}
              bestStreakDays={bestStreakDays}
              attempts={attempts}
              relapseCount={relapseRecords.length}
              analyticsSharing={recoveryState.analyticsSharing}
              analyticsSharingReadiness={analyticsSharingReadiness}
              analyticsSendBusy={analyticsSendBusy}
              analyticsSendMessage={analyticsSendMessage}
              onEnableAnalyticsSharing={enableAggregateAnalyticsSharing}
              onDisableAnalyticsSharing={disableAggregateAnalyticsSharing}
              onSendAnalyticsSnapshot={sendAggregateAnalyticsSnapshot}
              reminders={reminders}
              smartReminderSuggestion={smartReminderSuggestion}
              retentionPlan={retentionPlan}
              accountability={accountability}
              supportCircle={supportCircle}
              reminderBusy={reminderBusy}
              onReminderChange={changeReminderPreferences}
              onReminderRepair={reminderController.repair}
              onReminderTest={reminderController.sendTestNotification}
              reminderTestMessage={reminderController.storageError ?? reminderController.testStatusMessage}
              reminderStateReadable={storageReady}
              onAccountabilityChange={(update) => setRecoveryState((current) => updateAccountabilityPartner(current, update))}
              onSendSponsorReport={sendSponsorReport}
              onSendSupportCircleReport={sendSupportCircleReport}
              onSupportCircleChange={(memberId, update) => setRecoveryState((current) => updateSupportCircleMember(current, memberId, update))}
              onSupportCircleRemove={(memberId) => setRecoveryState((current) => removeSupportCircleMember(current, memberId))}
              onRestoreBackup={restoreRecoveryState}
              onConnectAccount={() => { enterAccountFlow(); const owner = getJourneyOwner(getFirebaseAuthSnapshot()); profileAccountOrigin.current = profileSection && owner && getFirebaseAccountScope() === owner ? { section: profileSection, owner, generation: accountHostGeneration.current, operation: accountOperationGate.current.begin() } : null; setAccountNotice(null); setAccountReturnToProfile(true); setScreen("account"); }}
              onSignOut={signOutRecoveryAccount}
              onAutomaticBackupChange={changeAutomaticBackup}
              ownerId={journeyOwner}
              onExportFile={exportOwnerBackupFile}
              onImportFile={importOwnerBackupFile}
              onDownloadTextBackup={downloadOwnerTextBackup}
              signingOut={signingOut}
              unclaimedHistory={unclaimedLegacy && Boolean(journeyOwner)}
              onAdoptHistory={() => setAdoptingLegacy(true)}
              accountNotice={accountNotice}
              onDeleteLocalData={deleteLocalRecoveryData}
              onDeleteAccountAndData={requestConfirmedAccountDeletion}
              onManagePlan={() => openProfilePaywall(profileSection)}
              onLogSlip={() => setScreen("slip")}
              onOpenShield={() => setTab("shield")}
              pendingFirebaseEmailLink={pendingFirebaseEmailLink}
              onPendingFirebaseEmailLinkHandled={() => setPendingFirebaseEmailLink(null)}
            />
          )}
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  };

  return (
    <OwnerPrivateDraftContext.Provider value={{ ownerId: privateViewLocked ? null : journeyOwner, storage: privateDraftStorage }}>
    <FreedAppContext.Provider value={{ renderScreen, renderAccountDeletion, startPanicIntervention, abandonActiveProtectionFlow, authSnapshot: journeyAuth, membershipSnapshot, reviewAccessSnapshot: reviewAccess.snapshot }}>
      {journeyRecoverySaveNotice ? <View style={{ padding: 16, backgroundColor: colors.surface }}><Text accessibilityRole="alert">{journeyRecoverySaveNotice}</Text><PillButton label="Retry saving answers" variant="ghost" onPress={() => {
        try { persistRecoveryState(current => current); setJourneyRecoverySaveNotice(null); } catch { /* Keep the recovery warning while this save still fails. */ }
      }} /></View> : null}
      {journeyOfferSaveNotice ? <View style={{ padding: 16, backgroundColor: colors.surface }}><Text accessibilityRole="alert">{journeyOfferSaveNotice.message}</Text><PillButton label="Retry saving" variant="ghost" onPress={() => {
        const owner = journeyOfferSaveNotice.ownerUid;
        if (getJourneyOwner(journeyAuth) !== owner || getFirebaseAccountScope() !== owner) return;
        void journeyOfferStore.current.sync(owner).then(result => {
          if (result.saved === true && getFirebaseAccountScope() === owner) setJourneyOfferSaveNotice(current => current?.ownerUid === owner ? null : current);
        });
      }} /></View> : null}
      {children}
      {renderAccountHost(publicBasicHelp || showAccountCleanupRecovery)}
      <BasicHelpPresentation visible={publicBasicHelp} onClose={() => setPublicBasicHelp(false)} />
      <Modal visible={confirmingDeletion} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal={!deletionBusy} onRequestClose={() => {
        if (deletionBusyRef.current) return;
        deletionContinuation.current?.reject(new Error("Account deletion cancelled.")); deletionContinuation.current = null; setConfirmingDeletion(false);
      }}>
        <AccountReauthenticationScreen onBusyChange={(busy) => { deletionBusyRef.current = busy; setDeletionBusy(busy); }} onCancel={() => {
          if (deletionBusyRef.current) return;
          deletionContinuation.current?.reject(new Error("Account deletion cancelled.")); deletionContinuation.current = null; setConfirmingDeletion(false);
        }} onConfirmed={async (expectedUid) => {
          if (deletionContinuation.current?.expectedUid !== expectedUid) throw new Error("The account confirmation changed. Cancel and try again.");
          const result = await deleteFirebaseAccountAndData();
          deletionContinuation.current?.resolve(result); deletionContinuation.current = null; setConfirmingDeletion(false);
        }} />
      </Modal>
      <Modal visible={adoptingLegacy} transparent animationType="fade" onRequestClose={() => setAdoptingLegacy(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.65)' }}><Card title="Keep older history for this account?">
          <Text style={{ color: colors.text2, lineHeight: 24, marginVertical: 16 }}>Confirm that this unclaimed history belongs to you. It will be kept for the currently connected account. This choice does not restore purchases or device permissions.</Text>
          <PillButton label="Keep history unclaimed" variant="ghost" onPress={() => setAdoptingLegacy(false)} />
          <PillButton label="Keep history for this account" onPress={() => { try { adoptLegacy(true); setAdoptingLegacy(false); journalChanged(); setAccountNotice('Older local history is now kept for this account.'); }
            catch (error) { setAccountNotice(safeUserFacingMessage(error, 'Local history could not be adopted. Its original copy was kept.')); } }} />
        </Card></View>
      </Modal>
      <Modal visible={Boolean(pendingRecoveryRestore)} transparent animationType="fade" onRequestClose={() => { if (!restoringBackupRef.current) { pendingJournalRestore.current = null; setPendingRecoveryRestore(null); } }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 24 }}>
          <Card>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, fontWeight: typography.heavy }}>Restore recovery history?</Text>
            <Text style={{ color: colors.text2, lineHeight: 22, marginVertical: 16 }}>This restores recovery history and merges saved journal entries for this account. Deleted legacy notes stay deleted. Create a backup first if you want to keep the current history. Membership and device permissions are checked separately.</Text>
            {restoreNotice ? <Text accessibilityRole="alert" style={{ color: colors.peach, lineHeight: 20, marginBottom: 12 }}>{restoreNotice}</Text> : null}
            <View style={{ gap: 12 }}>
              <PillButton label="Keep current history" variant="ghost" disabled={restoringBackup} onPress={() => { pendingJournalRestore.current = null; setPendingRecoveryRestore(null); }} />
              <PillButton label={restoringBackup ? "Restoring backup…" : "Restore backup"} disabled={restoringBackup} onPress={() => { void confirmRecoveryRestore(); }} />
            </View>
          </Card>
        </View>
      </Modal>
    </FreedAppContext.Provider>
    </OwnerPrivateDraftContext.Provider>
  );
}
