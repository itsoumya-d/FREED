// Test-only Web Storage boundary installed before Expo inspects globals.
// Never read Node's lazy localStorage accessor (it requires --localstorage-file).
const values = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => values.get(String(key)) ?? null,
  setItem: (key, value) => values.set(String(key), String(value)),
  removeItem: key => values.delete(String(key)),
  clear: () => values.clear(),
  key: index => [...values.keys()][index] ?? null,
  get length() { return values.size; },
} });
