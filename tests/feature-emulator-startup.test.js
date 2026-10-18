const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const runner = require('../scripts/run-feature-verification');
const { loadUserEnvs } = require('../functions/node_modules/firebase-tools/lib/functions/env');
const { resolveParams } = require('../functions/node_modules/firebase-tools/lib/deploy/functions/params');

const projectId = 'demo-freed-feature-verification';
const filename = `.env.${projectId}`;
const topic = 'freed-feature-verification-google-play-subscriptions';

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-emulator-startup-'));
  return Promise.resolve().then(() => run(directory)).finally(() => fs.rmSync(directory, { recursive: true, force: true }));
}

test('emulator startup supplies the public parameter to the actual Firebase CLI resolver without prompting', () => fixture(async directory => {
  assert.equal(typeof runner.prepareEmulatorStartup, 'function', 'startup must preload public demo-project parameters');
  runner.prepareEmulatorStartup(directory);
  const envs = loadUserEnvs({ functionsSource: directory, projectId, isEmulator: true });
  const resolved = await resolveParams([{ name: 'GOOGLE_PLAY_SUBSCRIPTION_TOPIC', type: 'string', default: 'freed-google-play-subscriptions' }], { projectId }, envs, true, true);
  assert.equal(resolved.GOOGLE_PLAY_SUBSCRIPTION_TOPIC, topic);
  assert.deepEqual(Object.keys(envs), ['GOOGLE_PLAY_SUBSCRIPTION_TOPIC']);
  assert.equal(fs.existsSync(path.join(directory, '.env.local')), false);
  assert.equal(fs.existsSync(path.join(directory, '.secret.local')), false);
}));

test('emulator startup binds the demo project and a non-interactive single-worker test command', () => fixture(directory => {
  assert.equal(typeof runner.prepareEmulatorStartup, 'function', 'startup must bind safe CLI arguments');
  const startup = runner.prepareEmulatorStartup(directory);
  assert.equal(startup.cwd, directory);
  assert.deepEqual(startup.args, ['emulators:exec', '--project', projectId, '--non-interactive', '--config', '../firebase.json', '--only', 'auth,firestore,storage,functions', 'node --test --test-concurrency=1 lib/**/*.test.js']);
  assert.equal(startup.env.GCLOUD_PROJECT, projectId);
  assert.equal(startup.env.GOOGLE_CLOUD_PROJECT, projectId);
  assert.equal(startup.env.JAVA_TOOL_OPTIONS, '-Xmx384m');
}));

test('emulator startup preserves an existing public fixture and owner environment and secret files', () => fixture(directory => {
  assert.equal(typeof runner.prepareEmulatorStartup, 'function', 'startup must preserve pre-existing config');
  const publicFixture = `# Existing operator comment\nGOOGLE_PLAY_SUBSCRIPTION_TOPIC=${topic}\n`;
  const files = { [filename]: publicFixture, '.env.local': '# Owner environment\nOWNER_PUBLIC_SETTING=keep\n', '.secret.local': '# Owner secret fixture; no real credentials\n' };
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content);
  runner.prepareEmulatorStartup(directory);
  for (const [name, content] of Object.entries(files)) assert.equal(fs.readFileSync(path.join(directory, name), 'utf8'), content, name);
}));

test('emulator startup fails promptly for an existing missing or ambiguous demo parameter without rewriting it', () => fixture(directory => {
  assert.equal(typeof runner.prepareEmulatorStartup, 'function', 'startup must reject unresolved demo parameters');
  for (const content of ['# Missing public topic\n', 'GOOGLE_PLAY_SUBSCRIPTION_TOPIC=freed-google-play-subscriptions\n', `GOOGLE_PLAY_SUBSCRIPTION_TOPIC=${topic}\nGOOGLE_PLAY_SUBSCRIPTION_TOPIC=another-topic\n`]) {
    fs.writeFileSync(path.join(directory, filename), content);
    assert.throws(() => runner.prepareEmulatorStartup(directory), /public demo.*GOOGLE_PLAY_SUBSCRIPTION_TOPIC/i);
    assert.equal(fs.readFileSync(path.join(directory, filename), 'utf8'), content);
  }
}));
