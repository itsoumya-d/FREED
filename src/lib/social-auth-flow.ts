export type SocialProviderToken =
  | { provider: "google"; idToken: string; accessToken?: string }
  | { provider: "apple"; identityToken: string; nonce: string; authorizationCode: string | null };

export type SocialSignInResult =
  | { ok: true; token: SocialProviderToken; email: string | null }
  | { ok: false; reason: "unavailable" | "cancelled" | "error"; message: string };

export type GoogleSignInSdk = {
  configure: (options: { webClientId: string; iosClientId?: string; offlineAccess: false }) => void;
  hasPlayServices: (options: { showPlayServicesUpdateDialog: true }) => Promise<boolean>;
  signIn: () => Promise<unknown>;
};

export function createGoogleSignInFlow(dependencies: {
  platform: () => string;
  webClientId: () => string | null;
  iosClientId?: () => string | null;
  loadSdk: () => Promise<GoogleSignInSdk>;
}) {
  let configuredClientIds: string | null = null;
  const isConfigured = () => Boolean(dependencies.webClientId()?.trim()) && dependencies.platform() !== "web";

  return {
    isConfigured,
    async signIn(): Promise<SocialSignInResult> {
      const webClientId = dependencies.webClientId()?.trim();
      if (!webClientId || dependencies.platform() === "web") {
        return { ok: false, reason: "unavailable", message: "Google sign-in is not configured in this build." };
      }

      try {
        const sdk = await dependencies.loadSdk();
        const iosClientId = dependencies.platform() === "ios" ? dependencies.iosClientId?.()?.trim() : undefined;
        const configuration = JSON.stringify([webClientId, iosClientId || null]);
        if (configuredClientIds !== configuration) {
          sdk.configure({ webClientId, offlineAccess: false, ...(iosClientId ? { iosClientId } : {}) });
          configuredClientIds = configuration;
        }
        if (dependencies.platform() === "android") {
          const available = await sdk.hasPlayServices({ showPlayServicesUpdateDialog: true });
          if (!available) {
            return { ok: false, reason: "unavailable", message: "Google Play Services are unavailable on this device." };
          }
        }
        const response = record(await sdk.signIn());
        if (response?.type === "cancelled") return googleCancelled();
        // Current SDKs return a discriminated response; older SDKs return User.
        const userData = response?.type === "success" ? record(response.data) : response?.type == null ? response : null;
        const idToken = nonemptyString(userData?.idToken);
        if (!idToken) {
          return { ok: false, reason: "error", message: "Google did not return an identity token." };
        }
        const email = nonemptyString(record(userData?.user)?.email);
        return { ok: true, token: { provider: "google", idToken }, email };
      } catch (error) {
        if (["-1", "12501", "SIGN_IN_CANCELLED"].includes(errorCode(error) ?? "")) return googleCancelled();
        return { ok: false, reason: "error", message: "Google sign-in could not be completed. Try again." };
      }
    }
  };
}

export function createAppleSignInFlow(dependencies: {
  platform: () => string;
  isAvailable: () => Promise<boolean>;
  randomBytes: (size: number) => Promise<Uint8Array>;
  sha256: (value: string) => Promise<string>;
  signIn: (options: { nonce: string }) => Promise<unknown>;
}) {
  const isAvailable = async () => {
    if (dependencies.platform() !== "ios") return false;
    try {
      return await dependencies.isAvailable();
    } catch {
      return false;
    }
  };

  return {
    isAvailable,
    async signIn(): Promise<SocialSignInResult> {
      if (!(await isAvailable())) {
        return { ok: false, reason: "unavailable", message: "Apple sign-in is not available on this device." };
      }

      try {
        const rawBytes = await dependencies.randomBytes(32);
        if (!(rawBytes instanceof Uint8Array) || rawBytes.length !== 32) throw new Error("Secure nonce generation failed.");
        const nonce = Array.from(rawBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
        const hashedNonce = await dependencies.sha256(nonce);
        if (!/^[a-f0-9]{64}$/i.test(hashedNonce)) throw new Error("Nonce hashing failed.");
        const response = record(await dependencies.signIn({ nonce: hashedNonce.toLowerCase() }));
        const identityToken = nonemptyString(response?.identityToken);
        if (!identityToken) {
          return { ok: false, reason: "error", message: "Apple did not return an identity token." };
        }
        return {
          ok: true,
          token: {
            provider: "apple", identityToken, nonce,
            authorizationCode: nonemptyString(response?.authorizationCode)
          },
          email: nonemptyString(response?.email)
        };
      } catch (error) {
        if (["ERR_REQUEST_CANCELED", "ERR_CANCELED", "1001"].includes(errorCode(error) ?? "")) {
          return { ok: false, reason: "cancelled", message: "Apple sign-in was cancelled." };
        }
        return { ok: false, reason: "error", message: "Apple sign-in could not be completed. Try again." };
      }
    }
  };
}

export type AuthIdentityUser = { uid: string; isAnonymous: boolean };

export type AuthIdentityApi<Credential, User extends AuthIdentityUser> = {
  currentUser: () => User | null;
  signInAnonymously: () => Promise<{ user: User }>;
  signInWithCredential: (credential: Credential) => Promise<{ user: User }>;
  linkWithCredential: (user: User, credential: Credential) => Promise<{ user: User }>;
  beforeLink?: (user: User) => Promise<void>;
  reauthenticateWithCredential?: (user: User, credential: Credential) => Promise<{ user: User }>;
  createEmailCredential?: (email: string, password: string) => Credential;
  createUserWithEmailAndPassword?: (email: string, password: string) => Promise<{ user: User }>;
  signInWithProvider?: (provider: unknown) => Promise<{ user: User }>;
  linkWithProvider?: (user: User, provider: unknown) => Promise<{ user: User }>;
  reauthenticateWithProvider?: (user: User, provider: unknown) => Promise<{ user: User }>;
  signOut?: () => Promise<void>;
};

export type AuthIdentityResult<User extends AuthIdentityUser> =
  | { ok: true; user: User; operation: "linked" | "signed-in" | "reauthenticated" }
  | { ok: false; reason: AuthIdentityFailureReason; message: string };

export type AuthIdentityFailureReason = "account-conflict" | "provider-already-linked" | "user-changed" | "sign-in-required" | "sign-out-required" | "link-unavailable" | "unavailable";

const AUTH_FAILURE_MESSAGES: Record<AuthIdentityFailureReason, string> = {
  "account-conflict": "This sign-in belongs to another account. Choose how to continue before switching accounts.",
  "provider-already-linked": "This sign-in method is already linked to the current account.",
  "user-changed": "The signed-in account changed. Try this action again.",
  "sign-in-required": "Sign in to your account before confirming this action.",
  "sign-out-required": "Link an additional sign-in method to this account, or sign out before switching accounts.",
  "link-unavailable": "Account linking could not be confirmed. Your current account was kept. Try again when account services are available.",
  unavailable: "Account confirmation is unavailable in this build."
};

export function getAuthIdentityFailureMessage(reason: AuthIdentityFailureReason): string { return AUTH_FAILURE_MESSAGES[reason]; }

/** Safe bridge from native identity coordination to the public Auth adapter. */
export class AuthIdentityFlowError extends Error {
  constructor(readonly code: AuthIdentityFailureReason) {
    super(getAuthIdentityFailureMessage(code));
    this.name = "AuthIdentityFlowError";
  }
}

/**
 * Construct once per native Auth instance. Construction has no SDK side effects;
 * only a deliberate remote-feature request should call ensureGuest().
 */
export function createAuthIdentityCoordinator<Credential, User extends AuthIdentityUser>(
  api: AuthIdentityApi<Credential, User>
) {
  let tail: Promise<void> = Promise.resolve();
  let guestPromise: Promise<User> | null = null;

  function enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const pending = tail.then(operation);
    // Failed network operations must not block future sign-in or sign-out.
    tail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async function linkExistingUser(current: User, credential: Credential): Promise<AuthIdentityResult<User>> {
    return linkExisting(current, () => api.linkWithCredential(current, credential));
  }

  async function linkExisting(current: User, link: () => Promise<{ user: User }>): Promise<AuthIdentityResult<User>> {
    const originalUid = current.uid;
    try {
      await api.beforeLink?.(current);
    } catch {
      return api.currentUser()?.uid !== originalUid ? userChanged() : identityFailure("link-unavailable");
    }
    if (api.currentUser()?.uid !== originalUid) return userChanged();
    try {
      const { user } = await link();
      if (user.uid !== originalUid || api.currentUser()?.uid !== originalUid) return userChanged();
      return { ok: true, user, operation: "linked" };
    } catch (error) {
      if (api.currentUser()?.uid !== originalUid) return userChanged();
      if (errorCode(error) === "auth/provider-already-linked") return identityFailure("provider-already-linked");
      if (isAccountConflict(error)) return accountConflict();
      throw error;
    }
  }

  return {
    ensureGuest(): Promise<User> {
      if (guestPromise) return guestPromise;
      const pending = enqueue(async () => {
        const current = api.currentUser();
        if (current) return current;
        const { user } = await api.signInAnonymously();
        if (!nonemptyString(user.uid) || api.currentUser()?.uid !== user.uid) {
          throw new Error("The authenticated identity changed during guest initialization.");
        }
        return user;
      });
      guestPromise = pending;
      const clear = () => { if (guestPromise === pending) guestPromise = null; };
      void pending.then(clear, clear);
      return pending;
    },

    signInWithCredential(credential: Credential): Promise<AuthIdentityResult<User>> {
      return enqueue(async () => {
        const current = api.currentUser();
        if (current?.isAnonymous) return linkExistingUser(current, credential);
        if (current) return identityFailure("sign-out-required");
        try {
          const { user } = await api.signInWithCredential(credential);
          if (!nonemptyString(user.uid) || api.currentUser()?.uid !== user.uid) {
            return userChanged();
          }
          return { ok: true, user, operation: "signed-in" };
        } catch (error) {
          if (isAccountConflict(error)) return accountConflict();
          throw error;
        }
      });
    },

    createEmailAccount(email: string, password: string): Promise<AuthIdentityResult<User>> {
      return enqueue(async () => {
        const current = api.currentUser();
        if (current?.isAnonymous) {
          if (!api.createEmailCredential) return identityFailure("unavailable");
          return linkExistingUser(current, api.createEmailCredential(email, password));
        }
        if (current) return identityFailure("sign-out-required");
        if (!api.createUserWithEmailAndPassword) return identityFailure("unavailable");
        try {
          const { user } = await api.createUserWithEmailAndPassword(email, password);
          if (!nonemptyString(user.uid) || api.currentUser()?.uid !== user.uid) return userChanged();
          return { ok: true, user, operation: "signed-in" };
        } catch (error) {
          if (isAccountConflict(error)) return accountConflict();
          throw error;
        }
      });
    },

    /** Native OAuth includes its pending-result recovery inside this queue. */
    signInWithProvider(provider: unknown, options: { linkExisting?: boolean } = {}): Promise<AuthIdentityResult<User>> {
      const linkExistingRequested = options.linkExisting === true;
      const expectedUid = linkExistingRequested ? api.currentUser()?.uid ?? null : null;
      return enqueue(async () => {
        const current = api.currentUser();
        if (linkExistingRequested) {
          if (!expectedUid) return identityFailure("sign-in-required");
          if (current?.uid !== expectedUid) return userChanged();
        }
        if (current && (current.isAnonymous || linkExistingRequested)) {
          if (!api.linkWithProvider) return identityFailure("link-unavailable");
          return linkExisting(current, () => api.linkWithProvider!(current, provider));
        }
        if (current) return identityFailure("sign-out-required");
        if (linkExistingRequested) return identityFailure("sign-in-required");
        if (!api.signInWithProvider) return identityFailure("unavailable");
        try {
          const { user } = await api.signInWithProvider(provider);
          if (!nonemptyString(user.uid) || api.currentUser()?.uid !== user.uid) return userChanged();
          return { ok: true, user, operation: "signed-in" };
        } catch (error) {
          if (isAccountConflict(error)) return accountConflict();
          throw error;
        }
      });
    },

    reauthenticateWithProvider(provider: unknown): Promise<AuthIdentityResult<User>> {
      const requestedUser = api.currentUser();
      const expectedUid = requestedUser && !requestedUser.isAnonymous ? requestedUser.uid : null;
      return enqueue(async () => {
        if (!expectedUid) return identityFailure("sign-in-required");
        const current = api.currentUser();
        if (current?.uid !== expectedUid) return userChanged();
        if (current.isAnonymous) return identityFailure("sign-in-required");
        if (!api.reauthenticateWithProvider) return identityFailure("unavailable");
        const originalUid = current.uid;
        try {
          const { user } = await api.reauthenticateWithProvider(current, provider);
          return user.uid === originalUid && api.currentUser()?.uid === originalUid
            ? { ok: true, user, operation: "reauthenticated" } : userChanged();
        } catch (error) {
          if (isAccountConflict(error)) return accountConflict();
          throw error;
        }
      });
    },

    /** Keeps the expected owner locked through confirmation and revocation. */
    performCurrentAccountAction(expectedUid: string, action: (user: User) => Promise<void>): Promise<AuthIdentityResult<User>> {
      return enqueue(async () => {
        const current = api.currentUser();
        if (!current || current.isAnonymous) return identityFailure("sign-in-required");
        if (current.uid !== expectedUid) return userChanged();
        try {
          await action(current);
          const user = api.currentUser();
          return user?.uid === expectedUid ? { ok: true, user, operation: "reauthenticated" } : userChanged();
        } catch (error) {
          if (api.currentUser()?.uid !== expectedUid) return userChanged();
          if (isAccountConflict(error)) return accountConflict();
          throw error;
        }
      });
    },

    linkCurrentCredential(credential: Credential): Promise<AuthIdentityResult<User>> {
      // Capture the primitive UID before waiting; a queued sign-out/sign-in
      // must never attach this credential to the replacement account.
      const expectedUid = api.currentUser()?.uid ?? null;
      return enqueue(async () => {
        if (!expectedUid) return identityFailure("sign-in-required");
        const current = api.currentUser();
        if (current?.uid !== expectedUid) return userChanged();
        return linkExistingUser(current, credential);
      });
    },

    reauthenticateWithCredential(credential: Credential): Promise<AuthIdentityResult<User>> {
      const requestedUser = api.currentUser();
      const expectedUid = requestedUser && !requestedUser.isAnonymous ? requestedUser.uid : null;
      return enqueue(async () => {
        if (!expectedUid) return identityFailure("sign-in-required");
        const current = api.currentUser();
        if (current?.uid !== expectedUid) return userChanged();
        if (current.isAnonymous) {
          return identityFailure("sign-in-required");
        }
        if (!api.reauthenticateWithCredential) {
          return identityFailure("unavailable");
        }
        const originalUid = current.uid;
        try {
          const { user } = await api.reauthenticateWithCredential(current, credential);
          if (user.uid !== originalUid || api.currentUser()?.uid !== originalUid) return userChanged();
          return { ok: true, user, operation: "reauthenticated" };
        } catch (error) {
          if (isAccountConflict(error)) return accountConflict();
          throw error;
        }
      });
    },

    signOut(): Promise<void> {
      // A new explicit guest request after sign-out belongs to the next session.
      guestPromise = null;
      return enqueue(async () => {
        if (!api.signOut) throw new Error("Account sign-out is unavailable in this build.");
        await api.signOut();
      });
    }
  };
}

function isAccountConflict(error: unknown): boolean {
  return ["auth/credential-already-in-use", "auth/account-exists-with-different-credential", "auth/email-already-in-use", "auth/user-mismatch"]
    .includes(errorCode(error) ?? "");
}

function accountConflict(): Extract<AuthIdentityResult<AuthIdentityUser>, { ok: false }> {
  return identityFailure("account-conflict");
}

function userChanged(): Extract<AuthIdentityResult<AuthIdentityUser>, { ok: false }> {
  return identityFailure("user-changed");
}

function identityFailure(reason: AuthIdentityFailureReason): Extract<AuthIdentityResult<AuthIdentityUser>, { ok: false }> {
  return { ok: false, reason, message: getAuthIdentityFailureMessage(reason) };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function nonemptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function errorCode(error: unknown): string | null {
  const code = record(error)?.code;
  return typeof code === "number" ? String(code) : nonemptyString(code);
}

function googleCancelled(): SocialSignInResult {
  return { ok: false, reason: "cancelled", message: "Google sign-in was cancelled." };
}
