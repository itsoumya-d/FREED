import React from 'react';
import { render } from '@testing-library/react-native';
import { useInitialRoute } from '@/hooks/use-initial-route';
let mockFocused = false;
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
function Probe({ ready, onAdvance }: { ready: boolean; onAdvance: () => void }) {
  useInitialRoute(ready, onAdvance);
  return null;
}
test('a retained hidden startup route cannot redirect quiz, sheets or forms after state updates', () => {
  const advance = jest.fn();
  const screen = render(<Probe ready={false} onAdvance={advance} />);
  screen.rerender(<Probe ready onAdvance={() => advance()} />);
  screen.rerender(<Probe ready onAdvance={() => advance()} />);
  expect(advance).not.toHaveBeenCalled();
  mockFocused = true;
  screen.rerender(<Probe ready onAdvance={() => advance()} />);
  expect(advance).toHaveBeenCalledTimes(1);
  screen.rerender(<Probe ready onAdvance={() => advance()} />);
  expect(advance).toHaveBeenCalledTimes(1);
  mockFocused = false;
  screen.rerender(<Probe ready onAdvance={() => advance()} />);
  expect(advance).toHaveBeenCalledTimes(1);
});
