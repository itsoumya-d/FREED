import { classifyUrl } from "../src/lib/blocking-engine";
import { classifierSafetyCorpus } from "./classifier-safety-corpus";

const results = classifierSafetyCorpus.map((entry) => {
  const result = classifyUrl(entry.url);
  return {
    ...entry,
    actual: result.verdict,
    matchedRule: result.matchedRule,
    status: result.verdict === entry.expected ? "pass" : "fail"
  };
});

const failed = results.filter((entry) => entry.status === "fail");
const groups = [...new Set(results.map((entry) => entry.group))].sort();

console.log("# FREED classifier safety audit");
console.log(`Result: ${results.length - failed.length} pass, ${failed.length} fail`);
console.log(`Groups: ${groups.join(", ")}`);
console.log("");
console.log("| Status | Group | Case | Expected | Actual | Rule |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const entry of results) {
  console.log(
    `| ${entry.status.toUpperCase()} | ${entry.group} | ${entry.id} | ${entry.expected} | ${entry.actual} | ${entry.matchedRule.replace(/\|/g, "/")} |`
  );
}

if (failed.length > 0) {
  process.exitCode = 1;
}
