import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { createRecoveryDnsEnrollment } from '../src/lib/recovery-dns-enrollment';
import { createFirebaseClientEventId, parseFirebaseRecoveryDnsReceipt } from '../src/lib/firebase-client';
import { unavailableRecoveryDns } from '../modules/freed-protection/src/recovery-dns-pilot';

const generation='12345678-1234-4123-8123-123456789abc';
function fixture() {
 let owner:string|null='owner-a', scope:string|null='scope-a', permission=true, registered=true, native:any=null;
 let requests=0, registrations=0, permissions=0, tokenCalls=0, guests=0;
 const store=new Map<string,string>(), options: unknown[]=[];
 const nativePilot={ stage:async(input:any)=>{ native={...unavailableRecoveryDns(),kind:'candidate',supported:true,staged:true,reference:'cd'.repeat(16),nativeConfigurationGeneration:1,credentialHash:input.credentialHash,audience:input.audience,ownerGeneration:input.ownerGeneration};return native; },status:async()=>native??unavailableRecoveryDns() };
 let duringDigest:(()=>void)|null=null;
 const mocks:Record<string,unknown>={
  'expo-secure-store':{ WHEN_UNLOCKED_THIS_DEVICE_ONLY:'device-only',getItemAsync:async(key:string,opts:unknown)=>{options.push(opts);return store.get(key)??null;},setItemAsync:async(key:string,value:string,opts:unknown)=>{options.push(opts);store.set(key,value);} },
  'expo-crypto':{ CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_algorithm:string,text:string)=>{duringDigest?.();return createHash('sha256').update(text).digest('hex');},randomUUID:()=>generation,getRandomBytesAsync:async(bytes:number)=>new Uint8Array(bytes).fill(171) },
  'expo-notifications':{IosAuthorizationStatus:{AUTHORIZED:2},getPermissionsAsync:async()=>({granted:permission}),requestPermissionsAsync:async()=>{permissions++;return {granted:permission};}},
  '@react-native-firebase/app':{getApp:()=>({})},'@react-native-firebase/installations':{getInstallations:()=>({}),getId:async()=>'c123456789012345678901'},
  'freed-protection':{recoveryDnsPilot:nativePilot,isNativeAccountActionScopeCurrent:(candidate:string)=>candidate===scope},
  './firebase-client':{createFirebaseClientEventId,parseFirebaseRecoveryDnsReceipt},
  './recovery-dns-enrollment':{createRecoveryDnsEnrollment},
  './firebase-native':{
   getFirebaseAccountScope:()=>owner,
   getFirebaseCallableContracts:async(opts:any)=>{if(opts.ensureGuest)guests++;if(opts.expectedAccountUid!==owner)return null;return {enrollRecoveryDns:async(request:any,opts:any)=>{assert.equal(opts.operationIsCurrent(),true);requests++;assert.equal('rawSecret' in request,false);return {status:'enrolled',installationId:request.installationId,credentialHash:request.credentialHash,audience:request.audience,ownerGeneration:generation,endpointHost:'freedrecovery.web.app'};},registerPushToken:async(registration:any)=>{registrations++;assert.equal(registration.recoveryContentIncluded,false);return {ok:registered,duplicate:false};}};},
   registerFirebasePushTokenAfterPermission:async(_permission:boolean,opts:any)=>{if(opts.ensureGuest)guests++;tokenCalls++;registrations++;return {status:registered?'registered':'error'};}
  }
 };
 const output=ts.transpileModule(readFileSync('src/lib/recovery-dns-native-enrollment.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports:any={};runInNewContext(output,{exports,require:(name:string)=>{if(!(name in mocks))throw Error(`Unexpected dependency ${name}`);return mocks[name];},Map,Array,JSON,Error});
 const runtime=exports.createRecoveryDnsNativeEnrollment(()=>scope);
 return {runtime,store,options,counts:()=>({requests,registrations,permissions,tokenCalls,guests}),setPermission:(v:boolean)=>{permission=v;},setRegistered:(v:boolean)=>{registered=v;},setOwner:(v:string|null)=>{owner=v;},setScope:(v:string|null)=>{scope=v;},setNative:(v:any)=>{native=v;},native:()=>native,onDigest:(fn:()=>void)=>{duringDigest=fn;}};
}
async function run(){
 const consent={dnsConsent:true,websiteAlertConsent:false,retentionAcknowledged:true};
 const f=fixture();assert.equal((await f.runtime.enroll(consent)).status,'staged');assert.deepEqual(f.counts(),{requests:1,registrations:0,permissions:0,tokenCalls:0,guests:0});
 assert.equal(f.store.size,1);const [key]=f.store.keys();assert.equal(key.includes('owner-a'),false);assert.ok(key.endsWith(createHash('sha256').update('owner-a').digest('hex')));assert.ok(f.options.every((value:any)=>value.keychainAccessible==='device-only'));
 assert.equal((await f.runtime.status()).audience,'ab'.repeat(16));f.setOwner('owner-b');assert.equal(await f.runtime.status(),null);f.setOwner('owner-a');assert.ok(await f.runtime.status());
 const old=f.native();f.setNative({...old,ownerGeneration:'12345678-1234-4123-8123-123456789abd'});assert.equal(await f.runtime.status(),null);
 const alert=fixture();assert.equal((await alert.runtime.enroll({...consent,websiteAlertConsent:true})).status,'staged');assert.deepEqual(alert.counts(),{requests:1,registrations:1,permissions:1,tokenCalls:1,guests:0});
 assert.equal(await alert.runtime.canActivate(),true);alert.setPermission(false);assert.equal(await alert.runtime.canActivate(),false);assert.equal(await f.runtime.canActivate(),false);
 const denied=fixture();denied.setPermission(false);assert.equal((await denied.runtime.enroll({...consent,websiteAlertConsent:true})).reason,'notification-permission-required');assert.equal(denied.counts().requests,0);assert.equal(denied.counts().registrations,0);
 const noRegister=fixture();noRegister.setRegistered(false);assert.equal((await noRegister.runtime.enroll({...consent,websiteAlertConsent:true})).reason,'notification-registration-unavailable');assert.equal(noRegister.counts().requests,0);
 const noOwner=fixture();noOwner.setOwner(null);assert.equal((await noOwner.runtime.enroll(consent)).status,'error');assert.equal(noOwner.counts().guests,0);
 const noConsent=fixture();assert.equal((await noConsent.runtime.enroll({...consent,retentionAcknowledged:false})).status,'error');assert.equal(noConsent.store.size,0);
 const changed=fixture();changed.onDigest(()=>changed.setOwner('owner-b'));assert.equal((await changed.runtime.enroll(consent)).status,'error');assert.equal(changed.store.size,0);assert.equal(changed.counts().requests,0);
 const localeRuntime={language:'en'},copyExports:any={};const copySource=ts.transpileModule(readFileSync('src/i18n/recovery-dns-copy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;runInNewContext(copySource,{exports:copyExports,require:()=>({appI18n:localeRuntime}),Object});
 const englishKeys=Object.keys(copyExports.recoveryDnsCopy());for(const locale of ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans']){localeRuntime.language=locale;const copy=copyExports.recoveryDnsCopy();assert.deepEqual(Object.keys(copy),englishKeys);assert.ok(Object.values(copy).every(value=>typeof value==='string'&&value.trim().length>0),locale);}
 console.log('Recovery DNS native wrapper: device-only owner storage, explicit permission, real registration, and owner/status fences passed.');
}
void run().catch(error=>{console.error(error);process.exitCode=1;});
