#!/usr/bin/env node
/**
 * SINGLE-COMMAND screen walkthrough.
 *
 * This sandbox kills background processes when a command returns, so a dev
 * server can never outlive one tool call. This script therefore does everything
 * inside one process: serve the exported web build, launch headless Chrome,
 * drive the app through its real screens with DevTools Protocol input events,
 * and write a screenshot + visible-text record for every step.
 *
 * QA captures only. These files are NOT release evidence.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import WebSocket from "ws";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "docs", "validation", "artifacts", "web-walkthrough-current");
const SERVE_PORT = 8901;
const CDP_PORT = 9222;
const CHROME =
  process.env.FREED_CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORT = { width: 390, height: 844 };

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".map": "application/json"
};

function log(...parts) {
  console.log("[walk]", ...parts);
}

function serveDist() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let filePath = path.join(DIST, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(DIST)) return res.writeHead(403).end();
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    if (!fs.existsSync(filePath)) {
      const html = filePath.replace(/\.html$/, "") + ".html";
      if (fs.existsSync(html)) filePath = html;
      else return res.writeHead(404).end("not found");
    }
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] ?? "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(SERVE_PORT, "127.0.0.1", () => resolve(server)));
}

async function waitForCdp() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`).then((r) => r.json());
      const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Chrome DevTools endpoint never became ready");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        this.consoleErrors.push(
          `exception: ${message.params.exceptionDetails?.exception?.description ?? "unknown"}`
        );
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.consoleErrors.push(
          `console: ${(message.params.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200)}`
        );
      }
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
        this.consoleErrors.push(`log: ${message.params.entry.text.slice(0, 200)}`);
      }
    });
  }

  send(method, params = {}) {
    this.id += 1;
    const id = this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`${method} timed out`));
        }
      }, 45000);
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "eval failed");
    return result.result?.value;
  }

  async visibleText() {
    return (await this.evaluate("document.body.innerText || ''")) ?? "";
  }

  /**
   * Scrolling and measuring must be separate round trips: React Native Web
   * screens are tall scroll containers, and a rect measured in the same tick as
   * scrollIntoView is pre-scroll, which silently makes clicks land nowhere.
   */
  async scrollTo(text) {
    return this.evaluate(`(() => {
      const wanted = ${JSON.stringify(text)}.toLowerCase();
      const nodes = Array.from(document.querySelectorAll('[role="button"],button,[role="radio"],[role="tab"],[role="link"],a'));
      const candidates = nodes.filter((el) => ((el.innerText || el.getAttribute('aria-label') || '').trim().toLowerCase().includes(wanted)));
      // Only the topmost, actually hittable element counts — a button covered by
      // an open modal is exactly as untappable for the harness as for a finger.
      const hittable = candidates.find((el) => {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
        const top = document.elementFromPoint(x, y);
        return Boolean(top && (top === el || el.contains(top) || top.contains(el)));
      });
      if (!hittable) return false;
      hittable.scrollIntoView({ block: 'center', behavior: 'instant' });
      window.__freedTarget = hittable;
      return true;
    })()`);
  }

  async measure() {
    return this.evaluate(`(() => {
      const match = window.__freedTarget;
      if (!match || !match.isConnected) return null;
      const rect = match.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: Math.round(rect.left + rect.width / 2),
        y: Math.round(rect.top + rect.height / 2),
        label: (match.innerText || match.getAttribute('aria-label') || '').trim().slice(0, 60)
      };
    })()`);
  }

  async jsPress() {
    return this.evaluate(`(() => {
      const el = window.__freedTarget;
      if (!el || !el.isConnected) return false;
      const rect = el.getBoundingClientRect();
      const init = {
        bubbles: true, cancelable: true, composed: true, view: window,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true
      };
      el.dispatchEvent(new PointerEvent('pointerdown', init));
      el.dispatchEvent(new MouseEvent('mousedown', init));
      el.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
      return true;
    })()`);
  }

  async clickText(text) {
    const found = await this.scrollTo(text);
    if (!found) return { clicked: false, text };
    await new Promise((r) => setTimeout(r, 450));
    const target = await this.measure();
    if (!target) return { clicked: false, text };
    const base = { x: target.x, y: target.y, button: "left", clickCount: 1 };
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
    return { clicked: true, text, label: target.label, method: "cdp" };
  }

  /** Click by text, then confirm the screen actually changed. */
  async clickTextExpectingChange(text) {
    const before = await this.visibleText();
    const first = await this.clickText(text);
    if (!first.clicked) return first;
    await new Promise((r) => setTimeout(r, 1500));
    if ((await this.visibleText()) !== before) return { ...first, changed: true };
    const pressed = await this.jsPress();
    await new Promise((r) => setTimeout(r, 1500));
    return {
      ...first,
      method: pressed ? "js-pointer" : "none",
      changed: (await this.visibleText()) !== before
    };
  }

  async clickFirstRadio() {
    return this.evaluate(`(() => {
      const radio = document.querySelector('[role="radio"]');
      if (!radio) return null;
      radio.scrollIntoView({ block: 'center' });
      const rect = radio.getBoundingClientRect();
      return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
    })()`).then(async (point) => {
      if (!point) return false;
      const base = { x: point.x, y: point.y, button: "left", clickCount: 1 };
      await this.send("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
      await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
      return true;
    });
  }

  async screenshot(name) {
    const shot = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.data, "base64"));
  }
}

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error("dist/index.html missing — run `npm run export:web` first");
  }
  fs.mkdirSync(OUT, { recursive: true });

  const server = await serveDist();
  log(`static server on ${SERVE_PORT}`);

  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--user-data-dir=/tmp/freed-walkthrough-profile",
      "about:blank"
    ],
    { stdio: "ignore" }
  );

  const steps = [];
  const record = (step, detail = {}) => {
    steps.push({ step, ...detail });
    log(step, JSON.stringify(detail).slice(0, 180));
  };

  try {
    const ws = new WebSocket(await waitForCdp(), { maxPayload: 256 * 1024 * 1024 });
    await new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    const cdp = new Cdp(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 2,
      mobile: true
    });

    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${SERVE_PORT}/` });
    await new Promise((r) => setTimeout(r, 4000));

    await cdp.screenshot("00-launch");
    record("launch", { text: (await cdp.visibleText()).slice(0, 90) });

    /**
     * Ordered, asserted walkthrough. Each step names the control a user taps and
     * the marker text the next screen must contain; a missing marker is a real
     * flow finding, recorded as pass=false with the screen text that appeared.
     */
    const flowSteps = [
      { click: "Start My Recovery", expect: "RECOVERY ASSESSMENT", name: "welcome-to-quiz" },
      { radio: true, expect: "How long has this cycle", name: "quiz-1" },
      { radio: true, expect: "When are urges most likely", name: "quiz-2" },
      { radio: true, expect: "What symptoms affect", name: "quiz-3" },
      { radio: true, expect: "What helps you reset", name: "quiz-4" },
      { radio: true, expect: "PROJECTION", name: "quiz-5-to-plan" },
      { wait: 8000, expect: "Reboot Plan is ready", name: "plan-projection" },
      { click: "Protect My Apps & Proceed", expect: "APP SELECTION", name: "plan-to-apps" },
      { click: "Continue with", expect: "Unlock Full Recovery", name: "apps-to-paywall" },
      { click: "Continue with Free Blocker", expect: "Protect Your First 72 Hours", name: "paywall-downsell" },
      { click: "Continue with Basic Free DNS", expect: "ACCOUNT", name: "downsell-to-account" },
      { click: "Skip for now", expect: "protection", name: "account-to-setup" },
      { click: "Continue Preview", expect: "SUMMARY", name: "setup-to-today" }
    ];

    for (const [index, step] of flowSteps.entries()) {
      if (step.wait) await new Promise((r) => setTimeout(r, step.wait));
      let clicked = null;
      if (step.radio) clicked = await cdp.clickFirstRadio();
      else if (step.click) clicked = (await cdp.clickText(step.click)).clicked;
      await new Promise((r) => setTimeout(r, step.click ? 2200 : 1200));
      const text = await cdp.visibleText();
      const passed = text.toUpperCase().includes(step.expect.toUpperCase());
      await cdp.screenshot(`${String(index + 1).padStart(2, "0")}-${step.name}`);
      record(step.name, { clicked, expect: step.expect, passed, text: text.replace(/\s+/g, " ").slice(0, 110) });
      if (!passed) {
        const dump = await cdp.evaluate(`(() => {
          const nodes = Array.from(document.querySelectorAll('[role="button"],button,[role="radio"],[role="link"],a'));
          return nodes.map((el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return {
              label: (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 70),
              role: el.getAttribute('role'),
              ariaDisabled: el.getAttribute('aria-disabled'),
              pointerEvents: style.pointerEvents,
              y: Math.round(rect.top)
            };
          }).filter((row) => row.label);
        })()`);
        fs.writeFileSync(
          path.join(OUT, "blocked-screen-buttons.json"),
          JSON.stringify({ failedStep: step.name, dump }, null, 2)
        );
        log(`FLOW FINDING at ${step.name}: expected "${step.expect}", saw "${text.replace(/\s+/g, " ").slice(0, 120)}"`);
        break;
      }
    }

    // Main app tabs, using the same accessibility labels the app ships.
    for (const [name, label] of [
      ["shield", "Shield"],
      ["progress", "Progress"],
      ["profile", "Profile"],
      ["today", "Today"]
    ]) {
      const result = await cdp.clickText(label);
      await new Promise((r) => setTimeout(r, 1200));
      await cdp.screenshot(`04-tab-${name}`);
      record(`tab-${name}`, { clicked: result.clicked, text: (await cdp.visibleText()).slice(0, 90) });
    }

    // Secondary screens reachable from Home, so the captures cover the full app.
    for (const [name, label] of [
      ["library", "Open Recovery Tools"],
      ["library-breathe", "Breathe"],
      ["library-challenge", "Challenge"],
      ["library-clara", "CLARA"],
      ["panic", "Open Urge Support"]
    ]) {
      const result = await cdp.clickText(label);
      if (!result.clicked) {
        record(`extra-${name}`, { clicked: false });
        continue;
      }
      await new Promise((r) => setTimeout(r, 1500));
      await cdp.screenshot(`05-extra-${name}`);
      record(`extra-${name}`, { clicked: true, text: (await cdp.visibleText()).slice(0, 90) });
    }

    fs.writeFileSync(
      path.join(OUT, "walkthrough.json"),
      JSON.stringify(
        {
          schema: "freed-web-walkthrough-v1",
          generatedAt: new Date().toISOString(),
          viewport: VIEWPORT,
          note: "QA capture only; not release evidence. Web preview platform, so native permission surfaces are not exercised.",
          steps,
          consoleErrors: cdp.consoleErrors.slice(0, 40)
        },
        null,
        2
      )
    );
    log(`console errors: ${cdp.consoleErrors.length}`);
    if (cdp.consoleErrors.length) log(cdp.consoleErrors.slice(0, 6).join(" | "));
  } finally {
    chrome.kill("SIGKILL");
    server.close();
  }

  const shots = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
  log("screenshots:", shots.join(", "));
}

main().catch((error) => {
  console.error("[walk] FAILED:", error.message);
  process.exitCode = 1;
});
