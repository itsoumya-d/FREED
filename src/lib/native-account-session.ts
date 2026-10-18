import { getJourneyOwner, type JourneyAuthSnapshot } from './user-journey';
import { validateNativeAccountPreparation, validateNativeAccountBinding, type NativeAccountAdmission, type NativeAccountSessionDriver, type NativeCleanupReceipt } from '../../modules/freed-protection/src/native-account-contract';
export type NativeAccountSessionSnapshot=Readonly<{status:'unavailable'|'preparing'|'ready';reason:string|null;admission:NativeAccountAdmission|null;revision:number}>;
/** One native-created session per Auth transition. Never persist its object, ticket or scope. */
export function createNativeAccountSessionCoordinator(options:{create:(isCurrent:()=>boolean,purpose?:'private'|'cleanup')=>NativeAccountSessionDriver|null;sdkOwner:()=>string|null;observed:()=>JourneyAuthSnapshot;uuid:()=>string;timeoutMs?:number}) {
 let snapshot:NativeAccountSessionSnapshot=Object.freeze({status:'unavailable',reason:'native-account-auth-unavailable',admission:null,revision:0});
 let driver:NativeAccountSessionDriver|null=null,epoch=0,sequence=0,owner:string|null=null,transition:string|null=null,cleanupInProgress=false;
 const bounded=async<T>(work:()=>Promise<T>):Promise<T>=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([Promise.resolve().then(work),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('native-account-timeout')),options.timeoutMs??2000);})]);}finally{if(timer)clearTimeout(timer);}};
 const listeners=new Set<()=>void>();let pending:Promise<NativeAccountAdmission|null>|null=null;
 const publish=(status:NativeAccountSessionSnapshot['status'],reason:string|null,admission:NativeAccountAdmission|null=null)=>{snapshot=Object.freeze({status,reason,admission,revision:snapshot.revision+1});listeners.forEach(fn=>fn());};
 const invalidate=(reason='native-account-transition')=>{epoch++;owner=null;transition=null;pending=null;cleanupInProgress=false;const old=driver;driver=null;publish('unavailable',reason);try{old?.retire();}catch{/* Adapter clears admission before releasing the native carrier. */}};
 const authenticated=(uid:string)=>{try{return options.sdkOwner()===uid&&getJourneyOwner(options.observed())===uid;}catch{return false;}};
 const admission=()=>{const a=snapshot.admission;if(a&&!authenticated(a.ownerUid)){invalidate('native-account-auth-changed');return null;}return a;};
 const observe=(auth:JourneyAuthSnapshot,force=false):Promise<NativeAccountAdmission|null>=>{
  const uid=getJourneyOwner(auth);
  if(!uid||options.sdkOwner()!==uid){invalidate('native-account-auth-unavailable');return Promise.resolve(null);}
  if(cleanupInProgress&&owner===uid)return Promise.resolve(null);
  if(!force&&owner===uid){if(snapshot.admission)return Promise.resolve(admission());if(pending)return pending;}
  invalidate('native-account-transition');owner=uid;transition=options.uuid();const id=transition,token=epoch,seq=++sequence;
  try{driver=options.create(()=>epoch===token&&owner===uid&&transition===id&&authenticated(uid));}catch{driver=null;}
  const captured=driver;
  if(!captured){publish('unavailable','native-account-update-required');return Promise.resolve(null);}
  publish('preparing',null);
  const current=()=>epoch===token&&driver===captured&&owner===uid&&transition===id&&authenticated(uid);
  const run=async()=>{
   try{
    if(!current())return null;
    let rawPreparation:unknown;try{rawPreparation=await bounded(()=>captured.prepare(uid,id,seq));}catch{if(!current())return null;rawPreparation=await bounded(()=>captured.prepare(uid,id,seq));}
    const prepared=validateNativeAccountPreparation(rawPreparation);if(!current())return null;
    if(!prepared)throw Error('native-account-preparation-invalid');
    // Exact ticket replay handles a lost commit response; never prepare another identity to repair it.
    let raw:unknown;try{raw=await bounded(()=>captured.commit(prepared.ticket));}catch{if(!current())return null;raw=await bounded(()=>captured.commit(prepared.ticket));}
    if(!current())return null;
    const binding=validateNativeAccountBinding(raw,uid,seq,prepared.admissionRevision);if(!binding)throw Error('native-account-binding-invalid');
    const acknowledged=Object.freeze({...binding,ownerUid:uid,transition:id,sequence:seq});publish('ready',null,acknowledged);return acknowledged;
   }catch{if(epoch===token){invalidate('native-account-admission-unavailable');}return null;}
   finally{if(epoch===token)pending=null;}
  };
  // The observer assigns the real SDK snapshot before private preparation may run.
  pending=Promise.resolve().then(run);return pending;
 };
 const withCleanupAdmission=async<T>(uid:string,isCurrent:()=>boolean,work:(admission:NativeAccountAdmission,current:()=>boolean,prepareCleanup:(scope:string,handle:string)=>Promise<NativeCleanupReceipt|null>)=>Promise<T>):Promise<T|null>=>{
  if(!authenticated(uid)||!isCurrent())return null;
  invalidate('native-account-cleanup-only');owner=uid;transition=options.uuid();cleanupInProgress=true;
  const token=epoch,id=transition,seq=++sequence;
  const current=()=>epoch===token&&cleanupInProgress&&owner===uid&&transition===id&&authenticated(uid)&&isCurrent();
  try{driver=options.create(current,'cleanup');}catch{driver=null;}
  const captured=driver;if(!captured){invalidate('native-account-update-required');return null;}
  try{
   if(!current())return null;
   let raw:unknown;try{raw=await bounded(()=>captured.prepare(uid,id,seq));}catch{if(!current())return null;raw=await bounded(()=>captured.prepare(uid,id,seq));}
   if(!current())return null;const prepared=validateNativeAccountPreparation(raw);if(!prepared)return null;
   try{raw=await bounded(()=>captured.commit(prepared.ticket));}catch{if(!current())return null;raw=await bounded(()=>captured.commit(prepared.ticket));}
   if(!current())return null;const binding=validateNativeAccountBinding(raw,uid,seq,prepared.admissionRevision);if(!binding)return null;
   // The temporary acknowledgement is visible only to this explicit cleanup closure.
   const prepareCleanup=async(scope:string,handle:string)=>current()&&scope===binding.actionScope&&handle===binding.bindingHandle?captured.prepareCleanup?.()??null:null;
   const result=await work(Object.freeze({...binding,ownerUid:uid,transition:id,sequence:seq}),current,prepareCleanup);return current()?result:null;
  }catch{return null;}
  finally{if(epoch===token)invalidate('native-account-cleanup-only-retired');}
 };
 return {withCleanupAdmission,getSnapshot:()=>snapshot,getAdmission:admission,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},observe,invalidate,
  isCurrent:(value:NativeAccountAdmission)=>admission()===value,
  retry:()=>observe(options.observed(),true)};
}
