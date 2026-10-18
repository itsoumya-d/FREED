import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClaraRequest } from './ai';
const request = { clientEventId: 'evt_locale123', input: 'Help me pause', context: { streakDays: 0, attemptsToday: 0, premium: false, slipsThisWeek: 0, slipWindow: null, slipTrigger: null } };
test('CLARA locale is optional for compatibility and validated when supplied', () => {
  assert.deepEqual(parseClaraRequest(request), request);
  for (const locale of ['en','hi','ko','es','pt','fr','de','ar','ja','zh-Hans']) assert.equal(parseClaraRequest({ ...request, locale }).locale, locale);
  assert.throws(() => parseClaraRequest({ ...request, locale: 'bn' }));
  assert.throws(() => parseClaraRequest({ ...request, locale: 'ar', privateHistory: 'do not accept' }));
});
