import { createHash } from "node:crypto";

export type MigrationExportRow = {
  table: string;
  uid: string;
  rowId: string;
  encryptedEnvelope?: { bytes: number; sha256: string };
};

export type MigrationManifest = {
  version: 1;
  mode: "dual-run-precutover";
  generatedAt: string;
  tables: Record<string, { count: number; checksum: string; encryptedEnvelopeBytes: number; encryptedEnvelopeHashes: string[] }>;
  rows: Array<{ table: string; rowId: string; firebaseUid: string; encryptedEnvelope?: { bytes: number; sha256: string } }>;
  idempotencyKey: string;
  requiredPrerequisites: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;

/** Firebase Auth UIDs intentionally preserve the legacy UUID exactly. */
export function preserveFirebaseUid(uid: string): string {
  if (!UUID.test(uid)) throw new Error("A legacy UUID is required to preserve the intended Firebase UID.");
  return uid.toLowerCase();
}

/** This returns names only—credential values are never printed, persisted, or passed to logs. */
export function getMigrationPrerequisites(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  missing.push("verified-export-manifest");
  return missing;
}

/**
 * Builds a deterministic, idempotent import manifest from a separately verified
 * export. Envelope bytes are never parsed or copied into the manifest: only
 * their byte count and SHA-256 are retained for transfer verification.
 */
export function createMigrationManifest(rows: MigrationExportRow[]): MigrationManifest {
  const mapped = rows.map((row) => ({
    table: safeTable(row.table),
    rowId: safeRowId(row.rowId),
    firebaseUid: preserveFirebaseUid(row.uid),
    ...(row.encryptedEnvelope ? { encryptedEnvelope: validateEnvelope(row.encryptedEnvelope) } : {})
  }));
  const tables: MigrationManifest["tables"] = {};
  for (const row of mapped) {
    const current = tables[row.table] ?? { count: 0, checksum: "", encryptedEnvelopeBytes: 0, encryptedEnvelopeHashes: [] };
    current.count += 1;
    current.encryptedEnvelopeBytes += row.encryptedEnvelope?.bytes ?? 0;
    if (row.encryptedEnvelope) current.encryptedEnvelopeHashes.push(row.encryptedEnvelope.sha256);
    tables[row.table] = current;
  }
  for (const [table, summary] of Object.entries(tables)) {
    summary.encryptedEnvelopeHashes.sort();
    summary.checksum = checksum(mapped.filter((row) => row.table === table));
  }
  const idempotencyKey = checksum(mapped);
  return {
    version: 1,
    mode: "dual-run-precutover",
    generatedAt: new Date().toISOString(),
    tables,
    rows: mapped,
    idempotencyKey,
    requiredPrerequisites: ["verified-export-manifest", "Firebase staging project", "billing-enabled deployment target", "reconciled counts and checksums"]
  };
}

function validateEnvelope(value: { bytes: number; sha256: string }) {
  if (!Number.isInteger(value.bytes) || value.bytes < 0 || !SHA256.test(value.sha256)) {
    throw new Error("Encrypted envelope metadata must provide only valid bytes and SHA-256.");
  }
  return { bytes: value.bytes, sha256: value.sha256 };
}

function safeTable(value: string) {
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(value)) throw new Error("Unsafe migration table name.");
  return value;
}

function safeRowId(value: string) {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(value) && !UUID.test(value)) throw new Error("Unsafe migration row identifier.");
  return value;
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

if (process.argv[1]?.endsWith("firebase-migration-plan.ts")) {
  const missing = getMigrationPrerequisites(process.env);
  console.log(JSON.stringify({
    mode: "planning-only",
    canExport: missing.length === 1 && missing[0] === "verified-export-manifest",
    missingPrerequisites: missing,
    statement: "No credentials, source data, or envelopes were read. Actual export/import remains disabled until a verified export, staging target, reconciliation, and cutover approval exist."
  }, null, 2));
}
