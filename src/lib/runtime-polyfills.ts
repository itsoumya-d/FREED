// Imported first by app/_layout.tsx. Must stay side-effect only and cheap.
//
// Hermes has no WebCrypto global; without this, account deletion, push-token
// registration, purchase verification and encrypted backups all throw
// "Secure randomness is unavailable" on real iOS/Android devices.
import { getRandomValues } from "expo-crypto";

import { installSecureRandomPolyfill } from "@/lib/secure-random";

installSecureRandomPolyfill(globalThis as never, getRandomValues as never);
