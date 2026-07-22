export type LeaseResult = { acquired: boolean; leaseUntil: number };

export type TransactionalDocument<T extends object> = { value: T | undefined };
export interface TransactionalStore {
  get<T extends object>(path: string): Promise<TransactionalDocument<T>>;
  set(path: string, value: object): Promise<void>;
}

/** Pure transaction logic used by the Admin SDK adapter and isolated test harness. */
export async function claimIdempotency(
  store: TransactionalStore,
  path: string,
  now: number,
  ttlMs: number
): Promise<boolean> {
  const existing = await store.get<{ expiresAt: number }>(path);
  if (existing.value && existing.value.expiresAt > now) return false;
  await store.set(path, { createdAt: now, expiresAt: now + ttlMs });
  return true;
}

export async function consumeRateLimit(
  store: TransactionalStore,
  path: string,
  now: number,
  windowMs: number,
  limit: number
): Promise<boolean> {
  const existing = await store.get<{ count: number; windowStartedAt: number; expiresAt: number }>(path);
  const current = existing.value;
  const inWindow = current !== undefined && current.windowStartedAt + windowMs > now;
  const count = inWindow && current ? current.count : 0;
  if (count >= limit) return false;
  const windowStartedAt = inWindow && current ? current.windowStartedAt : now;
  await store.set(path, { count: count + 1, windowStartedAt, expiresAt: windowStartedAt + windowMs });
  return true;
}

export async function acquireLease(
  store: TransactionalStore,
  path: string,
  owner: string,
  now: number,
  ttlMs: number
): Promise<LeaseResult> {
  const existing = await store.get<{ owner: string; expiresAt: number }>(path);
  if (existing.value && existing.value.expiresAt > now && existing.value.owner !== owner) {
    return { acquired: false, leaseUntil: existing.value.expiresAt };
  }
  const leaseUntil = now + ttlMs;
  await store.set(path, { owner, acquiredAt: now, expiresAt: leaseUntil });
  return { acquired: true, leaseUntil };
}
