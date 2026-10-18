#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const { locales } = require('./sync-android-localizations');
const registryPath = 'src/i18n/native-ios-notification-catalog.json';
const targetPath = 'ios/FREEDShieldAction/ShieldActionExtension.swift';
function generatedCopy(directory = root, registry = registryPath, enumName = 'FreedShieldActionCopy', label = 'SHIELD ACTION') {
  const messages = JSON.parse(fs.readFileSync(path.join(directory,registry),'utf8'));
  const dictionaries = locales.map(locale => {
    const source = JSON.parse(fs.readFileSync(path.join(directory,`src/i18n/locales/${locale}.json`),'utf8')).source;
    const copy = Object.fromEntries(Object.entries(messages).map(([key,english]) => {
      const translation = locale === 'en' ? english : source[english];
      if(!translation?.trim()) throw new Error(`Missing iOS notification ${locale}.${key}`);
      return [key,translation];
    }));
    return `    ${JSON.stringify(locale)}: [${Object.entries(copy).map(([key,value])=>`${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')}]`;
  }).join(',\n');
  return `// BEGIN GENERATED ${label} COPY\nprivate enum ${enumName} {\n  static let strings: [String: [String: String]] = [\n${dictionaries}\n  ]\n  static func language(selected: String?, preferred: String) -> String {\n    if let selected, strings[selected] != nil { return selected }\n    let normalized = preferred.replacingOccurrences(of: "_", with: "-").lowercased()\n    if normalized.hasPrefix("zh") {\n      return ["hant", "tw", "hk", "mo"].contains(where: normalized.contains) ? "en" : "zh-Hans"\n    }\n    let base = String(normalized.split(separator: "-").first ?? "en")\n    return strings[base] != nil ? base : "en"\n  }\n}\n// END GENERATED ${label} COPY`;
}
function run(check=false,directory=root) {
  const filename=path.join(directory,targetPath),before=fs.readFileSync(filename,'utf8');
  const pattern=/\/\/ BEGIN GENERATED SHIELD ACTION COPY[\s\S]*?\/\/ END GENERATED SHIELD ACTION COPY/;
  const section=generatedCopy(directory);
  const after=pattern.test(before)?before.replace(pattern,section):before.replace('final class ShieldActionExtension',section+'\n\nfinal class ShieldActionExtension');
  if(check && after!==before) throw new Error('iOS Shield Action notifications are stale');
  if(!check) fs.writeFileSync(filename,after);
  const blockerRegistry = 'src/i18n/native-ios-content-blocker-catalog.json';
  if (fs.existsSync(path.join(directory,blockerRegistry))) {
    const blockerFile=path.join(directory,'ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift');
    const beforeBlocker=fs.readFileSync(blockerFile,'utf8');
    const blockPattern=/\/\/ BEGIN GENERATED CONTENT BLOCKER COPY[\s\S]*?\/\/ END GENERATED CONTENT BLOCKER COPY/;
    const blockSection=generatedCopy(directory,blockerRegistry,'FreedContentBlockerCopy','CONTENT BLOCKER');
    const afterBlocker=blockPattern.test(beforeBlocker)?beforeBlocker.replace(blockPattern,blockSection):beforeBlocker.replace('final class ContentBlockerRequestHandler',blockSection+'\n\nfinal class ContentBlockerRequestHandler');
    if(check && beforeBlocker!==afterBlocker) throw new Error('iOS Content Blocker error copy is stale');
    if(!check) fs.writeFileSync(blockerFile,afterBlocker);
  }
}
if(require.main===module) {run(process.argv.includes('--check'));console.log('iOS Shield Action notifications: all ten languages are current.');}
module.exports={run,generatedCopy,registryPath,targetPath,locales};
