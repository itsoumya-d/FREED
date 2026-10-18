// Only the external Firebase session boundary is stubbed; group controllers and editor bindings remain real.
jest.mock('@/lib/firebase-native', () => {
  const snapshot = { status: 'ready', reason: null, admission: null, revision: 1 };
  return { getFirebaseNativeAccountSessionSnapshot: () => snapshot,
    subscribeFirebaseNativeAccountSession: () => () => {},
    getFirebaseAuthSnapshot: () => ({ status: 'ready', signedIn: true }),
    getFirebaseNativeAccountAdmission: () => null,
    reconcileFirebaseNativeAccountSession: async () => null };
});
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AppGroupEditor } from '@/components/AppGroupsScreen';
import { appGroupDraftKey } from '@/lib/app-group-drafts';
import type { AppGroup, AppGroupsSnapshot } from '@/lib/app-groups-contract';
import type { AppGroupsBinding } from '@/hooks/use-app-groups';
jest.mock('expo-sqlite/localStorage/install', () => ({}));
jest.mock('freed-protection', () => ({}));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/NativeAppGroupLabels', () => ({ NativeAppGroupLabels: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
const group: AppGroup = { id: 'selected', revision: 3, name: 'My apps', enabled: true, rule: { kind: 'daily-limit', limitMinutes: 40 }, packages: [], applicationCount: 1, draftApplicationCount: 2, categoryCount: 0, webDomainCount: 0, legacy: false, configured: true, ready: true, active: true, thresholdReached: true, unavailablePackages: [], usageMinutes: null, nextBoundaryAt: null, break: null };
function fixture() {
  const status: AppGroupsSnapshot = { version: 1, supported: true, platform: 'ios', revision: 8, configurationGeneration: 2, scopeEpoch: 3, groups: [group], permissions: { authorized: true, usageAccess: true, runtimeConnected: true }, monitorBudget: { used: 1, limit: 20 }, maxGroups: 6, legacyCompatibility: { retained: false, applicationCount: 0, categoryCount: 0, webDomainCount: 0 }, reason: null };
  const discard = jest.fn(), close = jest.fn(), update = jest.fn(), remove = jest.fn();
  const binding = { status, pending: null, error: null, waitingForOwner: false, refresh: jest.fn(), create: jest.fn(), update, remove, picker: jest.fn(), discard, acknowledge: jest.fn() } as AppGroupsBinding;
  const view = render(<AppGroupEditor group={group} binding={binding} onClose={close} />);
  fireEvent.press(view.getByTestId('group-details-toggle'));
  return { status, discard, close, update, remove, view };
}
beforeEach(() => { localStorage.clear(); jest.spyOn(Alert, 'alert').mockImplementation(() => undefined); });
afterEach(() => jest.restoreAllMocks());
test('discard asks explicitly, preserves the committed rule, and cancel does not call native', () => {
  const f = fixture();
  fireEvent.changeText(f.view.getByTestId('group-name'), 'Pending name');
  fireEvent.press(f.view.getByTestId('group-discard-draft'));
  expect(f.discard).not.toHaveBeenCalled();
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
  buttons.find((button: any) => button.style === 'cancel').onPress?.();
  expect(f.view.getByTestId('group-name')).toHaveProp('value', 'Pending name');
  expect(f.discard).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
});
test('accepted discard clears only the draft after the captured revision is acknowledged', async () => {
  const f = fixture();
  fireEvent.changeText(f.view.getByTestId('group-name'), 'Pending name');
  f.discard.mockResolvedValue({ accepted: true, reason: null, operation: 'discard-pending-selection', targetId: group.id, pendingSelectionDiscarded: true, snapshot: { ...f.status, revision: 9, groups: [{ ...group, draftApplicationCount: null }] } });
  fireEvent.press(f.view.getByTestId('group-discard-draft'));
  const confirm = (Alert.alert as jest.Mock).mock.calls[0][2].find((button: any) => button.style === 'destructive');
  await act(async () => { confirm.onPress(); });
  expect(f.discard).toHaveBeenCalledWith({ version: 1, expectedStoreRevision: 8, id: group.id, expectedRevision: 3 });
  expect(f.view.getByTestId('group-name')).toHaveProp('value', 'My apps');
  expect(f.status.groups[0].rule).toEqual({ kind: 'daily-limit', limitMinutes: 40 });
  expect(f.status.groups[0].enabled).toBe(true);
  expect(f.update).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled(); expect(f.close).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(appGroupDraftKey(f.status, group))!)).toMatchObject({ name: 'My apps', enabled: true });
});
test('a rejected or stale discard retains draft text and selection and offers retry', async () => {
  const f = fixture();
  fireEvent.changeText(f.view.getByTestId('group-name'), 'Pending name');
  f.discard.mockResolvedValue({ accepted: false, reason: 'stale-store', snapshot: f.status });
  fireEvent.press(f.view.getByTestId('group-discard-draft'));
  await act(async () => { (Alert.alert as jest.Mock).mock.calls[0][2].find((button: any) => button.style === 'destructive').onPress(); });
  expect(f.view.getByTestId('group-name')).toHaveProp('value', 'Pending name');
  expect(f.view.getByRole('alert')).toHaveTextContent(/could not be discarded/);
  expect(f.close).not.toHaveBeenCalled(); expect(f.update).not.toHaveBeenCalled();
});

test('pending discard disables editing and retains any already-queued newer change', async () => {
  const f = fixture();
  let finish!: (value: unknown) => void;
  f.discard.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  fireEvent.press(f.view.getByTestId('group-discard-draft'));
  await act(async () => { (Alert.alert as jest.Mock).mock.calls[0][2].find((button: any) => button.style === 'destructive').onPress(); });
  expect(f.view.getByTestId('group-name')).toHaveProp('editable', false);
  expect(f.view.getByTestId('group-rule-choice')).toBeDisabled();
  // A callback queued before the native dialog settled can arrive after disabling.
  act(() => { f.view.getByTestId('group-name').props.onChangeText('Newer queued edit'); });
  await act(async () => { finish({ accepted: true, reason: null, operation: 'discard-pending-selection', targetId: group.id, pendingSelectionDiscarded: true, snapshot: { ...f.status, revision: 9, groups: [{ ...group, draftApplicationCount: null }] } }); });
  expect(f.view.getByTestId('group-name')).toHaveProp('value', 'Newer queued edit');
  expect(f.view.getByRole('alert')).toHaveTextContent(/newer edits are still here/);
  expect(f.update).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
});

test('a local cleanup failure is visible and retries cleanup without another native discard', async () => {
  const f = fixture();
  fireEvent.changeText(f.view.getByTestId('group-name'), 'Pending name');
  f.discard.mockResolvedValue({ accepted: true, reason: null, operation: 'discard-pending-selection', targetId: group.id, pendingSelectionDiscarded: true, snapshot: { ...f.status, revision: 9, groups: [{ ...group, draftApplicationCount: null }] } });
  jest.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => { throw Error('storage unavailable'); });
  fireEvent.press(f.view.getByTestId('group-discard-draft'));
  await act(async () => { (Alert.alert as jest.Mock).mock.calls[0][2].find((button: any) => button.style === 'destructive').onPress(); });
  expect(f.view.getByRole('alert')).toHaveTextContent(/local draft could not be cleared/);
  expect(f.view.getByTestId('group-name')).toHaveProp('value', 'Pending name');
  fireEvent.press(f.view.getByTestId('group-draft-cleanup-retry'));
  expect(f.view.getByTestId('group-name')).toHaveProp('value', 'My apps');
  expect(f.discard).toHaveBeenCalledTimes(1); expect(f.update).not.toHaveBeenCalled();
});
test('a rejected discard with a queued edit never claims that the device discarded it', async () => {
  const f = fixture(); let finish!: (value: unknown) => void;
  f.discard.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  fireEvent.press(f.view.getByTestId('group-discard-draft'));
  await act(async () => { (Alert.alert as jest.Mock).mock.calls[0][2].find((button: any) => button.style === 'destructive').onPress(); });
  act(() => { f.view.getByTestId('group-name').props.onChangeText('Newer queued edit'); });
  await act(async () => { finish(null); });
  expect(f.view.getByTestId('group-name')).toHaveProp('value', 'Newer queued edit');
  expect(f.view.getByRole('alert')).toHaveTextContent(/could not be discarded/);
  expect(f.view.queryByText(/device discarded the pending selection/)).toBeNull();
});
