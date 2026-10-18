/** Package A schema only. Native integrations must advertise support before these requests exist.
 * A receipt is diagnostic data, never a JavaScript permission, app lease, or reusable unlocked flag.
 * Friend secrets must remain ephemeral, never enter history, backup, analytics or logs. */
export type FriendLockStatus = 'notEnrolled' | 'enrolled' | 'missingEnrolled' | 'corrupt' | 'unavailable';
export type FriendLockAction =
  | 'disableAdultFilter'
  | 'disableEncryptedDNS'
  | 'removeAdultDomains'
  | 'addAdultExceptions'
  | 'resetAdultProtection'
  | 'reduceAdultSchedule';
export type FriendLockFailure =
  | 'invalidPIN' | 'pinMismatch' | 'invalidScope' | 'baselineUnavailable'
  | 'alreadyEnrolled' | 'notEnrolled' | 'missingEnrolled' | 'corrupt'
  | 'storageUnavailable' | 'commitOutcomeUnknown' | 'storageConflict' | 'incorrectSecret' | 'throttled'
  | 'scopeMismatch' | 'unknownOperation' | 'cancelled' | 'authorizationCapacity'
  | 'invalidTransition' | 'cryptoUnavailable';
export type FriendLockConfiguration = Readonly<{
  revision: string;
  mutationGeneration: string;
}>;
export type FriendLockReceipt = Readonly<{
  operationID: string;
  deltaDigest: string;
  configuration: FriendLockConfiguration;
  lockRevision: number;
  authorizationGeneration: number;
  state: 'awaitingSecret' | 'authorized' | 'inFlight' | 'completed' | 'cancelled';
  resultingConfiguration?: FriendLockConfiguration;
  readbackDigest?: string;
}>;
export type FriendLockEnrollment = Readonly<{
  lockRevision: number;
  /** One-time trusted-person presentation; never persist this value in JS. */
  recoveryKey: string;
}>;
export type FriendLockNativeCapability = Readonly<{
  schema: 1;
  coreAvailable: boolean;
  /** This remains false until B/C native mutation boundaries and device evidence are delivered. */
  mutationEnforcementAvailable: boolean;
}>;
