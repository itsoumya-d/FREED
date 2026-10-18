import "expo-sqlite/localStorage/install";
import React from "react";
import { AppState } from "react-native";
import { randomUUID } from "expo-crypto";
import { CHALLENGE_SESSION_STORAGE_KEY, createChallengeSessionController, type ChallengeSessionController, type ChallengeSessionSnapshot, type ChallengeSessionStorage } from "../lib/challenge-session";
import type { ChallengeFeedbackOutcome, RecoveryChallenge } from "../lib/recovery-engine";
import type { ChallengeVerificationEvidence } from "../lib/challenge-verification";
import type { EarnedAppTimeOffer } from '../../modules/freed-protection/src/earned-app-time';
import type { EarnedChallengeEvidenceReceipt } from '../../modules/freed-protection/src/earned-challenge-evidence';

const emptySnapshot = (): ChallengeSessionSnapshot => ({ session: null, running: false, elapsedSec: 0,
  evidence: { elapsedSec: 0 }, connectionStage: "idle" });
const monotonicNow = () => typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now();

/** Owns foreground timing and durable session state, never native sensor subscriptions.
 * Restored sessions remain paused until the user selects Resume. Background/foreground on the
 * same mounted screen automatically pauses/resumes an already-running session.
 */
export function useChallengeSession(options: { ownerId: string | null; active?: boolean; storage?: ChallengeSessionStorage; access?: { nextSessionId: () => string; consume: (id: string) => boolean; allows: (id: string) => boolean } }) {
  const active = options.active ?? true;
  const accessRef = React.useRef(options.access); accessRef.current = options.access;
  const activeRef = React.useRef(active); activeRef.current = active;
  const ownerRef = React.useRef(options.ownerId); ownerRef.current = options.ownerId;
  const controllerOwnerRef = React.useRef<string | null>(null);
  const controllerRef = React.useRef<ChallengeSessionController | null>(null);
  const [snapshot, setSnapshot] = React.useState<ChallengeSessionSnapshot>(emptySnapshot);
  const [hydrated, setHydrated] = React.useState(false);
  const [storageError, setStorageError] = React.useState<string | null>(null);

  const operate = React.useCallback(<Value,>(operation: (controller: ChallengeSessionController) => Value, fallback: Value): Value => {
    const controller = controllerRef.current;
    if (!controller || controllerOwnerRef.current !== ownerRef.current) return fallback;
    try {
      const value = operation(controller);
      setSnapshot(controller.read()); setStorageError(null); return value;
    } catch {
      try { controller.pause(); } catch { /* Keep a failed storage transition paused without throwing from an event handler. */ }
      setSnapshot(controller.read());
      setStorageError("Challenge progress could not be saved. Free up space and try again."); return fallback;
    }
  }, []);

  React.useEffect(() => {
    let alive = true;
    setHydrated(false); setSnapshot(emptySnapshot()); setStorageError(null);
    if (!options.ownerId) { controllerRef.current = null; controllerOwnerRef.current = null; setHydrated(true); return; }
    let controller: ChallengeSessionController;
    try {
      controller = createChallengeSessionController({ ownerId: options.ownerId, storage: options.storage ?? localStorage,
        monotonicNow, wallNow: Date.now, createId: () => accessRef.current?.nextSessionId() ?? randomUUID(),
        ...(options.access ? { storageKey: CHALLENGE_SESSION_STORAGE_KEY + "." + encodeURIComponent(options.ownerId), access: { consume: id => accessRef.current?.consume(id) ?? false, allows: id => accessRef.current?.allows(id) ?? false } } : {}) });
      controllerRef.current = controller;
      controllerOwnerRef.current = options.ownerId;
      setSnapshot(controller.hydrate());
      controller.setForeground(activeRef.current && AppState.currentState === "active");
    } catch {
      controllerRef.current = null; controllerOwnerRef.current = null; setStorageError("Challenge progress could not be loaded."); setHydrated(true); return;
    }
    setHydrated(true);
    const publish = () => { if (alive && controllerRef.current === controller) setSnapshot(controller.read()); };
    const safely = (operation: () => void) => {
      if (!alive || controllerRef.current !== controller) return;
      try { operation(); publish(); }
      catch { publish(); setStorageError("Challenge progress could not be saved. Free up space and try again."); }
    };
    const subscription = AppState.addEventListener("change", state => safely(() => {
      controller.setForeground(state === "active" && activeRef.current);
    }));
    const timer = setInterval(() => {
      const current = controller.read();
      if (!current.session || !current.running || !activeRef.current || AppState.currentState !== "active") return;
      safely(() => { controller.tick(); });
    }, 1000);
    return () => {
      alive = false; clearInterval(timer); subscription.remove();
      try { controller.pause(); } catch { /* Failed writes never enable completion or publish after unmount. */ }
      controller.dispose(); if (controllerRef.current === controller) { controllerRef.current = null; controllerOwnerRef.current = null; }
    };
  }, [options.ownerId, options.storage]);

  React.useEffect(() => {
    operate(controller => {
      if (!active) controller.pause();
      return controller.setForeground(active && AppState.currentState === "active");
    }, emptySnapshot());
  }, [active, operate]);

  const start = React.useCallback((challenge: RecoveryChallenge) => operate(controller => {
    controller.start(challenge);
    if (!activeRef.current || AppState.currentState !== "active") controller.pause();
    return true;
  }, false), [operate]);
  const replace = React.useCallback((challenge: RecoveryChallenge, expectedSessionId: string) => operate(controller => {
    controller.replace(challenge, expectedSessionId);
    if (!activeRef.current || AppState.currentState !== 'active') controller.pause();
    return true;
  }, false), [operate]);
  const pause = React.useCallback(() => operate(controller => controller.pause(), emptySnapshot()), [operate]);
  const resume = React.useCallback(() => operate(controller => {
    if (!activeRef.current || AppState.currentState !== "active") return false;
    return controller.resume();
  }, false), [operate]);
  const abandon = React.useCallback(() => operate(controller => controller.abandon(), emptySnapshot()), [operate]);
  const recordEvidence = React.useCallback((evidence: Partial<ChallengeVerificationEvidence>, sessionId?: string) =>
    operate(controller => controller.recordEvidence(evidence, sessionId), emptySnapshot()), [operate]);
  const claimCompletion = React.useCallback((evidence: Partial<ChallengeVerificationEvidence> = {}, outcome: ChallengeFeedbackOutcome = "unknown", sessionId?: string) =>
    operate(controller => controller.claimCompletion(evidence, outcome, sessionId), false), [operate]);
  const claimNativeCompletion = React.useCallback((receipt:EarnedChallengeEvidenceReceipt,offer:EarnedAppTimeOffer,outcome:ChallengeFeedbackOutcome='unknown',sessionId?:string)=>operate(controller=>controller.claimNativeCompletion(receipt,offer,outcome,sessionId),false),[operate]);
  const beginConnectionAction = React.useCallback(() => operate(controller => controller.beginConnectionAction(), null), [operate]);
  const markConnectionReturned = React.useCallback((token: string) => operate(controller => controller.markConnectionReturned(token), false), [operate]);
  const confirmConnectionAction = React.useCallback((token: string) => operate(controller => controller.confirmConnectionAction(token), false), [operate]);
  const getSnapshot = React.useCallback(() => controllerOwnerRef.current === ownerRef.current ? controllerRef.current?.read() ?? emptySnapshot() : emptySnapshot(), []);

  const ownedSnapshot = snapshot.session && snapshot.session.ownerId !== options.ownerId ? emptySnapshot() : snapshot;
  return { ...ownedSnapshot, hydrated: hydrated && controllerOwnerRef.current === options.ownerId, storageError, start, replace, pause, resume, abandon, recordEvidence, claimCompletion, claimNativeCompletion,
    beginConnectionAction, markConnectionReturned, confirmConnectionAction, getSnapshot };
}
