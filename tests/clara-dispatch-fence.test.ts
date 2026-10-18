import assert from 'node:assert/strict';
import test from 'node:test';
import {createClaraConversationDispatcher} from '../src/lib/firebase-feature-runtime';
import {CLARA_CLOUD_CONSENT} from '../src/lib/clara-conversation';
const payload={clientEventId:'clara_0123456789abcdef0123456789abcdef',consentVersion:CLARA_CLOUD_CONSENT,locale:'en' as const,input:'Owner A private words',conversation:[]};
test('contract acquisition is bound to originating owner and rechecks cancellation before sending',async()=>{
 for(const reason of ['cancel','consent','owner']){
 let current=true,calls=0,resolve!:(api:any)=>void;const acquired=new Promise<any>(yes=>{resolve=yes;});
 const dispatcher=createClaraConversationDispatcher(async owner=>{assert.equal(owner,'owner-a');return acquired;});
 const pending=dispatcher(payload,{ownerUid:'owner-a',isCurrent:()=>current});
 current=false;resolve({generateGoogleClaraReply:async()=>{calls++;}});await assert.rejects(()=>pending);assert.equal(calls,0,reason);
 }
});
