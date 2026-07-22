import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const firebasePaths = [
  "functions/src",
  "src/lib/firebase-client.ts",
  "src/lib/firebase-native.ts",
  "scripts/firebase-migration-plan.ts"
];
const forbiddenRuntime = /(?:from\s+["'](?:@supabase|upstash)|require\(["'](?:@supabase|upstash)|https?:\/\/[^\s"']*(?:supabase|upstash))/i;

function audit(path: string) {
  const source = readFileSync(resolve(process.cwd(), path), "utf8");
  if (forbiddenRuntime.test(source)) throw new Error(`New Firebase path must not add Supabase or Upstash runtime access: ${path}`);
}

function auditTree(path: string) {
  const absolute = resolve(process.cwd(), path);
  if (statSync(absolute).isFile()) return audit(path);
  for (const entry of readdirSync(absolute)) auditTree(`${path}/${entry}`);
}

for (const path of firebasePaths) auditTree(path);
console.log("firebase runtime boundary audit passed: legacy Supabase/Upstash remains permitted only until the documented cutover gate.");
