import React from 'react';
import { TextInput } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { useRecoveryDraft } from '@/hooks/use-recovery-draft';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
function Probe({owner}:{owner:string}){
 const draft=useRecoveryDraft('coach',{text:'',ownerUid:owner},{ownerId:owner} as any);
 return <TextInput testID="coach-draft" value={draft.value.text} onChangeText={text=>draft.update({text,ownerUid:owner})} />;
}
test('an account change cannot restore another owner’s unfinished chat input',()=>{
 const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
 const view=render(<Probe owner="owner-a"/>);fireEvent.changeText(view.getByTestId('coach-draft'),'Owner A private words');
 view.rerender(<Probe owner="owner-b"/>);expect(view.getByTestId('coach-draft')).toHaveProp('value','');
});
