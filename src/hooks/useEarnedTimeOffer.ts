import React from 'react';
import {createLiveEarnedOfferCoordinator,type LiveEarnedOfferContext} from '../lib/live-earned-app-time';
import {isEarnedAppTimeAvailable,prepareEarnedAppTimeOffer,setAppGroupActionScope} from 'freed-protection';
import type {EarnedAppTimeSeconds} from '../../modules/freed-protection/src/earned-app-time';
/** Transient offer state only; restarting/restoring cannot restore grant authority. */
export function useEarnedTimeOffer(context:LiveEarnedOfferContext|null,options:{preferredBreakSeconds?:EarnedAppTimeSeconds;supportedBreakSeconds?:readonly EarnedAppTimeSeconds[];initializeDefault?:boolean}={}){
 const live=React.useRef(context);live.current=context;const alive=React.useRef(true);
 const [,publish]=React.useReducer(n=>n+1,0);
 const coordinator=React.useMemo(()=>createLiveEarnedOfferCoordinator({getContext:()=>live.current,isAvailable:isEarnedAppTimeAvailable,bind:setAppGroupActionScope,prepare:prepareEarnedAppTimeOffer,now:Date.now,onChange:()=>{if(alive.current)publish();}}),[]);
 const contextKey=context?JSON.stringify([context.ownerUid,context.actionScope,context.attempt.nativeInterventionId,context.attempt.scope]):'none';
 const initialized=React.useRef<string|null>(null);const [unsupported,setUnsupported]=React.useState(false);
 const supportedBreakSeconds=options.supportedBreakSeconds??([300,600] as const);
 React.useEffect(()=>{initialized.current=null;setUnsupported(false);coordinator.invalidate();},[coordinator,contextKey,context?.ownerLease]);
 React.useEffect(()=>{
  if(!context||!options.initializeDefault||initialized.current===contextKey)return;
  initialized.current=contextKey;
  const preferred=options.preferredBreakSeconds??300;
  const seconds=supportedBreakSeconds.includes(preferred)?preferred:supportedBreakSeconds.includes(300)?300:supportedBreakSeconds[0];
  if(seconds)void coordinator.select(seconds);
 },[coordinator,contextKey,context?.ownerLease,options.initializeDefault,options.preferredBreakSeconds,JSON.stringify(supportedBreakSeconds)]);
 React.useEffect(()=>{alive.current=true;return()=>{alive.current=false;coordinator.invalidate();};},[coordinator]);
 const snapshot=coordinator.read();
 const visible=context&&!isEarnedAppTimeAvailable()?{...snapshot,status:'unavailable' as const,reason:'earned-time-unavailable',selection:null}:snapshot;
 return {...visible,...(unsupported?{status:'unavailable' as const,reason:'earned-time-duration-update-required',selection:null}:{}),supportedBreakSeconds,current:()=>unsupported?null:coordinator.current(),isBound:coordinator.isBound,select:(seconds:EarnedAppTimeSeconds)=>{initialized.current=contextKey;if(!supportedBreakSeconds.includes(seconds)){setUnsupported(true);coordinator.invalidate();return Promise.resolve();}setUnsupported(false);return coordinator.select(seconds);},invalidate:coordinator.invalidate};
}
