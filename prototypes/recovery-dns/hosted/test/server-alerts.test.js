import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { createHash } from 'node:crypto';
import packet from 'dns-packet';
import { DomainFeed } from '../src/feed.js';
import { createFamiliesPolicy } from '../src/families-policy.js';
import { createRecoveryServer } from '../src/server.js';
import { createFcmSender, createAttachedServiceAccountTokenProvider } from '../src/alerts.js';

const secret = 'a'.repeat(64);
const hash = createHash('sha256').update(secret, 'utf8').digest('hex');
const installation = () => ({ installationId: 'synthetic-installation', active: true, dnsConsent: true, websiteAlertConsent: true, ownerGeneration: 'owner-1', currentOwnerGeneration: 'owner-1', audience: 'b'.repeat(32), pushTarget: { installationId: 'synthetic-installation', token: 'synthetic-not-a-real-push-token' } });
const query = name => packet.encode({ type: 'query', id: 22, flags: packet.RECURSION_DESIRED, questions: [{ name, type: 'A', class: 'IN' }] });
async function serverFixture(t, options = {}) {
  const feed = new DomainFeed(); feed.replace({ reviewed: true, version: 1, generatedAt: Date.now(), expiresAt: Date.now() + 100_000, domains: ['blocked.test'] });
  const service = createRecoveryServer({ feed, reserveDnsRequest: async () => ({ status: 'granted' }), resolveInstallation: async digest => { assert.equal(digest, hash); return installation(); }, forward: async wire => packet.encode({ ...packet.decode(wire), type: 'response' }), ...options });
  await new Promise(r => service.server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${service.server.address().port}/dns/${secret}/dns-query`;
  t.after(() => service.close());
  return { ...service, url };
}
async function post(url, name = 'safe.test') { return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/dns-message' }, body: query(name) }); }
test('actual HTTP GET/POST normal forwarding never shares private cache content', async t => {
  const { url } = await serverFixture(t);
  for (const response of [await post(url), await fetch(`${url}?dns=${query('safe.test').toString('base64url')}`)]) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    assert.equal(packet.decode(Buffer.from(await response.arrayBuffer())).rcode, 'NOERROR');
  }
});
test('strict route, media, query/body bounds and malformed DNS fail without forwarding', async t => {
  const { url } = await serverFixture(t, { forward: async () => assert.fail('must not forward') });
  assert.equal((await fetch(url, { method: 'PUT' })).status, 405);
  assert.equal((await fetch(url, { method: 'POST', body: query('safe.test') })).status, 415);
  assert.equal((await fetch(`${url}?dns=x&dns=y`)).status, 400);
  assert.equal((await fetch(`${url}?dns=${'a'.repeat(7000)}`)).status, 414);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/dns-message' }, body: Buffer.alloc(4097) })).status, 413);
  assert.equal((await fetch(url.replace(secret, secret.toUpperCase()))).status, 404);
});
test('missing installation adapter, revoked DNS consent and owner mismatch fail closed', async t => {
  for (const resolveInstallation of [undefined, async () => ({ ...installation(), dnsConsent: false }), async () => ({ ...installation(), currentOwnerGeneration: 'owner-2' })]) {
    const { url } = await serverFixture(t, { resolveInstallation, forward: async () => assert.fail('must not forward') });
    assert.equal((await post(url)).status, 403);
  }
});
test('revocation between classification and forwarding prevents upstream use', async t => {
  let checks = 0;
  const { url } = await serverFixture(t, { resolveInstallation: async () => ++checks < 3 ? installation() : null, forward: async () => assert.fail('must not forward') });
  assert.equal((await post(url)).status, 403);
  assert.equal(checks, 3);
});
test('admission is reserved once per request and absent/unavailable/exhausted gates fail closed', async t => {
  let reservations = 0; let checks = 0;
  const { url } = await serverFixture(t, { resolveInstallation: async () => { checks++; return installation(); }, reserveDnsRequest: async (privateRequest, { signal }) => {
    reservations++; signal.throwIfAborted();
    assert.deepEqual(Object.keys(privateRequest).sort(), ['installationHash', 'installationId', 'ownerGeneration', 'requestId']);
    assert.equal(privateRequest.installationHash, hash);
    return { status: 'granted' };
  } });
  assert.equal((await post(url)).status, 200);
  assert.equal(reservations, 1); assert.equal(checks, 3);
  for (const [reserveDnsRequest, status] of [[undefined, 503], [async () => ({ status: 'unavailable' }), 503], [async () => ({ status: 'exhausted' }), 429], [async () => { throw new Error('synthetic admission unavailable'); }, 503]]) {
    const gated = await serverFixture(t, { reserveDnsRequest, forward: async () => assert.fail('must not forward') });
    assert.equal((await post(gated.url)).status, status);
  }
});
test('missing/stale feed returns DNS SERVFAIL with no upstream or alert', async t => {
  const { url } = await serverFixture(t, { feed: new DomainFeed(), forward: async () => assert.fail('must not forward'), sendAlert: async () => assert.fail('must not alert') });
  const response = await post(url);
  assert.equal(response.status, 200);
  assert.equal(packet.decode(Buffer.from(await response.arrayBuffer())).rcode, 'SERVFAIL');
});
test('actual HTTP EDNS denied and failed resolution returns OPT with safe DO signaling', async t => {
  for (const [name, options, rcode] of [['blocked.test', {}, 'REFUSED'], ['safe.test', { feed: new DomainFeed() }, 'SERVFAIL'], ['safe.test', { forward: async () => { throw new Error('synthetic engine failure'); } }, 'SERVFAIL']]) {
    const { url } = await serverFixture(t, options);
    const wire = packet.encode({ type: 'query', id: 22, questions: [{ name, type: 'A', class: 'IN' }], additionals: [{ type: 'OPT', name: '.', udpPayloadSize: 4096, flags: packet.DNSSEC_OK, options: [{ code: 65001, data: Buffer.from('private-client-option') }] }] });
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/dns-message' }, body: wire });
    assert.equal(response.status, 200);
    const answer = packet.decode(Buffer.from(await response.arrayBuffer()));
    assert.equal(answer.rcode, rcode);
    assert.equal(answer.additionals.length, 1);
    assert.equal(answer.additionals[0].type, 'OPT');
    assert.equal(answer.additionals[0].udpPayloadSize, 1232);
    assert.equal(answer.additionals[0].flags, packet.DNSSEC_OK);
    assert.deepEqual(answer.additionals[0].options, []);
  }
});
test('denied bursts remain REFUSED even when alert fails; public event is generic and coalesced', async t => {
  const events = [];
  const { url } = await serverFixture(t, { forward: async () => assert.fail('must not forward'), sendAlert: async ({ event }) => { events.push(event); throw new Error('synthetic unavailable'); } });
  for (const name of ['blocked.test', 'a.blocked.test', 'b.blocked.test']) {
    const response = await post(url, name);
    assert.equal(response.status, 200);
    assert.equal(packet.decode(Buffer.from(await response.arrayBuffer())).rcode, 'REFUSED');
  }
  assert.equal(events.length, 1);
  assert.deepEqual(Object.keys(events[0]).sort(), ['audience', 'expiresAt', 'id', 'kind', 'version']);
  assert.equal(events[0].kind, 'website-recovery');
  assert.ok(Number(events[0].expiresAt) - Date.now() <= 60000);
  assert.ok(!JSON.stringify(events[0]).includes('blocked'));
});
test('alert consent revocation prevents notification without changing DNS refusal', async t => {
  let checks = 0;
  const { url } = await serverFixture(t, { resolveInstallation: async () => ({ ...installation(), websiteAlertConsent: ++checks < 4 }), sendAlert: async () => assert.fail('must not alert') });
  const response = await post(url, 'blocked.test');
  assert.equal(packet.decode(Buffer.from(await response.arrayBuffer())).rcode, 'REFUSED');
});
test('failure in notification-only authorization never changes the DNS refusal', async t => {
  let checks = 0;
  const { url } = await serverFixture(t, { resolveInstallation: async () => { if (++checks >= 3) throw new Error('synthetic notification lookup failure'); return installation(); }, sendAlert: async () => assert.fail('must not alert') });
  const response = await post(url, 'blocked.test');
  assert.equal(response.status, 200);
  assert.equal(packet.decode(Buffer.from(await response.arrayBuffer())).rcode, 'REFUSED');
});
test('bounded HTTP concurrency rejects additional work while resolver is pending', async t => {
  let release;
  const gate = new Promise(r => { release = r; });
  const { url } = await serverFixture(t, { maxConcurrent: 1, resolveInstallation: async () => { await gate; return installation(); } });
  const first = post(url); await new Promise(r => setTimeout(r, 20));
  assert.equal((await post(url)).status, 503);
  release(); assert.equal((await first).status, 200);
});
test('shutdown cancels bounded request and provider tasks', async t => {
  let entered; const ready = new Promise(r => { entered = r; });
  let aborted = false;
  const { url, close } = await serverFixture(t, { sendAlert: async ({ signal }) => { entered(); await new Promise(r => signal.addEventListener('abort', () => { aborted = true; r(); }, { once: true })); } });
  const result = post(url, 'blocked.test').catch(() => null);
  await ready; await close(); await result;
  assert.equal(aborted, true);
});
test('shutdown closes a real stalled partial-header socket within its bounded drain', async t => {
  const { url, close } = await serverFixture(t);
  const socket = net.createConnection({ host: '127.0.0.1', port: Number(new URL(url).port) });
  socket.on('error', () => {});
  await new Promise(r => socket.once('connect', r));
  socket.write('POST /dns/');
  await new Promise(r => setTimeout(r, 10));
  let timer;
  try {
    const completed = await Promise.race([close().then(() => true), new Promise(r => { timer = setTimeout(() => r(false), 250); })]);
    assert.equal(completed, true, 'shutdown must not await the peer/header timeout before forcing sockets');
  } finally { clearTimeout(timer); socket.destroy(); }
});

test('FCM HTTP-v1 adapter sends exact generic data with TTL and fresh provider authorization', async () => {
  const calls = []; let checks = 0;
  const send = createFcmSender({ projectId: 'freed-7d5ee', getAccessToken: async () => 'synthetic-access-token', fetch: async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ name: 'projects/freed-7d5ee/messages/synthetic' }), { status: 200 }); } });
  const event = { version: '1', kind: 'website-recovery', id: '213ead22-c5a2-4872-821d-50b0d0e21790', audience: 'b'.repeat(32), expiresAt: String(Date.now() + 30_000) };
  const result = await send({ event, authorize: async () => { checks++; return installation(); }, signal: AbortSignal.timeout(1000) });
  assert.equal(result.accepted, true); assert.equal(checks, 2); assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0].init.body).message;
  assert.deepEqual(body.data, event);
  assert.equal(body.token, 'synthetic-not-a-real-push-token');
  assert.ok(/^[0-9]+s$/.test(body.android.ttl));
  assert.ok(Number(body.android.ttl.slice(0, -1)) <= 30);
  assert.equal(body.apns.headers['apns-expiration'], String(Math.floor(Number(event.expiresAt) / 1000)));
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(!calls[0].init.body.includes('owner-1'));
});
test('FCM provider recheck after token fetch blocks revoked target; expiry never retries', async () => {
  let checks = 0;
  const send = createFcmSender({ projectId: 'freed-7d5ee', getAccessToken: async () => 'synthetic-access-token', fetch: async () => assert.fail('must not send') });
  const event = { version: '1', kind: 'website-recovery', id: '213ead22-c5a2-4872-821d-50b0d0e21790', audience: 'b'.repeat(32), expiresAt: String(Date.now() + 30_000) };
  assert.equal((await send({ event, authorize: async () => ++checks === 1 ? installation() : null })).accepted, false);
  assert.equal((await send({ event: { ...event, expiresAt: '1' }, authorize: async () => installation() })).accepted, false);
});
test('FCM/attached-account token HTTP calls are abortable and bound to fixed endpoints', async () => {
  const observed = [];
  const token = createAttachedServiceAccountTokenProvider({ fetch: async (url, options) => { observed.push(url); assert.equal(options.headers['Metadata-Flavor'], 'Google'); options.signal.throwIfAborted(); return new Response(JSON.stringify({ access_token: 'synthetic-access-token', token_type: 'Bearer', expires_in: 100 }), { status: 200, headers: { 'Metadata-Flavor': 'Google' } }); } });
  assert.equal(await token({ signal: AbortSignal.timeout(1000) }), 'synthetic-access-token');
  assert.equal(observed[0], 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token');
  const abort = new AbortController(); abort.abort();
  await assert.rejects(token({ signal: abort.signal }));
});
test('actual FCM HTTP boundary cancels a stalled socket and never retries provider failures', async t => {
  let count = 0; let stall = false; let entered;
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    count++;
    request.resume();
    if (stall) { entered?.(); return; }
    response.writeHead(503); response.end('synthetic provider failure');
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { for (const socket of sockets) socket.destroy(); server.close(); });
  const localUrl = `http://127.0.0.1:${server.address().port}`;
  const send = createFcmSender({ projectId: 'freed-7d5ee', getAccessToken: async () => 'synthetic-access-token', fetch: async (url, init) => {
    assert.equal(url, 'https://fcm.googleapis.com/v1/projects/freed-7d5ee/messages:send');
    return fetch(localUrl, init);
  } });
  const event = { version: '1', kind: 'website-recovery', id: '213ead22-c5a2-4872-821d-50b0d0e21790', audience: 'b'.repeat(32), expiresAt: String(Date.now() + 30_000) };
  assert.deepEqual(await send({ event, authorize: async () => installation() }), { accepted: false });
  assert.equal(count, 1);
  stall = true;
  const controller = new AbortController();
  const ready = new Promise(r => { entered = r; });
  const pending = send({ event, authorize: async () => installation(), signal: controller.signal });
  await ready; controller.abort();
  assert.deepEqual(await pending, { accepted: false });
  assert.equal(count, 2);
});

test('hosted HTTP detects Families denial, alerts generically, and never forwards its rewrite', async t => {
  const events=[];let forwarded=0;
  const policy=createFamiliesPolicy({feed:{classify:()=> 'allow'},fetchImpl:async (_url,init)=>{
    const q=packet.decode(init.body);return new Response(packet.encode({type:'response',id:q.id,flags:packet.RECURSION_AVAILABLE,questions:q.questions,answers:[{name:q.questions[0].name,type:'A',class:'IN',ttl:60,data:'0.0.0.0'}]}),{headers:{'content-type':'application/dns-message'}});
  }});
  const service=await serverFixture(t,{feed:policy,forward:async()=>{forwarded++;throw Error();},sendAlert:async({event})=>events.push(event)});
  const response=await post(service.url,'policy-blocked.test');
  assert.equal(response.status,200);assert.equal(packet.decode(Buffer.from(await response.arrayBuffer())).rcode,'REFUSED');assert.equal(forwarded,0);assert.equal(events.length,1);assert.equal(events[0].kind,'website-recovery');assert.ok(!JSON.stringify(events[0]).includes('policy-blocked'));
});
test('owner revocation while asynchronous policy is running prevents both forwarding and alert', async t => {
  let release;let started;const begin=new Promise(resolve=>{started=resolve;});let active=true;
  const policy={classify:()=>{started();return new Promise(resolve=>{release=resolve;});}};
  const service=await serverFixture(t,{feed:policy,resolveInstallation:async()=>active?installation():null,forward:async()=>assert.fail('revoked forwarding'),sendAlert:async()=>assert.fail('revoked alert')});
  const pending=post(service.url);await begin;active=false;release('deny');assert.equal((await pending).status,403);
});

test('nonce route probes are authenticated, budgeted and separate from ordinary DNS',async t=>{
  let reserved=0;const events=[];const fixture=await serverFixture(t,{reserveDnsRequest:async()=>{reserved++;return{status:'granted'};},feed:{classify:()=>assert.fail('probe is local only')},forward:async()=>assert.fail('probe must not forward'),sendAlert:async({event})=>events.push(event)});
  const nonce='0123456789abcdef0123456789abcdef';
  for(const [type,expected] of [['A','198.51.100.42'],['AAAA','2001:db8::42']]){
    const wire=packet.encode({type:'query',id:552,questions:[{name:`a.${nonce}.probe.freedrecovery.web.app`,type,class:'IN'}]});
    const res=await fetch(fixture.url,{method:'POST',headers:{'content-type':'application/dns-message'},body:wire});assert.equal(res.status,200);const msg=packet.decode(Buffer.from(await res.arrayBuffer()));assert.equal(msg.id,552);assert.equal(msg.answers[0].data,expected);assert.equal(msg.answers[0].ttl,0);
  }
  const denied=await post(fixture.url,`b.${nonce}.probe.freedrecovery.web.app`);assert.equal(packet.decode(Buffer.from(await denied.arrayBuffer())).rcode,'REFUSED');assert.equal(reserved,3);assert.equal(events.length,1);assert.ok(!JSON.stringify(events[0]).includes(nonce));
  const gated=await serverFixture(t,{resolveInstallation:async()=>null});assert.equal((await post(gated.url,`a.${nonce}.probe.freedrecovery.web.app`)).status,403);
});
