import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import { assertRecentAccountDeletionAuthentication } from '../functions/src/core-data';
import { createFirebaseCallableContracts } from '../src/lib/firebase-client';

function actualHandler(failure?: 'sweep' | 'cooldown') {
  const source = readFileSync('functions/src/foundation.ts', 'utf8');
  const start = source.indexOf('export const requestAccountDeletion ='), end = source.indexOf('\n/** Retries partial deletion sweeps', start);
  const expression = source.slice(start, end).replace('export const requestAccountDeletion =', 'return');
  const code = transpileModule(expression, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  const calls: string[] = []; let release: (() => void) | undefined;
  const sweep = new Promise<void>(resolve => { release = resolve; });
  class HttpsError extends Error { constructor(public code: string, message: string) { super(message); } }
  const deps = { onCall: (_config: unknown, handler: Function) => handler, requireUid: (uid: string) => uid,
    HttpsError, assertRecentAccountDeletionAuthentication, parseOrHttpsError: (fn: Function) => fn(), parseDeletionRequest: (v: unknown) => v,
    mutate: async (_uid: string, _kind: string, _event: string, _quota: number, run: Function) => { calls.push('fence'); await run({}); },
    setServerDocument: () => {}, COLLECTIONS: { deletionTombstones: 'tombstones' }, FieldValue: { serverTimestamp: () => 'timestamp' },
    accountDeletionDependencies: () => ({}), sweepFirebaseAccountDeletion: async () => { calls.push('sweep'); await sweep; if (failure === 'sweep') throw new Error('partial deletion'); return { expiresAt: Date.now() + 1000 }; },
    transitionDeletionToCooldown: async () => { calls.push('cooldown'); if (failure === 'cooldown') throw new Error('fence publication failed'); },
    getAuth: () => { throw new Error('permanent owner handler must not add UID lookup'); }
  };
  return { handler: new Function(...Object.keys(deps), code)(...Object.values(deps)), calls, release: () => release!() };
}
const request = () => ({ auth: { uid: 'confirmed-owner', token: { firebase: { sign_in_provider: 'password' }, auth_time: Math.floor(Date.now() / 1000) } }, data: { expectedAccountUid: 'confirmed-owner', clientEventId: 'confirmed_event' } });
test('actual backend acknowledgement becomes completed only after the awaited sweep and cooldown publication', async () => {
  const f = actualHandler(); let settled = false; const result = f.handler(request()).then((value: unknown) => { settled = true; return value; });
  await Promise.resolve(); await Promise.resolve(); assert.equal(settled, false); assert.deepEqual(f.calls, ['fence', 'sweep']);
  f.release(); assert.deepEqual(await result, { ok: true, status: 'completed' }); assert.deepEqual(f.calls, ['fence', 'sweep', 'cooldown']);
});
test('real handler never returns completed for a partial sweep, failed cooldown publication, owner mismatch or stale authentication', async () => {
  for (const failure of ['sweep', 'cooldown'] as const) { const f = actualHandler(failure), result = f.handler(request()); f.release(); await assert.rejects(result, /did not complete/); }
  const f = actualHandler(); await assert.rejects(f.handler({ ...request(), data: { expectedAccountUid: 'another-owner', clientEventId: 'confirmed_event' } }), /account changed/);
  const old = request(); old.auth.token.auth_time -= 3600; await assert.rejects(f.handler(old), /Sign in again/); assert.deepEqual(f.calls, []);
});
test('actual client parser preserves legacy processing truth and accepts only explicit confirmed acknowledgement', async () => {
  let value: unknown = { ok: true, status: 'completed' };
  const contracts = createFirebaseCallableContracts({ call: async () => value });
  for (const status of ['completed', 'processing', 'deleting'] as const) { value = { ok: true, status }; assert.deepEqual(await contracts.requestAccountDeletion({ expectedAccountUid: 'confirmed-owner', clientEventId: 'confirmed_event' }), value); }
  value = { ok: true, status: 'completed', authMissing: true }; await assert.rejects(contracts.requestAccountDeletion({ expectedAccountUid: 'confirmed-owner', clientEventId: 'confirmed_event' }));
});
