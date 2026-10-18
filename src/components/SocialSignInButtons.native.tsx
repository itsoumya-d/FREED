import { Pressable, Text, View } from '@/components/Localized';
import React from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import Svg, { Path } from "react-native-svg";
import { GoogleSigninButton } from "@react-native-google-signin/google-signin";
import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from "expo-apple-authentication";
import { radii, spacing } from "@/constants/design";
import { useAppTheme } from "@/design-system/use-app-theme";
import { createSocialLoginPressGate, presentSocialLogin, type SocialLoginProvider, type SocialSignInButtonsProps } from "@/lib/social-login-presenter";

export type { SocialSignInButtonsProps } from "@/lib/social-login-presenter";

export function SocialSignInButtons(props: SocialSignInButtonsProps) {
  const { colors, mode, typography } = useAppTheme();
  const styles = React.useMemo(() => createStyles(colors, mode, typography), [colors, mode, typography]);
  const appleForeground = mode === "dark" ? colors.black : colors.white;
  const [queuedProvider, setQueuedProvider] = React.useState<SocialLoginProvider | null>(null);
  const [startupError, setStartupError] = React.useState<string | null>(null);
  const latestProps = React.useRef(props);
  latestProps.current = props;
  const gate = React.useRef(createSocialLoginPressGate());
  const releaseFrame = React.useRef<number | null>(null);
  const model = presentSocialLogin({ ...props, platform: Platform.OS, busyProvider: props.busyProvider ?? queuedProvider });

  React.useLayoutEffect(() => {
    if (props.busyProvider === null) {
      gate.current.release();
      setQueuedProvider(null);
    }
  }, [props.busyProvider]);

  React.useEffect(() => () => {
    if (releaseFrame.current !== null) cancelAnimationFrame(releaseFrame.current);
  }, []);

  React.useEffect(() => {
    const announcement = startupError ?? model.busyAnnouncement;
    if (announcement && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(announcement);
  }, [startupError, model.busyAnnouncement]);

  const press = (provider: SocialLoginProvider) => {
    const current = latestProps.current;
    const currentModel = presentSocialLogin({ ...current, platform: Platform.OS });
    try {
      const started = gate.current.tryStart(provider, { available: !currentModel[provider].disabled, busyProvider: current.busyProvider }, () => {
        setStartupError(null);
        setQueuedProvider(provider);
        if (provider === "google") current.onGoogle();
        else current.onApple();
      });
      if (!started) return;
      if (releaseFrame.current !== null) cancelAnimationFrame(releaseFrame.current);
      // A fast cancellation may be batched without a visible busy render. Keep
      // the synchronous tap lock until the next frame, then use parent state.
      releaseFrame.current = requestAnimationFrame(() => {
        releaseFrame.current = null;
        if (latestProps.current.busyProvider === null) {
          gate.current.release();
          setQueuedProvider(null);
        }
      });
    } catch {
      gate.current.release();
      setQueuedProvider(null);
      setStartupError(`${provider === "google" ? "Google" : "Apple"} sign-in could not open. Try again.`);
    }
  };

  return (
    <View style={styles.group}>
      {model.google.visible ? (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={mode === "dark" ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light}
          style={styles.providerButton}
          disabled={model.google.disabled}
          onPress={() => press("google")}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Google"
          accessibilityHint={props.googleAvailable ? "Opens Google sign-in. You can cancel and keep using FREED." : "Google sign-in is unavailable in this build. You can continue with local progress and try again after updating FREED."}
          accessibilityState={{ disabled: model.google.disabled, busy: model.google.busy }}
        />
      ) : null}
      {model.apple.visible && Platform.OS === "android" ? (
        <Pressable
          style={({ pressed }) => [styles.androidApple, pressed && styles.pressedApple, model.apple.disabled && styles.disabledApple]}
          onPress={() => press("apple")}
          disabled={model.apple.disabled}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          accessibilityHint="Opens secure Apple sign-in. You can cancel and keep using FREED."
          accessibilityState={{ disabled: model.apple.disabled, busy: model.apple.busy }}
        >
          <Svg width={20} height={24} viewBox="0 0 24 28" accessible={false}>
            <Path fill={appleForeground} d="M19.67 14.17c.03-3.53 2.88-5.24 3.01-5.32-1.64-2.4-4.2-2.73-5.1-2.76-2.15-.23-4.23 1.29-5.32 1.29-1.12 0-2.81-1.27-4.63-1.23C5.28 6.2 3.06 7.54 1.85 9.63c-2.49 4.31-.63 10.66 1.75 14.15 1.19 1.7 2.58 3.59 4.4 3.53 1.79-.07 2.46-1.13 4.62-1.13 2.13 0 2.76 1.13 4.62 1.09 1.93-.03 3.14-1.7 4.28-3.42 1.38-1.96 1.93-3.89 1.95-3.99-.04-.02-3.78-1.44-3.8-5.69ZM16.17 3.8c.96-1.21 1.62-2.85 1.44-4.5-1.39.06-3.12.97-4.12 2.15-.88 1.04-1.67 2.74-1.46 4.33 1.56.12 3.14-.79 4.14-1.98Z" transform="translate(0 1)" />
          </Svg>
          <Text style={styles.androidAppleLabel}>Continue with Apple</Text>
        </Pressable>
      ) : model.apple.visible ? (
        <View
          pointerEvents={model.apple.disabled ? "none" : "auto"}
          style={model.apple.disabled ? styles.disabledApple : undefined}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
          accessibilityHint="Opens Apple sign-in. You can cancel and keep using FREED."
          accessibilityState={{ disabled: model.apple.disabled, busy: model.apple.busy }}
          onAccessibilityTap={() => press("apple")}
          accessibilityActions={[{ name: "activate" }]}
          onAccessibilityAction={(event) => { if (event.nativeEvent.actionName === "activate") press("apple"); }}
        >
          <AppleAuthenticationButton
            buttonType={AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={mode === "dark" ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radii.xs}
            style={styles.providerButton}
            onPress={() => press("apple")}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        </View>
      ) : null}
      {model.unavailableMessage ? (
        <Text selectable style={styles.notice}>{model.unavailableMessage}</Text>
      ) : null}
      <View
        style={styles.statusRow}
        accessible={Boolean(model.busyAnnouncement)}
        accessibilityRole={model.busyAnnouncement ? "progressbar" : undefined}
        accessibilityLabel={model.busyAnnouncement ?? undefined}
        accessibilityState={{ busy: Boolean(model.busyAnnouncement) }}
        accessibilityLiveRegion="polite"
      >
        {model.busyAnnouncement ? (
          <>
            <ActivityIndicator size="small" color={colors.mint} accessible={false} />
            <Text style={styles.statusText} accessible={false}>{model.busyAnnouncement}</Text>
          </>
        ) : null}
      </View>
      {startupError ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.errorText}>{startupError}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>["colors"], mode: ReturnType<typeof useAppTheme>["mode"], typography: ReturnType<typeof useAppTheme>["typography"]) => StyleSheet.create({
  group: { gap: spacing.sm, alignSelf: "stretch" },
  providerButton: { width: "100%", height: 48 },
  disabledApple: { opacity: 0.5 },
  pressedApple: { opacity: 0.75 },
  androidApple: { minHeight: 48, borderRadius: radii.xs, borderCurve: "continuous", backgroundColor: mode === "dark" ? colors.white : colors.black, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md },
  androidAppleLabel: { color: mode === "dark" ? colors.black : colors.white, fontSize: 17, fontWeight: "600" },
  statusRow: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  statusText: { flexShrink: 1, color: colors.text2, fontSize: 14, lineHeight: 20, fontWeight: typography.medium },
  notice: { color: colors.text2, fontSize: 14, lineHeight: 20, textAlign: "center" },
  errorText: { color: colors.text, fontSize: 14, lineHeight: 20, textAlign: "center" }
});

export default SocialSignInButtons;
