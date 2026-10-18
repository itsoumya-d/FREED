const { test } = require('node:test');
test('native app schedules enforce exact wall-clock windows with independent manual targets', () => {
  require('../modules/freed-protection/tests/run-app-schedule-policy-tests.js');
});
