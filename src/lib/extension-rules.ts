export const MAX_EXTENSION_STATIC_RULES = 25_000;

export type ExtensionRuleAction = "redirect" | "block";

export type ExtensionStaticRule = {
  id: number;
  priority: number;
  action:
    | { type: "block" }
    | { type: "redirect"; redirect: { extensionPath: string } };
  condition: {
    requestDomains: string[];
    resourceTypes: string[];
  };
};

export type CompiledExtensionRules = {
  version: string;
  checksum: string;
  generatedAt: string;
  domainCount: number;
  ruleCount: number;
  rules: ExtensionStaticRule[];
  truncated: boolean;
};

const BLOCKED_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "stylesheet",
  "script",
  "image",
  "font",
  "object",
  "xmlhttprequest",
  "ping",
  "media",
  "websocket",
  "webtransport",
  "webbundle",
  "other"
];

const INTERSTITIAL_PATH = "/blocked/index.html";

function normalizeDomain(input: string): string | null {
  let value = String(input ?? "")
    .trim()
    .toLowerCase();

  if (!value || value.startsWith("#") || value.startsWith("!") || value.startsWith("//")) return null;
  value = value.split("#")[0].trim();
  if (!value) return null;

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts[0] === "0.0.0.0" || parts[0] === "127.0.0.1" || parts[0] === "::1") {
    value = parts[1] ?? "";
  }

  value = value
    .replace(/^\|\|/, "")
    .replace(/^\*\./, "")
    .replace(/^\./, "")
    .split("^")[0]
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .split(":")[0]
    .replace(/^www\./, "");

  if (!/^[a-z0-9.-]+$/.test(value)) return null;
  if (!value.includes(".") || value.includes("..") || value.length > 253) return null;
  const labels = value.split(".");
  if (labels.some((label) => !label || label.length > 63 || label.startsWith("-") || label.endsWith("-"))) return null;

  return value;
}

function fnv1aHex(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Compiles the reviewed adult-domain feed into Chrome MV3 declarativeNetRequest
 * static rules. One rule per domain using `requestDomains`, which matches the
 * domain and all of its subdomains — the same suffix semantics as the app-side
 * classifier feed. Rules are hard-capped below Chrome's guaranteed minimum of
 * 30k enabled static rules so enabling this ruleset can never fail.
 */
export function compileExtensionRules(
  domainsInput: readonly string[],
  options: { generatedAt?: Date; maxRules?: number } = {}
): CompiledExtensionRules {
  const maxRules = options.maxRules ?? MAX_EXTENSION_STATIC_RULES;
  const seen = new Set<string>();
  const domains: string[] = [];

  for (const raw of domainsInput) {
    const domain = normalizeDomain(raw);
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    domains.push(domain);
  }

  domains.sort();

  const truncated = domains.length > maxRules;
  const selectedDomains = truncated ? domains.slice(0, maxRules) : domains;

  const rules: ExtensionStaticRule[] = selectedDomains.map((domain, index) => ({
    id: index + 1,
    priority: 20,
    action: {
      type: "redirect",
      redirect: { extensionPath: INTERSTITIAL_PATH }
    },
    condition: {
      requestDomains: [domain],
      resourceTypes: BLOCKED_RESOURCE_TYPES
    }
  }));

  const checksumSource = `${selectedDomains.join("\n")}\n--extension-rules-v2-adult-priority--`;
  const version = `freed-ext-${options.generatedAt?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)}-${checksumFeedShort(checksumSource)}`;

  return {
    version,
    checksum: fnv1aHex(checksumSource),
    generatedAt: (options.generatedAt ?? new Date()).toISOString(),
    domainCount: selectedDomains.length,
    ruleCount: rules.length,
    rules,
    truncated
  };
}

function checksumFeedShort(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}
