export type ProtectionTestSnapshot = {
  adultBlocked: boolean;
  normalAllowed: boolean;
  nativeReady: boolean;
  nativeChecked: boolean;
  statusSignature: string;
};

export function canFinishProtectionSetup(test: ProtectionTestSnapshot | null, freshReady: boolean, freshSignature: string): boolean {
  return freshReady && test?.adultBlocked === true && test.normalAllowed === true &&
    test.nativeChecked === true && test.nativeReady === true && test.statusSignature === freshSignature;
}
