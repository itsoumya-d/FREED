import React from 'react';
import {Pressable,Text} from 'react-native';
import {fireEvent,render} from '@testing-library/react-native';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('src/features/freed-app.tsx','utf8'),tree=ts.createSourceFile('freed-app.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let button:ts.Node|undefined;
const visit=(node:ts.Node)=>{if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==='PillButton'&&node.attributes.getText(tree).includes('nativeVerification.repairLabel'))button=node;else ts.forEachChild(node,visit)};visit(tree);
if(!button)throw Error('Missing actual native verification repair button');
const code=ts.transpileModule(`exports.Screen=({nativeVerification,sessionController})=>${button.getText(tree)};`,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const out:any={};const PillButton=({label,onPress}:any)=><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>;
new Function('React','PillButton','exports',code)(React,PillButton,out);const Screen=out.Screen;
test('actual repair control announces Settings action and resumes only through the explicit press',()=>{
 const retry=jest.fn(),resume=jest.fn();const screen=render(<Screen nativeVerification={{repairLabel:'Open app settings',retry}} sessionController={{running:false,resume}}/>);
 expect(retry).not.toHaveBeenCalled();expect(resume).not.toHaveBeenCalled();fireEvent.press(screen.getByRole('button',{name:'Open app settings'}));expect(resume).toHaveBeenCalledTimes(1);expect(retry).toHaveBeenCalledTimes(1);
});
