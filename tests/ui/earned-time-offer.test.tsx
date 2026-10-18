import React from 'react';
import {AppState} from 'react-native';
import {act,fireEvent,render} from '@testing-library/react-native';
import {I18nextProvider} from 'react-i18next';
import {appI18n} from '@/i18n/runtime';
import {EarnedTimeOfferPicker,EarnedTimeCountdown} from '@/components/EarnedTimeOfferPicker';
import {GuidedResetOffer} from '@/components/GuidedResetOffer';
jest.mock('@/design-system/use-app-theme',()=>({useAppTheme:()=>({colors:{text:'#111',text2:'#444',accent:'#137A60',onAccent:'#fff',surface:'#fff',surface2:'#eee',bg:'#fff'},typography:{bold:'700'}})}));
jest.mock('@/components/MomentumPageHeader',()=>({MomentumPageHeader:()=>null}));
const challenge={id:'preview',title:'Breathe comfortably',category:'breathing' as const,durationSec:60,intensity:'calm' as const,premium:false,icon:'Waves',why:'One comfortable minute.',steps:['Sit comfortably.','Breathe gently.'],verification:{version:1 as const,kind:'timer' as const}};
const wrapper=(content:React.ReactNode)=><I18nextProvider i18n={appI18n}>{content}</I18nextProvider>;
test('duration choice is explicit and unavailable native offer exposes help without an ad promise',()=>{
 const choose=jest.fn(),watch=jest.fn(),help=jest.fn();const picker=<EarnedTimeOfferPicker offer={{status:'unavailable',seconds:null,reason:'earned-time-unavailable',selection:null}} busy={false} onChoose={choose}/>;
 const screen=render(wrapper(<GuidedResetOffer tier="free" protectionOrigin challenge={challenge} busy={false} notice={null} repairNeeded={false} resumable={false} accessBlocked earnedTimeOffer={picker} onStart={()=>{}} onWatch={watch} onRepair={()=>{}} onRetry={()=>{}} onPro={()=>{}} onSafety={()=>{}} onHelp={help}/>));
 expect(screen.queryByRole('button',{name:/Watch one ad/})).toBeNull();expect(screen.getByText(/Update FREED/)).toBeTruthy();fireEvent.press(screen.getByRole('radio',{name:'10 minutes'}));expect(choose).toHaveBeenCalledWith(600);expect(watch).not.toHaveBeenCalled();fireEvent.press(screen.getByRole('button',{name:'Help now'}));expect(help).toHaveBeenCalledTimes(1);
});
test('pending offer preserves selection accessibility and prevents choice changes while SDK access is busy',()=>{
 const choose=jest.fn();const screen=render(wrapper(<EarnedTimeOfferPicker offer={{status:'loading',seconds:300,reason:null,selection:null}} busy onChoose={choose}/>));
 const five=screen.getByTestId('earned-time-300');expect(five.props.accessibilityState).toEqual({checked:true,disabled:true});fireEvent.press(five);expect(choose).not.toHaveBeenCalled();expect(screen.getByText('Checking this app’s available time…')).toBeTruthy();
});
test('receipt countdown uses continuous native deadline after background and ends without granting or extending',()=>{
 jest.useFakeTimers();jest.setSystemTime(new Date('2026-10-08T10:00:00Z'));Object.defineProperty(AppState,'currentState',{configurable:true,value:'active'});let lifecycle:(state:string)=>void=()=>{};
 const spy=jest.spyOn(AppState,'addEventListener').mockImplementation((_event,callback)=>{lifecycle=callback as any;return {remove:jest.fn()}});
 const screen=render(wrapper(<EarnedTimeCountdown expiresAt="2026-10-08T10:05:00Z"/>));expect(screen.getByText('Break ends in 5:00')).toBeTruthy();
 act(()=>lifecycle('background'));act(()=>jest.advanceTimersByTime(180000));act(()=>lifecycle('active'));expect(screen.getByText('Break ends in 2:00')).toBeTruthy();act(()=>jest.advanceTimersByTime(120000));expect(screen.getByText('This app break has ended. Your completed activity is saved.')).toBeTruthy();screen.unmount();spy.mockRestore();jest.useRealTimers();
});
test('native-supported requirements are disclosed before access and unsupported photo targets are never promised',()=>{
 const base:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:'12345678-1234-4123-8123-123456789abc',groupId:'group',groupRevision:1,configurationGeneration:1,scopeEpoch:1,kind:'ios-app-group',requestedSeconds:600,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T12:00:00Z',requiredActiveSeconds:120,requiredSteps:60,requiredDistinctPhotoTargets:2,availableMethods:['timer','steps','photo'],supportedPhotoTargetIds:['chair','cup']};
 const offer=(native:any):any=>({status:'ready',seconds:600,reason:null,selection:{receipt:{offer:native,budget:{remainingSeconds:1200}}}});
 const screen=render(wrapper(<EarnedTimeOfferPicker offer={offer(base)} busy={false} onChoose={()=>{}}/>));
 expect(screen.getByText('Or complete 60 observed steps with FREED open.')).toBeTruthy();
 expect(screen.getByText('Or match 2 different targets in fresh photos checked on this device.')).toBeTruthy();
 screen.rerender(wrapper(<EarnedTimeOfferPicker offer={offer({...base,supportedPhotoTargetIds:[]})} busy={false} onChoose={()=>{}}/>));
 expect(screen.queryByText('Or match 2 different targets in fresh photos checked on this device.')).toBeNull();
});
test('20-minute interruption choice appears only with native support and keeps120-second requirements',()=>{
 const choose=jest.fn();const state:any={status:'idle',seconds:1200,reason:null,selection:null,supportedBreakSeconds:[300,600,1200]};
 const screen=render(wrapper(<EarnedTimeOfferPicker offer={state} busy={false} onChoose={choose}/>));fireEvent.press(screen.getByTestId('earned-time-1200'));expect(choose).toHaveBeenCalledWith(1200);
 screen.rerender(wrapper(<EarnedTimeOfferPicker offer={{...state,supportedBreakSeconds:undefined,seconds:300}} busy={false} onChoose={choose}/>));expect(screen.queryByTestId('earned-time-1200')).toBeNull();expect(screen.getByTestId('earned-time-300')).toBeTruthy();expect(screen.getByTestId('earned-time-600')).toBeTruthy();expect(screen.getByTestId('earned-window-update-needed')).toBeTruthy();
});
