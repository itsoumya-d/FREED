import React from 'react';
import { ScrollView } from 'react-native';
import { Text, View, Pressable } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';
import { Check } from 'lucide-react-native';
import { localizedNumber } from '@/i18n/runtime';
import type { ChallengeFeedbackOutcome } from '@/lib/recovery-engine';

export function ToolCompletionView({ seconds, onSave, onSkip, onSupport, initiallySaved = false }: { seconds: number; initiallySaved?: boolean; onSave: (feedback: ChallengeFeedbackOutcome | undefined, recordPractice: boolean) => void; onSkip: () => void; onSupport: () => void }) {
  const { colors } = useAppTheme(); const [feedback, setFeedback] = React.useState<ChallengeFeedbackOutcome | undefined>();
  const saved = React.useRef(initiallySaved); const [savedVisible, setSavedVisible] = React.useState(initiallySaved);
  React.useEffect(() => { if (initiallySaved) { saved.current = true; setSavedVisible(true); } }, [initiallySaved]);
  const [practice, setPractice] = React.useState(false); const [failed, setFailed] = React.useState(false); const busy = React.useRef(false);
  return <ScrollView testID="tool-outcome" contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 32, lineHeight: 40, fontWeight: '800' }}>{savedVisible ? 'Session saved' : 'Breathing session finished'}</Text>
    {!savedVisible ? <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{localizedNumber(seconds)} s</Text> : null}
    <Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>Record the activity and optionally tell us whether it helped.</Text>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, fontWeight: '700' }}>Did this help?</Text>
    {([['helped','It helped'],['still-urging','Still need support']] as const).map(([value,label]) => <Pressable key={value} testID={`tool-outcome-${value}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected: feedback === value }} disabled={savedVisible} onPress={() => setFeedback(feedback === value ? undefined : value)} style={{ minHeight: 56, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: feedback === value ? colors.accentTint : colors.surface2 }}><Text style={{ flex: 1, color: colors.text, fontSize: 17 }}>{label}</Text>{feedback === value ? <Check color={colors.accent} size={22} /> : null}</Pressable>)}
    <Pressable testID="tool-record-practice" accessibilityRole="checkbox" accessibilityLabel="Also mark meditation completed" accessibilityState={{ checked: practice }} disabled={savedVisible} onPress={() => setPractice(value => !value)} style={{ minHeight: 56, flexDirection: 'row', gap: 12, alignItems: 'center' }}><View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>{practice ? <Check color={colors.accent} size={18} /> : null}</View><Text style={{ color: colors.text, flex: 1, fontSize: 17 }}>Also mark meditation completed</Text></Pressable>
    {failed ? <Text accessibilityRole="alert" style={{ color: colors.text }}>{savedVisible ? "Session saved. Resume-state cleanup could not finish. Try Continue again." : "Your session could not be saved. The result is still here. Try again."}</Text> : null}
    <Pressable testID="tool-save" accessibilityRole="button" onPress={() => { if (busy.current) return; busy.current = true; try { if (!saved.current) { onSave(feedback,practice); saved.current = true; setSavedVisible(true); } if (feedback === 'still-urging') onSupport(); else onSkip(); } catch { setFailed(true); } finally { busy.current = false; } }} style={{ minHeight: 56, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontSize: 17, fontWeight: '700' }}>{savedVisible ? 'Continue' : 'Save session'}</Text></Pressable>
    {!savedVisible ? <Pressable testID="tool-discard" accessibilityRole="button" onPress={() => { try { onSkip(); } catch { setFailed(true); } }} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text2, fontSize: 17 }}>Leave without recording</Text></Pressable> : null}
  </ScrollView>;
}
