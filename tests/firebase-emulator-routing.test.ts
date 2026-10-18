import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseEmulatorRouting } from '../src/lib/firebase-emulator-routing';
test('explicit development fixtures route Auth and Functions together to the local host', () => {
  assert.deepEqual(firebaseEmulatorRouting(true, true, 'android'), { authUrl: 'http://10.0.2.2:9099', functionsHost: '10.0.2.2', functionsPort: 5001 });
  assert.equal(firebaseEmulatorRouting(true, true, 'ios')?.authUrl, 'http://127.0.0.1:9099');
  assert.equal(firebaseEmulatorRouting(false, false, 'ios'), null);
  assert.throws(() => firebaseEmulatorRouting(true, false, 'ios'), /development/);
});
