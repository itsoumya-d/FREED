import assert from "node:assert/strict";

import { createMigrationManifest, getMigrationPrerequisites, preserveFirebaseUid } from "../scripts/firebase-migration-plan";

async function run() {
  assert.equal(preserveFirebaseUid("550e8400-e29b-41d4-a716-446655440000"), "550e8400-e29b-41d4-a716-446655440000");
  assert.throws(() => preserveFirebaseUid("not-a-uuid"), /UUID/i);
  const manifest = createMigrationManifest([
    { table: "profiles", uid: "550e8400-e29b-41d4-a716-446655440000", rowId: "550e8400-e29b-41d4-a716-446655440000" },
    { table: "recovery_backups", uid: "550e8400-e29b-41d4-a716-446655440000", rowId: "bkp_12345678", encryptedEnvelope: { bytes: 12, sha256: "a".repeat(64) } }
  ]);
  assert.equal(manifest.tables.profiles.count, 1);
  assert.equal(manifest.tables.recovery_backups.encryptedEnvelopeBytes, 12);
  assert.equal(manifest.rows[1]?.firebaseUid, "550e8400-e29b-41d4-a716-446655440000");
  assert.deepEqual(getMigrationPrerequisites({}), ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "verified-export-manifest"]);
  console.log("firebase migration planning tests passed");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
