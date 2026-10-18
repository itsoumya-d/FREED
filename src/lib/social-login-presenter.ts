export type SocialLoginProvider = "google" | "apple";
export type SocialSignInButtonsProps = {
  googleAvailable: boolean;
  appleAvailable: boolean;
  busyProvider: SocialLoginProvider | null;
  disabled?: boolean;
  onGoogle: () => void;
  onApple: () => void;
};

export function presentSocialLogin(options: {
  platform: string;
  googleAvailable: boolean;
  appleAvailable: boolean;
  busyProvider: SocialLoginProvider | null;
  disabled?: boolean;
}) {
  const native = options.platform === "ios" || options.platform === "android";
  const googleVisible = native;
  const appleVisible = native && options.appleAvailable;
  const busy = options.busyProvider !== null || options.disabled === true;
  return {
    google: { visible: googleVisible, disabled: !googleVisible || !options.googleAvailable || busy, busy: native && options.busyProvider === "google" },
    apple: { visible: appleVisible, disabled: !appleVisible || busy, busy: native && options.busyProvider === "apple" },
    busyAnnouncement: native && options.busyProvider ? `Connecting with ${options.busyProvider === "google" ? "Google" : "Apple"}…` : null,
    unavailableMessage: !native
      ? "Use the FREED iOS or Android app to sign in with Google or Apple."
      : !options.googleAvailable && !busy
      ? "Google sign-in is unavailable in this build. You can continue with local progress and try again after updating FREED."
      : null
  };
}

export function createSocialLoginPressGate() {
  let claimed = false;
  return {
    tryStart(provider: SocialLoginProvider, state: { available: boolean; busyProvider: SocialLoginProvider | null }, onStart: () => void): boolean {
      if (claimed || !state.available || state.busyProvider !== null) return false;
      claimed = true;
      try { onStart(); }
      catch (error) { claimed = false; throw error; }
      return true;
    },
    release() { claimed = false; }
  };
}
