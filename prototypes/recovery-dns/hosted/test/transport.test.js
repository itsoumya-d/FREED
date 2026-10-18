import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import packet from 'dns-packet';
import { createTcpForwarder, DNSPROXY_ARGS, startDnsproxy } from '../src/transport.js';
import { parseQuery, responseFor } from '../src/dns.js';
const query = packet.encode({ id: 93, type: 'query', questions: [{ name: 'safe.test', type: 'TXT', class: 'IN' }] });
async function fixture(t, handler) {
  const sockets = new Set();
  const server = net.createServer(s => { sockets.add(s); s.on('close', () => sockets.delete(s)); s.on('error', () => {}); handler(s); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { for (const s of sockets) s.destroy(); server.close(); });
  return server.address().port;
}
test('actual loopback TCP framing accepts split reply and preserves DNS types', async t => {
  const port = await fixture(t, s => s.once('data', data => {
    assert.equal(data.readUInt16BE(0), query.length);
    assert.deepEqual(data.subarray(2), query);
    const reply = responseFor(parseQuery(query), 'NOERROR');
    const frame = Buffer.alloc(reply.length + 2); frame.writeUInt16BE(reply.length); reply.copy(frame, 2);
    s.write(frame.subarray(0, 1)); setImmediate(() => s.end(frame.subarray(1)));
  }));
  const forward = createTcpForwarder({ port });
  const answer = await forward(query, { signal: AbortSignal.timeout(1000) });
  assert.equal(packet.decode(answer).questions[0].type, 'TXT');
});
test('TCP rejects mismatch, oversized frame, timeout and cancellation', async t => {
  for (const mode of ['mismatch', 'oversize', 'timeout', 'abort']) {
    const port = await fixture(t, s => s.once('data', () => {
      if (mode === 'mismatch') { const answer = responseFor(parseQuery(query), 'NOERROR'); answer.writeUInt16BE(44); const frame = Buffer.alloc(answer.length + 2); frame.writeUInt16BE(answer.length); answer.copy(frame, 2); s.end(frame); }
      if (mode === 'oversize') s.end(Buffer.from([255, 255]));
    }));
    const forward = createTcpForwarder({ port, timeoutMs: 30, maxResponseBytes: 4096 });
    await assert.rejects(forward(query, { signal: AbortSignal.timeout(mode === 'abort' ? 1 : 1000) }));
  }
});
test('engine invocation is fixed, loopback only, no cache, logging discarded', () => {
  let observed;
  const child = { once() {}, kill() {}, unref() {} };
  const engine = startDnsproxy({ spawn: (...args) => { observed = args; return child; } });
  assert.deepEqual(observed[1], DNSPROXY_ARGS);
  assert.equal(observed[2].stdio, 'ignore');
  assert.ok(DNSPROXY_ARGS.includes('127.0.0.1'));
  assert.ok(DNSPROXY_ARGS.includes('https://1.1.1.1/dns-query'));
  assert.ok(!DNSPROXY_ARGS.includes('--cache'));
  engine.stop();
});
