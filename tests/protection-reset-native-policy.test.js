const { test } = require('node:test');
test('native deletion reset acknowledges only confirmed owned-state and runtime cleanup', () => {
  require('../modules/freed-protection/tests/run-protection-reset-policy-tests.js');
});
