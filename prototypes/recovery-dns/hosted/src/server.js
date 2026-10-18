import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { MAX_QUERY_BYTES, parseQuery, responseFor, validateResponse } from './dns.js';
import { bounded, hashSecret, installationBinding, createInstallationAuthorizer } from './installations.js';
import { createAlertQueue } from './alerts.js';
import { routeProbe } from './route-probe.js';

class HttpError extends Error { constructor(status) { super('request rejected'); this.status = status; } }
const failure = status => { throw new HttpError(status); };

async function readWire(request, signal) {
  if (request.headers['content-encoding'] && request.headers['content-encoding'] !== 'identity') failure(415);
  const contentLength = request.headers['content-length'];
  if (contentLength !== undefined && (!/^[0-9]+$/.test(contentLength) || Number(contentLength) > MAX_QUERY_BYTES)) failure(413);
  const chunks = []; let bytes = 0;
  const iterator = request[Symbol.asyncIterator]();
  while (true) {
    const { value, done } = await bounded(iterator.next(), signal);
    if (done) break;
    bytes += value.length;
    if (bytes > MAX_QUERY_BYTES) failure(413);
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function createRecoveryServer({ feed, forward, resolveInstallation, reserveDnsRequest, sendAlert, maxConcurrent = 128, requestTimeoutMs = 4000, alertOptions = {} } = {}) {
  if (!feed || typeof feed.classify !== 'function' || typeof forward !== 'function' || !Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 128 || requestTimeoutMs < 1 || requestTimeoutMs > 5000) throw new Error('invalid server configuration');
  const alerts = createAlertQueue({ ...alertOptions, sendAlert });
  const requests = new Set(); const installationRequests = new Map();
  let closing = false; let closePromise;
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: requestTimeoutMs, headersTimeout: requestTimeoutMs, keepAliveTimeout: 2000 }, async (request, response) => {
    // Never emit request.url, headers, wire, domains, resolver errors or tokens.
    response.setHeader('Cache-Control', 'no-store, private');
    response.setHeader('Pragma', 'no-cache'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Type', 'text/plain');
    const write = (status, body = Buffer.alloc(0)) => { if (!response.destroyed && !response.writableEnded) { response.statusCode = status; response.end(body); } };
    if (closing || requests.size >= maxConcurrent) { response.setHeader('Connection', 'close'); write(503); return; }
    const controller = new AbortController(); requests.add(controller);
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    const abort = () => controller.abort();
    request.once('aborted', abort);
    response.once('close', abort);
    let hash; let counted = false;
    try {
      if (!request.url || request.url.length > 6000) failure(414);
      const route = /^\/dns\/([a-f0-9]{64})\/dns-query(?:\?(.*))?$/.exec(request.url);
      if (!route) failure(404);
      if (request.method !== 'GET' && request.method !== 'POST') { response.setHeader('Allow', 'GET, POST'); failure(405); }
      let wire;
      if (request.method === 'GET') {
        if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] ?? 0) !== 0) failure(400);
        if (!/^dns=[A-Za-z0-9_-]+$/.test(route[2] ?? '')) failure(400);
        const value = route[2].slice(4);
        wire = Buffer.from(value, 'base64url');
        if (wire.toString('base64url') !== value) failure(400);
        if (wire.length > MAX_QUERY_BYTES) failure(413);
      } else {
        if (route[2] !== undefined) failure(400);
        if (request.headers['content-type']?.toLowerCase() !== 'application/dns-message') failure(415);
        wire = await readWire(request, controller.signal);
      }
      let query;
      try { query = parseQuery(wire); } catch { failure(400); }
      hash = hashSecret(route[1]);
      const count = installationRequests.get(hash) ?? 0;
      if (count >= 16) failure(429);
      installationRequests.set(hash, count + 1);
      counted = true;
      const initialAuthorize = createInstallationAuthorizer({ resolveInstallation, hash });
      const initial = await initialAuthorize({ signal: controller.signal });
      if (!initial) failure(403);
      // One durable reservation per HTTP DNS request, never per auth recheck.
      // Adapter must make this atomic/idempotent across deployed instances.
      if (typeof reserveDnsRequest !== 'function') failure(503);
      const admission = await bounded(reserveDnsRequest({ installationHash: hash, installationId: initial.installationId, ownerGeneration: initial.ownerGeneration, requestId: randomUUID() }, { signal: controller.signal }), controller.signal);
      if (admission?.status === 'exhausted') failure(429);
      if (admission?.status !== 'granted') failure(503);
      const binding = installationBinding(initial);
      const authorize = createInstallationAuthorizer({ resolveInstallation, hash, binding });
      const probe = routeProbe(query);
      let classification = probe?.kind;
      if (!probe) {
        try { classification = await bounded(feed.classify(query.questions[0].name, { signal: controller.signal }), controller.signal); }
        catch { classification = 'unavailable'; }
      }
      const afterClassification = await authorize({ signal: controller.signal });
      if (!afterClassification) failure(403);
      let answer;
      if (classification === 'deny') {
        answer = responseFor(query, 'REFUSED');
        // Denial is final before best-effort notification and never unlocks.
        try {
          const current = await authorize({ signal: controller.signal });
          if (current?.websiteAlertConsent === true) await alerts.enqueue({ hash, binding, audience: current.audience, authorize, signal: controller.signal });
        } catch { /* Notification lookup/provider failures cannot change denial. */ }
      } else if (classification !== 'allow') {
        answer = responseFor(query, 'SERVFAIL');
      } else {
        const current = await authorize({ signal: controller.signal });
        if (!current) failure(403);
        try { answer = probe?.wire ?? validateResponse(await bounded(forward(wire, { signal: controller.signal }), controller.signal), query); } catch { answer = responseFor(query, 'SERVFAIL'); }
      }
      response.setHeader('Content-Type', 'application/dns-message');
      write(200, answer);
    } catch (error) {
      response.setHeader('Connection', 'close');
      write(error instanceof HttpError ? error.status : 503);
    } finally {
      clearTimeout(timer); requests.delete(controller); request.removeListener('aborted', abort); response.removeListener('close', abort);
      if (counted && installationRequests.has(hash)) { const remaining = installationRequests.get(hash) - 1; if (remaining > 0) installationRequests.set(hash, remaining); else installationRequests.delete(hash); }
    }
  });
  server.maxConnections = 256;
  server.maxRequestsPerSocket = 100;
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); });
  return { server, close() {
    if (closePromise) return closePromise;
    closing = true;
    for (const controller of requests) controller.abort();
    closePromise = (async () => {
      // Stop accepting before forcing existing HTTP sockets. Waiting for close's
      // callback first can deadlock on peers stalled before request creation.
      const stopped = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await alerts.close();
      await stopped;
    })();
    return closePromise;
  } };
}
