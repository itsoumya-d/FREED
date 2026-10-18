"use strict";

const send = (message) => chrome.runtime.sendMessage(message);

const allowedInput = document.getElementById("allowed-input");
const blockedInput = document.getElementById("blocked-input");
const statusEl = document.getElementById("status");
const statsLine = document.getElementById("stats-line");

async function load() {
  const stored = await chrome.storage.local.get(["freedCustomBlocked", "freedCustomAllowed", "freedRuleStats"]);
  allowedInput.value = (stored.freedCustomAllowed ?? []).join("\n");
  blockedInput.value = (stored.freedCustomBlocked ?? []).join("\n");

  const stats = stored.freedRuleStats;
  if (stats) {
    statsLine.textContent =
      `Active custom rules: ${stats.customAllowedCount} allow · ${stats.customBlockedCount} block` +
      (stats.updatedAt ? ` · synced ${new Date(stats.updatedAt).toLocaleString()}` : "");
  }
}

document.getElementById("save-btn").addEventListener("click", async () => {
  statusEl.textContent = "Saving…";

  const toList = (value) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  await chrome.storage.local.set({
    freedCustomAllowed: toList(allowedInput.value),
    freedCustomBlocked: toList(blockedInput.value)
  });

  try {
    await send({ type: "syncRules" });
    statusEl.textContent = "Saved and applied.";
  } catch {
    statusEl.textContent = "Saved. Rules apply on next browser start.";
  }
  await load();
});

load();
