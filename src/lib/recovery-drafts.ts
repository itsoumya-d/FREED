import type { CustomChallengeInput, DailyCheckInInput } from "./recovery-state";

/** Private form scratch space. These keys never enter RecoveryState or remote backups. */
export const RECOVERY_DRAFT_STORAGE_KEYS = {
  checkin: "freed.recovery.draft.checkin.v1",
  journal: "freed.recovery.draft.journal.v1",
  coach: "freed.recovery.draft.coach.v1",
  slip: "freed.recovery.draft.slip.v1",
  custom: "freed.recovery.draft.custom.v1"
} as const;

export const RECOVERY_TOOL_SESSION_STORAGE_KEYS = { breathing: "freed.recovery.breathing-session.v1" } as const;

export const RECOVERY_DRAFT_LIMITS = { reflection: 4000, note: 4000, trigger: 64, title: 256, why: 4000, step: 1000, steps: 4 } as const;
// JSON may escape each entered character into six bytes; allow every field at its limit.
const MAX_SERIALIZED_LENGTH = 60000;
export type RecoveryDraftKind = keyof typeof RECOVERY_DRAFT_STORAGE_KEYS;
export type RecoveryDraftValues = {
  checkin: DailyCheckInInput & { reflection: string };
  journal: { reflection: string };
  coach: { text: string; ownerUid: string | null };
  slip: { trigger: string; note: string };
  custom: CustomChallengeInput;
};
export type RecoveryDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function text(value: unknown, limit: number): value is string {
  return typeof value === "string" && value.length <= limit;
}
function whole(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
function validDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalize<K extends RecoveryDraftKind>(kind: K, value: unknown): RecoveryDraftValues[K] | null {
  if (!isRecord(value)) return null;
  let safe: RecoveryDraftValues[RecoveryDraftKind];
  if (kind === "checkin") {
    if (!(value.mood === null || ["low", "steady", "energized", "stressed"].includes(value.mood as string))
      || !(value.urgeLevel === null || whole(value.urgeLevel, 0, 5)) || !(value.sleepQuality === null || whole(value.sleepQuality, 1, 5))
      || !text(value.reflection, RECOVERY_DRAFT_LIMITS.reflection)) return null;
    safe = { mood: value.mood as DailyCheckInInput["mood"], urgeLevel: value.urgeLevel as number | null, sleepQuality: value.sleepQuality as number | null, reflection: value.reflection };
  } else if (kind === "journal") {
    if (!text(value.reflection, RECOVERY_DRAFT_LIMITS.reflection)) return null;
    safe = { reflection: value.reflection };
  } else if (kind === 'coach') {
    if (!text(value.text,4000) || !(value.ownerUid === null || (typeof value.ownerUid === 'string' && value.ownerUid.length > 0 && value.ownerUid.length <= 128))) return null;
    safe = {text:value.text,ownerUid:value.ownerUid as string|null};
  } else if (kind === "slip") {
    if (!text(value.trigger, RECOVERY_DRAFT_LIMITS.trigger) || !text(value.note, RECOVERY_DRAFT_LIMITS.note)) return null;
    safe = { trigger: value.trigger, note: value.note };
  } else {
    if (!text(value.title, RECOVERY_DRAFT_LIMITS.title) || !text(value.why, RECOVERY_DRAFT_LIMITS.why)
      || !["physical", "breathing", "reflection", "connection", "reset"].includes(value.category as string)
      || !["calm", "medium", "strong"].includes(value.intensity as string) || !whole(value.durationSec, 60, 900)
      || !Array.isArray(value.steps) || value.steps.length !== RECOVERY_DRAFT_LIMITS.steps
      || !value.steps.every(step => text(step, RECOVERY_DRAFT_LIMITS.step))) return null;
    safe = { title: value.title, why: value.why, category: value.category as CustomChallengeInput["category"],
      intensity: value.intensity as CustomChallengeInput["intensity"], durationSec: value.durationSec, steps: [...value.steps] };
  }
  return safe as RecoveryDraftValues[K];
}

/** Invalid records fall back to form defaults. Storage access errors remain observable. */
export function loadRecoveryDraft<K extends RecoveryDraftKind>(storage: RecoveryDraftStorage, kind: K, dateKey?: string): RecoveryDraftValues[K] | null {
  const raw = storage.getItem(RECOVERY_DRAFT_STORAGE_KEYS[kind]);
  if (!raw || raw.length > MAX_SERIALIZED_LENGTH) return null;
  let envelope: unknown;
  try { envelope = JSON.parse(raw); } catch { return null; }
  if (!isRecord(envelope) || envelope.version !== 1 || envelope.kind !== kind) return null;
  if ((kind === "checkin" || kind === "journal") && (!validDateKey(dateKey) || envelope.dateKey !== dateKey)) return null;
  return normalize(kind, envelope.value);
}

/** Recover the dated scratch form after midnight without treating it as a historical record. */
export function getRetainedCheckInDraftDate(storage: RecoveryDraftStorage, todayKey: string): string {
  try {
    const raw = storage.getItem(RECOVERY_DRAFT_STORAGE_KEYS.checkin);
    if (!raw || raw.length > MAX_SERIALIZED_LENGTH) return todayKey;
    const envelope: unknown = JSON.parse(raw);
    if (!isRecord(envelope) || !validDateKey(envelope.dateKey) || String(envelope.dateKey) > todayKey) return todayKey;
    return loadRecoveryDraft(storage, 'checkin', String(envelope.dateKey)) ? String(envelope.dateKey) : todayKey;
  } catch { return todayKey; }
}

export function saveRecoveryDraft<K extends RecoveryDraftKind>(storage: RecoveryDraftStorage, kind: K, value: RecoveryDraftValues[K], dateKey?: string): void {
  const safe = normalize(kind, value);
  if (!safe || ((kind === "checkin" || kind === "journal") && !validDateKey(dateKey))) throw new RangeError("recovery-draft-invalid");
  const raw = JSON.stringify({ version: 1, kind, ...((kind === "checkin" || kind === "journal") ? { dateKey } : {}), value: safe });
  if (raw.length > MAX_SERIALIZED_LENGTH) throw new RangeError("recovery-draft-too-large");
  storage.setItem(RECOVERY_DRAFT_STORAGE_KEYS[kind], raw);
}

export function clearRecoveryDraft(storage: RecoveryDraftStorage, kind: RecoveryDraftKind): void {
  storage.removeItem(RECOVERY_DRAFT_STORAGE_KEYS[kind]);
}

/** Explicit local-data deletion must try every key and must report any failed erasure. */
export function purgeRecoveryDrafts(storage: RecoveryDraftStorage): void {
  let failed = false;
  try { storage.removeItem("freed.protection.setup.intent.v1"); } catch { failed = true; }
  for (const kind of Object.keys(RECOVERY_DRAFT_STORAGE_KEYS) as RecoveryDraftKind[]) {
    try { clearRecoveryDraft(storage, kind); } catch { failed = true; }
  }
  for (const key of Object.values(RECOVERY_TOOL_SESSION_STORAGE_KEYS)) {
    try { storage.removeItem(key); } catch { failed = true; }
  }
  if (failed) throw new Error("recovery-draft-purge-failed");
}

/** Journal scratch space stays on its authored day across app restarts. */
export function getRetainedJournalDraftDate(storage: RecoveryDraftStorage, todayKey: string): string {
  try {
    const raw = storage.getItem(RECOVERY_DRAFT_STORAGE_KEYS.journal);
    if (!raw || raw.length > MAX_SERIALIZED_LENGTH) return todayKey;
    const envelope: unknown = JSON.parse(raw);
    if (!isRecord(envelope) || !validDateKey(envelope.dateKey) || String(envelope.dateKey) > todayKey) return todayKey;
    return loadRecoveryDraft(storage, 'journal', String(envelope.dateKey)) ? String(envelope.dateKey) : todayKey;
  } catch { return todayKey; }
}
