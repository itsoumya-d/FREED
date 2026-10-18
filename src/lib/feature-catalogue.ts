import { hasReviewAccess, type ReviewAccessSnapshot } from './review-access';
import { getJourneyOwner, type JourneyAuthSnapshot, type JourneyMembershipSnapshot } from './user-journey';
import type { DailyHabitKey } from './recovery-state';
import type { FreedScreen, FreedShieldSection } from './native-navigation';
export type FeatureGroup = 'Protect' | 'Reset' | 'Daily plan' | 'Progress' | 'Account/data';
export type FeatureDestination = { kind: 'screen'; screen: FreedScreen } | { kind: 'shield'; section: FreedShieldSection } | { kind: 'focus'; tab: 'profile' | 'progress'; section: string } | { kind: 'guided' } | { kind: 'preferences' } | { kind: 'practices' } | { kind: 'setup'; intent: 'websites' } | { kind: 'practice'; key: DailyHabitKey };
export const FEATURE_DESTINATIONS = {
  websites: { kind: 'setup', intent: 'websites' }, apps: { kind: 'shield', section: 'apps' }, schedules: { kind: 'shield', section: 'schedules' }, exceptions: { kind: 'shield', section: 'websites' }, diagnostics: { kind: 'shield', section: 'diagnostics' }, 'dns-health': { kind: 'shield', section: 'dns' },
  breathe: { kind: 'screen', screen: 'breathing' }, move: { kind: 'screen', screen: 'movement' }, journal: { kind: 'screen', screen: 'journal' }, talk: { kind: 'screen', screen: 'coach' }, 'guided-reset': { kind: 'guided' }, 'custom-reset': { kind: 'screen', screen: 'customChallenge' }, library: { kind: 'screen', screen: 'library' }, slip: { kind: 'screen', screen: 'slip' },
  checkin: { kind: 'screen', screen: 'checkin' }, practices: { kind: 'practices' }, 'practice-adult-content-boundary': { kind: 'practice', key: 'adult-content-boundary' }, 'practice-exercise': { kind: 'practice', key: 'exercise' }, 'practice-journal': { kind: 'practice', key: 'journal' }, 'practice-meditation': { kind: 'practice', key: 'meditation' }, 'practice-cold-shower': { kind: 'practice', key: 'cold-shower' }, 'practice-social-media-boundary': { kind: 'practice', key: 'social-media-boundary' },
  routine: { kind: 'focus', tab: 'profile', section: 'routine' }, personalize: { kind: 'screen', screen: 'quiz' }, pledge: { kind: 'practices' },
  history: { kind: 'focus', tab: 'progress', section: 'history' }, 'activity-estimates': { kind: 'focus', tab: 'progress', section: 'activity' }, 'adaptive-signals': { kind: 'focus', tab: 'progress', section: 'adaptive' }, achievements: { kind: 'focus', tab: 'progress', section: 'achievements' }, insight: { kind: 'focus', tab: 'progress', section: 'insight' }, 'weekly-report': { kind: 'focus', tab: 'progress', section: 'weekly' }, 'monthly-report': { kind: 'focus', tab: 'progress', section: 'monthly' }, 'urge-estimate': { kind: 'focus', tab: 'progress', section: 'estimate' }, analytics: { kind: 'focus', tab: 'profile', section: 'analytics-consent' },
  account: { kind: 'focus', tab: 'profile', section: 'account' }, membership: { kind: 'screen', screen: 'paywall' }, reminders: { kind: 'focus', tab: 'profile', section: 'reminders' }, backup: { kind: 'focus', tab: 'profile', section: 'backup' }, accountability: { kind: 'focus', tab: 'profile', section: 'accountability' }, privacy: { kind: 'focus', tab: 'profile', section: 'privacy' }, preferences: { kind: 'preferences' }
} as const satisfies Record<string, FeatureDestination>;
export type FeatureId = keyof typeof FEATURE_DESTINATIONS;
export type FeatureDefinition = { id: FeatureId; group: FeatureGroup; title: string; purpose: string; action: string; keywords: readonly string[]; premium?: boolean };
const feature = (id: FeatureId, group: FeatureGroup, title: string, purpose: string, keywords: string[], premium = false): FeatureDefinition => ({ id, group, title, purpose, action: 'Open', keywords, premium });
export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
 feature('websites','Protect','Adult website protection','Review website filtering and its independent coverage.',['websites','block','DNS']),
 feature('apps','Protect','App limits','Choose apps and a daily limit; complete required permission steps.',['apps','screen time']),
 feature('schedules','Protect','Schedules','Protect selected apps during chosen time windows.',['schedule','time']),
 feature('exceptions','Protect','Allowed sites','Review local ordinary-site exceptions and wrong-block support.',['allowlist','websites']),
 feature('diagnostics','Protect','Diagnostics','Check a URL and review permission health.',['URL','permissions']),
 feature('dns-health','Protect','DNS & health','Review filtering coverage, provider and connection health.',['DNS','connection']),
 feature('breathe','Reset','Breathe','Take a free breathing pause.',['breath','calm']),
 feature('move','Reset','Move','Try comfortable movement and optionally record exercise yourself.',['movement','exercise']),
 feature('journal','Reset','Journal','Write a private reflection directly.',['Write','notes']),
 feature('talk','Reset','Talk','Talk it through with local CLARA support.',['CLARA','coach']),
 feature('guided-reset','Reset','Guided reset','Choose a guided recovery activity.',['challenge','reset']),
 feature('custom-reset','Reset','Custom reset','Build and save a personal guided activity.',['builder','challenge'],true),
 feature('library','Reset','Recovery Tools','Read recovery articles and open tools.',['articles','learn']),
 feature('slip','Reset','Log Slip Safely','Record a difficult moment and plan your next step.',['slip','relapse']),
 feature('checkin','Daily plan','Daily check-in','Record mood, urges and sleep.',['check-in','mood']),
 feature('practices','Daily plan','All tools and practices','Read and self-report any of the six daily practices; choose up to two for today.',['exercise','Journal','Meditation','Cold shower','No adult content','No social media','pledge']),
 feature('practice-adult-content-boundary','Daily plan','No adult content','Read boundary instructions and record your own daily practice.',['boundary','adult content']),
 feature('practice-exercise','Daily plan','Exercise','Read movement instructions and record your own exercise.',['exercise','movement']),
 feature('practice-journal','Daily plan','Journal practice','Read reflection instructions and open private writing.',['Journal','Write']),
 feature('practice-meditation','Daily plan','Meditation','Read calm practice instructions and optionally open breathing.',['meditation','calm']),
 feature('practice-cold-shower','Daily plan','Cold shower','Read comfortable shower instructions and record your practice.',['cold','shower']),
 feature('practice-social-media-boundary','Daily plan','No social media','Read attention-boundary instructions and record your own day.',['social','media','boundary']),
 feature('routine','Daily plan','Your routine','Review your suggested retention plan.',['plan','routine']),
 feature('personalize','Daily plan','Personalize my suggestions','Review optional goals and preferred resets.',['goals','suggestions']),
 feature('pledge','Daily plan',"Take today's pledge",'Record an optional daily commitment.',['pledge','commitment']),
 feature('history','Progress','Recovery history','Browse dated records and past practices.',['calendar','history']),
 feature('activity-estimates','Progress','Activity Estimates','Review estimates based on your own recorded activity.',['activity','score']),
 feature('adaptive-signals','Progress','Adaptive signals','Review recorded risk windows and helpful resets.',['signals','patterns'],true),
 feature('achievements','Progress','Milestones and achievements','See milestones based on recorded activity.',['streak','XP']),
 feature('insight','Progress','Personal insight','Review patterns from your local check-ins.',['insight','patterns']),
 feature('weekly-report','Progress','Weekly Report','Review the last week of recorded activity.',['week','report']),
 feature('monthly-report','Progress','Monthly growth','Review the monthly report from your recorded activity.',['month','report'],true),
 feature('urge-estimate','Progress','Urge estimate','Review a local rule-based estimate when enough signals exist.',['risk','forecast'],true),
 feature('analytics','Account/data','Analytics sharing','Review aggregate counts and optional sharing controls.',['privacy','analytics','remote']),
 feature('account','Account/data','Sign-in','Manage account providers and sign-out.',['account','email','Apple','Google']),
 feature('membership','Account/data','Manage membership','Review verified access and membership options.',['premium','subscription']),
 feature('reminders','Account/data','Reminders','Choose reminder timing and permission.',['notification','time']),
 feature('backup','Account/data','Encrypted Backup','Export, restore and configure optional encrypted sync.',['export','restore','data']),
 feature('accountability','Account/data','Accountability','Manage contacts and support-circle reports.',['sponsor','family','contacts']),
 feature('privacy','Account/data','Privacy & support','Read privacy information, get help and manage deletion.',['support','delete','data']),
 feature('preferences','Account/data','Language & appearance','Choose language, theme and accessibility preferences.',['language','dark','settings'])
];
export type FeatureStatusContext = { platform?: 'android' | 'ios' | 'web' | 'unknown'; auth: JourneyAuthSnapshot; membership: JourneyMembershipSnapshot; reviewAccess?: ReviewAccessSnapshot|null; websiteStatus: string; appStatus: string; remindersEnabled: boolean; backupEnabled: boolean; analyticsEnabled: boolean };
export function getFeatureStatus(feature: FeatureDefinition, context: FeatureStatusContext): string {
 if (feature.id === 'exceptions') return context.platform === 'android' ? 'Android local exceptions only · Families filtering still applies' : context.platform === 'ios' ? 'Unsupported on iOS · wrong-block help available' : 'Unavailable on this platform · wrong-block help available';
 if (feature.id === 'websites') return context.websiteStatus;
 if (feature.id === 'apps') return context.appStatus;
 if (feature.id === 'schedules') return `App protection: ${context.appStatus} · review schedules`;
 if (feature.id === 'reminders') return context.remindersEnabled ? 'Configured · review permission' : 'Off';
 if (feature.id === 'backup') return context.backupEnabled ? 'Configured · check sync in settings' : 'Local export available · sync off';
 if (feature.id === 'analytics') return context.analyticsEnabled ? 'Sharing configured · check readiness' : 'Local only · sharing off';
 if (feature.id === 'account') return getJourneyOwner(context.auth) ? 'Signed in' : 'Account unavailable';
 if ((feature.premium || feature.id === 'guided-reset') && hasReviewAccess(context.reviewAccess ?? null, getJourneyOwner(context.auth))) return 'Review access';
 if (feature.premium || feature.id === 'membership') {
  const owner = getJourneyOwner(context.auth);
  if (!owner || owner !== context.membership.ownerUid || context.membership.status === 'unavailable') return 'Verification required';
  if (context.membership.status === 'checking') return 'Checking membership';
  return context.membership.status === 'verified-premium' ? 'Premium available' : 'Membership options available';
 }
 return feature.id === 'guided-reset' ? 'Choose access when starting' : 'Available locally';
}
export function searchFeatures(query: string, translate: (source: string) => string, locale?: string): readonly FeatureDefinition[] {
 const term = query.trim().toLocaleLowerCase(locale);
 const hiddenReports: ReadonlySet<FeatureId> = new Set(['activity-estimates','adaptive-signals','achievements','insight','weekly-report','monthly-report','urge-estimate']);
 return FEATURE_DEFINITIONS.filter(f => !hiddenReports.has(f.id) && (!term || [f.title,f.purpose,f.group,...f.keywords].some(value => [value,translate(value)].some(text => text.toLocaleLowerCase(locale).includes(term)))));
}
export function parseFeatureId(value: unknown): FeatureId | null { return typeof value === 'string' && Object.hasOwn(FEATURE_DESTINATIONS,value) ? value as FeatureId : null; }
