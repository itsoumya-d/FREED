/**
 * Local-only contract for deterministic, user-configured Focus Shield rules.
 * Selector fingerprints deliberately exclude node text, screenshots, and raw
 * accessibility trees so the data remains safe to persist on-device.
 */
export const FOCUS_SHIELD_CONTRACT_VERSION = 1 as const;

export type FocusShieldPresetId = "youtube-shorts" | "instagram-reels" | "tiktok-for-you";
export type FocusShieldRuleKind = "preset" | "custom";
export type FocusShieldRuleId = string;

export type FocusShieldNormalizedBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FocusShieldSelectorFingerprint = {
  packageName: string;
  viewId?: string;
  role?: string;
  ancestorRoles?: string[];
  normalizedBounds?: FocusShieldNormalizedBounds;
};

export type FocusShieldPreset = {
  version: typeof FOCUS_SHIELD_CONTRACT_VERSION;
  id: FocusShieldPresetId;
  displayName: string;
  packageName: string;
  selector: FocusShieldSelectorFingerprint;
};

export type FocusShieldRule = {
  version: typeof FOCUS_SHIELD_CONTRACT_VERSION;
  id: FocusShieldRuleId;
  packageName: string;
  displayLabel: string;
  kind: FocusShieldRuleKind;
  presetId?: FocusShieldPresetId;
  enabled: boolean;
  selector: FocusShieldSelectorFingerprint;
};

export type FocusShieldCalibrationState = "idle" | "calibrating" | "ready" | "cancelled" | "unavailable" | "failed";

export type FocusShieldCalibrationRequest = {
  ruleId: FocusShieldRuleId;
  packageName: string;
  displayLabel?: string;
  presetId?: FocusShieldPresetId;
};

export type FocusShieldCalibrationResult = {
  state: FocusShieldCalibrationState;
  rule?: FocusShieldRule;
  message?: string;
};

export type FocusShieldInterventionScope =
  | { kind: "android-surface"; ruleId: FocusShieldRuleId; packageName: string }
  | { kind: "android-package"; packageName: string }
  | { kind: "ios-token"; tokenType: "application" | "category" | "domain"; token: string }
  | { kind: "browser-domain"; domain: string };

export const FOCUS_SHIELD_PRESETS: readonly FocusShieldPreset[] = [
  {
    version: FOCUS_SHIELD_CONTRACT_VERSION,
    id: "youtube-shorts",
    displayName: "YouTube Shorts",
    packageName: "com.google.android.youtube",
    selector: {
      packageName: "com.google.android.youtube",
      viewId: "com.google.android.youtube:id/reel_player",
      role: "android.view.View",
      ancestorRoles: ["android.widget.FrameLayout"]
    }
  },
  {
    version: FOCUS_SHIELD_CONTRACT_VERSION,
    id: "instagram-reels",
    displayName: "Instagram Reels",
    packageName: "com.instagram.android",
    selector: {
      packageName: "com.instagram.android",
      viewId: "com.instagram.android:id/clips_viewer",
      role: "android.view.View",
      ancestorRoles: ["android.widget.FrameLayout"]
    }
  },
  {
    version: FOCUS_SHIELD_CONTRACT_VERSION,
    id: "tiktok-for-you",
    displayName: "TikTok For You",
    packageName: "com.zhiliaoapp.musically",
    selector: {
      packageName: "com.zhiliaoapp.musically",
      viewId: "com.zhiliaoapp.musically:id/pager",
      role: "androidx.viewpager.widget.ViewPager",
      ancestorRoles: ["android.widget.FrameLayout"]
    }
  }
];

export const FOCUS_SHIELD_ALLOWED_VIEW_IDS = {
  "com.google.android.youtube": ["com.google.android.youtube:id/reel_player"],
  "com.instagram.android": ["com.instagram.android:id/clips_viewer"],
  "com.zhiliaoapp.musically": ["com.zhiliaoapp.musically:id/pager"]
} as const;

export function getFocusShieldPreset(id: string | null | undefined): FocusShieldPreset | null {
  const normalizedId = sanitizeIdentifier(id, 64);
  return FOCUS_SHIELD_PRESETS.find((preset) => preset.id === normalizedId) ?? null;
}

export function createFocusShieldPresetRule(
  presetId: FocusShieldPresetId,
  ruleId: FocusShieldRuleId,
  displayLabel?: string
): FocusShieldRule | null {
  const preset = getFocusShieldPreset(presetId);
  const id = sanitizeOpaqueRuleId(ruleId);
  if (!preset || !id) return null;

  return {
    version: FOCUS_SHIELD_CONTRACT_VERSION,
    id,
    packageName: preset.packageName,
    displayLabel: sanitizeDisplayLabel(displayLabel) || preset.displayName,
    kind: "preset",
    presetId: preset.id,
    enabled: true,
    selector: cloneSelector(preset.selector)
  };
}

export function validateFocusShieldRule(value: unknown): value is FocusShieldRule {
  return sanitizeFocusShieldRule(value) !== null;
}

export function sanitizeFocusShieldRule(value: unknown): FocusShieldRule | null {
  if (!isRecord(value)) return null;

  const version = value.version === FOCUS_SHIELD_CONTRACT_VERSION ? FOCUS_SHIELD_CONTRACT_VERSION : null;
  const id = sanitizeOpaqueRuleId(value.id);
  const kind = value.kind === "preset" || value.kind === "custom" ? value.kind : null;
  const packageName = sanitizePackageName(value.packageName);
  const displayLabel = sanitizeDisplayLabel(value.displayLabel);
  const enabled = typeof value.enabled === "boolean" ? value.enabled : null;
  if (!version || !id || !kind || !packageName || !displayLabel || enabled === null) return null;

  if (kind === "preset") {
    const preset = getFocusShieldPreset(typeof value.presetId === "string" ? value.presetId : null);
    if (!preset || preset.packageName !== packageName) return null;

    return {
      version,
      id,
      packageName,
      displayLabel,
      kind,
      presetId: preset.id,
      enabled,
      selector: cloneSelector(preset.selector)
    };
  }

  const selector = sanitizeFocusShieldSelector(value.selector, packageName);
  if (!selector || !hasStableSelector(selector)) return null;

  return {
    version,
    id,
    packageName,
    displayLabel,
    kind,
    enabled,
    selector
  };
}

export function getFocusShieldRuleDisplayName(rule: Pick<FocusShieldRule, "displayLabel" | "presetId"> | null | undefined): string {
  const displayLabel = sanitizeDisplayLabel(rule?.displayLabel);
  if (displayLabel) return displayLabel;
  return getFocusShieldPreset(rule?.presetId)?.displayName ?? "Focus Shield rule";
}

export function isAndroidSurfaceScopeActive(
  scope: FocusShieldInterventionScope | null | undefined,
  rule: Pick<FocusShieldRule, "id" | "packageName"> | null | undefined
): boolean {
  if (!scope || !rule || scope.kind !== "android-surface") return false;
  return scope.ruleId === rule.id && normalizeScopePackage(scope.packageName) === normalizeScopePackage(rule.packageName);
}

export function focusShieldScopesMatch(
  left: FocusShieldInterventionScope | null | undefined,
  right: FocusShieldInterventionScope | null | undefined
): boolean {
  if (!left || !right || left.kind !== right.kind) return false;

  switch (left.kind) {
    case "android-surface":
      return right.kind === "android-surface" && left.ruleId === right.ruleId && normalizeScopePackage(left.packageName) === normalizeScopePackage(right.packageName);
    case "android-package":
      return right.kind === "android-package" && normalizeScopePackage(left.packageName) === normalizeScopePackage(right.packageName);
    case "ios-token":
      return right.kind === "ios-token" && left.tokenType === right.tokenType && left.token === right.token;
    case "browser-domain":
      return right.kind === "browser-domain" && normalizeDomain(left.domain) === normalizeDomain(right.domain);
  }
}

export function sanitizeFocusShieldInterventionScope(value: unknown): FocusShieldInterventionScope | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;

  if (value.kind === "android-surface") {
    const packageName = sanitizePackageName(value.packageName);
    const ruleId = sanitizeOpaqueRuleId(value.ruleId);
    return packageName && ruleId ? { kind: "android-surface", packageName, ruleId } : null;
  }

  if (value.kind === "android-package") {
    const packageName = sanitizePackageName(value.packageName);
    return packageName ? { kind: "android-package", packageName } : null;
  }

  if (value.kind === "ios-token") {
    const tokenType = value.tokenType;
    const token = sanitizeOpaqueToken(value.token);
    return (tokenType === "application" || tokenType === "category" || tokenType === "domain") && token
      ? { kind: "ios-token", tokenType, token }
      : null;
  }

  if (value.kind === "browser-domain") {
    const domain = sanitizeDomain(value.domain);
    return domain ? { kind: "browser-domain", domain } : null;
  }

  return null;
}

function sanitizeFocusShieldSelector(value: unknown, expectedPackageName: string): FocusShieldSelectorFingerprint | null {
  if (!isRecord(value)) return null;
  const packageName = sanitizePackageName(value.packageName);
  if (!packageName || packageName !== expectedPackageName) return null;

  const viewId = sanitizeIdentifier(value.viewId, 180, /[^a-zA-Z0-9_.$:/-]/g);
  if (viewId && !isAllowedFocusShieldViewId(packageName, viewId)) return null;
  const role = sanitizeIdentifier(value.role, 180, /[^a-zA-Z0-9_.$-]/g);
  const ancestorRoles = Array.isArray(value.ancestorRoles)
    ? value.ancestorRoles
        .map((ancestor) => sanitizeIdentifier(ancestor, 180, /[^a-zA-Z0-9_.$-]/g))
        .filter((ancestor): ancestor is string => Boolean(ancestor))
        .slice(0, 8)
    : [];
  const normalizedBounds = sanitizeNormalizedBounds(value.normalizedBounds);

  const selector: FocusShieldSelectorFingerprint = { packageName };
  if (viewId) selector.viewId = viewId;
  if (role) selector.role = role;
  if (ancestorRoles.length > 0) selector.ancestorRoles = [...new Set(ancestorRoles)];
  if (normalizedBounds) selector.normalizedBounds = normalizedBounds;
  return selector;
}

function sanitizeNormalizedBounds(value: unknown): FocusShieldNormalizedBounds | null {
  if (!isRecord(value)) return null;
  const x = value.x;
  const y = value.y;
  const width = value.width;
  const height = value.height;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(width) || !isFiniteNumber(height)) return null;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) return null;
  const normalized = { x: roundNormalized(x), y: roundNormalized(y), width: roundNormalized(width), height: roundNormalized(height) };
  return normalized.width > 0 && normalized.height > 0 && normalized.x + normalized.width <= 1 && normalized.y + normalized.height <= 1
    ? normalized
    : null;
}

function hasStableSelector(selector: FocusShieldSelectorFingerprint): boolean {
  return Boolean(selector.viewId || selector.role || selector.ancestorRoles?.length);
}

function cloneSelector(selector: FocusShieldSelectorFingerprint): FocusShieldSelectorFingerprint {
  return {
    ...selector,
    ancestorRoles: selector.ancestorRoles ? [...selector.ancestorRoles] : undefined,
    normalizedBounds: selector.normalizedBounds ? { ...selector.normalizedBounds } : undefined
  };
}

function sanitizeOpaqueRuleId(value: unknown): string | null {
  const id = sanitizeIdentifier(value, 128);
  return id && id.length >= 6 ? id : null;
}

function sanitizePackageName(value: unknown): string | null {
  const packageName = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/.test(packageName) ? packageName : null;
}

function isAllowedFocusShieldViewId(packageName: string, viewId: string): boolean {
  return (FOCUS_SHIELD_ALLOWED_VIEW_IDS[packageName as keyof typeof FOCUS_SHIELD_ALLOWED_VIEW_IDS] as readonly string[] | undefined)?.includes(viewId) ?? false;
}

function sanitizeOpaqueToken(value: unknown): string | null {
  return sanitizeIdentifier(value, 256, /[^a-zA-Z0-9_.-]/g);
}

function sanitizeDomain(value: unknown): string | null {
  const domain = typeof value === "string" ? normalizeDomain(value) : "";
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain) ? domain : null;
}

function sanitizeDisplayLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.replace(/\s+/g, " ").trim().slice(0, 80);
  return label || null;
}

function sanitizeIdentifier(value: unknown, maxLength: number, invalidCharacters = /[^a-zA-Z0-9_.-]/g): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(invalidCharacters, "").slice(0, maxLength);
  return normalized || null;
}

function normalizeScopePackage(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

function roundNormalized(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
