const assert = require('node:assert/strict');
const { test } = require('node:test');
const { collectExportedFunctionSources } = require('../scripts/lib/firebase-function-source');

function surface(files) {
  return collectExportedFunctionSources('/fixture', 'functions/src/index.ts', file => {
    const value = files[file];
    if (value === undefined) throw new Error(`Missing fixture module ${file}`);
    return value;
  });
}

test('star and nested named re-exports retain actual handler origin and alias', () => {
  const result = surface({
    'functions/src/index.ts': 'export * from "./foundation.js"; export { generated as publicGenerated } from "./ai.js";',
    'functions/src/foundation.ts': 'export { readiness } from "./health.js";',
    'functions/src/health.ts': 'export const readiness = onCall({}, () => {});',
    'functions/src/ai.ts': 'export const generated = onCall({}, () => {}); export const privateExtra = onCall({}, () => {});',
  });
  assert.deepEqual(result.exports.map(x => [x.exportName, x.localName, x.path]).sort(), [
    ['publicGenerated', 'generated', 'functions/src/ai.ts'], ['readiness', 'readiness', 'functions/src/health.ts'],
  ]);
  assert.equal(result.modules.length, 4);
});

test('local exports and imported value re-exports resolve without executing Firebase initialization', () => {
  const result = surface({
    'functions/src/index.ts': 'import { request as forwarded } from "./health.js"; export { forwarded as health };',
    'functions/src/health.ts': 'const request = onCall({}, () => {}); export { request };',
  });
  assert.deepEqual(result.exports.map(x => [x.exportName, x.localName, x.path]), [['health', 'request', 'functions/src/health.ts']]);
});

test('cyclic star exports retain reachable handlers without duplication or recursion', () => {
  const result = surface({
    'functions/src/index.ts': 'export * from "./foundation.js";',
    'functions/src/foundation.ts': 'export * from "./index.js"; export const readiness = onCall({}, () => {});',
  });
  assert.deepEqual(result.exports.map(x => x.exportName), ['readiness']);
});

test('missing named re-export fails instead of silently omitting a deployment endpoint', () => {
  assert.throws(() => surface({ 'functions/src/index.ts': 'export { readiness } from "./foundation.js";', 'functions/src/foundation.ts': 'export const another = 1;' }), /missing.*readiness|readiness.*missing/i);
});

test('type-only and commented exports never produce runtime endpoint coverage', () => {
  const result = surface({ 'functions/src/index.ts': 'export type { Contract } from "./missing.js"; /* export * from "./fake.js"; */ const text = "export * from fake"; export const actual = 1;' });
  assert.deepEqual(result.exports.map(x => x.exportName), ['actual']);
  assert.equal(result.modules.length, 1);
});

test('export traversal rejects paths outside the Functions source boundary and ambiguous names', () => {
  assert.throws(() => surface({ 'functions/src/index.ts': 'export * from "../../private.js";' }), /boundary|outside/i);
  assert.throws(() => surface({ 'functions/src/index.ts': 'export * from "./a.js"; export * from "./b.js";', 'functions/src/a.ts': 'export const same = 1;', 'functions/src/b.ts': 'export const same = 2;' }), /ambiguous.*same/i);
});
