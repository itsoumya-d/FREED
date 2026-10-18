function compileTokenProfiles(source) {
  const raw = {};
  function flatten(node, prefix = '') {
    if (!node || typeof node !== 'object') return;
    if (Object.hasOwn(node, '$value')) { raw[prefix] = node.$value; return; }
    for (const [key, value] of Object.entries(node)) if (!key.startsWith('$')) flatten(value, prefix ? `${prefix}.${key}` : key);
  }
  flatten(source);
  const definitions = source.$extensions?.['org.mobile-native']?.profiles ?? { base: { overrides: {} } };
  const overrides = {};
  function inheritance(name, pending = new Set()) {
    if (overrides[name]) return overrides[name];
    if (pending.has(name)) throw new Error(`Cyclic profile: ${name}`);
    if (!definitions[name]) throw new Error(`Unknown profile: ${name}`);
    pending.add(name);
    const parent = definitions[name].extends;
    const result = { ...(parent ? inheritance(parent, pending) : {}), ...definitions[name].overrides };
    pending.delete(name); overrides[name] = result; return result;
  }
  const profiles = {};
  for (const name of Object.keys(definitions).sort()) {
    const values = { ...raw, ...inheritance(name) }, resolved = {};
    function token(key, pending = new Set()) {
      if (Object.hasOwn(resolved, key)) return resolved[key];
      if (!Object.hasOwn(values, key)) throw new Error(`Unknown token: ${key}`);
      if (pending.has(key)) throw new Error(`Cyclic token: ${key}`);
      pending.add(key);
      const value = resolveValue(values[key], pending);
      pending.delete(key); resolved[key] = value; return value;
    }
    function resolveValue(value, pending) {
      if (typeof value === 'string') { const alias = value.match(/^\{([^}]+)\}$/); return alias ? token(alias[1], pending) : value; }
      if (Array.isArray(value)) return value.map(item => resolveValue(item, pending));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item, pending)]));
      return value;
    }
    profiles[name] = Object.fromEntries(Object.keys(values).sort().map(key => [key, token(key)]));
  }
  return { profiles, paths: Object.keys(raw).sort() };
}
module.exports = { compileTokenProfiles };
