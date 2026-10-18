import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createAccountOperationGate } from '@/lib/account-operation';
import { createPendingInterventionTracker, consumePendingInterventionOnce } from '@/lib/protection-capabilities';
import { createNativeInterventionAttempt, type NativePendingInterventionPayload } from '@/lib/native-intervention';
import { createDefaultRecoveryState, recordBlockingAttempt } from '@/lib/recovery-state';
import { isAppGroupBindingConfirmed } from '../../modules/freed-protection/src/app-group-binding';
import { getJourneyOwner } from '@/lib/user-journey';

// Execute the production Root callbacks, preserving the actual exact-ID claim,
// account gate, binding validator, payload validation and history reducer. Only
// native asynchronous IO and the mounted navigation/state boundary are supplied.
const source = readFileSync('src/features/freed-app.tsx', 'utf8');
const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const variables = new Map<string, string>();
let manualExpression = '';
let reconcileExpression = '';
function visit(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) variables.set(node.name.text, node.initializer.getText(tree));
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useGuidedResetLink') {
    const property = (node.arguments[0] as ts.ObjectLiteralExpression).properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(tree) === 'onOpen') as ts.PropertyAssignment;
    manualExpression = property.initializer.getText(tree);
  }
  if (ts.isCallExpression(node) && node.expression.getText(tree) === 'recoveryEntryPresentation.current.reconcile') reconcileExpression = node.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
function actual(expression: string, dependencies: Record<string, unknown>) {
  const js = ts.transpileModule(`return (${expression});`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(dependencies), js)(...Object.values(dependencies));
}
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
const nativeId = '20202020-2020-4020-8020-202020202020';
function payload(kind: 'website' | 'app'): NativePendingInterventionPayload {
  return { interventionId: nativeId, detectedAt: new Date().toISOString(), reason: 'Configured protection',
    url: kind === 'website' ? 'https://blocked.example' : 'https://selected-app.app.freed.local',
    host: kind === 'website' ? 'blocked.example' : 'selected-app.app.freed.local',
    sourcePackage: kind === 'website' ? '' : 'com.instagram.android',
    matchedRule: kind === 'website' ? 'adult-domain-feed:blocked.example' : 'configured-app:com.instagram.android',
    scope: kind === 'website' ? { kind: 'browser-domain', domain: 'blocked.example' } : { kind: 'android-package', packageName: 'com.instagram.android' } };
}
const originalAttempt = createNativeInterventionAttempt({ ...payload('app'), interventionId: '10101010-1010-4010-8010-101010101010' });
function fixture(phase: 'paused' | 'completed' | null = null, kind: 'website' | 'app' = 'website') {
  let sdkOwner: string | null = 'owner-a', generation = 0, route = 'main', state = createDefaultRecoveryState();
  let session: any = phase ? { id: 'saved-session', ownerId: 'owner-a', phase, challenge: { id: 'original-activity' } } : null;
  const origin = { current: phase ? { sessionId: 'saved-session', ownerUid: 'owner-a', attempt: originalAttempt, saved: phase === 'completed' } : null };
  const activeAttemptRef = { current: phase ? originalAttempt : null as any };
  const claims: string[] = [], routes: string[] = [], reads: string[] = [], grants: unknown[] = [];
  const pending = deferred<NativePendingInterventionPayload | null>(), claim = deferred<boolean>();
  const React = { useCallback: (callback: unknown) => callback, useRef: (value: unknown) => ({ current: value }) };
  const deps: Record<string, any> = { React, hydrated: true, journeyOwner: 'owner-a', ownerLease: {}, screen: route,
    Platform: { OS: 'android' }, accountOperationGate: { current: createAccountOperationGate(() => sdkOwner) },
    pendingInterventionTracker: { current: createPendingInterventionTracker() }, challengeBreakOrigin: origin, activeAttemptRef,
    challengeSession: { getSnapshot: () => ({ session }) }, guidedAccess: { canEnter: () => grants.length > 0, nextSessionId: () => 'saved-session' },
    getProtectionActionScope: () => sdkOwner ? JSON.stringify([sdkOwner, generation]) : null,
    captureProtectionActionTicket: (scope: string) => ({ isCurrent: () => scope === JSON.stringify([sdkOwner, generation]) }),
    setAppGroupActionScope: async () => ({ version: 1, operationId: '30303030-3030-4030-8030-303030303030', supported: true, accepted: true,
      bindingCurrent: true, ownerVerified: true, stage: 'complete', reason: null, generation: 1, scopeEpoch: 1, errorCode: null, errorDomain: null }),
    isAppGroupBindingConfirmed, consumePendingInterventionOnce,
    getPendingIntervention: () => { reads.push('pending'); return pending.promise; },
    clearPendingIntervention: (id: string) => { claims.push(id); return claim.promise; },
    getFirebaseAccountScope: () => sdkOwner,
    getFirebaseAuthSnapshot: () => ({ status: 'ready', signedIn: Boolean(sdkOwner), anonymous: false, ownerUid: sdkOwner, email: null }), getJourneyOwner,
    setRecoveryState: (update: any) => { state = update(state); }, recordBlockingAttempt,
    setActiveAttempt: (attempt: any) => { activeAttemptRef.current = attempt; }, setSelectedChallenge: () => {},
    setChallengeBreakNotice: () => {}, setProtectionSyncMessage: () => {},
    setNavigationScreen: (next: string) => { route = next; routes.push(next); },
  };
  // The baseline has no coordinator/wrapper. Once Root declares them, evaluate
  // its real initializers rather than providing a test substitute for the fix.
  if (variables.has('recoveryEntryPresentation')) {
    deps.createRecoveryEntryPresentation = require('@/lib/recovery-entry-presentation').createRecoveryEntryPresentation;
    deps.recoveryEntryPresentation = actual(variables.get('recoveryEntryPresentation')!, deps);
    actual(reconcileExpression, deps);
  }
  deps.setScreen = variables.has('setScreen') ? actual(variables.get('setScreen')!, deps) : deps.setNavigationScreen;
  if (variables.has('guidedRecoveryInProgress')) {
    deps.guidedRecoveryInProgress = actual(variables.get('guidedRecoveryInProgress')!, deps);
    // Execute the actual current-reader assignment used by the Root callback.
    let reader = '';
    function find(node: ts.Node) {
      if (ts.isBinaryExpression(node) && node.left.getText(tree) === 'guidedRecoveryInProgress.current') reader = node.right.getText(tree);
      ts.forEachChild(node, find);
    }
    find(tree); deps.guidedRecoveryInProgress.current = actual(reader, deps);
  }
  deps.startChallenge = actual(variables.get('startChallenge')!, deps);
  const manual = actual(manualExpression, deps), consume = actual(variables.get('consumePendingIntervention')!, deps);
  return { manual, consume, claims, routes, reads, grants, origin, activeAttemptRef,
    get route() { return route; }, get state() { return state; },
    read: async () => { pending.resolve(payload(kind)); await settle(); },
    finish: async () => { claim.resolve(true); await settle(); },
    depart: (next: string) => deps.setScreen(next),
    observeRoute: (next: string) => { deps.screen = next; if (reconcileExpression) actual(reconcileExpression, deps); },
    switchOwner: (next: string | null) => { sdkOwner = next; generation++; deps.accountOperationGate.current.invalidate(); },
    setAccessPending: (state: 'busy' | 'repairNeeded') => { deps.guidedAccess[state] = true; },
    setSession: (value: any) => { session = value; } };
}

test.each(['paused', 'completed'] as const)('a delayed website claim cannot strand the resumed %s app reset', async phase => {
  const f = fixture(phase); f.consume(); await settle(); await f.read();
  expect(f.claims).toEqual([nativeId]); f.manual(); await f.finish();
  expect(f.route).toBe('challenge'); expect(f.activeAttemptRef.current).toBe(originalAttempt);
  expect(f.origin.current?.attempt).toBe(originalAttempt); expect(f.origin.current?.sessionId).toBe('saved-session');
  expect(f.state.attempts).toHaveLength(1); expect(f.state.completedChallenges).toBe(0);
});

test.each(['website', 'app'] as const)('fresh manual access wins over a late same-owner %s get/claim without losing native accounting', async kind => {
  const f = fixture(null, kind); f.consume(); await settle(); f.manual(); await f.read(); await f.finish();
  expect(f.route).toBe('ad'); expect(f.activeAttemptRef.current).toBeNull(); expect(f.origin.current).toBeNull();
  expect(f.claims).toEqual([nativeId]); expect(f.state.attempts).toHaveLength(1);
});

test('native delivery before the manual callback also preserves the saved app origin', async () => {
  const f = fixture('completed'); f.consume(); await settle(); await f.read(); await f.finish(); f.manual();
  expect(f.route).toBe('challenge'); expect(f.activeAttemptRef.current).toBe(originalAttempt); expect(f.state.attempts).toHaveLength(1);
});

test('a consumer started after manual entry cannot displace its active chooser', async () => {
  const f = fixture(); f.manual(); f.consume(); await settle(); await f.read(); await f.finish();
  expect(f.route).toBe('ad'); expect(f.activeAttemptRef.current).toBeNull(); expect(f.state.attempts).toHaveLength(1);
});

test('a fresh native delivery followed by manual entry becomes a manual reset without carrying native app authority', async () => {
  const f = fixture(null, 'app'); f.consume(); await settle(); await f.read(); await f.finish(); f.manual();
  expect(f.routes).toEqual(['intercept', 'ad']); expect(f.activeAttemptRef.current).toBeNull();
  expect(f.origin.current).toBeNull(); expect(f.state.attempts).toHaveLength(1);
});

test('a session created while native IO is pending is read live instead of using the consumer closure', async () => {
  const f = fixture(); f.consume(); await settle(); await f.read();
  f.setSession({ id: 'new-owned-session', ownerId: 'owner-a', phase: 'paused', challenge: { id: 'calm' } });
  await f.finish(); expect(f.routes).toEqual([]); expect(f.activeAttemptRef.current).toBeNull();
  expect(f.state.attempts).toHaveLength(1);
});

test('another owner\'s stale session cannot suppress a legitimate native entry for the current owner', async () => {
  const f = fixture(); f.setSession({ id: 'old-other-session', ownerId: 'owner-b', phase: 'paused', challenge: { id: 'calm' } });
  f.consume(); await settle(); await f.read(); await f.finish();
  expect(f.route).toBe('intercept'); expect(f.activeAttemptRef.current.nativeInterventionId).toBe(nativeId);
});

test('an earned chooser without a selected activity resumes without another access entry or target replacement', async () => {
  const f = fixture('paused'); f.setSession(null); f.grants.push({ sessionId: 'saved-session' });
  f.consume(); await settle(); await f.read(); f.manual(); await f.finish();
  expect(f.route).toBe('challenge'); expect(f.activeAttemptRef.current).toBe(originalAttempt);
  expect(f.routes).toEqual(['challenge']); expect(f.grants).toHaveLength(1);
});

test.each(['busy', 'repairNeeded'] as const)('manual delivery retains the original %s ad/access context without manufacturing a grant', async state => {
  const f = fixture('paused'); f.setSession(null); f.setAccessPending(state);
  f.consume(); await settle(); await f.read(); f.manual(); await f.finish();
  expect(f.route).toBe('ad'); expect(f.activeAttemptRef.current).toBe(originalAttempt);
  expect(f.origin.current?.sessionId).toBe('saved-session'); expect(f.grants).toHaveLength(0);
});

test.each(['coach', 'main'])('a newer %s navigation supersedes a pending native continuation', async destination => {
  const f = fixture(); f.consume(); await settle(); await f.read(); f.depart(destination); await f.finish();
  expect(f.route).toBe(destination); expect(f.activeAttemptRef.current).toBeNull(); expect(f.state.attempts).toHaveLength(1);
});

test.each(['owner-b', null, 'owner-a'])('a pending owner-a event cannot transfer across invalidation to %p', async next => {
  const f = fixture('paused'); f.consume(); await settle(); await f.read(); f.switchOwner(next); await f.finish();
  expect(f.routes).toEqual([]); expect(f.activeAttemptRef.current).toBe(originalAttempt); expect(f.state.attempts).toHaveLength(0);
});

test.each(['website', 'app'] as const)('a genuine fresh native %s event still opens interception with exactly its validated authority', async kind => {
  const f = fixture(null, kind); f.consume(); await settle(); await f.read(); await f.finish();
  expect(f.route).toBe('intercept'); expect(f.activeAttemptRef.current.nativeInterventionId).toBe(nativeId);
  expect(f.activeAttemptRef.current.source).toBe(kind === 'website' ? 'browser' : 'app');
  expect(f.activeAttemptRef.current.scope).toEqual(kind === 'website' ? { kind: 'browser-domain', domain: 'blocked.example' } : { kind: 'android-package', packageName: 'com.instagram.android' });
  expect(f.claims).toEqual([nativeId]); f.consume(); await settle(); expect(f.claims).toEqual([nativeId]);
});

test('leaving a manual flow allows a later fresh native entry without disabling the consumer', async () => {
  const f = fixture(); f.manual(); f.depart('main'); f.consume(); await settle(); await f.read(); await f.finish();
  expect(f.routes).toEqual(['ad', 'main', 'intercept']); expect(f.state.attempts).toHaveLength(1);
});

test('an unchanged lagging pathname cannot release manual ownership, but native Back can', async () => {
  const f = fixture(); f.manual(); f.observeRoute('main'); f.consume(); await settle(); await f.read(); await f.finish();
  expect(f.route).toBe('ad'); expect(f.activeAttemptRef.current).toBeNull();
  const later = fixture(); later.manual(); later.observeRoute('ad'); later.observeRoute('main');
  later.consume(); await settle(); await later.read(); await later.finish();
  expect(later.route).toBe('intercept');
});
