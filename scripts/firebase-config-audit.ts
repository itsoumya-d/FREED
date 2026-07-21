import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PUBLIC_FIREBASE_SECRET_KEY = /^EXPO_PUBLIC_(?:FIREBASE|GOOGLE)_[A-Z0-9_]*(?:SERVICE_ACCOUNT|ADMIN|PRIVATE_KEY|SERVER_KEY|ACCESS_TOKEN|APPLICATION_CREDENTIALS|CREDENTIAL)[A-Z0-9_]*$/;

export type FirebaseConfigAuditReport = {
  ok: boolean;
  checkedFiles: number;
  violations: string[];
};

export function inspectFirebaseClientFiles(root: string, paths: string[]): FirebaseConfigAuditReport {
  const violations: string[] = [];
  let checkedFiles = 0;

  for (const path of paths) {
    const absolutePath = join(root, path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue;
    checkedFiles += 1;
    const source = readFileSync(absolutePath, "utf8");
    for (const key of publicFirebaseSecretKeys(source)) {
      violations.push(`${relative(root, absolutePath)}: ${key}`);
    }
  }

  return { ok: violations.length === 0, checkedFiles, violations: Array.from(new Set(violations)).sort() };
}

function publicFirebaseSecretKeys(source: string) {
  const keys = new Set<string>();
  for (const match of source.matchAll(/\bEXPO_PUBLIC_(?:FIREBASE|GOOGLE)_[A-Z0-9_]+\b/g)) {
    if (PUBLIC_FIREBASE_SECRET_KEY.test(match[0])) keys.add(match[0]);
  }
  return keys;
}

function main() {
  const root = process.cwd();
  const report = inspectFirebaseClientFiles(root, [
    ".env.example",
    ".env.production.example",
    "app.config.js",
    "app.json",
    "eas.json",
    "firebase.json",
    "src/lib/firebase-client.ts",
    "src/lib/firebase-native.ts",
    "src/features/freed-app.tsx",
    "android/app/google-services.json",
    "ios/FREED/GoogleService-Info.plist"
  ]);

  console.log("# Firebase client configuration audit");
  console.log(`Result: ${report.ok ? "pass" : "fail"}`);
  console.log(`Files checked: ${report.checkedFiles}`);
  if (report.violations.length > 0) {
    console.log("Public Firebase credential violations:");
    for (const violation of report.violations) console.log(`- ${violation}`);
    process.exitCode = 1;
  }
}

// `run-ts-entry.js` compiles this file as an isolated CommonJS module, so its
// `require.main` is the runner rather than this source file. Inspect argv to
// retain normal import safety while making the npm audit command executable.
if (process.argv[1]?.endsWith("firebase-config-audit.ts")) main();
