const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { run, createNativeBuildProgressSnapshot } = require("../scripts/build-android-release-apk");
const realSetTimeout = global.setTimeout;

async function waitFor(predicate, description) {
  const deadline = Date.now() + 20_000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, description);
    await new Promise(resolve => realSetTimeout(resolve, 25));
  }
}

function silentWorker(file, finishFile) {
  return ["-e", `
    const fs = require('node:fs');
    fs.writeFileSync(process.argv[1], String(process.pid));
    const timer = setInterval(() => {
      if (fs.existsSync(process.argv[2])) clearInterval(timer);
    }, 25);
  `, file, finishFile];
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-native-progress-"));
  const folder = path.join(dir, "node_modules", "native-package", "android", ".cxx", "Release", "hash", "arm64-v8a");
  fs.mkdirSync(folder, { recursive: true });
  const log = path.join(folder, ".ninja_log");
  fs.writeFileSync(log, "initial\n");
  return { dir, log, progressSnapshot: createNativeBuildProgressSnapshot(dir) };
}

test("silent native compilation stays alive while real object progress advances", async (t) => {
  const {dir, log, progressSnapshot} = fixture();
  const ready = path.join(dir, "ready");
  const finish = path.join(dir, "finish");
  t.mock.timers.enable({apis: ["setTimeout", "setInterval"]});
  try {
    let settled = false;
    const task = run(process.execPath, silentWorker(ready, finish), {
      timeoutMs: 5000,
      idleTimeoutMs: 1000,
      progressPollMs: 100,
      progressSnapshot,
    }).finally(() => { settled = true; });
    await waitFor(() => fs.existsSync(ready), "the real worker must start before advancing the virtual build clock");
    for (let n = 1; n <= 7; n++) {
      fs.appendFileSync(log, `object-${n}\n`);
      t.mock.timers.tick(500);
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(settled, false, "completed object work must keep the build alive");
    }
    fs.writeFileSync(finish, "done");
    await task;
    assert.match(fs.readFileSync(log, "utf8"), /object-7/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("unchanged progress cannot keep a stalled build alive", async (t) => {
  const {dir} = fixture();
  const ready = path.join(dir, "ready");
  t.mock.timers.enable({apis: ["setTimeout", "setInterval"]});
  const task = run(process.execPath, silentWorker(ready, path.join(dir, "finish")), {
    timeoutMs: 5000,
    idleTimeoutMs: 500,
    progressPollMs: 50,
    progressSnapshot: () => "unchanged",
  });
  const rejected = assert.rejects(task, /timed out after 500ms/);
  try {
    await waitFor(() => fs.existsSync(ready), "worker startup");
    t.mock.timers.tick(500);
    await rejected;
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});

test("an advancing native build still respects the absolute build deadline", async (t) => {
  const {dir, log, progressSnapshot} = fixture();
  const ready = path.join(dir, "ready");
  t.mock.timers.enable({apis: ["setTimeout", "setInterval"]});
  try {
    const task = run(process.execPath, silentWorker(ready, path.join(dir, "finish")), {
      timeoutMs: 1200,
      idleTimeoutMs: 500,
      progressPollMs: 50,
      progressSnapshot,
    });
    const rejected = assert.rejects(task, /timed out after 1200ms$/);
    await waitFor(() => fs.existsSync(ready), "worker startup");
    for (let n = 0; n < 3; n++) {
      fs.appendFileSync(log, "object\n");
      t.mock.timers.tick(400);
    }
    await rejected;
    assert.match(fs.readFileSync(log, "utf8"), /object/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("timeout also terminates a compiler descendant with its own process group", { skip: process.platform === "win32" }, async (t) => {
  const { dir } = fixture();
  const pidFile = path.join(dir, "compiler.pid");
  let compilerPid;
  t.mock.timers.enable({apis: ["setTimeout", "setInterval"]});
  try {
    const task = run(process.execPath, ["-e", `
      const {spawn} = require('node:child_process');
      spawn(process.execPath, ['-e', "require('node:fs').writeFileSync(process.argv[1], String(process.pid));setInterval(()=>{},1000)", process.argv[1]], {detached:true,stdio:'ignore'});
      setInterval(()=>{},1000);
    `, pidFile], { timeoutMs: 5000, idleTimeoutMs: 1000, killProcessTree: true });
    const rejected = assert.rejects(task, /timed out/);
    await waitFor(() => fs.existsSync(pidFile), "the actual detached compiler must start before its deadline is advanced");
    compilerPid = Number(fs.readFileSync(pidFile, "utf8"));
    assert.ok(compilerPid > 0, "the detached descendant must have actually started");
    t.mock.timers.tick(1000);
    await rejected;
    await waitFor(() => { try { process.kill(compilerPid, 0); return false; } catch { return true; } }, "a Gradle-style detached descendant must not outlive its deadline");
  } finally {
    if (compilerPid) try { process.kill(compilerPid, "SIGKILL"); } catch { /* Already reaped. */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("timeout retries a failed process enumeration before cleaning detached descendants", { skip: process.platform === "win32" }, async (t) => {
  const {dir} = fixture();
  const pidFile = path.join(dir, "compiler.pid");
  const marker = path.join(dir, "enumerated-once");
  const originalPath = process.env.PATH;
  const originalMarker = process.env.FREED_TEST_PS_ONCE_MARKER;
  fs.writeFileSync(path.join(dir, "ps"), '#!/bin/sh\nif [ ! -f "$FREED_TEST_PS_ONCE_MARKER" ]; then touch "$FREED_TEST_PS_ONCE_MARKER"; exit 1; fi\nexec /bin/ps "$@"\n', {mode:0o755});
  process.env.PATH = `${dir}:${originalPath}`;
  process.env.FREED_TEST_PS_ONCE_MARKER = marker;
  t.mock.timers.enable({apis:["setTimeout", "setInterval"]});
  let compilerPid;
  try {
    const task = run(process.execPath, ["-e", `
      const {spawn} = require('node:child_process');
      spawn(process.execPath, ['-e', "require('node:fs').writeFileSync(process.argv[1], String(process.pid));setInterval(()=>{},1000)", process.argv[1]], {detached:true,stdio:'ignore'});
      setInterval(()=>{},1000);
    `, pidFile], {idleTimeoutMs:1000,timeoutMs:5000,killProcessTree:true});
    const rejected = assert.rejects(task, /timed out/);
    await waitFor(() => fs.existsSync(pidFile), "detached compiler startup");
    compilerPid = Number(fs.readFileSync(pidFile, "utf8"));
    t.mock.timers.tick(1000);
    await rejected;
    assert.ok(fs.existsSync(marker), "the failure path must actually be exercised");
    await waitFor(() => { try { process.kill(compilerPid, 0); return false; } catch { return true; } }, "enumeration failure must not leave the detached compiler running");
  } finally {
    process.env.PATH = originalPath;
    if (originalMarker === undefined) delete process.env.FREED_TEST_PS_ONCE_MARKER; else process.env.FREED_TEST_PS_ONCE_MARKER = originalMarker;
    if (compilerPid) try { process.kill(compilerPid, "SIGKILL"); } catch { /* Reaped. */ }
    fs.rmSync(dir, {recursive:true,force:true});
  }
});
