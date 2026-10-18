import assert from 'node:assert/strict';
import test from 'node:test';
import {buildClaraCloudPayload,readCloudChatConsent,saveCloudChatConsent,configureClaraConversationTransport,replyWithClaraConversation,parseClaraCloudResult,CLARA_CLOUD_CONSENT} from '../src/lib/clara-conversation';
const eventId='clara_0123456789abcdef0123456789abcdef';
const consent={version:CLARA_CLOUD_CONSENT,enabled:true,includeConversation:false};
test('new cloud payload contains no aggregate or inferred history, and previous messages require a separate choice',()=>{
 const options={eventId,locale:'en' as const,consent,messages:[{role:'user' as const,text:'My old message'},{role:'ai' as const,text:'SDK-ONLY-TAINT: shield activity'}]};
 const payload=buildClaraCloudPayload('My new message',options);assert.deepEqual(payload.conversation,[]);
 assert.deepEqual(Object.keys(payload).sort(),['clientEventId','consentVersion','conversation','input','locale']);
 const selected=buildClaraCloudPayload('My new message',{...options,consent:{...consent,includeConversation:true}});
 assert.deepEqual(selected.conversation,[{role:'user',text:'My old message'}]);assert.doesNotMatch(JSON.stringify(selected),/SDK-ONLY-TAINT/);
 assert.throws(()=>buildClaraCloudPayload('My new message',{...options,consent:{...consent,enabled:false}}));
});
test('cloud consent defaults off, is owner-specific, and storage errors do not become consent',()=>{
 const values=new Map<string,string>();const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 assert.equal(readCloudChatConsent(storage,'owner').enabled,false);saveCloudChatConsent(storage,'owner',consent);
 assert.equal(readCloudChatConsent(storage,'owner').enabled,true);assert.equal(readCloudChatConsent(storage,'other').enabled,false);
 assert.equal(readCloudChatConsent({getItem:()=>{throw Error('disk');},setItem:()=>{}},'owner').enabled,false);
});
test('registered transport cannot send without user consent; actual unavailable/quota status accompanies local help',async()=>{
 let calls=0;
 configureClaraConversationTransport(async()=>{calls++;return{text:'',provider:'fallback',serviceState:'daily-quota-exhausted',action:'none',quota:{remaining:0,limit:3,resetsAt:'2026-10-06T00:00:00Z'}};});
 const context={attempts:[],locale:'en' as const};
 try{
 const guard={ownerUid:'owner',isCurrent:()=>true};
 const off=await replyWithClaraConversation('Help me pause',context,{guard,consent:{...consent,enabled:false},messages:[],eventId:async()=>eventId});assert.equal(calls,0);assert.equal(off.provider,'local');
 const result=await replyWithClaraConversation('Help me pause',context,{guard,consent,messages:[],eventId:async()=>eventId});assert.equal(calls,1);assert.equal(result.serviceState,'daily-quota-exhausted');assert.equal(result.quota?.remaining,0);assert.ok(result.text);
 assert.throws(()=>parseClaraCloudResult({...result,provider:'remote',serviceState:'online',quota:{remaining:99,limit:3,resetsAt:null}}));
 }finally{configureClaraConversationTransport(null);}
});
test('cancellation, consent withdrawal and account changes during event creation prevent transmission',async()=>{
 for(const reason of ['cancel','consent','owner']){
  let current=true,calls=0,resolve!:(value:string)=>void;const id=new Promise<string>(yes=>{resolve=yes;});
  configureClaraConversationTransport(async()=>{calls++;throw Error('must not send');});
  const pending=replyWithClaraConversation('Owner A private words',{attempts:[]},{guard:{ownerUid:'owner-a',isCurrent:()=>current},consent,messages:[],eventId:()=>id});
  current=false;resolve(eventId);await pending;assert.equal(calls,0,reason);
 }
 configureClaraConversationTransport(null);
});
