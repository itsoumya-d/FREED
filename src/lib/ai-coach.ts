import { readClientEnvironmentValue } from "@/lib/public-client-env";
import { BlockingAttempt } from "@/lib/blocking-engine";
import { getProductionEndpointIssues } from "@/lib/endpoint-safety";
import { generateCoachReply, isCrisisSupportInput } from "@/lib/recovery-engine";
import { coarseRecoveryTriggerLabel, projectRecoveryStateForOffDevice } from "@/lib/recovery-signal-privacy";
import { countRecoveryRiskMomentsForDay, type RecoveryState } from "@/lib/recovery-state";
import { fetchRemoteProviderJson } from "@/lib/remote-provider-timeout";
import type { SupportedLanguage } from './app-preferences';

export type CoachMode = "local" | "remote";
export type CoachProvider = "local" | "remote" | "fallback";

export type CoachContext = {
  /** Read only by the remote builder; never serialized into the request. */
  exportState?: RecoveryState;
  exportDay?: Date | string;
  locale?: SupportedLanguage;
  attempts: BlockingAttempt[];
  streakDays?: number;
  attemptsToday?: number;
  premium?: boolean;
  slipsThisWeek?: number;
  slipWindow?: string | null;
  slipTrigger?: string | null;
};

export type CoachRequest = {
  locale?: SupportedLanguage;
  input: string;
  context: {
    streakDays: number | null;
    attemptsToday: number | null;
    premium: boolean | null;
    slipsThisWeek: number | null;
    slipWindow: string | null;
    slipTrigger: string | null;
    recentRiskHosts: string[];
    recentRules: string[];
  };
  guardrails: string[];
};

export type CoachResponse = {
  text: string;
  provider: CoachProvider;
  status: "ok" | "fallback";
};

/** Synchronous request fence plus retained reply receipt. React render timing
 * cannot duplicate a send; a storage retry never needs another provider call.
 */
export function createCoachSendController(options: {
  reply: (input: string, isCurrent:()=>boolean) => Promise<CoachResponse>;
  onUser: (input: string) => void;
  onReply: (reply: CoachResponse) => void;
  onPending: (pending: boolean) => void;
  onError: (code: 'save-failed' | 'service-failed' | null) => void;
  isCurrent: () => boolean;
  /** Only explicit retryReply may refresh an admitted, durably saved fallback.
   * Ordinary retry preserves the retained request for persistence repair. */
  canRetryReply?: (reply: CoachResponse) => boolean;
}) {
  let pending=false,disposed=false,generation=0;
  let last: {input:string;userSaved:boolean;reply?:CoachResponse;replySaved:boolean}|null=null;
  const current=()=>!disposed && options.isCurrent();
  const run=async()=>{
    if(pending || !current() || !last)return false;
    pending=true;options.onPending(true);options.onError(null);
    const request=last;
    const token=generation;
    const active=()=>current() && token===generation;
    try {
      if(!request.userSaved){options.onUser(request.input);request.userSaved=true;}
      if(!active())return false;
      if(!request.reply){
        try {request.reply=await options.reply(request.input,active);}
        catch {if(active())options.onError('service-failed');return false;}
      }
      if(!active() || request!==last)return false;
      if(!request.replySaved){options.onReply(request.reply);request.replySaved=true;}
      return true;
    } catch {if(active())options.onError('save-failed');return false;}
    finally {if(token===generation){pending=false;if(current())options.onPending(false);}}
  };
  return {
    send(input:string){
      if(pending || !current() || !input.trim())return Promise.resolve(false);
      last={input,userSaved:false,replySaved:false};return run();
    },
    retry(){return run();},
    retryReply(){
      if(pending || !current() || !last?.replySaved || !last.reply || !options.canRetryReply?.(last.reply))return Promise.resolve(false);
      last.reply=undefined;last.replySaved=false;
      return run();
    },
    cancel(){generation++;pending=false;last=null;if(current())options.onPending(false);},
    activate(){disposed=false;},
    dispose(){generation++;pending=false;disposed=true;last=null;},
  };
}

export type RemoteCoachProvider = (request: CoachRequest) => Promise<CoachResponse>;

export type CoachConfig = {
  mode: CoachMode;
  endpointUrl: string | null;
  timeoutMs: number;
};

let remoteProvider: RemoteCoachProvider | null = null;

export function configureRemoteCoachProvider(provider: RemoteCoachProvider | null) {
  remoteProvider = provider;
}

function readEnv(key: string): string | null {
  const value = readClientEnvironmentValue(key);
  if (!value || !value.trim()) return null;
  return value.trim();
}

export function getCoachConfig(options: { mode?: CoachMode } = {}): CoachConfig {
  const timeoutValue = Number.parseInt(readEnv("EXPO_PUBLIC_AI_COACH_TIMEOUT_MS") ?? "", 10);
  const requestedMode = readEnv('EXPO_PUBLIC_AI_COACH_MODE');
  return {
    // Registering transport is not permission to transmit personal recovery context.
    mode: options.mode ?? (requestedMode === 'remote' ? 'remote' : 'local'),
    endpointUrl: readEnv("EXPO_PUBLIC_AI_COACH_ENDPOINT"),
    timeoutMs: Number.isFinite(timeoutValue) && timeoutValue >= 1_000 ? Math.min(timeoutValue, 12_000) : 8_000
  };
}

export function getCoachReadiness(options: { mode?: CoachMode } = {}) {
  const config = getCoachConfig(options);
  const missing: string[] = [];
  if (config.mode === "remote" && !remoteProvider && !config.endpointUrl) {
    missing.push("remote coach provider or endpoint");
  }
  if (config.mode === "remote" && !remoteProvider && config.endpointUrl) {
    missing.push(...getProductionEndpointIssues(config.endpointUrl, "remote coach endpoint").map((issue) => issue.issue));
  }

  return {
    status: config.mode === "local" ? "local" : missing.length > 0 ? "missing-config" : "ready",
    mode: config.mode,
    missing
  };
}

export function redactCoachText(input: string): string {
  return input
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(/\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)(?:\/[^\s]*)?/gi, "[redacted-domain]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_200);
}

function sanitizeCoachOutput(input: string): string {
  return redactCoachText(input).slice(0, 1_000);
}

function coachSignalCount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : null;
}

function coachSignalText(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const cleaned = redactCoachText(value).slice(0, 64);
  return cleaned || null;
}

export function buildCoachRequest(input: string, context: CoachContext): CoachRequest {
  const own = context.exportState ? projectRecoveryStateForOffDevice(context.exportState)
    : projectRecoveryStateForOffDevice({ attempts: context.attempts });
  const recentAttempts = own.attempts
    .filter((attempt) => attempt.result.verdict === "block")
    .slice(0, 5);
  const slipsThisWeek = coachSignalCount(context.slipsThisWeek);
  const includeSlipSignals = (slipsThisWeek ?? 0) > 0;

  return {
    ...(context.locale ? { locale: context.locale } : {}),
    input: redactCoachText(input),
    context: {
      streakDays: context.streakDays ?? null,
      attemptsToday: context.exportState ? countRecoveryRiskMomentsForDay(own, context.exportDay) : null,
      premium: context.premium ?? null,
      slipsThisWeek,
      slipWindow: includeSlipSignals ? coachSignalText(context.slipWindow) : null,
      slipTrigger: includeSlipSignals ? coarseRecoveryTriggerLabel(context.slipTrigger) : null,
      recentRiskHosts: recentAttempts.map((attempt) => attempt.host).filter(Boolean),
      recentRules: recentAttempts.map((attempt) => attempt.result.matchedRule).filter(Boolean)
    },
    guardrails: [
      "Be calm, supportive, and non-judgmental.",
      "Never shame the user or use sexualized detail.",
      "Give one immediate recovery action before broader advice.",
      "Do not include raw URLs, paths, query strings, or browsing history.",
      "Encourage professional help for crisis, self-harm, abuse, or severe distress."
    ]
  };
}

async function fetchRemoteCoachReply(request: CoachRequest, config: CoachConfig): Promise<CoachResponse> {
  if (!config.endpointUrl) {
    throw new Error("Remote coach endpoint is not configured.");
  }
  const endpointIssues = getProductionEndpointIssues(config.endpointUrl, "remote coach endpoint");
  if (endpointIssues.length > 0) {
    throw new Error(endpointIssues.map((issue) => issue.issue).join("; "));
  }

  const payload = (await fetchRemoteProviderJson(
    config.endpointUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    },
    config.timeoutMs,
    "Remote coach request"
  )) as { text?: unknown; reply?: unknown; provider?: unknown; status?: unknown };
  const text = typeof payload.text === "string" ? payload.text : typeof payload.reply === "string" ? payload.reply : "";
  const safeText = sanitizeCoachOutput(text);
  if (!safeText) {
    throw new Error("Remote coach returned an empty reply.");
  }

  const provider = payload.provider === "fallback" ? "fallback" : "remote";
  return {
    text: safeText,
    provider,
    status: payload.status === "fallback" || provider === "fallback" ? "fallback" : "ok"
  };
}

export async function replyWithCoach(
  input: string,
  context: CoachContext,
  options: { mode?: CoachMode } = {}
): Promise<CoachResponse> {
  const config = getCoachConfig(options);
  const localReply = () => ({
    text: generateCoachReply(input, context.attempts, {
      slipsThisWeek: context.slipsThisWeek,
      slipWindow: context.slipWindow,
      slipTrigger: context.slipTrigger
    }),
    provider: config.mode === "remote" ? ("fallback" as const) : ("local" as const),
    status: config.mode === "remote" ? ("fallback" as const) : ("ok" as const)
  });

  if (isCrisisSupportInput(input)) return localReply();

  if (config.mode === "local") return localReply();

  const request = buildCoachRequest(input, context);
  if (!request.input) return localReply();

  try {
    if (remoteProvider) {
      const result = await remoteProvider(request);
      const safeText = sanitizeCoachOutput(result.text);
      if (!safeText) return localReply();
      return {
        text: safeText,
        provider: result.provider === "fallback" ? "fallback" : "remote",
        status: result.status === "fallback" || result.provider === "fallback" ? "fallback" : "ok"
      };
    }

    return await fetchRemoteCoachReply(request, config);
  } catch {
    return localReply();
  }
}
