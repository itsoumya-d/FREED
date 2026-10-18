import { formatNumber } from './number-format';
const templateCache = new WeakMap<Record<string, string>, { match: RegExp; names: string[]; translated: string }[]>();
function templates(source: Record<string, string>) {
  let cached = templateCache.get(source);
  if (cached) return cached;
  cached = Object.entries(source).filter(([key]) => key.includes('{{')).map(([key, translated]) => {
    const names: string[] = [];
    const literalContext = key.replace(/\{\{[^{}]+\}\}/g, '');
    const numericContext = /^[\s.,:\/%+\-dhms]+$/i.test(literalContext) && /[dhms%]/i.test(literalContext);
    const pattern = key.split(/(\{\{[^{}]+\}\})/).map(part => {
      if (part.startsWith('{{')) {
        const name = part.slice(2, -2).trim(); names.push(name);
        const numeric = numericContext || /^(?:count|total|days?|hours?|minutes?|seconds?|selectedCount|index|step|percent|completed|target)$/i.test(name);
        return numeric ? '([0-9]+(?:[.,][0-9]+)?)' : '(.*?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return { match: new RegExp(`^${pattern}$`), names, translated };
  });
  templateCache.set(source, cached); return cached;
}
export function translateAuthoredSource(value: string, source: Record<string, string>, depth = 0, language = 'en'): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const ownValue = (key: string) => Object.prototype.hasOwnProperty.call(source, key) ? source[key] : undefined;
  const direct = ownValue(value) ?? ownValue(normalized);
  if (direct) return direct;
  if (depth >= 3 || normalized.length > 800 || /^(?:https?:|freed:)/i.test(normalized)) return value;
  for (const template of templates(source)) {
    const match = template.match.exec(normalized);
    if (!match) continue;
    const values = Object.fromEntries(template.names.map((name, index) => {
      const raw = match[index + 1];
      // Store prices, identifiers and private addresses are opaque data, never authored copy.
      if (/price|productId|url|uri|email|host|domain|token|name|phone|reflection|note|prompt|input|^id$/i.test(name)) return [name, raw];
      if (/^[+-]?\d+(?:\.\d+)?$/.test(raw)) return [name, formatNumber(Number(raw), language, { maximumFractionDigits: 8 })];
      return [name, translateAuthoredSource(raw, source, depth + 1, language)];
    }));
    return template.translated.replace(/\{\{([^{}]+)\}\}/g, (token, name) => values[name.trim()] ?? token);
  }
  return value;
}
