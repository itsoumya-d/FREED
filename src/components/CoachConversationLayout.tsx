import React from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, View as NativeView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from './Localized';
import { useAppTheme } from '@/design-system/use-app-theme';

/** The transcript scrolls independently; the composer stays above the keyboard. */
export function CoachConversationLayout({ children, composer, header, keyboardVerticalOffset, onMeasuredOrigin }: {
  children: React.ReactNode; composer: React.ReactNode; header?: React.ReactNode;
  /** Optional caller override when its modal/navigation host has an authoritative measurement. */
  keyboardVerticalOffset?: number;
  onMeasuredOrigin?: (windowY: number) => void;
}) {
  const { colors } = useAppTheme(); const insets = useSafeAreaInsets();
  const container = React.useRef<NativeView>(null);
  const mounted = React.useRef(true), lastOrigin = React.useRef<number | null>(null);
  const measurement = React.useRef(0);
  const [origin, setOrigin] = React.useState(0);
  const measureOrigin = React.useCallback(() => {
    const request = ++measurement.current;
    container.current?.measureInWindow((_x, windowY) => {
      if (!mounted.current || request !== measurement.current || !Number.isFinite(windowY) || lastOrigin.current === windowY) return;
      lastOrigin.current = windowY;
      setOrigin(windowY);
      onMeasuredOrigin?.(windowY);
    });
  }, [onMeasuredOrigin]);
  React.useEffect(() => {
    mounted.current = true;
    // These events refresh only the window origin. RN owns keyboard displacement/animation.
    const listeners = [Keyboard.addListener('keyboardWillChangeFrame', measureOrigin),
      Keyboard.addListener('keyboardDidShow', measureOrigin), Keyboard.addListener('keyboardDidHide', measureOrigin)];
    return () => { mounted.current = false; measurement.current += 1; listeners.forEach(listener => listener.remove()); };
  }, [measureOrigin]);
  const offset = typeof keyboardVerticalOffset === 'number' && Number.isFinite(keyboardVerticalOffset) ? keyboardVerticalOffset : origin;
  // The inner KAV starts at local y=0; the wrapper's window origin supplies its missing modal offset.
  return <NativeView ref={container} testID="coach-layout" onLayout={measureOrigin} style={{ flex: 1, minHeight: 0, backgroundColor: colors.bg }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} enabled={Platform.OS === 'ios'}
      keyboardVerticalOffset={offset} style={{ flex: 1, minHeight: 0, backgroundColor: colors.bg }}>
      {header}
      <ScrollView testID="coach-transcript" style={{ flex: 1, minHeight: 0 }} keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive" contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
        automaticallyAdjustKeyboardInsets={false} contentContainerStyle={{ padding: 20, paddingBottom: 16, gap: 16 }}>{children}</ScrollView>
      <View testID="coach-composer" style={{ flexShrink: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(12, insets.bottom),
        borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg }}>{composer}</View>
    </KeyboardAvoidingView>
  </NativeView>;
}
