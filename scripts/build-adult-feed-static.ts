import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createAdultDomainFeed, DEFAULT_ALLOWED_NORMAL_DOMAINS } from "../src/lib/blocking-engine";

const OISD_NSFW_SMALL = "https://nsfw-small.oisd.nl/";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 8_000_000;

function fnv1aNote(): void {}

async function fetchSourceText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`source returned ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error("source too large");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function parseDomains(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    let value = line.trim().toLowerCase();
    if (!value || value.startsWith("#") || value.startsWith("!") || value.startsWith("//")) continue;
    value = value.split("#")[0].trim();
    const parts = value.split(/\s+/);
    if (["0.0.0.0", "127.0.0.1", "::1"].includes(parts[0])) value = parts[1] ?? "";
    value = value
      .replace(/^\|\|/, "")
      .replace(/^\*\./, "")
      .replace(/^\./, "")
      .split("^")[0]
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split("?")[0]
      .split(":")[0]
      .replace(/^www\./, "")
      .trim();
    if (/^[a-z0-9.-]+$/.test(value) && value.includes(".") && !value.includes("..") && value.length <= 253) {
      out.push(value);
    }
  }
  return out;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const sourceResults: { id: string; label: string; domains: string[] }[] = [];

  try {
    const raw = await fetchSourceText(OISD_NSFW_SMALL);
    const domains = parseDomains(raw);
    if (domains.length < 1000) throw new Error(`oisd feed suspiciously small (${domains.length})`);
    sourceResults.push({ id: "oisd-nsfw", label: "OISD NSFW Small", domains });
    console.log(`oisd-nsfw: ${domains.length} domains`);
  } catch (error) {
    console.warn(`oisd-nsfw fetch failed: ${error instanceof Error ? error.message : error}`);
  }

  const merged = new Set<string>();
  for (const source of sourceResults) for (const d of source.domains) merged.add(d);
  if (merged.size === 0) {
    console.error("No upstream source reachable; refusing to write an empty feed.");
    process.exit(1);
  }

  const feed = createAdultDomainFeed({
    version: `freed-static-${generatedAt.slice(0, 10)}`,
    generatedAt,
    domains: [...merged],
    exceptions: [...DEFAULT_ALLOWED_NORMAL_DOMAINS],
    sources: sourceResults.map((s) => ({ id: s.id, label: s.label, updatedAt: generatedAt }))
  });

  const outDir = join(process.cwd(), "website");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "adult-domain-feed.json"), JSON.stringify(feed));
  console.log(`feed written: ${feed.domains.length} domains, checksum ${feed.checksum}, ${Math.round(JSON.stringify(feed).length / 1024)} KB`);
}

main();
