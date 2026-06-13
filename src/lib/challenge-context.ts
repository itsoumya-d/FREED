import type { ChallengeContextSignal } from "@/lib/recovery-engine";
import { readBoundedResponseJson } from "@/lib/bounded-response-json";
import { getProductionEndpointIssues } from "@/lib/endpoint-safety";

type CheckInContext = {
  mood: "low" | "steady" | "energized" | "stressed";
  urgeLevel: number;
  sleepQuality: number;
};

type WeatherPayload = {
  current?: {
    temperature_2m?: unknown;
    weather_code?: unknown;
  };
  current_weather?: {
    temperature?: unknown;
    weathercode?: unknown;
  };
};

const DEFAULT_CHALLENGE_WEATHER_TIMEOUT_MS = 5_000;
const MIN_CHALLENGE_WEATHER_TIMEOUT_MS = 500;
const MAX_CHALLENGE_WEATHER_TIMEOUT_MS = 15_000;
const DEFAULT_CHALLENGE_WEATHER_RESPONSE_MAX_BYTES = 128_000;
const MIN_CHALLENGE_WEATHER_RESPONSE_MAX_BYTES = 1_024;
const MAX_CHALLENGE_WEATHER_RESPONSE_MAX_BYTES = 1_000_000;

export type ChallengeGeoPoint = {
  latitude: number;
  longitude: number;
};

export type ChallengeWeatherContextConfig = {
  enabled: boolean;
  endpointUrl: string | null;
  timeoutMs: number;
  responseMaxBytes: number;
};

const defaultWeatherEndpoint = "https://api.open-meteo.com/v1/forecast";

function readPublicEnv(key: string, env: Record<string, string | undefined>) {
  const value = env[key];
  return value && value.trim() ? value.trim() : null;
}

function sanitizeWeatherEndpoint(value: string | null) {
  if (!value) return null;
  const raw = value;
  try {
    if (getProductionEndpointIssues(raw, "challenge weather endpoint").length > 0) return null;
    const url = new URL(raw);
    if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function getChallengeWeatherContextConfig(env: Record<string, string | undefined> = process.env): ChallengeWeatherContextConfig {
  const requested = readPublicEnv("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENABLED", env) === "true";
  const endpointUrl = requested ? sanitizeWeatherEndpoint(readPublicEnv("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_ENDPOINT", env)) : null;
  return {
    enabled: requested && endpointUrl !== null,
    endpointUrl,
    timeoutMs: normalizeBoundedInteger(
      readPublicEnv("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_TIMEOUT_MS", env),
      DEFAULT_CHALLENGE_WEATHER_TIMEOUT_MS,
      MIN_CHALLENGE_WEATHER_TIMEOUT_MS,
      MAX_CHALLENGE_WEATHER_TIMEOUT_MS
    ),
    responseMaxBytes: normalizeBoundedInteger(
      readPublicEnv("EXPO_PUBLIC_CHALLENGE_WEATHER_CONTEXT_RESPONSE_MAX_BYTES", env),
      DEFAULT_CHALLENGE_WEATHER_RESPONSE_MAX_BYTES,
      MIN_CHALLENGE_WEATHER_RESPONSE_MAX_BYTES,
      MAX_CHALLENGE_WEATHER_RESPONSE_MAX_BYTES
    )
  };
}

export function deriveChallengeEnergyLevel(checkIn: CheckInContext | null): ChallengeContextSignal["energyLevel"] {
  if (!checkIn) return null;
  if (checkIn.sleepQuality <= 2 || checkIn.mood === "low") return "low";
  if (checkIn.sleepQuality >= 4 && checkIn.urgeLevel <= 2 && checkIn.mood === "energized") return "high";
  return "steady";
}

export function buildChallengeContextSignals(checkIn: CheckInContext | null): ChallengeContextSignal {
  return {
    energyLevel: deriveChallengeEnergyLevel(checkIn),
    urgeLevel: checkIn ? checkIn.urgeLevel : null,
    sleepQuality: checkIn ? checkIn.sleepQuality : null,
    locationPermission: "unknown",
    weatherCondition: null,
    temperatureC: null
  };
}

export function permissionStatusToChallengeSignal(status: string | null | undefined): ChallengeContextSignal["locationPermission"] {
  if (status === "granted" || status === "denied" || status === "undetermined") return status;
  return "unknown";
}

function roundedCoordinate(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}

export function buildOpenMeteoWeatherUrl(point: ChallengeGeoPoint, endpointUrl = defaultWeatherEndpoint): string | null {
  const latitude = roundedCoordinate(point.latitude);
  const longitude = roundedCoordinate(point.longitude);
  if (latitude === null || longitude === null) return null;

  const endpoint = sanitizeWeatherEndpoint(endpointUrl);
  if (!endpoint) return null;
  const url = new URL(endpoint);
  url.searchParams.set("latitude", latitude.toFixed(1));
  url.searchParams.set("longitude", longitude.toFixed(1));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");
  return url.toString();
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function weatherCodeToCondition(code: number | null, temperatureC: number | null): ChallengeContextSignal["weatherCondition"] {
  if (code !== null) {
    if (code === 0) {
      if (temperatureC !== null && temperatureC >= 34) return "hot";
      if (temperatureC !== null && temperatureC <= 0) return "cold";
      return "clear";
    }
    if ((code >= 1 && code <= 3) || code === 45 || code === 48) return "cloudy";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
    if (code >= 95 && code <= 99) return "storm";
  }
  if (temperatureC !== null && temperatureC >= 34) return "hot";
  if (temperatureC !== null && temperatureC <= 0) return "cold";
  return code === null && temperatureC === null ? null : "unknown";
}

export async function fetchChallengeWeatherContext(
  point: ChallengeGeoPoint,
  fetcher: typeof fetch = fetch,
  config = getChallengeWeatherContextConfig()
): Promise<Pick<ChallengeContextSignal, "weatherCondition" | "temperatureC">> {
  const empty = { weatherCondition: null, temperatureC: null };
  if (!config.enabled || !config.endpointUrl || typeof fetcher !== "function") return empty;
  const url = buildOpenMeteoWeatherUrl(point, config.endpointUrl);
  if (!url) return empty;

  try {
    const response = await fetchChallengeWeatherResponse(fetcher, url, config.timeoutMs);
    if (!response.ok) return empty;
    const payload = (await readBoundedResponseJson(response, {
      timeoutMs: config.timeoutMs,
      maxBytes: config.responseMaxBytes,
      label: "Challenge weather response"
    })) as WeatherPayload;
    const temperatureC = numeric(payload.current?.temperature_2m) ?? numeric(payload.current_weather?.temperature);
    const weatherCode = numeric(payload.current?.weather_code) ?? numeric(payload.current_weather?.weathercode);
    return {
      weatherCondition: weatherCodeToCondition(weatherCode, temperatureC),
      temperatureC: temperatureC === null ? null : Math.round(temperatureC)
    };
  } catch {
    return empty;
  }
}

function normalizeBoundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function fetchChallengeWeatherResponse(fetcher: typeof fetch, url: string, timeoutMs: number) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Challenge weather request timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(url, controller ? { signal: controller.signal } : undefined),
      timeoutPromise
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
