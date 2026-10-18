import { useAppTheme } from '@/design-system/use-app-theme';
import { View } from '@/components/Localized';
import React from "react";
import { StyleSheet, type ViewStyle } from 'react-native';
import { LinearGradient } from "expo-linear-gradient";
import { radii } from "@/constants/design";

export interface CardProps {
  children: React.ReactNode;
  gradient?: readonly [string, string] | readonly [string, string, string];
  style?: ViewStyle | ViewStyle[];
  surfaceVariant?: "default" | "surface2" | "surface3";
}

/**
 * Benchmark-quality card container with continuous squircle corners (borderCurve: "continuous"),
 * semantic elevation, and subtle surface framing.
 */
export const Card: React.FC<CardProps> = ({
  children,
  gradient,
  style,
  surfaceVariant = "default"
}) => {
  const { colors } = useAppTheme();
  const surfaceColor =
    surfaceVariant === "surface2"
      ? colors.surface2
      : surfaceVariant === "surface3"
      ? colors.surface3
      : colors.surface;

  const inner = (
    <View
      style={[
        styles.inner,
        style
      ]}
    >
      {children}
    </View>
  );

  if (!gradient) {
    return (
      <View style={[styles.container, { backgroundColor: surfaceColor }]}>
        {inner}
      </View>
    );
  }

  return (
    <LinearGradient colors={gradient} style={styles.container}>
      {inner}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: 'transparent',
    overflow: "hidden",
    boxShadow: "none"
  },
  inner: {
    padding: 16
  }
});

export default Card;
