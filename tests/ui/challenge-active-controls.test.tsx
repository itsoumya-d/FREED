import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { fireEvent, render, act } from '@testing-library/react-native';
import fs from 'node:fs';
import ts from 'typescript';
import { appI18n } from '@/i18n/runtime';
import { MOMENTUM_RESET_TEMPLATES } from '@/data/momentum-resets';
const source=fs.readFileSync('src/features/freed-app.tsx','utf8');
const tree=ts.createSourceFile('freed-app.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let active:ts.Expression|undefined;
for(const node of tree.statements)if(ts.isFunctionDeclaration(node)&&node.name?.text==='ChallengeScreen')for(const statement of node.body!.statements)if(ts.isReturnStatement(statement))active=statement.expression;
if(!active)throw Error('Missing production active challenge JSX');
const shell=({children}:any)=><View>{children}</View>;
const button=({label,onPress,disabled}:any)=><Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable>;
const deps={React,View,Text,ScrollView,Pressable,AppBackground:shell,SafeAreaView:shell,Card:shell,PillButton:button,BackButton:button,
 ChallengeText:({children,...props}:any)=><Text {...props}>{children}</Text>,ChallengeActivityScene:({progress}:any)=><Text testID="scene-evidence">{progress}</Text>,InlineNotice:({message}:any)=><Text>{message}</Text>,ShieldCheck:()=>null,Camera:()=>null,MessageCircleHeart:()=>null,ActivityIndicator:()=>null,appI18n};
const compiled=ts.transpileModule(`exports.Screen=(props)=>{const {challenge,sessionController,verification,nativeVerification,onBack=()=>{},onDiscard=()=>{},setChoosingReplacement=()=>{},setChallenge=()=>{},submitChallengeOutcome=()=>{},sessionNotice=null}=props;const colors={},typography={},seconds=1,max=60,profile={premium:false},capabilities={},done=false,completionSubmitting=false,onMessagePartner=undefined,connectionToken={current:null},rewardLabelForChallenge=undefined;const setSessionNotice=()=>{},getChallengeCapability=()=>({eligible:true}),tap=()=>{};return ${active.getText(tree)};}`,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const out:any={};new Function(...Object.keys(deps),'exports',compiled)(...Object.values(deps),out);const Screen=out.Screen;
const fixture=()=>({challenge:MOMENTUM_RESET_TEMPLATES.find(x=>x.id==='momentum-move-seated')!,sessionController:{running:true,pause:jest.fn(),resume:jest.fn(()=>true),storageError:null,connectionStage:null},verification:{satisfied:false,photoBusy:false,progress:'7/30 observed steps',status:'Keep FREED open.',requirement:{kind:'steps',label:'Steps observed',detail:'Carry your phone.'}},nativeVerification:{enabled:true,state:'active',cancel:jest.fn().mockResolvedValue(true)},submitChallengeOutcome:jest.fn(),setChoosingReplacement:jest.fn(),setChallenge:jest.fn(),onDiscard:jest.fn()});
test('actual active screen keeps pause, replacement and finish gated by real verification',()=>{
 const f=fixture();const view=render(<Screen {...f}/>);expect(view.getByTestId('scene-evidence')).toHaveTextContent('7/30 observed steps');
 fireEvent.press(view.getByRole('button',{name:'Pause reset'}));expect(f.sessionController.pause).toHaveBeenCalledTimes(1);
 fireEvent.press(view.getByRole('button',{name:'Choose a different reset'}));expect(f.sessionController.pause).toHaveBeenCalledTimes(2);expect(f.setChoosingReplacement).toHaveBeenCalledWith(true);expect(f.setChallenge).toHaveBeenCalledWith(null);
 const finish=view.getByRole('button',{name:'Continue your activity'});expect(finish).toBeDisabled();fireEvent.press(finish);expect(f.submitChallengeOutcome).not.toHaveBeenCalled();
 view.rerender(<Screen {...f} verification={{...f.verification,satisfied:true}}/>);fireEvent.press(view.getByRole('button',{name:"I'm Done"}));expect(f.submitChallengeOutcome).toHaveBeenCalledWith(f.challenge,'unknown');
});
test('pause retains explicit resume and native cancellation callback; storage error stays visible',async()=>{
 const f=fixture();f.sessionController.running=false;const view=render(<Screen {...f} sessionNotice="Reset could not be saved. Try saving again; your completion receipt is kept."/>);
 expect(view.getByText(/Reset could not be saved/)).toBeTruthy();fireEvent.press(view.getByRole('button',{name:'Resume reset'}));expect(f.sessionController.resume).toHaveBeenCalledTimes(1);
 await act(async()=>fireEvent.press(view.getByRole('button',{name:'Discard this guided reset'})));expect(f.nativeVerification.cancel).toHaveBeenCalledTimes(1);expect(f.onDiscard).toHaveBeenCalledTimes(1);
});
