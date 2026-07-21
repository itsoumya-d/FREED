import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inspectFirebaseClientFiles } from "../scripts/firebase-config-audit";

const root = mkdtempSync(join(tmpdir(), "freed-firebase-config-audit-"));
writeFileSync(join(root, "allowed.env"), "EXPO_PUBLIC_FIREBASE_ENV=production\n");
writeFileSync(join(root, "rejected.env"), "EXPO_PUBLIC_FIREBASE_SERVICE_ACCOUNT_JSON=private-key\n");
writeFileSync(join(root, "google-services.json"), '{"project_info":{"project_id":"freed-7d5ee"}}\n');

const report = inspectFirebaseClientFiles(root, ["allowed.env", "rejected.env", "google-services.json"]);

assert.equal(report.ok, false);
assert.deepEqual(report.violations, ["rejected.env: EXPO_PUBLIC_FIREBASE_SERVICE_ACCOUNT_JSON"]);
assert.equal(report.checkedFiles, 3);
console.log("firebase config audit tests passed");
