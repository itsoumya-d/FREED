import React from 'react';
import { Modal, Platform, ScrollView } from 'react-native';
import { DateTimePicker } from '@expo/ui/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text, View, Pressable } from './Localized';
import { RecoveryMonthPicker } from './RecoveryMonthPicker';
import { useAppTheme } from '@/design-system/use-app-theme';

export function JournalDatePicker({ visible, dateKey, onChange, onClose }: { visible: boolean; dateKey: string; onChange: (date: Date) => void; onClose: () => void }) {
  const { colors, mode } = useAppTheme(); const { i18n } = useTranslation();
  const [date, setDate] = React.useState(() => new Date(`${dateKey}T12:00:00`));
  React.useEffect(() => { if (visible) setDate(new Date(`${dateKey}T12:00:00`)); }, [visible, dateKey]);
  const today = new Date();
  const picker = <DateTimePicker testID="journal-native-date-picker" value={date} mode="date" display={Platform.OS === 'android' ? 'default' : 'inline'} presentation={Platform.OS === 'android' ? 'dialog' : 'inline'} themeVariant={mode} accentColor={colors.accent} maximumDate={today} locale={i18n.language} onDismiss={onClose} onChange={(event, value) => { if (event.type === 'dismissed') { onClose(); return; } if (value) { if (Platform.OS === 'android') { onChange(value); onClose(); } else setDate(value); } }} />;
  if (Platform.OS === 'android') return visible ? picker : null;
  return <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 24 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>Choose a date</Text>{Platform.OS === 'web' ? <RecoveryMonthPicker value={date} maximumDate={today} onChange={setDate} /> : picker}<View style={{ flexDirection: 'row', gap: 12 }}><Pressable accessibilityRole="button" onPress={onClose} style={{ flex: 1, minHeight: 56, padding: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface2 }}><Text style={{ color: colors.text }}>Cancel</Text></Pressable><Pressable testID="journal-confirm-date" accessibilityRole="button" onPress={() => { onChange(date); onClose(); }} style={{ flex: 1, minHeight: 56, padding: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '700' }}>Done</Text></Pressable></View></ScrollView></SafeAreaView></Modal>;
}
