/**
 * Expo Router resolves every URL the OS hands to the app. FREED's feature
 * links (Android Usage Access return, Safari Focus Shield handoff, Firebase
 * email sign-in, Screen Time notifications) have no file route of their own:
 * FreedApp consumes them through `Linking` after it mounts. Without this
 * mapping, expo-router renders its "Unmatched Route" screen instead of the app
 * on a cold start and pushes it on top of the app on a warm start.
 *
 * Pure so it can be unit tested; wired in app/+native-intent.tsx.
 */

import { FREED_SHIELD_SECTIONS, freedShieldSectionPath, FREED_PROFILE_SECTIONS, freedProfileSectionPath } from './native-navigation';

const APP_SCHEMES = new Set(["freed:", "app.freed.recovery:"]);
const FILE_ROUTES = new Set(["privacy", "support", "account-deletion", "preferences"]);
// Screen links carry no purchase, unlock, account, or intervention authority.
const FEATURE_ROUTES = new Set([
  "/today", "/shield", "/progress", "/profile", "/today/library", "/preferences",
  "/flow/breathing", "/flow/checkin", "/flow/coach", "/flow/account", "/flow/paywall",
  "/flow/slip", "/flow/customChallenge", "/flow/protectionSetup", "/flow/challenge",
  "/onboarding/welcome", "/onboarding/quiz", "/onboarding/planCalculation", "/onboarding/appSelection",
  ...FREED_SHIELD_SECTIONS.map(freedShieldSectionPath),
  ...FREED_PROFILE_SECTIONS.map(freedProfileSectionPath)
]);
const FIREBASE_AUTH_HOSTS = new Set(["freed-7d5ee.firebaseapp.com", "freed-7d5ee.web.app"]);
const INTERVENTION_HOSTS = new Set(["intervention.freed.app"]);
const WEBSITE_HOSTS = new Set(["freedrecovery.app", "www.freedrecovery.app"]);

function fileRouteFor(segment: string): string | null {
  const normalized = segment.trim().toLowerCase();
  return FILE_ROUTES.has(normalized) ? `/${normalized}` : null;
}

/**
 * Returns the expo-router path to render for a system URL. FreedApp still
 * receives the original URL through `Linking.getInitialURL()` / the `url`
 * event, so returning "/" never loses the link's payload.
 */
export function resolveFreedSystemPath(path: string | null | undefined): string {
  if (!path || typeof path !== "string") return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";

  // Plain in-app paths ("/privacy", "/") pass through when they are real routes.
  if (trimmed.startsWith("/")) {
    if (FEATURE_ROUTES.has(trimmed)) return trimmed;
    const segment = trimmed.replace(/^\/+/, "").split(/[/?#]/)[0] ?? "";
    if (!segment) return "/";
    return fileRouteFor(segment) ?? "/";
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "/";
  }

  if (APP_SCHEMES.has(parsed.protocol)) {
    if (parsed.username || parsed.password || parsed.port) return "/";
    const featurePath = `/${[parsed.hostname, parsed.pathname.replace(/^\/+/, "")].filter(Boolean).join("/")}`;
    if (!parsed.search && !parsed.hash && FEATURE_ROUTES.has(featurePath)) return featurePath;
    const route = parsed.hostname || parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
    return fileRouteFor(route) ?? "/";
  }

  if (parsed.protocol === "https:" || parsed.protocol === "http:") {
    const host = parsed.hostname.toLowerCase();
    if (FIREBASE_AUTH_HOSTS.has(host) || INTERVENTION_HOSTS.has(host)) return "/";
    if (WEBSITE_HOSTS.has(host)) {
      const segment = parsed.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
      return fileRouteFor(segment) ?? "/";
    }
  }

  return "/";
}
