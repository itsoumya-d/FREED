import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebsiteSetupWriter } from '../src/lib/website-protection-operations';
test('a distinct queued Off action runs after activation instead of joining its acknowledgement', async () => {
  const writer = createWebsiteSetupWriter(), calls: string[] = [];
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const enable = writer.run(async () => { calls.push('enable'); await gate; return 'enabled'; });
  const disable = writer.enqueue(async () => { calls.push('disable'); return 'disabled'; });
  assert.deepEqual(calls, ['enable']); finish();
  assert.equal(await enable, 'enabled'); assert.equal(await disable, 'disabled');
  assert.deepEqual(calls, ['enable', 'disable']);
});
test('a failed activation does not prevent a later explicit Off request or leave the writer locked', async () => {
  const writer = createWebsiteSetupWriter(), calls: string[] = [];
  const enable = writer.run(async () => { throw Error('controlled native failure'); });
  const disable = writer.enqueue(async () => { calls.push('disable'); return false; });
  await assert.rejects(enable); assert.equal(await disable, false); await writer.whenIdle();
  assert.equal(await writer.run(async () => 'retry'), 'retry'); assert.deepEqual(calls, ['disable']);
});
test('a later explicit activation queues behind Off and receives its own acknowledgement', async () => {
  const writer = createWebsiteSetupWriter(), calls: string[] = [];
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const disable = writer.enqueue(async () => { calls.push('off'); await gate; return 'disabled'; });
  const enable = writer.enqueue(async () => { calls.push('on'); return 'enabled'; });
  await Promise.resolve(); assert.deepEqual(calls, ['off']); finish();
  assert.equal(await disable, 'disabled'); assert.equal(await enable, 'enabled'); assert.deepEqual(calls, ['off', 'on']);
});
