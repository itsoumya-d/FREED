jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ProtectionSetupView } from '@/components/ProtectionSetupView';
import { presentProtectionSetup } from '@/lib/protection-setup-presenter';
import '@/i18n/runtime';
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('lucide-react-native', () => ({ Check: () => null, ChevronDown: () => null, ChevronUp: () => null, ShieldCheck: () => null, Smartphone: () => null }));
test('permission failure keeps limited continuation visible without expanding technical help', () => {
  const exit = jest.fn();
  const presentation = presentProtectionSetup({ platform: 'ios', step: null, complete: false, ready: false, busy: null });
  const screen = render(<ProtectionSetupView presentation={presentation} busy={false} onContinue={jest.fn()} details={null} onToggleDetails={jest.fn()} showDetails={false} steps={[]} limited onLimited={exit} issue="Screen Time access wasn't approved. Try again, or open Help for other options." />);
  fireEvent.press(screen.getByText('Continue with limited protection'));
  expect(exit).toHaveBeenCalledTimes(1);
});
