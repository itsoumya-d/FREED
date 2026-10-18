const { test } = require('node:test');
test('native grant requires a fresh claimed same-target ID with bounded single fulfillment', () => {
  require('../modules/freed-protection/tests/run-native-unlock-policy-tests.js');
});
