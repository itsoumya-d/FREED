import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_MODEL,
  AI_OPENAI_ENDPOINT,
  CRISIS_REPLY,
  createAiService,
  parseChallengeRequest,
  parseClaraRequest,
  parseRetentionRequest,
  type AiAuditEvent,
  type AiFeatureGate,
  type AiRoute,
  type AiServiceDependencies
} from "./ai.js";

const now = Date.parse("2026-07-22T09:00:00.000Z");

const claraRequest = {
  clientEventId: "evt_clara123",
  input: "I need help getting through this urge.",
  context: {
    streakDays: 4,
    attemptsToday: 2,
    premium: false,
    slipsThisWeek: 1,
    slipWindow: "evening",
    slipTrigger: "stress"
  }
};

const challengeRequest = {
  clientEventId: "evt_challenge123",
  profile: {
    streakDays: 4,
    premium: false,
    attemptsToday: 2,
    mood: "stressed",
    hour: 21,
    dayPart: "evening",
    isWeekend: false,
    timezoneOffsetMinutes: -330,
    slipsThisWeek: 1,
    slipWindow: "evening",
    slipTrigger: "stress",
    interventionContext: {
      source: "app",
      category: "unknown",
      surface: "social",
      ruleFamily: "instagram-reels",
      sessionDurationBucket: "1-5m"
    },
    disciplinePreferences: {
      challengeIntensity: "balanced",
      outdoorFrequency: "balanced",
      exercisePreference: "balanced",
      socialFrequency: "low",
      emergencyStrictMode: false,
      sleepModeActive: false,
      deepFocusModeActive: false,
      weekendModeEnabled: false,
      unlockDurationMinutes: 10,
      dailyLimitMinutes: 60
    },
    contextSignals: {
      energyLevel: "steady",
      urgeLevel: 3,
      sleepQuality: 4,
      locationPermission: "denied",
      weatherCondition: "unknown",
      temperatureC: null
    },
    riskForecast: {
      level: "elevated",
      score: 65,
      confidence: "medium",
      currentWindow: "evening",
      drivers: ["low-sleep", "mood-support"]
    },
    recentFailureCount: 1,
    preferredCategories: ["breathing", "reset"]
  },
  recentChallengeHistory: [
    { id: "breathing-478", category: "breathing", outcome: "helped", completedAt: "2026-07-21T20:00:00.000Z" }
  ]
};

const retentionRequest = {
  clientEventId: "evt_retention123",
  profile: {
    premium: false,
    streakDays: 4,
    bestStreakDays: 9,
    attemptsThisWeek: 7,
    slipsThisWeek: 1,
    checkInsThisWeek: 4,
    completedChallengesThisWeek: 3,
    averageUrge: 2.5,
    averageSleep: 3.5,
    steadyDays: 3,
    riskWindow: "evening",
    slipWindow: "evening",
    slipTrigger: "stress",
    bestIntervention: "breathing",
    momentum: "stable",
    urgeRiskForecast: {
      level: "elevated",
      score: 65,
      confidence: "medium",
      currentWindow: "evening",
      drivers: ["low-sleep", "mood-support"]
    },
    enabledReminderKeys: ["morning", "guard"],
    smartGuardTime: "21:45",
    smartGuardSource: "risk-window",
    localDateKey: "2026-07-22",
    timezoneOffsetMinutes: -330
  }
};

const remoteChallenges = {
  challenges: [
    challenge("reset-breathe", "Breathing reset", "breathing", "calm"),
    challenge("reset-room", "Change rooms", "reset", "medium"),
    challenge("reset-note", "Name the next step", "reflection", "calm")
  ]
};

test("AI inputs use exact bounded aggregate allowlists", () => {
  assert.deepEqual(parseClaraRequest(claraRequest), claraRequest);
  assert.deepEqual(parseChallengeRequest(challengeRequest), challengeRequest);
  assert.deepEqual(parseRetentionRequest(retentionRequest), retentionRequest);

  for (const [parser, input] of [
    [parseClaraRequest, claraRequest],
    [parseChallengeRequest, challengeRequest],
    [parseRetentionRequest, retentionRequest]
  ] as const) {
    assert.throws(() => parser({ ...input, url: "https://private.example/path" }), /not permitted/i);
    assert.throws(() => parser({ ...input, notes: "private" }), /not permitted/i);
    assert.throws(() => parser({ ...input, clientEventId: "x" }), /not permitted/i);
  }
  assert.throws(() => parseClaraRequest({ ...claraRequest, input: "x".repeat(1_201) }), /not permitted/i);
  assert.throws(() => parseClaraRequest({ ...claraRequest, context: { ...claraRequest.context, recentRiskHosts: ["private.example"] } }), /not permitted/i);
  assert.throws(() => parseChallengeRequest({ ...challengeRequest, profile: { ...challengeRequest.profile, ruleFamily: "private.example" } }), /not permitted/i);
  assert.throws(() => parseRetentionRequest({ ...retentionRequest, profile: { ...retentionRequest.profile, browsingHistory: [] } }), /not permitted/i);
});

test("provider-bound profile text accepts only established coarse signal values", () => {
  for (const profile of [
    { ...challengeRequest.profile, slipWindow: "private diary details about last night" },
    { ...challengeRequest.profile, slipTrigger: "argument with a named person" },
    { ...challengeRequest.profile, riskForecast: { ...challengeRequest.profile.riskForecast, drivers: ["private note content"] } },
    { ...challengeRequest.profile, riskForecast: { ...challengeRequest.profile.riskForecast, currentWindow: "after messaging a named person" } }
  ]) {
    assert.throws(() => parseChallengeRequest({ ...challengeRequest, profile }), /not permitted/i);
  }
  for (const profile of [
    { ...retentionRequest.profile, riskWindow: "private journal detail" },
    { ...retentionRequest.profile, slipTrigger: "named contact and secret" },
    { ...retentionRequest.profile, bestIntervention: "my custom private note" },
    { ...retentionRequest.profile, momentum: "private narrative about a relapse" },
    { ...retentionRequest.profile, urgeRiskForecast: { ...retentionRequest.profile.urgeRiskForecast, drivers: ["private transcript"] } }
  ]) {
    assert.throws(() => parseRetentionRequest({ ...retentionRequest, profile }), /not permitted/i);
  }
});

test("kill switches fail safe without calling OpenAI", async () => {
  for (const gate of ["disabled", "unavailable"] satisfies AiFeatureGate[]) {
    const harness = serviceHarness({ gate });
    const result = await harness.service.generateClara("uid-safe", claraRequest);
    assert.equal(result.provider, "fallback");
    assert.equal(result.status, "fallback");
    assert.equal(result.reason, gate === "disabled" ? "provider-disabled" : "configuration-unavailable");
    assert.equal(harness.fetchCalls.length, 0);
  }
});

test("crisis input returns fixed local support before feature gates or OpenAI", async () => {
  const harness = serviceHarness({ gate: "enabled" });
  const result = await harness.service.generateClara("uid-safe", {
    ...claraRequest,
    input: "I am going to kill myself right now"
  });
  assert.deepEqual(result, {
    text: CRISIS_REPLY,
    provider: "fallback",
    status: "fallback",
    reason: "crisis-support"
  });
  assert.equal(harness.fetchCalls.length, 0);
  assert.equal(harness.gateCalls.length, 0);
  assert.equal(harness.events.length, 1);
  assert.equal(harness.events[0]?.crisisFallback, true);
  assertNoSensitiveAuditFields(harness.events[0]);
});

test("established crisis phrases override duplicate/idempotency handling", async () => {
  for (const input of ["I want to die", "I can't stay safe", "I cannot stay safe"]) {
    const harness = serviceHarness({ gate: "enabled", authorization: "duplicate" });
    const result = await harness.service.generateClara("uid-safe", { ...claraRequest, input });
    assert.deepEqual(result, {
      text: CRISIS_REPLY,
      provider: "fallback",
      status: "fallback",
      reason: "crisis-support"
    });
    assert.equal(harness.authorizationCalls.length, 0);
    assert.equal(harness.gateCalls.length, 0);
    assert.equal(harness.fetchCalls.length, 0);
  }
});

test("OpenAI request is one bounded, non-stored, strict Responses API call with no identity metadata", async () => {
  const harness = serviceHarness({
    response: openAiResponse({ text: "Put the phone down, take three slow breaths, and step into another room." })
  });
  const result = await harness.service.generateClara("firebase-uid-secret", claraRequest);
  assert.deepEqual(result, {
    text: "Put the phone down, take three slow breaths, and step into another room.",
    provider: "remote",
    status: "ok"
  });
  assert.equal(harness.fetchCalls.length, 1);
  const call = harness.fetchCalls[0];
  assert.equal(call?.url, AI_OPENAI_ENDPOINT);
  assert.equal(call?.init.redirect, "error");
  assert.equal(call?.init.method, "POST");
  assert.ok(call?.init.signal instanceof AbortSignal);
  const outbound = JSON.parse(String(call?.init.body)) as Record<string, unknown>;
  assert.equal(outbound.model, AI_MODEL);
  assert.equal(outbound.store, false);
  assert.equal(outbound.max_output_tokens, 450);
  assert.deepEqual(outbound.reasoning, { effort: "none" });
  assert.deepEqual((outbound.text as { format: { type: string; strict: boolean } }).format.type, "json_schema");
  assert.equal((outbound.text as { format: { type: string; strict: boolean } }).format.strict, true);
  const serialized = JSON.stringify(outbound);
  assert.doesNotMatch(serialized, /firebase-uid-secret|evt_clara123|private\.example/i);
  assert.equal(harness.events.length, 1);
  assertNoSensitiveAuditFields(harness.events[0]);
});

test("provider failures and invalid envelopes collapse to fixed local fallbacks", async () => {
  const cases: Array<Response | Error> = [
    new Response("downstream secret", { status: 503, headers: { "content-type": "text/plain" } }),
    new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    new Response("not json", { status: 200, headers: { "content-type": "application/json" } }),
    openAiResponse({ text: "" }),
    openAiRefusalResponse(),
    new Response("x".repeat(256 * 1024 + 1), { status: 200, headers: { "content-type": "application/json" } }),
    new Error("OPENAI_API_KEY=never-leak")
  ];
  for (const response of cases) {
    const harness = serviceHarness({ response });
    const result = await harness.service.generateClara("uid-safe", claraRequest);
    assert.equal(result.provider, "fallback");
    assert.equal(result.status, "fallback");
    assert.ok(result.reason === "provider-unavailable" || result.reason === "invalid-provider-response");
    assert.doesNotMatch(JSON.stringify(result), /OPENAI|downstream secret|cannot comply/i);
    assertNoSensitiveAuditFields(harness.events[0]);
  }
});

test("the hard timeout aborts the one provider request and returns a fixed fallback", async () => {
  const harness = serviceHarness({ response: "timeout", timeoutMs: 5 });
  const result = await harness.service.generateClara("uid-safe", claraRequest);
  assert.equal(result.provider, "fallback");
  if (result.provider !== "fallback") assert.fail("Timeout must use the local fallback.");
  assert.equal(result.reason, "provider-unavailable");
  assert.equal(harness.fetchCalls.length, 1);
});

test("challenge output is exact, non-premium, sanitized, unique, bounded, and safe", async () => {
  const harness = serviceHarness({ response: openAiResponse(remoteChallenges) });
  const result = await harness.service.generateChallenges("uid-safe", challengeRequest);
  assert.equal(result.provider, "remote");
  assert.equal(result.status, "ok");
  assert.equal(result.challenges.length, 3);
  assert.equal(new Set(result.challenges.map((item) => item.id)).size, 3);
  for (const item of result.challenges) {
    assert.equal(item.premium, false);
    assert.ok(item.durationSec >= 30 && item.durationSec <= 900);
    assert.ok(item.steps.length >= 2 && item.steps.length <= 4);
  }
  const providerBody = JSON.parse(String(harness.fetchCalls[0]?.init.body)) as {
    input: Array<{ role: string; content: Array<{ text: string }> }>;
  };
  const providerProfile = providerBody.input.find((item) => item.role === "user")?.content[0]?.text ?? "";
  assert.doesNotMatch(providerProfile, /breathing-478|completedAt|2026-07-21T20:00:00\.000Z/);
  assert.match(providerProfile, /recentChallengeSummary/);

  for (const invalid of [
    { challenges: remoteChallenges.challenges.slice(0, 2) },
    { challenges: remoteChallenges.challenges.map((item, index) => index === 0 ? { ...item, premium: true } : item) },
    { challenges: remoteChallenges.challenges.map((item, index) => index === 0 ? { ...item, steps: ["Drive to another place", "Come back"] } : item) },
    { challenges: remoteChallenges.challenges.map((item) => ({ ...item, id: "duplicate" })) }
  ]) {
    const invalidHarness = serviceHarness({ response: openAiResponse(invalid) });
    const fallback = await invalidHarness.service.generateChallenges("uid-safe", challengeRequest);
    assert.equal(fallback.provider, "fallback");
    assert.equal(fallback.status, "fallback");
    assert.equal(fallback.challenges.length, 3);
    assert.equal(fallback.reason, "invalid-provider-response");
  }
});

test("all remote output routes reject unsafe recovery language without rejecting safe copy", async () => {
  for (const text of [
    "You are disgusting and weak.",
    "Double your medication dose tonight.",
    "Use explicit sexual content as a reward."
  ]) {
    const harness = serviceHarness({ response: openAiResponse({ text }) });
    const result = await harness.service.generateClara("uid-safe", claraRequest);
    assert.equal(result.provider, "fallback");
    if (result.provider !== "fallback") assert.fail("Unsafe CLARA output must fail closed.");
    assert.equal(result.reason, "invalid-provider-response");
  }

  for (const unsafeStep of ["Sprint until you vomit.", "Hold a plank for 20 minutes.", "Do 500 pushups without stopping."]) {
    const unsafe = {
      challenges: remoteChallenges.challenges.map((item, index) => index === 0 ? { ...item, steps: [unsafeStep, "Come back when finished."] } : item)
    };
    const harness = serviceHarness({ response: openAiResponse(unsafe) });
    const result = await harness.service.generateChallenges("uid-safe", challengeRequest);
    assert.equal(result.provider, "fallback");
    if (result.provider !== "fallback") assert.fail("Unsafe challenge output must fail closed.");
    assert.equal(result.reason, "invalid-provider-response");
  }

  const unsafeRetention = {
    headline: "Prove you are not a failure.",
    nextBestAction: "Sprint until you vomit.",
    checkInPrompt: "Did punishment work?",
    suggestedGuardTime: "21:45",
    focusTags: ["punishment"]
  };
  const unsafeHarness = serviceHarness({ response: openAiResponse(unsafeRetention) });
  const unsafeResult = await unsafeHarness.service.generateRetentionPlan("uid-safe", retentionRequest);
  assert.equal(unsafeResult.provider, "fallback");
  if (unsafeResult.provider !== "fallback") assert.fail("Unsafe retention output must fail closed.");
  assert.equal(unsafeResult.reason, "invalid-provider-response");

  for (const text of [
    "Take a short walk, breathe slowly, and contact a trusted person if you need support.",
    "Do not use punishment; choose one calm reset and treat the setback as useful data."
  ]) {
    const safeHarness = serviceHarness({ response: openAiResponse({ text }) });
    assert.equal((await safeHarness.service.generateClara("uid-safe", claraRequest)).provider, "remote");
  }
});

test("retention uses only aggregate input and enforces its exact normalized schema", async () => {
  const remote = {
    headline: "Protect tonight's steady progress.",
    nextBestAction: "Set the guard reminder, then leave the phone outside the bedroom.",
    checkInPrompt: "What will make the next hour easier?",
    suggestedGuardTime: "21:45",
    focusTags: ["guard-time", "phone-boundary"]
  };
  const harness = serviceHarness({ response: openAiResponse(remote) });
  const result = await harness.service.generateRetentionPlan("uid-safe", retentionRequest);
  assert.deepEqual(result, { ...remote, provider: "remote", status: "ok" });
  const outbound = JSON.parse(String(harness.fetchCalls[0]?.init.body)) as {
    input: Array<{ role: string; content: Array<{ text: string }> }>;
  };
  const userPayload = outbound.input.find((item) => item.role === "user")?.content[0]?.text ?? "";
  assert.doesNotMatch(userPayload, /evt_retention123|uid-safe|notes|contacts|history|transcript/i);

  for (const invalid of [
    { ...remote, suggestedGuardTime: "25:00" },
    { ...remote, focusTags: [] },
    { ...remote, provider: "openai" },
    { ...remote, headline: "x".repeat(91) }
  ]) {
    const invalidHarness = serviceHarness({ response: openAiResponse(invalid) });
    const fallback = await invalidHarness.service.generateRetentionPlan("uid-safe", retentionRequest);
    assert.equal(fallback.provider, "fallback");
    assert.equal(fallback.status, "fallback");
    assert.equal(fallback.reason, "invalid-provider-response");
  }
});

test("duplicate calls fallback without provider access while limits and account deletion fail closed", async () => {
  const duplicate = serviceHarness({ authorization: "duplicate" });
  const duplicateResult = await duplicate.service.generateClara("uid-safe", claraRequest);
  assert.equal(duplicateResult.provider, "fallback");
  if (duplicateResult.provider !== "fallback") assert.fail("A duplicate request must use the local fallback.");
  assert.equal(duplicateResult.reason, "duplicate-request");
  assert.equal(duplicate.fetchCalls.length, 0);

  for (const authorization of ["rate-limited", "account-deleting"] as const) {
    const harness = serviceHarness({ authorization });
    await assert.rejects(() => harness.service.generateClara("uid-safe", claraRequest), new RegExp(authorization));
    assert.equal(harness.fetchCalls.length, 0);
  }
});

function serviceHarness(options: {
  gate?: AiFeatureGate;
  response?: Response | Error | "timeout";
  authorization?: "allowed" | "duplicate" | "rate-limited" | "account-deleting";
  timeoutMs?: number;
} = {}) {
  const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
  const events: AiAuditEvent[] = [];
  const gateCalls: AiRoute[] = [];
  const authorizationCalls: Array<{ route: AiRoute; clientEventId: string }> = [];
  const dependencies: AiServiceDependencies = {
    now: () => now,
    getFeatureGate: async (route) => {
      gateCalls.push(route);
      return options.gate ?? "enabled";
    },
    getApiKey: () => "server-secret",
    authorize: async (input) => {
      authorizationCalls.push({ route: input.route, clientEventId: input.clientEventId });
      return options.authorization ?? "allowed";
    },
    persistEvent: async (event) => {
      events.push(event);
    },
    fetch: async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      if (options.response === "timeout") {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      }
      if (options.response instanceof Error) throw options.response;
      return options.response ?? openAiResponse({ text: "Take one slow breath and move the phone out of reach." });
    },
    timeoutMs: options.timeoutMs
  };
  return { service: createAiService(dependencies), fetchCalls, events, gateCalls, authorizationCalls };
}

function openAiResponse(value: unknown): Response {
  const text = typeof value === "object" && value !== null && "text" in value && Object.keys(value).length === 1
    ? JSON.stringify(value)
    : JSON.stringify(value);
  return Response.json({
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text }] }]
  });
}

function openAiRefusalResponse(): Response {
  return Response.json({
    status: "completed",
    output: [{ type: "message", content: [{ type: "refusal", refusal: "cannot comply" }] }]
  });
}

function challenge(id: string, title: string, category: string, intensity: string) {
  return {
    id,
    title,
    category,
    durationSec: 120,
    intensity,
    premium: false,
    icon: "Activity",
    steps: ["Put the phone down.", "Take three slow breaths."],
    why: "A short reset interrupts the automatic loop."
  };
}

function assertNoSensitiveAuditFields(event: AiAuditEvent | undefined) {
  assert.ok(event);
  assert.deepEqual(Object.keys(event).sort(), [
    "createdAt",
    "crisisFallback",
    "eventType",
    "expiresAt",
    "generatedItemCount",
    "inputCharacterCount",
    "model",
    "outcome",
    "outputCharacterCount",
    "provider",
    "uid"
  ]);
  assert.doesNotMatch(JSON.stringify(event), /urge|private|prompt|response|OPENAI_API_KEY/i);
}
