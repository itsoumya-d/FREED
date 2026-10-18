import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { FREED_PROFILE_SECTIONS, FREED_PUBLIC_AUXILIARY_ROUTES, parseFreedProfileSection, freedProfileSectionPath, parseFreedRoute, planFreedNavigation } from '../src/lib/native-navigation';
import { resolveFreedSystemPath } from '../src/lib/deep-link-routing';
import { guardJourneyRoute } from '../src/lib/user-journey';

test('only exact private Profile sections pass the native cold-link resolver and route parser', () => {
  for (const section of FREED_PROFILE_SECTIONS) {
    const path = freedProfileSectionPath(section);
    assert.deepEqual(parseFreedRoute(path), { screen: 'main', tab: 'profile', profileSection: section });
    for (const link of [path, `freed://${path}`, `app.freed.recovery://${path}`]) assert.equal(resolveFreedSystemPath(link), path);
    for (const suffix of ['?owner=other&premium=true', '#grant', '/extra']) assert.equal(resolveFreedSystemPath(`${path}${suffix}`), '/');
  }
  assert.deepEqual(FREED_PUBLIC_AUXILIARY_ROUTES, ['preferences', 'privacy', 'support', 'account-deletion']);
});

test('unknown, arrays, traversal and case variants cannot select a private Profile control', () => {
  for (const value of [undefined, null, ['account'], ['settings', 'account'], 'Account', '../account', '%2Faccount', 'unknown', '']) assert.equal(parseFreedProfileSection(value), null);
  for (const path of ['/profile/unknown', '/profile/account/extra', '/profile/%2Faccount', '/profile/../account', 'freed://user@profile/account']) assert.equal(resolveFreedSystemPath(path), '/');
});

test('every cold private section stays behind the mandatory account and existing membership journey guards', () => {
  for (const section of FREED_PROFILE_SECTIONS) {
    const route = parseFreedRoute(freedProfileSectionPath(section));
    const policy = { auth: {status:'ready' as const, signedIn:false, anonymous:false, ownerUid:null, email:null}, journey:{entry:'existing' as const, introCompletedAt:null}, offerAcknowledged:true, verifiedPremium:false };
    assert.equal(guardJourneyRoute(route.screen, policy), 'account');
    assert.equal(guardJourneyRoute(route.screen, {...policy, auth:{...policy.auth,signedIn:true,anonymous:true,ownerUid:'legacy-guest'}}), 'account');
    const signedIn = {...policy, auth:{...policy.auth,signedIn:true,ownerUid:'owner'}};
    assert.equal(guardJourneyRoute(route.screen, signedIn), 'main');
    assert.equal(guardJourneyRoute(route.screen, signedIn, true), 'account');
    assert.equal(guardJourneyRoute(route.screen, {...signedIn, offerAcknowledged:false}), 'paywall');
  }
});

test('native Profile owns Back and a cold stack anchor; ordinary terminal root navigation remains unchanged', () => {
  const layout = readFileSync('app/(tabs)/profile/_layout.tsx','utf8');
  assert.match(layout, /initialRouteName: 'index'/);
  assert.match(layout, /headerBackButtonDisplayMode: 'minimal'/);
  assert.match(layout, /headerRight: \(\) => <RootToolbarActions/);
  assert.match(layout, /name="\[section\]"/);
  assert.deepEqual(planFreedNavigation('/profile/account','main','profile'), {action:'reset',path:'/profile'});
});
