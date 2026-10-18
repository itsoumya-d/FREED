import React from 'react';
import { I18nManager, Pressable, View, Text, StyleSheet } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, JsxEmit, ModuleKind } from 'typescript';
import { useTranslation } from 'react-i18next';
import { appI18n, translateSource } from '@/i18n/runtime';
import { ChevronRight } from '@/components/DirectionalIcons';
import { useAppTheme } from '@/design-system/use-app-theme';
jest.unmock('lucide-react-native');
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));

const nativeDirection=Object.getOwnPropertyDescriptor(I18nManager,'isRTL');
function row(){
 const source=readFileSync('src/features/freed-app.tsx','utf8');const start=source.indexOf('function ProfileAction('),end=source.indexOf('\nconst ADULT_FEED_REFRESH_INTERVAL_MS',start);
 const deps={React,Pressable,View,Text,useAppTheme,useTranslation,translateSource,ChevronRight};
 const compiled=transpileModule(`${source.slice(start,end)};return ProfileAction;`,{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 return new Function(...Object.keys(deps),compiled)(...Object.values(deps));
}
function scale(style:any){return (StyleSheet.flatten(style)?.transform??[]).reduce((value:number,transform:any)=>value*(transform.scaleX??1),1);}
afterEach(async()=>{if(nativeDirection)Object.defineProperty(I18nManager,'isRTL',nativeDirection);await act(async()=>appI18n.changeLanguage('en'));});
test.each([
 [true,'ar',-1,'Arabic after native RTL restart'],
 [false,'en',1,'English in native LTR'],
 [false,'ar',1,'Arabic selected before native LTR restart'],
 [true,'en',-1,'English selected before native RTL restart'],
] as const)('actual directional helper has one owner: %s / %s (%s, %s)',async(nativeRTL,language,expected)=>{
 Object.defineProperty(I18nManager,'isRTL',{configurable:true,value:nativeRTL});await act(async()=>appI18n.changeLanguage(language));
 const Row=row(),Icon=()=>null;const view=render(<Row label="Account" detail="Connected sign-ins and sign out" onPress={()=>{}} Icon={Icon}/>);
 const glyph=view.UNSAFE_getByType(ChevronRight);const wrapper=glyph.findByType(View);
 expect(scale(wrapper.props.style)).toBe(nativeRTL?-1:1);
 expect(scale(wrapper.props.style)*scale(glyph.props.style)).toBe(expected);
 expect(StyleSheet.flatten(glyph.props.style)?.transform).toBeUndefined();
});
