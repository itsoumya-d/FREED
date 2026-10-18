/**
 * Web / test build of the monetization SDK loader. Store purchases and
 * rewarded ads only exist in native iOS/Android builds, so this resolves null
 * and the paywall reports that native purchase SDKs are unavailable.
 *
 * The native build uses native-monetization-loader.native.ts, which Metro
 * picks automatically for iOS and Android.
 */
export function loadNativeMonetizationModule(_specifier: string): Promise<unknown> {
  return Promise.resolve(null);
}
