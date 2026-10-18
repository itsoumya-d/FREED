import assert from 'node:assert/strict';
import { createDurableStateCell } from '../src/lib/durable-state-cell';
let saved = { count: 0, checkpoint: 0 };
let fail = false;
const cell = createDurableStateCell(saved, value => { if (fail) throw new Error('disk full'); saved = {...value}; });
cell.commit(current => ({...current, count: current.count + 1}));
cell.commit(current => ({...current, count: current.count + 1}));
const captured = cell.commit(current => ({...current, checkpoint: 1}));
assert.deepEqual(captured, saved);
assert.equal(captured.count, 2);
cell.commit(current => ({...current, count: current.count + 1}));
cell.commit(current => ({...current, checkpoint: 2}));
assert.equal(cell.read().count, 3); // acknowledgement keeps intervening activity
fail = true;
assert.throws(() => cell.commit(current => ({...current, checkpoint: 3})), /disk full/);
assert.equal(cell.read().checkpoint, 2);
assert.equal(saved.checkpoint, 2);
cell.replaceInMemory({...cell.read(), count: 4});
assert.equal(cell.read().count, 4); // optional volatile recovery continues with an explicit UI error
fail = false; cell.commit(current => current);
assert.equal(saved.count, 4);
console.log('PASS: durable capture, serialized updates, acknowledgement and failed-write preservation');
