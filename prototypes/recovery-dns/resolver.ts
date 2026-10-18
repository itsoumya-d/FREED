import { createHmac, randomBytes, randomUUID } from 'node:crypto';

const MAX_QUERY_BYTES = 512;
const MAX_GET_QUERY_CHARACTERS = Math.ceil(MAX_QUERY_BYTES * 4 / 3);
const MAX_RESPONSE_BYTES = 4_096;
const MAX_AUTHORIZATION_BYTES = 600;
const ALERT_TTL_MS = 60_000;
const MAX_COALESCED_ALERTS = 256;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 2_500;
const MAX_UPSTREAM_TIMEOUT_MS = 5_000;
const DEFAULT_ALERT_TIMEOUT_MS = 1_500;
const MAX_ALERT_TIMEOUT_MS = 5_000;

type ActiveInstallation = {
  status: 'active';
  installationRef: string;
  ownerGeneration: number;
  activeOwnerGeneration: number;
  cloudDnsConsent: boolean;
  notificationConsent: boolean;
};

type Installation = ActiveInstallation | { status: 'revoked' };

export type RecoveryAlert = {
  id: string;
  kind: 'website-recovery';
  expiresAt: number;
};

export type InstallationAuthority = Readonly<{
  installationRef: string;
  ownerGeneration: number;
}>;

export type DnsDependencies = {
  defer(task: Promise<void>): 'retained' | 'unavailable';
  resolveInstallation(token: string): Promise<Installation | null>;
  decideCategory(name: string): Promise<'allow' | 'deny' | 'unavailable'>;
  forward(wire: Uint8Array, signal: AbortSignal): Promise<Uint8Array>;
  alert: {
    kind: 'open-freed-action';
    deliver(authority: InstallationAuthority, event: RecoveryAlert, signal: AbortSignal): Promise<void>;
  };
  now(): number;
  upstreamTimeoutMs?: number;
  alertTimeoutMs?: number;
};

export type DnsHttpRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: Uint8Array;
};

export type DnsHttpResponse = {
  status: number;
  headers: Readonly<Record<string, string>>;
  body: Uint8Array;
};

type Question = {
  name: string;
  type: 1 | 28;
  dnsClass: 1;
  end: number;
};

const DNS_HEADERS = Object.freeze({
  'content-type': 'application/dns-message',
  'cache-control': 'no-store',
});

const EMPTY_HEADERS = Object.freeze({ 'cache-control': 'no-store' });

function response(status: number, body = new Uint8Array(), dns = false): DnsHttpResponse {
  return { status, headers: dns ? DNS_HEADERS : EMPTY_HEADERS, body };
}

function readU16(wire: Uint8Array, offset: number): number {
  return (wire[offset] << 8) | wire[offset + 1];
}

function parseQuestion(wire: Uint8Array, requireExactEnd: boolean): Question | null {
  let offset = 12;
  let encodedNameLength = 1;
  const labels: string[] = [];

  while (true) {
    if (offset >= wire.length) return null;
    const length = wire[offset++];
    if (length === 0) break;
    if ((length & 0xc0) !== 0 || length > 63 || offset + length > wire.length) return null;
    encodedNameLength += length + 1;
    if (encodedNameLength > 255) return null;

    let label = '';
    for (let index = 0; index < length; index += 1) {
      const byte = wire[offset + index];
      const supported = (byte >= 0x30 && byte <= 0x39)
        || (byte >= 0x41 && byte <= 0x5a)
        || (byte >= 0x61 && byte <= 0x7a)
        || byte === 0x2d
        || byte === 0x5f;
      if (!supported) return null;
      label += String.fromCharCode(byte).toLowerCase();
    }
    labels.push(label);
    offset += length;
  }

  if (labels.length === 0 || offset + 4 > wire.length) return null;
  const type = readU16(wire, offset);
  const dnsClass = readU16(wire, offset + 2);
  const end = offset + 4;
  if ((type !== 1 && type !== 28) || dnsClass !== 1 || (requireExactEnd && end !== wire.length)) return null;
  return { name: labels.join('.'), type, dnsClass, end };
}

function parseQuery(wire: Uint8Array): Question | null {
  if (wire.length < 17 || wire.length > MAX_QUERY_BYTES) return null;
  if ((wire[2] & 0x80) !== 0 || ((wire[2] >> 3) & 0x0f) !== 0 || (wire[3] & 0x40) !== 0) return null;
  if (readU16(wire, 4) !== 1 || readU16(wire, 6) !== 0
    || readU16(wire, 8) !== 0 || readU16(wire, 10) !== 0) return null;
  return parseQuestion(wire, true);
}

function isMatchingResponse(request: Uint8Array, expected: Question, candidate: Uint8Array): boolean {
  if (candidate.length < 17 || candidate.length > MAX_RESPONSE_BYTES) return false;
  if (candidate[0] !== request[0] || candidate[1] !== request[1] || (candidate[2] & 0x80) === 0) return false;
  if ((candidate[2] & 0x78) !== (request[2] & 0x78)
    || (candidate[3] & 0x40) !== 0 || readU16(candidate, 4) !== 1) return false;
  const actual = parseQuestion(candidate, false);
  return actual !== null && actual.name === expected.name
    && actual.type === expected.type && actual.dnsClass === expected.dnsClass;
}

function dnsFailure(request: Uint8Array, rcode: 2 | 5): Uint8Array {
  const failure = Uint8Array.from(request);
  failure[2] = 0x80 | (request[2] & 0x79);
  failure[3] = 0x80 | rcode;
  failure.fill(0, 6, 12);
  return failure;
}

function header(headers: Record<string, string>, wanted: string): string | undefined {
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === wanted);
  return key === undefined ? undefined : headers[key];
}

function bearerToken(headers: Record<string, string>): string | null {
  const authorization = header(headers, 'authorization');
  if (!authorization || authorization.length > MAX_AUTHORIZATION_BYTES) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]{1,512})$/.exec(authorization);
  return match?.[1] ?? null;
}

function activeInstallation(value: Installation | null): value is ActiveInstallation {
  return value?.status === 'active'
    && value.ownerGeneration === value.activeOwnerGeneration
    && value.cloudDnsConsent
    && value.installationRef.length > 0;
}

function sameAuthority(before: InstallationAuthority, after: Installation | null): after is ActiveInstallation {
  return activeInstallation(after)
    && before.installationRef === after.installationRef
    && before.ownerGeneration === after.ownerGeneration;
}

function strictGetBody(url: URL): { status: number; wire?: Uint8Array } {
  const raw = url.search.startsWith('?') ? url.search.slice(1) : '';
  if (!raw.startsWith('dns=')) return { status: 400 };
  const encoded = raw.slice(4);
  if (encoded.length > MAX_GET_QUERY_CHARACTERS) return { status: 413 };
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) return { status: 400 };
  const decoded = Uint8Array.from(Buffer.from(encoded, 'base64url'));
  return Buffer.from(decoded).toString('base64url') === encoded
    ? { status: 200, wire: decoded }
    : { status: 400 };
}

function extractWire(request: DnsHttpRequest): { status: number; wire?: Uint8Array } {
  if (request.method !== 'GET' && request.method !== 'POST') return { status: 405 };

  let url: URL;
  try {
    url = new URL(request.url, 'https://resolver.invalid');
  } catch {
    return { status: 400 };
  }
  if (url.origin !== 'https://resolver.invalid' || url.pathname !== '/dns-query' || url.hash) return { status: 400 };

  let wire: Uint8Array | null;
  if (request.method === 'GET') {
    if (request.body !== undefined) return { status: 400 };
    const decoded = strictGetBody(url);
    if (!decoded.wire) return { status: decoded.status };
    wire = decoded.wire;
  } else {
    if (url.search !== '') return { status: 400 };
    if (header(request.headers, 'content-type')?.toLowerCase() !== 'application/dns-message') {
      return { status: 415 };
    }
    if (!(request.body instanceof Uint8Array)) return { status: 400 };
    if (request.body.byteLength > MAX_QUERY_BYTES) return { status: 413 };
    wire = Uint8Array.from(request.body);
  }

  if (wire.length > MAX_QUERY_BYTES) return { status: 413 };
  return { status: 200, wire };
}

function boundedTimeout(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value) || value === undefined) return fallback;
  return Math.max(1, Math.min(Math.floor(value), maximum));
}

async function forwardWithTimeout(
  deps: DnsDependencies,
  wire: Uint8Array,
): Promise<Uint8Array | null> {
  const abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abortController.abort();
        reject(Error('upstream timeout'));
      }, boundedTimeout(deps.upstreamTimeoutMs, DEFAULT_UPSTREAM_TIMEOUT_MS, MAX_UPSTREAM_TIMEOUT_MS));
    });
    return await Promise.race([deps.forward(wire, abortController.signal), timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function deliverAlert(
  deps: DnsDependencies,
  token: string,
  authority: InstallationAuthority,
  event: RecoveryAlert,
): Promise<void> {
  const abortController = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const attempt = (async () => {
      let current: Installation | null;
      try {
        current = await deps.resolveInstallation(token);
      } catch {
        return;
      }
      if (abortController.signal.aborted || deps.now() >= event.expiresAt
        || !sameAuthority(authority, current) || !current.notificationConsent) return;
      await deps.alert.deliver(authority, event, abortController.signal);
    })();
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abortController.abort();
        reject(Error('alert timeout'));
      }, boundedTimeout(deps.alertTimeoutMs, DEFAULT_ALERT_TIMEOUT_MS, MAX_ALERT_TIMEOUT_MS));
    });
    await Promise.race([attempt, timeout]);
  } catch {
    // Alert failure and cancellation cannot weaken or delay the DNS denial.
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function registerAlert(
  deps: DnsDependencies,
  token: string,
  authority: InstallationAuthority,
  event: RecoveryAlert,
): boolean {
  let start = () => {};
  const startGate = new Promise<void>(resolve => { start = resolve; });
  const task = (async () => {
    await startGate;
    await deliverAlert(deps, token, authority, event);
  })();

  try {
    if (typeof deps.defer !== 'function' || deps.defer(task) !== 'retained') return false;
  } catch {
    return false;
  }
  start();
  return true;
}

export function createHostedDnsController(deps: DnsDependencies) {
  const coalesceSecret = randomBytes(32);
  const recentAlerts = new Map<string, number>();

  function alertKey(installationRef: string, name: string): string {
    return createHmac('sha256', coalesceSecret)
      .update(installationRef)
      .update('\0')
      .update(name)
      .digest('hex');
  }

  function claimAlert(key: string, now: number): boolean {
    for (const [candidate, expiresAt] of recentAlerts) {
      if (expiresAt <= now) recentAlerts.delete(candidate);
    }
    if ((recentAlerts.get(key) ?? 0) > now) return false;
    while (recentAlerts.size >= MAX_COALESCED_ALERTS) {
      const oldest = recentAlerts.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      recentAlerts.delete(oldest);
    }
    recentAlerts.set(key, now + ALERT_TTL_MS);
    return true;
  }

  return {
    async handle(request: DnsHttpRequest): Promise<DnsHttpResponse> {
      const extracted = extractWire(request);
      if (!extracted.wire) return response(extracted.status);
      const wire = extracted.wire;
      const question = parseQuery(wire);
      if (!question) return response(400);

      const token = bearerToken(request.headers);
      if (!token) return response(401);

      let authorized: Installation | null;
      try {
        authorized = await deps.resolveInstallation(token);
      } catch {
        return response(503);
      }
      if (!activeInstallation(authorized)) return response(authorized === null ? 401 : 403);
      const authority: InstallationAuthority = Object.freeze({
        installationRef: authorized.installationRef,
        ownerGeneration: authorized.ownerGeneration,
      });

      let verdict: unknown;
      try {
        verdict = await deps.decideCategory(question.name);
      } catch {
        verdict = 'unavailable';
      }

      let fenced: Installation | null;
      try {
        fenced = await deps.resolveInstallation(token);
      } catch {
        return response(503);
      }
      if (!sameAuthority(authority, fenced)) return response(403);

      if (verdict === 'unavailable') return response(200, dnsFailure(wire, 2), true);
      if (verdict === 'deny') {
        const denial = dnsFailure(wire, 5);
        if (fenced.notificationConsent) {
          const now = deps.now();
          const key = alertKey(fenced.installationRef, question.name);
          if (claimAlert(key, now)) {
            const retained = registerAlert(deps, token, authority, {
              id: randomUUID(),
              kind: 'website-recovery',
              expiresAt: now + ALERT_TTL_MS,
            });
            if (!retained) recentAlerts.delete(key);
          }
        }
        return response(200, denial, true);
      }

      if (verdict !== 'allow') return response(200, dnsFailure(wire, 2), true);

      const upstream = await forwardWithTimeout(deps, wire);
      if (!upstream || !isMatchingResponse(wire, question, upstream)) {
        return response(200, dnsFailure(wire, 2), true);
      }
      return response(200, Uint8Array.from(upstream), true);
    },
  };
}
