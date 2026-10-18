import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyUrl } from '../src/lib/blocking-engine';
test('ordinary-site exceptions do not disable adult domains or consumption searches', () => {
  assert.equal(classifyUrl('https://pornhub.com', { userAllowedDomains: ['pornhub.com'] }).verdict, 'block');
  assert.equal(classifyUrl('https://google.com/search?q=watch+free+porn', { userAllowedDomains: ['google.com'] }).verdict, 'block');
  assert.equal(classifyUrl('https://google.com/search?q=porn+addiction+recovery', { userAllowedDomains: ['google.com'] }).verdict, 'allow');
  assert.equal(classifyUrl('https://example.com', { userAllowedDomains: ['example.com'] }).verdict, 'allow');
});
