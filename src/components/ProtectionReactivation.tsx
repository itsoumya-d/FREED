import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Pressable } from './Localized';
import { MomentumPageHeader } from './MomentumPageHeader';
import { useAppTheme } from '@/design-system/use-app-theme';

export function ProtectionReactivation({ onResume,onClose }: {onResume:()=>Promise<unknown>;onClose:()=>void}) {
  const {colors}=useAppTheme();const [busy,setBusy]=React.useState(false),[failed,setFailed]=React.useState(false);const gate=React.useRef(false);
  const resume=async()=>{if(gate.current)return;gate.current=true;setBusy(true);setFailed(false);try{await onResume();}catch{setFailed(true);}finally{gate.current=false;setBusy(false);}};
  return <SafeAreaView style={{flex:1,backgroundColor:colors.bg}}><ScrollView testID="protection-reactivation" contentContainerStyle={{padding:24,gap:24}}><MomentumPageHeader pose="guide" context="protection-reactivation" title="Protection was cleared" description="Protection stays off until you choose to set it up again." category="commitment" compact />
    <Text style={{color:colors.text2,fontSize:17,lineHeight:26}}>Resuming setup allows your saved app limits and schedules to sync on this device. Website filtering still needs its own setup.</Text>
    <Text style={{color:colors.text2,fontSize:17,lineHeight:26}}>Recovery tools remain available while protection is off.</Text>
    {failed?<Text accessibilityRole="alert" style={{color:colors.text,lineHeight:24}}>Protection setup could not be enabled. Recovery tools remain available. Try again.</Text>:null}
    <Pressable testID="protection-resume" accessibilityRole="button" accessibilityState={{busy,disabled:busy}} disabled={busy} onPress={()=>void resume()} style={{minHeight:56,padding:16,borderRadius:16,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.onAccent,fontSize:17,fontWeight:'700'}}>Resume protection setup</Text></Pressable>
    <Pressable testID="protection-resume-close" accessibilityRole="button" onPress={onClose} style={{minHeight:48,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.accent,fontSize:17,fontWeight:'700'}}>Continue using recovery tools</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
