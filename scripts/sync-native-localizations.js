#!/usr/bin/env node
// Generate native permission copy from the same audited catalogs used in the app.
const fs = require('node:fs');
const path = require('node:path');
const xcode = require('xcode');
const root = path.resolve(__dirname, '..');
const locales = ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'];
const quote = value => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
const projectPath = path.join(root, 'ios/FREED.xcodeproj/project.pbxproj');
const project = xcode.project(projectPath); project.parseSync();
const parent = project.findPBXGroupKey({ name: 'FREED' }) ?? project.findPBXGroupKey({ path: 'FREED' });
if (!parent) throw new Error('FREED application resource group was not found.');
if (!project.findPBXGroupKey({ name: 'Resources' })) {
  const resources = project.addPbxGroup([], 'Resources', project.getPBXGroupByKey(parent).path ? '.' : 'FREED');
  project.addToPbxGroup({ fileRef: resources.uuid, basename: 'Resources' }, parent);
}
project.getPBXGroupByKey(project.findPBXGroupKey({ name: 'Resources' })).path = project.getPBXGroupByKey(parent).path ? '.' : 'FREED';
let variant = project.findPBXVariantGroupKey({ name: 'InfoPlist.strings' });
if (!variant) {
  const added = project.addLocalizationVariantGroup('InfoPlist.strings');
  variant = added.fileRef;
}
// Retire only the previous generated Bengali permission file and registration.
const references = project.pbxFileReferenceSection();
const children = project.getPBXVariantGroupByKey(variant).children;
for (const child of [...children]) {
  if (!String(references[child.value]?.path).includes('bn.lproj/InfoPlist.strings')) continue;
  children.splice(children.indexOf(child), 1);
  delete references[child.value]; delete references[`${child.value}_comment`];
}
for (const [key, definition] of Object.entries(project.hash.project.objects.PBXProject)) {
  if (!key.endsWith('_comment') && definition.knownRegions) definition.knownRegions = definition.knownRegions.filter(region => String(region).replace(/"/g, '') !== 'bn');
}
const retired = path.join(root, 'ios/FREED/bn.lproj/InfoPlist.strings');
if (fs.existsSync(retired)) fs.unlinkSync(retired);
if (fs.existsSync(path.dirname(retired)) && fs.readdirSync(path.dirname(retired)).length === 0) fs.rmdirSync(path.dirname(retired));
for (const locale of locales) {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, `src/i18n/locales/${locale}.json`), 'utf8'));
  const permissions = catalog.native?.permissions;
  if (!permissions || Object.values(permissions).some(value => typeof value !== 'string' || !value)) throw new Error(`Missing native permission copy for ${locale}`);
  const relative = `${locale}.lproj/InfoPlist.strings`;
  const target = path.join(root, 'ios/FREED', relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Object.entries(permissions).map(([key, value]) => `${quote(key)} = ${quote(value)};`).join('\n') + '\n');
  const children = project.getPBXVariantGroupByKey(variant).children;
  if (!children.some(child => project.pbxFileReferenceSection()[child.value]?.path?.includes(`${locale}.lproj`))) {
    const file = project.addResourceFile(relative, { variantGroup: true }, variant);
    if (!file) throw new Error(`Could not register native localization ${locale}`);
    project.pbxFileReferenceSection()[file.fileRef].name = locale;
    children.find(child => child.value === file.fileRef).comment = locale;
  }
  project.addKnownRegion(locale);
}
// xcode's default helper can select an extension's resource phase. Bind only to the host app.
const objects = project.hash.project.objects;
const host = Object.entries(objects.PBXNativeTarget).find(([key, value]) => !key.endsWith('_comment') && String(value.name).replace(/"/g, '') === 'FREED');
if (!host) throw new Error('FREED host target was not found.');
const phaseId = host[1].buildPhases.map(phase => phase.value).find(id => objects.PBXResourcesBuildPhase[id]);
const buildFileIds = Object.entries(objects.PBXBuildFile).filter(([key, value]) => !key.endsWith('_comment') && value.fileRef === variant).map(([key]) => key);
if (!phaseId || buildFileIds.length !== 1) throw new Error('Native localization resource phase is ambiguous.');
for (const [key, phase] of Object.entries(objects.PBXResourcesBuildPhase)) {
  if (key.endsWith('_comment')) continue;
  phase.files = phase.files.filter(file => !buildFileIds.includes(file.value));
}
objects.PBXResourcesBuildPhase[phaseId].files.push({ value: buildFileIds[0], comment: 'InfoPlist.strings in Resources' });
fs.writeFileSync(projectPath, project.writeSync());
console.log(`Generated and registered native permission translations for ${locales.length} languages.`);

// Android app labels are the brand name in each locale. Runtime authored copy
// comes from the same JS catalogs; register the locales without prebuilding.
const android = path.join(root, 'android/app/src/main/res');
for (const locale of locales) {
  const qualifier = locale === 'zh-Hans' ? 'b+zh+Hans' : locale;
  const directory = path.join(android, `values-${qualifier}`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'strings.xml'), '<resources>\n  <string name="app_name">FREED</string>\n</resources>\n');
}
fs.writeFileSync(path.join(android, 'xml/locales_config.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<locale-config xmlns:android="http://schemas.android.com/apk/res/android">\n' + locales.map(locale => `  <locale android:name="${locale}" />`).join('\n') + '\n</locale-config>\n');

require('./sync-android-localizations').run();

require('./sync-ios-notification-localizations').run();
