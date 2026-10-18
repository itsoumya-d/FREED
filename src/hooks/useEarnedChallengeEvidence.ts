import React from 'react';
import { AppState, Linking } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Pedometer } from 'expo-sensors';
import * as ImagePicker from 'expo-image-picker';
import { beginEarnedChallengeEvidence, setEarnedChallengeEvidencePhase, getEarnedChallengeEvidence, finishEarnedChallengeEvidence, captureEarnedChallengePhoto, cancelNativeAccountResources, isEarnedChallengeEvidenceAvailable } from 'freed-protection';
import { createEarnedChallengeEvidenceController, type EarnedChallengeEvidenceSnapshot } from '../lib/earned-challenge-controller';
import type { ChallengeSession } from '../lib/challenge-session';
import { getEarnedResetNativeRequirement } from '../lib/earned-reset-templates';
import type { EarnedAppTimeOffer } from '../../modules/freed-protection/src/earned-app-time';
import type { EarnedChallengeEvidenceReceipt } from '../../modules/freed-protection/src/earned-challenge-evidence';
import { appI18n } from '../i18n/runtime';

const empty=():EarnedChallengeEvidenceSnapshot=>({status:'idle',receipt:null,satisfied:false,busy:false});
export function useEarnedChallengeEvidence(input:{session:ChallengeSession|null;offer?:EarnedAppTimeOffer|null;ownerScope?:string|null;active:boolean;isCurrent?:()=>boolean;onReceipt?:(receipt:EarnedChallengeEvidenceReceipt)=>void}){
 const latest=React.useRef(input);latest.current=input;
 const [snapshot,setSnapshot]=React.useState(empty);
 const controller=React.useRef<ReturnType<typeof createEarnedChallengeEvidenceController>|null>(null);
 const photoBusy=React.useRef(false);
 type PermissionKind='motion'|'camera';
 const [permissionState,setPermissionState]=React.useState<{kind:PermissionKind;status:'needed'|'denied'|'unavailable'|'granted'}|null>(null);
 const preparePermissionRef=React.useRef<((kind:PermissionKind,explicit:boolean)=>Promise<boolean>)|null>(null);
 const requirement=input.session?getEarnedResetNativeRequirement(input.session.challenge):null;
 const key=requirement&&input.session&&input.offer&&input.ownerScope?JSON.stringify([input.session.id,input.session.challenge.id,input.offer.offerId,input.ownerScope]):null;
 React.useEffect(()=>{
  setSnapshot(empty());setPermissionState(null);if(!key||!input.session||!input.offer||!input.ownerScope)return;
  let alive=true;
  let motionAttempted=false;
  const current=()=>alive&&latest.current.isCurrent?.()===true&&latest.current.session?.id===input.session!.id&&latest.current.session.challenge.id===input.session!.challenge.id&&latest.current.offer?.offerId===input.offer!.offerId&&latest.current.ownerScope===input.ownerScope;
  const foreground=()=>current()&&latest.current.active&&AppState.currentState==='active';
  const permission=async(kind:PermissionKind,explicit=false):Promise<boolean>=>{
   const update=(status:'needed'|'denied'|'unavailable'|'granted')=>{if(current())setPermissionState(previous=>previous?.kind===kind&&previous.status===status?previous:{kind,status});};
   if(!foreground()){if(kind==='motion')update('needed');return false;}
   try{
    if(kind==='motion'&&!input.offer!.availableMethods.includes('steps')){update('unavailable');return false;}
    let result=kind==='motion'?await Pedometer.getPermissionsAsync():await ImagePicker.getCameraPermissionsAsync();
    if(!foreground())return false;
    const mayRequest=kind==='camera'||explicit||!motionAttempted;
    if(result.status==='undetermined'&&result.canAskAgain!==false&&mayRequest){
     if(kind==='motion')motionAttempted=true;
     result=kind==='motion'?await Pedometer.requestPermissionsAsync():await ImagePicker.requestCameraPermissionsAsync();
     if(!foreground())return false;
    }
    if(result.status==='granted'){update('granted');return true;}
    update(result.status==='denied'||result.canAskAgain===false?'denied':'needed');return false;
   }catch{if(foreground())update('unavailable');return false;}
  };
  preparePermissionRef.current=permission;
  const next=createEarnedChallengeEvidenceController({session:input.session,offer:input.offer,ownerScope:input.ownerScope,isCurrent:current,isAuthorityCurrent:()=>latest.current.isCurrent?.()===true&&latest.current.session?.id===input.session!.id&&latest.current.session.challenge.id===input.session!.challenge.id&&latest.current.offer?.offerId===input.offer!.offerId&&latest.current.ownerScope===input.ownerScope,
   isActive:()=>photoBusy.current||latest.current.active&&AppState.currentState==='active',isAvailable:isEarnedChallengeEvidenceAvailable,
   cancelResource:cancelNativeAccountResources,begin:beginEarnedChallengeEvidence,read:getEarnedChallengeEvidence,phase:setEarnedChallengeEvidencePhase,finish:finishEarnedChallengeEvidence,capture:captureEarnedChallengePhoto,createCaptureId:randomUUID,
   beforeBegin:()=>latest.current.session?.phase==='completed'?Promise.resolve(current()):requirement?.method==='steps'?permission('motion'):Promise.resolve(foreground()),
   onChange:()=>{if(alive&&controller.current===next){const value=next.read();setSnapshot(value);if(value.receipt)latest.current.onReceipt?.(value.receipt);if(value.reason?.includes('permission')&&requirement?.method==='steps')void permission('motion');}}
  });
  controller.current=next;
  const refresh=()=>{if(current()&&(AppState.currentState==='active'||photoBusy.current))void next.refresh();};
  refresh();const timer=setInterval(refresh,1000);const listener=AppState.addEventListener('change',()=>{if(!photoBusy.current)void next.refresh();});
  return()=>{next.dispose();alive=false;clearInterval(timer);listener.remove();if(controller.current===next)controller.current=null;if(preparePermissionRef.current===permission)preparePermissionRef.current=null;};
 },[key]);
 React.useEffect(()=>{if(!photoBusy.current)void controller.current?.refresh();},[input.active]);
 const finish=React.useCallback(()=>controller.current?.finish()??Promise.resolve(null),[]);
 const capturePhoto=React.useCallback(async()=>{
  const current=controller.current,session=current?.read().receipt?.session,targets=latest.current.session?getEarnedResetNativeRequirement(latest.current.session.challenge)?.targetIds:[];
  const next=targets?.find(id=>!session?.matchedTargetIds.includes(id));if(!current||!next||photoBusy.current)return;
  if(!await preparePermissionRef.current?.('camera',true)||controller.current!==current)return;
  photoBusy.current=true;try{await current.capture(next);}finally{photoBusy.current=false;void current.refresh();}
 },[]);
 const native=snapshot.receipt?.session;
 const photoTargets=requirement?.targetIds??[];
 const targetLabel=(id:string)=>appI18n.t(`earnedProof.targets.${id}`,{defaultValue:id});
 const progress=requirement?.method==='steps'?appI18n.t('earnedProof.stepsProgress',{defaultValue:'{{count}}/{{required}} observed steps',count:native?.observedSteps??0,required:input.offer?.requiredSteps??0}):appI18n.t('earnedProof.photoProgress',{defaultValue:'{{count}}/{{required}} different objects matched',count:native?.matchedTargetIds.length??0,required:input.offer?.requiredDistinctPhotoTargets??0});
 const nextTarget=photoTargets.find(id=>!native?.matchedTargetIds.includes(id));
 const permissionNeeded=permissionState&&permissionState.status!=='granted';
 const permissionCopy=permissionNeeded?appI18n.t(`earnedProof.${permissionState.kind}${permissionState.status==='denied'?'Denied':permissionState.status==='unavailable'?'Unavailable':'Needed'}`,{defaultValue:permissionState.kind==='motion'?permissionState.status==='denied'?'Motion access is denied. Allow it in FREED’s app settings, or choose another reset. Your guided session is kept.':permissionState.status==='unavailable'?'Step counting is unavailable on this device. Choose another reset; your guided session is kept.':'Allow motion access to count steps. Resume the reset when you’re ready.':permissionState.status==='denied'?'Camera access is denied. Allow it in FREED’s app settings, or choose another reset. Your guided session is kept.':permissionState.status==='unavailable'?'Camera permission could not be checked. Retry or choose another reset; your guided session is kept.':'Allow camera access to photograph the requested targets.'}):null;
 const status=permissionCopy??appI18n.t(snapshot.status==='unavailable'?'earnedProof.unavailable':snapshot.status==='ready'?'earnedProof.ready':snapshot.status==='active'?requirement?.method==='steps'?'earnedProof.activeSteps':'earnedProof.activePhoto':'earnedProof.checking',{
  defaultValue:snapshot.status==='unavailable'?'Native verification is unavailable. Retry or choose another reset; your guided access is kept.':snapshot.status==='ready'?'Native activity evidence is ready to save.':snapshot.status==='active'?requirement?.method==='steps'?'Keep FREED open while you walk. Only observed steps count.':'Take a fresh photo of each requested object.':'Checking native activity evidence…'});
 const repairLabel=appI18n.t(permissionState?.status==='denied'?'earnedProof.openSettings':permissionState?.status==='needed'&&permissionState.kind==='motion'?'earnedProof.allowMotion':permissionState?.status==='needed'&&permissionState.kind==='camera'?'earnedProof.allowCamera':'earnedProof.retry',{defaultValue:permissionState?.status==='denied'?'Open app settings':permissionState?.status==='needed'?permissionState.kind==='motion'?'Allow motion access':'Allow camera access':'Retry verification'});
 const retry=async()=>{
  if(latest.current.isCurrent?.()!==true||AppState.currentState!=='active')return;
  if(permissionState?.status==='denied'){try{await Linking.openSettings();}catch{/* The notice retains the explicit manual Settings route. */}return;}
  if(permissionState?.kind==='camera'&&permissionState.status!=='granted'){await capturePhoto();return;}
  if(permissionState?.kind==='motion'&&permissionState.status!=='granted'&&!await preparePermissionRef.current?.('motion',true))return;
  await controller.current?.retry();
 };
 return {...snapshot,state:permissionNeeded?'unavailable' as const:snapshot.status,enabled:!!key,requirement,progress,status,repairLabel,photoTargets:photoTargets.map(targetLabel).join(', '),nextPhoto:nextTarget?appI18n.t('earnedProof.nextPhoto',{defaultValue:'Next object: {{target}}',target:targetLabel(nextTarget)}):null,finish,capturePhoto,cancel:()=>controller.current?.cancel()??Promise.resolve(true),retry};
}
