import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelAnimation, Easing, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useMotionSettings } from '@/design-system/motion';
import { useCompanionViewport } from '@/hooks/use-companion-viewport';
import { getAppPalette } from '@/design-system/app-palette';
import { useOptionalAppPreferences } from '@/hooks/use-app-preferences';
import { createCompanionCueRegistry, resolveCompanionPose, companionMayAnimate, type CompanionVariant, type CompanionPose, type CompanionCategory, type CompanionCue, type CompanionHelp } from '@/lib/companion-policy';
import { KiteCompanionRig } from './KiteCompanionRig';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
export type { CompanionVariant, CompanionPose, CompanionCategory, CompanionCue, CompanionHelp } from '@/lib/companion-policy';
export type MomentumCompanionProps = {
    variant?: CompanionVariant;
    width?: number;
    height?: number;
    interactive?: boolean;
    visible?: boolean;
    idle?: boolean;
    pose?: CompanionPose;
    category?: CompanionCategory;
    context?: string;
    help?: CompanionHelp;
    cue?: CompanionCue;
    phaseProgress?: SharedValue<number>;
    scene?: boolean;
    motionEnabled?: boolean;
    backdrop?: React.ReactNode;
};
let processCues: ReturnType<typeof createCompanionCueRegistry> | undefined;
function cueRegistry() {
    return processCues ?? (processCues = createCompanionCueRegistry({ getItem: key => globalThis.localStorage?.getItem(key) ?? null, setItem: (key, value) => globalThis.localStorage?.setItem(key, value), removeItem: key => globalThis.localStorage?.removeItem(key) }));
}
/** Explicit local-data deletion. Failed ledger erasure throws to the deletion caller. */
export function clearCompanionPresentationHistory(): void {
    cueRegistry().clear();
    processCues = undefined;
}
/** Contextual presentation. Saved/earned cues must be issued after the caller's durable state commit. */
export function MomentumCompanion({ variant = 'progress', width = 144, height = 144, interactive = true, visible = true, idle = true, pose, category, context, help, cue, phaseProgress, scene = width >= 88, motionEnabled = true, backdrop }: MomentumCompanionProps) {
    const { t } = useTranslation();
    // Optional reader permits provider-free illustrations; production calls always follow the same hook order.
    const preferences = typeof useOptionalAppPreferences === 'function' ? useOptionalAppPreferences() : null;
    const colors = getAppPalette(preferences?.mode);
    const insets = useSafeAreaInsets();
    const settings = useMotionSettings(visible);
    const basePose = resolveCompanionPose(pose, variant);
    const [cuePose, setCuePose] = React.useState<CompanionPose | null>(null);
    const [open, setOpen] = React.useState(false);
    // Central measurement also protects direct callers that have no header wrapper.
    // Keep screen eligibility separate: opening help pauses the rig without closing help.
    const viewport = useCompanionViewport(visible && !open);
    const presentationActive = settings.active && viewport.visible && !open;
    const animate = settings.spatialMotion && companionMayAnimate({
        visible: presentationActive, focused: settings.focused, foreground: settings.foreground, reduceMotion: settings.reduceMotion,
        motionEnabled: motionEnabled && preferences?.preferences.companionMotion !== 'off',
    });
    const currentPose = cuePose ?? basePose;
    // Hop feedback is reserved for welcoming/earned moments. Calm, urgent,
    // purchase and destructive contexts keep their stable silhouette.
    const hopEligible = (basePose === 'welcome' || basePose === 'guide' || basePose === 'move' || basePose === 'celebrate' || basePose === 'saved')
        && !/urge|urgent|purchase|paywall|checkout|delete|destruct|reset/i.test(context ?? '');
    const drift = useSharedValue(0), gesture = useSharedValue(0), blink = useSharedValue(0);
    React.useEffect(() => {
        cancelAnimation(drift);
        cancelAnimation(blink);
        cancelAnimation(gesture);
        drift.value = 0;
        blink.value = 0;
        gesture.value = 0;
        if (animate && idle) {
            drift.value = withRepeat(withTiming(1, { duration: currentPose === 'breathe' || currentPose === 'rest' ? 3200 : 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
            blink.value = withRepeat(withSequence(withDelay(3600, withTiming(1, { duration: 110 })), withTiming(0, { duration: 150 })), -1, false);
        }
        return () => { cancelAnimation(drift); cancelAnimation(blink); cancelAnimation(gesture); };
    }, [animate, idle, currentPose, drift, blink, gesture]);
    React.useEffect(() => { if (!settings.active) {
        setOpen(false);
        setCuePose(null);
    } }, [settings.active]);
    React.useEffect(() => {
        if (basePose === 'welcome' && hopEligible && animate && presentationActive && cueRegistry().consume({ id: 'entrance:' + (context ?? 'welcome'), pose: 'welcome' }, true))
            gesture.value = withSequence(withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }), withSpring(0, { duration: 280, dampingRatio: .8 }));
    }, [basePose, hopEligible, animate, presentationActive, context, gesture]);
    const cueId = cue?.id, cueValue = cue?.pose, earned = cue?.earned;
    React.useEffect(() => {
        setCuePose(null);
        if (!cueId || !cueValue || !cueRegistry().consume({ id: cueId, pose: cueValue, earned }, presentationActive))
            return;
        setCuePose(cueValue);
        // A single expiry schedules no frame work and is cancelled on navigation/background.
        const expiry = setTimeout(() => setCuePose(null), 1800);
        return () => clearTimeout(expiry);
    }, [cueId, cueValue, earned, presentationActive]);
    React.useEffect(() => {
        if (animate && cuePose && hopEligible)
            gesture.value = withSequence(withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }), withSpring(0, { duration: 280, dampingRatio: .8 }));
    }, [animate, cuePose, hopEligible, gesture]);
    const contextualHelp = help ?? { title: t(`companion.poses.${basePose}.helpTitle`), body: t(`companion.poses.${basePose}.helpBody`) };
    const actions = contextualHelp.actions?.slice(0, 2) ?? [];
    const closeLabel = t('companion.closeHelp');
    const button = (label: string, onPress: () => void, key: string, primary = false) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: primary ? colors.accent : colors.surface2, opacity: pressed ? .7 : 1 })}><Text style={{ fontSize: 16, fontWeight: '700', textAlign: 'center', color: primary ? colors.onAccent : colors.text }}>{label}</Text></Pressable>;
    return <View ref={viewport.ref} onLayout={viewport.onLayout} collapsable={false} testID={context ? 'companion-' + context : undefined} style={{ width, height, overflow: 'hidden' }} accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>
  {backdrop && <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }}>{backdrop}</View>}
  <Pressable accessible={viewport.visible} accessibilityElementsHidden={!viewport.visible} importantForAccessibility={viewport.visible ? 'auto' : 'no-hide-descendants'} accessibilityRole={interactive ? 'button' : 'image'} accessibilityLabel={`${t('companion.label')}. ${t(`companion.poses.${basePose}.label`)}`} accessibilityHint={interactive ? t('companion.helpHint') : undefined} accessibilityState={{ disabled: !interactive || !presentationActive }} disabled={!interactive || !presentationActive} onPressIn={() => { if (animate && hopEligible) { cancelAnimation(gesture); gesture.value = withSpring(1, { duration: 180, dampingRatio: 1 }); } }} onPressOut={() => { if (animate && hopEligible) gesture.value = withSpring(0, { duration: 240, dampingRatio: .8 }); }} onPress={() => { void Haptics.selectionAsync().catch(() => undefined); setOpen(true); }} style={({ pressed }) => ({ width, height, opacity: pressed ? .85 : 1 })}>
   <KiteCompanionRig pose={currentPose} width={width} height={height} animated={animate} drift={drift} gesture={gesture} blink={blink} phaseProgress={phaseProgress} scene={scene && !backdrop} category={category} dark={preferences?.mode === 'dark'}/>
  </Pressable>
  <Modal visible={open && settings.active} animationType="none" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
   <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ paddingHorizontal: 24, paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24), gap: 20 }} accessibilityViewIsModal>
    <View style={{ alignSelf: 'center' }}><KiteCompanionRig pose={basePose} width={128} height={140} animated={false} drift={drift} gesture={gesture} blink={blink} scene category={category} dark={preferences?.mode === 'dark'}/></View>
    <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: '700', color: colors.text }}>{contextualHelp.title}</Text>
    <Text selectable style={{ fontSize: 17, lineHeight: 26, color: colors.text2 }}>{contextualHelp.body}</Text>
    {actions.map((action, index) => button(action.label, () => { setOpen(false); action.onPress(); }, `action-${index}`, index === 0))}
    {button(closeLabel, () => setOpen(false), 'close')}
   </ScrollView>
  </Modal>
 </View>;
}
