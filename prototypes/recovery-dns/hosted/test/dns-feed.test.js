import test from 'node:test';
import assert from 'node:assert/strict';
import packet from 'dns-packet';
import { parseQuery, responseFor, validateResponse } from '../src/dns.js';
import { DomainFeed } from '../src/feed.js';

const wire = (type = 'UNKNOWN_65') => packet.encode({ type: 'query', id: 71, flags: packet.RECURSION_DESIRED, questions: [{ name: 'www.blocked.test', type, class: 'IN' }], additionals: [{ type: 'OPT', name: '.', udpPayloadSize: 1232, flags: packet.DNSSEC_OK, options: [] }] });
test('normal DNS types and EDNS survive parsing; refusal remains refusal', () => {
  // dns-packet preserves SVCB(64)/HTTPS(65) numerically as unknown RRs.
  for (const type of ['A', 'AAAA', 'UNKNOWN_65', 'UNKNOWN_64', 'MX', 'TXT', 'DNSKEY', 'UNKNOWN_65400']) {
    const q = parseQuery(wire(type));
    assert.equal(q.questions[0].type, type);
    const refused = packet.decode(responseFor(q, 'REFUSED'));
    assert.equal(refused.rcode, 'REFUSED');
    assert.equal(refused.questions[0].type, q.questions[0].type);
  }
});
test('synthetic denial/failure includes safe EDNS reply and DO without client options', () => {
  const q = parseQuery(packet.encode({ type: 'query', id: 71, questions: [{ name: 'blocked.test', type: 'A', class: 'IN' }], additionals: [{ type: 'OPT', name: '.', udpPayloadSize: 65535, flags: 65535, options: [{ code: 65001, data: Buffer.from('private-client-option') }] }] }));
  for (const rcode of ['REFUSED', 'SERVFAIL']) {
    const reply = packet.decode(responseFor(q, rcode));
    assert.equal(reply.rcode, rcode);
    assert.equal(reply.additionals.length, 1);
    assert.equal(reply.additionals[0].type, 'OPT');
    assert.equal(reply.additionals[0].udpPayloadSize, 1232);
    assert.equal(reply.additionals[0].flags, packet.DNSSEC_OK);
    assert.equal(reply.additionals[0].ednsVersion, 0);
    assert.deepEqual(reply.additionals[0].options, []);
  }
  const plain = parseQuery(packet.encode({ type: 'query', id: 71, questions: [{ name: 'blocked.test', type: 'A', class: 'IN' }] }));
  assert.equal(packet.decode(responseFor(plain, 'REFUSED')).additionals.length, 0);
});
test('rejects multiple questions, extra bytes and response-as-query', () => {
  assert.throws(() => parseQuery(Buffer.concat([wire(), Buffer.from([0])])));
  assert.throws(() => parseQuery(packet.encode({ type: 'query', questions: [{ name: 'x.test', type: 'A' }, { name: 'y.test', type: 'A' }] })));
  assert.throws(() => parseQuery(packet.encode({ type: 'response', questions: [{ name: 'x.test', type: 'A' }] })));
});
test('response matching checks transaction, full question, QR, bounds', () => {
  const q = parseQuery(wire());
  const valid = responseFor(q, 'NOERROR');
  assert.deepEqual(validateResponse(valid, q), valid);
  const wrong = Buffer.from(valid); wrong.writeUInt16BE(99, 0);
  assert.throws(() => validateResponse(wrong, q));
  assert.throws(() => validateResponse(responseFor({ ...q, questions: [{ name: 'other.test', type: 'UNKNOWN_65', class: 'IN' }] }, 'NOERROR'), q));
});
test('reviewed feed uses safe suffixes; missing, invalid, rollback and stale fail closed', () => {
  let now = 1_000_000;
  const feed = new DomainFeed({ now: () => now, maxAgeMs: 10_000 });
  assert.equal(feed.classify('ordinary.test'), 'unavailable');
  assert.equal(feed.replace({ version: 1, reviewed: true, generatedAt: now, expiresAt: now + 9_000, domains: ['blocked.test'] }), true);
  assert.equal(feed.classify('a.BLOCKED.test'), 'deny');
  assert.equal(feed.classify('notblocked.test'), 'allow');
  assert.equal(feed.classify('blocked.test.evil.test'), 'allow');
  assert.equal(feed.replace({ version: 0, reviewed: true, generatedAt: now, expiresAt: now + 9_000, domains: ['other.test'] }), false);
  assert.equal(feed.classify('blocked.test'), 'deny');
  assert.equal(feed.replace({ version: 2, reviewed: true, generatedAt: now, expiresAt: now + 9_000, domains: ['*.bad.test'] }), false);
  now += 9_001;
  assert.equal(feed.classify('ordinary.test'), 'unavailable');
});
