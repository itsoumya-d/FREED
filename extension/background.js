"use strict";

const STATIC_RULESET_ID = "freed_adult_domains";
const PAUSE_ALARM = "freed-pause-expiry";
const MAX_DYNAMIC_RULES = 4000;

const DEFAULT_STATE = {
  pausedUntil: 0,
  pausesToday: 0,
  pausesDateKey: ""
};

chrome.runtime.onInstalled.addListener(() => {
  void syncDynamicRules();
});

chrome.runtime.onStartup.addListener(() => {
  void reconcilePauseOnBoot();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PAUSE_ALARM) {
    void resume();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.freedCustomBlocked || changes.freedCustomAllowed) {
    void syncDynamicRules();
  }
});

function dateKey(now = new Date()) {
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getState() {
  const stored = await chrome.storage.local.get(["freedGuardState", "freedCustomBlocked", "freedCustomAllowed"]);
  const state = { ...DEFAULT_STATE, ...(stored.freedGuardState ?? {}) };
  if (state.pausesDateKey !== dateKey()) {
    state.pausesToday = 0;
    state.pausesDateKey = dateKey();
  }
  return {
    state,
    customBlocked: Array.isArray(stored.freedCustomBlocked) ? stored.freedCustomBlocked : [],
    customAllowed: Array.isArray(stored.freedCustomAllowed) ? stored.freedCustomAllowed : []
  };
}

async function setState(state) {
  await chrome.storage.local.set({ freedGuardState: state });
}

async function isPaused() {
  const { state } = await getState();
  return Date.now() < state.pausedUntil;
}

async function reconcilePauseOnBoot() {
  if (!(await isPaused())) await resume();
}

async function pause(minutes) {
  const boundedMinutes = Math.max(1, Math.min(15, Math.round(minutes)));
  const { state } = await getState();
  const pausedUntil = Date.now() + boundedMinutes * 60 * 1000;
  await setState({
    ...state,
    pausedUntil,
    pausesToday: state.pausesToday + 1,
    pausesDateKey: dateKey()
  });
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    disableRulesetIds: [STATIC_RULESET_ID]
  });
  await chrome.alarms.clear(PAUSE_ALARM);
  await chrome.alarms.create(PAUSE_ALARM, { when: pausedUntil });
  return getPublicState();
}

async function resume() {
  const { state } = await getState();
  await setState({ ...state, pausedUntil: 0 });
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [STATIC_RULESET_ID]
  });
  await chrome.alarms.clear(PAUSE_ALARM);
  return getPublicState();
}

async function getPublicState() {
  const { state } = await getState();
  let enabled = true;
  try {
    const enabledSets = await chrome.declarativeNetRequest.getEnabledRulesets();
    enabled = enabledSets.includes(STATIC_RULESET_ID);
  } catch {
    enabled = true;
  }

  return {
    enabled,
    pausedUntil: state.pausedUntil,
    paused: Date.now() < state.pausedUntil,
    pausesToday: state.pausesToday
  };
}

/**
 * Ordinary-site allows (priority 10) override custom blocks (priority 2), while
 * reviewed adult-domain rules (priority 20) remain enforced. requestDomains keeps the
 * same domain+subdomain semantics as the reviewed static ruleset.
 */
async function syncDynamicRules() {
  const { customBlocked, customAllowed } = await getState();

  const sanitize = (list) =>
    Array.from(
      new Set(
        list
          .map((raw) => String(raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, ""))
          .filter((value) => /^[a-z0-9.-]+$/.test(value) && value.includes(".") && value.length <= 253)
      )
    ).slice(0, Math.floor(MAX_DYNAMIC_RULES / 2));

  const blockedDomains = sanitize(customBlocked);
  const allowedDomains = sanitize(customAllowed);

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map((rule) => rule.id),
    addRules: [
      ...allowedDomains.map((domain, index) => ({
        id: 900_000 + index,
        priority: 10,
        action: { type: "allow" },
        condition: { requestDomains: [domain], resourceTypes: ["main_frame"] }
      })),
      ...blockedDomains.map((domain, index) => ({
        id: 800_000 + index,
        priority: 2,
        action: { type: "redirect", redirect: { extensionPath: "/blocked/index.html" } },
        condition: { requestDomains: [domain], resourceTypes: ["main_frame", "sub_frame"] }
      }))
    ]
  });

  await chrome.storage.local.set({
    freedRuleStats: {
      customBlockedCount: blockedDomains.length,
      customAllowedCount: allowedDomains.length,
      updatedAt: new Date().toISOString()
    }
  });

  return { blockedCount: blockedDomains.length, allowedCount: allowedDomains.length };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case "getState":
        sendResponse(await getPublicState());
        break;
      case "pause":
        sendResponse(await pause(message.minutes));
        break;
      case "resume":
        sendResponse(await resume());
        break;
      case "syncRules":
        sendResponse(await syncDynamicRules());
        break;
      default:
        sendResponse({ error: "unknown-message" });
    }
  })();
  return true;
});
