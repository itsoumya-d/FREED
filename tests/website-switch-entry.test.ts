import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Execute the actual root switch handler; native prompt execution is separately
// exercised through ProtectionFeatureSetup in the component suite.
const source = readFileSync('src/features/freed-app.tsx', 'utf8');
const start = source.indexOf('  const requestWebsiteProtectionChange =');
const end = source.indexOf('\n  const ', start + 1);
assert.ok(start >= 0 && end > start, 'actual root handler exists');
const script = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
function fixture(scope: string | null, running = false) {
  const events: unknown[] = [];
  const adultToggleRunning = { current: running }, adultToggleRequest = { current: 40 };
  const run = new Function('adultToggleRunning', 'adultToggleRequest', 'getProtectionActionScope',
    'setWebsiteActivationRequest', 'setProtectionIntent', 'setScreen',
    `${script}\nreturn requestWebsiteProtectionChange;`)(
    adultToggleRunning, adultToggleRequest, () => scope,
    (value: unknown) => events.push(['request', value]),
    (value: unknown) => events.push(['intent', value]),
    (value: unknown) => events.push(['screen', value]),
  );
  return { run, events, counter: adultToggleRequest };
}
const current = fixture('current-owner-scope');
current.run(true);
assert.deepEqual(current.events, [
  ['request', { id: 41, scope: 'current-owner-scope' }],
  ['intent', 'websites'], ['screen', 'protectionSetup'],
]);
assert.equal(current.counter.current, 41);
const unavailable = fixture(null);
unavailable.run(true);
assert.deepEqual(unavailable.events, [
  ['request', null], ['intent', 'websites'], ['screen', 'protectionSetup'],
]);
assert.equal(unavailable.counter.current, 40);
const competing = fixture('current-owner-scope', true);
competing.run(true);
assert.deepEqual(competing.events, []);
assert.equal(competing.counter.current, 40);
console.log('PASS actual website switch entry: current, unavailable and competing operation');
