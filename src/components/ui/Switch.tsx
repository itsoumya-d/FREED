import React from "react";
import { Switch as RNSwitch, Platform, type SwitchProps as RNSwitchProps } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppTheme } from '@/design-system/use-app-theme';

export interface SwitchProps extends RNSwitchProps {
  onValueChange?: (value: boolean) => void;
}

/**
 * Platform native Switch with Appllama haptic feedback and semantic styling.
 */
export const Switch: React.FC<SwitchProps> = ({
  value,
  onValueChange,
  disabled,
  ...rest
}) => {
  const { colors } = useAppTheme();
  return (
    <RNSwitch
      value={value}
      disabled={disabled}
      trackColor={{
        false: colors.surface3,
        true: colors.mint
      }}
      thumbColor={Platform.select({
        ios: colors.white,
        default: value ? colors.onAccent : colors.text3
      })}
      ios_backgroundColor={colors.surface3}
      onValueChange={(nextValue) => {
        void Haptics.selectionAsync().catch(() => undefined);
        onValueChange?.(nextValue);
      }}
      {...rest}
    />
  );
};

export default Switch;
