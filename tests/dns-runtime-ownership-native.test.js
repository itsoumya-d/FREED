const { test } = require('node:test');
test('native deletion reset owns resolver racers and blocked localhost UDP receives', () => {
  require('../modules/freed-protection/tests/run-dns-runtime-ownership-tests.js');
});
