/** Async work belongs to the account that started it, even after sign-out. */
export function createAccountOperationGate(readScope: () => string | null) {
  let generation = 0;
  return {
    invalidate() { generation += 1; },
    begin() {
      const epoch = generation;
      let scope = readScope();
      let cancelled = false;
      const isCurrent = () => !cancelled && epoch === generation && readScope() === scope;
      return {
        isCurrent,
        cancel() { cancelled = true; },
        /** Only a new guest created for this protected action may be adopted. */
        bindCreatedGuest(isAnonymous: boolean) {
          if (cancelled || epoch !== generation) return false;
          const next = readScope();
          if (scope === null && next !== null && isAnonymous) scope = next;
          return isCurrent();
        },
        assertCurrent() { if (!isCurrent()) throw new Error('The recovery account changed. Try this action again.'); }
      };
    }
  };
}
