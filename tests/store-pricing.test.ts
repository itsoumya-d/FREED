import assert from 'node:assert/strict';
import { normalizeStoreProductPrice } from '../src/lib/store-pricing';

// Current OpenIAP Android metadata can carry only standardized offer phases.
// The product-level display price can describe an introductory offer; use the
// undiscounted base-plan phase that checkout selects instead.
const currentAndroidProduct = {
  id: 'freed_premium_yearly', platform: 'android', displayPrice: '₹0.00', price: 0,
  subscriptionOffers: [
    { id: 'trial', paymentMode: 'free-trial', displayPrice: '₹0.00', offerTokenAndroid: 'fixture-trial',
      pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: '₹0.00', priceAmountMicros: '0', billingPeriod: 'P7D' }] } },
    { id: '', basePlanIdAndroid: 'yearly', displayPrice: '₹3,999.00', offerTokenAndroid: 'fixture-base',
      pricingPhasesAndroid: { pricingPhaseList: [{ formattedPrice: '₹3,999.00', priceAmountMicros: '3999000000', billingPeriod: 'P1Y' }] } }
  ]
};
assert.equal(normalizeStoreProductPrice(currentAndroidProduct)?.displayPrice, '₹3,999.00');
assert.equal(normalizeStoreProductPrice({ id: 'freed_premium_yearly', platform: 'ios', displayPrice: '  39,99\u00a0€  ', price: 39.99 })?.displayPrice, '  39,99\u00a0€  ', 'store spacing is opaque display data');
for (const displayPrice of ['Price unavailable', 'Free', 'NaN', '<b>$39.99</b>', 'https://example.test/39.99']) {
  assert.equal(normalizeStoreProductPrice({ id: 'freed_premium_yearly', displayPrice }), null, `${displayPrice} is not a checkout price`);
}
assert.equal(normalizeStoreProductPrice({ id: 'freed_premium_yearly', platform: 'ios', displayPrice: '$0.00', price: 0 }), null, 'launch subscriptions must have a positive base price');
assert.equal(normalizeStoreProductPrice({ id: 'freed_premium_monthly', displayPrice: '٩٩٫٩٩\u00a0ر.س.‏', price: 99.99 })?.displayPrice, '٩٩٫٩٩\u00a0ر.س.‏');
console.log('Store pricing metadata normalization passed.');
assert.equal(normalizeStoreProductPrice({ id: 'freed_premium_yearly', subscriptionOfferDetailsAndroid: [
  { offerToken: 'unlabelled-intro-token', pricingPhases: { pricingPhaseList: [
    { formattedPrice: '$0.00', priceAmountMicros: '0', billingPeriod: 'P7D' },
    { formattedPrice: '$39.99', priceAmountMicros: '39990000', billingPeriod: 'P1Y' }
  ] } }
] }), null, 'A purported base offer with multiple introductory phases cannot represent the no-intro launch bill.');
