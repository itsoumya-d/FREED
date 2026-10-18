import React from 'react';
import { Platform, Dimensions, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { EncryptedDnsSection } from '@/components/EncryptedDnsSection';
import { appI18n } from '@/i18n/runtime';
jest.mock('expo-sqlite/localStorage/install',()=>({}));
jest.mock('@/components/MomentumCompanion',()=>({MomentumCompanion:()=>null}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
jest.mock('freed-protection',()=>({openProtectionSettings:jest.fn(),openVpnSettings:jest.fn()}));
let mockStatus:any;
jest.mock('@/hooks/use-encrypted-dns',()=>({useEncryptedDns:()=>({status:mockStatus,pending:null,error:null,operationReason:null,operationDiagnostic:null,lastCheckedAt:null,refresh:jest.fn(),configure:jest.fn(),acknowledgeOperation:jest.fn()})}));
const labels=['FREED · Cloudflare Families encrypted DNS','FREED · Cloudflare Families एन्क्रिप्टेड DNS','FREED · DNS cifrado de Cloudflare Families','FREED · DNS criptografado do Cloudflare Families','FREED · DNS chiffré Cloudflare Families','FREED · Verschlüsseltes Cloudflare Families DNS','FREED · DNS مشفّر من Cloudflare Families','FREED · Cloudflare Families 暗号化DNS','FREED · Cloudflare Families 암호화 DNS','FREED · Cloudflare Families 加密 DNS'];
const original=Platform.OS;
beforeEach(async()=>{Object.defineProperty(Platform,'OS',{value:'ios',configurable:true});localStorage.clear();await appI18n.changeLanguage('en');mockStatus={supported:true,releaseEnabled:true,configured:true,enabled:false,healthy:null,reason:'ios-dns-settings-enable-required',provider:'cloudflare-families',requiresSettings:true};});
afterEach(()=>{Object.defineProperty(Platform,'OS',{value:original,configurable:true});jest.restoreAllMocks();});
test.each(labels.flatMap(label=>[false,true].map(setup=>({label,setup}))))('both iOS entry paths preserve actual saved profile $label / setup=$setup',({label,setup})=>{
 mockStatus.configurationLabel=label;const view=render(<EncryptedDnsSection setup={setup}/>);
 expect(view.getByTestId('dns-settings-guide')).toBeOnTheScreen();
 fireEvent.press(view.getByTestId('dns-guide-next'));fireEvent.press(view.getByTestId('dns-guide-next'));
 expect(view.getByTestId('dns-guide-step-3')).toHaveTextContent(new RegExp(label));
 expect(view.queryByText(/After saving, select FREED · Cloudflare Families encrypted DNS/)).toBeNull();
 expect(mockStatus.enabled).toBe(false);
});
test.each([false,true])('saved native identity absent prevents profile handoff / setup=%s',setup=>{
 const view=render(<EncryptedDnsSection setup={setup}/>);expect(view.queryByTestId('dns-settings-guide')).toBeNull();expect(view.queryByTestId('dns-settings')).toBeNull();
});
test('largest font scale stacks accessible Back/Next within a bounded width',async()=>{
 await appI18n.changeLanguage('es');jest.spyOn(Dimensions,'get').mockReturnValue({width:375,height:812,fontScale:3,scale:3});mockStatus.configurationLabel=labels[2];const view=render(<EncryptedDnsSection setup/>);
 fireEvent.press(view.getByTestId('dns-guide-next'));
 const row=StyleSheet.flatten(view.getByTestId('dns-guide-controls').props.style);expect(row.flexDirection).toBe('column');
 for(const id of ['dns-guide-back','dns-guide-next']){const node=view.getByTestId(id),style=StyleSheet.flatten(node.props.style);expect(style.minWidth).toBe(0);expect(style.minHeight).toBeGreaterThanOrEqual(44);expect(node).not.toBeDisabled();}
});
