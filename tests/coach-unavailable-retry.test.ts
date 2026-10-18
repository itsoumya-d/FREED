import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoachSendController } from '../src/lib/ai-coach';
import { CLARA_CLOUD_CONSENT, configureClaraConversationTransport, replyWithClaraConversation, type ClaraConversationReply } from '../src/lib/clara-conversation';

const create = createCoachSendController;
const unavailable: ClaraConversationReply = { text: 'Local help remains available.', provider: 'fallback', status: 'fallback', serviceState: 'unavailable', action: 'none', quota: { remaining: 2, limit: 3, resetsAt: null } };
const remote: ClaraConversationReply = { text: 'A cloud reply.', provider: 'remote', status: 'ok', serviceState: 'online', action: 'breathe', quota: { remaining: 1, limit: 3, resetsAt: null } };
const canRetryReply = (reply: ClaraConversationReply) => reply.serviceState === 'unavailable';

test('ordinary persistence retry retains an already-saved unavailable receipt without another provider request', async () => {
  let calls = 0, saves = 0;
  const users: string[] = [];
  const sender = create({ canRetryReply, reply: async () => { calls++; return unavailable; }, onUser: text => users.push(text),
    onReply: () => { saves++; }, onPending: () => {}, onError: () => {}, isCurrent: () => true });
  await sender.send('The saved original words'); await sender.retry();
  assert.equal(calls, 1); assert.equal(saves, 1); assert.deepEqual(users, ['The saved original words']);
});

test('explicit unavailable retry sends the retained user message once and suppresses rapid duplicate retries', async () => {
  const users: string[] = [], replies: string[] = [];
  let calls = 0, finish!: (reply: ClaraConversationReply) => void;
  const sender = create({ canRetryReply, reply: async () => ++calls === 1 ? unavailable : new Promise(resolve => { finish = resolve; }),
    onUser: (text: string) => users.push(text), onReply: (reply: ClaraConversationReply) => replies.push(reply.text), onPending: () => {}, onError: () => {}, isCurrent: () => true });
  await sender.send('My retained message');
  const retry = sender.retryReply(); await sender.retryReply();
  assert.equal(calls, 2); assert.deepEqual(users, ['My retained message']); assert.deepEqual(replies, ['Local help remains available.']);
  finish(remote); await retry; await sender.retryReply();
  assert.equal(calls, 2); assert.deepEqual(replies, ['Local help remains available.', 'A cloud reply.']);
});

test('unavailable reply persistence repair must finish before another explicit provider attempt', async () => {
  let calls = 0, saves = 0;
  const sender = create({ canRetryReply, reply: async () => { calls++; return unavailable; }, onUser: () => {},
    onReply: () => { if (++saves === 1) throw Error('storage unavailable'); }, onPending: () => {}, onError: () => {}, isCurrent: () => true });
  await sender.send('Retain my saved words'); await sender.retry();
  assert.equal(calls, 1); assert.equal(saves, 2);
  await sender.retryReply(); assert.equal(calls, 2); assert.equal(saves, 3);
});

test('completed fallback and allowance states do not retry unless specifically admitted', async () => {
  for (const state of ['online', 'basic-help', 'daily-quota-exhausted', 'budget-exhausted', 'duplicate', 'account-deleting', 'rate-limited']) {
    let calls = 0;
    const sender = create({ canRetryReply, reply: async () => { calls++; return { ...unavailable, serviceState: state }; },
      onUser: () => {}, onReply: () => {}, onPending: () => {}, onError: () => {}, isCurrent: () => true });
    await sender.send('Words'); await sender.retryReply(); assert.equal(calls, 1, state);
  }
  let calls = 0;
  const unchanged = create({ reply: async () => { calls++; return unavailable; }, onUser: () => {}, onReply: () => {}, onPending: () => {}, onError: () => {}, isCurrent: () => true });
  await unchanged.send('Words'); await unchanged.retry(); assert.equal(calls, 1, 'default retained-response behavior');
});

test('cancel, disposal, owner departure and withdrawn retry permission keep unavailable attempts fenced', async () => {
  for (const action of ['cancel', 'dispose', 'owner', 'consent']) {
    let current = true, consent = true, calls = 0;
    const sender = create({ canRetryReply: (reply: ClaraConversationReply) => consent && canRetryReply(reply), reply: async () => { calls++; return unavailable; },
      onUser: () => {}, onReply: () => {}, onPending: () => {}, onError: () => {}, isCurrent: () => current });
    await sender.send('Owner A words');
    if (action === 'owner') current = false; else if (action === 'consent') consent = false; else sender[action]();
    await sender.retryReply(); assert.equal(calls, 1, action);
  }
});

test('a cancelled unavailable retry cannot append its late reply or clear a newer pending send', async () => {
  const replies: string[] = [], pending: boolean[] = [];
  let calls = 0, oldFinish!: (reply: ClaraConversationReply) => void, newFinish!: (reply: ClaraConversationReply) => void;
  const sender = create({ canRetryReply, reply: async () => {
    calls++; if (calls === 1) return unavailable;
    return new Promise<ClaraConversationReply>(resolve => { if (calls === 2) oldFinish = resolve; else newFinish = resolve; });
  }, onUser: () => {}, onReply: reply => replies.push(reply.text), onPending: busy => pending.push(busy), onError: () => {}, isCurrent: () => true });
  await sender.send('Saved unavailable message'); const old = sender.retryReply(); sender.cancel(); const next = sender.send('New deliberate message');
  oldFinish(remote); await old;
  assert.deepEqual(replies, ['Local help remains available.']); assert.equal(pending.at(-1), true);
  newFinish({ ...remote, text: 'Current reply' }); await next;
  assert.deepEqual(replies, ['Local help remains available.', 'Current reply']); assert.equal(pending.at(-1), false);
});

test('actual CLARA client gives an explicit unavailable retry a fresh event ID while preserving context consent', async () => {
  const ids = ['clara_11111111111111111111111111111111', 'clara_22222222222222222222222222222222'];
  const payloads: any[] = [], users: string[] = [], replies: ClaraConversationReply[] = [];
  let sequence = 0;
  configureClaraConversationTransport(async payload => {
    payloads.push(payload);
    return payloads.length === 1 ? { text: '', provider: 'fallback', serviceState: 'unavailable', action: 'none', quota: { remaining: 2, limit: 3, resetsAt: null } } :
      { text: 'Cloud reply received.', provider: 'remote', serviceState: 'online', action: 'breathe', quota: { remaining: 1, limit: 3, resetsAt: null } };
  });
  try {
    const consent = { version: CLARA_CLOUD_CONSENT, enabled: true, includeConversation: false };
    const sender = create({ canRetryReply, reply: (input: string, isCurrent: () => boolean) => replyWithClaraConversation(input, { attempts: [], locale: 'en' },
      { consent, messages: [{ role: 'user', text: 'Unshared previous message' }, { role: 'ai', text: 'Local sensitive guidance' }],
        guard: { ownerUid: 'owner', isCurrent }, eventId: async () => ids[sequence++] }),
      onUser: (input: string) => users.push(input), onReply: (reply: ClaraConversationReply) => replies.push(reply), onPending: () => {}, onError: () => {}, isCurrent: () => true });
    await sender.send('Help me pause'); await sender.retryReply();
    assert.deepEqual(users, ['Help me pause']); assert.equal(payloads.length, 2);
    assert.deepEqual(payloads.map(payload => payload.clientEventId), ids);
    assert.deepEqual(payloads.map(payload => payload.conversation), [[], []]);
    assert.deepEqual(payloads.map(payload => payload.input), ['Help me pause', 'Help me pause']);
    assert.equal(replies[0].serviceState, 'unavailable'); assert.notEqual(replies[0].provider, 'remote'); assert.ok(replies[0].text);
    assert.equal(replies[1].provider, 'remote'); assert.equal(replies[1].serviceState, 'online'); assert.equal(replies[1].quota?.remaining, 1);
  } finally { configureClaraConversationTransport(null); }
});
