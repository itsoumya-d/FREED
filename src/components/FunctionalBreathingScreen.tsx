import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from './Localized';
import { MomentumBreathingView } from './MomentumBreathingView';
import { ToolCompletionView } from './ToolCompletionView';
import { createBreathingSession, type BreathingSessionMode } from '@/lib/breathing-session';
import { getBreathingPhase } from '@/lib/breathing-cadence';
import { getBreathingArtworkProgress, getBreathingArtworkTiming } from '@/lib/breathing-artwork';
import { getLocalDateKey } from '@/lib/recovery-state';
import { useAppTheme } from '@/design-system/use-app-theme';
import { useMotionSettings } from '@/design-system/motion';
import { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useBreathingAudio } from '@/hooks/use-breathing-audio';
import { useTranslation } from 'react-i18next';
import type { ToolCompletionInput } from '@/lib/tool-completion';

export function FunctionalBreathingScreen({ onBack, onComplete, onSupport, completedSessionIds = [] }: { onBack: () => void; onComplete: (input: ToolCompletionInput, completedAt: Date) => void; onSupport: () => void; completedSessionIds?: readonly string[] }) {
  const {t}=useTranslation();
  const [soundCues,setSoundCues]=React.useState(false);
  const { colors } = useAppTheme(); const motion = useMotionSettings();
  const ref = React.useRef<ReturnType<typeof createBreathingSession> | null>(null); if (!ref.current) ref.current = createBreathingSession(localStorage);
  const session = ref.current;
  const alreadyRecorded = completedSessionIds.includes(session.id);
  const [mode, setMode] = React.useState<BreathingSessionMode>(session.mode); const [running, setRunning] = React.useState(false);
  const [hapticCues, setHapticCues] = React.useState(false); const hapticRef = React.useRef(hapticCues); hapticRef.current = hapticCues; const [seconds, setSeconds] = React.useState<number | null>(session.pending?.seconds ?? (alreadyRecorded ? Math.floor(session.elapsed(performance.now())/1000) : null)); const [sessionError, setSessionError] = React.useState(session.error);
  const configs = {
    gentle: {title:'Comfortable breathing',subtitle:'Follow a comfortable pace without holding your breath.',phases:[{label:'Inhale',kind:'inhale' as const,sec:4,scale:1.08},{label:'Exhale',kind:'exhale' as const,sec:6,scale:1}]},
    '478': { title: '4-7-8 Relaxing Breath', subtitle: 'Breathe in for four seconds, hold for seven, then breathe out for eight.', phases: [{ label: 'Inhale', kind: 'inhale' as const, sec: 4, scale: 1.08 }, { label: 'Hold', kind: 'hold' as const, sec: 7, scale: 1.08 }, { label: 'Exhale', kind: 'exhale' as const, sec: 8, scale: 1 }] },
    box: { title: 'Box Breathing (4-4-4-4)', subtitle: 'Follow four equal phases: breathe in, hold, breathe out, then hold.', phases: [{ label: 'Inhale', kind: 'inhale' as const, sec: 4, scale: 1.08 }, { label: 'Hold', kind: 'hold' as const, sec: 4, scale: 1.08 }, { label: 'Exhale', kind: 'exhale' as const, sec: 4, scale: 1 }, { label: 'Hold Empty', kind: 'hold' as const, sec: 4, scale: 1 }] },
    sigh: { title: 'Physiological Sigh', subtitle: 'Take two gentle inhales, then a longer exhale.', phases: [{ label: 'Deep Inhale', kind: 'inhale' as const, sec: 2, scale: 1.04 }, { label: 'Top-Off Inhale', kind: 'inhale' as const, sec: 1, scale: 1.08 }, { label: 'Long Exhale', kind: 'exhale' as const, sec: 6, scale: 1 }] },
  };
  const config = configs[mode]; const phases = config.phases;
  const phaseNow = () => getBreathingPhase(phases.map(item => item.sec), session.elapsed(performance.now()));
  const [phaseIndex, setPhaseIndex] = React.useState(() => phaseNow().phaseIndex); const [count, setCount] = React.useState(() => phaseNow().secondsRemaining);
  const cycleMs=phases.reduce((total,item)=>total+item.sec*1000,0);
  const audio=useBreathingAudio({enabled:soundCues,active:motion.active,running,key:`${session.id}:${mode}:${Math.floor(session.elapsed(performance.now())/cycleMs)}:${phaseIndex}`,kind:(phases[phaseIndex]??phases[0]).kind});
  const lastPhase = React.useRef(phaseIndex), phase = phases[phaseIndex] ?? phases[0];
  const breathScale = useSharedValue(1), haloScale = useSharedValue(1), artworkProgress = useSharedValue(0);
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ scale: breathScale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ transform: [{ scale: haloScale.value }] }));
  React.useEffect(() => {
    if (!motion.active) { session.pause(performance.now()); setRunning(false); setSessionError(session.error); }
  }, [motion.active, session]);
  React.useEffect(() => {
    if (!running || !motion.active) return;
    const tick = () => { const next = phaseNow(); if (lastPhase.current !== next.phaseIndex && hapticRef.current) void Haptics.selectionAsync().catch(() => undefined); lastPhase.current = next.phaseIndex; setPhaseIndex(next.phaseIndex); setCount(next.secondsRemaining); };
    tick(); const timer = setInterval(tick,250); const checkpoint = setInterval(() => { session.checkpoint(performance.now()); setSessionError(session.error); },1000);
    return () => { clearInterval(timer); clearInterval(checkpoint); session.pause(performance.now()); };
  }, [mode, running, motion.active, session]);
  React.useEffect(() => {
    cancelAnimation(breathScale); cancelAnimation(haloScale); cancelAnimation(artworkProgress);
    if (!motion.spatialMotion) { breathScale.value = 1; haloScale.value = 1; artworkProgress.set(200/950); }
    else if (running) {
      const elapsed = session.elapsed(performance.now()), current = phaseNow(); const timing = getBreathingArtworkTiming(phases.map(item => item.sec), current.phaseIndex, elapsed);
      artworkProgress.set(getBreathingArtworkProgress(phases[current.phaseIndex].label, timing.elapsedRatio));
      artworkProgress.set(withTiming(getBreathingArtworkProgress(phases[current.phaseIndex].label,1), { duration: timing.remainingMs, easing: Easing.linear }));
      breathScale.value = withTiming(phase.scale, { duration: timing.remainingMs, easing: Easing.inOut(Easing.quad) });
      haloScale.value = withTiming(phase.scale, { duration: timing.remainingMs, easing: Easing.inOut(Easing.quad) });
    }
    return () => { cancelAnimation(breathScale); cancelAnimation(haloScale); cancelAnimation(artworkProgress); };
  }, [running, mode, phaseIndex, motion.spatialMotion]);
  const finish = () => { const at = Date.now(); const pending = session.finish(performance.now(), at, getLocalDateKey(new Date(at))); setRunning(false); if (pending) setSeconds(pending.seconds); else onBack(); };
  const close = () => { session.pause(performance.now()); onBack(); };
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>{seconds !== null ? <ToolCompletionView initiallySaved={alreadyRecorded} seconds={seconds} onSave={(helpfulness, practice) => {
    onComplete({ sessionId: session.id, toolId: `breathing-${mode}`, title: config.title, category: 'breathing', startedAt: session.startedAt, activeDurationSec: seconds, dateKey: session.pending!.dateKey, ...(helpfulness ? { helpfulness } : {}), ...(practice ? { practiceKey: 'meditation' as const } : {}) }, new Date(session.pending!.at));
  }} onSkip={() => { session.clear(); onBack(); }} onSupport={() => { session.clear(); onSupport(); }} /> : <View style={{ flex: 1 }}><MomentumBreathingView modes={[{id:'gentle',label:'Gentle (4-6)'},{ id: '478', label: '4-7-8 Relax' },{ id: 'box', label: 'Box (4-4-4-4)' },{ id: 'sigh', label: 'Physio Sigh' }]} mode={mode} onMode={value => { if (!['gentle','478','box','sigh'].includes(value) || value === mode) return; session.reset(value as BreathingSessionMode); setRunning(false); setMode(value as BreathingSessionMode); setPhaseIndex(0); setCount(configs[value as BreathingSessionMode].phases[0].sec); }} title={config.title} subtitle={config.subtitle} phaseLabel={phase.label} count={count} phases={phases.length} phaseIndex={phaseIndex} running={running} onToggle={() => { if (running) session.pause(performance.now()); else session.resume(performance.now()); setRunning(!running); }} onFinish={finish} onClose={close} hapticCues={hapticCues} onHapticCues={setHapticCues} soundCues={soundCues} onSoundCues={setSoundCues} breathStyle={breathStyle} haloStyle={haloStyle} artworkProgress={artworkProgress} />{audio.unavailable ? <Text accessibilityRole="alert" translate={false} style={{color:colors.text2,padding:12}}>{t('momentum.soundUnavailable',{defaultValue:'Sound cues are unavailable. You can continue with the visual guide.'})}</Text> : null}{session.restored ? <Text style={{ color: colors.text2, padding: 12 }}>Saved breathing session restored. Begin to resume.</Text> : null}{sessionError ? <Text accessibilityRole="alert" style={{ color: colors.text2, padding: 12 }}>Session progress could not be kept. Stay here and save your result before leaving.</Text> : null}</View>}</SafeAreaView>;
}
