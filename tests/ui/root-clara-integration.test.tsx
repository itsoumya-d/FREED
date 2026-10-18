import React from 'react';
import { act, render, fireEvent, within } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { Text, View, TextInput, Pressable } from '@/components/Localized';
import { ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { CoachConversationLayout } from '@/components/CoachConversationLayout';
import { ClaraCompactHeader } from '@/components/ClaraCompactHeader';
import { ClaraConsentSheet } from '@/components/ClaraConsentSheet';
import { ClaraCloudControls } from '@/components/ClaraCloudControls';
import { createCoachSendController } from '@/lib/ai-coach';
import { readCloudChatConsent, saveCloudChatConsent, replyWithClaraConversation, configureClaraConversationTransport, CLARA_CLOUD_CONSENT } from '@/lib/clara-conversation';
import { useRecoveryDraft } from '@/hooks/use-recovery-draft';
import { OwnerPrivateDraftContext, createOwnerPrivateDraftStorage } from '@/lib/owner-private-drafts';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n } from '@/i18n/runtime';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'}),useOptionalAppPreferences:()=>null}));
jest.mock('@/components/DirectionalIcons',()=>({ArrowLeft:()=>null}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('lucide-react-native',()=>new Proxy({}, {get:()=>()=>null}));
jest.mock('expo-sqlite/localStorage/install',()=>({}));
// Keep native Modal as a boundary; Task5 tests the real consent sheet independently.
jest.mock('@/components/ClaraConsentSheet',()=>{const R=require('react'),N=require('react-native');return {ClaraConsentSheet:({visible,onClose,children}:any)=>visible?R.createElement(N.View,null,R.createElement(N.Pressable,{accessibilityRole:'button',accessibilityLabel:'Close cloud settings',onPress:onClose},R.createElement(N.Text,null,'Close cloud settings')),children):null};});
function fixture(conversationIntegration=false) {
 const source=readFileSync('src/features/freed-app.tsx','utf8'),start=source.indexOf('function CoachPanel('),end=source.indexOf('\nfunction CheckInScreen',start);
 const compiled=transpileModule(source.slice(start,end)+';return CoachPanel;',{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const noticeStart=source.indexOf('function InlineNotice('),noticeEnd=source.indexOf('\nfunction EmptyState',noticeStart);
 const noticeCompiled=transpileModule(source.slice(noticeStart,noticeEnd)+';return InlineNotice;',{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const noticeDeps={React,Text,View,Pressable,useAppTheme,radii:{lg:16},tap:()=>{},LifeBuoy:()=>null,Check:()=>null,Bell:()=>null};
 const InlineNotice=new Function(...Object.keys(noticeDeps),noticeCompiled)(...Object.values(noticeDeps));
 let failDraftWrite=false,failDraftRead=false;
 const draftWrites:string[]=[];
 const values=new Map<string,string>(),storage={getItem:(k:string)=>{if(failDraftRead&&k.endsWith('freed.recovery.draft.coach.v1'))throw Error('draft read unavailable');return values.get(k)??null;},setItem:(k:string,v:string)=>{if(k.endsWith('freed.recovery.draft.coach.v1')){if(failDraftWrite)throw Error('draft storage unavailable');draftWrites.push(v);}values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});let owner='clara-a',release:((reply:any)=>void)|undefined;
 if(conversationIntegration)saveCloudChatConsent(storage,owner,{version:CLARA_CLOUD_CONSENT,enabled:true,includeConversation:true});
 let eventSequence=0;
 const reply=jest.fn((input:string,...args:any[])=>conversationIntegration?replyWithClaraConversation(input,args[0],args[1]):new Promise(resolve=>{release=resolve;}));const persisted=jest.fn(),back=jest.fn();
 const deps={React,Text,View,TextInput,Pressable,ScrollView,ActivityIndicator,useAppTheme,CoachConversationLayout,ClaraCompactHeader,ClaraConsentSheet,ClaraCloudControls,useRecoveryDraft,createCoachSendController,readCloudChatConsent,saveCloudChatConsent,
  getFirebaseAccountScope:()=>owner,replyWithClaraConversation:reply,appI18n,getRandomBytesAsync:async()=>new Uint8Array(16).fill(++eventSequence),tap:()=>{},redactCoachText:(v:string)=>v,
  InlineNotice,ShieldCheck:()=>null,Send:()=>null,Brain:()=>null,LifeBuoy:()=>null};
 const Panel=new Function(...Object.keys(deps),compiled)(...Object.values(deps));
 const props={recoveryState:createDefaultRecoveryState(),attempts:[],streakDays:3,attemptsToday:0,premium:false,slipsThisWeek:0,slipWindow:'',slipTrigger:'',onPersistMessages:persisted,onBack:back,
  initialMessages:conversationIntegration?[{role:'user' as const,text:'A deliberately shared earlier message'},{role:'ai' as const,text:'Local private history must not leave'}]:undefined};
 const ui=()=> <View><OwnerPrivateDraftContext.Provider value={{ownerId:owner,storage:createOwnerPrivateDraftStorage(storage,owner,()=>true)}}><Panel key={owner} {...props}/></OwnerPrivateDraftContext.Provider></View>;
 return {ui,reply,persisted,back,values,draftWrites,setDraftReadFailure:(v:boolean)=>{failDraftRead=v;},setDraftWriteFailure:(v:boolean)=>{failDraftWrite=v;},setOwner:(v:string)=>{owner=v;},finish:(value:any)=>release!(value)};
}
test('actual root CLARA settings keep explicit consent and observed service status, with bounded composer and functioning back',async()=>{
 const f=fixture(),view=render(f.ui());expect(view.getByTestId('clara-compact-header')).toBeOnTheScreen();expect(view.getByText('Built-in guidance')).toBeOnTheScreen();
 expect(StyleSheet.flatten(view.getByTestId('clara-message').props.style).maxHeight).toBe(120);fireEvent.press(view.getByTestId('clara-open-settings'));fireEvent(view.getByTestId('clara-cloud-toggle'),'valueChange',true);
 expect(f.reply).not.toHaveBeenCalled();fireEvent.press(view.getByTestId('clara-enable-cloud'));expect(view.getByText('Cloud permission on')).toBeOnTheScreen();expect(view.queryByText('Cloud reply received')).toBeNull();
 fireEvent.press(view.getByRole('button',{name:'Close cloud settings'}));fireEvent.changeText(view.getByTestId('clara-message'),'one deliberate message');
 fireEvent(view.getByTestId('clara-message'),'submitEditing');await act(async()=>{await Promise.resolve();});expect(f.reply).toHaveBeenCalledTimes(1);
 await act(async()=>f.finish({text:'Local fallback reply',provider:'fallback',status:'fallback',serviceState:'unavailable'}));expect(view.getByText('Cloud unavailable')).toBeOnTheScreen();expect(view.queryByText('Cloud reply received')).toBeNull();
 fireEvent.press(view.getByRole('button',{name:'Back'}));expect(f.back).toHaveBeenCalledTimes(1);
});
test('actual unavailable CLARA retry retains the original message and draft, sends once, and keeps local help while cancellable',async()=>{
 const f=fixture(),view=render(f.ui());
 fireEvent.press(view.getByTestId('clara-open-settings'));fireEvent(view.getByTestId('clara-cloud-toggle'),'valueChange',true);
 fireEvent.press(view.getByTestId('clara-enable-cloud'));fireEvent.press(view.getByRole('button',{name:'Close cloud settings'}));
 fireEvent.changeText(view.getByTestId('clara-message'),'Keep my original message');fireEvent(view.getByTestId('clara-message'),'submitEditing');
 await act(async()=>{await Promise.resolve();});
 await act(async()=>f.finish({text:'Three slow breaths remain available.',provider:'fallback',status:'fallback',serviceState:'unavailable',action:'none',quota:{remaining:null,limit:null,resetsAt:null}}));
 expect(view.getByText('Cloud unavailable')).toBeOnTheScreen();
 fireEvent.changeText(view.getByTestId('clara-message'),'A separate unsent draft');
 const retry=view.getByRole('button',{name:'Retry'});
 await act(async()=>{fireEvent.press(retry);fireEvent.press(retry);await Promise.resolve();});
 expect(f.reply).toHaveBeenCalledTimes(2);
 expect(f.reply.mock.calls[1][0]).toBe('Keep my original message');
 expect(view.getAllByText('Keep my original message')).toHaveLength(1);
 expect(view.getByTestId('clara-message')).toHaveProp('value','A separate unsent draft');
 expect(view.getByText('Three slow breaths remain available.')).toBeOnTheScreen();
 fireEvent.press(view.getByRole('button',{name:'Stop waiting'}));
 await act(async()=>f.finish({text:'Cancelled reply must not render',provider:'remote',status:'ok',serviceState:'online',action:'none',quota:{remaining:2,limit:3,resetsAt:null}}));
 expect(view.queryByText('Cancelled reply must not render')).toBeNull();
 expect(view.getByTestId('clara-message')).toHaveProp('value','A separate unsent draft');
 expect(view.getByText('Three slow breaths remain available.')).toBeOnTheScreen();
 fireEvent.press(view.getByRole('button',{name:'Back'}));expect(f.back).toHaveBeenCalledTimes(1);
});
test('actual CLARA owner remount keeps original draft private and rejects a late reply from the old owner',async()=>{
 const f=fixture(),view=render(f.ui());fireEvent.changeText(view.getByTestId('clara-message'),'Owner A unsent draft');
 f.setOwner('clara-b');view.rerender(f.ui());expect(view.getByTestId('clara-message')).toHaveProp('value','');
 f.setOwner('clara-a');view.rerender(f.ui());expect(view.getByTestId('clara-message')).toHaveProp('value','Owner A unsent draft');
 fireEvent(view.getByTestId('clara-message'),'submitEditing');await act(async()=>{await Promise.resolve();});f.setOwner('clara-b');view.rerender(f.ui());
 await act(async()=>f.finish({text:'Old owner reply must not render',provider:'remote',status:'ok',serviceState:'online'}));expect(view.queryByText('Old owner reply must not render')).toBeNull();expect(f.persisted.mock.calls.flat().flat().some((v:any)=>v?.text==='Old owner reply must not render')).toBe(false);
});
test.each(['basic-help','daily-quota-exhausted','budget-exhausted','duplicate','account-deleting','rate-limited'])('actual CLARA %s fallback keeps its service status and local help without an unavailable retry',async serviceState=>{
 const f=fixture(),view=render(f.ui());
 fireEvent.press(view.getByTestId('clara-open-settings'));fireEvent(view.getByTestId('clara-cloud-toggle'),'valueChange',true);
 fireEvent.press(view.getByTestId('clara-enable-cloud'));fireEvent.press(view.getByRole('button',{name:'Close cloud settings'}));
 fireEvent.changeText(view.getByTestId('clara-message'),'My deliberate words');fireEvent(view.getByTestId('clara-message'),'submitEditing');await act(async()=>{await Promise.resolve();});
 await act(async()=>f.finish({text:'A useful local recovery guide.',provider:'fallback',status:'fallback',serviceState,action:'none',quota:{remaining:0,limit:3,resetsAt:null}}));
 expect(view.getByText('A useful local recovery guide.')).toBeOnTheScreen();expect(view.queryByRole('button',{name:'Retry'})).toBeNull();
 expect(view.getByRole('button',{name:'Back'})).toBeOnTheScreen();
});
test('actual CLARA deliberate local mode keeps local help without presenting a reconnect action',async()=>{
 const f=fixture(),view=render(f.ui());fireEvent.changeText(view.getByTestId('clara-message'),'Keep this local');fireEvent(view.getByTestId('clara-message'),'submitEditing');
 await act(async()=>{await Promise.resolve();});await act(async()=>f.finish({text:'Local help with cloud permission off.',provider:'local',status:'ok',serviceState:'unavailable'}));
 expect(view.getByText('Built-in guidance')).toBeOnTheScreen();expect(view.getByText('Local help with cloud permission off.')).toBeOnTheScreen();expect(view.queryByRole('button',{name:'Retry'})).toBeNull();
});
test('actual CoachPanel unavailable retry preserves chosen prior conversation, excludes the retained current message, and creates a fresh attempt ID',async()=>{
 const payloads:any[]=[];
 configureClaraConversationTransport(async payload=>{payloads.push(payload);return payloads.length===1?
  {text:'',provider:'fallback',serviceState:'unavailable',action:'none',quota:{remaining:2,limit:3,resetsAt:null}}:
  {text:'Cloud reply after explicit retry.',provider:'remote',serviceState:'online',action:'breathe',quota:{remaining:1,limit:3,resetsAt:null}};});
 try{
  const f=fixture(true),view=render(f.ui());fireEvent.changeText(view.getByTestId('clara-message'),'My retained current message');
  await act(async()=>{fireEvent(view.getByTestId('clara-message'),'submitEditing');await Promise.resolve();});
  expect(view.getByText('Cloud unavailable')).toBeOnTheScreen();
  await act(async()=>{fireEvent.press(view.getByRole('button',{name:'Retry'}));await Promise.resolve();});
  expect(payloads).toHaveLength(2);
  expect(payloads.map(payload=>payload.clientEventId)).toEqual(['clara_01010101010101010101010101010101','clara_02020202020202020202020202020202']);
  expect(payloads.map(payload=>payload.conversation)).toEqual([
   [{role:'user',text:'A deliberately shared earlier message'}],
   [{role:'user',text:'A deliberately shared earlier message'}],
  ]);
  expect(payloads.map(payload=>payload.input)).toEqual(['My retained current message','My retained current message']);
  expect(view.getAllByText('My retained current message')).toHaveLength(1);expect(view.getByText('Cloud reply after explicit retry.')).toBeOnTheScreen();
  expect(view.getByText('Cloud reply received')).toBeOnTheScreen();expect(view.queryByRole('button',{name:'Retry'})).toBeNull();
 }finally{configureClaraConversationTransport(null);}
});
test('actual CLARA draft-storage Retry after saved unavailable reply repairs only the unsent draft; cloud Retry remains an explicit separate attempt',async()=>{
 const payloads:any[]=[];
 configureClaraConversationTransport(async payload=>{payloads.push(payload);return payloads.length===1?
  {text:'',provider:'fallback',serviceState:'unavailable',action:'none',quota:{remaining:2,limit:3,resetsAt:null}}:
  {text:'Cloud reply from the separate deliberate action.',provider:'remote',serviceState:'online',action:'none',quota:{remaining:1,limit:3,resetsAt:null}};});
 try{
  const f=fixture(true),view=render(f.ui());fireEvent.changeText(view.getByTestId('clara-message'),'The saved original message');
  await act(async()=>{fireEvent(view.getByTestId('clara-message'),'submitEditing');await Promise.resolve();});
  expect(view.getByText('Cloud unavailable')).toBeOnTheScreen();
  f.setDraftWriteFailure(true);fireEvent.changeText(view.getByTestId('clara-message'),'A separate unsent draft');
  const error='Your draft could not be kept on this device. Free up space and try again before leaving.';
  const storageNotice=view.UNSAFE_getByProps({message:error});
  f.setDraftWriteFailure(false);
  await act(async()=>{fireEvent.press(within(storageNotice).getByRole('button',{name:'Retry'}));await Promise.resolve();});
  expect(payloads).toHaveLength(1);expect(f.reply).toHaveBeenCalledTimes(1);
  expect(view.getAllByText('The saved original message')).toHaveLength(1);expect(view.getByTestId('clara-message')).toHaveProp('value','A separate unsent draft');
  expect(f.values.get('freed.private.owner.clara-a.freed.recovery.draft.coach.v1')).toContain('A separate unsent draft');
  expect(view.queryByText(error)).toBeNull();expect(view.getByText('Cloud unavailable')).toBeOnTheScreen();
  await act(async()=>{fireEvent.press(view.getByRole('button',{name:'Retry'}));await Promise.resolve();});
  expect(payloads).toHaveLength(2);expect(payloads.map(payload=>payload.input)).toEqual(['The saved original message','The saved original message']);
  expect(payloads.map(payload=>payload.clientEventId)).toEqual(['clara_01010101010101010101010101010101','clara_02020202020202020202020202020202']);
  expect(view.getAllByText('The saved original message')).toHaveLength(1);expect(view.getByTestId('clara-message')).toHaveProp('value','A separate unsent draft');
 }finally{configureClaraConversationTransport(null);}
});
test('actual CLARA load-error Retry rereads the retained owner draft without overwriting it or dispatching cloud work',async()=>{
 const f=fixture(true),key='freed.private.owner.clara-a.freed.recovery.draft.coach.v1';
 const retained=JSON.stringify({version:1,kind:'coach',value:{text:'My retained unsent private message',ownerUid:'clara-a'}});
 f.values.set(key,retained);f.setDraftReadFailure(true);
 const view=render(f.ui());expect(view.getByTestId('clara-message')).toHaveProp('value','');
 const notice=view.UNSAFE_getByProps({message:'Your draft could not be loaded. Check device storage and try again.'});
 f.setDraftReadFailure(false);
 await act(async()=>{fireEvent.press(within(notice).getByRole('button',{name:'Retry'}));await Promise.resolve();});
 expect(view.getByTestId('clara-message')).toHaveProp('value','My retained unsent private message');
 expect(f.values.get(key)).toBe(retained);expect(f.draftWrites).toEqual([]);expect(f.reply).not.toHaveBeenCalled();expect(f.persisted).not.toHaveBeenCalled();
 expect(view.queryByText('Your draft could not be loaded. Check device storage and try again.')).toBeNull();
});
