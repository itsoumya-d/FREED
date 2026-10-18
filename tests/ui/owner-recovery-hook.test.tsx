import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { usePersistentRecoveryState } from '@/lib/recovery-storage';
import { trustedPrivateOwner } from '@/lib/trusted-private-owner';
import { recordDailyCheckIn, createDefaultRecoveryState } from '@/lib/recovery-state';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
test('actual owner hook never renders a previous owner frame on SDK/snapshot mismatch, and stale writers cannot overwrite the replacement owner',()=>{
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});
 let sdk:string|null='hook-a',stale:any;
 function Probe({snapshotOwner}:{snapshotOwner:string|null}) {const snapshot={status:'ready' as const,signedIn:Boolean(snapshotOwner),anonymous:false,ownerUid:snapshotOwner,email:null};
  const owner=trustedPrivateOwner(snapshot,sdk),{state,persistRecoveryState}=usePersistentRecoveryState({ownerId:owner,readOwner:()=>trustedPrivateOwner(snapshot,sdk)});
  if(owner==='hook-a')stale=persistRecoveryState;return <><Text testID="reflection">{state.dailyCheckIns[0]?.reflection??'empty'}</Text><Pressable testID="write" onPress={()=>persistRecoveryState(recordDailyCheckIn(createDefaultRecoveryState(),{mood:'steady',urgeLevel:1,reflection:`private ${owner}`},'2026-10-07T12:00:00.000Z'))}/></>;
 }
 const view=render(<Probe snapshotOwner="hook-a"/>);fireEvent.press(view.getByTestId('write'));expect(view.getByTestId('reflection')).toHaveTextContent('private hook-a');const aWriter=stale;
 sdk='hook-b';view.rerender(<Probe snapshotOwner="hook-a"/>);expect(view.getByTestId('reflection')).toHaveTextContent('empty');
 view.rerender(<Probe snapshotOwner="hook-b"/>);fireEvent.press(view.getByTestId('write'));expect(view.getByTestId('reflection')).toHaveTextContent('private hook-b');
 act(()=>{expect(()=>aWriter(createDefaultRecoveryState())).toThrow(/owner changed/);});expect(view.getByTestId('reflection')).toHaveTextContent('private hook-b');
 sdk='hook-a';view.rerender(<Probe snapshotOwner="hook-a"/>);expect(view.getByTestId('reflection')).toHaveTextContent('private hook-a');view.unmount();
 const cold=render(<Probe snapshotOwner="hook-a"/>);expect(cold.getByTestId('reflection')).toHaveTextContent('private hook-a');
});
