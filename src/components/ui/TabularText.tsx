import { Text } from '@/components/Localized';
import React from "react";
import { StyleSheet, type TextProps } from 'react-native';
import { typography } from "@/constants/design";

export interface TabularTextProps extends TextProps {
  children: React.ReactNode;
}

/**
 * Text component with tabular numerals (fontVariant: ["tabular-nums"])
 * guaranteed to prevent layout shifts on numbers, timers, prices, and stats.
 */
export const TabularText: React.FC<TabularTextProps> = ({
  children,
  style,
  selectable = true,
  ...rest
}) => {
  return (
    <Text
      selectable={selectable}
      style={[styles.tabular, style]}
      {...rest}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  tabular: {
    fontVariant: ["tabular-nums"],
    fontFamily: typography.familyFallback
  }
});

export default TabularText;
