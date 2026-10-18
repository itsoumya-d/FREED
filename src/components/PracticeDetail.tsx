import React from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import { MomentumCompanion, type CompanionPose } from './MomentumCompanion';
import { getPracticeDefinition } from '@/lib/practice-definitions';
import { getLocalDateKey, type DailyHabitKey } from '@/lib/recovery-state';
import type { MomentumHabit } from './MomentumToday';

export type PracticeDetailProps = {
  habit: MomentumHabit; selectedDate: Date; today: Date; onClose: () => void;
  onHabitToggle: (habit: MomentumHabit) => void | Promise<void>;
  onPracticeAction?: (key: DailyHabitKey) => void;
};
/** Instructions are readable on every date; guided actions and self reports write only today. */
export function PracticeDetail({ habit, selectedDate, today, onClose, onHabitToggle, onPracticeAction }: PracticeDetailProps) {
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const definition = getPracticeDefinition(habit.key);
  const [failure, setFailure] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const selectedKey = getLocalDateKey(selectedDate);
  const readOnly = selectedKey !== getLocalDateKey(today);
  const canWrite = () => !readOnly && selectedKey === getLocalDateKey(new Date(Date.now()));
  const title = t(`companion.practices.${habit.key}.title`);
  const markLabel = t(habit.done ? 'companion.markUndone' : 'companion.markDone');
  const mark = () => {
    if (!canWrite() || saving) return;
    setFailure(false);
    try {
      const pending = onHabitToggle(habit);
      if (pending && typeof pending.then === 'function') {
        setSaving(true);
        void pending.catch(() => setFailure(true)).finally(() => setSaving(false));
      }
    } catch { setFailure(true); }
  };
  const pose: CompanionPose = habit.key === 'exercise' ? 'move' : habit.key === 'journal' ? 'write' : habit.key === 'meditation' ? 'breathe' : habit.key === 'cold-shower' ? 'focus' : 'shield';
  return <Modal visible presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}>
    <SafeAreaView testID="practice-detail-modal" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Text translate={false} accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: '800' }}>{title}</Text>
          <Pressable testID="practice-detail-close" accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text translate={false} style={{ color: colors.accent, fontWeight: '700' }}>{t('companion.close')}</Text></Pressable>
        </View>
        <View style={{ alignSelf: 'center' }}><MomentumCompanion pose={pose} context={`practice:${habit.key}`} category={definition?.category} help={{ title, body: t(`companion.practices.${habit.key}.detail`) }} width={104} height={104} visible interactive /></View>
        <Text translate={false} style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>{t('companion.viewingDate', { date: selectedDate.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }) })}</Text>
        <Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{t(`companion.practices.${habit.key}.detail`)}</Text>
        {(definition?.instructions ?? [habit.detail]).map((instruction, index) => <View key={index} style={{ flexDirection: 'row', gap: 12 }}>
          <Text translate={false} style={{ color: colors.accent, fontSize: 17, lineHeight: 24, fontWeight: '800' }}>{(index + 1).toLocaleString(i18n.language)}.</Text>
          <Text style={{ flex: 1, color: colors.text, fontSize: 17, lineHeight: 24 }}>{instruction}</Text>
        </View>)}
        {readOnly ? <Text translate={false} testID="practice-detail-readonly" style={{ color: colors.text2, fontSize: 15, lineHeight: 24 }}>{t('companion.readOnly')}</Text> : null}
        {definition?.action && onPracticeAction ? <Pressable testID="practice-guided-action" accessibilityRole="button" accessibilityState={{ disabled: readOnly }} disabled={readOnly} onPress={() => { if (canWrite()) { onClose(); onPracticeAction(definition.key); } }} style={({ pressed }) => ({ minHeight: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface, padding: 16, opacity: readOnly ? .6 : pressed ? .7 : 1 })}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '700' }}>{definition.actionLabel}</Text></Pressable> : null}
        <Pressable testID="practice-mark-done" accessibilityRole="button" accessibilityState={{ disabled: readOnly || saving, busy: saving }} disabled={readOnly || saving} onPress={() => void mark()} style={({ pressed }) => ({ minHeight: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.accent, padding: 16, justifyContent: 'center', opacity: readOnly || saving ? .6 : pressed ? .7 : 1 })}><Text translate={false} style={{ color: colors.onAccent, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{markLabel}</Text></Pressable>
        {failure ? <Text testID="practice-save-error" translate={false} accessibilityRole="alert" style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{t('companion.failedSave')}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
