import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Text, View, Pressable } from 'react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { usePersistentRecoveryState } from '@/lib/recovery-storage';
import { beginOwnerRestoreDeletion, wholeAppRestoreIntentKey } from '@/lib/whole-app-restore';
import { createOwnerRecoveryStore } from '@/lib/owner-recovery-store';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
test('actual owner hook hides history and blocks new recovery writes while durable deletion cleanup is pending',()=>{
 const values=new Map<string,string>(),owner='pending-ui-owner',storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{if(k===wholeAppRestoreIntentKey(owner))throw new Error('disk');values.delete(k);}};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 const ledger=createOwnerRecoveryStore({storage,currentOwnerUid:()=>owner});ledger.activate(owner).save({...createDefaultRecoveryState(),completedChallenges:11});storage.setItem(wholeAppRestoreIntentKey(owner),'private restore snapshot');
 expect(()=>beginOwnerRestoreDeletion(storage,owner,'account')).toThrow('disk');let current:any;
 function Probe(){current=usePersistentRecoveryState({ownerId:owner,readOwner:()=>owner});return <View><Text testID="visible-count">{current.state.completedChallenges}</Text><Text testID="cleanup-kind">{current.ownerCleanupPending}</Text></View>;}
 const view=render(<Probe/>);expect(view.getByTestId('visible-count')).toHaveTextContent('0');expect(view.getByTestId('cleanup-kind')).toHaveTextContent('account');expect(current.rollbackPending).toBe(true);
 act(()=>{expect(()=>current.persistRecoveryState(createDefaultRecoveryState())).toThrow(/before new writes/);});expect(ledger.readOwner(owner).completedChallenges).toBe(11);
});
test.each(['account','local'])('actual root pending %s cleanup guard exposes the correct retry instead of replaying backup state',async kind=>{
 const source=readFileSync(process.env.TASK4_FIX1_CONTROLLER_SOURCE??'src/features/freed-app.tsx','utf8'),start=source.indexOf('    if (rollbackPending) return'),end=source.indexOf('    if (privateViewLocked)',start);
 const code=transpileModule('return (()=>{'+source.slice(start,end)+'})();',{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.React}}).outputText;
 const retry=jest.fn(async()=>{}),rollback=jest.fn(),push=jest.fn();const deps={React,SafeAreaView:View,Text,rollbackPending:true,ownerCleanupPending:kind,colors:{bg:'#fff',text:'#111'},PillButton:({label,onPress}:any)=><Pressable testID="retry-cleanup" onPress={onPress}><Text>{label}</Text></Pressable>,router:{push},deleteLocalRecoveryData:retry,resumeOwner:rollback,setAccountNotice:jest.fn(),safeUserFacingMessage:(_e:any,f:string)=>f};
 const view=render(new Function(...Object.keys(deps),code)(...Object.values(deps)));expect(view.getByText('Private data cleanup is pending. Retry deletion before opening this history.')).toBeOnTheScreen();
 await act(async()=>fireEvent.press(view.getByTestId('retry-cleanup')));if(kind==='account')expect(push).toHaveBeenCalledWith('/account-deletion');else expect(retry).toHaveBeenCalledTimes(1);expect(rollback).not.toHaveBeenCalled();
});
