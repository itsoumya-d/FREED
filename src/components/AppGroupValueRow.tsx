import React from 'react';
import { Modal, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/design-system/use-app-theme';
import { SpringPressable } from '@/design-system/motion';
import { translateSource } from '@/i18n/runtime';
import { AppGroupValueOptions, type AppGroupValueOption } from './AppGroupValueOptions';
import { ChevronRight } from './DirectionalIcons';
import { View, Text, Pressable } from './Localized';
/** A duration choice is a value, never a wall-clock Date. Cancel keeps the editor draft. */
export function AppGroupValueRow({label,value,options,onChange,testID,disabled=false,description}:{label:string;value:number;options:AppGroupValueOption[];onChange:(value:number)=>void;testID:string;disabled?:boolean;description?:string}) {
 const {colors}=useAppTheme();const {width,fontScale}=useWindowDimensions();const stacked=width<360||fontScale>1.25;
 const [open,setOpen]=React.useState(false),[pending,setPending]=React.useState(value);
 const close=()=>setOpen(false);
 React.useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 const cancel=<Pressable testID={testID+'-cancel'} accessibilityRole="button" accessibilityLabel={translateSource('Cancel')} onPress={close} style={{minHeight:48,minWidth:48,flexShrink:1,maxWidth:stacked?'100%':'30%',paddingHorizontal:4,paddingVertical:8,alignItems:'center',justifyContent:'center'}}><Text style={{maxWidth:'100%',minWidth:0,color:colors.accent,fontSize:17,lineHeight:24,textAlign:'center'}}>Cancel</Text></Pressable>;
 const done=<Pressable testID={testID+'-done'} accessibilityRole="button" accessibilityLabel={translateSource('Done')} onPress={()=>{onChange(pending);close();}} style={{minHeight:48,minWidth:48,flexShrink:1,maxWidth:stacked?'100%':'30%',paddingHorizontal:4,paddingVertical:8,alignItems:'center',justifyContent:'center'}}><Text style={{maxWidth:'100%',minWidth:0,color:colors.accent,fontSize:17,lineHeight:24,fontWeight:'700',textAlign:'center'}}>Done</Text></Pressable>;
 const title=<Text translate={false} accessibilityRole="header" style={{flex:stacked?undefined:1,minWidth:0,color:colors.text,fontSize:17,lineHeight:24,fontWeight:'700',textAlign:'center'}}>{label}</Text>;
 return <><SpringPressable testID={testID} haptic={false} feedback="opacity" accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{text:options.find(option=>option.value===value)?.label??String(value)}} accessibilityState={{disabled}} disabled={disabled} onPress={()=>{setPending(value);setOpen(true);}} style={{minHeight:56,paddingHorizontal:16,paddingVertical:12,flexDirection:stacked?'column':'row',alignItems:stacked?'stretch':'center',gap:stacked?4:12,opacity:disabled ? 0.5 : 1}}>
  <Text translate={false} style={{flex:stacked?undefined:1,minWidth:0,color:colors.text,fontSize:17,lineHeight:24}}>{label}</Text>
  <View style={{flexDirection:'row',alignItems:'center',gap:8,maxWidth:stacked?'100%':'55%',minWidth:0}}><Text translate={false} style={{flexShrink:1,minWidth:0,color:colors.accent,fontSize:17,lineHeight:24,fontWeight:'600',textAlign:stacked?'auto':'right'}}>{options.find(option=>option.value===value)?.label}</Text><ChevronRight size={18} color={colors.text2}/></View>
 </SpringPressable>
 {open?<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}><SafeAreaView style={{flex:1,backgroundColor:colors.bg}}><View style={{paddingHorizontal:20,paddingTop:12,flexDirection:stacked?'column':'row',alignItems:stacked?'stretch':'center',gap:8}}>{stacked?<>{title}<View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}>{cancel}{done}</View></>:<>{cancel}{title}{done}</>}</View><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:20,gap:16}}><AppGroupValueOptions label={label} value={pending} options={options} onChange={setPending}/>{description?<Text translate={false} style={{color:colors.text2,fontSize:15,lineHeight:22}}>{description}</Text>:null}</ScrollView></SafeAreaView></Modal>:null}</>;
}
