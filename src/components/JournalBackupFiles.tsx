import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Text, View, Pressable, TextInput } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import { getAutomaticBackupStatus, subscribeAutomaticBackupStatus } from '@/lib/automatic-backup';
export function JournalBackupFiles({ ownerId, automaticEnabled, onExport, onImport, onDownload, onAutomaticChange, onConnect }: {
  ownerId: string | null; automaticEnabled: boolean; onExport: (passphrase: string) => Promise<void>;
  onImport: (passphrase: string) => Promise<boolean>; onAutomaticChange: (enabled: boolean, passphrase: string) => Promise<void>; onConnect: () => void;
  onDownload?: (passphrase: string) => Promise<void>;
}) {
  const { colors } = useAppTheme(); const [passphrase, setPassphrase] = React.useState(''), [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState<string | null>(null);
  const busyRef = React.useRef(false), mounted = React.useRef(true);
  const [automaticStatus, setAutomaticStatus] = React.useState(getAutomaticBackupStatus);
  React.useEffect(() => subscribeAutomaticBackupStatus(setAutomaticStatus), []);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => { setPassphrase(''); setMessage(null); }, [ownerId]);
  const currentOwner = React.useRef(ownerId); currentOwner.current = ownerId;
  const run = async (action: () => Promise<boolean | void>, success: string) => {
    if (busyRef.current || !ownerId) return; busyRef.current = true; setBusy(true); setMessage(null); const owner = ownerId;
    try { const completed = await action(); if (mounted.current && currentOwner.current === owner) setMessage(completed === false ? 'File selection cancelled. Your history was kept.' : success); }
    catch { if (mounted.current && currentOwner.current === owner) setMessage('Backup action could not complete. Your history was kept; check the file and passphrase and try again.'); }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  const button = (id: string, label: string, action: () => void, disabled = busy || !ownerId || passphrase.trim().length < 8) => <Pressable key={id} testID={id} accessibilityRole="button" accessibilityState={{ disabled, busy }} disabled={disabled} onPress={action}
    style={{ minHeight: 48, justifyContent: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.surface2 }}><Text style={{ color: colors.text, fontWeight: '700', lineHeight: 24 }}>{label}</Text></Pressable>;
  return <View testID="journal-backup-files" style={{ gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: '800' }}>Encrypted backup files</Text>
    <Text style={{ color: colors.text2, lineHeight: 24 }}>Save recovery history and journal photos in an encrypted file. Keep your passphrase safe; FREED cannot recover it. Files up to 64 MiB are supported.</Text>
    {!ownerId ? button('backup-connect-account', 'Connect your account to open its backup', onConnect, false) : <>
      <TextInput testID="backup-file-passphrase" accessibilityLabel="Backup passphrase" secureTextEntry autoCorrect={false} autoCapitalize="none" textContentType="none" maxLength={512} value={passphrase} onChangeText={setPassphrase} editable={!busy}
        style={{ minHeight: 52, padding: 16, borderRadius: 16, color: colors.text, backgroundColor: colors.surface2, fontSize: 17 }} />
      {button('backup-export-file', 'Save encrypted backup file', () => { void run(() => onExport(passphrase), 'Encrypted file shared. Keep a saved copy before leaving the share sheet.'); })}
      {button('backup-import-file', 'Choose a backup file to restore', () => { void run(() => onImport(passphrase), 'Backup file checked. Confirm restore to apply it.'); })}
      {onDownload ? button('backup-download-text', 'Restore encrypted cloud text backup', () => { void run(() => onDownload(passphrase), 'Text backup checked. Photos were excluded. Confirm restore to apply it.'); }) : null}
      <Text style={{ color: colors.text2, lineHeight: 24 }}>Optional automatic backup encrypts journal text and history. Photos stay on this device and are included only in manual backup files.</Text>
      {automaticEnabled && automaticStatus.message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text2, lineHeight: 24 }}>{automaticStatus.message}</Text> : null}
      {automaticEnabled && automaticStatus.phase === 'synced' ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text2, lineHeight: 24 }}>Encrypted text backup upload confirmed.</Text> : null}
      {button('backup-automatic-consent', automaticEnabled ? 'Turn off automatic text backup' : 'Enable automatic text backup', () => { void run(() => onAutomaticChange(!automaticEnabled, passphrase), automaticEnabled ? 'Automatic text backup is off.' : 'Automatic text backup is enabled on this device.'); }, busy || (!automaticEnabled && passphrase.trim().length < 8))}
    </>}
    {busy ? <ActivityIndicator accessibilityLabel="Backup action in progress" color={colors.accent} /> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.text2, lineHeight: 24 }}>{message}</Text> : null}
  </View>;
}
