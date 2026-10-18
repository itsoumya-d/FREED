import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const navigationCore = dirname(require.resolve("@react-navigation/core/package.json"));

test("query-string supports both namespace and default consumers", async () => {
  const namespace = await import("query-string");
  const commonjs = require("query-string");
  for (const method of ["extract", "parse", "stringify", "parseUrl", "stringifyUrl", "pick", "exclude"]) {
    assert.equal(typeof namespace[method], "function", `missing named ${method}`);
    assert.equal(typeof namespace.default[method], "function", `missing default ${method}`);
    assert.equal(typeof commonjs[method], "function", `missing CommonJS ${method}`);
  }
  const parsed = namespace.parse("email=sam%2Bbackup%40example.com&tag=first&tag=second&flag&blank=&q=hello+world&symbol=%F0%9F%94%90&value=a%3Db");
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.deepEqual({ ...parsed }, {
    blank: "", email: "sam+backup@example.com", flag: null, q: "hello world",
    symbol: "🔐", tag: ["first", "second"], value: "a=b"
  });
  const parameters = { email: "sam+backup@example.com", tag: ["first", "second"], blank: "", flag: null, q: "space & = #" };
  assert.equal(commonjs.stringify(parameters, { sort: false }), "email=sam%2Bbackup%40example.com&tag=first&tag=second&blank=&flag&q=space%20%26%20%3D%20%23");
  assert.deepEqual({ ...namespace.default.parse("count=12.5&enabled=true", { parseNumbers: true, parseBooleans: true }) }, { count: 12.5, enabled: true });
  assert.equal(namespace.pick("https://example.com/?a=1&b=2", ["a"]), "https://example.com/?a=1");
  assert.equal(namespace.exclude("https://example.com/?a=1&b=2", ["a"]), "https://example.com/?b=2");
});

test("real React Navigation query parsing and stringification retain deep-link parameters", async () => {
  const { getStateFromPath } = await import(pathToFileURL(resolve(navigationCore, "lib/module/getStateFromPath.js")));
  const { getPathFromState } = await import(pathToFileURL(resolve(navigationCore, "lib/module/getPathFromState.js")));
  const options = { screens: { Recovery: { path: "recovery/:id", parse: { count: Number }, stringify: { count: String } } } };
  const state = getStateFromPath("/recovery/day-1?count=3&tag=first&tag=second&q=hello+world&flag&blank=", options);
  const route = state.routes.at(-1);
  assert.equal(route.name, "Recovery");
  assert.deepEqual(route.params, { id: "day-1", blank: "", count: 3, flag: null, q: "hello world", tag: ["first", "second"] });
  const path = getPathFromState(state, options);
  assert.equal(path, "/recovery/day-1?blank=&count=3&flag=null&q=hello%20world&tag=first%2Csecond");
});

async function loadExpoPathBoundary() {
  const result = await build({
    stdin: {
      contents: 'export { getPathFromState } from "expo-router/build/fork/getPathFromState"; export { appendQueryAndHash } from "expo-router/build/fork/getPathFromState-forks";',
      resolveDir: root, sourcefile: "query-boundary-test.js", loader: "js"
    },
    bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
    plugins: [{
      name: "navigation-pure-boundary",
      setup(build) {
        // Expo's path utilities use only this real Navigation validator. Avoid
        // loading unrelated React Native rendering modules into Node.
        build.onResolve({ filter: /^@react-navigation\/native$/ }, () => ({ path: "navigation-path-validator", namespace: "query-compat-test" }));
        build.onLoad({ filter: /.*/, namespace: "query-compat-test" }, () => ({
          contents: `export { validatePathConfig } from ${JSON.stringify(resolve(navigationCore, "lib/module/validatePathConfig.js"))};`,
          loader: "js", resolveDir: root
        }));
      }
    }]
  });
  const compiled = { exports: {} };
  Function("module", "exports", "require", result.outputFiles[0].text)(compiled, compiled.exports, require);
  return compiled.exports;
}

test("real Expo Router query output preserves repeated arrays and hash routing", async () => {
  const { appendQueryAndHash, getPathFromState } = await loadExpoPathBoundary();
  const parameters = { tag: ["first", "second"], q: "hello world", blank: "", "#": "reset" };
  assert.equal(appendQueryAndHash("/recovery", parameters), "/recovery?tag=first&tag=second&q=hello%20world&blank=#reset");
  const state = { routes: [{ name: "recovery", params: parameters }] };
  assert.equal(getPathFromState(state, { screens: { recovery: "recovery" } }), "/recovery?tag=first&tag=second&q=hello%20world&blank=#reset");
});

test("malformed percent-encoded input finishes within a bounded child process", () => {
  const child = spawnSync(process.execPath, ["--max-old-space-size=128", "--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import * as queryString from "query-string";
    import { getStateFromPath } from ${JSON.stringify(pathToFileURL(resolve(navigationCore, "lib/module/getStateFromPath.js")).href)};
    for (const input of ["%FF".repeat(4096), "%C2".repeat(4096), "%E0%A4%FF".repeat(2048), "%F0%9F%".repeat(2048)]) {
      const parsed = queryString.parse("value=" + input);
      assert.equal(typeof parsed.value, "string");
      assert.equal(Object.keys(parsed).length, 1);
      const state = getStateFromPath("recovery?value=" + input);
      assert.equal(typeof state.routes[0].params.value, "string");
    }
    console.log("bounded malformed decoding passed");
  `], { cwd: root, encoding: "utf8", timeout: 3000, killSignal: "SIGKILL", maxBuffer: 1024 * 1024 });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /bounded malformed decoding passed/);
});
