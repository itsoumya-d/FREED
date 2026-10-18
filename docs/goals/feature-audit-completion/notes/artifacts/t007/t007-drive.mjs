// T007 CDP driver: walks the exported web build in headless Chrome, records visible text + screenshots.
const PORT = 9333, APP = "http://127.0.0.1:41738/";
const ART = "/Users/soumyadebnath16/Developer/live/FREED/docs/goals/feature-audit-completion/notes/artifacts/t007/";
const log = (...a) => console.log(...a);
let id = 0; const pending = new Map(); let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
async function evl(expr, awaitPromise = true) {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error("EVAL: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function text() { return (await evl(`document.body.innerText`, false)) || ""; }
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync(ART + name, Buffer.from(r.data, "base64"));
  return ART + name;
}
async function clickText(label, { nth = 0 } = {}) {
  const rect = await evl(`(async () => {
    const want = ${JSON.stringify(label.toLowerCase())};
    const nodes = [...document.querySelectorAll('div,span,button,a,p,h1,h2,h3,[role]')];
    const hits = nodes.filter(n => (n.innerText||'').trim().toLowerCase() === want || (n.innerText||'').trim().toLowerCase().startsWith(want));
    const leaf = hits.filter(n => !hits.some(o => o !== n && n.contains(o)));
    const el = (leaf.length ? leaf : hits)[${nth}] || null;
    if (!el) return null;
    el.scrollIntoView({block:'center'});
    await new Promise(r => setTimeout(r, 120));
    const b = el.getBoundingClientRect();
    return { x: b.x + b.width/2, y: b.y + b.height/2, tag: el.tagName, text: (el.innerText||'').slice(0,60), w: b.width, h: b.height };
  })()`);
  if (!rect) return { clicked: false, label };
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", clickCount: 1 });
  await sleep(450);
  return { clicked: true, ...rect };
}
function argsNow() { try { return JSON.parse(process.argv[2] || "{}"); } catch { return {}; } }
async function step(label) {
  await sleep(700);
  const t = (await text()).replace(/\s+/g, " ").slice(0, argsNow().maxText || 600);
  const file = await shot(label.replace(/[^a-z0-9]+/gi, "-") + ".png");
  log(JSON.stringify({ step: label, shot: file.split("/").pop(), visibleText: t }));
}
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(APP)}`, { method: "PUT" })).json();
ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
await send("Page.enable"); await send("Runtime.enable"); await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const args = JSON.parse(process.argv[2] || "{}");
if (args.seedFile) args.seed = (await import("node:fs")).readFileSync(args.seedFile, "utf8");
if (args.tz) await send("Emulation.setTimezoneOverride", { timezoneId: args.tz });
log("TZ:", JSON.stringify(await evl(`Intl.DateTimeFormat().resolvedOptions().timeZone`, false)), "| now:", await evl(`new Date().toString()`, false));
await send("Page.navigate", { url: APP });
await sleep(2500);
await step("01-cold-start");
if (args.skipSplash) { await clickText("continue").catch(()=>{}); await step("02-after-splash-tap"); }
for (const [i, label] of (args.clicks || []).entries()) {
  const r = await clickText(label);
  log(JSON.stringify({ clickAttempt: label, ...r }));
  await step(`click-${i + 1}-${label}`);
}
if (args.seed) {
  const before = (await text()).replace(/\s+/g, " ").slice(0, 400);
  const applied = await evl(args.seed);
  log(JSON.stringify({ seed: applied, beforeSeedText: before }));
  await send("Page.reload", {}); await sleep(2600);
  await step("after-seed-reload");
}
if (args.reTz) { await send("Emulation.setTimezoneOverride", { timezoneId: args.reTz }); await send("Page.reload", {}); await sleep(2600); await step(`tz-${args.reTz}`); }
if (args.offline) { await send("Network.enable"); await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }); await send("Page.reload", {}); await sleep(2600); await step("offline-reload"); await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }); }
if (args.dumpStorage) {
  const dump = await evl(`(async () => {
    const ls = {}; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); ls[k]=(localStorage.getItem(k)||'').slice(0,160);}
    const dbs = indexedDB.databases ? (await indexedDB.databases()).map(d=>d.name) : [];
    const urls = []; try { const req = indexedDB.open(null); } catch(e) {}
    return { localStorageKeys: Object.keys(ls), sample: ls, idb: dbs, navigatorOnLine: navigator.onLine, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, now: new Date().toISOString(), localToday: new Date().toLocaleDateString('en-CA') };
  })()`);
  log(JSON.stringify({ storage: dump }));
}
if (args.habit) {
  const before = (await text()).replace(/\s+/g, " ");
  const r = await clickText(args.habit);
  await sleep(600);
  const after = (await text()).replace(/\s+/g, " ");
  const pick = (s) => (s.match(/Day Streak\s+(\d+)/)||[])[1] + " | habits " + (s.match(/(\d+)\/6/)||[])[1] + " | complete " + (s.match(/(\d+)% Complete/)||[])[1] + " | day " + (s.match(/Day (\d+) of 90/)||[])[1];
  log(JSON.stringify({ habit: args.habit, clicked: r.clicked, beforeMetrics: pick(before), afterMetrics: pick(after) }));
  await step("habit-toggled");
}
if (args.dumpState) {
  const s = await evl(`(() => { const st = JSON.parse(localStorage.getItem("freed.recovery.state.v1") || "{}"); return {
    localToday: new Date().toLocaleDateString("en-CA"), tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    streakDays: st.streakDays, best: st.bestStreakDays, start: st.recoveryStartedAt,
    pledgeKeys: (st.pledges || []).map((p) => p.dateKey),
    habitKeys: (st.dailyHabits || []).map((h) => h.dateKey + ":" + h.key + (h.completed ? "" : "!")),
    checkInKeys: (st.dailyCheckIns || []).map((c) => c.dateKey)
  }; })()`, false);
  log(JSON.stringify({ postLoadState: s }));
}
process.exit(0);
