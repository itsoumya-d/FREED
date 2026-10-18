import React from 'react';
import { ScrollView, Switch, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Waves, Heart, X } from 'lucide-react-native';
import { Text, Pressable, View } from './Localized';
import { MomentumCompanion } from './MomentumCompanion';
import { BreathingCadenceArtwork } from './BreathingCadenceArtwork';
import { getPracticePalette } from '@/design-system/app-palette';
import { useAppTheme } from '@/design-system/use-app-theme';

export function MomentumBreathingView({ modes, mode, onMode, title, subtitle, phaseLabel, count, phases, phaseIndex, running, onToggle, onFinish, onClose, hapticCues, onHapticCues, soundCues=false, onSoundCues, breathStyle, haloStyle, artworkProgress }: {
  modes: { id: string; label: string }[]; mode: string; onMode: (id: string) => void; title: string; subtitle: string; phaseLabel: string; count: number; phases: number; phaseIndex: number;
  running: boolean; onToggle: () => void; onFinish: () => void; onClose?: () => void; hapticCues: boolean; onHapticCues: (enabled: boolean) => void; breathStyle: StyleProp<ViewStyle>; haloStyle: StyleProp<ViewStyle>; artworkProgress: SharedValue<number>;
  soundCues?:boolean;onSoundCues?:(enabled:boolean)=>void;
}) {
  const { t } = useTranslation(); const { colors, mode: appearance } = useAppTheme(); const { width, fontScale } = useWindowDimensions();
  const calm = getPracticePalette('calm', appearance); const diameter = Math.min(320, Math.max(160, width - 64));
  return <ScrollView testID="momentum-breathing" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Close breathing exercise" onPress={onClose ?? onFinish} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .65 : 1 })}><X size={24} color={colors.text} /></Pressable>
    <View style={{ gap: 8, alignItems: 'center' }}><Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 32, lineHeight: 40, fontWeight: '800', textAlign: 'center' }}>{t('momentum.breathingReset', { defaultValue: 'Breathing reset' })}</Text><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: 'center' }}>{t('momentum.breathingPace', { defaultValue: 'Follow a comfortable pace.' })}</Text></View>
    <View style={{ alignItems: 'center', paddingVertical: 12, gap: 16 }}>
      <View style={{ width: diameter, height: diameter, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: calm.surface, opacity: .55 }, haloStyle]} />
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: diameter * .86, height: diameter * .86, borderRadius: diameter / 2, backgroundColor: calm.surface }, breathStyle]} />
        <BreathingCadenceArtwork progress={artworkProgress} diameter={diameter} />
        <View><MomentumCompanion pose="breathe" context="breathing" scene={false} category="calm" phaseProgress={artworkProgress} variant="calm" width={diameter * .76} height={diameter * .76} idle={false} /></View>
      </View>
      <View style={{ gap: 4, alignItems: 'center' }}><Text style={{ color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: '800', textAlign: 'center' }}>{phaseLabel}</Text><Text translate={false} style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{t('momentum.breathingSeconds', { count, defaultValue: count === 1 ? '{{count}} second' : '{{count}} seconds' })}</Text></View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 16 }}>{Array.from({ length: phases }, (_, index) => <View key={index} style={{ width: index === phaseIndex ? 16 : 12, height: index === phaseIndex ? 16 : 12, borderRadius: 8, backgroundColor: calm.surface, opacity: index === phaseIndex ? 1 : .4, alignSelf: 'center' }} />)}</View>
    </View>
    <View style={{ gap: 8 }}>
      <Pressable testID="breathing-toggle" onPress={onToggle} accessibilityRole="button" accessibilityLabel={running ? 'Pause Exercise' : 'Begin Breathing'} style={({ pressed }) => ({ minHeight: 56, borderRadius: 16, borderCurve: 'continuous', padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: calm.surface, opacity: pressed ? .72 : 1 })}><Text style={{ color: calm.ink, fontSize: 17, fontWeight: '800' }}>{running ? 'Pause Exercise' : 'Begin Breathing'}</Text></Pressable>
      <Pressable testID="breathing-finish" accessibilityRole="button" onPress={onFinish} style={({ pressed }) => ({ minHeight: 52, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1.5, borderColor: colors.border, padding: 16, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .72 : 1 })}><Text translate={false} style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{t('momentum.finish', { defaultValue: 'Finish' })}</Text></Pressable>
    </View>
    <View style={{ gap: 8 }}>{[{ Icon: Waves, key: 'momentum.breathingPace', fallback: 'Follow a comfortable pace.' }, { Icon: Heart, key: 'momentum.breathingStop', fallback: 'You can stop whenever you need' }].map(({ Icon, key, fallback }) => <View key={key} style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', gap: 12 }}><Icon color={colors.text2} size={24} /><Text translate={false} style={{ flex: 1, color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t(key, { defaultValue: fallback })}</Text></View>)}</View>
    <View style={{ gap: 12, paddingTop: 8 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800' }}>{title}</Text><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{subtitle}</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: fontScale > 1.3 ? 'column' : 'row', gap: 8 }}>{modes.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === mode }} accessibilityLabel={item.label} onPress={() => onMode(item.id)} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 16, borderCurve: 'continuous', padding: 12, backgroundColor: item.id === mode ? colors.accentTint : colors.surface, opacity: pressed ? .7 : 1, justifyContent: 'center' })}><Text style={{ color: item.id === mode ? colors.accent : colors.text, textAlign: 'center', fontSize: 15, lineHeight: 24, fontWeight: '700' }}>{item.label}</Text></Pressable>)}</View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 48 }}><Text style={{ color: colors.text, flex: 1, fontSize: 17 }}>Haptic cues</Text><Switch accessibilityLabel="Haptic cues" value={hapticCues} onValueChange={onHapticCues} trackColor={{ false: colors.border, true: colors.accent }} /></View>
      {onSoundCues ? <View style={{flexDirection:'row',alignItems:'center',gap:16,minHeight:48}}><View style={{flex:1,gap:4}}><Text translate={false} style={{color:colors.text,fontSize:17}}>{t('momentum.soundCues',{defaultValue:'Sound cues'})}</Text><Text translate={false} style={{color:colors.text2,fontSize:15,lineHeight:22}}>{t('momentum.soundCueMeaning',{defaultValue:'Rising tone: breathe in. Falling tone: breathe out. Short tone: hold.'})}</Text></View><Switch accessibilityLabel={t('momentum.soundCues',{defaultValue:'Sound cues'})} value={soundCues} onValueChange={onSoundCues} trackColor={{false:colors.border,true:colors.accent}} /></View> : null}
    </View>
  </ScrollView>;
}
