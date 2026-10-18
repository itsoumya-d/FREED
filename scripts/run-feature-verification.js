#!/usr/bin/env node
// One child process at a time, with bounded execution and artifact-backed status.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { LEDGER_PATH, buildManifest, summarize, evaluateRequirement, parseArgs, countTestResults, validateIsolation } = require('./lib/feature-test-manifest');
const { assertSafeReportPath } = require('./lib/report-path-safety');
const { sanitizeLocalHomePaths } = require('./lib/local-path-privacy');

const WORKSPACE = path.resolve(__dirname, '..');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function redactLog(output) {
  return sanitizeLocalHomePaths(output).replace(/(?:Bearer\s+)[A-Za-z0-9._-]+/gi, 'Bearer [redacted]').replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, '[redacted]').replace(/((?:password|passphrase|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]');
}

async function runCommand(command, args, options) {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  let output = '', timedOut = false;
  const child = spawn(command, args, { cwd: options.cwd || WORKSPACE, env: { ...process.env, CI: '1', FORCE_COLOR: '0', NODE_OPTIONS: '--max-old-space-size=512', ESBUILD_WORKER_THREADS: '0', FREED_CORE_COLLECT_FAILURES: '1', ...options.env }, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  const append = chunk => { output += chunk.toString(); if (output.length > 4_000_000) output = output.slice(-4_000_000); };
  child.stdout.on('data', append); child.stderr.on('data', append);
  const timer = setTimeout(() => {
    timedOut = true;
    try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch {}
    const forceTimer = setTimeout(() => { try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} }, 1500);
    forceTimer.unref();
  }, options.timeoutMs);
  let error = null;
  const code = await new Promise(resolve => { child.on('error', err => { error = err.message; resolve(null); }); child.on('close', value => resolve(value)); });
  clearTimeout(timer);
  const cleaned = redactLog(output + (error ? `\n${error}\n` : ''));
  fs.mkdirSync(path.dirname(options.logPath), { recursive: true });
  fs.writeFileSync(options.logPath, cleaned);
  const counts = countTestResults(output);
  const status = timedOut || error || code !== 0 || counts.failed > 0 ? 'failed' : counts.skipped > 0 ? 'blocked' : 'passed';
  return { status, exitCode: code, timedOut, startedAt, durationMs: Date.now() - start, counts, log: path.relative(WORKSPACE, options.logPath), logSha256: sha256(cleaned), command: [path.basename(command), ...args.map(argument => sanitizeLocalHomePaths(String(argument)))], ...(error ? { reason: redactLog(error) } : {}) };
}

function listLocalTests() {
  const walk = directory => fs.readdirSync(path.join(WORKSPACE, directory), { withFileTypes: true }).flatMap(entry => {
    const relative = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(relative) : entry.isFile() && /\.test\.(?:tsx?|js|mjs)$/.test(entry.name) ? [relative] : [];
  });
  return walk('tests').sort();
}

function localSuiteCommand(suite) {
  if (suite.endsWith('.tsx')) return ['node_modules/jest/bin/jest.js', '--runInBand', '--watch=false', '--runTestsByPath', suite];
  return suite.endsWith('.ts') ? ['scripts/run-ts-entry.js', suite] : ['--test', '--test-concurrency=1', suite];
}

function prepareEmulatorStartup(functionsDirectory = path.join(WORKSPACE, 'functions')) {
  const projectId = 'demo-freed-feature-verification';
  const topic = 'freed-feature-verification-google-play-subscriptions';
  const filename = path.join(functionsDirectory, `.env.${projectId}`);
  // Firebase CLI 14 prompts for unresolved defineString defaults during
  // emulator discovery, even with --non-interactive. Supply only this public
  // demo parameter; never modify .env.local or manufacture store/API secrets.
  try {
    fs.writeFileSync(filename, `# Public parameter for the disposable Firebase demo project only.\nGOOGLE_PLAY_SUBSCRIPTION_TOPIC=${topic}\n`, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const topicLines = fs.readFileSync(filename, 'utf8').split(/\r?\n/).filter(line => /^\s*GOOGLE_PLAY_SUBSCRIPTION_TOPIC\s*=/.test(line));
  if (topicLines.length !== 1 || topicLines[0].trim() !== `GOOGLE_PLAY_SUBSCRIPTION_TOPIC=${topic}`) {
    throw new Error(`The existing public demo parameter file .env.${projectId} must supply exactly one GOOGLE_PLAY_SUBSCRIPTION_TOPIC=${topic}; it was preserved without changes.`);
  }
  return {
    command: path.join(functionsDirectory, 'node_modules/.bin/firebase'),
    args: ['emulators:exec', '--project', projectId, '--non-interactive', '--config', '../firebase.json', '--only', 'auth,firestore,storage,functions', 'node --test --test-concurrency=1 lib/**/*.test.js'],
    cwd: functionsDirectory,
    env: { JAVA_TOOL_OPTIONS: '-Xmx384m', GCLOUD_PROJECT: projectId, GOOGLE_CLOUD_PROJECT: projectId },
  };
}

function loadEvidence(filename) {
  if (!filename) return [];
  const absolute = path.resolve(WORKSPACE, filename);
  const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (parsed.schemaVersion !== 'freed-feature-execution-receipts-v1' || parsed.sanitized !== true || !Array.isArray(parsed.receipts)) throw new Error('Evidence must use freed-feature-execution-receipts-v1, sanitized: true and an array of receipts.');
  const ids = new Set();
  return parsed.receipts.map(receipt => {
    if (ids.has(receipt.requirementId)) throw new Error(`Duplicate execution receipt ${receipt.requirementId}`);
    ids.add(receipt.requirementId);
    return { receipt, baseDirectory: path.dirname(absolute) };
  });
}

function printHelp() {
  console.log(`FREED feature verification (99 baseline ledger rows plus premium catalog)\n\nnode scripts/run-feature-verification.js --mode local\nnode scripts/run-feature-verification.js --mode all --plan\nnode scripts/run-feature-verification.js --mode ios --feature feature-048 --run-ui --device ISOLATED_ID --isolation fixture.json\nnode scripts/run-feature-verification.js --mode device --evidence receipts.json --build-sha256 SHA256\n\nModes: local, emulator, ios, android, live, device, all, list\n--feature feature-NNN   Select one exact baseline or appended feature\n--catalog baseline|premium  Select original ledger or appended premium obligations\n--flow FLOW_NAME        Select one catalogued UI smoke flow\n--run-ui                Explicitly execute native UI on bound disposable fixture\n--evidence FILE         Validate full scenario receipts and artifact hashes\n--build-sha256 SHA256   Reject receipts from a different installed binary\n--report FILE           JSON under docs/validation/artifacts/<run-id>/\n--timeout-ms N          Per child timeout (1000..1800000; default 180000)\n--plan                  Generate requirements without executing any test/device/service\n--allow-incomplete      Return 0 for blocked/not-run only; failures still exit 1\n\nExit codes: 0 requested checks passed, 1 failed checks, 2 blocked/not-run checks.\nNo live email, message, purchase, production backend write or device reset is performed.`);
}

async function main(argv = process.argv.slice(2)) {
  process.chdir(WORKSPACE);
  const options = parseArgs(argv);
  if (options.help) { printHelp(); return 0; }
  const ledgerData = fs.readFileSync(path.join(WORKSPACE, LEDGER_PATH));
  const manifest = buildManifest(JSON.parse(ledgerData));
  let features = manifest.features;
  if (options.catalog) features = features.filter(feature => options.catalog === 'premium' ? feature.catalog === 'premium-verification' : !feature.catalog);
  if (options.feature) { features = features.filter(feature => feature.id === options.feature); if (!features.length) throw new Error(`Feature ${options.feature} is absent from the selected catalog.`); }
  if (options.flow) { features = features.filter(feature => feature.flow === options.flow); if (!features.length) throw new Error(`No feature maps to flow ${options.flow}.`); }
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultReport = `docs/validation/artifacts/2026-10-02-feature-coverage/${runId}/${options.mode}.json`;
  const reportPath = path.resolve(assertSafeReportPath(options.report || defaultReport));
  const artifactDirectory = path.dirname(reportPath);
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const context = { suites: {}, flows: {}, receipts: loadEvidence(options.evidence), expected: { appBuildSha256: options.appBuildSha256 } };
  const discoveredTests = listLocalTests();
  const missingSuites = [...new Set(features.flatMap(feature => feature.suites))].filter(suite => !fs.existsSync(path.join(WORKSPACE, suite)));
  if (missingSuites.length) throw new Error(`Mapped test files missing: ${missingSuites.join(', ')}`);
  const flowNames = [...new Set(features.map(feature => feature.flow).filter(Boolean))];
  const missingFlows = flowNames.filter(flow => !fs.existsSync(path.join(WORKSPACE, `.maestro/flows/${flow}.yaml`)));
  if (missingFlows.length && options.mode !== 'local') throw new Error(`Mapped UI flows missing: ${missingFlows.join(', ')}`);
  if (options.mode === 'list') {
    fs.writeFileSync(reportPath, JSON.stringify({ ...manifest, ledgerSha256: sha256(ledgerData), features, discoveredTests }, null, 2) + '\n');
    console.log(`Catalog: ${features.length} features, ${features.reduce((n, f) => n + f.scenarios.length, 0)} scenarios, ${discoveredTests.length} local test files.\n${path.relative(WORKSPACE, reportPath)}`);
    return 0;
  }

  if (!options.plan && ['local', 'all'].includes(options.mode)) {
    const tests = options.feature || options.flow || options.catalog ? [...new Set(features.flatMap(feature => feature.suites))].sort() : discoveredTests;
    for (let index = 0; index < tests.length; index++) {
      const suite = tests[index];
      console.log(`[${index + 1}/${tests.length}] ${suite}`);
      const args = localSuiteCommand(suite);
      context.suites[suite] = await runCommand(process.execPath, args, { timeoutMs: options.timeoutMs, logPath: path.join(artifactDirectory, 'logs', `${path.basename(suite)}.log`) });
      console.log(`${context.suites[suite].status}: ${suite}`);
    }
  }
  if (!options.plan && options.mode === 'emulator') {
    const build = await runCommand('npm', ['--prefix', 'functions', 'run', 'build'], { timeoutMs: options.timeoutMs, logPath: path.join(artifactDirectory, 'logs', 'functions-build.log') });
    if (build.status !== 'passed') context.suites['functions:emulator'] = build;
    else {
      // A demo project ID prevents accidentally falling through to live services.
      const startup = prepareEmulatorStartup();
      context.suites['functions:emulator'] = await runCommand(startup.command, startup.args, { cwd: startup.cwd, timeoutMs: Math.max(options.timeoutMs, 300000), env: startup.env, logPath: path.join(artifactDirectory, 'logs', 'functions-emulator.log') });
    }
  }
  if (!options.plan && options.runUi) {
    const fixture = JSON.parse(fs.readFileSync(path.resolve(WORKSPACE, options.isolation), 'utf8'));
    const isolation = validateIsolation(fixture, options);
    if (!isolation.valid) throw new Error(isolation.reason);
    const maestroCandidates = [process.env.FREED_MAESTRO_BIN, path.join(os.homedir(), '.maestro/bin/maestro'), '/opt/homebrew/bin/maestro'].filter(Boolean);
    const maestro = maestroCandidates.find(candidate => fs.existsSync(candidate)) || 'maestro';
    for (const flow of flowNames) {
      const flowPath = `.maestro/flows/${flow}.yaml`;
      const flowText = fs.readFileSync(flowPath, 'utf8');
      if (/clearState|clearKeychain|eraseDevice/.test(flowText)) throw new Error(`Flow ${flow} violates the no-reset fixture contract.`);
      // Side-effecting provider/store flows require fixture-specific receipts and
      // are intentionally never launched by the generic no-communication runner.
      if (/external-service/.test(flowText) && fixture.services === 'disabled') { context.flows[flow] = { status: 'blocked', reason: 'Flow needs isolated emulator/sandbox services; disabled fixture cannot execute it.' }; continue; }
      if (/auth-emulator/.test(flowText) && fixture.services !== 'emulator') { context.flows[flow] = { status: 'blocked', reason: 'Account creation and verification flow requires the isolated Auth emulator; no real email delivery is authorized by this runner.' }; continue; }
      console.log(`UI smoke ${flow} on explicit disposable ${options.mode} fixture.`);
      context.flows[flow] = await runCommand(maestro, ['--device', options.device, 'test', '--format', 'junit', '--output', path.join(artifactDirectory, `${flow}.xml`), '--test-output-dir', path.join(artifactDirectory, 'maestro', flow), '-e', 'APP_ID=app.freed.recovery', flowPath], { timeoutMs: Math.max(options.timeoutMs, 180000), env: { JAVA_TOOL_OPTIONS: '-Xmx384m', MAESTRO_CLI_NO_ANALYTICS: 'true', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true' }, logPath: path.join(artifactDirectory, 'logs', `${flow}.log`) });
    }
  }
  const results = features.map(feature => {
    const required = feature.requirements.map(requirement => {
      const selected = options.mode === 'all' || requirement.mode === options.mode;
      const evidence = selected && !options.plan ? evaluateRequirement(requirement, context) : { status: 'not-run', reason: options.plan ? 'Plan only; no execution performed.' : `Not selected by ${options.mode} mode.` };
      return { ...requirement, selected, ...evidence };
    });
    const selected = required.filter(requirement => requirement.selected);
    const allStatus = required.some(r => r.status === 'failed') ? 'failed' : required.every(r => r.status === 'passed') ? 'passed' : required.some(r => r.status === 'blocked') ? 'blocked' : 'not-run';
    return { ...feature, requirements: required, requestedSummary: summarize(selected), status: allStatus };
  });
  const requested = results.flatMap(feature => feature.requirements.filter(requirement => requirement.selected));
  const overall = results.flatMap(feature => feature.requirements);
  const report = { schemaVersion: 'freed-feature-verification-report-v1', generatedAt: new Date().toISOString(), sanitized: true, mode: options.mode, catalog: options.catalog || 'all', planOnly: options.plan, ledgerPath: LEDGER_PATH, baselineFeatureCount: manifest.baselineFeatureCount, additionalFeatureCount: manifest.additionalFeatureCount, ledgerSha256: sha256(ledgerData), installedBuildSha256: options.appBuildSha256, meaning: manifest.coverageMeaning, requestedSummary: summarize(requested), allRequiredChecks: summarize(overall), fullFeatureSummary: summarize(results), testSuiteSummary: summarize(Object.values(context.suites)), localTestCounts: Object.values(context.suites).reduce((total, result) => ({ passed: total.passed + result.counts.passed, failed: total.failed + result.counts.failed, skipped: total.skipped + result.counts.skipped }), { passed: 0, failed: 0, skipped: 0 }), suites: context.suites, uiSmoke: context.flows, features: results };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  const markdown = `# FREED feature verification\n\nGenerated: ${report.generatedAt}. Mode: ${options.mode}${options.plan ? ' (plan only)' : ''}.\n\nRequested checks: ${report.requestedSummary.passed}/${report.requestedSummary.total} passed; ${report.requestedSummary.failed} failed; ${report.requestedSummary.blocked} blocked; ${report.requestedSummary.notRun} not run. Full features: ${report.fullFeatureSummary.passed}/${report.fullFeatureSummary.total}.\n\n${manifest.coverageMeaning}\n\n| ID | Feature | Overall | Requested passed/total | Next verification |\n|---|---|---|---|---|\n${results.map(feature => `| ${feature.id} | ${feature.feature.replace(/\|/g, '/')} | ${feature.status} | ${feature.requestedSummary.passed}/${feature.requestedSummary.total} | ${feature.nextVerification.replace(/\|/g, '/')} |`).join('\n')}\n`;
  fs.writeFileSync(reportPath.replace(/\.json$/, '.md'), markdown);
  console.log(`Requested checks: ${report.requestedSummary.passed}/${report.requestedSummary.total} passed; ${report.requestedSummary.failed} failed; ${report.requestedSummary.blocked} blocked; ${report.requestedSummary.notRun} not run.\nFull feature coverage: ${report.fullFeatureSummary.passed}/${report.fullFeatureSummary.total}.\n${path.relative(WORKSPACE, reportPath)}`);
  if (options.plan) return 0;
  if (report.requestedSummary.failed > 0 || report.testSuiteSummary.failed > 0) return 1;
  return report.requestedSummary.complete && report.testSuiteSummary.blocked === 0 || options.allowIncomplete ? 0 : 2;
}

if (require.main === module) main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { main, runCommand, listLocalTests, localSuiteCommand, prepareEmulatorStartup, loadEvidence, redactLog };
