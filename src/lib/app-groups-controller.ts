import type { AppGroupActionDiagnostics, AppGroupReceipt, AppGroupsSnapshot } from './app-groups-contract';
import { validateAppGroupActionDiagnostics } from './protection-groups';
import { validateAppGroupBindingReceipt, type AppGroupBindingReceipt } from '../../modules/freed-protection/src/app-group-binding';
export type GroupMutation = 'create' | 'update' | 'update-earned' | 'remove' | 'picker' | 'discard';
export function unavailableAppGroupsSnapshot(reason = 'app-group-owner-unknown'): AppGroupsSnapshot {
 return {version:1,supported:false,platform:'unsupported',revision:0,configurationGeneration:0,scopeEpoch:0,groups:[],permissions:{authorized:false,usageAccess:false,runtimeConnected:false},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason};
}
export function createAppGroupsController(options:{getScope:()=>string|null;bind:(scope:string)=>Promise<unknown>;suspend:()=>Promise<boolean>;repair?:(scope:string)=>Promise<void>;read:(scope:string)=>Promise<AppGroupsSnapshot>;mutate:(method:GroupMutation,request:unknown,scope:string)=>Promise<AppGroupReceipt>}) {
 let state={status:unavailableAppGroupsSnapshot(),pending:false,waitingForOwner:true,error:null as string|null,bindingReceipt:null as AppGroupBindingReceipt|null,bindingFailureReceipt:null as AppGroupBindingReceipt|null,actionDiagnostics:null as AppGroupActionDiagnostics|null};
 let owner:string|null|undefined,epoch=0,reads=0,writes=0,mutationFailure:string|null=null;
 let queue:Promise<void>=Promise.resolve();const listeners=new Set<()=>void>();
 const publish=(update:Partial<typeof state>)=>{state={...state,...update};listeners.forEach(fn=>fn());};
 const capture=()=>{const scope=options.getScope();if(owner!==scope){owner=scope;epoch++;reads++;mutationFailure=null;publish({status:unavailableAppGroupsSnapshot(),waitingForOwner:scope===null,error:null,bindingReceipt:null,bindingFailureReceipt:null,actionDiagnostics:null});}return{scope,epoch};};
 const current=(token:ReturnType<typeof capture>)=>token.epoch===epoch && token.scope===options.getScope();
 let bound:string|null|undefined;
 const bindingLost=(status:AppGroupsSnapshot)=>status.reason==='sign-in-required' || status.reason==='owner-scope-unbound-or-stale';
 const invalidateBinding=(status:AppGroupsSnapshot)=>{bound=null;publish({status,waitingForOwner:false,error:mutationFailure ?? status.reason,bindingReceipt:null});};
 const bind=async(token:ReturnType<typeof capture>,retainFailure=false)=>{
  if(!current(token))return false;
  if(token.scope===null){await options.suspend();bound=null;return false;}
  if(bound!==token.scope){
   const value=await options.bind(token.scope);
   if(!current(token))return false;
   const receipt=validateAppGroupBindingReceipt(value);
   if(receipt?.accepted!==true){
    bound=null;
    const reason=receipt?.reason ?? 'app-group-binding-not-confirmed';
    if(retainFailure)mutationFailure=reason;
    publish({status:unavailableAppGroupsSnapshot(reason),waitingForOwner:false,error:mutationFailure??reason,bindingReceipt:receipt,...(retainFailure?{bindingFailureReceipt:receipt}:{})});
    return false;
   }
   bound=token.scope;
   publish({waitingForOwner:false,bindingReceipt:receipt});
  }
  return current(token);
 };
 const refresh=async():Promise<AppGroupsSnapshot|null>=>{
  const token=capture();if(token.scope===null){await bind(token);return null;}
  if(writes>0){await queue;if(!current(token))return null;}
  const read=++reads;
  try{if(!await bind(token))return null;let status=await options.read(token.scope);
   if(!current(token)||read!==reads)return null;
   // Another native caller may have suspended this same scope after our bind.
   // Publish the lost binding, then attempt exactly one fresh receipt/read.
   if(bindingLost(status)){
    invalidateBinding(status);
    if(options.repair){await options.repair(token.scope);return null;}
    if(!await bind(token)||!current(token)||read!==reads)return null;
    status=await options.read(token.scope);
    if(!current(token)||read!==reads)return null;
    if(bindingLost(status)){invalidateBinding(status);return status;}
   }
   publish({status,waitingForOwner:false,error:mutationFailure ?? status.reason});return status;
  }catch{if(current(token)&&read===reads)publish({waitingForOwner:false,error:mutationFailure ?? 'app-groups-read-failed'});return null;}
 };
 return {
  getSnapshot:()=>state,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},refresh,
  invalidate(){epoch++;reads++;owner=undefined;bound=null;mutationFailure=null;publish({status:unavailableAppGroupsSnapshot(),waitingForOwner:true,error:null,bindingReceipt:null,bindingFailureReceipt:null,actionDiagnostics:null});},
  acknowledge(){mutationFailure=null;publish({error:null,actionDiagnostics:null,bindingFailureReceipt:null});},
  mutate(method:GroupMutation,request:unknown):Promise<AppGroupReceipt|null>{
   const token=capture();const verified=token.scope!==null;
   if(!verified){publish({error:'sign-in-required'});return Promise.resolve(null);}
   writes++;publish({pending:true,error:null,actionDiagnostics:null,bindingFailureReceipt:null});
   const result=queue.then(async()=>{
    try{
     if(!await bind(token,true)||!token.scope)return null;
     mutationFailure=null;
     const rebased=method!=='discard' && request && typeof request==='object' && 'expectedStoreRevision' in request ? {...request,expectedStoreRevision:state.status.revision}:request;
     const receipt=await options.mutate(method,rebased,token.scope);
     if(!current(token))return null;
     reads++;mutationFailure=receipt.accepted||receipt.cancelled?null:receipt.reason ?? 'app-group-operation-not-confirmed';
     publish({status:receipt.snapshot,error:mutationFailure,waitingForOwner:false,actionDiagnostics:validateAppGroupActionDiagnostics(receipt.diagnostics)});return receipt;
    }catch{if(current(token)){mutationFailure='app-group-operation-failed';publish({waitingForOwner:false,error:mutationFailure});}return null;}
    finally{writes--;if(writes===0)publish({pending:false});}
   });
   queue=result.then(()=>undefined);return result;
  },
 };
}
