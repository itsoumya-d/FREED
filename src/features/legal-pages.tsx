import { MomentumPageHeader, MomentumSection } from '@/components/MomentumPageHeader';
import { translateSource } from '@/i18n/runtime';
import { Pressable, Text, View } from '@/components/Localized';
import { Linking, ScrollView, StyleSheet } from 'react-native';

import { radii, typography } from "@/constants/design";
import { useAppTheme } from '@/design-system/use-app-theme';
import nativeAndroidCopy from '@/i18n/native-android-catalog.json';

const SUPPORT_EMAIL = "soumyadebnath1661@gmail.com";
const PRIVACY_URL = "https://freed-landing.web.app/privacy";
const SUPPORT_URL = "https://freed-landing.web.app/support";
const ACCOUNT_DELETION_URL = "https://freed-landing.web.app/account-deletion";

type LegalSection = {
  title: string;
  body: string[];
  accent?: 'mint' | 'sky' | 'peach';
};

type Action = {
  label: string;
  url: string;
};

function openUrl(url: string) {
  void Linking.openURL(url);
}

function mailto(subject: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(translateSource(subject))}`;
}

function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
  actions
}: {
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  actions: Action[];
}) {
  const { colors } = useAppTheme();
  const styles = createLegalStyles(colors);
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.shell}>
        <MomentumPageHeader pose="secure" context="legal" title={title} description={intro} category="commitment" variant="calm" compact restrained>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="link"
                onPress={() => openUrl(action.url)}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <Text style={styles.actionText}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </MomentumPageHeader>

        <View style={styles.sectionList}>
          {sections.map((section) => (
            <MomentumSection key={section.title} title={section.title} category={section.accent === "mint" ? "commitment" : section.accent === "peach" ? "calm" : "reflection"}>
              {section.body.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </MomentumSection>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Effective date: October 5, 2026"
      title="FREED Privacy Policy"
      intro="FREED is a recovery and digital self-control app for blocking explicit adult-domain access, interrupting selected app loops, and guiding users into recovery challenges."
      actions={[
        { label: "Email privacy support", url: mailto("FREED privacy request") },
        { label: "Account deletion", url: ACCOUNT_DELETION_URL }
      ]}
      sections={[
        {
          title: "Data FREED uses on device",
          accent: 'mint',
          body: [
            "FREED stores protection setup status, selected Android app package IDs or opaque iOS Screen Time tokens, adult-domain feed version and checksum, challenge history, streak state, settings, reminders, and premium entitlement state on the device.",
            nativeAndroidCopy.freed_accessibility_description,
            "Android DNS-only VPN protection, called DNS Guard in the app, classifies DNS questions locally against the reviewed adult-domain feed. FREED does not full-tunnel traffic, inspect packet payloads beyond DNS questions, proxy normal browsing, decrypt HTTPS, or MITM connections.",
            "On iOS, FREED uses Family Controls, ManagedSettings, DeviceActivity, FamilyActivityPicker, and Safari Content Blocker rules to apply Screen Time and Safari restrictions. FREED receives opaque selected target tokens and counts, not the user's full app or browsing history.",
            "Photos are checked on your device with Apple Vision or bundled ML Kit. Photos are not uploaded. ML Kit may send operational SDK metrics."
          ]
        },
        {
          title: "Optional data sent to FREED servers",
          accent: 'sky',
          body: [
            "Purchase verification sends store transaction metadata to FREED's server so Apple or Google can verify entitlement before premium is activated. FREED does not receive full payment card details.",
            "With analytics consent, FREED sends absolute UTC-day counts of check-ins and completed challenges for a 14-day window, plus schema and consent versions, opt-in time, and lineage, revision and snapshot identifiers. Records link to your authenticated account UID. Derived rates, streak summaries and challenge categories stay local. Raw URLs, search text, private notes, exact selected app tokens and exact coordinates are excluded.",
            "With cloud-chat consent, messages you deliberately send to CLARA are processed by Google Cloud's Gemini service through FREED. If you choose to share conversation context, up to six recent user-authored messages may be included. Browsing activity, journal entries, photos and Screen Time data are not automatically attached. Challenge selection and retention planning stay local. Processing may happen outside your country.",
            "Google processing and retention follow the applicable service terms and configuration. FREED does not promise a fixed Google retention period or zero retention. Turning cloud chat off stops future messages; a request already sent may finish. Built-in guidance remains available.",
            "FREED's backend does not persist chat prompts or full provider results. It keeps account-linked quota and request deduplication metadata. Deduplication records have a configured 7-day expiry; physical deletion may occur later. These controls do not set Google's content retention.",
            "If hosted encrypted backup sync is enabled, FREED sends encrypted backup envelopes only. FREED does not receive the user's passphrase."
          ]
        },
        {
          title: "Ads, payments, and permissions",
          accent: 'peach',
          body: [
            "Free users may see rewarded ads before some recovery challenges. FREED does not include Android Advertising ID permission in the release manifest, and ad requests must use non-personalized request options where supported.",
            "Premium plans are processed by Apple App Store or Google Play billing. FREED activates premium only after server-side Purchase verification succeeds.",
            "FREED requests sensitive permissions only when needed: VPN/DNS Guard, Accessibility, and Usage Access on Android; Family Controls, DeviceActivity, ManagedSettings, and Safari Content Blocker on iOS; and camera, motion/activity, foreground location, or notifications only for matching challenges or reminders."
          ]
        },
        {
          title: "Retention, deletion, and contact",
          accent: 'peach',
          body: [
            "Analytics records have a configured 14-day expiry: day counters expire 14 days after their UTC-day boundary, and snapshot and receipt metadata 14 days after writing. Expiry makes records eligible for TTL deletion; physical deletion may occur later.",
            "Use Delete Local Data in Profile for this device, or Delete Account & Data to request account and account-linked hosted data deletion. Store and Google records follow their own terms. Some purchase, fraud-prevention, security, tax, refund or chargeback records may require legal retention.",
            `Data deletion and privacy requests can be sent to ${SUPPORT_EMAIL}. Public pages: ${PRIVACY_URL}, ${SUPPORT_URL}, and ${ACCOUNT_DELETION_URL}.`
          ]
        }
      ]}
    />
  );
}

export function SupportPage() {
  return (
    <LegalPage
      eyebrow="FREED help desk"
      title="FREED Support"
      intro="Use this page for privacy requests, store review contact, account deletion, billing help, and protection setup issues."
      actions={[
        { label: "Email support", url: mailto("FREED support request") },
        { label: "Privacy policy", url: PRIVACY_URL },
        { label: "Account deletion", url: ACCOUNT_DELETION_URL }
      ]}
      sections={[
        {
          title: "Contact",
          accent: 'sky',
          body: [
            `Primary support email: ${SUPPORT_EMAIL}. Include the platform, app version, device model, and whether the issue is Android, iOS, Google Play, App Store, TestFlight, billing, or protection setup.`,
            "Do not send passwords, private recovery notes, raw receipts, purchase tokens, screenshots containing sensitive content, or full browsing history."
          ]
        },
        {
          title: "Protection setup help",
          accent: 'mint',
          body: [
            "Android support covers DNS Guard/VpnService consent, Usage Access, AccessibilityService consent, selected app package configuration, activation tests, reboot behavior, and normal browsing allow cases.",
            "iOS support covers Family Controls authorization, ManagedSettings web filtering, FamilyActivityPicker target selection, DeviceActivity limits, Safari Content Blocker reload, shield actions, and activation tests.",
            "FREED cannot silently grant Accessibility, Usage Access, VPN, Screen Time, or Safari content-blocker authority. The app should redirect to the required operating-system surface and resume setup after the user returns."
          ]
        },
        {
          title: "Billing and purchases",
          accent: 'peach',
          body: [
            "Launch products are yearly and monthly Premium, with the same features. Purchases and refunds are handled by Google Play or App Store billing. FREED verifies purchases before granting Premium.",
            "For restore issues, include the platform and product ID if visible: freed_premium_yearly or freed_premium_monthly. Never send raw purchase tokens or full receipts by email."
          ]
        },
        {
          title: "Privacy and deletion",
          accent: 'peach',
          body: [
            "In Profile, choose Delete Account & Data and confirm the signed-in account, including any required recent sign-in or Apple confirmation. FREED requests server-side account and account-linked data deletion before clearing this device and signing out.",
            "An accepted request means deletion is in progress, not that every server or provider copy is erased. If rejected or interrupted, retry or contact support. If accepted but device cleanup fails, return to Profile and use Delete Local Data."
          ]
        }
      ]}
    />
  );
}

export function AccountDeletionPage() {
  return (
    <LegalPage
      eyebrow="Data deletion"
      title="FREED Account Deletion"
      intro="Choose a device reset or an account deletion request. Account deletion requests server removal before device cleanup and sign-out; acceptance means deletion is in progress."
      actions={[
        { label: "Email deletion request", url: mailto("FREED account deletion request") },
        { label: "Privacy policy", url: PRIVACY_URL },
        { label: "Support", url: SUPPORT_URL }
      ]}
      sections={[
        {
          title: "Delete local app data",
          accent: 'mint',
          body: [
            "In Profile, choose Delete Local Data and confirm. FREED first asks native protection to stop DNS Guard, risk-window monitoring, blocked app configuration and earned unlock windows. After native acknowledgment, it clears local recovery history, drafts, guided progress and cloud-chat consent, and disables automatic backup. If cleanup fails, follow the retry instructions. This device reset does not delete your account, hosted backups or exported copies. System permissions remain controlled by iOS or Android Settings.",
            "Deleting local data does not automatically cancel App Store or Google Play subscriptions. Manage subscription cancellation in the store account that purchased premium."
          ]
        },
        {
          title: "Request hosted data deletion",
          accent: 'sky',
          body: [
            "In Profile, choose Delete Account & Data and confirm the signed-in account, including any required recent sign-in or Apple confirmation. FREED requests server-side account and account-linked data deletion before clearing this device and signing out.",
            "An accepted request means deletion is in progress, not that every server or provider copy is erased. If rejected or interrupted, retry or contact support. If accepted but device cleanup fails, return to Profile and use Delete Local Data."
          ]
        },
        {
          title: "Records that may be retained",
          accent: 'peach',
          body: [
            "Some purchase audit records, fraud-prevention records, tax records, refund or chargeback records, and security logs may need to be retained for legal retention or compliance. FREED does not retain raw receipts or raw purchase tokens in user-facing evidence.",
            "Account deletion covers associated hosted backups, optional analytics, push registrations, service records and purchase ownership data through the service deletion process. FREED does not promise instantaneous provider authorization revocation or complete erasure of retained copies. Store and Google records follow their own terms."
          ]
        },
        {
          title: "Public deletion URL",
          accent: 'peach',
          body: [
            `The public account deletion URL is ${ACCOUNT_DELETION_URL}. Contact support if you cannot access the app.`,
            `Privacy contact and deletion support: ${SUPPORT_EMAIL}.`
          ]
        }
      ]}
    />
  );
}

const createLegalStyles = (colors: ReturnType<typeof useAppTheme>['colors']) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bgDeep
  },
  content: {
    minHeight: "100%",
    paddingHorizontal: 24,
    paddingVertical: 32
  },
  shell: {
    width: "100%",
    maxWidth: 920,
    alignSelf: "center"
  },
  header: {
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.14)"
  },
  eyebrow: {
    color: colors.mint,
    fontFamily: typography.familyFallback,
    fontSize: 13,
    fontWeight: typography.bold,
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  title: {
    marginTop: 10,
    color: colors.text,
    fontFamily: typography.familyFallback,
    fontSize: 40,
    lineHeight: 46,
    fontWeight: typography.heavy,
    letterSpacing: 0
  },
  intro: {
    marginTop: 14,
    color: colors.text2,
    fontFamily: typography.familyFallback,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: typography.medium,
    maxWidth: 760
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 24
  },
  actionButton: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.md,
    borderCurve: "continuous",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  pressed: {
    opacity: 0.72
  },
  actionText: {
    color: colors.text,
    fontFamily: typography.familyFallback,
    fontSize: 17,
    fontWeight: typography.bold,
    letterSpacing: 0
  },
  sectionList: {
    gap: 16,
    paddingTop: 24
  },
  section: {
    borderRadius: radii.lg,
    borderCurve: "continuous",
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: colors.surface
  },
  accent: {
    width: 42,
    height: 4,
    borderRadius: 2,
    borderCurve: "continuous",
    marginBottom: 12
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.familyFallback,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: typography.heavy,
    letterSpacing: 0
  },
  paragraph: {
    marginTop: 10,
    color: colors.text2,
    fontFamily: typography.familyFallback,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: typography.medium,
    letterSpacing: 0
  }
});
