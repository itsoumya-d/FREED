const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const xcode = require('xcode');
test('localized permission resources resolve on disk and belong only to the host app', () => {
  const project = xcode.project('ios/FREED.xcodeproj/project.pbxproj'); project.parseSync();
  const resources = project.getPBXGroupByKey(project.findPBXGroupKey({ name: 'Resources' }));
  assert.equal(resources.path, 'FREED');
  const variant = project.findPBXVariantGroupKey({ name: 'InfoPlist.strings' });
  const children = project.getPBXVariantGroupByKey(variant).children;
  assert.equal(children.length, 10);
  assert.deepEqual(children.map(child => project.pbxFileReferenceSection()[child.value].name.replace(/"/g, '')).sort(), ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'].sort());
  for (const child of children) {
    const file = project.pbxFileReferenceSection()[child.value];
    assert.ok(fs.existsSync(`ios/${resources.path}/${file.path.replace(/"/g, '')}`));
    assert.match(fs.readFileSync(`ios/${resources.path}/${file.path.replace(/"/g, '')}`, 'utf8'), /NSCameraUsageDescription/);
  }
  const o = project.hash.project.objects;
  const buildId = Object.entries(o.PBXBuildFile).find(([key, value]) => !key.endsWith('_comment') && value.fileRef === variant)[0];
  for (const [key, target] of Object.entries(o.PBXNativeTarget)) {
    if (key.endsWith('_comment')) continue;
    const resourcePhases = target.buildPhases.map(phase => o.PBXResourcesBuildPhase[phase.value]).filter(Boolean);
    const copies = resourcePhases.flatMap(phase => phase.files).filter(file => file.value === buildId).length;
    assert.equal(copies, String(target.name).replace(/"/g, '') === 'FREED' ? 1 : 0);
  }
});

test('Android language registry includes Korean and retires Bengali', () => {
  const config = fs.readFileSync('android/app/src/main/res/xml/locales_config.xml', 'utf8');
  assert.match(config, /android:name="ko"/);
  assert.doesNotMatch(config, /android:name="bn"/);
  assert.ok(fs.existsSync('android/app/src/main/res/values-ko/strings.xml'));
});
