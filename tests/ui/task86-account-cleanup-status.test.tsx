import React from 'react';
import {render,fireEvent,act} from '@testing-library/react-native';
import {AccountDeletionDestination} from '@/components/AccountDeletionDestination';
jest.mock('@/hooks/use-app-preferences',()=>({useAppPreferences:()=>({mode:'light'}),useOptionalAppPreferences:()=>null}));
const receipt={version:1 as const,ownerUid:'A',eventId:'event',requestedAt:'2026-10-15T00:00:00.000Z',cloud:'completed' as const,local:'completed' as const};
test.each(['pending','unavailable'] as const)('JS completed with native %s keeps an exact native retry without another cloud deletion',async state=>{
 const retry=jest.fn(async()=>{}),cloud=jest.fn(async()=>{});const v=render(<AccountDeletionDestination connected={false} email={null} receipt={receipt} nativeCleanupState={state} onRetryNativeCleanup={retry} onDelete={cloud} onConnect={()=>{}} onManage={()=>{}} onSupport={()=>{}}/>);
 expect(v.getByText('Cloud deletion is confirmed. This account’s private local history was removed.')).toBeOnTheScreen();await act(async()=>fireEvent.press(v.getByTestId('account-delete-native-retry')));expect(retry).toHaveBeenCalledTimes(1);expect(cloud).not.toHaveBeenCalled();
});
test('historical local completion cannot acquire a new native completion claim or invented operation',()=>{
 const v=render(<AccountDeletionDestination connected={false} email={null} receipt={receipt} onDelete={async()=>{}} onConnect={()=>{}} onManage={()=>{}} onSupport={()=>{}}/>);expect(v.getByText('This older receipt confirms local history cleanup only. Native cleanup was not verified.')).toBeOnTheScreen();expect(v.queryByTestId('account-delete-native-retry')).toBeNull();expect(v.queryByText('Native private cleanup is confirmed.')).toBeNull();
});
test('independent confirmed native cleanup is visible without changing retained protection claims',()=>{
 const v=render(<AccountDeletionDestination connected={false} email={null} receipt={receipt} nativeCleanupState="completed" onDelete={async()=>{}} onConnect={()=>{}} onManage={()=>{}} onSupport={()=>{}}/>);expect(v.getByText('Native private cleanup is confirmed.')).toBeOnTheScreen();expect(v.getByText('Device adult-protection settings and any friend lock are retained.')).toBeOnTheScreen();expect(v.queryByTestId('account-delete-native-retry')).toBeNull();
});
