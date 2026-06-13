import {
  isGoogleAiApiKey,
  isOpenAiApiKey,
  isUsableRemoteModelId
} from "@/lib/server-credential-safety";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";

export type ServerAiProviderName = "openai" | "gemini";

export type ServerAiResponseFormat = "text" | "json";

export type ServerAiTextRequest = {
  taskName: string;
  systemInstruction: string;
  userPrompt: string;
  responseFormat: ServerAiResponseFormat;
  jsonResponseSchema?: Record<string, unknown>;
  responseFormatName?: string;
  geminiResponseSchema?: Record<string, unknown>;
  maxOutputTokens: number;
  temperature?: number;
  topP?: number;
};

export type ServerAiProviderConfig = {
  provider: ServerAiProviderName;
  apiKey: string;
  model: string;
  timeoutMs: number;
  responseMaxBytes: number;
};

type ServerAiEnvironment = Record<string, string | undefined>;

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_SERVER_AI_PROVIDER_TIMEOUT_MS = 12_000;
const MIN_SERVER_AI_PROVIDER_TIMEOUT_MS = 500;
const MAX_SERVER_AI_PROVIDER_TIMEOUT_MS = 60_000;
const DEFAULT_SERVER_AI_PROVIDER_RESPONSE_MAX_BYTES = 1_000_000;
const MIN_SERVER_AI_PROVIDER_RESPONSE_MAX_BYTES = 10_000;
const MAX_SERVER_AI_PROVIDER_RESPONSE_MAX_BYTES = 5_000_000;

const GEMINI_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
];

function readEnv(env: ServerAiEnvironment, key: string) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function readProviderOverride(env: ServerAiEnvironment): ServerAiProviderName | null {
  const raw = (readEnv(env, "FREED_AI_PROVIDER") ?? readEnv(env, "AI_PROVIDER"))?.toLowerCase();
  if (!raw) return null;
  if (raw === "openai" || raw === "gemini") return raw;
  throw new Error("FREED_AI_PROVIDER must be openai or gemini.");
}

function readOpenAiKey(env: ServerAiEnvironment) {
  const value = readEnv(env, "OPENAI_API_KEY");
  return isOpenAiApiKey(value) ? value : null;
}

function readGeminiKey(env: ServerAiEnvironment) {
  for (const key of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY"]) {
    const value = readEnv(env, key);
    if (isGoogleAiApiKey(value)) return value;
  }
  return null;
}

function readProviderModel(env: ServerAiEnvironment, provider: ServerAiProviderName) {
  const key = provider === "openai" ? "OPENAI_MODEL" : "GEMINI_MODEL";
  const fallback = provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_GEMINI_MODEL;
  const value = readEnv(env, key);
  if (!value) return fallback;
  if (!isUsableRemoteModelId(value)) throw new Error(`${key} must be a concrete remote provider model id.`);
  return value;
}

function readConfiguredProviderModel(env: ServerAiEnvironment, provider: ServerAiProviderName) {
  const key = provider === "openai" ? "OPENAI_MODEL" : "GEMINI_MODEL";
  const value = readEnv(env, key);
  return value && isUsableRemoteModelId(value) ? value : null;
}

function readServerAiProviderTimeoutMs(env: ServerAiEnvironment) {
  return normalizeServerAiProviderTimeoutMs(readEnv(env, "FREED_AI_PROVIDER_TIMEOUT_MS"));
}

function readServerAiProviderResponseMaxBytes(env: ServerAiEnvironment) {
  return normalizeServerAiProviderResponseMaxBytes(readEnv(env, "FREED_AI_PROVIDER_RESPONSE_MAX_BYTES"));
}

export function readConfiguredServerAiModel(env: ServerAiEnvironment = process.env) {
  const provider = readProviderOverride(env);
  if (provider === "openai") return readConfiguredProviderModel(env, "openai");
  if (provider === "gemini") return readConfiguredProviderModel(env, "gemini");
  if (readOpenAiKey(env)) return readConfiguredProviderModel(env, "openai");
  if (readGeminiKey(env)) return readConfiguredProviderModel(env, "gemini");
  return readConfiguredProviderModel(env, "openai") ?? readConfiguredProviderModel(env, "gemini");
}

export function readServerAiProviderModel(env: ServerAiEnvironment = process.env) {
  const provider = readProviderOverride(env);
  if (provider === "openai") return readProviderModel(env, "openai");
  if (provider === "gemini") return readProviderModel(env, "gemini");
  if (readOpenAiKey(env)) return readProviderModel(env, "openai");
  return readProviderModel(env, "gemini");
}

export function readServerAiProviderConfig(env: ServerAiEnvironment = process.env): ServerAiProviderConfig {
  const provider = readProviderOverride(env);
  const openAiKey = readOpenAiKey(env);
  const geminiKey = readGeminiKey(env);
  const timeoutMs = readServerAiProviderTimeoutMs(env);
  const responseMaxBytes = readServerAiProviderResponseMaxBytes(env);

  if (provider === "openai") {
    if (!openAiKey) throw new Error("OPENAI_API_KEY is not configured.");
    return {
      provider,
      apiKey: openAiKey,
      model: readProviderModel(env, "openai"),
      timeoutMs,
      responseMaxBytes
    };
  }

  if (provider === "gemini") {
    if (!geminiKey) throw new Error("GEMINI_API_KEY is not configured.");
    return {
      provider,
      apiKey: geminiKey,
      model: readProviderModel(env, "gemini"),
      timeoutMs,
      responseMaxBytes
    };
  }

  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      model: readProviderModel(env, "openai"),
      timeoutMs,
      responseMaxBytes
    };
  }

  if (geminiKey) {
    return {
      provider: "gemini",
      apiKey: geminiKey,
      model: readProviderModel(env, "gemini"),
      timeoutMs,
      responseMaxBytes
    };
  }

  throw new Error("OPENAI_API_KEY or GEMINI_API_KEY is not configured.");
}

export async function createServerAiText(request: ServerAiTextRequest) {
  const config = readServerAiProviderConfig();
  if (config.provider === "openai") return createOpenAiResponse(config, request);
  return createGeminiResponse(config, request);
}

async function createOpenAiResponse(config: ServerAiProviderConfig, request: ServerAiTextRequest) {
  const responseFormat = openAiResponseFormat(request);
  const body: Record<string, unknown> = {
    model: config.model,
    instructions: request.systemInstruction,
    input: request.userPrompt,
    max_output_tokens: request.maxOutputTokens,
    text: {
      format: responseFormat
    }
  };

  if (typeof request.temperature === "number") body.temperature = request.temperature;
  if (typeof request.topP === "number") body.top_p = request.topP;

  const response = await fetchServerAiProviderResponse(
    OPENAI_RESPONSES_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    },
    config.timeoutMs,
    "OpenAI provider request"
  );

  if (!response.ok) throw new Error(`OpenAI returned ${response.status}.`);
  const text = extractOpenAiText(
    await readServerAiProviderJson(response, config.timeoutMs, "OpenAI provider response", config.responseMaxBytes)
  ).trim();
  if (!text) throw new Error(`OpenAI returned an empty ${request.taskName} response.`);
  return text;
}

function openAiResponseFormat(request: ServerAiTextRequest) {
  if (request.responseFormat !== "json") return { type: "text" };

  const schema = request.jsonResponseSchema ?? request.geminiResponseSchema;
  if (!schema) return { type: "json_object" };

  return {
    type: "json_schema",
    name: sanitizeResponseFormatName(request.responseFormatName ?? request.taskName),
    schema,
    strict: true
  };
}

function sanitizeResponseFormatName(value: string) {
  const cleaned = value
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return cleaned || "freed_response";
}

async function createGeminiResponse(config: ServerAiProviderConfig, request: ServerAiTextRequest) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const response = await fetchServerAiProviderResponse(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: request.systemInstruction }] },
        contents: [
          {
            role: "user",
            parts: [{ text: request.userPrompt }]
          }
        ],
        generationConfig: {
          temperature: request.temperature ?? 0.6,
          topP: request.topP ?? 0.9,
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: request.responseFormat === "json" ? "application/json" : "text/plain",
          ...(request.responseFormat === "json" && request.geminiResponseSchema ? { responseSchema: request.geminiResponseSchema } : {})
        },
        safetySettings: GEMINI_SAFETY_SETTINGS
      })
    },
    config.timeoutMs,
    "Gemini provider request"
  );

  if (!response.ok) throw new Error(`Gemini returned ${response.status}.`);
  const text = extractGeminiText(
    await readServerAiProviderJson(response, config.timeoutMs, "Gemini provider response", config.responseMaxBytes)
  ).trim();
  if (!text) throw new Error(`Gemini returned an empty ${request.taskName} response.`);
  return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fetchServerAiProviderResponse(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  timeoutMs: number,
  label: string
) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timedOut = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetch(input, { ...(init ?? {}), ...(controller ? { signal: controller.signal } : {}) }),
      timedOut
    ]);
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
      throw new Error(`${label} timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function readServerAiProviderJson(
  response: Response,
  timeoutMs: number,
  label: string,
  maxBytes: number
): Promise<unknown> {
  return readBoundedResponseJson(response, { timeoutMs, maxBytes, label });
}

function normalizeServerAiProviderTimeoutMs(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SERVER_AI_PROVIDER_TIMEOUT_MS;
  return Math.max(MIN_SERVER_AI_PROVIDER_TIMEOUT_MS, Math.min(MAX_SERVER_AI_PROVIDER_TIMEOUT_MS, Math.round(parsed)));
}

function normalizeServerAiProviderResponseMaxBytes(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_SERVER_AI_PROVIDER_RESPONSE_MAX_BYTES;
  return Math.max(
    MIN_SERVER_AI_PROVIDER_RESPONSE_MAX_BYTES,
    Math.min(MAX_SERVER_AI_PROVIDER_RESPONSE_MAX_BYTES, Math.round(parsed))
  );
}

function extractOpenAiText(payload: unknown): string {
  if (!isRecord(payload)) return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;

  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!isRecord(part)) continue;
      const text = part.text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }

  return "";
}

function extractGeminiText(payload: unknown): string {
  if (!isRecord(payload)) return "";
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const content = candidate.content;
    if (!isRecord(content)) continue;
    const parts = Array.isArray(content.parts) ? content.parts : [];
    for (const part of parts) {
      if (!isRecord(part)) continue;
      const text = part.text;
      if (typeof text === "string" && text.trim()) return text;
    }
  }
  return "";
}
