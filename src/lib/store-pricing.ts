// Paywall pricing and subscription-disclosure model.
//
// App Store 3.1.2(a) and Google Play's subscription policy require the billed
// amount to be the most prominent price, free-trial terms to state what is
// charged afterwards, and the auto-renewal / cancellation terms to be shown
// next to the purchase button. This module keeps that copy in one pure,
// testable place so PaywallScreen only renders it.

import { LAUNCH_PREMIUM_PLAN_ECONOMICS, PREMIUM_PLANS, type PremiumPlanId } from "@/lib/monetization";

export type PaywallPlanId = Extract<PremiumPlanId, "yearly" | "monthly" | "lifetime">;

export type StoreProductPrice = {
  productId: string;
  /** Localized, store-formatted price for the regular billing period. */
  displayPrice: string;
  /** Length of a free introductory offer, when the store reports one. */
  freeTrialDays: number | null;
};

export type PaywallPlanPricing = {
  planId: PaywallPlanId;
  /** Most prominent price: always the amount actually billed. */
  headline: string;
  /** "per year", "per month" or "one-time". */
  cadence: string;
  /** Secondary, smaller detail (never more prominent than the headline). */
  detail: string | null;
  /** Present only when the store product carries a free-trial offer. */
  trialLine: string | null;
  hasFreeTrial: boolean;
  /** True when the price came from the App Store / Google Play, not the static fallback. */
  storeLocalized: boolean;
};

const FALLBACK_USD: Record<PaywallPlanId, string> = {
  yearly: formatUsd(LAUNCH_PREMIUM_PLAN_ECONOMICS.plans.find((plan) => plan.planId === "yearly")?.grossUsd ?? 39.99),
  monthly: formatUsd(LAUNCH_PREMIUM_PLAN_ECONOMICS.plans.find((plan) => plan.planId === "monthly")?.grossUsd ?? 9.99),
  lifetime: PREMIUM_PLANS.find((plan) => plan.id === "lifetime")?.price ?? "$79.99"
};

const YEARLY_MONTHLY_EQUIVALENT_USD =
  LAUNCH_PREMIUM_PLAN_ECONOMICS.plans.find((plan) => plan.planId === "yearly")?.monthlyEquivalentGrossUsd ?? null;

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Paid subscription amounts contain a nonzero decimal digit in any store locale. */
export function isStoreFormattedPrice(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 64
    || /[<>\u0000-\u001f\u007f−-]|https?:/i.test(value)) return false;
  return [...value.matchAll(/\p{Nd}/gu)].some(([digit]) => {
    const code = digit.codePointAt(0)!;
    let zero = code;
    // Unicode decimal digits form consecutive groups of ten, including the
    // adjacent mathematical styles. Preserve the original glyphs and spacing.
    while (zero > 0 && /\p{Nd}/u.test(String.fromCodePoint(zero - 1))) zero--;
    return (code - zero) % 10 !== 0;
  });
}

function cleanPrice(value: unknown): string | null {
  return isStoreFormattedPrice(value) ? value : null;
}

function periodUnitToDays(unit: unknown, value: unknown): number | null {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count <= 0) return null;
  switch (unit) {
    case "day":
      return count;
    case "week":
      return count * 7;
    case "month":
      return count * 30;
    case "year":
      return count * 365;
    default:
      return null;
  }
}

/** ISO-8601 billing periods used by Google Play ("P3D", "P1W", "P1M", "P1Y"). */
export function isoPeriodToDays(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(value.trim());
  if (!match) return null;
  const [, years, months, weeks, days] = match;
  const total =
    Number(years ?? 0) * 365 + Number(months ?? 0) * 30 + Number(weeks ?? 0) * 7 + Number(days ?? 0);
  return total > 0 ? total : null;
}

function boundedTrialDays(days: number | null): number | null {
  if (days === null || !Number.isFinite(days)) return null;
  const rounded = Math.round(days);
  return rounded >= 1 && rounded <= 366 ? rounded : null;
}

function freeTrialDaysFromStandardOffers(offers: unknown): number | null {
  if (!Array.isArray(offers)) return null;
  for (const offer of offers) {
    if (!isRecord(offer) || offer.paymentMode !== "free-trial") continue;
    const period = isRecord(offer.period) ? offer.period : null;
    const perPeriod = period ? periodUnitToDays(period.unit, period.value) : null;
    const periodCount = typeof offer.periodCount === "number" && offer.periodCount > 0 ? offer.periodCount : 1;
    const days = perPeriod !== null ? perPeriod * periodCount : null;
    if (days !== null) return boundedTrialDays(days);
    const android = isRecord(offer.pricingPhasesAndroid) ? offer.pricingPhasesAndroid : null;
    const fromPhases = freeTrialDaysFromAndroidPhases(android?.pricingPhaseList);
    if (fromPhases !== null) return fromPhases;
  }
  return null;
}

function freeTrialDaysFromIosInfo(info: unknown): number | null {
  if (!isRecord(info)) return null;
  const intro = isRecord(info.introductoryOffer) ? info.introductoryOffer : null;
  if (!intro || intro.paymentMode !== "free-trial") return null;
  const period = isRecord(intro.period) ? intro.period : null;
  const perPeriod = period ? periodUnitToDays(period.unit, period.value) : null;
  const periodCount = typeof intro.periodCount === "number" && intro.periodCount > 0 ? intro.periodCount : 1;
  return boundedTrialDays(perPeriod !== null ? perPeriod * periodCount : null);
}

function freeTrialDaysFromAndroidPhases(phases: unknown): number | null {
  if (!Array.isArray(phases) || phases.length < 2) return null;
  const first = phases[0];
  if (!isRecord(first) || String(first.priceAmountMicros) !== "0") return null;
  const perCycle = isoPeriodToDays(first.billingPeriod);
  const cycles = typeof first.billingCycleCount === "number" && first.billingCycleCount > 0 ? first.billingCycleCount : 1;
  return boundedTrialDays(perCycle !== null ? perCycle * cycles : null);
}

function freeTrialDaysFromAndroidOfferDetails(details: unknown): number | null {
  if (!Array.isArray(details)) return null;
  for (const detail of details) {
    if (!isRecord(detail)) continue;
    const phases = isRecord(detail.pricingPhases) ? detail.pricingPhases.pricingPhaseList : null;
    const days = freeTrialDaysFromAndroidPhases(phases);
    if (days !== null) return days;
  }
  return null;
}

function androidPhasePrice(phases: unknown): string | null {
  // The approved base plan has one regular phase; introductory phases are not
  // interchangeable with the undiscounted offer used for this launch.
  if (!Array.isArray(phases) || phases.length !== 1) return null;
  const last = phases[phases.length - 1];
  if (!isRecord(last)) return null;
  if (last.priceAmountMicros !== undefined) {
    const micros = Number(last.priceAmountMicros);
    if (!Number.isFinite(micros) || micros <= 0) return null;
  }
  return cleanPrice(last.formattedPrice);
}

export type AndroidBasePlanOffer = { displayPrice: string; offerToken: string };

function validOfferToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 4096;
}

/** Price and token must come from one validated, undiscounted store offer. */
export function selectAndroidBasePlanOffer(product: unknown): AndroidBasePlanOffer | null {
  if (!isRecord(product)) return null;
  const details = Array.isArray(product.subscriptionOfferDetailsAndroid) ? product.subscriptionOfferDetailsAndroid : [];
  for (const detail of details) {
    if (!isRecord(detail) || detail.offerId) continue;
    const phases = isRecord(detail.pricingPhases) ? detail.pricingPhases.pricingPhaseList : null;
    const price = androidPhasePrice(phases);
    if (price && validOfferToken(detail.offerToken)) return { displayPrice: price, offerToken: detail.offerToken };
  }
  const offers = Array.isArray(product.subscriptionOffers) ? product.subscriptionOffers : [];
  for (const offer of offers) {
    if (!isRecord(offer) || offer.id || offer.paymentMode === "free-trial" || offer.type === "introductory") continue;
    const phases = isRecord(offer.pricingPhasesAndroid) ? offer.pricingPhasesAndroid.pricingPhaseList : null;
    const price = phases == null ? cleanPrice(offer.displayPrice) : androidPhasePrice(phases);
    if (price && validOfferToken(offer.offerTokenAndroid)) return { displayPrice: price, offerToken: offer.offerTokenAndroid };
  }
  return null;
}

/**
 * Normalizes an expo-iap (OpenIAP) product into the small, display-only shape
 * the paywall needs. Unknown or malformed products return null so native checkout
 * remains unavailable until the store supplies a valid billed amount.
 */
export function normalizeStoreProductPrice(product: unknown): StoreProductPrice | null {
  if (!isRecord(product)) return null;
  if (product.id !== undefined && product.productId !== undefined && product.id !== product.productId) return null;
  const productId = typeof product.id === "string" ? product.id : typeof product.productId === "string" ? product.productId : null;
  if (!productId || !/^[a-z0-9_.]{3,100}$/i.test(productId)) return null;

  const basePlanPrice = selectAndroidBasePlanOffer(product)?.displayPrice ?? null;
  const hasAndroidOffers = Array.isArray(product.subscriptionOfferDetailsAndroid) && product.subscriptionOfferDetailsAndroid.length > 0
    || Array.isArray(product.subscriptionOffers) && product.subscriptionOffers.some(offer => isRecord(offer)
      && (offer.offerTokenAndroid !== undefined || offer.pricingPhasesAndroid !== undefined));
  if (hasAndroidOffers && !basePlanPrice) return null;
  if (!basePlanPrice && typeof product.price === "number" && (!Number.isFinite(product.price) || product.price <= 0)) return null;
  const displayPrice = basePlanPrice ?? cleanPrice(product.displayPrice) ?? cleanPrice(product.localizedPrice);
  if (!displayPrice) return null;

  const freeTrialDays =
    freeTrialDaysFromStandardOffers(product.subscriptionOffers) ??
    freeTrialDaysFromIosInfo(product.subscriptionInfoIOS) ??
    freeTrialDaysFromAndroidOfferDetails(product.subscriptionOfferDetailsAndroid) ??
    (product.introductoryPricePaymentModeIOS === "free-trial"
      ? boundedTrialDays(
          periodUnitToDays(
            product.introductoryPriceSubscriptionPeriodIOS,
            Number(product.introductoryPriceNumberOfPeriodsIOS ?? 1)
          )
        )
      : null);

  return { productId, displayPrice, freeTrialDays };
}

export function describeLaunchPlanPricing(
  planId: PaywallPlanId,
  storePrice?: StoreProductPrice | null
): PaywallPlanPricing {
  const storeLocalized = Boolean(storePrice?.displayPrice);
  const billed = storePrice?.displayPrice ?? FALLBACK_USD[planId];
  // The approved monthly/annual launch has no introductory offers.
  const trialDays: number | null = null;

  if (planId === "yearly") {
    return {
      planId,
      headline: billed,
      cadence: "per year",
      detail:
        !storeLocalized && YEARLY_MONTHLY_EQUIVALENT_USD !== null
          ? `Billed yearly · about ${formatUsd(YEARLY_MONTHLY_EQUIVALENT_USD)}/month`
          : "Billed yearly",
      trialLine: trialDays ? `${trialDays}-day free trial for eligible new subscribers, then ${billed} per year.` : null,
      hasFreeTrial: Boolean(trialDays),
      storeLocalized
    };
  }

  if (planId === "monthly") {
    return {
      planId,
      headline: billed,
      cadence: "per month",
      detail: "Billed monthly",
      trialLine: trialDays ? `${trialDays}-day free trial for eligible new subscribers, then ${billed} per month.` : null,
      hasFreeTrial: Boolean(trialDays),
      storeLocalized
    };
  }

  return {
    planId,
    headline: billed,
    cadence: "one-time",
    detail: "One payment, no renewal",
    trialLine: null,
    hasFreeTrial: false,
    storeLocalized
  };
}

export function getPaywallPrimaryActionLabel(pricing: PaywallPlanPricing): string {
  if (pricing.hasFreeTrial) return "Start free trial";
  if (pricing.planId === "lifetime") return `Buy lifetime · ${pricing.headline}`;
  return `Subscribe · ${pricing.headline} ${pricing.cadence}`;
}

/**
 * Auto-renewal and cancellation terms shown directly under the purchase
 * buttons (App Store 3.1.2(a); Google Play subscriptions policy).
 */
export function getSubscriptionTermsDisclosure(platform: string): string {
  const account = platform === "android" ? "Google Play account" : "Apple ID";
  const manage =
    platform === "android"
      ? "Google Play Store > Payments & subscriptions > Subscriptions"
      : "Settings > your name > Subscriptions";
  return (
    `Auto-renews at the price and interval shown. No free trial. Charged to your ${account} at confirmation. ` +
    `Cancel in ${manage} before renewal; access continues through the paid period.`
  );
}
