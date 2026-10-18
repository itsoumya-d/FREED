import { hydrateRecoveryState, type RecoveryState, type RecoveryAttemptSourceCounts } from './recovery-state';

export function redactRecoverySignalText(value: unknown, maxLength = 180): string | null {
  if (typeof value !== "string") return null;
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

export function coarseRecoveryTriggerLabel(value: unknown): string | null {
  const cleaned = redactRecoverySignalText(value, 96);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  if (/\b(stress|stressed|anxious|anxiety|overwhelm|pressure|deadline|work|school|exam)\b/.test(lower)) {
    return "Stress pattern";
  }

  if (/\b(bed|bedroom|night|late|sleep|tired|exhausted|after dark)\b/.test(lower)) {
    return "Night or low-sleep pattern";
  }

  if (/\b(phone|scroll|scrolling|doomscroll|social|instagram|tiktok|reddit|youtube|shorts|twitter|x\/twitter)\b/.test(lower)) {
    return "Scrolling trigger pattern";
  }

  if (/\b(bored|idle|alone|lonely|isolation|nothing to do)\b/.test(lower)) {
    return "Boredom or isolation pattern";
  }

  if (/\b(argument|fight|partner|friend|family|rejection|message|relationship)\b/.test(lower)) {
    return "Connection stress pattern";
  }

  if (/\b(urge|craving|relapse|slip|porn|adult|nsfw|explicit)\b/.test(lower)) {
    return "Urge pattern";
  }

  return "Logged trigger pattern";
}

/** Framework provenance is metadata, never inferred from a person's private notes. */
export function isFamilyControlsDerivedSignal(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const scope = item.scope && typeof item.scope === "object" ? item.scope as Record<string, unknown> : null;
  const result = item.result && typeof item.result === "object" ? item.result as Record<string, unknown> : null;
  if (['ios-token','ios-screen-time','ios-app-group'].includes(String(item.kind)) || ['ios-token','ios-screen-time','ios-app-group'].includes(String(scope?.kind))) return true;
  const provenance = [item.sourcePackage, item.source, item.matchedRule, result?.matchedRule, item.ruleFamily];
  const hosts = [item.host, result?.host, item.sourceAttemptHost];
  return provenance.some(value => typeof value === "string" && /^(ios-screen-time|screen-time-shield|family-controls|device-activity)/i.test(value))
    || hosts.some(value => typeof value === "string" && /^(screen-time-shield|ios-screen-time)\./i.test(value));
}

function ownAttemptCounts(counts: RecoveryAttemptSourceCounts): RecoveryAttemptSourceCounts {
  const own: RecoveryAttemptSourceCounts = {};
  for (const key of ["panic-button", "manual-check"] as const) if (counts[key]) own[key] = counts[key];
  return own;
}

/**
 * One conservative outbound dataset. Automatic device interceptions, ambiguous
 * legacy app archives and native management windows stay on-device. User input,
 * verified recovery actions and FREED's own app sessions remain portable.
 * This function does not write, mutate local state, or change enforcement.
 */
export function projectRecoveryStateForOffDevice(value: unknown): RecoveryState {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const attempts = Array.isArray(raw.attempts) ? raw.attempts.filter(attempt => {
    if (isFamilyControlsDerivedSignal(attempt) || !attempt || typeof attempt !== "object") return false;
    const source = (attempt as Record<string, unknown>).source;
    return source === "panic-button" || source === "manual-check";
  }) : [];
  const state = hydrateRecoveryState({ ...raw, attempts });
  const archive = { ...state.activityArchive,
    attemptTotals: ownAttemptCounts(state.activityArchive.attemptTotals),
    attemptMinutes: Object.fromEntries(Object.entries(state.activityArchive.attemptMinutes)
      .map(([minute, counts]) => [minute, ownAttemptCounts(counts)])
      .filter(([, counts]) => Object.keys(counts).length > 0)),
    unlockMinutes: {}, unlockTotals: { count: 0, seconds: 0 }
  };
  const challengeHistory = state.challengeHistory.map(({ sourceAttemptHost: _deviceLink, ...completion }) => completion);
  const dates = [...challengeHistory.map(completion => completion.completedAt), ...state.attempts.filter(attempt => attempt.source === "panic-button").map(attempt => attempt.detectedAt)]
    .filter(date => Number.isFinite(Date.parse(date))).sort((a, b) => Date.parse(b) - Date.parse(a));
  return hydrateRecoveryState({ ...state, activityArchive: archive, challengeHistory, earnedUnlocks: [],
    lastProtectedAt: dates[0] ?? null,
    // Old AI replies have no provenance marker and may summarize local device
    // events. Preserve authored input; keep these ambiguous replies local.
    coachMessages: state.coachMessages.filter(message => message.role === "user"),
    blockedDomainFeedback: state.blockedDomainFeedback.filter(item => !isFamilyControlsDerivedSignal(item))
  });
}

/** Coarse automatic interception context is still device data, even without a token. */
export function offDeviceInterventionContext<T extends { source?: string }>(context: T | null | undefined): T | null {
  if (!context || isFamilyControlsDerivedSignal(context) || context.source === "app" || context.source === "browser" || context.source === "search") return null;
  return context;
}
