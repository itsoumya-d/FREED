import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from './DirectionalIcons';
import { ChevronDown } from 'lucide-react-native';
import { Pressable, Text, View } from './Localized';
import { MomentumCompanion, type CompanionVariant, type CompanionPose, type CompanionHelp, type CompanionCue } from './MomentumCompanion';
import { CompanionBackdrop } from './CompanionBackdrop';
import { getCategoryPanelPalette, type PracticeCategory } from '@/design-system/app-palette';
import { useAppTheme } from '@/design-system/use-app-theme';

const Visibility = React.createContext(true);
export function MomentumVisibility({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const parent = React.useContext(Visibility);
  return <Visibility.Provider value={visible && parent}>{children}</Visibility.Provider>;
}
export function MomentumPageHeader({ title, description, category = 'reflection', variant = 'progress', pose, context = 'screen', help, cue, compact = false, restrained = false, translateTitle = true, translateDescription = true, children }: {
  title: string; description?: string; category?: PracticeCategory; variant?: CompanionVariant; pose?: CompanionPose; context?: string; help?: CompanionHelp; cue?: CompanionCue; compact?: boolean; restrained?: boolean; translateTitle?: boolean; translateDescription?: boolean; children?: React.ReactNode;
}) {
  const { mode, colors } = useAppTheme(); const palette = getCategoryPanelPalette(category, mode);
  const { width, fontScale } = useWindowDimensions(); const visible = React.useContext(Visibility);
  const preservesWelcomeArt = ['home', 'onboarding', 'paywall'].some(prefix => context.startsWith(prefix)) || context.startsWith('quiz-') || context === 'planCalculation' || context === 'appSelection';
  const interior = !preservesWelcomeArt;
  const stacked = width < 360 || fontScale > 1.3; const size = interior ? 48 : restrained ? 56 : compact ? 72 : 104;
  return <View testID="momentum-page-header" style={{ borderRadius: 20, borderCurve: 'continuous', backgroundColor: interior ? colors.surface : palette.surface, padding: interior ? 16 : compact ? 16 : 20, gap: 12 }}>
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'center', gap: 12 }}>
      <View style={{ flex: stacked ? undefined : 1, width: stacked ? '100%' : undefined, minWidth: 0, gap: 8 }}><Text translate={translateTitle} accessibilityRole="header" style={{ minWidth: 0, maxWidth: '100%', color: interior ? colors.text : palette.ink, fontSize: interior ? 24 : compact ? 24 : 32, lineHeight: interior ? 32 : compact ? 32 : 40, fontWeight: '800', letterSpacing: -.6 }}>{title}</Text>{description ? <Text translate={translateDescription} style={{ minWidth: 0, maxWidth: '100%', color: interior ? colors.text2 : palette.ink, fontSize: interior ? 15 : 17, lineHeight: interior ? 22 : 24 }}>{description}</Text> : null}</View>
      <View style={{ flexShrink: 0 }}><MomentumCompanion variant={variant} pose={pose} context={context} category={category} help={help} cue={cue} backdrop={size >= 104 ? <CompanionBackdrop pose={pose} category={category} /> : undefined} width={size} height={size} interactive visible={visible} idle={!interior && !restrained} /></View>
    </View>
    {children}
  </View>;
}
/** Colored meaning belongs to the section header; private fields keep a neutral, readable body. */
export function MomentumSection({ title, category = 'reflection', companion = false, variant = 'progress', children, collapsible = false, initiallyExpanded = true, style, testID }: {
  title?: string; category?: PracticeCategory; companion?: boolean; variant?: CompanionVariant; children: React.ReactNode; collapsible?: boolean; initiallyExpanded?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { colors, mode } = useAppTheme(); const palette = getCategoryPanelPalette(category, mode);
  const [expanded, setExpanded] = React.useState(initiallyExpanded); const visible = React.useContext(Visibility);
  const heading = <><Text accessibilityRole="header" style={{ flex: 1, minWidth: 0, maxWidth: '100%', color: palette.ink, fontSize: 21, lineHeight: 28, fontWeight: '800' }}>{title}</Text>{companion ? <View style={{ flexShrink: 0 }}><MomentumCompanion variant={variant} width={56} height={56} interactive visible={visible} /></View> : null}{collapsible ? <View style={{ flexShrink: 0 }}>{expanded ? <ChevronDown color={palette.ink} size={20} /> : <ChevronRight color={palette.ink} size={20} />}</View> : null}</>;
  return <View testID={testID} style={{ borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
    {title ? collapsible ? <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 56, borderTopStartRadius: 20, borderTopEndRadius: 20, backgroundColor: palette.surface, opacity: pressed ? .75 : 1 })}>{heading}</Pressable> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderTopStartRadius: 20, borderTopEndRadius: 20, backgroundColor: palette.surface }}>{heading}</View> : <View style={{ height: 8, borderTopStartRadius: 20, borderTopEndRadius: 20, backgroundColor: palette.surface }} />}
    <MomentumVisibility visible={!collapsible || expanded}><View accessibilityElementsHidden={collapsible && !expanded} importantForAccessibility={collapsible && !expanded ? 'no-hide-descendants' : 'auto'} style={[{ display: !collapsible || expanded ? 'flex' : 'none', padding: 16, gap: 12 }, style]}>{children}</View></MomentumVisibility>
  </View>;
}
export function MomentumMetricStrip({ children }: { children: React.ReactNode }) {
  const { width, fontScale } = useWindowDimensions(); const stack = width < 360 || fontScale > 1.3;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{React.Children.map(children, child => <View style={{ flexGrow: 1, flexBasis: stack ? '100%' : '28%', minWidth: stack ? 0 : 96 }}>{child}</View>)}</View>;
}

/** NativeTabs adjusts the first iOS ScrollView. Other hosts can supply their measured bar height. */
export function useMomentumBottomPadding(measuredTabBarHeight?: number) {
  const insets = useSafeAreaInsets();
  const bar = measuredTabBarHeight !== undefined && Number.isFinite(measuredTabBarHeight) ? Math.max(0, measuredTabBarHeight) : 0;
  return 24 + (bar > 0 ? Math.max(insets.bottom, bar) : Platform.OS === 'ios' ? 0 : insets.bottom);
}
