import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {ProtectionFeatureSetup} from '@/components/ProtectionFeatureSetup';
import {ProtectOverview} from '@/components/ProtectOverview';
import {createDefaultDisciplineSettings} from '@/lib/recovery-state';
import {appI18n} from '@/i18n/runtime';
jest.mock('lucide-react-native',()=>new Proxy({}, {get:()=>()=>null}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/components/DirectionalIcons',()=>({ChevronRight:()=>null,ChevronLeft:()=>null}));
jest.mock('@/components/EncryptedDnsSection',()=>({EncryptedDnsSection:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'}),useOptionalAppPreferences:()=>null}));
jest.mock('expo-router',()=>({Link:({children}:any)=>children,useFocusEffect:(effect:any)=>require('react').useEffect(effect,[effect])}));
jest.mock('freed-protection',()=>({applyAdultContentFilter:jest.fn(),requestProtectionAuthorization:jest.fn(),presentFamilyActivityPicker:jest.fn(),openUsageAccessSettings:jest.fn(),openProtectionSettings:jest.fn(),openPrivateDnsSettings:jest.fn(),openVpnSettings:jest.fn(),openSafariExtensionSettings:jest.fn()}));
const ios={platform:'ios',screenTime:true,managedSettings:true,appGuardModes:true,appSchedules:true,accessibility:false,dnsFiltering:false,localVpnFallback:false,notes:[]} as any;
const ready={authorized:true,active:false,mode:'screen-time',message:'',selectedApplications:2,selectedCategories:3,appGuardMode:'before-use',appGuardModeConfigurationAccepted:true,appGuardReady:true} as any;
function setup(capability=ios,status=ready,save=jest.fn(async()=>ready)){
 const refresh=jest.fn(async()=>({capability,status})),limit=jest.fn(),sync=jest.fn(async()=>status);
 return {save,refresh,limit,sync,view:render(<ProtectionFeatureSetup intent="apps" capability={capability} status={status} appCount={0} onRefresh={refresh} onChooseApps={jest.fn()} onSyncApps={sync} onClose={jest.fn()} vpnDisclosureAcknowledged onAcknowledgeVpnDisclosure={jest.fn()} appGuardMode="before-use" onAppGuardSave={save} dailyLimitMinutes={30} onDailyLimitChange={limit}/>)};
}
beforeEach(async()=>{await appI18n.changeLanguage('en')});
test('mode draft and explicit save call real callback; default does not save on mount',async()=>{
 const {view,save,limit}=setup();await act(async()=>{});expect(save).not.toHaveBeenCalled();expect(view.queryByTestId('setup-limit-increase')).toBeNull();
 fireEvent.press(view.getByTestId('setup-mode-daily-limit'));expect(save).not.toHaveBeenCalled();fireEvent.press(view.getByTestId('setup-limit-increase'));expect(limit).toHaveBeenCalledWith(35);
 await act(async()=>{fireEvent.press(view.getByTestId('setup-mode-save'))});expect(save).toHaveBeenCalledWith('daily-limit');expect(view.getByRole('alert')).toHaveTextContent(/could not sync/);
});
test('rejected write remains retryable and successful save only reflects device acknowledgment',async()=>{
 const save=jest.fn().mockRejectedValueOnce(new Error('rejected')).mockResolvedValueOnce(ready);const {view}=setup(ios,ready,save);await act(async()=>{fireEvent.press(view.getByTestId('setup-mode-save'))});expect(view.getByRole('alert')).toHaveTextContent(/retry saving/);expect(view.getByTestId('setup-mode-save')).not.toBeDisabled();await act(async()=>{fireEvent.press(view.getByTestId('setup-mode-save'))});expect(save).toHaveBeenCalledTimes(2);expect(view.queryByRole('alert')).toBeNull();expect(view.getByTestId('setup-guard-state')).toHaveTextContent(/Device blocking: not tested/);
});
test('iOS category-only selection never makes modern guards ready, modes on legacy binaries unavailable',async()=>{
 const {view}=setup(ios,{...ready,selectedApplications:0,selectedCategories:8});await act(async()=>{});expect(view.getByTestId('setup-guard-state')).toHaveTextContent(/Ready: No/);expect(view.queryByRole('button',{name:'Done'})).toBeNull();view.unmount();const legacy=setup({...ios,appGuardModes:false},ready);await act(async()=>{});expect(legacy.view.getByTestId('setup-mode-before-use')).toBeDisabled();expect(legacy.view.queryByTestId('setup-mode-save')).toBeNull();expect(legacy.save).not.toHaveBeenCalled();
});
test('overview keeps the registered iOS target and mode summary compact, with technical scope behind details',async()=>{
 const view=render(<ProtectOverview capability={ios} status={{...ready,appGuardMode:'scheduled',appSchedulesSupported:true,appSchedulesConfigured:true,appSchedulesConfigurationAccepted:true,appSchedulesServiceConnected:true}} settings={createDefaultDisciplineSettings()} onSetup={jest.fn()}/>);await act(async()=>{});expect(view.getByTestId('protect-apps-target-summary')).toHaveTextContent(/2 selected apps/);expect(view.getByTestId('protect-apps-target-summary')).toHaveTextContent(/Scheduled/);expect(view.queryByText(/Registered time windows for selected individual iOS applications/)).toBeNull();expect(view.queryByText(/min\/day/)).toBeNull();fireEvent.press(view.getByTestId('protect-apps-details-toggle'));expect(view.getByText(/Registered time windows for selected individual iOS applications/)).toBeOnTheScreen();
});

import {readFileSync} from 'node:fs';
import {transpileModule, JsxEmit, ModuleKind} from 'typescript';
import {View, Text, Pressable, ScrollView, Switch} from 'react-native';
import {APP_GUARD_MODES, describeAppGuard} from '@/lib/app-guard';
import {getProtectionSetupReadiness} from '@/lib/protection-readiness';
import {DOOMSCROLL_APP_OPTIONS} from '@/lib/doomscroll-apps';
function productionEditor(section:'apps'|'schedules',capability=ios){
 const source=readFileSync(`${process.cwd()}/src/features/freed-app.tsx`,'utf8');
 const controls=source.slice(source.indexOf('function SettingToggle('),source.indexOf('function SettingStepper('));
 const screen=source.slice(source.indexOf('function ShieldScreen('),source.indexOf('function BackButton('));
 const compiled=transpileModule(`${controls}\n${screen}\nreturn ShieldScreen;`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const deps={freedShieldSectionTitle:(s:string)=>s,React,View,Text,Pressable,ScrollView,Switch,useAppTheme:()=>({colors:{},gradients:{},typography:{},mode:'light'}),useMomentumBottomPadding:()=>24,useWindowDimensions:()=>({width:390,fontScale:1}),describeAppGuard,getProtectionSetupReadiness,translateSource:(s:string)=>s,APP_GUARD_MODES,DOOMSCROLL_APP_OPTIONS,
 MomentumPageHeader:({children}:any)=><View>{children}</View>,PillButton:({label,onPress}:any)=><Pressable accessibilityRole="button" onPress={onPress}><Text>{label}</Text></Pressable>,Card:({children}:any)=><View>{children}</View>,SettingStepper:()=>null,SettingTimeInput:()=>null,formatUnlock:()=>'',appI18n};
 const Editor=new Function(...Object.keys(deps),compiled)(...Object.values(deps));const change=jest.fn();
 return {change,view:render(<Editor section={section} disciplineSettings={createDefaultDisciplineSettings()} protectionCapability={capability} protectionStatus={ready} activeUnlock={null} onDisciplineChange={change} onAttempt={jest.fn()} onRefreshProtection={jest.fn()} onOpenProtectionSetup={jest.fn()}/>)};
}
test('production app editor activates before-use only on an explicit save and passes selected mode through its settings callback',()=>{
 const {view,change}=productionEditor('apps');expect(change).not.toHaveBeenCalled();fireEvent.press(view.getByRole('button',{name:'Save guard mode'}));expect(change).toHaveBeenLastCalledWith({appGuardMode:'before-use'});fireEvent.press(view.getByRole('button',{name:'Scheduled'}));expect(change).toHaveBeenLastCalledWith({appGuardMode:'scheduled'});expect(view.getByText(/Choose individual applications/)).toBeOnTheScreen();
});
test('production iOS schedules expose supported native windows and strict callbacks with retained application scope',()=>{
 const {view,change}=productionEditor('schedules');const work=view.getByLabelText('Work hours 09:00-17:00');expect(work).not.toBeDisabled();fireEvent(work,'valueChange',true);expect(change).toHaveBeenLastCalledWith({workHoursEnabled:true});fireEvent(view.getByLabelText('Emergency strict mode'),'valueChange',true);expect(change).toHaveBeenLastCalledWith({emergencyStrictMode:true});expect(view.getByText(/only retained individual application selections/)).toBeOnTheScreen();
});

test('successful guarded save accepts final stable native status without replaying transient receipts',async()=>{
 const stable={...ready,appGuardModeConfigurationAccepted:undefined,appSchedulesConfigurationAccepted:undefined};const save=jest.fn(async()=>stable);const {view}=setup(ios,stable,save);await act(async()=>{fireEvent.press(view.getByTestId('setup-mode-save'))});expect(save).toHaveBeenCalledWith('before-use');expect(view.queryByRole('alert')).toBeNull();expect(view.getByTestId('setup-guard-state')).toHaveTextContent(/Ready: Yes/);
});
