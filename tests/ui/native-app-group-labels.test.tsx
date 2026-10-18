import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { NativeAppGroupLabels } from '@/components/NativeAppGroupLabels';
import { appI18n } from '@/i18n/runtime';
jest.mock('expo-modules-core',()=>({requireNativeViewManager:()=>require('react-native').View}));
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'})}));
const identity={configurationGeneration:2,scopeEpoch:3,storeRevision:4,groupRevision:5};
const props={groupId:'owned-group',layout:'rows' as const,draft:true,applicationCount:3,...identity};
const size=(more:any={})=>({nativeEvent:{...identity,groupId:'owned-group',draft:true,layout:'rows',width:320,height:231,measurementRevision:1,...more}});
beforeEach(async()=>{Platform.OS='ios';await appI18n.changeLanguage('en');});
test('native measured content height replaces the initial measure surface without a JS app-count guess',()=>{
 const view=render(<NativeAppGroupLabels {...props}/>);const native=view.getByTestId('native-app-group-labels',{includeHiddenElements:true});
 expect(StyleSheet.flatten(native.props.style).height).toBe(64);expect(StyleSheet.flatten(native.props.style).opacity).toBe(1);
 act(()=>native.props.onContentSizeChange(size()));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(231);expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).opacity).toBe(1);
 act(()=>native.props.onContentSizeChange(size({height:702})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(702);
});
test('old owner revision or wrong group and draft geometry cannot resize the current selection',()=>{
 const view=render(<NativeAppGroupLabels {...props}/>);const old=view.getByTestId('native-app-group-labels',{includeHiddenElements:true});const oldCallback=old.props.onContentSizeChange;
 act(()=>old.props.onContentSizeChange(size()));
 view.rerender(<NativeAppGroupLabels {...props} scopeEpoch={9} storeRevision={10}/>);
 const current=view.getByTestId('native-app-group-labels',{includeHiddenElements:true});
 for(const changed of [{},{scopeEpoch:9,storeRevision:10,groupId:'another'},{scopeEpoch:9,storeRevision:10,draft:false},{scopeEpoch:9,storeRevision:10,groupRevision:99},{scopeEpoch:9,storeRevision:10,height:NaN},{scopeEpoch:9,storeRevision:10,height:-2}]){
  act(()=>current.props.onContentSizeChange(size(changed)));
  expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(64);
 }
 act(()=>current.props.onContentSizeChange(size({scopeEpoch:9,storeRevision:10,height:388})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(388);
 act(()=>oldCallback(size({height:654})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(388);
});

test('older Dynamic Type measurement revisions and previous widths cannot undo the latest native size',()=>{
 const view=render(<NativeAppGroupLabels {...props}/>);const native=view.getByTestId('native-app-group-labels',{includeHiddenElements:true});
 act(()=>native.props.onLayout({nativeEvent:{layout:{width:320}}}));
 act(()=>native.props.onContentSizeChange(size({height:512,measurementRevision:3})));
 act(()=>native.props.onContentSizeChange(size({height:123,measurementRevision:2})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(512);
 act(()=>native.props.onLayout({nativeEvent:{layout:{width:260}}}));
 act(()=>native.props.onContentSizeChange(size({height:180,measurementRevision:4})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(512);
 act(()=>native.props.onContentSizeChange(size({width:260,height:602,measurementRevision:4})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(602);
});

test('preview follows actual native height at a changed width and rejects rows or stale-authority measurements',()=>{
 const view=render(<NativeAppGroupLabels {...props} layout="preview" applicationCount={12}/>);
 const native=view.getByTestId('native-app-group-labels',{includeHiddenElements:true});
 act(()=>native.props.onLayout({nativeEvent:{layout:{width:260}}}));
 for(const changes of [{layout:'rows'},{layout:'preview',width:320},{layout:'preview',scopeEpoch:99}]) {
  act(()=>native.props.onContentSizeChange(size({width:260,height:321,...changes})));
  expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(64);
 }
 act(()=>native.props.onContentSizeChange(size({layout:'preview',width:260,height:321,measurementRevision:2})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(321);
 // A larger native measurement remains authoritative; JS must not cap Dynamic Type rows.
 act(()=>native.props.onContentSizeChange(size({layout:'preview',width:260,height:802,measurementRevision:3})));
 expect(StyleSheet.flatten(view.getByTestId('native-app-group-labels',{includeHiddenElements:true}).props.style).height).toBe(802);
});
