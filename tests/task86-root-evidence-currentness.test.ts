import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {transpileModule,ModuleKind} from 'typescript';
test('actual Root evidence callback retains immutable acknowledged admission across unknown to same-owner and replacement',()=>{
 const s=readFileSync(process.env.TASK86_ROOT_SOURCE??'src/features/freed-app.tsx','utf8'),start=s.indexOf('          nativeEvidenceIsCurrent={'),end=s.indexOf('\n          onNativeEvidence=',start),raw=s.slice(start,end),expression=raw.slice(raw.indexOf('{')+1,raw.lastIndexOf('}'));let current:any={actionScope:'opaque-A'};const original=current,origin:any={nativeActionScope:original.actionScope,sessionId:'session',earnedTime:{},attempt:{nativeInterventionId:'native',scope:{groupId:'group'}}};
 const deps={nativeAccountSnapshot:{admission:original},getFirebaseNativeAccountAdmission:()=>current,getProtectionActionScope:()=>current?.actionScope??null,challengeBreakOrigin:{current:origin},challengeSession:{getSnapshot:()=>({session:{id:'session'}})},getFirebaseAccountScope:()=> 'A',journeyOwner:'A',liveResetOwnerCurrent:()=>true,appConfigReadScope:{current:{ownerLease:{ownerUid:'A',isCurrent:()=>true},hydrated:true,storageReady:true}},activeAttemptRef:{current:origin.attempt}};
 const fn=new Function(...Object.keys(deps),transpileModule('return '+expression+';',{compilerOptions:{module:ModuleKind.CommonJS}}).outputText)(...Object.values(deps));assert.equal(fn(),true);current=null;assert.equal(fn(),false);current={actionScope:'opaque-new-A'};origin.nativeActionScope=current.actionScope;assert.equal(fn(),false,'Old render callback cannot borrow a later same-owner native acknowledgement');
});
