const test = require('node:test');
const assert = require('node:assert/strict');
const { compileTokenProfiles } = require('../scripts/lib/momentum-tokens');

test('theme overrides propagate through component aliases and inherited profiles', () => {
  const source = { color: { accent: { $value: '#414ACE' } }, button: { fill: { $value: '{color.accent}' } },
    $extensions: { 'org.mobile-native': { profiles: { base: { overrides: {} }, dark: { extends: 'base', overrides: { 'color.accent': '#A1ADFF' } }, darkAndroid: { extends: 'dark', overrides: {} } } } } };
  const output = compileTokenProfiles(source);
  assert.equal(output.profiles.base['button.fill'], '#414ACE');
  assert.equal(output.profiles.darkAndroid['button.fill'], '#A1ADFF');
});
test('bad aliases fail generation instead of shipping a stale or unresolved color', () => {
  assert.throws(() => compileTokenProfiles({ a: { $value: '{missing}' } }), /Unknown token/);
  assert.throws(() => compileTokenProfiles({ a: { $value: '{b}' }, b: { $value: '{a}' } }), /Cyclic token/);
});
test('cyclic profile inheritance is rejected', () => {
  assert.throws(() => compileTokenProfiles({ a: { $value: 1 }, $extensions: { 'org.mobile-native': { profiles: { base: { extends: 'dark' }, dark: { extends: 'base' } } } } }), /Cyclic profile/);
});
