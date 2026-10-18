import test from 'node:test';
import assert from 'node:assert/strict';
import { canFinishProtectionSetup } from '../src/lib/protection-setup-completion';
test('Ready can only continue after a fresh matching native state and completed diagnostics', () => {
  const checked = { adultBlocked: true, normalAllowed: true, nativeChecked: true, nativeReady: true, statusSignature: 'tested-network-and-permissions' };
  assert.equal(canFinishProtectionSetup(checked, true, checked.statusSignature), true);
  assert.equal(canFinishProtectionSetup(checked, false, checked.statusSignature), false, 'revocation, stopped tunnel and captive network cannot use cached Ready');
  assert.equal(canFinishProtectionSetup(checked, true, 'new-network-or-permission'), false);
  assert.equal(canFinishProtectionSetup({ ...checked, nativeChecked: false }, true, checked.statusSignature), false);
  assert.equal(canFinishProtectionSetup(null, true, checked.statusSignature), false);
});
