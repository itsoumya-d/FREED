import React from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Switch } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { useTranslation } from 'react-i18next';
import { appI18n, translateSource } from '@/i18n/runtime';
import { useAppTheme } from '@/design-system/use-app-theme';
import { MomentumSection, MomentumPageHeader } from '@/components/MomentumPageHeader';
import { MomentumSettingHeader } from '@/components/MomentumSettingHeader';
import { parseFreedProfileSection, freedProfileSectionPath, freedProfileSectionTitle } from '@/lib/native-navigation';
import { FEATURE_DEFINITIONS, FEATURE_DESTINATIONS } from '@/lib/feature-catalogue';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
import { NativeTimeInput } from '@/components/NativeTimeInput';
jest.mock('lucide-react-native',()=>new Proxy({}, {get:()=>()=>null}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useOptionalAppPreferences:()=>null,useAppPreferences:()=>({mode:'light'})}));
jest.mock('@/design-system/motion',()=>({useMotionSettings:()=>({active:true,spatialMotion:false,reduceMotion:true,focused:true,foreground:true})}));

function profileFixture({mode='light',email='private@example.com',version='1.2',build='37'}={}) {
 const source=readFileSync('src/features/freed-app.tsx','utf8');
 const profileStart=source.indexOf('function ProfileScreen('),profileEnd=source.indexOf('\nconst ADULT_FEED_REFRESH_INTERVAL_MS',profileStart);
 const reminderStart=source.indexOf('function ReminderSettingsCard('),reminderEnd=source.indexOf('\nfunction RetentionPlanCard',reminderStart);
 const Icon=()=>null,push=jest.fn(),openURL=jest.fn().mockResolvedValue(undefined);const received:Record<string,any>={};
 const form=(name:string)=>(props:any)=>{received[name]=props;return <Text testID={`actual-wiring-${name}`}>{name}</Text>;};
 const palette=require('@/design-system/app-palette').getAppPalette(mode);
 const theme=()=>({...useAppTheme(),...(palette?{colors:palette}:{}),mode});
 const deps={React,ScrollView,View,Text,Pressable,Switch,NativeTimeInput,useTranslation,useAppTheme:theme,useMomentumBottomPadding:()=>96,appI18n,translateSource,parseFreedProfileSection,freedProfileSectionPath,freedProfileSectionTitle,FEATURE_DEFINITIONS,FEATURE_DESTINATIONS,
 getFirebaseAccountSummary:()=>({signedIn:true,anonymous:false,email,providers:['password','google.com']}),getFirebaseAccountScope:()=> 'owner',getMembershipSummary:()=>({state:'active',accessThrough:Date.UTC(2026,9,8)}),Card:MomentumSection,MomentumPageHeader,MomentumSettingHeader,router:{push},Linking:{openURL},Constants:{nativeAppVersion:version,nativeBuildVersion:build},PillButton:({label,onPress,disabled}:any)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>,
  Shield:Icon,Sparkles:Icon,Users:Icon,Calendar:Icon,Target:Icon,Settings:Icon,Bell:Icon,FileLock:Icon,LifeBuoy:Icon,NotebookPen:Icon,Lock:Icon,ChevronRight:Icon,BarChart3:Icon,Sun:Icon,Moon:Icon,
  RetentionPlanCard:form('routine'),RecoveryBackupCard:form('backup'),AccountabilitySettingsCard:form('accountability'),PrivacySupportCard:form('privacy')};
 const compiled=transpileModule(`${source.slice(reminderStart,reminderEnd)}\n${source.slice(profileStart,profileEnd)}\nreturn ProfileScreen;`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const Profile=new Function(...Object.keys(deps),compiled)(...Object.values(deps));
 const state=createDefaultRecoveryState();
 const props={recoveryState:state,premium:true,premiumCapabilities:{sponsorAccountability:false,familySupport:true},reminders:{...state.reminders,statusMessage:'Permission denied. Open settings to allow reminders.'},smartReminderSuggestion:{guardTime:'22:00',reason:'Recorded evenings'},retentionPlan:{},accountability:state.accountability,supportCircle:[],reminderBusy:false,onReminderChange:jest.fn(),onReminderRepair:jest.fn(),onReminderTest:jest.fn(),reminderTestMessage:null,onConnectAccount:jest.fn(),onSignOut:jest.fn(),onManagePlan:jest.fn(),onPersonalize:jest.fn(),onLogSlip:jest.fn(),onOpenShield:jest.fn(),onRestoreBackup:jest.fn(),onAutomaticBackupChange:jest.fn(),onDeleteLocalData:jest.fn(),onDeleteAccountAndData:jest.fn(),onAccountabilityChange:jest.fn(),onSendSponsorReport:jest.fn(),onSendSupportCircleReport:jest.fn(),onSupportCircleChange:jest.fn(),onSupportCircleRemove:jest.fn(),onPendingFirebaseEmailLinkHandled:jest.fn(),accountNotice:null};
 return {Profile,props,push,openURL,received};
}
beforeEach(async()=>{await appI18n.changeLanguage('en');});
afterEach(async()=>{await appI18n.changeLanguage('en');});
test('rendered root has real membership/email, visible account notice, three direct rows and no embedded forms',()=>{
 const f=profileFixture();const view=render(<f.Profile {...f.props} accountNotice="Your account is connected"/>);
 expect(view.getByText('private@example.com')).toBeOnTheScreen();expect(view.getByText('Verified Premium access')).toBeOnTheScreen();expect(view.getByTestId('profile-account-notice')).toHaveTextContent('Your account is connected');
 expect(view.getAllByRole('button')).toHaveLength(3);expect(view.queryByText('Link another sign-in')).toBeNull();expect(view.queryByRole('switch')).toBeNull();expect(view.queryByTestId('actual-wiring-backup')).toBeNull();
 for(const section of ['routine','support-tools','settings']){fireEvent.press(view.getByTestId(`profile-open-${section}`));expect(f.push).toHaveBeenLastCalledWith(`/profile/${section}`);}
});
test('rendered Settings groups have direct Sign out at the bottom and functional rows',()=>{
 const f=profileFixture();const view=render(<f.Profile {...f.props} section="settings"/>);expect(view.getAllByRole('button')).toHaveLength(7);expect(view.queryByRole('switch')).toBeNull();expect(view.queryByText('Link another sign-in')).toBeNull();
 for(const section of ['account','membership','reminders','data-privacy','help-about']){fireEvent.press(view.getByTestId(`profile-open-${section}`));expect(f.push).toHaveBeenLastCalledWith(`/profile/${section}`);}
 fireEvent.press(view.getByTestId('profile-open-preferences'));expect(f.push).toHaveBeenLastCalledWith('/preferences');
 fireEvent.press(view.getByTestId('settings-sign-out'));expect(f.props.onSignOut).toHaveBeenCalledTimes(1);
});
test('focused account and membership use their real callbacks and keep provider text private',()=>{
 const f=profileFixture();const account=render(<f.Profile {...f.props} section="account"/>);fireEvent.press(account.getByRole('button',{name:'Link another sign-in'}));fireEvent.press(account.getByRole('button',{name:'Sign out'}));expect(f.props.onConnectAccount).toHaveBeenCalledTimes(1);expect(f.props.onSignOut).toHaveBeenCalledTimes(1);expect(account.getByText('Email · Google').props.translate).toBe(false);account.unmount();
 const membership=render(<f.Profile {...f.props} section="membership"/>);fireEvent.press(membership.getByTestId('profile-manage-membership'));expect(f.props.onManagePlan).toHaveBeenCalledTimes(1);expect(membership.getByText(/Access through/)).toBeOnTheScreen();
});
test('focused notification page uses requested native switches and disables busy actions',()=>{
 const f=profileFixture();const view=render(<f.Profile {...f.props} section="reminders"/>);
 expect(view.getByText('Permission denied. Open settings to allow reminders.')).toBeOnTheScreen();fireEvent(view.getByRole('switch',{name:'Recovery Reminders'}),'valueChange',true);expect(f.props.onReminderChange).toHaveBeenLastCalledWith({enabled:true});
 fireEvent(view.getByRole('switch',{name:'Morning reset'}),'valueChange',false);expect(f.props.onReminderChange).toHaveBeenLastCalledWith({morningEnabled:false});
 view.rerender(<f.Profile {...f.props} section="reminders" reminderBusy/>);expect(view.getByRole('switch',{name:'Recovery Reminders'})).toBeDisabled();const before=f.props.onReminderChange.mock.calls.length;fireEvent(view.getByRole('switch',{name:'Recovery Reminders'}),'valueChange',false);fireEvent(view.getByRole('switch',{name:'Morning reset'}),'valueChange',false);expect(f.props.onReminderChange).toHaveBeenCalledTimes(before);
});
test('notification permission repair and test require explicit taps and suggestion does not replace selected time',()=>{
 const f=profileFixture(); const reminders={...f.props.reminders,enabled:true,guardEnabled:true,guardTime:'23:15',permissionStatus:'denied',effectiveStatus:'permission-required'};
 const view=render(<f.Profile {...f.props} reminders={reminders} section="reminders"/>);
 expect(view.getByRole('switch',{name:'Recovery Reminders'})).toHaveProp('accessibilityState',expect.objectContaining({checked:true}));expect(f.props.onReminderChange).not.toHaveBeenCalled();expect(f.props.onReminderRepair).not.toHaveBeenCalled();expect(f.props.onReminderTest).not.toHaveBeenCalled();
 expect(view.getByRole('button',{name:'Night guard time'})).toHaveTextContent('23:15');
 fireEvent.press(view.getByTestId('reminder-repair'));expect(f.props.onReminderRepair).toHaveBeenCalledTimes(1);
 fireEvent.press(view.getByTestId('reminder-test'));expect(f.props.onReminderTest).toHaveBeenCalledTimes(1);
 fireEvent.press(view.getByTestId('reminder-apply-suggestion'));expect(f.props.onReminderChange).toHaveBeenLastCalledWith({guardTime:'22:00'});
});
test('focused native and retained feature destinations forward their actual data/capability/callback contracts',()=>{
 for(const section of ['routine','backup','accountability','privacy']){const f=profileFixture();const view=render(<f.Profile {...f.props} focus={section}/>);expect(view.getByTestId(`actual-wiring-${section}`)).toBeOnTheScreen();
 if(section==='backup'){expect(f.received.backup.onRestore).toBe(f.props.onRestoreBackup);expect(f.received.backup.onAutomaticBackupChange).toBe(f.props.onAutomaticBackupChange);}
 if(section==='accountability'){expect(f.received.accountability.canSendSponsorReport).toBe(false);expect(f.received.accountability.canUseSupportCircle).toBe(true);expect(f.received.accountability.onSendSupportCircleReport).toBe(f.props.onSendSupportCircleReport);expect(f.received.accountability.onManagePlan).toBe(f.props.onManagePlan);}
 if(section==='privacy'){expect(f.received.privacy.onDeleteLocalData).toBe(f.props.onDeleteLocalData);expect(f.received.privacy.onDeleteAccountAndData).toBe(f.props.onDeleteAccountAndData);}view.unmount();}
});
test('data/privacy and support directories expose focused pages; help uses actual routes and runtime version only',()=>{
 const f=profileFixture();let view=render(<f.Profile {...f.props} section="data-privacy"/>);for(const section of ['backup','privacy']){fireEvent.press(view.getByTestId(`profile-open-${section}`));expect(f.push).toHaveBeenLastCalledWith(`/profile/${section}`);}expect(view.queryByTestId('actual-wiring-backup')).toBeNull();fireEvent.press(view.getByTestId('privacy-delete-account'));expect(f.push).toHaveBeenLastCalledWith('/account-deletion');expect(f.props.onDeleteAccountAndData).not.toHaveBeenCalled();fireEvent.press(view.getByTestId('profile-open-analytics-consent'));expect(f.push).toHaveBeenLastCalledWith('/profile/analytics-consent');fireEvent.press(view.getByTestId('profile-open-cloud-consent'));expect(f.push).toHaveBeenLastCalledWith('/flow/coach');view.unmount();
 view=render(<f.Profile {...f.props} section="support-tools"/>);fireEvent.press(view.getByTestId('profile-open-accountability'));expect(f.push).toHaveBeenLastCalledWith('/profile/accountability');view.unmount();
 view=render(<f.Profile {...f.props} section="help-about"/>);expect(view.getByText('Version 1.2 (37)')).toBeOnTheScreen();for(const [label,path] of [['Support','/support'],['Privacy Policy','/privacy'],['Account Deletion Help','/account-deletion']]){fireEvent.press(view.getByRole('button',{name:label}));expect(f.push).toHaveBeenLastCalledWith(path);}fireEvent.press(view.getByRole('button',{name:'Terms of Service'}));expect(f.openURL).toHaveBeenCalledWith('https://freed-landing.web.app/terms');view.unmount();
 const missing=profileFixture({version:'',build:''});view=render(<missing.Profile {...missing.props} section="help-about"/>);expect(view.queryByText(/^Version/)).toBeNull();
});
test.each(['light','dark'])('Arabic %s source fixture keeps private email, directional rows, flexible 17pt type and 44pt targets',async mode=>{
 await act(async()=>appI18n.changeLanguage('ar'));const f=profileFixture({mode,email:'unchanged@example.com'});const view=render(<f.Profile {...f.props} section="settings"/>);
 const action=view.getByTestId('profile-open-account');expect(action.props.accessibilityLabel).toBe('الحساب');expect(StyleSheet.flatten(action.props.style).flexDirection).toBe('row-reverse');expect(StyleSheet.flatten(action.props.style).minHeight).toBeGreaterThanOrEqual(44);
 const label=view.getByText('الحساب');const style=StyleSheet.flatten(label.props.style);expect(style.fontSize).toBe(17);expect(style.writingDirection).toBe('rtl');expect(label.props.numberOfLines).toBeUndefined();expect(action.props.style.height).toBeUndefined();view.unmount();const root=render(<f.Profile {...f.props}/>);expect(root.getByText('unchanged@example.com').props.translate).toBe(false);
});

test('actual failed external terms action keeps Help usable with visible localized error',async()=>{const f=profileFixture();f.openURL.mockRejectedValueOnce(new Error('offline'));const view=render(<f.Profile {...f.props} section="help-about"/>);await act(async()=>fireEvent.press(view.getByRole('button',{name:'Terms of Service'})));expect(view.getByRole('alert')).toHaveTextContent('The terms could not open. Try again.');expect(view.getByRole('button',{name:'Support'})).toBeOnTheScreen();});
test('separate analytics consent page uses real enable, revoke and send callbacks and respects readiness',()=>{
 const f=profileFixture(),enable=jest.fn(),disable=jest.fn(),send=jest.fn();
 const extra={analyticsSharing:f.props.recoveryState.analyticsSharing,analyticsSharingReadiness:{ready:false,gaps:['consent-required']},analyticsSendBusy:false,onEnableAnalyticsSharing:enable,onDisableAnalyticsSharing:disable,onSendAnalyticsSnapshot:send};
 const view=render(<f.Profile {...f.props} {...extra} section="analytics-consent"/>);
 expect(view.getByTestId('profile-analytics-consent')).toBeOnTheScreen();expect(view.queryByTestId('progress-history')).toBeNull();
 expect(view.getByRole('button',{name:'Send Snapshot'})).toBeDisabled();fireEvent.press(view.getByRole('button',{name:'Enable Sharing'}));expect(enable).toHaveBeenCalledTimes(1);expect(send).not.toHaveBeenCalled();
 view.rerender(<f.Profile {...f.props} {...extra} analyticsSharing={{...extra.analyticsSharing,enabled:true}} analyticsSharingReadiness={{ready:true,gaps:[]}} section="analytics-consent"/>);
 fireEvent.press(view.getByRole('button',{name:'Turn Off'}));expect(disable).toHaveBeenCalledTimes(1);fireEvent.press(view.getByRole('button',{name:'Send Snapshot'}));expect(send).toHaveBeenCalledTimes(1);
});

test('unreadable reminder choices expose retry without fabricated switches or new notification work',()=>{
 const f=profileFixture();
 const view=render(<f.Profile {...f.props} section="reminders" reminderStateReadable={false} reminderTestMessage="Saved reminder choices could not be read. Existing reminders were kept. Retry to reload saved choices."/>);
 expect(view.getByTestId('reminder-effective-status')).toHaveTextContent('Reminder settings could not be loaded. Existing reminders were kept.');
 expect(view.queryByRole('switch')).toBeNull();
 expect(view.queryByRole('button',{name:'Night guard time'})).toBeNull();
 expect(view.queryByTestId('reminder-apply-suggestion')).toBeNull();
 expect(view.getByTestId('reminder-test')).toBeDisabled();
 fireEvent.press(view.getByTestId('reminder-test'));
 expect(f.props.onReminderChange).not.toHaveBeenCalled();
 expect(f.props.onReminderTest).not.toHaveBeenCalled();
 expect(f.props.onReminderRepair).not.toHaveBeenCalled();
 fireEvent.press(view.getByTestId('reminder-repair'));
 expect(f.props.onReminderRepair).toHaveBeenCalledTimes(1);
});

test('required advertising privacy options remain reachable for Premium in Data and privacy',()=>{
 const f=profileFixture(),open=jest.fn();const view=render(<f.Profile {...f.props} section="data-privacy" adPrivacyRequired onAdPrivacyOptions={open}/>);
 fireEvent.press(view.getByTestId('profile-ad-privacy-options'));expect(open).toHaveBeenCalledTimes(1);expect(f.props.onManagePlan).not.toHaveBeenCalled();
 view.rerender(<f.Profile {...f.props} section="data-privacy" adPrivacyRequired adPrivacyBusy onAdPrivacyOptions={open}/>);
 fireEvent.press(view.getByTestId('profile-ad-privacy-options'));expect(open).toHaveBeenCalledTimes(1);
 view.rerender(<f.Profile {...f.props} section="data-privacy" adPrivacyRequired={false} onAdPrivacyOptions={open}/>);expect(view.queryByTestId('profile-ad-privacy-options')).toBeNull();
});

test('ad privacy row announces disabled and busy while a native form request is pending',()=>{
 const f=profileFixture(),open=jest.fn();const view=render(<f.Profile {...f.props} section="data-privacy" adPrivacyRequired adPrivacyBusy onAdPrivacyOptions={open}/>);
 const row=view.getByTestId('profile-ad-privacy-options');expect(row).toBeDisabled();expect(row.props.accessibilityState).toEqual({disabled:true,busy:true});fireEvent.press(row);expect(open).not.toHaveBeenCalled();
 view.rerender(<f.Profile {...f.props} section="data-privacy" adPrivacyRequired onAdPrivacyOptions={open}/>);fireEvent.press(view.getByTestId('profile-ad-privacy-options'));expect(open).toHaveBeenCalledTimes(1);
});
