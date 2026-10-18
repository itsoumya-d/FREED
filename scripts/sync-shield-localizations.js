#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const locales = ['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'];
const keys = ['title', 'primary', 'secondary', 'targetDescription', 'categoryDescription'];
const target = path.join(root, 'ios/FreedShieldConfiguration/ShieldConfigurationExtension.swift');
function buildShieldCopy(catalogs) {
  return locales.map(locale => {
    const copy = catalogs[locale]?.native?.shield;
    if (!copy || keys.some(key => typeof copy[key] !== 'string' || !copy[key].trim())) throw new Error(`Incomplete native shield copy: ${locale}`);
    return `    ${JSON.stringify(locale)}: [\n${keys.map(key => `      ${JSON.stringify(key)}: ${JSON.stringify(copy[key])}`).join(',\n')}\n    ]`;
  }).join(',\n');
}
function generatedSection(catalogs) {
  return `  // BEGIN GENERATED SHIELD COPY\n  static let strings: [String: [String: String]] = [\n${buildShieldCopy(catalogs)}\n  ]\n  // END GENERATED SHIELD COPY`;
}
function run(check = false) {
  const catalogs = Object.fromEntries(locales.map(locale => [locale, JSON.parse(fs.readFileSync(path.join(root, `src/i18n/locales/${locale}.json`), 'utf8'))]));
  const before = fs.readFileSync(target, 'utf8');
  const pattern = /  \/\/ BEGIN GENERATED SHIELD COPY[\s\S]*?  \/\/ END GENERATED SHIELD COPY/;
  if (!pattern.test(before)) throw new Error('Native shield generation markers are missing.');
  const after = before.replace(pattern, generatedSection(catalogs));
  if (check && after !== before) throw new Error('Native shield translations are stale. Run node scripts/sync-shield-localizations.js.');
  if (!check) fs.writeFileSync(target, after);
  return after;
}
if (require.main === module) {
  if (process.argv.slice(2).some(value => value !== '--check')) throw new Error('Only --check is supported.');
  run(process.argv.includes('--check'));
  console.log('Native shield copy: all ten languages are current.');
}
module.exports = { buildShieldCopy, generatedSection, run, locales, keys };
