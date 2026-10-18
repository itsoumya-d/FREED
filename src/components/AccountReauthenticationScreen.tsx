import { MomentumPageHeader } from './MomentumPageHeader';
import { Pressable, Text, TextInput, View } from '@/components/Localized';
import React from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Shield, Eye, EyeOff } from "lucide-react-native";
import { radii, spacing } from "@/constants/design";
import { useAppTheme } from "@/design-system/use-app-theme";
import { getFirebaseAccountScope, getFirebaseAccountSummary, getFirebaseNativeAuthAdapter } from "@/lib/firebase-native";
import { SocialSignInButtons } from "@/components/SocialSignInButtons";
import type { SocialLoginProvider } from "@/lib/social-login-presenter";
import { signInWithGoogle } from "@/lib/social-login";

export type AccountReauthenticationScreenProps = {
  /** Must run Apple revocation (when linked) before requesting account deletion. */
  onConfirmed: (expectedAccountUid: string) => Promise<void>;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
};

/** Recent authentication for sensitive actions never signs into another UID. */
export function AccountReauthenticationScreen({ onConfirmed, onCancel, onBusyChange }: AccountReauthenticationScreenProps) {
  const { colors, mode: themeMode, typography } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, typography), [colors, typography]);
  const account = React.useMemo(() => getFirebaseAccountSummary(), []);
  const owner = React.useRef(getFirebaseAccountScope());
  const [busy, setBusy] = React.useState(false);
  const [busyProvider, setBusyProvider] = React.useState<SocialLoginProvider | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const password = React.useRef("");
  const active = React.useRef(true);
  const claimed = React.useRef(false);
  const apple = account.providers.includes("apple.com");
  const google = account.providers.includes("google.com");
  const email = account.providers.includes("password");

  React.useEffect(() => {
    active.current = true;
    return () => { active.current = false; password.current = ""; };
  }, []);

  const run = async (task: () => Promise<void>, provider: SocialLoginProvider | null = null) => {
    if (claimed.current) return;
    if (!owner.current || getFirebaseAccountScope() !== owner.current) { setMessage("Your account changed. Close this screen and try again."); return; }
    claimed.current = true;
    setBusy(true);
    setBusyProvider(provider);
    onBusyChange?.(true);
    setMessage(null);
    setNotice(null);
    try { await task(); }
    catch { if (active.current) setMessage("Account confirmation could not be completed. Check your connection and try again."); }
    finally { claimed.current = false; if (active.current) { setBusy(false); setBusyProvider(null); } onBusyChange?.(false); }
  };

  const proceed = async () => {
    if (!active.current) return;
    if (getFirebaseAccountScope() !== owner.current) { setMessage("Your account changed. Close this screen and try again."); return; }
    password.current = "";
    if (!owner.current) { setMessage("Your account changed. Close this screen and try again."); return; }
    await onConfirmed(owner.current);
  };

  const confirmEmail = () => void run(async () => {
    const result = await getFirebaseNativeAuthAdapter().reauthenticateProviderCredential("email", { email: account.email ?? "", password: password.current });
    if (!active.current) return;
    if (result.ok) await proceed();
    else setMessage(result.reason ?? "The password could not be confirmed. Try again.");
  });

  const confirmGoogle = () => void run(async () => {
    const social = await signInWithGoogle();
    if (!active.current) return;
    if (!social.ok) {
      if (social.reason === "cancelled") setNotice("Google confirmation cancelled. Your account is still here.");
      else setMessage(social.message);
      return;
    }
    if (social.token.provider !== "google") return;
    if (getFirebaseAccountScope() !== owner.current) { setMessage("Your account changed. Close this screen and try again."); return; }
    const result = await getFirebaseNativeAuthAdapter().reauthenticateProviderCredential("google", { idToken: social.token.idToken, accessToken: social.token.accessToken });
    if (!active.current) return;
    if (result.ok) await proceed();
    else setMessage(result.reason ?? "Google could not confirm this account. Choose the Google account already connected to FREED.");
  }, "google");

  const resetPassword = () => void run(async () => {
    const result = await getFirebaseNativeAuthAdapter().requestPasswordReset(account.email ?? "");
    if (!active.current) return;
    if (result.ok) setNotice("A reset link is on its way if this email has an account. Reset your password, then return here to confirm.");
    else setMessage(result.reason ?? "The reset email could not be sent.");
  });

  const button = (label: string, action: () => void, primary = false) => <Pressable onPress={action} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }} style={({ pressed }) => [styles.button, primary && styles.primary, pressed && styles.pressed, busy && styles.disabled]}><Text style={[styles.buttonLabel, primary && styles.primaryLabel]}>{label}</Text></Pressable>;

  return <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scroll}>
    <View style={styles.content}>
      <MomentumPageHeader pose="secure" context="account-reauthentication" compact restrained category="commitment" variant="calm" title={account.anonymous ? "Delete guest account and data" : "Confirm account deletion"} description={account.anonymous ? "This deletes the guest account, hosted data, and recovery history on this device. This cannot be undone." : "Confirm the account connected to FREED before deleting it. Cancelling keeps your account and purchases connected."} />
      {account.email ? <Text translate={false} selectable style={styles.identity}>{account.email}</Text> : null}
      {account.anonymous ? button("Delete guest account and data", () => void run(proceed), true) : apple ? <><SocialSignInButtons googleAvailable={false} appleAvailable busyProvider={busyProvider} disabled={busy} onGoogle={confirmGoogle} onApple={() => void run(proceed, "apple")} /><Text style={styles.description}>Apple will ask you to confirm. Its authorization will be revoked before account deletion.</Text></> : <>
        {email ? <>
          <Text style={styles.label}>Password</Text><View style={styles.passwordRow}><TextInput keyboardAppearance={themeMode === "dark" ? "dark" : "light"} selectionColor={colors.mint} defaultValue="" onChangeText={value => { password.current = value; }} secureTextEntry={!visible} editable={!busy} style={styles.input} accessibilityLabel="Account password" textContentType="password" autoComplete="current-password" autoCapitalize="none" autoCorrect={false} maxLength={1024} returnKeyType="go" onSubmitEditing={confirmEmail} /><Pressable disabled={busy} onPress={() => setVisible(value => !value)} style={styles.eye} accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} accessibilityState={{ disabled: busy }}>{visible ? <EyeOff size={20} color={colors.text2} /> : <Eye size={20} color={colors.text2} />}</Pressable></View>
          {button("Confirm password", confirmEmail, true)}{button("Forgot password?", resetPassword)}
        </> : null}
        {google ? <SocialSignInButtons googleAvailable appleAvailable={false} busyProvider={busyProvider} disabled={busy} onGoogle={confirmGoogle} onApple={() => undefined} /> : null}
        {!google && !email ? <Text style={styles.description}>A supported sign-in must be connected to this account before it can be confirmed.</Text> : null}
      </>}
      {busy && !busyProvider ? <View style={styles.status} accessibilityRole="progressbar" accessibilityLabel="Confirming your account" accessibilityLiveRegion="polite"><ActivityIndicator color={colors.mint} /><Text style={styles.description}>Confirming your account…</Text></View> : null}
      {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{message}</Text> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.description}>{notice}</Text> : null}
      {button("Cancel", onCancel)}
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

const createStyles = (colors: ReturnType<typeof useAppTheme>["colors"], typography: ReturnType<typeof useAppTheme>["typography"]) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: "flex-start" }, content: { maxWidth: 480, width: "100%", alignSelf: "center", gap: spacing.md },
  icon: { alignSelf: "center" }, title: { color: colors.text, fontSize: 32, lineHeight: 40, fontWeight: typography.heavy, textAlign: "center" },
  description: { color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: "center" }, identity: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.semibold, textAlign: "center" }, label: { color: colors.text, fontSize: 17, fontWeight: typography.semibold },
  passwordRow: { backgroundColor: colors.surface, borderRadius: 16, borderCurve: "continuous", flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border }, input: { flex: 1, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: 17 }, eye: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  button: { minHeight: 52, padding: spacing.md, borderRadius: 16, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 }, primary: { backgroundColor: colors.mint }, buttonLabel: { color: colors.text, textAlign: "center", fontSize: 17, fontWeight: typography.semibold }, primaryLabel: { color: colors.onAccent, fontWeight: typography.bold }, pressed: { opacity: 0.75 }, disabled: { opacity: 0.5 },
  status: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, error: { color: colors.text, fontSize: 14, lineHeight: 21, textAlign: "center", padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, borderCurve: "continuous", backgroundColor: colors.surface }
});

export default AccountReauthenticationScreen;
