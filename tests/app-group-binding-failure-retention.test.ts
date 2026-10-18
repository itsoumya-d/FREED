import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAppGroupsController} from '../src/lib/app-groups-controller';
const snapshot:any={version:1,supported:true,platform:'ios',revision:7,configurationGeneration:1,scopeEpoch:2,groups:[],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:0,limit:20},maxGroups:6,legacyCompatibility:{retained:false,applicationCount:0,categoryCount:0,webDomainCount:0},reason:null};
const binding={version:1,operationId:'11111111-1111-4111-8111-111111111111',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:1,scopeEpoch:2,errorCode:null,errorDomain:null};
test('a rejected mutation binding retains its safe failure receipt through a successful refresh until acknowledgement',async()=>{
 let attempt=0;const failure={...binding,accepted:false,bindingCurrent:false,stage:'state-read',reason:'state-storage-unavailable',errorDomain:'NSPOSIXErrorDomain',errorCode:13};
 const controller=createAppGroupsController({getScope:()=> '["owner",1]',bind:async()=>++attempt===1?{...failure,privateOwner:'do-not-retain'}:binding,suspend:async()=>true,read:async()=>snapshot,mutate:async()=>{throw new Error('must not mutate after rejected binding');}});
 assert.equal(await controller.mutate('update',{}),null);assert.equal(controller.getSnapshot().error,failure.reason);
 await controller.refresh();assert.equal(controller.getSnapshot().error,failure.reason);
 assert.deepEqual((controller.getSnapshot() as any).bindingFailureReceipt,failure);
 assert.equal(JSON.stringify(controller.getSnapshot()).includes('do-not-retain'),false);
 controller.acknowledge();assert.equal(controller.getSnapshot().error,null);assert.equal((controller.getSnapshot() as any).bindingFailureReceipt,null);
});
