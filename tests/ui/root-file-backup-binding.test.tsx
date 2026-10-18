import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind, JsxEmit } from 'typescript';
import { Text, View, Pressable } from 'react-native';
import { JournalBackupFiles } from '@/components/JournalBackupFiles';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'}),useOptionalAppPreferences:()=>null}));
test('actual focused Profile backup exposes file actions with no archive TextInput and keeps the original callback boundaries',async()=>{
 const source=readFileSync(process.env.TASK4_CONTROLLER_SOURCE??'src/features/freed-app.tsx','utf8');const start=source.indexOf('function ProfileScreen('),end=source.indexOf('\nfunction ProfileGroup',start);
 const code=transpileModule(source.slice(start,end)+';return ProfileScreen;',{compilerOptions:{jsx:JsxEmit.React,module:ModuleKind.CommonJS}}).outputText;
 const deps={React,Text,View,Pressable,JournalBackupFiles,useAppTheme:()=>({colors:{text:'#111',text2:'#555',surface:'#fff'}}),useTranslation:()=>({t:(_key:string,v:any)=>v.defaultValue,i18n:{language:'en'}}),useMomentumBottomPadding:()=>24,getFirebaseAccountSummary:()=>({signedIn:true,anonymous:false,email:null,providers:[]}),getFirebaseAccountScope:()=> 'backup-owner',getMembershipSummary:()=>({state:'none'}),appI18n:{t:(_key:string,v:any)=>v.defaultValue},parseFreedProfileSection:()=>null,freedProfileSectionTitle:(v:string)=>v,freedProfileSectionPath:(v:string)=>v,router:{push:jest.fn()},translateSource:(v:string)=>v,
  ScrollView:View,ProfileGroup:View,ProfileAction:()=>null,Card:View,PillButton:()=>null,RecoveryBackupCard:()=> <View testID="legacy-large-archive-form"/>,Lock:()=>null,Users:()=>null,Settings:()=>null,Calendar:()=>null,Sparkles:()=>null};
 const Profile=new Function(...Object.keys(deps),code)(...Object.values(deps));const onExport=jest.fn(async()=>{}),onImport=jest.fn(async()=>false),onDownload=jest.fn(async()=>{}),onAutomatic=jest.fn(async()=>{});
 const props={section:'backup',recoveryState:createDefaultRecoveryState(),ownerId:'backup-owner',onExportFile:onExport,onImportFile:onImport,onDownloadTextBackup:onDownload,onAutomaticBackupChange:onAutomatic,onConnectAccount:jest.fn(),onPersonalize:jest.fn()};
 const view=render(<Profile {...props}/>);expect(view.getByTestId('journal-backup-files')).toBeOnTheScreen();expect(view.queryByTestId('legacy-large-archive-form')).toBeNull();expect(view.queryByTestId('backup-text')).toBeNull();
 fireEvent.changeText(view.getByTestId('backup-file-passphrase'),'private backup passphrase');await act(async()=>fireEvent.press(view.getByTestId('backup-export-file')));expect(onExport).toHaveBeenCalledWith('private backup passphrase');
 await act(async()=>fireEvent.press(view.getByTestId('backup-import-file')));expect(onImport).toHaveBeenCalledWith('private backup passphrase');expect(view.getByText('File selection cancelled. Your history was kept.')).toBeOnTheScreen();
 await act(async()=>fireEvent.press(view.getByTestId('backup-download-text')));expect(onDownload).toHaveBeenCalledWith('private backup passphrase');
});
