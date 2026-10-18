import React from 'react';
import {Switch} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text,Pressable,View} from './Localized';
import {useAppTheme} from '@/design-system/use-app-theme';
import type {CloudChatConsent,ClaraCloudState,ClaraCloudResult} from '@/lib/clara-conversation';

const STATUS:Partial<Record<ClaraCloudState,string>>={
 online:'Cloud reply received',
 unavailable:'Cloud chat is unavailable. Built-in guidance remains available.',
 'daily-quota-exhausted':'Your daily cloud reply allowance is used. Built-in guidance remains available.',
 'budget-exhausted':'Cloud chat has reached its testing allowance. Built-in guidance remains available.',
 duplicate:'This request already reached the service. Send a new message to continue.',
 'rate-limited':'Please wait a moment before sending another cloud message.',
 'account-deleting':'Cloud chat is off while this account is being deleted.',
 'basic-help':'Basic support is available without cloud chat.',
};
export function ClaraCloudControls({consent,onConsent,state,quota,error}: {consent:CloudChatConsent;onConsent:(next:CloudChatConsent)=>void;state?:ClaraCloudState;quota?:ClaraCloudResult['quota'];error?:boolean}) {
 const {colors,typography}=useAppTheme();const {t}=useTranslation();const [confirming,setConfirming]=React.useState(false);
 const row={padding:16,borderRadius:20,borderCurve:'continuous' as const,backgroundColor:colors.surface,gap:12};
 return <View style={row}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <View style={{flex:1,gap:4}}><Text style={{color:colors.text,fontSize:17,fontWeight:typography.bold}}>Cloud chat</Text><Text style={{color:colors.text2,lineHeight:21}}>{consent.enabled?'Messages you send can use Google-hosted CLARA.':'Built-in guidance stays on this device.'}</Text></View>
   <Switch testID="clara-cloud-toggle" value={consent.enabled} accessibilityLabel="Cloud chat" onValueChange={value=>{if(value)setConfirming(true);else onConsent({...consent,enabled:false});}} trackColor={{false:colors.surface3,true:colors.accent}} />
  </View>
  {confirming?<View style={{gap:12}}>
   <Text style={{color:colors.text,lineHeight:24}}>Enable cloud chat? Messages you send are processed by Google through FREED. Browsing activity, journal entries, photos and Screen Time data are not attached. Processing may happen outside your country. Google applies its service processing and retention terms.</Text>
   <Text style={{color:colors.text2,lineHeight:22}}>Turning this off stops future messages. A request already sent may finish. Built-in guidance remains available.</Text>
   <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>
    <Pressable testID="clara-enable-cloud" onPress={()=>{onConsent({...consent,enabled:true});setConfirming(false);}} style={{minHeight:48,padding:12,borderRadius:12,backgroundColor:colors.accent}}><Text style={{color:colors.onAccent,fontWeight:typography.bold}}>Enable cloud chat</Text></Pressable>
    <Pressable onPress={()=>setConfirming(false)} style={{minHeight:48,padding:12}}><Text style={{color:colors.text,fontWeight:typography.bold}}>Keep built-in guidance</Text></Pressable>
   </View>
  </View>:null}
  {consent.enabled?<View style={{flexDirection:'row',alignItems:'center',gap:12}}><Text style={{flex:1,color:colors.text2,lineHeight:22}}>Share my recent messages for conversation context</Text><Switch testID="clara-context-toggle" value={consent.includeConversation} accessibilityLabel="Share my recent messages for conversation context" onValueChange={includeConversation=>onConsent({...consent,includeConversation})} trackColor={{false:colors.surface3,true:colors.accent}} /></View>:null}
  {consent.enabled&&state?<Text accessibilityLiveRegion="polite" style={{color:colors.text2,lineHeight:22}}>{STATUS[state]??''}</Text>:null}
  {consent.enabled&&quota?.remaining!=null&&quota.limit!=null?<Text translate={false} style={{color:colors.text2,lineHeight:22}}>{t('purpose.claraCloudQuota',{remaining:quota.remaining,limit:quota.limit,defaultValue:'Cloud replies left today: {{remaining}} of {{limit}}'})}</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:colors.text,lineHeight:22}}>Your cloud chat preference could not be saved. Cloud chat stays off until it is saved.</Text>:null}
 </View>;
}
