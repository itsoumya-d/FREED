import { createDefaultRecoveryState, hydrateRecoveryState, type RecoveryState } from './recovery-state';
import { buildPortableRecoveryState } from './recovery-backup';
export const OWNER_RECOVERY_STORAGE_KEY = 'freed.recovery.private.v2';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Ledger = { version: 2; owners: Record<string, { ownerUid: string; state: RecoveryState }>; publicState: RecoveryState; legacyClaimedBy: string | null };
const legacyKey = 'freed.recovery.state.v1';
const generations = new WeakMap<object, { owner: string | null; epoch: number }>();
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
function ownerKey(owner: string) {
  if (!owner || owner.length > 128 || owner.trim() !== owner || /[\x00-\x1f]/.test(owner)) throw new Error('Recovery owner is unavailable.');
  return `uid:${encodeURIComponent(owner)}`;
}
/** One atomic ledger publication keeps owner records and legacy claim intent consistent. */
export function createOwnerRecoveryStore({ storage, currentOwnerUid }: { storage: StorageLike; currentOwnerUid: () => string | null }) {
  let generation = generations.get(storage as object);
  if (!generation) { generation = { owner: null, epoch: 0 }; generations.set(storage as object, generation); }
  const empty = (): Ledger => ({ version: 2, owners: {}, publicState: createDefaultRecoveryState(), legacyClaimedBy: null });
  const readLedger = (): Ledger => {
    const raw = storage.getItem(OWNER_RECOVERY_STORAGE_KEY); if (!raw) return empty();
    const parsed: unknown = JSON.parse(raw);
    if (!record(parsed) || parsed.version !== 2 || !record(parsed.owners) || !record(parsed.publicState) ||
      !(parsed.legacyClaimedBy === null || typeof parsed.legacyClaimedBy === 'string')) throw new Error('Owner recovery storage could not be read.');
    for (const [key, value] of Object.entries(parsed.owners)) if (!record(value) || typeof value.ownerUid !== 'string' ||
      key !== ownerKey(value.ownerUid) || !record(value.state)) throw new Error('Owner recovery storage could not be read.');
    return parsed as unknown as Ledger;
  };
  const publish = (ledger: Ledger) => storage.setItem(OWNER_RECOVERY_STORAGE_KEY, JSON.stringify(ledger));
  const legacy = () => { const raw = storage.getItem(legacyKey); return raw ? hydrateRecoveryState(JSON.parse(raw)) : null; };
  const publicProjection = (state: RecoveryState): RecoveryState => ({ ...createDefaultRecoveryState(),
    journey: { ...state.journey }, hasCompletedOnboarding: state.hasCompletedOnboarding });
  return {
    activate(owner: string | null) {
      if (owner !== null) ownerKey(owner);
      if (generation!.owner !== owner) { generation!.owner = owner; generation!.epoch += 1; }
      const epoch = generation!.epoch;
      const isCurrent = () => generation!.epoch === epoch && generation!.owner === owner && currentOwnerUid() === owner;
      const assertCurrent = () => { if (!isCurrent()) throw new Error('The recovery owner changed. This write was stopped.'); };
      const read = (): RecoveryState => {
        assertCurrent(); const ledger = readLedger();
        return owner ? hydrateRecoveryState(ledger.owners[ownerKey(owner)]?.state ?? publicProjection(ledger.publicState))
          : hydrateRecoveryState(ledger.publicState);
      };
      return {
        ownerUid: owner, isCurrent, assertCurrent, read,
        save(state: RecoveryState) {
          assertCurrent(); const ledger = readLedger(), next = hydrateRecoveryState(state);
          if (owner) ledger.owners[ownerKey(owner)] = { ownerUid: owner, state: next };
          else ledger.publicState = next;
          assertCurrent(); publish(ledger); return clone(next);
        },
        hasUnclaimedLegacy() { assertCurrent(); const ledger = readLedger(); return ledger.legacyClaimedBy === null && Boolean(legacy()); },
        ownsLegacy() { assertCurrent(); return owner !== null && readLedger().legacyClaimedBy === owner; },
        adoptLegacy(confirmed: boolean): RecoveryState {
          assertCurrent(); if (!owner || !confirmed) throw new Error('Explicit account confirmation is required to adopt local history.');
          const ledger = readLedger(), old = legacy();
          if (ledger.legacyClaimedBy !== null || !old) throw new Error('No unclaimed local history is available.');
          const existing = ledger.owners[ownerKey(owner)]?.state;
          if (existing && (existing.dailyCheckIns.length || existing.attempts.length || existing.relapseRecords.length || existing.completedChallenges > 0 || existing.streakDays > 0 ||
            existing.challengeHistory.length || existing.customChallenges.length || existing.dailyHabits.length || existing.personalDailyPlans.length || existing.toolCompletions.length ||
            existing.supportCircle.length || existing.coachMessages.length || existing.answers.length || existing.pledges.length || existing.reminders.enabled || existing.accountability.contact || existing.premiumEntitlement))
            throw new Error('This account already has saved history. Export it before adopting local history.');
          const next = hydrateRecoveryState({ ...buildPortableRecoveryState(old, new Date().toISOString()),
            premium: false, premiumEntitlement: null, premiumPlanId: null, premiumPlanAudience: null, premiumActivatedAt: null,
            signedInEmail: null, automaticBackupEnabled: false });
          ledger.owners[ownerKey(owner)] = { ownerUid: owner, state: next }; ledger.legacyClaimedBy = owner;
          assertCurrent(); publish(ledger); return clone(next);
        }
      };
    },
    revoke() { generation!.epoch += 1; },
    legacyClaimOwner() { return readLedger().legacyClaimedBy; },
    readOwner(owner: string): RecoveryState { const ledger = readLedger(); return hydrateRecoveryState(ledger.owners[ownerKey(owner)]?.state ?? publicProjection(ledger.publicState)); },
    /** Rollback is bound to the captured owner, never the account currently displayed. */
    restoreOwner(owner: string, state: RecoveryState) {
      const ledger = readLedger(); ledger.owners[ownerKey(owner)] = { ownerUid: owner, state: hydrateRecoveryState(state) }; publish(ledger);
    },
    purgeOwner(owner: string) {
      const key = ownerKey(owner), ledger = readLedger();
      const claimedLegacy = ledger.legacyClaimedBy === owner || ledger.legacyClaimedBy === `deleted:${owner}`;
      delete ledger.owners[key];
      if (ledger.legacyClaimedBy === owner) ledger.legacyClaimedBy = `deleted:${owner}`;
      publish(ledger);
      if (claimedLegacy) storage.removeItem(legacyKey);
      if (generation!.owner === owner) generation!.epoch += 1;
    }
  };
}
export type OwnerRecoveryStore = ReturnType<typeof createOwnerRecoveryStore>;
export type OwnerRecoveryLease = ReturnType<OwnerRecoveryStore['activate']>;
