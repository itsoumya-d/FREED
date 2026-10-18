import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFreedSystemPath } from '../src/lib/deep-link-routing';
test('preferences is a real public route and query parameters carry no settings authority', () => {
  for (const path of ['/preferences', 'freed://preferences', 'freed:///preferences', 'app.freed.recovery://preferences']) assert.equal(resolveFreedSystemPath(path), '/preferences');
  assert.equal(resolveFreedSystemPath('freed://preferences?language=ar&premium=true'), '/preferences');
  assert.equal(resolveFreedSystemPath('freed://unknown-route'), '/');
});
