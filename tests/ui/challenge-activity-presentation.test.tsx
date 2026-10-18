import React from 'react';
import { StyleSheet } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { appI18n, translateSource } from '@/i18n/runtime';
import { ChallengeActivityScene } from '@/components/ChallengeActivityScene';
import { ResetChoicePicker } from '@/components/ResetChoicePicker';
import { GuidedResetOffer } from '@/components/GuidedResetOffer';
import { MOMENTUM_RESET_TEMPLATES } from '@/data/momentum-resets';
import { getCategoryPanelPalette } from '@/design-system/app-palette';
import { getChallengeVerificationRequirement } from '@/lib/challenge-verification';
let mockMode='light',mockActive=true,mockReduce=false,mockCompanion='on';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:mockMode}),useOptionalAppPreferences:()=>({preferences:{companionMotion:mockCompanion}})}));
jest.mock('@/hooks/use-companion-viewport',()=>({useCompanionViewport:()=>({ref:undefined,onLayout:()=>{},visible:mockActive})}));
jest.mock('@/design-system/motion',()=>({...jest.requireActual('@/design-system/motion'),useMotionSettings:()=>({active:mockActive,spatialMotion:mockActive&&!mockReduce,focused:mockActive,foreground:mockActive,reduceMotion:mockReduce})}));
jest.mock('@/components/KiteCompanionRig',()=>({KiteCompanionRig:(props:any)=>{const {View}=require('react-native');return <View testID="activity-rig" {...props}/>;}}));
const breathe=MOMENTUM_RESET_TEMPLATES.find(x=>x.id==='momentum-breathe-soft')!;
const wrapper=(child:React.ReactNode)=><I18nextProvider i18n={appI18n}>{child}</I18nextProvider>;
const scene=(props:any={})=>wrapper(<ChallengeActivityScene challenge={breathe} elapsedSec={0} running progress="0/60 sec" status="" {...props}/>);
beforeEach(async()=>{mockMode='light';mockActive=true;mockReduce=false;mockCompanion='on';await appI18n.changeLanguage('en');});
afterEach(async()=>{await appI18n.changeLanguage('en');});
test('authored comfortable guidance follows actual active elapsed and freezes when paused; elapsed does not complete',()=>{
 const view=render(scene({elapsedSec:2}));expect(view.getByTestId('challenge-breathing-phase')).toHaveTextContent('Breathe in gently');expect(view.getByTestId('challenge-actual-progress')).toHaveTextContent('2 / 60 active seconds');
 view.rerender(scene({elapsedSec:4}));expect(view.getByTestId('challenge-breathing-phase')).toHaveTextContent('Let your breath out');
 const phase=view.getByTestId('activity-rig', {includeHiddenElements:true}).props.phaseProgress;const held=phase.value;
 view.rerender(scene({elapsedSec:4,running:false}));expect(view.getByTestId('challenge-breathing-phase')).toHaveTextContent('Paused');expect(phase.value).toBe(held);
 view.rerender(scene({elapsedSec:10}));expect(view.getByTestId('challenge-breathing-phase')).toHaveTextContent('Breathe in gently');
 view.rerender(scene({elapsedSec:60}));expect(view.queryByText('Challenge Complete')).toBeNull();expect(view.queryAllByRole('button')).toHaveLength(0);
});
test.each(['custom-private','legacy-box-pattern'])('private or legacy %s does not acquire a new4/6 breathing instruction',id=>{
 const view=render(scene({challenge:{...breathe,id},elapsedSec:4}));expect(view.queryByTestId('challenge-breathing-phase')).toBeNull();
});
test.each(['blur/background/offscreen','reduce-motion','companion-off'])('%s prevents animated phase work',gate=>{
 const view=render(scene({elapsedSec:2}));
 if(gate==='blur/background/offscreen')mockActive=false;if(gate==='reduce-motion')mockReduce=true;if(gate==='companion-off')mockCompanion='off';
 view.rerender(scene({elapsedSec:4}));expect(view.getByTestId('activity-rig', {includeHiddenElements:true}).props.animated).toBe(false);
});
test('observed-step and local-photo scenes show actual evidence instead of elapsed percentage',()=>{
 const move=MOMENTUM_RESET_TEMPLATES.find(x=>x.id==='momentum-move-steps')!;
 const view=render(scene({challenge:move,elapsedSec:120,progress:'8/30 observed steps',status:'Keep FREED open.'}));expect(view.getByTestId('challenge-actual-progress')).toHaveTextContent('8/30 observed steps');expect(view.queryByText('100%')).toBeNull();
 const photo=MOMENTUM_RESET_TEMPLATES.find(x=>x.id==='momentum-find-chair')!;
 view.rerender(scene({challenge:photo,elapsedSec:120,progress:'1/2 different targets matched'}));expect(view.getByTestId('challenge-actual-progress')).toHaveTextContent('1/2 different targets matched');
 view.rerender(scene({challenge:photo,elapsedSec:120,progress:'',status:'Verification unavailable'}));expect(view.getByTestId('challenge-actual-progress')).toHaveTextContent('Verification unavailable');
});
test.each(['light','dark'])('%s keeps large scene/category surfaces semantic and text unconstrained',mode=>{
 mockMode=mode;const view=render(scene());expect(StyleSheet.flatten(view.getByTestId('challenge-activity-scene').props.style).backgroundColor).toBe(getCategoryPanelPalette('calm',mode as any).surface);
 expect(view.getByTestId('challenge-actual-progress').props.numberOfLines).toBeUndefined();view.unmount();
 const picker=render(wrapper(<ResetChoicePicker choices={[{group:'breathe',challenge:breathe}]} onChoose={()=>{}}/>));expect(StyleSheet.flatten(picker.getByTestId('reset-category-breathe').props.style).backgroundColor).toBe(getCategoryPanelPalette('calm',mode as any).surface);expect(StyleSheet.flatten(picker.getByTestId('reset-choice-breathe').props.style).minHeight).toBeGreaterThanOrEqual(44);
});
test('Arabic choice retains category→title→evidence reading order and unclipped scalable copy',async()=>{
 await act(async()=>{await appI18n.changeLanguage('ar');});const view=render(wrapper(<ResetChoicePicker choices={[{group:'breathe',challenge:breathe}]} onChoose={()=>{}}/>));
 const category=appI18n.t('resetChoices.breathe'),title=translateSource(breathe.title),requirement=appI18n.t('resetRecoveryUi.breatheTimer',{seconds:60});
 const action=view.getByTestId('reset-choice-breathe');expect(action.props.accessibilityLabel).toBe(`${category}. ${title}. ${requirement}`);
 for(const text of [category,title,requirement]){const visible=view.getByText(text);expect(visible.props.numberOfLines).toBeUndefined();expect(StyleSheet.flatten(visible.props.style).textAlign).toBe('right');}
 expect(view.getByRole('header',{name:category})).toBeTruthy();
});
test('real earned offer replaces generic recommendation so120seconds cannot be contradicted by60',()=>{
 const {Text}=require('react-native');const props:any={tier:'free',protectionOrigin:true,challenge:breathe,busy:false,notice:null,repairNeeded:false,resumable:false,onStart:jest.fn(),onWatch:jest.fn(),onRepair:jest.fn(),onRetry:jest.fn(),onPro:jest.fn(),onSafety:jest.fn(),onHelp:jest.fn()};
 const view=render(wrapper(<GuidedResetOffer {...props} earnedTimeOffer={<Text>120 active seconds for a20-minute break</Text>}/>));expect(view.queryByTestId('guided-activity-preview')).toBeNull();expect(view.getByText('120 active seconds for a20-minute break')).toBeTruthy();
 const buttons=view.getAllByRole('button');expect(buttons[0].props.accessibilityLabel).toBe('Watch one ad — start this guided challenge');expect(props.onWatch).not.toHaveBeenCalled();
});
test('all ten semantic copies contain every new key and preserve placeholders',()=>{
 const fs=require('node:fs');const batch=JSON.parse(fs.readFileSync('src/i18n/batches/challenge-presentation-20261012.json','utf8'));
 for(const locale of ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans']){const catalog=JSON.parse(fs.readFileSync(`src/i18n/locales/${locale}.json`,'utf8'));for(const entry of batch.entries){const value=catalog.resetChoices[entry.key.split('.')[1]];expect(value).toBe(locale==='en'?entry.source:entry.translations[locale]);expect([...value.matchAll(/{{(\w+)}}/g)].map((x:any)=>x[1]).sort()).toEqual([...entry.source.matchAll(/{{(\w+)}}/g)].map((x:any)=>x[1]).sort());}}
});
