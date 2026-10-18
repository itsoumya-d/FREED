import React from 'react';
import { ScrollView, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text, View, Pressable } from './Localized';
import { ChevronLeft, ChevronRight } from './DirectionalIcons';
import { useAppTheme } from '@/design-system/use-app-theme';
import { localizedNumber } from '@/i18n/runtime';
import { getLocalDateKey } from '@/lib/recovery-state';
export function RecoveryMonthPicker({ value, maximumDate, onChange }: { value: Date; maximumDate: Date; onChange: (date: Date) => void }) {
  const { colors } = useAppTheme(); const { t, i18n } = useTranslation(); const { width } = useWindowDimensions();
  const [month, setMonth] = React.useState(() => new Date(value.getFullYear(), value.getMonth(), 1, 12));
  const offset = (month.getDay() + 6) % 7;
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12);
  const nextDisabled = getLocalDateKey(nextMonth) > getLocalDateKey(maximumDate);
  return <View style={{ gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable testID="calendar-previous-month" accessibilityRole="button" accessibilityLabel={t('companion.previousMonth')} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={22} color={colors.accent} /></Pressable>
      <Text translate={false} accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '700', textAlign: 'center' }}>{month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}</Text>
      <Pressable testID="calendar-next-month" accessibilityRole="button" accessibilityLabel={t('companion.nextMonth')} accessibilityState={{ disabled: nextDisabled }} disabled={nextDisabled} onPress={() => { if (!nextDisabled) setMonth(nextMonth); }} style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: nextDisabled ? .5 : 1 }}><ChevronRight size={22} color={colors.accent} /></Pressable>
    </View>
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ width: Math.max(308, width - 48), flexDirection: 'row', flexWrap: 'wrap' }}>
        {Array.from({ length: 7 }, (_, index) => <Text key={`weekday-${index}`} translate={false} style={{ width: '14.2857%', textAlign: 'center', color: colors.text2, fontSize: 13, lineHeight: 20, paddingVertical: 8 }}>{new Date(2026, 5, 1 + index).toLocaleDateString(i18n.language, { weekday: 'short' })}</Text>)}
        {Array.from({ length: 42 }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > total) return <View key={`empty-${index}`} style={{ width: '14.2857%', minHeight: 44 }} />;
          const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
          const key = getLocalDateKey(date), selected = key === getLocalDateKey(value), future = key > getLocalDateKey(maximumDate);
          return <Pressable key={key} testID={`calendar-month-day-${key}`} accessibilityRole="button" accessibilityLabel={date.toLocaleDateString(i18n.language, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} accessibilityState={{ selected, disabled: future }} disabled={future} onPress={() => { if (!future && key <= getLocalDateKey(new Date(Date.now()))) onChange(date); }} style={({ pressed }) => ({ width: '14.2857%', minHeight: 44, padding: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : pressed ? colors.surface2 : 'transparent', borderRadius: 16, borderCurve: 'continuous', opacity: future ? .5 : 1 })}><Text translate={false} style={{ color: selected ? colors.onAccent : colors.text, fontSize: 17, fontVariant: ['tabular-nums'] }}>{localizedNumber(day)}</Text></Pressable>;
        })}
      </View>
    </ScrollView>
  </View>;
}
