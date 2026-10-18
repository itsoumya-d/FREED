import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as Native from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { appI18n } from '@/i18n/runtime';
import { RecoveryHistory } from '@/components/RecoveryHistory';
import { PremiumOffer, type PremiumOfferProps } from '@/components/PremiumOffer';
import { CoachConversationLayout } from '@/components/CoachConversationLayout';
import { createDefaultRecoveryState, recordDailyCheckIn } from '@/lib/recovery-state';
import { presentPaywallPlan } from '@/lib/paywall-presenter';
import { getSubscriptionTermsDisclosure } from '@/lib/store-pricing';

jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
jest.mock('@/components/DirectionalIcons', () => ({ ChevronLeft: () => null, ChevronRight: () => null, ArrowLeft: () => null }));
jest.mock('lucide-react-native', () => ({ Check: () => null, Calendar: () => null, X: () => null, ChevronDown: () => null, Settings: () => null }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: 'light' }) }));
jest.mock('@/design-system/motion', () => ({ useMotionSettings: () => ({ active: true }) }));
let mockDimensions = { width: 375, height: 667, scale: 2, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 7, 12) });
  mockDimensions = { width: 375, height: 667, scale: 2, fontScale: 1 };
  await appI18n.changeLanguage('en');
});
afterEach(async () => { jest.useRealTimers(); jest.restoreAllMocks(); await appI18n.changeLanguage('en'); });

function offerProps(): PremiumOfferProps {
  return {
    plans: (['yearly', 'monthly'] as const).map(id => ({ id, label: id === 'yearly' ? 'Yearly' : 'Monthly',
      presentation: presentPaywallPlan({ planId: id, productId: `test-${id}`, storePrices: [
        { productId: `test-${id}`, displayPrice: id === 'yearly' ? '79,99 €' : '9,99 €', freeTrialDays: null }
      ], status: 'ready', platform: 'ios', isDevelopment: false, verificationStatus: 'ready' }) })),
    selectedPlan: 'yearly', onSelectPlan: jest.fn(), onSubscribe: jest.fn(), onClose: jest.fn(), onRestore: jest.fn(),
    onManage: jest.fn(), canManage: true, onRetryPrices: jest.fn(), priceStatus: 'ready', terms: getSubscriptionTermsDisclosure('ios')
  };
}
test.each([1, 1.8])('short paywall keeps real plans side by side and both actions outside scrolling at font scale %s', fontScale => {
  mockDimensions.fontScale = fontScale;
  const props = offerProps();
  const view = render(<I18nextProvider i18n={appI18n}><PremiumOffer {...props} /></I18nextProvider>);
  const scroll = view.UNSAFE_getByType(Native.ScrollView);
  const free = view.getByRole('button', { name: 'Continue with Free' });
  const subscribe = view.getByTestId('paywall-subscribe');
  expect(scroll.findAll(node => node === free || node === subscribe)).toHaveLength(0);
  const plans = view.getByTestId('paywall-plan-options');
  expect(Native.StyleSheet.flatten(plans.props.style).flexDirection).toBe('row');
  for (const id of ['yearly', 'monthly']) {
    const style = Native.StyleSheet.flatten(view.getByTestId(`paywall-plan-${id}`).props.style);
    expect(style.flex).toBe(1); expect(style.flexBasis).toBe(0);
  }
  expect(view.getByTestId('paywall-price-yearly').props.children).toBe('79,99 €');
  fireEvent.press(subscribe); expect(props.onSubscribe).toHaveBeenCalledTimes(1);
  fireEvent.press(free); expect(props.onClose).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByRole('button', { name: 'Restore purchases' })); expect(props.onRestore).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByRole('button', { name: 'Manage subscription' })); expect(props.onManage).toHaveBeenCalledTimes(1);
});
test('compact paywall keeps supported benefits concise with optional details and complete renewal terms', () => {
  const view = render(<PremiumOffer {...offerProps()} />);
  const disclosure = view.getByRole('button', { name: 'Premium details' });
  expect(disclosure.props.accessibilityState.expanded).toBe(false);
  expect(view.getByText(getSubscriptionTermsDisclosure('ios'))).toBeOnTheScreen();
  for (const text of ['Ad-free guided resets', 'Choose available activities', 'Create your own resets']) expect(view.getByText(text)).toBeOnTheScreen();
  fireEvent.press(disclosure);
  for (const text of ['Start a guided reset without a rewarded ad.', 'Choose from activities available on this device. Requirements appear before you start.',
    'Build personal resets with your own steps, saved on this device.', 'Premium does not bypass app limits or unlock adult websites.']) expect(view.getByText(text)).toBeOnTheScreen();
  const free = view.getByRole('button', { name: 'Continue with Free' });
  expect(view.UNSAFE_getByType(Native.ScrollView).findAll(node => node === free)).toHaveLength(0);
});
test('maximum Dynamic Type keeps only concise Subscribe and Free in the footer while full billing, help and legal text remain reachable in the body', () => {
  mockDimensions.fontScale = 3.2;
  const props = { ...offerProps(), onHelp: jest.fn() };
  const view = render(<PremiumOffer {...props} />);
  const footer = view.getByTestId('paywall-footer'), body = view.getByTestId('paywall-body');
  const subscribe = view.getByTestId('paywall-subscribe');
  expect(subscribe.props.accessibilityLabel).toBe('Subscribe · 79,99 € per year');
  expect(subscribe.findAll(node => node.type === Native.Text && node.props.children === 'Subscribe')).toHaveLength(1);
  const help = view.getByRole('button', { name: appI18n.t('publicHelp.entry') });
  const privacy = view.getByRole('link', { name: 'Privacy' }), terms = view.getByRole('link', { name: 'Terms' });
  for (const action of [help, privacy, terms]) {
    expect(footer.findAll(node => node === action)).toHaveLength(0);
    expect(body.findAll(node => node === action)).toHaveLength(1);
  }
  expect(view.getByText(getSubscriptionTermsDisclosure('ios'))).toBeOnTheScreen();
  expect(view.getByTestId('paywall-price-yearly').props.children).toBe('79,99 €');
  expect(Native.StyleSheet.flatten(view.getByTestId('paywall-plan-options').props.style).flexDirection).toBe('column');
  expect(Native.StyleSheet.flatten(view.getByTestId('paywall-plan-yearly').props.style).flexBasis).toBe('auto');
  expect(view.getByTestId('paywall-price-yearly').props.numberOfLines).toBeUndefined();
  expect(view.getByTestId('paywall-price-yearly').props.maxFontSizeMultiplier).toBeUndefined();
  expect(body.findAll(node => node === subscribe || node === view.getByRole('button', { name: 'Continue with Free' }))).toHaveLength(0);
  fireEvent.press(help); expect(props.onHelp).toHaveBeenCalledTimes(1);
});
test('horizontal week paging leaves the selected day independent and past records read-only', () => {
  const state = recordDailyCheckIn(createDefaultRecoveryState(), { mood: 'steady', urgeLevel: 2, reflection: 'My exact earlier words' }, new Date(2026, 8, 29, 12).toISOString());
  const before = structuredClone(state), checkIn = jest.fn();
  const view = render(<RecoveryHistory state={state} onCheckIn={checkIn} />);
  const pager = view.getByTestId('history-week-pager');
  fireEvent(pager, 'layout', { nativeEvent: { layout: { width: 327, height: 96, x: 0, y: 0 } } });
  fireEvent(pager, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0, y: 0 }, layoutMeasurement: { width: 327, height: 96 } } });
  expect(view.getByTestId('calendar-return-today')).toBeOnTheScreen();
  expect(view.getByText(new Date(2026, 9, 7, 12).toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }))).toBeOnTheScreen();
  fireEvent.press(view.getByTestId('history-day-2026-09-29'));
  expect(view.getByTestId('history-journal-note')).toHaveTextContent('My exact earlier words');
  expect(pager.findAllByProps({ testID: 'history-journal-note' })).toHaveLength(0);
  expect(view.getByText('Past days are read-only.')).toBeOnTheScreen();
  expect(view.queryByRole('button', { name: "Start today's check-in" })).toBeNull();
  expect(checkIn).not.toHaveBeenCalled(); expect(state).toEqual(before);
  act(() => { jest.setSystemTime(new Date(2026, 9, 8, 12)); jest.advanceTimersByTime(1000); });
  expect(view.getByTestId('history-journal-note')).toHaveTextContent('My exact earlier words');
  fireEvent.press(view.getByTestId('calendar-return-today'));
  expect(view.getByTestId('history-day-2026-10-08').props.accessibilityState.selected).toBe(true);
  expect(view.getByTestId('calendar-next-week')).toBeDisabled();
});
test('RTL reverses physical week order without reversing calendar time', async () => {
  await appI18n.changeLanguage('ar');
  const view = render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={jest.fn()} />);
  const pager = view.getByTestId('history-week-pager');
  fireEvent(pager, 'layout', { nativeEvent: { layout: { width: 327, height: 96, x: 0, y: 0 } } });
  expect(pager.props.contentOffset.x).toBe(0);
  fireEvent(pager, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 327, y: 0 }, layoutMeasurement: { width: 327, height: 96 } } });
  expect(view.getByTestId('calendar-return-today')).toBeOnTheScreen();
  fireEvent.press(view.getByTestId('calendar-next-week'));
  expect(view.getByTestId('calendar-next-week')).toBeDisabled();
});
test('a backwards calendar clock cannot leave all current-week pages hidden behind a future anchor', () => {
  const view = render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={jest.fn()} />);
  fireEvent.press(view.getByTestId('history-day-2026-10-06'));
  act(() => { jest.setSystemTime(new Date(2026, 8, 28, 12)); jest.advanceTimersByTime(1000); });
  expect(view.getByTestId('history-day-2026-09-28').props.accessibilityState.selected).toBe(true);
  expect(view.getByTestId('calendar-next-week')).toBeDisabled();
});
test('large text gives a week two rows without shrinking date hit targets or moving records into the pager', () => {
  mockDimensions.fontScale = 1.8;
  const view = render(<RecoveryHistory state={createDefaultRecoveryState()} onCheckIn={jest.fn()} />);
  const pager = view.getByTestId('history-week-pager');
  fireEvent(pager, 'layout', { nativeEvent: { layout: { width: 327, height: 180, x: 0, y: 0 } } });
  const width = Native.StyleSheet.flatten(view.getByTestId('history-day-2026-10-07').props.style).width;
  expect(width).toBeGreaterThanOrEqual(44); expect(width * 4 + 12).toBeCloseTo(327);
  expect(pager.props.directionalLockEnabled).toBe(true); expect(pager.props.nestedScrollEnabled).toBe(true);
});
test('CLARA uses one keyboard inset strategy while its composer and send remain outside the transcript', () => {
  const view = render(<CoachConversationLayout composer={<Native.Pressable testID="send"><Native.Text>Send</Native.Text></Native.Pressable>}><Native.Text>Transcript</Native.Text></CoachConversationLayout>);
  const transcript = view.getByTestId('coach-transcript');
  expect(transcript.props.contentInsetAdjustmentBehavior).toBe('never');
  expect(transcript.props.automaticallyAdjustKeyboardInsets).toBe(false);
  expect(transcript.props.automaticallyAdjustContentInsets).toBe(false);
  expect(transcript.findAllByProps({ testID: 'send' })).toHaveLength(0);
  expect(Native.StyleSheet.flatten(view.getByTestId('coach-composer').props.style).flexShrink).toBe(0);
});
