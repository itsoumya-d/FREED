import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeFreedRootReset, parseFreedRoute, planFreedNavigation } from '../src/lib/native-navigation';
import { resolveFreedSystemPath } from '../src/lib/deep-link-routing';

const sections = ['apps', 'schedules', 'websites', 'focus-shield', 'dns', 'diagnostics'] as const;

test('focused Shield pages remain in the Shield tab instead of restarting onboarding', () => {
  for (const section of sections) {
    assert.deepEqual(parseFreedRoute(`/shield/${section}`), { screen: 'main', tab: 'shield' }, section);
  }
});

test('unknown or malformed Shield detail paths do not open a control surface', () => {
  for (const path of ['/shield/unknown', '/shield/apps/extra', '/shield/%2Fapps', '/shield/../account']) {
    assert.deepEqual(parseFreedRoute(path), { screen: 'splash', tab: null });
    assert.equal(resolveFreedSystemPath(path), '/');
  }
});

test('Shield detail links carry screen navigation only and cannot change protection or account state', () => {
  for (const section of sections) {
    const path = `/shield/${section}`;
    assert.equal(resolveFreedSystemPath(path), path);
    assert.equal(resolveFreedSystemPath(`freed://${path}`), path);
    assert.equal(resolveFreedSystemPath(`freed://${path}?enabled=true&premium=true`), '/');
    assert.equal(resolveFreedSystemPath(`freed://${path}#grant`), '/');
  }
  assert.equal(resolveFreedSystemPath('freed://user@shield/apps'), '/');
  assert.equal(resolveFreedSystemPath('freed:///preferences?source=profile'), '/preferences');
});

test('terminal return from a Shield detail keeps all tab identities and returns to Shield overview', () => {
  assert.deepEqual(planFreedNavigation('/shield/apps', 'main', 'shield'), { action: 'reset', path: '/shield' });
  const root = {
    index: 0, routes: [{ name: '(tabs)', key: 'tabs-owner', state: {
      index: 1, routes: [
        { name: 'today', key: 'today-owner' },
        { name: 'shield', key: 'shield-owner', state: { index: 1, routes: [{ name: 'index', key: 'shield-root' }, { name: '[section]', params: { section: 'apps' } }] } },
        { name: 'progress', key: 'progress-owner' },
        { name: 'profile', key: 'profile-owner' }
      ]
    } }]
  };
  const next = makeFreedRootReset(root, 'main', 'shield');
  assert.equal(next.routes[0].key, 'tabs-owner');
  assert.deepEqual(next.routes[0].state!.routes.map(route => route.key), ['today-owner', 'shield-owner', 'progress-owner', 'profile-owner']);
  assert.deepEqual(next.routes[0].state!.routes[1].state!.routes, [{ name: 'index', key: 'shield-root' }]);
});
