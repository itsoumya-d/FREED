import React from 'react';
import { AppState, Linking } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useEarnedChallengeEvidence } from '@/hooks/useEarnedChallengeEvidence';
import { getEarnedResetChoices } from '@/lib/earned-reset-templates';
import { captureEarnedChallengePhoto, cancelNativeAccountResources, setEarnedChallengeEvidencePhase } from 'freed-protection';
import { Pedometer } from 'expo-sensors';
import * as ImagePicker from 'expo-image-picker';
import { beginEarnedChallengeEvidence } from 'freed-protection';

let mockPhase='active',mockSteps=0,mockProof:string|null=null,mockBeginRequest:any,mockTargets:string[]=[],mockPhotoProofs:string[]=[],mockNativeId='42345678-1234-4123-8123-123456789abc',mockNativeStepUnavailable=false;
const mockReceipt=():any=>({version:1,supported:true,accepted:true,reason:null,session:{evidenceSessionId:mockNativeId,offerId:mockBeginRequest.offerId,completionSessionId:mockBeginRequest.completionSessionId,templateId:mockBeginRequest.templateId,templateVersion:2,method:mockBeginRequest.method,phase:mockPhase,observedSteps:mockSteps,requiredSteps:30,requiredPhotoTargets:1,supportedTargetIds:mockBeginRequest.method==='photo'?['chair']:[],matchedTargetIds:mockTargets,stepProofId:mockProof,photoProofIds:mockPhotoProofs}});
jest.mock('expo-crypto',()=>({randomUUID:()=> '62345678-1234-4123-8123-123456789abc'}));
jest.mock('expo-sensors',()=>({Pedometer:{isAvailableAsync:jest.fn(async()=>true),getPermissionsAsync:jest.fn(async()=>({status:'granted',canAskAgain:true})),requestPermissionsAsync:jest.fn(async()=>({status:'granted',canAskAgain:true}))}}));
jest.mock('expo-image-picker',()=>({getCameraPermissionsAsync:jest.fn(async()=>({status:'granted',canAskAgain:true})),requestCameraPermissionsAsync:jest.fn(async()=>({status:'granted',canAskAgain:true}))}));
jest.mock('freed-protection',()=>({
 isEarnedChallengeEvidenceAvailable:()=>true,
 beginEarnedChallengeEvidence:jest.fn(async request=>{mockBeginRequest=request;return mockNativeStepUnavailable?{version:1,supported:true,accepted:false,reason:'earned-challenge-step-sensor-unavailable',session:null}:mockReceipt()}),
 getEarnedChallengeEvidence:jest.fn(async()=>mockReceipt()),
 setEarnedChallengeEvidencePhase:jest.fn(async request=>{mockPhase=request.phase;if(mockPhase==='cancelled'){mockProof=null;mockTargets=[];mockPhotoProofs=[]}return mockReceipt()}),
 finishEarnedChallengeEvidence:jest.fn(async()=>{mockPhase='completed';if(mockBeginRequest.method==='steps')mockProof='52345678-1234-4123-8123-123456789abc';return mockReceipt()}),
 captureEarnedChallengePhoto:jest.fn(),
 cancelNativeAccountResources:jest.fn(async()=>({state:'pending',osDismissalConfirmed:false})),
}));
const offer:any={offerId:'32345678-1234-4123-8123-123456789abc',nativeInterventionId:'12345678-1234-4123-8123-123456789abc',groupId:'group',groupRevision:1,configurationGeneration:1,scopeEpoch:1,kind:'ios-app-group',requestedSeconds:300,budgetDay:'2026-10-11',budgetRevision:0,validUntil:'2026-10-11T12:00:00Z',requiredActiveSeconds:60,requiredSteps:30,requiredDistinctPhotoTargets:1,availableMethods:['timer','steps','photo'],supportedPhotoTargetIds:['chair']};
const session=(kind:'steps'|'photo')=>{const challenge=getEarnedResetChoices(offer).find(value=>value.challenge.verification?.kind===kind)!.challenge;return {id:'session',ownerId:'owner',challenge,phase:'paused' as const,elapsedMs:0,createdAtMs:Date.parse('2026-10-11T10:00:00Z'),evidence:{steps:0,motionSamples:0,distanceMeters:0,locationSamples:0},templateRevision:{id:challenge.id,revision:2}}};
const flush=async()=>{await act(async()=>{for(let i=0;i<8;i++)await Promise.resolve()})};
let listeners:Set<(state:string)=>void>;
beforeEach(()=>{jest.useFakeTimers();mockPhase='active';mockSteps=0;mockProof=null;mockTargets=[];mockPhotoProofs=[];listeners=new Set();Object.defineProperty(AppState,'currentState',{configurable:true,value:'active'});jest.spyOn(AppState,'addEventListener').mockImplementation((_,callback)=>{listeners.add(callback as any);return{remove:()=>{listeners.delete(callback as any)}}});jest.mocked(Pedometer.isAvailableAsync).mockResolvedValue(true);jest.mocked(Pedometer.getPermissionsAsync).mockResolvedValue({status:'granted',canAskAgain:true} as any);jest.mocked(Pedometer.requestPermissionsAsync).mockResolvedValue({status:'granted',canAskAgain:true} as any);jest.mocked(ImagePicker.getCameraPermissionsAsync).mockResolvedValue({status:'granted',canAskAgain:true} as any);jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({status:'granted',canAskAgain:true} as any);});
afterEach(()=>{jest.clearAllTimers();jest.useRealTimers();jest.restoreAllMocks();});
test('actual hook reads steps, propagates user pause, and finishes a native proof separately from timer history',async()=>{
 const original=session('steps');const hook=renderHook(({active})=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active,isCurrent:()=>true}),{initialProps:{active:true}});await flush();
 expect(hook.result.current.satisfied).toBe(false);hook.rerender({active:false});await flush();expect(hook.result.current.receipt?.session?.phase).toBe('paused');
 mockSteps=30;hook.rerender({active:true});await flush();expect(hook.result.current.satisfied).toBe(true);
 let result:any;await act(async()=>{result=await hook.result.current.finish()});expect(result.session.stepProofId).toBe('52345678-1234-4123-8123-123456789abc');expect(original.elapsedMs).toBe(0);hook.unmount();
});
test('native camera transition retains photo authority through foreground pause and exposes real target proof',async()=>{
 let resolve!:(receipt:any)=>void;jest.mocked(captureEarnedChallengePhoto).mockImplementation(()=>new Promise(r=>{resolve=r}));
 const original=session('photo');const hook=renderHook(({active})=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active,isCurrent:()=>true}),{initialProps:{active:true}});await flush();
 let capture!:Promise<void>;await act(async()=>{capture=hook.result.current.capturePhoto()});await flush();
 act(()=>{Object.defineProperty(AppState,'currentState',{configurable:true,value:'background'});listeners.forEach(listener=>listener('background'))});hook.rerender({active:false});await flush();expect(mockPhase).toBe('active');
 await act(async()=>{mockTargets=['chair'];mockPhotoProofs=['72345678-1234-4123-8123-123456789abc'];resolve({...mockReceipt(),result:'matched',targetId:'chair',proofId:mockPhotoProofs[0]});await capture});
 act(()=>{Object.defineProperty(AppState,'currentState',{configurable:true,value:'active'});listeners.forEach(listener=>listener('active'))});hook.rerender({active:true});await flush();
 expect(hook.result.current.receipt?.session?.photoProofIds).toEqual(['72345678-1234-4123-8123-123456789abc']);expect(hook.result.current.satisfied).toBe(true);hook.unmount();
});
test('undetermined motion permission is requested after active selection and before native begin',async()=>{
 jest.mocked(Pedometer.getPermissionsAsync).mockResolvedValue({status:'undetermined',canAskAgain:true} as any);
 const original=session('steps');const hook=renderHook(({active})=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active,isCurrent:()=>true}),{initialProps:{active:false}});await flush();
 expect(Pedometer.requestPermissionsAsync).not.toHaveBeenCalled();expect(beginEarnedChallengeEvidence).not.toHaveBeenCalled();
 hook.rerender({active:true});await flush();expect(Pedometer.requestPermissionsAsync).toHaveBeenCalledTimes(1);expect(hook.result.current.receipt?.session?.phase).toBe('active');
 expect(jest.mocked(Pedometer.requestPermissionsAsync).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(beginEarnedChallengeEvidence).mock.invocationCallOrder[0]);hook.unmount();
});
test('denied permission keeps native authority unavailable and offers Settings repair without repeating prompts',async()=>{
 jest.mocked(Pedometer.getPermissionsAsync).mockResolvedValue({status:'denied',canAskAgain:false} as any);const settings=jest.spyOn(Linking,'openSettings').mockResolvedValue();
 const original=session('steps');const hook=renderHook(()=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active:true,isCurrent:()=>true}));await flush();
 expect(hook.result.current.state).toBe('unavailable');expect((hook.result.current as any).repairLabel).toBe('Open app settings');expect(beginEarnedChallengeEvidence).not.toHaveBeenCalled();
 await act(async()=>{await hook.result.current.retry()});expect(settings).toHaveBeenCalledTimes(1);expect(Pedometer.requestPermissionsAsync).not.toHaveBeenCalled();
 jest.mocked(Pedometer.getPermissionsAsync).mockResolvedValue({status:'granted',canAskAgain:true} as any);act(()=>listeners.forEach(listener=>listener('active')));await flush();expect(hook.result.current.receipt?.session?.phase).toBe('active');hook.unmount();
});
test.each(['owner','background','session'] as const)('late motion approval after %s cannot begin native evidence',async reason=>{
 let resolve!:(value:any)=>void;jest.mocked(Pedometer.getPermissionsAsync).mockResolvedValue({status:'undetermined',canAskAgain:true} as any);jest.mocked(Pedometer.requestPermissionsAsync).mockImplementation(()=>new Promise(r=>{resolve=r}));let allowed=true;
 const original=session('steps');const hook=renderHook(({record,active})=>useEarnedChallengeEvidence({session:record,offer,ownerScope:'owner-scope',active,isCurrent:()=>allowed}),{initialProps:{record:original,active:true}});await flush();
 if(reason==='owner')allowed=false;if(reason==='background'){act(()=>{Object.defineProperty(AppState,'currentState',{configurable:true,value:'background'});listeners.forEach(listener=>listener('background'))});hook.rerender({record:original,active:false})}if(reason==='session')hook.rerender({record:{...original,id:'replacement'},active:false});
 await act(async()=>{resolve({status:'granted',canAskAgain:true})});await flush();expect(beginEarnedChallengeEvidence).not.toHaveBeenCalled();hook.unmount();
});
test('native camera capture requires explicit camera permission with current foreground scope',async()=>{
 jest.mocked(ImagePicker.getCameraPermissionsAsync).mockResolvedValue({status:'undetermined',canAskAgain:true} as any);jest.mocked(captureEarnedChallengePhoto).mockResolvedValue({...mockReceipt(),result:'cancelled',targetId:null,proofId:null} as any);
 const original=session('photo');const hook=renderHook(()=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active:true,isCurrent:()=>true}));await flush();expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
 await act(async()=>{await hook.result.current.capturePhoto()});expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(1);expect(jest.mocked(ImagePicker.requestCameraPermissionsAsync).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(captureEarnedChallengePhoto).mock.invocationCallOrder[0]);hook.unmount();
});
test('validated detector-only native support works even when Expo counter availability is false',async()=>{
 jest.mocked(Pedometer.isAvailableAsync).mockResolvedValue(false);const original=session('steps');const hook=renderHook(()=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active:true,isCurrent:()=>true}));await flush();expect(hook.result.current.state).toBe('active');expect(hook.result.current.receipt?.session?.method).toBe('steps');expect(Pedometer.isAvailableAsync).not.toHaveBeenCalled();expect(Pedometer.getPermissionsAsync).toHaveBeenCalled();expect(beginEarnedChallengeEvidence).toHaveBeenCalled();hook.unmount();
});
test('native sensor-unavailable response stays unavailable without manufacturing completion',async()=>{
 mockNativeStepUnavailable=true;try{jest.mocked(Pedometer.isAvailableAsync).mockResolvedValue(false);const original=session('steps');const hook=renderHook(()=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active:true,isCurrent:()=>true}));await flush();expect(beginEarnedChallengeEvidence).toHaveBeenCalled();expect(hook.result.current.state).toBe('unavailable');expect(hook.result.current.receipt).toBeNull();expect(hook.result.current.satisfied).toBe(false);let proof:any;await act(async()=>{proof=await hook.result.current.finish()});expect(proof).toBeNull();hook.unmount();}finally{mockNativeStepUnavailable=false;}
});
test('late camera permission approval after background cannot invoke native capture',async()=>{
 let resolve!:(value:any)=>void;jest.mocked(ImagePicker.getCameraPermissionsAsync).mockResolvedValue({status:'undetermined',canAskAgain:true} as any);jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockImplementation(()=>new Promise(r=>{resolve=r}));const original=session('photo');const hook=renderHook(({active})=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active,isCurrent:()=>true}),{initialProps:{active:true}});await flush();let pending!:Promise<void>;await act(async()=>{pending=hook.result.current.capturePhoto()});await flush();
 act(()=>{Object.defineProperty(AppState,'currentState',{configurable:true,value:'background'});listeners.forEach(listener=>listener('background'))});hook.rerender({active:false});await act(async()=>{resolve({status:'granted',canAskAgain:true});await pending});expect(captureEarnedChallengePhoto).not.toHaveBeenCalled();hook.unmount();
});
test('Allow camera repair retries permission only from its explicit action',async()=>{
 jest.mocked(ImagePicker.getCameraPermissionsAsync).mockResolvedValue({status:'undetermined',canAskAgain:true} as any);jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValueOnce({status:'undetermined',canAskAgain:true} as any).mockResolvedValue({status:'granted',canAskAgain:true} as any);
 const original=session('photo');const hook=renderHook(()=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'owner-scope',active:true,isCurrent:()=>true}));await flush();await act(async()=>{await hook.result.current.capturePhoto()});expect(hook.result.current.repairLabel).toBe('Allow camera access');expect(captureEarnedChallengePhoto).not.toHaveBeenCalled();
 jest.mocked(captureEarnedChallengePhoto).mockResolvedValue({...mockReceipt(),result:'cancelled',targetId:null,proofId:null} as any);await act(async()=>{await hook.result.current.retry()});expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(2);expect(captureEarnedChallengePhoto).toHaveBeenCalledTimes(1);hook.unmount();
});

test('retired actual hook disposes only its captured native evidence resource and never claims cancellation proof',async()=>{
 let owned=true;const original=session('steps');const hook=renderHook(()=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'captured-opaque-A',active:true,isCurrent:()=>owned}));await flush();const evidenceId=hook.result.current.receipt?.session?.evidenceSessionId;expect(evidenceId).toBeTruthy();owned=false;const phases=jest.mocked(setEarnedChallengeEvidencePhase).mock.calls.length;hook.unmount();await flush();expect(cancelNativeAccountResources).toHaveBeenCalledWith('captured-opaque-A',evidenceId,undefined);expect(jest.mocked(setEarnedChallengeEvidencePhase).mock.calls.length).toBe(phases);
});

test('actual hook carries exact in-flight capture operation ID during retired disposal',async()=>{
 let owned=true,release!:(value:any)=>void;jest.mocked(captureEarnedChallengePhoto).mockImplementation(()=>new Promise(r=>{release=r}));const original=session('photo');const hook=renderHook(()=>useEarnedChallengeEvidence({session:original,offer,ownerScope:'capture-opaque-A',active:true,isCurrent:()=>owned}));await flush();let pending!:Promise<void>;await act(async()=>{pending=hook.result.current.capturePhoto()});await flush();const request=jest.mocked(captureEarnedChallengePhoto).mock.calls.at(-1)![0];const evidenceId=hook.result.current.receipt!.session!.evidenceSessionId;owned=false;hook.unmount();expect(cancelNativeAccountResources).toHaveBeenCalledWith('capture-opaque-A',evidenceId,request.captureOperationId);await act(async()=>{release({...mockReceipt(),result:'cancelled',targetId:null,proofId:null});await pending});
});
