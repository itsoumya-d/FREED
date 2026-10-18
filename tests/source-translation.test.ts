import assert from 'node:assert/strict';
import test from 'node:test';
import { translateAuthoredSource } from '../src/i18n/source-translation';
test('authored copy and parameterized copy translate without changing values', () => {
  const source = { 'Retry': 'Reintentar', '{{count}} days': '{{count}} días', 'Subscribe · {{price}} {{cadence}}': 'Suscribirse · {{price}} {{cadence}}' };
  assert.equal(translateAuthoredSource('Retry', source), 'Reintentar');
  assert.equal(translateAuthoredSource('12 days', source), '12 días');
  assert.equal(translateAuthoredSource('Subscribe · ₹399 per month', source), 'Suscribirse · ₹399 per month');
  assert.equal(translateAuthoredSource('https://example.test/account', source), 'https://example.test/account');
});
test('unknown phrases remain observable and whitespace normalization preserves copy', () => {
  assert.equal(translateAuthoredSource('  Retry\n', { Retry: '再試行' }), '再試行');
  assert.equal(translateAuthoredSource('Untranslated warning', {}), 'Untranslated warning');
  assert.equal(translateAuthoredSource('FREED', {}), 'FREED');
  assert.equal(translateAuthoredSource('constructor', {}), 'constructor');
  assert.equal(translateAuthoredSource('__proto__', {}), '__proto__');
  assert.equal(translateAuthoredSource('unknown authored string', { '{{value}}d{{value2}}': '{{value}} días {{value2}}' }), 'unknown authored string');
});
test('short authored contexts accept text and mixed values while nested copy localizes', () => {
  const source = { 'Protect {{app}}': 'Proteger {{app}}', 'Backup: {{status}}': 'Copia: {{status}}', ready: 'lista', '{{label}} · {{count}} {{unit}}': '{{label}} · {{count}} {{unit}}', Strength: 'Fuerza', rounds: 'rondas' };
  assert.equal(translateAuthoredSource('Protect WhatsApp', source), 'Proteger WhatsApp');
  assert.equal(translateAuthoredSource('Backup: ready', source), 'Copia: lista');
  assert.equal(translateAuthoredSource('Strength · 5 rounds', source), 'Fuerza · 5 rondas');
});
test('empty optional suffixes localize and private interpolation values stay opaque', () => {
  assert.equal(translateAuthoredSource('High · Low data confidence', { '{{level}} · {{confidence}} data confidence{{suffix}}': '{{level}} · {{confidence}} confianza de datos{{suffix}}', High: 'Alto', Low: 'Bajo' }), 'Alto · Bajo confianza de datos');
  assert.equal(translateAuthoredSource('Message Calm', { 'Message {{name}}': 'Enviar mensaje a {{name}}', Calm: 'Calma' }), 'Enviar mensaje a Calm');
  assert.equal(translateAuthoredSource('2.5 days', { '{{count}} days': '{{count}} días' }, 0, 'es'), '2,5 días');
});

test('Arabic numeric interpolation uses Arabic digits while opaque private values retain their digits', () => {
  const source = { '{{count}} days': '{{count}} أيام', 'Message {{name}}': 'رسالة {{name}}' };
  assert.equal(translateAuthoredSource('2 days', source, 0, 'ar'), '٢ أيام');
  assert.equal(translateAuthoredSource('Message Calm2', source, 0, 'ar'), 'رسالة Calm2');
});
