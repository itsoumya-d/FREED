const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const esbuild = require("esbuild");

process.env.ESBUILD_WORKER_THREADS ||= "0";
const entry = resolve(__dirname, "recovery-data-accuracy.test.ts");
const localFailure = /✖ challenge generation stays local with a remote hint and preserves every feedback outcome/;
const unknownFailure = /✖ Firebase answered-feedback DTO rejects unknown history before transport without relabeling it/;
const answerFailure = /✖ Firebase answered-feedback DTO preserves explicit helped and still-urging answers through the real callable contract/;

async function runAccuracy(mutation) {
  const result = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, platform: "node", format: "cjs", target: "node20", logLevel: "silent",
    external: ["expo", "expo-*", "react-native", "react-native-*", "lucide-react-native"],
    plugins: mutation ? [{
      name: "in-memory-accuracy-negative",
      setup(build) {
        build.onLoad({ filter: /\/(?:challenge-generator|firebase-client)\.ts$/ }, ({ path }) => {
          if (path !== resolve(__dirname, "..", mutation.file)) return;
          const source = readFileSync(path, "utf8");
          assert.equal(source.split(mutation.before).length - 1, 1, `Unique real dependency target: ${mutation.name}`);
          const contents = source.replace(mutation.before, mutation.after);
          assert.notEqual(contents, source, `Dependency mutation must change source: ${mutation.name}`);
          return { contents, loader: "ts" };
        });
      }
    }] : []
  });
  // Bundle and execute in memory; source files are never replaced, and all transports are test doubles.
  const childEnvironment = { ...process.env, FORCE_COLOR: "0" };
  // A nested node:test worker otherwise emits its internal binary protocol to stdout.
  delete childEnvironment.NODE_TEST_CONTEXT;
  const executed = spawnSync(process.execPath, ["--input-type=commonjs", "--test-reporter=spec"], {
    cwd: resolve(__dirname, ".."), input: result.outputFiles[0].text, encoding: "utf8", timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
    env: childEnvironment
  });
  if (executed.error) throw executed.error;
  return { status: executed.status, output: executed.stdout + executed.stderr };
}

test("recovery accuracy contracts reject real local-generation and legacy DTO privacy regressions in memory", async t => {
  try {
    const baseline = await runAccuracy();
    assert.equal(baseline.status, 0, baseline.output);
    assert.match(baseline.output, /pass 20/);
    const mutations = [
      {
        name: "remote hint regains authority", file: "src/lib/challenge-generator.ts",
        before: "mode: 'local',", after: "mode: options.mode ?? 'local',", expected: localFailure
      },
      {
        name: "local branch invokes configured provider", file: "src/lib/challenge-generator.ts",
        before: 'if (config.mode === "local") return fallback;',
        after: 'if (config.mode === "local") { if (remoteChallengeProvider) await remoteChallengeProvider(buildChallengeGenerationRequest(profile)); return fallback; }',
        expected: localFailure
      },
      {
        name: "local generation relabels unknown feedback", file: "src/lib/challenge-generator.ts",
        before: "const fallback = select(generateChallengeSet(profile));",
        after: 'if (profile.challengeHistory) profile.challengeHistory = profile.challengeHistory.map(item => ({ ...item, outcome: item.outcome === "unknown" ? "helped" : item.outcome }));\n  const fallback = select(generateChallengeSet(profile));',
        expected: localFailure
      },
      {
        name: "legacy validator permits unknown feedback", file: "src/lib/firebase-client.ts",
        before: 'isEnum(entry.outcome, ["helped", "still-urging"] as const)',
        after: 'isEnum(entry.outcome, ["helped", "still-urging", "unknown"] as const)', expected: unknownFailure
      },
      {
        name: "legacy callable silently discards unknown before validation", file: "src/lib/firebase-client.ts",
        before: "assertFirebaseChallengeRequest(payload);",
        after: 'payload.recentChallengeHistory = payload.recentChallengeHistory.filter(item => item.outcome !== "unknown");\n      assertFirebaseChallengeRequest(payload);',
        expected: unknownFailure
      },
      {
        name: "legacy callable remaps a still-urging answer", file: "src/lib/firebase-client.ts",
        before: 'transport.call("generateChallenges", payload)',
        after: 'transport.call("generateChallenges", { ...payload, recentChallengeHistory: payload.recentChallengeHistory.map(item => ({ ...item, outcome: item.outcome === "still-urging" ? "helped" : item.outcome })) })',
        expected: answerFailure
      },
      {
        name: "legacy callable adds unrequested private body fields", file: "src/lib/firebase-client.ts",
        before: 'transport.call("generateChallenges", payload)',
        after: 'transport.call("generateChallenges", { ...payload, deviceBrowsingHistory: ["https://example.invalid/private"] })',
        expected: answerFailure
      }
    ];
    for (const mutation of mutations) {
      const result = await runAccuracy(mutation);
      assert.equal(result.status, 1, `${mutation.name}\n${result.output}`);
      assert.match(result.output, mutation.expected, `${mutation.name}\n${result.output}`);
      assert.doesNotMatch(result.output, /SyntaxError|Cannot find module|Error: Build failed/, mutation.name);
      t.diagnostic(`Changed and rejected: ${mutation.name}`);
    }
  } finally { await esbuild.stop(); }
});
