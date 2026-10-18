import type { RecoveryDnsPilotReceipt } from '../../modules/freed-protection/src/recovery-dns-pilot';
const absent = new Set(['recovery-dns-pilot-build-gated','recovery-dns-internal-build-required','recovery-dns-native-method-unavailable']);
/** An unavailable read is not evidence that the previous protection mode is absent. */
export function recoveryDnsAvailability(receipt: RecoveryDnsPilotReceipt): 'pilot'|'legacy'|'pending' {
  if (receipt.kind === 'status') return receipt.supported && receipt.modeActivationSupported ? 'pilot' : 'legacy';
  return absent.has(receipt.reason) ? 'legacy' : 'pending';
}
export function recoveryDnsAudienceResolution(receipt: RecoveryDnsPilotReceipt): {resolved:boolean;audience:string|null} {
  if (receipt.kind === 'status') return {resolved:true,audience:receipt.supported && receipt.staged ? receipt.audience : null};
  return {resolved:absent.has(receipt.reason),audience:null};
}
