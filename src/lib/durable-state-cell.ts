/** A synchronous persistence boundary; React scheduling cannot delay the save. */
export function createDurableStateCell<T>(initial: T, persist: (value: T) => void, normalize: (value: T) => T = value => value) {
  let current = initial;
  return {
    read: () => current,
    replaceInMemory(value: T) { current = value; return current; },
    commit(update: T | ((value: T) => T)) {
      const next = normalize(typeof update === 'function' ? (update as (value: T) => T)(current) : update);
      persist(next);
      current = next;
      return next;
    }
  };
}
