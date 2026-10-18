import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { JournalScreen } from '@/components/JournalScreen';
import { createDefaultRecoveryState, recordDailyCheckIn } from '@/lib/recovery-state';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/components/DirectionalIcons',()=>({ChevronLeft:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
jest.mock('@/design-system/motion',()=>({useMotionSettings:()=>({active:true})}));
beforeEach(()=>{jest.useFakeTimers({now:new Date(2026,9,5,12)});const values=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});});
afterEach(()=>jest.useRealTimers());
test('an explicitly selected past note opens exact private text and saves only its original day',()=>{
 const history=recordDailyCheckIn(createDefaultRecoveryState(),{mood:'steady',urgeLevel:2,sleepQuality:3,reflection:'私の記録\nMy note'},new Date(2026,9,3,12).toISOString()).dailyCheckIns;
 const save=jest.fn();const view=render(<JournalScreen record={null} history={history} onSave={save} onBack={jest.fn()} />);
 fireEvent.press(view.getByTestId('journal-entry-2026-10-03'));
 expect(view.getByTestId('journal-reflection')).toHaveProp('value','私の記録\nMy note');
 fireEvent.changeText(view.getByTestId('journal-reflection'),'私の記録\nUpdated words');
 fireEvent.press(view.getByTestId('journal-save'));
 expect(save).toHaveBeenCalledWith('私の記録\nUpdated words','2026-10-03','edit-existing');
});
test('history selection cannot overwrite an unsaved current draft',()=>{
 const history=recordDailyCheckIn(createDefaultRecoveryState(),{mood:'steady',urgeLevel:1,reflection:'Earlier'},new Date(2026,9,3,12).toISOString()).dailyCheckIns;
 const view=render(<JournalScreen record={null} history={history} onSave={jest.fn()} onBack={jest.fn()} />);
 fireEvent.changeText(view.getByTestId('journal-reflection'),'My unfinished words');
 expect(view.getByTestId('journal-entry-2026-10-03')).toBeDisabled();
 fireEvent.press(view.getByTestId('journal-entry-2026-10-03'));
 expect(view.getByTestId('journal-reflection')).toHaveProp('value','My unfinished words');
});
