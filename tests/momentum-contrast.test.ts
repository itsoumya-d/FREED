import assert from 'node:assert/strict';
import { getAppPalette, getPracticePalette, getCategoryPanelPalette } from '../src/design-system/app-palette';
function luminance(hex: string) {
  const values = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
function contrast(a: string, b: string) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
for (const mode of ['light', 'dark'] as const) {
  const palette = getAppPalette(mode);
  for (const key of ['text', 'text2', 'text3', 'accent', 'sky', 'mintLight'] as const) {
    assert.ok(contrast(palette[key], palette.bg) >= 4.5, `${mode} ${key} must remain readable as retained foreground copy`);
  }
  assert.ok(contrast(palette.onAccent, palette.accent) >= 4.5);
  for (const category of ['commitment', 'movement', 'reflection', 'calm'] as const) { const tile = getPracticePalette(category, mode); assert.ok(contrast(tile.ink, tile.surface) >= 4.5); }
  for (const category of ['commitment', 'movement', 'reflection', 'calm'] as const) {
    const panel = getCategoryPanelPalette(category, mode);
    for (const text of [panel.ink, panel.secondaryInk, panel.accent]) assert.ok(contrast(text, panel.surface) >= 4.5, `${mode} ${category} panel copy must be readable`);
  }
  for (const [foreground, background] of [[palette.success, palette.onTint], [palette.red, palette.offTint], [palette.warning, palette.attentionTint]]) {
    assert.ok(contrast(foreground, background) >= 4.5, `${mode} status label must be readable on its semantic tint`);
    assert.ok(contrast(palette.text, background) >= 4.5, `${mode} status description must be readable`);
  }
}
console.log('Both Momentum themes preserve readable actions, retained foreground aliases and all practice categories.');
