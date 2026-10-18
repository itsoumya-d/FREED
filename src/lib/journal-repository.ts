import type { DailyCheckIn } from './recovery-state';

export const JOURNAL_LIMITS = { title: 256, text: 4000, photos: 6, photoBytes: 2 * 1024 * 1024, edge: 1600, entries: 10000, drafts: 100, storageChars: 32 * 1024 * 1024 } as const;
export type JournalPhoto = { id: string; fileName: string; thumbnailFileName: string; width: number; height: number; bytes: number; mime: 'image/jpeg' };
export type JournalEntry = { id: string; ownerId: string; revision: number; dateKey: string; title: string; text: string; photos: JournalPhoto[]; createdAt: string; updatedAt: string; savedDraftId: string; legacySourceId?: string };
export type JournalDraft = { id: string; ownerId: string; entryId: string | null; baseRevision: number | null; dateKey: string; title: string; text: string; photos: JournalPhoto[]; createdAt: string; updatedAt: string };
export type JournalLegacyDraft = { sourceId: string; dateKey: string; text: string };
export type JournalMigrationState = { processedSources: readonly string[]; deletedLegacySources: readonly string[] };
export type JournalArchiveState = JournalMigrationState & { entries: JournalEntry[] };
export type JournalLocalSnapshot = { ownerId: string; state: unknown; draftBuffer: JournalDraft | null };
export type JournalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type JournalState = { version: 1; ownerId: string; entries: JournalEntry[]; drafts: JournalDraft[]; migratedSources: string[] };
export class JournalError extends Error { constructor(public readonly code: 'storage' | 'corrupt' | 'owner' | 'date' | 'invalid' | 'empty' | 'conflict' | 'missing' | 'limit') { super(`journal-${code}`); this.name = 'JournalError'; } }
export const isJournalId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const isJournalFileName = (value: unknown): value is string => typeof value === 'string' && /^(photo|thumb)-[A-Za-z0-9_-]{1,128}\.jpg$/.test(value);
export function isJournalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00.000Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function assertJournalOwner(ownerId: string): void {
  // Opaque account/guest namespaces, never a path or URI. No percent-decoding aliases.
  if (typeof ownerId !== 'string' || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(ownerId) || /^\.+$/.test(ownerId)) throw new JournalError('owner');
}
/** Collision-free ASCII identity encoding; <=177 bytes and never dot/separator/percent syntax. */
export function journalOwnerComponent(ownerId: string): string {
  assertJournalOwner(ownerId); const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let bits = 0, value = 0, result = 'owner_';
  for (let index = 0; index < ownerId.length; index++) {
    value = (value << 8) | ownerId.charCodeAt(index); bits += 8;
    while (bits >= 6) { bits -= 6; result += alphabet[(value >>> bits) & 63]; }
    value &= (1 << bits) - 1;
  }
  if (bits) result += alphabet[(value << (6 - bits)) & 63]; return result;
}
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const ownerGenerations = new Map<string, number>();
function legacyId(sourceId: string) { let a = 2166136261, b = 5381; for (const c of sourceId) { a = Math.imul(a ^ c.charCodeAt(0), 16777619); b = Math.imul(b, 33) ^ c.charCodeAt(0); } return `legacy_${(a >>> 0).toString(16)}_${(b >>> 0).toString(16)}`; }
export function validateJournalMigrationState(value: unknown, entries: readonly Pick<JournalEntry, 'legacySourceId'>[] = []): asserts value is JournalMigrationState {
  if (!object(value) || !Array.isArray(value.processedSources) || !Array.isArray(value.deletedLegacySources)) throw new JournalError('invalid');
  for (const list of [value.processedSources, value.deletedLegacySources]) {
    if (list.length > JOURNAL_LIMITS.entries || list.some(s => typeof s !== 'string' || !s.length || s.length > 512) || new Set(list).size !== list.length) throw new JournalError('invalid');
  }
  const processed = new Set(value.processedSources), deleted = new Set(value.deletedLegacySources);
  const active = entries.map(e => e.legacySourceId).filter((s): s is string => Boolean(s));
  if (new Set(active).size !== active.length || value.deletedLegacySources.some(s => !processed.has(s) || s.startsWith('draft:')) || active.some(s => !processed.has(s) || deleted.has(s))
    || value.processedSources.some(s => !s.startsWith('draft:') && !active.includes(s) && !deleted.has(s))) throw new JournalError('invalid');
}
function deletedLegacySources(state: JournalState): string[] { const present = new Set(state.entries.map(e => e.legacySourceId).filter(Boolean)); return state.migratedSources.filter(s => !s.startsWith('draft:') && !present.has(s)); }
export function validateJournalPhoto(value: unknown): asserts value is JournalPhoto {
  if (!object(value) || !isJournalId(value.id) || value.fileName !== `photo-${value.id}.jpg` || value.thumbnailFileName !== `thumb-${value.id}.jpg`
    || value.mime !== 'image/jpeg' || !Number.isInteger(value.width) || !Number.isInteger(value.height) || Number(value.width) < 1 || Number(value.height) < 1
    || Math.max(Number(value.width), Number(value.height)) > JOURNAL_LIMITS.edge || !Number.isInteger(value.bytes) || Number(value.bytes) < 1 || Number(value.bytes) > JOURNAL_LIMITS.photoBytes) throw new JournalError('invalid');
}
function validateContent(value: unknown, ownerId: string): asserts value is JournalDraft {
  if (!object(value) || value.ownerId !== ownerId || !isJournalId(value.id) || !isJournalDate(value.dateKey)
    || typeof value.title !== 'string' || value.title.length > JOURNAL_LIMITS.title || typeof value.text !== 'string' || value.text.length > JOURNAL_LIMITS.text
    || !timestamp(value.createdAt) || !timestamp(value.updatedAt) || !Array.isArray(value.photos) || value.photos.length > JOURNAL_LIMITS.photos) throw new JournalError('invalid');
  value.photos.forEach(validateJournalPhoto);
  if (new Set(value.photos.map(p => p.id)).size !== value.photos.length) throw new JournalError('invalid');
}
export function validateJournalEntry(value: unknown, ownerId: string): asserts value is JournalEntry {
  validateContent(value, ownerId); const e = value as unknown as JournalEntry;
  if (!Number.isSafeInteger(e.revision) || e.revision < 1 || !isJournalId(e.savedDraftId) || (!e.text.trim() && !e.photos.length)
    || (e.legacySourceId !== undefined && (typeof e.legacySourceId !== 'string' || e.legacySourceId.length > 512))) throw new JournalError('invalid');
}
function validateState(value: unknown, ownerId: string): JournalState {
  if (!object(value) || value.version !== 1 || value.ownerId !== ownerId || !Array.isArray(value.entries) || value.entries.length > JOURNAL_LIMITS.entries
    || !Array.isArray(value.drafts) || value.drafts.length > JOURNAL_LIMITS.drafts || !Array.isArray(value.migratedSources) || value.migratedSources.length > JOURNAL_LIMITS.entries) throw new JournalError('corrupt');
  try {
    value.entries.forEach(e => validateJournalEntry(e, ownerId));
    value.drafts.forEach(d => { validateContent(d, ownerId); if ((d.entryId !== null && !isJournalId(d.entryId)) || (d.baseRevision !== null && (!Number.isSafeInteger(d.baseRevision) || d.baseRevision < 1))) throw new JournalError('invalid'); });
    if (new Set(value.entries.map(e => e.id)).size !== value.entries.length || new Set(value.drafts.map(d => d.id)).size !== value.drafts.length
      || !value.migratedSources.every(s => typeof s === 'string' && s.length <= 512) || new Set(value.migratedSources).size !== value.migratedSources.length) throw new JournalError('invalid');
  } catch { throw new JournalError('corrupt'); }
  return value as unknown as JournalState;
}
/** A single durable envelope makes draft-to-entry saves atomic. No RecoveryState writes. */
export function createJournalRepository({ storage, ownerId, now = () => new Date().toISOString(), newId = () => `j_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}` }: { storage: JournalStorage; ownerId: string; now?: () => string; newId?: () => string }) {
  assertJournalOwner(ownerId); const storageKey = `freed.journal.owner.${encodeURIComponent(ownerId)}.v1`;
  const generation = ownerGenerations.get(ownerId) ?? 0;
  const isActive = () => generation === (ownerGenerations.get(ownerId) ?? 0);
  const assertActive = () => { if (!isActive()) throw new JournalError('owner'); };
  const bufferKey = `${storageKey}.draft-buffer`;
  function readBuffer(): JournalDraft | null {
    let raw: string | null; try { raw = storage.getItem(bufferKey); } catch { throw new JournalError('storage'); }
    if (!raw) return null; if (raw.length > 60000) throw new JournalError('corrupt');
    try { const value: unknown = JSON.parse(raw); validateContent(value, ownerId); return value; } catch { throw new JournalError('corrupt'); }
  }
  const empty = (): JournalState => ({ version: 1, ownerId, entries: [], drafts: [], migratedSources: [] });
  function read(): JournalState {
    assertActive();
    let raw: string | null; try { raw = storage.getItem(storageKey); } catch { throw new JournalError('storage'); }
    if (!raw) return empty(); if (raw.length > JOURNAL_LIMITS.storageChars) throw new JournalError('corrupt');
    let value: unknown; try { value = JSON.parse(raw); } catch { throw new JournalError('corrupt'); }
    return validateState(value, ownerId);
  }
  read(); // Surface corrupt/inaccessible storage; never replace it with an empty history.
  function commit(next: JournalState) {
    assertActive();
    validateState(next, ownerId); const raw = JSON.stringify(next); if (raw.length > JOURNAL_LIMITS.storageChars) throw new JournalError('limit');
    try { storage.setItem(storageKey, raw); } catch { throw new JournalError('storage'); }
  }
  function nextId(state: JournalState) {
    const id = newId(); if (!isJournalId(id) || state.entries.some(e => e.id === id || e.savedDraftId === id) || state.drafts.some(d => d.id === id)) throw new JournalError('invalid'); return id;
  }
  const repo = {
    ownerId, storageKey, isActive,
    exportArchiveState(): JournalArchiveState { const s = read(); return { entries: clone(s.entries), processedSources: [...new Set([...s.migratedSources, ...s.entries.flatMap(e => e.legacySourceId ? [e.legacySourceId] : [])])], deletedLegacySources: deletedLegacySources(s) }; },
    exportLocalSnapshot(): JournalLocalSnapshot { return { ownerId, state: clone(read()), draftBuffer: clone(readBuffer()) }; },
    restoreLocalSnapshot(snapshot: JournalLocalSnapshot): void {
      assertActive(); if (snapshot.ownerId !== ownerId) throw new JournalError('owner');
      const state = validateState(snapshot.state, ownerId);
      if (snapshot.draftBuffer) validateContent(snapshot.draftBuffer, ownerId);
      // A durable whole-app restore intent remains until BOTH publications succeed.
      commit(state);
      if (snapshot.draftBuffer) repo.bufferDraft(snapshot.draftBuffer); else repo.clearDraftBuffer();
    },
    revoke(): void { if (isActive()) ownerGenerations.set(ownerId, generation + 1); },
    bufferDraft(draft: JournalDraft): void {
      assertActive();
      validateContent(draft, ownerId); const raw = JSON.stringify(draft); if (raw.length > 60000) throw new JournalError('limit');
      try { storage.setItem(bufferKey, raw); } catch { throw new JournalError('storage'); }
    },
    clearDraftBuffer(): void { assertActive(); try { storage.removeItem(bufferKey); } catch { throw new JournalError('storage'); } },
    recoverDraftBuffer(): void {
      const buffered = readBuffer(); if (!buffered) return; const s = read();
      // Successful Save/Discard can be followed by interrupted scratch cleanup. Never recreate those forms.
      if (s.drafts.some(d => d.id === buffered.id)) repo.saveDraft(buffered);
      repo.clearDraftBuffer();
    },
    list(filter: { query?: string; dateKey?: string } = {}): JournalEntry[] { const q = filter.query?.trim().toLocaleLowerCase(); return clone(read().entries.filter(e => (!filter.dateKey || e.dateKey === filter.dateKey) && (!q || `${e.title}\n${e.text}`.toLocaleLowerCase().includes(q))).sort((a, b) => b.dateKey.localeCompare(a.dateKey) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))); },
    drafts(): JournalDraft[] { return clone(read().drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); },
    newDraft(dateKey: string): JournalDraft {
      if (!isJournalDate(dateKey)) throw new JournalError('date'); const s = read(); if (s.drafts.length >= JOURNAL_LIMITS.drafts) throw new JournalError('limit');
      const d: JournalDraft = { id: nextId(s), ownerId, entryId: null, baseRevision: null, dateKey, title: '', text: '', photos: [], createdAt: now(), updatedAt: now() };
      commit({ ...s, drafts: [...s.drafts, d] }); return clone(d);
    },
    editDraft(entryId: string): JournalDraft {
      const s = read(); const e = s.entries.find(e => e.id === entryId); if (!e) throw new JournalError('missing'); if (s.drafts.length >= JOURNAL_LIMITS.drafts) throw new JournalError('limit');
      const d: JournalDraft = { id: nextId(s), ownerId, entryId: e.id, baseRevision: e.revision, dateKey: e.dateKey, title: e.title, text: e.text, photos: clone(e.photos), createdAt: e.createdAt, updatedAt: now() };
      commit({ ...s, drafts: [...s.drafts, d] }); return clone(d);
    },
    saveDraft(draft: JournalDraft): JournalDraft {
      validateContent(draft, ownerId); const s = read(); const previous = s.drafts.find(d => d.id === draft.id);
      if (!previous || previous.entryId !== draft.entryId || previous.baseRevision !== draft.baseRevision || previous.createdAt !== draft.createdAt) throw new JournalError('conflict');
      const next = { ...clone(draft), updatedAt: now() }; commit({ ...s, drafts: s.drafts.map(d => d.id === next.id ? next : d) }); return clone(next);
    },
    saveEntry(draftId: string): JournalEntry {
      const s = read(); const d = s.drafts.find(d => d.id === draftId);
      if (!d) { const receipt = s.entries.find(e => e.savedDraftId === draftId); if (receipt) return clone(receipt); throw new JournalError('missing'); }
      if (!d.text.trim() && !d.photos.length) throw new JournalError('empty');
      const current = d.entryId ? s.entries.find(e => e.id === d.entryId) : null;
      if (d.entryId && (!current || current.revision !== d.baseRevision)) throw new JournalError('conflict');
      if (!current && s.entries.length >= JOURNAL_LIMITS.entries) throw new JournalError('limit');
      const e: JournalEntry = { id: current?.id ?? `entry_${d.id}`, ownerId, revision: (current?.revision ?? 0) + 1, dateKey: d.dateKey, title: d.title, text: d.text, photos: clone(d.photos), createdAt: current?.createdAt ?? d.createdAt, updatedAt: now(), savedDraftId: d.id, ...(current?.legacySourceId ? { legacySourceId: current.legacySourceId } : {}) };
      commit({ ...s, entries: [...s.entries.filter(old => old.id !== e.id), e], drafts: s.drafts.filter(old => old.id !== d.id) }); return clone(e);
    },
    discardDraft(id: string): void { const s = read(); commit({ ...s, drafts: s.drafts.filter(d => d.id !== id) }); },
    deleteEntry(id: string, expectedRevision: number): void {
      const s = read(); const e = s.entries.find(e => e.id === id); if (!e) return; if (e.revision !== expectedRevision) throw new JournalError('conflict');
      commit({ ...s, entries: s.entries.filter(e => e.id !== id), drafts: s.drafts.filter(d => d.entryId !== id), migratedSources: e.legacySourceId ? [...new Set([...s.migratedSources, e.legacySourceId])] : s.migratedSources });
    },
    migrateLegacy(records: readonly DailyCheckIn[], legacyDraft?: JournalLegacyDraft): number {
      const s = read(); let added = 0; const entries = [...s.entries], migratedSources = [...s.migratedSources], drafts = [...s.drafts];
      for (const record of [...records].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.id.localeCompare(b.id))) {
        if (!record.reflection?.trim()) continue;
        const sourceId = `${record.dateKey}:${record.id}`; if (migratedSources.includes(sourceId)) continue;
        // Deterministic UTF-16 hex hash pair, with exact source IDs retained to detect collisions.
        const id = legacyId(sourceId);
        const existing = entries.find(e => e.id === id || e.legacySourceId === sourceId);
        if (existing) { if (existing.legacySourceId !== sourceId) throw new JournalError('conflict'); migratedSources.push(sourceId); continue; }
        const entry: JournalEntry = { id, ownerId, revision: 1, dateKey: record.dateKey, title: '', text: record.reflection, photos: [], createdAt: record.createdAt, updatedAt: record.updatedAt, savedDraftId: id, legacySourceId: sourceId };
        validateJournalEntry(entry, ownerId); entries.push(entry); migratedSources.push(sourceId); added++;
      }
      if (legacyDraft?.text.trim()) {
        const sourceId = `draft:${legacyDraft.sourceId}`;
        if (!migratedSources.includes(sourceId)) {
          if (!legacyDraft.sourceId || sourceId.length > 512 || !isJournalDate(legacyDraft.dateKey)) throw new JournalError('invalid');
          const id = legacyId(sourceId);
          if (drafts.some(d => d.id === id) || entries.some(e => e.savedDraftId === id)) migratedSources.push(sourceId);
          else {
            if (entries.some(e => e.id === id)) throw new JournalError('conflict');
            const draft: JournalDraft = { id, ownerId, entryId: null, baseRevision: null, dateKey: legacyDraft.dateKey, text: legacyDraft.text, title: '', photos: [], createdAt: now(), updatedAt: now() };
            validateContent(draft, ownerId); drafts.push(draft); migratedSources.push(sourceId);
          }
        }
      }
      if (added || drafts.length !== s.drafts.length || migratedSources.length !== s.migratedSources.length) commit({ ...s, entries, drafts, migratedSources }); return added;
    },
    referencedFileNames(): string[] { const s = read(), buffered = readBuffer(); return [...new Set([...s.entries, ...s.drafts, ...(buffered ? [buffered] : [])].flatMap(e => e.photos.flatMap(p => [p.fileName, p.thumbnailFileName])))].sort(); },
    importEntries(incoming: readonly JournalEntry[], migration?: JournalMigrationState): { importedEntries: number; skippedDeletedEntries: number } {
      if (migration) validateJournalMigrationState(migration, incoming);
      const s = read(), deleted = new Set([...deletedLegacySources(s), ...(migration?.deletedLegacySources ?? [])]);
      const entries = s.entries.filter(e => !e.legacySourceId || !deleted.has(e.legacySourceId));
      const migratedSources = new Set([...s.migratedSources, ...(migration?.processedSources ?? [])]); let importedEntries = 0, skippedDeletedEntries = 0;
      for (const value of incoming) {
        validateJournalEntry(value, ownerId); const index = entries.findIndex(e => e.id === value.id);
        if (value.legacySourceId) { migratedSources.add(value.legacySourceId); if (deleted.has(value.legacySourceId)) { skippedDeletedEntries++; continue; } }
        if (index >= 0) { if (entries[index].revision > value.revision) throw new JournalError('conflict'); entries[index] = clone(value); } else entries.push(clone(value));
        importedEntries++;
      }
      commit({ ...s, entries, migratedSources: [...migratedSources], drafts: s.drafts.filter(d => !d.entryId || entries.some(e => e.id === d.entryId)) });
      return { importedEntries, skippedDeletedEntries };
    },
    purgeOwner(): void { repo.revoke(); let failed = false; for (const key of [storageKey, bufferKey]) { try { storage.removeItem(key); } catch { failed = true; } } if (failed) throw new JournalError('storage'); }
  };
  return repo;
}
export type JournalRepository = ReturnType<typeof createJournalRepository>;
