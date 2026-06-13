import {
  countAttemptsForDay,
  generateWeeklyRecoveryReport,
  getDailyCheckInForDay,
  getLocalDateKey,
  isSleepModeActive,
  isWorkHoursModeActive,
  type RecoveryState
} from "@/lib/recovery-state";

export const URGE_RISK_FORECAST_SCHEMA_VERSION = "local-urge-risk-v1";

export type UrgeRiskLevel = "low" | "elevated" | "high";
export type UrgeRiskForecastConfidence = "low" | "medium" | "high";

export type LocalUrgeRiskForecast = {
  schemaVersion: typeof URGE_RISK_FORECAST_SCHEMA_VERSION;
  source: "local-recovery-signals";
  generatedForDateKey: string;
  generatedAtHourBucket: string;
  currentWindow: string | null;
  level: UrgeRiskLevel;
  score: number;
  confidence: UrgeRiskForecastConfidence;
  drivers: string[];
  protectiveFactors: string[];
  recommendedAction: string;
  nextCheckInPrompt: string;
  privacy: {
    localOnly: true;
    aggregateOnly: true;
    excludesPrivateNotes: true;
    excludesBrowsingDetails: true;
    excludesSupportContacts: true;
    usesRawLocation: false;
  };
};

function toDate(day: Date | string) {
  const date = typeof day === "string" ? new Date(day) : day;
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

function inDateRange(value: string, startKey: string, endKey: string) {
  const key = getLocalDateKey(value);
  return key >= startKey && key <= endKey;
}

function hourBucketLabel(value: Date | string) {
  const date = toDate(value);
  const hour = date.getHours();
  if (hour >= 0 && hour < 6) return "Late night";
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  return "Evening";
}

function safeSignalText(value: string | null | undefined, maxLength = 80) {
  if (!value || typeof value !== "string") return null;
  const cleaned = value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(
      /\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn|example|test|invalid|local)(?:\/[^\s]*)?/gi,
      "[redacted-domain]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  if (!cleaned || /^no (clear pattern|slips|protected risk|completions)/i.test(cleaned)) return null;
  return cleaned;
}

function addUnique(list: string[], value: string | null | undefined, max = 6) {
  const cleaned = safeSignalText(value);
  if (!cleaned || list.includes(cleaned) || list.length >= max) return;
  list.push(cleaned);
}

function riskLevelFromScore(score: number): UrgeRiskLevel {
  if (score >= 70) return "high";
  if (score >= 40) return "elevated";
  return "low";
}

function confidenceFromSignals(signalCount: number): UrgeRiskForecastConfidence {
  if (signalCount >= 8) return "high";
  if (signalCount >= 3) return "medium";
  return "low";
}

function recommendationForForecast(options: {
  level: UrgeRiskLevel;
  bestIntervention: string | null;
  sleepModeActive: boolean;
  currentWindow: string | null;
  hasCheckInToday: boolean;
}) {
  const { level, bestIntervention, sleepModeActive, currentWindow, hasCheckInToday } = options;

  if (level === "high") {
    if (bestIntervention) return `Start "${bestIntervention}" now, then keep the next unlock off until the body settles.`;
    if (sleepModeActive) return "Move the phone away from bed and run a calm breathing reset before any unlock.";
    return "Do a body-first reset now: stand up, change rooms, drink water, and breathe before deciding.";
  }

  if (level === "elevated") {
    if (currentWindow) return `Add friction during ${currentWindow.toLowerCase()}: phone away, one short reset, then decide.`;
    return "Start with a two-minute reset before the urge has room to build.";
  }

  if (!hasCheckInToday) return "Log a 20-second check-in so FREED can keep the forecast honest.";
  return "Keep the current boundary and repeat the smallest reset that has already worked.";
}

export function buildLocalUrgeRiskForecast(state: RecoveryState, day: Date | string = new Date()): LocalUrgeRiskForecast {
  const targetDate = toDate(day);
  const start = new Date(targetDate);
  start.setDate(targetDate.getDate() - 6);
  const startKey = getLocalDateKey(start);
  const endKey = getLocalDateKey(targetDate);
  const report = generateWeeklyRecoveryReport(state, targetDate);
  const todayCheckIn = getDailyCheckInForDay(state, targetDate);
  const attemptsToday = countAttemptsForDay(state.attempts, targetDate);
  const currentBucket = hourBucketLabel(targetDate);
  const drivers: string[] = [];
  const protectiveFactors: string[] = [];
  const recentChallenges = state.challengeHistory.filter((challenge) => inDateRange(challenge.completedAt, startKey, endKey));
  const helpfulChallenges = recentChallenges.filter((challenge) => challenge.outcome === "helped").length;
  const helpRate = percent(helpfulChallenges, recentChallenges.length);
  const sleepModeActive = isSleepModeActive(state.disciplineSettings, targetDate);
  const workHoursActive = isWorkHoursModeActive(state.disciplineSettings, targetDate);
  let score = 18;

  if (todayCheckIn) {
    if (todayCheckIn.urgeLevel >= 4) {
      score += 26;
      addUnique(drivers, "High urge check-in today");
    } else if (todayCheckIn.urgeLevel === 3) {
      score += 12;
      addUnique(drivers, "Moderate urge check-in today");
    } else if (todayCheckIn.urgeLevel <= 1) {
      score -= 8;
      addUnique(protectiveFactors, "Low urge check-in today");
    }

    if (todayCheckIn.sleepQuality <= 2) {
      score += 16;
      addUnique(drivers, "Low sleep reported today");
    } else if (todayCheckIn.sleepQuality >= 4) {
      score -= 6;
      addUnique(protectiveFactors, "Solid sleep reported today");
    }

    if (todayCheckIn.mood === "stressed" || todayCheckIn.mood === "low") {
      score += 10;
      addUnique(drivers, "Mood check-in needs extra support");
    } else {
      score -= 5;
      addUnique(protectiveFactors, "Mood check-in is steady");
    }
  } else {
    score += 6;
    addUnique(drivers, "No check-in signal yet today");
  }

  if (attemptsToday > 0) {
    score += Math.min(34, 16 + (attemptsToday - 1) * 8);
    addUnique(drivers, `${attemptsToday} protected risk ${attemptsToday === 1 ? "moment" : "moments"} today`);
  }

  if (report.attempts >= 3) {
    score += 14;
    addUnique(drivers, "Weekly risk moments are clustered");
  } else if (report.attempts > 0) {
    score += 6;
    addUnique(drivers, "Recent risk moments logged");
  }

  if (report.slips > 0) {
    score += Math.min(30, 18 + (report.slips - 1) * 6);
    addUnique(drivers, "Recent honest reset log");
  }

  let currentWindow: string | null = null;
  if (report.slips > 0 && report.slipWindow === currentBucket) {
    score += 14;
    currentWindow = `${currentBucket} slip window`;
    addUnique(drivers, "Current time matches recent slip window");
  } else if (report.attempts > 0 && report.riskWindow === currentBucket) {
    score += 12;
    currentWindow = `${currentBucket} risk window`;
    addUnique(drivers, "Current time matches learned risk window");
  } else if (sleepModeActive) {
    score += 8;
    currentWindow = "Sleep mode window";
    addUnique(drivers, "Sleep mode window is active");
  } else if (workHoursActive || state.disciplineSettings.deepFocusModeEnabled) {
    currentWindow = "Focus protection window";
  }

  if (report.momentum === "Risk rising") {
    score += 12;
    addUnique(drivers, "Weekly risk momentum is rising");
  } else if (report.momentum === "Risk easing") {
    score -= 8;
    addUnique(protectiveFactors, "Weekly risk momentum is easing");
  }

  if (recentChallenges.length > 0 && helpRate >= 70) {
    score -= 10;
    addUnique(protectiveFactors, "Recent resets are helping");
  } else if (recentChallenges.length >= 2) {
    score -= 5;
    addUnique(protectiveFactors, "Recent resets were completed");
  } else if (report.attempts > 0 && recentChallenges.length === 0) {
    score += 6;
    addUnique(drivers, "Risk moments need a completed reset");
  }

  if (report.steadyDays >= 4) {
    score -= 8;
    addUnique(protectiveFactors, "Steady days are building");
  }

  if (state.disciplineSettings.emergencyStrictMode) {
    score -= 10;
    addUnique(protectiveFactors, "Emergency strict mode is active");
  }

  if (state.disciplineSettings.deepFocusModeEnabled || workHoursActive) {
    score -= 5;
    addUnique(protectiveFactors, "Focus protection is active");
  }

  if (state.disciplineSettings.blockedAppPackages.length > 0) {
    score -= 4;
    addUnique(protectiveFactors, "Configured app shields are active");
  }

  if (state.streakDays >= 7) {
    score -= 4;
    addUnique(protectiveFactors, "Recovery streak has momentum");
  }

  const signalCount =
    report.checkIns +
    Math.min(5, report.attempts) +
    Math.min(3, report.slips) +
    Math.min(5, report.completedChallenges);
  const safeScore = clampScore(score);
  const level = riskLevelFromScore(safeScore);
  const bestIntervention = safeSignalText(report.bestIntervention === "More completions needed" ? null : report.bestIntervention, 64);
  const confidence = confidenceFromSignals(signalCount);

  return {
    schemaVersion: URGE_RISK_FORECAST_SCHEMA_VERSION,
    source: "local-recovery-signals",
    generatedForDateKey: endKey,
    generatedAtHourBucket: currentBucket,
    currentWindow,
    level,
    score: safeScore,
    confidence,
    drivers: drivers.length > 0 ? drivers : ["No elevated local risk signal"],
    protectiveFactors: protectiveFactors.length > 0 ? protectiveFactors : ["Keep building recovery signal"],
    recommendedAction: recommendationForForecast({
      level,
      bestIntervention,
      sleepModeActive,
      currentWindow,
      hasCheckInToday: Boolean(todayCheckIn)
    }),
    nextCheckInPrompt:
      todayCheckIn?.urgeLevel && todayCheckIn.urgeLevel >= 4
        ? "What would lower stimulation in the next ten minutes?"
        : "What is the smallest boundary that protects the next hour?",
    privacy: {
      localOnly: true,
      aggregateOnly: true,
      excludesPrivateNotes: true,
      excludesBrowsingDetails: true,
      excludesSupportContacts: true,
      usesRawLocation: false
    }
  };
}
