import React from 'react';
import { Text as NativeText, TextInput as NativeTextInput, Pressable as NativePressable, View as NativeView, Alert as NativeAlert, type TextProps, type TextInputProps, type PressableProps, type ViewProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@/i18n/number-format';
import { translateSource } from '@/i18n/runtime';
export type TextInput = NativeTextInput;

function translateChildren(children: React.ReactNode, language: string): React.ReactNode {
  if (typeof children === 'number') return formatNumber(children, language);
  if (typeof children === 'string') return translateSource(children, language as never);
  if (Array.isArray(children) && children.every(child => typeof child === 'string' || typeof child === 'number')) {
    const joined = children.join('');
    const translated = translateSource(joined, language as never);
    if (translated !== joined) return translated;
    // A JSX phrase can combine data with several independently authored labels.
    // When there is no complete template, retain the fragments and their spacing.
    return children.map(child => {
      if (typeof child === 'number') return formatNumber(child, language);
      const value = translateSource(child.trim(), language as never);
      return value === child.trim() ? child : `${child.match(/^\s*/)?.[0] ?? ''}${value}${child.match(/\s*$/)?.[0] ?? ''}`;
    });
  }
  return React.Children.map(children, child => typeof child === 'string' ? translateSource(child, language as never) : child);
}
export const Text = React.forwardRef<NativeText, TextProps & { translate?: boolean }>(function LocalizedText({ children, accessibilityLabel, accessibilityHint, translate = true, ...props }, ref) {
  const { i18n } = useTranslation();
  return <NativeText {...props} style={[{ fontSize: 17, writingDirection: translate ? i18n.language === 'ar' ? 'rtl' : 'ltr' : 'auto' }, props.style]} ref={ref} accessibilityLabel={accessibilityLabel ? translate ? translateSource(accessibilityLabel) : accessibilityLabel : undefined} accessibilityHint={accessibilityHint ? translate ? translateSource(accessibilityHint) : accessibilityHint : undefined}>{translate ? translateChildren(children, i18n.language) : children}</NativeText>;
});
export const TextInput = React.forwardRef<NativeTextInput, TextInputProps>(function LocalizedInput({ placeholder, accessibilityLabel, accessibilityHint, ...props }, ref) {
  const { i18n } = useTranslation();
  const identifier = props.secureTextEntry || ['email-address', 'url', 'phone-pad', 'number-pad', 'decimal-pad', 'numbers-and-punctuation'].includes(props.keyboardType ?? '') || ['password', 'newPassword', 'emailAddress'].includes(props.textContentType ?? '') || props.textContentType?.toLowerCase() === 'url';
  const rtl = !identifier && i18n.language === 'ar';
  return <NativeTextInput {...props} style={[{ writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }, props.style]} ref={ref} placeholder={placeholder ? translateSource(placeholder) : undefined} accessibilityLabel={accessibilityLabel ? translateSource(accessibilityLabel) : undefined} accessibilityHint={accessibilityHint ? translateSource(accessibilityHint) : undefined} />;
});
export const Pressable = React.forwardRef<React.ComponentRef<typeof NativePressable>, PressableProps & { translate?: boolean }>(function LocalizedPressable({ accessibilityLabel, accessibilityHint, translate = true, ...props }, ref) {
  useTranslation();
  return <NativePressable {...props} ref={ref} accessibilityLabel={translate && typeof accessibilityLabel === 'string' ? translateSource(accessibilityLabel) : accessibilityLabel} accessibilityHint={translate && typeof accessibilityHint === 'string' ? translateSource(accessibilityHint) : accessibilityHint} />;
});
export const View = React.forwardRef<NativeView, ViewProps>(function LocalizedView({ accessibilityLabel, accessibilityHint, ...props }, ref) {
  useTranslation();
  return <NativeView {...props} ref={ref} accessibilityLabel={accessibilityLabel ? translateSource(accessibilityLabel) : undefined} accessibilityHint={accessibilityHint ? translateSource(accessibilityHint) : undefined} />;
});
export const Alert = { ...NativeAlert, alert: (title: string, message?: string, buttons?: Parameters<typeof NativeAlert.alert>[2], options?: Parameters<typeof NativeAlert.alert>[3]) => NativeAlert.alert(translateSource(title), message ? translateSource(message) : message, buttons?.map(button => ({ ...button, text: button.text ? translateSource(button.text) : button.text })), options) };
