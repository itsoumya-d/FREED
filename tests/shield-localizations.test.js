const test = require('node:test');
const assert = require('node:assert/strict');
const { buildShieldCopy, run } = require('../scripts/sync-shield-localizations');
test('shield translations fail generation if any supported language is incomplete', () => {
  assert.throws(() => buildShieldCopy({}), /Incomplete/);
  assert.doesNotThrow(() => run(true));
});
