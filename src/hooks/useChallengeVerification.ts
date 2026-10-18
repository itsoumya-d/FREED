import React from "react";
import { AppState, Linking } from "react-native";
import { adoptTemporaryChallengePhoto, deleteTemporaryChallengePhoto, prepareTemporaryChallengePhotoCapture } from "../lib/challenge-photo-files";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Accelerometer, Pedometer } from "expo-sensors";
import { cancelChallengePhoto, classifyChallengePhoto, getChallengePhotoCapabilities } from "freed-protection";
import type { RecoveryChallenge } from "../lib/recovery-engine";
import {
  getChallengeVerificationRequirement,
  isChallengeVerificationSatisfied,
  type ChallengeVerificationEvidence,
  type ChallengeVerificationRequirement
} from "../lib/challenge-verification";
import {
  createVerificationCallbackFence,
  createVerificationSensorAccumulator,
  runChallengePhotoCapture,
  type VerificationCallbackContext
} from "../lib/challenge-verification-runtime";

type CallbackFence = ReturnType<typeof createVerificationCallbackFence>;
type VerificationRecord = {
  sessionKey: string | null;
  sensors: ReturnType<typeof createVerificationSensorAccumulator>;
  photo: Pick<ChallengeVerificationEvidence, "photoMatched" | "photoLabels" | "photoConfidence">;
  status: string;
};
const initialRecord = (sessionKey: string | null, restoredEvidence?: Partial<ChallengeVerificationEvidence>): VerificationRecord => ({
  sessionKey,
  sensors: createVerificationSensorAccumulator(restoredEvidence),
  photo: { photoMatched: false, photoLabels: [] },
  status: "Verification starts when the challenge starts."
});

/** Owns native verification subscriptions only; foreground timing and durable proof
 * belong to useChallengeSession. Restoration seeds aggregates once per session.
 * completed is separate from active because camera UI legitimately pauses AppState.
 */
export function useChallengeVerification(
  challenge: RecoveryChallenge | null,
  elapsedSec: number,
  active: boolean,
  connectionActionComplete: boolean,
  sessionId?: string,
  restoredEvidence?: Partial<ChallengeVerificationEvidence>,
  completed = false
) {
  const requirement = React.useMemo(() => challenge ? getChallengeVerificationRequirement(challenge) : null, [challenge]);
  const sessionKey = challenge ? JSON.stringify([challenge.id, sessionId ?? null]) : null;
  const [foreground, setForeground] = React.useState(AppState.currentState === "active");
  const effectiveActive = active && foreground && AppState.currentState === "active" && !completed;
  const [, redraw] = React.useReducer((revision: number) => revision + 1, 0);
  const recordRef = React.useRef<VerificationRecord | null>(null);
  if (!recordRef.current || recordRef.current.sessionKey !== sessionKey) recordRef.current = initialRecord(sessionKey, restoredEvidence);
  const record = recordRef.current;
  const latestRef = React.useRef({ active, completed }); latestRef.current = { active, completed };
  const contextRef = React.useRef<VerificationCallbackContext>({ sessionKey, active: effectiveActive, completed, mounted: false, foregroundEpoch: 0 });
  const previousContext = contextRef.current;
  contextRef.current = { ...previousContext, sessionKey, active: effectiveActive, completed,
    foregroundEpoch: previousContext.foregroundEpoch + Number(previousContext.sessionKey !== sessionKey || previousContext.active !== effectiveActive || previousContext.completed !== completed) };
  const readContext = React.useCallback(() => contextRef.current, []);
  const photoOperationRef = React.useRef<{ fence: CallbackFence; abort: AbortController } | null>(null);
  const [photoBusy, setPhotoBusy] = React.useState(false);

  const publish = React.useCallback((fence: CallbackFence, update: (current: VerificationRecord) => boolean | void) => {
    if (!fence.isCurrent() || !recordRef.current) return;
    if (update(recordRef.current) !== false) redraw();
  }, []);
  const setStatus = React.useCallback((fence: CallbackFence, message: string) => publish(fence, current => {
    if (current.status === message) return false;
    current.status = message;
  }), [publish]);
  const openPermissionSettings = React.useCallback(async (fence: CallbackFence, permissionName: string) => {
    if (!fence.isCurrent()) return;
    setStatus(fence, `${permissionName} permission is needed here. Opening app settings now.`);
    try { await Linking.openSettings(); }
    catch { setStatus(fence, `${permissionName} permission is needed here. Open system settings for FREED and allow it, then return to the challenge.`); }
  }, [setStatus]);

  React.useEffect(() => {
    contextRef.current.mounted = true;
    const listener = AppState.addEventListener("change", state => {
      // Invalidate sensor callbacks immediately, before the session hook's state update renders.
      contextRef.current.foregroundEpoch += 1;
      contextRef.current.active = state === "active" && latestRef.current.active && !latestRef.current.completed;
      setForeground(state === "active");
    });
    return () => {
      contextRef.current.mounted = false;
      contextRef.current.foregroundEpoch += 1;
      photoOperationRef.current?.fence.cancel();
      photoOperationRef.current?.abort.abort();
      listener.remove();
    };
  }, []);

  React.useEffect(() => {
    if (!effectiveActive || requirement?.kind !== "motion") return;
    const fence = createVerificationCallbackFence(readContext);
    const segment = record.sensors.startMotion();
    let subscription: { remove: () => void } | null = null;
    setStatus(fence, "Checking motion sensor...");
    void (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!fence.isCurrent()) return;
        if (!available) { setStatus(fence, "Motion sensor unavailable on this device."); return; }
        const permission = await Accelerometer.requestPermissionsAsync();
        if (!fence.isCurrent()) return;
        if (permission.status !== "granted") { await openPermissionSettings(fence, "Motion"); return; }
        Accelerometer.setUpdateInterval(350);
        subscription = Accelerometer.addListener(sample => {
          if (fence.isCurrent() && segment.observe(sample)) publish(fence, () => {});
        });
        setStatus(fence, "Motion sensor active.");
      } catch { setStatus(fence, "Motion sensor permission or hardware is unavailable."); }
    })();
    return () => { fence.cancel(); segment.cancel(); subscription?.remove(); };
  }, [effectiveActive, sessionKey, completed, requirement?.kind, record, readContext, publish, setStatus, openPermissionSettings]);

  React.useEffect(() => {
    if (!effectiveActive || requirement?.kind !== "steps") return;
    const fence = createVerificationCallbackFence(readContext);
    const segment = record.sensors.startSteps();
    let subscription: { remove: () => void } | null = null;
    setStatus(fence, "Checking step sensor...");
    void (async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (!fence.isCurrent()) return;
        if (!available) { setStatus(fence, "Step counter unavailable on this device."); return; }
        const permission = await Pedometer.requestPermissionsAsync();
        if (!fence.isCurrent()) return;
        if (permission.status !== "granted") { await openPermissionSettings(fence, "Motion"); return; }
        subscription = Pedometer.watchStepCount(result => {
          if (fence.isCurrent() && segment.observe(result.steps)) publish(fence, () => {});
        });
        setStatus(fence, "Step counter active.");
      } catch { setStatus(fence, "Step sensor permission or hardware is unavailable."); }
    })();
    return () => { fence.cancel(); segment.cancel(); subscription?.remove(); };
  }, [effectiveActive, sessionKey, completed, requirement?.kind, record, readContext, publish, setStatus, openPermissionSettings]);

  React.useEffect(() => {
    if (!effectiveActive || requirement?.kind !== "location") return;
    const fence = createVerificationCallbackFence(readContext);
    const maxAccuracyMeters = requirement.maxLocationAccuracyMeters ?? 80;
    const segment = record.sensors.startLocation(maxAccuracyMeters);
    let subscription: { remove: () => void } | null = null;
    setStatus(fence, "Requesting location for movement verification...");
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!fence.isCurrent()) return;
        if (permission.status !== "granted") { await openPermissionSettings(fence, "Location"); return; }
        const nextSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
          location => {
            if (!fence.isCurrent()) return;
            const result = segment.observe(location.coords);
            if (result === "invalid" || result === "cancelled") return;
            publish(fence, current => {
              current.status = result === "accuracy" ? `Waiting for clearer location accuracy under ${maxAccuracyMeters} m.` : "Location movement verification active.";
            });
          }
        );
        if (!fence.isCurrent()) { nextSubscription.remove(); return; }
        subscription = nextSubscription;
        setStatus(fence, "Location movement verification active.");
      } catch { setStatus(fence, "Location provider is unavailable."); }
    })();
    return () => { fence.cancel(); segment.cancel(); subscription?.remove(); };
  }, [effectiveActive, sessionKey, completed, requirement?.kind, requirement?.maxLocationAccuracyMeters, record, readContext, publish, setStatus, openPermissionSettings]);

  React.useEffect(() => {
    if (!effectiveActive || !requirement) return;
    const fence = createVerificationCallbackFence(readContext);
    if (requirement.kind === "timer") setStatus(fence, "Timer verification active.");
    if (requirement.kind === "photo" && !photoBusy && record.status === "Verification starts when the challenge starts.") setStatus(fence, "Take a fresh camera photo when you reach the target.");
    if (requirement.kind === "connection") setStatus(fence, connectionActionComplete ? "Connection action verified." : "Complete a connection action to verify this challenge.");
    return () => fence.cancel();
  }, [effectiveActive, sessionKey, completed, requirement?.kind, connectionActionComplete, photoBusy, record, readContext, setStatus]);

  React.useEffect(() => {
    if (photoOperationRef.current && (completed || !photoOperationRef.current.fence.isCurrent())) {
      photoOperationRef.current.fence.cancel(); photoOperationRef.current.abort.abort();
    }
  }, [sessionKey, completed]);

  const capturePhoto = React.useCallback(async () => {
    if (!effectiveActive || completed || requirement?.kind !== "photo" || photoOperationRef.current) return;
    const fence = createVerificationCallbackFence(readContext, false);
    if (!fence.isCurrent()) return;
    const expectedLabels = requirement.expectedPhotoLabels ?? [];
    if (expectedLabels.length === 0) { setStatus(fence, "This photo challenge has no verifiable target labels."); return; }
    const operation = { fence, abort: new AbortController() };
    photoOperationRef.current = operation;
    setPhotoBusy(true); setStatus(fence, "Opening camera...");
    try {
      await runChallengePhotoCapture({
        expectedLabels, minPhotoConfidence: requirement?.minPhotoConfidence, isCurrent: fence.isCurrent, signal: operation.abort.signal,
        getCapabilities: getChallengePhotoCapabilities,
        preparePhotoCapture: prepareTemporaryChallengePhotoCapture,
        requestPermission: async () => ({ granted: (await ImagePicker.requestCameraPermissionsAsync()).status === "granted" }),
        launchCamera: () => ImagePicker.launchCameraAsync({ allowsEditing: false, base64: false, exif: false, mediaTypes: ["images"], quality: 0.72 }),
        adoptPhoto: adoptTemporaryChallengePhoto, classifyPhoto: classifyChallengePhoto, cancelPhoto: cancelChallengePhoto, deletePhoto: deleteTemporaryChallengePhoto,
        onStatus: message => setStatus(fence, message),
        onPermissionDenied: () => openPermissionSettings(fence, "Camera"),
        onClassification: classification => publish(fence, current => {
          current.photo = { photoMatched: classification.available && classification.matched,
            photoLabels: [...classification.matchedLabels],
            photoConfidence: classification.confidence };
          current.status = classification.message;
        })
      });
    } catch {
      publish(fence, current => { current.photo = { photoMatched: false, photoLabels: [] }; current.status = "Photo verification failed. Try again with a clearer image."; });
    } finally {
      fence.cancel();
      if (photoOperationRef.current === operation) {
        photoOperationRef.current = null;
        if (contextRef.current.mounted) setPhotoBusy(false);
      }
    }
  }, [effectiveActive, completed, requirement, readContext, publish, setStatus, openPermissionSettings]);

  // Aggregate inputs from storage are deliberately not re-added on every evidence write.
  const aggregate = record.sensors.read();
  const evidence = React.useMemo(() => ({ ...aggregate, ...record.photo, elapsedSec, connectionActionComplete }),
    [record, aggregate.motionSamples, aggregate.steps, aggregate.distanceMeters, aggregate.locationSamples, aggregate.bestLocationAccuracyMeters,
      record.photo, elapsedSec, connectionActionComplete]);
  return { requirement, evidence, satisfied: requirement ? isChallengeVerificationSatisfied(requirement, evidence) : false,
    status: record.status, progress: requirement ? getVerificationProgressText(requirement, evidence) : "", capturePhoto, photoBusy };
}

function getVerificationProgressText(requirement: ChallengeVerificationRequirement, evidence: ChallengeVerificationEvidence) {
  if (requirement.kind === "motion") return `${Math.min(evidence.motionSamples ?? 0, requirement.minMotionSamples ?? 0)}/${requirement.minMotionSamples ?? 0} movement signals`;
  if (requirement.kind === "steps") return `${Math.min(evidence.steps ?? 0, requirement.minSteps ?? 0)}/${requirement.minSteps ?? 0} steps`;
  if (requirement.kind === "location") {
    const target = requirement.minLocationSamples ?? 0;
    const samples = target > 0 ? `, ${Math.min(evidence.locationSamples ?? 0, target)}/${target} fixes` : "";
    const accuracy = evidence.bestLocationAccuracyMeters !== undefined ? `, best ${Math.round(evidence.bestLocationAccuracyMeters)} m accuracy` : "";
    return `${Math.min(Math.round(evidence.distanceMeters ?? 0), requirement.minDistanceMeters ?? 0)}/${requirement.minDistanceMeters ?? 0} m moved${samples}${accuracy}`;
  }
  if (requirement.kind === "photo") {
    if (!evidence.photoMatched) return "Fresh verified photo pending";
    const minConfidence = requirement.minPhotoConfidence ?? 0;
    if ((evidence.photoConfidence ?? 0) < minConfidence) return `Target found, needs ${Math.round(minConfidence * 100)}% confidence`;
    const confidence = evidence.photoConfidence !== undefined ? ` - ${Math.round(evidence.photoConfidence * 100)}%` : "";
    return `Matched ${evidence.photoLabels?.slice(0, 2).join(", ") || "target"}${confidence}`;
  }
  if (requirement.kind === "connection") return evidence.connectionActionComplete ? "Connection action complete" : "Connection action pending";
  return `${Math.min(evidence.elapsedSec, requirement.minElapsedSec)}/${requirement.minElapsedSec} sec`;
}
