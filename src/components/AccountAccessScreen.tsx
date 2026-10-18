import { MomentumPageHeader, MomentumSection } from './MomentumPageHeader';
import { Pressable, Text, TextInput, View } from '@/components/Localized';
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { Eye, EyeOff, Mail, Shield } from "lucide-react-native";
import { ArrowLeft } from '@/components/DirectionalIcons';
import { radii, spacing } from "@/constants/design";
import { useAppTheme } from "@/design-system/use-app-theme";
import { SocialSignInButtons } from "@/components/SocialSignInButtons";
import { getFirebaseAccountScope, getFirebaseAccountSummary, getFirebaseNativeAuthAdapter, startFirebaseClient } from "@/lib/firebase-native";
import { isAppleSignInAvailable, isGoogleSignInConfigured, signInWithApple, signInWithGoogle } from "@/lib/social-login";
import { beginEmailAccountAccess, submitEmailAccountAccess } from "@/lib/account-access-flow";
import type { AccountFlowControl } from '@/lib/user-journey';
import type { FirebaseAuthActionResult } from "@/lib/firebase-client";

export type AccountAccessScreenProps = {
  onConnected: (email: string | null) => void | Promise<void>;
  onSkip: () => void;
  onHelp?: () => void;
  /** Claims this interacted view until its explicit Finish or cancellation. */
  onFlowInteraction?: () => AccountFlowControl;
  linkExisting?: boolean;
  requiredEntry?: boolean;
  authUnavailableReason?: string;
  onRetryAuth?: () => void;
  initialEmail?: string;
  /** Explicitly signs out the guest while preserving local recovery history. */
  onSwitchAccount?: () => Promise<void>;
};

export type AccountAccessScreenHandle = { requestBack: () => void };

type Mode = "choices" | "create" | "sign-in" | "reset" | "reset-sent" | "verify" | "conflict";
type BusyAction = "google" | "apple" | "email" | "reset" | "verification" | "refresh" | "finish" | "switch";

/** Self-contained account access; the parent owns navigation after connection. */
export const AccountAccessScreen = React.forwardRef<AccountAccessScreenHandle, AccountAccessScreenProps>(function AccountAccessScreen({ onConnected, onSkip, linkExisting = false, initialEmail = "", onSwitchAccount, requiredEntry = false, authUnavailableReason, onRetryAuth, onFlowInteraction, onHelp }, forwardedRef) {
  const { t } = useTranslation();
  const { colors, mode: themeMode, typography } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, typography), [colors, typography]);
  const [mode, setMode] = React.useState<Mode>("choices");
  const [busy, setBusy] = React.useState<BusyAction | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [conflictOwner, setConflictOwner] = React.useState<string | null>(null);
  const [existingAccountFlow, setExistingAccountFlow] = React.useState(false);
  const [switchDestination, setSwitchDestination] = React.useState<"choices" | "sign-in">("choices");
  const [appleAvailable, setAppleAvailable] = React.useState(false);
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [connectedEmail, setConnectedEmail] = React.useState<string | null | undefined>(undefined);
  const [displayEmail, setDisplayEmail] = React.useState(initialEmail);
  const email = React.useRef(initialEmail);
  const password = React.useRef("");
  const confirmation = React.useRef("");
  const emailInput = React.useRef<TextInput>(null);
  const passwordInput = React.useRef<TextInput>(null);
  const confirmationInput = React.useRef<TextInput>(null);
  const active = React.useRef(true);
  const claimed = React.useRef(false);
  const connectedUid = React.useRef<string | null>(null);
  const interaction = React.useRef<AccountFlowControl | null>(null);
  const claimInteraction = () => {
    if (!interaction.current) interaction.current = onFlowInteraction?.() ?? null;
    return !interaction.current || interaction.current.isCurrent();
  };
  const isCurrentFlow = () => active.current && (!interaction.current || interaction.current.isCurrent());
  const clearCredentials = () => {
    email.current = "";
    password.current = "";
    confirmation.current = "";
    emailInput.current?.clear();
    passwordInput.current?.clear();
    confirmationInput.current?.clear();
  };
  const cancel = () => {
    if (claimed.current || !claimInteraction()) return;
    if (interaction.current && !interaction.current.complete()) return;
    interaction.current = null;
    clearCredentials();
    Keyboard.dismiss();
    onSkip();
  };
  const native = Platform.OS === "ios" || Platform.OS === "android";

  React.useEffect(() => {
    active.current = true;
    void isAppleSignInAvailable().then(value => { if (active.current) setAppleAvailable(value); }).catch(() => undefined);
    return () => { active.current = false; email.current = ""; password.current = ""; confirmation.current = ""; };
  }, []);

  const changeMode = (next: Mode) => {
    if (claimed.current || !claimInteraction()) return;
    Keyboard.dismiss();
    password.current = "";
    confirmation.current = "";
    setPasswordVisible(false);
    setMessage(null);
    setNotice(null);
    setConflictOwner(null);
    setMode(next);
  };

  const showGuestSwitch = (destination: "choices" | "sign-in") => {
    Keyboard.dismiss();
    password.current = "";
    confirmation.current = "";
    setPasswordVisible(false);
    setConflictOwner(getFirebaseAccountScope());
    setSwitchDestination(destination);
    setMessage(null);
    setNotice(null);
    setMode("conflict");
  };

  const openEmailSignIn = () => {
    if (claimed.current || !claimInteraction()) return;
    if (beginEmailAccountAccess("sign-in", getFirebaseAccountSummary()) === "guest-switch") showGuestSwitch("sign-in");
    else changeMode("sign-in");
  };

  const requestBack = () => {
    if (claimed.current) return;
    if (mode === "choices") cancel();
    else if (mode === "reset" || mode === "reset-sent") openEmailSignIn();
    else changeMode("choices");
  };
  React.useImperativeHandle(forwardedRef, () => ({ requestBack }));
  React.useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [mode, onSkip]);

  const showFailure = (result: FirebaseAuthActionResult) => {
    if (result.status === "cancelled") {
      setNotice(requiredEntry ? "Sign-in cancelled. Choose another method or return to Welcome." : "Sign-in cancelled. You can choose another method or continue for now.");
      return;
    }
    if (result.code === "account-conflict" && getFirebaseAccountSummary().anonymous) {
      showGuestSwitch("choices");
      return;
    }
    setMessage(result.reason ?? "Sign-in could not be completed. Try again.");
  };

  const run = async (action: BusyAction, task: () => Promise<void>) => {
    if (claimed.current || !claimInteraction()) return;
    claimed.current = true;
    setBusy(action);
    setMessage(null);
    setNotice(null);
    Keyboard.dismiss();
    try {
      const startup = await startFirebaseClient();
      if (!isCurrentFlow()) return;
      if (startup.status !== "started") { setMessage(requiredEntry ? "Account access is unavailable in this build. Check your connection and retry in the iOS or Android app." : "Account access is unavailable in this build. You can continue with progress on this device."); return; }
      await task();
    } catch {
      if (active.current) setMessage("This action could not be completed. Check your connection and try again.");
    } finally {
      claimed.current = false;
      if (active.current) setBusy(null);
    }
  };

  const switchAccount = () => {
    if (!onSwitchAccount) return;
    void run("switch", async () => {
      if (!conflictOwner || getFirebaseAccountScope() !== conflictOwner || !getFirebaseAccountSummary().anonymous) {
        setMessage("Your account changed. Return to account options and try again.");
        return;
      }
      await onSwitchAccount();
      if (!isCurrentFlow()) return;
      if (getFirebaseAccountScope() !== null) {
        setMessage("The guest account could not be signed out. Try again before switching accounts.");
        return;
      }
      setConflictOwner(null);
      setConnectedEmail(undefined);
      connectedUid.current = null;
      setExistingAccountFlow(true);
      setMode(switchDestination);
      setNotice(switchDestination === "sign-in" ? "Guest account signed out. Enter your existing account email and password. Your recovery history stays on this device." : "Guest account signed out. Choose the sign-in for your existing account. Your recovery history stays on this device.");
    });
  };

  const finish = async (fallbackEmail: string | null = connectedEmail ?? null, expectedUid: string | null = connectedUid.current) => {
    if (!isCurrentFlow()) return;
    if (expectedUid && getFirebaseAccountScope() !== expectedUid) { setMessage("Your account changed. Return to account options and try again."); return; }
    const account = getFirebaseAccountSummary();
    if (requiredEntry && (!account.signedIn || account.anonymous || !getFirebaseAccountScope())) { setMessage("A signed-in account is required. Choose an account method to continue."); return; }
    if (interaction.current && !interaction.current.complete()) return;
    interaction.current = null;
    clearCredentials();
    Keyboard.dismiss();
    setBusy("finish");
    await onConnected(getFirebaseAccountSummary().email ?? fallbackEmail);
  };

  const providerSignIn = (provider: "apple" | "google") => void run(provider, async () => {
    const adapter = getFirebaseNativeAuthAdapter();
    const ownerBefore = getFirebaseAccountScope();
    const shouldLink = linkExisting || getFirebaseAccountSummary().anonymous;
    if (provider === "apple" && Platform.OS === "android") {
      const result = await adapter.signInWithAppleProvider({ linkExisting: shouldLink });
      if (!isCurrentFlow()) return;
      if (result.ok) await finish(null, result.uid ?? null);
      else showFailure(result);
      return;
    }
    const social = provider === "google" ? await signInWithGoogle() : await signInWithApple();
    if (!isCurrentFlow()) return;
    if (!social.ok) {
      if (social.reason === "cancelled") setNotice(requiredEntry ? "Sign-in cancelled. Choose another method or return to Welcome." : "Sign-in cancelled. You can choose another method or continue for now.");
      else setMessage(social.message);
      return;
    }
    if (getFirebaseAccountScope() !== ownerBefore) { setMessage("Your account changed. Return to account options and try again."); return; }
    const input = social.token.provider === "google"
      ? { idToken: social.token.idToken, accessToken: social.token.accessToken }
      : { identityToken: social.token.identityToken, nonce: social.token.nonce };
    const result = shouldLink
      ? await adapter.linkProviderCredential(social.token.provider, input)
      : await adapter.exchangeProviderCredential(social.token.provider, input);
    if (!isCurrentFlow()) return;
    if (result.ok) await finish(social.email, result.uid ?? null);
    else showFailure(result);
  });

  const submitEmail = () => {
    if (mode === "create" && password.current !== confirmation.current) { setMessage("The passwords do not match. Enter them again."); return; }
    void run(mode === "reset" ? "reset" : "email", async () => {
      const adapter = getFirebaseNativeAuthAdapter();
      if (mode === "reset") {
        const result = await adapter.requestPasswordReset(email.current);
        if (!isCurrentFlow()) return;
        if (result.ok) { setDisplayEmail(email.current.trim().toLowerCase()); setMode("reset-sent"); }
        else showFailure(result);
        return;
      }
      const input = { email: email.current, password: password.current };
      const submission = await submitEmailAccountAccess(adapter, mode === "create" ? "create" : "sign-in", input, { linkExisting });
      if (!isCurrentFlow()) return;
      if (submission.status === "switch-required") { showGuestSwitch("sign-in"); return; }
      const result = submission.result;
      if (!isCurrentFlow()) return;
      if (!result.ok) { showFailure(result); return; }
      if (result.uid && getFirebaseAccountScope() !== result.uid) { setMessage("Your account changed. Return to account options and try again."); return; }
      connectedUid.current = result.uid ?? getFirebaseAccountScope();
      password.current = "";
      confirmation.current = "";
      const account = adapter.getAccountSummary();
      setConnectedEmail(account.email);
      if (account.emailVerified === true) { await finish(account.email); return; }
      setDisplayEmail(account.email ?? email.current.trim().toLowerCase());
      setMode("verify");
      const sent = await adapter.sendEmailVerification();
      if (!isCurrentFlow()) return;
      if (sent.ok) setNotice("Verification email sent. Check your inbox and spam folder.");
      else showFailure(sent);
    });
  };

  const resendVerification = () => void run("verification", async () => {
    if (getFirebaseAccountScope() !== connectedUid.current) { setMessage("Your account changed. Return to account options and try again."); return; }
    const result = await getFirebaseNativeAuthAdapter().sendEmailVerification();
    if (!isCurrentFlow()) return;
    if (result.ok) setNotice("Verification email sent. Check your inbox and spam folder.");
    else showFailure(result);
  });

  const checkVerification = () => void run("refresh", async () => {
    if (getFirebaseAccountScope() !== connectedUid.current) { setMessage("Your account changed. Return to account options and try again."); return; }
    const adapter = getFirebaseNativeAuthAdapter();
    const result = await adapter.reloadAccount();
    if (!isCurrentFlow()) return;
    if (!result.ok) { showFailure(result); return; }
    if (adapter.getAccountSummary().emailVerified === true) await finish(displayEmail);
    else setNotice("Your email is not verified yet. Open the link in your email, then check again.");
  });

  const title = mode === "choices" ? (connectedEmail !== undefined ? "Your account is connected" : existingAccountFlow ? "Sign in to your account" : linkExisting ? "Connect another sign-in" : "Connect your account")
    : mode === "create" ? (linkExisting ? "Connect email" : "Create your account")
    : mode === "sign-in" ? (linkExisting ? "Connect email" : "Welcome back")
    : mode === "reset" ? "Reset your password" : mode === "reset-sent" ? "Check your email" : mode === "conflict" ? (switchDestination === "sign-in" ? "Sign in to an existing account" : "Your guest account is still here") : "Verify your email";
  const description = mode === "choices" ? (connectedEmail !== undefined ? "Your sign-in is connected. Continue to return to FREED." : existingAccountFlow ? "Sign in with the account that owns your purchases. Recovery history stays on this device." : linkExisting ? "Add a sign-in to this account. Your purchases keep the same owner." : requiredEntry ? "Connect Apple, Google, or email to continue. Your recovery history stays on this device. Encrypted backup is optional." : "Keep your purchases connected to an account. Encrypted backup is optional, and recovery works without signing in.")
    : mode === "create" ? "Use your email to keep your account recoverable."
    : mode === "sign-in" ? "Enter the email and password for your FREED account."
    : mode === "reset" ? "We'll send a secure link to reset your password."
    : mode === "reset-sent" ? "If an account uses this email, a password reset link is on its way. Check your inbox and spam folder."
    : mode === "conflict" ? `${switchDestination === "sign-in" ? "To sign in, first switch away from this guest account." : "That sign-in belongs to an existing account."} Purchases owned by this guest account stay with it and will not move to the account you sign in to. Recovery history stays on this device.`
    : "Open the verification link in your email, then come back to confirm. Your account and purchases are connected.";
  const form = mode === "create" || mode === "sign-in" || mode === "reset";

  const actionButton = (label: string, onPress: () => void, primary = false) => (
    <Pressable onPress={onPress} disabled={busy !== null} accessibilityRole="button" accessibilityState={{ disabled: busy !== null }}
      style={({ pressed }) => [styles.button, primary ? styles.primary : styles.secondary, pressed && styles.pressed, busy !== null && styles.disabled]}>
      <Text style={[styles.buttonLabel, primary && styles.primaryLabel]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            {onHelp ? <Pressable accessibilityRole="button" accessibilityLabel={t("publicHelp.entry")} onPress={onHelp} style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}><Text translate={false} style={styles.buttonLabel}>{t("publicHelp.entry")}</Text></Pressable> : null}
            {mode !== "choices" ? <Pressable onPress={() => mode === "reset" || mode === "reset-sent" ? openEmailSignIn() : changeMode("choices")} disabled={busy !== null} accessibilityRole="button" accessibilityLabel="Back to account options" accessibilityState={{ disabled: busy !== null }} style={styles.back}>
              <ArrowLeft size={20} color={colors.text} /><Text style={styles.backLabel}>Back</Text>
            </Pressable> : null}
            <MomentumPageHeader pose={mode === "conflict" ? "reassure" : mode === "verify" ? "waiting" : "secure"} context={`account-${mode}`} title={title} description={description} category="reflection" variant={mode === "conflict" ? "calm" : "welcome"} compact restrained={mode === "conflict"} />

            {mode === "choices" ? <>
              {connectedEmail !== undefined ? <><Text translate={false} selectable style={styles.email}>{connectedEmail}</Text>{actionButton("Continue", () => void run("finish", () => finish()), true)}</> : <>
              <SocialSignInButtons googleAvailable={isGoogleSignInConfigured()} appleAvailable={appleAvailable} busyProvider={busy === "google" || busy === "apple" ? busy : null} disabled={busy !== null} onGoogle={() => providerSignIn("google")} onApple={() => providerSignIn("apple")} />
              <View style={styles.divider}><View style={styles.line} /><Text style={styles.small}>or use email</Text><View style={styles.line} /></View>
              {native ? <>{actionButton(existingAccountFlow ? "Sign in with email" : linkExisting ? "Connect email" : "Create account with email", () => existingAccountFlow ? openEmailSignIn() : changeMode("create"), true)}
                {!linkExisting && !existingAccountFlow ? actionButton("Sign in with email", openEmailSignIn) : null}</> : null}
              </>}
            </> : null}

            {mode === "conflict" ? <>
              {actionButton("Keep guest account", () => changeMode("choices"), true)}
              {onSwitchAccount ? actionButton("Switch to an existing account", switchAccount) : null}
              <Text style={styles.footer}>To keep this guest account recoverable, connect an Apple, Google, or email sign-in that is not already used by another account.</Text>
            </> : null}

            {form ? <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput keyboardAppearance={themeMode === "dark" ? "dark" : "light"} selectionColor={colors.mint} key={`${mode}-email`} ref={emailInput} defaultValue={email.current} onChangeText={value => { email.current = value; }} style={styles.input} editable={busy === null} accessibilityLabel="Email address" placeholder="you@example.com" placeholderTextColor={colors.text3} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" maxLength={254} returnKeyType={mode === "reset" ? "send" : "next"} onSubmitEditing={() => mode === "reset" ? submitEmail() : passwordInput.current?.focus()} />
              </View>
              {mode !== "reset" ? <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput keyboardAppearance={themeMode === "dark" ? "dark" : "light"} selectionColor={colors.mint} key={`${mode}-password`} ref={passwordInput} defaultValue="" onChangeText={value => { password.current = value; }} style={styles.passwordInput} editable={busy === null} accessibilityLabel="Password" secureTextEntry={!passwordVisible} autoCapitalize="none" autoCorrect={false} textContentType={mode === "create" ? "newPassword" : "password"} autoComplete={mode === "create" ? "new-password" : "current-password"} maxLength={1024} returnKeyType={mode === "create" ? "next" : "go"} onSubmitEditing={() => mode === "create" ? confirmationInput.current?.focus() : submitEmail()} />
                    <Pressable onPress={() => setPasswordVisible(value => !value)} disabled={busy !== null} accessibilityRole="button" accessibilityLabel={passwordVisible ? "Hide password" : "Show password"} accessibilityState={{ disabled: busy !== null }} style={styles.eye}>{passwordVisible ? <EyeOff size={20} color={colors.text2} /> : <Eye size={20} color={colors.text2} />}</Pressable>
                  </View>
                  {mode === "create" ? <Text style={styles.small}>Use at least 8 characters.</Text> : null}
                </View>
                {mode === "create" ? <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput keyboardAppearance={themeMode === "dark" ? "dark" : "light"} selectionColor={colors.mint} key="confirm-password" ref={confirmationInput} defaultValue="" onChangeText={value => { confirmation.current = value; }} style={styles.input} editable={busy === null} accessibilityLabel="Confirm password" secureTextEntry={!passwordVisible} autoCapitalize="none" autoCorrect={false} textContentType="newPassword" autoComplete="new-password" maxLength={1024} returnKeyType="go" onSubmitEditing={submitEmail} />
                </View> : actionButton("Forgot password?", () => changeMode("reset"))}
              </> : null}
              {actionButton(mode === "reset" ? "Send reset email" : mode === "create" ? (linkExisting ? "Connect email" : "Create account") : "Sign in", submitEmail, true)}
              {mode === "create" && !linkExisting ? actionButton("Already have an account? Sign in", openEmailSignIn) : null}
            </View> : null}

            {mode === "reset-sent" ? <><Text translate={false} selectable style={styles.email}>{displayEmail}</Text>{actionButton("Back to sign in", openEmailSignIn, true)}{actionButton("Use a different email", () => changeMode("reset"))}</> : null}
            {mode === "verify" ? <><Text translate={false} selectable style={styles.email}>{displayEmail}</Text>{actionButton("I've verified my email", checkVerification, true)}{actionButton("Resend verification email", resendVerification)}{actionButton("Continue and verify later", () => void run("finish", () => finish(displayEmail)))}</> : null}

            {busy && busy !== "google" && busy !== "apple" ? <View accessibilityRole="progressbar" accessibilityLabel={busy === "refresh" ? "Checking email verification" : busy === "finish" ? "Connecting your account" : busy === "switch" ? "Signing out of the guest account" : "Contacting account service"} accessibilityLiveRegion="polite" style={styles.status}><ActivityIndicator color={colors.mint} /><Text style={styles.description}>{busy === "refresh" ? "Checking verification…" : busy === "finish" ? "Connecting your account…" : busy === "switch" ? "Signing out of the guest account…" : "Please wait…"}</Text></View> : null}
            {authUnavailableReason ? <><Text accessibilityRole="alert" style={styles.error}>{authUnavailableReason}</Text>{onRetryAuth ? actionButton("Retry account access", onRetryAuth) : null}</> : null}
            {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{message}</Text> : null}
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
            {mode === "choices" && connectedEmail === undefined ? <>{actionButton(requiredEntry ? "Back to Welcome" : linkExisting ? "Cancel" : "Skip for now", cancel)}{requiredEntry ? <Text style={styles.footer}>Your progress stays on this device while you connect an account.</Text> : <Text style={styles.footer}>Progress stays on this device. You can connect an account later in Profile.</Text>}</> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

const createStyles = (colors: ReturnType<typeof useAppTheme>["colors"], typography: ReturnType<typeof useAppTheme>["typography"]) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.xl, justifyContent: "flex-start" },
  content: { width: "100%", maxWidth: 480, alignSelf: "center", gap: 24 },
  hero: { alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  icon: { width: 64, height: 64, backgroundColor: colors.surface2, borderRadius: radii.lg, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 32, lineHeight: 40, fontWeight: typography.heavy, textAlign: "center" },
  description: { color: colors.text2, fontSize: 17, lineHeight: 24, textAlign: "center" },
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: spacing.xs, minHeight: 44, paddingRight: spacing.md },
  backLabel: { color: colors.text, fontSize: 17, fontWeight: typography.semibold },
  form: { gap: 16, backgroundColor: colors.surface, borderRadius: 20, borderCurve: "continuous", padding: 16, borderWidth: 1, borderColor: colors.border },
  fieldGroup: { gap: spacing.xs },
  label: { color: colors.text, fontSize: 17, fontWeight: typography.semibold },
  input: { backgroundColor: colors.surface, borderRadius: 16, borderCurve: "continuous", minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: 17, borderWidth: 1, borderColor: colors.border },
  passwordRow: { backgroundColor: colors.surface, borderRadius: 16, borderCurve: "continuous", flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border },
  passwordInput: { flex: 1, minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.text, fontSize: 17 },
  eye: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center" },
  button: { minHeight: 52, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 16, borderCurve: "continuous", alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.mint },
  secondary: { backgroundColor: colors.surface2 },
  buttonLabel: { color: colors.text, textAlign: "center", fontSize: 17, fontWeight: typography.semibold },
  primaryLabel: { color: colors.onAccent, fontWeight: typography.bold },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  divider: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  small: { color: colors.text2, fontSize: 13, lineHeight: 20 },
  status: { flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center" },
  email: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: typography.semibold, textAlign: "center" },
  error: { color: colors.text, fontSize: 14, lineHeight: 21, textAlign: "center", padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 16, borderCurve: "continuous", backgroundColor: colors.surface },
  notice: { color: colors.text2, fontSize: 14, lineHeight: 21, textAlign: "center" },
  footer: { color: colors.text2, fontSize: 12, lineHeight: 19, textAlign: "center" }
});

export default AccountAccessScreen;
