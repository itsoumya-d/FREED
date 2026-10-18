import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const esbuild = createRequire(resolve("package.json"))("esbuild") as typeof import("esbuild");
const bundle = esbuild.buildSync({
  entryPoints: [resolve("modules/freed-protection/src/index.ts")],
  bundle: true, external: ["expo-modules-core", "react-native"],
  platform: "node", format: "cjs", write: false, logLevel: "silent"
}).outputFiles[0].text;

function nativePermissionAdapter(platform: string, nativeModule: Record<string, unknown> | null) {
  const timers = new Map<number, { callback: () => void; milliseconds: number }>();
  let nextTimer = 1;
  const sandbox = {
    module: { exports: {} },
    require(name: string) {
      if (name === "react-native") return { Platform: { OS: platform } };
      assert.equal(name, "expo-modules-core");
      return { requireNativeModule() {
        if (!nativeModule) throw new Error("native module is absent");
        return nativeModule;
      } };
    },
    setTimeout(callback: () => void, milliseconds: number) {
      const timer = nextTimer++;
      timers.set(timer, { callback, milliseconds });
      return timer;
    },
    clearTimeout(timer: number) { timers.delete(timer); }
  };
  runInNewContext(bundle, sandbox);
  return { adapter: sandbox.module.exports as typeof import("../modules/freed-protection/src/index"), timers };
}

test("iOS authorization waits for the person's decision without a short native deadline", async () => {
  let finish!: (value: unknown) => void;
  const systemDecision = new Promise(resolve => { finish = resolve; });
  const { adapter, timers } = nativePermissionAdapter("ios", { requestAuthorization: () => systemDecision });
  const pending = adapter.requestProtectionAuthorization();
  assert.equal(timers.size, 0, "a human authorization sheet must not expire after 15 seconds");
  const denied = { authorized: false, active: false, mode: "screen-time", message: "Denied by the system" };
  finish(denied);
  assert.equal(await pending, denied, "the actual denial is preserved");
});

test("Android authorization still bounds its immediate settings launch", async () => {
  const { adapter, timers } = nativePermissionAdapter("android", { requestAuthorization: () => new Promise(() => {}) });
  const pending = adapter.requestProtectionAuthorization();
  const timeout = [...timers.values()][0];
  assert.equal(timeout?.milliseconds, 15_000);
  timeout.callback();
  await assert.rejects(pending, { name: "NativeProtectionTimeoutError" });
  assert.equal(timers.size, 0);
});

test("Safari settings opening preserves native permission state and forwards the selected extension", async () => {
  let requestedTarget: unknown;
  const actualStatus = {
    authorized: false, active: false, mode: "screen-time", message: "Settings opened",
    safariExtensionSettingsOpened: true, safariExtensionSettingsRoute: "extension"
  };
  const { adapter } = nativePermissionAdapter("ios", {
    openSafariExtensionSettings(target: unknown) { requestedTarget = target; return Promise.resolve(actualStatus); }
  });
  assert.equal(typeof adapter.openSafariExtensionSettings, "function");
  assert.equal(await adapter.openSafariExtensionSettings(), actualStatus);
  assert.equal(requestedTarget, "content-blocker");
  await adapter.openSafariExtensionSettings("focus-shield");
  assert.equal(requestedTarget, "focus-shield");
});

test("older binaries retain the existing public app settings route", async () => {
  const actualStatus = { authorized: false, active: false, mode: "screen-time", message: "App settings opened" };
  let appSettingsOpened = 0;
  const { adapter } = nativePermissionAdapter("ios", {
    openProtectionSettings() { appSettingsOpened += 1; return Promise.resolve(actualStatus); }
  });
  assert.equal(typeof adapter.openSafariExtensionSettings, "function");
  assert.equal(await adapter.openSafariExtensionSettings(), actualStatus);
  assert.equal(appSettingsOpened, 1);
});

test("an unavailable native module never reports that settings or permissions were granted", async () => {
  const { adapter } = nativePermissionAdapter("ios", null);
  assert.equal(typeof adapter.openSafariExtensionSettings, "function");
  const status = await adapter.openSafariExtensionSettings();
  assert.equal(status.authorized, false);
  assert.equal(status.active, false);
  assert.notEqual(status.safariExtensionSettingsOpened, true);
});
