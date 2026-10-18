'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LOCALES, audit } = require('../scripts/localization-audit');

function fixture(code, keys, extraFiles = {}, inspect = audit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-localization-precision-'));
  for (const [file, contents] of Object.entries({ 'src/components/Fixture.tsx': code, ...extraFiles })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  }
  fs.mkdirSync(path.join(root, 'src/i18n/locales'), { recursive: true });
  for (const locale of LOCALES) fs.writeFileSync(path.join(root, 'src/i18n/locales', `${locale}.json`), JSON.stringify({
    source: Object.fromEntries(keys.map(key => [key, locale === 'en' ? key : `${locale}: ${key}`])),
    common: {}, preferences: {}, dns: {},
  }));
  try { return inspect(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const imports = "import { translateSource, appI18n } from '@/i18n/runtime'; import { Text } from './Localized';";
const stepFiles = { 'src/lib/guide-stage.ts': 'export type DnsGuideStage = 0 | 1 | 2;' };
const finiteSteps = "import type { DnsGuideStage } from '@/lib/guide-stage'; export function Guide(stage: DnsGuideStage) { return <Text>{`Step ${stage + 1} of 3`}</Text>; }";

test('explicitly localized compositions inventory source calls and authored fragments', () => {
  const report = fixture(imports + "export const label = <Text translate={false}>{`${translateSource('Settings')} → ${translateSource('General')} → ${translateSource('VPN & Device Management')} → DNS`}</Text>;", ['Settings', 'General', 'VPN & Device Management', 'DNS']);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.coverage.uncoveredPhrases, []);
  assert.equal(report.coverage.byFile['src/components/Fixture.tsx'].phrases, 4);
});

test('source namespace lookup inventories the English dictionary key', () => {
  for (const code of [
    imports + "export const label = appI18n.t('source.{{date}}. Recorded activity', { date: formatted });",
    "import { useTranslation } from 'react-i18next'; export function Label() { const { t } = useTranslation(); return <Text translate={false}>{t('source.{{date}}. Recorded activity', { date: formatted })}</Text>; }",
  ]) {
    const report = fixture(code, ['{{date}}. Recorded activity']);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.coverage.uncoveredPhrases, []);
    assert.equal(report.coverage.distinctPhrases, 1);
  }
});

test('finite numeric union arithmetic inventories every exact rendered source', () => {
  const report = fixture(finiteSteps, ['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3'], stepFiles);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.coverage.uncoveredPhrases, []);
  assert.equal(report.coverage.distinctPhrases, 3);
});

test('translate=false cannot conceal untranslated literal or composed English', () => {
  for (const code of [
    'export const label = <Text translate={false}>New untranslated instructions.</Text>;',
    imports + "export const label = <Text translate={false}>{`New untranslated instructions. ${translateSource('Settings')}`}</Text>;",
    imports + "export const label = <Text translate={false}>{`${translateSource('Settings')} → Advanced configuration`}</Text>;",
  ]) {
    const report = fixture(code, ['Settings']);
    assert.equal(report.coverage.uncovered, 1);
    assert.ok(report.coverage.uncoveredPhrases[0].source.includes('untranslated instructions') || report.coverage.uncoveredPhrases[0].source.includes('Advanced configuration'));
  }
});

test('authored literals in identifier aliases object properties and imports stay uncovered', () => {
  for (const [declaration, expression, extraFiles] of [
    ["const plain = 'Unreviewed';", 'plain', {}],
    ["const plain = 'Unreviewed'; const alias = plain;", 'alias', {}],
    ["const plain = 'Unreviewed';", 'translateSource(plain)', {}],
    ["const data = { caption: 'Unreviewed' };", 'data.caption', {}],
    ["import { plain as alias } from '@/lib/fixture-copy';", 'alias', { 'src/lib/fixture-copy.ts': "export const plain = 'Unreviewed';" }],
    ["import { data } from '@/lib/fixture-copy';", 'data.caption', { 'src/lib/fixture-copy.ts': "export const data = { caption: 'Unreviewed' };" }],
  ]) {
    const report = fixture(imports + declaration + `export const label = <Text translate={false}>{\`${'${translateSource(\'Settings\')}'} → DNS → \${${expression}}\`}</Text>;`, ['Settings', 'DNS'], extraFiles);
    assert.ok(report.coverage.uncoveredPhrases.some(item => item.source === 'Unreviewed'), expression);
    assert.ok(report.coverage.uncoveredPhrases.some(item => item.occurrences.some(occurrence => occurrence.kind === 'uncertain-source-composition')), expression);
  }
});

test('unknown parameter and property spans retain the original aggregate candidate', () => {
  for (const expression of ['plain', 'guide.label']) {
    const report = fixture(imports + `export function Path(plain: string, guide: { label: string }) { return <Text translate={false}>{\`${'${translateSource(\'Settings\')}'} → DNS → \${${expression}}\`}</Text>; }`, ['Settings', 'DNS']);
    assert.equal(report.coverage.uncovered, 1);
    assert.equal(report.coverage.uncoveredPhrases[0].occurrences[0].kind, 'uncertain-source-composition');
  }
});

test('separator-only uncertain authored function output has a required coverage candidate', () => {
  const report = fixture(imports + "function authored() { return 'Unreviewed'; } export const label = <Text translate={false}>{`${translateSource('Settings')} → ${authored()}`}</Text>;", ['Settings']);
  assert.deepEqual(report.errors, []);
  assert.equal(report.coverage.uncovered, 1);
  assert.equal(report.coverage.uncoveredPhrases[0].source, '{{value1}} → {{value2}}');
  assert.equal(report.coverage.uncoveredPhrases[0].occurrences[0].kind, 'uncertain-source-composition');
});

test('separator-only unknown parameters cannot be waived by a reviewed placeholder template', () => {
  for (const name of ['plain', 'note']) {
    const report = fixture(imports + `export function Path(${name}: string) { return <Text translate={false}>{\`${'${translateSource(\'Settings\')}'} → \${${name}}\`}</Text>; }`, ['Settings', `{{value1}} → {{${name}}}`]);
    assert.deepEqual(report.errors, []);
    assert.equal(report.coverage.uncovered, 1);
    assert.equal(report.coverage.uncoveredPhrases[0].source, `{{value1}} → {{${name}}}`);
    assert.equal(report.coverage.uncoveredPhrases[0].occurrences[0].kind, 'uncertain-source-composition');
  }
});

test('fully known translations and punctuation alone do not create missing candidates', () => {
  const report = fixture(imports + "export const label = <><Text translate={false}>{`${translateSource('Settings')} → ${translateSource('General')}`}</Text><Text translate={false}>→</Text></>;", ['Settings', 'General']);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.coverage.uncoveredPhrases, []);
  assert.equal(report.coverage.distinctPhrases, 2);
});

test('standard numeric local and property locale output composes with reviewed labels', () => {
  for (const [parameters, declaration, expression] of [
    ['', 'const selectedCount = 4;', 'selectedCount'],
    ['draft: { rule: { limitMinutes: number } }', '', 'draft.rule.limitMinutes'],
  ]) {
    const report = fixture(imports + `export function Label(${parameters}) { ${declaration} return <Text translate={false}>{\`\${${expression}.toLocaleString(appI18n.language)} ${'${translateSource(\'selected apps\')}'}\`}</Text>; }`, ['selected apps']);
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.coverage.uncoveredPhrases, []);
    assert.equal(report.coverage.distinctPhrases, 1);
  }
});

test('custom any string Date and builtin name imitators stay uncertain', () => {
  for (const [parameters, declaration, expression] of [
    ['', "const count = { toLocaleString() { return 'Unreviewed'; } };", 'count.toLocaleString(appI18n.language)'],
    ['count: any', '', 'count.toLocaleString(appI18n.language)'],
    ['count: string', '', 'count.toLocaleString(appI18n.language)'],
    ['count: Date', '', 'count.toLocaleString(appI18n.language)'],
    ['', "class Number { toLocaleString() { return 'Unreviewed'; } } const count = new Number();", 'count.toLocaleString(appI18n.language)'],
    ['', "function authored() { return 'Unreviewed'; }", 'authored()'],
    ['', 'function count() { return 4; }', 'count().toLocaleString(appI18n.language)'],
  ]) {
    const report = fixture(imports + `export function Label(${parameters}) { ${declaration} return <Text translate={false}>{\`\${${expression}} ${'${translateSource(\'selected apps\')}'}\`}</Text>; }`, ['selected apps']);
    assert.equal(report.coverage.uncovered, 1, expression);
    assert.equal(report.coverage.uncoveredPhrases[0].occurrences[0].kind, 'uncertain-source-composition');
  }
});

test('shadowed locale augmented numeric methods options and cast receivers stay uncertain', () => {
  for (const [parameters, declaration, expression, preamble = ''] of [
    ['appI18n: { language: string }', 'const count = 4;', 'count.toLocaleString(appI18n.language)'],
    ['', 'const count = 4;', 'count.toLocaleString(appI18n.language)', 'declare global { interface Number { toLocaleString(locale: string): string; } }'],
    ['', 'const count = 4;', "count.toLocaleString(appI18n.language, { style: 'currency', currency: 'USD', currencyDisplay: 'name' })"],
    ['count: any', '', '(count as number).toLocaleString(appI18n.language)'],
  ]) {
    const report = fixture(imports + preamble + `export function Label(${parameters}) { ${declaration} return <Text translate={false}>{\`\${${expression}} ${'${translateSource(\'selected apps\')}'}\`}</Text>; }`, ['selected apps']);
    assert.equal(report.coverage.uncovered, 1, expression);
    assert.equal(report.coverage.uncoveredPhrases[0].occurrences[0].kind, 'uncertain-source-composition');
  }
});

test('reused type programs observe changed and newly created imported source files', () => {
  fixture(imports + "import { plain } from '@/lib/fixture-copy'; export const label = <Text translate={false}>{`${translateSource('Settings')} → DNS → ${plain}`}</Text>;", ['Settings', 'DNS'], {}, root => {
    const first = audit(root);
    assert.equal(first.coverage.uncovered, 1);
    const copyPath = path.join(root, 'src/lib/fixture-copy.ts');
    fs.mkdirSync(path.dirname(copyPath), { recursive: true });
    fs.writeFileSync(copyPath, "export const plain = 'Unreviewed';");
    assert.ok(audit(root).coverage.uncoveredPhrases.some(item => item.source === 'Unreviewed'));
    fs.writeFileSync(copyPath, "export const plain = 'Changed';");
    const changed = audit(root);
    assert.ok(changed.coverage.uncoveredPhrases.some(item => item.source === 'Changed'));
    assert.ok(!changed.coverage.uncoveredPhrases.some(item => item.source === 'Unreviewed'));
  });
});

test('missing source lookups and literal namespace text remain uncovered', () => {
  for (const code of [
    imports + "export const label = appI18n.t('source.{{date}}. Missing activity', { date: formatted });",
    "export const label = <Text translate={false}>source.{{date}}. Recorded activity</Text>;",
    "export function Label(appI18n: any) { return appI18n.t('source.{{date}}. Recorded activity'); }",
  ]) assert.equal(fixture(code, ['{{date}}. Recorded activity']).coverage.uncovered, 1);
});

test('a missing finite rendered key and an unknown numeric range still fail coverage', () => {
  const finite = fixture(finiteSteps, ['Step 1 of 3', 'Step 2 of 3'], stepFiles);
  assert.deepEqual(finite.coverage.uncoveredPhrases.map(item => item.source), ['Step 3 of 3']);
  const unknown = fixture('export function Guide(stage: number) { return <Text>{`Step ${stage + 1} of 3`}</Text>; }', ['Step 1 of 3', 'Step 2 of 3', 'Step 3 of 3']);
  assert.deepEqual(unknown.coverage.uncoveredPhrases.map(item => item.source), ['Step {{value1}} of 3']);
});

test('missing translated fragments and shadowed translator names remain uncovered', () => {
  const missing = fixture(imports + "export const label = <Text translate={false}>{`${translateSource('Settings')} → ${translateSource('Unreviewed')}`}</Text>;", ['Settings']);
  assert.deepEqual(missing.coverage.uncoveredPhrases.map(item => item.source), ['Unreviewed']);
  const shadowed = fixture(imports + "export function Label(translateSource: any) { return <Text translate={false}>{`${translateSource('Settings')} → DNS → ${guide.label}`}</Text>; }", ['Settings']);
  assert.equal(shadowed.coverage.uncovered, 1);
  const unsupportedCall = fixture(imports + "export const label = <Text translate={false}>{`${translateSource('Settings')} → DNS → ${appI18n.t('common.missing')}`}</Text>;", ['Settings', 'DNS']);
  assert.equal(unsupportedCall.coverage.uncovered, 1);
});
