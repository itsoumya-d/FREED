import { Platform } from "react-native";
import {
  AppleAuthenticationScope,
  isAvailableAsync,
  signInAsync
} from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { createAppleSignInFlow, createGoogleSignInFlow } from "./social-auth-flow";

export type { SocialProviderToken, SocialSignInResult } from "./social-auth-flow";

function readGoogleWebClientId(): string | null {
  const value = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  return value && value.trim() ? value.trim() : null;
}

function readGoogleIosClientId(): string | null {
  const value = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  return value && value.trim() ? value.trim() : null;
}

const googleFlow = createGoogleSignInFlow({
  platform: () => Platform.OS,
  webClientId: readGoogleWebClientId,
  iosClientId: readGoogleIosClientId,
  loadSdk: async () => {
    const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
    return GoogleSignin;
  }
});

const appleFlow = createAppleSignInFlow({
  platform: () => Platform.OS,
  isAvailable: isAvailableAsync,
  randomBytes: (size) => Crypto.getRandomBytesAsync(size),
  sha256: (nonce) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce, {
    encoding: Crypto.CryptoEncoding.HEX
  }),
  signIn: ({ nonce }) => signInAsync({
    requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
    nonce
  })
});

export function isGoogleSignInConfigured(): boolean {
  return googleFlow.isConfigured();
}

export function isAppleSignInAvailable(): Promise<boolean> {
  // Android uses Firebase's browser OAuth activity via the Auth coordinator.
  if (Platform.OS === "android") return Promise.resolve(true);
  return appleFlow.isAvailable();
}

export function signInWithGoogle() {
  return googleFlow.signIn();
}

export function signInWithApple() {
  return appleFlow.signIn();
}
