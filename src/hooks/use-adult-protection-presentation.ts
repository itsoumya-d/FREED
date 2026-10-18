import { useEncryptedDns } from './use-encrypted-dns';
import { getObservedAdultProtectionPresentation, type ObservedAdultProtectionInput } from '@/lib/observed-adult-protection';

/** Subscribe to the same device-level controller used by Protect and setup. */
export function useAdultProtectionPresentation(input: ObservedAdultProtectionInput) {
  return getObservedAdultProtectionPresentation(input, useEncryptedDns());
}
