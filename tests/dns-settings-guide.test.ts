import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as guide from '../src/lib/dns-settings-guide';
const saved = { supported: true, releaseEnabled: true, configured: true, enabled: false, healthy: null, reason: null, provider: 'cloudflare-families', requiresSettings: true, configurationLabel: 'FREED · Native DNS label' };
test('guide stages are presentation only and require native saved-label evidence', () => {
  const derive = (guide as any).getDnsSettingsGuide;
  assert.equal(typeof derive, 'function');
  assert.equal(derive({ ...saved, configured: false }, 2), null);
  assert.equal(derive({ ...saved, configurationLabel: undefined }, 2), null);
  assert.equal(derive({ ...saved, enabled: true }, 2), null);
  assert.deepEqual(derive(saved, 9), { label: saved.configurationLabel, stage: 0 });
  assert.deepEqual(derive(saved, 2), { label: saved.configurationLabel, stage: 2 });
});
test('persisted visual position cannot establish OS selection and resets for another native label', () => {
  const restore = (guide as any).restoreDnsGuideStage;
  assert.equal(typeof restore, 'function');
  assert.equal(restore(JSON.stringify({ version: 1, label: saved.configurationLabel, stage: 2 }), saved.configurationLabel), 2);
  assert.equal(restore(JSON.stringify({ version: 1, label: 'other', stage: 2 }), saved.configurationLabel), 0);
  assert.equal(restore(JSON.stringify({ version: 1, label: saved.configurationLabel, stage: true }), saved.configurationLabel), 0);
  assert.equal(restore('bad', saved.configurationLabel), 0);
});
