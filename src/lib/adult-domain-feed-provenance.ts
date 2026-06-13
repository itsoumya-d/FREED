import type { ProtectionStatus } from "freed-protection";

const EMBEDDED_ADULT_DOMAIN_FEED_VERSION_PREFIX = "freed-embedded-";

export function isReviewedAdultDomainFeedRequired(): boolean {
  if (readBooleanEnv("EXPO_PUBLIC_REQUIRE_REVIEWED_ADULT_DOMAIN_FEED")) return true;
  return isProductionRuntime();
}

export function hasReviewedNativeAdultDomainFeed(status: ProtectionStatus | null): boolean {
  return Boolean((status?.adultDomainFeedDomainCount ?? 0) > 0 && isReviewedFeedVersion(status?.adultDomainFeedVersion));
}

export function hasReviewedSafariAdultDomainFeed(status: ProtectionStatus | null): boolean {
  return Boolean((status?.safariContentBlockerRuleCount ?? 0) > 0 && isReviewedFeedVersion(status?.safariContentBlockerVersion));
}

export function nativeAdultDomainFeedReadyForActivation(status: ProtectionStatus | null): boolean {
  if ((status?.adultDomainFeedDomainCount ?? 0) <= 0) return false;
  return !isReviewedAdultDomainFeedRequired() || hasReviewedNativeAdultDomainFeed(status);
}

export function safariAdultDomainFeedReadyForActivation(status: ProtectionStatus | null): boolean {
  if (status?.safariContentBlockerEnabled !== true) return false;
  if ((status?.safariContentBlockerRuleCount ?? 0) <= 0) return false;
  return !isReviewedAdultDomainFeedRequired() || hasReviewedSafariAdultDomainFeed(status);
}

function isReviewedFeedVersion(value: string | null | undefined): boolean {
  const version = value?.trim();
  return Boolean(version && !version.startsWith(EMBEDDED_ADULT_DOMAIN_FEED_VERSION_PREFIX));
}

function readBooleanEnv(key: string): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function isProductionRuntime(): boolean {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  if (nodeEnv === "production") return true;
  return typeof __DEV__ !== "undefined" ? !__DEV__ : false;
}
