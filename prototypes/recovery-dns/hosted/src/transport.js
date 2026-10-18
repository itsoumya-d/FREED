import net from 'node:net';
import { spawn as nodeSpawn } from 'node:child_process';
import { MAX_RESPONSE_BYTES, parseQuery, validateResponse } from './dns.js';

export const DNSPROXY_ARGS = Object.freeze([
  '--listen', '127.0.0.1', '--port', '1053',
  '--upstream', 'https://1.1.1.1/dns-query',
  '--timeout', '2s', '--max-go-routines', '128', '--pending-requests-enabled',
]);

export function startDnsproxy({ spawn = nodeSpawn, onUnavailable = () => {} } = {}) {
  const child = spawn('/opt/dnsproxy/dnsproxy', [...DNSPROXY_ARGS], { stdio: 'ignore', shell: false, env: { PATH: '/usr/bin:/bin', SSL_CERT_DIR: '/etc/ssl/certs' } });
  let stopped = false;
  const unavailable = () => { if (!stopped) onUnavailable(); };
  child.once('error', unavailable);
  child.once('exit', unavailable);
  return { stop() { stopped = true; child.kill('SIGTERM'); } };
}

export function createTcpForwarder({ port = 1053, timeoutMs = 2500, maxResponseBytes = MAX_RESPONSE_BYTES, maxConcurrent = 128 } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || timeoutMs < 1 || timeoutMs > 5000 || maxResponseBytes < 12 || maxResponseBytes > MAX_RESPONSE_BYTES || maxConcurrent < 1 || maxConcurrent > 128) throw new Error('invalid transport bounds');
  let active = 0;
  return async function forward(wire, { signal } = {}) {
    const query = parseQuery(wire);
    if (active >= maxConcurrent) throw new Error('transport full');
    signal?.throwIfAborted();
    active++;
    try {
      return await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: '127.0.0.1', port });
        let received = Buffer.alloc(0);
        let expected;
        let done = false;
        const finish = (error, answer) => {
          if (done) return;
          done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); socket.destroy();
          if (error) reject(error); else resolve(answer);
        };
        const abort = () => finish(new Error('DNS request cancelled'));
        const timer = setTimeout(() => finish(new Error('DNS engine timed out')), timeoutMs);
        signal?.addEventListener('abort', abort, { once: true });
        socket.once('connect', () => {
          const frame = Buffer.alloc(wire.length + 2); frame.writeUInt16BE(wire.length); wire.copy(frame, 2); socket.write(frame);
        });
        socket.on('data', chunk => {
          if (received.length + chunk.length > maxResponseBytes + 2) return finish(new Error('DNS response too large'));
          received = Buffer.concat([received, chunk]);
          if (expected === undefined && received.length >= 2) {
            expected = received.readUInt16BE(0);
            if (expected < 12 || expected > maxResponseBytes) return finish(new Error('invalid DNS frame'));
          }
          if (expected !== undefined && received.length >= expected + 2) {
            if (received.length !== expected + 2) return finish(new Error('extra DNS frame'));
            try { finish(null, validateResponse(received.subarray(2), query, maxResponseBytes)); } catch { finish(new Error('invalid DNS engine response')); }
          }
        });
        socket.once('error', () => finish(new Error('DNS engine unavailable')));
        socket.once('end', () => { if (!done) finish(new Error('truncated DNS engine response')); });
        if (signal?.aborted) abort();
      });
    } finally { active--; }
  };
}
