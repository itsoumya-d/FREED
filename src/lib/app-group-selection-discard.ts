import type { AppGroupSelectionDiscardReceipt, AppGroupTargetRequest } from './app-groups-contract';
import { validateAppGroupsSnapshot } from './protection-groups';

/** A picker discard keeps committed group revisions and reports the exact target. */
export function validateAppGroupSelectionDiscardReceipt(value:unknown,request:AppGroupTargetRequest):AppGroupSelectionDiscardReceipt|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>,snapshot=validateAppGroupsSnapshot(r.snapshot);
 if(r.operation!=='discard-pending-selection'||typeof r.accepted!=='boolean'||r.reason!==null&&typeof r.reason!=='string'
  ||r.targetId!==null&&typeof r.targetId!=='string'||typeof r.pendingSelectionDiscarded!=='boolean'||!snapshot||r.cancelled!==undefined)return null;
 if(r.accepted){
  const group=snapshot.groups.find(g=>g.id===request.id);
  if(!snapshot.supported||snapshot.reason!==null||r.reason!==null||r.targetId!==request.id||!r.pendingSelectionDiscarded
   ||!group||group.revision!==request.expectedRevision||group.draftApplicationCount!=null
   ||snapshot.platform==='android'&&snapshot.revision!==request.expectedStoreRevision
   ||snapshot.platform==='ios'&&snapshot.revision!==request.expectedStoreRevision&&snapshot.revision!==request.expectedStoreRevision+1)return null;
 }else if(r.reason===null||r.pendingSelectionDiscarded)return null;
 let diagnostics:AppGroupSelectionDiscardReceipt['diagnostics'];
 if(r.diagnostics!==undefined){
  if(!r.diagnostics||typeof r.diagnostics!=='object'||Array.isArray(r.diagnostics))return null;
  const d=r.diagnostics as Record<string,unknown>;
  if(typeof d.stage!=='string'||d.reason!==undefined&&d.reason!==null&&typeof d.reason!=='string'
   ||d.configurationGeneration!==undefined&&d.configurationGeneration!==null&&!(typeof d.configurationGeneration==='number'&&Number.isSafeInteger(d.configurationGeneration)&&d.configurationGeneration>=0)
   ||d.errorCode!==undefined&&d.errorCode!==null&&!(typeof d.errorCode==='number'&&Number.isSafeInteger(d.errorCode))
   ||d.errorDomain!==undefined&&d.errorDomain!==null&&typeof d.errorDomain!=='string')return null;
  diagnostics=d as AppGroupSelectionDiscardReceipt['diagnostics'];
 }
 return {accepted:r.accepted,reason:r.reason as string|null,operation:'discard-pending-selection',targetId:r.targetId as string|null,pendingSelectionDiscarded:r.pendingSelectionDiscarded,snapshot,...(diagnostics?{diagnostics}:{})};
}
