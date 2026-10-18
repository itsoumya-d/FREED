package app.freed.protection

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager

internal object FreedEncryptedDnsConfig {
  const val RELEASE_FLAG = "app.freed.protection.ENCRYPTED_DNS_RELEASE_ENABLED"
  const val PREVIEW_FLAG = "app.freed.protection.ENCRYPTED_DNS_DEV_PREVIEW"
  private const val PREFERENCES = "freed_encrypted_dns"
  private const val ENABLED = "cloudflare_families_enabled"
  // Families preferences, pilot pointer/runtime swaps and plaintext send admission
  // share one boundary: no old plaintext send may start after either encrypted opt-in.
  internal val configurationLock = Any()

  data class Capability(val supported: Boolean, val releaseEnabled: Boolean)

  fun capability(context: Context): Capability {
    val info = runCatching {
      context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    }.getOrNull() ?: return Capability(false, false)
    val release = info.metaData?.getBoolean(RELEASE_FLAG, false) == true
    val preview = info.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0 &&
      info.metaData?.getBoolean(PREVIEW_FLAG, false) == true
    return Capability(release || preview, release)
  }

  internal fun requestedReadback(context: Context): Boolean? = synchronized(configurationLock) {
    val state = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).all
    check(state.keys.all { it == ENABLED }) { "adult-encrypted-state-unknown" }
    val value = state[ENABLED]
    check(value == null || value is Boolean) { "adult-encrypted-state-malformed" }
    value as? Boolean
  }

  fun isRequested(context: Context): Boolean = synchronized(configurationLock) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getBoolean(ENABLED, false)
  }

  fun setRequested(context: Context, enabled: Boolean): Boolean = setRequested(context, enabled, null)
  internal fun setRequested(context: Context, enabled: Boolean, permit: FreedAdultPermit?): Boolean = FreedAdultProtectionState.guarded(context) {
    if (!enabled) FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.DISABLE_ENCRYPTED_DNS,
      "encrypted-request", isRequested(context).toString(), "false", permit)
    else FreedAdultProtectionState.repairFence(context, "encrypted-enable")
    synchronized(FreedNativeUnlockStore.lock) {
      if (!enabled && !FreedProtectionConfiguration.interceptionEnabled(context)) return@synchronized false
      synchronized(configurationLock) {
        val storage = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        val saved = storage.edit().putBoolean(ENABLED, enabled).commit() && storage.getBoolean(ENABLED, !enabled) == enabled
        if (saved && enabled) FreedRecoveryDnsPilot.restoreFamilies(context)
        saved
      }
    }
  }

  fun clearOwnedConfiguration(context: Context): Boolean = clearOwnedConfiguration(context, null)
  internal fun clearOwnedConfiguration(context: Context, permit: FreedAdultPermit?): Boolean = FreedAdultProtectionState.guarded(context) {
    FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.DISABLE_ENCRYPTED_DNS,
      "encrypted-clear", if (ownedConfigurationEmpty(context)) "empty" else isRequested(context).toString(), "empty", permit)
    synchronized(FreedNativeUnlockStore.lock) { synchronized(configurationLock) {
      val storage = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      storage.edit().clear().commit() && storage.all.isEmpty()
    } }
  }

  fun ownedConfigurationEmpty(context: Context): Boolean = synchronized(configurationLock) {
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).all.isEmpty()
  }

  // This check and UDP send are atomic with an opt-in. A query queued while DNS
  // was plaintext cannot leak after the encrypted preference has been saved.
  fun <T> withPlaintextPermission(context: Context, send: () -> T): T? = synchronized(configurationLock) {
    if (!FreedProtectionConfiguration.interceptionEnabled(context) || isRequested(context) || FreedRecoveryDnsPilot.activeOrUnknown(context)) null else send()
  }
}
