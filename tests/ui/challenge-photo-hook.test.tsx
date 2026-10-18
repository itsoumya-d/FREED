import React from 'react';
import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { classifyChallengePhoto, cancelChallengePhoto } from 'freed-protection';
import { adoptTemporaryChallengePhoto, deleteTemporaryChallengePhoto, prepareTemporaryChallengePhotoCapture } from '@/lib/challenge-photo-files';
import { useChallengeVerification } from '@/hooks/useChallengeVerification';
import type { RecoveryChallenge } from '@/lib/recovery-engine';
jest.mock('expo-location',()=>({}));jest.mock('expo-sensors',()=>({Accelerometer:{},Pedometer:{}}));
jest.mock('expo-image-picker',()=>({requestCameraPermissionsAsync:jest.fn().mockResolvedValue({status:'granted'}),launchCameraAsync:jest.fn()}));
jest.mock('@/lib/challenge-photo-files',()=>({adoptTemporaryChallengePhoto:jest.fn(async uri=>uri),deleteTemporaryChallengePhoto:jest.fn(async()=>{}),prepareTemporaryChallengePhotoCapture:jest.fn(()=>true)}));
jest.mock('freed-protection',()=>({getChallengePhotoCapabilities:jest.fn(async()=>({cameraAvailable:true,classifierAvailable:true,identity:{provider:'bundled-mlkit',classifierRevision:'com.google.mlkit:image-labeling:17.0.9',runtimeRevision:'android-36',ruleRevision:'freed-photo-targets-v1',modelWeightsRevision:null},supportedTargetIds:['flower'],validatedPhotoTargets:[]})),classifyChallengePhoto:jest.fn(),cancelChallengePhoto:jest.fn(async()=>true)}));
const identity={provider:'bundled-mlkit',classifierRevision:'com.google.mlkit:image-labeling:17.0.9',runtimeRevision:'android-36',ruleRevision:'freed-photo-targets-v1',modelWeightsRevision:null};
const classification={available:true,matched:true,outcome:'matched',identity,labels:['flower'],matchedLabels:['flower'],confidence:.8,message:'Target found.'};
const challenge={id:'photo-flower',durationSec:30,verification:{version:1,kind:'photo',targetId:'flower'}} as RecoveryChallenge;
const flush=async()=>{await act(async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();});};
afterEach(()=>{jest.restoreAllMocks();});
beforeEach(()=>{jest.spyOn(AppState,'addEventListener').mockImplementation(()=>({remove:()=>{}}));Object.defineProperty(AppState,'currentState',{value:'active',writable:true,configurable:true});jest.mocked(classifyChallengePhoto).mockResolvedValue(classification as never);});
test('camera foreground pause retains the current session photo operation',async()=>{
 let finish!:(v:any)=>void;let background!:(state:any)=>void;const listener=jest.spyOn(AppState,'addEventListener').mockImplementation((_,cb)=>{background=cb;return {remove:()=>{}};});
 jest.mocked(ImagePicker.launchCameraAsync).mockImplementation(()=>new Promise(r=>finish=r));
 const hook=renderHook(({active})=>useChallengeVerification(challenge,30,active,false,'s1'),{initialProps:{active:true}});
 let capture!:Promise<void>;await act(async()=>{capture=hook.result.current.capturePhoto();});await flush();
 act(()=>{Object.defineProperty(AppState,'currentState',{value:'background',writable:true});background('background');});hook.rerender({active:false});
 expect(cancelChallengePhoto).not.toHaveBeenCalled();
 await act(async()=>{finish({canceled:false,assets:[{uri:'camera-photo'}]});await capture;});
 expect(hook.result.current.evidence.photoMatched).toBe(true);expect(deleteTemporaryChallengePhoto).toHaveBeenCalledWith('camera-photo');hook.unmount();listener.mockRestore();
});
test('unmount aborts UI but a remount cannot open another camera before the first returns',async()=>{
 let finish!:(v:any)=>void;jest.mocked(ImagePicker.launchCameraAsync).mockImplementation(()=>new Promise(r=>finish=r));
 const first=renderHook(()=>useChallengeVerification(challenge,30,true,false,'s1'));let capture!:Promise<void>;await act(async()=>{capture=first.result.current.capturePhoto();});await flush();first.unmount();await capture;
 const second=renderHook(()=>useChallengeVerification(challenge,30,true,false,'s2'));await act(async()=>{await second.result.current.capturePhoto();});expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1);
 await act(async()=>{finish({canceled:false,assets:[{uri:'late-photo'}]});});await flush();expect(adoptTemporaryChallengePhoto).toHaveBeenCalledWith('late-photo');expect(deleteTemporaryChallengePhoto).toHaveBeenCalledWith('late-photo');expect(classifyChallengePhoto).not.toHaveBeenCalled();expect(second.result.current.evidence.photoMatched).toBe(false);second.unmount();
});
test('session replacement aborts inference and rejects its late native callback',async()=>{
 let finish!:(v:any)=>void;jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({canceled:false,assets:[{uri:'inference-photo'}]} as never);jest.mocked(classifyChallengePhoto).mockImplementation(()=>new Promise(r=>finish=r));
 const hook=renderHook(({session})=>useChallengeVerification(challenge,30,true,false,session),{initialProps:{session:'s1'}});let capture!:Promise<void>;await act(async()=>{capture=hook.result.current.capturePhoto();});await flush();
 hook.rerender({session:'s2'});await act(async()=>{await capture;});expect(cancelChallengePhoto).toHaveBeenCalled();expect(hook.result.current.evidence.photoMatched).toBe(false);
 await act(async()=>{finish(classification);});await flush();expect(hook.result.current.evidence.photoMatched).toBe(false);expect(deleteTemporaryChallengePhoto).toHaveBeenCalledWith('inference-photo');hook.unmount();
});

test('storage admission prevents camera and leaves already earned session evidence intact', async () => {
 jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({canceled:false,assets:[{uri:'earned-photo'}]} as never);
 const hook=renderHook(()=>useChallengeVerification(challenge,30,true,false,'storage-session'));
 await act(async()=>{await hook.result.current.capturePhoto();});
 expect(hook.result.current.evidence.photoMatched).toBe(true);
 const before=jest.mocked(ImagePicker.launchCameraAsync).mock.calls.length;
 jest.mocked(prepareTemporaryChallengePhotoCapture).mockReturnValueOnce(false);
 await act(async()=>{await hook.result.current.capturePhoto();});
 expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(before);
 expect(hook.result.current.evidence.photoMatched).toBe(true);
 expect(hook.result.current.photoBusy).toBe(false);
 expect(hook.result.current.status).toBe('On-device image classification is unavailable in this build.');
 hook.unmount();
});
