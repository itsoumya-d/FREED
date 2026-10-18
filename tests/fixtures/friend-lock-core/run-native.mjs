import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const fixture = dirname(fileURLToPath(import.meta.url));
const root = resolve(fixture, '../../..');
if (!process.argv.includes('--compiler-reserved')) {
  process.stderr.write('Native compilation refused: Root must explicitly reserve the sole compiler first.\n');
  process.exit(2);
}
const platform = process.argv.find(value => value.startsWith('--platform='))?.split('=')[1];
assert.ok(platform === 'swift' || platform === 'kotlin', 'Choose exactly one platform per compiler reservation.');
const red = process.argv.includes('--red');
const typesOnly = process.argv.includes('--typecheck-only');
assert.ok(!typesOnly || (platform === 'kotlin' && !red), 'Public type-only mode is Kotlin GREEN only.');
const scratch = mkdtempSync(join(tmpdir(), 'freed-friend-lock-core-'));
const android = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const ios = 'modules/freed-protection/ios/';
const inputs = platform === 'swift' ? [
  `${ios}FreedFriendLockCore.swift`, `${ios}FreedFriendLockRecordStore.swift`, `${ios}FreedFriendLockKeychain.swift`,
  'tests/fixtures/friend-lock-core/FriendLockCoreCases.swift', 'tests/fixtures/friend-lock-core/FriendLockAdapterCases.swift',
] : [
  `${android}FreedFriendLockCore.kt`, `${android}FreedFriendLockRecordStore.kt`, `${android}FreedFriendLockEncryptedRecord.kt`,
  'tests/fixtures/friend-lock-core/FriendLockCoreCases.kt', 'tests/fixtures/friend-lock-core/FriendLockAdapterCases.kt',
];
const copied = inputs.map(path => {
  let text = readFileSync(join(root, path), 'utf8');
  const sourceHash = createHash('sha256').update(text).digest('hex');
  if (red && basename(path) === 'FreedFriendLockCore.swift') {
    const gate = 'guard validFormat, try crypto.derive(input, salt: verifier.salt).friendConstantEquals(verifier.derived) else';
    assert.ok(text.includes(gate)); text = text.replace(gate, 'let _ = verifier; let _ = validFormat\n        guard true else');
  }
  if (red && basename(path) === 'FreedFriendLockCore.kt') {
    const gate = 'if (!valid || !MessageDigest.isEqual(crypto.derive(input, verifier.salt), verifier.derived))';
    assert.ok(text.includes(gate)); text = text.replace(gate, 'if (false)');
  }
  const output = join(scratch, basename(path)); writeFileSync(output, text);
  process.stdout.write(`snapshotFile=${JSON.stringify({ path, sourceHash, compiledHash: createHash('sha256').update(text).digest('hex') })}\n`);
  return output;
});
function run(command, args, expectedFailure = false) {
  process.stdout.write(`command=${JSON.stringify({ command, args })}\n`);
  const started = Date.now();
  const result = spawnSync(command, args, { cwd: scratch, encoding: 'utf8', timeout: 180_000, maxBuffer: 1_048_576 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  process.stdout.write(output);
  process.stdout.write(`${basename(command)} elapsedMilliseconds=${Date.now() - started} exit=${result.status} signal=${result.signal ?? 'none'}\n`);
  if (expectedFailure) {
    assert.notEqual(result.status, 0, 'Wrong-secret semantic baseline must fail.');
    assert.match(output, platform === 'swift' ? /expected-failure/ : /Expected INCORRECT_SECRET/, 'RED must fail at wrong-secret behavior, after successful compilation.');
  } else assert.equal(result.status, 0, result.error?.message ?? output);
}
// Retain temp copies/loggable path for review. Never revert or rewrite the shared live checkout.
process.stdout.write(`fixtureSnapshot=${scratch} mode=${red ? 'semantic-red-mutant' : 'green'} platform=${platform}\n`);
if (platform === 'swift') {
  const binary = join(scratch, 'cases');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', ...copied, '-o', binary]);
  run(binary, [], red);
  if (!red) {
    const sdk = spawnSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], { encoding: 'utf8' });
    assert.equal(sdk.status, 0, sdk.stderr);
    run('xcrun', ['swiftc', '-typecheck', '-swift-version', '5', '-target', 'arm64-apple-ios15.1', '-sdk', sdk.stdout.trim(), ...copied.slice(0, 3)]);
  }
} else {
  if (!typesOnly) {
    const jar = join(scratch, 'cases.jar');
    run('kotlinc', [...copied, '-include-runtime', '-d', jar]); run('java', ['-jar', jar], red);
  }
  if (!red) {
    const sdk = process.env.ANDROID_HOME ?? join(homedir(), 'Library/Android/sdk');
    const publicJar = join(sdk, 'platforms/android-36/android.jar');
    assert.ok(existsSync(publicJar), 'Existing Android 36 public SDK is required; this runner installs nothing.');
    const nativeAdapter = join(scratch, 'FreedFriendLockKeystore.kt');
    writeFileSync(nativeAdapter, readFileSync(join(root, `${android}FreedFriendLockKeystore.kt`), 'utf8'));
    process.stdout.write(`snapshotFile=${JSON.stringify({ path: `${android}FreedFriendLockKeystore.kt`, compiledHash: createHash('sha256').update(readFileSync(nativeAdapter)).digest('hex') })}\n`);
    const types = join(scratch, 'public-framework-types'); mkdirSync(types);
    run('kotlinc', [...copied.slice(0, 3), nativeAdapter, '-classpath', publicJar, '-d', types]);
  }
}
