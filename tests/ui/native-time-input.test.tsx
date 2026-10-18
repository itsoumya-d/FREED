import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { NativeTimeInput } from '@/components/NativeTimeInput';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
jest.mock('@expo/ui/datetimepicker',()=>({DateTimePicker:(props:object)=>require('react').createElement(require('react-native').View,props)}));
let original: PropertyDescriptor | undefined;
beforeEach(()=>{original=Object.getOwnPropertyDescriptor(Platform,'OS');Object.defineProperty(Platform,'OS',{configurable:true,value:'ios'});});
afterEach(()=>{if(original)Object.defineProperty(Platform,'OS',original);});
test('a native time selection applies only on Done and cancel preserves the previous rule',()=>{
 const change=jest.fn();const view=render(<NativeTimeInput label="Sleep start" value="22:30" onChange={change}/>);
 fireEvent.press(view.getByRole('button',{name:'Sleep start time'}));fireEvent(view.getByTestId('setting-native-time-picker'),'onChange',{type:'set'},new Date(2026,9,4,20,15));
 expect(change).not.toHaveBeenCalled();fireEvent.press(view.getByTestId('setting-time-cancel'));expect(change).not.toHaveBeenCalled();
 fireEvent.press(view.getByRole('button',{name:'Sleep start time'}));fireEvent(view.getByTestId('setting-native-time-picker'),'onChange',{type:'set'},new Date(2026,9,4,20,15));fireEvent.press(view.getByTestId('setting-time-done'));expect(change).toHaveBeenCalledWith('20:15');
});
test('Android confirmation and dismissal unmount the system time dialog',()=>{
 Object.defineProperty(Platform,'OS',{configurable:true,value:'android'});
 const change=jest.fn();const view=render(<NativeTimeInput label="Work end" value="18:00" onChange={change}/>);
 fireEvent.press(view.getByRole('button',{name:'Work end time'}));fireEvent(view.getByTestId('setting-native-time-picker'),'onDismiss');expect(change).not.toHaveBeenCalled();expect(view.queryByTestId('setting-native-time-picker')).toBeNull();
 fireEvent.press(view.getByRole('button',{name:'Work end time'}));fireEvent(view.getByTestId('setting-native-time-picker'),'onChange',{type:'set'},new Date(2026,9,4,19,45));expect(change).toHaveBeenCalledWith('19:45');expect(view.queryByTestId('setting-native-time-picker')).toBeNull();
});
test('busy disables opening and applying a time picker without changing the saved time',()=>{
 const change=jest.fn();const view=render(<NativeTimeInput label="Night guard" value="23:15" onChange={change}/>);
 fireEvent.press(view.getByRole('button',{name:'Night guard time'}));
 fireEvent(view.getByTestId('setting-native-time-picker'),'onChange',{type:'set'},new Date(2026,9,7,22,0));
 view.rerender(<NativeTimeInput label="Night guard" value="23:15" onChange={change} disabled/>);
 expect(view.getByRole('button',{name:'Night guard time'})).toBeDisabled();expect(view.getByTestId('setting-time-done')).toBeDisabled();
 fireEvent.press(view.getByTestId('setting-time-done'));expect(change).not.toHaveBeenCalled();
});
