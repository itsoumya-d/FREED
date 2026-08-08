import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const auditPath = "scripts/firebase-email-link-delivery-audit.js";
assert.equal(existsSync(auditPath), true, "Email-link delivery must have a source-level cold/warm contract audit.");

console.log("firebase email-link delivery audit tests passed");
