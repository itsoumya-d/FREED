import test from 'node:test';
import assert from 'node:assert/strict';
import packet from 'dns-packet';
import { createFamiliesPolicy } from '../src/families-policy.js';
const feed = { classify: () => 'allow' };
const responder = (answers = [], flags = packet.RECURSION_AVAILABLE, options = {}) => async (url, init) => {
  assert.equal(url, 'https://family.cloudflare-dns.com/dns-query'); assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
  const query = packet.decode(init.body); assert.equal(query.questions[0].type, 'A');
  const body = packet.encode({ id: options.wrongId ? (query.id + 1) % 65536 : query.id, type: 'response', flags, questions: query.questions, answers });
  return new Response(body, { status: 200, headers: { 'content-type': 'application/dns-message' } });
};
const a = data => ({name:'test.example',type:'A',class:'IN',ttl:60,data});
test('blocked policy result denies even though the transport uses ordinary DNS', async () => {
  assert.equal(await createFamiliesPolicy({ feed, fetchImpl: responder([a('0.0.0.0')]) }).classify('test.example'), 'deny');
});
test('SafeSearch CNAME is a policy allow, never a forwarded response', async () => {
  const result = await createFamiliesPolicy({feed, fetchImpl:responder([{name:'www.google.com',type:'CNAME',class:'IN',ttl:60,data:'forcesafesearch.google.com'},a('216.239.38.120')])}).classify('www.google.com');
  assert.equal(result,'allow'); assert.equal(typeof result,'string');
});
test('local deny and stale policy never make an upstream request', async () => {
  for (const local of ['deny','unavailable']) {
    assert.equal(await createFamiliesPolicy({feed:{classify:()=>local},fetchImpl:()=>{throw Error('must not fetch');}}).classify('test.example'),local);
  }
});
test('policy outage, DNS failure, mismatched response and truncation fail closed', async () => {
  for (const fetchImpl of [async()=>{throw Error('offline');}, responder([],packet.RECURSION_AVAILABLE|2), responder([],packet.RECURSION_AVAILABLE,{wrongId:true}), responder([],packet.RECURSION_AVAILABLE|packet.TRUNCATED_RESPONSE),async()=>new Response('bad',{status:200,headers:{'content-type':'text/html'}})]) {
    assert.equal(await createFamiliesPolicy({feed,fetchImpl}).classify('test.example'),'unavailable');
  }
});
test('cancellation prevents provider call',async()=>{
  const abort=new AbortController();abort.abort();let called=false;
  assert.equal(await createFamiliesPolicy({feed,fetchImpl:async()=>{called=true;throw Error();}}).classify('test.example',{signal:abort.signal}),'unavailable');assert.equal(called,false);
});
test('oversized policy response cannot become allow',async()=>{
  assert.equal(await createFamiliesPolicy({feed,fetchImpl:async()=>new Response(Buffer.alloc(65536),{headers:{'content-type':'application/dns-message'}})}).classify('test.example'),'unavailable');
});

test('stalled policy request and body are bounded even when an adapter ignores cancellation',async()=>{
  for(const fetchImpl of [()=>new Promise(()=>{}),async()=>new Response(new ReadableStream({pull:()=>new Promise(()=>{})}),{headers:{'content-type':'application/dns-message'}})]){
    // Keep the test host alive; AbortSignal.timeout itself is unref'ed by Node.
    const keepAlive=setTimeout(()=>{},200);
    try{assert.equal(await createFamiliesPolicy({feed,fetchImpl,timeoutMs:20}).classify('test.example'),'unavailable');}finally{clearTimeout(keepAlive);}
  }
});
