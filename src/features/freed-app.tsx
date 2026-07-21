import * as Haptics from "expo-haptics";
import { File as ExpoFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as ExpoLinking from "expo-linking";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { Accelerometer, Pedometer, type AccelerometerMeasurement } from "expo-sensors";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import {
  ProtectionCapability,
  ProtectionActivationDiagnostics,
  ProtectionStatus,
  applyAdultContentFilter,
  applyEarnedUnlockWindow,
  applyFocusShieldEarnedUnlock,
  cancelFocusShieldCalibration,
  classifyChallengePhoto,
  configureBlockedAppPackages,
  configureFocusShieldRule,
  clearEarnedUnlockWindow,
  clearPendingIntervention,
  getFocusShieldCalibration,
  getProtectionCapabilities,
  getPendingIntervention,
  getProtectionStatus,
  listFocusShieldRules,
  openPrivateDnsSettings,
  openUsageAccessSettings,
  openProtectionSettings,
  presentFamilyActivityPicker,
  requestProtectionAuthorization,
  removeFocusShieldRule,
  runActivationDiagnostics,
  startFocusShieldCalibration,
  startRiskWindowMonitoring,
  stopAdultContentFilter,
  stopRiskWindowMonitoring
} from "freed-protection";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Dumbbell,
  FileLock,
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
  Waves,
  X
} from "lucide-react-native";
import React from "react";

import { colors, gradients, radii, shadow, starField, typography } from "@/constants/design";
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
import { replyWithCoach } from "@/lib/ai-coach";
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
  buildSupabaseOAuthUrl,
  extractSupabaseAccessTokenFromUrl,
  getSupabaseAuthReadiness,
  requestSupabaseMagicLink,
  type SupabaseAuthProvider
} from "@/lib/supabase-auth-client";
import { safeUserFacingMessage } from "@/lib/user-facing-error";
import {
  ANALYTICS_CONSENT_VERSION,
  buildRecoveryAnalyticsSnapshot,
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
  completeRewardedResetSession,
  createRewardedResetSession,
  getLaunchPremiumPlans,
  getPremiumCapabilities,
  purchasePremiumPlan,
  restorePremiumPurchases,
  type MonetizationPlatform,
  type PremiumCapabilitySet,
  type PremiumPlanId
} from "@/lib/monetization";
import { configureNativeMonetizationRuntime } from "@/lib/native-monetization-runtime";
import {
  appPackageForEarnedUnlockSource,
  createDeepLinkInterventionAttempt,
  getActiveNativeEarnedUnlock,
  isIosScreenTimeShieldSource,
  unlockSourceForAttempt,
  type NativeInterventionAttempt
} from "@/lib/native-intervention";
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
  shouldBypassRewardedAdForAttempt,
  summarizeFocusShieldRules,
  type FocusShieldRuleSummary
} from "@/lib/protection-capabilities";
import { getProtectionSetupReadiness } from "@/lib/protection-readiness";
import {
  ChallengeHistorySignal,
  ChallengeContextSignal,
  ChallengeOutcome,
  ChallengePreferenceSignal,
  InterventionContextSignal,
  RecoveryChallenge,
  buildInterventionContextFromAttempt,
  calculateRecoveryScore,
  generateChallengeSet,
  inferPreferredChallengeCategories
} from "@/lib/recovery-engine";
import {
  getSmartReminderSuggestion,
  listenForReminderResponses,
  parseClockTime,
  syncRecoveryReminders,
  type SmartReminderSuggestion
} from "@/lib/recovery-reminders";
import { requestAndroidRecoveryNotificationVisibility } from "@/lib/recovery-notification-permission";
import {
  buildRetentionRequest,
  createLocalRetentionPlan,
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
  createDefaultRecoveryState,
  createCustomRecoveryChallenge,
  clearProtectionActivation,
  generateAchievementBadges,
  generateMonthlyGrowthReport,
  generateRecoveryInsight,
  generateWeeklyRecoveryReport,
  getActiveEarnedUnlock,
  getActiveBlockedAppPackages,
  getDailyCheckInForDay,
  getDailyHabitCompletionsForDay,
  getLocalDateKey,
  getRecoveryMilestone,
  hasProtectionActivationForPlatform,
  markOnboardingPaywallPresented,
  markProtectionActivated,
  recordEarnedUnlock,
  recordDailyHabitCompletion,
  recordAccountabilityContact,
  recordAppSessionEnd,
  recordAppSessionStart,
  recordBlockingAttempt,
  recordChallengeCompletion,
  recordDailyCheckIn,
  recordRelapse,
  recordReminderSync,
  recordSupportCircleContact,
  removeSupportCircleMember,
  summarizeCheckIns,
  updateAccountabilityPartner,
  updateAnalyticsSharingSettings,
  updateDisciplineSettings,
  updateReminderPreferences,
  updateSupportCircleMember,
  setPremiumPlan
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
  SupportCircleMember,
  ProtectionActivationPlatform,
  WeeklyRecoveryReport
} from "@/lib/recovery-state";
import { usePersistentRecoveryState } from "@/lib/recovery-storage";

type Screen =
  | "splash"
  | "welcome"
  | "quiz"
  | "appSelection"
  | "paywall"
  | "protectionSetup"
  | "main"
  | "intercept"
  | "ad"
  | "challenge"
  | "breathing"
  | "checkin"
  | "coach"
  | "slip"
  | "customChallenge";
type Tab = "home" | "analytics" | "shield" | "library" | "profile";

const FREED_PRIVACY_POLICY_URL = "https://freedrecovery.app/privacy";
const FREED_SUPPORT_EMAIL = "support@freedrecovery.app";
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
  if (!state.hasCompletedOnboarding) return "welcome";
  if (!state.onboardingPaywallPresentedAt && !state.premium) return "paywall";
  if (!hasProtectionActivationForPlatform(state, getRuntimeProtectionActivationPlatform())) {
    return "protectionSetup";
  }
  return "main";
}

function shouldReturnToProtectionSetupAfterRevocation(screen: Screen) {
  return (
    screen === "main" ||
    screen === "checkin" ||
    screen === "coach" ||
    screen === "slip" ||
    screen === "customChallenge"
  );
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
    options: ["Mental clarity", "Confidence", "Relationships", "Faith or values"]
  },
  {
    question: "When are urges most likely?",
    options: ["Late night", "Stress", "Boredom", "After social media"]
  },
  {
    question: "What helps you reset fastest?",
    options: ["Exercise", "Breathing", "Journaling", "Talking to someone"]
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
  { key: "meditation", label: "Meditation", accent: colors.purple },
  { key: "journal", label: "Journal", accent: colors.yellow },
  { key: "social-media-boundary", label: "No social media", accent: colors.pink }
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

function getRecentWeekDates(today = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
}

function hasRecoverySignalForDate(state: RecoveryState, date: Date) {
  const key = getLocalDateKey(date);
  const hasSlip = state.relapseRecords.some((record) => getLocalDateKey(record.occurredAt) === key);
  if (hasSlip) return false;

  return (
    state.dailyCheckIns.some((checkIn) => checkIn.dateKey === key) ||
    state.challengeHistory.some((challenge) => getLocalDateKey(challenge.completedAt) === key) ||
    state.dailyHabits.some((habit) => habit.dateKey === key && habit.completed) ||
    state.attempts.some((attempt) => attempt.result.verdict === "block" && getLocalDateKey(attempt.detectedAt) === key)
  );
}

function tap() {
  if (process.env.EXPO_OS === "ios") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }
}

function FreedLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Text selectable style={{ fontSize: compact ? 24 : 36, fontWeight: typography.heavy, letterSpacing: -1 }}>
      <Text style={{ color: colors.purple }}>F</Text>
      <Text style={{ color: colors.text }}>R</Text>
      <Text style={{ color: colors.mint }}>E</Text>
      <Text style={{ color: colors.text }}>E</Text>
      <Text style={{ color: colors.peach }}>D</Text>
    </Text>
  );
}

function AppBackground({ children }: { children: React.ReactNode }) {
  return (
    <LinearGradient colors={gradients.app} style={{ flex: 1 }}>
      <StatusBar style="light" />
      {starField.map((star, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: star.size,
            backgroundColor: colors.white,
            opacity: star.opacity
          }}
        />
      ))}
      {children}
    </LinearGradient>
  );
}

function PillButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  accessibilityLabel,
  accessibilityHint
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger" | "success";
  icon?: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isSuccess = variant === "success";
  const content = (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 58,
        borderRadius: radii.pill,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 9,
        opacity: disabled ? 0.42 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        backgroundColor: isPrimary || isSuccess ? colors.text : isDanger ? undefined : "rgba(255,255,255,0.07)",
        borderWidth: isPrimary || isSuccess ? 0 : 1.5,
        borderColor: isDanger ? "rgba(255,81,72,0.35)" : "rgba(255,255,255,0.11)",
        paddingHorizontal: 22,
        ...(!isDanger ? shadow.soft : shadow.glowRed)
      })}
    >
      {icon}
      <Text
        selectable
        style={{
          color: isPrimary ? colors.bg : isSuccess ? "#0A2018" : isDanger ? colors.white : colors.text2,
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

  if (isDanger) {
    return (
      <LinearGradient colors={gradients.danger} style={{ borderRadius: radii.pill }}>
        {content}
      </LinearGradient>
    );
  }

  return content;
}

function Card({
  children,
  gradient,
  style
}: {
  children: React.ReactNode;
  gradient?: readonly [string, string] | readonly [string, string, string];
  style?: object;
}) {
  const inner = (
    <View
      style={{
        borderRadius: radii.lg,
        borderWidth: 1.3,
        borderColor: "rgba(255,255,255,0.08)",
        padding: 16,
        overflow: "hidden",
        ...style
      }}
    >
      {children}
    </View>
  );

  if (!gradient) {
    return <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg }}>{inner}</View>;
  }

  return (
    <LinearGradient colors={gradient} style={{ borderRadius: radii.lg }}>
      {inner}
    </LinearGradient>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card style={{ flex: 1, minHeight: 100 }} gradient={[`${color}33`, colors.surface]}>
      <Text selectable style={{ color: colors.text, fontSize: 28, fontWeight: typography.heavy }}>
        {value}
      </Text>
      <Text selectable style={{ color, marginTop: "auto", fontWeight: typography.bold }}>
        {label}
      </Text>
    </Card>
  );
}

function ProgressRing({ value, size = 152 }: { value: number; size?: number }) {
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = Math.PI * 2 * radius;
  const offset = circumference * (1 - Math.min(100, value) / 100);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.purple}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
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

function SplashScreen({ onDone, hold = false }: { onDone: () => void; hold?: boolean }) {
  React.useEffect(() => {
    if (hold) return undefined;
    const timer = setTimeout(onDone, 1100);
    return () => clearTimeout(timer);
  }, [hold, onDone]);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
        <View style={{ transform: [{ scale: 1.08 }] }}>
          <FreedLogo />
        </View>
        <Text selectable style={{ color: colors.text3, letterSpacing: 2.4, fontSize: 12, fontWeight: typography.bold }}>
          FREEDOM STARTS TODAY
        </Text>
        <ActivityIndicator color={colors.purple} style={{ marginTop: 28 }} />
      </SafeAreaView>
    </AppBackground>
  );
}

function WelcomeScreen({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "space-between" }}>
          <View style={{ alignItems: "center", paddingTop: 20 }}>
            <FreedLogo compact />
          </View>

          <View style={{ gap: 26 }}>
            <LinearGradient
              colors={gradients.hero}
              style={{
                height: 260,
                borderRadius: 42,
                justifyContent: "flex-end",
                padding: 22,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)"
              }}
            >
              <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
                {[0, 1, 2, 3, 4].map((item) => (
                  <Sparkles key={item} color={colors.yellow} size={18} fill={colors.yellow} />
                ))}
              </View>
              <Text selectable style={{ color: colors.white, fontSize: 42, lineHeight: 45, fontWeight: typography.heavy }}>
                Break free.{"\n"}Protect your streak.
              </Text>
            </LinearGradient>

            <View style={{ gap: 12 }}>
              {[
                ["Adult-only blocking", "Normal browsing stays fast and untouched.", colors.mint],
                ["Relapse interruption", "Risk moments become guided recovery flows.", colors.pink],
                ["Adaptive challenges", "FREED learns which reset works for you.", colors.purple]
              ].map(([title, body, color]) => (
                <Card key={title} gradient={[`${color}28`, colors.surface]}>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 13,
                        backgroundColor: `${color}22`,
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Check color={color} size={18} strokeWidth={3} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: typography.heavy }}>
                        {title}
                      </Text>
                      <Text selectable style={{ color: colors.text2, marginTop: 2, lineHeight: 19 }}>
                        {body}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </View>

          <View style={{ gap: 12, paddingTop: 28 }}>
            <PillButton label="Start My Recovery" onPress={onStart} icon={<ChevronRight color={colors.bg} size={19} />} />
            <PillButton label="Skip Assessment" variant="ghost" onPress={onSkip} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

function QuizScreen({
  index,
  answers,
  onAnswer,
  onBack
}: {
  index: number;
  answers: string[];
  onAnswer: (answer: string) => void;
  onBack: () => void;
}) {
  const step = quiz[index];
  const progress = Math.round(((index + 1) / quiz.length) * 100);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 20 }}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous onboarding question."
            style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft color={colors.text2} size={20} />
          </Pressable>
          <View style={{ flex: 1, height: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <View style={{ width: `${progress}%`, height: "100%", backgroundColor: colors.purple }} />
          </View>
          <Text selectable style={{ color: colors.text3, fontWeight: typography.heavy }}>
            {index + 1}/{quiz.length}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 18, flexGrow: 1 }}>
          <Text selectable style={{ color: colors.purple, fontWeight: typography.heavy, letterSpacing: 1.4, fontSize: 12 }}>
            RECOVERY ASSESSMENT
          </Text>
          <Text selectable style={{ color: colors.text, fontSize: 31, lineHeight: 36, fontWeight: typography.heavy }}>
            {step.question}
          </Text>
          <View style={{ gap: 12, marginTop: 10 }}>
            {step.options.map((option, optionIndex) => {
              const isSelected = answers[index] === option;
              const palette = [colors.peach, colors.pink, colors.purple, colors.mint][optionIndex];
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityLabel={option}
                  accessibilityHint={`Selects ${option} for ${step.question}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    tap();
                    onAnswer(option);
                  }}
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.98 : 1 }]
                  })}
                >
                  <Card gradient={isSelected ? [`${palette}44`, colors.surface] : undefined}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          backgroundColor: isSelected ? palette : "rgba(255,255,255,0.07)",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {isSelected ? <Check color={colors.bg} size={17} strokeWidth={3} /> : <Text style={{ color: colors.text3, fontWeight: typography.heavy }}>{optionIndex + 1}</Text>}
                      </View>
                      <Text selectable style={{ color: isSelected ? colors.text : colors.text2, fontSize: 16, fontWeight: typography.bold, flex: 1 }}>
                        {option}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 20 }}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to the previous onboarding step."
            style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}
          >
            <ChevronLeft color={colors.text2} size={20} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.2 }}>
              APP SELECTION
            </Text>
            <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy, marginTop: 2 }}>
              {selectedCount} selected
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 34 }}>
          <LinearGradient colors={["#151C2F", "#141420"]} style={{ borderRadius: 30, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", gap: 12 }}>
            <TimerReset color={colors.purple} size={36} />
            <Text selectable style={{ color: colors.text, fontSize: 29, lineHeight: 34, fontWeight: typography.heavy }}>
              Choose the apps FREED can interrupt.
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 21 }}>
              These choices become Android app timers and short-form guards. On iOS, you will choose the actual apps and websites in Apple's Screen Time picker during setup.
            </Text>
          </LinearGradient>

          <Card>
            <View style={{ gap: 10 }}>
              {DOOMSCROLL_APP_OPTIONS.map((option) => {
                const selected = selectedSet.has(option.androidPackage);
                return (
                  <Pressable
                    key={option.androidPackage}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Protect ${option.label}`}
                    accessibilityHint={`Toggles FREED app timer protection for ${option.label}.`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => togglePackage(option.androidPackage)}
                    style={({ pressed }) => ({
                      minHeight: 58,
                      borderRadius: 18,
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: selected ? "rgba(184,152,255,0.18)" : "rgba(255,255,255,0.055)",
                      borderWidth: 1.2,
                      borderColor: selected ? "rgba(184,152,255,0.42)" : "rgba(255,255,255,0.07)",
                      transform: [{ scale: pressed ? 0.985 : 1 }]
                    })}
                  >
                    <View style={{ width: 30, height: 30, borderRadius: 11, backgroundColor: selected ? colors.purple : "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
                      {selected ? <Check color={colors.white} size={17} strokeWidth={3.5} /> : <Shield color={colors.text3} size={15} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
                        {option.label}
                      </Text>
                      <Text selectable style={{ color: colors.text3, marginTop: 2, fontSize: 12 }}>
                        {packageDetailForPlatform ?? option.androidPackage}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Text selectable style={{ color: colors.text3, lineHeight: 19, textAlign: "center" }}>
            {requiresAndroidAppSelection
              ? "Android activation needs at least one selected app timer so FREED can verify app interruption before setup completes."
              : "Adult-domain blocking is separate and stays available even if you do not select any app timers."}
          </Text>

          <PillButton
            label={selectedCount > 0 ? `Continue with ${selectedCount} App${selectedCount === 1 ? "" : "s"}` : "Select At Least 1 App"}
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
  onSubscribe: (planId: PremiumPlanId) => void;
  onClose: () => void;
  onRestore: () => void;
  busy?: boolean;
  notice?: string | null;
}) {
  const [plan, setPlan] = React.useState<PremiumPlanId>("yearly");
  const launchPlans = React.useMemo(() => getLaunchPremiumPlans({ platform: getRuntimeMonetizationPlatform() }), []);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close premium offer"
              accessibilityHint="Continues without upgrading."
              style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}
            >
              <X color={colors.text2} size={18} />
            </Pressable>
          </View>

          <LinearGradient colors={["#3E1624", "#3E2214", "#302614"]} style={{ borderRadius: 30, padding: 22, gap: 12 }}>
            <Sparkles color={colors.yellow} size={40} fill={colors.yellow} style={{ alignSelf: "center" }} />
            <Text selectable style={{ color: colors.text, textAlign: "center", fontSize: 34, fontWeight: typography.heavy }}>
              Go Premium
            </Text>
            <Text selectable style={{ color: colors.text2, textAlign: "center", fontSize: 15, lineHeight: 22 }}>
              Faster interventions, no ads, advanced coaching, and deeper recovery analytics.
            </Text>
          </LinearGradient>

          <View style={{ gap: 10 }}>
            {["No ads before challenges", "Unlimited adaptive interventions", "Premium CLARA patterns", "Deeper recovery analytics"].map((feature) => (
              <View key={feature} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" }}>
                  <Check color={colors.bg} size={14} strokeWidth={4} />
                </View>
                <Text selectable style={{ color: colors.text2, fontSize: 15, flex: 1 }}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          <Text selectable style={{ color: colors.text3, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
            Secure store verification happens before premium activates, and Premium skips ads before recovery challenges.
          </Text>

          <View style={{ gap: 10 }}>
            {launchPlans.map((item) => {
              const active = plan === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`${item.label} premium plan, ${item.price}`}
                  accessibilityHint={item.sub}
                  accessibilityState={{ selected: active }}
                  onPress={() => setPlan(item.id)}
                >
                  <Card gradient={active ? gradients.purple : undefined}>
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: active ? 7 : 2, borderColor: active ? colors.purple : "rgba(255,255,255,0.24)" }} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                            {item.label}
                          </Text>
                          <Text selectable style={{ color: colors.purple, fontSize: 11, fontWeight: typography.heavy, backgroundColor: "rgba(184,152,255,0.18)", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 }}>
                            {item.badge}
                          </Text>
                        </View>
                        <Text selectable style={{ color: colors.text3, marginTop: 3 }}>
                          {item.sub}
                        </Text>
                      </View>
                      <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: typography.heavy }}>
                        {item.price}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>

          {notice ? (
            <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 21 }}>
              {notice}
            </Text>
          ) : null}

          <PillButton label={busy ? "Preparing..." : "Upgrade Plan"} onPress={() => onSubscribe(plan)} disabled={busy} />
          <PillButton label="Restore Purchase" variant="ghost" onPress={onRestore} disabled={busy} />
          <PillButton label="Continue Free" variant="ghost" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

type ProtectionRefreshResult = {
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
  const [rules, setRules] = React.useState<FocusShieldRuleSummary[]>([]);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [calibrationState, setCalibrationState] = React.useState<FocusShieldCalibrationState>("idle");
  const [message, setMessage] = React.useState<string | null>(null);
  const capabilityModel = React.useMemo(
    () => getFocusShieldCapabilityModel(protectionCapability, protectionStatus, rules),
    [protectionCapability, protectionStatus, rules]
  );
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
    [onRefresh, refreshRules]
  );

  const beginCalibration = React.useCallback(
    async (preset: (typeof FOCUS_SHIELD_PRESETS)[number]) => {
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
    []
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
    <Card gradient={capabilityModel.available ? gradients.purple : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <ShieldCheck color={capabilityModel.available ? colors.mint : colors.text3} size={24} />
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
            Focus Shield
          </Text>
          <Text selectable style={{ color: colors.text3, marginTop: 2, textTransform: "capitalize" }}>
            {capabilityModel.platform} capability
          </Text>
        </View>
      </View>
      <Text selectable style={{ color: colors.text2, lineHeight: 21, marginBottom: 12 }}>
        {capabilityModel.description}
      </Text>

      {capabilityModel.platform === "android" ? (
        <>
          <Text selectable style={{ color: colors.text3, fontWeight: typography.heavy, letterSpacing: 0.8, marginBottom: 8 }}>
            SUPPORTED PRESETS
          </Text>
          <View style={{ gap: 10, marginBottom: 12 }}>
            {FOCUS_SHIELD_PRESETS.map((preset) => {
              const enabled = rules.some((rule) => rule.presetId === preset.id || rule.id === `preset-${preset.id}`);
              return (
                <View key={preset.id} style={{ borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.05)", gap: 9 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                        {preset.displayName}
                      </Text>
                      <Text selectable style={{ color: colors.text3, fontSize: 12, marginTop: 3 }}>
                        Local rule · {preset.packageName}
                      </Text>
                    </View>
                    {enabled ? <Check color={colors.mint} size={20} /> : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <PillButton
                        label={enabled ? "Preset On" : "Enable"}
                        variant="ghost"
                        disabled={enabled || busyAction !== null}
                        onPress={() => void enablePreset(preset)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <PillButton
                        label="Calibrate"
                        variant="ghost"
                        disabled={!capabilityModel.calibrationAvailable || calibrationActive || busyAction !== null}
                        onPress={() => void beginCalibration(preset)}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Text selectable style={{ color: calibrationActive ? colors.yellow : colors.text3, flex: 1, fontWeight: typography.bold }}>
              Calibration: {calibrationState.replace(/-/g, " ")}
            </Text>
            {calibrationActive ? (
              <Pressable
                onPress={() => void cancelCalibration()}
                disabled={busyAction !== null}
                accessibilityRole="button"
                accessibilityLabel="Cancel Focus Shield calibration"
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,216,106,0.12)" }}
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
                <View key={rule.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, padding: 11, backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <View style={{ flex: 1 }}>
                    <Text selectable style={{ color: colors.text, fontWeight: typography.bold }}>{rule.displayLabel}</Text>
                    <Text selectable style={{ color: colors.text3, fontSize: 12, marginTop: 3 }}>
                      {rule.kind} · {rule.enabled ? "enabled" : "paused"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void removeRule(rule)}
                    disabled={busyAction !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${rule.displayLabel}`}
                    style={{ width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,81,72,0.12)" }}
                  >
                    <Trash2 color={colors.red2} size={17} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}

      {message ? (
        <Text selectable style={{ color: colors.mint, lineHeight: 19, marginBottom: 10, fontWeight: typography.bold }}>
          {message}
        </Text>
      ) : null}
      {capabilityModel.diagnostics.map((diagnostic) => (
        <Text key={diagnostic} selectable style={{ color: colors.yellow, lineHeight: 19, marginTop: 5 }}>
          {diagnostic}
        </Text>
      ))}
    </Card>
  );
}

function ProtectionSetupScreen({
  protectionCapability,
  protectionStatus,
  protectionSyncMessage,
  selectedAppPackageCount,
  appSelectionReturnPending,
  onRefresh,
  onSyncAppPackages,
  onChooseApps,
  onAppSelectionReturnHandled,
  onContinue
}: {
  protectionCapability: ProtectionCapability | null;
  protectionStatus: ProtectionStatus | null;
  protectionSyncMessage: string | null;
  selectedAppPackageCount: number;
  appSelectionReturnPending: boolean;
  onRefresh: () => Promise<ProtectionRefreshResult>;
  onSyncAppPackages: () => Promise<ProtectionStatus>;
  onChooseApps: () => void;
  onAppSelectionReturnHandled: () => void;
  onContinue: () => void;
}) {
  const [busy, setBusy] = React.useState<"adult" | "apps" | "usage" | "settings" | "feed" | "sync-apps" | "test" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [retryAdultStart, setRetryAdultStart] = React.useState(false);
  const [setupDetailsExpanded, setSetupDetailsExpanded] = React.useState(false);
  const { height: windowHeight } = useWindowDimensions();
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

  const setupReadiness = React.useMemo(
    () => getProtectionSetupReadiness(protectionCapability, protectionStatus, selectedAppPackageCount),
    [protectionCapability, protectionStatus, selectedAppPackageCount]
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
    [protectionCapability, protectionStatus, selectedAppPackageCount]
  );
  const activationTestMatchesCurrentStatus = activationTest?.statusSignature === currentProtectionActivationSignature;
  const activationTestPassed = Boolean(
    activationTest?.adultBlocked &&
      activationTest.normalAllowed &&
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
      ? "Safari rules are loaded, but FREED Safari Blocker is disabled. Enable it in iOS Settings > Safari > Extensions, then return and run Test Protection."
      : protectionCapability?.platform === "ios" && reviewedAdultFeedRequired && rawSafariContentBlockerRuleCount > 0 && !hasReviewedSafariAdultDomainFeed(protectionStatus)
      ? "Safari has embedded fallback rules; production activation is waiting for reviewed Safari feed provenance."
      : null;
  const activationTestMessage = activationTest
    ? !activationTest.adultBlocked && !activationTest.normalAllowed
      ? "Activation test needs attention: local adult-domain block and normal-site allow checks both failed."
      : !activationTest.adultBlocked
      ? "Activation test needs attention: the local adult-domain check did not block."
      : !activationTest.normalAllowed
      ? "Activation test needs attention: the normal-site allow check did not pass."
      : activationTestPassed
      ? "Activation test passed. Native adult-domain blocking, normal-site allow behavior, and required permission/feed status are ready."
      : !activationTestMatchesCurrentStatus
      ? "Protection status changed since the last activation test. Run Test Protection again before activation can finish."
      : !activationTest.nativeChecked
      ? "Activation test could not run native diagnostics. Return from system settings, then run Test Protection again."
      : activationTest.nativeIssues.length > 0
      ? `Native diagnostics need attention: ${activationTest.nativeIssues.slice(0, 2).join(" ")}`
      : activationTest.nativeReady
      ? "Native domain checks passed, but current readiness changed. Review the required permission/feed rows, then run Test Protection again."
      : "Native domain checks passed without saving a blocked attempt. Finish the required permission and feed rows, then run this again."
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
      setBusy(kind);
      setActivationTest(null);
      action()
        .then((status) => {
          setNotice(safeUserFacingMessage(status.message, "Protection permission action completed."));
          if (kind === "adult" && Platform.OS === "android") {
            setRetryAdultStart(Boolean(status.vpnConsentRequired && !status.adultFilterActive));
          }
        })
        .catch((error) => {
          setNotice(safeUserFacingMessage(error, "Protection permission could not be completed."));
        })
        .finally(() => {
          void onRefresh();
          setBusy(null);
        });
    },
    [onRefresh]
  );

  const runFeedSync = React.useCallback(() => {
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
          setNotice("Embedded adult-domain fallback is loaded. Production activation still waits for reviewed feed provenance.");
        }
        await onRefresh();
      } catch (error) {
        setNotice(safeUserFacingMessage(error, "Adult-domain feed sync could not complete."));
      } finally {
        setBusy(null);
      }
    })();
  }, [onRefresh]);

  const runAppPackageSync = React.useCallback(() => {
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
        setBusy(null);
      }
    })();
  }, [onRefresh, onSyncAppPackages]);

  const runStepAction = React.useCallback(
    (step: ProtectionPermissionStep) => {
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

      if (targetStep.id === "ios-safari-content-blocker") {
        if (protectionStatus?.safariContentBlockerEnabled === false) {
          prepareSetupAutoAdvance(targetStep, { waitingForAppReturn: true });
          setNotice("Safari rules are loaded, but FREED Safari Blocker is disabled. Opening iOS Settings so you can enable the extension, then return to FREED.");
          runAction("settings", openProtectionSettings);
          return;
        }
        prepareSetupAutoAdvance(targetStep);
        runFeedSync();
        return;
      }

      switch (targetStep.action) {
        case "sync-adult-domain-feed":
          prepareSetupAutoAdvance(targetStep);
          runFeedSync();
          return;
        case "apply-adult-filter":
          prepareSetupAutoAdvance(targetStep, {
            waitingForAppReturn: Platform.OS === "android" && protectionStatus?.vpnConsentRequired !== false
          });
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
          runAction("settings", requestAndroidRecoveryNotificationVisibility);
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
      permissionPlan,
      prepareSetupAutoAdvance,
      protectionStatus?.safariContentBlockerEnabled,
      protectionStatus?.vpnConsentRequired,
      runAction,
      runAppPackageSync,
      runFeedSync,
      selectedAppPackageCount
    ]
  );

  React.useEffect(() => {
    if (!appSelectionReturnPending || busy !== null) return;

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
      void onRefresh();
    });

    return () => subscription.remove();
  }, [onRefresh]);

  React.useEffect(() => {
    if (!retryAdultStart || busy !== null || Platform.OS !== "android") return;

    if (protectionStatus?.adultFilterActive) {
      setRetryAdultStart(false);
      return;
    }

    if (protectionStatus?.vpnConsentRequired === false) {
      setRetryAdultStart(false);
      setNotice("Android VPN permission is approved. Starting DNS Guard now.");
      runAction("adult", applyAdultContentFilter);
    }
  }, [busy, protectionStatus?.adultFilterActive, protectionStatus?.vpnConsentRequired, retryAdultStart, runAction]);

  const runActivationTest = React.useCallback(() => {
    const adultSmokeHost = "pornhub.com";
    const normalSmokeHost = "www.khanacademy.org";
    const adultSmoke = classifyUrl(`https://${adultSmokeHost}`);
    const normalSmoke = classifyUrl(`https://${normalSmokeHost}`);
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
        const freshReadiness = getProtectionSetupReadiness(capability, status, selectedAppPackageCount);
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
        setBusy(null);
      }
    })();
  }, [currentProtectionActivationSignature, onRefresh, reviewedAdultFeedRequired, selectedAppPackageCount]);

  React.useEffect(() => {
    if (busy !== null || !nativeProtectionPlatform || activationComplete) return;

    const pending = setupAutoAdvanceRef.current;
    if (!pending) return;

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

    if (nextRequiredStep) {
      if (nextRequiredStep.id === completedStep.id) return;
      setNotice(
        pending.continueAfterOptional && completedStep.status !== "complete"
          ? `${completedStep.title} can be finished later. Continuing setup: ${nextRequiredStep.title}.`
          : `Continuing setup: ${nextRequiredStep.title}.`
      );
      runStepAction(nextRequiredStep);
      return;
    }

    if (activationReady && !activationTestPassed && !pending.testTriggered) {
      setupAutoAdvanceRef.current = { fromStepId: completedStep.id, testTriggered: true };
      setNotice("All required setup rows are ready. Running the activation test now.");
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
      onContinue();
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
    runStepAction
  ]);

  const primaryActionLabel = activationComplete
    ? "Activation Complete"
    : nextRequiredStep
      ? `Continue: ${nextRequiredStep.title}`
      : activationReady
        ? "Run Test First"
        : nativeProtectionPlatform
          ? "Finish Setup"
          : "Continue Preview";
  const androidOneStepSetup = Platform.OS === "android" || protectionCapability?.platform === "android";
  const androidRequiredSteps = React.useMemo(() => permissionPlan.filter((step) => step.required), [permissionPlan]);
  const androidWizardStep = nextRequiredStep ?? (!activationTestPassed ? activationRecoveryStep : null);
  const androidWizardIsRecoveryStep = Boolean(
    !nextRequiredStep && androidWizardStep && activationRecoveryStep?.id === androidWizardStep.id
  );
  const androidWizardStepIndex = androidWizardStep
    ? androidRequiredSteps.findIndex((step) => step.id === androidWizardStep.id)
    : -1;
  const androidTotalStepCount = Math.max(androidRequiredSteps.length + 1, 1);
  const androidCurrentStepNumber =
    activationComplete || (activationReady && !androidWizardStep)
      ? androidTotalStepCount
      : androidWizardStepIndex >= 0
        ? androidWizardStepIndex + 1
        : Math.min(permissionProgress.complete + 1, androidTotalStepCount);
  const androidProgressPercent = Math.max(
    8,
    Math.min(100, Math.round((androidCurrentStepNumber / androidTotalStepCount) * 100))
  );
  const androidCompactSetup = windowHeight < 720;
  const androidWizardStatusColor = activationComplete
    ? colors.mint
    : androidWizardStep?.status === "unavailable"
      ? colors.text3
      : activationReady && !androidWizardStep
        ? colors.sky
        : colors.yellow;
  const androidWizardTitle = activationComplete
    ? "Protection is on"
    : androidWizardStep
      ? androidWizardStep.title
      : activationReady
        ? "Test protection"
        : nativeProtectionPlatform
          ? "Checking setup"
          : "Native build required";
  const androidWizardSummary = getAndroidSetupStepSummary(androidWizardStep, {
    activationComplete,
    activationReady,
    activationTestPassed,
    selectedAppPackageCount,
    nativeProtectionPlatform,
    isRecoveryStep: androidWizardIsRecoveryStep
  });
  const androidWizardPrimaryLabel = getAndroidSetupStepActionLabel(androidWizardStep, {
    activationComplete,
    activationReady,
    activationTestPassed,
    selectedAppPackageCount,
    busy,
    nativeProtectionPlatform,
    isRecoveryStep: androidWizardIsRecoveryStep
  });
  const androidAdvancedDetailsMaxHeight = Math.max(150, Math.min(260, windowHeight * 0.34));
  const handleAndroidWizardPrimary = React.useCallback(() => {
    if (activationComplete || !nativeProtectionPlatform) {
      handleSetupContinue();
      return;
    }

    if (nextRequiredStep) {
      runStepAction(nextRequiredStep);
      return;
    }

    if (activationRecoveryStep && !activationTestPassed) {
      runStepAction(activationRecoveryStep);
      return;
    }

    if (activationReady && !activationTestPassed) {
      runActivationTest();
      return;
    }

    setNotice("Refreshing Android protection status. If you just returned from settings, FREED will continue with the next step.");
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

  if (androidOneStepSetup) {
    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              padding: androidCompactSetup ? 16 : 20,
              paddingBottom: androidCompactSetup ? 18 : 24,
              justifyContent: "space-between",
              gap: androidCompactSetup ? 10 : 14
            }}
          >
            <View style={{ alignItems: "center", gap: androidCompactSetup ? 6 : 9 }}>
              <ShieldCheck color={colors.mint} size={androidCompactSetup ? 32 : 38} />
              <Text selectable style={{ color: colors.text, textAlign: "center", fontSize: androidCompactSetup ? 25 : 29, fontWeight: typography.heavy }}>
                Turn on protection
              </Text>
              <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 20, fontSize: androidCompactSetup ? 13 : 14 }}>
                One step at a time. Android opens the right screen, then FREED continues here.
              </Text>
            </View>

            <Card gradient={activationComplete ? gradients.mint : undefined} style={{ gap: androidCompactSetup ? 12 : 14 }}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.heavy, textTransform: "uppercase" }}>
                    Step {androidCurrentStepNumber} of {androidTotalStepCount}
                  </Text>
                  <Text selectable style={{ color: androidWizardStatusColor, fontSize: 12, fontWeight: typography.heavy, textTransform: "uppercase" }}>
                    {activationComplete
                      ? "Ready"
                      : androidWizardStep
                        ? getProtectionPermissionStatusLabel(androidWizardStep.status)
                        : activationReady
                          ? "Ready to test"
                          : "Checking"}
                  </Text>
                </View>
                <View style={{ height: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <View style={{ width: `${androidProgressPercent}%`, height: "100%", borderRadius: 999, backgroundColor: androidWizardStatusColor }} />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 13, alignItems: "flex-start" }}>
                <View
                  style={{
                    width: androidCompactSetup ? 40 : 46,
                    height: androidCompactSetup ? 40 : 46,
                    borderRadius: 17,
                    backgroundColor: `${androidWizardStatusColor}22`,
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {activationComplete ? (
                    <Check color={androidWizardStatusColor} size={23} strokeWidth={4} />
                  ) : (
                    <Shield color={androidWizardStatusColor} size={22} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: colors.text, fontSize: androidCompactSetup ? 20 : 22, fontWeight: typography.heavy, lineHeight: androidCompactSetup ? 25 : 28 }}>
                    {androidWizardTitle}
                  </Text>
                  <Text selectable style={{ color: colors.text2, marginTop: 6, lineHeight: 21, fontSize: androidCompactSetup ? 13 : 14 }}>
                    {androidWizardSummary}
                  </Text>
                </View>
              </View>

              {activationTestMessage ? (
                <Text
                  selectable
                  numberOfLines={setupDetailsExpanded ? undefined : 2}
                  style={{ color: activationTestPassed ? colors.mint : colors.yellow, lineHeight: 20, fontWeight: typography.bold }}
                >
                  {activationTestMessage}
                </Text>
              ) : null}

              {notice ? (
                <Text
                  selectable
                  numberOfLines={setupDetailsExpanded ? undefined : 2}
                  style={{ color: colors.mint, lineHeight: 20, fontWeight: typography.bold }}
                >
                  {notice}
                </Text>
              ) : null}

              <PillButton
                label={androidWizardPrimaryLabel}
                onPress={handleAndroidWizardPrimary}
                disabled={busy !== null}
                icon={activationComplete ? <Check color={colors.bg} size={18} strokeWidth={4} /> : <ChevronRight color={colors.bg} size={18} />}
                accessibilityHint="Opens the next required Android permission screen or runs the protection test."
              />
            </Card>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={setupDetailsExpanded ? "Hide advanced setup details" : "Show advanced setup details"}
              onPress={() => setSetupDetailsExpanded((value) => !value)}
              style={({ pressed }) => ({
                alignSelf: "center",
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: pressed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.055)"
              })}
            >
              <Text selectable style={{ color: colors.text2, fontWeight: typography.heavy }}>
                {setupDetailsExpanded ? "Hide advanced details" : "Advanced details"}
              </Text>
            </Pressable>

            {setupDetailsExpanded ? (
              <View style={{ maxHeight: androidAdvancedDetailsMaxHeight, borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
                  {permissionPlan.map((step) => {
                    const stepColor = getProtectionPermissionStatusColor(step.status);
                    return (
                      <View key={step.id} style={{ gap: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: `${stepColor}22`, alignItems: "center", justifyContent: "center" }}>
                            {step.status === "complete" ? <Check color={stepColor} size={12} strokeWidth={4} /> : <Shield color={stepColor} size={11} />}
                          </View>
                          <Text selectable style={{ color: colors.text, flex: 1, fontWeight: typography.heavy }}>
                            {step.title}
                          </Text>
                          <Text selectable style={{ color: stepColor, fontSize: 10, fontWeight: typography.heavy, textTransform: "uppercase" }}>
                            {getProtectionPermissionStatusLabel(step.status)}
                          </Text>
                        </View>
                        <Text selectable style={{ color: colors.text3, lineHeight: 18, fontSize: 12 }}>
                          {step.permissionLabel}: {step.reason}
                        </Text>
                      </View>
                    );
                  })}
                  {protectionSyncMessage ? (
                    <Text selectable style={{ color: colors.yellow, lineHeight: 19, fontWeight: typography.bold }}>
                      {protectionSyncMessage}
                    </Text>
                  ) : null}
                  {androidSettingsReturnHintText ? (
                    <Text selectable style={{ color: colors.yellow, lineHeight: 19, fontWeight: typography.bold }}>
                      {androidSettingsReturnHintText}
                    </Text>
                  ) : null}
                  {activationTest?.nativeMessage && !activationTestPassed ? (
                    <Text selectable style={{ color: colors.text3, lineHeight: 18, fontSize: 12 }}>
                      {activationTest.nativeMessage}
                    </Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : (
              <Text selectable style={{ color: colors.text3, textAlign: "center", lineHeight: 19, fontSize: 12 }}>
                FREED cannot turn Android permissions on silently. This button opens the right screen and setup resumes here.
              </Text>
            )}
          </View>
        </SafeAreaView>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 34, gap: 18 }}>
          <LinearGradient colors={["#10251F", "#151421"]} style={{ borderRadius: 30, padding: 22, gap: 12 }}>
            <ShieldCheck color={colors.mint} size={42} style={{ alignSelf: "center" }} />
            <Text selectable style={{ color: colors.text, textAlign: "center", fontSize: 31, fontWeight: typography.heavy }}>
              Turn on real protection
            </Text>
            <Text selectable style={{ color: colors.text2, textAlign: "center", fontSize: 15, lineHeight: 22 }}>
              {PROTECTION_PERMISSION_EXPLANATION}
            </Text>
          </LinearGradient>

          <FocusShieldSection
            protectionCapability={protectionCapability}
            protectionStatus={protectionStatus}
            onRefresh={onRefresh}
          />

          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                  Permission checklist
                </Text>
                <Text selectable style={{ color: colors.text2, marginTop: 5, lineHeight: 21 }}>
                  Each permission has one job. FREED avoids continuous screen capture, OCR, packet inspection, and full-traffic proxying.
                </Text>
                {nextRequiredStep ? (
                  <Text selectable style={{ color: colors.yellow, marginTop: 8, lineHeight: 20, fontWeight: typography.bold }}>
                    Next required step: {nextRequiredStep.title}
                  </Text>
                ) : null}
              </View>
              <Text selectable style={{ color: permissionProgress.ready ? colors.mint : colors.yellow, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {permissionProgress.complete}/{permissionProgress.required}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {permissionPlan.map((step) => {
                const stepColor = getProtectionPermissionStatusColor(step.status);
                return (
                  <View key={step.id} style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", paddingTop: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: `${stepColor}22`, alignItems: "center", justifyContent: "center" }}>
                        {step.status === "complete" ? <Check color={stepColor} size={14} strokeWidth={4} /> : <Shield color={stepColor} size={13} />}
                      </View>
                      <Text selectable style={{ color: colors.text, flex: 1, fontWeight: typography.heavy }}>
                        {step.title}
                      </Text>
                      <Text selectable style={{ color: stepColor, fontSize: 11, fontWeight: typography.heavy, textTransform: "uppercase" }}>
                        {getProtectionPermissionStatusLabel(step.status)}
                      </Text>
                    </View>
                    <Text selectable style={{ color: colors.text2, marginTop: 6, lineHeight: 19 }}>
                      {step.permissionLabel}: {step.reason}
                    </Text>
                    <Text selectable style={{ color: colors.text3, marginTop: 4, lineHeight: 18, fontSize: 12 }}>
                      {step.dataBoundary}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card gradient={adultFilterActive ? gradients.mint : undefined}>
            <View style={{ flexDirection: "row", gap: 13, alignItems: "flex-start" }}>
              <View style={{ width: 42, height: 42, borderRadius: 17, backgroundColor: adultFilterActive ? colors.mint : "rgba(90,223,158,0.13)", alignItems: "center", justifyContent: "center" }}>
                {adultFilterActive ? <Check color={colors.bg} size={22} strokeWidth={4} /> : <Shield color={colors.mint} size={22} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                  Adult content blocking
                </Text>
                <Text selectable style={{ color: colors.text2, marginTop: 5, lineHeight: 21 }}>
                  Android uses FREED DNS Guard permission for device-level adult-domain blocking. iOS uses Screen Time and Managed Settings where available.
                </Text>
                {protectionCapability?.platform === "android" ? (
                  <Text selectable style={{ color: nativeAdultFeedCount > 0 ? colors.mint : colors.yellow, marginTop: 8, lineHeight: 19, fontSize: 12, fontWeight: typography.bold }}>
                    {nativeAdultFeedProvenanceText}
                  </Text>
                ) : null}
                {dnsGuardRuntimeNeedsAttention ? (
                  <Text selectable style={{ color: colors.yellow, marginTop: 8, lineHeight: 19, fontSize: 12, fontWeight: typography.bold }}>
                    DNS Guard runtime needs attention: {protectionStatus?.dnsGuardRuntimeIssue ?? "return to FREED and start DNS Guard again before testing protection."}
                  </Text>
                ) : null}
                {safariAdultFeedProvenanceText ? (
                  <Text selectable style={{ color: colors.yellow, marginTop: 8, lineHeight: 19, fontSize: 12, fontWeight: typography.bold }}>
                    {safariAdultFeedProvenanceText}
                  </Text>
                ) : null}
              </View>
            </View>
            {protectionSyncMessage ? (
              <Text selectable style={{ color: colors.yellow, marginTop: 12, lineHeight: 20, fontWeight: typography.bold }}>
                {protectionSyncMessage}
              </Text>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <PillButton
                label={adultFilterActive ? "Adult Block Active" : busy === "adult" ? "Opening Permission..." : orderedSetupActionLabel(adultFilterStep, "Enable Adult Block")}
                disabled={busy !== null || adultFilterActive}
                onPress={() => (adultFilterStep ? runStepAction(adultFilterStep) : runAction("adult", applyAdultContentFilter))}
              />
            </View>
          </Card>

          {androidRecoveryNotificationsNeedAttention ? (
            <Card>
              <View style={{ flexDirection: "row", gap: 13, alignItems: "flex-start" }}>
                <View style={{ width: 42, height: 42, borderRadius: 17, backgroundColor: "rgba(255,216,106,0.13)", alignItems: "center", justifyContent: "center" }}>
                  <Bell color={colors.yellow} size={21} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
                    Recovery notifications
                  </Text>
                  <Text selectable style={{ color: colors.text2, marginTop: 6, lineHeight: 20 }}>
                    Android can hide background challenge launches unless FREED notifications are allowed. FREED asks in-app first and opens the exact notification settings screen only if Android still needs it.
                  </Text>
                </View>
              </View>
              <View style={{ marginTop: 14 }}>
                <PillButton
                  label={busy === "settings" ? "Checking..." : "Allow Recovery Notifications"}
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() =>
                    recoveryNotificationStep
                      ? runStepAction(recoveryNotificationStep)
                      : runAction("settings", requestAndroidRecoveryNotificationVisibility)
                  }
                />
              </View>
            </Card>
          ) : null}

          {protectionCapability?.platform === "android" && privateDnsActive ? (
            <Card gradient={privateDnsStrict ? gradients.yellow : undefined}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
                Private DNS check
              </Text>
              <Text selectable style={{ color: colors.text2, marginTop: 8, lineHeight: 21 }}>
                {privateDnsStrict
                  ? `Strict Private DNS${protectionStatus?.privateDnsSpecifier ? ` (${protectionStatus.privateDnsSpecifier})` : ""} is enabled. Review Android Network & internet settings, then return and run Test Protection so DNS Guard evidence proves the resolver path.`
                  : "Android Private DNS is visible for QA. FREED still uses Accessibility and DNS Guard evidence to confirm protection on this device."}
              </Text>
              <View style={{ marginTop: 14 }}>
                <PillButton
                  label={busy === "settings" ? "Opening Settings..." : "Review Private DNS"}
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => (privateDnsStep ? runStepAction(privateDnsStep) : runAction("settings", openPrivateDnsSettings))}
                />
              </View>
            </Card>
          ) : null}

          <Card gradient={appInterventionReady ? gradients.purple : undefined}>
            <View style={{ flexDirection: "row", gap: 13, alignItems: "flex-start" }}>
              <View style={{ width: 42, height: 42, borderRadius: 17, backgroundColor: appInterventionReady ? colors.purple : "rgba(184,152,255,0.13)", alignItems: "center", justifyContent: "center" }}>
                {appInterventionReady ? <Check color={colors.white} size={22} strokeWidth={4} /> : <TimerReset color={colors.purple} size={22} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                  Instagram and app timers
                </Text>
                <Text selectable style={{ color: colors.text2, marginTop: 5, lineHeight: 21 }}>
                  {protectionCapability?.platform === "ios"
                    ? "On iOS, FREED uses Screen Time app-level daily limits and shields selected apps after the threshold. Native Reels, Shorts, and TikTok screens are not inspected."
                    : protectionCapability?.platform === "android"
                    ? "On Android, Accessibility and Usage Access handle selected app timers and can interrupt sustained Shorts/Reels/TikTok For You loops when the selected surface is visible."
                    : "Signed iOS and Android builds use platform-native timers and interruptions after activation."}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {DOOMSCROLL_APP_OPTIONS.map((option) => (
                <Text key={option.androidPackage} selectable style={{ color: colors.purple, backgroundColor: "rgba(184,152,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, fontWeight: typography.heavy }}>
                  {option.label}
                </Text>
              ))}
            </View>
            <Text selectable style={{ color: colors.text3, marginTop: 12, lineHeight: 19 }}>
              {protectionCapability?.platform === "ios"
                ? selectedIosTargets > 0
                  ? `${selectedIosTargets} Screen Time target${selectedIosTargets === 1 ? "" : "s"} selected${protectionStatus?.appLimitScheduled ? ` with a ${protectionStatus.dailyLimitMinutes ?? 20} minute daily limit monitor.` : "."}`
                  : "Choose apps or sites with the iOS Screen Time picker so FREED can shield them."
                : appCount > 0
                ? `${appCount} selected app timer${appCount === 1 ? "" : "s"} configured. Usage Access ${protectionStatus?.usageStatsAuthorized ? "is on" : "is needed"} for same-day checks.`
                : "No Android app timers are selected yet. Choose at least one app now so activation can finish."}
            </Text>
            {protectionCapability?.platform === "android" && selectedAppPackageCount <= 0 ? (
              <View style={{ marginTop: 10 }}>
                <PillButton
                  label="Choose Apps to Protect"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={onChooseApps}
                />
              </View>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <PillButton
                label={appInterventionReady ? "App Timer Permission On" : busy === "apps" ? "Opening Settings..." : orderedSetupActionLabel(appInterventionStep, "Enable App Timer Permission")}
                variant={appInterventionReady ? "success" : "ghost"}
                disabled={busy !== null || appInterventionReady}
                onPress={() => (appInterventionStep ? runStepAction(appInterventionStep) : runAction("apps", requestProtectionAuthorization))}
              />
            </View>
            {protectionCapability?.platform === "ios" ? (
              <View style={{ marginTop: 10 }}>
                <PillButton
                  label={selectedIosTargets > 0 ? "Edit Screen Time Targets" : "Choose Apps to Shield"}
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => runAction("apps", presentFamilyActivityPicker)}
                />
              </View>
            ) : (
              <View style={{ marginTop: 10 }}>
                <PillButton
                  label={protectionStatus?.usageStatsAuthorized ? "Usage Access On" : busy === "usage" ? "Opening Usage Access..." : orderedSetupActionLabel(usageAccessStep, "Enable Usage Access")}
                  variant={protectionStatus?.usageStatsAuthorized ? "success" : "ghost"}
                  disabled={busy !== null || Boolean(protectionStatus?.usageStatsAuthorized)}
                  onPress={() => (usageAccessStep ? runStepAction(usageAccessStep) : runAction("usage", openUsageAccessSettings))}
                />
              </View>
            )}
          </Card>

          {protectionCapability?.platform === "android" ? (
            <Card>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
                Accessibility disclosure
              </Text>
              <Text selectable style={{ color: colors.text2, marginTop: 8, lineHeight: 21 }}>
                FREED uses Android Accessibility only after you enable it to read the current app package, supported browser address fields, focused WebView URL/search fields, selected short-form labels or IDs such as Shorts/Reels/For You, and bounded scroll events in selected apps after your configured threshold. YouTube Shorts, Instagram Reels, and TikTok For You interruptions require the selected short-form surface to still be visible when the threshold is reached. This data is used on-device to start recovery challenges and app timers, is not sold, and is not shared for ads.
              </Text>
            </Card>
          ) : null}

          <Card gradient={activationTestPassed ? gradients.mint : undefined}>
            <View style={{ flexDirection: "row", gap: 13, alignItems: "flex-start" }}>
              <View style={{ width: 42, height: 42, borderRadius: 17, backgroundColor: activationTestPassed ? colors.mint : "rgba(130,206,255,0.13)", alignItems: "center", justifyContent: "center" }}>
                {activationTestPassed ? <Check color={colors.bg} size={22} strokeWidth={4} /> : <ShieldCheck color={colors.sky} size={22} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                  Test Protection
                </Text>
                <Text selectable style={{ color: colors.text2, marginTop: 5, lineHeight: 21 }}>
                  Runs native adult-domain and normal-site diagnostics plus a local classifier sanity check without saving a blocked attempt.
                </Text>
              </View>
            </View>
            {activationTestMessage ? (
              <Text selectable style={{ color: activationTestPassed ? colors.mint : colors.yellow, marginTop: 12, lineHeight: 20, fontWeight: typography.bold }}>
                {activationTestMessage}
              </Text>
            ) : null}
            {activationTest?.nativeMessage && !activationTestPassed ? (
              <Text selectable style={{ color: colors.text3, marginTop: 8, lineHeight: 18, fontSize: 12 }}>
                {activationTest.nativeMessage}
              </Text>
            ) : null}
            {activationRecoveryStep && !activationTestPassed ? (
              <View style={{ marginTop: 12 }}>
                <PillButton
                  label={`Fix: ${activationRecoveryStep.title}`}
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => runStepAction(activationRecoveryStep)}
                />
              </View>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <PillButton
                label={activationTestPassed ? "Protection Test Passed" : "Run Activation Test"}
                variant={activationTestPassed ? "success" : "ghost"}
                disabled={busy !== null}
                onPress={runActivationTest}
              />
            </View>
          </Card>

          {notice ? (
            <Text selectable style={{ color: colors.mint, textAlign: "center", lineHeight: 21, fontWeight: typography.bold }}>
              {notice}
            </Text>
          ) : null}

          {androidSettingsReturnHintText ? (
            <Text selectable style={{ color: colors.yellow, textAlign: "center", lineHeight: 20, fontWeight: typography.bold }}>
              {androidSettingsReturnHintText}
            </Text>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PillButton
                label={nextRequiredStep ? `Open: ${nextRequiredStep.title}` : "Open Settings"}
                variant="ghost"
                disabled={busy !== null}
                onPress={() => (nextRequiredStep ? runStepAction(nextRequiredStep) : runAction("settings", openProtectionSettings))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PillButton
                label={primaryActionLabel}
                onPress={handleSetupContinue}
                disabled={busy !== null}
              />
            </View>
          </View>

          <Text selectable style={{ color: colors.text3, textAlign: "center", lineHeight: 19 }}>
            {protectionCapability?.platform === "android"
              ? "Required Android setup: reviewed adult-domain feed, DNS-only VPN, Usage Access, Accessibility, selected app timers, then Test Protection. Notifications and challenge sensors are on demand."
              : protectionCapability?.platform === "ios"
              ? "Required iOS setup: Screen Time authorization, adult-domain Safari Content Blocker, Safari Focus Shield for Shorts/Reels, selected targets, daily-limit monitoring, then Test Protection. iOS DNS filtering is unavailable; challenge sensors are on demand."
              : "Native blocking requires a signed iOS or Android build."}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
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

function getAndroidSetupStepSummary(
  step: ProtectionPermissionStep | null,
  context: {
    activationComplete: boolean;
    activationReady: boolean;
    activationTestPassed: boolean;
    selectedAppPackageCount: number;
    nativeProtectionPlatform: boolean;
    isRecoveryStep: boolean;
  }
) {
  if (context.activationComplete) {
    return "Protection is active on this device. FREED checked the required Android layers and the block test passed.";
  }

  if (!context.nativeProtectionPlatform) {
    return "Install a native Android build to turn on real DNS Guard, Usage Access, and Accessibility protection.";
  }

  if (!step && context.activationReady && !context.activationTestPassed) {
    return "FREED will check one known adult host and one normal host before it unlocks the app.";
  }

  if (!step) {
    return "FREED is checking this device. Return here after Android settings and the next step will appear automatically.";
  }

  if (context.isRecoveryStep) {
    return "The protection test found one layer that needs another look. Open this step, make the change, then return to FREED.";
  }

  switch (step.id) {
    case "android-native-adult-domain-feed":
      return "FREED loads its reviewed adult-domain list before any protection can be saved.";
    case "android-dns-guard":
      return "Android will show a VPN consent screen. FREED uses this only as a DNS guard for adult domains.";
    case "android-usage-access":
      return "Open Usage Access and allow FREED so selected app timers keep working after app switches or restarts.";
    case "android-accessibility":
      return "Open Accessibility and turn on FREED Protection so browser and selected-app attempts can redirect to recovery.";
    case "android-doomscroll-apps":
      return context.selectedAppPackageCount > 0
        ? "Sync the selected apps to Android protection so timers and short-form interruptions can run."
        : "Choose at least one app to protect so Android setup can finish.";
    case "android-recovery-notifications":
      return "Allow recovery notifications so Android can keep a challenge visible when a blocked attempt happens in the background.";
    case "android-private-dns-guidance":
      return "Review Android Private DNS, then return and test protection so DNS Guard proof is accurate.";
    default:
      return step.reason;
  }
}

function getAndroidSetupStepActionLabel(
  step: ProtectionPermissionStep | null,
  context: {
    activationComplete: boolean;
    activationReady: boolean;
    activationTestPassed: boolean;
    selectedAppPackageCount: number;
    busy: string | null;
    nativeProtectionPlatform: boolean;
    isRecoveryStep: boolean;
  }
) {
  if (context.busy) {
    switch (context.busy) {
      case "feed":
        return "Syncing Adult List...";
      case "adult":
        return "Opening DNS Guard...";
      case "usage":
        return "Opening Usage Access...";
      case "apps":
        return "Opening Permission...";
      case "settings":
        return "Opening Settings...";
      case "sync-apps":
        return "Syncing Apps...";
      case "test":
        return "Testing Protection...";
      default:
        return "Working...";
    }
  }

  if (context.activationComplete) return "Enter FREED";
  if (!context.nativeProtectionPlatform) return "Continue Preview";
  if (!step && context.activationReady && !context.activationTestPassed) return "Test Protection";
  if (!step) return "Refresh Setup";

  if (context.isRecoveryStep) return `Fix ${step.title}`;

  switch (step.id) {
    case "android-native-adult-domain-feed":
      return "Sync Adult List";
    case "android-dns-guard":
      return "Start DNS Guard";
    case "android-usage-access":
      return "Open Usage Access";
    case "android-accessibility":
      return "Open Accessibility";
    case "android-doomscroll-apps":
      return context.selectedAppPackageCount > 0 ? "Sync Selected Apps" : "Choose Apps";
    case "android-recovery-notifications":
      return "Allow Notifications";
    case "android-private-dns-guidance":
      return "Review Private DNS";
    default:
      return "Continue";
  }
}

// ── WeekStrip (matches freed-v2/screens-home.jsx) ──────────────────────────────
function WeekStrip({ recoveryState }: { recoveryState: RecoveryState }) {
  const dates = React.useMemo(() => getRecentWeekDates(), []);
  const todayKey = getLocalDateKey(new Date());
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {dates.map((date, index) => {
        const dateKey = getLocalDateKey(date);
        const day = date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
        const isToday = dateKey === todayKey;
        const done = hasRecoverySignalForDate(recoveryState, date);
        return (
          <View key={`${dateKey}-${index}`} style={{ flex: 1, alignItems: "center", gap: 5 }}>
            <Text selectable style={{ fontSize: 10, color: colors.text3, fontWeight: typography.semibold }}>
              {day}
            </Text>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                backgroundColor: isToday ? "rgba(184,152,255,0.18)" : done ? "rgba(90,223,158,0.16)" : colors.surface,
                borderWidth: isToday ? 2 : 1.5,
                borderColor: isToday ? "rgba(184,152,255,0.55)" : done ? "rgba(90,223,158,0.3)" : "rgba(255,255,255,0.07)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {isToday ? (
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.purple }} />
              ) : done ? (
                <Check color={colors.mint} size={13} strokeWidth={3} />
              ) : (
                <X color={colors.text3} size={10} strokeWidth={3} />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── StreakOrb (large circular progress ring · matches freed-v2 design) ────────
function StreakOrb({ days, size = 156 }: { days: number; size?: number }) {
  const pct = Math.min(100, Math.round((days / 90) * 100));
  const stroke = 10;
  const r = (size - stroke) / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={colors.purple}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
        <Text selectable style={{ color: colors.text, fontSize: 32, fontWeight: typography.heavy, lineHeight: 36, letterSpacing: -1 }}>
          {pct}
          <Text style={{ fontSize: 16, color: colors.text2, fontWeight: typography.semibold }}>%</Text>
        </Text>
        <Text selectable style={{ color: colors.text3, fontSize: 10, fontWeight: typography.semibold, marginTop: 2 }}>
          Complete
        </Text>
      </View>
    </View>
  );
}

// ── SideStatCard (small stat tile in Today's Progress) ─────────────────────────
function SideStatCard({
  value,
  label,
  accent,
  gradient,
  emoji
}: {
  value: string | number;
  label: string;
  accent: string;
  gradient: readonly [string, string];
  emoji: string;
}) {
  return (
    <LinearGradient colors={gradient} style={{ borderRadius: 18, padding: 11, flex: 1, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 12 }}>{emoji}</Text>
        </View>
        <Text selectable style={{ fontSize: 10, color: accent, fontWeight: typography.heavy, letterSpacing: 0.3 }}>
          {label}
        </Text>
      </View>
      <Text selectable style={{ fontSize: 22, fontWeight: typography.heavy, color: colors.text, lineHeight: 24, letterSpacing: -0.5 }}>
        {value}
      </Text>
    </LinearGradient>
  );
}

// ── SummaryCard (2x2 grid tiles in Summary section) ───────────────────────────
function SummaryCard({
  value,
  label,
  accent,
  gradient,
  emoji
}: {
  value: string | number;
  label: string;
  accent: string;
  gradient: readonly [string, string];
  emoji: string;
}) {
  return (
    <LinearGradient colors={gradient} style={{ borderRadius: 22, padding: 16, minHeight: 118, flex: 1 }}>
      <Text selectable style={{ fontSize: 34, fontWeight: typography.heavy, color: colors.text, lineHeight: 38, letterSpacing: -1 }}>
        {value}
      </Text>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
        <Text selectable style={{ fontSize: 12, color: accent, fontWeight: typography.semibold }}>
          {label}
        </Text>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14 }}>{emoji}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

// ── PledgeBanner (yellow daily pledge action banner) ──────────────────────────
function PledgeBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <LinearGradient
        colors={gradients.yellow}
        style={{ borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5, borderColor: "rgba(255,214,102,0.2)" }}
      >
        <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: "rgba(255,214,102,0.18)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 20 }}>🙏</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ fontSize: 14, fontWeight: typography.heavy, color: colors.text }}>
            Take Today's Pledge
          </Text>
          <Text selectable style={{ fontSize: 12, color: colors.text2, fontWeight: typography.medium, marginTop: 2 }}>
            Renew your commitment daily
          </Text>
        </View>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.yellow, alignItems: "center", justifyContent: "center" }}>
          <ChevronRight color="#221C10" size={16} strokeWidth={3} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// ── HabitRow (today's habits checklist) ───────────────────────────────────────
type HabitItem = { key: DailyHabitKey; label: string; done: boolean; accent: string };
function HabitRow({ habit, index, onToggle }: { habit: HabitItem; index: number; onToggle: () => void }) {
  const bg = habit.done ? gradients.mint : null;
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 9,
          backgroundColor: habit.done ? colors.mint : "rgba(255,255,255,0.07)",
          borderWidth: habit.done ? 0 : 1.5,
          borderColor: "rgba(255,255,255,0.1)",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {habit.done ? <Check color="#0A2018" size={13} strokeWidth={3} /> : null}
      </View>
      <Text
        selectable
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: habit.done ? typography.medium : typography.semibold,
          color: habit.done ? colors.text2 : colors.text,
          textDecorationLine: habit.done ? "line-through" : "none"
        }}
      >
        {habit.label}
      </Text>
      {!habit.done ? (
        <View style={{ width: 20, height: 20, borderRadius: 7, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.04)" }} />
      ) : null}
    </View>
  );

  return (
    <Pressable
      onPress={() => {
        tap();
        onToggle();
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: pressed ? 0.92 : 1 })}
      key={index}
    >
      {bg ? (
        <LinearGradient colors={bg} style={{ borderRadius: 16 }}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: 16 }}>{inner}</View>
      )}
    </Pressable>
  );
}

function HomeScreen({
  recoveryState,
  streakDays,
  recoveryScore,
  completedChallenges,
  todayCheckIn,
  milestone,
  onCheckIn,
  onPanic,
  onAttempt,
  onHabitToggle,
  premium
}: {
  recoveryState: RecoveryState;
  streakDays: number;
  recoveryScore: number;
  completedChallenges: number;
  todayCheckIn: DailyCheckIn | null;
  milestone: RecoveryMilestone;
  onCheckIn: () => void;
  onPanic: () => void;
  onAttempt: (url: string) => void;
  onHabitToggle: (habit: HabitItem) => void;
  premium: boolean;
}) {
  const [nowMs, setNowMs] = React.useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const completedHabitKeys = new Set(
    getDailyHabitCompletionsForDay(recoveryState)
      .filter((habit) => habit.completed)
      .map((habit) => habit.key)
  );
  const habits = habitLibrary.map((habit) => ({
    ...habit,
    done: completedHabitKeys.has(habit.key)
  }));

  const completedHabits = habits.filter((h) => h.done).length;
  const totalHabits = habits.length;
  const daysTo90 = Math.max(0, 90 - streakDays);
  const recoveryLevel = calculateRecoveryLevel(recoveryState);
  const karma = recoveryLevel.xp;
  const rewardPct = Math.min(100, Math.round((streakDays / 90) * 100));
  const elapsed = formatElapsedSince(recoveryState.recoveryStartedAt, nowMs);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 112 }}
      style={{ backgroundColor: colors.bg }}
    >
      {/* Header — logo + streak chip + community + settings */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <FreedLogo compact />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,155,114,0.18)", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 5 }}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text selectable style={{ fontSize: 13, fontWeight: typography.heavy, color: colors.peach }}>
              {streakDays}
            </Text>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck color={premium ? colors.mint : colors.text2} size={16} />
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
            <Target color={colors.text2} size={15} />
          </View>
        </View>
      </View>

      {/* Week strip */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <WeekStrip recoveryState={recoveryState} />
      </View>

      {/* Today's Progress — StreakOrb + 3 SideStatCards */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Text selectable style={{ fontSize: 16, fontWeight: typography.heavy, color: colors.text }}>
            Today&apos;s Progress
          </Text>
          <Text selectable style={{ fontSize: 12, color: colors.purple, fontWeight: typography.bold }}>
            View All
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "stretch" }}>
          <StreakOrb days={streakDays} />
          <View style={{ flex: 1, flexDirection: "column", gap: 8 }}>
            <SideStatCard value={streakDays} label="Day Streak" accent={colors.peach} gradient={gradients.peach} emoji="🔥" />
            <SideStatCard value={`${completedHabits}/${totalHabits}`} label="Habits Done" accent={colors.purple} gradient={gradients.purple} emoji="✓" />
            <SideStatCard value={daysTo90} label="Days to 90" accent={colors.mint} gradient={gradients.mint} emoji="🎯" />
          </View>
        </View>
      </View>

      {/* Daily Pledge banner */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <PledgeBanner onPress={onCheckIn} />
      </View>

      {/* Summary 2x2 grid */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Text selectable style={{ fontSize: 16, fontWeight: typography.heavy, color: colors.text }}>
            Summary
          </Text>
          <Text selectable style={{ fontSize: 12, color: colors.purple, fontWeight: typography.bold }}>
            View All
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <SummaryCard value={streakDays} label="Day Streak" accent={colors.peach} gradient={gradients.peach} emoji="🔥" />
          <SummaryCard value={`${completedHabits}/${totalHabits}`} label="Habits Done" accent={colors.pink} gradient={gradients.pink} emoji="✓" />
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <SummaryCard value={daysTo90} label="Days to 90" accent={colors.purple} gradient={gradients.purple} emoji="🎯" />
          <SummaryCard value={karma} label="Karma Points" accent={colors.sky} gradient={gradients.sky} emoji="💎" />
        </View>
      </View>

      {/* Brain Rewiring */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Text selectable style={{ fontSize: 14, color: colors.text, fontWeight: typography.bold }}>
              🧠 Brain Rewiring
            </Text>
            <Text selectable style={{ fontSize: 14, fontWeight: typography.heavy, color: colors.purple }}>
              {rewardPct}%
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
            <LinearGradient colors={[colors.purple, colors.pink]} style={{ height: "100%", width: `${rewardPct}%`, borderRadius: 99 }} />
          </View>
          <Text selectable style={{ fontSize: 11, color: colors.text3, fontWeight: typography.medium, marginTop: 10 }}>
            Dopamine receptors restoring · Day {streakDays} of 90
          </Text>
        </View>
      </View>

      {/* Today's Habits */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <Text selectable style={{ fontSize: 16, fontWeight: typography.heavy, color: colors.text }}>
            Today&apos;s Habits
          </Text>
          <Text selectable style={{ fontSize: 12, color: colors.purple, fontWeight: typography.bold }}>
            {completedHabits}/{totalHabits}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          {habits.map((habit, index) => (
            <HabitRow key={habit.label} habit={habit} index={index} onToggle={() => onHabitToggle(habit)} />
          ))}
        </View>
      </View>

      {/* Active streak counter (kept from previous design — preserves the elapsed-time chip the reference shows on settings) */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <View style={{ alignItems: "center", paddingVertical: 14, backgroundColor: colors.surface, borderRadius: 18 }}>
          <Text selectable style={{ color: colors.text3, fontSize: 11, fontWeight: typography.semibold, letterSpacing: 1 }}>
            ADULT-CONTENT FREE
          </Text>
          <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: typography.heavy, fontVariant: ["tabular-nums"], marginTop: 2 }}>
            {elapsed}
          </Text>
        </View>
      </View>

      {/* Milestone tracker — preserved from existing engine */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <Card gradient={milestone.achieved ? gradients.mint : gradients.sky}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Trophy color={milestone.achieved ? colors.mint : colors.sky} size={28} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                <Text selectable style={{ color: colors.text, fontSize: 15, fontWeight: typography.heavy, flex: 1 }}>
                  {milestone.title}
                </Text>
                <Text selectable style={{ color: milestone.achieved ? colors.mint : colors.sky, fontWeight: typography.heavy, fontSize: 12 }}>
                  {milestone.achieved ? "Unlocked" : `${milestone.currentDays}/${milestone.targetDays}`}
                </Text>
              </View>
              <Text selectable style={{ color: colors.text2, lineHeight: 19, fontSize: 13 }}>
                {milestone.detail}
              </Text>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.09)", overflow: "hidden" }}>
                <LinearGradient colors={milestone.achieved ? [colors.mint, colors.sky] : [colors.sky, colors.purple]} style={{ width: `${Math.round(milestone.progress * 100)}%`, height: "100%" }} />
              </View>
            </View>
          </View>
        </Card>
      </View>

      {/* Adult-only protection status */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
        <Card gradient={gradients.mint}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <ShieldCheck color={colors.mint} size={26} />
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: typography.heavy }}>
                Adult-only protection active
              </Text>
              <Text selectable style={{ color: colors.text2, marginTop: 3, fontSize: 12, lineHeight: 17 }}>
                Google, YouTube, Instagram, X, education, games — daily browsing is untouched. Recovery score: {recoveryScore}%
              </Text>
            </View>
          </View>
        </Card>
      </View>

      {/* Panic Button — heart-shaped action */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <Pressable
          onPress={() => {
            tap();
            onPanic();
          }}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
        >
          <LinearGradient
            colors={gradients.pink}
            style={{
              height: 62,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: "rgba(255,109,158,0.28)",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 10
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,109,158,0.18)", alignItems: "center", justifyContent: "center" }}>
              <Lock color={colors.pink} size={17} strokeWidth={2.5} />
            </View>
            <Text selectable style={{ fontSize: 17, fontWeight: typography.heavy, color: colors.pink }}>
              Panic Button
            </Text>
          </LinearGradient>
        </Pressable>
      </View>

      {showQaControls ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <PillButton label="Simulate adult attempt (QA)" variant="ghost" onPress={() => onAttempt("https://pornhub.com/watch")} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function AnalyticsScreen({
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
  onEnableAnalyticsSharing,
  onDisableAnalyticsSharing,
  onSendAnalyticsSnapshot,
  urgeRiskForecast
}: {
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
  onEnableAnalyticsSharing: () => void;
  onDisableAnalyticsSharing: () => void;
  onSendAnalyticsSnapshot: () => void;
  urgeRiskForecast: LocalUrgeRiskForecast;
}) {
  const score = calculateRecoveryScore(streakDays, completedChallenges, attemptsToday);
  const hasCheckInSignals = checkInSummary.total > 0;
  const hasChallengeSignals = analyticsSnapshot.interventions.completedChallenges > 0;
  const clarityScore = hasCheckInSignals
    ? Math.max(0, Math.min(100, Math.round(100 - checkInSummary.averageUrge * 16 + checkInSummary.steadyDays * 4)))
    : 0;
  const energyScore = hasCheckInSignals ? Math.max(0, Math.min(100, Math.round(checkInSummary.averageSleep * 20))) : 0;
  const urgeControlScore = hasChallengeSignals
    ? analyticsSnapshot.interventions.challengeHelpRate
    : attemptsToday > 0
    ? Math.max(0, 100 - attemptsToday * 20)
    : 0;
  const sleepGuardScore = hasCheckInSignals ? Math.max(0, Math.min(100, Math.round(checkInSummary.averageSleep * 20))) : 0;
  const bars = [
    ["Discipline", score, colors.purple],
    ["Clarity", clarityScore, colors.mint],
    ["Energy", energyScore, colors.peach],
    ["Urge Control", urgeControlScore, colors.pink],
    ["Sleep Guard", sleepGuardScore, colors.sky]
  ];
  const forecastAccent =
    urgeRiskForecast.level === "high" ? colors.pink : urgeRiskForecast.level === "elevated" ? colors.peach : colors.mint;
  const forecastGradient =
    urgeRiskForecast.level === "high" ? gradients.pink : urgeRiskForecast.level === "elevated" ? gradients.peach : gradients.mint;
  const peakRiskLabel =
    analyticsSnapshot.productionMetrics.peakUrgeHour === null
      ? "None"
      : `${String(analyticsSnapshot.productionMetrics.peakUrgeHour).padStart(2, "0")}:00`;
  const analyticsSharingReady = analyticsSharingReadiness.ready;
  const analyticsSharingStatus = analyticsSharing.enabled
    ? analyticsSharingReady
      ? analyticsSharing.lastSentAt
        ? `Ready - last sent ${new Date(analyticsSharing.lastSentAt).toLocaleDateString()}`
        : "Ready to send"
      : "Needs setup"
    : "Off";
  const analyticsGapText = analyticsSharingReadiness.gaps
    .slice(0, 2)
    .map((gap) => gap.replace(/-/g, " "))
    .join(", ");

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 18 }}>
      <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy }}>
        Analytics
      </Text>
      <Card gradient={gradients.purple} style={{ alignItems: "center" }}>
        <ProgressRing value={score} size={210} />
        <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 21 }}>
          Recovery score blends streak, completed interventions, and today's risk load.
        </Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Metric label="Current" value={`${streakDays}d`} color={colors.peach} />
        <Metric label="Best" value={`${bestStreakDays}d`} color={colors.yellow} />
        <Metric label="Attempts" value={`${attemptsToday}`} color={colors.pink} />
      </View>
      <Card gradient={gradients.purple}>
        <Text selectable style={{ color: colors.purple, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
          LEVEL {recoveryLevel.level}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 14, marginTop: 8 }}>
          <Text selectable style={{ flex: 1, color: colors.text, fontSize: 26, lineHeight: 31, fontWeight: typography.heavy }}>
            {recoveryLevel.xp} XP
          </Text>
          <Text selectable style={{ color: colors.text2, fontWeight: typography.bold }}>
            {Math.max(0, recoveryLevel.nextLevelXp - recoveryLevel.xp)} to next
          </Text>
        </View>
        <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 12 }}>
          <View style={{ width: `${Math.round(recoveryLevel.progress * 100)}%`, height: "100%", backgroundColor: colors.purple }} />
        </View>
        <View style={{ gap: 11, marginTop: 16 }}>
          {achievements.slice(0, 3).map((badge) => (
            <View key={badge.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: badge.earned ? "rgba(143,227,200,0.18)" : "rgba(255,255,255,0.07)"
                }}
              >
                {badge.earned ? <Check color={colors.mint} size={17} strokeWidth={3} /> : <Target color={colors.text3} size={16} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                  {badge.title}
                </Text>
                <Text selectable style={{ color: colors.text2, fontSize: 12, marginTop: 2 }}>
                  {badge.earned ? "Unlocked" : `${badge.progress}/${badge.target} - ${badge.detail}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Card>
      <Card gradient={gradients.sky}>
        <Text selectable style={{ color: colors.sky, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
          PERSONAL INSIGHT
        </Text>
        <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: typography.heavy, marginTop: 8 }}>
          {checkInInsight}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          {[
            ["Check-ins", `${checkInSummary.total}/7`, colors.sky],
            ["Avg urge", `${checkInSummary.averageUrge}`, colors.pink],
            ["Avg sleep", `${checkInSummary.averageSleep}`, colors.mint]
          ].map(([label, value, color]) => (
            <View key={label as string} style={{ flex: 1, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", padding: 12 }}>
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
        <Card gradient={forecastGradient}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
            <View
              style={{
                width: 84,
                minHeight: 84,
                borderRadius: 22,
                backgroundColor: "rgba(255,255,255,0.08)",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Text selectable style={{ color: forecastAccent, fontSize: 30, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {urgeRiskForecast.score}
              </Text>
              <Text selectable style={{ color: colors.text3, fontSize: 11, fontWeight: typography.bold }}>
                risk
              </Text>
            </View>
            <View style={{ flex: 1, gap: 7 }}>
              <Text selectable style={{ color: forecastAccent, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
                URGE FORECAST
              </Text>
              <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: typography.heavy }}>
                {urgeRiskForecast.recommendedAction}
              </Text>
              <Text selectable style={{ color: colors.text2, lineHeight: 20 }}>
                {urgeRiskForecast.level.toUpperCase()} - {urgeRiskForecast.confidence} confidence
                {urgeRiskForecast.currentWindow ? ` - ${urgeRiskForecast.currentWindow}` : ""}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {urgeRiskForecast.drivers.slice(0, 3).map((driver) => (
              <View key={driver} style={{ borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 11, paddingVertical: 7 }}>
                <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold }}>
                  {driver}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          Weekly Report
        </Text>
        <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.bold, marginBottom: 12 }}>
          {weeklyReport.rangeLabel}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          {[
            ["Risks", `${weeklyReport.attempts}`, colors.pink],
            ["Resets", `${weeklyReport.completedChallenges}`, colors.mint],
            ["Slips", `${weeklyReport.slips}`, colors.peach],
            ["Check-ins", `${weeklyReport.checkIns}`, colors.sky]
          ].map(([label, value, color]) => (
            <View key={label as string} style={{ width: "48%", minHeight: 74, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", padding: 12 }}>
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
        <Text selectable style={{ color: colors.text2, lineHeight: 21, marginTop: 8 }}>
          {weeklyReport.nextFocus}
        </Text>
      </Card>
      {premiumCapabilities.deepRecoveryReports ? (
        <Card gradient={gradients.purple}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
            <View
              style={{
                width: 76,
                minHeight: 76,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.08)"
              }}
            >
              <Text selectable style={{ color: colors.purple, fontSize: 28, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                {monthlyGrowthReport.growthScore}
              </Text>
              <Text selectable style={{ color: colors.text3, fontSize: 11, fontWeight: typography.bold }}>
                growth
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.purple, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
                MONTHLY GROWTH
              </Text>
              <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: typography.heavy, marginTop: 6 }}>
                {monthlyGrowthReport.summary}
              </Text>
              <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.bold, marginTop: 7 }}>
                {monthlyGrowthReport.rangeLabel}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 15 }}>
            {[
              ["Protected", `${monthlyGrowthReport.protectedMoments}`, colors.mint],
              ["Helpful", `${monthlyGrowthReport.helpfulChallenges}`, colors.sky],
              ["Check-ins", `${monthlyGrowthReport.checkIns}`, colors.yellow],
              ["Slips", `${monthlyGrowthReport.slips}`, colors.peach]
            ].map(([label, value, color]) => (
              <View key={label as string} style={{ width: "48%", minHeight: 70, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", padding: 12 }}>
                <Text selectable style={{ color: color as string, fontSize: 20, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                  {value as string}
                </Text>
                <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold, marginTop: 4 }}>
                  {label as string}
                </Text>
              </View>
            ))}
          </View>
          <Text selectable style={{ color: colors.text2, lineHeight: 21, marginTop: 14 }}>
            {monthlyGrowthReport.nextExperiment}
          </Text>
        </Card>
      ) : null}
      <Card gradient={gradients.sky}>
        <Text selectable style={{ color: colors.sky, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
          PRIVACY-SAFE SNAPSHOT
        </Text>
        <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: typography.heavy, marginTop: 8 }}>
          Aggregate signals only. No private notes, contacts, or browsing details leave this device.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          {[
            ["Help rate", `${analyticsSnapshot.interventions.challengeHelpRate}%`, colors.mint],
            ["Peak risk", peakRiskLabel, colors.peach],
            ["Reset rate", `${analyticsSnapshot.productionMetrics.relapseResetRate}%`, colors.sky],
            ["App shields", `${analyticsSnapshot.behavior.appInterceptions}`, colors.purple],
            ["App opens", `${analyticsSnapshot.productionMetrics.appOpens}`, colors.yellow],
            ["Unlock/wk", `${analyticsSnapshot.productionMetrics.unlockFrequencyPerWeek}`, colors.pink]
          ].map(([label, value, color]) => (
            <View key={label as string} style={{ width: "48%", minHeight: 74, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)", padding: 12 }}>
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
      <Card>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
              REMOTE ANALYTICS
            </Text>
            <Text selectable style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: typography.heavy, marginTop: 7 }}>
              {analyticsSharingStatus}
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 20, marginTop: 6 }}>
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
              borderRadius: 18,
              backgroundColor: analyticsSharingReady ? "rgba(143,227,200,0.18)" : "rgba(255,255,255,0.07)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {analyticsSharingReady ? <Check color={colors.mint} size={20} strokeWidth={3} /> : <BarChart3 color={colors.text3} size={20} />}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
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
        <Card gradient={gradients.mint}>
          <Text selectable style={{ color: colors.mint, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
            ADAPTIVE SIGNALS
          </Text>
          <View style={{ gap: 12, marginTop: 12 }}>
            {[
              ["Risk window", weeklyReport.riskWindow, colors.pink],
              ["Slip window", weeklyReport.slipWindow, colors.peach],
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
      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          Habit Scores
        </Text>
        <View style={{ gap: 12 }}>
          {bars.map(([label, value, color]) => (
            <View key={label as string} style={{ gap: 7 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text selectable style={{ color: colors.text2, fontWeight: typography.bold }}>
                  {label as string}
                </Text>
                <Text selectable style={{ color: color as string, fontWeight: typography.heavy }}>
                  {value as number}%
                </Text>
              </View>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <View style={{ width: `${value as number}%`, backgroundColor: color as string, height: "100%" }} />
              </View>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

function VerdictCard({ result }: { result: ClassificationResult }) {
  const blocked = result.verdict === "block";
  return (
    <Card gradient={blocked ? gradients.danger : gradients.mint}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {blocked ? <Lock color={colors.white} size={28} /> : <ShieldCheck color={colors.mint} size={28} />}
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
            {blocked ? "Blocked: adult intent" : "Allowed: normal browsing"}
          </Text>
          <Text selectable style={{ color: colors.text2, marginTop: 3 }}>
            {result.reason}
          </Text>
          <Text selectable style={{ color: blocked ? "rgba(255,255,255,0.74)" : colors.text3, marginTop: 7, fontSize: 12 }}>
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
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 46,
        borderRadius: 18,
        paddingHorizontal: 12,
        backgroundColor: "rgba(255,255,255,0.06)"
      }}
    >
      <Text selectable style={{ color: colors.text, fontWeight: typography.bold, flex: 1 }}>
        {label}
      </Text>
      <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: value ? "rgba(68,225,177,0.28)" : "rgba(255,255,255,0.12)", padding: 3, alignItems: value ? "flex-end" : "flex-start" }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: value ? colors.mint : colors.text3 }} />
      </View>
    </Pressable>
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
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.text2, fontWeight: typography.bold }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? "rgba(184,152,255,0.22)" : "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: active ? "rgba(184,152,255,0.42)" : "rgba(255,255,255,0.06)"
              }}
            >
              <Text selectable style={{ color: active ? colors.purple : colors.text2, fontWeight: typography.heavy, fontSize: 12 }}>
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
  const setNext = (direction: -1 | 1) => onChange(Math.min(max, Math.max(min, value + direction * step)));
  return (
    <View style={{ flex: 1, minHeight: 104, borderRadius: 20, padding: 14, backgroundColor: "rgba(255,255,255,0.06)", gap: 10 }}>
      <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => setNext(-1)} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, fontSize: 18 }}>
            -
          </Text>
        </Pressable>
        <Text selectable style={{ color: colors.text, fontSize: 23, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
          {value}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => setNext(1)} style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, fontSize: 18 }}>
            +
          </Text>
        </Pressable>
      </View>
      <Text selectable style={{ color: colors.text3, fontSize: 12, fontWeight: typography.bold }}>
        {suffix}
      </Text>
    </View>
  );
}

function normalizeClockTimeInput(value: string) {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function SettingTimeInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  const normalized = normalizeClockTimeInput(draft);
  const valid = Boolean(normalized);
  const commit = React.useCallback(() => {
    const next = normalizeClockTimeInput(draft);
    if (!next) {
      setDraft(value);
      return;
    }
    setDraft(next);
    if (next !== value) onChange(next);
  }, [draft, onChange, value]);

  return (
    <View style={{ flex: 1, minHeight: 82, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.06)", gap: 8 }}>
      <Text selectable style={{ color: colors.text2, fontSize: 12, fontWeight: typography.bold }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={`${label} time`}
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder="22:30"
        placeholderTextColor={colors.text3}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        style={{
          minHeight: 38,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: valid ? "rgba(255,255,255,0.08)" : "rgba(255,81,72,0.42)",
          color: colors.text,
          fontSize: 18,
          fontWeight: typography.heavy,
          fontVariant: ["tabular-nums"],
          paddingHorizontal: 12,
          backgroundColor: "rgba(255,255,255,0.06)"
        }}
      />
    </View>
  );
}

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

function ShieldScreen({
  onAttempt,
  disciplineSettings,
  activeUnlock,
  onDisciplineChange
}: {
  onAttempt: (url: string) => void;
  disciplineSettings: DisciplineSettings;
  activeUnlock: EarnedUnlock | null;
  onDisciplineChange: (update: Partial<Omit<DisciplineSettings, "updatedAt">>) => void;
}) {
  const [input, setInput] = React.useState("https://google.com/search?q=productivity");
  const [result, setResult] = React.useState<ClassificationResult | null>(null);
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

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 18 }}>
      <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy }}>
        Shield
      </Text>
      <Card gradient={gradients.mint}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <ShieldCheck color={colors.mint} size={30} />
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
              Default allow, precise block
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 21, marginTop: 4 }}>
              FREED blocks adult domains and adult search intent. Normal web stays open; Android app shields are opt-in.
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          URL Check
        </Text>
        <TextInput
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Enter a URL or search URL"
          placeholderTextColor={colors.text3}
          style={{
            minHeight: 54,
            borderRadius: 18,
            borderWidth: 1.4,
            borderColor: "rgba(255,255,255,0.1)",
            color: colors.text,
            paddingHorizontal: 16,
            fontSize: 15,
            backgroundColor: "rgba(255,255,255,0.05)"
          }}
        />
        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <PillButton label="Check" variant="ghost" onPress={() => setResult(createBlockingAttempt(input, "manual-check").result)} />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton label="Visit" onPress={() => onAttempt(input)} />
          </View>
        </View>
      </Card>

      {result && <VerdictCard result={result} />}

      <Card gradient={gradients.purple}>
        <Text selectable style={{ color: colors.purple, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
          DISCIPLINE RULES
        </Text>
        <Text selectable style={{ color: colors.text, fontSize: 20, lineHeight: 25, fontWeight: typography.heavy, marginTop: 8 }}>
          Earned unlocks and challenge intensity are saved on this device.
        </Text>
        <Text selectable style={{ color: colors.text2, marginTop: 8, lineHeight: 21 }}>
          {formatUnlock(activeUnlock)}
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
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
        <View style={{ marginTop: 10 }}>
          <SettingStepper
            label="Shorts guard"
            value={disciplineSettings.shortFormInterruptionSeconds}
            suffix="seconds sustained"
            min={30}
            max={300}
            step={15}
            onChange={(shortFormInterruptionSeconds) => onDisciplineChange({ shortFormInterruptionSeconds })}
          />
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 14 }}>
          Challenge Mix
        </Text>
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

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          Doomscroll Apps
        </Text>
        <View style={{ gap: 9 }}>
          {DOOMSCROLL_APP_OPTIONS.map((option) => (
            <SettingToggle
              key={option.androidPackage}
              label={option.label}
              value={blockedPackageSet.has(option.androidPackage)}
              onChange={() => toggleBlockedPackage(option.androidPackage)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          Modes
        </Text>
        <View style={{ gap: 12 }}>
          <SettingToggle label="Emergency strict mode" value={disciplineSettings.emergencyStrictMode} onChange={(emergencyStrictMode) => onDisciplineChange({ emergencyStrictMode })} />
          <SettingToggle label={`Sleep mode ${disciplineSettings.sleepStartTime}-${disciplineSettings.sleepEndTime}`} value={disciplineSettings.sleepModeEnabled} onChange={(sleepModeEnabled) => onDisciplineChange({ sleepModeEnabled })} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SettingTimeInput label="Sleep start" value={disciplineSettings.sleepStartTime} onChange={(sleepStartTime) => onDisciplineChange({ sleepStartTime })} />
            <SettingTimeInput label="Wake" value={disciplineSettings.sleepEndTime} onChange={(sleepEndTime) => onDisciplineChange({ sleepEndTime })} />
          </View>
          <SettingToggle label="Deep focus mode" value={disciplineSettings.deepFocusModeEnabled} onChange={(deepFocusModeEnabled) => onDisciplineChange({ deepFocusModeEnabled })} />
          <SettingToggle label={`Work hours ${disciplineSettings.workStartTime}-${disciplineSettings.workEndTime}`} value={disciplineSettings.workHoursEnabled} onChange={(workHoursEnabled) => onDisciplineChange({ workHoursEnabled })} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SettingTimeInput label="Work start" value={disciplineSettings.workStartTime} onChange={(workStartTime) => onDisciplineChange({ workStartTime })} />
            <SettingTimeInput label="Work end" value={disciplineSettings.workEndTime} onChange={(workEndTime) => onDisciplineChange({ workEndTime })} />
          </View>
          <SettingToggle label="Weekend adventure mode" value={disciplineSettings.weekendModeEnabled} onChange={(weekendModeEnabled) => onDisciplineChange({ weekendModeEnabled })} />
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PillButton label="Google" variant="ghost" onPress={() => setInput("https://google.com")} />
        </View>
        <View style={{ flex: 1 }}>
          <PillButton label="YouTube" variant="ghost" onPress={() => setInput("https://youtube.com/results?search_query=workout")} />
        </View>
      </View>
      <PillButton label="Adult Search Test" variant="danger" onPress={() => onAttempt("https://google.com/search?q=porn")} />

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          Normal Web Allowlist
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DEFAULT_ALLOWED_NORMAL_DOMAINS.slice(0, 14).map((domain) => (
            <Text key={domain} selectable style={{ color: colors.mint, backgroundColor: "rgba(90,223,158,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              {domain}
            </Text>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

function LibraryScreen({
  onBreathing,
  onChallenge,
  onCustomChallenge,
  onCoach,
  customChallengeCount,
  customChallengesEnabled
}: {
  onBreathing: () => void;
  onChallenge: () => void;
  onCustomChallenge: () => void;
  onCoach: () => void;
  customChallengeCount: number;
  customChallengesEnabled: boolean;
}) {
  const items = [
    { title: "Breathe", sub: "Calm a craving", color: colors.sky, icon: Waves, action: onBreathing },
    { title: "Challenge", sub: "Generate reset", color: colors.mint, icon: Activity, action: onChallenge },
    {
      title: "Custom",
      sub: customChallengesEnabled ? `${customChallengeCount} saved` : "Premium builder",
      color: colors.pink,
      icon: Target,
      action: onCustomChallenge
    },
    { title: "CLARA", sub: "Talk it through", color: colors.purple, icon: Brain, action: onCoach },
    { title: "Journal", sub: "Identity notes", color: colors.yellow, icon: NotebookPen, action: tap },
    { title: "Move", sub: "Physical reset", color: colors.peach, icon: Dumbbell, action: tap }
  ];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 18 }}>
      <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy }}>
        Library
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {items.map((item) => (
          <Pressable key={item.title} onPress={item.action} style={{ width: "48%" }}>
            <Card gradient={[`${item.color}33`, colors.surface]} style={{ minHeight: 134 }}>
              <item.icon color={item.color} size={32} />
              <View style={{ marginTop: "auto" }}>
                <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                  {item.title}
                </Text>
                <Text selectable style={{ color: colors.text2, marginTop: 3 }}>
                  {item.sub}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <Card gradient={gradients.purple}>
        <Text selectable style={{ color: colors.purple, fontSize: 12, fontWeight: typography.heavy, letterSpacing: 1.1 }}>
          RECOVERY FRAMEWORK
        </Text>
        <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: typography.heavy, marginTop: 7 }}>
          Cue to Interrupt to Reset to Reflect
        </Text>
        <Text selectable style={{ color: colors.text2, lineHeight: 22, marginTop: 8 }}>
          FREED treats every risk moment as a chance to practice self-control, not as a reason for shame.
        </Text>
      </Card>

      {[
        ["How urges peak and fade", "Mindfulness", colors.sky],
        ["Build identity, not just willpower", "Psychology", colors.purple],
        ["Why movement helps cravings", "Behavior", colors.peach],
        ["Make relapse data useful", "Recovery", colors.mint]
      ].map(([title, tag, color]) => (
        <Card key={title}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <BookOpen color={color as string} size={26} />
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, fontSize: 16 }}>
                {title as string}
              </Text>
              <Text selectable style={{ color: color as string, marginTop: 4, fontWeight: typography.bold }}>
                {tag as string} - 5 min
              </Text>
            </View>
            <ChevronRight color={colors.text3} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

function CustomChallengeScreen({
  premium,
  customChallenges,
  onBack,
  onUpgrade,
  onSave
}: {
  premium: boolean;
  customChallenges: RecoveryChallenge[];
  onBack: () => void;
  onUpgrade: () => void;
  onSave: (input: CustomChallengeInput) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [why, setWhy] = React.useState("");
  const [category, setCategory] = React.useState<RecoveryChallenge["category"]>("reset");
  const [intensity, setIntensity] = React.useState<RecoveryChallenge["intensity"]>("medium");
  const [durationSec, setDurationSec] = React.useState(120);
  const [steps, setSteps] = React.useState(["", "", "", ""]);
  const cleanedSteps = steps.map((step) => step.trim()).filter(Boolean);
  const canSave = premium && title.trim().length >= 4 && cleanedSteps.length > 0;

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 112, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text selectable style={{ color: colors.text, fontSize: 28, fontWeight: typography.heavy }}>
                Custom Reset
              </Text>
              <Pressable onPress={onBack} style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                <X color={colors.text2} size={18} />
              </Pressable>
            </View>

            {!premium ? (
              <Card gradient={gradients.purple}>
                <Target color={colors.purple} size={34} />
                <Text selectable style={{ color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: typography.heavy, marginTop: 10 }}>
                  Build resets that match your real life.
                </Text>
                <Text selectable style={{ color: colors.text2, lineHeight: 21, marginTop: 8 }}>
                  Custom challenges are part of Premium and are stored locally as your own recovery actions.
                </Text>
                <View style={{ marginTop: 14 }}>
                  <PillButton label="Upgrade" onPress={onUpgrade} icon={<ChevronRight color={colors.bg} size={18} />} />
                </View>
              </Card>
            ) : (
              <>
                <Card gradient={gradients.pink}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Reset name"
                    placeholderTextColor={colors.text3}
                    style={{
                      minHeight: 52,
                      borderRadius: 17,
                      borderWidth: 1.3,
                      borderColor: "rgba(255,255,255,0.1)",
                      color: colors.text,
                      paddingHorizontal: 15,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      fontWeight: typography.bold
                    }}
                  />
                  <TextInput
                    value={why}
                    onChangeText={setWhy}
                    placeholder="Why this works for you"
                    placeholderTextColor={colors.text3}
                    multiline
                    style={{
                      minHeight: 84,
                      borderRadius: 17,
                      borderWidth: 1.3,
                      borderColor: "rgba(255,255,255,0.1)",
                      color: colors.text,
                      padding: 15,
                      textAlignVertical: "top",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      marginTop: 10
                    }}
                  />
                </Card>
                <Card>
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
                <Card>
                  <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
                    Steps
                  </Text>
                  <View style={{ gap: 9 }}>
                    {steps.map((step, index) => (
                      <TextInput
                        key={index}
                        value={step}
                        onChangeText={(value) => setSteps((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))}
                        placeholder={`Step ${index + 1}`}
                        placeholderTextColor={colors.text3}
                        style={{
                          minHeight: 48,
                          borderRadius: 16,
                          borderWidth: 1.3,
                          borderColor: "rgba(255,255,255,0.1)",
                          color: colors.text,
                          paddingHorizontal: 14,
                          backgroundColor: "rgba(255,255,255,0.05)"
                        }}
                      />
                    ))}
                  </View>
                </Card>
                {customChallenges.length > 0 ? (
                  <Card>
                    <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 10 }}>
                      Saved Resets
                    </Text>
                    <View style={{ gap: 8 }}>
                      {customChallenges.slice(0, 4).map((challenge) => (
                        <Text key={challenge.id} selectable style={{ color: colors.text2, lineHeight: 20 }}>
                          {challenge.title} - {Math.round(challenge.durationSec / 60)}m
                        </Text>
                      ))}
                    </View>
                  </Card>
                ) : null}
                <PillButton
                  label="Save and Start"
                  variant={canSave ? "success" : "ghost"}
                  onPress={() =>
                    canSave &&
                    onSave({
                      title,
                      why,
                      category,
                      intensity,
                      durationSec,
                      steps: cleanedSteps
                    })
                  }
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

function ReminderSettingsCard({
  reminders,
  busy,
  onChange,
  smartSuggestion
}: {
  reminders: ReminderPreferences;
  busy: boolean;
  onChange: (update: Partial<ReminderPreferences>) => void;
  smartSuggestion: SmartReminderSuggestion;
}) {
  const items: Array<[keyof ReminderPreferences, string, string, typeof Sun, string]> = [
    ["morningEnabled", "Morning reset", reminders.morningTime, Sun, colors.sky],
    ["eveningEnabled", "Evening reflection", reminders.eveningTime, Moon, colors.purple],
    ["guardEnabled", "Night guard", reminders.guardTime, Shield, colors.mint]
  ];

  return (
    <Card gradient={reminders.enabled ? gradients.sky : undefined}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <Bell color={reminders.enabled ? colors.sky : colors.text2} size={28} />
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
            Recovery Reminders
          </Text>
          <Text selectable style={{ color: colors.text2, marginTop: 3, lineHeight: 20 }}>
            {reminders.statusMessage}
          </Text>
        </View>
        <Pressable
          disabled={busy}
          onPress={() => onChange({ enabled: !reminders.enabled })}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: reminders.enabled ? colors.mint : colors.surface2,
            opacity: busy ? 0.52 : 1
          }}
        >
          <Text selectable style={{ color: reminders.enabled ? colors.bg : colors.text, fontWeight: typography.heavy }}>
            {busy ? "Sync" : reminders.enabled ? "On" : "Off"}
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        {items.map(([key, title, time, Icon, color]) => {
          const active = Boolean(reminders[key]);
          return (
            <Pressable
              key={key as string}
              disabled={busy}
              onPress={() => onChange({ [key]: !active })}
              style={{
                minHeight: 58,
                borderRadius: 18,
                padding: 12,
                borderWidth: 1.3,
                borderColor: active ? `${color}66` : "rgba(255,255,255,0.08)",
                backgroundColor: active ? `${color}16` : "rgba(255,255,255,0.05)",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                opacity: busy ? 0.62 : 1
              }}
            >
              <Icon color={active ? color : colors.text3} size={22} />
              <Text selectable style={{ color: active ? colors.text : colors.text2, fontWeight: typography.heavy, flex: 1 }}>
                {title}
              </Text>
              <Text selectable style={{ color: active ? color : colors.text3, fontWeight: typography.bold, fontVariant: ["tabular-nums"] }}>
                {time}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {reminders.guardEnabled && (
        <View style={{ marginTop: 12, borderRadius: 18, padding: 12, backgroundColor: "rgba(130,206,255,0.10)", borderWidth: 1, borderColor: "rgba(130,206,255,0.22)", flexDirection: "row", gap: 10 }}>
          <Sparkles color={colors.sky} size={18} />
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
              Smart guard {smartSuggestion.guardTime}
            </Text>
            <Text selectable style={{ color: colors.text2, marginTop: 3, lineHeight: 20 }}>
              {smartSuggestion.reason}
            </Text>
          </View>
        </View>
      )}
    </Card>
  );
}

function RetentionPlanCard({ plan }: { plan: RetentionPlan }) {
  return (
    <Card gradient={[`${colors.mint}20`, colors.surface]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 18, backgroundColor: "rgba(90,223,158,0.14)", alignItems: "center", justifyContent: "center" }}>
          <Target color={colors.mint} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
            Daily Recovery Plan
          </Text>
          <Text selectable style={{ color: colors.text2, marginTop: 3, lineHeight: 20 }}>
            {plan.headline}
          </Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <View style={{ borderRadius: 18, padding: 13, backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <Text selectable style={{ color: colors.text3, fontWeight: typography.bold, marginBottom: 5 }}>
            NEXT BEST ACTION
          </Text>
          <Text selectable style={{ color: colors.text, lineHeight: 21, fontWeight: typography.bold }}>
            {plan.nextBestAction}
          </Text>
        </View>
        <Text selectable style={{ color: colors.text2, lineHeight: 21 }}>
          {plan.checkInPrompt}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {plan.focusTags.map((tag) => (
            <Text
              selectable
              key={tag}
              style={{
                color: colors.mint,
                backgroundColor: "rgba(90,223,158,0.10)",
                borderWidth: 1,
                borderColor: "rgba(90,223,158,0.22)",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                fontWeight: typography.bold
              }}
            >
              {tag}
            </Text>
          ))}
          {plan.suggestedGuardTime ? (
            <Text selectable style={{ color: colors.sky, backgroundColor: "rgba(130,206,255,0.10)", borderWidth: 1, borderColor: "rgba(130,206,255,0.22)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
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
  onRestore
}: {
  recoveryState: RecoveryState;
  onRestore: (state: RecoveryState) => void;
}) {
  const readiness = getRecoveryBackupReadiness();
  const syncEndpointConfigured = Boolean(process.env.EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT?.trim());
  const authRedirectUrl = React.useMemo(
    () => process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL?.trim() || ExpoLinking.createURL("auth/callback"),
    []
  );
  const supabaseAuthReadiness = React.useMemo(() => getSupabaseAuthReadiness(), []);
  const [passphrase, setPassphrase] = React.useState("");
  const [backupText, setBackupText] = React.useState("");
  const [authEmail, setAuthEmail] = React.useState("");
  const [syncToken, setSyncToken] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [authBusy, setAuthBusy] = React.useState(false);
  const [message, setMessage] = React.useState(readiness.status === "ready" ? "Encrypted backup is ready." : readiness.missing[0]);
  const disabled = busy || readiness.status !== "ready";
  const syncConfig = React.useMemo(
    () => ({
      endpointUrl: process.env.EXPO_PUBLIC_RECOVERY_BACKUP_SYNC_ENDPOINT,
      getAuthToken: () => syncToken.trim()
    }),
    [syncToken]
  );
  const syncReadiness = React.useMemo(() => getRecoveryBackupClientSyncReadiness(syncConfig), [syncConfig]);
  const syncDisabled = disabled || authBusy || !syncReadiness.ready || syncToken.trim().length < 16;
  const runBackupAction = React.useCallback(
    (action: () => Promise<void>) => {
      setBusy(true);
      action()
        .catch((error) => setMessage(safeUserFacingMessage(error, "Backup action could not complete.")))
        .finally(() => setBusy(false));
    },
    []
  );
  const applyAuthUrl = React.useCallback((url: string | null) => {
    if (!url) return;
    const token = extractSupabaseAccessTokenFromUrl(url);
    if (!token) return;
    setSyncToken(token);
    setMessage("Account session connected for hosted encrypted sync.");
  }, []);
  const requestEmailLink = React.useCallback(() => {
    setAuthBusy(true);
    requestSupabaseMagicLink(authEmail, { redirectTo: authRedirectUrl })
      .then((result) => {
        setMessage(result.ok ? "Check your email for the FREED account link." : safeUserFacingMessage(result.reason, "Account link could not be sent."));
      })
      .catch(() => setMessage("Account link could not be sent."))
      .finally(() => setAuthBusy(false));
  }, [authEmail, authRedirectUrl]);
  const openOAuthProvider = React.useCallback(
    (provider: SupabaseAuthProvider) => {
      const result = buildSupabaseOAuthUrl(provider, { redirectTo: authRedirectUrl });
      if (!result.ok || !result.url) {
        setMessage(safeUserFacingMessage(result.reason, "Account sign-in could not start."));
        return;
      }
      setAuthBusy(true);
      Linking.openURL(result.url)
        .then(() => setMessage("Finish account sign-in, then return to FREED."))
        .catch(() => setMessage("Account sign-in could not open."))
        .finally(() => setAuthBusy(false));
    },
    [authRedirectUrl]
  );

  React.useEffect(() => {
    if (!syncEndpointConfigured) return undefined;
    let active = true;
    const applyIfActive = (url: string | null) => {
      if (active) applyAuthUrl(url);
    };
    Linking.getInitialURL().then(applyIfActive).catch(() => undefined);
    const subscription = Linking.addEventListener("url", ({ url }) => applyIfActive(url));
    return () => {
      active = false;
      subscription.remove();
    };
  }, [applyAuthUrl, syncEndpointConfigured]);

  return (
    <Card gradient={[`${colors.sky}1F`, colors.surface]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 18, backgroundColor: "rgba(130,206,255,0.14)", alignItems: "center", justifyContent: "center" }}>
          <Lock color={colors.sky} size={21} />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
            Encrypted Backup
          </Text>
          <Text selectable style={{ color: colors.text2, marginTop: 3, lineHeight: 20 }}>
            {message}
          </Text>
        </View>
      </View>

      <TextInput
        value={passphrase}
        onChangeText={setPassphrase}
        secureTextEntry
        placeholder="Passphrase"
        placeholderTextColor={colors.text3}
        style={{
          minHeight: 48,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          color: colors.text,
          paddingHorizontal: 14,
          backgroundColor: "rgba(255,255,255,0.05)",
          marginBottom: 10
        }}
      />
      <TextInput
        value={backupText}
        onChangeText={setBackupText}
        multiline
        placeholder="Backup package"
        placeholderTextColor={colors.text3}
        textAlignVertical="top"
        style={{
          minHeight: 92,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          color: colors.text,
          padding: 14,
          backgroundColor: "rgba(255,255,255,0.05)",
          marginBottom: 12
        }}
      />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          disabled={disabled}
          onPress={() =>
            runBackupAction(async () => {
              const backup = await createEncryptedRecoveryBackup(recoveryState, passphrase);
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
            runBackupAction(async () => {
              const restored = await restoreEncryptedRecoveryBackup(backupText, passphrase);
              onRestore(restored);
              setMessage("Encrypted backup restored.");
            })
          }
          style={{
            flex: 1,
            minHeight: 46,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
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
      {syncEndpointConfigured ? (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.09)" }}>
          {supabaseAuthReadiness.ready ? (
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
                  borderColor: "rgba(255,255,255,0.10)",
                  color: colors.text,
                  paddingHorizontal: 14,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  marginBottom: 10
                }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                <Pressable
                  disabled={disabled || authBusy}
                  onPress={requestEmailLink}
                  style={{
                    flexGrow: 1,
                    minWidth: 110,
                    minHeight: 42,
                    borderRadius: 999,
                    backgroundColor: "rgba(130,206,255,0.16)",
                    borderWidth: 1,
                    borderColor: "rgba(130,206,255,0.24)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: disabled || authBusy ? 0.5 : 1
                  }}
                >
                  <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy }}>
                    Email Link
                  </Text>
                </Pressable>
                <Pressable
                  disabled={disabled || authBusy}
                  onPress={() => openOAuthProvider("apple")}
                  style={{
                    flexGrow: 1,
                    minWidth: 90,
                    minHeight: 42,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.07)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: disabled || authBusy ? 0.5 : 1
                  }}
                >
                  <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                    Apple
                  </Text>
                </Pressable>
                <Pressable
                  disabled={disabled || authBusy}
                  onPress={() => openOAuthProvider("google")}
                  style={{
                    flexGrow: 1,
                    minWidth: 90,
                    minHeight: 42,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.07)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: disabled || authBusy ? 0.5 : 1
                  }}
                >
                  <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                    Google
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Text selectable style={{ color: colors.text2, lineHeight: 20, marginBottom: 10 }}>
              Account sync needs Supabase Auth public URL and anon key before hosted backup can be enabled.
            </Text>
          )}
          <TextInput
            value={syncToken}
            onChangeText={setSyncToken}
            secureTextEntry
            placeholder="Account session token"
            placeholderTextColor={colors.text3}
            style={{
              minHeight: 48,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              color: colors.text,
              paddingHorizontal: 14,
              backgroundColor: "rgba(255,255,255,0.05)",
              marginBottom: 10
            }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Pressable
              disabled={syncDisabled}
              onPress={() =>
                runBackupAction(async () => {
                  const result = await uploadEncryptedRecoveryBackup(recoveryState, passphrase, syncConfig);
                  setMessage(result.ok ? "Encrypted backup uploaded." : safeUserFacingMessage(result.reason, "Hosted sync could not upload."));
                })
              }
              style={{
                flexGrow: 1,
                minWidth: 120,
                minHeight: 44,
                borderRadius: 999,
                backgroundColor: "rgba(130,206,255,0.16)",
                borderWidth: 1,
                borderColor: "rgba(130,206,255,0.24)",
                alignItems: "center",
                justifyContent: "center",
                opacity: syncDisabled ? 0.5 : 1
              }}
            >
              <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy }}>
                Upload Sync
              </Text>
            </Pressable>
            <Pressable
              disabled={syncDisabled}
              onPress={() =>
                runBackupAction(async () => {
                  const result = await downloadEncryptedRecoveryBackup(passphrase, syncConfig);
                  if (result.ok && result.restoredState) {
                    onRestore(result.restoredState);
                    setMessage("Encrypted backup downloaded.");
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
                backgroundColor: "rgba(90,223,158,0.14)",
                borderWidth: 1,
                borderColor: "rgba(90,223,158,0.22)",
                alignItems: "center",
                justifyContent: "center",
                opacity: syncDisabled ? 0.5 : 1
              }}
            >
              <Text selectable style={{ color: colors.mint, fontWeight: typography.heavy }}>
                Download Sync
              </Text>
            </Pressable>
            <Pressable
              disabled={syncDisabled}
              onPress={() =>
                runBackupAction(async () => {
                  const result = await deleteHostedRecoveryBackup(syncConfig);
                  setMessage(result.ok ? "Encrypted backup deleted from sync." : safeUserFacingMessage(result.reason, "Hosted sync could not delete."));
                })
              }
              style={{
                flexGrow: 1,
                minWidth: 120,
                minHeight: 44,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.11)",
                alignItems: "center",
                justifyContent: "center",
                opacity: syncDisabled ? 0.5 : 1
              }}
            >
              <Text selectable style={{ color: colors.text2, fontWeight: typography.heavy }}>
                Delete Sync
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function PrivacySupportCard({ onDeleteLocalData }: { onDeleteLocalData: () => Promise<void> | void }) {
  const [message, setMessage] = React.useState("Privacy controls are ready.");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
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
  const deletionUrl = React.useMemo(
    () =>
      `mailto:${encodeURIComponent(FREED_SUPPORT_EMAIL)}?subject=${encodeURIComponent(
        "FREED data deletion request"
      )}&body=${encodeURIComponent(
        "Please help delete any hosted FREED data associated with my account. I understand local device data can be deleted inside FREED Profile > Privacy & Support."
      )}`,
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

  return (
    <Card gradient={[`${colors.mint}1F`, colors.surface]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 18, backgroundColor: "rgba(90,223,158,0.14)", alignItems: "center", justifyContent: "center" }}>
          <FileLock color={colors.mint} size={21} />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
            Privacy & Support
          </Text>
          <Text selectable style={{ color: colors.text2, marginTop: 3, lineHeight: 20 }}>
            {message}
          </Text>
        </View>
      </View>
      <Text selectable style={{ color: colors.text2, lineHeight: 21, marginBottom: 12 }}>
        Local deletion clears FREED's saved streaks, check-ins, protected moments, selected app choices, membership cache, and activation state on this device. System permissions remain controlled by iOS or Android Settings.
      </Text>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
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
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PillButton
              label="Server Deletion"
              variant="ghost"
              icon={<Mail color={colors.text2} size={18} />}
              onPress={() => openUrl(deletionUrl, "Deletion request message opened.")}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PillButton
              label={confirmDelete ? "Confirm Delete" : "Delete Local Data"}
              variant={confirmDelete ? "danger" : "ghost"}
              disabled={busy}
              icon={<Trash2 color={confirmDelete ? colors.white : colors.text2} size={18} />}
              onPress={runLocalDelete}
            />
          </View>
        </View>
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
  const enabledWithContact = hasUsableAccountabilityPartner(partner);
  const [draftSupportMemberIds, setDraftSupportMemberIds] = React.useState<string[]>([]);
  const lastContacted = partner.lastContactedAt
    ? new Date(partner.lastContactedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
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
    <Card gradient={enabledWithContact ? gradients.purple : undefined}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <MessageCircleHeart color={enabledWithContact ? colors.purple : colors.text2} size={30} />
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
            Accountability Partner
          </Text>
          <Text selectable style={{ color: colors.text2, marginTop: 3, lineHeight: 20 }}>
            {lastContacted ? `Last contacted ${lastContacted}.` : "One trusted person can be one tap away during a risk moment."}
          </Text>
        </View>
        <Pressable
          onPress={() => onChange({ enabled: !partner.enabled })}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: partner.enabled ? colors.mint : colors.surface2
          }}
        >
          <Text selectable style={{ color: partner.enabled ? colors.bg : colors.text, fontWeight: typography.heavy }}>
            {partner.enabled ? "On" : "Off"}
          </Text>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
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
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? "rgba(184,152,255,0.22)" : "rgba(255,255,255,0.05)",
                  borderWidth: 1.3,
                  borderColor: active ? colors.purple : "rgba(255,255,255,0.08)"
                }}
              >
                <Text selectable style={{ color: active ? colors.purple : colors.text2, fontWeight: typography.heavy }}>
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
            borderRadius: 17,
            borderWidth: 1.3,
            borderColor: "rgba(255,255,255,0.1)",
            color: colors.text,
            paddingHorizontal: 15,
            backgroundColor: "rgba(255,255,255,0.05)"
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
            borderRadius: 17,
            borderWidth: 1.3,
            borderColor: "rgba(255,255,255,0.1)",
            color: colors.text,
            paddingHorizontal: 15,
            backgroundColor: "rgba(255,255,255,0.05)"
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
            borderRadius: 17,
            borderWidth: 1.3,
            borderColor: "rgba(255,255,255,0.1)",
            color: colors.text,
            padding: 15,
            textAlignVertical: "top",
            backgroundColor: "rgba(255,255,255,0.05)"
          }}
        />
        <View style={{ borderRadius: 18, padding: 12, backgroundColor: "rgba(184,152,255,0.10)", borderWidth: 1, borderColor: "rgba(184,152,255,0.20)", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ShieldCheck color={colors.purple} size={19} />
            <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, flex: 1 }}>
              Weekly sponsor report
            </Text>
          </View>
          <Text selectable style={{ color: colors.text2, lineHeight: 20 }}>
            {sponsorReport.summary.streakDays}d streak, {sponsorReport.summary.attempts} protected, {sponsorReport.summary.completedChallenges} resets, {sponsorReport.summary.checkIns} check-ins.
          </Text>
          <Text selectable style={{ color: colors.text3, lineHeight: 19 }}>
            Private notes, contacts, and browsing details stay out.
          </Text>
          <Pressable
            disabled={canSendSponsorReport && !enabledWithContact}
            onPress={canSendSponsorReport ? onSendReport : onManagePlan}
            style={{
              minHeight: 44,
              borderRadius: 999,
              backgroundColor: sponsorReportReady ? colors.purple : "rgba(255,255,255,0.08)",
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
        <View style={{ borderRadius: 18, padding: 12, backgroundColor: "rgba(130,206,255,0.08)", borderWidth: 1, borderColor: "rgba(130,206,255,0.18)", gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <CircleUserRound color={colors.sky} size={19} />
            <Text selectable style={{ color: colors.text, fontWeight: typography.heavy, flex: 1 }}>
              Family Support Circle
            </Text>
            {!canUseSupportCircle ? (
              <Pressable onPress={onManagePlan} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(130,206,255,0.14)" }}>
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
            <View style={{ gap: 10 }}>
              {visibleSupportCircle.slice(0, 4).map((member) => {
                const ready = hasUsableSupportCircleMember(member);
                const persisted = supportCircle.some((item) => item.id === member.id);
                const draft = draftSupportMemberIds.includes(member.id);
                return (
                  <View key={member.id} style={{ gap: 8, borderRadius: 16, padding: 10, backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        value={member.name}
                        onChangeText={(name) => onSupportCircleChange(member.id, { name, enabled: true })}
                        placeholder="Name"
                        placeholderTextColor={colors.text3}
                        style={{ flex: 1, minHeight: 44, borderRadius: 14, color: colors.text, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.06)" }}
                      />
                      <Pressable
                        onPress={() => onSupportCircleChange(member.id, { method: member.method === "sms" ? "email" : "sms" })}
                        style={{ width: 70, minHeight: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(130,206,255,0.12)" }}
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
                      style={{ minHeight: 44, borderRadius: 14, color: colors.text, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,0.06)" }}
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
                          backgroundColor: ready ? colors.sky : "rgba(255,255,255,0.08)",
                          opacity: ready ? 1 : 0.55
                        }}
                      >
                        <Text selectable style={{ color: ready ? colors.bg : colors.text2, fontWeight: typography.heavy }}>
                          Send Report
                        </Text>
                      </Pressable>
                      {persisted ? (
                        <Pressable onPress={() => onSupportCircleRemove(member.id)} style={{ minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
                          <Text selectable style={{ color: colors.text2, fontWeight: typography.heavy }}>
                            Remove
                          </Text>
                        </Pressable>
                      ) : draft ? (
                        <Pressable onPress={() => removeSupportDraft(member.id)} style={{ minHeight: 40, borderRadius: 999, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
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
                  style={{ minHeight: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(130,206,255,0.12)" }}
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
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  if (capabilities.advancedAnalytics) labels.push("Deep analytics");
  if (capabilities.advancedAiCoach) labels.push("CLARA+");
  if (capabilities.sponsorAccountability) labels.push("Sponsor");
  if (capabilities.familySupport) labels.push("Family");
  if (capabilities.relapsePrediction) labels.push("Risk prediction");
  if (capabilities.deepRecoveryReports) labels.push("Deep reports");
  return labels;
}

function ProfileScreen({
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
  onManagePlan,
  onLogSlip,
  storageError,
  protectionCapability,
  protectionStatus,
  protectionSyncMessage,
  refreshProtectionStatus
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
  onManagePlan: () => void;
  onLogSlip: () => void;
  storageError: string | null;
  protectionCapability: ProtectionCapability | null;
  protectionStatus: ProtectionStatus | null;
  protectionSyncMessage: string | null;
  refreshProtectionStatus: () => Promise<ProtectionRefreshResult>;
}) {
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
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 18 }}>
      <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy }}>
        Profile
      </Text>
      <Card gradient={gradients.purple} style={{ alignItems: "center", gap: 12 }}>
        <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" }}>
          <Text selectable style={{ color: colors.white, fontSize: 32, fontWeight: typography.heavy }}>
            F
          </Text>
        </View>
        <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: typography.heavy }}>
          FREED Member
        </Text>
        <Text selectable style={{ color: colors.peach, fontWeight: typography.heavy }}>
          {streakDays} DAY STREAK
        </Text>
      </Card>

      <Card>
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
            style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: premium ? colors.mint : colors.surface2 }}
          >
            <Text selectable style={{ color: premium ? colors.bg : colors.text, fontWeight: typography.heavy }}>
              {premium ? "Active" : "Upgrade"}
            </Text>
          </Pressable>
        </View>
        {premium && membershipCapabilities.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {membershipCapabilities.map((label) => (
              <Text
                key={label}
                selectable
                style={{
                  color: colors.mint,
                  backgroundColor: "rgba(90,223,158,0.12)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
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

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Metric label="Protected" value={`${attempts.length}`} color={colors.mint} />
        <Metric label="Best" value={`${bestStreakDays}d`} color={colors.yellow} />
      </View>

      <Card gradient={[`${colors.pink}24`, colors.surface]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 18, backgroundColor: "rgba(255,124,182,0.14)", alignItems: "center", justifyContent: "center" }}>
            <TimerReset color={colors.pink} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
              Private Reset Log
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 21, marginTop: 4 }}>
              A slip is data, not a verdict. Log it honestly and FREED restarts the streak without losing the pattern.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1, borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.05)" }}>
            <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
              {relapseCount}
            </Text>
            <Text selectable style={{ color: colors.text3, marginTop: 3, fontWeight: typography.bold }}>
              Logged
            </Text>
          </View>
          <View style={{ flex: 1, borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.05)" }}>
            <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: typography.heavy }}>
              {formatRecoveryDate(lastRelapseAt)}
            </Text>
            <Text selectable style={{ color: colors.text3, marginTop: 3, fontWeight: typography.bold }}>
              Latest
            </Text>
          </View>
        </View>
        <PillButton label="Log Slip Safely" variant="ghost" onPress={onLogSlip} icon={<NotebookPen color={colors.text2} size={18} />} />
      </Card>

      <Card gradient={storageError ? gradients.danger : gradients.mint}>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 6 }}>
          Recovery Data
        </Text>
        <Text selectable style={{ color: colors.text2, lineHeight: 21 }}>
          {storageError
            ? `Local save needs attention: ${storageError}`
            : "Streaks, check-ins, quiz answers, protected attempts, membership status, and challenge history are saved on this device."}
        </Text>
      </Card>

      <RetentionPlanCard plan={retentionPlan} />

      <RecoveryBackupCard recoveryState={recoveryState} onRestore={onRestoreBackup} />

      <PrivacySupportCard onDeleteLocalData={onDeleteLocalData} />

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

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          Native Protection
        </Text>
        <Text selectable style={{ color: colors.text2, lineHeight: 21, marginBottom: 12 }}>
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
          <Text selectable style={{ color: protectionStatus?.active ? colors.mint : colors.text3, backgroundColor: protectionStatus?.active ? "rgba(90,223,158,0.12)" : "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
            {protectionStatus?.active ? "Active" : "Inactive"}
          </Text>
          <Text selectable style={{ color: colors.text2, backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
            {(protectionStatus?.mode ?? "checking").replace("-", " ")}
          </Text>
          {protectionCapability?.platform === "android" && protectionStatus?.androidNotificationPermissionRequired ? (
            <Text
              selectable
              style={{
                color: protectionStatus.androidNotificationPermissionGranted ? colors.mint : colors.yellow,
                backgroundColor: protectionStatus.androidNotificationPermissionGranted ? "rgba(90,223,158,0.12)" : "rgba(255,216,106,0.12)",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                fontWeight: typography.bold
              }}
            >
              Recovery notifications {protectionStatus.androidNotificationPermissionGranted ? "on" : "off"}
            </Text>
          ) : null}
          {screenTimeScheduleActive ? (
            <Text selectable style={{ color: colors.yellow, backgroundColor: "rgba(255,216,106,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              Scheduled
            </Text>
          ) : null}
          {screenTimeSelectionCount > 0 ? (
            <Text selectable style={{ color: colors.purple, backgroundColor: "rgba(184,152,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              {screenTimeSelectionCount} selected
            </Text>
          ) : null}
          {iosAppLimitScheduled ? (
            <Text selectable style={{ color: colors.sky, backgroundColor: "rgba(130,206,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              iOS app limit {protectionStatus?.dailyLimitMinutes ?? 20}m
            </Text>
          ) : null}
          {iosAppLimitReachedToday ? (
            <Text selectable style={{ color: colors.pink, backgroundColor: "rgba(255,125,169,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              Limit reached today
            </Text>
          ) : null}
          {(protectionStatus?.blockedApplications ?? 0) > 0 ? (
            <Text selectable style={{ color: colors.pink, backgroundColor: "rgba(255,125,169,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              {protectionStatus?.blockedApplications} apps
            </Text>
          ) : null}
          {nativeUnlockLabel ? (
            <Text selectable style={{ color: colors.peach, backgroundColor: "rgba(255,190,118,0.14)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              {nativeUnlockLabel}
            </Text>
          ) : null}
          {protectionStatus?.adultFilterStaysActiveDuringEarnedUnlock ? (
            <Text selectable style={{ color: colors.mint, backgroundColor: "rgba(90,223,158,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              Adult filter on
            </Text>
          ) : null}
          {privateDnsMode ? (
            <Text selectable style={{ color: privateDnsStrict ? colors.yellow : colors.text2, backgroundColor: privateDnsStrict ? "rgba(255,216,106,0.12)" : "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              Private DNS {privateDnsMode}
            </Text>
          ) : null}
          {protectionCapability?.platform === "android" && typeof protectionStatus?.dnsGuardRuntimeReady === "boolean" ? (
            <Text selectable style={{ color: dnsGuardRuntimeReady ? colors.mint : colors.yellow, backgroundColor: dnsGuardRuntimeReady ? "rgba(90,223,158,0.12)" : "rgba(255,216,106,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              {dnsGuardRuntimeReady ? "DNS runtime ready" : "DNS runtime attention"}
            </Text>
          ) : null}
          {protectionStatus?.usageStatsAuthorized ? (
            <Text selectable style={{ color: colors.sky, backgroundColor: "rgba(130,206,255,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              Usage Access
            </Text>
          ) : null}
          {protectionStatus?.adultDomainFeedDomainCount ? (
            <Text selectable style={{ color: colors.mint, backgroundColor: "rgba(90,223,158,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              {protectionStatus.adultDomainFeedDomainCount} domains
            </Text>
          ) : null}
          {protectionStatus?.safariContentBlockerRuleCount ? (
            <Text selectable style={{ color: protectionStatus.safariContentBlockerEnabled ? colors.mint : colors.yellow, backgroundColor: protectionStatus.safariContentBlockerEnabled ? "rgba(90,223,158,0.12)" : "rgba(255,216,106,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              Safari {protectionStatus.safariContentBlockerRuleCount} rules
            </Text>
          ) : null}
          {protectionStatus?.safariContentBlockerEnabled ? (
            <Text selectable style={{ color: colors.mint, backgroundColor: "rgba(90,223,158,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              Safari blocker on
            </Text>
          ) : protectionStatus?.safariContentBlockerEnabled === false ? (
            <Text selectable style={{ color: colors.yellow, backgroundColor: "rgba(255,216,106,0.12)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
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
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
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
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <PillButton
                label={dnsGuardActive ? "DNS Guard On" : "Start DNS Guard"}
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
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
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
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
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
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
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
            <Text key={label as string} selectable style={{ color: active ? colors.mint : colors.text3, backgroundColor: active ? "rgba(90,223,158,0.12)" : "rgba(255,255,255,0.06)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontWeight: typography.bold }}>
              {label as string}
            </Text>
          ))}
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
          Platform Plan
        </Text>
        {[
          ["iOS Screen Time", "FamilyControls, ManagedSettings and shield extensions"],
          ["Safari/Web", "Managed web-content filter plus adult domain exceptions"],
          ["Android Browser", "Accessibility URL detection with native recovery handoff"],
          ["DNS-only Guard", "Private DNS guidance first; local VpnService routes DNS resolver IPs only"]
        ].map(([title, sub]) => (
          <View key={title} style={{ flexDirection: "row", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" }}>
            <Shield color={colors.purple} size={22} />
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                {title}
              </Text>
              <Text selectable style={{ color: colors.text2, marginTop: 2 }}>
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
  attempts,
  streakDays,
  attemptsToday,
  premium,
  slipsThisWeek,
  slipWindow,
  slipTrigger,
  onBack
}: {
  attempts: BlockingAttempt[];
  streakDays: number;
  attemptsToday: number;
  premium: boolean;
  slipsThisWeek: number;
  slipWindow: string;
  slipTrigger: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = React.useState<CoachMessage[]>([
    { role: "ai", text: "Hi, I am CLARA. Tell me what is happening, and we will pick the next clean action together." }
  ]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);

  function send() {
    if (!input.trim() || sending) return;
    const user = input.trim();
    setInput("");
    setSending(true);
    setMessages((current) => [...current, { role: "user", text: user }]);
    replyWithCoach(user, { attempts, streakDays, attemptsToday, premium, slipsThisWeek, slipWindow, slipTrigger })
      .then((reply) => {
        setMessages((current) => [...current, { role: "ai", text: reply.text }]);
      })
      .catch(() => {
        setMessages((current) => [
          ...current,
          { role: "ai", text: "I am here. Put the phone down for one minute, take three slow breaths, and choose the smallest clean action available." }
        ]);
      })
      .finally(() => setSending(false));
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, paddingBottom: 112, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={onBack} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft color={colors.text2} size={19} />
          </Pressable>
          <Text selectable style={{ color: colors.text, flex: 1, fontSize: 30, fontWeight: typography.heavy }}>
            CLARA
          </Text>
        </View>
        {messages.map((message, index) => {
          const user = message.role === "user";
          return (
            <View key={`${message.role}-${index}`} style={{ alignItems: user ? "flex-end" : "flex-start" }}>
              <View style={{ maxWidth: "86%", borderRadius: 20, padding: 14, backgroundColor: user ? colors.purple : colors.surface }}>
                <Text selectable style={{ color: colors.text, lineHeight: 21, fontWeight: typography.medium }}>
                  {message.text}
                </Text>
              </View>
            </View>
          );
        })}
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Talk to CLARA..."
            placeholderTextColor={colors.text3}
            style={{ flex: 1, minHeight: 50, backgroundColor: colors.surface, borderRadius: 999, color: colors.text, paddingHorizontal: 18, borderWidth: 1.3, borderColor: "rgba(255,255,255,0.08)" }}
            onSubmitEditing={send}
          />
          <Pressable onPress={send} style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" }}>
            {sending ? <ActivityIndicator color={colors.bg} /> : <ChevronRight color={colors.bg} size={24} />}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CheckInScreen({
  todayCheckIn,
  onBack,
  onSave
}: {
  todayCheckIn: DailyCheckIn | null;
  onBack: () => void;
  onSave: (input: DailyCheckInInput) => void;
}) {
  const [mood, setMood] = React.useState<DailyCheckInInput["mood"]>(todayCheckIn?.mood ?? "steady");
  const [urgeLevel, setUrgeLevel] = React.useState(todayCheckIn?.urgeLevel ?? 2);
  const [sleepQuality, setSleepQuality] = React.useState(todayCheckIn?.sleepQuality ?? 3);
  const [reflection, setReflection] = React.useState(todayCheckIn?.reflection ?? "");
  const moodOptions: Array<[DailyCheckInInput["mood"], string, string]> = [
    ["steady", "Steady", colors.mint],
    ["energized", "Energized", colors.sky],
    ["stressed", "Stressed", colors.peach],
    ["low", "Low", colors.pink]
  ];

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 18, paddingBottom: 34 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={onBack} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft color={colors.text2} size={19} />
            </Pressable>
            <Text selectable style={{ color: colors.text, flex: 1, fontSize: 28, fontWeight: typography.heavy }}>
              Daily Check-In
            </Text>
          </View>

          <Card gradient={gradients.purple}>
            <Brain color={colors.purple} size={36} />
            <Text selectable style={{ color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: typography.heavy, marginTop: 12 }}>
              Name the pattern before it names the day.
            </Text>
            <Text selectable style={{ color: colors.text2, lineHeight: 22, marginTop: 8 }}>
              One clear minute now makes the next hard moment easier.
            </Text>
          </Card>

          <Card>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
              Mood
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {moodOptions.map(([id, label, color]) => {
                const active = mood === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      tap();
                      setMood(id);
                    }}
                    style={{
                      width: "48%",
                      borderRadius: 18,
                      padding: 14,
                      backgroundColor: active ? `${color}24` : "rgba(255,255,255,0.05)",
                      borderWidth: 1.4,
                      borderColor: active ? color : "rgba(255,255,255,0.08)"
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

          <Card>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
              Urge level
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[0, 1, 2, 3, 4, 5].map((level) => {
                const active = urgeLevel === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      tap();
                      setUrgeLevel(level);
                    }}
                    style={{ flex: 1, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.pink : "rgba(255,255,255,0.06)" }}
                  >
                    <Text selectable style={{ color: active ? colors.bg : colors.text2, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                      {level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
              Sleep quality
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((level) => {
                const active = sleepQuality === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      tap();
                      setSleepQuality(level);
                    }}
                    style={{ flex: 1, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: active ? colors.mint : "rgba(255,255,255,0.06)" }}
                  >
                    <Text selectable style={{ color: active ? colors.bg : colors.text2, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
                      {level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
              Reflection
            </Text>
            <TextInput
              value={reflection}
              onChangeText={setReflection}
              multiline
              placeholder="What triggered you? What helped?"
              placeholderTextColor={colors.text3}
              style={{
                minHeight: 112,
                borderRadius: 18,
                borderWidth: 1.4,
                borderColor: "rgba(255,255,255,0.1)",
                color: colors.text,
                padding: 16,
                textAlignVertical: "top",
                fontSize: 15,
                backgroundColor: "rgba(255,255,255,0.05)"
              }}
            />
          </Card>

          <PillButton
            label="Save Check-In"
            onPress={() => onSave({ mood, urgeLevel, sleepQuality, reflection })}
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
  onSave
}: {
  currentStreak: number;
  bestStreakDays: number;
  onBack: () => void;
  onSave: (input: RelapseRecordInput) => void;
}) {
  const [trigger, setTrigger] = React.useState("");
  const [note, setNote] = React.useState("");
  const triggerOptions = ["Late night", "Stress", "Boredom", "Social media", "Lonely", "Tired"];
  const streakLabel = `${currentStreak} ${currentStreak === 1 ? "day" : "days"}`;

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 22, gap: 18, paddingBottom: 34 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Pressable onPress={onBack} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft color={colors.text2} size={19} />
              </Pressable>
              <Text selectable style={{ color: colors.text, flex: 1, fontSize: 28, fontWeight: typography.heavy }}>
                Reset Moment
              </Text>
            </View>

            <Card gradient={gradients.purple}>
              <TimerReset color={colors.pink} size={36} />
              <Text selectable style={{ color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: typography.heavy, marginTop: 12 }}>
                A slip is data, not a verdict.
              </Text>
              <Text selectable style={{ color: colors.text2, lineHeight: 22, marginTop: 8 }}>
                You are still here. Logging this gives the recovery engine a cleaner pattern and starts the next honest streak now.
              </Text>
            </Card>

            <Card>
              <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 10 }}>
                What FREED will do
              </Text>
              <Text selectable style={{ color: colors.text2, lineHeight: 22 }}>
                Your {streakLabel} streak will restart at 0 today. Your personal best stays at {Math.max(bestStreakDays, currentStreak)} days, and this note remains private on this device.
              </Text>
            </Card>

            <Card>
              <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
                Main trigger
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
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
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 10,
                        backgroundColor: active ? "rgba(255,124,182,0.18)" : "rgba(255,255,255,0.06)",
                        borderWidth: 1.3,
                        borderColor: active ? colors.pink : "rgba(255,255,255,0.08)"
                      }}
                    >
                      <Text selectable style={{ color: active ? colors.pink : colors.text2, fontWeight: typography.heavy, textAlign: "center" }}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            <Card>
              <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy, marginBottom: 12 }}>
                Private note
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="What happened right before it? What would make the next hour safer?"
                placeholderTextColor={colors.text3}
                style={{
                  minHeight: 118,
                  borderRadius: 18,
                  borderWidth: 1.4,
                  borderColor: "rgba(255,255,255,0.1)",
                  color: colors.text,
                  padding: 16,
                  textAlignVertical: "top",
                  fontSize: 15,
                  backgroundColor: "rgba(255,255,255,0.05)"
                }}
              />
            </Card>

            <PillButton label="Save and Start Again" variant="success" onPress={() => onSave({ trigger, note })} icon={<Check color={colors.bg} size={18} />} />
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
  membershipPlanLabel,
  streakDays,
  accountability,
  onMessagePartner,
  onContinue,
  onClose
}: {
  attempt: BlockingAttempt;
  premium: boolean;
  membershipPlanLabel: string;
  streakDays: number;
  accountability: AccountabilityPartner;
  onMessagePartner: () => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const hasPartner = hasUsableAccountabilityPartner(accountability);
  const selfUrge = attempt.source === "panic-button";
  const interventionBody = interventionBodyForAttempt(attempt);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 18, flexGrow: 1, justifyContent: "space-between" }}>
          <View style={{ gap: 18 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(255,81,72,0.16)" }}>
                <Text selectable style={{ color: colors.red2, fontWeight: typography.heavy, letterSpacing: 1 }}>
                  {selfUrge ? "URGE MODE" : "STREAK AT RISK"}
                </Text>
              </View>
              <Pressable onPress={onClose} style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
                <X color={colors.text2} size={18} />
              </Pressable>
            </View>

            <LinearGradient colors={gradients.danger} style={{ borderRadius: 34, padding: 22, gap: 18, ...shadow.glowRed }}>
              <Lock color={colors.white} size={48} />
              <Text selectable style={{ color: colors.white, fontSize: 35, lineHeight: 39, fontWeight: typography.heavy }}>
                Hold on.{"\n"}You are still in control.
              </Text>
              <Text selectable style={{ color: "rgba(255,255,255,0.82)", lineHeight: 22, fontSize: 15 }}>
                {interventionBody}
              </Text>
            </LinearGradient>

            <VerdictCard result={attempt.result} />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Metric label="Current streak" value={`${streakDays}d`} color={colors.peach} />
              <Metric label="Plan" value={premium ? membershipPlanLabel : "Free"} color={premium ? colors.mint : colors.sky} />
            </View>

            <Card gradient={gradients.purple}>
              <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: typography.heavy }}>
                Your next move matters
              </Text>
              <Text selectable style={{ color: colors.text2, lineHeight: 22, marginTop: 8 }}>
                No shame. No lecture. Take one recovery action now and let the urge pass.
              </Text>
            </Card>

            {hasPartner && (
              <Card gradient={gradients.sky}>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  <MessageCircleHeart color={colors.sky} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                      Message {accountability.name || "your partner"}
                    </Text>
                    <Text selectable style={{ color: colors.text2, lineHeight: 21, marginTop: 4 }}>
                      Break secrecy and ask for a quick check-in before the next step.
                    </Text>
                  </View>
                  <Pressable onPress={onMessagePartner} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: "rgba(130,206,255,0.16)" }}>
                    <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy }}>
                      Send
                    </Text>
                  </Pressable>
                </View>
              </Card>
            )}
          </View>

          <PillButton
            label={premium || selfUrge || shouldBypassRewardedAdForAttempt(attempt) ? "Start Recovery Challenge" : "Continue to Reset"}
            onPress={onContinue}
            icon={<Play color={colors.bg} size={18} fill={colors.bg} />}
          />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

function interventionBodyForAttempt(attempt: BlockingAttempt) {
  const matchedRule = attempt.result.matchedRule;
  if (attempt.source === "panic-button") {
    return "You asked for help before the loop took over. That is a clean rep for self-control.";
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

function RewardedAdScreen({ onDone }: { onDone: () => void }) {
  const monetizationPlatform = getRuntimeMonetizationPlatform();
  const [session] = React.useState(() => createRewardedResetSession({ platform: monetizationPlatform }));
  const [seconds, setSeconds] = React.useState(session.durationSeconds);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          completeRewardedResetSession(session, { platform: monetizationPlatform }).finally(() => {
            setTimeout(onDone, 250);
          });
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [monetizationPlatform, onDone, session]);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1, padding: 22, justifyContent: "center", gap: 18 }}>
        <Card gradient={gradients.sky} style={{ alignItems: "center", paddingVertical: 30 }}>
          <Text selectable style={{ color: colors.sky, fontWeight: typography.heavy, letterSpacing: 1.2 }}>
            {session.status === "fallback" ? "RECOVERY RESET" : "SPONSORED RESET"}
          </Text>
          <Text selectable style={{ color: colors.text, fontSize: 64, fontWeight: typography.heavy, marginTop: 14, fontVariant: ["tabular-nums"] }}>
            {seconds}
          </Text>
          <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 22 }}>
            {session.message} Premium skips this completely.
          </Text>
        </Card>
      </SafeAreaView>
    </AppBackground>
  );
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

function useChallengeVerification(
  challenge: RecoveryChallenge | null,
  elapsedSec: number,
  active: boolean,
  connectionActionComplete: boolean
) {
  const requirement = React.useMemo(
    () => (challenge ? getChallengeVerificationRequirement(challenge) : null),
    [challenge]
  );
  const [motionSamples, setMotionSamples] = React.useState(0);
  const [steps, setSteps] = React.useState(0);
  const [distance, setDistance] = React.useState(0);
  const [locationSamples, setLocationSamples] = React.useState(0);
  const [bestLocationAccuracy, setBestLocationAccuracy] = React.useState<number | undefined>(undefined);
  const [photoMatched, setPhotoMatched] = React.useState(false);
  const [photoLabels, setPhotoLabels] = React.useState<string[]>([]);
  const [photoConfidence, setPhotoConfidence] = React.useState<number | undefined>(undefined);
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [status, setStatus] = React.useState("Verification starts when the challenge starts.");

  React.useEffect(() => {
    setMotionSamples(0);
    setSteps(0);
    setDistance(0);
    setLocationSamples(0);
    setBestLocationAccuracy(undefined);
    setPhotoMatched(false);
    setPhotoLabels([]);
    setPhotoConfidence(undefined);
    setPhotoBusy(false);
    setStatus("Verification starts when the challenge starts.");
  }, [challenge?.id]);

  React.useEffect(() => {
    if (!active || requirement?.kind !== "motion") return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let previousMagnitude: number | null = null;

    setStatus("Checking motion sensor...");
    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        if (!available) {
          setStatus("Motion sensor unavailable on this device.");
          return;
        }

        Accelerometer.setUpdateInterval(350);
        subscription = Accelerometer.addListener((sample: AccelerometerMeasurement) => {
          const magnitude = Math.sqrt(sample.x * sample.x + sample.y * sample.y + sample.z * sample.z);
          const delta = previousMagnitude === null ? 0 : Math.abs(magnitude - previousMagnitude);
          previousMagnitude = magnitude;
          if (delta > 0.18) setMotionSamples((current) => Math.min(current + 1, 999));
        });
        setStatus("Motion sensor active.");
      })
      .catch(() => setStatus("Motion sensor permission or hardware is unavailable."));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, requirement?.kind]);

  React.useEffect(() => {
    if (!active || requirement?.kind !== "steps") return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    setStatus("Checking step sensor...");
    Pedometer.isAvailableAsync()
      .then(async (available) => {
        if (cancelled) return;
        if (!available) {
          setStatus("Step counter unavailable on this device.");
          return;
        }

        const permission = await Pedometer.requestPermissionsAsync().catch(() => null);
        if (cancelled) return;
        if (permission && permission.status !== "granted") {
          await openAppSettingsForPermission(setStatus, "Motion");
          return;
        }

        subscription = Pedometer.watchStepCount((result) => {
          setSteps(Math.max(0, Math.round(result.steps)));
        });
        setStatus("Step counter active.");
      })
      .catch(() => setStatus("Step sensor permission or hardware is unavailable."));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, requirement?.kind]);

  React.useEffect(() => {
    if (!active || requirement?.kind !== "location") return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;
    let startPoint: { latitude: number; longitude: number } | null = null;
    const maxAccuracyMeters = requirement.maxLocationAccuracyMeters ?? 80;

    setStatus("Requesting location for movement verification...");
    Location.requestForegroundPermissionsAsync()
      .then(async (permission) => {
        if (cancelled) return;
        if (permission.status !== "granted") {
          await openAppSettingsForPermission(setStatus, "Location");
          return;
        }

        const nextSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 5000
          },
          (location) => {
            const accuracy = typeof location.coords.accuracy === "number" ? location.coords.accuracy : undefined;
            if (accuracy === undefined || accuracy > maxAccuracyMeters) {
              if (accuracy !== undefined) {
                setBestLocationAccuracy((current) => Math.min(current ?? accuracy, accuracy));
              }
              setStatus(`Waiting for clearer location accuracy under ${maxAccuracyMeters} m.`);
              return;
            }

            const point = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            };
            const origin = startPoint ?? point;
            startPoint = origin;
            setLocationSamples((current) => Math.min(current + 1, 999));
            setBestLocationAccuracy((current) => Math.min(current ?? accuracy, accuracy));
            setDistance((current) => Math.max(current, distanceMeters(origin, point)));
          }
        );
        if (cancelled) {
          nextSubscription.remove();
          return;
        }
        subscription = nextSubscription;
        setStatus("Location movement verification active.");
      })
      .catch(() => setStatus("Location provider is unavailable."));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active, requirement?.kind, requirement?.maxLocationAccuracyMeters]);

  React.useEffect(() => {
    if (!active || requirement?.kind !== "timer") return;
    setStatus("Timer verification active.");
  }, [active, requirement?.kind]);

  React.useEffect(() => {
    if (!active || requirement?.kind !== "photo") return;
    setStatus("Take a fresh camera photo when you reach the target.");
  }, [active, requirement?.kind]);

  React.useEffect(() => {
    if (!active || requirement?.kind !== "connection") return;
    setStatus(connectionActionComplete ? "Connection action verified." : "Complete a connection action to verify this challenge.");
  }, [active, connectionActionComplete, requirement?.kind]);

  const capturePhoto = React.useCallback(async () => {
    if (!requirement || requirement.kind !== "photo") return;
    const expectedLabels = requirement.expectedPhotoLabels ?? [];
    if (expectedLabels.length === 0) {
      setStatus("This photo challenge has no verifiable target labels.");
      return;
    }

    setPhotoBusy(true);
    setStatus("Opening camera...");
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        await openAppSettingsForPermission(setStatus, "Camera");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        base64: false,
        exif: false,
        mediaTypes: ["images"],
        quality: 0.72
      });
      if (result.canceled || !result.assets[0]?.uri) {
        setStatus("Photo capture cancelled.");
        return;
      }

      const photoUri = result.assets[0].uri;
      try {
        setStatus("Classifying the photo on this device...");
        const classification = await classifyChallengePhoto(photoUri, expectedLabels);
        const labels = Array.from(new Set([...classification.matchedLabels, ...classification.labels]));
        setPhotoMatched(classification.matched);
        setPhotoLabels(labels);
        setPhotoConfidence(classification.confidence);
        setStatus(classification.message);
      } finally {
        deleteTemporaryChallengePhoto(photoUri);
      }
    } catch {
      setPhotoMatched(false);
      setStatus("Photo verification failed. Try again with a clearer image.");
    } finally {
      setPhotoBusy(false);
    }
  }, [requirement]);

  const evidence = React.useMemo(
    () => ({
      elapsedSec,
      motionSamples,
      steps,
      distanceMeters: distance,
      locationSamples,
      bestLocationAccuracyMeters: bestLocationAccuracy,
      photoMatched,
      photoLabels,
      photoConfidence,
      connectionActionComplete
    }),
    [
      bestLocationAccuracy,
      connectionActionComplete,
      distance,
      elapsedSec,
      locationSamples,
      motionSamples,
      photoConfidence,
      photoLabels,
      photoMatched,
      steps
    ]
  );
  const satisfied = requirement ? isChallengeVerificationSatisfied(requirement, evidence) : false;

  return {
    requirement,
    satisfied,
    status,
    progress: requirement ? getVerificationProgressText(requirement, evidence) : "",
    capturePhoto,
    photoBusy
  };
}

function getVerificationProgressText(
  requirement: ChallengeVerificationRequirement,
  evidence: {
    elapsedSec: number;
    motionSamples: number;
    steps: number;
    distanceMeters: number;
    locationSamples: number;
    bestLocationAccuracyMeters?: number;
    photoMatched: boolean;
    photoLabels: string[];
    photoConfidence?: number;
    connectionActionComplete: boolean;
  }
) {
  if (requirement.kind === "motion") {
    return `${Math.min(evidence.motionSamples, requirement.minMotionSamples ?? 0)}/${requirement.minMotionSamples ?? 0} movement signals`;
  }
  if (requirement.kind === "steps") {
    return `${Math.min(evidence.steps, requirement.minSteps ?? 0)}/${requirement.minSteps ?? 0} steps`;
  }
  if (requirement.kind === "location") {
    const sampleTarget = requirement.minLocationSamples ?? 0;
    const sampleText = sampleTarget > 0
      ? `, ${Math.min(evidence.locationSamples, sampleTarget)}/${sampleTarget} fixes`
      : "";
    const accuracyText = evidence.bestLocationAccuracyMeters !== undefined
      ? `, best ${Math.round(evidence.bestLocationAccuracyMeters)} m accuracy`
      : "";
    return `${Math.min(Math.round(evidence.distanceMeters), requirement.minDistanceMeters ?? 0)}/${requirement.minDistanceMeters ?? 0} m moved${sampleText}${accuracyText}`;
  }
  if (requirement.kind === "photo") {
    const minConfidence = requirement.minPhotoConfidence ?? 0;
    if (evidence.photoMatched) {
      const confidence = evidence.photoConfidence ? ` - ${Math.round(evidence.photoConfidence * 100)}%` : "";
      if ((evidence.photoConfidence ?? 0) < minConfidence) {
        return `Target found, needs ${Math.round(minConfidence * 100)}% confidence`;
      }
      return `Matched ${evidence.photoLabels.slice(0, 2).join(", ") || "target"}${confidence}`;
    }
    return "Fresh verified photo pending";
  }
  if (requirement.kind === "connection") {
    return evidence.connectionActionComplete ? "Connection action complete" : "Connection action pending";
  }
  return `${Math.min(evidence.elapsedSec, requirement.minElapsedSec)}/${requirement.minElapsedSec} sec`;
}

function ChallengeScreen({
  profile,
  selected,
  onBack,
  onMessagePartner,
  onComplete
}: {
  profile: {
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
  onMessagePartner?: (challenge: RecoveryChallenge) => void;
  onComplete: (challenge: RecoveryChallenge, outcome: ChallengeOutcome) => void;
}) {
  const [challenge, setChallenge] = React.useState<RecoveryChallenge | null>(selected ?? null);
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
        streakDays: profile.streakDays,
        premium: profile.premium,
        attemptsToday: profile.attemptsToday,
        mood: profile.attemptsToday > 0 && profile.mood !== "low" ? ("stressed" as const) : profile.mood,
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
  const [seconds, setSeconds] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const [connectionActionComplete, setConnectionActionComplete] = React.useState(false);
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

  React.useEffect(() => {
    let cancelled = false;
    setOptions(generateChallengeSet(challengeProfile));
    generateAdaptiveChallengeSet(challengeProfile)
      .then((nextOptions) => {
        if (!cancelled) setOptions(nextOptions);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [challengeProfile]);

  React.useEffect(() => {
    if (!challenge || done) return;
    setSeconds(0);
    const max = Math.max(1, challenge.durationSec);
    const timer = setInterval(() => {
      setSeconds((current) => {
        if (current >= max) {
          clearInterval(timer);
          return max;
        }
        return current + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [challenge, done]);
  React.useEffect(() => {
    setConnectionActionComplete(false);
    completionSubmittedRef.current = false;
    setCompletionSubmitting(false);
  }, [challenge?.id]);
  const submitChallengeOutcome = React.useCallback(
    (completedChallenge: RecoveryChallenge, outcome: ChallengeOutcome) => {
      if (completionSubmittedRef.current) return;
      completionSubmittedRef.current = true;
      setCompletionSubmitting(true);
      onComplete(completedChallenge, outcome);
    },
    [onComplete]
  );
  const verification = useChallengeVerification(challenge, seconds, Boolean(challenge && !done), connectionActionComplete);

  if (!challenge) {
    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 22, gap: 14 }}>
            <Pressable onPress={onBack} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
              <X color={colors.text2} size={19} />
            </Pressable>
            <Text selectable style={{ color: colors.text, fontSize: 31, lineHeight: 36, fontWeight: typography.heavy }}>
              Pick one reset.{"\n"}The urge will pass.
            </Text>
            {options.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap] ?? Activity;
              return (
                <Pressable key={item.id} onPress={() => setChallenge(item)}>
                  <Card gradient={item.premium ? gradients.purple : undefined}>
                    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                      <View style={{ width: 54, height: 54, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }}>
                        <Icon color={item.premium ? colors.purple : colors.mint} size={27} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: typography.heavy }}>
                          {item.title}
                        </Text>
                        <Text selectable style={{ color: colors.text2, marginTop: 4 }}>
                          {Math.round(item.durationSec / 60) || 1} min - {item.intensity}
                        </Text>
                      </View>
                      <ChevronRight color={colors.mint} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </AppBackground>
    );
  }

  if (done) {
    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: "center", gap: 22 }}>
          <Card gradient={gradients.mint} style={{ alignItems: "center", paddingVertical: 32 }}>
            <Check color={colors.mint} size={58} strokeWidth={4} />
            <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy, marginTop: 16 }}>
              Challenge Complete
            </Text>
            <Text selectable style={{ color: colors.peach, fontSize: 18, fontWeight: typography.heavy, marginTop: 8 }}>
              {profile.disciplinePreferences?.unlockDurationMinutes ?? 10} min unlock ready
            </Text>
            <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 22, marginTop: 12 }}>
              You protected the streak and trained the response you want next time.
            </Text>
          </Card>
          <PillButton
            label={completionSubmitting ? "Saving..." : "Urge Passed"}
            onPress={() => submitChallengeOutcome(challenge, "helped")}
            variant="success"
            disabled={completionSubmitting}
          />
          <PillButton
            label="Still Need Support"
            onPress={() => submitChallengeOutcome(challenge, "still-urging")}
            variant="ghost"
            icon={<Brain color={colors.text2} size={19} />}
            disabled={completionSubmitting}
          />
        </SafeAreaView>
      </AppBackground>
    );
  }

  const max = Math.max(1, challenge.durationSec);
  const pct = Math.round((seconds / max) * 100);
  const Icon = iconMap[challenge.icon as keyof typeof iconMap] ?? Activity;

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 22, gap: 18, flexGrow: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable onPress={() => setChallenge(null)} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft color={colors.text2} size={19} />
            </Pressable>
            <Text selectable style={{ color: colors.text, flex: 1, fontSize: 18, fontWeight: typography.heavy }}>
              {challenge.title}
            </Text>
          </View>

          <Card gradient={gradients.purple} style={{ alignItems: "center", paddingVertical: 28 }}>
            <View style={{ width: 150, height: 150, borderRadius: 75, borderWidth: 10, borderColor: "rgba(184,152,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <Icon color={colors.purple} size={42} />
              <Text selectable style={{ color: colors.text, fontSize: 24, fontWeight: typography.heavy, marginTop: 8 }}>
                {pct}%
              </Text>
            </View>
            <Text selectable style={{ color: colors.text2, textAlign: "center", lineHeight: 22, marginTop: 18 }}>
              {challenge.why}
            </Text>
          </Card>

          <Card>
            <Text selectable style={{ color: colors.text3, fontWeight: typography.heavy, letterSpacing: 1.2, marginBottom: 12 }}>
              STEPS
            </Text>
            {challenge.steps.map((step, index) => (
              <View key={step} style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
                <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: seconds > (index / challenge.steps.length) * max ? "rgba(184,152,255,0.24)" : "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" }}>
                  <Text selectable style={{ color: colors.text, fontWeight: typography.heavy }}>
                    {index + 1}
                  </Text>
                </View>
                <Text selectable style={{ color: colors.text2, flex: 1, lineHeight: 21 }}>
                  {step}
                </Text>
              </View>
            ))}
          </Card>

          {verification.requirement && (
            <Card>
              <Text selectable style={{ color: colors.text3, fontWeight: typography.heavy, letterSpacing: 1.2, marginBottom: 10 }}>
                VERIFICATION
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <ShieldCheck color={verification.satisfied ? colors.mint : colors.sky} size={25} />
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: typography.heavy }}>
                    {verification.requirement.label}
                  </Text>
                  <Text selectable style={{ color: colors.text2, lineHeight: 21, marginTop: 4 }}>
                    {verification.status}
                  </Text>
                  <Text selectable style={{ color: colors.text3, marginTop: 4 }}>
                    {verification.progress}
                  </Text>
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
                        minHeight: 42,
                        borderRadius: 21,
                        paddingHorizontal: 14,
                        marginTop: 12,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: verification.satisfied ? "rgba(68,225,177,0.16)" : "rgba(122,196,255,0.16)",
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
              label={onMessagePartner ? "Message Partner" : "I Reached Out"}
              variant="ghost"
              onPress={() => {
                setConnectionActionComplete(true);
                onMessagePartner?.(challenge);
              }}
              icon={<MessageCircleHeart color={colors.text2} size={19} />}
            />
          )}

          <PillButton
            label={verification.satisfied ? "I'm Done" : seconds >= max ? "Verify Action" : `Keep Going ${pct}%`}
            disabled={!verification.satisfied}
            variant="success"
            onPress={() => setDone(true)}
          />
        </ScrollView>
      </SafeAreaView>
    </AppBackground>
  );
}

function BreathingScreen({ onBack }: { onBack: () => void }) {
  const phases = React.useMemo(
    () => [
      { label: "Inhale", sec: 4, scale: 1.2, color: colors.sky },
      { label: "Hold", sec: 7, scale: 1.2, color: colors.purple },
      { label: "Exhale", sec: 8, scale: 0.86, color: colors.mint }
    ],
    []
  );
  const [running, setRunning] = React.useState(false);
  const [phaseIndex, setPhaseIndex] = React.useState(0);
  const [count, setCount] = React.useState(phases[0].sec);
  const phase = phases[phaseIndex];

  React.useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setCount((current) => {
        if (current > 1) return current - 1;
        const next = (phaseIndex + 1) % phases.length;
        setPhaseIndex(next);
        return phases[next].sec;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phaseIndex, phases, running]);

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1, padding: 22 }}>
        <Pressable onPress={onBack} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft color={colors.text2} size={19} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 28 }}>
          <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: typography.heavy }}>
            4-7-8 Breathing
          </Text>
          <View style={{ width: 190, height: 190, borderRadius: 95, backgroundColor: `${phase.color}20`, borderWidth: 3, borderColor: `${phase.color}66`, alignItems: "center", justifyContent: "center", transform: [{ scale: running ? phase.scale : 1 }] }}>
            <Text selectable style={{ color: phase.color, fontSize: 48, fontWeight: typography.heavy, fontVariant: ["tabular-nums"] }}>
              {running ? count : "-"}
            </Text>
            <Text selectable style={{ color: colors.text2, fontWeight: typography.bold }}>
              {running ? phase.label : "Ready"}
            </Text>
          </View>
          <PillButton
            label={running ? "Pause" : "Start"}
            variant={running ? "ghost" : "primary"}
            onPress={() => {
              tap();
              setRunning(!running);
              if (!running) {
                setPhaseIndex(0);
                setCount(phases[0].sec);
              }
            }}
          />
        </View>
      </SafeAreaView>
    </AppBackground>
  );
}

function BottomNav({ tab, setTab, onPanic }: { tab: Tab; setTab: (tab: Tab) => void; onPanic: () => void }) {
  const items = [
    ["home", Home],
    ["analytics", BarChart3],
    ["shield", Shield],
    ["library", BookOpen],
    ["profile", CircleUserRound]
  ] as const;
  const navLabels: Record<Tab, string> = {
    home: "Home",
    analytics: "Analytics",
    shield: "Shield",
    library: "Library",
    profile: "Profile"
  };

  return (
    <View style={{ position: "absolute", left: 12, right: 12, bottom: 16, flexDirection: "row", gap: 10, alignItems: "center" }}>
      <View style={{ flex: 1, minHeight: 70, borderRadius: 35, backgroundColor: "#1E1C2E", borderWidth: 1.4, borderColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", padding: 6, ...shadow.soft }}>
        {items.map(([id, Icon]) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={`${navLabels[id]} tab`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                tap();
                setTab(id);
              }}
              style={{ flex: 1, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: active ? "rgba(184,152,255,0.18)" : "transparent" }}
            >
              <Icon color={active ? colors.purple : "rgba(240,236,248,0.4)"} size={22} strokeWidth={active ? 2.6 : 2.1} />
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={onPanic}
        accessibilityRole="button"
        accessibilityLabel="Open urge support"
        accessibilityHint="Starts an immediate recovery intervention without an ad."
        style={({ pressed }) => ({ width: 66, height: 66, borderRadius: 33, overflow: "hidden", transform: [{ scale: pressed ? 0.94 : 1 }], ...shadow.glowPurple })}
      >
        <LinearGradient colors={[colors.purple, colors.pink]} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Lock color={colors.white} size={24} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function FreedApp() {
  const { width } = useWindowDimensions();
  const { state: recoveryState, setRecoveryState, hydrated, storageError } = usePersistentRecoveryState();
  const [screen, setScreen] = React.useState<Screen>("splash");
  const [tab, setTab] = React.useState<Tab>("home");
  const [quizIndex, setQuizIndex] = React.useState(0);
  const [activeAttempt, setActiveAttempt] = React.useState<NativeInterventionAttempt | null>(null);
  const [selectedChallenge, setSelectedChallenge] = React.useState<RecoveryChallenge | null>(null);
  const [protectionCapability, setProtectionCapability] = React.useState<ProtectionCapability | null>(null);
  const [protectionStatus, setProtectionStatus] = React.useState<ProtectionStatus | null>(null);
  const [protectionRefreshCompleted, setProtectionRefreshCompleted] = React.useState(false);
  const [protectionSyncMessage, setProtectionSyncMessage] = React.useState<string | null>(null);
  const [appSelectionReturnToProtectionSetup, setAppSelectionReturnToProtectionSetup] = React.useState(false);
  const [reminderBusy, setReminderBusy] = React.useState(false);
  const [purchaseBusy, setPurchaseBusy] = React.useState(false);
  const [purchaseNotice, setPurchaseNotice] = React.useState<string | null>(null);
  const [analyticsSendBusy, setAnalyticsSendBusy] = React.useState(false);
  const [analyticsSendMessage, setAnalyticsSendMessage] = React.useState<string | null>(null);
  const [unlockClockMs, setUnlockClockMs] = React.useState(Date.now());
  const pendingInterventionTracker = React.useRef(createPendingInterventionTracker());
  const consumedDeepLinkIntervention = React.useRef<string | null>(null);
  const consumedProtectionSetupLink = React.useRef<string | null>(null);
  const isWide = width > 760;

  const {
    premium,
    streakDays,
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
  const attemptsToday = countAttemptsForDay(attempts);
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
  const retentionPlan = createLocalRetentionPlan(buildRetentionRequest(recoveryState));
  const achievements = generateAchievementBadges(recoveryState);
  const lastRelapseAt = relapseRecords[0]?.occurredAt ?? null;
  const premiumCapabilities = React.useMemo(
    () => getPremiumCapabilities({ premium, planId: recoveryState.premiumPlanId }),
    [premium, recoveryState.premiumPlanId]
  );
  const preferredCategories = React.useMemo(() => inferPreferredChallengeCategories(answers), [answers]);
  const activeInterventionContext = React.useMemo(
    () => buildInterventionContextFromAttempt(activeAttempt),
    [activeAttempt]
  );
  const challengePreferences = React.useMemo(
    () => buildChallengePreferenceSignal(disciplineSettings),
    [disciplineSettings]
  );
  const activeUnlock = getActiveEarnedUnlock(recoveryState, new Date(unlockClockMs).toISOString());
  const activeNativeUnlock = React.useMemo(
    () => getActiveNativeEarnedUnlock(recoveryState.earnedUnlocks, Platform.OS, new Date(unlockClockMs).toISOString()),
    [recoveryState.earnedUnlocks, unlockClockMs]
  );
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
    setAnalyticsSendBusy(true);
    setAnalyticsSendMessage("Sending aggregate snapshot...");
    const sentAt = new Date().toISOString();
    try {
      const result = await sendGatedAnalyticsPayload(recoveryState, recoveryState.analyticsSharing);
      const message = result.accepted
        ? "Aggregate analytics snapshot accepted."
        : result.reason ?? "Aggregate analytics snapshot was not accepted.";
      setAnalyticsSendMessage(message);
      setRecoveryState((current) =>
        updateAnalyticsSharingSettings(
          current,
          {
            lastSentAt: result.accepted ? sentAt : current.analyticsSharing.lastSentAt,
            lastSendStatus: result.status,
            lastSendMessage: message
          },
          sentAt
        )
      );
    } finally {
      setAnalyticsSendBusy(false);
    }
  }, [recoveryState, setRecoveryState]);

  const startChallenge = React.useCallback((challenge?: RecoveryChallenge) => {
    setSelectedChallenge(challenge ?? null);
    setScreen("challenge");
  }, []);

  const startStandaloneChallenge = React.useCallback(
    (challenge?: RecoveryChallenge) => {
      setActiveAttempt(null);
      startChallenge(challenge);
    },
    [startChallenge]
  );

  const abandonActiveProtectionFlow = React.useCallback(() => {
    setActiveAttempt(null);
    setSelectedChallenge(null);
    setScreen("main");
  }, []);

  const startPanicIntervention = React.useCallback(() => {
    const attempt = createPanicInterventionAttempt();
    setRecoveryState((current) => recordBlockingAttempt(current, attempt));
    setActiveAttempt(attempt);
    setScreen("intercept");
  }, [setRecoveryState]);

  const refreshProtectionStatus = React.useCallback(async (): Promise<ProtectionRefreshResult> => {
    const [capabilityResult, statusResult] = await Promise.allSettled([
      getProtectionCapabilities(),
      getProtectionStatus()
    ]);
    const capability = capabilityResult.status === "fulfilled" ? capabilityResult.value : null;
    const status = statusResult.status === "fulfilled" ? statusResult.value : null;

    setProtectionCapability(capability);
    setProtectionStatus(status);
    setProtectionRefreshCompleted(true);

    return { capability, status };
  }, []);

  React.useEffect(() => {
    void refreshProtectionStatus();
  }, [refreshProtectionStatus]);

  React.useEffect(() => {
    configureNativeMonetizationRuntime({ platform: getRuntimeMonetizationPlatform() }).catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!hydrated || screen !== "paywall") return;
    setRecoveryState((current) => markOnboardingPaywallPresented(ensureOnboardingComplete(current)));
  }, [hydrated, screen, setRecoveryState]);

  React.useEffect(() => {
    const timer = setInterval(() => setUnlockClockMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

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
    if (!hydrated) return undefined;

    let cancelled = false;
    syncNativeAdultDomainFeed()
      .then(({ status, provider, warning }) => {
        if (!cancelled) {
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
        if (!cancelled) {
          setProtectionSyncMessage("Adult-domain feed sync could not complete; embedded adult-domain protection remains available.");
        }
      })
      .finally(() => {
        if (!cancelled) void refreshProtectionStatus();
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, refreshProtectionStatus]);

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
    if (shouldReturnToProtectionSetupAfterRevocation(screen)) {
      setScreen("protectionSetup");
    }
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

    let cancelled = false;
    const syncUnlock = activeNativeUnlock
      ? applyEarnedUnlockWindow(activeNativeUnlock.expiresAt, activeNativeUnlock.sourceAttemptHost)
      : clearEarnedUnlockWindow();

    syncUnlock
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
  }, [activeNativeUnlock?.expiresAt, activeNativeUnlock?.id, activeNativeUnlock?.sourceAttemptHost, hydrated, refreshProtectionStatus]);

  React.useEffect(() => {
    if (!hydrated) return undefined;

    let cancelled = false;
    configureBlockedAppPackages(
      activeBlockedAppPackages,
      disciplineSettings.dailyLimitMinutes,
      disciplineSettings.shortFormInterruptionSeconds
    )
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
    activeBlockedAppPackagesKey,
    disciplineSettings.dailyLimitMinutes,
    disciplineSettings.shortFormInterruptionSeconds,
    hydrated,
    refreshProtectionStatus
  ]);

  React.useEffect(() => {
    if (!hydrated || !protectionCapability?.managedSettings) return undefined;

    let cancelled = false;
    const start = parseClockTime(disciplineSettings.sleepStartTime);
    const end = parseClockTime(disciplineSettings.sleepEndTime);
    const syncSleepSchedule =
      disciplineSettings.sleepModeEnabled && start && end
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
    refreshProtectionStatus
  ]);

  const changeReminderPreferences = React.useCallback(
    (update: Partial<ReminderPreferences>) => {
      const smartUpdate =
        update.enabled === true && update.guardTime === undefined
          ? { ...update, guardTime: getSmartReminderSuggestion(recoveryState).guardTime }
          : update;
      const nextPreferences = { ...recoveryState.reminders, ...smartUpdate };
      setRecoveryState((current) => updateReminderPreferences(current, smartUpdate));
      setReminderBusy(true);
      syncRecoveryReminders(nextPreferences)
        .then((result) => {
          setRecoveryState((current) => recordReminderSync(updateReminderPreferences(current, smartUpdate), result));
        })
        .catch((error) => {
          setRecoveryState((current) =>
            recordReminderSync(updateReminderPreferences(current, smartUpdate), {
              scheduledIds: [],
              permissionStatus: "unavailable",
              statusMessage: safeUserFacingMessage(error, "Recovery reminders could not be scheduled."),
              enabled: false
            })
          );
        })
        .finally(() => setReminderBusy(false));
    },
    [recoveryState, setRecoveryState]
  );

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

    // The coordinator claims the exact native ID, then gates UI handoff with isFreshPendingIntervention(pending).
    consumePendingInterventionOnce({
      tracker: pendingInterventionTracker.current,
      getPending: getPendingIntervention,
      clearPending: clearPendingIntervention
    })
      .then((attempt) => {
        if (!attempt) return;
        setRecoveryState((current) => recordBlockingAttempt(current, attempt));
        setActiveAttempt(attempt);
        setScreen("intercept");
      })
      .catch(() => undefined);
  }, [hydrated, setRecoveryState]);

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

  const messageAccountabilityPartner = React.useCallback(
    (challenge?: RecoveryChallenge) => {
      const url = buildAccountabilityDeepLink(
        recoveryState.accountability,
        {
          streakDays: recoveryState.streakDays,
          host: activeAttempt?.host,
          challengeTitle: challenge?.title
        },
        Platform.OS === "android" ? "android" : Platform.OS === "web" ? "web" : "ios"
      );

      if (!url) return;

      Linking.openURL(url)
        .then(() => {
          setRecoveryState((current) => recordAccountabilityContact(current));
        })
        .catch(() => undefined);
    },
    [activeAttempt?.host, recoveryState.accountability, recoveryState.streakDays, setRecoveryState]
  );

  const sendSponsorReport = React.useCallback(() => {
    if (!premiumCapabilities.sponsorAccountability) {
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
  }, [premiumCapabilities.sponsorAccountability, recoveryState, setRecoveryState]);

  const sendSupportCircleReport = React.useCallback(
    (memberId: string) => {
      if (!premiumCapabilities.familySupport && !premiumCapabilities.sponsorAccountability) {
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
    [premiumCapabilities.familySupport, premiumCapabilities.sponsorAccountability, recoveryState, setRecoveryState]
  );

  const deleteLocalRecoveryData = React.useCallback(async () => {
    const defaultState = createDefaultRecoveryState();
    await Promise.allSettled([
      stopAdultContentFilter(),
      stopRiskWindowMonitoring(),
      clearEarnedUnlockWindow(),
      configureBlockedAppPackages(
        [],
        defaultState.disciplineSettings.dailyLimitMinutes,
        defaultState.disciplineSettings.shortFormInterruptionSeconds
      )
    ]);
    pendingInterventionTracker.current = createPendingInterventionTracker();
    consumedDeepLinkIntervention.current = null;
    setActiveAttempt(null);
    setSelectedChallenge(null);
    setProtectionStatus(null);
    setProtectionSyncMessage(null);
    setRecoveryState(defaultState);
    setTab("home");
    setScreen("welcome");
  }, [setRecoveryState]);

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
  }, [consumeDeepLinkIntervention, consumeProtectionSetupDeepLink, hydrated]);

  React.useEffect(() => {
    if (!hydrated || !reminders.enabled) return undefined;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    listenForReminderResponses((route) => {
      if (route !== "checkin") return;
      setTab("home");
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

  const body = (() => {
    if (screen === "splash") {
      return <SplashScreen hold={!hydrated} onDone={() => setScreen(getInitialScreenForRecoveryState(recoveryState))} />;
    }
    if (screen === "welcome") {
      return (
        <WelcomeScreen
          onStart={() => setScreen("quiz")}
          onSkip={() => {
            setScreen("appSelection");
          }}
        />
      );
    }
    if (screen === "quiz") {
      return (
        <QuizScreen
          index={quizIndex}
          answers={answers}
          onBack={() => {
            if (quizIndex === 0) setScreen("welcome");
            else setQuizIndex((index) => index - 1);
          }}
          onAnswer={(answer) => {
            setRecoveryState((current) => {
              const next = [...current.answers];
              next[quizIndex] = answer;
              return { ...current, answers: next };
            });
            if (quizIndex >= quiz.length - 1) setScreen("appSelection");
            else setQuizIndex((index) => index + 1);
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
            setScreen(answers.length > 0 ? "quiz" : "welcome");
          }}
          onContinue={(packages) => {
            const returnToProtectionSetup = appSelectionReturnToProtectionSetup;
            setRecoveryState((current) => completeOnboardingWithSelectedApps(current, current.answers, packages));
            if (returnToProtectionSetup) {
              setScreen("protectionSetup");
              return;
            }
            setScreen(recoveryState.onboardingPaywallPresentedAt || recoveryState.premium ? "protectionSetup" : "paywall");
          }}
        />
      );
    }
    if (screen === "paywall") {
      return (
        <PaywallScreen
          busy={purchaseBusy}
          notice={purchaseNotice}
          onSubscribe={(planId) => {
            setPurchaseBusy(true);
            purchasePremiumPlan(planId, { platform: getRuntimeMonetizationPlatform() })
              .then((result) => {
                setPurchaseNotice(safeUserFacingMessage(result.message, "Premium purchase could not be completed."));
                if (result.premium) {
                  setRecoveryState((current) =>
                    setPremiumPlan(ensureOnboardingComplete(current), true, result.planId)
                  );
                  setScreen("protectionSetup");
                }
              })
              .catch((error) => {
                setPurchaseNotice(safeUserFacingMessage(error, "Premium purchase could not be completed."));
              })
              .finally(() => setPurchaseBusy(false));
          }}
          onRestore={() => {
            setPurchaseBusy(true);
            restorePremiumPurchases({ platform: getRuntimeMonetizationPlatform() })
              .then((result) => {
                setPurchaseNotice(safeUserFacingMessage(result.message, "Premium restore could not be completed."));
                if (result.premium) {
                  setRecoveryState((current) =>
                    setPremiumPlan(ensureOnboardingComplete(current), true, result.planId)
                  );
                  setScreen("protectionSetup");
                }
              })
              .catch((error) => {
                setPurchaseNotice(safeUserFacingMessage(error, "Premium restore could not be completed."));
              })
              .finally(() => setPurchaseBusy(false));
          }}
          onClose={() => {
            setRecoveryState((current) => ensureOnboardingComplete(current));
            setScreen("protectionSetup");
          }}
        />
      );
    }
    if (screen === "protectionSetup") {
      return (
        <ProtectionSetupScreen
          protectionCapability={protectionCapability}
          protectionStatus={protectionStatus}
          protectionSyncMessage={protectionSyncMessage}
          selectedAppPackageCount={disciplineSettings.blockedAppPackages.length}
          appSelectionReturnPending={appSelectionReturnToProtectionSetup}
          onRefresh={refreshProtectionStatus}
          onSyncAppPackages={() =>
            configureBlockedAppPackages(
              activeBlockedAppPackages,
              disciplineSettings.dailyLimitMinutes,
              disciplineSettings.shortFormInterruptionSeconds
            )
          }
          onChooseApps={() => {
            setAppSelectionReturnToProtectionSetup(true);
            setScreen("appSelection");
          }}
          onAppSelectionReturnHandled={() => setAppSelectionReturnToProtectionSetup(false)}
          onContinue={() => {
            setRecoveryState((current) =>
              markProtectionActivated(ensureOnboardingComplete(current), getRuntimeProtectionActivationPlatform())
            );
            setScreen("main");
          }}
        />
      );
    }
    if (screen === "intercept" && activeAttempt) {
      return (
        <InterceptScreen
          attempt={activeAttempt}
          premium={premiumCapabilities.noAds}
          membershipPlanLabel={getMembershipPlanLabel(recoveryState, true)}
          streakDays={streakDays}
          accountability={accountability}
          onMessagePartner={() => messageAccountabilityPartner()}
          onClose={abandonActiveProtectionFlow}
          onContinue={() => {
            if (premiumCapabilities.noAds || shouldBypassRewardedAdForAttempt(activeAttempt)) startChallenge();
            else setScreen("ad");
          }}
        />
      );
    }
    if (screen === "ad") return <RewardedAdScreen onDone={startChallenge} />;
    if (screen === "challenge") {
      return (
        <ChallengeScreen
          profile={{
            streakDays,
            premium: premiumCapabilities.premiumChallenges,
            attemptsToday,
            mood: todayCheckIn?.mood ?? (attemptsToday > 0 ? "stressed" : "steady"),
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
            customChallenges: premiumCapabilities.customChallenges ? customChallenges : []
          }}
          selected={selectedChallenge ?? undefined}
          onMessagePartner={hasUsableAccountabilityPartner(accountability) ? messageAccountabilityPartner : undefined}
          onBack={abandonActiveProtectionFlow}
          onComplete={(challenge, outcome) => {
            const completionDecision = getProtectionChallengeCompletionDecision(activeAttempt, outcome);
            if (completionDecision.applyFocusShieldScope && activeAttempt?.scope?.kind === "android-surface") {
              const focusShieldDurationMinutes = Math.max(1, Math.min(120, disciplineSettings.unlockDurationMinutes));
              const focusShieldExpiresAt = new Date(Date.now() + focusShieldDurationMinutes * 60_000).toISOString();
              void applyFocusShieldEarnedUnlock(focusShieldExpiresAt, activeAttempt.scope)
                .then((status) => setProtectionStatus(status))
                .catch(() => undefined)
                .finally(() => void refreshProtectionStatus());
            }
            setRecoveryState((current) => {
              const sourceAttempt = unlockSourceForAttempt(activeAttempt);
              const completed = recordChallengeCompletion(current, challenge, undefined, sourceAttempt, outcome);
              if (!completionDecision.grantEarnedUnlock) return completed;
              return recordEarnedUnlock(completed, challenge, {
                durationMinutes: current.disciplineSettings.unlockDurationMinutes,
                sourceAttemptHost: activeAttempt?.scope?.kind === "android-surface" ? undefined : sourceAttempt
              });
            });
            setActiveAttempt(null);
            setSelectedChallenge(null);
            setScreen(outcome === "still-urging" ? "coach" : "main");
          }}
        />
      );
    }
    if (screen === "customChallenge") {
      return (
        <CustomChallengeScreen
          premium={premiumCapabilities.customChallenges}
          customChallenges={customChallenges}
          onBack={() => setScreen("main")}
          onUpgrade={() => setScreen("paywall")}
          onSave={(input) => {
            const challenge = createCustomRecoveryChallenge(input);
            setRecoveryState((current) => addCustomRecoveryChallenge(current, challenge));
            startStandaloneChallenge(challenge);
          }}
        />
      );
    }
    if (screen === "breathing") return <BreathingScreen onBack={() => setScreen("main")} />;
    if (screen === "coach") {
      return (
        <CoachPanel
          attempts={attempts}
          streakDays={streakDays}
          attemptsToday={attemptsToday}
          premium={premiumCapabilities.advancedAiCoach}
          slipsThisWeek={weeklyReport.slips}
          slipWindow={weeklyReport.slipWindow}
          slipTrigger={weeklyReport.slipTrigger}
          onBack={() => setScreen("main")}
        />
      );
    }
    if (screen === "checkin") {
      return (
        <CheckInScreen
          todayCheckIn={todayCheckIn}
          onBack={() => setScreen("main")}
          onSave={(input) => {
            setRecoveryState((current) => recordDailyCheckIn(current, input));
            setTab("home");
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
          onBack={() => setScreen("main")}
          onSave={(input) => {
            setRecoveryState((current) => recordRelapse(current, input));
            setActiveAttempt(null);
            setTab("home");
            setScreen("main");
          }}
        />
      );
    }

    return (
      <AppBackground>
        <SafeAreaView style={{ flex: 1, alignSelf: "center", width: "100%", maxWidth: isWide ? 520 : undefined }}>
          {tab === "home" && (
            <HomeScreen
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
              onHabitToggle={(habit) => {
                setRecoveryState((current) =>
                  recordDailyHabitCompletion(current, {
                    key: habit.key,
                    label: habit.label,
                    completed: !habit.done
                  })
                );
              }}
            />
          )}
          {tab === "analytics" && (
            <AnalyticsScreen
              streakDays={streakDays}
              bestStreakDays={bestStreakDays}
              completedChallenges={completedChallenges}
              attemptsToday={attemptsToday}
              premiumCapabilities={premiumCapabilities}
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
              onEnableAnalyticsSharing={enableAggregateAnalyticsSharing}
              onDisableAnalyticsSharing={disableAggregateAnalyticsSharing}
              onSendAnalyticsSnapshot={sendAggregateAnalyticsSnapshot}
              urgeRiskForecast={urgeRiskForecast}
            />
          )}
          {tab === "shield" && (
            <ShieldScreen
              onAttempt={(url) => handleAttempt(url)}
              disciplineSettings={disciplineSettings}
              activeUnlock={activeUnlock}
              onDisciplineChange={(update) => setRecoveryState((current) => updateDisciplineSettings(current, update))}
            />
          )}
          {tab === "library" && (
            <LibraryScreen
              onBreathing={() => setScreen("breathing")}
              onChallenge={() => startStandaloneChallenge()}
              onCustomChallenge={() => setScreen("customChallenge")}
              onCoach={() => setScreen("coach")}
              customChallengeCount={customChallenges.length}
              customChallengesEnabled={premiumCapabilities.customChallenges}
            />
          )}
          {tab === "profile" && (
            <ProfileScreen
              recoveryState={recoveryState}
              premium={premium}
              premiumCapabilities={premiumCapabilities}
              streakDays={streakDays}
              bestStreakDays={bestStreakDays}
              attempts={attempts}
              relapseCount={relapseRecords.length}
              lastRelapseAt={lastRelapseAt}
              reminders={reminders}
              smartReminderSuggestion={smartReminderSuggestion}
              retentionPlan={retentionPlan}
              accountability={accountability}
              supportCircle={supportCircle}
              disciplineSettings={disciplineSettings}
              reminderBusy={reminderBusy}
              onReminderChange={changeReminderPreferences}
              onAccountabilityChange={(update) => setRecoveryState((current) => updateAccountabilityPartner(current, update))}
              onSendSponsorReport={sendSponsorReport}
              onSendSupportCircleReport={sendSupportCircleReport}
              onSupportCircleChange={(memberId, update) =>
                setRecoveryState((current) => updateSupportCircleMember(current, memberId, update))
              }
              onSupportCircleRemove={(memberId) => setRecoveryState((current) => removeSupportCircleMember(current, memberId))}
              onRestoreBackup={setRecoveryState}
              onDeleteLocalData={deleteLocalRecoveryData}
              onManagePlan={() => setScreen("paywall")}
              onLogSlip={() => setScreen("slip")}
              storageError={storageError}
              protectionCapability={protectionCapability}
              protectionStatus={protectionStatus}
              protectionSyncMessage={protectionSyncMessage}
              refreshProtectionStatus={refreshProtectionStatus}
            />
          )}
          <BottomNav tab={tab} setTab={setTab} onPanic={startPanicIntervention} />
        </SafeAreaView>
      </AppBackground>
    );
  })();

  if (screen === "main" && tab === "profile") {
    return body;
  }

  return body;
}
