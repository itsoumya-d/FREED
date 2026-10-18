"use strict";

const send = (message) => chrome.runtime.sendMessage(message);

const statusLine = document.getElementById("status-line");
const activePanel = document.getElementById("active-panel");
const pausePanel = document.getElementById("pause-panel");
const pauseCount = document.getElementById("pause-count");

function render(state) {
  pauseCount.textContent = String(state.pausesToday ?? 0);
  if (state.paused) {
    statusLine.textContent = "Paused · resumes " + new Date(state.pausedUntil).toLocaleTimeString();
    statusLine.classList.add("paused");
    activePanel.hidden = true;
    pausePanel.hidden = false;
  } else {
    statusLine.textContent = state.enabled ? "Blocking adult domains" : "Rules disabled";
    statusLine.classList.remove("paused");
    activePanel.hidden = false;
    pausePanel.hidden = true;
  }
}

async function refresh() {
  try {
    render(await send({ type: "getState" }));
  } catch {
    statusLine.textContent = "Guard unavailable";
  }
}

document.getElementById("breather-btn").addEventListener("click", async () => {
  render(await send({ type: "pause", minutes: 5 }));
});

document.getElementById("resume-btn").addEventListener("click", async () => {
  render(await send({ type: "resume" }));
});

document.getElementById("options-link").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

document.getElementById("blocked-link").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("/blocked/index.html") });
  window.close();
});

refresh();
