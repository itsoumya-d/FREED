const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const base = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const locales = ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'];

test('Android persists presentation language and every presenter uses localized native copy', () => {
  const module = fs.readFileSync(`${base}FreedProtectionModule.kt`, 'utf8');
  assert.match(module, /Function\("setPresentationPreferences"\)/, 'Android must receive saved app presentation choices');
  assert.match(fs.readFileSync('modules/freed-protection/src/index.ts','utf8'), /Platform\.OS !== 'ios' && Platform\.OS !== 'android'/);
  for (const locale of locales) {
    const qualifier = locale === 'zh-Hans' ? 'b+zh+Hans' : locale;
    assert.ok(fs.existsSync(`modules/freed-protection/android/src/main/res/values-${qualifier}/strings.xml`), `missing ${locale} module copy`);
  }
});

test('compiled Android locale resolution follows saved choice, System, migration and supported tags', () => {
  const policy = `${base}FreedPresentationLocale.kt`;
  assert.ok(fs.existsSync(policy), 'Android saved-locale resolution is missing');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-presentation-locale-'));
  try {
    const input = path.join(folder, 'Cases.kt'), jar = path.join(folder, 'cases.jar');
    fs.writeFileSync(input, `package app.freed.protection
fun main() {
  check(FreedPresentationLocale.resolve("ko", "ar-SA") == "ko")
  check(FreedPresentationLocale.resolve("system", "ko-KR") == "ko")
  check(FreedPresentationLocale.resolve("bn", "fr-FR") == "fr")
  check(FreedPresentationLocale.resolve(null, "ar_SA") == "ar")
  check(FreedPresentationLocale.resolve(null, "zh-TW") == "en")
  check(FreedPresentationLocale.resolve(null, "zh-CN") == "zh-Hans")
  check(FreedPresentationLocale.resolve(null, "unsupported") == "en")
  for (language in listOf(${locales.map(locale=>JSON.stringify(locale)).join(',')})) check(FreedPresentationLocale.resolve(language, "en") == language)
  println("PASS Android saved/System/legacy native language resolution")
}`);
    const compile = spawnSync('kotlinc', [policy,input,'-include-runtime','-d',jar], {encoding:'utf8',timeout:120000});
    assert.equal(compile.status,0,(compile.error?.message ?? '')+compile.stdout+compile.stderr);
    const result = spawnSync('java',['-jar',jar],{encoding:'utf8',timeout:10000});
    assert.equal(result.status,0,result.stdout+result.stderr);
  } finally { fs.rmSync(folder,{recursive:true,force:true}); }
});
