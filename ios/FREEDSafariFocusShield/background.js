"use strict";

const NATIVE_APP_ID = "app.freed.recovery";
const APPROVED_RULE_HOSTS = Object.freeze({
  "short-form:youtube-shorts": "youtube.com",
  "short-form:instagram-reels": "instagram.com",
  "short-form:tiktok-feed": "tiktok.com"
});

function approvedNativePayload(message) {
  if (!message || typeof message !== "object") return null;
  const host = typeof message.host === "string" ? message.host : "";
  const rule = typeof message.rule === "string" ? message.rule : "";
  if (APPROVED_RULE_HOSTS[rule] !== host) return null;
  return {
    type: "record-pending-intervention",
    source: "ios-safari-short-form",
    host,
    rule
  };
}

browser.runtime.onMessage.addListener((message) => {
  const payload = approvedNativePayload(message);
  if (!payload) return Promise.resolve({ accepted: false });
  return browser.runtime
    .sendNativeMessage(NATIVE_APP_ID, payload)
    .catch(() => ({ accepted: false }));
});
