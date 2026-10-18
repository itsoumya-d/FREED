const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('native Safari rule-loading errors retain domain/code and use saved-language copy', () => {
  const source=fs.readFileSync('ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift','utf8');
  assert.match(source,/private enum FreedContentBlockerCopy/);
  assert.match(source,/NSLocalizedDescriptionKey: localizedError\("missing"\)/);
  assert.match(source,/NSLocalizedDescriptionKey: localizedError\("load"\)/);
  assert.match(source,/domain: "FreedSafariContentBlocker"/);
  assert.match(source,/code: 1/);assert.match(source,/code: 2/);
  assert.match(source,/freed\.presentation\.v1/);
});
