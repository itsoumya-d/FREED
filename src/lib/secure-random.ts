/**
 * React Native's Hermes engine ships without the WebCrypto `crypto` global.
 * FREED calls `globalThis.crypto.getRandomValues` for Firebase client event
 * IDs (account deletion, push registration, purchase verification) and for
 * encrypted-backup salts/IVs, so the native entry installs a CSPRNG (expo-crypto)
 * behind that standard name before any feature runs.
 *
 * Kept dependency-free so the installer can be unit tested in Node.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RandomValuesProvider = (array: any) => any;

type CryptoHost = {
  crypto?: { getRandomValues?: unknown } | undefined;
};

export function hasSecureRandom(host: CryptoHost = globalThis as CryptoHost): boolean {
  return typeof host.crypto?.getRandomValues === "function";
}

/**
 * Installs `crypto.getRandomValues` on `host` when it is missing.
 * Returns true only when something was installed; an existing implementation
 * (web, Node, or a previous install) is never replaced.
 */
export function installSecureRandomPolyfill(host: CryptoHost, provider: RandomValuesProvider): boolean {
  if (hasSecureRandom(host)) return false;
  if (typeof provider !== "function") return false;

  const getRandomValues = <T extends ArrayBufferView>(array: T): T => {
    provider(array);
    return array;
  };

  const existing = host.crypto;
  if (existing && typeof existing === "object") {
    try {
      Object.defineProperty(existing, "getRandomValues", {
        value: getRandomValues,
        configurable: true,
        writable: true
      });
      if (hasSecureRandom(host)) return true;
    } catch {
      // Frozen or exotic crypto object: fall through and replace it.
    }
  }

  Object.defineProperty(host, "crypto", {
    value: { ...(existing ?? {}), getRandomValues },
    configurable: true,
    writable: true
  });
  return hasSecureRandom(host);
}
