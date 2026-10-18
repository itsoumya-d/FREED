import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAppPalette } from '../src/design-system/app-palette';
function luminance(hex: string) { const channels = hex.slice(1).match(/../g)!.map(x => parseInt(x, 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722; }
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
test('both themes keep normal text and primary actions readable', () => {
  for (const mode of ['light', 'dark'] as const) {
    const c = getAppPalette(mode);
    assert.ok(contrast(c.text, c.bg) >= 7);
    assert.ok(contrast(c.text2, c.surface) >= 4.5);
    assert.ok(contrast(c.onAccent, c.mint) >= 4.5);
    assert.notEqual(c.bg, c.surface);
  }
});
test('default selects light surfaces and semantic text remains readable on both themes', () => {
  assert.equal(getAppPalette(null), getAppPalette('light'));
  for (const mode of ['light', 'dark'] as const) {
    const c = getAppPalette(mode);
    for (const key of ['mintLight', 'purple', 'peach', 'peachLight', 'pink', 'sky', 'yellow', 'red', 'red2'] as const) {
      for (const surface of [c.bg, c.surface, c.surface2])
        assert.ok(contrast(c[key], surface) >= 4.5, `${mode} ${key} must remain readable`);
    }
  }
});
