'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const sourceInputs = [
  'src/data/challenge-templates.ts', 'src/lib/recovery-engine.ts',
  'src/lib/monetization.ts', 'src/lib/native-monetization-adapter.ts',
  'src/features/legal-pages.tsx', 'src/features/freed-app.tsx',
  'functions/src/aggregate-analytics.ts', 'functions/src/clara-quota.ts',
  'website/build-legal-pages.js', 'src/i18n/batches/current-app-truthful-copy-20261005.json',
  ...['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'].map(locale => `src/i18n/locales/${locale}.json`)
];

async function runIsolatedArtifact(t, forcedBreathing = false) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-copy-portability-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const relative of sourceInputs) {
    const destination = path.join(directory, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, relative), destination);
  }
  const fixture = 'tests/fixtures/current-app-copy-baseline.json';
  if (fs.existsSync(path.join(root, fixture))) {
    const destination = path.join(directory, fixture);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(root, fixture), destination);
  }
  const plugins = forcedBreathing ? [{
    name: 'unsafe-wim-hof-test-only-mutation',
    setup(build) {
      build.onLoad({ filter: /src\/data\/challenge-templates\.ts$/ }, args => {
        const contents = fs.readFileSync(args.path, 'utf8');
        const start = contents.indexOf('prefix: "Wim Hof rounds"');
        const end = contents.indexOf('prefix: "Resonant 6-breath"', start);
        assert.ok(start >= 0 && end > start);
        const safe = '"Sit comfortably and breathe at your natural pace."';
        const block = contents.slice(start, end);
        assert.ok(block.includes(safe));
        return { contents: contents.slice(0, start) + block.replace(safe, '"Take 30 full breaths in and out."') + contents.slice(end), loader: 'ts' };
      });
    }
  }] : [];
  // Bundle in memory; the mutation affects only this disposable test artifact.
  const result = await build({
    entryPoints: [path.join(root, 'tests/current-app-copy.test.ts')], bundle: true,
    platform: 'node', format: 'cjs', target: 'node20', write: false, logLevel: 'silent',
    external: ['expo', 'expo-*', 'react-native', 'react-native-*'], plugins
  });
  const artifact = path.join(directory, 'current-app-copy.cjs');
  fs.writeFileSync(artifact, result.outputFiles[0].text);
  assert.equal(fs.existsSync(path.join(directory, '.superpowers')), false);
  const run = spawnSync(process.execPath, [artifact], { cwd: directory, encoding: 'utf8', timeout: 30_000 });
  assert.ifError(run.error);
  return run;
}

test('the complete copy regression runs in a source-only artifact without private task receipts', async t => {
  const run = await runIsolatedArtifact(t);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /pass 10/);
  assert.match(run.stdout, /fail 0/);
});

test('the comfort regression rejects forced breaths in the renamed stable-ID Wim Hof entry', async t => {
  const run = await runIsolatedArtifact(t, true);
  assert.notEqual(run.status, 0, 'Forced breathing must fail the real comfort regression');
  assert.match(run.stdout + run.stderr, /legacy breathing choices give permission to skip holds and switch comfortably/);
  assert.match(run.stdout + run.stderr, /wim-hof-rounds--base/);
  assert.doesNotMatch(run.stdout + run.stderr, /ENOENT/);
});
