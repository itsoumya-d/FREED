import assert from 'node:assert/strict';
import test from 'node:test';
import {createGoogleClaraProvider} from './clara-google.js';
import {CLARA_CONSENT_VERSION,type ClaraCloudRequest} from './clara-cloud.js';
const request:ClaraCloudRequest={clientEventId:'clara_0123456789abcdef0123456789abcdef',consentVersion:CLARA_CONSENT_VERSION,locale:'en',input:'Please help me pause at https://private.example/secret.',conversation:[]};
test('Google transport uses only attached authorization, bounded text and allowlisted actions',async()=>{
 let body:any;
 const provider=createGoogleClaraProvider({projectId:'freed-7d5ee',headers:async()=>new Headers({authorization:'Bearer synthetic-test-token'}),fetcher:async(url,init)=>{
  assert.match(String(url),/locations\/global\/publishers\/google\/models\/gemini-3.5-flash-lite:generateContent$/);
  body=JSON.parse(String(init?.body));assert.equal((init?.headers as any).authorization,'Bearer synthetic-test-token');
  return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'Take a comfortable breath.',action:'breathe'})}]}}]});
 }});
 assert.equal((await provider(request)).action,'breathe');
 assert.equal(body.generationConfig.maxOutputTokens,1024);
 assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'MINIMAL');
 assert.doesNotMatch(JSON.stringify(body),/private\.example|secret/);
 for(const key of ['tools','cachedContent','apiKey','labels'])assert.equal(body[key],undefined);
});
test('incomplete, blocked, oversized and arbitrary provider output never becomes a reply',async()=>{
 const data=[{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]},
 {candidates:[{finishReason:'STOP',safetyRatings:[{blocked:true}],content:{parts:[{text:'{}'}]}}]},
 {candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'hi',action:'disable-protection'})}]}}]},
 {candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({text:'x'.repeat(1201),action:'none'})}]}}]}];
 for(const payload of data){const provider=createGoogleClaraProvider({projectId:'freed-7d5ee',headers:async()=>new Headers(),fetcher:async()=>Response.json(payload)});await assert.rejects(()=>provider(request));}
 const oversized=createGoogleClaraProvider({projectId:'freed-7d5ee',headers:async()=>new Headers(),fetcher:async()=>new Response('x'.repeat(65537))});await assert.rejects(()=>oversized(request));
});
test('credential and transport hangs have a real deadline',async()=>{
 let calls=0;
 const provider=createGoogleClaraProvider({projectId:'freed-7d5ee',headers:()=>new Promise(()=>{}),fetcher:async()=>{calls++;return Response.json({});},timeoutMs:20});
 await assert.rejects(()=>provider(request));assert.equal(calls,0);
});
test('a stalled fetch or body reader is aborted by the same hard deadline',async()=>{
 for(const phase of ['fetch','body']){
 let signal:AbortSignal|undefined;
 const provider=createGoogleClaraProvider({projectId:'freed-7d5ee',headers:async()=>new Headers(),timeoutMs:20,fetcher:async(_url,init)=>{
  signal=init?.signal as AbortSignal;
  if(phase==='fetch')return new Promise(()=>{});
  return new Response(new ReadableStream({pull:()=>new Promise(()=>{})}));
 }});
 await assert.rejects(()=>provider(request));assert.equal(signal?.aborted,true,phase);
 }
});
