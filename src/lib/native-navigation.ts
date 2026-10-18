export type FreedScreen = 'splash' | 'welcome' | 'quiz' | 'planCalculation' | 'appSelection' | 'paywall' | 'account' | 'protectionSetup' | 'library' | 'main' | 'intercept' | 'ad' | 'challenge' | 'breathing' | 'checkin' | 'journal' | 'coach' | 'slip' | 'customChallenge' | 'article' | 'features' | 'movement' | 'feature';
export type FreedTab = 'today' | 'shield' | 'progress' | 'profile';
export const FREED_SHIELD_SECTIONS = ['apps', 'groups', 'schedules', 'websites', 'focus-shield', 'dns', 'diagnostics', 'advanced'] as const;
export type FreedShieldSection = typeof FREED_SHIELD_SECTIONS[number];
const shieldSectionTitles: Record<FreedShieldSection, string> = {
  apps: 'Apps', groups: 'Manage groups', schedules: 'Schedules', websites: 'Web exceptions',
  'focus-shield': 'Focus Shield', dns: 'DNS & health', diagnostics: 'Diagnostics', advanced: 'Protection details'
};
export function parseFreedShieldSection(value: unknown): FreedShieldSection | null {
  return typeof value === 'string' && (FREED_SHIELD_SECTIONS as readonly string[]).includes(value) ? value as FreedShieldSection : null;
}
export function freedShieldSectionPath(section: FreedShieldSection): `/shield/${FreedShieldSection}` { return `/shield/${section}`; }
export function freedShieldSectionTitle(section: FreedShieldSection): string { return shieldSectionTitles[section]; }
export const FREED_PROFILE_SECTIONS = ['routine', 'support-tools', 'settings', 'account', 'membership', 'reminders', 'data-privacy', 'backup', 'accountability', 'privacy', 'help-about', 'analytics-consent'] as const;
export type FreedProfileSection = typeof FREED_PROFILE_SECTIONS[number];
const profileSectionTitles: Record<FreedProfileSection, string> = {
  routine: 'Your routine', 'support-tools': 'Support tools', settings: 'Settings', account: 'Account', membership: 'Membership', reminders: 'Notifications',
  'data-privacy': 'Data & privacy', backup: 'Encrypted Backup', accountability: 'Accountability', privacy: 'Privacy & support', 'help-about': 'Help & about', 'analytics-consent': 'Analytics sharing'
};
export function parseFreedProfileSection(value: unknown): FreedProfileSection | null {
  return typeof value === 'string' && (FREED_PROFILE_SECTIONS as readonly string[]).includes(value) ? value as FreedProfileSection : null;
}
export function freedProfileSectionPath(section: FreedProfileSection): `/profile/${FreedProfileSection}` { return `/profile/${section}`; }
export function freedProfileSectionTitle(section: FreedProfileSection): string { return profileSectionTitles[section]; }
const tabs: readonly string[] = ['today', 'shield', 'progress', 'profile'];
const onboarding: readonly string[] = ['welcome', 'quiz', 'planCalculation', 'appSelection'];
const flows: readonly string[] = ['paywall', 'account', 'protectionSetup', 'intercept', 'ad', 'challenge', 'breathing', 'checkin', 'journal', 'coach', 'slip', 'customChallenge', 'features', 'movement', 'feature'];
export const FREED_PUBLIC_AUXILIARY_ROUTES = ['preferences', 'privacy', 'support', 'account-deletion'] as const;
export type FreedPublicAuxiliaryRoute = typeof FREED_PUBLIC_AUXILIARY_ROUTES[number];

export function parseFreedRoute(pathname: string): { screen: FreedScreen; tab: FreedTab | null; auxiliaryRoute?: FreedPublicAuxiliaryRoute; profileSection?: FreedProfileSection } {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 1 && (FREED_PUBLIC_AUXILIARY_ROUTES as readonly string[]).includes(parts[0])) return { screen: 'splash', tab: null, auxiliaryRoute: parts[0] as FreedPublicAuxiliaryRoute };
  if (parts.length === 1 && tabs.includes(parts[0])) return { screen: 'main', tab: parts[0] as FreedTab };
  if (parts.length === 2 && parts[0] === 'profile' && parseFreedProfileSection(parts[1])) return { screen: 'main', tab: 'profile', profileSection: parseFreedProfileSection(parts[1])! };
  if (parts.length === 2 && parts[0] === 'shield' && parseFreedShieldSection(parts[1])) return { screen: 'main', tab: 'shield' };
  if (parts.length === 2 && parts[0] === 'today' && ['library', 'article'].includes(parts[1])) return { screen: parts[1] as FreedScreen, tab: 'today' };
  if (parts.length === 2 && parts[0] === 'onboarding' && onboarding.includes(parts[1])) return { screen: parts[1] as FreedScreen, tab: null };
  if (parts.length === 2 && parts[0] === 'flow' && flows.includes(parts[1])) return { screen: parts[1] as FreedScreen, tab: null };
  return { screen: 'splash', tab: null };
}

export function planFreedNavigation(pathname: string, screen: FreedScreen, tab: FreedTab): { action: 'none' | 'reset' | 'back' | 'push' | 'replace' | 'setParams'; path: string } {
  const path = screen === 'main' ? `/${tab}` : screen === 'splash' ? '/' : ['library', 'article'].includes(screen) ? `/today/${screen}` : onboarding.includes(screen) ? `/onboarding/${screen}` : `/flow/${screen}`;
  if (pathname === path) return { action: 'none', path };
  if (['/flow/intercept', '/flow/ad', '/flow/challenge'].includes(pathname) && ['intercept', 'ad', 'challenge'].includes(screen)) return { action: 'setParams', path };
  if (screen === 'main' || screen === 'welcome') return { action: 'reset', path };
  if (pathname === '/today/article' && screen === 'library') return { action: 'back', path };
  const replacing = pathname === '/' || pathname.startsWith('/onboarding/') || (pathname.startsWith('/flow/') && !['/flow/features', '/flow/feature', '/flow/movement'].includes(pathname));
  return { action: replacing ? 'replace' : 'push', path };
}

export type FreedNavigationRoute = { name: string; key?: string; params?: Record<string, unknown>; state?: FreedNavigationState; [key: string]: unknown };
export type FreedNavigationState = { index: number; routes: FreedNavigationRoute[]; key?: string; [key: string]: unknown };
export function findFreedNavigatorState(root: FreedNavigationState): FreedNavigationState | null {
  const names = Array.isArray(root.routeNames) ? root.routeNames : root.routes.map(route => route.name);
  if (names.includes('(tabs)') || names.includes('flow/[destination]') || names.includes('index')) return root;
  for (const route of root.routes) {
    if (route.state) { const found = findFreedNavigatorState(route.state); if (found) return found; }
  }
  return null;
}
/** Terminal transitions remove old root history while retaining each existing tab's identity. */
export function makeFreedRootReset(root: FreedNavigationState, screen: 'main' | 'welcome', tab: FreedTab): FreedNavigationState {
  if (screen === 'welcome') return { ...root, index: 0, routes: [{ name: 'onboarding/[destination]', params: { destination: 'welcome' } }], preloadedRoutes: [] };
  const existing = root.routes.find(route => route.name === '(tabs)');
  const tabState = existing?.state;
  const tabRoutes = tabState?.routes?.length ? tabState.routes : tabs.map(name => ({ name, state: { index: 0, routes: [{ name: 'index' }] } }));
  const routes = tabRoutes.map(route => {
    if (route.name !== tab || !route.state?.routes?.length) return route;
    const home = route.state.routes.find(child => child.name === 'index') ?? { name: 'index' };
    return { ...route, state: { ...route.state, index: 0, routes: [home], preloadedRoutes: [] } };
  });
  const index = Math.max(0, routes.findIndex(route => route.name === tab));
  const destination = { ...existing, name: '(tabs)', state: { ...tabState, index, routes } };
  return { ...root, index: 0, routes: [destination], preloadedRoutes: [] };
}
