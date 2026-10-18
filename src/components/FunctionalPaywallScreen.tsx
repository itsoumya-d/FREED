import React from 'react';
import { Linking, Platform } from 'react-native';
import { PremiumOffer } from './PremiumOffer';
import { useMotionSettings } from '@/design-system/motion';
import { createAccountOperationGate } from '@/lib/account-operation';
import { getFirebaseAccountScope, getFirebaseAccountSummary, getFirebaseCallableContracts } from '@/lib/firebase-native';
import { fetchLaunchStorePrices, getLaunchPremiumPlans, type LaunchPremiumPlanId, type MonetizationPlatform } from '@/lib/monetization';
import { getSubscriptionManagementUrl, presentPaywallPlan, type PaywallPriceStatus, type PurchaseVerificationStatus } from '@/lib/paywall-presenter';
import { getSubscriptionTermsDisclosure, type StoreProductPrice } from '@/lib/store-pricing';

/** Store metadata and owner-scoped server readiness are independent requirements. */
export function FunctionalPaywallScreen({ onSubscribe, onClose, onRestore, busy, notice, onHelp }: { onSubscribe: (id: LaunchPremiumPlanId) => void; onClose: () => void; onRestore: () => void; busy?: boolean; notice?: string | null; onHelp?: () => void }) {
  const platform = (['ios','android','web'].includes(Platform.OS) ? Platform.OS : 'unknown') as MonetizationPlatform;
  const [plan,setPlan] = React.useState<LaunchPremiumPlanId>('yearly'), [prices,setPrices] = React.useState<StoreProductPrice[]>([]);
  const [priceStatus,setPriceStatus] = React.useState<PaywallPriceStatus>('loading'), [priceError,setPriceError] = React.useState<string | null>(null);
  const [verification,setVerification] = React.useState<PurchaseVerificationStatus>('loading'), [owner,setOwner] = React.useState<string | null>(null);
  const [retry,setRetry] = React.useState(0), [managementMessage,setManagementMessage] = React.useState<string | null>(null);
  const gate = React.useRef(createAccountOperationGate(getFirebaseAccountScope)); const active = useMotionSettings().active;
  const liveOwner = getFirebaseAccountScope(); const account = getFirebaseAccountSummary(); const realOwner = Boolean(liveOwner && account.signedIn && !account.anonymous); const native = platform === 'ios' || platform === 'android';
  React.useEffect(() => {
    let current = true; setPriceStatus('loading'); setPriceError(null);
    void fetchLaunchStorePrices({ platform }).then(products => { if (current) { setPrices(products); setPriceStatus(products.length ? 'ready' : 'empty'); if (!products.length) setPriceError('No store prices were returned. Check the signed app, store account and product availability, then retry.'); } }).catch(() => { if (current) { setPrices([]); setPriceStatus('error'); setPriceError('Store prices could not load. Check your connection and retry.'); } });
    return () => { current = false; };
  }, [platform,retry]);
  React.useEffect(() => {
    if (!active || !native || !realOwner) { setVerification('unavailable'); setOwner(null); return; }
    const operation = gate.current.begin(); let current = true; setVerification('loading'); setOwner(null);
    void (async () => {
      const contracts = await getFirebaseCallableContracts({ ensureGuest: false });
      operation.assertCurrent(); if (!getFirebaseAccountSummary().signedIn || getFirebaseAccountSummary().anonymous || getFirebaseAccountScope() !== liveOwner) throw new Error('Connect an account before checkout');
      if (!contracts) throw new Error('Secure checkout unavailable');
      await contracts.getCheckoutContext({platform:platform as 'ios'|'android'}); operation.assertCurrent();
      if (current) { setOwner(getFirebaseAccountScope()); setVerification('ready'); }
    })().catch(() => { if (current && operation.isCurrent()) setVerification('unavailable'); });
    return () => { current = false; operation.cancel(); };
  }, [active,native,liveOwner,realOwner,retry]);
  const plans = getLaunchPremiumPlans({ platform }).map(item => ({ ...item, id: item.id === 'monthly' ? 'monthly' as const : 'yearly' as const, presentation: presentPaywallPlan({ planId: item.id === 'monthly' ? 'monthly' : 'yearly', productId: item.productId, storePrices: prices, status: priceStatus, platform, isDevelopment: false, verificationStatus: owner && owner === getFirebaseAccountScope() ? verification : verification === 'loading' ? 'loading' : 'unavailable' }) }));
  const selected = plans.find(item => item.id === plan)?.presentation, management = getSubscriptionManagementUrl(platform);
  return <PremiumOffer onHelp={onHelp} plans={plans} selectedPlan={plan} onSelectPlan={setPlan} onSubscribe={() => { if (!busy && selected?.canPurchase && owner !== null && owner === getFirebaseAccountScope() && getFirebaseAccountSummary().signedIn && !getFirebaseAccountSummary().anonymous) onSubscribe(plan); }} onClose={onClose} onRestore={() => { if (getFirebaseAccountScope() && getFirebaseAccountSummary().signedIn && !getFirebaseAccountSummary().anonymous) onRestore(); }} onManage={() => { if (management) void Linking.openURL(management).catch(() => setManagementMessage("Subscription settings could not open. Manage your membership in your device's store account.")); }} canManage={Boolean(management)} onRetryPrices={() => setRetry(value => value + 1)} priceStatus={priceStatus} priceError={priceError ?? (native && verification === 'unavailable' ? 'Secure checkout is unavailable. Free recovery tools remain available. Try again later.' : null)} busy={busy} notice={notice} managementMessage={managementMessage} previewMessage={!native ? 'Subscriptions are available in the Android or iPhone app.' : null} terms={native ? getSubscriptionTermsDisclosure(platform as 'ios'|'android') : 'Subscribe in the iOS or Android app. The store shows the final price before purchase.'} />;
}
