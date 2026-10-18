import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TextInput, Pressable, Text } from '@/components/Localized';
import { MomentumSection } from '@/components/MomentumPageHeader';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('lucide-react-native', () => ({ ChevronDown: () => null, ChevronRight: () => null, ChevronLeft: () => null }));
function Draft() { const [text, setText] = React.useState(''); return <TextInput accessibilityLabel="Private reflection" value={text} onChangeText={setText} />; }
test('a grouped section reveals its real controls and preserves a private draft when collapsed', () => {
  const onSave = jest.fn();
  const screen = render(<MomentumSection title="Reflection" category="reflection" collapsible initiallyExpanded={false}><Draft /><Pressable accessibilityRole="button" accessibilityLabel="Save Check-In" onPress={onSave}><Text>Save Check-In</Text></Pressable></MomentumSection>);
  expect(screen.queryByRole('button', { name: 'Save Check-In' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Reflection' }));
  fireEvent.changeText(screen.getByLabelText('Private reflection'), 'My private draft');
  fireEvent.press(screen.getByRole('button', { name: 'Reflection' }));
  expect(screen.queryByRole('button', { name: 'Save Check-In' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Reflection' }));
  expect(screen.getByLabelText('Private reflection').props.value).toBe('My private draft');
  fireEvent.press(screen.getByRole('button', { name: 'Save Check-In' })); expect(onSave).toHaveBeenCalledTimes(1);
});

test('a reorganized settings header retains its enable control and busy guard', () => {
  const { MomentumSettingHeader } = require('@/components/MomentumSettingHeader');
  const onChange = jest.fn();
  const screen = render(<MomentumSettingHeader title="Accountability Partner" description="One trusted person can be one tap away during a risk moment." category="reflection" enabled={false} onChange={onChange} />);
  fireEvent(screen.getByRole('switch', { name: 'Accountability Partner' }), 'valueChange', true);
  expect(onChange).toHaveBeenCalledWith(true);
  screen.rerender(<MomentumSettingHeader title="Recovery Reminders" category="calm" enabled busy onChange={onChange} />);
  expect(screen.getByRole('switch', { name: 'Recovery Reminders' })).toBeDisabled();
});
