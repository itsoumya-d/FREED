import assert from 'node:assert/strict';
import test from 'node:test';
import { createGuidedResetAccessController, resolveGuidedTier } from '../src/lib/guided-reset-access';
import { parseReviewAccessSnapshot, hasReviewAccess } from '../src/lib/review-access';
const now = 1800000000000;
const proof = { reviewAccessVersion: 1, ownerUid: 'owner/valid', access: 'review', expiresAt: new Date(now + 60000).toISOString(), capabilities: ['ad-free', 'premium-features'] };
test('review proof is exact, owner bound, time bounded and separate from membership', () => {
    const valid = parseReviewAccessSnapshot(proof, now);
    assert.equal(hasReviewAccess(valid, 'owner/valid', now), true);
    for (const bad of [{ ...proof, extra: true }, { ...proof, capabilities: ['ad-free'] }, { ...proof, expiresAt: new Date(now + 15 * 86400000).toISOString() }])
        assert.throws(() => parseReviewAccessSnapshot(bad, now));
    assert.equal(hasReviewAccess(valid, 'other', now), false);
    assert.equal(hasReviewAccess(valid, 'owner/valid', now + 60000), false);
    assert.equal(resolveGuidedTier('owner/valid', { ownerUid: 'owner/valid', status: 'unavailable' }, null, now), 'unknown');
    assert.equal(resolveGuidedTier('owner/valid', { ownerUid: 'other', status: 'free' }, null, now), 'unknown');
});
function harness() {
    let owner: string | null = 'owner/valid', tier: 'free' | 'paid' | 'review' | 'unknown' = 'free', foreground = true, fail = false;
    const values = new Map<string, string>();
    let creates = 0, shows = 0;
    let result = { provider: 'native', status: 'completed', rewardGranted: true } as any;
    let resolve: ((value: any) => void) | undefined;
    const c = createGuidedResetAccessController({ ownerUid: owner, storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => { if (fail)
                throw Error('disk'); values.set(k, v); }, removeItem: k => { if (fail)
                throw Error('disk'); values.delete(k); } }, currentOwner: () => owner, currentTier: () => tier, isForeground: () => foreground, now: () => now, createId: () => `session-${creates++}`, createReward: () => ({ id: 'sdk', provider: 'native', status: 'ready' } as any), completeReward: async (_s, eligible) => { shows++; if (!eligible())
            throw Error(); return result ?? await new Promise(r => { resolve = r; }); } });
    return { c, values, setOwner: (v: string | null) => { owner = v; }, setTier: (v: typeof tier) => { tier = v; }, background: () => { foreground = false; c.invalidate(); }, fail: (v: boolean) => { fail = v; }, result: (v: any) => { result = v; }, resolve: () => resolve!({ provider: 'native', status: 'completed', rewardGranted: true }), shows: () => shows };
}
test('explicit native reward grants once; persistence repair never asks for another ad', async () => {
    const h = harness();
    h.c.hydrate();
    assert.equal(h.shows(), 0);
    h.fail(true);
    assert.equal(await h.c.watch(), 'save-failed');
    assert.equal(h.shows(), 1);
    h.fail(false);
    assert.equal(h.c.repair(), 'granted');
    const grant = h.c.read()!;
    assert.equal(h.c.consume(grant.sessionId), true);
    assert.equal(h.c.consume('another'), false);
    assert.equal(await h.c.watch(), 'denied');
    h.c.end(grant.sessionId);
    assert.equal(h.c.read(), null);
});
test('unknown/paid/background and stale owner cannot receive ad grants; rapid taps show once', async () => {
    for (const tier of ['unknown', 'paid', 'review'] as const) {
        const h = harness();
        h.c.hydrate();
        h.setTier(tier);
        assert.equal(await h.c.watch(), 'denied');
        assert.equal(h.shows(), 0);
    }
    const h = harness();
    h.c.hydrate();
    h.result(null);
    const pending = h.c.watch();
    assert.equal(await h.c.watch(), 'denied');
    h.setOwner('other');
    h.resolve();
    assert.equal(await pending, 'denied');
    assert.equal(h.c.read(), null);
    const b = harness();
    b.c.hydrate();
    b.result(null);
    const p = b.c.watch();
    b.background();
    b.resolve();
    assert.equal(await p, 'denied');
});
test('mock or denied rewards never grant; cleanup failure retains the exact session', async () => {
    for (const result of [{ provider: 'mock', status: 'completed', rewardGranted: true }, { provider: 'native', status: 'failed', rewardGranted: true }, { provider: 'native', status: 'completed', rewardGranted: false }]) {
        const h = harness();
        h.c.hydrate();
        h.result(result);
        assert.equal(await h.c.watch(), 'unavailable');
        assert.equal(h.c.read(), null);
    }
    const h = harness();
    h.c.hydrate();
    await h.c.watch();
    const id = h.c.read()!.sessionId;
    h.fail(true);
    assert.throws(() => h.c.end(id));
    assert.equal(h.c.read()?.sessionId, id);
    h.fail(false);
    h.c.end('another');
    assert.equal(h.c.read()?.sessionId, id);
});
test('real SDK presentation can witness reward while backgrounded, persistence waits for foreground', async () => {
    let foreground = true;
    let lifecycle: any;
    let settle: any;
    let calls = 0;
    const values = new Map<string, string>();
    const c = createGuidedResetAccessController({ ownerUid: 'u', storage: { getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: k => { values.delete(k); } }, currentOwner: () => 'u', currentTier: () => 'free', isForeground: () => foreground, now: () => now, createId: () => 'one', createReward: () => ({ id: 'sdk', provider: 'native', status: 'ready' } as any), completeReward: async (_session, eligible, events) => { calls++; lifecycle = events; events.onPresenting(); return await new Promise(resolve => { settle = () => { assert.equal(eligible(), true); events.onDismissed(); resolve({ provider: 'native', status: 'completed', rewardGranted: true } as any); }; }); } });
    c.hydrate();
    const result = c.watch();
    foreground = false;
    c.background();
    settle();
    assert.equal(await result, 'pending-foreground');
    assert.equal(c.read(), null);
    assert.equal(values.size, 0);
    assert.equal(await c.watch(), 'denied');
    foreground = true;
    assert.equal(c.repair(), 'granted');
    assert.equal(calls, 1);
    // The presentation exception is over; a later background cannot reopen it.
    lifecycle.onDismissed();
    c.end('one');
    foreground = false;
    assert.equal(await c.watch(), 'denied');
});
test('same real owner restores access from durable storage; another owner cannot erase it', async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
    let owner = 'one';
    const make = (uid: string) => createGuidedResetAccessController({ ownerUid: uid, storage, currentOwner: () => owner, currentTier: () => 'paid', isForeground: () => true, now: () => now, createId: () => 'session', createReward: () => { throw Error('no SDK'); }, completeReward: async () => { throw Error('no SDK'); } });
    const first = make('one');
    first.hydrate();
    assert.equal(first.startLicensed(), true);
    first.consume('session');
    first.dispose();
    const resumed = make('one');
    resumed.hydrate();
    assert.equal(resumed.allows('session'), true);
    assert.equal(resumed.startLicensed(), false);
    owner = 'two';
    resumed.clear();
    assert.equal(values.size, 1);
    const second = make('two');
    assert.equal(second.hydrate(), null);
});
test('cold challenge/ad and native handoffs gate; manual SOS and basic help stay independent', async () => {
    const { shouldOfferGuidedReset } = await import('../src/lib/guided-reset-access');
    const base = { hasSessionAccess: false, completedReceipt: false };
    for (const source of ['app', 'browser', 'search'])
        assert.equal(shouldOfferGuidedReset({ ...base, screen: 'intercept', source }), true);
    for (const source of ['panic-button', 'manual-check'])
        assert.equal(shouldOfferGuidedReset({ ...base, screen: 'intercept', source }), false);
    assert.equal(shouldOfferGuidedReset({ ...base, screen: 'intercept', source: 'app', basicHelp: true }), false);
    assert.equal(shouldOfferGuidedReset({ ...base, screen: 'challenge' }), true);
    assert.equal(shouldOfferGuidedReset({ ...base, screen: 'ad' }), true);
    assert.equal(shouldOfferGuidedReset({ ...base, screen: 'challenge', hasSessionAccess: true }), false);
    assert.equal(shouldOfferGuidedReset({ ...base, screen: 'challenge', completedReceipt: true }), false);
    for (const screen of ['breathing', 'movement', 'journal', 'coach'])
        assert.equal(shouldOfferGuidedReset({ ...base, screen }), false);
});

test('context change and disposed controller cannot grant even when the same Firebase owner returns',async()=>{
 let context='attempt-a',resolve!:(result:any)=>void;const values=new Map<string,string>();
 const c=createGuidedResetAccessController({ownerUid:'owner',storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v)},removeItem:k=>{values.delete(k)}},currentOwner:()=> 'owner',currentTier:()=> 'free',requestContext:()=>context,isForeground:()=>true,now:()=>now,createId:()=> 'session',createReward:()=>({provider:'native',status:'ready',id:'ad'} as any),completeReward:async()=>await new Promise(r=>{resolve=r})});
 c.hydrate();const pending=c.watch();context='attempt-b';resolve({provider:'native',status:'completed',rewardGranted:true});assert.equal(await pending,'denied');assert.equal(values.size,0);c.dispose();assert.equal(await c.watch(),'denied');assert.equal(c.startLicensed(),false);
});
