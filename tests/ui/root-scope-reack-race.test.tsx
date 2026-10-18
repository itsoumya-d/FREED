import {task86ScopeDependencies} from '../helpers/task86-native-account-fixture';
import React from 'react';
import { render,act } from '@testing-library/react-native';
import { View,Text,AppState } from 'react-native';
import { readFileSync } from 'node:fs';
import { transpileModule,ModuleKind,JsxEmit } from 'typescript';
import { getJourneyOwner } from '@/lib/user-journey';
import { unavailableAppGroupsSnapshot } from '@/lib/app-groups-controller';
import { presentNativeAppBreak } from '@/lib/live-earned-app-time';
import { isAppGroupBindingConfirmed } from '../../modules/freed-protection/src/app-group-binding';
const acceptedBinding = { version: 1 as const, operationId: 'c0c660e3-55bf-4930-a729-a1728ec2fc1f', supported: true, accepted: true, bindingCurrent: true, ownerVerified: true, stage: 'complete' as const, reason: null, generation: 1, scopeEpoch: 1, errorCode: null, errorDomain: null };

function fixture(initiallyUnknown=false,nativeSnapshot=unavailableAppGroupsSnapshot()){const s=readFileSync(process.env.TASK2_FIX_SCOPE_SOURCE??'src/features/freed-app.tsx','utf8'),start=s.indexOf('  const appGroupsMemorySuspended ='),end=s.indexOf('  const refreshProtectionStatus =',start);let auth:any={status:'ready',signedIn:true,anonymous:false,ownerUid:'owner',email:null},sdk:string|null='owner',capture:any,resolve:any;
 if(initiallyUnknown){auth={status:'hydrating',signedIn:false,anonymous:false,ownerUid:null,email:null};sdk=null;}
 const leases=new Map<string,{ownerUid:string;isCurrent:()=>boolean}>();
 const readOwnerLease=()=>{const owner=getJourneyOwner(auth);if(!owner||owner!==sdk)return null;if(!leases.has(owner))leases.set(owner,{ownerUid:owner,isCurrent:()=>getJourneyOwner(auth)===owner&&sdk===owner});return leases.get(owner)!;};
 const bind=jest.fn(()=>new Promise<unknown>(r=>{resolve=r;})),suspend=jest.fn(async()=>true),refresh=jest.fn(async()=>({...nativeSnapshot,supported:true}));
 const deps:any={React,View,Text,AppState,presentNativeAppBreak,readOwnerLease,screen:'main',tab:'shield',Platform:{OS:'ios'},getFirebaseAuthSnapshot:()=>auth,getFirebaseAccountScope:()=>sdk,getJourneyOwner,privateLockedRef:{current:false},accountHostGeneration:{current:4},suspendAppGroupOperations:suspend,setAppGroupActionScope:bind,isAppGroupBindingConfirmed,useAppGroups:()=>({status:nativeSnapshot,refresh,create:jest.fn()}),protectionCapability:{appGroups:true},setProtectionIntent:()=>{},setScreen:()=>{},enterAccountFlow:()=>{},router:{push:()=>{}},freedShieldSectionPath:(v:string)=>v,guidedRouteParams:{},translateSource:(v:string)=>v,protectionReadback:{current:{invalidate:jest.fn()}},capture:(v:any)=>{capture=v;}};
 Object.assign(deps,task86ScopeDependencies(()=>auth,()=>sdk));
 const code=transpileModule(`return function Probe(){const journeyOwner=getJourneyOwner(getFirebaseAuthSnapshot());const ownerLease=readOwnerLease();const [unlockClockMs,setUnlockClockMs]=React.useState(Date.now);${s.slice(start,end)}capture({getProtectionActionScope,refreshAppGroupConfiguration,appGroupsMemorySuspended,appGroupsSuspensionEpoch,appGroupsSnapshotScope,nativeAppBreak});return <View><Text>{appGroupsSnapshotScope??'none'}</Text></View>;};`,{compilerOptions:{module:ModuleKind.CommonJS,jsx:JsxEmit.React}}).outputText;
 const Probe=new Function(...Object.keys(deps),code)(...Object.values(deps));return {Probe,get:()=>capture,bind,suspend,refresh,unknown:()=>{auth={...auth,status:'hydrating'};capture.getProtectionActionScope();},sameOwner:()=>{auth={...auth,status:'ready'};},ownerChange:()=>{auth={...auth,ownerUid:'other'};sdk='other';},release:(receipt:unknown=acceptedBinding)=>resolve(receipt)};}
test('actual effect old ack after unknown and same-owner return cannot unpause/read/publish; new acknowledged effect resumes',async()=>{
 const f=fixture(),view=render(<f.Probe/>);f.unknown();f.sameOwner();await act(async()=>{f.release();await Promise.resolve();});expect(f.get().appGroupsMemorySuspended.current).toBe(true);expect(f.refresh).not.toHaveBeenCalled();expect(f.get().appGroupsSnapshotScope).toBeNull();
 view.rerender(<f.Probe/>);await act(async()=>{f.release();await Promise.resolve();await Promise.resolve();});expect(f.refresh).toHaveBeenCalledTimes(1);expect(f.get().appGroupsMemorySuspended.current).toBe(false);expect(f.get().appGroupsSnapshotScope).toBe('["owner",4,"22222222-2222-4222-8222-222222222222"]');
});
test('actual manual retry old ack cannot resume same owner after suspension or publish after unmount',async()=>{
 const f=fixture(),view=render(<f.Probe/>);await act(async()=>{f.release();await Promise.resolve();});f.bind.mockImplementationOnce(()=>new Promise<unknown>(r=>{(f as any).manualRelease=r;}));let pending:Promise<unknown>;act(()=>{pending=f.get().refreshAppGroupConfiguration();f.unknown();f.sameOwner();});await act(async()=>{(f as any).manualRelease(acceptedBinding);await pending;});expect(f.get().appGroupsMemorySuspended.current).toBe(true);expect(f.refresh).toHaveBeenCalledTimes(1);
 f.bind.mockImplementationOnce(()=>new Promise<unknown>(r=>{(f as any).late=r;}));let late:Promise<unknown>;act(()=>{late=f.get().refreshAppGroupConfiguration();});view.unmount();await act(async()=>{(f as any).late(acceptedBinding);await late;});expect(f.refresh).toHaveBeenCalledTimes(1);
});
test('actual readback cannot publish a private snapshot after suspension or owner change',async()=>{
 const f=fixture(),view=render(<f.Probe/>);let readResolve:any;f.refresh.mockImplementationOnce(()=>new Promise(r=>{readResolve=r;}));await act(async()=>{f.release();await Promise.resolve();});expect(f.refresh).toHaveBeenCalledTimes(1);f.unknown();f.sameOwner();await act(async()=>{readResolve({...unavailableAppGroupsSnapshot(),supported:true});await Promise.resolve();});expect(f.get().appGroupsSnapshotScope).toBeNull();expect(f.get().appGroupsMemorySuspended.current).toBe(true);
 view.unmount();const other=fixture(),second=render(<other.Probe/>);other.ownerChange();await act(async()=>{other.release();await Promise.resolve();});expect(other.refresh).not.toHaveBeenCalled();second.unmount();
});

test.each([
 true,
 {...acceptedBinding,accepted:false,bindingCurrent:false,ownerVerified:false,stage:'state-commit',reason:'commit-failed'},
 {...acceptedBinding,ownerVerified:false},
 {...acceptedBinding,generation:null},
])('actual Root refuses unconfirmed scope receipt %# without reading or resuming',async receipt=>{
 const f=fixture(),view=render(<f.Probe/>);await act(async()=>{f.release(receipt);await Promise.resolve();});
 expect(f.refresh).not.toHaveBeenCalled();expect(f.get().appGroupsSnapshotScope).toBeNull();
 view.unmount();
});


test('actual Root projection is safe on the first render with unknown owner and no native scope',async()=>{
 const f=fixture(true),view=render(<f.Probe/>);await act(async()=>{});
 expect(f.get().getProtectionActionScope()).toBeNull();expect(f.get().appGroupsSnapshotScope).toBeNull();expect(f.get().nativeAppBreak).toBeNull();
 expect(f.bind).not.toHaveBeenCalled();expect(f.refresh).not.toHaveBeenCalled();view.unmount();
});
test('actual Root projection uses the real helper and shows a native deadline only after matching owner scope acknowledgement',async()=>{
 const snapshot=JSON.parse(readFileSync('tests/fixtures/native-android-app-groups-snapshot.json','utf8'));
 const nativeId='12345678-1234-4123-8123-123456789abc',expiresAt=new Date(Date.now()+300000).toISOString();
 snapshot.platform='ios';snapshot.monitorBudget={used:1,limit:20};snapshot.groups[0].packages=[];
 snapshot.groups[0].break={interventionId:nativeId,expiresAt,effective:true,remainingRestrictionCount:0};
 const f=fixture(false,snapshot),view=render(<f.Probe/>);expect(f.get().nativeAppBreak).toBeNull();
 await act(async()=>{f.release();await Promise.resolve();});
 expect(f.get().nativeAppBreak).toEqual({groupId:snapshot.groups[0].id,nativeInterventionId:nativeId,expiresAt});
 f.unknown();view.rerender(<f.Probe/>);expect(f.get().nativeAppBreak).toBeNull();expect(f.get().appGroupsSnapshotScope).toBeNull();view.unmount();
});
