import React from 'react';
import { render } from '@testing-library/react-native';
import { I18nManager, Platform, Text } from 'react-native';
import { AppPreferencesProvider, useAppPreferences } from '@/hooks/use-app-preferences';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('expo-localization', () => ({getLocales:() => [{languageTag:'ar-SA', textDirection:'rtl'}]}));
function Probe(){const {language}=useAppPreferences(); return <Text>{language}</Text>}
test('explicit English persists LTR native layout after restarting on an Arabic device',() => {
 Object.defineProperty(Platform,'OS',{configurable:true,value:'ios'});
 const nativeState={forced:true,allowed:true};
 jest.spyOn(I18nManager,'forceRTL').mockImplementation(value=>{nativeState.forced=value});
 jest.spyOn(I18nManager,'allowRTL').mockImplementation(value=>{nativeState.allowed=value});
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>JSON.stringify({themeMode:'system',language:'en'}),setItem:()=>{}}});
 const screen=render(<AppPreferencesProvider><Probe/></AppPreferencesProvider>);
 expect(screen.getByText('en')).toBeTruthy();
 // RN RCTI18nUtil.isRTL = forced || (allowed && applicationPreferredLanguageRTL).
 const nativeDirectionAfterRestart=nativeState.forced || nativeState.allowed;
 expect(nativeDirectionAfterRestart).toBe(false);
});
