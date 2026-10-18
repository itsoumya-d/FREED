import React from 'react';
import { I18nManager, Image, Modal, Platform, ScrollView, Switch, View } from 'react-native';
import { reloadAppAsync } from 'expo';
import { getLocales } from 'expo-localization';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { useAppTheme } from '@/design-system/use-app-theme';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, resolveAppLanguage, type AppLanguage, type ThemeMode, type CompanionMotionPreference } from '@/lib/app-preferences';
import { LANGUAGE_FLAGS } from './LanguagePicker';
import { PreferencePicker } from './PreferencePicker';
import { MomentumCompanion } from './MomentumCompanion';
import { ChevronRight } from './DirectionalIcons';
import { Text, Pressable } from './Localized';

type PreferencePatch = { themeMode?: ThemeMode; language?: AppLanguage; companionMotion?: CompanionMotionPreference };

export function PreferencesScreen({ nativeHeader = false }: { nativeHeader?: boolean } = {}) {
  const { t } = useTranslation();
  const { preferences, update, error } = useAppPreferences();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [languageOpen, setLanguageOpen] = React.useState(false);
  const [restartNeeded, setRestartNeeded] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const failedPatch = React.useRef<PreferencePatch | null>(null);
  const save = (patch: PreferencePatch) => {
    try {
      update(patch);
      failedPatch.current = null;
      setMessage(null);
      // Draft inputs are synchronously retained by useRecoveryDraft. Only the explicit
      // restart below reloads the app; selecting a language never clears local data.
      if (patch.language) setRestartNeeded(Platform.OS !== 'web' && (resolveAppLanguage(patch.language, getLocales()[0]?.languageTag) === 'ar') !== I18nManager.isRTL);
      return true;
    } catch {
      failedPatch.current = patch;
      setMessage(t('preferences.saveError'));
      return false;
    }
  };
  const currentLanguage = resolveAppLanguage(preferences.language, getLocales()[0]?.languageTag);
  const group = { backgroundColor: colors.surface, borderRadius: 16, borderCurve: 'continuous' as const, overflow: 'hidden' as const };
  const body = { fontSize: 17, lineHeight: 24, color: colors.text2 };
  const errorNotice = message || error ? <View style={{ gap: 8 }}><Text testID="preferences-error" accessibilityRole="alert" style={{ ...body, color: colors.red }}>{message ?? t('preferences.saveError')}</Text>{failedPatch.current ? <Pressable testID="preferences-retry" accessibilityRole="button" onPress={() => { const patch = failedPatch.current; if (patch && save(patch) && patch.language) setLanguageOpen(false); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '600' }}>{t('common.retry')}</Text></Pressable> : null}</View> : null;
  return <>
    <ScrollView testID="screen-preferences" contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 20, gap: 24 }}>
      {!nativeHeader ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}><Text translate={false} accessibilityRole="header" style={{ color: colors.text, fontSize: 24, lineHeight: 32, fontWeight: '700' }}>{t('preferences.title')}</Text></View>
        <MomentumCompanion pose="guide" context="preferences" width={64} height={72} scene={false} idle={false} />
      </View> : null}
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text translate={false} accessibilityRole="header" style={{ flex: 1, minWidth: 0, color: colors.text2, fontSize: 15, lineHeight: 20, fontWeight: '600', paddingHorizontal: 4 }}>{t('preferences.appearance')}</Text>
          {nativeHeader ? <MomentumCompanion pose="guide" context="preferences" width={48} height={52} scene={false} idle={false} /> : null}
        </View>
        <PreferencePicker label={t('preferences.appearance')} testID="appearance" value={preferences.themeMode} options={(['system','light','dark'] as const).map(value => ({ value, label: t(`preferences.${value}`) }))} onChange={value => save({ themeMode: value as ThemeMode })} />
        {preferences.themeMode === 'system' ? <Text translate={false} style={{ ...body, paddingHorizontal: 4 }}>{t('preferences.followDevice')}</Text> : null}
      </View>
      <View style={{ gap: 8 }}>
        <View style={group}>
          <Pressable testID="language-open" accessibilityRole="button" accessibilityLabel={t('preferences.language')} accessibilityValue={{ text: preferences.language === 'system' ? t('preferences.system') : LANGUAGE_NAMES[currentLanguage] }} accessibilityHint={t('preferences.languageDescription')} onPress={() => setLanguageOpen(true)} style={({ pressed }) => ({ minHeight: 60, padding: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.surface2 : colors.surface })}>
            <Text translate={false} style={{ flexGrow: 1, color: colors.text, fontSize: 17, lineHeight: 24 }}>{t('preferences.language')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Image source={LANGUAGE_FLAGS[currentLanguage]} accessible={false} resizeMode="contain" style={{ width: 24, height: 18 }} /><Text translate={false} style={{ color: colors.text2, fontSize: 17, lineHeight: 24 }}>{preferences.language === 'system' ? t('preferences.system') : LANGUAGE_NAMES[currentLanguage]}</Text><ChevronRight accessible={false} color={colors.text3} size={18} /></View>
          </Pressable>
          <View style={{ minHeight: 60, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <Text translate={false} style={{ flex: 1, fontSize: 17, lineHeight: 24, color: colors.text }}>{t('companion.motionTitle')}</Text>
            <Switch accessible testID="companion-motion" accessibilityRole="switch" accessibilityLabel={t('companion.motionTitle')} accessibilityHint={t('companion.motionDescription')} accessibilityState={{ checked: preferences.companionMotion !== 'off' }} value={preferences.companionMotion !== 'off'} onValueChange={enabled => { save({ companionMotion: enabled ? 'system' : 'off' }); }} trackColor={{ false: colors.border, true: colors.accent }} />
          </View>
        </View>
        <Text translate={false} style={{ ...body, paddingHorizontal: 4 }}>{t('companion.motionDescription')}</Text>
      </View>
      {restartNeeded ? <View testID="language-restart-notice" style={{ padding: 16, gap: 12, ...group }}><Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 17, lineHeight: 24 }}>{t('preferences.restartRequired')}</Text><Pressable testID="language-restart" accessibilityRole="button" onPress={() => { void reloadAppAsync('Apply saved FREED layout direction').catch(() => setMessage(t('preferences.restartRequired'))); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontSize: 17, fontWeight: '600' }}>{t('preferences.restartNow')}</Text></Pressable></View> : null}
      {!languageOpen ? errorNotice : null}
    </ScrollView>
    <Modal testID="language-sheet" visible={languageOpen} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setLanguageOpen(false)}>
      <View style={{ flex: 1, backgroundColor: colors.bg }} accessibilityViewIsModal>
        <View style={{ paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 16 : Math.max(insets.top, 16), paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text translate={false} accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: '700' }}>{t('preferences.language')}</Text><Pressable testID="language-close" accessibilityRole="button" accessibilityLabel={t('common.done')} onPress={() => setLanguageOpen(false)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><Text translate={false} style={{ color: colors.accent, fontSize: 17, fontWeight: '600' }}>{t('common.done')}</Text></Pressable></View>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 20), gap: 16 }}>
          <Text translate={false} style={body}>{t('preferences.languageDescription')}</Text>
          <PreferencePicker label={t('preferences.language')} testID="language" value={preferences.language} options={[{ value: 'system', label: t('preferences.system') }, ...SUPPORTED_LANGUAGES.map(value => ({ value, label: LANGUAGE_NAMES[value], flag: LANGUAGE_FLAGS[value] }))]} onChange={value => { if (save({ language: value as AppLanguage })) setLanguageOpen(false); }} />
          {languageOpen ? errorNotice : null}
        </ScrollView>
      </View>
    </Modal>
  </>;
}
