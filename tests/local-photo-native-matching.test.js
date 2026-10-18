const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const folder = path.resolve('.superpowers/sdd/2026-10-05-daily-usability-release-completion/photo-matching');
fs.mkdirSync(folder, { recursive: true });
const cases = [['plant','flower',false],['flowerpot','flower',false],['sunflower wallpaper','flower',false],[' FLOWER ','flower',true],['blossom','blossom',true],['','flower',false]];
test('Swift native matching rejects generic and substring evidence', () => {
 const source = path.resolve('modules/freed-protection/ios/FreedPhotoTargetMatching.swift');
 assert.ok(fs.existsSync(source), 'native matching must share the reviewed exact-label policy');
 const runner = fs.readFileSync(source,'utf8') + '\n' + cases.map(([observed,expected,want]) => `precondition(FreedPhotoTargetMatching.matches(observed: ${JSON.stringify(observed)}, expected: ${JSON.stringify(expected)}) == ${want})`).join('\n') + '\nprint("Swift photo matching passed")';
 const main = path.join(folder,'main.swift'), binary = path.join(folder,'matching-swift');fs.writeFileSync(main,runner);
 execFileSync('xcrun',['swiftc',main,'-o',binary],{timeout:60000});
 assert.match(execFileSync(binary,{encoding:'utf8',timeout:10000}),/Swift photo matching passed/);
});
test('Kotlin native matching rejects generic and substring evidence', () => {
 const source = path.resolve('modules/freed-protection/android/src/main/java/app/freed/protection/FreedPhotoTargetMatching.kt');
 assert.ok(fs.existsSync(source), 'native matching must share the reviewed exact-label policy');
 const runner = path.join(folder,'MatchingTest.kt');
 fs.writeFileSync(runner,'package app.freed.protection\nfun main() {\n'+cases.map(([observed,expected,want])=>`check(FreedPhotoTargetMatching.matches(${JSON.stringify(observed)}, ${JSON.stringify(expected)}) == ${want})`).join('\n')+'\nprintln("Kotlin photo matching passed")\n}\n');
 const jar=path.join(folder,'matching.jar');execFileSync('kotlinc',[source,runner,'-include-runtime','-d',jar],{timeout:60000});
 assert.match(execFileSync('java',['-jar',jar],{encoding:'utf8',timeout:10000}),/Kotlin photo matching passed/);
});
