let mockDnsStatus:any={supported:false,releaseEnabled:false,configured:false,enabled:false,healthy:null,reason:null,provider:'cloudflare-families',requiresSettings:false};
jest.mock('@/hooks/use-encrypted-dns',()=>({useEncryptedDns:()=>({status:mockDnsStatus,lastCheckedAt:100})}));
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ProtectOverview } from '@/components/ProtectOverview';
import { appI18n } from '@/i18n/runtime';
import { createDefaultDisciplineSettings } from '@/lib/recovery-state';
import { freedShieldSectionPath } from '@/lib/native-navigation';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';

jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronRight: () => null }));
jest.mock('lucide-react-native', () => ({ Globe2: () => null, Grid2X2: () => null, ChevronDown: () => null }));
jest.mock('@/components/EncryptedDnsSection', () => ({
  EncryptedDnsSection: () => require('react').createElement(require('react-native').Text, { testID: 'encrypted-dns-form' }, 'Encrypted DNS form'),
}));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }), useOptionalAppPreferences: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Link: ({ children, href }: any) => React.createElement(View, { testID: `route-${String(href).replace(/[^a-zA-Z0-9]+/g, '-')}` }, children),
  };
});

const ios: ProtectionCapability = {
  platform: 'ios', screenTime: true, managedSettings: true, appGuardModes: true, appSchedules: true,
  accessibility: false, dnsFiltering: false, localVpnFallback: false, notes: [],
};
const android: ProtectionCapability = {
  platform: 'android', screenTime: false, managedSettings: false, appGuardModes: true, appSchedules: true,
  accessibility: true, usageStats: true, dnsFiltering: true, localVpnFallback: true, notes: [],
};
const iosActive: ProtectionStatus = {
  authorized: true, active: true, mode: 'screen-time', adultFilterActive: true, message: '',
  selectedApplications: 2, appGuardMode: 'before-use', appGuardReady: true,
} as ProtectionStatus;

beforeEach(async () => { mockDnsStatus={supported:false,releaseEnabled:false,configured:false,enabled:false,healthy:null,reason:null,provider:'cloudflare-families',requiresSettings:false}; await appI18n.changeLanguage('en'); });

function overview(capability: ProtectionCapability | null, status: ProtectionStatus | null, settings = createDefaultDisciplineSettings(), onSetup = jest.fn(), observations?:any) {
  const view = render(<ProtectOverview capability={capability} status={status} settings={settings} onSetup={onSetup} observations={observations} />);
  return { view, onSetup };
}

test('empty device state is plainly Off and offers setup for both independent cards', () => {
  const { view, onSetup } = overview(android, null);
  expect(view.getByTestId('protect-websites-status')).toHaveTextContent('Off');
  expect(view.getByTestId('protect-apps-status')).toHaveTextContent('Off');
  expect(view.getByTestId('protect-websites-setup')).toHaveTextContent('Set up');
  expect(view.getByTestId('protect-apps-setup')).toHaveTextContent('Set up');
  expect(view.getByTestId('protect-apps-target-summary')).toHaveTextContent('0 selected apps');
  fireEvent.press(view.getByTestId('protect-websites-setup'));
  fireEvent.press(view.getByTestId('protect-apps-setup'));
  expect(onSetup.mock.calls).toEqual([['websites'], ['apps']]);
});

test('currently observed iOS protection reads On, uses Check, and keeps app and website setup routes separate', () => {
  mockDnsStatus={...mockDnsStatus,supported:true,releaseEnabled:true,configured:true,enabled:true,healthy:true};
  const { view, onSetup } = overview(ios, iosActive,undefined,undefined,{readbackAt:100,enablement:'observed-current',routing:'observed-current',adultBrowsing:'observed-blocked',ordinaryBrowsing:'observed-allowed'});
  expect(view.getByTestId('protect-websites-status')).toHaveTextContent('On');
  expect(view.getByTestId('protect-apps-status')).toHaveTextContent('On');
  fireEvent.press(view.getByTestId('protect-websites-details-toggle'));
  expect(view.getByTestId('protect-websites-coverage')).toHaveTextContent('Screen Time can block supported adult websites.');
  expect(view.getByTestId('protect-websites-coverage')).not.toHaveTextContent(/tested|browser/i);
  expect(view.getByTestId('protect-websites-setup')).toHaveTextContent('Check');
  expect(view.getByTestId('protect-apps-setup')).toHaveTextContent('Check');
  fireEvent.press(view.getByTestId('protect-websites-setup'));
  fireEvent.press(view.getByTestId('protect-apps-setup'));
  expect(onSetup.mock.calls).toEqual([['websites'], ['apps']]);
});

test('degraded setup offers Fix and unsupported device offers Check without claiming readiness', () => {
  const degraded: ProtectionStatus = { ...iosActive, appGuardReady: false } as ProtectionStatus;
  const { view } = overview(ios, degraded);
  expect(view.getByTestId('protect-apps-status')).toHaveTextContent('Needs attention');
  expect(view.getByTestId('protect-apps-setup')).toHaveTextContent('Fix');
  view.unmount();

  const unsupported = overview(null, null).view;
  expect(unsupported.getByTestId('protect-websites-status')).toHaveTextContent('Unavailable');
  expect(unsupported.getByTestId('protect-apps-status')).toHaveTextContent('Unavailable');
  expect(unsupported.getByTestId('protect-websites-setup')).toHaveTextContent('Check');
  expect(unsupported.getByTestId('protect-apps-setup')).toHaveTextContent('Check');
});

test('how protection works reveals scope only after the explicit details action', () => {
  const { view } = overview(android, null);
  const scope = 'Reviewed adult-domain blocking at DNS lookups covered by DNS Guard.';
  expect(view.queryByText(scope)).toBeNull();
  fireEvent.press(view.getByTestId('protect-websites-details-toggle'));
  expect(view.getByTestId('protect-websites-details')).toBeOnTheScreen();
  expect(view.getByText(scope)).toBeOnTheScreen();
  expect(view.getByTestId('protect-websites-details-toggle').props.accessibilityState).toEqual({ expanded: true });
});

test('DNS settings stay behind Advanced and the overview no longer renders encrypted DNS inline', () => {
  const { view } = overview(ios, iosActive);
  expect(view.queryByTestId('encrypted-dns-form')).toBeNull();
  expect(view.queryByTestId('shield-open-dns')).toBeNull();
  expect(view.getByTestId('shield-open-advanced')).toBeOnTheScreen();
  const routeId = `route-${freedShieldSectionPath('advanced').replace(/[^a-zA-Z0-9]+/g, '-')}`;
  expect(view.getByTestId(routeId)).toBeOnTheScreen();
});

test('app summary uses native selected targets, mode, and Android-reported daily minutes', () => {
  const iosScheduled = { ...iosActive, appGuardMode: 'scheduled', appSchedulesSupported: true, appSchedulesConfigured: true, appSchedulesServiceConnected: true } as ProtectionStatus;
  const iosSettings = { ...createDefaultDisciplineSettings(), appGuardMode: 'scheduled' as const };
  const iosView = overview(ios, iosScheduled, iosSettings).view;
  expect(iosView.getByTestId('protect-apps-target-summary')).toHaveTextContent(/2 selected apps/);
  expect(iosView.getByTestId('protect-apps-target-summary')).toHaveTextContent(/Scheduled/);
  expect(iosView.queryByText(/minutes/)).toBeNull();
  iosView.unmount();

  const androidStatus: ProtectionStatus = {
    authorized: true, active: false, message: '', blockedApplications: 3, appGuardMode: 'daily-limit',
    appGuardReady: true, appInterventionAuthorized: true, usageStatsAuthorized: true, dailyLimitMinutes: 45,
  } as ProtectionStatus;
  const androidSettings = { ...createDefaultDisciplineSettings(), appGuardMode: 'daily-limit' as const, blockedAppPackages: ['a', 'b', 'c'] };
  const androidView = overview(android, androidStatus, androidSettings).view;
  expect(androidView.getByTestId('protect-apps-target-summary')).toHaveTextContent(/3 selected apps/);
  expect(androidView.getByTestId('protect-apps-target-summary')).toHaveTextContent(/Daily limit/);
  expect(androidView.getByTestId('protect-apps-target-summary')).toHaveTextContent(/45 minutes/);
  expect(androidView.getByTestId('protect-apps-coverage')).toHaveTextContent(/Shorts and Reels cannot be separated/);
});


test('selected native DNS and Apple policy are separate root facts, with no Off or browsing pass',()=>{
 mockDnsStatus={...mockDnsStatus,supported:true,releaseEnabled:true,configured:true,enabled:true};
 const {view}=overview(ios,{...iosActive,adultFilterActive:false,adultWebPolicyConfigured:false});
 expect(view.getByTestId('protect-websites-status')).not.toHaveTextContent('Off');expect(view.getByTestId('protect-websites-status')).not.toHaveTextContent('Unavailable');
 expect(view.getByTestId('protect-websites-setup')).toHaveTextContent('Fix');expect(view.queryByText(/browsing verified/i)).toBeNull();
});

test('retained independent app intent is described as configured after default group adoption or removal',()=>{
 const groups:any={version:1,supported:true,platform:'ios',revision:2,configurationGeneration:0,scopeEpoch:1,groups:[],permissions:{authorized:true,usageAccess:true,runtimeConnected:true},monitorBudget:{used:1,limit:20},maxGroups:6,legacyCompatibility:{retained:true,applicationCount:1,categoryCount:0,webDomainCount:0},reason:null};
 const view=render(<ProtectOverview capability={{...ios,appGroups:true}} status={iosActive} settings={createDefaultDisciplineSettings()} onSetup={jest.fn()} groups={groups}/>);
 expect(view.getByTestId('protect-apps-status')).toHaveTextContent('Independent protection configured');expect(view.getByTestId('protect-apps-status')).not.toHaveTextContent('Off');
});
