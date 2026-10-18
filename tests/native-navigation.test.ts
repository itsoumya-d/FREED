import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFreedRoute, planFreedNavigation, makeFreedRootReset, findFreedNavigatorState } from '../src/lib/native-navigation';

test('native tab destinations retain their own route identity', () => {
  for (const tab of ['today', 'shield', 'progress', 'profile'] as const) {
    assert.deepEqual(parseFreedRoute(`/${tab}`), { screen: 'main', tab });
  }
});
test('library detail belongs to the Today stack and back returns to its list', () => {
  assert.deepEqual(parseFreedRoute('/today/article'), { screen: 'article', tab: 'today' });
  assert.deepEqual(planFreedNavigation('/today/article', 'library', 'today'), { action: 'back', path: '/today/library' });
});
test('finished exercises reset to tabs without a back path into completed exercise', () => {
  assert.deepEqual(planFreedNavigation('/flow/challenge', 'main', 'shield'), { action: 'reset', path: '/shield' });
});
test('recovery steps update one modal while cross-presentation tools retain replacement', () => {
  // The approved flow is unchanged; replacing these same-modal steps changed
  // native route identity and introduced a dismiss/re-present boundary.
  assert.equal(planFreedNavigation('/flow/intercept', 'ad', 'today').action, 'setParams');
  assert.equal(planFreedNavigation('/flow/ad', 'challenge', 'today').action, 'setParams');
  assert.equal(planFreedNavigation('/flow/challenge', 'coach', 'today').action, 'replace');
});
test('same-modal delivery is bounded to the three recovery destinations', () => {
  for (const current of ['intercept', 'ad', 'challenge'] as const) {
    for (const next of ['intercept', 'ad', 'challenge'] as const) {
      assert.equal(planFreedNavigation(`/flow/${current}`, next, 'today').action, current === next ? 'none' : 'setParams');
    }
  }
  for (const screen of ['breathing', 'paywall', 'account', 'journal', 'features', 'coach'] as const) {
    assert.notEqual(planFreedNavigation(`/flow/${screen}`, 'ad', 'today').action, 'setParams');
    assert.notEqual(planFreedNavigation('/flow/ad', screen, 'today').action, 'setParams');
  }
});
test('checkout opens above tabs and onboarding progress has no obsolete back entries', () => {
  assert.deepEqual(planFreedNavigation('/profile', 'paywall', 'profile'), { action: 'push', path: '/flow/paywall' });
  assert.equal(planFreedNavigation('/onboarding/quiz', 'planCalculation', 'today').action, 'replace');
  assert.equal(planFreedNavigation('/onboarding/appSelection', 'paywall', 'today').action, 'replace');
});
test('unknown paths cannot open an arbitrary feature or grant authority', () => {
  assert.deepEqual(parseFreedRoute('/flow/not-a-screen'), { screen: 'splash', tab: null });
  assert.deepEqual(parseFreedRoute('/auth/reset'), { screen: 'splash', tab: null });
  assert.deepEqual(planFreedNavigation('/profile', 'main', 'profile'), { action: 'none', path: '/profile' });
});
test('only exact public auxiliary roots classify separately from journey startup', () => {
  for (const auxiliaryRoute of ['preferences', 'privacy', 'support', 'account-deletion']) {
    assert.deepEqual(parseFreedRoute(`/${auxiliaryRoute}`), { screen: 'splash', tab: null, auxiliaryRoute });
  }
  for (const path of ['/preferences/private', '/flow/preferences', '/privacy-extra', '/auth/reset', '/unknown']) {
    assert.deepEqual(parseFreedRoute(path), { screen: 'splash', tab: null });
  }
});
test('return to tabs removes obsolete onboarding and exercise entries while keeping tab state', () => {
  const root = { key: 'root', index: 2, routes: [{ name: 'index' }, { name: '(tabs)', key: 'tabs-once', state: { index: 0, routes: [{ name: 'today', key: 'today-once', state: { index: 1, routes: [{ name: 'index', key: 'home-once' }, { name: 'library' }] } }, { name: 'shield' }, { name: 'progress' }, { name: 'profile' }] } }, { name: 'flow/[destination]', params: { destination: 'challenge' } }] };
  const next = makeFreedRootReset(root, 'main', 'today');
  assert.equal(next.routes.length, 1);
  assert.equal(next.routes[0].key, 'tabs-once');
  assert.equal(next.routes[0].state!.routes[0].key, 'today-once');
  assert.equal(next.routes[0].state!.routes[0].state!.routes.length, 1);
  assert.equal(next.routes[0].state!.routes[0].state!.routes[0].key, 'home-once');
});
test('resetting local history creates a one-way onboarding root with no old tabs', () => {
  assert.equal(planFreedNavigation('/profile', 'welcome', 'today').action, 'reset');
  const next = makeFreedRootReset({ index: 0, routes: [{ name: '(tabs)' }] }, 'welcome', 'today');
  assert.deepEqual(next.routes, [{ name: 'onboarding/[destination]', params: { destination: 'welcome' } }]);
});
test('terminal reset targets the app stack underneath Expo’s internal root wrapper', () => {
  const app = { key: 'app-stack', index: 0, routeNames: ['index', '(tabs)', 'flow/[destination]'], routes: [{ name: 'index' }] };
  const outer = { key: 'internal-stack', index: 0, routeNames: ['__root', '_sitemap'], routes: [{ name: '__root', state: app }] };
  assert.equal(findFreedNavigatorState(outer)?.key, 'app-stack');
  assert.equal(findFreedNavigatorState({ index: 0, routes: [{ name: '__root' }] }), null);
});
