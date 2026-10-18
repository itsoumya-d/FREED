import type { BlockingAttempt, ClassificationResult } from "./blocking-engine";
import { sanitizeFocusShieldInterventionScope } from "./focus-shield";
import type { FocusShieldInterventionScope } from "./focus-shield";
import type { EarnedUnlock } from "./recovery-state";
import { canonicalInstalledAppPackage, sanitizeAppGroupInterventionScope, type AppGroupInterventionScope } from './app-group-intervention';
import {
  INSTAGRAM_REELS_RULE,
  SHORT_FORM_RULE_HOSTS,
  SUPPORTED_DOOMSCROLL_APP_PACKAGES,
  TIKTOK_FEED_RULE,
  YOUTUBE_SHORTS_RULE,
  hostForShortFormRule,
  normalizeDoomscrollAppPackage,
  packageForShortFormRule
} from "./doomscroll-apps";

export type NativePendingInterventionPayload = {
  interventionId: string;
  url: string;
  host: string;
  sourcePackage: string;
  reason: string;
  matchedRule: string;
  detectedAt: string;
  sessionDurationSec?: number;
  scope?: FocusShieldInterventionScope | AppGroupInterventionScope;
};

export type NativeInterventionAttempt = BlockingAttempt & {
  nativeInterventionId?: string;
  scope?: FocusShieldInterventionScope | AppGroupInterventionScope;
};

export const PENDING_INTERVENTION_MAX_AGE_MS = 10 * 60 * 1000;
export const SUPPORTED_NATIVE_INTERVENTION_APP_PACKAGES = SUPPORTED_DOOMSCROLL_APP_PACKAGES;

export function sanitizeNativeInterventionId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

const supportedNativeAppPackageSet = new Set<string>(SUPPORTED_NATIVE_INTERVENTION_APP_PACKAGES);
const APP_INTERVENTION_FALLBACK_HOST = "selected-app.app.freed.local";
const IOS_SCREEN_TIME_SHIELD_HOST = "screen-time-shield.freed.local";
const IOS_SAFARI_SHORT_FORM_SOURCE = "ios-safari-short-form";
const IOS_SAFARI_INTERVENTION_HTTPS_ROUTE = "https://freed-7d5ee.firebaseapp.com/intervention";
const SAFARI_SHORT_FORM_WEB_HOSTS: Record<string, string> = {
  [YOUTUBE_SHORTS_RULE]: "youtube.com",
  [INSTAGRAM_REELS_RULE]: "instagram.com",
  [TIKTOK_FEED_RULE]: "tiktok.com"
};

export function isFreshPendingIntervention(
  pending: NativePendingInterventionPayload,
  nowMs = Date.now()
): boolean {
  if (!sanitizeNativeInterventionId(pending.interventionId)) return false;
  const detectedMs = Date.parse(pending.detectedAt);
  if (Number.isNaN(detectedMs)) return false;
  return detectedMs <= nowMs + 60_000 && nowMs - detectedMs <= PENDING_INTERVENTION_MAX_AGE_MS;
}

export function createNativeInterventionAttempt(pending: NativePendingInterventionPayload): NativeInterventionAttempt {
  const detectedAt = Number.isNaN(Date.parse(pending.detectedAt)) ? new Date().toISOString() : pending.detectedAt;
  const matchedRule = normalizeMatchedRule(pending.matchedRule);
  const source = isNativeAppRule(matchedRule) ? "app" : "browser";
  const sourcePackage = source === "app" ? normalizeSourcePackage(pending.sourcePackage, matchedRule) : undefined;
  const host =
    source === "app"
      ? normalizeAppPendingHost(pending, matchedRule, sourcePackage)
      : normalizePendingHost(pending) || "screen-time-shield.freed.local";
  const scope = sanitizeNativePendingScope(pending.scope, matchedRule, sourcePackage, host);
  const interventionId = source === "app" && !matchedRule.startsWith("ios-screen-time-shield") && !sourcePackage
    ? null : sanitizeNativeInterventionId(pending.interventionId);

  return {
    url: `https://${host}`,
    host,
    detectedAt,
    source,
    sourcePackage,
    sessionDurationSec: source === "app" ? sanitizeSessionDurationSeconds(pending.sessionDurationSec) : undefined,
    ...(interventionId ? { nativeInterventionId: interventionId } : {}),
    ...(scope ? { scope } : {}),
    result: {
      verdict: "block",
      confidence: 0.98,
      host,
      category: inferNativeCategory(matchedRule),
      reason: normalizePendingReason(pending.reason),
      matchedRule: matchedRule || "native-protection"
    }
  };
}

function sanitizeNativePendingScope(
  value: unknown,
  matchedRule: string,
  sourcePackage: string | undefined,
  host: string
): FocusShieldInterventionScope | AppGroupInterventionScope | null {
  const group = sanitizeAppGroupInterventionScope(value);
  if (group) return matchedRule === `app-group:${group.groupId}:${group.groupRevision}` &&
    (group.kind === 'android-app-group' ? group.packageName === sourcePackage : sourcePackage === 'ios-screen-time' && host === IOS_SCREEN_TIME_SHIELD_HOST) ? group : null;
  const scope = sanitizeFocusShieldInterventionScope(value);
  if (!scope) return null;
  switch (scope.kind) {
    case "android-surface":
      return matchedRule === `focus-shield:${scope.ruleId}` && sourcePackage === scope.packageName ? scope : null;
    case "android-package":
      return (matchedRule.startsWith("configured-app:") || matchedRule.startsWith("short-form:")) &&
        sourcePackage === scope.packageName ? scope : null;
    case "ios-token":
      return null; // Historical token-bearing data is readable elsewhere, never a new public native envelope.
    case 'ios-screen-time':
      return matchedRule.startsWith('ios-screen-time-shield') && sourcePackage === 'ios-screen-time' && host === IOS_SCREEN_TIME_SHIELD_HOST ? scope : null;
    case "browser-domain":
      return !isNativeAppRule(matchedRule) && host === scope.domain ? scope : null;
    case 'ios-app-group':
    case 'android-app-group':
      return null;
  }
}

export function createDeepLinkInterventionAttempt(deepLinkUrl: string, detectedAt = new Date().toISOString()): BlockingAttempt | null {
  const params = parseInterventionParams(deepLinkUrl);
  if (!params) return null;
  const source = params.get("source")?.trim().toLowerCase() ?? "";
  if (source !== IOS_SAFARI_SHORT_FORM_SOURCE) return null;

  const matchedRule = normalizeMatchedRule(params.get("rule") ?? params.get("matchedRule") ?? "");
  const expectedHost = SAFARI_SHORT_FORM_WEB_HOSTS[matchedRule];
  if (!expectedHost) return null;

  const sourceHost =
    normalizeHostValue(params.get("host") ?? "") ||
    hostFromUrlParam(params.get("url")) ||
    expectedHost;
  if (!hostMatchesDomain(sourceHost, expectedHost)) return null;

  return {
    url: `https://${sourceHost}`,
    host: sourceHost,
    detectedAt,
    source: "browser",
    result: {
      verdict: "block",
      confidence: 0.98,
      host: sourceHost,
      category: "unknown",
      reason: "Safari web short-form path requested a FREED recovery challenge.",
      matchedRule: `${IOS_SAFARI_SHORT_FORM_SOURCE}:${matchedRule}`
    }
  };
}

export function unlockSourceForAttempt(attempt: BlockingAttempt | null | undefined): string | undefined {
  if (attempt?.scope?.kind === 'ios-screen-time' || attempt?.scope?.kind === 'ios-app-group') return IOS_SCREEN_TIME_SHIELD_HOST;
  if (attempt?.source === "app" && !attempt.result.matchedRule.startsWith("ios-screen-time-shield") && !attempt.sourcePackage) return undefined;
  return attempt?.sourcePackage ?? attempt?.host;
}

export function appPackageForEarnedUnlockSource(sourceAttemptHost: string | null | undefined): string | undefined {
  const rawSource = sourceAttemptHost?.trim().toLowerCase() ?? "";
  if (!rawSource) return undefined;

  const rulePackage = packageForShortFormRule(rawSource);
  if (rulePackage) return rulePackage;

  const withoutPrefix = rawSource
    .replace(/^configured-app:/, "")
    .replace(/^short-form:/, "");
  const directPackage = normalizeSourcePackageCandidate(withoutPrefix);
  if (directPackage) return directPackage;

  const normalizedHost = normalizeHostValue(withoutPrefix);
  if (!normalizedHost) return undefined;

  const hostPackage = normalizeSourcePackageCandidate(normalizedHost);
  if (hostPackage) return hostPackage;

  const shortFormHostRule = Object.entries(SHORT_FORM_RULE_HOSTS).find(([, host]) => host === normalizedHost)?.[0];
  const shortFormHostPackage = shortFormHostRule ? packageForShortFormRule(shortFormHostRule) : null;
  if (shortFormHostPackage) return shortFormHostPackage;

  if (normalizedHost.endsWith(".app.freed.local")) {
    return normalizeSourcePackageCandidate(normalizedHost.replace(/\.app\.freed\.local$/, ""));
  }

  return undefined;
}

export function getActiveNativeEarnedUnlock(
  earnedUnlocks: readonly EarnedUnlock[],
  platform: "ios" | "android" | string,
  at: Date | string = new Date()
): EarnedUnlock | null {
  const atMs = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (!Number.isFinite(atMs)) return null;

  return (
    earnedUnlocks
      .filter((unlock) => {
        const startedMs = Date.parse(unlock.startedAt);
        const expiresMs = Date.parse(unlock.expiresAt);
        return (
          Number.isFinite(startedMs) &&
          Number.isFinite(expiresMs) &&
          startedMs <= atMs &&
          expiresMs > atMs &&
          earnedUnlockCanPauseNativeShields(unlock, platform)
        );
      })
      .sort((a, b) => Date.parse(b.expiresAt) - Date.parse(a.expiresAt))[0] ?? null
  );
}

function earnedUnlockCanPauseNativeShields(unlock: EarnedUnlock, platform: string): boolean {
  if (platform === "android") return Boolean(appPackageForEarnedUnlockSource(unlock.sourceAttemptHost));
  if (platform === "ios") return isIosScreenTimeShieldSource(unlock.sourceAttemptHost);
  return false;
}

export function isIosScreenTimeShieldSource(sourceAttemptHost: string | null | undefined): boolean {
  const rawSource = sourceAttemptHost?.trim().toLowerCase() ?? "";
  if (!rawSource) return false;
  if (rawSource === "ios-screen-time") return true;
  return normalizeHostValue(rawSource) === IOS_SCREEN_TIME_SHIELD_HOST;
}

function inferNativeCategory(matchedRule: string): ClassificationResult["category"] {
  if (matchedRule.startsWith('app-group:')) return 'unknown';
  if (matchedRule.startsWith("safe-site-search:")) return "adult-search-intent";
  if (matchedRule.startsWith("configured-app:")) return "unknown";
  if (matchedRule.startsWith("short-form:")) return "unknown";
  if (matchedRule.startsWith("focus-shield:")) return "unknown";
  if (matchedRule.startsWith("ios-screen-time-shield")) return "unknown";
  return "adult";
}

function normalizeMatchedRule(matchedRule: string): string {
  if (matchedRule.trim().toLowerCase().startsWith('app-group:')) {
    const raw = matchedRule.trim().toLowerCase(); return /^app-group:(?:[0-9a-f-]{36}|legacy-default):[1-9][0-9]{0,15}$/.test(raw) ? raw : 'app-group:unsupported';
  }
  const raw = matchedRule.trim().toLowerCase();
  if (raw.startsWith("configured-app:")) {
    const packageName = normalizeSourcePackageCandidate(raw.slice("configured-app:".length));
    return packageName ? `configured-app:${packageName}` : "configured-app:unsupported";
  }
  if (raw.startsWith("short-form:")) return packageForShortFormRule(raw) ? raw : "short-form:unknown";
  const focusShieldMatch = matchedRule.trim().match(/^focus-shield:(.+)$/i);
  if (focusShieldMatch) {
    const ruleId = focusShieldMatch[1]?.trim();
    return ruleId && /^[a-zA-Z0-9_.-]{6,128}$/.test(ruleId) ? `focus-shield:${ruleId}` : "focus-shield:unsupported";
  }

  const normalized = matchedRule
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._ -]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 140);

  if (normalized.startsWith("configured-app:")) {
    return "configured-app:unsupported";
  }

  if (normalized.startsWith("short-form:")) {
    return "short-form:unknown";
  }

  return normalized;
}

function normalizePendingReason(reason: string): string {
  const normalized = reason
    .trim()
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b[a-z0-9_]+(?:\.[a-z0-9_]+){1,}\b/gi, "[redacted-domain]")
    .slice(0, 180);

  return normalized || "Native protection requested a recovery intervention.";
}

function sanitizeSessionDurationSeconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const seconds = Math.round(value);
  if (seconds <= 0) return undefined;
  return Math.min(seconds, 4 * 60 * 60);
}

function isNativeAppRule(matchedRule: string): boolean {
  return (
    matchedRule.startsWith('app-group:') ||
    matchedRule.startsWith("configured-app:") ||
    matchedRule.startsWith("short-form:") ||
    matchedRule.startsWith("focus-shield:") ||
    matchedRule.startsWith("ios-screen-time-shield")
  );
}

function normalizePendingHost(pending: NativePendingInterventionPayload): string {
  const directHost = normalizeHostValue(pending.host);
  if (directHost) return directHost;

  try {
    return normalizeHostValue(new URL(pending.url).hostname);
  } catch {
    return normalizeHostValue(
      pending.url
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .split("?")[0]
        .split("#")[0]
    );
  }
}

function normalizeHostValue(host: string): string {
  const hostOnly = host.trim().toLowerCase().split("@").pop() ?? host;
  const withoutPort = !hostOnly.startsWith("[") && hostOnly.includes(":") ? hostOnly.split(":")[0] ?? hostOnly : hostOnly;
  const normalized = withoutPort
    .trim()
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);

  if (!normalized.includes(".")) return "";
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(normalized)) return "";
  if (normalized.split(".").some((part) => !part || part.startsWith("-") || part.endsWith("-"))) return "";
  return normalized;
}

function parseInterventionParams(value: string): URLSearchParams | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "freed:") {
      const route = parsed.hostname || parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
      return route === "intervention" ? parsed.searchParams : null;
    }

    // The fragment never enters the hosting request. Keep this HTTPS route exact
    // rather than accepting URL-normalized credentials, paths, or query hints.
    const route = value.split("#")[0];
    if (route !== IOS_SAFARI_INTERVENTION_HTTPS_ROUTE &&
        route !== IOS_SAFARI_INTERVENTION_HTTPS_ROUTE.replace(".com/", ".com:443/")) return null;
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || parsed.search) return null;

    const params = new URLSearchParams(parsed.hash.slice(1));
    const allowedKeys = ["source", "rule", "host"];
    if ([...params.keys()].some(key => !allowedKeys.includes(key))) return null;
    if (allowedKeys.some(key => params.getAll(key).length !== 1)) return null;

    const host = params.get("host") ?? "";
    if (host.length > 120 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) ||
        host.split(".").some(part => !part || part.startsWith("-") || part.endsWith("-")) ||
        !normalizeHostValue(host)) return null;
    return params;
  } catch {
    return null;
  }
}

function hostFromUrlParam(value: string | null): string {
  if (!value) return "";
  try {
    return normalizeHostValue(new URL(value).hostname);
  } catch {
    return normalizeHostValue(value);
  }
}

function hostMatchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function normalizeAppPendingHost(
  pending: NativePendingInterventionPayload,
  matchedRule: string,
  sourcePackage: string | undefined
): string {
  if (matchedRule.startsWith('app-group:') && sourcePackage === 'ios-screen-time') return IOS_SCREEN_TIME_SHIELD_HOST;
  if (matchedRule.startsWith("ios-screen-time-shield")) return IOS_SCREEN_TIME_SHIELD_HOST;

  const shortFormHost = hostForShortFormRule(matchedRule);
  if (shortFormHost) return shortFormHost;

  if (sourcePackage) return `${sourcePackage}.app.freed.local`;

  const host = normalizePendingHost(pending);
  return host && isSupportedAppHandoffHost(host) ? host : APP_INTERVENTION_FALLBACK_HOST;
}

function isSupportedAppHandoffHost(host: string): boolean {
  if (host === APP_INTERVENTION_FALLBACK_HOST) return true;
  if (Object.values(SHORT_FORM_RULE_HOSTS).includes(host)) return true;
  if (!host.endsWith(".app.freed.local")) return false;
  return supportedNativeAppPackageSet.has(host.replace(/\.app\.freed\.local$/, ""));
}

function normalizeSourcePackage(packageName: string, matchedRule: string): string | undefined {
  if (matchedRule.startsWith('ios-screen-time-shield')) return packageName === 'ios-screen-time' ? packageName : undefined;
  if (matchedRule.startsWith('app-group:') && matchedRule !== 'app-group:unsupported') return packageName === 'ios-screen-time' ? packageName : canonicalInstalledAppPackage(packageName) ?? undefined;
  const actual = normalizeSourcePackageCandidate(packageName);
  if (!actual) return undefined;
  if (matchedRule.startsWith("configured-app:")) {
    return matchedRule.slice("configured-app:".length) === actual ? actual : undefined;
  }
  if (matchedRule.startsWith("short-form:")) {
    return normalizeDoomscrollAppPackage(actual) === packageForShortFormRule(matchedRule) ? actual : undefined;
  }
  return matchedRule.startsWith("focus-shield:") && matchedRule !== "focus-shield:unsupported" ? actual : undefined;
}

function normalizeSourcePackageCandidate(packageName: string): string | undefined {
  const normalized = packageName
    .trim()
    .toLowerCase();

  return supportedNativeAppPackageSet.has(normalized) ? normalized : undefined;
}
