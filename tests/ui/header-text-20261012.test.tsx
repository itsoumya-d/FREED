import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { MomentumPageHeader, MomentumSection } from '@/components/MomentumPageHeader';
import { MomentumCompanion } from '@/components/MomentumCompanion';
import { ChevronDown } from 'lucide-react-native';
import { ChevronRight } from '@/components/DirectionalIcons';
import { AppGroupEditor, AppGroupsScreen } from '@/components/AppGroupsScreen';
import { ProtectOverview } from '@/components/ProtectOverview';
import { Text } from '@/components/Localized';
import { appI18n, translateSource } from '@/i18n/runtime';
import { createDefaultDisciplineSettings } from '@/lib/recovery-state';
import type { AppGroupsBinding } from '@/hooks/use-app-groups';
import type { AppGroup, AppGroupsSnapshot } from '@/lib/app-groups-contract';

let mockMode = 'light';
let mockDimensions = { width: 430, height: 932, scale: 3, fontScale: 1 };
let mockBinding: AppGroupsBinding;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('freed-protection', () => ({}));
jest.mock('@/hooks/use-app-groups', () => ({ useAppGroups: () => mockBinding }));
jest.mock('@/hooks/use-encrypted-dns', () => ({ useEncryptedDns: () => ({ status: null, lastCheckedAt: null }) }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronRight: () => null }));
jest.mock('lucide-react-native', () => ({ Globe2: () => null, Grid2X2: () => null, ChevronDown: () => null }));
jest.mock('expo-router', () => ({ Link: ({ children }: any) => children }));

const longName = 'My private native app selection — '.repeat(3).slice(0, 80);
const group: AppGroup = { id: 'header', revision: 3, name: longName, enabled: false, rule: { kind: 'daily-limit', limitMinutes: 30 }, packages: [], applicationCount: 0, categoryCount: 0, webDomainCount: 0, legacy: false, configured: true, ready: false, active: false, thresholdReached: false, unavailablePackages: [], usageMinutes: null, nextBoundaryAt: null, break: null };
const snapshot: AppGroupsSnapshot = { version: 1, supported: true, platform: 'ios', revision: 8, configurationGeneration: 2, scopeEpoch: 3, groups: [], permissions: { authorized: true, usageAccess: true, runtimeConnected: true }, monitorBudget: { used: 0, limit: 20 }, maxGroups: 6, legacyCompatibility: { retained: false, applicationCount: 0, categoryCount: 0, webDomainCount: 0 }, reason: null };
const capability: any = { platform: 'ios', screenTime: true, managedSettings: true, appGuardModes: true, appSchedules: true, appGroups: true, notes: [] };
function binding(status = snapshot): AppGroupsBinding {
  return { status, earnedTimeAvailable: false, pending: false, error: null, waitingForOwner: false, refresh: jest.fn(), create: jest.fn(), update: jest.fn(), updateEarned: jest.fn(), remove: jest.fn(), picker: jest.fn(), discard: jest.fn(), acknowledge: jest.fn() } as unknown as AppGroupsBinding;
}
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
  expect(style.minWidth).toBe(0);
  expect(style.maxWidth).toBe('100%');
}
beforeEach(async () => { localStorage.clear(); mockBinding = binding(); mockMode = 'light'; mockDimensions = { width: 430, height: 932, scale: 3, fontScale: 1 }; await appI18n.changeLanguage('en'); });
afterEach(async () => { await appI18n.changeLanguage('en'); });
// Constraints and callbacks only: Jest does not measure glyphs, Yoga, native scaling or RTL geometry.
const scenarios = ['de', 'fr', 'ar'].flatMap(language => ['light', 'dark'].flatMap(mode => [{ width: 320, fontScale: 1, direction: 'column' }, { width: 430, fontScale: 1, direction: 'row' }, { width: 430, fontScale: 1.8, direction: 'column' }].map(size => ({ language, mode, ...size }))));

test.each(scenarios)('full headers and Cancel receive independent space at $language/$mode/$width/fontScale $fontScale', async ({ language, mode, width, fontScale, direction }) => {
  mockMode = mode; mockDimensions = { ...mockDimensions, width, fontScale }; await appI18n.changeLanguage(language);
  const page = render(<MomentumPageHeader compact title="Adult websites" description="Choose apps and one rule for each group. A recovery break applies only to the app and group that requested it." />);
  const title = page.getByRole('header'); growingText(title);
  expect(title).toHaveTextContent(translateSource('Adult websites'));
  const copy = containingView(title);
  expect(copy).toHaveStyle({ minWidth: 0 });
  expect(containingView(copy)).toHaveStyle({ flexDirection: direction });
  growingText(page.getByText(translateSource('Choose apps and one rule for each group. A recovery break applies only to the app and group that requested it.')));
  expect(containingView(page.UNSAFE_getByType(MomentumCompanion))).toHaveStyle({ flexShrink: 0 }); page.unmount();

  const section = render(<MomentumSection title={longName} companion collapsible><Text>Private content</Text></MomentumSection>);
  growingText(section.getByRole('header'));
  expect(section.getByRole('header')).toHaveTextContent(longName);
  expect(containingView(section.UNSAFE_getByType(MomentumCompanion))).toHaveStyle({ flexShrink: 0 });
  expect(containingView(section.UNSAFE_getByType(ChevronDown))).toHaveStyle({ flexShrink: 0 });
  fireEvent.press(section.getByRole('button', { name: longName })); expect(section.queryByText('Private content')).toBeNull();
  expect(containingView(section.UNSAFE_getByType(ChevronRight))).toHaveStyle({ flexShrink: 0 });
  fireEvent.press(section.getByRole('button', { name: longName })); expect(section.getByText('Private content')).toBeOnTheScreen(); section.unmount();

  const close = jest.fn(); const editor = render(<AppGroupEditor group={group} binding={mockBinding} onClose={close} simple />);
  expect(editor.getByTestId('group-editor-navigation')).toHaveStyle({ flexDirection: direction });
  growingText(editor.getByRole('header'));
  expect(editor.getByRole('header')).toHaveTextContent(translateSource('App protection'));
  expect(editor.getByTestId('group-cancel')).toHaveStyle({ minHeight: 44, minWidth: 44, flexShrink: 0 });
  growingText(editor.getByText(translateSource('Cancel')));
  expect(editor.getByTestId('apps-activate')).toBeOnTheScreen();
  fireEvent.press(editor.getByTestId('group-cancel')); expect(close).toHaveBeenCalledTimes(1); expect(mockBinding.update).not.toHaveBeenCalled();
  editor.rerender(<AppGroupEditor group={group} binding={{ ...mockBinding, pending: true }} onClose={close} simple />);
  expect(editor.getByTestId('group-cancel')).toBeDisabled(); fireEvent.press(editor.getByTestId('group-cancel')); expect(close).toHaveBeenCalledTimes(1);
});

test.each([{ name: 'no groups', groups: [] }, { name: 'user empty group', groups: [group] }])('supported truly empty groups show one working Add entry and preserve empty-group management: $name', async ({ groups }) => {
  const add = jest.fn(), open = jest.fn(), setup = jest.fn();
  const view = render(<ProtectOverview capability={capability} status={null} settings={createDefaultDisciplineSettings()} groups={{ ...snapshot, groups }} onSetup={setup} onAddGroup={add} onOpenGroups={open} />);
  expect(view.queryByTestId('protect-apps-setup')).toBeNull();
  expect(view.getByTestId('protect-add-group')).not.toBeDisabled(); fireEvent.press(view.getByTestId('protect-add-group')); expect(add).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled(); view.unmount();
  // The existing Add path reuses an empty user group; Manage groups remains reachable.
  mockBinding = binding({ ...snapshot, groups: [group] }); const manage = jest.fn();
  const apps = render(<AppGroupsScreen getActionScope={() => 'owner'} onManageGroups={manage} />);
  fireEvent.press(apps.getByTestId('apps-manage-groups')); expect(manage).toHaveBeenCalledTimes(1);
  await act(async () => { fireEvent.press(apps.getByTestId('apps-add')); });
  expect(apps.getByTestId('app-group-editor')).toBeOnTheScreen(); expect(mockBinding.create).not.toHaveBeenCalled();
});

const repairStates = [
  { name: 'checking snapshot', groups: null },
  { name: 'unsupported build', groups: { ...snapshot, supported: false } },
  { name: 'retained legacy apps', groups: { ...snapshot, legacyCompatibility: { ...snapshot.legacyCompatibility, retained: true, applicationCount: 2 } } },
  { name: 'legacy category targets', groups: { ...snapshot, legacyCompatibility: { ...snapshot.legacyCompatibility, retained: true, categoryCount: 1 } } },
  { name: 'selected native apps', groups: { ...snapshot, groups: [{ ...group, applicationCount: 1 }] } },
  { name: 'selected installed packages', groups: { ...snapshot, groups: [{ ...group, packages: ['com.actual.long.native.selection'] }] } },
  { name: 'zero pending selection', groups: { ...snapshot, groups: [{ ...group, draftApplicationCount: 0 }] } },
  { name: 'group category targets', groups: { ...snapshot, groups: [{ ...group, categoryCount: 1 }] } },
  { name: 'group website targets', groups: { ...snapshot, groups: [{ ...group, webDomainCount: 1 }] } },
  { name: 'native storage error', groups: { ...snapshot, reason: 'storage-unavailable' } },
  { name: 'checking configuration', groups: snapshot, syncing: true },
  { name: 'configuration error', groups: snapshot, syncMessage: 'Configuration read failed' },
];
test.each(repairStates)('Review remains reachable for $name', ({ groups, ...state }) => {
  const open = jest.fn(), add = jest.fn();
  const view = render(<ProtectOverview capability={capability} status={null} settings={createDefaultDisciplineSettings()} groups={groups} syncing={'syncing' in state && state.syncing} syncMessage={'syncMessage' in state ? state.syncMessage : null} onSetup={jest.fn()} onOpenGroups={open} onAddGroup={add} />);
  expect(view.getByTestId('protect-apps-setup')).not.toBeDisabled(); fireEvent.press(view.getByTestId('protect-apps-setup')); expect(open).toHaveBeenCalledTimes(1);
  if (!groups?.supported) { expect(view.getByTestId('protect-add-group')).toBeDisabled(); fireEvent.press(view.getByTestId('protect-add-group')); expect(add).not.toHaveBeenCalled(); }
});

test('the setup fallback remains when no Add callback is supplied', () => {
  const setup = jest.fn(); const view = render(<ProtectOverview capability={capability} status={null} settings={createDefaultDisciplineSettings()} groups={snapshot} onSetup={setup} />);
  fireEvent.press(view.getByTestId('protect-apps-setup')); expect(setup).toHaveBeenCalledWith('apps');
});

test('long untranslated names preserve full content and Edit group retains its Cancel action', () => {
  mockDimensions = { ...mockDimensions, width: 320, fontScale: 1.8 };
  const longNativeName = 'Actual installed app / extended native selection label '.repeat(3);
  const page = render(<MomentumPageHeader compact title={longNativeName} translateTitle={false} description={longName} translateDescription={false} />);
  growingText(page.getByRole('header')); expect(page.getByRole('header')).toHaveTextContent(longNativeName);
  growingText(page.getByText(longName)); page.unmount();
  const close = jest.fn(); const editor = render(<AppGroupEditor group={group} binding={mockBinding} onClose={close} />);
  expect(editor.getByRole('header')).toHaveTextContent('Edit group'); growingText(editor.getByRole('header'));
  expect(editor.getByTestId('group-name').props.value).toBe(longName);
  fireEvent.press(editor.getByTestId('group-cancel')); expect(close).toHaveBeenCalledTimes(1); expect(mockBinding.update).not.toHaveBeenCalled();
});

test('a supported empty overview forwards Add to its existing groups fallback', () => {
  const open = jest.fn(); const view = render(<ProtectOverview capability={capability} status={null} settings={createDefaultDisciplineSettings()} groups={snapshot} onSetup={jest.fn()} onOpenGroups={open} />);
  expect(view.queryByTestId('protect-apps-setup')).toBeNull(); fireEvent.press(view.getByTestId('protect-add-group')); expect(open).toHaveBeenCalledTimes(1);
});
