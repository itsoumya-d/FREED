import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureNativeMonetizationBuild, getMonetizationConfig } from '../src/lib/monetization';

test('native Debug permits explicit mock purchases with optimized JS; native Release forbids them', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    configureNativeMonetizationBuild(true);
    assert.equal(getMonetizationConfig({ mode: 'mock', platform: 'ios' }).mode, 'mock');
    assert.equal(getMonetizationConfig({ mode: 'native', platform: 'ios' }).mode, 'native');
    configureNativeMonetizationBuild(false);
    assert.equal(getMonetizationConfig({ mode: 'mock', platform: 'ios' }).mode, 'native');
    configureNativeMonetizationBuild(null);
    assert.equal(getMonetizationConfig({ mode: 'mock', platform: 'ios' }).mode, 'native');
  } finally {
    configureNativeMonetizationBuild(null);
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

test('native fixture routing and root registration use the native iOS Debug signal', () => {
  const firebase = readFileSync('src/lib/firebase-native.ts', 'utf8');
  const root = readFileSync('app/_layout.tsx', 'utf8');
  const app = readFileSync('src/features/freed-app.tsx', 'utf8');
  assert.match(firebase, /Constants\.debugMode/);
  assert.match(root, /configureNativeMonetizationBuild\(Constants\.debugMode === true\)/);
  assert.doesNotMatch(firebase, /const auth = getAuth\(app\)/);
  assert.doesNotMatch(app, /__DEV__ && getMonetizationConfig\([^;]+legacyPremium/);
  assert.match(app, /getMonetizationConfig\(\{ platform: getRuntimeMonetizationPlatform\(\) \}\)\.mode === "mock" && legacyPremium/);
});
