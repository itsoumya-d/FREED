package app.freed.protection

import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject

/** Private native receipts never cross the JS boundary or enter recovery backups. */
internal object FreedNativeUnlockStore {
  val lock = Any()
  private const val CLAIMED_LEASE = "claimed_native_unlock_lease_v1"
  private const val PACKAGE_RECEIPT = "native_package_unlock_receipt_v1"
  private const val SURFACE_RECEIPTS = "native_surface_unlock_receipts_v1"
  private const val GRANTED_ID = "earned_unlock_intervention_id_v1"
  private fun prefs(context: Context) = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
  private fun boot(context: Context): Int = try { Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1) } catch (_: Exception) { -1 }

  fun stage(context: Context, snapshot: Map<String, *>, editor: SharedPreferences.Editor) {
    if (!FreedProtectionConfiguration.interceptionEnabled(context)) { editor.remove(CLAIMED_LEASE); return }
    val id = (snapshot[FreedAccessibilityService.PENDING_INTERVENTION_ID] as? String)?.trim()?.lowercase().orEmpty()
    val source = (snapshot[FreedAccessibilityService.PENDING_SOURCE_PACKAGE] as? String)?.trim()?.lowercase().orEmpty()
    if (source !in FreedInstalledApplications.eligible(context)) { editor.remove(CLAIMED_LEASE); return }
    val matchedRule = (snapshot[FreedAccessibilityService.PENDING_RULE] as? String).orEmpty()
    val surface = (snapshot[FreedAccessibilityService.PENDING_FOCUS_SHIELD_RULE_ID] as? String)?.takeIf { id ->
      FreedFocusShieldRules.list(context).any { it.enabled && it.id == id && it.packageName == source }
    }
    val detected = (snapshot[FreedAccessibilityService.PENDING_DETECTED_AT] as? String)?.let { raw ->
      parseIso(raw)
    }
    val lease = detected?.let { FreedNativeUnlockPolicy.claim(id, source, matchedRule, surface, it,
      System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) }
    if (lease == null) editor.remove(CLAIMED_LEASE) else editor.putString(CLAIMED_LEASE, encode(lease))
  }

  fun fulfill(context: Context, id: String?, source: String, ruleId: String?, expiryMs: Long): FreedNativeUnlockDecision? = synchronized(lock) {
    if (!FreedProtectionConfiguration.interceptionEnabled(context) || source !in FreedInstalledApplications.eligible(context)) return@synchronized null
    val storage = prefs(context)
    val now = System.currentTimeMillis()
    val elapsed = SystemClock.elapsedRealtime()
    val bootCount = boot(context)
    // A duplicate JS hydration can observe an existing grant, but cannot renew
    // it or consume a later target's staged lease.
    if (ruleId == null) {
      val receipt = decode(storage.getString(PACKAGE_RECEIPT, null))
      val replay = FreedNativeUnlockPolicy.authorize(receipt, id, source, null, expiryMs, now, elapsed, bootCount)
      if (replay != null && !replay.firstFulfillment) return@synchronized replay
    } else {
      val receipt = decode(surfaceReceipts(storage).optString(surfaceKey(source, ruleId)))
      val replay = FreedNativeUnlockPolicy.authorize(receipt, id, source, ruleId, expiryMs, now, elapsed, bootCount)
      if (replay != null && !replay.firstFulfillment) return@synchronized replay
    }
    // A v2 group lease owns the single app-break slot. Historical v1 replays above
    // remain immutable, but no fresh package/surface grant may stack behind it.
    if (FreedAppGroupStore.hasActiveEarnedTimeWindow(context)) return@synchronized null
    val lease = decode(storage.getString(CLAIMED_LEASE, null))
    val decision = FreedNativeUnlockPolicy.authorize(lease, id, source, ruleId, expiryMs, now, elapsed, bootCount)
      ?: return@synchronized null
    if (!decision.firstFulfillment) return@synchronized decision
    val before = storage.all
    val fulfilled = lease!!.copy(fulfilledRequestExpiryMs = expiryMs, grantedExpiryMs = decision.expiresAtMs)
    val editor = storage.edit().putString(CLAIMED_LEASE, encode(fulfilled))
    if (ruleId == null) {
      editor.putString(PACKAGE_RECEIPT, encode(fulfilled)).putString(GRANTED_ID, fulfilled.interventionId)
        .putString(FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE, source)
        .putString(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT, formatIso(decision.expiresAtMs))
    } else {
      val receipts = surfaceReceipts(storage)
      receipts.keys().asSequence().toList().forEach { key ->
        val old = decode(receipts.optString(key))
        if (old?.grantedExpiryMs == null || old.grantedExpiryMs <= now) receipts.remove(key)
      }
      receipts.put(surfaceKey(source, ruleId), encode(fulfilled))
      editor.putString(SURFACE_RECEIPTS, receipts.toString())
    }
    if (!editor.commit()) {
      // SharedPreferences may change memory even when disk commit fails. Restore
      // only this transaction's keys so rejection cannot open an unissued window
      // or discard a different already-granted target.
      val rollback = storage.edit()
      val keys = if (ruleId == null) listOf(CLAIMED_LEASE, PACKAGE_RECEIPT, GRANTED_ID,
        FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE, FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT)
        else listOf(CLAIMED_LEASE, SURFACE_RECEIPTS)
      keys.forEach { key -> (before[key] as? String)?.let { rollback.putString(key, it) } ?: rollback.remove(key) }
      rollback.apply()
      null
    } else decision
  }

  fun hasActivePackageGrant(context: Context, source: String, expiryMs: Long, expectedId: String? = null): Boolean {
    if (!FreedProtectionConfiguration.interceptionEnabled(context) || source !in FreedInstalledApplications.eligible(context)) return false
    val storage = prefs(context)
    val receipt = decode(storage.getString(PACKAGE_RECEIPT, null)) ?: return false
    if (expectedId != null && receipt.interventionId != expectedId) return false
    val requestExpiry = receipt.fulfilledRequestExpiryMs ?: return false
    val decision = FreedNativeUnlockPolicy.authorize(receipt, storage.getString(GRANTED_ID, null), source, null,
      requestExpiry, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) ?: return false
    return !decision.firstFulfillment && decision.expiresAtMs == expiryMs
  }

  fun clearPackageReceipt(editor: SharedPreferences.Editor) { editor.remove(PACKAGE_RECEIPT).remove(GRANTED_ID) }
  fun clearAllAuthority(editor: SharedPreferences.Editor) {
    FreedAppGroupStore.clearAuthority(editor)
    editor.remove(CLAIMED_LEASE).remove(PACKAGE_RECEIPT).remove(SURFACE_RECEIPTS).remove(GRANTED_ID)
      .remove(FreedAccessibilityService.EARNED_UNLOCK_EXPIRES_AT).remove(FreedAccessibilityService.EARNED_UNLOCK_SOURCE_PACKAGE)
  }
  fun restoreClaimedLease(editor: SharedPreferences.Editor, snapshot: Map<String, *>) {
    (snapshot[CLAIMED_LEASE] as? String)?.let { editor.putString(CLAIMED_LEASE, it) } ?: editor.remove(CLAIMED_LEASE)
  }

  fun activePackageInterventionId(context: Context, source: String, expiryMs: Long): String? = synchronized(lock) {
    if (!hasActivePackageGrant(context, source, expiryMs)) null else prefs(context).getString(GRANTED_ID, null)
  }

  fun activeSurfaceInterventionId(context: Context, source: String, ruleId: String, expiryMs: Long): String? {
    if (!FreedProtectionConfiguration.interceptionEnabled(context) || source !in FreedInstalledApplications.eligible(context)) return null
    val receipt = decode(surfaceReceipts(prefs(context)).optString(surfaceKey(source, ruleId))) ?: return null
    val requestExpiry = receipt.fulfilledRequestExpiryMs ?: return null
    val decision = FreedNativeUnlockPolicy.authorize(receipt, receipt.interventionId, source, ruleId, requestExpiry,
      System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) ?: return null
    return receipt.interventionId.takeIf { !decision.firstFulfillment && decision.expiresAtMs == expiryMs }
  }

  private fun surfaceKey(source: String, ruleId: String) = "$source|$ruleId"
  private fun surfaceReceipts(storage: SharedPreferences): JSONObject = try {
    val raw = storage.getString(SURFACE_RECEIPTS, null)
    if (raw == null || raw.length > 65536) JSONObject() else JSONObject(raw)
  } catch (_: Exception) { JSONObject() }

  private fun formatIso(time: Long): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
    timeZone = java.util.TimeZone.getTimeZone("UTC")
  }.format(java.util.Date(time))

  private fun parseIso(raw: String): Long? = listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'").firstNotNullOfOrNull { pattern ->
    val parser = java.text.SimpleDateFormat(pattern, java.util.Locale.US).apply { isLenient = false; timeZone = java.util.TimeZone.getTimeZone("UTC") }
    val position = java.text.ParsePosition(0)
    parser.parse(raw, position)?.takeIf { position.index == raw.length }?.time
  }

  private fun encode(lease: FreedNativeUnlockLease): String = JSONObject().apply {
    put("version", 1); put("id", lease.interventionId); put("package", lease.packageName)
    put("rule", lease.ruleId ?: JSONObject.NULL); put("claimedAt", lease.claimedAtMs)
    put("elapsed", lease.claimedElapsedMs); put("boot", lease.bootCount)
    put("requestedExpiry", lease.fulfilledRequestExpiryMs ?: JSONObject.NULL)
    put("grantedExpiry", lease.grantedExpiryMs ?: JSONObject.NULL)
  }.toString()

  private fun decode(raw: String?): FreedNativeUnlockLease? = try {
    if (raw == null || raw.length > 1024) null else JSONObject(raw).let {
      if (it.getInt("version") != 1) null else FreedNativeUnlockLease(it.getString("id"), it.getString("package"),
        if (it.isNull("rule")) null else it.getString("rule"), it.getLong("claimedAt"), it.getLong("elapsed"), it.getInt("boot"),
        if (it.isNull("requestedExpiry")) null else it.getLong("requestedExpiry"), if (it.isNull("grantedExpiry")) null else it.getLong("grantedExpiry"))
    }
  } catch (_: Exception) { null }
}
