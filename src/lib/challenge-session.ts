import type { ChallengeFeedbackOutcome, RecoveryChallenge } from "./recovery-engine";
import { getChallengeVerificationRequirement, isChallengeVerificationSatisfied, type ChallengeVerificationEvidence } from "./challenge-verification";
import { normalizeChallengeRule } from './challenge-rules';
import { captureMomentumRewardTemplate } from './momentum-reward-templates';
import { captureEarnedResetTemplate, getEarnedResetNativeRequirement, rebindNativeValidatedEarnedTemplate, matchesEarnedResetTemplate } from './earned-reset-templates';
import type { EarnedAppTimeOffer } from '../../modules/freed-protection/src/earned-app-time';
import { validateEarnedChallengeEvidenceReceipt, type EarnedChallengeEvidenceReceipt, type EarnedChallengeEvidenceSession } from '../../modules/freed-protection/src/earned-challenge-evidence';
import { sanitizeAuthoredTemplateRevision, sanitizeCompletionProvenance, type AuthoredTemplateRevision, type CompletionProvenance } from './completion-provenance';

export const CHALLENGE_SESSION_STORAGE_KEY = "freed.challenge.session.v1";
const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60_000;
const MAX_OBSERVED_TICK_MS = 5000;
const MAX_RECORD_BYTES = 8000;

export type ChallengeSessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type AggregateEvidence = {
  motionSamples: number; steps: number; distanceMeters: number; locationSamples: number;
  bestLocationAccuracyMeters?: number;
};
export type ChallengeSession = {
  id: string;
  ownerId: string;
  challenge: RecoveryChallenge;
  phase: "paused" | "completed";
  elapsedMs: number;
  createdAtMs: number;
  evidence: AggregateEvidence;
  templateRevision?: AuthoredTemplateRevision;
  /** Local proof reference only. Grants require fresh native readback and native consumption. */
  nativeEvidence?: EarnedChallengeEvidenceSession;
  completion?: { outcome: ChallengeFeedbackOutcome; completedAtMs: number; provenance?: CompletionProvenance };
};
export type ChallengeSessionSnapshot = {
  session: ChallengeSession | null;
  running: boolean;
  elapsedSec: number;
  evidence: ChallengeVerificationEvidence;
  connectionStage: "idle" | "opened" | "returned" | "confirmed";
};
type Options = {
  ownerId: string;
  storage: ChallengeSessionStorage;
  monotonicNow: () => number;
  wallNow: () => number;
  createId: () => string;
  access?: { consume: (sessionId: string) => boolean; allows: (sessionId: string) => boolean };
  storageKey?: string;
};
const emptyEvidence = (): AggregateEvidence => ({ motionSamples: 0, steps: 0, distanceMeters: 0, locationSamples: 0 });
const boundedNumber = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(max, value) : 0;
const safeId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9:_-]{1,160}$/.test(value);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

function copyChallenge(value: unknown): RecoveryChallenge | null {
  if (!record(value) || !safeId(value.id) ||
    !["physical", "breathing", "reflection", "connection", "reset"].includes(value.category as string) ||
    !["calm", "medium", "strong"].includes(value.intensity as string) ||
    !Number.isInteger(value.durationSec) || (value.durationSec as number) < 1 || (value.durationSec as number) > 3600 ||
    typeof value.premium !== "boolean" || !Array.isArray(value.steps) || value.steps.length < 2 || value.steps.length > 4) return null;
  for (const [key, max] of [["title", 160], ["icon", 40], ["why", 300]] as const) {
    if (typeof value[key] !== "string" || (value[key] as string).length > max) return null;
  }
  if (!value.title || value.steps.some(step => typeof step !== "string" || step.length < 1 || step.length > 200)) return null;
  const verification = normalizeChallengeRule(value.verification);
  if (!verification) return null;
  return { id: value.id, title: value.title as string, category: value.category as RecoveryChallenge["category"],
    durationSec: value.durationSec as number, intensity: value.intensity as RecoveryChallenge["intensity"], premium: value.premium,
    icon: value.icon as string, why: value.why as string, steps: [...value.steps] as string[], verification,
    ...(['breathe','find','move'].includes(value.choiceGroup as string) ? { choiceGroup: value.choiceGroup as RecoveryChallenge['choiceGroup'] } : {}),
    ...(['indoors','outdoors','either'].includes(value.environment as string) ? { environment: value.environment as RecoveryChallenge['environment'] } : {}),
    ...(typeof value.seatedAlternative === 'boolean' ? { seatedAlternative: value.seatedAlternative } : {}) };
}

function copyAggregate(value: unknown): AggregateEvidence {
  const source = record(value) ? value : {};
  const accuracy = source.bestLocationAccuracyMeters;
  return { motionSamples: Math.floor(boundedNumber(source.motionSamples, 9999)), steps: Math.floor(boundedNumber(source.steps, 100_000)),
    distanceMeters: boundedNumber(source.distanceMeters, 100_000), locationSamples: Math.floor(boundedNumber(source.locationSamples, 9999)),
    ...(typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0 ? { bestLocationAccuracyMeters: Math.min(100_000, accuracy) } : {}) };
}

export function nativeEarnedEvidenceMatches(receipt:EarnedChallengeEvidenceReceipt,offer:EarnedAppTimeOffer,session:Pick<ChallengeSession,'id'|'challenge'|'templateRevision'>,completed=true):boolean {
  const evidence=receipt?.session, requirement=getEarnedResetNativeRequirement(session.challenge);
  const binding=rebindNativeValidatedEarnedTemplate(session.challenge,offer);
  if(!requirement||!validateEarnedChallengeEvidenceReceipt(receipt,offer,{version:1,offerId:offer.offerId,completionSessionId:session.id,templateId:session.challenge.id,templateVersion:2,method:requirement.method}))return false;
  if(!receipt?.supported||!receipt.accepted||receipt.reason!==null||!evidence||!requirement||!binding||!matchesEarnedResetTemplate(session.challenge,binding,offer)||session.templateRevision?.id!==session.challenge.id||session.templateRevision.revision!==2||evidence.offerId!==offer.offerId||evidence.completionSessionId!==session.id||evidence.templateId!==session.challenge.id||evidence.templateVersion!==2||evidence.method!==requirement.method||evidence.requiredSteps!==offer.requiredSteps||evidence.requiredPhotoTargets!==offer.requiredDistinctPhotoTargets||evidence.phase==='cancelled'||completed&&evidence.phase!=='completed')return false;
  if(!Number.isSafeInteger(evidence.observedSteps)||evidence.observedSteps<0||!Array.isArray(evidence.photoProofIds)||!Array.isArray(evidence.matchedTargetIds)||!Array.isArray(evidence.supportedTargetIds))return false;
  if(!completed)return true;
  const proofId=(id:unknown)=>typeof id==='string'&&/^[A-Za-z0-9:_-]{1,160}$/.test(id);
  return requirement.method==='steps'?evidence.observedSteps>=offer.requiredSteps&&proofId(evidence.stepProofId)&&evidence.photoProofIds.length===0:
    evidence.stepProofId===null&&evidence.photoProofIds.length===requirement.targetIds.length&&new Set(evidence.photoProofIds).size===evidence.photoProofIds.length&&evidence.photoProofIds.every(proofId)&&evidence.matchedTargetIds.length===requirement.targetIds.length&&new Set(evidence.matchedTargetIds).size===evidence.matchedTargetIds.length&&requirement.targetIds.every(id=>evidence.matchedTargetIds.includes(id)&&evidence.supportedTargetIds.includes(id)&&offer.supportedPhotoTargetIds?.includes(id));
}
const copyNativeEvidence=(value:EarnedChallengeEvidenceSession):EarnedChallengeEvidenceSession=>({...value,supportedTargetIds:[...value.supportedTargetIds],matchedTargetIds:[...value.matchedTargetIds],photoProofIds:[...value.photoProofIds]});

function restore(raw: string | null, ownerId: string, now: number): ChallengeSession | null {
  if (!raw || raw.length > MAX_RECORD_BYTES || !Number.isFinite(now)) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || envelope.version !== 1 || !record(envelope.session)) return null;
    const value = envelope.session;
    const challenge = copyChallenge(value.challenge);
    if (!challenge || value.ownerId !== ownerId || !safeId(value.id) ||
      (value.phase !== "paused" && value.phase !== "completed") ||
      typeof value.elapsedMs !== "number" || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > challenge.durationSec * 1000 ||
      typeof value.createdAtMs !== "number" || !Number.isFinite(value.createdAtMs) || value.createdAtMs > now + 60_000 || now - value.createdAtMs > MAX_SESSION_AGE_MS) return null;
    const completion = record(value.completion) && (["helped", "still-urging", "unknown"].includes(value.completion.outcome as string)) &&
      typeof value.completion.completedAtMs === "number" && Number.isFinite(value.completion.completedAtMs)
      ? { outcome: value.completion.outcome as ChallengeFeedbackOutcome, completedAtMs: value.completion.completedAtMs,
          ...(sanitizeCompletionProvenance(value.completion.provenance, challenge.id) ? { provenance: sanitizeCompletionProvenance(value.completion.provenance, challenge.id) } : {}) } : undefined;
    return { id: value.id, ownerId, challenge, phase: value.phase, elapsedMs: value.elapsedMs,
      createdAtMs: value.createdAtMs, evidence: copyAggregate(value.evidence),
      ...(sanitizeAuthoredTemplateRevision(value.templateRevision, challenge.id) ? { templateRevision: sanitizeAuthoredTemplateRevision(value.templateRevision, challenge.id) } : {}),
      ...(completion ? { completion } : {}),
      ...(record(value.nativeEvidence)&&value.nativeEvidence.offerId&&Array.isArray(value.nativeEvidence.photoProofIds)&&Array.isArray(value.nativeEvidence.supportedTargetIds)&&Array.isArray(value.nativeEvidence.matchedTargetIds)?{nativeEvidence:copyNativeEvidence(value.nativeEvidence as EarnedChallengeEvidenceSession)}:{}) };
  } catch { return null; }
}

/** One foreground session. All critical transitions persist synchronously before becoming observable.
 * Sensor subscriptions remain with the screen; recordEvidence accepts cumulative aggregate totals.
 * Photo proof and connection confirmation stay in memory and must be repeated after process restart.
 */
export function createChallengeSessionController(options: Options) {
  if (typeof options.ownerId !== "string" || !options.ownerId.trim() || options.ownerId.length > 160) throw new Error("Challenge session owner is unavailable.");
  const storageKey = options.storageKey ?? CHALLENGE_SESSION_STORAGE_KEY;
  let session: ChallengeSession | null = null;
  let running = false;
  let foreground = true;
  let resumeAfterForeground = false;
  let disposed = false;
  let hydrated = false;
  let lastSampleMs: number | null = null;
  let photoEvidence: Pick<ChallengeVerificationEvidence, "photoMatched" | "photoLabels" | "photoConfidence"> = {};
  let connectionStage: ChallengeSessionSnapshot["connectionStage"] = "idle";
  let connectionToken: string | null = null;
  let connectionSequence = 0;
  const resetVolatile = () => { photoEvidence = {}; connectionStage = "idle"; connectionToken = null; };
  const read = (): ChallengeSessionSnapshot => {
    const elapsedSec = Math.floor((session?.elapsedMs ?? 0) / 1000);
    return { session: session ? { ...session, challenge: { ...session.challenge, steps: [...session.challenge.steps],
      ...(session.challenge.verification ? {verification:{...session.challenge.verification}} : {}) }, evidence: { ...session.evidence },
      ...(session.templateRevision ? { templateRevision: { ...session.templateRevision } } : {}),
      ...(session.nativeEvidence ? {nativeEvidence:copyNativeEvidence(session.nativeEvidence)} : {}),
      ...(session.completion ? { completion: { ...session.completion, ...(session.completion.provenance ? { provenance: sanitizeCompletionProvenance(session.completion.provenance, session.challenge.id) } : {}) } } : {}) } : null,
      running, elapsedSec, evidence: { ...emptyEvidence(), ...session?.evidence, ...photoEvidence,
        ...(photoEvidence.photoLabels ? { photoLabels: [...photoEvidence.photoLabels] } : {}),
        elapsedSec, connectionActionComplete: connectionStage === "confirmed" }, connectionStage };
  };
  const persist = (next: ChallengeSession) => {
    try { options.storage.setItem(storageKey, JSON.stringify({ version: 1, session: next })); }
    catch (error) { running = false; resumeAfterForeground = false; lastSampleMs = null; throw error; }
    session = next;
  };
  const tick = () => {
    if (disposed || !running || !session || session.phase === "completed" || (options.access && !options.access.allows(session.id))) return read();
    const now = options.monotonicNow();
    if (!Number.isFinite(now)) { running = false; lastSampleMs = null; return read(); }
    if (lastSampleMs === null) { lastSampleMs = now; return read(); }
    const delta = now - lastSampleMs;
    if (delta < 0) return read(); // A clock rollback cannot re-count the same interval.
    lastSampleMs = now;
    if (delta > 0 && delta <= MAX_OBSERVED_TICK_MS) {
      const elapsedMs = Math.min(session.challenge.durationSec * 1000, session.elapsedMs + delta);
      if (elapsedMs !== session.elapsedMs) persist({ ...session, elapsedMs });
    }
    return read();
  };
  const recordEvidence = (input: Partial<ChallengeVerificationEvidence>, expectedSessionId?: string) => {
    if (disposed || !running || !session || session.phase === "completed" || (expectedSessionId !== undefined && expectedSessionId !== session.id)) return read();
    const aggregate = copyAggregate(input);
    const current = session.evidence;
    const accuracy = aggregate.bestLocationAccuracyMeters;
    const evidence: AggregateEvidence = { motionSamples: Math.max(current.motionSamples, aggregate.motionSamples),
      steps: Math.max(current.steps, aggregate.steps), distanceMeters: Math.max(current.distanceMeters, aggregate.distanceMeters),
      locationSamples: Math.max(current.locationSamples, aggregate.locationSamples),
      ...(accuracy === undefined ? (current.bestLocationAccuracyMeters === undefined ? {} : { bestLocationAccuracyMeters: current.bestLocationAccuracyMeters })
        : { bestLocationAccuracyMeters: Math.min(current.bestLocationAccuracyMeters ?? accuracy, accuracy) }) };
    if (JSON.stringify(evidence) !== JSON.stringify(current)) persist({ ...session, evidence });
    // Only proof consumed by the current photo requirement is retained. Raw camera files never cross this boundary.
    if (getChallengeVerificationRequirement(session.challenge).kind === "photo" && input.photoMatched !== undefined) {
      photoEvidence = { photoMatched: input.photoMatched === true,
        photoConfidence: typeof input.photoConfidence === "number" && input.photoConfidence <= 1 ? boundedNumber(input.photoConfidence, 1) : 0,
        photoLabels: Array.isArray(input.photoLabels) ? input.photoLabels.filter((label): label is string => typeof label === "string" && label.length <= 80).slice(0, 20) : [] };
    }
    return read();
  };
  const pause = () => { resumeAfterForeground = false; tick(); running = false; lastSampleMs = null; return read(); };
  const resume = () => {
    if (disposed || !foreground || !session || session.phase === "completed" || (options.access && !options.access.allows(session.id))) return false;
    running = true; lastSampleMs = options.monotonicNow(); return true;
  };
  return {
    read, tick, recordEvidence, pause, resume,
    setForeground(value: boolean) {
      if (disposed) return read();
      if (!value) {
        const shouldResume = resumeAfterForeground || running;
        pause(); foreground = false; resumeAfterForeground = shouldResume;
      } else {
        foreground = true;
        if (resumeAfterForeground) resume();
        resumeAfterForeground = false;
      }
      return read();
    },
    hydrate() {
      if (disposed || hydrated) return read();
      session = restore(options.storage.getItem(storageKey), options.ownerId, options.wallNow());
      hydrated = true; running = false; lastSampleMs = null; resetVolatile(); return read();
    },
    start(challenge: RecoveryChallenge) {
      if (disposed) throw new Error("Challenge session is closed.");
      if (!hydrated) throw new Error("Challenge session is still loading.");
      const copied = copyChallenge(challenge);
      const id = options.createId(); const now = options.wallNow();
      if (!copied || !safeId(id) || !Number.isFinite(now)) throw new Error("Challenge could not be started.");
      if (options.access && (session || !options.access.consume(id))) throw new Error("Start a new guided reset from the access offer.");
      const authored = captureEarnedResetTemplate(challenge) ?? captureMomentumRewardTemplate(challenge);
      persist({ id, ownerId: options.ownerId, challenge: copied, phase: "paused", elapsedMs: 0, createdAtMs: now, evidence: emptyEvidence(),
        ...(authored ? { templateRevision: { id: authored.templateId, revision: authored.templateVersion } } : {}) });
      resetVolatile(); resumeAfterForeground = false; running = foreground; lastSampleMs = foreground ? options.monotonicNow() : null; return read();
    },
    replace(challenge: RecoveryChallenge, expectedSessionId: string) {
      if (disposed || !hydrated || !session || session.phase === 'completed' || session.id !== expectedSessionId ||
          (options.access && !options.access.allows(expectedSessionId))) throw new Error('This guided session is no longer available.');
      const copied = copyChallenge(challenge);
      if (!copied) throw new Error('This reset has no supported verification rule.');
      // Same license and completion identity. No second consume/ad, no reused sensor/photo proof.
      const authored = captureEarnedResetTemplate(challenge) ?? captureMomentumRewardTemplate(challenge);
      persist({ ...session, challenge: copied, elapsedMs: 0, evidence: emptyEvidence(),
        templateRevision: authored ? { id: authored.templateId, revision: authored.templateVersion } : undefined, nativeEvidence:undefined });
      resetVolatile(); resumeAfterForeground = false; running = foreground;
      lastSampleMs = foreground ? options.monotonicNow() : null; return read();
    },
    abandon() {
      if (disposed) return read();
      pause();
      const stored = restore(options.storage.getItem(storageKey), options.ownerId, options.wallNow());
      if (stored && session && stored.id !== session.id) throw new Error("Another session owns saved progress.");
      options.storage.removeItem(storageKey);
      session = null; running = false; resumeAfterForeground = false; lastSampleMs = null; resetVolatile(); return read();
    },
    beginConnectionAction() {
      if (disposed || !session || session.phase === "completed" || getChallengeVerificationRequirement(session.challenge).kind !== "connection") return null;
      connectionToken = `${session.id}:${++connectionSequence}`; connectionStage = "opened"; return connectionToken;
    },
    markConnectionReturned(token: string) {
      if (disposed || !token || token !== connectionToken || connectionStage !== "opened") return false;
      connectionStage = "returned"; return true;
    },
    confirmConnectionAction(token: string) {
      if (disposed || !token || token !== connectionToken || connectionStage !== "returned") return false;
      connectionStage = "confirmed"; return true;
    },
    claimCompletion(input: Partial<ChallengeVerificationEvidence> = {}, outcome: ChallengeFeedbackOutcome = "unknown", expectedSessionId?: string) {
      if (disposed || !session || session.phase === "completed" || (expectedSessionId !== undefined && expectedSessionId !== session.id)) return false;
      if (outcome !== "helped" && outcome !== "still-urging" && outcome !== "unknown") return false;
      if (options.access && !options.access.allows(session.id)) return false;
      if (getEarnedResetNativeRequirement(session.challenge)) return false;
      recordEvidence(input, expectedSessionId); tick();
      if (!isChallengeVerificationSatisfied(getChallengeVerificationRequirement(session.challenge), read().evidence)) return false;
      const completedAtMs = options.wallNow();
      if (!Number.isFinite(completedAtMs)) return false;
      const provenance = sanitizeCompletionProvenance({ version: 1, method: getChallengeVerificationRequirement(session.challenge).kind,
        verificationRuleVersion: normalizeChallengeRule(session.challenge.verification)?.version,
        ...(session.templateRevision ? { template: session.templateRevision } : {}) }, session.challenge.id);
      persist({ ...session, phase: "completed", completion: { outcome, completedAtMs, ...(provenance ? { provenance } : {}) } });
      running = false; resumeAfterForeground = false; lastSampleMs = null; return true;
    },
    claimNativeCompletion(receipt:EarnedChallengeEvidenceReceipt,offer:EarnedAppTimeOffer,outcome:ChallengeFeedbackOutcome='unknown',expectedSessionId?:string){
      if(disposed||!session||session.phase==='completed'||expectedSessionId!==session.id||!['helped','still-urging','unknown'].includes(outcome)||(options.access&&!options.access.allows(session.id))||!nativeEarnedEvidenceMatches(receipt,offer,session))return false;
      const completedAtMs=options.wallNow();if(!Number.isFinite(completedAtMs))return false;
      tick();const nativeEvidence=copyNativeEvidence(receipt.session!);
      const provenance=sanitizeCompletionProvenance({version:1,method:nativeEvidence.method,verificationRuleVersion:1,template:session.templateRevision},session.challenge.id);
      persist({...session,phase:'completed',evidence:{...session.evidence,steps:nativeEvidence.observedSteps},nativeEvidence,completion:{outcome,completedAtMs,...(provenance?{provenance}:{})}});
      running=false;resumeAfterForeground=false;lastSampleMs=null;return true;
    },
    dispose() { disposed = true; running = false; resumeAfterForeground = false; lastSampleMs = null; resetVolatile(); }
  };
}

export type ChallengeSessionController = ReturnType<typeof createChallengeSessionController>;
