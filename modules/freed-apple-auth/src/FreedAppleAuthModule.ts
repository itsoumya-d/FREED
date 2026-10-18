import { requireOptionalNativeModule } from "expo";

/** Provider tokens remain inside the native module and never reach JavaScript. */
export type FreedAppleAuthResult = { uid: string; email: string | null; revoked: boolean };
type FreedAppleAuthModule = {
  signIn(): Promise<FreedAppleAuthResult>;
  link(expectedUid: string): Promise<FreedAppleAuthResult>;
  reauthenticate(expectedUid: string): Promise<FreedAppleAuthResult>;
  reauthenticateAndRevoke(expectedUid: string): Promise<FreedAppleAuthResult>;
};

export function getFreedAppleAuthModule(): FreedAppleAuthModule {
  const native = requireOptionalNativeModule<FreedAppleAuthModule>("FreedAppleAuth");
  if (!native) throw new Error("Apple account access requires a FREED build with native Apple authentication support.");
  return native;
}
