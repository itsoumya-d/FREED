package app.freed.protection

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager

object FreedFocusShieldRollout {
  private const val PREFS = "freed_focus_shield_rollout"
  private const val ROLLOUT = "surface_rollout_enabled"
  private fun flag(context: Context, name: String): Boolean = try {
    context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      .metaData?.getBoolean(name, false) == true
  } catch (_: Exception) { false }
  fun releaseEnabled(context: Context) = flag(context, "app.freed.protection.FOCUS_SHIELD_SURFACE_RELEASE_ENABLED")
  private fun debugBuild(context: Context) = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
  private fun devPreview(context: Context) = flag(context, "app.freed.protection.FOCUS_SHIELD_SURFACE_DEV_PREVIEW")
  fun buildAllowed(context: Context) = releaseEnabled(context) || (debugBuild(context) && devPreview(context))
  fun enabled(context: Context) = FreedProtectionConfiguration.interceptionEnabled(context) && FreedFocusShieldPolicy.canInspectSurface(releaseEnabled(context), debugBuild(context),
    devPreview(context), context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(ROLLOUT, false), true)
  fun configure(context: Context, enabled: Boolean): Unit = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedProtectionConfiguration.interceptionEnabled(context)) return@synchronized
    // Persist a deny when build capability is absent, including older binaries.
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ROLLOUT, enabled && buildAllowed(context)).apply()
  }
  fun clearOwnedConfiguration(context: Context): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit()
  }
  fun ownedConfigurationEmpty(context: Context): Boolean = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).all.isEmpty()
  fun reason(context: Context, authorized: Boolean): String = when {
    !buildAllowed(context) -> "release-gated"
    !enabled(context) -> "rollout-disabled"
    !authorized -> "permission-required"
    else -> "ready"
  }
}
