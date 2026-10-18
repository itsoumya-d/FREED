import { assertFirebaseRecoveryDnsEnrollment, parseFirebaseRecoveryDnsReceipt, type FirebaseRecoveryDnsEnrollment, type FirebaseRecoveryDnsReceipt, type FirebaseRecoveryDnsOptions } from './firebase-client';
import { parseRecoveryDnsPilotReceipt, type RecoveryDnsPilotInput, type RecoveryDnsPilotReceipt } from '../../modules/freed-protection/src/recovery-dns-pilot';

export type RecoveryDnsEnrollmentConsent = { ownerId: string; actionScope: string; consentVersion: '2026-10-18'; dnsConsent: true; websiteAlertConsent: boolean; retentionAcknowledged: true };
/** Secret-bearing record: persist only in owner-partitioned secure storage, never diagnostics/backups. */
export type RecoveryDnsPendingEnrollment = { version: 1; ownerId: string; rawSecret: string; request: FirebaseRecoveryDnsEnrollment; receipt: FirebaseRecoveryDnsReceipt | null };
export type RecoveryDnsEnrollmentDependencies = {
  currentOwner: () => { ownerId: string; actionScope: string } | null;
  pending: { load: (ownerId: string) => Promise<unknown>; save: (ownerId: string, pending: RecoveryDnsPendingEnrollment) => Promise<void> };
  installationId: () => Promise<string>;
  randomHex: (bytes: number) => Promise<string>;
  uuid: () => string | Promise<string>;
  hashSecret: (rawSecret: string) => Promise<string>;
  enroll: (request: FirebaseRecoveryDnsEnrollment, options: FirebaseRecoveryDnsOptions) => Promise<FirebaseRecoveryDnsReceipt>;
  stage: (input: RecoveryDnsPilotInput) => Promise<RecoveryDnsPilotReceipt>;
};
export type RecoveryDnsEnrollmentResult = { status: 'staged'; receipt: FirebaseRecoveryDnsReceipt; native: RecoveryDnsPilotReceipt } | { status: 'error'; reason: 'owner-changed' | 'busy' | 'consent-required' | 'consent-changed' | 'pending-invalid' | 'storage-unavailable' | 'enrollment-unavailable' | 'stage-unavailable' };
const exact = (v: unknown, keys: string[]): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === [...keys].sort().join(','));
class EnrollmentFailure extends Error { constructor(readonly reason: Extract<RecoveryDnsEnrollmentResult, {status: 'error'}>['reason']) { super(reason); } }
/** Enroll and stage only. A staged candidate is neither saved DNS settings nor verified recovery. */
export function createRecoveryDnsEnrollment(deps: RecoveryDnsEnrollmentDependencies) {
  let busy = false;
  return {
    async enroll(input: RecoveryDnsEnrollmentConsent): Promise<RecoveryDnsEnrollmentResult> {
      if (busy) return { status: 'error', reason: 'busy' };
      if (!exact(input, ['ownerId', 'actionScope', 'consentVersion', 'dnsConsent', 'websiteAlertConsent', 'retentionAcknowledged']) || typeof input.ownerId !== 'string' || !input.ownerId.trim() || typeof input.actionScope !== 'string' || !input.actionScope || input.consentVersion !== '2026-10-18' || input.dnsConsent !== true || typeof input.websiteAlertConsent !== 'boolean' || input.retentionAcknowledged !== true) return { status: 'error', reason: 'consent-required' };
      const ownerId = input.ownerId, scope = input.actionScope, websiteAlertConsent = input.websiteAlertConsent;
      const current = () => { const owner = deps.currentOwner(); return owner?.ownerId === ownerId && owner.actionScope === scope; };
      const fence = () => { if (!current()) throw new EnrollmentFailure('owner-changed'); };
      let phase: Extract<RecoveryDnsEnrollmentResult, {status: 'error'}>['reason'] = 'storage-unavailable';
      busy = true;
      try {
        fence();
        const stored = await deps.pending.load(ownerId); fence();
        let pending: RecoveryDnsPendingEnrollment;
        if (stored !== null && stored !== undefined) {
          phase = 'pending-invalid';
          if (!exact(stored, ['version', 'ownerId', 'rawSecret', 'request', 'receipt']) || stored.version !== 1 || stored.ownerId !== ownerId || typeof stored.rawSecret !== 'string' || !/^[a-f0-9]{64}$/.test(stored.rawSecret)) throw new EnrollmentFailure(phase);
          assertFirebaseRecoveryDnsEnrollment(stored.request);
          const request = { ...stored.request };
          const digest = await deps.hashSecret(stored.rawSecret); fence();
          if (digest !== request.credentialHash) throw new EnrollmentFailure(phase);
          const receipt = stored.receipt === null ? null : parseFirebaseRecoveryDnsReceipt(stored.receipt);
          if (receipt && (receipt.credentialHash !== request.credentialHash || receipt.installationId !== request.installationId || receipt.audience !== request.audience)) throw new EnrollmentFailure(phase);
          if (request.websiteAlertConsent !== websiteAlertConsent) throw new EnrollmentFailure('consent-changed');
          pending = { version: 1, ownerId, rawSecret: stored.rawSecret, request, receipt };
        } else {
          phase = 'enrollment-unavailable';
          const installationId = await deps.installationId(); fence();
          const rawSecret = await deps.randomHex(32); fence();
          if (!/^[a-f0-9]{64}$/.test(rawSecret)) throw new EnrollmentFailure(phase);
          const credentialHash = await deps.hashSecret(rawSecret); fence();
          const audience = await deps.randomHex(16); fence();
          const clientEventId = await deps.uuid(); fence();
          const request: FirebaseRecoveryDnsEnrollment = { credentialHash, installationId, audience, clientEventId, consentVersion: '2026-10-18', dnsConsent: true, websiteAlertConsent, retentionAcknowledged: true };
          assertFirebaseRecoveryDnsEnrollment(request);
          pending = { version: 1, ownerId, rawSecret, request, receipt: null };
          phase = 'storage-unavailable'; fence();
          await deps.pending.save(ownerId, pending); fence();
        }
        if (!pending.receipt) {
          phase = 'enrollment-unavailable'; fence();
          const receipt = parseFirebaseRecoveryDnsReceipt(await deps.enroll({ ...pending.request }, { operationIsCurrent: current })); fence();
          if (receipt.credentialHash !== pending.request.credentialHash || receipt.installationId !== pending.request.installationId || receipt.audience !== pending.request.audience) throw new EnrollmentFailure(phase);
          pending = { ...pending, receipt };
          phase = 'storage-unavailable'; fence();
          await deps.pending.save(ownerId, pending); fence();
        }
        phase = 'stage-unavailable'; fence();
        const receipt = pending.receipt!;
        const native = parseRecoveryDnsPilotReceipt(await deps.stage({ rawSecret: pending.rawSecret, credentialHash: receipt.credentialHash, audience: receipt.audience, ownerGeneration: receipt.ownerGeneration, installationId: receipt.installationId, actionScope: scope })); fence();
        if (!native || native.kind !== 'candidate' || !native.supported || !native.staged || native.credentialHash !== receipt.credentialHash || native.audience !== receipt.audience || native.ownerGeneration !== receipt.ownerGeneration) throw new EnrollmentFailure(phase);
        return { status: 'staged', receipt: { ...receipt }, native };
      } catch (error) {
        // Never expose raw SDK errors, secret-bearing input, or a previous owner's result.
        return { status: 'error', reason: !current() ? 'owner-changed' : error instanceof EnrollmentFailure ? error.reason : phase };
      } finally { busy = false; }
    }
  };
}
