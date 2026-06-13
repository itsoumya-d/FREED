import "expo-sqlite/localStorage/install";

import React from "react";

import {
  RecoveryState,
  createDefaultRecoveryState,
  hydrateRecoveryState,
  recordAppSessionStart,
  touchRecoveryState
} from "@/lib/recovery-state";
import { safeUserFacingMessage } from "@/lib/user-facing-error";

export const RECOVERY_STORAGE_KEY = "freed.recovery.state.v1";

export function loadRecoveryState(): RecoveryState {
  const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
  if (!raw) return createDefaultRecoveryState();
  return hydrateRecoveryState(JSON.parse(raw));
}

export function saveRecoveryState(state: RecoveryState): void {
  localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(hydrateRecoveryState(state)));
}

export function usePersistentRecoveryState() {
  const [state, setState] = React.useState<RecoveryState>(() => createDefaultRecoveryState());
  const [hydrated, setHydrated] = React.useState(false);
  const [storageError, setStorageError] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const stored = recordAppSessionStart(loadRecoveryState());
      setState(stored);
      saveRecoveryState(stored);
      setStorageError(null);
    } catch (error) {
      setState(recordAppSessionStart(createDefaultRecoveryState()));
      setStorageError(safeUserFacingMessage(error, "Recovery data could not be loaded."));
    } finally {
      setHydrated(true);
    }
  }, []);

  const setRecoveryState = React.useCallback((update: RecoveryState | ((current: RecoveryState) => RecoveryState)) => {
    setState((current) => {
      const nextValue = typeof update === "function" ? update(current) : update;
      const next = touchRecoveryState(hydrateRecoveryState(nextValue));

      try {
        saveRecoveryState(next);
        setStorageError(null);
      } catch (error) {
        setStorageError(safeUserFacingMessage(error, "Recovery data could not be saved."));
      }

      return next;
    });
  }, []);

  return { state, setRecoveryState, hydrated, storageError };
}
