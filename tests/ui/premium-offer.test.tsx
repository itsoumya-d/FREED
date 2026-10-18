import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { I18nextProvider } from 'react-i18next';
import { PremiumOffer, type PremiumOfferProps } from '@/components/PremiumOffer';
import { appI18n } from '@/i18n/runtime';
import { presentPaywallPlan } from '@/lib/paywall-presenter';
import { getSubscriptionTermsDisclosure, normalizeStoreProductPrice } from '@/lib/store-pricing';
import { SUPPORTED_LANGUAGES } from '@/lib/app-preferences';
import { getAppPalette } from '@/design-system/app-palette';
import { ScrollView, StyleSheet } from 'react-native';
import { translateSource } from '@/i18n/runtime';

// Decorative artwork is outside checkout state; keep the store behavior under test.
jest.mock('@/components/MomentumCompanion', () => ({ MomentumCompanion: () => null }));
let mockMode: 'light' | 'dark' = 'light';
let mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ __esModule: true, default: () => mockDimensions }));
jest.mock('@/hooks/use-app-preferences', () => ({ useAppPreferences: () => ({ mode: mockMode }) }));
function props(status: 'loading' | 'ready' | 'error', withPrices = false): PremiumOfferProps {
  return {
    plans: (['monthly', 'yearly'] as const).map(id => ({ id, label: id === 'monthly' ? 'Monthly' : 'Yearly', presentation: presentPaywallPlan({ planId: id, productId: `test-${id}`, storePrices: withPrices ? [{ productId: `test-${id}`, displayPrice: id === 'monthly' ? '9,99 €' : '79,99 €', freeTrialDays: null }] : [], status, platform: 'ios', isDevelopment: false, verificationStatus: 'ready' }) })),
    selectedPlan: 'monthly', onSelectPlan: jest.fn(), onSubscribe: jest.fn(), onClose: jest.fn(), onRestore: jest.fn(), onManage: jest.fn(), canManage: false, onRetryPrices: jest.fn(), priceStatus: status, terms: getSubscriptionTermsDisclosure('ios'),
  };
}
async function offer(value: PremiumOfferProps) { return render(<I18nextProvider i18n={appI18n}><PremiumOffer {...value} /></I18nextProvider>); }
beforeEach(async () => {
  mockMode = 'light'; mockDimensions = { width: 390, height: 844, scale: 3, fontScale: 1 };
  await appI18n.changeLanguage('en');
});
afterEach(async () => { jest.restoreAllMocks(); await appI18n.changeLanguage('en'); });

test('billing choices precede compact honest benefits and optional details on a regular phone', async () => {
  const screen = await offer(props('ready', true));
  const orderedSections = screen.getByTestId('paywall-body').findAll(node => typeof node.type === 'string' &&
    ['paywall-plan-options', 'paywall-benefits', 'paywall-details'].includes(node.props.testID));
  expect(orderedSections.map(node => node.props.testID)).toEqual(['paywall-plan-options', 'paywall-benefits', 'paywall-details']);
  expect(StyleSheet.flatten(screen.getByTestId('paywall-plan-options').props.style).flexDirection).toBe('row');
  for (const id of ['monthly', 'yearly']) {
    const style = StyleSheet.flatten(screen.getByTestId(`paywall-plan-${id}`).props.style);
    expect(style.flex).toBe(1); expect(style.flexBasis).toBe(0);
  }
  expect(screen.getByText('Ad-free guided resets')).toBeOnTheScreen();
  expect(screen.getByText('Choose available activities')).toBeOnTheScreen();
  expect(screen.getByText('Create your own resets')).toBeOnTheScreen();
  expect(screen.queryByText(/forecasts|Support-circle reports|remote replies/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Premium details' })).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.queryByText('Build personal resets with your own steps, saved on this device.')).toBeNull();
});

test('Premium details expand and collapse without changing billing or starting checkout', async () => {
  const value = props('ready', true);
  const screen = await offer(value);
  const details = screen.getByRole('button', { name: 'Premium details' });
  await fireEvent.press(details);
  expect(details).toHaveProp('accessibilityState', { expanded: true });
  for (const text of [
    'Start a guided reset without a rewarded ad.',
    'Choose from activities available on this device. Requirements appear before you start.',
    'Build personal resets with your own steps, saved on this device.',
    'Premium does not bypass app limits or unlock adult websites.'
  ]) expect(screen.getByText(text)).toBeOnTheScreen();
  expect(screen.getByTestId('paywall-plan-monthly')).toBeChecked();
  expect(value.onSelectPlan).not.toHaveBeenCalled();
  expect(value.onSubscribe).not.toHaveBeenCalled();
  await fireEvent.press(details);
  expect(details).toHaveProp('accessibilityState', { expanded: false });
  expect(screen.queryByText('Build personal resets with your own steps, saved on this device.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: value.plans[0].presentation.primaryActionLabel }));
  expect(value.onSubscribe).toHaveBeenCalledTimes(1);
});

test.each([
  ['en', 'Ad-free guided resets', 'Premium details'],
  ['hi', 'बिना विज्ञापन के गाइडेड रीसेट', 'प्रीमियम की जानकारी'],
  ['es', 'Pausas guiadas sin anuncios', 'Detalles de Premium'],
  ['pt', 'Pausas guiadas sem anúncios', 'Detalhes do Premium'],
  ['fr', 'Pauses guidées sans publicité', 'Détails de Premium'],
  ['de', 'Geführte Auszeiten ohne Werbung', 'Premium-Details'],
  ['ar', 'استراحات موجّهة بلا إعلانات', 'تفاصيل بريميوم'],
  ['ja', '広告なしのガイド付きリセット', 'Premiumの詳細'],
  ['ko', '광고 없는 가이드 리셋', 'Premium 자세히 보기'],
  ['zh-Hans', '无广告引导重置', 'Premium 详情']
])('%s shows localized compact benefits and an operable details control', async (language, adFree, detailsLabel) => {
  await appI18n.changeLanguage(language);
  const value = props('ready', true);
  const screen = await offer(value);
  expect(screen.getByText(adFree)).toBeOnTheScreen();
  const details = screen.getByRole('button', { name: detailsLabel });
  expect(details).toHaveProp('accessibilityState', { expanded: false });
  await fireEvent.press(details);
  expect(details).toHaveProp('accessibilityState', { expanded: true });
  expect(screen.getByTestId('paywall-price-yearly')).toHaveTextContent('79,99 €');
  expect(value.onSubscribe).not.toHaveBeenCalled();
});

test.each(['loading', 'error'] as const)('%s prices prevent checkout and keep free continuation reachable', async status => {
  const value = props(status);
  const screen = await offer(value);
  const action = screen.getByRole('button', { name: status === 'loading' ? 'Loading store prices…' : 'Store price unavailable' });
  expect(action).toBeDisabled();
  await fireEvent.press(action);
  expect(value.onSubscribe).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with Free' }));
  expect(value.onClose).toHaveBeenCalledTimes(1);
  if (status === 'loading') expect(screen.queryByRole('button', { name: 'Retry store prices' })).toBeNull();
});

test('price retry requests one reload without checkout or a fabricated price', async () => {
  const value = props('error');
  const screen = await offer(value);
  await fireEvent.press(screen.getByRole('button', { name: 'Retry store prices' }));
  expect(value.onRetryPrices).toHaveBeenCalledTimes(1);
  expect(value.onSubscribe).not.toHaveBeenCalled();
  expect(screen.getAllByText('Price unavailable')).toHaveLength(2);
  expect(screen.queryByText(/₹|\$|€/)).toBeNull();
});

test('ready store-localized prices retain their supplied currency and route explicit selection', async () => {
  const value = props('ready', true);
  const screen = await offer(value);
  expect(screen.getByText('9,99 €')).toBeOnTheScreen();
  expect(screen.getByText('79,99 €')).toBeOnTheScreen();
  expect(screen.getByTestId('paywall-plan-monthly')).toBeChecked();
  await fireEvent.press(screen.getByTestId('paywall-plan-yearly'));
  expect(value.onSelectPlan).toHaveBeenCalledWith('yearly');
  await fireEvent.press(screen.getByRole('button', { name: value.plans[0].presentation.primaryActionLabel }));
  expect(value.onSubscribe).toHaveBeenCalledTimes(1);
});

test('busy checkout disables repeated purchase and keeps free exit reachable', async () => {
  const value = { ...props('ready', true), busy: true };
  const screen = await offer(value);
  const action = screen.getByRole('button', { name: 'Confirming purchase' });
  expect(action).toBeDisabled();
  expect(action).toHaveProp('accessibilityState', expect.objectContaining({ busy: true }));
  await fireEvent.press(action);
  await fireEvent.press(screen.getByTestId('paywall-plan-yearly'));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with Free' }));
  expect(value.onSubscribe).not.toHaveBeenCalled();
  expect(value.onSelectPlan).not.toHaveBeenCalled();
  expect(value.onClose).toHaveBeenCalledTimes(1);
});

test('selecting a plan with missing metadata blocks checkout until a successful store-price retry', async () => {
  const subscribe = jest.fn(); const retry = jest.fn(); const close = jest.fn();
  const monthly = normalizeStoreProductPrice({ id: 'freed_premium_monthly', platform: 'ios', displayPrice: '9,99\u00a0€', price: 9.99 })!;
  const yearly = normalizeStoreProductPrice({ id: 'freed_premium_yearly', platform: 'ios', displayPrice: '39,99\u00a0€', price: 39.99 })!;
  function StatefulOffer({ prices }: { prices: typeof monthly[] }) {
    const [selected, setSelected] = React.useState<'monthly' | 'yearly'>('monthly');
    const value = props('ready');
    return <I18nextProvider i18n={appI18n}><PremiumOffer {...value}
      selectedPlan={selected} onSelectPlan={setSelected} onSubscribe={() => subscribe(selected)} onRetryPrices={retry} onClose={close}
      plans={(['monthly', 'yearly'] as const).map(id => ({ id, label: id === 'monthly' ? 'Monthly' : 'Yearly',
        presentation: presentPaywallPlan({ planId: id, productId: `freed_premium_${id}`, storePrices: prices, status: 'ready', platform: 'ios', isDevelopment: false, verificationStatus: 'ready' }) }))}
    /></I18nextProvider>;
  }
  const screen = render(<StatefulOffer prices={[monthly]} />);
  await fireEvent.press(screen.getByTestId('paywall-plan-yearly'));
  expect(screen.getByTestId('paywall-plan-yearly')).toBeChecked();
  expect(screen.getByRole('button', { name: 'Store price unavailable' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry store prices' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(subscribe).not.toHaveBeenCalled();
  screen.rerender(<StatefulOffer prices={[monthly, yearly]} />);
  expect(screen.getByTestId('paywall-plan-yearly')).toBeChecked();
  expect(screen.getByTestId('paywall-price-yearly')).toHaveTextContent(yearly.displayPrice);
  await fireEvent.press(screen.getByRole('button', { name: `Subscribe · ${yearly.displayPrice} per year` }));
  expect(subscribe).toHaveBeenCalledWith('yearly');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue with Free' }));
  expect(close).toHaveBeenCalledTimes(1);
});

const viewports = [
  { width: 320, height: 568, fontScale: 1 },
  { width: 390, height: 844, fontScale: 1 },
  { width: 430, height: 932, fontScale: 1.8 },
  { width: 768, height: 1024, fontScale: 1 }
];
test.each(SUPPORTED_LANGUAGES.flatMap(language => (['light', 'dark'] as const).map(mode => [language, mode] as const)))('%s %s keeps store prices, localized actions and free exit usable across responsive states', async (language, mode) => {
  mockMode = mode;
  await appI18n.changeLanguage(language);
  const rawMonthly = '  9,99\u00a0€  '; const rawYearly = '  39,99\u00a0€  ';
  for (const viewport of viewports) {
    mockDimensions = { ...viewport, scale: 3 };
    for (const status of ['loading', 'ready', 'error'] as const) {
      const value = props(status);
      value.plans = (['monthly', 'yearly'] as const).map(id => ({ id, label: id === 'monthly' ? 'Monthly' : 'Yearly',
        presentation: presentPaywallPlan({ planId: id, productId: `freed_premium_${id}`, storePrices: status === 'ready'
          ? [{ productId: `freed_premium_${id}`, displayPrice: id === 'monthly' ? rawMonthly : rawYearly, freeTrialDays: null }] : [],
          status, platform: 'ios', isDevelopment: false, verificationStatus: 'ready' }) }));
      const screen = await offer(value);
      expect(screen.getByText(translateSource(value.terms, language))).toBeOnTheScreen();
      if (language !== 'en') expect(translateSource(value.terms, language)).not.toBe(value.terms);
      expect(StyleSheet.flatten(screen.getByTestId('premium-offer').props.style).backgroundColor).toBe(getAppPalette(mode).bg);
      expect(StyleSheet.flatten(screen.getByTestId('premium-offer').props.style).direction).toBe(language === 'ar' ? 'rtl' : 'ltr');
      const freeExit = screen.getByRole('button', { name: translateSource('Continue with Free', language) });
      expect(freeExit).not.toBeDisabled();
      await fireEvent.press(freeExit);
      expect(value.onClose).toHaveBeenCalledTimes(1);
      if (status === 'ready') {
        expect(screen.getByTestId('paywall-price-monthly').props.children).toBe(rawMonthly);
        expect(screen.getByTestId('paywall-price-yearly').props.children).toBe(rawYearly);
        const expected = appI18n.t('source.Subscribe · {{price}} {{cadence}}', { price: rawMonthly, cadence: translateSource('per month', language) });
        const subscribe = screen.getByRole('button', { name: expected });
        expect(subscribe).not.toBeDisabled();
        await fireEvent.press(subscribe);
        expect(value.onSubscribe).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('paywall-plan-yearly').props.accessibilityLabel).toBe(`${translateSource('Yearly', language)}, ${rawYearly} ${translateSource('per year', language)}`);
        if (viewport.width < 480 || viewport.fontScale > 1.15) {
          expect(StyleSheet.flatten(screen.getByTestId('paywall-price-block-yearly').props.style).maxWidth).toBe('100%');
        }
      } else {
        const name = translateSource(status === 'loading' ? 'Loading store prices…' : 'Store price unavailable', language);
        const subscribe = screen.getByRole('button', { name });
        expect(subscribe).toBeDisabled();
        await fireEvent.press(subscribe);
        expect(value.onSubscribe).not.toHaveBeenCalled();
        expect(screen.queryByText(rawMonthly)).toBeNull();
      }
      expect(screen.UNSAFE_getByType(ScrollView).findAll(node => node === freeExit).length).toBe(0);
      screen.unmount();
    }
  }
});
