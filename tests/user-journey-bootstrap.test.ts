import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { transpileModule, ModuleKind } from 'typescript';
import { configureFirebaseFeatureProviders } from '../src/lib/firebase-feature-runtime';
import { resolveAdultDomainFeed } from '../src/lib/adult-domain-feed-sync';
import { createFirebaseCallableContracts } from '../src/lib/firebase-client';
import { createAuthIdentityCoordinator } from '../src/lib/social-auth-flow';

for (const emulator of [false,true]) test(`actual native initializer/provider cannot create anonymous bootstrap identity (${emulator?'emulator':'normal'})`, async () => {
  const source = readFileSync(`${process.cwd()}/src/lib/firebase-native.ts`, 'utf8');
  const extract = (start: string, end: string) => source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))).replace(/^export /gm,'');
  const script = `let startupPromise=null; ${extract('export function startFirebaseClient()', 'export function getFirebaseNativeAuthAdapter()')}
    ${extract('export async function ensureFirebaseGuestSession()', 'export async function signOutFirebaseAccount()')}
    ${extract('export async function getFirebaseCallableContracts(', 'async function initializeFirebaseClient()')}
    ${extract('async function initializeFirebaseClient()', 'function initializeFirebaseAppCheck()')}
    return {startFirebaseClient};`;
  const compiled = transpileModule(script, {compilerOptions:{module:ModuleKind.CommonJS}}).outputText;
  let user: any = null; let anonymousCalls=0; let remoteCalls=0;
  const auth = { get currentUser() { return user; } };
  const coordinator = createAuthIdentityCoordinator({ currentUser:()=>user,
    signInAnonymously:async()=> { anonymousCalls++; user={uid:'unexpected-guest',isAnonymous:true}; return {user}; },
    signOut:async()=> {user=null;}, signInWithCredential:async()=> {throw Error('unused');}, linkWithCredential:async()=> {throw Error('unused');},
  });
  const domains=['a.example.xxx','b.example.xxx'];
  const checksum=createHash('sha256').update(`${domains.join('\n')}\n`).digest('hex');
  const feed={version:`oisd-nsfw-small-${checksum.slice(0,16)}`,generatedAt:new Date().toISOString(),publishedAt:new Date().toISOString(),checksum,source:{id:'oisd-nsfw-small',label:'OISD NSFW Small',url:'https://nsfw-small.oisd.nl/'},domains};
  const noOp=async()=>{};
  const dependencies={ Platform:{OS:'ios'}, configureFocusShieldRollout:noOp, getFirebaseClientReadiness:()=>({ready:true,functionsRegion:'asia-south1'}),
    getEmulatorRouting:()=>emulator?{}:null, getConfiguredAuth:()=>auth, getConfiguredFunctions:()=>({}), configureFirebaseFeatureProviders,
    initializeFirebaseAppCheck:noOp, crashlyticsModule:()=>({setCrashlyticsCollectionEnabled:noOp}), perfModule:()=>({setPerformanceCollectionEnabled:noOp}),
    remoteConfigModule:()=>({setConfigSettings:noOp,setDefaults:noOp,fetchAndActivate:noOp}), createFirebaseCallableContracts,
    getIdentityCoordinator:()=>coordinator, FIREBASE_CALLABLE_TIMEOUT_MS:10_000,
    httpsCallable:(_functions:any,name:string)=>async()=>{assert.equal(name,'getReviewedAdultDomainFeed');remoteCalls++; return {data:feed};},
  };
  const runtime=new Function(...Object.keys(dependencies),compiled)(...Object.values(dependencies));
  try {
    assert.deepEqual(await runtime.startFirebaseClient(),{status:'started'});
    const result=await resolveAdultDomainFeed(undefined,null);
    assert.equal(anonymousCalls,0,'Provider invocation during signed-out startup must not call signInAnonymously');
    assert.equal(user,null); assert.equal(remoteCalls,0); assert.equal(result.provider,'embedded');
    user={uid:'real-owner',isAnonymous:false};
    const connected=await resolveAdultDomainFeed(undefined,null);
    assert.equal(connected.provider,'remote'); assert.equal(remoteCalls,1); assert.equal(anonymousCalls,0);
  } finally { configureFirebaseFeatureProviders(async()=>null)(); }
});
