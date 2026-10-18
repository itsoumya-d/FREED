import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('src/features/freed-app.tsx','utf8');
const tree=ts.createSourceFile('freed-app.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let returned:ts.Expression|undefined;let declarations:ts.Statement[]=[];
function visit(node:ts.Node){
 if(ts.isFunctionDeclaration(node)&&node.name?.text==='ChallengeScreen'){
  function completion(n:ts.Node){if(ts.isIfStatement(n)&&n.expression.getText(tree)==='done'){
    if(ts.isBlock(n.thenStatement))declarations=n.thenStatement.statements.filter(ts.isVariableStatement);
    function ret(r:ts.Node){if(ts.isReturnStatement(r))returned=r.expression;else ts.forEachChild(r,ret)}ret(n.thenStatement);
   }else ts.forEachChild(n,completion)}completion(node);
 }else ts.forEachChild(node,visit);
}
visit(tree);if(!returned)throw Error('Missing production completion UI');
const shell=({children}:any)=><View>{children}</View>;
const deps={React,View,ScrollView,Text,AppBackground:shell,SafeAreaView:shell,Card:shell,MomentumCompanion:()=>null,
 PillButton:({label,onPress}:any)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>,
 InlineNotice:({message}:any)=><Text>{message}</Text>,appI18n:{t:(_key:string,options?:any)=>options?.defaultValue?.replace('{{minutes}}',String(options.minutes))??'Choose what helps next.'}};
const code=ts.transpileModule(`exports.Screen = (props) => {
 const {canRequestUnlock,onRequestBreak,onFeedback,breakNotice=null,rewardSeconds=null,scopedReward=false,earnedOffer=null,earnedBreakExpiresAt=null,onRetryEarnedResume=undefined}=props;
 const sessionController={session:{id:'session'},storageError:null}, profile={disciplinePreferences:{unlockDurationMinutes:10}}, colors={}, typography={}, gradients={}, sessionNotice=null, setSessionNotice=()=>{};
 ${declarations.map(statement=>statement.getText(tree)).join("\n")}
 return ${returned.getText(tree)};
}`,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const out:any={};new Function(...Object.keys(deps),'exports',code)(...Object.values(deps),out);const Screen=out.Screen;
test('saved completion offers a separate app-break choice and does not request on mount or feedback',()=>{
 const request=jest.fn(),feedback=jest.fn(()=>true);const screen=render(<Screen canRequestUnlock onRequestBreak={request} onFeedback={feedback}/>);
 expect(request).not.toHaveBeenCalled();expect(screen.getByText('Your completed activity is saved. How you feel is optional.')).toBeTruthy();
 fireEvent.press(screen.getByRole('button',{name:'Urge Passed'}));expect(feedback).toHaveBeenCalledWith('session','helped');expect(request).not.toHaveBeenCalled();
 fireEvent.press(screen.getByRole('button',{name:'Use app for 10 minutes'}));expect(request).toHaveBeenCalledTimes(1);
 screen.rerender(<Screen canRequestUnlock={false} onRequestBreak={request} onFeedback={feedback} breakNotice="App break unavailable. Your completed activity is saved."/>);
 expect(screen.queryByRole('button',{name:'Use app for 10 minutes'})).toBeNull();fireEvent.press(screen.getByRole('button',{name:'Skip feedback'}));expect(request).toHaveBeenCalledTimes(1);
});
test('restored or ineligible completion retains feedback without an app-break action',()=>{
 const request=jest.fn();const screen=render(<Screen canRequestUnlock={false} onRequestBreak={request} onFeedback={()=>true}/>);expect(screen.queryByRole('button',{name:'Use app for 10 minutes'})).toBeNull();fireEvent.press(screen.getByRole('button',{name:'Still Need Support'}));expect(request).not.toHaveBeenCalled();
});

test('actual completion UI uses2/5 minute scoped reward and cannot fall back to legacy10',()=>{
 for(const [seconds,minutes] of [[120,2],[300,5]]){const request=jest.fn();const screen=render(<Screen canRequestUnlock scopedReward rewardSeconds={seconds} onRequestBreak={request} onFeedback={()=>true}/>);fireEvent.press(screen.getByRole('button',{name:`Use app for ${minutes} minutes`}));expect(request).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button',{name:'Use app for 10 minutes'})).toBeNull();screen.unmount();}
 const screen=render(<Screen canRequestUnlock scopedReward onRequestBreak={jest.fn()} onFeedback={()=>true}/>);expect(screen.queryByRole('button',{name:'Use app for 10 minutes'})).toBeNull();
});

test('v2 saved completion requires explicit Start5/10 action and cannot change selected duration',()=>{
 for(const seconds of [300,600]){const request=jest.fn();const screen=render(<Screen canRequestUnlock scopedReward earnedOffer={{requestedSeconds:seconds}} rewardSeconds={seconds} onRequestBreak={request} onFeedback={()=>true}/>);expect(request).not.toHaveBeenCalled();fireEvent.press(screen.getByRole('button',{name:`Start my ${seconds/60}-minute break`}));expect(request).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button',{name:`Use app for ${seconds/60} minutes`})).toBeNull();screen.unmount();}
});
