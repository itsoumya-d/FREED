import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegacyJournalScreen } from './LegacyJournalScreen';
import type { StandaloneJournalProps } from './StandaloneJournalScreen';
import { Text, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import type { DailyCheckIn } from '@/lib/recovery-state';

export type JournalScreenProps = Omit<StandaloneJournalProps, 'ownerId'> & {
  ownerId?: string | null;
  /** Compatibility while the root binds the owner-scoped API. Never used by standalone saves. */
  record?: DailyCheckIn | null;
  history?: readonly DailyCheckIn[];
  onSave?: (reflection: string, dateKey: string, mode?: 'edit-existing') => void;
};
export function JournalScreen(props: JournalScreenProps) {
  const { colors } = useAppTheme();
  if (!('ownerId' in props)) return <LegacyJournalScreen record={props.record ?? null} history={props.history} onSave={props.onSave ?? (() => { throw new Error('journal-owner-not-bound'); })} onBack={props.onBack} />;
  if (!props.ownerId) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 24, gap: 16 }}><Text accessibilityRole="alert" style={{ color: colors.text }}>Open your journal from your account or guest profile.</Text><Pressable accessibilityRole="button" onPress={props.onBack} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent }}>Back</Text></Pressable></SafeAreaView>;
  const { StandaloneJournalScreen } = require('./StandaloneJournalScreen') as typeof import('./StandaloneJournalScreen');
  return <StandaloneJournalScreen key={props.ownerId} {...props} ownerId={props.ownerId} />;
}
