import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { G } from 'react-native-svg';
import { KiteCompanionRig } from '@/components/KiteCompanionRig';
import { MomentumCompanion, clearCompanionPresentationHistory } from '@/components/MomentumCompanion';
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-image', () => ({ Image: require('react-native').Image }));
jest.mock('expo-haptics', () => ({ selectionAsync: () => Promise.resolve() }));
let mockActive = true;
let mockReduced = true;
let mockViewportVisible = true;
let mockMotionOff = false;
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ spatialMotion: !mockReduced, reduceMotion: mockReduced, active: mockActive, focused: true, foreground: true }), SPRINGS: { snap: {}, pop: {} } }));
jest.mock('@/hooks/use-app-preferences', () => ({ useOptionalAppPreferences: () => ({ mode: 'light', preferences: { companionMotion: mockMotionOff ? 'off' : 'system' } }) }));
jest.mock('@/hooks/use-companion-viewport', () => ({ useCompanionViewport: (parentVisible: boolean) => ({ ref: require('react').useRef(null), onLayout: () => undefined, visible: parentVisible && mockViewportVisible }) }));
const wrap = (child: React.ReactNode) => <I18nextProvider i18n={appI18n}>{child}</I18nextProvider>;
beforeEach(() => { mockActive = true; mockReduced = true; mockViewportVisible = true; mockMotionOff = false; });
beforeAll(() => { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } }); });
test('tap opens contextual help under Reduce Motion and runs only the selected action', () => {
    const action = jest.fn();
    const view = render(wrap(<MomentumCompanion pose="shield" help={{ title: 'Check protection', body: 'Check the actual connection before trusting the shield.', actions: [{ label: 'Check now', onPress: action }] }}/>));
    fireEvent.press(view.getByRole('button', { name: /FREED companion/ }));
    expect(view.getByText('Check protection')).toBeVisible();
    expect(view.getByText('Check the actual connection before trusting the shield.')).toBeVisible();
    expect(action).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: 'Check now' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(view.queryByText('Check protection')).toBeNull();
});
test('offscreen companion cannot open help', () => {
    mockActive = false;
    const view = render(wrap(<MomentumCompanion pose="listen" visible={false} help={{ title: 'Listen', body: 'A quiet moment' }}/>));
    expect(view.queryByRole('button', { name: /FREED companion/ })).toBeNull();
    expect(view.queryByText('A quiet moment')).toBeNull();
});
test('unmigrated caller opens pose-specific help with a close control', () => {
    const view = render(wrap(<MomentumCompanion variant="calm"/>));
    fireEvent.press(view.getByRole('button', { name: /FREED companion/ }));
    expect(view.getByText(appI18n.t('companion.poses.breathe.helpTitle', { defaultValue: 'Follow a comfortable breath' }))).toBeVisible();
    fireEvent.press(view.getByRole('button', { name: appI18n.t('companion.closeHelp', { defaultValue: 'Close help' }) }));
    expect(view.queryByText('Follow a comfortable breath')).toBeNull();
});
test('a removed cue returns to the contextual pose and cannot replay after remount', () => {
    const cue = { id: 'ui-saved-one', pose: 'saved' as const, earned: true };
    const view = render(wrap(<MomentumCompanion pose="guide" cue={cue}/>));
    expect(view.getByTestId('companion-rig-saved')).toBeOnTheScreen();
    view.rerender(wrap(<MomentumCompanion pose="guide"/>));
    expect(view.getByTestId('companion-rig-guide')).toBeOnTheScreen();
    view.unmount();
    const remounted = render(wrap(<MomentumCompanion pose="guide" cue={cue}/>));
    expect(remounted.getByTestId('companion-rig-guide')).toBeOnTheScreen();
});
test('background transition dismisses contextual help', () => {
    const view = render(wrap(<MomentumCompanion pose="listen" help={{ title: 'Listen now', body: 'Pause here' }}/>));
    fireEvent.press(view.getByRole('button', { name: /FREED companion/ }));
    expect(view.getByText('Pause here')).toBeVisible();
    mockActive = false;
    view.rerender(wrap(<MomentumCompanion pose="listen" help={{ title: 'Listen now', body: 'Pause here' }}/>));
    expect(view.queryByText('Pause here')).toBeNull();
});

test('opening contextual help pauses the original rig and closing resumes eligible motion', () => {
    mockReduced = false;
    const view = render(wrap(<MomentumCompanion pose="guide"/>));
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.animated).toBe(true);
    fireEvent.press(view.getByRole('button', { name: /FREED companion/ }));
    expect(view.getByText(appI18n.t('companion.poses.guide.helpTitle'))).toBeVisible();
    expect(view.UNSAFE_getAllByType(KiteCompanionRig).every(rig => !rig.props.animated)).toBe(true);
    fireEvent.press(view.getByRole('button', { name: appI18n.t('companion.closeHelp') }));
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.animated).toBe(true);
});
test('direct companions gate motion and defer cues until their own viewport is visible', () => {
    mockReduced = false;
    mockViewportVisible = false;
    const cue = {id:'viewport-deferred-receipt', pose:'saved' as const};
    const view = render(wrap(<MomentumCompanion pose="guide" cue={cue}/>));
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.animated).toBe(false);
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.pose).toBe('guide');
    expect(view.queryByRole('button', {name:/FREED companion/})).toBeNull();
    mockViewportVisible = true;
    view.rerender(wrap(<MomentumCompanion pose="guide" cue={cue}/>));
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.animated).toBe(true);
    expect(view.getByTestId('companion-rig-saved')).toBeOnTheScreen();
});
test('explicit deletion resets process cue history so fresh local data can reuse a receipt id', () => {
    const cue = {id:'reset-local-receipt',pose:'saved' as const};
    const first = render(wrap(<MomentumCompanion pose="guide" cue={cue}/>));
    expect(first.getByTestId('companion-rig-saved')).toBeOnTheScreen();
    first.unmount();
    const repeated = render(wrap(<MomentumCompanion pose="guide" cue={cue}/>));
    expect(repeated.getByTestId('companion-rig-guide')).toBeOnTheScreen();
    repeated.unmount();
    clearCompanionPresentationHistory();
    const fresh = render(wrap(<MomentumCompanion pose="guide" cue={cue}/>));
    expect(fresh.getByTestId('companion-rig-saved')).toBeOnTheScreen();
});


test('finger feedback drives the full-body gesture before help and stops under the static preference', () => {
    mockReduced = false;
    const view = render(wrap(<MomentumCompanion pose="guide" context="finger-feedback"/>));
    const companion = () => view.getByRole('button', { name: /FREED companion/ });
    fireEvent(companion(), 'pressIn');
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.gesture.value).toBe(1);
    fireEvent(companion(), 'pressOut');
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.gesture.value).toBe(0);
    mockMotionOff = true;
    view.rerender(wrap(<MomentumCompanion pose="guide" context="finger-feedback"/>));
    fireEvent(companion(), 'pressIn');
    const rig = view.UNSAFE_getAllByType(KiteCompanionRig)[0];
    expect(rig.props.animated).toBe(false);
    expect(rig.props.gesture.value).toBe(0);
    fireEvent.press(companion());
    expect(view.getByText(appI18n.t('companion.poses.guide.helpTitle'))).toBeVisible();
});

test.each(['urgent-help', 'purchase', 'delete-data', 'reset'])('%s context keeps press feedback restrained', context => {
    mockReduced = false;
    const view = render(wrap(<MomentumCompanion pose="guide" context={context}/>));
    fireEvent(view.getByRole('button', { name: /FREED companion/ }), 'pressIn');
    expect(view.UNSAFE_getAllByType(KiteCompanionRig)[0].props.gesture.value).toBe(0);
});

test('live Reduce Motion pauses the rig and cancels gesture values', () => {
    mockReduced = false;
    const view = render(wrap(<MomentumCompanion pose="guide"/>));
    fireEvent(view.getByRole('button', { name: /FREED companion/ }), 'pressIn');
    mockReduced = true;
    view.rerender(wrap(<MomentumCompanion pose="guide"/>));
    const rig = view.UNSAFE_getAllByType(KiteCompanionRig)[0];
    expect(rig.props.animated).toBe(false);
    expect(rig.props.gesture.value).toBe(0);
});


test('full-body hop stays visible at small sizes and keeps the native SVG matrix boundary', () => {
    const value = (current: number) => ({ value: current } as any);
    const view = render(<KiteCompanionRig pose="welcome" width={56} height={56} animated drift={value(0)} gesture={value(1.5)} blink={value(0)} scene={false} />);
    const animatedMatrices = view.UNSAFE_getAllByType(G).map(group => group.props.animatedProps?.matrix).filter(Boolean);
    expect(animatedMatrices).toContainEqual([1, 0, 0, 1, 0, -28]);
    // A native matrix, rather than an SVG transform string, avoids the known
    // platform transform regression and clamps spring overshoot within the art.
    expect(animatedMatrices.length).toBeGreaterThan(0);
});

test('breathing body expansion follows the provided session phase', () => {
    const value = (current: number) => ({ value: current } as any);
    const view = render(<KiteCompanionRig pose="breathe" width={144} height={144} animated drift={value(0)} gesture={value(0)} blink={value(0)} phaseProgress={value(1)} scene={false} />);
    const matrices = view.UNSAFE_getAllByType(G).map(group => group.props.animatedProps?.matrix).filter(Boolean);
    expect(matrices.some(matrix => Math.abs(matrix[0] - 1.035) < .00001 && Math.abs(matrix[3] - 1.035) < .00001)).toBe(true);
});
