import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the installed SDK's actual pure payload converter. A route planner
// alone cannot detect parameters discarded by Expo before native dispatch.
const filename = require.resolve('expo-router/build/global-state/routing.js');
const sdk = readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, sdk, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const converter = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'getPayloadFromStateRoute');
assert.ok(converter, 'Review the native dispatch contract if the installed SDK changes its converter.');
const convert = runInNewContext(`(${sdk.slice(converter.getStart(parsed), converter.end)})`);
for (const [group, value] of [['onboarding', 'quiz'], ['flow', 'breathing']]) {
  const route = readdirSync(`app/${group}`).find(file => /^\[.+\]\.tsx$/.test(file));
  assert.ok(route);
  const parameter = route.slice(1, route.indexOf(']'));
  const payload = convert({ name: `${group}/${route.slice(0, -4)}`, params: { [parameter]: value } });
  assert.equal(payload.params[parameter], value, `${group} destination must survive real Expo dispatch`);
}
console.log('Installed Expo native dispatch preserves both FREED destinations');
