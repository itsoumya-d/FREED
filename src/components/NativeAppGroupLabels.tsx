import React from 'react';
import { Platform, type LayoutChangeEvent, type ViewProps } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';
import { useAppTheme } from '@/design-system/use-app-theme';
import { translateSource } from '@/i18n/runtime';
import { Text } from './Localized';
type PresentationIdentity={configurationGeneration:number;scopeEpoch:number;storeRevision:number;groupRevision:number};
type ContentSize=PresentationIdentity&{groupId:string;draft:boolean;layout:'preview'|'rows';width:number;height:number;measurementRevision:number};
type NativeLabelProps=ViewProps&PresentationIdentity&{groupId:string;draft:boolean;layout:'preview'|'rows';unavailableLabel:string;dark:boolean;onContentSizeChange:(event:{nativeEvent:ContentSize})=>void};
let NativeLabels:React.ComponentType<NativeLabelProps>|null|undefined;
export function NativeAppGroupLabels({groupId,draft=false,layout='rows',configurationGeneration,scopeEpoch,storeRevision,groupRevision}:{groupId:string;draft?:boolean;layout?:'preview'|'rows';applicationCount?:number}&PresentationIdentity) {
 const {colors,mode}=useAppTheme();
 const identity=JSON.stringify([groupId,draft,layout,configurationGeneration,scopeEpoch,storeRevision,groupRevision]);
 const currentIdentity=React.useRef(identity);currentIdentity.current=identity;
 const currentWidth=React.useRef<number|null>(null);
 const measurementRevision=React.useRef({identity,revision:-1});
 if(measurementRevision.current.identity!==identity){measurementRevision.current={identity,revision:-1};currentWidth.current=null;}
 const [measurement,setMeasurement]=React.useState<{identity:string;height:number}|null>(null);
 const onContentSizeChange=(event:{nativeEvent:ContentSize})=>{
  const size=event.nativeEvent;
  if(currentIdentity.current!==identity||size.groupId!==groupId||size.draft!==draft||size.layout!==layout||size.configurationGeneration!==configurationGeneration||size.scopeEpoch!==scopeEpoch||size.storeRevision!==storeRevision||size.groupRevision!==groupRevision)return;
  if(!Number.isSafeInteger(size.measurementRevision)||size.measurementRevision<measurementRevision.current.revision)return;
  if(!Number.isFinite(size.height)||size.height<=0||!Number.isFinite(size.width)||size.width<=0||currentWidth.current!==null&&Math.abs(size.width-currentWidth.current)>1)return;
  measurementRevision.current={identity,revision:size.measurementRevision};
  setMeasurement(previous=>previous?.identity===identity&&previous.height===Math.ceil(size.height)?previous:{identity,height:Math.ceil(size.height)});
 };
 const onLayout=(event:LayoutChangeEvent)=>{if(currentIdentity.current!==identity)return;const width=event.nativeEvent.layout.width;if(width>0)currentWidth.current=width;};
 if(Platform.OS==='ios' && NativeLabels===undefined){try{NativeLabels=requireNativeViewManager('FreedProtection');}catch{NativeLabels=null;}}
 if(!NativeLabels)return <Text style={{color:colors.text2,fontSize:15}}>App previews are unavailable in this installed build.</Text>;
 return <NativeLabels key={identity} testID="native-app-group-labels" groupId={groupId} draft={draft} layout={layout} configurationGeneration={configurationGeneration} scopeEpoch={scopeEpoch} storeRevision={storeRevision} groupRevision={groupRevision} unavailableLabel={translateSource('No individual apps selected')} dark={mode==='dark'} onContentSizeChange={onContentSizeChange} onLayout={onLayout} style={{height:measurement?.identity===identity?measurement.height:64,opacity:1}}/>;
}
