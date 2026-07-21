import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inspectFirebasePrivacyDefaults } from "../scripts/firebase-privacy-audit";

const root = mkdtempSync(join(tmpdir(), "freed-firebase-privacy-audit-"));
mkdirSync(join(root, "android/app/src/main"), { recursive: true });
mkdirSync(join(root, "ios/FREED"), { recursive: true });
writeFileSync(join(root, "firebase.json"), JSON.stringify({ "react-native": {} }));
writeFileSync(join(root, "android/app/src/main/AndroidManifest.xml"), "<manifest><application /></manifest>");
writeFileSync(join(root, "ios/FREED/Info.plist"), "<plist><dict /></plist>");
writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { "@react-native-firebase/firestore": "25.1.0" } }));
writeFileSync(join(root, "src-lib.ts"), 'import firestore from "@react-native-firebase/firestore";');

const report = inspectFirebasePrivacyDefaults(root, {
  sourceFiles: ["src-lib.ts"]
});

assert.equal(report.ok, false);
assert.ok(report.violations.some((violation) => violation.includes("app_data_collection_default_enabled")));
assert.ok(report.violations.some((violation) => violation.includes("Android manifest")));
assert.ok(report.violations.some((violation) => violation.includes("iOS Info.plist")));
assert.ok(report.violations.some((violation) => violation.includes("Firestore dependency")));
assert.ok(report.violations.some((violation) => violation.includes("Firestore import")));
console.log("firebase privacy audit tests passed");
