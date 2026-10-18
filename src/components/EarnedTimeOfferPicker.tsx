import React from 'react';
import {AppState} from 'react-native';
import {useTranslation} from 'react-i18next';
import {Text,View,Pressable} from './Localized';
import {useAppTheme} from '../design-system/use-app-theme';
import type {LiveEarnedOfferSnapshot} from '../lib/live-earned-app-time';
import type {EarnedAppTimeSeconds} from '../../modules/freed-protection/src/earned-app-time';
import {getEarnedResetChoices} from '../lib/earned-reset-templates';
export function EarnedTimeOfferPicker({offer,busy,onChoose}:{offer:LiveEarnedOfferSnapshot&{supportedBreakSeconds?:readonly EarnedAppTimeSeconds[]};busy:boolean;onChoose:(seconds:EarnedAppTimeSeconds)=>void}){
 const {colors,typography}=useAppTheme();const {t}=useTranslation();const receipt=offer.selection?.receipt;
 const choices=receipt?.offer?getEarnedResetChoices(receipt.offer):[];
 const supported=offer.supportedBreakSeconds??([300,600] as const);
 return <View testID="earned-time-offer-picker" style={{gap:12,padding:16,borderRadius:20,borderCurve:'continuous',backgroundColor:colors.surface}}>
  <Text translate={false} accessibilityRole="header" style={{fontSize:20,fontWeight:typography.bold,color:colors.text}}>{t('earnedTime.chooseTitle',{defaultValue:'Choose your app break'})}</Text>
  <Text translate={false} style={{color:colors.text2,lineHeight:22}}>{t('earnedTime.chooseDescription',{defaultValue:'Choose the time before starting your guided reset.'})}</Text>
  <View style={{flexDirection:'row',gap:12}}>{supported.map(seconds=><Pressable key={seconds} testID={`earned-time-${seconds}`} accessibilityRole="radio" accessibilityState={{checked:offer.seconds===seconds,disabled:busy}} disabled={busy} onPress={()=>onChoose(seconds)} style={{flex:1,minHeight:52,padding:12,borderRadius:16,borderCurve:'continuous',justifyContent:'center',alignItems:'center',backgroundColor:offer.seconds===seconds?colors.accent:colors.surface2,opacity:busy?.5:1}}><Text translate={false} style={{color:offer.seconds===seconds?colors.onAccent:colors.text,fontSize:17,fontWeight:typography.bold}}>{t(seconds===300?'earnedTime.fiveMinutes':seconds===600?'earnedTime.tenMinutes':'earnedSetup.twentyMinutes',{defaultValue:seconds===300?'5 minutes':seconds===600?'10 minutes':'20 minutes'})}</Text></Pressable>)}</View>
  {!supported.includes(1200)&&offer.reason!=='earned-time-unavailable'?<Text translate={false} testID="earned-window-update-needed" style={{color:colors.text2,lineHeight:22}}>{t('earnedSetup.updateWindow',{defaultValue:'Update FREED for 20-minute challenge windows. This installed build still offers 5 or 10 minutes.'})}</Text>:null}
  {offer.status==='loading'?<Text translate={false} accessibilityLiveRegion="polite" style={{color:colors.text2}}>{t('earnedTime.checkingOffer',{defaultValue:'Checking this app’s available time…'})}</Text>:null}
  {receipt?.offer&&receipt.budget?<>{receipt.offer.availableMethods.includes('timer')?<Text translate={false} style={{color:colors.text,lineHeight:24}}>{t('earnedTime.requirements',{defaultValue:'Complete {{seconds}} active seconds of Breathe or gentle Move.',seconds:receipt.offer.requiredActiveSeconds})}</Text>:null}
  {choices.some(choice=>choice.challenge.verification?.kind==='steps')?<Text translate={false} style={{color:colors.text,lineHeight:24}}>{t('earnedTime.requirementsSteps',{defaultValue:'Or complete {{steps}} observed steps with FREED open.',steps:receipt.offer.requiredSteps})}</Text>:null}
  {choices.some(choice=>choice.group==='find')?<Text translate={false} style={{color:colors.text,lineHeight:24}}>{t('earnedTime.requirementsPhotos',{defaultValue:'Or match {{count}} different objects in fresh photos checked on this device.',count:receipt.offer.requiredDistinctPhotoTargets})}</Text>:null}
  <Text translate={false} style={{color:colors.text2,lineHeight:22,fontVariant:['tabular-nums']}}>{t('earnedTime.remaining',{defaultValue:'{{minutes}} minutes of extra time remain today.',minutes:Math.floor(receipt.budget.remainingSeconds/60)})}</Text></>:null}
  {offer.status==='unavailable'?<><Text translate={false} accessibilityRole="alert" style={{color:colors.text2,lineHeight:24}}>{offer.reason==='earned-time-unavailable'?t('earnedTime.updateRequired',{defaultValue:'Update FREED to request a 5- or 10-minute app break. Basic help is still available.'}):t('earnedTime.unavailable',{defaultValue:'An app break is unavailable right now. Use Help now, or retry the offer.'})}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>onChoose(offer.seconds??300)} style={{minHeight:48,justifyContent:'center'}}><Text translate={false} style={{color:colors.accent,fontWeight:typography.bold}}>{t('earnedTime.retryOffer',{defaultValue:'Check available time again'})}</Text></Pressable></>:null}
  <Text translate={false} style={{color:colors.text2,lineHeight:22}}>{t('earnedTime.scope',{defaultValue:'Only the app that brought you here can open. Other rules and adult website protection stay active.'})}</Text>
 </View>;
}

/** Display-only countdown from a native receipt. This timer never releases or relocks an app. */
export function EarnedTimeCountdown({expiresAt}:{expiresAt:string}){
 const {colors}=useAppTheme();const {t}=useTranslation();const [now,setNow]=React.useState(Date.now);
 React.useEffect(()=>{let timer:ReturnType<typeof setInterval>|null=null;const update=()=>setNow(Date.now());const sync=(state:string)=>{if(timer)clearInterval(timer);timer=null;if(state==='active'){update();timer=setInterval(update,1000);}};sync(AppState.currentState);const listener=AppState.addEventListener('change',sync);return()=>{if(timer)clearInterval(timer);listener.remove();};},[expiresAt]);
 const remaining=Math.max(0,Math.ceil((Date.parse(expiresAt)-now)/1000));const time=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
 return <Text translate={false} testID="earned-time-countdown" style={{color:colors.text2,lineHeight:24,fontVariant:['tabular-nums']}}>{remaining>0?t('earnedTime.countdown',{defaultValue:'Break ends in {{time}}',time}):t('earnedTime.expired',{defaultValue:'This app break has ended. Your completed activity is saved.'})}</Text>;
}
