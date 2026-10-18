import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { AppGroupValueRow } from '@/components/AppGroupValueRow';
import { AppGroupEditor, AppGroupsScreen } from '@/components/AppGroupsScreen';
import { ProtectOverview } from '@/components/ProtectOverview';
import { ProtectionLayers } from '@/components/ProtectionLayers';
import { appI18n, translateSource } from '@/i18n/runtime';
import { createDefaultDisciplineSettings } from '@/lib/recovery-state';
import type { AppGroupsBinding } from '@/hooks/use-app-groups';
import type { AppGroup } from '@/lib/app-groups-contract';

let mockMode = 'light';
let mockDimensions = { width: 320, height: 640, scale: 3, fontScale: 1 };
let mockBinding: AppGroupsBinding;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('freed-protection', () => ({}));
jest.mock('@/hooks/use-app-groups', () => ({ useAppGroups: () => mockBinding }));
jest.mock('@/hooks/use-encrypted-dns', () => ({ useEncryptedDns: () => ({ status: null, lastCheckedAt: null }) }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronRight: () => null }));
jest.mock('lucide-react-native', () => ({ Globe2: () => null, Grid2X2: () => null, ChevronDown: () => null, Shield: () => null, ShieldCheck: () => null }));
jest.mock('expo-router', () => ({ Link: ({ children }: any) => children }));

const longName = 'My private app group — '.repeat(4).slice(0, 80);
const group: AppGroup = { id: 'layout', revision: 3, name: longName, enabled: true, rule: { kind: 'daily-limit', limitMinutes: 240 }, packages: [], applicationCount: 0, categoryCount: 0, webDomainCount: 0, legacy: false, configured: true, ready: false, active: false, thresholdReached: false, unavailablePackages: [], usageMinutes: null, nextBoundaryAt: null, break: null };
const capability: any = { platform: 'ios', screenTime: true, managedSettings: true, appGuardModes: true, appSchedules: true, safariContentBlocker: true, notes: [] };
function binding(): AppGroupsBinding {
  return { status: { version: 1, supported: true, platform: 'ios', revision: 8, configurationGeneration: 2, scopeEpoch: 3, groups: [group], permissions: { authorized: true, usageAccess: true, runtimeConnected: true }, monitorBudget: { used: 1, limit: 20 }, maxGroups: 6, legacyCompatibility: { retained: false, applicationCount: 0, categoryCount: 0, webDomainCount: 0 }, reason: null }, earnedTimeAvailable: false, pending: false, error: null, waitingForOwner: false, refresh: jest.fn(), create: jest.fn(), update: jest.fn(), updateEarned: jest.fn(), remove: jest.fn(), picker: jest.fn(), discard: jest.fn(), acknowledge: jest.fn() } as unknown as AppGroupsBinding;
}
// Render-tree constraints only: Jest does not lay out glyphs or prove phone geometry.
function containingView(node: any) {
  let current = node.parent;
  while (current && current.type !== 'View') current = current.parent;
  if (!current) throw new Error('Expected a native content view');
  return current;
}
function growingText(node: any) {
  expect(node.props.allowFontScaling).not.toBe(false);
  expect(node.props.numberOfLines).toBeUndefined();
  const style = StyleSheet.flatten(node.props.style);
  expect(style.height).toBeUndefined();
  expect(style.maxHeight).toBeUndefined();
}
beforeEach(async () => { localStorage.clear(); mockBinding = binding(); await appI18n.changeLanguage('en'); });
afterEach(async () => { await appI18n.changeLanguage('en'); });
const scenarios = ['de', 'fr', 'ar'].flatMap(language => ['light', 'dark'].flatMap(mode => [1, 1.8].map(fontScale => ({ language, mode, fontScale, width: language === 'de' ? 320 : language === 'fr' ? 360 : 430 }))));

test.each(scenarios)('full texts retain independent vertical space at $language/$mode/$width/fontScale $fontScale', async ({ language, mode, fontScale, width }) => {
  mockMode = mode; mockDimensions = { ...mockDimensions, width, fontScale };
  await appI18n.changeLanguage(language);
  const label = appI18n.t('earnedSetup.dailyAllowance');
  const options = [240, 60].map(value => ({ value, label: appI18n.t('earnedTime.capMinutes', { minutes: value }), testID: `choice-${value}` }));
  const onChange = jest.fn();
  const row = render(<AppGroupValueRow label={label} value={240} options={options} onChange={onChange} testID="duration" />);
  expect(row.getByTestId('duration')).toHaveStyle({ flexDirection: 'column', alignItems: 'stretch' });
  growingText(row.getByText(label)); growingText(row.getByText(options[0].label));
  fireEvent.press(row.getByTestId('duration'));
  const title = row.getByRole('header'); growingText(title);
  const header = containingView(title);
  expect(header).toHaveStyle({ flexDirection: 'column', alignItems: 'stretch' });
  for (const action of ['cancel', 'done']) expect(row.getByTestId(`duration-${action}`)).toHaveStyle({ minHeight: 44, minWidth: 44 });
  fireEvent.press(row.getByTestId('choice-60')); fireEvent.press(row.getByTestId('duration-cancel'));
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.press(row.getByTestId('duration')); fireEvent.press(row.getByTestId('choice-60')); fireEvent.press(row.getByTestId('duration-done'));
  expect(onChange).toHaveBeenCalledWith(60); row.unmount();

  const groups = render(<AppGroupsScreen mode="groups" getActionScope={() => 'owner'} />);
  const name = groups.getByText(longName); growingText(name);
  expect(containingView(name)).toHaveStyle({ flexDirection: 'column', alignItems: 'stretch' });
  expect(name).toHaveTextContent(longName);
  fireEvent.press(name); expect(groups.getByTestId('group-name').props.value).toBe(longName);
  expect(groups.getByTestId('group-rule-choice')).toHaveStyle({ flexDirection: 'column', alignItems: 'stretch' });
  expect(groups.getByTestId('group-daily-value')).toHaveProp('accessibilityValue', { text: options[0].label });
  fireEvent.press(groups.getByTestId('group-rule-choice')); fireEvent.press(groups.getByTestId('group-rule-before-use'));
  expect(groups.queryByTestId('group-daily-value')).toBeNull();
  fireEvent.press(groups.getByTestId('group-cancel')); expect(mockBinding.update).not.toHaveBeenCalled(); groups.unmount();

  const open = jest.fn(), openGroup = jest.fn(), add = jest.fn(), setup = jest.fn(), requested = jest.fn();
  const overview = render(<ProtectOverview capability={{ ...capability, appGroups: true }} status={null} settings={createDefaultDisciplineSettings()} groups={{ ...mockBinding.status, groups: [{ ...group, applicationCount: 1 }] }} onSetup={setup} onOpenGroups={open} onOpenGroup={openGroup} onAddGroup={add} onRequestedChange={requested} />);
  for (const id of ['protect-apps-setup', 'protect-add-group']) {
    expect(overview.getByTestId(id)).toHaveStyle({ maxWidth: '100%', minWidth: 0, minHeight: 48 });
    growingText(overview.getByText(translateSource(id === 'protect-apps-setup' ? 'Review apps' : 'Add apps')));
  }
  fireEvent.press(overview.getByTestId(`protect-apps-group-${group.id}`));
  expect(openGroup).toHaveBeenCalledWith(group.id);
  fireEvent.press(overview.getByTestId('protect-apps-setup')); fireEvent.press(overview.getByTestId('protect-add-group'));
  expect(open).toHaveBeenCalledTimes(1); expect(add).toHaveBeenCalledTimes(1);
  expect(open.mock.calls[0]).toHaveLength(0); expect(add.mock.calls[0]).toHaveLength(0);
  fireEvent(overview.getByTestId('protect-websites-switch'), 'valueChange', true); expect(requested).toHaveBeenCalledWith(true);
  overview.rerender(<ProtectOverview capability={capability} status={null} settings={createDefaultDisciplineSettings()} onSetup={setup} />);
  const appsTitle = overview.getByTestId('protect-apps-title');
  expect(containingView(appsTitle)).toHaveStyle({ flex: 1, minWidth: 0 });
  expect(containingView(overview.getByTestId('protect-apps-status'))).toBe(containingView(appsTitle));
  growingText(overview.getByTestId('protect-apps-status'));
  fireEvent.press(overview.getByTestId('protect-apps-setup')); expect(setup).toHaveBeenCalledWith('apps'); overview.unmount();

  const layers = render(<ProtectionLayers capability={capability} status={null} />);
  const layerTitle = layers.getByText(translateSource('Selected app limits'));
  expect(containingView(layerTitle)).toHaveStyle({ flex: 1, minWidth: 0 });
  growingText(layerTitle); layers.unmount();
});

test('disabled and pending presentation preserves callbacks and hides a sheet that becomes disabled', () => {
  const onChange = jest.fn(); const options = [{ value: 20, label: '20 min', testID: 'twenty' }];
  const row = render(<AppGroupValueRow label="Extra time each day" value={20} options={options} onChange={onChange} testID="cap" />);
  fireEvent.press(row.getByTestId('cap'));
  row.rerender(<AppGroupValueRow label="Extra time each day" value={20} options={options} onChange={onChange} testID="cap" disabled />);
  expect(row.getByTestId('cap')).toBeDisabled(); expect(row.UNSAFE_queryByType(Modal)).toBeNull();
  fireEvent.press(row.getByTestId('cap')); expect(onChange).not.toHaveBeenCalled(); row.unmount();
  const close = jest.fn(); mockBinding.pending = true;
  const editor = render(<AppGroupEditor group={group} binding={mockBinding} onClose={close} />);
  expect(editor.getByTestId('group-rule-choice')).toBeDisabled(); fireEvent.press(editor.getByTestId('group-rule-choice'));
  expect(editor.queryByTestId('group-rule-before-use')).toBeNull(); fireEvent.press(editor.getByTestId('group-cancel')); expect(close).not.toHaveBeenCalled(); editor.unmount();
  const add = jest.fn();
  const overview = render(<ProtectOverview capability={{ ...capability, appGroups: true }} status={null} settings={createDefaultDisciplineSettings()} groups={{ ...mockBinding.status, supported: false }} onSetup={jest.fn()} onAddGroup={add} />);
  expect(overview.getByTestId('protect-add-group')).toBeDisabled(); fireEvent.press(overview.getByTestId('protect-add-group')); expect(add).not.toHaveBeenCalled();
});
