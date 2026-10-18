import React from 'react';
import { useSharedValue } from 'react-native-reanimated';
import { View } from './Localized';
import { KiteCompanionRig } from './KiteCompanionRig';
import { useAppTheme } from '@/design-system/use-app-theme';
import { getPracticePalette, type PracticeCategory } from '@/design-system/app-palette';

export const challengeCategory = (group: string): PracticeCategory => group === 'breathe' ? 'calm' : group === 'find' ? 'commitment' : 'movement';
/** Decorative rig: no nested button or second accessibility stop. */
export function ChallengeCategoryArt({ group, size = 80 }: { group: string; size?: number }) {
  const { mode } = useAppTheme();
  const still = useSharedValue(0);
  const palette = getPracticePalette(challengeCategory(group), mode);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.surface }}>
    <KiteCompanionRig pose={group === 'breathe' ? 'breathe' : group === 'find' ? 'focus' : 'move'} category={challengeCategory(group)} width={size} height={size} animated={false} drift={still} gesture={still} blink={still} scene={false} dark={mode === 'dark'} />
  </View>;
}

