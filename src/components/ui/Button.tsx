import { useAppTheme } from '@/design-system/use-app-theme';
import { Pressable, Text } from '@/components/Localized';
import React from "react";
import { StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from "react-native-reanimated";
import { radii, typography } from "@/constants/design";
import { PRESS_SPRING, useMotionSettings } from "@/design-system/motion";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger" | "success" | "secondary";
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  labelStyle?: TextStyle | TextStyle[];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  minHeight?: number;
}

/**
 * Benchmark native pill button adhering to Appllama Fidelity & Anti-Slop laws.
 * Enforces continuous squircle curvature, >= 48pt touch targets, and tactile haptic feedback.
 */
export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  style,
  labelStyle,
  accessibilityLabel,
  accessibilityHint,
  minHeight = 48
}) => {
  const { colors } = useAppTheme();
  const scale = useSharedValue(1);
  const { spatialMotion } = useMotionSettings();
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isSuccess = variant === "success";
  const isSecondary = variant === "secondary";

  const backgroundColor = isPrimary
    ? colors.mint
    : isSuccess
    ? colors.accentTint
    : isDanger
    ? colors.surface2
    : isSecondary
    ? colors.surface2
    : colors.surface2;

  const borderColor = isPrimary
    ? "transparent"
    : isDanger
    ? `${colors.red}66`
    : isSuccess
    ? colors.accent
    : colors.border;

  const textColor = isPrimary
    ? colors.onAccent
    : isDanger
    ? colors.red2
    : isSuccess
    ? colors.mint
    : colors.text;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: Boolean(disabled) }}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          onPress();
        }}
        onPressIn={() => {
          scale.value = spatialMotion ? withSpring(0.97, PRESS_SPRING) : 1;
        }}
        onPressOut={() => {
          scale.value = spatialMotion ? withSpring(1, PRESS_SPRING) : 1;
        }}
        style={[
          styles.button,
          {
            minHeight,
            backgroundColor,
            borderColor,
            borderWidth: isPrimary ? 0 : 1.2,
            opacity: disabled ? 0.42 : 1
          },
          { boxShadow: "none" },
          style
        ]}
      >
        {icon}
        <Text
          selectable={false}
          style={[
            styles.label,
            {
              color: textColor
            },
            labelStyle
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 22,
    paddingVertical: 12
  },
  label: {
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1
  }
});

export default Button;
