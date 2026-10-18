import type { AutomaticBackupRuntime, AutomaticBackupStatus } from "./automatic-backup";

const status: AutomaticBackupStatus = {
  phase: "unavailable", enabled: false, attempts: 0, lastSyncedAt: null,
  reason: "unsupported", message: "Automatic backup is unavailable on this platform."
};

/** Web and Node refuse this native-only feature without reading or caching an encryption secret. */
const unsupportedRuntime: AutomaticBackupRuntime = {
  enable: async () => { throw new Error("Automatic backup is unavailable on this platform."); },
  disable: async () => undefined,
  sync: async () => ({ ok: false, status: "unavailable", attempts: 0, lastSyncedAt: null, reason: "unsupported" }),
  cancel: () => undefined,
  getStatus: () => ({ ...status }),
  subscribe: (listener) => { listener({ ...status }); return () => undefined; }
};

export function getAutomaticBackupRuntime(): AutomaticBackupRuntime { return unsupportedRuntime; }
