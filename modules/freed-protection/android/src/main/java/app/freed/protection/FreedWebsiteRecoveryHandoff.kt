package app.freed.protection

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.SystemClock

/** Private, process-local website routing fences. These never authorize app time or restore after restart. */
internal object FreedWebsiteRecoveryHandoff {
  const val PREVIEW_FLAG = "app.freed.websiteRecoveryDevPreview"
  private const val OWNER_EPOCH = "app_group_scope_epoch_v1"
  private const val GROUP_CONFIGURATION = "app_groups_configuration_v1"
  private const val CONSUMED_IDS = "pending_consumed_intervention_ids_v1"
  private data class Stamp(val id: String, val owner: String, val ownerEpoch: Long,
    val configurationEpoch: Long, val groupConfiguration: Any?, val elapsed: Long,
    val source: String?, val host: String?, val rule: String?)
  private var pending: Stamp? = null
  private val attemptedIds = LinkedHashSet<String>()
  private var lastAttemptElapsed: Long? = null

  /** Account cleanup clears only the captured original owner's private stamp.
   * It cannot close a filter, authorize access or erase a newer owner's pending payload. */
  fun clearPrivatePendingRetainingDevice(expectedOwnerScope: String, ownerCurrent: () -> Boolean): Boolean =
    synchronized(FreedNativeUnlockStore.lock) {
      if (!ownerCurrent() || pending?.owner?.let { it != expectedOwnerScope } == true) return@synchronized false
      pending = null
      true
    }

  fun previewEnabled(context: Context): Boolean = runCatching {
    val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    info.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0 && info.metaData?.getBoolean(PREVIEW_FLAG, false) == true
  }.getOrDefault(false)

  fun isWebsite(snapshot: Map<String, *>): Boolean {
    if (snapshot[FreedAccessibilityService.PENDING_SOURCE_PACKAGE] == "android-dns") return true
    val rule = snapshot[FreedAccessibilityService.PENDING_RULE] as? String ?: return false
    return !listOf("configured-app:", "short-form:", "focus-shield:", "app-group:").any(rule::startsWith)
  }

  /** Must run under the native grant lock, before replacing pending data. Unknown owner creates no private record. */
  fun publish(context: Context, prefs: SharedPreferences, id: String, fields: SharedPreferences.Editor.() -> Unit): Boolean =
    synchronized(FreedNativeUnlockStore.lock) {
      val owner = FreedAppGroupStore.capturePolicyScope(context) ?: return@synchronized false
      val state = prefs.all
      val scopeEpoch = (state[OWNER_EPOCH] as? Number)?.toLong() ?: return@synchronized false
      if (!FreedProtectionConfiguration.interceptionEnabled(context) || !FreedAppGroupStore.ownerScopeCurrent(owner)) return@synchronized false
      val stamp = Stamp(id, owner, scopeEpoch, FreedProtectionConfiguration.epoch(context), state[GROUP_CONFIGURATION], SystemClock.elapsedRealtime(), null, null, null)
      val editor = prefs.edit()
      state.keys.filter { it.startsWith("pending_") && it != CONSUMED_IDS }.forEach(editor::remove)
      editor.fields()
      pending = null
      if (!editor.commit()) return@synchronized false
      val published = prefs.all
      pending = stamp.copy(source = published[FreedAccessibilityService.PENDING_SOURCE_PACKAGE] as? String,
        host = published[FreedAccessibilityService.PENDING_HOST] as? String, rule = published[FreedAccessibilityService.PENDING_RULE] as? String)
      current(context, prefs.all, id)
    }

  /** Also used by native read, exact claim, and barrier. Owner fields never enter a returned payload. */
  fun current(context: Context, snapshot: Map<String, *>, expectedId: String?): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val stamp = pending ?: return@synchronized false
    val now = SystemClock.elapsedRealtime()
    val source = snapshot[FreedAccessibilityService.PENDING_SOURCE_PACKAGE] as? String
    val rule = snapshot[FreedAccessibilityService.PENDING_RULE] as? String
    if (source != stamp.source || rule != stamp.rule || snapshot[FreedAccessibilityService.PENDING_HOST] != stamp.host ||
      !isWebsite(snapshot) || expectedId != stamp.id || snapshot[FreedAccessibilityService.PENDING_INTERVENTION_ID] != stamp.id ||
      !FreedAppGroupStore.ownerScopeCurrent(stamp.owner) || (snapshot[OWNER_EPOCH] as? Number)?.toLong() != stamp.ownerEpoch ||
      snapshot[GROUP_CONFIGURATION] != stamp.groupConfiguration || FreedProtectionConfiguration.epoch(context) != stamp.configurationEpoch ||
      now < stamp.elapsed || now - stamp.elapsed > 600_000L ||
      snapshot.containsKey(FreedAccessibilityService.PENDING_FOCUS_SHIELD_RULE_ID) ||
      snapshot.containsKey(FreedAccessibilityService.PENDING_SESSION_DURATION_SECONDS) ||
      (snapshot[CONSUMED_IDS] as? String).orEmpty().split(',').contains(stamp.id)) return@synchronized false
    FreedInterventionHandoffPolicy.mayOpen(stamp.id, stamp.id, source, source, rule, rule,
      snapshot[FreedAccessibilityService.PENDING_DETECTED_AT] as? String, stamp.configurationEpoch,
      FreedProtectionConfiguration.epoch(context), FreedProtectionConfiguration.interceptionEnabled(context))
  }

  /** Cross-producer monotonic attempt budget; a denied start still consumes the budget. */
  fun requestOnce(id: String, now: Long, valid: () -> Boolean, start: () -> Unit): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    if (!runCatching(valid).getOrDefault(false) || id in attemptedIds || lastAttemptElapsed?.let { now < it || now - it < 4_000L } == true) return@synchronized false
    attemptedIds.add(id)
    while (attemptedIds.size > 64) attemptedIds.remove(attemptedIds.first())
    lastAttemptElapsed = now
    runCatching(start).isSuccess // Request acceptance is never observed presentation.
  }
}
