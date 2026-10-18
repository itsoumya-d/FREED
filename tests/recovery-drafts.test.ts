import assert from "node:assert/strict";
import {
  RECOVERY_DRAFT_LIMITS,
  RECOVERY_DRAFT_STORAGE_KEYS,
  RECOVERY_TOOL_SESSION_STORAGE_KEYS,
  clearRecoveryDraft,
  loadRecoveryDraft,
  purgeRecoveryDrafts,
  saveRecoveryDraft,
  type RecoveryDraftStorage
} from "../src/lib/recovery-drafts";
import { PROTECTION_INTENT_STORAGE_KEY } from "../src/lib/protection-intent-storage";
import { PREFERENCES_STORAGE_KEY } from "../src/lib/app-preferences";
import { createDefaultRecoveryState } from "../src/lib/recovery-state";

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: RecoveryDraftStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); }
  };
  return { values, storage };
}

const { storage, values } = memoryStorage();
const checkin = { mood: "stressed" as const, urgeLevel: 5, sleepQuality: 1, reflection: "  ನನ್ನ ಮಾತು\n私の記録  " };
const slip = { trigger: "Stress", note: "  Keep my spacing\nand words.  " };
const custom = { title: "  My reset  ", why: "私の理由", category: "reflection" as const, intensity: "calm" as const, durationSec: 180, steps: [" one ", "two\nlines", "", ""] };
saveRecoveryDraft(storage, "checkin", checkin, "2026-10-03");
saveRecoveryDraft(storage, "slip", slip);
saveRecoveryDraft(storage, "custom", custom);

// A fresh reader has only durable device storage, as after navigation or restart.
const restarted: RecoveryDraftStorage = { ...storage };
assert.deepEqual(loadRecoveryDraft(restarted, "checkin", "2026-10-03"), checkin);
assert.deepEqual(loadRecoveryDraft(restarted, "slip"), slip);
assert.deepEqual(loadRecoveryDraft(restarted, "custom"), custom);
assert.equal(values.size, 3, "there is at most one retained draft per form");
saveRecoveryDraft(storage, "slip", { ...slip, note: "replacement" });
assert.equal(values.size, 3);
assert.equal(loadRecoveryDraft(storage, "slip")?.note, "replacement");

// Draft retention is separate from the recovery history, analytics and backups.
const history = createDefaultRecoveryState();
assert.equal(history.dailyCheckIns.length, 0);
assert.equal(history.relapseRecords.length, 0);
assert.equal(history.customChallenges.length, 0);
assert.ok([...values.keys()].every(key => Object.values(RECOVERY_DRAFT_STORAGE_KEYS).includes(key)));

assert.equal(loadRecoveryDraft(storage, "checkin", "2026-10-04"), null, "yesterday's entry never becomes today's draft");
saveRecoveryDraft(storage, "checkin", { ...checkin, mood: "energized" }, "2026-10-04");
assert.equal(loadRecoveryDraft(storage, "checkin", "2026-10-03"), null);
assert.equal(loadRecoveryDraft(storage, "checkin", "2026-10-04")?.mood, "energized");

for (const raw of ["not json", "null", "[]", JSON.stringify({ version: 2, kind: "slip", value: slip }), JSON.stringify({ version: 1, kind: "checkin", value: slip }), JSON.stringify({ version: 1, kind: "slip", value: { trigger: 4, note: "text" } }), "x".repeat(50_000)]) {
  values.set(RECOVERY_DRAFT_STORAGE_KEYS.slip, raw);
  assert.equal(loadRecoveryDraft(storage, "slip"), null, "corrupt or oversized data uses the form's safe defaults");
}
values.set(RECOVERY_DRAFT_STORAGE_KEYS.slip, JSON.stringify({ version: 1, kind: "slip", value: slip, unknownMetadata: "x".repeat(70_000) }));
assert.equal(loadRecoveryDraft(storage, "slip"), null, "a large valid JSON envelope is rejected before restoration");
values.set(RECOVERY_DRAFT_STORAGE_KEYS.checkin, JSON.stringify({ version: 1, kind: "checkin", dateKey: "2026-02-30", value: checkin }));
assert.equal(loadRecoveryDraft(storage, "checkin", "2026-02-30"), null);
for (const patch of [{ mood: "invalid" }, { urgeLevel: 7 }, { urgeLevel: 1.5 }, { sleepQuality: 0 }, { reflection: "x".repeat(RECOVERY_DRAFT_LIMITS.reflection + 1) }]) {
  assert.throws(() => saveRecoveryDraft(storage, "checkin", { ...checkin, ...patch } as typeof checkin, "2026-10-03"));
}
assert.throws(() => saveRecoveryDraft(storage, "custom", { ...custom, steps: [...custom.steps, "fifth"] }));
assert.throws(() => saveRecoveryDraft(storage, "custom", { ...custom, durationSec: 3600 }));
saveRecoveryDraft(storage, "slip", { trigger: "", note: "x".repeat(RECOVERY_DRAFT_LIMITS.note) });
assert.equal(loadRecoveryDraft(storage, "slip")?.note.length, RECOVERY_DRAFT_LIMITS.note);
saveRecoveryDraft(storage, "custom", { ...custom, why: "\u0001".repeat(RECOVERY_DRAFT_LIMITS.why), steps: Array.from({ length: 4 }, () => "\u0001".repeat(RECOVERY_DRAFT_LIMITS.step)) });
assert.equal(loadRecoveryDraft(storage, "custom")?.why, "\u0001".repeat(RECOVERY_DRAFT_LIMITS.why), "JSON escaping must not reduce the advertised field limit");

const fullDisk: RecoveryDraftStorage = { ...storage, setItem: () => { throw new Error("disk full"); } };
assert.throws(() => saveRecoveryDraft(fullDisk, "slip", slip), /disk full/);
assert.equal(loadRecoveryDraft(storage, "slip")?.note.length, RECOVERY_DRAFT_LIMITS.note, "failed writes retain the last durable draft");
assert.throws(() => loadRecoveryDraft({ ...storage, getItem: () => { throw new Error("unreadable"); } }, "slip"), /unreadable/);

clearRecoveryDraft(storage, "slip");
assert.equal(loadRecoveryDraft(storage, "slip"), null);
saveRecoveryDraft(storage, "slip", slip);
const preferences = JSON.stringify({ themeMode: "dark", language: "ja", companionMotion: "off" });
values.set(PREFERENCES_STORAGE_KEY, preferences);
values.set(PROTECTION_INTENT_STORAGE_KEY, "websites");
purgeRecoveryDrafts(storage);
assert.ok(Object.values(RECOVERY_DRAFT_STORAGE_KEYS).every(key => !values.has(key)));
assert.equal(values.has(PROTECTION_INTENT_STORAGE_KEY), false, "Explicit local-data deletion clears a retained setup handoff intent.");
assert.equal(values.get(PREFERENCES_STORAGE_KEY), preferences, "Independent Language, Theme and motion choices survive local recovery cleanup.");
saveRecoveryDraft(storage, "slip", slip);
values.set(PROTECTION_INTENT_STORAGE_KEY, "apps");
for (const key of Object.values(RECOVERY_TOOL_SESSION_STORAGE_KEYS)) values.set(key, "retained exercise receipt");
const beforeFailedPurge = [...values.entries()];
const attempted: string[] = [];
assert.throws(() => purgeRecoveryDrafts({ ...storage, removeItem: key => { attempted.push(key); throw new Error("locked"); } }));
assert.deepEqual([...values.entries()], beforeFailedPurge, "Failed removal attempts do not mutate durable drafts, tool receipts, intent or independent preferences.");
assert.equal(values.get(PREFERENCES_STORAGE_KEY), preferences, "Failed cleanup does not mutate retained preferences.");
assert.deepEqual(attempted.sort(), [PROTECTION_INTENT_STORAGE_KEY, ...Object.values(RECOVERY_DRAFT_STORAGE_KEYS), ...Object.values(RECOVERY_TOOL_SESSION_STORAGE_KEYS)].sort(), "purge tries every form even if one removal fails");

console.log("Recovery drafts: restart, exact input, schema bounds, day rollover, storage failures and explicit purge passed.");
