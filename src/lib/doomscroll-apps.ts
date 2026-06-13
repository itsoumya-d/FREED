export type DoomscrollAppSurface = "social" | "video" | "forum";

export const INSTAGRAM_ANDROID_PACKAGE = "com.instagram.android";
export const TIKTOK_PRIMARY_ANDROID_PACKAGE = "com.zhiliaoapp.musically";
export const TIKTOK_ANDROID_PACKAGE_ALIASES = ["com.ss.android.ugc.trill", "com.tiktok"] as const;
export const YOUTUBE_ANDROID_PACKAGE = "com.google.android.youtube";
export const YOUTUBE_SHORTS_RULE = "short-form:youtube-shorts";
export const INSTAGRAM_REELS_RULE = "short-form:instagram-reels";
export const TIKTOK_FEED_RULE = "short-form:tiktok-feed";
export const YOUTUBE_SHORTS_HOST = "youtube-shorts.app.freed.local";
export const INSTAGRAM_REELS_HOST = "instagram-reels.app.freed.local";
export const TIKTOK_FEED_HOST = "tiktok-feed.app.freed.local";
export const DEFAULT_SHORT_FORM_WEB_URL = "https://youtube.com/shorts/dQw4w9WgXcQ";
export const SAFARI_SHORT_FORM_WEB_RULE_FILTERS = [
  "^https?://([^/?#]+\\.)?youtube\\.com/shorts([/?#]|$)",
  "^https?://([^/?#]+\\.)?youtube\\.com/feed/shorts([/?#]|$)",
  "^https?://([^/?#]+\\.)?instagram\\.com/reel(s)?([/?#]|/|$)",
  "^https?://([^/?#]+\\.)?tiktok\\.com/foryou([/?#]|$)"
] as const;

export const DOOMSCROLL_APP_OPTIONS = [
  { label: "Instagram", androidPackage: INSTAGRAM_ANDROID_PACKAGE, androidPackageAliases: [], surface: "social" },
  {
    label: "TikTok",
    androidPackage: TIKTOK_PRIMARY_ANDROID_PACKAGE,
    androidPackageAliases: TIKTOK_ANDROID_PACKAGE_ALIASES,
    surface: "video"
  },
  { label: "X", androidPackage: "com.twitter.android", androidPackageAliases: [], surface: "social" },
  { label: "Reddit", androidPackage: "com.reddit.frontpage", androidPackageAliases: [], surface: "forum" },
  { label: "YouTube", androidPackage: YOUTUBE_ANDROID_PACKAGE, androidPackageAliases: [], surface: "video" }
] as const;

export const SUPPORTED_DOOMSCROLL_APP_PACKAGES = Array.from(
  new Set(DOOMSCROLL_APP_OPTIONS.flatMap((option) => [option.androidPackage, ...option.androidPackageAliases]))
);

export const TIKTOK_ANDROID_PACKAGES = [TIKTOK_PRIMARY_ANDROID_PACKAGE, ...TIKTOK_ANDROID_PACKAGE_ALIASES];

export const SHORT_FORM_RULE_PACKAGES = {
  [YOUTUBE_SHORTS_RULE]: YOUTUBE_ANDROID_PACKAGE,
  [INSTAGRAM_REELS_RULE]: INSTAGRAM_ANDROID_PACKAGE,
  [TIKTOK_FEED_RULE]: TIKTOK_PRIMARY_ANDROID_PACKAGE
} as const;

export type ShortFormRuleId = keyof typeof SHORT_FORM_RULE_PACKAGES;

export const SHORT_FORM_RULE_HOSTS: Record<ShortFormRuleId, string> = {
  [YOUTUBE_SHORTS_RULE]: YOUTUBE_SHORTS_HOST,
  [INSTAGRAM_REELS_RULE]: INSTAGRAM_REELS_HOST,
  [TIKTOK_FEED_RULE]: TIKTOK_FEED_HOST
};

export function isShortFormRuleId(rule: string): rule is ShortFormRuleId {
  return Object.prototype.hasOwnProperty.call(SHORT_FORM_RULE_PACKAGES, rule);
}

export function packageForShortFormRule(rule: string): string | null {
  return isShortFormRuleId(rule) ? SHORT_FORM_RULE_PACKAGES[rule] : null;
}

export function hostForShortFormRule(rule: string): string | null {
  return isShortFormRuleId(rule) ? SHORT_FORM_RULE_HOSTS[rule] : null;
}

const primaryDoomscrollPackageBySupportedPackage = new Map<string, string>(
  DOOMSCROLL_APP_OPTIONS.flatMap((option) =>
    [option.androidPackage, ...option.androidPackageAliases].map((androidPackage) => [androidPackage, option.androidPackage] as const)
  )
);

export function normalizeDoomscrollAppPackage(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return primaryDoomscrollPackageBySupportedPackage.get(normalized) ?? null;
}

export function expandDoomscrollAppPackages(packages: string[]): string[] {
  const seen = new Set<string>();
  const expanded: string[] = [];

  for (const rawPackage of packages) {
    const primaryPackage = normalizeDoomscrollAppPackage(rawPackage);
    if (!primaryPackage) continue;

    const option = DOOMSCROLL_APP_OPTIONS.find((item) => item.androidPackage === primaryPackage);
    if (!option) continue;

    for (const androidPackage of [option.androidPackage, ...option.androidPackageAliases]) {
      if (seen.has(androidPackage)) continue;
      seen.add(androidPackage);
      expanded.push(androidPackage);
    }
  }

  return expanded;
}

export function surfaceForDoomscrollAppPackage(value: string): DoomscrollAppSurface | null {
  const primaryPackage = normalizeDoomscrollAppPackage(value);
  if (!primaryPackage) return null;

  return DOOMSCROLL_APP_OPTIONS.find((option) => option.androidPackage === primaryPackage)?.surface ?? null;
}
