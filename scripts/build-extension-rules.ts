import { writeFileSync } from "node:fs";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ADULT_DOMAIN_SEEDS } from "../src/lib/blocking-engine";
import { compileExtensionRules } from "../src/lib/extension-rules";

const outputDir = join(process.cwd(), "extension", "rules");

const feedArgIndex = process.argv.indexOf("--feed");
let domains: readonly string[] = ADULT_DOMAIN_SEEDS;
if (feedArgIndex > 0 && process.argv[feedArgIndex + 1]) {
  const parsed = JSON.parse(readFileSync(process.argv[feedArgIndex + 1], "utf8")) as { domains?: unknown };
  if (!Array.isArray(parsed.domains)) {
    console.error("Feed file must contain a `domains` array.");
    process.exit(1);
  }
  domains = parsed.domains.filter((item): item is string => typeof item === "string");
}

const compiled = compileExtensionRules(domains);

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "adult-blocklist.json"),
  `${JSON.stringify(compiled.rules, null, 2)}\n`
);

writeFileSync(
  join(outputDir, "metadata.json"),
  `${JSON.stringify(
    {
      version: compiled.version,
      checksum: compiled.checksum,
      generatedAt: compiled.generatedAt,
      domainCount: compiled.domainCount,
      ruleCount: compiled.ruleCount,
      truncated: compiled.truncated,
      maxStaticRules: 25_000
    },
    null,
    2
  )}\n`
);

console.log(
  `FREED extension rules: ${compiled.domainCount} domains -> ${compiled.ruleCount} rules (${compiled.checksum})${compiled.truncated ? " [TRUNCATED]" : ""}`
);
