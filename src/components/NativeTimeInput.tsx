import React from 'react';
import { Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePicker } from '@expo/ui/datetimepicker';
import { Text, View, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import { appI18n } from '@/i18n/runtime';
import { normalizeClockTimeInput } from '@/lib/localized-input';

export function NativeTimeInput({ label,value,onChange,disabled=false }: {label:string;value:string;onChange:(value:string)=>void;disabled?:boolean}) {
  const { colors,mode }=useAppTheme(); const [open,setOpen]=React.useState(false);
  const dateFor = (time:string)=>{const normalized=normalizeClockTimeInput(time)??'09:00';const [hour,minute]=normalized.split(':').map(Number);const date=new Date();date.setHours(hour,minute,0,0);return date;};
  const [draft,setDraft]=React.useState(()=>dateFor(value));
  const commit=(date:Date)=>{if(disabled)return;const time=`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;if(time!==value)onChange(time);setOpen(false);};
  const picker=<DateTimePicker testID="setting-native-time-picker" value={draft} mode="time" display="spinner" presentation={Platform.OS==='android'?'dialog':'inline'} locale={appI18n.language} themeVariant={mode} accentColor={colors.accent} onDismiss={()=>setOpen(false)} onChange={(event,date)=>{if(event.type==='dismissed'){setOpen(false);return;}if(date){if(Platform.OS==='android')commit(date);else setDraft(date);}}} />;
  return <View style={{flex:1,minWidth:120,backgroundColor:colors.surface2,borderRadius:16,padding:12,gap:8}}><Text style={{color:colors.text2,fontWeight:'700',fontSize:17}}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${label} time`} disabled={disabled} accessibilityState={{disabled}} onPress={()=>{if(disabled)return;setDraft(dateFor(value));setOpen(true);}} style={{minHeight:44,justifyContent:'center'}}><Text translate={false} style={{color:colors.accent,fontSize:21,fontVariant:['tabular-nums'],fontWeight:'700'}}>{dateFor(value).toLocaleTimeString(appI18n.language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'})}</Text></Pressable>{Platform.OS==='android'&&open?picker:null}<Modal visible={open&&Platform.OS!=='android'} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setOpen(false)}><SafeAreaView style={{flex:1,backgroundColor:colors.bg}}><View style={{padding:24,gap:24}}><Text accessibilityRole="header" style={{color:colors.text,fontSize:28,fontWeight:'800'}}>{label}</Text>{picker}<View style={{flexDirection:'row',gap:12}}><Pressable testID="setting-time-cancel" accessibilityRole="button" onPress={()=>setOpen(false)} style={{flex:1,minHeight:56,padding:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface2,borderRadius:16}}><Text style={{color:colors.text,fontSize:17,fontWeight:'700'}}>Cancel</Text></Pressable><Pressable testID="setting-time-done" accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={()=>commit(draft)} style={{flex:1,minHeight:56,padding:16,alignItems:'center',justifyContent:'center',backgroundColor:colors.accent,borderRadius:16}}><Text style={{color:colors.onAccent,fontSize:17,fontWeight:'700'}}>Done</Text></Pressable></View></View></SafeAreaView></Modal></View>;
}
