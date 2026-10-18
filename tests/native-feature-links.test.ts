import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveFreedSystemPath } from '../src/lib/deep-link-routing';
test('safe screen links open existing features on cold and warm start', () => {
  for (const route of ['/today','/shield','/progress','/profile','/today/library','/flow/checkin','/flow/breathing','/flow/coach','/flow/account','/flow/paywall','/flow/slip','/flow/customChallenge','/flow/protectionSetup','/flow/challenge','/onboarding/quiz']) {
    assert.equal(resolveFreedSystemPath(`freed://${route}`), route);
    assert.equal(resolveFreedSystemPath(route), route);
  }
});
test('trusted interception, purchase authority and unknown destinations never come from a screen URL', () => {
  for (const link of ['freed:///flow/intercept','freed:///flow/ad','freed:///flow/not-a-feature','freed:///flow/challenge?premium=true','freed://user:secret@profile','freed://profile:443','https://untrusted.example/flow/checkin']) assert.equal(resolveFreedSystemPath(link), '/');
  assert.equal(resolveFreedSystemPath('https://freed-7d5ee.firebaseapp.com/intervention#source=safari'), '/');
  assert.equal(resolveFreedSystemPath('freed:///privacy'), '/privacy');
});
