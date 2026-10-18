import packet from 'dns-packet';
import { randomInt } from 'node:crypto';
import { canonicalName, MAX_RESPONSE_BYTES, validateResponse } from './dns.js';
import { bounded } from './installations.js';

const FAMILIES = 'https://family.cloudflare-dns.com/dns-query';

async function readBounded(response, signal) {
  if (!response.body) throw new Error('policy response unavailable');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await bounded(reader.read(), signal);
      if (done) break;
      size += value.length;
      if (size > MAX_RESPONSE_BYTES) throw new Error('policy response exceeds bound');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } finally { try { await bounded(reader.cancel(), signal); } catch { /* No response content is logged. */ } }
}

/** Policy lookup only. Never forward Families' SafeSearch-rewritten answer. */
export function createFamiliesPolicy({ feed, fetchImpl = fetch, timeoutMs = 1500 } = {}) {
  if (!feed || typeof feed.classify !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2000) throw new Error('invalid policy configuration');
  return {
    async classify(name, { signal } = {}) {
      const local = await feed.classify(name, { signal });
      if (local !== 'allow') return local === 'deny' ? 'deny' : 'unavailable';
      try {
        const active = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
        active.throwIfAborted();
        const query = { id: randomInt(65536), type: 'query', flags: packet.RECURSION_DESIRED, questions: [{ name: canonicalName(name), type: 'A', class: 'IN' }], answers: [], authorities: [], additionals: [] };
        const response = await bounded(fetchImpl(FAMILIES, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/dns-message', Accept: 'application/dns-message' }, body: packet.encode(query), signal: active }), active);
        if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/dns-message') return 'unavailable';
        const wire = validateResponse(await readBounded(response, active), query);
        const answer = packet.decode(wire);
        // Only a matched, successful policy response permits the ordinary
        // encrypted resolver. DNS errors and outages never become an allow.
        if (answer.rcode !== 'NOERROR' || answer.flag_tc) return 'unavailable';
        return answer.answers.some(record => record.type === 'A' && record.data === '0.0.0.0') ? 'deny' : 'allow';
      } catch { return 'unavailable'; }
    }
  };
}
