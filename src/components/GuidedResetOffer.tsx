import { useTranslation } from 'react-i18next';
import type { RewardedDiagnosticReceipt } from '../lib/rewarded-ad-diagnostics';
import React from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, View, Pressable } from './Localized';
import { ChallengeCategoryArt } from './ChallengeCategoryArt';
import { useAppTheme } from '../design-system/use-app-theme';
import type { GuidedTier } from '../lib/guided-reset-access';
import type { RecoveryChallenge } from '../lib/recovery-engine';
import { resetRecoveryPresentation } from './reset-recovery-presentation';
export function GuidedResetOffer({ tier, protectionOrigin, challenge, previewMode = 'resume', busy, notice, repairNeeded, resumable, cleanupPending = false, onRetryCleanup, onStart, onWatch, onRepair, onRetry, onPro, onSafety, onHelp, earnedTimeOffer, accessBlocked = false, diagnostic, adPrivacyRequired = false, adPrivacyBusy = false, adPrivacyNotice, onAdPrivacyOptions }: {
    previewMode?: 'choices' | 'resume';
    diagnostic?: RewardedDiagnosticReceipt | null;
    adPrivacyRequired?: boolean;
    adPrivacyBusy?: boolean;
    adPrivacyNotice?: string | null;
    onAdPrivacyOptions?: () => void;
    earnedTimeOffer?: React.ReactNode;
    accessBlocked?: boolean;
    tier: GuidedTier;
    protectionOrigin: boolean;
    challenge: RecoveryChallenge;
    busy: boolean;
    notice: string | null;
    repairNeeded: boolean;
    resumable: boolean;
    cleanupPending?: boolean;
    onRetryCleanup?: () => void;
    onStart: () => void;
    onWatch: () => void;
    onRepair: () => void;
    onRetry: () => void;
    onPro: () => void;
    onSafety: () => void;
    onHelp: () => void;
}) {
    const { t, i18n } = useTranslation();
    const rtl = i18n.language === 'ar';
    const failure = diagnostic?.events.slice().reverse().find(event => event.failure);
    const { colors, typography } = useAppTheme();
    const insets = useSafeAreaInsets();
    const group = challenge.choiceGroup ?? (challenge.category === 'breathing' ? 'breathe' : 'move');
    const presentation = resetRecoveryPresentation(challenge, challenge.choiceGroup ?? (challenge.category === 'physical' ? 'move' : 'breathe'), t);
    const action = (label: string, onPress: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 48, padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: primary ? colors.accent : colors.surface, opacity: disabled ? .5 : 1, justifyContent: 'center' }}><Text style={{ color: primary ? colors.onAccent : colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.bold, textAlign: rtl ? 'right' : 'left' }}>{label}</Text></Pressable>;
    return <ScrollView testID="guided-reset-offer" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: Math.max(24, insets.top), paddingBottom: Math.max(24, insets.bottom), gap: 16, backgroundColor: colors.bg }}>
    <View style={{ gap: 8 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, lineHeight: 36, fontWeight: typography.bold }}>Take a guided reset</Text><Text style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{protectionOrigin ? 'Your protection is still active. Choose how to start.' : 'Choose one guided activity, or use a basic tool now.'}</Text></View>
    {earnedTimeOffer}
    {tier === 'review' ? <Text style={{ color: colors.text2 }}>Review access</Text> : null}
    {!earnedTimeOffer ? previewMode === 'choices' ? <View testID="guided-choices-preview" style={{ gap: 12 }}>
      <Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 20, lineHeight: 28, fontWeight: typography.bold, textAlign: rtl ? 'right' : 'left' }}>{t('resetRecoveryUi.choose')}</Text>
      {(['breathe', 'move', 'find'] as const).map(category => <View key={category} style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
        <ChallengeCategoryArt group={category} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text translate={false} style={{ color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.bold, textAlign: rtl ? 'right' : 'left' }}>{t(`resetChoices.${category}`)}</Text>
          <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: rtl ? 'right' : 'left' }}>{t(`resetRecoveryUi.${category}Preview`)}</Text>
        </View>
      </View>)}
    </View> : <View testID="guided-activity-preview" style={{ padding: 16, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface, gap: 12 }}>
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 16 }}><View style={{ flex: 1, gap: 8 }}><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{t(resumable ? 'resetChoices.continue' : 'resetChoices.suggested')}</Text><Text translate={false} accessibilityRole="header" style={{ fontSize: 20, lineHeight: 28, fontWeight: typography.bold, color: colors.text, textAlign: rtl ? 'right' : 'left' }}>{presentation.title}</Text></View><ChallengeCategoryArt group={group} size={56} /></View>
      <Text translate={false} testID="guided-activity-requirement" style={{ color: colors.text, fontSize: 17, lineHeight: 24, textAlign: rtl ? 'right' : 'left' }}>{presentation.requirement}</Text>
      {presentation.detail ? <Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: rtl ? 'right' : 'left' }}>{presentation.detail}</Text> : null}
    </View> : null}
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.text2, lineHeight: 24 }}>{notice}</Text> : null}
    {notice && failure ? <Text translate={false} testID="rewarded-ad-diagnostic" style={{ color: colors.text2 }}>{t('momentum.profileSettings.adErrorReference', { reference: `${failure.stage}/${failure.nativeCode ?? failure.failure}` })}</Text> : null}
    {adPrivacyNotice ? <Text translate={false} accessibilityRole="alert" style={{ color: colors.text2 }}>{adPrivacyNotice}</Text> : null}
    {adPrivacyRequired && onAdPrivacyOptions ? action(t('momentum.profileSettings.adPrivacyOptions'), onAdPrivacyOptions, false, busy || adPrivacyBusy) : null}
    {accessBlocked && !cleanupPending && !repairNeeded ? null : cleanupPending ? action('Retry discarding saved reset', onRetryCleanup ?? onSafety, true, busy) : repairNeeded ? action('Retry saving access', onRepair, true, busy) : resumable ? action('Resume guided reset', onStart, true, busy) : tier === 'paid' || tier === 'review' ? action(previewMode === 'choices' ? t('resetRecoveryUi.choose') : 'Start challenge', onStart, true, busy) : tier === 'free' ? <>{action(busy ? 'Preparing your ad…' : previewMode === 'choices' ? t('resetRecoveryUi.watchChoose') : 'Watch one ad — start this guided challenge', onWatch, true, busy)}{action('Go Pro — guided resets without ads', onPro, false, busy)}</> : <><Text accessibilityLiveRegion="polite" style={{ color: colors.text2 }}>Checking access. Connect your account and retry when ready.</Text>{action('Retry access check', onRetry, false, busy)}</>}
    {action('Back to safety', onSafety)}{action('Help now', onHelp)}
  </ScrollView>;
}
