import { MomentumPageHeader, MomentumSection } from './MomentumPageHeader';
import { Pressable, Text, View } from '@/components/Localized';
import React from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { useTranslation } from 'react-i18next';
import { translateSource } from '@/i18n/runtime';
import type { PaywallPlanPresentation, PaywallPriceStatus } from "@/lib/paywall-presenter";
import { useOfferTheme, type OfferTheme } from "./offer-theme";

export type PremiumOfferPlan = {
  id: "monthly" | "yearly";
  label: string;
  presentation: PaywallPlanPresentation;
};

export type PremiumOfferProps = {
  plans: readonly PremiumOfferPlan[];
  selectedPlan: PremiumOfferPlan["id"];
  onSelectPlan: (plan: PremiumOfferPlan["id"]) => void;
  onSubscribe: () => void;
  onClose: () => void;
  onHelp?: () => void;
  onRestore: () => void;
  onManage: () => void;
  canManage: boolean;
  onRetryPrices: () => void;
  priceStatus: PaywallPriceStatus;
  priceError?: string | null;
  busy?: boolean;
  notice?: string | null;
  terms: string;
  previewMessage?: string | null;
  managementMessage?: string | null;
};

const PRIVACY_URL = "https://freed-landing.web.app/privacy";
const APPLE_TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const FREED_TERMS_URL = "https://freed-landing.web.app/terms";
const benefitKeys = ['adFree', 'activities', 'custom'] as const;

/** Display-only offer. Store pricing, purchase state, and navigation belong to its caller. */
export function PremiumOffer({
  plans,
  selectedPlan,
  onSelectPlan,
  onSubscribe,
  onClose,
  onRestore,
  onManage,
  canManage,
  onRetryPrices,
  priceStatus,
  priceError,
  busy = false,
  notice,
  terms,
  previewMessage,
  managementMessage,
  onHelp
}: PremiumOfferProps) {
  const theme = useOfferTheme();
  const { t: supportCopy } = useTranslation();
  const { t: compactCopy } = useTranslation(undefined, { keyPrefix: 'premiumOfferCompact' });
  const { i18n, t } = useTranslation(undefined, { keyPrefix: 'source' });
  const rtl = i18n.dir() === 'rtl';
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const [legalMessage, setLegalMessage] = React.useState<string | null>(null);
  const selectedPresentation = plans.find((plan) => plan.id === selectedPlan)?.presentation;
  const canSubscribe = priceStatus === "ready" && selectedPresentation?.canPurchase === true;
  const canRetry = priceStatus !== "loading" &&
    (priceStatus === "error" || selectedPresentation?.canRetry === true || plans.length === 0);
  const compactOffer = height < 740 && width < 600;
  const largeText = fontScale > 1.15;
  const accessiblePlans = fontScale > 2;
  const primaryActionLabel = busy
    ? translateSource("Confirming purchase")
    : canSubscribe && selectedPresentation?.pricing
    ? t('Subscribe · {{price}} {{cadence}}', {
      price: selectedPresentation.pricing.headline,
      cadence: translateSource(selectedPresentation.pricing.cadence)
    })
    : translateSource(selectedPresentation?.primaryActionLabel ?? "Store price unavailable");
  const openLegalLink = (url: string) => {
    setLegalMessage(null);
    void Linking.openURL(url).catch(() => {
      setLegalMessage("This link could not open. Check your connection and try again.");
    });
  };
  const legalLinks = <View style={[styles.legalLinks, compactOffer && styles.compactLegalLinks]}>
    <QuietAction label="Privacy" role="link" onPress={() => openLegalLink(PRIVACY_URL)} disabled={busy} theme={theme} />
    <QuietAction label="Terms" role="link" onPress={() => openLegalLink(Platform.OS === "ios" ? APPLE_TERMS_URL : FREED_TERMS_URL)} disabled={busy} theme={theme} />
  </View>;
  const renewalTerms = <Text selectable style={[styles.terms, { color: theme.muted }]}>{terms}</Text>;
  const visibleActionLabel = busy ? translateSource("Confirming purchase…") : largeText && canSubscribe ? translateSource("Subscribe") : primaryActionLabel;

  const footer = (
    <View
      testID="paywall-footer"
      style={[
        styles.footer,
        {
          backgroundColor: theme.bg,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 12)
        },
        compactOffer && styles.compactFooter
      ]}
    >
      {!largeText ? renewalTerms : null}
      <Pressable
        testID="paywall-subscribe"
        translate={false}
        accessibilityRole="button"
        accessibilityLabel={primaryActionLabel}
        accessibilityHint={translateSource("Your device's store confirms the subscription and final charge.")}
        accessibilityState={{ disabled: busy || !canSubscribe, busy }}
        disabled={busy || !canSubscribe}
        onPress={() => { if (!busy && canSubscribe) onSubscribe(); }}
        style={({ pressed }) => [
          styles.subscribe,
          {
            backgroundColor: canSubscribe ? theme.accent : theme.border,
            opacity: busy || pressed ? 0.72 : 1
          }
        ]}
      >
        {busy ? <ActivityIndicator color={canSubscribe ? theme.onAccent : theme.muted} /> : null}
        <Text translate={false} style={[styles.subscribeLabel, { color: canSubscribe ? theme.onAccent : theme.muted }]}>
          {visibleActionLabel}
        </Text>
      </Pressable>
      {onHelp && !largeText ? <QuietAction label={supportCopy("publicHelp.entry")} onPress={onHelp} disabled={false} theme={theme} /> : null}
      <View style={compactOffer ? styles.footerSecondaryActions : undefined}>
        <QuietAction label="Continue with Free" onPress={onClose} disabled={false} theme={theme} />
        {compactOffer && !largeText ? legalLinks : null}
      </View>
    </View>
  );

  return (
    // Recreate native text layout after a live Dynamic Type change. The plan
    // and checkout controller remain mounted, preserving purchase ownership.
    <SafeAreaView testID="premium-offer" key={fontScale} edges={["top", "left", "right"]} style={[styles.screen, { backgroundColor: theme.bg, direction: rtl ? 'rtl' : 'ltr' }]}>
      <ScrollView
        testID="paywall-body"
        style={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.content, compactOffer && styles.compactContent]}>
          <View style={styles.closeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close Premium offer and continue with Free"
              accessibilityState={{ disabled: false }}
              onPress={onClose}
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? theme.surfacePressed : theme.surface, opacity: 1 }
              ]}
            >
              <X color={theme.secondary} size={20} strokeWidth={2} />
            </Pressable>
          </View>

          <MomentumPageHeader pose={busy || priceStatus === "loading" ? "waiting" : priceStatus === "ready" ? "plan" : "repair"} context="paywall" title="FREED Premium" category="commitment" variant="welcome" compact restrained={busy} />

          <View style={styles.plansSection}>
            <View style={styles.planIntro}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: theme.text }]}>Choose your billing</Text>
              <Text selectable style={[styles.planNote, { color: theme.muted }]}>Same Premium features in both plans.</Text>
            </View>
            <View testID="paywall-plan-options" accessibilityRole="radiogroup" accessibilityLabel="Premium billing plan" style={[styles.plans, accessiblePlans && styles.accessiblePlans]}>
              {plans.map((plan) => {
                const selected = plan.id === selectedPlan;
                const presentation = plan.presentation;
                return (
                  <Pressable
                    key={plan.id}
                    testID={`paywall-plan-${plan.id}`}
                    accessibilityRole="radio"
                    accessibilityLabel={`${translateSource(plan.label)}, ${presentation.pricing ? presentation.headline : translateSource(presentation.headline)}${presentation.cadence ? ` ${translateSource(presentation.cadence)}` : ""}`}
                    accessibilityHint={presentation.detail ?? undefined}
                    accessibilityState={{ checked: selected, selected, disabled: busy }}
                    disabled={busy}
                    onPress={() => onSelectPlan(plan.id)}
                    style={({ pressed }) => [
                      styles.plan,
                      accessiblePlans && styles.accessiblePlan,
                      {
                        borderColor: selected ? theme.accent : theme.border,
                        backgroundColor: selected ? theme.accentSurface : pressed ? theme.surfacePressed : theme.surface,
                        opacity: busy ? 0.6 : 1
                      }
                    ]}
                  >
                    <View style={styles.planContent}>
                      <View style={[styles.planHeading, styles.planHeadingStacked]}>
                        <View style={styles.planLabelRow}>
                          <View style={[styles.radio, { borderColor: selected ? theme.accent : theme.muted }]}>
                            {selected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
                          </View>
                          <Text style={[styles.planLabel, { color: theme.text }]}>{plan.label}</Text>
                        </View>
                        <View testID={`paywall-price-block-${plan.id}`} style={[styles.price, styles.priceStacked]}>
                          <Text testID={`paywall-price-${plan.id}`} translate={!presentation.pricing} selectable style={[styles.priceHeadline, { color: theme.text, textAlign: rtl ? 'right' : 'left' }]}>
                            {presentation.headline}
                          </Text>
                          {presentation.cadence ? (
                            <Text selectable style={[styles.priceCadence, { color: theme.secondary, textAlign: rtl ? 'right' : 'left' }]}>
                              {presentation.cadence}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      {presentation.detail && !/^Billed (yearly|monthly)$/.test(presentation.detail) ? (
                        <Text selectable style={[styles.planDetail, { color: theme.muted }]}>{presentation.detail}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {priceStatus === "loading" ? (
            <View accessibilityLiveRegion="polite" style={styles.loading}>
              <ActivityIndicator color={theme.accent} />
              <Text style={[styles.message, { color: theme.secondary }]}>Loading prices from your store…</Text>
            </View>
          ) : canRetry ? (
            <View style={styles.priceRecovery}>
              <Text accessibilityRole="alert" style={[styles.message, { color: theme.error }]}>
                {priceError ?? "Store prices are unavailable. Retry before subscribing."}
              </Text>
              <QuietAction label="Retry store prices" onPress={onRetryPrices} disabled={busy} theme={theme} />
            </View>
          ) : null}
          {previewMessage ? <Text selectable style={[styles.message, { color: theme.muted }]}>{previewMessage}</Text> : null}
          {notice ? <Text selectable accessibilityLiveRegion="polite" style={[styles.message, { color: theme.secondary }]}>{notice}</Text> : null}
          {managementMessage ? <Text accessibilityRole="alert" style={[styles.message, { color: theme.error }]}>{managementMessage}</Text> : null}

          <View testID="paywall-benefits" style={styles.benefits}>
            {benefitKeys.map(key => (
              <View key={key} style={styles.benefit}>
                <Check color={theme.accent} size={18} strokeWidth={2.5} style={styles.benefitIcon} />
                <Text translate={false} selectable style={[styles.benefitText, { color: theme.text }]}>{compactCopy(key)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.detailsClip}>
            <MomentumSection testID="paywall-details" title={compactCopy('details')} category="reflection" collapsible initiallyExpanded={false}>
              {(['adFreeDetail', 'activitiesDetail', 'customDetail', 'limits'] as const).map(key => (
                <Text key={key} translate={false} selectable style={[styles.detailText, { color: theme.muted }]}>{compactCopy(key)}</Text>
              ))}
            </MomentumSection>
          </View>

          <View style={styles.utilityActions}>
            <QuietAction label="Restore purchases" onPress={onRestore} disabled={busy} theme={theme} />
            {canManage ? <QuietAction label="Manage subscription" onPress={onManage} disabled={busy} theme={theme} /> : null}
          </View>
          {onHelp && largeText ? <QuietAction label={supportCopy("publicHelp.entry")} onPress={onHelp} disabled={false} theme={theme} /> : null}
          {!compactOffer || largeText ? legalLinks : null}
          {largeText ? renewalTerms : null}
          {legalMessage ? <Text accessibilityRole="alert" style={[styles.message, { color: theme.error }]}>{legalMessage}</Text> : null}
        </View>
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

function QuietAction({
  label,
  onPress,
  disabled,
  theme,
  role = "button"
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  theme: OfferTheme;
  role?: "button" | "link";
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.quietAction, { opacity: disabled ? 0.45 : pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.quietLabel, { color: theme.secondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { flexGrow: 1 },
  content: { width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 24, paddingBottom: 12, gap: 12 },
  compactContent: { paddingHorizontal: 20, paddingBottom: 0, gap: 4 },
  closeRow: { alignItems: "flex-end", paddingTop: 4 },
  close: { minWidth: 44, minHeight: 44, borderRadius: 999, borderCurve: "continuous", justifyContent: "center", alignItems: "center" },
  benefits: { gap: 8 },
  detailsClip: { borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden' },
  benefit: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  benefitIcon: { marginTop: 1 },
  benefitText: { flex: 1, fontSize: 15, lineHeight: 20 },
  detailText: { fontSize: 13, lineHeight: 20 },
  plansSection: { gap: 12 },
  planIntro: { gap: 4 },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  planNote: { fontSize: 13, lineHeight: 20 },
  plans: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  accessiblePlans: { flexDirection: 'column' },
  plan: { flex: 1, flexBasis: 0, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 84, borderWidth: 1.5, borderRadius: 16, borderCurve: "continuous", padding: 12 },
  accessiblePlan: { flex: 0, flexBasis: 'auto' },
  radio: { width: 22, height: 22, borderRadius: 999, borderCurve: "continuous", borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 999, borderCurve: "continuous" },
  planContent: { flex: 1, gap: 4 },
  planHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  planHeadingStacked: { flexDirection: "column", alignItems: "flex-start", gap: 8 },
  planLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  planLabel: { fontSize: 17, lineHeight: 24, fontWeight: "600", flexShrink: 1 },
  price: { alignItems: "flex-end", maxWidth: "58%" },
  priceStacked: { alignItems: "flex-start", maxWidth: "100%", width: "100%" },
  priceHeadline: { fontSize: 21, lineHeight: 28, fontWeight: "700", fontVariant: ["tabular-nums"], textAlign: "right" },
  priceCadence: { fontSize: 12, lineHeight: 18, textAlign: "right" },
  planDetail: { fontSize: 12, lineHeight: 18 },
  loading: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  priceRecovery: { gap: 4 },
  message: { flexShrink: 1, fontSize: 13, lineHeight: 20, textAlign: "center" },
  utilityActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4 },
  legalLinks: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  compactLegalLinks: { marginTop: 0, gap: 0 },
  quietAction: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", alignItems: "center" },
  quietLabel: { fontSize: 13, lineHeight: 20, textAlign: "center" },
  footer: { flexShrink: 0, width: "100%", maxWidth: 600, alignSelf: "center", borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 24, gap: 8 },
  compactFooter: { paddingTop: 8, paddingHorizontal: 20, gap: 4 },
  footerSecondaryActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  terms: { fontSize: 11, lineHeight: 16, textAlign: "center" },
  subscribe: { minHeight: 52, borderRadius: 16, borderCurve: "continuous", paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  subscribeLabel: { flexShrink: 1, fontSize: 17, lineHeight: 24, fontWeight: "600", textAlign: "center" }
});

export default PremiumOffer;
