import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { useRecoveryDraft } from "@/hooks/use-recovery-draft";
import { RECOVERY_DRAFT_STORAGE_KEYS, loadRecoveryDraft, saveRecoveryDraft, type RecoveryDraftStorage } from "@/lib/recovery-drafts";
import { createDurableStateCell } from "@/lib/durable-state-cell";
import { createDefaultRecoveryState, recordDailyCheckIn, recordRelapse } from "@/lib/recovery-state";
import { appI18n } from "@/i18n/runtime";

jest.mock("expo-sqlite/localStorage/install", () => ({}));

const defaults = { mood: "steady" as const, urgeLevel: 2, sleepQuality: 3, reflection: "" };
function deviceStorage() {
  const values = new Map<string, string>();
  const fail = { read: false, write: false, clear: false };
  const storage: RecoveryDraftStorage = {
    getItem: key => { if (fail.read) throw new Error("locked"); return values.get(key) ?? null; },
    setItem: (key, value) => { if (fail.write) throw new Error("full"); values.set(key, value); },
    removeItem: key => { if (fail.clear) throw new Error("locked"); values.delete(key); }
  };
  return { storage, values, fail };
}

afterEach(async () => { await appI18n.changeLanguage("en"); });

test("navigation and language-direction restart restore every check-in field without changing user input or history", async () => {
  const { storage } = deviceStorage();
  const originalHistory = createDefaultRecoveryState();
  const entry = { mood: "low" as const, urgeLevel: 4, sleepQuality: 1, reflection: "  ჩემი ჩანაწერი\n私の言葉  " };
  const first = renderHook(() => useRecoveryDraft("checkin", defaults, { storage, dateKey: "2026-10-03" }));
  act(() => { first.result.current.update(entry); });
  expect(originalHistory.dailyCheckIns).toEqual([]);
  first.unmount();
  await appI18n.changeLanguage("ar");
  const restarted = renderHook(() => useRecoveryDraft("checkin", defaults, { storage, dateKey: "2026-10-03" }));
  expect(restarted.result.current.value).toEqual(entry);
  expect(restarted.result.current.restored).toBe(true);
  expect(restarted.result.current.notice).toBe("Draft restored. Your history changes when you save.");
});

test("editing an old saved record uses its values until a current draft exists", () => {
  const { storage } = deviceStorage();
  const saved = { mood: "energized" as const, urgeLevel: 1, sleepQuality: 5, reflection: "saved record" };
  const screen = renderHook(() => useRecoveryDraft("checkin", saved, { storage, dateKey: "2026-10-03" }));
  expect(screen.result.current.value).toEqual(saved);
  expect(storage.getItem(RECOVERY_DRAFT_STORAGE_KEYS.checkin)).toBeNull();
});

test("check-in day rollover starts from the new day's defaults without carrying yesterday's unfinished entry", () => {
  const { storage } = deviceStorage();
  const screen = renderHook(({ dateKey }) => useRecoveryDraft("checkin", defaults, { storage, dateKey }), { initialProps: { dateKey: "2026-10-03" } });
  act(() => { screen.result.current.update({ ...defaults, reflection: "yesterday" }); });
  screen.rerender({ dateKey: "2026-10-04" });
  expect(screen.result.current.value).toEqual(defaults);
  expect(screen.result.current.restored).toBe(false);
});

test("slip trigger and note stay separate from history until explicit Save succeeds", () => {
  const { storage } = deviceStorage();
  const history = createDurableStateCell(createDefaultRecoveryState(), () => undefined);
  const screen = renderHook(() => useRecoveryDraft("slip", { trigger: "", note: "" }, { storage }));
  act(() => { screen.result.current.update({ trigger: "Tired", note: "  My private note  " }); });
  expect(history.read().relapseRecords).toHaveLength(0);
  screen.unmount();
  const resumed = renderHook(() => useRecoveryDraft("slip", { trigger: "", note: "" }, { storage }));
  expect(resumed.result.current.value).toEqual({ trigger: "Tired", note: "  My private note  " });
  act(() => { expect(resumed.result.current.save(input => history.commit(current => recordRelapse(current, input))).ok).toBe(true); });
  expect(history.read().relapseRecords).toHaveLength(1);
  expect(loadRecoveryDraft(storage, "slip")).toBeNull();
});

test("custom reset fields survive restart without creating a saved reset", () => {
  const { storage } = deviceStorage();
  const initial = { title: "", why: "", category: "reset" as const, intensity: "medium" as const, durationSec: 120, steps: ["", "", "", ""] };
  const entered = { title: "Reset name", why: "  because  ", category: "connection" as const, intensity: "calm" as const, durationSec: 600, steps: ["  step one  ", "two", "", ""] };
  const screen = renderHook(() => useRecoveryDraft("custom", initial, { storage }));
  act(() => { screen.result.current.update(entered); });
  screen.unmount();
  const resumed = renderHook(() => useRecoveryDraft("custom", initial, { storage }));
  expect(resumed.result.current.value).toEqual(entered);
  expect(createDefaultRecoveryState().customChallenges).toHaveLength(0);
});

test("a failed durable Save keeps all fields and draft and does not count a check-in", () => {
  const { storage } = deviceStorage();
  let full = true;
  const history = createDurableStateCell(createDefaultRecoveryState(), () => { if (full) throw new Error("full disk"); });
  const screen = renderHook(() => useRecoveryDraft("checkin", defaults, { storage, dateKey: "2026-10-03" }));
  const entered = { ...defaults, reflection: "unfinished reflection" };
  act(() => { screen.result.current.update(entered); });
  act(() => { expect(screen.result.current.save(input => history.commit(current => recordDailyCheckIn(current, input))).ok).toBe(false); });
  expect(history.read().dailyCheckIns).toHaveLength(0);
  expect(screen.result.current.value).toEqual(entered);
  expect(loadRecoveryDraft(storage, "checkin", "2026-10-03")).toEqual(entered);
  expect(screen.result.current.error).toBe("This entry could not be saved. Your changes are still here. Free up space and try again.");
  full = false;
  act(() => { expect(screen.result.current.save(input => history.commit(current => recordDailyCheckIn(current, input))).ok).toBe(true); });
  expect(history.read().dailyCheckIns).toHaveLength(1);
  expect(loadRecoveryDraft(storage, "checkin", "2026-10-03")).toBeNull();
});

test("draft storage failures preserve on-screen input and show an honest actionable error", () => {
  const { storage, fail } = deviceStorage();
  const screen = renderHook(() => useRecoveryDraft("slip", { trigger: "", note: "" }, { storage }));
  fail.write = true;
  act(() => { screen.result.current.update({ trigger: "Stress", note: "still here" }); });
  expect(screen.result.current.value.note).toBe("still here");
  expect(screen.result.current.error).toBe("Your draft could not be kept on this device. Free up space and try again before leaving.");
  expect(storage.getItem(RECOVERY_DRAFT_STORAGE_KEYS.slip)).toBeNull();
  fail.write = false;
  act(() => { screen.result.current.update({ trigger: "Stress", note: "still here, updated" }); });
  expect(screen.result.current.error).toBeNull();
});

test("draft read failures show defaults and never overwrite the unknown stored entry", () => {
  const { storage, values, fail } = deviceStorage();
  saveRecoveryDraft(storage, "slip", { trigger: "Tired", note: "durable" });
  const raw = values.get(RECOVERY_DRAFT_STORAGE_KEYS.slip);
  fail.read = true;
  const screen = renderHook(() => useRecoveryDraft("slip", { trigger: "", note: "" }, { storage }));
  expect(screen.result.current.error).toBe("Your draft could not be loaded. Check device storage and try again.");
  expect(screen.result.current.value.note).toBe("");
  expect(values.get(RECOVERY_DRAFT_STORAGE_KEYS.slip)).toBe(raw);
});

test("a cleanup retry cannot create a second slip after history was durably saved", () => {
  const { storage, fail } = deviceStorage();
  const history = createDurableStateCell(createDefaultRecoveryState(), () => undefined);
  const screen = renderHook(() => useRecoveryDraft("slip", { trigger: "", note: "" }, { storage }));
  act(() => { screen.result.current.update({ trigger: "Stress", note: "one entry" }); });
  fail.clear = true;
  act(() => { expect(screen.result.current.save(input => history.commit(current => recordRelapse(current, input))).ok).toBe(false); });
  expect(history.read().relapseRecords).toHaveLength(1);
  expect(screen.result.current.committed).toBe(true);
  expect(screen.result.current.error).toBe("Saved locally. Draft cleanup could not finish. Check device storage and try Save again.");
  act(() => { screen.result.current.update({ trigger: "Tired", note: "new changes must not erase an unsaved entry" }); });
  expect(screen.result.current.value.note).toBe("one entry");
  fail.clear = false;
  act(() => { expect(screen.result.current.save(input => history.commit(current => recordRelapse(current, input))).ok).toBe(true); });
  expect(history.read().relapseRecords).toHaveLength(1);
  expect(loadRecoveryDraft(storage, "slip")).toBeNull();
});

test("a second Save before the form leaves reuses the successful receipt instead of duplicating history", () => {
  const { storage } = deviceStorage();
  const history = createDurableStateCell(createDefaultRecoveryState(), () => undefined);
  const screen = renderHook(() => useRecoveryDraft("slip", { trigger: "", note: "" }, { storage }));
  act(() => { screen.result.current.update({ trigger: "Stress", note: "one entry" }); });
  act(() => {
    expect(screen.result.current.save(input => history.commit(current => recordRelapse(current, input))).ok).toBe(true);
    expect(screen.result.current.save(input => history.commit(current => recordRelapse(current, input))).ok).toBe(true);
  });
  expect(history.read().relapseRecords).toHaveLength(1);
});
