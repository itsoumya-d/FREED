import React from 'react';
import {subscribeFirebaseNativeAccountSession,getFirebaseNativeAccountSessionSnapshot,getFirebaseAuthSnapshot,getFirebaseNativeAccountAdmission,reconcileFirebaseNativeAccountSession} from '@/lib/firebase-native';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Native from 'freed-protection';
import { translateSource } from '@/i18n/runtime';
import { createAppGroupsController } from '@/lib/app-groups-controller';
import type { AppGroupCreateRequest, AppGroupUpdateRequest, AppGroupTargetRequest } from '@/lib/app-groups-contract';
import type { AppGroupEarnedTimeUpdateRequest } from '../../modules/freed-protection/src/earned-app-time';
let getCurrentScope:()=>string|null=()=>null;
const controller=createAppGroupsController({getScope:()=>getCurrentScope(),bind:Native.setAppGroupActionScope,suspend:async()=>true,read:Native.getAppGroups,repair:async scope=>{const admission=getFirebaseNativeAccountAdmission();if(admission?.actionScope===scope)await reconcileFirebaseNativeAccountSession();},
 mutate:(method,request,scope)=>method==='update-earned'?Native.updateAppGroupWithEarnedTime(request as AppGroupEarnedTimeUpdateRequest,scope):method==='create'?Native.createAppGroup(request as AppGroupCreateRequest,scope):method==='update'?Native.updateAppGroup(request as AppGroupUpdateRequest,scope):method==='remove'?Native.removeAppGroup(request as AppGroupTargetRequest,scope):method==='discard'?Native.discardPendingAppGroupSelection(request as AppGroupTargetRequest,scope):Native.presentAppGroupPicker(request as AppGroupTargetRequest,scope,translateSource('Choose individual apps'),translateSource('Selected apps stay off until you review the rule and activate protection.'))});
subscribeFirebaseNativeAccountSession(()=>controller.invalidate());
/** Device writer survives navigation. Owner/mutation/read fences live outside React batching. */
export function useAppGroups(getActionScope:()=>string|null) {
 getCurrentScope=getActionScope;
 const nativeSession=React.useSyncExternalStore(subscribeFirebaseNativeAccountSession,getFirebaseNativeAccountSessionSnapshot,getFirebaseNativeAccountSessionSnapshot);
 const snapshot=React.useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
 const scope=getActionScope();
 const refresh=async()=>{const native=getFirebaseNativeAccountSessionSnapshot();if(!getCurrentScope()&&native.status==='unavailable'&&native.reason!=='native-account-update-required'&&getFirebaseAuthSnapshot().signedIn)await reconcileFirebaseNativeAccountSession();return controller.refresh();};
 React.useEffect(()=>{void controller.refresh();},[scope]);
 useFocusEffect(React.useCallback(()=>{void controller.refresh();const app=AppState.addEventListener('change',state=>{if(state==='active')void controller.refresh();});return()=>app.remove();},[]));
 return {...snapshot,...(nativeSession.status==='unavailable'&&getFirebaseAuthSnapshot().signedIn?{waitingForOwner:false,error:nativeSession.reason}:{}),actionScope:scope,earnedTimeAvailable:Native.isEarnedAppTimeAvailable?.() ?? false,updateEarned:(request:AppGroupEarnedTimeUpdateRequest)=>controller.mutate('update-earned',request),refresh,create:(name:string)=>controller.mutate('create',{version:1,expectedStoreRevision:controller.getSnapshot().status.revision,name}),
  update:(request:AppGroupUpdateRequest)=>controller.mutate('update',request),remove:(request:AppGroupTargetRequest)=>controller.mutate('remove',request),picker:(request:AppGroupTargetRequest)=>controller.mutate('picker',request),discard:(request:AppGroupTargetRequest)=>controller.mutate('discard',request),acknowledge:controller.acknowledge};
}
export type AppGroupsBinding=ReturnType<typeof useAppGroups>;
