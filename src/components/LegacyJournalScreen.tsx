import React from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, TextInput, Pressable } from './Localized';
import { ChevronLeft } from './DirectionalIcons';
import { useAppTheme } from '@/design-system/use-app-theme';
import { useRecoveryDraft } from '@/hooks/use-recovery-draft';
import { getLocalDateKey, type DailyCheckIn } from '@/lib/recovery-state';
import { getRetainedJournalDraftDate, RECOVERY_DRAFT_LIMITS } from '@/lib/recovery-drafts';
import { useTodayClock } from './use-today-clock';
import { useMotionSettings } from '@/design-system/motion';
import { MomentumPageHeader } from './MomentumPageHeader';
import { useTranslation } from 'react-i18next';

export function LegacyJournalScreen({ record, history = [], onSave, onBack }: { record: DailyCheckIn | null; history?: readonly DailyCheckIn[]; onSave: (reflection: string, dateKey: string, mode?: 'edit-existing') => void; onBack: () => void }) {
  const { colors } = useAppTheme(); const now = useTodayClock(useMotionSettings().active); const todayKey = getLocalDateKey(new Date(now));
  const {t,i18n}=useTranslation();
  const [dateKey, setDateKey] = React.useState(() => getRetainedJournalDraftDate(localStorage, todayKey));
  const [historicalSelection,setHistoricalSelection]=React.useState(false);
  const selectedRecord=history.find(item=>item.dateKey===dateKey) ?? (record?.dateKey===dateKey ? record : null);
  const transfer = React.useRef<string | null>(null);
  const draft = useRecoveryDraft('journal', { reflection: selectedRecord?.reflection ?? '' }, { dateKey });
  React.useEffect(() => { if (transfer.current !== null) { const reflection = transfer.current; transfer.current = null; draft.update({ reflection }); } }, [dateKey]);
  const changed = !historicalSelection && dateKey !== todayKey;
  const hasUnsavedChanges=draft.value.reflection !== (selectedRecord?.reflection ?? '') || Boolean(draft.error);
  const dateLabel=(key:string)=>new Intl.DateTimeFormat(i18n.language,{year:'numeric',month:'short',day:'numeric'}).format(new Date(`${key}T12:00:00`));
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ScrollView testID="journal-editor" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ minWidth: 44, minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' }}><ChevronLeft color={colors.text} size={24} /></Pressable>
    <MomentumPageHeader title="Journal" description="Write what is on your mind. Your note stays private on this device." pose="write" context="journal" category="reflection" compact restrained />
    {historicalSelection ? <Text translate={false} style={{color:colors.text2,fontSize:17}}>{t('momentum.journalEditingDate',{defaultValue:'Editing {{date}}',date:dateLabel(dateKey)})}</Text> : null}
    {changed ? <View style={{ backgroundColor: colors.surface, padding: 16, gap: 12, borderRadius: 16 }}><Text accessibilityRole="alert" style={{ color: colors.text }}>A new day has started. Keep this draft and move it to today's entry.</Text><Pressable accessibilityRole="button" onPress={() => { transfer.current = draft.value.reflection; setDateKey(getLocalDateKey(new Date())); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Use draft today</Text></Pressable></View> : null}
    <TextInput testID="journal-reflection" accessibilityLabel="Private journal note" value={draft.value.reflection} onChangeText={reflection => draft.update({ reflection })} multiline editable={!draft.committed} maxLength={RECOVERY_DRAFT_LIMITS.reflection} placeholder="What happened? What helped? What do you need next?" placeholderTextColor={colors.text3} style={{ minHeight: 240, padding: 16, backgroundColor: colors.surface, borderRadius: 16, color: colors.text, fontSize: 17, lineHeight: 26, textAlignVertical: 'top' }} />
    <Text accessibilityRole={draft.error ? 'alert' : undefined} style={{ color: colors.text2, lineHeight: 24 }}>{draft.error ?? draft.notice}</Text>
    <Pressable testID="journal-save" accessibilityRole="button" accessibilityState={{ disabled: changed || !draft.value.reflection.trim() || (draft.committed && !draft.error) }} disabled={changed || !draft.value.reflection.trim() || (draft.committed && !draft.error)} onPress={() => { if (draft.save(value => historicalSelection ? onSave(value.reflection, dateKey,'edit-existing') : onSave(value.reflection,dateKey)).ok) onBack(); }} style={({ pressed }) => ({ minHeight: 56, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: changed || !draft.value.reflection.trim() || (draft.committed && !draft.error) ? .4 : pressed ? .7 : 1 })}><Text style={{ color: colors.onAccent, fontSize: 17, fontWeight: '700' }}>Save journal note</Text></Pressable>
    <Text style={{ color: colors.text2, fontSize: 13, lineHeight: 20 }}>Saving a note preserves your check-in answers. It does not log a setback.</Text>
    {history.some(item=>item.reflection.trim()) ? <View style={{gap:12}}>
      <Text translate={false} accessibilityRole="header" style={{color:colors.text,fontSize:23,fontWeight:'800'}}>{t('momentum.journalHistory',{defaultValue:'Your journal entries'})}</Text>
      {hasUnsavedChanges ? <Text translate={false} style={{color:colors.text2,lineHeight:24}}>{t('momentum.journalSaveBeforeSwitch',{defaultValue:'Save this draft before opening another entry.'})}</Text> : null}
      {[...history].filter(item=>item.reflection.trim()).sort((a,b)=>b.dateKey.localeCompare(a.dateKey)).slice(0,30).map(item=><Pressable key={item.id} testID={`journal-entry-${item.dateKey}`} accessibilityRole="button" accessibilityLabel={dateLabel(item.dateKey)} accessibilityState={{disabled:hasUnsavedChanges}} disabled={hasUnsavedChanges} onPress={()=>{setHistoricalSelection(true);setDateKey(item.dateKey);}} style={({pressed})=>({padding:16,minHeight:72,borderRadius:20,backgroundColor:colors.surface,opacity:hasUnsavedChanges?.5:pressed?.7:1,gap:8})}>
        <Text translate={false} style={{color:colors.accent,fontWeight:'700'}}>{dateLabel(item.dateKey)}</Text>
        <Text translate={false} numberOfLines={2} style={{color:colors.text2,lineHeight:24}}>{item.reflection}</Text>
      </Pressable>)}
    </View> : null}
  </ScrollView></SafeAreaView>;
}
