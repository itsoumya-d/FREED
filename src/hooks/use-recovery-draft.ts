import "expo-sqlite/localStorage/install";
import React from "react";
import { useOwnerPrivateDraftStorage } from '@/lib/owner-private-drafts';
import {
  clearRecoveryDraft,
  loadRecoveryDraft,
  saveRecoveryDraft,
  type RecoveryDraftKind,
  type RecoveryDraftStorage,
  type RecoveryDraftValues
} from "@/lib/recovery-drafts";

type DraftSession<K extends RecoveryDraftKind> = {
  scope: string;
  storage: RecoveryDraftStorage;
  value: RecoveryDraftValues[K];
  restored: boolean;
  committed: boolean;
  error: string | null;
  retryKind: 'load' | 'write' | null;
  identity: object;
};

/** Changes synchronously retain private scratch space; only Save can mutate history. */
export function useRecoveryDraft<K extends RecoveryDraftKind>(kind: K, initial: RecoveryDraftValues[K], options: {
  dateKey?: string;
  ownerId?: string | null;
  storage?: RecoveryDraftStorage;
} = {}) {
  const ownerContext = useOwnerPrivateDraftStorage();
  const storage = options.storage ?? ownerContext?.storage ?? localStorage;
  const ownerId = options.ownerId ?? ownerContext?.ownerId ?? null;
  const scope = `${kind}:${options.dateKey ?? ""}:${ownerId ?? ""}`;
  const read = (): DraftSession<K> => {
    try {
      const loaded = loadRecoveryDraft(storage, kind, options.dateKey);
      const value = kind === 'coach' && loaded && (loaded as RecoveryDraftValues['coach']).ownerUid !== ownerId ? null : loaded;
      return { scope, storage, value: value ?? initial, restored: value !== null, committed: false, error: null, retryKind: null, identity: {} };
    } catch {
      return { scope, storage, value: initial, restored: false, committed: false, retryKind: 'load', identity: {},
        error: "Your draft could not be loaded. Check device storage and try again." };
    }
  };
  const [session, setSession] = React.useState(read);
  const current = React.useRef(session);
  const savedReceipt = React.useRef<{ result: unknown } | null>(null);
  const mounted = React.useRef(true);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // A new calendar day gets a new form before any event can write yesterday's fields.
  if (session.scope !== scope || session.storage !== storage) {
    const next = read();
    current.current = next;
    savedReceipt.current = null;
    setSession(next);
  }

  const update = React.useCallback((change: RecoveryDraftValues[K] | ((value: RecoveryDraftValues[K]) => RecoveryDraftValues[K])) => {
    const previous = current.current;
    if (previous.committed || previous.scope !== scope || previous.storage !== storage) return;
    const value = typeof change === "function" ? change(previous.value) : change;
    let error: string | null = null;
    try { saveRecoveryDraft(storage, kind, value, options.dateKey); }
    catch { error = "Your draft could not be kept on this device. Free up space and try again before leaving."; }
    const next: DraftSession<K> = { ...previous, value, error, retryKind: error ? 'write' : null };
    current.current = next;
    setSession(next);
  }, [storage, kind, options.dateKey, scope]);

  // A stale callback may share an owner name after A→B→A. Bind storage recovery
  // to this mounted draft session, then avoid replacing edits made during read.
  const retryIdentity = current.current.identity;
  const retryStorage = () => {
    const previous = current.current;
    if (!mounted.current || previous.committed || previous.scope !== scope || previous.storage !== storage || previous.identity !== retryIdentity) return false;
    if (previous.retryKind === 'write') { update(previous.value); return current.current.error === null; }
    if (previous.retryKind !== 'load') return false;
    const next = { ...read(), identity: previous.identity };
    if (!mounted.current || current.current !== previous) return false;
    current.current = next;
    setSession(next);
    return next.error === null;
  };

  const save = React.useCallback(<Result,>(commit: (value: RecoveryDraftValues[K]) => Result): { ok: true; result: Result } | { ok: false } => {
    if (current.current.scope !== scope || current.current.storage !== storage) return { ok: false };
    if (!savedReceipt.current) {
      try { savedReceipt.current = { result: commit(current.current.value) }; }
      catch {
        const next = { ...current.current, retryKind: null, error: "This entry could not be saved. Your changes are still here. Free up space and try again." };
        current.current = next;
        setSession(next);
        return { ok: false };
      }
    }
    try { clearRecoveryDraft(storage, kind); }
    catch {
      const next = { ...current.current, committed: true, retryKind: null,
        error: "Saved locally. Draft cleanup could not finish. Check device storage and try Save again." };
      current.current = next;
      setSession(next);
      return { ok: false };
    }
    const result = savedReceipt.current.result as Result;
    // Keep the receipt for this mounted form, including a second tap before navigation commits.
    const next = { ...current.current, restored: false, committed: true, error: null, retryKind: null };
    current.current = next;
    setSession(next);
    return { ok: true, result };
  }, [storage, kind, scope]);

  return { value: session.value, restored: session.restored, committed: session.committed, error: session.error,
    notice: session.restored ? "Draft restored. Your history changes when you save." : "Your draft stays on this device until you save.",
    update, save, retryStorage };
}
