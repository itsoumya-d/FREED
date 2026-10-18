import { MomentumPageHeader, MomentumSection } from './MomentumPageHeader';
import { Pressable, Text, View } from '@/components/Localized';
import React from "react";
import { ActivityIndicator, Linking, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronUp, ShieldCheck, Smartphone } from "lucide-react-native";
import type { ProtectionPermissionStep } from "@/lib/protection-permissions";
import type { presentProtectionSetup } from "@/lib/protection-setup-presenter";
import { useOfferTheme } from "./offer-theme";

export function ProtectionSetupView({ presentation, busy, onContinue, details, onToggleDetails, showDetails, steps, limited, onLimited, issue }: {
  presentation: ReturnType<typeof presentProtectionSetup>;
  busy: boolean;
  onContinue: () => void;
  onToggleDetails: () => void;
  showDetails: boolean;
  steps: ProtectionPermissionStep[];
  details: React.ReactNode;
  limited: boolean;
  onLimited: () => void;
  issue?: string | null;
}) {
  const theme = useOfferTheme();
  const [browserIssue, setBrowserIssue] = React.useState<string | null>(null);
  const openTest = (url: string) => { void Linking.openURL(url).catch(() => setBrowserIssue('The browser could not open. Open the test address in your browser and check the result.')); };
  const { fontScale, height } = useWindowDimensions();
  const inlineFooter = fontScale > 1.15 || height < 740;
  const footer = (
      <View style={{ borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.bg, paddingHorizontal: inlineFooter ? 0 : 24, paddingTop: 16, paddingBottom: 12, gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={presentation.action} accessibilityState={{ disabled: busy, busy }} onPress={onContinue} disabled={busy} style={({ pressed }) => ({ minHeight: 56, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, borderCurve: "continuous", backgroundColor: theme.accent, opacity: busy || pressed ? 0.7 : 1, flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 552, alignSelf: "center" })}>
          {busy ? <ActivityIndicator color={theme.onAccent} /> : null}
          <Text style={{ color: theme.onAccent, fontSize: 17, fontWeight: "700", textAlign: "center", flexShrink: 1 }}>{presentation.action}</Text>
        </Pressable>
        {limited ? <Pressable testID="protection-limited-continue" onPress={onLimited} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} style={{ minHeight: 44, paddingVertical: 8, justifyContent: "center", alignItems: "center" }}><Text style={{ color: theme.secondary, fontSize: 17, lineHeight: 24, textAlign: 'center', textDecorationLine: "underline" }}>Continue with limited protection</Text></Pressable> : null}
        <Text style={{ color: theme.secondary, fontSize: 12, lineHeight: 18, textAlign: "center" }}>You control what FREED protects.</Text>
      </View>
  );
  return (
    <SafeAreaView key={fontScale} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 24, flexGrow: 1, width: "100%", maxWidth: 600, alignSelf: "center" }}>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: theme.secondary, fontSize: 17, fontWeight: "700" }}>Protection setup</Text>
            <Text accessibilityLabel={`Step ${presentation.stage} of ${presentation.total}`} style={{ color: theme.secondary, fontSize: 13, fontVariant: ["tabular-nums"] }}>{presentation.stage} of {presentation.total}</Text>
          </View>
          <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: presentation.total, now: presentation.stage }} style={{ flexDirection: "row", gap: 8 }}>
            {Array.from({ length: presentation.total }, (_, index) => <View key={index} style={{ flex: 1, height: 4, borderRadius: 8, backgroundColor: index < presentation.stage ? theme.accent : theme.border }} />)}
          </View>
        </View>

        <MomentumPageHeader pose={busy ? "waiting" : "guide"} context="protectionSetup" title={presentation.title} description={presentation.description} category="commitment" variant="progress" compact />
        <MomentumSection title="What happens next" category="movement">
          <Text style={{ color: theme.secondary, fontSize: 17, lineHeight: 24 }}>{presentation.instruction}</Text>
        </MomentumSection>
        {issue ? <Text accessibilityRole="alert" style={{ color: theme.text, fontSize: 17, lineHeight: 24 }}>{issue}</Text> : null}
        {presentation.title === "Check configuration" || presentation.title === "Configuration ready" ? <MomentumSection title="Check actual browsing" category="calm">
          <Text style={{ color: theme.secondary, fontSize: 15, lineHeight: 24 }}>Open Cloudflare's safe adult-category test page: it should be blocked when that filtering layer works. Then open example.com: it should load. These links open your browser; FREED does not observe the result or mark protection verified.</Text>
          <Pressable testID="website-test-adult" accessibilityRole="button" onPress={() => openTest('https://nudity.testcategory.com')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.accent, fontSize: 17, fontWeight: '700' }}>Open adult-category test</Text></Pressable>
          <Pressable testID="website-test-normal" accessibilityRole="button" onPress={() => openTest('https://example.com')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.accent, fontSize: 17, fontWeight: '700' }}>Open normal website test</Text></Pressable>
          {browserIssue ? <Text accessibilityRole="alert" style={{ color: theme.text, lineHeight: 24 }}>{browserIssue}</Text> : null}
        </MomentumSection> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={showDetails ? "Hide setup help" : "Show setup help"} accessibilityState={{ expanded: showDetails }} onPress={onToggleDetails} style={{ minHeight: 44, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: theme.secondary, fontSize: 17, fontWeight: "700" }}>{showDetails ? "Hide help" : "Need help?"}</Text>
          {showDetails ? <ChevronUp size={18} color={theme.secondary} /> : <ChevronDown size={18} color={theme.secondary} />}
        </Pressable>
        {showDetails ? <View style={{ gap: 16 }}>
          <Text style={{ color: theme.secondary, fontSize: 17, lineHeight: 24 }}>Approve each request on your device. FREED checks the result when you return and opens the next step for you.</Text>
          {steps.filter(step => step.required).map(step => <View key={step.id} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            {step.status === "complete" ? <Check size={18} color={theme.accent} /> : <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: theme.border }} />}
            <Text style={{ flex: 1, color: theme.text, fontSize: 14 }}>{step.title}</Text>
            <Text style={{ color: theme.secondary, fontSize: 12 }}>{step.status === "complete" ? "Ready" : step.status === "unavailable" ? "Unavailable" : "Needed"}</Text>
          </View>)}
          {details}
        </View> : null}
        {inlineFooter ? footer : null}
      </ScrollView>
      {!inlineFooter ? footer : null}
    </SafeAreaView>
  );
}
