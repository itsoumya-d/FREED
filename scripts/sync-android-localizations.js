#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const locales = ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'];
const registryPath = 'src/i18n/native-android-catalog.json';
const resourcesPath = 'modules/freed-protection/android/src/main/res';
function escaped(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function generatedXml(locale, directory = root) {
  const registry = JSON.parse(fs.readFileSync(path.join(directory,registryPath),'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(directory,`src/i18n/locales/${locale}.json`),'utf8'));
  return '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from the audited authored-source catalogs. -->\n<resources>\n' + Object.entries(registry).map(([key, english]) => {
    const translation = locale === 'en' ? english : catalog.source[english];
    if (!translation?.trim()) throw new Error(`Missing Android native translation ${locale}: ${english}`);
    return `  <string name="${key}" formatted="false">${escaped(translation)}</string>`;
  }).join('\n') + '\n</resources>\n';
}
function run(check = false, directory = root) {
  for (const locale of locales) {
    const folder = locale === 'zh-Hans' ? 'values-b+zh+Hans' : `values-${locale}`;
    const filename = path.join(directory,resourcesPath,folder,'strings.xml');
    const xml = generatedXml(locale,directory);
    if (check) {
      if (!fs.existsSync(filename) || fs.readFileSync(filename,'utf8') !== xml) throw new Error(`Android native locale ${locale} is stale or missing`);
    } else {
      fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,xml);
      if (locale === 'en') fs.writeFileSync(path.join(directory,resourcesPath,'values/strings.xml'),xml);
    }
  }
}
if (require.main === module) {
  run(process.argv.includes('--check')); console.log('Android native notifications and presenters: all ten languages are current.');
}
module.exports = { generatedXml, run, locales, registryPath, resourcesPath };
