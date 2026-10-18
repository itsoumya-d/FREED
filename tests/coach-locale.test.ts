import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachRequest, configureRemoteCoachProvider, getCoachConfig } from '../src/lib/ai-coach';
test('CLARA preserves a supported language preference without changing user input', () => {
  const request = buildCoachRequest('मुझे मदद चाहिए', { attempts: [], locale: 'hi' });
  assert.equal(request.locale, 'hi');
  assert.equal(request.input, 'मुझे मदद चाहिए');
  assert.equal(buildCoachRequest('Help', { attempts: [] }).locale, undefined);
});
test('an explicit local coach setting prevents implicit remote provider use', () => {
  const previous = process.env.EXPO_PUBLIC_AI_COACH_MODE;
  try { process.env.EXPO_PUBLIC_AI_COACH_MODE = 'local'; configureRemoteCoachProvider(async () => { throw new Error('Remote must not run'); }); assert.equal(getCoachConfig().mode, 'local'); }
  finally { configureRemoteCoachProvider(null); if (previous === undefined) delete process.env.EXPO_PUBLIC_AI_COACH_MODE; else process.env.EXPO_PUBLIC_AI_COACH_MODE = previous; }
});
