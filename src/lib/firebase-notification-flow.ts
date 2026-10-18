import { createWebsiteRecoveryAlertInbox, isWebsiteRecoveryAudience, rememberNotificationMessageId, type WebsiteRecoveryAlertInbox } from "./website-recovery-alert";
import { getFirebaseMessagingRegistrationContract, type FirebaseMessagingRegistration } from "./firebase-client";

export type FirebasePushRegistrationStatus = { status: "registered" | "permission-not-authorized" | "unavailable" | "error" };
export type FirebasePushTokenDependencies = {
  permissionGranted(): Promise<boolean>;
  currentUid(): string | null;
  prepareDevice(): Promise<void>;
  getToken(): Promise<string>;
  getInstallationId(): Promise<string>;
  onTokenRefresh(listener: (token: string) => void): () => void;
  register(registration: FirebaseMessagingRegistration, uid: string): Promise<boolean>;
  now?: () => number;
};

/** No SDK work occurs until start(true); a caller must already have obtained permission and identity. */
export function createFirebasePushTokenController(dependencies: FirebasePushTokenDependencies) {
  let epoch = 0;
  let activeUid: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let starting: { epoch: number; promise: Promise<FirebasePushRegistrationStatus> } | null = null;
  let pending: { token: string; uid: string; epoch: number } | null = null;
  let running = false;
  let tokenSequence = 0;
  let lastRegistered: string | null = null;
  let registeredAt = 0;
  let lastResult: FirebasePushRegistrationStatus = { status: "unavailable" };
  const waiters: Array<{ epoch: number; resolve: (result: FirebasePushRegistrationStatus) => void }> = [];
  const now = dependencies.now ?? Date.now;
  const active = (scope: number, uid: string) => epoch === scope && activeUid === uid && dependencies.currentUid() === uid;

  function settle(scope: number, result: FirebasePushRegistrationStatus) {
    for (let index = waiters.length - 1; index >= 0; index -= 1) {
      if (waiters[index].epoch === scope) waiters.splice(index, 1)[0].resolve(result);
    }
  }
  function stop() {
    const previous = epoch++;
    activeUid = null; pending = null; lastRegistered = null;
    unsubscribe?.(); unsubscribe = null;
    settle(previous, { status: "unavailable" });
  }
  function waitForDrain(scope: number): Promise<FirebasePushRegistrationStatus> {
    if (!running && !pending) return Promise.resolve(lastResult);
    return new Promise((resolve) => waiters.push({ epoch: scope, resolve }));
  }
  async function registerQueued(job: { token: string; uid: string; epoch: number }): Promise<FirebasePushRegistrationStatus> {
    try {
      if (!active(job.epoch, job.uid)) return { status: "unavailable" };
      if (!(await dependencies.permissionGranted())) return { status: "permission-not-authorized" };
      if (!active(job.epoch, job.uid)) return { status: "unavailable" };
      const key = `${job.uid}:${job.token}`;
      if (key === lastRegistered && now() - registeredAt < 86_400_000) return { status: "registered" };
      const installationId = await dependencies.getInstallationId();
      if (!active(job.epoch, job.uid)) return { status: "unavailable" };
      const registration = getFirebaseMessagingRegistrationContract({ installationId, token: job.token });
      if (!registration) return { status: "error" };
      if (!(await dependencies.permissionGranted())) return { status: "permission-not-authorized" };
      if (!active(job.epoch, job.uid)) return { status: "unavailable" };
      const accepted = await dependencies.register(registration, job.uid);
      if (!active(job.epoch, job.uid)) return { status: "unavailable" };
      if (!accepted) return { status: "error" };
      lastRegistered = key; registeredAt = now();
      return { status: "registered" };
    } catch { return { status: "error" }; }
  }
  function drain() {
    if (running || !pending) return;
    running = true;
    const scope = pending.epoch;
    void Promise.resolve().then(async () => {
      while (pending && pending.epoch === scope && epoch === scope) {
        const job = pending;
        pending = null;
        lastResult = await registerQueued(job);
      }
      settle(scope, lastResult);
    }).catch(() => { settle(scope, { status: "error" }); }).finally(() => { running = false; drain(); });
  }
  function queue(token: string, uid: string, scope: number): Promise<FirebasePushRegistrationStatus> {
    if (!active(scope, uid)) return Promise.resolve({ status: "unavailable" });
    if (!getFirebaseMessagingRegistrationContract({ installationId: "firebase-token-validation", token })) return Promise.resolve({ status: "error" });
    pending = { token, uid, epoch: scope };
    const completed = new Promise<FirebasePushRegistrationStatus>((resolve) => waiters.push({ epoch: scope, resolve }));
    drain(); return completed;
  }

  return {
    start(notificationsAuthorized: boolean): Promise<FirebasePushRegistrationStatus> {
      if (!notificationsAuthorized) { stop(); return Promise.resolve({ status: "permission-not-authorized" }); }
      if (starting?.epoch === epoch) return starting.promise;
      const scope = epoch;
      const promise = (async (): Promise<FirebasePushRegistrationStatus> => {
        try {
          if (!(await dependencies.permissionGranted())) { if (epoch === scope) stop(); return { status: "permission-not-authorized" }; }
          const uid = dependencies.currentUid();
          if (!uid || epoch !== scope) return { status: "unavailable" };
          if (activeUid !== null && activeUid !== uid) { stop(); return { status: "unavailable" }; }
          activeUid = uid;
          await dependencies.prepareDevice();
          if (!active(scope, uid)) return { status: "unavailable" };
          if (!(await dependencies.permissionGranted())) { if (epoch === scope) stop(); return { status: "permission-not-authorized" }; }
          if (!active(scope, uid)) return { status: "unavailable" };
          if (!unsubscribe) unsubscribe = dependencies.onTokenRefresh((token) => {
            if (active(scope, uid)) { tokenSequence += 1; void queue(token, uid, scope); }
          });
          const sequence = tokenSequence;
          const token = await dependencies.getToken();
          if (!active(scope, uid)) return { status: "unavailable" };
          return sequence === tokenSequence ? queue(token, uid, scope) : waitForDrain(scope);
        } catch { return { status: "error" }; }
      })();
      starting = { epoch: scope, promise };
      void promise.then(() => { if (starting?.promise === promise) starting = null; });
      return promise;
    },
    stop
  };
}

export type FirebaseNotificationOpenDependencies = {
  permissionGranted(): Promise<boolean>;
  getInitialNotification(): Promise<unknown>;
  onNotificationOpened(listener: (message: unknown) => void): () => void;
  seenMessageIds?: Set<string>;
  websiteRecoveryInbox?: WebsiteRecoveryAlertInbox;
  now?: () => number;
};

export type FirebaseNotificationOpenOptions = {
  onWebsiteRecovery?: () => void;
  /** Required for website entry: the durable active DNS enrollment audience, or null without consent. */
  readCurrentWebsiteAudience?: () => string | null;
  /** Must include the caller's current owner, consent and navigation-readiness fence. */
  isCurrent?: () => boolean;
};

/** Only person-open SDK events can enter the fixed check-in or generic recovery callbacks. */
export function createFirebaseNotificationOpenListener(
  dependencies: FirebaseNotificationOpenDependencies,
  onCheckIn: () => void,
  options: FirebaseNotificationOpenOptions = {}
): () => void {
  let active = true;
  let unsubscribe: (() => void) | null = null;
  const seen = dependencies.seenMessageIds ?? new Set<string>();
  const recoveryInbox = dependencies.websiteRecoveryInbox ?? createWebsiteRecoveryAlertInbox({ seenMessageIds: seen, now: dependencies.now });
  function current() {
    try { return active && (options.isCurrent?.() ?? true); } catch { return false; }
  }
  function readWebsiteAudience(): string | null {
    try {
      const audience = options.readCurrentWebsiteAudience?.();
      return isWebsiteRecoveryAudience(audience) ? audience : null;
    } catch { return null; }
  }
  const websiteAudience = options.onWebsiteRecovery && current() ? readWebsiteAudience() : null;
  let websiteBindingCurrent = websiteAudience !== null;
  function websiteCurrent() {
    if (!current() || !websiteBindingCurrent) return false;
    // A listener belongs to one enrollment. Rebinding requires a fresh listener;
    // an old provider-accepted notification cannot become a new owner's entry.
    if (readWebsiteAudience() !== websiteAudience) websiteBindingCurrent = false;
    return websiteBindingCurrent;
  }
  function opened(value: unknown) {
    if (!current() || !value || typeof value !== "object" || Array.isArray(value)) return;
    const message = value as Record<string, unknown>;
    const data = message.data && typeof message.data === "object" ? message.data as Record<string, unknown> : null;
    // A malformed/ambiguous recovery payload must not fall through to check-in routing.
    if (data?.kind === "website-recovery") {
      if (!options.onWebsiteRecovery || !websiteCurrent()) return;
      if (recoveryInbox.takeOpened(value, websiteAudience) && websiteCurrent()) {
        try { options.onWebsiteRecovery(); } catch { /* Access is still resolved by the ordinary guided-session controller. */ }
      }
      return;
    }
    if (data?.route !== "checkin" || typeof message.messageId !== "string" || message.messageId.length < 1 || message.messageId.length > 200 || seen.has(message.messageId)) return;
    rememberNotificationMessageId(seen, message.messageId);
    try { onCheckIn(); } catch { /* A UI callback cannot disclose or replay the notification body. */ }
  }
  void (async () => {
    try {
      if (!current()) return;
      websiteCurrent();
      if (!(await dependencies.permissionGranted()) || !current()) return;
      websiteCurrent();
      const removeListener = dependencies.onNotificationOpened(opened);
      if (!current()) { removeListener(); return; }
      websiteCurrent();
      unsubscribe = removeListener;
      const initial = await dependencies.getInitialNotification();
      websiteCurrent();
      opened(initial);
    } catch { /* An unavailable SDK/initial message must not request permission or invent a route. */ }
  })();
  return () => { active = false; unsubscribe?.(); unsubscribe = null; };
}
