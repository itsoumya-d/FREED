import 'expo-sqlite/localStorage/install';
import React from 'react';
import { AppState } from 'react-native';
import { createJournalRepository, JournalError, type JournalRepository, type JournalDraft, type JournalLegacyDraft } from '@/lib/journal-repository';
import type { JournalMediaStore } from '@/lib/journal-media';
const EMPTY_LEGACY_NOTES: readonly import('@/lib/recovery-state').DailyCheckIn[] = [];

// Errors describe outcomes, never raw filesystem/provider details or private content.
export function journalErrorMessage(error: unknown) {
  if (error instanceof JournalError && error.code === 'conflict') return 'This entry changed elsewhere. Your draft is kept. Reopen the saved entry before editing again.';
  if (error instanceof JournalError && error.code === 'corrupt') return 'Your journal could not be read. Its saved data has been kept. Try again or restore a backup.';
  return 'Your journal could not be saved. Your changes are still here. Check device storage and retry.';
}
/** Synchronous durable autosave, plus fenced asynchronous photo work. Mount this with an owner key. */
export function useJournalEntries({ ownerId, repository: supplied, media, legacyNotes = EMPTY_LEGACY_NOTES, legacyDraft, onChange }: { ownerId: string; repository?: JournalRepository; media: JournalMediaStore | null; legacyNotes?: readonly import('@/lib/recovery-state').DailyCheckIn[]; legacyDraft?: JournalLegacyDraft; onChange?: () => void }) {
  const [repository, setRepository] = React.useState<JournalRepository | null>(null);
  const [entries, setEntries] = React.useState<ReturnType<JournalRepository['list']>>([]);
  const [drafts, setDrafts] = React.useState<JournalDraft[]>([]);
  const [draft, setDraft] = React.useState<JournalDraft | null>(null);
  const current = React.useRef<JournalDraft | null>(null); const mounted = React.useRef(true); const busyRef = React.useRef(false);
  const autosaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState<string | null>(null); const [notice, setNotice] = React.useState<string | null>(null);
  const [cleanupPending, setCleanupPending] = React.useState(false);
  const changeCallback = React.useRef(onChange); changeCallback.current = onChange;
  const emit = () => { try { changeCallback.current?.(); } catch { /* A notification cannot undo an already durable journal save. */ } };
  const refresh = (repo: JournalRepository) => { setEntries(repo.list()); setDrafts(repo.drafts()); };
  const load = React.useCallback(() => {
    try {
      const repo = supplied ?? createJournalRepository({ ownerId, storage: localStorage });
      if (repo.ownerId !== ownerId) throw new JournalError('owner'); repo.recoverDraftBuffer(); repo.migrateLegacy(legacyNotes, legacyDraft);
      setRepository(repo); refresh(repo); setError(null);
    } catch (e) { setError(journalErrorMessage(e)); }
  }, [ownerId, supplied, legacyNotes, legacyDraft]);
  React.useEffect(() => { load(); }, [load]);
  const retain = React.useCallback(() => {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    if (!repository || !current.current) return true;
    try { const saved = repository.saveDraft(current.current); repository.clearDraftBuffer(); current.current = saved; if (mounted.current) { setDraft(saved); refresh(repository); setError(null); } return true; }
    catch (e) { if (mounted.current) setError(journalErrorMessage(e)); return false; }
  }, [repository]);
  React.useEffect(() => {
    mounted.current = true; const subscription = AppState.addEventListener('change', state => { if (state !== 'active') retain(); });
    return () => { retain(); mounted.current = false; subscription.remove(); };
  }, [retain]);
  const cleanup = React.useCallback(async () => {
    if (!repository || !media) return;
    try { await media.reconcile(ownerId, () => repository.referencedFileNames()); if (mounted.current) setCleanupPending(false); }
    catch { if (mounted.current) setCleanupPending(true); }
  }, [repository, media, ownerId]);
  React.useEffect(() => { void cleanup(); }, [cleanup]);
  function select(value: JournalDraft | null) { current.current = value; setDraft(value); }
  function update(change: Partial<Pick<JournalDraft, 'title' | 'text' | 'dateKey' | 'photos'>>) {
    if (!repository || !current.current || busyRef.current) return false;
    const value = { ...current.current, ...change }; current.current = value; setDraft(value);
    try {
      // Persist only this small active form per keystroke. The growing entry envelope waits for a typing pause.
      repository.bufferDraft(value); if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => { autosaveTimer.current = null; if (mounted.current) retain(); }, 300);
      setError(null); return true;
    }
    catch (e) { setError(journalErrorMessage(e)); return false; }
  }
  return {
    repository, entries, drafts, draft, busy, error, notice, cleanupPending, retryLoad: load, retryCleanup: cleanup,
    newEntry(dateKey: string) { if (!repository || busyRef.current || !retain()) return; try { select(repository.newDraft(dateKey)); refresh(repository); setError(null); setNotice(null); } catch (e) { setError(journalErrorMessage(e)); } },
    openEntry(id: string) { if (!repository || busyRef.current || !retain()) return; try { const existing = repository.drafts().find(d => d.entryId === id); select(existing ?? repository.editDraft(id)); refresh(repository); setError(null); setNotice(existing ? 'Draft restored. Your history changes when you save.' : null); } catch (e) { setError(journalErrorMessage(e)); } },
    openDraft(id: string) { if (!repository || busyRef.current || !retain()) return; const value = repository.drafts().find(d => d.id === id); if (value) { select(value); setError(null); setNotice('Draft restored. Your history changes when you save.'); } },
    leaveEditor() { if (busyRef.current || !retain()) return false; select(null); return true; },
    update,
    save() {
      if (!repository || !current.current || busyRef.current) return false;
      if (!retain()) return false;
      try { repository.saveEntry(current.current!.id); select(null); refresh(repository); setError(null); setNotice('Entry saved.'); emit(); void cleanup(); return true; }
      catch (e) { setError(journalErrorMessage(e)); return false; }
    },
    discard() {
      if (!repository || !current.current || busyRef.current) return; try { repository.discardDraft(current.current.id); repository.clearDraftBuffer(); select(null); refresh(repository); setError(null); void cleanup(); }
      catch (e) { setError(journalErrorMessage(e)); }
    },
    deleteEntry() {
      if (!repository || !current.current?.entryId || busyRef.current) return;
      try { repository.deleteEntry(current.current.entryId, current.current.baseRevision!); repository.clearDraftBuffer(); select(null); refresh(repository); setError(null); setNotice('Entry deleted.'); emit(); void cleanup(); }
      catch (e) { setError(journalErrorMessage(e)); }
    },
    async addPhoto(source: 'camera' | 'library') {
      const editing = current.current; if (!repository || !editing || busyRef.current) return;
      if (!media) { setError('Journal photos need a native build with private photo storage.'); return; }
      busyRef.current = true; setBusy(true); setError(null); const isCurrent = () => mounted.current && current.current?.id === editing.id && repository.ownerId === ownerId && repository.isActive();
      const outcome = await media.pickAndImport(ownerId, source, editing.photos.length, isCurrent);
      busyRef.current = false; if (!mounted.current) { if (outcome.status === 'added') { try { await media.removePhoto(ownerId, outcome.photo); } catch { /* Owner reconciliation retries on next open. */ } } return; }
      setBusy(false);
      if (outcome.status === 'added') {
        if (!isCurrent() || !update({ photos: [...editing.photos, outcome.photo] })) {
          if (current.current?.id === editing.id) { current.current = { ...current.current, photos: editing.photos }; setDraft(current.current); }
          try { await media.removePhoto(ownerId, outcome.photo); } catch { setCleanupPending(true); }
        }
        else {
          try { media.adoptPhoto(ownerId, outcome.photo, () => repository.referencedFileNames()); } catch { setCleanupPending(true); }
          setNotice(outcome.limited ? 'Photo added. FREED can only access the photos you selected.' : 'Photo added.'); if (outcome.cleanupPending) setCleanupPending(true);
        }
      } else if (outcome.status !== 'cancelled' && outcome.status !== 'stale') {
        const messages = { limit: 'Each entry can hold up to six photos.', denied: 'Photo permission is off. Allow access in system settings, then try again.', unsupported: 'Photo capture is unavailable on this device.', unavailable: 'The original photo is unavailable. Download it to your device and try again.', optimization: 'This photo could not be prepared safely. Try a different photo or update the app.', storage: 'The photo could not be saved. Free device storage and try again.' };
        setError(messages[outcome.status]); if (outcome.cleanupPending) setCleanupPending(true);
      }
    },
    removePhoto(id: string) { if (!current.current || busyRef.current) return; if (update({ photos: current.current.photos.filter(p => p.id !== id) }) && retain()) void cleanup(); }
  };
}
