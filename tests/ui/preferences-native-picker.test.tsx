import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Picker } from '@expo/ui/swift-ui';
import { PreferencePicker } from '@/components/PreferencePicker.ios';
import { LANGUAGE_FLAGS } from '@/components/LanguagePicker';
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from '@/lib/app-preferences';

jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));

test('iOS appearance passes committed selection and segmented options to the native picker boundary', async () => {
  const onChange = jest.fn();
  const options = ['system', 'light', 'dark'].map(value => ({ value, label: value }));
  const screen = await render(<PreferencePicker testID="appearance" label="Appearance" value="dark" options={options} onChange={onChange} />);
  const native = screen.getByTestId('mock-native-preference-picker');
  expect(native.props.selection).toBe('dark');
  expect(native.props.label).toBe('Appearance');
  expect(native.props.modifiers).toContainEqual({ type: 'pickerStyle', value: 'segmented' });
  await fireEvent(native, 'selectionChange', 'system');
  expect(onChange).toHaveBeenCalledWith('system');
  expect(Picker).toHaveBeenCalled();
});

test('iOS language supplies all eleven tagged wheel choices including Arabic and System', async () => {
  const options = [{ value: 'system', label: 'System' }, ...SUPPORTED_LANGUAGES.map(value => ({ value, label: LANGUAGE_NAMES[value] }))];
  const onChange = jest.fn();
  const screen = await render(<PreferencePicker testID="language" label="Language" value="system" options={options} onChange={onChange} />);
  const native = screen.getByTestId('mock-native-preference-picker');
  expect(native.props.modifiers).toContainEqual({ type: 'pickerStyle', value: 'wheel' });
  for (const option of options) expect(screen.getByText(option.label).props.modifiers).toContainEqual({ type: 'tag', value: option.value });
  await fireEvent(native, 'selectionChange', 'ar');
  expect(onChange).toHaveBeenCalledWith('ar');
});

test('iOS language flags remain decorative and native names retain radio selection semantics', async () => {
  const options = [{ value: 'system', label: 'System' }, ...SUPPORTED_LANGUAGES.map(value => ({ value, label: LANGUAGE_NAMES[value], flag: LANGUAGE_FLAGS[value] }))];
  const onChange = jest.fn();
  const screen = render(<PreferencePicker testID="language" label="Language" value="ko" options={options} onChange={onChange} />);
  expect(screen.getByRole('radio', { name: '한국어' })).toBeChecked();
  const flag = screen.getByTestId('language-flag-ko', { includeHiddenElements: true });
  expect(flag.props.accessible).toBe(false);
  expect(flag.props.accessibilityElementsHidden).toBe(true);
  fireEvent.press(screen.getByRole('radio', { name: 'العربية' }));
  expect(onChange).toHaveBeenCalledWith('ar');
});
