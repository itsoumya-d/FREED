const { test } = require('node:test');
test('Android DNS routes and plaintext upstream forwarding use Families without losing existing interception', () => {
  require('../modules/freed-protection/tests/run-dns-upstream-routing-tests.js');
});
