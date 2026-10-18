const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('Shield Action authors localized notification copy using saved app-group presentation language', () => {
  const source = fs.readFileSync('ios/FREEDShieldAction/ShieldActionExtension.swift','utf8');
  assert.match(source,/FreedShieldActionCopy/);
  assert.match(source,/freed\.presentation\.v1/);
  assert.match(source,/content\.title = copy\["title"\]/);
  assert.match(source,/content\.body = copy\["body"\]/);
  assert.match(source,/content\.userInfo = \["kind": "freed-pending-intervention"\]/);
});
