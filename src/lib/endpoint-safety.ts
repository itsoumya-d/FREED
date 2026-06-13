export type EndpointSafetyIssue = {
  label: string;
  issue: string;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::", "::1"]);
const PLACEHOLDER_HOSTS = new Set(["example.com", "example.net", "example.org"]);
const RESERVED_TLDS = [".example", ".invalid", ".localhost", ".test"];

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

function isPrivateOrReservedIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const octets = match.slice(1).map((part) => Number.parseInt(part, 10));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;

  const [first, second, third] = octets;
  return (
    first === 10 ||
    first === 0 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isPrivateOrReservedIpv6(hostname: string): boolean {
  if (!hostname.includes(":")) return false;
  return (
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe8") ||
    hostname.startsWith("fe9") ||
    hostname.startsWith("fea") ||
    hostname.startsWith("feb") ||
    hostname.startsWith("ff") ||
    hostname.startsWith("2001:db8")
  );
}

function isPlaceholderHost(hostname: string): boolean {
  return (
    [...PLACEHOLDER_HOSTS].some((host) => hostname === host || hostname.endsWith(`.${host}`)) ||
    RESERVED_TLDS.some((suffix) => hostname.endsWith(suffix)) ||
    hostname.includes("your-deployed-origin") ||
    hostname.includes("your-") ||
    hostname.includes("placeholder") ||
    hostname.includes("changeme") ||
    hostname.includes("sample") ||
    hostname.includes("todo")
  );
}

export function getProductionEndpointIssues(endpoint: string | null | undefined, label: string): EndpointSafetyIssue[] {
  const value = endpoint?.trim();
  if (!value) return [{ label, issue: "is not configured" }];

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return [{ label, issue: "is not a valid URL" }];
  }

  const issues: EndpointSafetyIssue[] = [];
  const hostname = normalizeHostname(parsed.hostname);
  if (parsed.protocol !== "https:") issues.push({ label, issue: "must use HTTPS" });
  if (parsed.username || parsed.password) issues.push({ label, issue: "must not include URL credentials" });
  if (LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) issues.push({ label, issue: "must not point to a local development host" });
  if (isPrivateOrReservedIpv4(hostname) || isPrivateOrReservedIpv6(hostname)) issues.push({ label, issue: "must not point to a private or reserved network address" });
  if (isPlaceholderHost(hostname)) issues.push({ label, issue: "must not use a placeholder or documentation host" });
  if (!parsed.pathname || parsed.pathname === "/") issues.push({ label, issue: "must include a concrete API route path" });
  if (parsed.search) issues.push({ label, issue: "must not include query strings" });
  if (parsed.hash) issues.push({ label, issue: "must not include URL fragments" });
  return issues;
}

export function getProductionBaseUrlIssues(baseUrl: string | null | undefined, label: string): EndpointSafetyIssue[] {
  const value = baseUrl?.trim();
  if (!value) return [{ label, issue: "is not configured" }];

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return [{ label, issue: "is not a valid URL" }];
  }

  const issues = getProductionEndpointIssues(value, label).filter(
    (entry) => entry.issue !== "must include a concrete API route path"
  );
  if (parsed.pathname && parsed.pathname !== "/") {
    issues.push({ label, issue: "must be an origin without a path" });
  }
  return issues;
}

export function formatEndpointIssues(issues: EndpointSafetyIssue[]): string[] {
  return issues.map((entry) => `${entry.label} ${entry.issue}`);
}
