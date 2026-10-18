const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { inspectPremiumOfferAccessibilitySource } = require('../scripts/accessibility-safety-audit');
const source = readFileSync('src/components/PremiumOffer.tsx', 'utf8');
test('paywall reader audit follows translated plan, raw actual price, cadence, selection and guarded checkout', () => {
  assert.equal(inspectPremiumOfferAccessibilitySource(source), true);
});
test('paywall reader audit rejects fabricated or translated store prices and disconnected plan metadata', () => {
  const changes = [
    ["from '@/i18n/runtime'", "from './fake-runtime'"],
    ['translateSource(plan.label)', '"Every plan"'],
    ['presentation.pricing ? presentation.headline : translateSource(presentation.headline)', 'presentation.pricing ? "$0.00" : translateSource(presentation.headline)'],
    ['presentation.pricing ? presentation.headline : translateSource(presentation.headline)', 'presentation.pricing ? translateSource(presentation.headline) : translateSource(presentation.headline)'],
    ['presentation.pricing ? presentation.headline : translateSource(presentation.headline)', 'presentation.pricing ? presentation.headline.trim() : translateSource(presentation.headline)'],
    ['const presentation = plan.presentation;', 'const presentation = fakePresentation;'],
    ['translateSource(presentation.cadence)', '""'],
    ['accessibilityHint={presentation.detail ?? undefined}', 'accessibilityHint={undefined}'],
    ['accessibilityState={{ checked: selected, selected, disabled: busy }}', 'accessibilityState={{ checked: false, selected, disabled: busy }}'],
    ['accessibilityState={{ checked: selected, selected, disabled: busy }}', 'accessibilityState={{ checked: selected, selected: false, disabled: busy }}'],
    ['accessibilityState={{ checked: selected, selected, disabled: busy }}', 'accessibilityState={{ checked: selected, selected, disabled: false }}'],
    ['onPress={() => onSelectPlan(plan.id)}', 'onPress={() => undefined}'],
    ['translate={!presentation.pricing}', 'translate={true}'],
  ];
  for (const [before, after] of changes) {
    assert.ok(source.includes(before), before);
    assert.equal(inspectPremiumOfferAccessibilitySource(source.replace(before, after)), false, before);
  }
});
test('paywall reader audit preserves billed amount, period, disclosure and readiness/busy guard', () => {
  const changes = [
    ['price: selectedPresentation.pricing.headline', 'price: "$0.00"'],
    ['cadence: translateSource(selectedPresentation.pricing.cadence)', 'cadence: ""'],
    ['priceStatus === "ready" && selectedPresentation?.canPurchase === true', 'true'],
    ['{terms}</Text>', '{"Terms omitted"}</Text>'],
    ['{footer}', '{false ? footer : null}'],
    ['</ScrollView>\n      {footer}', '{footer}</ScrollView>'],
    ['!largeText ? renewalTerms : null', 'false ? renewalTerms : null'],
    ['largeText ? renewalTerms : null', 'false ? renewalTerms : null'],
    ['accessibilityState={{ disabled: busy || !canSubscribe, busy }}', 'accessibilityState={{ disabled: false, busy }}'],
    ['disabled={busy || !canSubscribe}', 'disabled={false}'],
    ['onPress={() => { if (!busy && canSubscribe) onSubscribe(); }}', 'onPress={() => onSubscribe()}'],
  ];
  for (const [before, after] of changes) {
    assert.ok(source.includes(before), before);
    assert.equal(inspectPremiumOfferAccessibilitySource(source.replace(before, after)), false, before);
  }
});
