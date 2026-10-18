#!/usr/bin/env node
// A real Swift/SDK check; deliberately separate from platform-independent Node tests.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { locales, run } = require('./sync-shield-localizations');
if (process.platform !== 'darwin') throw new Error('The native Shield policy check requires macOS and Xcode.');
if (process.argv.length > 2) throw new Error('No arguments are supported.');
run(true);
const filename = path.resolve(__dirname, '../ios/FreedShieldConfiguration/ShieldConfigurationExtension.swift');
const source = fs.readFileSync(filename, 'utf8');
const copy = source.slice(source.indexOf('private enum FreedShieldCopy'), source.indexOf('final class ShieldConfigurationExtension'));
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-shield-locale-'));
try {
  fs.writeFileSync(path.join(folder, 'main.swift'), `import Foundation\n${copy}\n
assert(FreedShieldCopy.language(selected: "ar", preferred: "en-US") == "ar")
assert(FreedShieldCopy.language(selected: nil, preferred: "ko-KR") == "ko")
assert(FreedShieldCopy.language(selected: nil, preferred: "zh-CN") == "zh-Hans")
assert(FreedShieldCopy.language(selected: "system", preferred: "zh-TW") == "en")
assert(FreedShieldCopy.language(selected: nil, preferred: "pt-BR") == "pt")
assert(FreedShieldCopy.language(selected: "unknown", preferred: "zz-ZZ") == "en")
for language in ${JSON.stringify(locales)} {
  for key in ["title", "primary", "secondary", "targetDescription", "categoryDescription"] {
    assert(!(FreedShieldCopy.strings[language]?[key] ?? "").isEmpty)
  }
}
assert(FreedShieldCopy.strings["ar"]?["title"] != FreedShieldCopy.strings["en"]?["title"])
print("PASS native Shield language selection and all ten dictionaries")
`);
  const binary = path.join(folder, 'verify');
  execFileSync('xcrun', ['swiftc', '-swift-version', '5', path.join(folder, 'main.swift'), '-o', binary], { timeout: 60000, stdio: 'inherit' });
  execFileSync(binary, { timeout: 10000, stdio: 'inherit' });
  const sdk = execFileSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], { encoding: 'utf8' }).trim();
  execFileSync('xcrun', ['swiftc', '-swift-version', '5', '-target', 'arm64-apple-ios15.1', '-sdk', sdk, '-typecheck', filename], { timeout: 60000, stdio: 'inherit' });
  console.log('PASS complete Shield UIKit configuration typecheck against installed iPhone SDK');
} finally { fs.rmSync(folder, { recursive: true, force: true }); }
