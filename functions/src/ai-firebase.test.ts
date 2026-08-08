import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createAiService } from "./ai.js";

import {
  AI_REMOTE_CONFIG_PARAMETERS,
  createAiFeatureGateReader,
  readAiFeatureGateTemplate
} from "./ai-firebase.js";

const enabledTemplate = {
  parameters: {
    ai_clara_enabled: { defaultValue: { value: "true" } },
    ai_challenges_enabled: { defaultValue: { value: "false" } },
    ai_retention_enabled: { defaultValue: { value: "false" } }
  }
};

test("server feature gates require exact Remote Config parameter values", () => {
  assert.deepEqual(AI_REMOTE_CONFIG_PARAMETERS, {
    clara: "ai_clara_enabled",
    challenges: "ai_challenges_enabled",
    retention: "ai_retention_enabled"
  });
  assert.equal(readAiFeatureGateTemplate(enabledTemplate, "clara"), "enabled");
  assert.equal(readAiFeatureGateTemplate(enabledTemplate, "challenges"), "disabled");
  for (const malformed of [
    {},
    { parameters: {} },
    { parameters: { ai_clara_enabled: {} } },
    { parameters: { ai_clara_enabled: { defaultValue: { value: true } } } },
    { parameters: { ai_clara_enabled: { defaultValue: { value: "TRUE" } } } }
  ]) {
    assert.equal(readAiFeatureGateTemplate(malformed, "clara"), "unavailable");
  }
});

test("expired or failed Remote Config reads never reuse stale enabled state", async () => {
  let clock = 1_000;
  let calls = 0;
  let fail = false;
  const reader = createAiFeatureGateReader(async () => {
    calls += 1;
    if (fail) throw new Error("template unavailable");
    return enabledTemplate;
  }, () => clock, 60_000);

  assert.equal(await reader("clara"), "enabled");
  assert.equal(await reader("clara"), "enabled");
  assert.equal(calls, 1);
  fail = true;
  clock += 60_001;
  assert.equal(await reader("clara"), "unavailable");
  assert.equal(calls, 2);
});

test("Remote Config retrieval has a hard timeout and returns unavailable", async () => {
  const startedAt = Date.now();
  let providerCalls = 0;
  const reader = createAiFeatureGateReader(
    () => new Promise(() => undefined),
    () => 1_000,
    60_000,
    5
  );
  const service = createAiService({
    now: () => 1_000,
    getFeatureGate: reader,
    getApiKey: () => "unused-secret",
    authorize: async () => "allowed",
    persistEvent: async () => undefined,
    fetch: async () => {
      providerCalls += 1;
      return Response.json({});
    }
  });
  const result = await service.generateClara("uid-safe", {
    clientEventId: "evt_timeout123",
    input: "Help me reset.",
    context: { streakDays: 1, attemptsToday: 1, premium: false, slipsThisWeek: 0, slipWindow: null, slipTrigger: null }
  });
  assert.equal(result.provider, "fallback");
  assert.equal(providerCalls, 0);
  assert.ok(Date.now() - startedAt < 100, "Remote Config timeout must fail closed promptly in the test harness.");
});

test("all AI callables bind Auth, App Check, region, and the Secret Manager key", () => {
  const source = readFileSync("src/ai-firebase.ts", "utf8");
  const coreSource = readFileSync("src/ai.ts", "utf8");
  const index = readFileSync("src/index.ts", "utf8");
  assert.match(source, /defineSecret\("OPENAI_API_KEY"\)/);
  assert.doesNotMatch(source, /process\.env\.OPENAI_API_KEY/);
  for (const name of ["generateClaraReply", "generateChallenges", "generateRetentionPlan"]) {
    assert.match(source, new RegExp(`export const ${name} = onCall\\([\\s\\S]*?region: REGION, enforceAppCheck: true, secrets: \\[OPENAI_API_KEY\\]`));
    assert.match(index, new RegExp(name));
  }
  assert.equal(source.match(/requireAuthenticatedUid\(request\.auth\?\.uid\)/g)?.length, 3);
  assert.equal(source.match(/region: REGION, enforceAppCheck: true, secrets: \[OPENAI_API_KEY\]/g)?.length, 3);
  assert.match(source, /accountTombstonePath:\s*`\$\{COLLECTIONS\.deletionTombstones\}\/\$\{input\.uid\}`/);
  assert.match(source, /const tombstone = await transaction\.get\(tombstoneReference\);[\s\S]*?if \(tombstone\.exists\) return;[\s\S]*?transaction\.set\(eventReference/);
  assert.match(coreSource, /authorize\(dependencies, uid, "clara", input\.clientEventId, 30\)/);
  assert.match(coreSource, /authorize\(dependencies, uid, "challenges", input\.clientEventId, 20\)/);
  assert.match(coreSource, /authorize\(dependencies, uid, "retention", input\.clientEventId, 10\)/);
});
