const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const receiptIndex = process.argv.indexOf('--receipt');
const receiptPath = receiptIndex >= 0 ? process.argv[receiptIndex + 1] : null;
const commands = [];
const hash = file => ({ path: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-suspension-lock-'));
const lockPath = 'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift';
const casesPath = 'modules/freed-protection/tests/SuspensionLockCases.swift';
const production = fs.readFileSync(lockPath, 'utf8');
function run(command, args, expectedStatus = 0) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60_000 });
  commands.push({ command: [command, ...args], expectedStatus, exitCode: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr });
  process.stdout.write(`$ ${command} ${args.join(' ')}\n${result.stdout}${result.stderr}`);
  assert.equal(result.status, expectedStatus, result.error?.message || 'Unexpected exit status');
  return result;
}
try {
  // Mutation restores the pre-repair behavior only at the admission boundary;
  // the actual atomic-file/flock implementation and same cases remain intact.
  const mutant = path.join(workspace, 'NoExecutionAdmission.swift');
  assert.ok(production.includes('let execution = try beginExecution()'));
  fs.writeFileSync(mutant, production.replace('let execution = try beginExecution()', 'let execution: ExecutionLease? = nil'));
  const redBinary = path.join(workspace, 'red');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', mutant, casesPath, '-o', redBinary]);
  const red = run(redBinary, [], 1);
  assert.match(red.stderr, /denied assertion must prevent transaction body/);
  const lateCancellation = path.join(workspace, 'LateCancellation.swift');
  assert.ok(production.includes('completing = true'));
  fs.writeFileSync(lateCancellation, production.replace('completing = true', 'completing = false'));
  const lateBinary = path.join(workspace, 'red-late-cancellation');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', lateCancellation, casesPath, '-o', lateBinary]);
  const lateRed = run(lateBinary, [], 1);
  assert.match(lateRed.stderr, /admitted native success must settle after expiry/);
  const greenBinary = path.join(workspace, 'green');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', lockPath, casesPath, '-o', greenBinary]);
  run(greenBinary, []);
  const sdk = run('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path']).stdout.trim();
  const moduleSource = fs.readFileSync('modules/freed-protection/ios/FreedProtectionModule.swift', 'utf8');
  const start = moduleSource.indexOf('@available(iOSApplicationExtension, unavailable)\nprivate enum FreedProtectionAppExecution');
  assert.ok(start >= 0);
  const end = moduleSource.indexOf('\n#endif', start);
  const appHelper = path.join(workspace, 'AppExecution.swift');
  fs.writeFileSync(appHelper, 'import Foundation\nimport UIKit\n' + moduleSource.slice(start, end));
  const adapterHarness = path.join(workspace, 'AppExecutionAdapterCases.swift');
  fs.writeFileSync(adapterHarness, 'import Foundation\nimport Darwin\n' + moduleSource.slice(start, end) + '\n' + fs.readFileSync('modules/freed-protection/tests/AppExecutionAdapterCases.swift', 'utf8'));
  const adapterBinary = path.join(workspace, 'app-adapter');
  run('xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', lockPath, adapterHarness, '-o', adapterBinary]);
  run(adapterBinary, []);
  run('xcrun', ['swiftc', '-typecheck', '-swift-version', '5', '-sdk', sdk, '-target', 'arm64-apple-ios15.1', lockPath, appHelper]);
  run('xcrun', ['swiftc', '-typecheck', '-swift-version', '5', '-application-extension', '-sdk', sdk, '-target', 'arm64-apple-ios15.1', lockPath]);
  run('xcrun', ['swiftc', '-frontend', '-parse', 'modules/freed-protection/ios/FreedProtectionModule.swift']);
  console.log('PASS: red/green actual lock cases, iOS app helper typecheck, extension-safe shared source typecheck, module parse');
} finally {
  if (receiptPath) {
    const folder = path.dirname(receiptPath);
    fs.mkdirSync(folder, { recursive: true });
    const artifacts = [];
    for (const name of ['red', 'red-late-cancellation', 'green', 'app-adapter', 'NoExecutionAdmission.swift', 'LateCancellation.swift', 'AppExecution.swift', 'AppExecutionAdapterCases.swift']) {
      const file = path.join(workspace, name);
      if (!fs.existsSync(file)) continue;
      const saved = path.join(folder, name);
      fs.copyFileSync(file, saved);
      artifacts.push(hash(saved));
    }
    fs.writeFileSync(receiptPath, JSON.stringify({ physicalProof: false,
      environment: { platform: process.platform, osRelease: os.release(), architecture: process.arch },
      binaryKind: 'unsigned macOS harness, injected UIKit boundary; SDK checks are typechecks only',
      sources: [lockPath, casesPath, 'modules/freed-protection/ios/FreedProtectionModule.swift', 'modules/freed-protection/tests/AppExecutionAdapterCases.swift', __filename].map(hash),
      commands, artifacts }, null, 2) + '\n');
  }
  fs.rmSync(workspace, { recursive: true, force: true });
}
