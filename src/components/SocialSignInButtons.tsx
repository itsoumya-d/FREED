import { Text, View } from '@/components/Localized';
import React from "react";
import { StyleSheet } from 'react-native';
import { useAppTheme } from "@/design-system/use-app-theme";
import { presentSocialLogin, type SocialSignInButtonsProps } from "@/lib/social-login-presenter";

export type { SocialSignInButtonsProps } from "@/lib/social-login-presenter";

/** Native provider controls and callbacks are intentionally unavailable on web. */
export function SocialSignInButtons(props: SocialSignInButtonsProps) {
  const { colors } = useAppTheme();
  const model = presentSocialLogin({ ...props, platform: "web" });
  return (
    <View style={styles.container}>
      <Text selectable style={[styles.message, { color: colors.text2 }]}>{model.unavailableMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: "stretch" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" }
});

export default SocialSignInButtons;
