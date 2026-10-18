import React from 'react';
import { Pressable, Text } from './Localized';
import { appI18n, translateSource } from '@/i18n/runtime';
/** Compose authored units around a private title without re-translating that title. */
export function ChallengeOption({ title, minutes, custom, onPress, children }: { title: string; minutes: number; custom: boolean; onPress: () => void; children?: React.ReactNode }) {
  const label = appI18n.t('momentum.challengeDuration', { title: custom ? title : translateSource(title), count: minutes,
    defaultValue: minutes === 1 ? '{{title}}, {{count}} minute' : '{{title}}, {{count}} minutes' });
  return <Pressable translate={false} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>{children}</Pressable>;
}
export function ChallengeText({ custom, ...props }: React.ComponentProps<typeof Text> & { custom: boolean }) {
  return <Text {...props} translate={!custom && props.translate !== false} />;
}
