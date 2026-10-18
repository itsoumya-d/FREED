import React from 'react';
import { ScrollView } from 'react-native';
import { Text, Pressable } from './Localized';
import { MomentumPageHeader, useMomentumBottomPadding } from './MomentumPageHeader';
import { useAppTheme } from '@/design-system/use-app-theme';
import { useTodayClock } from './use-today-clock';
import { useMotionSettings } from '@/design-system/motion';
import { getLocalDateKey } from '@/lib/recovery-state';
export function BasicMovementScreen({ onRecord, onBack, recorded, recordedDateKey }: { onRecord: (dateKey: string) => void | Promise<void>; onBack: () => void; recorded: boolean; recordedDateKey?: string | null }) {
 const { colors } = useAppTheme(), bottom = useMomentumBottomPadding();
 useTodayClock(useMotionSettings().active);
 const todayKey = getLocalDateKey(new Date());
 const [chosenDate,setChosenDate] = React.useState<string | null>(null), [savedDate,setSavedDate] = React.useState<string | null>(null), [failedDate,setFailedDate] = React.useState<string | null>(null), [busy,setBusy] = React.useState(false);
 const chosen = chosenDate === todayKey, saved = savedDate === todayKey;
 const failure = failedDate === todayKey, recordedToday = recorded && (!recordedDateKey || recordedDateKey === todayKey);
 const pending = React.useRef(false);
 const save = async () => { const dateKey = getLocalDateKey(new Date()); if (chosenDate !== dateKey || (recorded && (!recordedDateKey || recordedDateKey === dateKey)) || savedDate === dateKey || pending.current) return; pending.current = true; setBusy(true); setFailedDate(null); try { await onRecord(dateKey); setSavedDate(dateKey); } catch { setFailedDate(dateKey); } finally { pending.current = false; setBusy(false); } };
 return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{padding:24,gap:20,paddingBottom:bottom}}><MomentumPageHeader title="Basic movement" description="A free pause at your own pace." category="movement" pose="move" compact />
 <Text style={{color:colors.text,lineHeight:26}}>Stand or sit comfortably. Relax your shoulders and notice your feet touching the ground.</Text><Text style={{color:colors.text,lineHeight:26}}>Choose a short walk, gentle stretch or comfortable movement. Stop whenever you need to.</Text><Text style={{color:colors.text2,lineHeight:24}}>This is your own exercise record. It does not verify a guided session or unlock protected apps.</Text>
 {saved || recordedToday ? <Text testID="movement-saved" accessibilityLiveRegion="polite" style={{color:colors.text}}>Exercise recorded for today.</Text> : <><Pressable testID="movement-self-report" accessibilityRole="checkbox" accessibilityState={{checked:chosen}} onPress={() => { const dateKey = getLocalDateKey(new Date()); setChosenDate(value => value === dateKey ? null : dateKey); }} style={{minHeight:56,padding:16,borderRadius:16,backgroundColor:colors.surface}}><Text style={{color:colors.text}}>{chosen ? '✓ ' : ''}I completed exercise today</Text></Pressable><Pressable testID="movement-save" accessibilityRole="button" disabled={!chosen || busy} accessibilityState={{disabled:!chosen || busy,busy}} onPress={() => void save()} style={{minHeight:56,padding:16,borderRadius:16,backgroundColor:colors.accent,opacity:!chosen || busy ? .5 : 1}}><Text style={{color:colors.onAccent,fontWeight:'700'}}>{failure ? 'Retry recording exercise' : 'Record exercise'}</Text></Pressable></>}
 {failure ? <Text accessibilityRole="alert" style={{color:colors.text}}>Exercise could not be saved. Your choice is still here. Try again.</Text> : null}<Pressable accessibilityRole="button" onPress={onBack} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:colors.accent}}>Back</Text></Pressable></ScrollView>;
}
