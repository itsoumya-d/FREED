import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from './Localized';
import { getCategoryPanelPalette } from '@/design-system/app-palette';
import { SpringPressable } from '@/design-system/motion';
import { useAppTheme } from '@/design-system/use-app-theme';
import type { RecoveryChallenge } from '@/lib/recovery-engine';
import type { ChallengeChoiceGroup } from '@/lib/challenge-rules';
import { ChallengeCategoryArt, challengeCategory } from './ChallengeCategoryArt';
import { resetRecoveryPresentation } from './reset-recovery-presentation';

export function ResetChoicePicker({ choices, onChoose, rewardLabel, showUnavailableFind = false, loading = false, onRetry, onBack }: {
  choices: readonly { group: ChallengeChoiceGroup; challenge: RecoveryChallenge }[];
  onChoose: (challenge: RecoveryChallenge) => void;
  rewardLabel?: (challenge: RecoveryChallenge) => string | null;
  showUnavailableFind?: boolean;
  loading?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
}) {
  const { mode, colors } = useAppTheme(); const { t, i18n } = useTranslation();
  const rtl = i18n.language === 'ar';
  if (!choices.length) return <View testID="reset-choice-empty" accessibilityLiveRegion="polite" style={{ gap: 12 }}><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t(loading ? 'resetChoices.checking' : 'uiRefinement.noChoices')}</Text>{!loading && onRetry ? <SpringPressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text></SpringPressable> : null}{!loading && onBack ? <SpringPressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontWeight: '700' }}>Back to safety</Text></SpringPressable> : null}</View>;
  return <View testID="reset-choice-picker" style={{ gap: 12 }}>
    {(['breathe', 'move', 'find'] as const).map(group => {
      const methods = choices.filter(choice => choice.group === group);
      if (!methods.length && !(group === 'find' && showUnavailableFind)) return null;
      const palette = getCategoryPanelPalette(challengeCategory(group), mode);
      const label = t(`resetChoices.${group}`);
      const cardStyle = { padding: 14, gap: 12, flexDirection: rtl ? 'row-reverse' as const : 'row' as const, alignItems: 'flex-start' as const, borderRadius: 24, borderCurve: 'continuous' as const, backgroundColor: palette.surface };
      const heading = <Text translate={false} accessibilityRole="header" style={{ color: palette.ink, fontSize: 21, lineHeight: 28, fontWeight: '800', textAlign: rtl ? 'right' : 'left' }}>{label}</Text>;
      const method = (challenge: RecoveryChallenge) => {
        const reward = rewardLabel?.(challenge);
        const choiceId = challenge.verification?.kind === 'steps' ? `${group}-steps` : group;
        const { title, requirement, detail } = resetRecoveryPresentation(challenge, group, t);
        const accessibilityLabel = `${label}. ${title}. ${requirement}${detail ? ` ${detail}` : ''}${reward ? ` ${reward}` : ''}`;
        const content = <>
          <Text translate={false} style={{ color: palette.ink, fontSize: 17, lineHeight: 24, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>{title} {rtl ? '←' : '→'}</Text>
          <Text translate={false} style={{ color: palette.secondaryInk, fontSize: 15, lineHeight: 22, textAlign: rtl ? 'right' : 'left' }}>{requirement}</Text>
          {detail ? <Text translate={false} style={{ color: palette.secondaryInk, fontSize: 15, lineHeight: 22, textAlign: rtl ? 'right' : 'left' }}>{detail}</Text> : null}
          {reward ? <Text translate={false} testID={`reset-reward-${choiceId}`} style={{ color: palette.ink, fontSize: 15, lineHeight: 22, textAlign: rtl ? 'right' : 'left' }}>{reward}</Text> : null}
        </>;
        return { choiceId, accessibilityLabel, content };
      };
      if (methods.length === 1) {
        const challenge = methods[0].challenge;
        const { choiceId, accessibilityLabel, content } = method(challenge);
        return <View key={group} testID={`reset-category-${group}`}>
          <SpringPressable testID={`reset-choice-${choiceId}`} haptic={false} feedback="scale" pressedScale={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => onChoose(challenge)} style={cardStyle}>
            <ChallengeCategoryArt group={group} size={56} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>{heading}{content}</View>
          </SpringPressable>
        </View>;
      }
      return <View key={group} testID={`reset-category-${group}`} style={cardStyle}>
        <ChallengeCategoryArt group={group} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          {heading}
          {methods.map(({ challenge }) => {
            const { choiceId, accessibilityLabel, content } = method(challenge);
            return <SpringPressable key={challenge.id} testID={`reset-choice-${choiceId}`} haptic={false} feedback="scale" pressedScale={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => onChoose(challenge)} style={{ minHeight: 56, padding: 12, marginTop: 8, gap: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>{content}</SpringPressable>;
          })}
          {!methods.length ? <Text translate={false} testID="reset-find-unavailable" style={{ color: palette.secondaryInk, fontSize: 15, lineHeight: 22, textAlign: rtl ? 'right' : 'left' }}>{t('resetChoices.findUnavailable')}</Text> : null}
        </View>
      </View>;
    })}
  </View>;
}
