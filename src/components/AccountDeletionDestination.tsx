import React from 'react';
import { ScrollView, ActivityIndicator } from 'react-native';
import { Text, View, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import type { AccountDeletionReceipt } from '@/lib/account-deletion-receipt';
export function AccountDeletionDestination({ connected, email, receipt, nativeCleanupState='unverified', onRetryNativeCleanup, onDelete, onConnect, onManage, onSupport }: {
  connected: boolean; email: string | null; receipt: AccountDeletionReceipt | null;
  nativeCleanupState?:'pending'|'completed'|'unavailable'|'unverified';onRetryNativeCleanup?:()=>Promise<unknown>;
  onDelete: () => Promise<unknown>; onConnect: () => void; onManage: () => void;
  onSupport: () => void;
}) {
  const { colors } = useAppTheme(); const [confirmed, setConfirmed] = React.useState(false), [busy, setBusy] = React.useState(false), [error, setError] = React.useState<string | null>(null);
  const run = async () => { if (busy || (!receipt && !confirmed)) return; setBusy(true); setError(null);
    try { await onDelete(); } catch { setError('Account deletion could not complete. Your receipt and remaining local data are kept for retry.'); }
    finally { setBusy(false); }
  };
  return <ScrollView testID="account-delete-page" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: '800' }}>Delete account</Text>
    {email ? <Text translate={false} selectable style={{ color: colors.text2 }}>{email}</Text> : null}
    <Text style={{ color: colors.text2, lineHeight: 24 }}>Deleting your account removes its hosted data and this account's private local history. Other accounts on this device are kept.</Text>
    <Text style={{ color: colors.text2, lineHeight: 24 }}>Account deletion does not cancel an App Store or Google Play subscription. Manage your subscription separately.</Text>
    <Pressable accessibilityRole="button" onPress={onManage} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Manage subscription</Text></Pressable>
    {receipt ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text2, lineHeight: 24 }}>{receipt.cloud === 'completed'
      ? receipt.local === 'completed' ? 'Cloud deletion is confirmed. This account’s private local history was removed.' : 'Cloud deletion is confirmed. Local cleanup still needs to finish.'
      : receipt.cloud === 'processing' ? 'The server accepted deletion. Completion is still processing; it has not been confirmed.' : 'The deletion response was not confirmed. Retry or contact support; sign-out alone does not prove deletion.'}</Text> : null}
    <Text style={{color:colors.text2,lineHeight:24}}>Device adult-protection settings and any friend lock are retained.</Text>
    {receipt?.cloud==='completed'?<Text accessibilityLiveRegion="polite" style={{color:colors.text2,lineHeight:24}}>{nativeCleanupState==='completed'?'Native private cleanup is confirmed.':nativeCleanupState==='pending'?'Native private cleanup is pending. Your local history cleanup is recorded separately.':nativeCleanupState==='unavailable'?'Native private cleanup could not be verified. Retry with the saved operation.':'This older receipt confirms local history cleanup only. Native cleanup was not verified.'}</Text>:null}
    {receipt?.cloud==='completed'&&['pending','unavailable'].includes(nativeCleanupState)&&onRetryNativeCleanup?<Pressable testID="account-delete-native-retry" accessibilityRole="button" disabled={busy} onPress={()=>{if(busy)return;setBusy(true);setError(null);void onRetryNativeCleanup().catch(()=>setError('Native private cleanup could not be verified. Retry with the saved operation.')).finally(()=>setBusy(false));}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.accent}}>Retry native private cleanup</Text></Pressable>:null}
    {!receipt && connected ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy }} disabled={busy}
      onPress={() => setConfirmed(value => !value)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ color: colors.text }}>{confirmed ? '✓' : '○'}</Text><Text style={{ flex: 1, color: colors.text, lineHeight: 24 }}>I understand that this account and its private data will be deleted.</Text>
    </Pressable> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.red, lineHeight: 24 }}>{error}</Text> : null}
    {receipt?.cloud === 'completed' && receipt.local === 'completed' ? null : connected || receipt?.cloud === 'completed' ? <Pressable testID="account-delete-confirm" accessibilityRole="button" disabled={busy || (!receipt && !confirmed)}
      accessibilityState={{ disabled: busy || (!receipt && !confirmed), busy }} onPress={() => { void run(); }} style={{ minHeight: 52, padding: 16, borderRadius: 16, backgroundColor: colors.red, alignItems: 'center' }}>
      {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '700' }}>{receipt?.cloud === 'completed' ? 'Retry local cleanup' : receipt ? 'Retry deletion request' : 'Confirm account deletion'}</Text>}
    </Pressable> : <Pressable accessibilityRole="button" onPress={onConnect} style={{ minHeight: 52, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>Connect the account to delete it</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={onSupport} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>Contact support</Text></Pressable>
  </ScrollView>;
}
