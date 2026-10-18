/**
 * Native (iOS/Android) monetization SDK loader.
 *
 * Every specifier is a string literal so Metro bundles the SDK JavaScript.
 * The previous `new Function("return import(specifier)")` loader could never
 * resolve in a Hermes release bundle, which silently disabled purchases and
 * rewarded ads on every real device.
 */
export function loadNativeMonetizationModule(specifier: string): Promise<unknown> {
  switch (specifier) {
    case "expo-iap":
      return import("expo-iap");
    case "react-native-google-mobile-ads":
      return import("react-native-google-mobile-ads");
    case "react-native-purchases":
      return import("react-native-purchases");
    default:
      return Promise.reject(new Error(`Unsupported native monetization module: ${specifier}`));
  }
}
