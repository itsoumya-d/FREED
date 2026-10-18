package app.freed.protection

import android.app.NotificationManager
import android.content.Context
import org.json.JSONObject
import java.util.UUID

/** Bounded durable retry capabilities outside the erased private namespace. No adult defaults/writes. */
internal object FreedRetainedAdultProtection {
  private const val PREFS = "freed_private_cleanup_v2"
  private const val KEY = "document"
  private const val LEGACY = "freed_private_cleanup_receipt_v1"
  private val coreOutcomes = java.util.concurrent.ConcurrentHashMap<String, String>()
  private val coreRunning = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
  private val coreExecutor = java.util.concurrent.Executors.newSingleThreadExecutor { work -> Thread(work, "freed-private-cleanup-core").apply { isDaemon = true } }
  private fun scheduleCore(context: Context, id: String) {
    if (!coreRunning.add(id)) return
    coreExecutor.execute {
      try {
        val authority = FreedAdultAuthorizationExecutor.get(context)
        val pending = synchronized(FreedNativeUnlockStore.lock) { pendingCore(read(context)).map { it.getString("id") }.toSet() }
        val reserved = authority.privateCleanupReservationLeader(pending)
        val leader = synchronized(FreedNativeUnlockStore.lock) {
          val doc = read(context)
          // A pre-upgrade reservation is authoritative for its still-closed native cohort.
          // No adult/Core lock is held while publishing the native lookup links.
          if (reserved != null && pendingCore(doc).any { it.getString("id") == reserved }) {
            val oldRoot = doc.getJSONObject("records").getJSONObject(reserved).optString("coreLeader", reserved)
            pendingCore(doc).filter { it.optString("coreLeader", it.getString("id")) == oldRoot }
              .forEach { it.put("coreLeader", reserved) }
            save(context, doc)
          }
          doc.getJSONObject("records").getJSONObject(id).getString("coreLeader")
        }
        authority.invalidateForPrivateCleanup(leader).get()
        coreOutcomes[id] = if (leader == id) authority.privateCleanupInvalidationStatus(leader)
          else authority.privateCleanupCoverageStatus(leader)
        if (leader == id) reconcileCore(context, leader)
        reconcileCore(context, id)
      } catch (_: Exception) { coreOutcomes[id] = "pending" }
      finally { coreRunning.remove(id) }
    }
  }
  private val terminal = setOf("terminal", "superseded")
  fun privateKey(key: String): Boolean = key.startsWith("app_group_") || key == FreedAppGroupStore.CONFIGURATION_KEY ||
    key == FreedAppScheduleStore.CONFIGURATION_KEY || key == FreedAppGuardModeStore.MODE_KEY ||
    key.startsWith("pending_") || key.startsWith("earned_unlock_") || key.startsWith("native_package_unlock_") ||
    key.startsWith("native_surface_unlock_") || key == "claimed_native_unlock_lease_v1" ||
    key.startsWith(FreedAccessibilityService.APP_USAGE_PREFIX) || key == FreedAccessibilityService.APP_USAGE_DATE_KEY ||
    key == FreedAccessibilityService.LAST_FOREGROUND_PACKAGE || key == FreedAccessibilityService.LAST_FOREGROUND_ELAPSED_MS ||
    key in setOf(FreedAccessibilityService.BLOCKED_APP_PACKAGES, FreedAccessibilityService.DAILY_LIMIT_MINUTES,
      FreedAccessibilityService.SHORT_FORM_THRESHOLD_SECONDS, FreedFocusShieldRules.FOCUS_SHIELD_RULES,
      FreedFocusShieldRules.FOCUS_SHIELD_UNLOCKS)

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun protection(context: Context) = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
  private fun read(context: Context): JSONObject {
    val storage = prefs(context)
    if (!storage.contains(KEY)) {
      check(storage.all.isEmpty()) { "private-cleanup-corrupt" }
      // Old tombstones cannot be adopted through a raw rebind or silently thrown away.
      check(context.getSharedPreferences(LEGACY, Context.MODE_PRIVATE).all.isEmpty()) { "private-cleanup-legacy-unavailable" }
      return JSONObject().put("version", 2).put("revision", 0L).put("namespace", 0L).put("records", JSONObject()).put("notices", JSONObject())
    }
    val encoded = storage.getString(KEY, null) ?: error("private-cleanup-corrupt")
    check(encoded.toByteArray().size <= 131072 && storage.all.keys == setOf(KEY))
    val doc = JSONObject(encoded)
    check(doc.keys().asSequence().toSet() == setOf("version", "revision", "namespace", "records", "notices") && FreedAppGroupPolicy.integer(doc.opt("version")) == 2L)
    check(FreedAppGroupPolicy.integer(doc.opt("revision")) != null && FreedAppGroupPolicy.integer(doc.opt("namespace")) != null)
    check(doc.getLong("revision") in 0..9_007_199_254_740_991L && doc.getLong("namespace") in 0..9_007_199_254_740_991L)
    val records = doc.getJSONObject("records"); check(records.length() <= 32)
    records.keys().forEach { id ->
      check(UUID.fromString(id).toString() == id)
      val r = records.getJSONObject(id)
      val required = setOf("id", "owner", "handle", "namespace", "revision", "epoch", "phase", "core", "process", "vpnHistory")
      check(r.keys().asSequence().toSet().let { it.containsAll(required) && (it - required).all { key -> key in setOf("erased", "runtime", "coreLeader") } })
      check(listOf("namespace", "revision", "epoch").all { key -> FreedAppGroupPolicy.integer(r.opt(key)) != null })
      check(listOf("erased", "runtime").all { key -> !r.has(key) || r.opt(key) is Boolean })
      check(r.toString().toByteArray().size <= 8192 && r.getString("id") == id && r.getString("phase") in terminal + setOf("prepared", "committed", "fenced", "privateErased", "runtimePending"))
      check(r.getLong("namespace") in 0..doc.getLong("namespace") && r.getLong("revision") in 0..doc.getLong("revision") && r.getLong("epoch") >= 0)
      check(r.getString("owner").matches(Regex("[a-f0-9]{64}")) && UUID.fromString(r.getString("handle")).toString() == r.getString("handle"))
      val history = r.getString("vpnHistory")
      check(history.length <= 57 && UUID.fromString(history.substringBefore(':')).toString() == history.substringBefore(':') && history.substringAfter(':').toLong() >= 0)
      check(r.getString("core") in setOf("pending", "complete", "superseded") && r.getString("process") in setOf("pending", "complete"))
      if (r.has("coreLeader")) check(UUID.fromString(r.getString("coreLeader")).toString() == r.getString("coreLeader"))
      if (r.getString("phase") == "terminal") check(r.optBoolean("erased") && r.optBoolean("runtime") && r.getString("process") == "complete" && r.getString("core") == "complete")
      if (r.optBoolean("runtime")) check(r.optBoolean("erased") && r.getString("process") == "complete")
    }
    records.keys().forEach { id -> val r = records.getJSONObject(id)
      if (r.has("coreLeader") && r.getString("core") == "pending" && r.getString("phase") !in terminal && r.getString("phase") != "prepared")
        check(records.has(r.getString("coreLeader"))) { "private-cleanup-leader-missing" }
    }
    val notices = doc.getJSONObject("notices")
    check(notices.length() <= 2 && notices.keys().asSequence().all { it in setOf("9403", "9404") })
    notices.keys().forEach { key -> val notice = notices.getJSONObject(key)
      check(notice.keys().asSequence().toSet() == setOf("namespace", "publication"))
      check(FreedAppGroupPolicy.integer(notice.opt("namespace"))?.let { it in 0..doc.getLong("namespace") } == true)
      check(UUID.fromString(notice.getString("publication")).toString() == notice.getString("publication"))
    }
    return doc
  }
  private fun save(context: Context, doc: JSONObject) {
    val encoded = doc.toString(); check(encoded.toByteArray().size <= 131072)
    check(prefs(context).edit().putString(KEY, encoded).commit() && prefs(context).getString(KEY, null) == encoded) { "private-cleanup-save-unconfirmed" }
  }
  private fun pendingCore(doc: JSONObject): List<JSONObject> = doc.getJSONObject("records").let { rows ->
    rows.keys().asSequence().map { rows.getJSONObject(it) }.filter {
      it.getString("phase") !in terminal && it.getString("phase") != "prepared" && it.getString("core") == "pending"
    }.toList()
  }
  /** Arming occurs under grant exclusion. Every new ID joins an already closed cohort, or starts itself.
   * A missing pre-upgrade link is migrated only while those armed records still keep admission closed. */
  private fun linkCoreCohort(doc: JSONObject): Boolean {
    val rows = pendingCore(doc)
    val missing = rows.filter { !it.has("coreLeader") }
    if (missing.isEmpty()) return false
    val records = doc.getJSONObject("records")
    val roots = rows.filter { it.has("coreLeader") }.map { records.getJSONObject(it.getString("coreLeader")) }
    val leader = (if (roots.isEmpty()) rows else roots).minWithOrNull(compareBy<JSONObject>(
      { it.getLong("revision") }, { it.getLong("namespace") }, { it.getString("id") })) ?: return false
    missing.forEach { it.put("coreLeader", leader.getString("id")) }
    return true
  }
  private fun unresolvedCoreDependent(doc: JSONObject, leader: String): Boolean = pendingCore(doc).any {
    it.getString("id") != leader && it.optString("coreLeader", "") == leader
  }
  /** Lock-free native admission observation under the adult guard: never takes the private/grant lock.
   * The durable arming marker closes the scheduling gap before the existing Core worker reserves. */
  fun adultCleanupPending(context: Context, exceptID: String?): Boolean = runCatching {
    val rows = read(context).getJSONObject("records")
    rows.keys().asSequence().any { id -> val r = rows.getJSONObject(id)
      r.getString("phase") !in terminal && r.getString("phase") != "prepared" && r.getString("core") == "pending" &&
        (exceptID == null || !r.has("coreLeader") || r.getString("coreLeader") != exceptID)
    }
  }.getOrDefault(true)
  fun coreCleanupKnown(context: Context, id: String): Boolean = runCatching {
    val r = read(context).getJSONObject("records").optJSONObject(id) ?: return@runCatching false
    r.getString("phase") !in terminal && r.getString("phase") != "prepared" && r.getString("core") == "pending"
  }.getOrDefault(false)
  fun coreCleanupCanForget(context: Context, id: String): Boolean = runCatching {
    val doc = read(context); val r = doc.getJSONObject("records").optJSONObject(id)
    (r == null || r.getString("phase") in terminal) && !unresolvedCoreDependent(doc, id)
  }.getOrDefault(false)
  fun admissionRevision(context: Context): Long {
    val doc = read(context); val rows = doc.getJSONObject("records")
    check(rows.keys().asSequence().none { rows.getJSONObject(it).getString("phase") in setOf("committed", "fenced") }) { "private-admission-fence-pending" }
    return doc.getLong("revision")
  }
  fun policyNamespace(context: Context): Long = read(context).getLong("namespace")
  fun policyAvailable(context: Context): Boolean = runCatching {
    val doc = read(context); val rows = doc.getJSONObject("records")
    rows.keys().asSequence().none { id -> val r = rows.getJSONObject(id); r.getLong("namespace") == doc.getLong("namespace") && r.getString("phase") !in terminal && r.getString("phase") != "prepared" }
  }.getOrDefault(false)
  fun advancePolicyNamespace(context: Context): Boolean = runCatching {
    val doc = read(context); doc.put("namespace", Math.addExact(doc.getLong("namespace"), 1L)); save(context, doc); true
  }.getOrDefault(false)
  private fun samePolicy(context: Context, r: JSONObject): Boolean =
    read(context).getLong("namespace") == r.getLong("namespace") &&
      protection(context).getString("app_group_owner_digest_v1", null) == r.getString("owner") &&
      (protection(context).all["app_group_scope_epoch_v1"] as? Number)?.toLong() == r.getLong("epoch")
  private fun originalNamespace(context: Context, r: JSONObject): Boolean = read(context).getLong("namespace") == r.getLong("namespace")
  private fun reply(r: JSONObject, replay: Boolean = false): Map<String, Any?> {
    val phase = r.getString("phase")
    return mapOf("version" to 2, "accepted" to true, "operationId" to r.getString("id"), "phase" to phase,
      "privateCleanupAccepted" to r.optBoolean("erased"),
      "runtimeScrubComplete" to (phase == "terminal"), "adultPolicyRetained" to true,
      "coreState" to r.getString("core"), "processState" to r.getString("process"), "replay" to replay,
      "reason" to if (phase == "terminal") null else "private-cleanup-" + phase, "adultLockEnrollmentAvailable" to false)
  }
  private fun unavailable(reason: String) = mapOf<String, Any?>("accepted" to false, "reason" to reason, "runtimeScrubComplete" to false)
  fun prepare(context: Context, scope: String, handle: String): Map<String, Any?> = try {
    val doc = read(context); val rows = doc.getJSONObject("records")
    val owner = protection(context).getString("app_group_owner_digest_v1", null) ?: error("private-cleanup-owner-unavailable")
    rows.keys().asSequence().map { rows.getJSONObject(it) }.firstOrNull { it.getString("handle") == handle && it.getString("phase") !in terminal }?.let { return reply(it, true) }
    // Only resolved records may be pruned; unknown/pruned IDs can never execute.
    if (rows.length() >= 32) rows.keys().asSequence().firstOrNull {
      rows.getJSONObject(it).getString("phase") in terminal && !unresolvedCoreDependent(doc, it)
    }?.let { old ->
      val history = rows.getJSONObject(old).getString("vpnHistory")
      rows.remove(old); coreOutcomes.remove(old); coreRunning.remove(old)
      if (rows.keys().asSequence().none { rows.getJSONObject(it).getString("phase") !in terminal && rows.getJSONObject(it).getString("vpnHistory") == history })
        FreedVpnService.forgetPrivateRuntimeHistoryIdentity(history)
      FreedInterventionActivity.forgetCleanupOperation(old)
    }
    check(rows.length() < 32) { "private-cleanup-capacity" }
    val id = UUID.randomUUID().toString()
    val r = JSONObject().put("id", id).put("owner", owner).put("handle", handle)
      .put("namespace", doc.getLong("namespace")).put("revision", doc.getLong("revision"))
      .put("epoch", (protection(context).all["app_group_scope_epoch_v1"] as Number).toLong())
      .put("phase", "prepared").put("core", "pending").put("process", "pending").put("vpnHistory", FreedVpnService.capturePrivateRuntimeHistoryIdentity())
    rows.put(id, r); save(context, doc); reply(r)
  } catch (_: Exception) { unavailable("private-cleanup-prepare-unavailable") }

  /** Runs under grant exclusion before new admission. Never waits on Core, DNS or a main task. */
  fun reconcilePrivateFence(context: Context): Boolean = runCatching {
    val ids = read(context).getJSONObject("records").keys().asSequence().toList()
    ids.forEach { id -> if (read(context).getJSONObject("records").getJSONObject(id).getString("phase") != "prepared") fenceAndErase(context, id) }
    val doc = read(context); val rows = doc.getJSONObject("records")
    rows.keys().asSequence().none { rows.getJSONObject(it).getString("phase") in setOf("committed", "fenced") }
  }.getOrDefault(false)
  private fun fenceAndErase(context: Context, id: String): JSONObject {
    var doc = read(context); var r = doc.getJSONObject("records").getJSONObject(id)
    if (r.getString("phase") in terminal) return r
    if (r.getString("phase") == "committed") {
      if (!samePolicy(context, r)) {
        check(!originalNamespace(context, r)) { "private-cleanup-original-policy-unknown" }
        r.put("phase", "runtimePending").put("core", "superseded"); save(context, doc); return r
      }
      // Independent, durable admission fence precedes all private erasure. Allocated once.
      doc.put("revision", Math.addExact(doc.getLong("revision"), 1L)); r.put("phase", "fenced")
      save(context, doc)
      FreedPrivateAccountAdmission.revokeCleanup(r.getString("handle"))
    }
    if (r.getString("phase") == "fenced") {
      if (!samePolicy(context, r)) {
        // Empty private namespace after an uncertain erase is safe; B has a distinct namespace.
        if (!originalNamespace(context, r)) { r.put("phase", "runtimePending").put("core", "superseded"); save(context, doc); return r }
        check(protection(context).all.keys.none(::privateKey)) { "private-cleanup-owner-unknown" }
      } else {
        val storage = protection(context); val retained = storage.all.filterKeys { !privateKey(it) }
        val editor = storage.edit(); storage.all.keys.filter(::privateKey).forEach(editor::remove)
        check(editor.commit() && storage.all.keys.none(::privateKey) && storage.all.filterKeys { !privateKey(it) } == retained) { "private-cleanup-storage-unconfirmed" }
      }
      r.put("phase", "privateErased").put("erased", true); save(context, doc)
    }
    return r
  }
  fun status(context: Context, id: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    try { read(context).getJSONObject("records").optJSONObject(id)?.let { if (it.getString("phase") in terminal || coreOutcomes[id] == null) reply(it, true) else reconcileCore(context, id) } ?: unavailable("private-cleanup-unknown-id") }
    catch (_: Exception) { unavailable("private-cleanup-storage-unavailable") }
  }
  fun execute(context: Context, id: String, process: (String) -> Boolean): Map<String, Any?> {
    var replay = false
    val initial = synchronized(FreedNativeUnlockStore.lock) {
      try {
        val doc = read(context); val r = doc.getJSONObject("records").optJSONObject(id) ?: return unavailable("private-cleanup-unknown-id")
        if (r.getString("phase") in terminal) return reply(r, true)
        replay = r.getString("phase") != "prepared"
        val arm = r.getString("phase") == "prepared"
        if (arm) r.put("phase", "committed")
        val linked = linkCoreCohort(doc)
        if (arm || linked) save(context, doc)
        fenceAndErase(context, id)
      } catch (_: Exception) { return unavailable("private-cleanup-storage-unconfirmed") }
    }
    if (initial.getString("phase") in terminal) return reply(initial, true)
    // Exact Module-owned process cancellation, never a global replacement controller destroy.
    val processDone = runCatching { process(initial.getString("handle")) }.getOrDefault(false)
    val runtimeDone = runCatching {
      if (initial.optBoolean("runtime")) true else {
      val valid = { synchronized(FreedNativeUnlockStore.lock) { originalNamespace(context, initial) } }
      val serviceDone = runCatching { FreedAccessibilityService.clearOwnedRuntimeForCleanup(valid) }.getOrDefault(false)
      val activityDone = runCatching { FreedInterventionActivity.clearOwnedRuntimeForCleanup(id, valid) }.getOrDefault(false)
      serviceDone && activityDone
      }
    }.getOrDefault(false)
    synchronized(FreedNativeUnlockStore.lock) {
      try {
        val doc = read(context); val r = doc.getJSONObject("records").getJSONObject(id)
        if (r.getString("phase") in terminal) return reply(r, true)
        if (processDone) r.put("process", "complete")
        if (!originalNamespace(context, r)) {
          // Never cancel a reused notice, touch B history, or relabel skipped OS work complete.
          r.put("phase", "runtimePending"); save(context, doc)
        } else if (!r.optBoolean("runtime")) {
          var noticesDone = true
          val notices = doc.getJSONObject("notices")
          for (key in listOf("9403", "9404")) {
            val notice = notices.optJSONObject(key) ?: continue
            if (notice.getLong("namespace") != r.getLong("namespace")) continue
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (manager == null || !runCatching { manager.cancel(key.toInt()) }.isSuccess) noticesDone = false else notices.remove(key)
          }
          val pendingDone = FreedWebsiteRecoveryHandoff.clearPrivatePendingRetainingDevice("policy:${r.getString("owner")}:${r.getLong("epoch")}:${r.getLong("namespace")}") { originalNamespace(context, r) }
          val historyDone = FreedVpnService.clearPrivateRuntimeHistoryRetainingAdult(r.getString("vpnHistory"))
          r.put("phase", "runtimePending")
          if (runtimeDone && noticesDone && processDone && pendingDone && historyDone) r.put("runtime", true)
          save(context, doc)
        } else { save(context, doc) }
      } catch (_: Exception) { return unavailable("private-cleanup-runtime-unconfirmed") }
    }
    // Same production Core/store graph. Scheduling does not wait for a queued DNS mutation.
    if (initial.getString("core") == "pending") scheduleCore(context, id)
    return reconcileCore(context, id) + ("replay" to replay)
  }
  fun reconcileCore(context: Context, id: String): Map<String, Any?> {
    val core = coreOutcomes[id]
    return synchronized(FreedNativeUnlockStore.lock) {
      try {
        val doc = read(context); val r = doc.getJSONObject("records").getJSONObject(id)
        if (r.getString("phase") in terminal) return@synchronized reply(r, true)
        if (core in setOf("complete", "superseded")) r.put("core", core)
        if (r.optBoolean("runtime") && r.getString("process") == "complete" && r.getString("core") == "complete") r.put("phase", "terminal")
        else if (!originalNamespace(context, r) && r.getString("process") == "complete" && r.getString("core") in setOf("complete", "superseded")) r.put("phase", "superseded")
        save(context, doc); reply(r)
      } catch (_: Exception) { unavailable("private-cleanup-core-pending") }
    }
  }
  /** Publication and cancellation share grant exclusion; IDs alone are never ownership. */
  fun publishPrivateNotice(context: Context, id: Int, publish: () -> Unit) = synchronized(FreedNativeUnlockStore.lock) {
    val doc = read(context); val notices = doc.getJSONObject("notices")
    val owner = protection(context).getString("app_group_owner_digest_v1", null)
    if (owner == null) notices.remove(id.toString()) else notices.put(id.toString(), JSONObject().put("namespace", doc.getLong("namespace")).put("publication", UUID.randomUUID().toString()))
    save(context, doc); publish()
  }
}
