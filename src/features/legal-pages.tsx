import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, typography } from "@/constants/design";

const SUPPORT_EMAIL = "support@freedrecovery.app";
const PRIVACY_URL = "https://freedrecovery.app/privacy";
const SUPPORT_URL = "https://freedrecovery.app/support";
const ACCOUNT_DELETION_URL = "https://freedrecovery.app/account-deletion";

type LegalSection = {
  title: string;
  body: string[];
  accent?: string;
};

type Action = {
  label: string;
  url: string;
};

function openUrl(url: string) {
  void Linking.openURL(url);
}

function mailto(subject: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
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
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.intro}>{intro}</Text>
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
        </View>

        <View style={styles.sectionList}>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <View style={[styles.accent, { backgroundColor: section.accent ?? colors.sky }]} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.body.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Effective date: June 6, 2026"
      title="FREED Privacy Policy"
      intro="FREED is a recovery and digital self-control app for blocking explicit adult-domain access, interrupting selected app loops, and guiding users into recovery challenges."
      actions={[
        { label: "Email privacy support", url: mailto("FREED privacy request") },
        { label: "Account deletion", url: ACCOUNT_DELETION_URL }
      ]}
      sections={[
        {
          title: "Data FREED uses on device",
          accent: colors.mint,
          body: [
            "FREED stores protection setup status, selected Android app package IDs or opaque iOS Screen Time tokens, adult-domain feed version and checksum, challenge history, streak state, settings, reminders, and premium entitlement state on the device.",
            "Android Accessibility is used only after user consent to detect supported browser URL or search fields, selected app launches, selected short-form surfaces, and bounded scroll events for recovery handoff.",
            "Android DNS-only VPN protection, called DNS Guard in the app, classifies DNS questions locally against the reviewed adult-domain feed. FREED does not full-tunnel traffic, inspect packet payloads beyond DNS questions, proxy normal browsing, decrypt HTTPS, or MITM connections.",
            "On iOS, FREED uses Family Controls, ManagedSettings, DeviceActivity, FamilyActivityPicker, and Safari Content Blocker rules to apply Screen Time and Safari restrictions. FREED receives opaque selected target tokens and counts, not the user's full app or browsing history."
          ]
        },
        {
          title: "Optional data sent to FREED servers",
          accent: colors.sky,
          body: [
            "Purchase verification sends store transaction metadata to FREED's server so Apple or Google can verify entitlement before premium is activated. FREED does not receive full payment card details.",
            "If the user opts into analytics sharing, FREED sends aggregate recovery metrics only, such as counts, rates, streak summaries, and challenge completion categories. Raw URLs, search text, private notes, exact selected app tokens, and exact coordinates are not sent.",
            "If AI coaching or remote challenge generation is enabled, FREED sends redacted recovery context. Raw URLs, raw domains, private notes, exact coordinates, raw receipts, and contact details are excluded.",
            "If hosted encrypted backup sync is enabled, FREED sends encrypted backup envelopes only. FREED does not receive the user's passphrase."
          ]
        },
        {
          title: "Ads, payments, and permissions",
          accent: colors.peach,
          body: [
            "Free users may see rewarded ads before some recovery challenges. FREED does not include Android Advertising ID permission in the release manifest, and ad requests must use non-personalized request options where supported.",
            "Premium plans are processed by Apple App Store or Google Play billing. FREED activates premium only after server-side Purchase verification succeeds.",
            "FREED requests sensitive permissions only when needed: VPN/DNS Guard, Accessibility, and Usage Access on Android; Family Controls, DeviceActivity, ManagedSettings, and Safari Content Blocker on iOS; and camera, motion/activity, foreground location, or notifications only for matching challenges or reminders."
          ]
        },
        {
          title: "Retention, deletion, and contact",
          accent: colors.pink,
          body: [
            "Local recovery data stays on the device unless the user enables an optional remote feature. Users can delete local recovery data from Profile or request hosted/server deletion through support.",
            "Server-side purchase audit, analytics, AI event, notification, and encrypted backup records follow the retention windows documented in FREED's backend schema and release evidence. Some purchase audit records may need to be retained when required for fraud prevention, tax, refund, chargeback, or legal compliance.",
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
          accent: colors.sky,
          body: [
            `Primary support email: ${SUPPORT_EMAIL}. Include the platform, app version, device model, and whether the issue is Android, iOS, Google Play, App Store, TestFlight, billing, or protection setup.`,
            "Do not send passwords, private recovery notes, raw receipts, purchase tokens, screenshots containing sensitive content, or full browsing history."
          ]
        },
        {
          title: "Protection setup help",
          accent: colors.mint,
          body: [
            "Android support covers DNS Guard/VpnService consent, Usage Access, AccessibilityService consent, selected app package configuration, activation tests, reboot behavior, and normal browsing allow cases.",
            "iOS support covers Family Controls authorization, ManagedSettings web filtering, FamilyActivityPicker target selection, DeviceActivity limits, Safari Content Blocker reload, shield actions, and activation tests.",
            "FREED cannot silently grant Accessibility, Usage Access, VPN, Screen Time, or Safari content-blocker authority. The app should redirect to the required operating-system surface and resume setup after the user returns."
          ]
        },
        {
          title: "Billing and purchases",
          accent: colors.peach,
          body: [
            "Launch products are yearly, monthly, and lifetime premium. Purchases and refunds are handled by Google Play or App Store billing, while FREED uses server-side purchase verification before granting premium.",
            "For restore issues, include the platform and product ID if visible: freed_premium_yearly, freed_premium_monthly, or freed_premium_lifetime. Never send raw purchase tokens or full receipts by email."
          ]
        },
        {
          title: "Privacy and deletion",
          accent: colors.pink,
          body: [
            "Account deletion requests can be started from the account deletion page or by emailing support. Users can also delete local recovery data in the app Profile.",
            "Hosted sync deletion removes encrypted backup envelopes and related hosted records where available. Purchase audit records may be retained when required for fraud prevention, tax, refund, chargeback, or legal compliance."
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
      intro="FREED is local-first. This page explains how to delete local recovery data and request deletion of hosted data tied to optional remote features."
      actions={[
        { label: "Email deletion request", url: mailto("FREED account deletion request") },
        { label: "Privacy policy", url: PRIVACY_URL },
        { label: "Support", url: SUPPORT_URL }
      ]}
      sections={[
        {
          title: "Delete local app data",
          accent: colors.mint,
          body: [
            "In the app, open Profile, choose Delete Local Data, then confirm the second step. This resets local recovery state and asks native protection to stop DNS Guard, risk-window monitoring, blocked app configuration, and earned unlock windows.",
            "Deleting local data does not automatically cancel App Store or Google Play subscriptions. Manage subscription cancellation in the store account that purchased premium."
          ]
        },
        {
          title: "Request hosted data deletion",
          accent: colors.sky,
          body: [
            `Send a deletion request to ${SUPPORT_EMAIL} from the email address used for hosted sync or support. Include the platform, approximate purchase or signup date, and whether hosted encrypted backup sync, remote analytics, AI coaching, notifications, or store purchases were used.`,
            "FREED will delete hosted encrypted backup envelopes, account-linked sync rows, push tokens, optional analytics events, optional AI audit summaries, and backend job or idempotency rows tied to the verified request where available."
          ]
        },
        {
          title: "Records that may be retained",
          accent: colors.peach,
          body: [
            "Some purchase audit records, fraud-prevention records, tax records, refund or chargeback records, and security logs may need to be retained for legal retention or compliance. FREED does not retain raw receipts or raw purchase tokens in user-facing evidence.",
            "If a record cannot be deleted immediately because of legal retention, support will explain the category and expected retention boundary."
          ]
        },
        {
          title: "Public deletion URL",
          accent: colors.pink,
          body: [
            `Use ${ACCOUNT_DELETION_URL} as the public account deletion URL in Google Play Console and App Store Connect until authenticated self-service account deletion is live.`,
            `Privacy contact and deletion support: ${SUPPORT_EMAIL}.`
          ]
        }
      ]}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bgDeep
  },
  content: {
    minHeight: "100%",
    paddingHorizontal: 20,
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
    gap: 10,
    marginTop: 22
  },
  actionButton: {
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
    backgroundColor: colors.surface
  },
  pressed: {
    opacity: 0.72
  },
  actionText: {
    color: colors.text,
    fontFamily: typography.familyFallback,
    fontSize: 14,
    fontWeight: typography.bold,
    letterSpacing: 0
  },
  sectionList: {
    gap: 14,
    paddingTop: 22
  },
  section: {
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: colors.surface
  },
  accent: {
    width: 42,
    height: 4,
    borderRadius: 4,
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
    fontSize: 15,
    lineHeight: 23,
    fontWeight: typography.medium,
    letterSpacing: 0
  }
});
