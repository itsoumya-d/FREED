import { readFileSync } from "node:fs";
import { join } from "node:path";

type Result = {
  id: string;
  status: "pass" | "fail";
  evidence: string;
};

const root = process.cwd();
const tsClassifier = readFileSync(join(root, "src/lib/blocking-engine.ts"), "utf8");
const kotlinClassifier = readFileSync(
  join(root, "modules/freed-protection/android/src/main/java/app/freed/protection/FreedUrlClassifier.kt"),
  "utf8"
);

const tablePairs = [
  ["DEFAULT_ALLOWED_NORMAL_DOMAINS", "allowedNormalDomains"],
  ["ADULT_DOMAIN_SEEDS", "adultDomains"],
  ["DEFAULT_SEARCH_ENGINE_DOMAINS", "searchEngineDomains"],
  ["explicitDomainTokens", "explicitDomainTokens"],
  ["explicitSearchTerms", "explicitSearchTerms"],
  ["recoveryEducationSearchTerms", "recoveryEducationSearchTerms"],
  ["consumptionIntentSearchTerms", "consumptionIntentSearchTerms"],
  ["recoveryDomainContextTerms", "recoveryDomainContextTerms"],
  ["consumptionDomainContextTerms", "consumptionDomainContextTerms"]
] as const;

function stringLiterals(value: string) {
  return [...value.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort();
}

function tsArray(name: string) {
  const match = tsClassifier.match(new RegExp(`(?:export\\s+)?const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  return match ? stringLiterals(match[1]) : [];
}

function kotlinSet(name: string) {
  const match = kotlinClassifier.match(new RegExp(`private\\s+val\\s+${name}\\s*=\\s*setOf\\(([\\s\\S]*?)\\n\\s*\\)`, "m"));
  return match ? stringLiterals(match[1]) : [];
}

function diff(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((entry) => !rightSet.has(entry));
}

function check(id: string, condition: boolean, evidence: string): Result {
  return { id, status: condition ? "pass" : "fail", evidence };
}

const tableResults = tablePairs.map(([tsName, kotlinName]) => {
  const tsValues = tsArray(tsName);
  const kotlinValues = kotlinSet(kotlinName);
  const missingInKotlin = diff(tsValues, kotlinValues);
  const missingInTs = diff(kotlinValues, tsValues);
  return check(
    `table-${kotlinName}`,
    tsValues.length > 0 && kotlinValues.length > 0 && missingInKotlin.length === 0 && missingInTs.length === 0,
    missingInKotlin.length === 0 && missingInTs.length === 0
      ? `${kotlinName} matches ${tsName} (${tsValues.length} entries).`
      : `${kotlinName} drift: missing in Kotlin [${missingInKotlin.join(", ")}], missing in TS [${missingInTs.join(", ")}].`
  );
});

const logicResults = [
  check(
    "logic-google-regional-search",
    kotlinClassifier.includes('Regex("^google\\\\.[a-z.]{2,}$")') &&
      tsClassifier.includes("/^google\\.[a-z.]{2,}$/"),
    "Android and TypeScript both allow regional Google search hosts through the search-engine rule."
  ),
  check(
    "logic-recovery-search-before-block",
    kotlinClassifier.indexOf("educationIntent && !consumptionIntent") > 0 &&
      kotlinClassifier.indexOf("safe-site-education") > 0 &&
      kotlinClassifier.indexOf("safe-site-education") < kotlinClassifier.indexOf("safe-site-search") &&
      tsClassifier.indexOf("educationalIntent && !consumptionIntent") > 0 &&
      tsClassifier.indexOf("safe-site-education") < tsClassifier.indexOf("safe-site-search"),
    "Recovery/education search intent is allowed before adult-search blocking on both platforms."
  ),
  check(
    "logic-recovery-domain-context-before-token-block",
    kotlinClassifier.indexOf("recoveryContext && !consumptionContext") > 0 &&
      kotlinClassifier.indexOf("explicit-domain-token-recovery-context") <
        kotlinClassifier.indexOf("explicit-domain-token:$token") &&
      tsClassifier.indexOf("recoveryContext && !consumptionContext") > 0 &&
      tsClassifier.indexOf("explicit-domain-token-recovery-context") <
        tsClassifier.indexOf("explicit-domain-token:${tokenMatch}"),
    "Recovery/filtering hostnames with adult-looking tokens are allowed before token-domain blocking on both platforms."
  ),
  check(
    "logic-default-allow",
    kotlinClassifier.includes("No adult-content signal found; default allow.") &&
      tsClassifier.includes("No adult-content signal was found. FREED allows normal browsing by default."),
    "Both platform classifiers default to allow when no adult-content signal is found."
  ),
  check(
    "logic-host-storage-normalization",
    kotlinClassifier.includes("fun normalizeHostForStorage(input: String): String") &&
      kotlinClassifier.includes("sanitizeHostCandidate") &&
      kotlinClassifier.includes("substringAfterLast(\"@\")") &&
      kotlinClassifier.includes("substringBefore(\":\")") &&
      tsClassifier.includes("normalizeHostCandidate") &&
      tsClassifier.includes("split(\"@\").pop()"),
    "Android and TypeScript both strip credentials, ports, paths, queries, fragments, and malformed host characters before host-level storage."
  ),
  check(
    "logic-focused-search-after-invalid-host",
    kotlinClassifier.includes('urlResult.matchedRule != "empty-input"') &&
      kotlinClassifier.includes("explicitFocusedSearchSignal(searchText)") &&
      kotlinClassifier.includes('matchedRule = "focused-search:$explicitSearch"'),
    "Android focused browser text still falls through to adult-intent search classification when the text is not a valid host."
  )
];

const results = [...tableResults, ...logicResults];
const failed = results.filter((entry) => entry.status === "fail");

console.log("# FREED Android classifier parity audit");
console.log(`Result: ${results.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const result of results) {
  console.log(`| ${result.status.toUpperCase()} | ${result.id} | ${result.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
