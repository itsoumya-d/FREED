const { test } = require('node:test');
test('native Android surface policy fails closed across build rollout and explicit opt-in', () => {
  require('../modules/freed-protection/tests/run-focus-shield-policy-tests.js');
});
