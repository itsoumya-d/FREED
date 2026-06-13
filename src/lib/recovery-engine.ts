import { BlockingAttempt } from "@/lib/blocking-engine";
import {
  inferChallengeEngineFamilies,
  pickChallengeTemplates,
  type ChallengeEngineFamily,
  type TemplateContext
} from "@/data/challenge-templates";
import { surfaceForDoomscrollAppPackage } from "@/lib/doomscroll-apps";

export type RecoveryChallenge = {
  id: string;
  title: string;
  category: "physical" | "breathing" | "reflection" | "connection" | "reset";
  durationSec: number;
  intensity: "calm" | "medium" | "strong";
  premium: boolean;
  icon: string;
  steps: string[];
  why: string;
};

export type ChallengeOutcome = "helped" | "still-urging";

export type ChallengeHistorySignal = {
  id: string;
  category: RecoveryChallenge["category"];
  outcome: ChallengeOutcome;
  completedAt: string;
};

export type InterventionContextSignal = {
  source: BlockingAttempt["source"];
  category: BlockingAttempt["result"]["category"] | "self-reported";
  surface: "adult-site" | "adult-search" | "search" | "social" | "video" | "forum" | "self-urge" | "unknown";
  matchedRule: string | null;
  sessionDurationBucket: "under-1m" | "1-5m" | "5-15m" | "15-30m" | "30m-plus" | null;
};

export type ChallengePreferenceSignal = {
  challengeIntensity: "gentle" | "balanced" | "strong";
  outdoorFrequency: "low" | "balanced" | "high";
  exercisePreference: "low" | "balanced" | "high";
  socialFrequency: "off" | "low" | "balanced" | "high";
  emergencyStrictMode: boolean;
  sleepModeActive: boolean;
  deepFocusModeActive: boolean;
  weekendModeEnabled: boolean;
  unlockDurationMinutes: number;
  dailyLimitMinutes: number;
};

export type ChallengeContextSignal = {
  energyLevel: "low" | "steady" | "high" | null;
  urgeLevel: number | null;
  sleepQuality: number | null;
  locationPermission: "granted" | "denied" | "undetermined" | "unavailable" | "unknown" | null;
  weatherCondition: "clear" | "cloudy" | "rain" | "snow" | "storm" | "hot" | "cold" | "unknown" | null;
  temperatureC: number | null;
};

export type UrgeRiskForecastSignal = {
  level: "low" | "elevated" | "high";
  score: number;
  confidence: "low" | "medium" | "high";
  currentWindow: string | null;
  drivers: string[];
};

export type CoachPatternSignal = {
  slipsThisWeek?: number | null;
  slipWindow?: string | null;
  slipTrigger?: string | null;
};

export type RecoveryProfile = {
  streakDays: number;
  mood: "low" | "steady" | "energized" | "stressed";
  premium: boolean;
  attemptsToday: number;
  hour: number;
  slipsThisWeek?: number;
  slipWindow?: string | null;
  slipTrigger?: string | null;
  dayOfWeek?: number | null;
  timezoneOffsetMinutes?: number | null;
  interventionContext?: InterventionContextSignal | null;
  disciplinePreferences?: ChallengePreferenceSignal | null;
  contextSignals?: ChallengeContextSignal | null;
  riskForecast?: UrgeRiskForecastSignal | null;
  challengeHistory?: ChallengeHistorySignal[];
  recentFailureCount?: number | null;
  preferredCategories?: RecoveryChallenge["category"][];
  customChallenges?: RecoveryChallenge[];
};

export const challengeLibrary: RecoveryChallenge[] = [
  {
    id: "pushups-20",
    title: "20 controlled pushups",
    category: "physical",
    durationSec: 90,
    intensity: "strong",
    premium: false,
    icon: "Dumbbell",
    why: "Physical effort quickly changes state and burns off restless energy.",
    steps: ["Plant your hands.", "Lower slowly.", "Exhale as you push.", "Stop at twenty honest reps."]
  },
  {
    id: "breathing-478",
    title: "4-7-8 breathing reset",
    category: "breathing",
    durationSec: 180,
    intensity: "calm",
    premium: false,
    icon: "Waves",
    why: "Slow breathing lowers arousal and gives the urge time to pass.",
    steps: ["Inhale for four.", "Hold for seven.", "Exhale for eight.", "Repeat three cycles."]
  },
  {
    id: "walk-outside",
    title: "Walk outside for five minutes",
    category: "reset",
    durationSec: 300,
    intensity: "medium",
    premium: false,
    icon: "Footprints",
    why: "Changing environment breaks the cue loop before it becomes automatic.",
    steps: ["Put the phone down.", "Step outside.", "Notice five things around you.", "Come back after five minutes."]
  },
  {
    id: "reasons-journal",
    title: "Write three reasons",
    category: "reflection",
    durationSec: 120,
    intensity: "calm",
    premium: false,
    icon: "NotebookPen",
    why: "Identity reminders reconnect the present urge to the person you are becoming.",
    steps: ["Open a note.", "Write why you started.", "Write who benefits.", "Read it out loud."]
  },
  {
    id: "cold-water",
    title: "Cold water face reset",
    category: "physical",
    durationSec: 45,
    intensity: "strong",
    premium: true,
    icon: "Snowflake",
    why: "A sharp temperature shift interrupts autopilot and restores control.",
    steps: ["Run cold water.", "Take one slow breath.", "Splash your face.", "Stand tall for ten seconds."]
  },
  {
    id: "accountability-text",
    title: "Message your accountability partner",
    category: "connection",
    durationSec: 90,
    intensity: "medium",
    premium: true,
    icon: "MessageCircleHeart",
    why: "Connection cuts secrecy, which is often where relapse gets stronger.",
    steps: ["Pick your trusted person.", "Send: I need a reset.", "Wait before doing anything else.", "Return to FREED."]
  },
  {
    id: "urge-surf",
    title: "Name the urge, then surf it",
    category: "breathing",
    durationSec: 180,
    intensity: "calm",
    premium: true,
    icon: "Activity",
    why: "Observing the craving without obeying it weakens the automatic response.",
    steps: ["Say: this is an urge.", "Find where it sits in your body.", "Breathe into that spot.", "Watch it rise and fall."]
  }
];

function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function appSurfaceFromPackage(packageName: string): InterventionContextSignal["surface"] {
  const normalized = packageName.toLowerCase();
  const configuredSurface = surfaceForDoomscrollAppPackage(normalized);
  if (configuredSurface) return configuredSurface;
  if (normalized === "com.facebook.katana") return "social";
  return "unknown";
}

function surfaceFromAttempt(attempt: BlockingAttempt): InterventionContextSignal["surface"] {
  if (attempt.source === "app" || attempt.result.matchedRule.startsWith("configured-app:")) {
    return appSurfaceFromPackage(attempt.result.matchedRule.replace(/^configured-app:/, ""));
  }

  if (attempt.source === "panic-button" || attempt.result.matchedRule === "self-reported-urge") return "self-urge";
  if (attempt.result.category === "adult-search-intent") return "adult-search";
  if (attempt.result.category === "adult") return "adult-site";

  const host = attempt.host.toLowerCase();
  if (["instagram.com", "x.com", "twitter.com", "facebook.com"].some((domain) => hostMatches(host, domain))) return "social";
  if (["youtube.com", "youtu.be", "tiktok.com"].some((domain) => hostMatches(host, domain))) return "video";
  if (["reddit.com"].some((domain) => hostMatches(host, domain))) return "forum";
  if (/^(google|bing|duckduckgo|yahoo|brave|ecosia|startpage|qwant|yandex|baidu)\./.test(host)) return "search";
  return "unknown";
}

export function buildInterventionContextFromAttempt(attempt: BlockingAttempt | null | undefined): InterventionContextSignal | null {
  if (!attempt || attempt.result.verdict !== "block") return null;

  return {
    source: attempt.source,
    category: attempt.result.matchedRule === "self-reported-urge" ? "self-reported" : attempt.result.category,
    surface: surfaceFromAttempt(attempt),
    matchedRule: attempt.result.matchedRule || null,
    sessionDurationBucket: sessionDurationBucket(attempt.sessionDurationSec)
  };
}

function sessionDurationBucket(value: number | null | undefined): InterventionContextSignal["sessionDurationBucket"] {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return "under-1m";
  if (value < 5 * 60) return "1-5m";
  if (value < 15 * 60) return "5-15m";
  if (value < 30 * 60) return "15-30m";
  return "30m-plus";
}

export function inferPreferredChallengeCategories(answers: string[]): RecoveryChallenge["category"][] {
  const categories = new Set<RecoveryChallenge["category"]>();
  const normalized = answers.map((answer) => answer.toLowerCase());

  if (normalized.some((answer) => answer.includes("exercise"))) categories.add("physical");
  if (normalized.some((answer) => answer.includes("breathing"))) categories.add("breathing");
  if (normalized.some((answer) => answer.includes("journal"))) categories.add("reflection");
  if (normalized.some((answer) => answer.includes("talking") || answer.includes("someone"))) categories.add("connection");
  if (normalized.some((answer) => answer.includes("boredom") || answer.includes("social media"))) categories.add("reset");

  return [...categories];
}

function inferChallengeContexts(challenge: RecoveryChallenge): TemplateContext[] {
  const text = `${challenge.title} ${challenge.why} ${challenge.steps.join(" ")}`.toLowerCase();
  const contexts = new Set<TemplateContext>();
  if (challenge.intensity === "strong" || /\b(urge|crav|relapse|slip|trigger|emergency|cold|pushup|burpee)\b/.test(text)) {
    contexts.add("high-urge");
  }
  if (/\b(late|night|bed|sleep|evening|wind-down)\b/.test(text)) contexts.add("late-night");
  if (/\b(bored|scroll|idle|social media|loop)\b/.test(text)) contexts.add("bored");
  if (/\b(stress|anxious|anxiety|overwhelm|pressure)\b/.test(text)) contexts.add("stressed");
  if (/\b(lonely|alone|isolation|secrecy|partner|friend|accountability)\b/.test(text)) contexts.add("lonely");
  if (contexts.size === 0) contexts.add("any");
  return [...contexts];
}

function recoveryChallengeFamilies(challenge: RecoveryChallenge): Set<ChallengeEngineFamily> {
  return new Set(
    inferChallengeEngineFamilies({
      category: challenge.category,
      contexts: inferChallengeContexts(challenge),
      durationSec: challenge.durationSec,
      intensity: challenge.intensity,
      title: challenge.title,
      why: challenge.why,
      steps: challenge.steps
    })
  );
}

export function generateChallengeSet(profile: RecoveryProfile) {
  // First, try the 1000+ curated template library. It's deterministic, fast,
  // and free — covers ~95% of cases without any AI cost.
  const helpedHistory = (profile.challengeHistory ?? []).filter((h) => h.outcome === "helped");
  const stillUrgingHistory = (profile.challengeHistory ?? []).filter((h) => h.outcome === "still-urging");
  const recentHistory = (profile.challengeHistory ?? [])
    .filter((item) => Number.isFinite(Date.parse(item.completedAt)))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, 20);
  const recentFailureCount = Math.max(
    0,
    Math.min(
      10,
      Math.round(
        typeof profile.recentFailureCount === "number" && Number.isFinite(profile.recentFailureCount)
          ? profile.recentFailureCount
          : recentHistory.filter((history) => history.outcome === "still-urging").length
      )
    )
  );
  const preferredCategories = new Set(profile.preferredCategories ?? []);
  const isLate = profile.hour >= 22 || profile.hour <= 5;
  const highRisk = profile.attemptsToday >= 2 || profile.mood === "stressed" || profile.mood === "low";
  const slipsThisWeek = Math.max(0, Math.round(profile.slipsThisWeek ?? 0));
  const slipPattern = `${profile.slipWindow ?? ""} ${profile.slipTrigger ?? ""}`.toLowerCase();
  const hasSlipPattern = slipsThisWeek > 0;
  const lateSlipPattern = hasSlipPattern && /\b(late|night|bed|sleep|evening)\b/.test(slipPattern);
  const stressSlipPattern = hasSlipPattern && /\b(stress|anxious|anxiety|overwhelm|pressure)\b/.test(slipPattern);
  const boredomSlipPattern = hasSlipPattern && /\b(bored|boredom|scroll|scrolling|social|alone|idle|isolation)\b/.test(slipPattern);
  const lonelySlipPattern = hasSlipPattern && /\b(lonely|isolation|isolated|secrecy|alone)\b/.test(slipPattern);
  const interventionContext = profile.interventionContext ?? null;
  const prolongedInterventionSession =
    interventionContext?.sessionDurationBucket === "15-30m" ||
    interventionContext?.sessionDurationBucket === "30m-plus";
  const discipline = profile.disciplinePreferences ?? null;
  const contextSignals = profile.contextSignals ?? null;
  const riskForecast = profile.riskForecast ?? null;
  const isWeekend = profile.dayOfWeek === 0 || profile.dayOfWeek === 6;
  const customPicks = profile.premium
    ? (profile.customChallenges ?? [])
        .filter((challenge) => challenge.premium && challenge.id.startsWith("custom-"))
        .map((challenge) => {
          const families = recoveryChallengeFamilies(challenge);
          let score = 1.4;
          if (preferredCategories.has(challenge.category)) score += 1.2;
          if (profile.attemptsToday >= 2 && challenge.intensity !== "calm") score += 0.8;
          if (profile.mood === "low" && challenge.intensity === "calm") score += 0.6;
          if (profile.mood === "stressed" && (challenge.category === "breathing" || challenge.category === "physical")) score += 0.7;
          if (riskForecast?.level === "high" && (challenge.category === "physical" || challenge.category === "breathing")) score += 0.9;
          if (riskForecast?.level === "high" && families.has("anti-relapse")) score += 1.1;
          if (riskForecast?.level === "high" && families.has("emergency")) score += 0.9;
          if (isLate && families.has("late-night")) score += 1.1;
          if (discipline?.emergencyStrictMode && (families.has("emergency") || families.has("anti-relapse"))) score += 1.3;
          if (discipline?.sleepModeActive && (families.has("late-night") || families.has("mindfulness"))) score += 0.9;
          if (discipline?.deepFocusModeActive && families.has("productivity")) score += 0.7;
          if (discipline?.outdoorFrequency === "high" && families.has("outdoors")) score += 0.8;
          if (discipline?.outdoorFrequency === "low" && families.has("outdoors")) score -= 0.8;
          if (discipline?.socialFrequency === "off" && families.has("social")) score -= 5;
          if (discipline?.socialFrequency === "high" && families.has("social")) score += 1;
          if (contextSignals?.energyLevel === "low" && (families.has("mindfulness") || families.has("quick-reset"))) score += 0.5;
          if (prolongedInterventionSession && (challenge.category === "physical" || challenge.category === "reset")) score += 0.55;
          if (recentFailureCount >= 2 && (families.has("anti-relapse") || families.has("emergency"))) score += 0.7;
          if (recentFailureCount >= 2 && recentHistory.some((history) => history.category === challenge.category && history.outcome === "helped")) {
            score += 0.4;
          }
          for (const history of recentHistory) {
            if (history.id === challenge.id && history.outcome === "helped") score += 0.9;
            if (history.id === challenge.id && history.outcome === "still-urging") score -= 1.2;
            if (history.category === challenge.category && history.outcome === "helped") score += 0.25;
          }
          if (recentHistory[0]?.id === challenge.id) score -= 0.8;
          return { challenge, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((item) => item.challenge)
    : [];
  const templatePicks = pickChallengeTemplates({
    streakDays: profile.streakDays,
    attemptsToday: profile.attemptsToday,
    hour: profile.hour,
    mood: profile.mood,
    premium: profile.premium,
    preferredCategories: profile.preferredCategories,
    recentChallengeIds: stillUrgingHistory.map((h) => h.id),
    helpedChallengeIds: helpedHistory.map((h) => h.id),
    helpedCategories: helpedHistory.map((h) => h.category),
    dayOfWeek: profile.dayOfWeek,
    interventionContext: profile.interventionContext,
    disciplinePreferences: profile.disciplinePreferences,
    contextSignals: profile.contextSignals,
    riskForecast: profile.riskForecast,
    recentFailureCount,
    slipsThisWeek: profile.slipsThisWeek,
    slipWindow: profile.slipWindow ?? null,
    slipTrigger: profile.slipTrigger ?? null
  }, 3);

  const templateAndCustomPicks = [
    ...customPicks,
    ...templatePicks.filter((challenge) => !customPicks.some((custom) => custom.id === challenge.id))
  ].slice(0, 3);

  if (templateAndCustomPicks.length === 3) return templateAndCustomPicks;

  // Fallback to the original hand-built library if the picker can't find enough.
  const fallbackLibrary = [
    ...customPicks,
    ...challengeLibrary.filter((challenge) => !customPicks.some((custom) => custom.id === challenge.id))
  ];

  return fallbackLibrary
    .filter((challenge) => profile.premium || !challenge.premium)
    .map((challenge) => {
      const families = recoveryChallengeFamilies(challenge);
      let score = 1;
      if (highRisk && challenge.intensity !== "calm") score += 2;
      if (highRisk && families.has("anti-relapse")) score += 1.1;
      if (highRisk && families.has("emergency")) score += 0.9;
      if (riskForecast?.level === "high" && (challenge.category === "physical" || challenge.category === "breathing")) score += 1.6;
      if (riskForecast?.level === "high" && families.has("anti-relapse")) score += 1.1;
      if (riskForecast?.level === "high" && families.has("emergency")) score += 0.9;
      if (riskForecast?.level === "high" && challenge.category === "reset") score += 0.9;
      if (riskForecast?.level === "high" && challenge.intensity === "strong") score += 0.7;
      if (riskForecast?.level === "elevated" && (challenge.category === "reset" || challenge.category === "reflection")) score += 0.7;
      if (riskForecast?.level === "low" && riskForecast.confidence !== "low" && challenge.intensity === "calm") score += 0.35;
      if (isLate && challenge.category === "breathing") score += 2;
      if (isLate && families.has("late-night")) score += 1.1;
      if (profile.streakDays < 7 && challenge.category === "reflection") score += 1;
      if (profile.premium && challenge.premium) score += 1;
      if (preferredCategories.has(challenge.category)) score += 2.4;
      if (slipsThisWeek >= 2 && challenge.category === "reflection") score += 0.7;
      if (lateSlipPattern && challenge.category === "breathing") score += 2;
      if (lateSlipPattern && challenge.category === "reset") score += 0.8;
      if (lateSlipPattern && families.has("late-night")) score += 1;
      if (stressSlipPattern && challenge.category === "breathing") score += 1.8;
      if (stressSlipPattern && challenge.category === "physical" && challenge.intensity !== "strong") score += 0.6;
      if (boredomSlipPattern && challenge.category === "reset") score += 2.4;
      if (boredomSlipPattern && (families.has("productivity") || families.has("quick-reset"))) score += 0.8;
      if (lonelySlipPattern && challenge.category === "connection") score += 2.8;
      if (lonelySlipPattern && families.has("social")) score += 1;
      if (isWeekend && challenge.category === "reset") score += 0.7;
      if (isWeekend && challenge.category === "connection") score += 0.35;
      if (interventionContext?.surface === "self-urge" && challenge.category === "breathing") score += 1.2;
      if (interventionContext?.surface === "self-urge" && challenge.category === "connection") score += 1.1;
      if (interventionContext?.surface === "adult-search" && challenge.category === "reflection") score += 1.2;
      if (interventionContext?.surface === "adult-site" && challenge.category === "physical") score += 1.4;
      if (["social", "video", "forum"].includes(interventionContext?.surface ?? "") && challenge.category === "reset") score += 1.5;
      if (["social", "video", "forum"].includes(interventionContext?.surface ?? "") && challenge.category === "physical") score += 0.8;
      if (prolongedInterventionSession && (challenge.category === "physical" || challenge.category === "reset")) score += 0.8;
      if (prolongedInterventionSession && challenge.intensity === "calm") score -= 0.3;
      if (recentFailureCount >= 2 && (families.has("anti-relapse") || families.has("emergency"))) score += 1.1;
      if (recentFailureCount >= 2 && recentHistory.some((history) => history.category === challenge.category && history.outcome === "helped")) {
        score += 0.55;
      }
      if (discipline?.challengeIntensity === "gentle" && challenge.intensity === "calm") score += 1;
      if (discipline?.challengeIntensity === "gentle" && challenge.intensity === "strong") score -= 1.4;
      if (discipline?.challengeIntensity === "strong" && challenge.intensity === "strong") score += 1.4;
      if (discipline?.emergencyStrictMode && challenge.intensity !== "calm") score += 1.2;
      if (discipline?.emergencyStrictMode && (families.has("emergency") || families.has("anti-relapse"))) score += 1.3;
      if (discipline?.outdoorFrequency === "high" && challenge.category === "reset") score += 1.1;
      if (discipline?.outdoorFrequency === "high" && families.has("outdoors")) score += 0.8;
      if (discipline?.outdoorFrequency === "low" && challenge.category === "reset") score -= 0.5;
      if (discipline?.outdoorFrequency === "low" && families.has("outdoors")) score -= 0.8;
      if (discipline?.exercisePreference === "high" && challenge.category === "physical") score += 1.3;
      if (discipline?.exercisePreference === "low" && challenge.category === "physical") score -= 1.1;
      if (discipline?.socialFrequency === "off" && challenge.category === "connection") score -= 6;
      if (discipline?.socialFrequency === "off" && families.has("social")) score -= 5;
      if (discipline?.socialFrequency === "low" && challenge.category === "connection") score -= 0.8;
      if (discipline?.socialFrequency === "high" && challenge.category === "connection") score += 1.6;
      if (discipline?.socialFrequency === "high" && families.has("social")) score += 1;
      if (discipline?.sleepModeActive && challenge.category === "breathing") score += 1.5;
      if (discipline?.sleepModeActive && (families.has("late-night") || families.has("mindfulness"))) score += 0.9;
      if (discipline?.sleepModeActive && challenge.intensity === "strong") score -= 0.9;
      if (discipline?.deepFocusModeActive && (challenge.category === "reset" || challenge.category === "reflection")) score += 0.8;
      if (discipline?.deepFocusModeActive && families.has("productivity")) score += 0.7;
      if (contextSignals?.energyLevel === "low" && challenge.intensity === "calm") score += 0.9;
      if (contextSignals?.energyLevel === "low" && (families.has("mindfulness") || families.has("quick-reset"))) score += 0.5;
      if (contextSignals?.energyLevel === "low" && challenge.intensity === "strong") score -= 1.1;
      if (contextSignals?.energyLevel === "high" && (challenge.category === "physical" || challenge.category === "reset")) score += 0.8;
      if ((contextSignals?.urgeLevel ?? 0) >= 4 && (challenge.category === "physical" || challenge.category === "breathing")) score += 0.9;
      if ((contextSignals?.urgeLevel ?? 0) >= 4 && families.has("anti-relapse")) score += 0.7;
      if ((contextSignals?.sleepQuality ?? 5) <= 2 && challenge.category === "breathing") score += 0.8;
      if (contextSignals?.locationPermission === "granted" && discipline?.outdoorFrequency === "high" && challenge.category === "reset") score += 0.45;
      if (contextSignals?.locationPermission === "granted" && discipline?.outdoorFrequency === "high" && families.has("outdoors")) score += 0.45;
      if (["rain", "snow", "storm", "hot", "cold"].includes(contextSignals?.weatherCondition ?? "") && challenge.intensity === "calm") score += 0.35;
      for (const history of recentHistory) {
        const sameChallenge = history.id === challenge.id;
        const sameCategory = history.category === challenge.category;
        if (history.outcome === "helped" && sameChallenge) score += 0.8;
        if (history.outcome === "helped" && sameCategory) score += 0.35;
        if (history.outcome === "still-urging" && sameChallenge) score -= 0.9;
        if (history.outcome === "still-urging" && sameCategory) score -= 0.25;
      }
      if (recentHistory[0]?.id === challenge.id) score -= 0.7;
      return { challenge, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.challenge);
}

export function calculateRecoveryScore(streakDays: number, completedChallenges: number, attemptsToday: number) {
  if (streakDays <= 0 && completedChallenges <= 0 && attemptsToday <= 0) return 0;
  const streakScore = Math.min(60, streakDays * 2.8);
  const practiceScore = Math.min(28, completedChallenges * 4);
  const riskAdjustment = Math.min(22, attemptsToday * 7);
  return Math.max(8, Math.round(streakScore + practiceScore + 12 - riskAdjustment));
}

export function isCrisisSupportInput(input: string): boolean {
  const text = input.toLowerCase();
  return [
    "kill myself",
    "suicide",
    "suicidal",
    "self harm",
    "self-harm",
    "hurt myself",
    "end my life",
    "can't stay safe",
    "cannot stay safe",
    "want to die"
  ].some((signal) => text.includes(signal));
}

function cleanCoachPatternSignal(value: string | null | undefined) {
  if (!value || typeof value !== "string") return "";
  return value
    .replace(/https?:\/\/[^\s]+/gi, "private pattern")
    .replace(/\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)(?:\/[^\s]*)?/gi, "private pattern")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export function generateCoachReply(input: string, attempts: BlockingAttempt[], pattern: CoachPatternSignal = {}) {
  const text = input.toLowerCase();
  const latest = attempts[0];
  const slipsThisWeek = Math.max(0, Math.round(pattern.slipsThisWeek ?? 0));
  const slipWindow = cleanCoachPatternSignal(pattern.slipWindow);
  const slipTrigger = cleanCoachPatternSignal(pattern.slipTrigger);

  if (isCrisisSupportInput(input)) {
    return "Your safety matters more than the streak. If you might hurt yourself or cannot stay safe, contact emergency help now. In the U.S., call or text 988 for crisis support; if there is immediate danger, call emergency services or go to the nearest ER. Stay near another person while you get support.";
  }

  if (slipsThisWeek > 0 && (text.includes("relapse") || text.includes("slip") || text.includes("again") || text.includes("pattern"))) {
    const signal = [slipWindow, slipTrigger].filter(Boolean).join(" and ");
    return `A slip is data, not a verdict. The recent pattern points to ${signal || "a repeatable cue"}, so the next move is specific: create distance, do one two-minute reset, and change the environment before making another decision.`;
  }

  if (text.includes("relapse") || text.includes("failed")) {
    return "A slip is data, not a verdict. Take one clean action now: breathe, drink water, and write what happened before the urge. We will adjust the plan from that pattern.";
  }

  if (text.includes("urge") || text.includes("craving") || text.includes("tempted")) {
    return "Good job naming it early. Set a two-minute timer, put both feet on the floor, and do one challenge before deciding anything else. The urge is loud, but it is temporary.";
  }

  if (text.includes("night") || text.includes("sleep")) {
    return "Night urges usually need friction and calm, not motivation. Charge your phone away from bed, start 4-7-8 breathing, and make tomorrow morning easy for yourself.";
  }

  if (latest) {
    return `I saw the recent risk moment around ${latest.host}. FREED protected the streak; now let us protect your mood too. Pick one small reset and come back to the day you wanted.`;
  }

  return "I am with you. Choose the next clean action, not the whole future. One breath, one decision, one minute where you act like the person you are becoming.";
}
