import React from 'react';
import { fireEvent, render, act } from '@testing-library/react-native';
import { FeatureDirectory } from '@/components/FeatureDirectory';
import { BasicMovementScreen } from '@/components/BasicMovementScreen';
import { FunctionalToday } from '@/components/FunctionalToday';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
import { getProtectionSetupReadiness } from '@/lib/protection-readiness';
import { FEATURE_DEFINITIONS, searchFeatures } from '@/lib/feature-catalogue';
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null, ArrowLeft: () => null }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('@/hooks/use-encrypted-dns', () => ({ useEncryptedDns: () => ({
  status: { supported: true, releaseEnabled: true, configured: true, enabled: true, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: false },
  lastCheckedAt: 100, pending: null, error: null,
}) }));
let mockMotionActive = false;
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: mockMotionActive }) }));
const context = { auth: { status: 'ready' as const, signedIn: true, anonymous: false, ownerUid: 'a', email: null }, membership: { ownerUid: 'a', status: 'free' as const }, websiteStatus: 'Off' as const, appStatus: 'On' as const, remindersEnabled: false, backupEnabled: false, analyticsEnabled: false };
test('every public row has a status and invokes its exact stable id; search clears no-results', () => {
  const open = jest.fn(); const view = render(<FeatureDirectory context={context} onOpen={open} onBack={jest.fn()} />);
  for (const f of searchFeatures('', source => source)) { expect(view.getByTestId(`feature-status-${f.id}`)).toBeOnTheScreen(); fireEvent.press(view.getByTestId(`feature-${f.id}`)); expect(open).toHaveBeenLastCalledWith(f.id); }
  fireEvent.changeText(view.getByTestId('feature-search'), 'does-not-exist'); expect(view.getByTestId('feature-empty')).toBeOnTheScreen();
  fireEvent.changeText(view.getByTestId('feature-search'), 'write'); expect(view.getByTestId('feature-journal')).toBeOnTheScreen();
});
test('basic movement requires explicit self-report, retries failure and writes current local date only', async () => {
  const record = jest.fn().mockRejectedValueOnce(Error('disk')).mockResolvedValue(undefined);
  const view = render(<BasicMovementScreen onRecord={record} onBack={jest.fn()} recorded={false} />);
  expect(view.getByTestId('movement-save')).toBeDisabled(); fireEvent.press(view.getByTestId('movement-save')); expect(record).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('movement-self-report'));
  await act(async () => fireEvent.press(view.getByTestId('movement-save'))); expect(view.getByRole('alert')).toBeOnTheScreen();
  await act(async () => fireEvent.press(view.getByTestId('movement-save'))); expect(record).toHaveBeenCalledTimes(2); expect(view.getByTestId('movement-saved')).toBeOnTheScreen();
});
test('actual Today exposes All features callback and prioritizes chosen incomplete protection before check-in', () => {
  const all = jest.fn(), protect = jest.fn(), checkin = jest.fn(); const state = createDefaultRecoveryState();
  const view = render(<FunctionalToday recoveryState={state} streakDays={0} protectionReadiness={getProtectionSetupReadiness(null,null,0,'websites')} onAllFeatures={all} protectionGoal="websites" onCheckIn={checkin} onJournal={jest.fn()} onPanic={jest.fn()} onMovement={jest.fn()} onBreathing={jest.fn()} onCoach={jest.fn()} onOpenLibrary={jest.fn()} onOpenShield={protect} onOpenProgress={jest.fn()} onHabitToggle={jest.fn()} onPlanChange={jest.fn()} onTakePledge={jest.fn()} />);
  fireEvent.press(view.getByTestId('home-all-features')); expect(all).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByTestId('home-primary-action')); expect(protect).toHaveBeenCalledTimes(1); expect(checkin).not.toHaveBeenCalled();
});

import { PracticeDetail } from '@/components/PracticeDetail';
import { getLocalDateKey } from '@/lib/recovery-state';
test.each(['journal','exercise'] as const)('real %s detail renders definition instructions and opens its writing/basic action', key => {
  const open = jest.fn(); const now = new Date();
  const view = render(<PracticeDetail habit={{key,label:key,category:'reflection',detail:key,done:false}} selectedDate={now} today={now} onClose={jest.fn()} onHabitToggle={jest.fn()} onPracticeAction={open} />);
  expect(view.getByTestId('practice-guided-action')).toHaveTextContent(key === 'journal' ? 'Open Journal' : 'Open basic movement');
  expect(view.queryByText('Use your check-in to save the reflection, then record this practice.')).toBeNull();
  fireEvent.press(view.getByTestId('practice-guided-action')); expect(open).toHaveBeenCalledWith(key);
});
test('exercise uses the date at explicit Save even after midnight and never writes duration or proof', async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date(2026,9,5,23,59)); const save = jest.fn();
  const view = render(<BasicMovementScreen recorded={false} onRecord={save} onBack={jest.fn()} />);
  fireEvent.press(view.getByTestId('movement-self-report')); jest.setSystemTime(new Date(2026,9,6,0,1));
  view.rerender(<BasicMovementScreen recorded={false} onRecord={save} onBack={jest.fn()} />);
  expect(view.getByTestId('movement-self-report')).not.toBeChecked();
  fireEvent.press(view.getByTestId('movement-self-report'));
  await act(async () => fireEvent.press(view.getByTestId('movement-save'))); expect(save).toHaveBeenCalledWith('2026-10-06');
  jest.useRealTimers();
});
test('a resumable reset takes priority; an independently completed website goal allows daily check-in', async () => {
  const state = createDefaultRecoveryState(), reset = jest.fn(), checkin = jest.fn();
  const protectionCapability: any = { platform:'ios', screenTime:true, managedSettings:true, notes:[] };
  const protectionStatus: any = { authorized:true, adultFilterActive:true, adultWebPolicyConfigured:true, active:true, mode:'screen-time', message:'' };
  const readiness = getProtectionSetupReadiness(protectionCapability,protectionStatus,0);
  const protectionObservations = { readbackAt:100, enablement:'observed-current' as const, routing:'observed-current' as const, adultBrowsing:'observed-blocked' as const, ordinaryBrowsing:'observed-allowed' as const };
  const props = { recoveryState:state, streakDays:0, protectionReadiness:readiness, protectionCapability, protectionStatus, protectionObservations, protectionGoal:'websites' as const, onCheckIn:checkin, onJournal:jest.fn(), onPanic:jest.fn(), onMovement:jest.fn(), onBreathing:jest.fn(), onCoach:jest.fn(), onOpenLibrary:jest.fn(), onOpenShield:jest.fn(), onOpenProgress:jest.fn(), onHabitToggle:jest.fn(), onPlanChange:jest.fn(), onTakePledge:jest.fn() };
  const view = render(<FunctionalToday {...props} resumableChallengeTitle="Saved reset" onResumeChallenge={reset} />);
  await act(async () => fireEvent.press(view.getByTestId('home-primary-action'))); expect(reset).toHaveBeenCalledTimes(1);
  view.rerender(<FunctionalToday {...props} />); fireEvent.press(view.getByTestId('home-primary-action')); expect(checkin).toHaveBeenCalledTimes(1);
});

import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { FEATURE_DESTINATIONS, parseFeatureId } from '@/lib/feature-catalogue';
import { guardJourneyRoute, getJourneyOwner } from '@/lib/user-journey';
function featureController(status: 'free'|'verified-premium' = 'verified-premium') {
  const source = readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8');
  const start = source.indexOf('  const renderScreen = (screen: Screen'), end = source.indexOf('    if (screen === "splash")',start);
  const compiled = transpileModule(`${source.slice(start,end)} return <Text testID="focus-route">{tab}:{focusedSection}</Text>; }; return renderScreen;`, {compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
  const state = createDefaultRecoveryState(), screen = jest.fn(), push = jest.fn(), back = jest.fn(), tab = jest.fn(), setup = jest.fn(), guided = jest.fn(); let canBack = true;
  const deps = { showAccountCleanupRecovery:false, rollbackPending:false, privateViewLocked:false, reviewAccess: {snapshot:null}, Platform, accountFlowFence: { current: { isActive: () => false } }, licensedFeatures: status === 'verified-premium', React, View, Text, PillButton: ({label,onPress}: any) => <Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>, AppBackground:View, SafeAreaView:View,
    FeatureDirectory, BasicMovementScreen, FEATURE_DEFINITIONS, FEATURE_DESTINATIONS, parseFeatureId, getJourneyOwner, getLocalDateKey, guardJourneyRoute, getProtectionSetupReadiness,
    getJourneyPolicy: () => ({auth:context.auth,journey:{entry:'existing',introCompletedAt:null},offerAcknowledged:true,verifiedPremium:false}),
    openPaywall:()=>screen('paywall'),router:{push,replace:screen,back,canGoBack:()=>canBack}, setScreen:screen, setTab:tab, setQuizIndex:jest.fn(), setProtectionIntent:setup, startStandaloneChallenge:guided,
    journeyAuth:context.auth,membershipSnapshot:{ownerUid:'a',status}, colors:{},protectionCapability:null,protectionStatus:null,disciplineSettings:state.disciplineSettings,reminders:{enabled:false},recoveryState:state,
    persistRecoveryState:jest.fn(),recordDailyHabitCompletion:jest.fn()
  };
  const run = new Function(...Object.keys(deps),compiled)(...Object.values(deps));
  return { run, screen,push,back,tab,setup,guided,cold:()=>{canBack=false;} };
}
test('production controller executes every directory destination and keeps guided entry in the single gateway', () => {
 const controller=featureController(); const view=render(controller.run('features','today'));
 for (const feature of searchFeatures('', source => source)) {
  fireEvent.press(view.getByTestId(`feature-${feature.id}`)); const destination=FEATURE_DESTINATIONS[feature.id];
  if (destination.kind==='screen') expect(controller.screen).toHaveBeenLastCalledWith(destination.screen);
  else if (destination.kind==='shield') expect(controller.push).toHaveBeenLastCalledWith(`/shield/${destination.section}`);
  else if (destination.kind==='setup') expect(controller.setup).toHaveBeenLastCalledWith('websites');
  else if (destination.kind==='guided') expect(controller.guided).toHaveBeenCalledTimes(1);
  else if (destination.kind==='preferences') expect(controller.push).toHaveBeenLastCalledWith('/preferences');
  else expect(controller.push).toHaveBeenLastCalledWith({pathname:'/flow/feature',params:{feature:feature.id}});
 }
});
test('production controller resolves all focused routes, recovers invalid ids and keeps normal Back/cold fallback', () => {
 const controller=featureController();
 for(const feature of FEATURE_DEFINITIONS) { const destination=FEATURE_DESTINATIONS[feature.id]; if(destination.kind==='focus') { const view=render(controller.run('feature','today',undefined,feature.id)); expect(view.getByTestId('focus-route')).toHaveTextContent(`${destination.tab}:${destination.section}`); view.unmount(); } }
 const invalid=render(controller.run('feature','today',undefined,'unknown')); expect(invalid.getByTestId('feature-directory')).toBeOnTheScreen(); invalid.unmount();
 const move=render(controller.run('movement','today')); fireEvent.press(move.getByRole('button',{name:'Back'})); expect(controller.back).toHaveBeenCalledTimes(1);
 controller.cold(); fireEvent.press(move.getByRole('button',{name:'Back'})); expect(controller.screen).toHaveBeenLastCalledWith('/flow/features');
});
test('free members keep four basic tools and retired report deep links fall back to recorded Progress without a paywall', () => {
 const controller=featureController('free'); const view=render(controller.run('features','today'));
 for(const id of ['breathe','move','journal','talk'] as const) { fireEvent.press(view.getByTestId(`feature-${id}`)); const d=FEATURE_DESTINATIONS[id]; expect(controller.screen).toHaveBeenLastCalledWith(d.screen); }
 for(const id of ['activity-estimates','adaptive-signals','achievements','insight','weekly-report','monthly-report','urge-estimate'] as const) expect(view.queryByTestId(`feature-${id}`)).toBeNull();
 view.unmount();for(const id of ['adaptive-signals','monthly-report','urge-estimate'] as const){const fallback=render(controller.run('feature','today',undefined,id));expect(fallback.getByTestId('focus-route')).toHaveTextContent(/^progress:/);expect(controller.screen).not.toHaveBeenCalledWith('paywall');fallback.unmount();}
});

import { FocusedFeatureContent } from '@/components/FeatureDirectory';
import { MomentumPageHeader, MomentumSection, MomentumVisibility } from '@/components/MomentumPageHeader';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n } from '@/i18n/runtime';
const form = (name: string) => () => <Text testID={`form-${name}`}>{name} controls</Text>;
function productionProfile() {
 const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8');
 const start=source.indexOf('function ProfileScreen('),end=source.indexOf('\nconst ADULT_FEED_REFRESH_INTERVAL_MS',start);
 const compiled=transpileModule(`${source.slice(start,end)}; return ProfileScreen;`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const Icon=()=>null;
 const deps={React,View,Text,Pressable,ScrollView,useAppTheme,useTranslation:require('react-i18next').useTranslation,translateSource,parseFreedProfileSection:require('@/lib/native-navigation').parseFreedProfileSection,freedProfileSectionTitle:require('@/lib/native-navigation').freedProfileSectionTitle,freedProfileSectionPath:require('@/lib/native-navigation').freedProfileSectionPath,BarChart3:Icon,Constants:{},Linking:{openURL:jest.fn()},FileLock:Icon,useMomentumBottomPadding:()=>96,appI18n,getFirebaseAccountScope:()=>'a',getMembershipSummary:()=>({state:'none'}),getFirebaseAccountSummary:()=>({signedIn:true,anonymous:false,email:null,providers:[]}),getLifetimeProtectedAttemptCount:()=>0,getPracticePalette:require('@/design-system/app-palette').getPracticePalette,
  FEATURE_DEFINITIONS,FEATURE_DESTINATIONS,MomentumPageHeader,FocusedFeatureContent,MomentumVisibility,Card:MomentumSection,tap:()=>{},router:{push:jest.fn()},PillButton:({label,onPress}:any)=><Pressable onPress={onPress}><Text>{label}</Text></Pressable>,ChevronRight:Icon,ChevronDown:Icon,
  Sparkles:Icon,Shield:Icon,Target:Icon,Settings:Icon,Calendar:Icon,NotebookPen:Icon,Lock:Icon,Bell:Icon,Users:Icon,LifeBuoy:Icon,
  RetentionPlanCard:form('routine'),RecoveryBackupCard:form('backup'),ReminderSettingsCard:form('reminders'),AccountabilitySettingsCard:form('accountability'),PrivacySupportCard:form('privacy')
 };
 return new Function(...Object.keys(deps),compiled)(...Object.values(deps));
}
test.each(['routine','backup','reminders','accountability','privacy'])('production focused Profile exposes %s controls expanded immediately',focus=>{
 const Profile=productionProfile(); const view=render(<Profile focus={focus} recoveryState={createDefaultRecoveryState()} premiumCapabilities={{}} relapseCount={0} />);
 expect(view.getByTestId(`form-${focus}`)).toBeOnTheScreen();
 for(const other of ['routine','backup','reminders','accountability','privacy'].filter(v=>v!==focus)) expect(view.queryByTestId(`form-${other}`)).toBeNull();
 expect(view.queryByText('Language & appearance')).toBeNull();
});
function productionProgress() {
 const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8'); const start=source.indexOf('function AnalyticsScreen('),end=source.indexOf('\nfunction AnimatedHabitBar',start);
 const compiled=transpileModule(`${source.slice(start,end)}; return AnalyticsScreen;`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const Icon=()=>null;const deps={React,View,Text,Pressable,ScrollView,useAppTheme,useTranslation:require('react-i18next').useTranslation,useMomentumBottomPadding:()=>96,appI18n,getLocalDateKey,buildRecoveryDaySnapshot:require('@/lib/recovery-day-snapshot').buildRecoveryDaySnapshot,calculateRecoveryScore:()=>0,MomentumPageHeader,FocusedFeatureContent,FEATURE_DEFINITIONS,FEATURE_DESTINATIONS,Card:MomentumSection,MomentumMetricStrip:View,
 RecoveryHistory:()=> <Text testID="form-history">Dated records</Text>,Metric:()=>null,EmptyState:()=>null,ProgressRing:()=>null,AnimatedHabitBar:()=>null,BarChart3:Icon,Check:Icon,Target:Icon,PillButton:({label,onPress}:any)=><Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>};
 return new Function(...Object.keys(deps),compiled)(...Object.values(deps));
}
test.each(['history','weekly','monthly','estimate','adaptive','activity','insight','achievements','analytics'])('production focused Progress %s shows recorded history and no unavailable report', focus=>{
 const Progress=productionProgress(), share=jest.fn();const state=createDefaultRecoveryState();
 const view=render(<Progress focus={focus} recoveryState={state} onEnableAnalyticsSharing={share} />);
 expect(view.getByTestId('form-history')).toBeOnTheScreen();
 for(const title of ['Weekly Report','Monthly growth','Urge estimate','ADAPTIVE SIGNALS','Activity Estimates','PERSONAL INSIGHT','Milestones and achievements','Analytics sharing'])expect(view.queryByText(title)).toBeNull();
 if(focus==='history')expect(view.queryByTestId('progress-unavailable-view')).toBeNull();else expect(view.getByTestId('progress-unavailable-view')).toBeOnTheScreen();
 expect(share).not.toHaveBeenCalled();
});

test.each(['adult-content-boundary','exercise','journal','meditation','cold-shower','social-media-boundary'] as const)('a direct %s feature opens its real daily instructions',key=>{
 const now=new Date(), props={recoveryState:createDefaultRecoveryState(),streakDays:0,protectionReadiness:getProtectionSetupReadiness(null,null,0),onCheckIn:jest.fn(),onJournal:jest.fn(),onPanic:jest.fn(),onMovement:jest.fn(),onBreathing:jest.fn(),onCoach:jest.fn(),onOpenLibrary:jest.fn(),onOpenShield:jest.fn(),onOpenProgress:jest.fn(),onHabitToggle:jest.fn(),onPlanChange:jest.fn(),onTakePledge:jest.fn()};
 const view=render(<FunctionalToday {...props} initialPracticeKey={key} />); expect(view.getByTestId('practice-detail-modal')).toBeOnTheScreen(); expect(view.getByTestId('practice-mark-done')).not.toBeDisabled();
});
test('production Today All features action opens the root directory',()=>{
 const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8');const match=source.match(/onAllFeatures=\{([^\n]+)\}/)!;const setScreen=jest.fn();const onAllFeatures=new Function('setScreen',`return (${match[1]});`)(setScreen);
 const props={recoveryState:createDefaultRecoveryState(),streakDays:0,protectionReadiness:getProtectionSetupReadiness(null,null,0),onCheckIn:jest.fn(),onJournal:jest.fn(),onPanic:jest.fn(),onMovement:jest.fn(),onBreathing:jest.fn(),onCoach:jest.fn(),onOpenLibrary:jest.fn(),onOpenShield:jest.fn(),onOpenProgress:jest.fn(),onHabitToggle:jest.fn(),onPlanChange:jest.fn(),onTakePledge:jest.fn()};
 const view=render(<FunctionalToday {...props} onAllFeatures={onAllFeatures} />); fireEvent.press(view.getByTestId('home-all-features'));expect(setScreen).toHaveBeenCalledWith('features');
});
import { translateSource } from '@/i18n/runtime';
import { ProtectOverview } from '@/components/ProtectOverview';
jest.mock('expo-router', () => ({ Link: ({children}:any) => children, useFocusEffect: (effect: () => unknown) => require('react').useEffect(effect, [effect]) }));
jest.mock('@/components/EncryptedDnsSection', () => ({ EncryptedDnsSection: () => null }));
afterEach(async () => { await appI18n.changeLanguage('en'); });
test('real localized directory search and status update stay live',async()=>{
 await appI18n.changeLanguage('es'); const view=render(<FeatureDirectory context={context} onOpen={jest.fn()} onBack={jest.fn()} />);
 fireEvent.changeText(view.getByTestId('feature-search'),translateSource('Breathe')); expect(view.getByTestId('feature-breathe')).toBeOnTheScreen();
 fireEvent.changeText(view.getByTestId('feature-search'),'');view.rerender(<FeatureDirectory context={{...context,websiteStatus:'On',appStatus:'Off'}} onOpen={jest.fn()} onBack={jest.fn()} />);
 expect(view.getByTestId('feature-status-websites')).toHaveTextContent(translateSource('On'));expect(view.getByTestId('feature-status-apps')).toHaveTextContent(translateSource('Off'));
});
test('public Protect omits Focus Shield and the retained legacy route offers only an app-limits alternative',()=>{
 const overview=render(<ProtectOverview capability={null} status={null} settings={createDefaultRecoveryState().disciplineSettings} onSetup={jest.fn()} />);
 expect(overview.queryByTestId('shield-open-focus-shield')).toBeNull();overview.unmount();
 const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8'),start=source.indexOf('{section === "focus-shield" ? <>',source.indexOf('function ShieldScreen(')),end=source.indexOf('</> : null}',start);
 const fragment=source.slice(start+'{section === "focus-shield" ? '.length,end+3);const compiled=transpileModule(`return (${fragment});`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const push=jest.fn(),deps={React,Card:MomentumSection,Text,PillButton:({label,onPress}:any)=><Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>,router:{push}};
 const view=render(new Function(...Object.keys(deps),compiled)(...Object.values(deps)));expect(view.getByText(/Short-form filtering and calibration are unavailable/)).toBeOnTheScreen();
 fireEvent.press(view.getByRole('button',{name:'Open app limits'}));expect(push).toHaveBeenCalledWith('/shield/apps');expect(view.queryByText('Calibrate')).toBeNull();
});
test('focused account exposes the actual provider-link action directly',()=>{
 const Profile=productionProfile(),link=jest.fn();const view=render(<Profile focus="account" recoveryState={createDefaultRecoveryState()} premiumCapabilities={{}} relapseCount={0} onConnectAccount={link} />);
 fireEvent.press(view.getByText('Link another sign-in'));expect(link).toHaveBeenCalledTimes(1);expect(view.queryByTestId('form-backup')).toBeNull();
});
test('a successful movement self-report before midnight does not claim or block tomorrow after resume',async()=>{
 jest.useFakeTimers();jest.setSystemTime(new Date(2026,9,5,23,59));const save=jest.fn();
 const view=render(<BasicMovementScreen recorded={false} onRecord={save} onBack={jest.fn()} />);
 fireEvent.press(view.getByTestId('movement-self-report'));await act(async()=>fireEvent.press(view.getByTestId('movement-save')));
 expect(view.getByTestId('movement-saved')).toBeOnTheScreen();
 view.rerender(<BasicMovementScreen recorded onRecord={save} onBack={jest.fn()} />);
 jest.setSystemTime(new Date(2026,9,6,8));view.rerender(<BasicMovementScreen recorded={false} onRecord={save} onBack={jest.fn()} />);
 expect(view.queryByTestId('movement-saved')).toBeNull();expect(view.getByTestId('movement-self-report')).not.toBeChecked();expect(view.getByTestId('movement-save')).toBeDisabled();
 fireEvent.press(view.getByTestId('movement-self-report'));await act(async()=>fireEvent.press(view.getByTestId('movement-save')));
 expect(save.mock.calls).toEqual([['2026-10-05'],['2026-10-06']]);expect(view.getByTestId('movement-saved')).toBeOnTheScreen();jest.useRealTimers();
});

test('movement calendar refresh on real foreground callback drops yesterday’s success and choice',async()=>{
 jest.useFakeTimers();jest.setSystemTime(new Date(2026,9,5,23,59));mockMotionActive=true;
 const callbacks:((state:any)=>void)[]=[];const subscribe=jest.spyOn(require('react-native').AppState,'addEventListener').mockImplementation((_event:any,callback:any)=>{callbacks.push(callback);return {remove:jest.fn()};});
 const save=jest.fn(),back=jest.fn();const view=render(<BasicMovementScreen recorded={false} onRecord={save} onBack={back} />);
 fireEvent.press(view.getByTestId('movement-self-report'));await act(async()=>fireEvent.press(view.getByTestId('movement-save')));
 view.rerender(<BasicMovementScreen recorded recordedDateKey="2026-10-05" onRecord={save} onBack={back} />);
 jest.setSystemTime(new Date(2026,9,6,8));act(()=>callbacks.forEach(callback=>callback('active')));
 expect(view.queryByTestId('movement-saved')).toBeNull();expect(view.getByTestId('movement-self-report')).not.toBeChecked();expect(view.getByTestId('movement-save')).toBeDisabled();
 fireEvent.press(view.getByTestId('movement-self-report'));await act(async()=>fireEvent.press(view.getByTestId('movement-save')));
 expect(save.mock.calls).toEqual([['2026-10-05'],['2026-10-06']]);view.unmount();subscribe.mockRestore();mockMotionActive=false;jest.useRealTimers();
});
