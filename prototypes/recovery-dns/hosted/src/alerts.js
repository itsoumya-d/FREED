import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { setImmediate as defer } from 'node:timers/promises';
import { bounded, installationBinding, validInstallation } from './installations.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validEvent(event, now) {
  return event && Object.keys(event).sort().join(',') === 'audience,expiresAt,id,kind,version' && event.version === '1' && event.kind === 'website-recovery' && UUID.test(event.id) && /^[a-f0-9]{32}$/.test(event.audience) && /^[0-9]{1,16}$/.test(event.expiresAt) && Number.isSafeInteger(Number(event.expiresAt)) && Number(event.expiresAt) > now && Number(event.expiresAt) <= now + 60_000;
}

async function readJsonBounded(response, maxBytes, signal) {
  if (!response.body) throw new Error('missing provider body');
  const reader = response.body.getReader();
  let bytes = 0; const chunks = [];
  try {
    while (true) {
      const { value, done } = await bounded(reader.read(), signal);
      if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) throw new Error('provider response too large');
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}

// Explicit token-provider implementation for the attached service-account ADC
// environment. No key file, caller-provided endpoint, or refresh retries.
export function createAttachedServiceAccountTokenProvider({ fetch: fetchImpl = globalThis.fetch } = {}) {
  return async ({ signal } = {}) => {
    signal?.throwIfAborted();
    const localSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(800)]);
    const response = await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', { method: 'GET', headers: { 'Metadata-Flavor': 'Google' }, redirect: 'error', cache: 'no-store', signal: localSignal });
    if (!response.ok || response.headers.get('Metadata-Flavor') !== 'Google') { await response.body?.cancel(); throw new Error('attached identity unavailable'); }
    const json = await readJsonBounded(response, 16_384, localSignal);
    if (json.token_type !== 'Bearer' || typeof json.access_token !== 'string' || json.access_token.length < 1 || json.access_token.length > 8192 || /[\r\n]/.test(json.access_token) || !Number.isFinite(json.expires_in) || json.expires_in <= 0) throw new Error('invalid attached identity');
    return json.access_token;
  };
}

export function createFcmSender({ projectId, getAccessToken, fetch: fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 900 } = {}) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId) || typeof getAccessToken !== 'function' || timeoutMs < 1 || timeoutMs > 5000) throw new Error('invalid FCM configuration');
  return async function send({ event, authorize, signal }) {
    if (!validEvent(event, now()) || typeof authorize !== 'function') return { accepted: false };
    const budget = Math.max(1, Math.min(timeoutMs, Number(event.expiresAt) - now()));
    const sendSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(budget)]);
    try {
      const first = await bounded(authorize({ signal: sendSignal, alerts: true }), sendSignal);
      if (!validInstallation(first, { alerts: true }) || first.audience !== event.audience) return { accepted: false };
      const firstBinding = installationBinding(first);
      const accessToken = await bounded(getAccessToken({ signal: sendSignal }), sendSignal);
      if (typeof accessToken !== 'string' || !accessToken || /[\r\n]/.test(accessToken)) return { accepted: false };
      // Re-resolve after identity token acquisition, at the provider boundary.
      const current = await bounded(authorize({ signal: sendSignal, alerts: true }), sendSignal);
      if (!validInstallation(current, { alerts: true }) || installationBinding(current) !== firstBinding || current.audience !== event.audience || !validEvent(event, now())) return { accepted: false };
      sendSignal.throwIfAborted();
      const ttlSeconds = Math.max(0, Math.floor((Number(event.expiresAt) - now()) / 1000));
      const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: sendSignal,
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token: current.pushTarget.token, data: event,
          notification: { title: 'Take a moment', body: 'Open FREED for a guided reset.' },
          android: { ttl: `${ttlSeconds}s`, priority: 'high', collapse_key: 'website-recovery' },
          apns: { headers: { 'apns-expiration': String(Math.floor(Number(event.expiresAt) / 1000)), 'apns-collapse-id': 'website-recovery', 'apns-push-type': 'alert', 'apns-priority': '10' }, payload: { aps: { sound: 'default' } } },
        } }),
      });
      if (!response.ok) { await response.body?.cancel(); return { accepted: false }; }
      const result = await readJsonBounded(response, 4096, sendSignal);
      // FCM acceptance is not device receipt, presentation, opening, or recovery.
      return { accepted: typeof result.name === 'string' && result.name.startsWith(`projects/${projectId}/messages/`) };
    } catch { return { accepted: false }; }
  };
}

export function createAlertQueue({ sendAlert, now = Date.now, maxConcurrent = 16, maxEntries = 1024, coalesceMs = 60_000, timeoutMs = 1000 } = {}) {
  if (maxConcurrent < 1 || maxConcurrent > 32 || maxEntries < 1 || maxEntries > 4096 || coalesceMs < 1000 || coalesceMs > 60_000 || timeoutMs < 1 || timeoutMs > 2000) throw new Error('invalid alert bounds');
  const key = randomBytes(32);
  const recent = new Map(); const tasks = new Set(); const controllers = new Set();
  let closed = false;
  return {
    async enqueue({ hash, binding, audience, authorize, signal }) {
      if (closed || typeof sendAlert !== 'function' || tasks.size >= maxConcurrent) return;
      const timestamp = now();
      for (const [digest, expires] of recent) if (expires <= timestamp) recent.delete(digest);
      const digest = createHmac('sha256', key).update(`${hash}:${binding}`).digest('hex');
      if (recent.has(digest) || recent.size >= maxEntries) return;
      recent.set(digest, timestamp + coalesceMs);
      const controller = new AbortController(); controllers.add(controller);
      const jobSignal = AbortSignal.any([controller.signal, ...(signal ? [signal] : []), AbortSignal.timeout(timeoutMs)]);
      const event = Object.freeze({ version: '1', kind: 'website-recovery', id: randomUUID(), audience, expiresAt: String(timestamp + 60_000) });
      const task = (async () => {
        await defer(undefined, { signal: jobSignal });
        const current = await bounded(authorize({ signal: jobSignal, alerts: true }), jobSignal);
        if (!current || current.audience !== audience) return;
        await bounded(sendAlert({ event, authorize, signal: jobSignal }), jobSignal);
      })().catch(() => {}).finally(() => { controllers.delete(controller); tasks.delete(task); });
      tasks.add(task);
      // Caller awaits: background work remains inside this HTTP request lifetime.
      await task;
    },
    async close() { closed = true; for (const controller of controllers) controller.abort(); await Promise.allSettled(tasks); recent.clear(); },
  };
}
