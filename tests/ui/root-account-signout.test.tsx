import {task86CleanupDependencies} from '../helpers/task86-native-account-fixture';
import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { readFileSync } from 'node:fs';
import { transpileModule, ModuleKind } from 'typescript';
import { createDefaultRecoveryState } from '@/lib/recovery-state';
import { getJourneyOwner } from '@/lib/user-journey';
function actualSignout(fail = false) {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const first = source.indexOf('  const signOutRecoveryAccount = React.useCallback('), last = source.indexOf('\n  const restoreRecoveryState', first);
  const body = transpileModule(`return function Probe() { const [notice,setAccountNotice]=React.useState(''); ${source.slice(first,last)} return React.createElement(Pressable,{testID:'logout',onPress:()=>{void signOutRecoveryAccount();}},React.createElement(Text,null,notice)); };`, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  let uid: string | null = 'owner-a'; const state = createDefaultRecoveryState();
  const auth = jest.fn(async () => { if (fail) throw new Error('local-auth-failure'); uid = null; });
  const snapshots=new Map<string|null,any>();const snapshot=()=>{if(!snapshots.has(uid))snapshots.set(uid,{status:'ready',signedIn:Boolean(uid),anonymous:false,ownerUid:uid,email:uid?'owner@example.test':null});return snapshots.get(uid);};
  const screen = jest.fn(), suspendOwner = jest.fn(), resumeOwner = jest.fn();
  const deps: Record<string, any> = { React, Pressable, Text, deletionBusyRef: { current: false }, signingOutRef: { current: false },
    accountOperationGate: { current: { invalidate: jest.fn(),begin:()=>({isCurrent:()=>true}) } }, setPendingRecoveryRestore: jest.fn(),
    disableAutomaticBackup: jest.fn(() => new Promise(() => {})), cancelAutomaticBackupSync: jest.fn(),
    persistRecoveryState: jest.fn((update: Function) => update(state)), setVerifiedPremiumEntitlement: (value: any) => value,
    createDefaultRecoveryState, signOutFirebaseAccount: auth, setAccountReturnToProfile: jest.fn(), setScreen: screen,
    setRemoteRetentionPlan: jest.fn(), safeUserFacingMessage: (_error: unknown, fallback: string) => fallback,
    getFirebaseAccountScope: () => uid, getFirebaseAuthSnapshot:snapshot, subscribeFirebaseAuthSnapshot:()=>()=>{}, getJourneyOwner,
    privateLockedRef: { current: false }, setPrivateViewLocked: jest.fn(), suspendOwner, resumeOwner,
    accountHostGeneration: { current: 0 }, profileAccountOrigin: { current: null }, accountFlowFence: { current: { isActive: () => false } },
    protectionReadback: { current: { invalidate: jest.fn() } }, appConfigQueue: { current: { invalidate: jest.fn() } },
    journalResources: { current: { owner: 'owner-a', repository: { revoke: jest.fn() }, media: null } },
    setJourneyMembership: jest.fn(), setActiveAttempt: jest.fn(), setSelectedChallenge: jest.fn(), setBasicHelpContext: jest.fn(),
    challengeBreakOrigin: { current: null }, privateSignoutOwner: { current: null }, setPendingFirebaseEmailLink: jest.fn(),
    setSigningOut: jest.fn(), Platform: { OS: 'android' }, getProtectionActionScope: () => '[null,1]', setAppGroupActionScope: jest.fn(), clearAccountPrivatePresentation: jest.fn() };
  Object.assign(deps,{...task86CleanupDependencies(),suspendOwner,resumeOwner});
  return { Probe: new Function(...Object.keys(deps), body)(...Object.values(deps)), auth, screen, deps, suspendOwner, resumeOwner };
}
test('actual root logout reaches local Auth and confirmed welcome while backup shutdown never settles offline', async () => {
  const f = actualSignout(), view = render(<f.Probe />); fireEvent.press(view.getByTestId('logout'));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  expect(f.auth).toHaveBeenCalledTimes(1); expect(f.screen).toHaveBeenCalledWith('welcome');
  expect(f.suspendOwner).toHaveBeenCalled();
  expect(view.getByText(/Signed out/)).toBeOnTheScreen();
});
test('failed actual Auth logout never reports signed out or resets to welcome and permits retry', async () => {
  const f = actualSignout(true), view = render(<f.Probe />); fireEvent.press(view.getByTestId('logout'));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(f.screen).not.toHaveBeenCalledWith('welcome'); expect(view.queryByText(/Signed out/)).toBeNull();
  expect(view.getByText(/could not complete/)).toBeOnTheScreen();
  fireEvent.press(view.getByTestId('logout')); await act(async () => { await Promise.resolve(); });
  expect(f.auth).toHaveBeenCalledTimes(2);
});
