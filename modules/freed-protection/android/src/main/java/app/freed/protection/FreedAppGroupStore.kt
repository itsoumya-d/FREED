package app.freed.protection

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Process
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Calendar
import java.util.TimeZone
import java.util.UUID

/** Synchronized native policy, device-only inventory and exact target leases. Never writes DNS/adult policy. */
internal object FreedAppGroupStore {
  const val CONFIGURATION_KEY = "app_groups_configuration_v1"
  const val CLAIM_KEY = "app_group_claim_v1"
  private const val EVENT_KEY = "app_group_event_v1"
  private const val BREAKS_KEY = "app_group_breaks_v1"
  private const val SCOPE_EPOCH = "app_group_scope_epoch_v1"
  private const val OWNER_DIGEST = "app_group_owner_digest_v1"
  private const val OWNER_SALT = "app_group_owner_salt_v1"
  private var boundScope: String? = null
  private var boundSignedInOwner = false
  private var boundDiscardScopeEpoch: Long? = null
  private var privateOperationsSuspended = false
  private var privateCleanupInProgress = false
  fun suspendPrivateOperations(): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    privateOperationsSuspended = true
    true
  }
  fun ownerBound(): Boolean = synchronized(FreedNativeUnlockStore.lock) { boundScope?.let { boundSignedInOwner && validScope(it) } == true }
  fun awaitingOwnerBinding(): Boolean = synchronized(FreedNativeUnlockStore.lock) { !ownerBound() }
  /** A captured scope is memory-only and must still be current at private payload publication. */
  fun captureOwnerScope(): String? = synchronized(FreedNativeUnlockStore.lock) { boundScope.takeIf { boundSignedInOwner && validScope(it ?: "") } }
  fun ownerScopeCurrent(scope: String?): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    scope != null && (if (scope.startsWith("policy:")) policyContext?.let { policyScopeCurrent(it, scope) } == true else boundSignedInOwner && validScope(scope))
  }
  private fun prefs(context: Context) = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
  private fun number(value: Any?): Long = FreedAppGroupPolicy.integer(value) ?: 0L
  private fun boot(context: Context): Int = runCatching { Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1) }.getOrDefault(-1)
  private fun scopeEpoch(context: Context): Long = number(prefs(context).all[SCOPE_EPOCH])
  private fun generation(context: Context, state: Map<String, Any?>): Long = number(state["generation"]) + FreedProtectionConfiguration.epoch(context) * 1_000_000L

  /** The raw legacy bridge cannot establish private authority. */
  fun bindScope(context: Context, token: String): Boolean = false

  internal fun bindAcknowledgedScope(context: Context, token: String): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    if (token.length !in 3..1100 || FreedProtectionConfiguration.resetInProgress || privateCleanupInProgress) return@synchronized false
    val parts = runCatching { JSONArray(token) }.getOrNull() ?: return@synchronized false
    if (parts.length() != 3 || parts.opt(0) !is String || parts.opt(2) !is String || FreedAppGroupPolicy.integer(parts.opt(1)) == null) return@synchronized false
    val owner = parts.getString(0)
    if (owner.isBlank() || owner.length > 256) return@synchronized false
    val storage = prefs(context)
    val salt = storage.getString(OWNER_SALT, null) ?: UUID.randomUUID().toString()
    val digest = MessageDigest.getInstance("SHA-256").digest("$salt\u0000$owner".toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it.toInt() and 255) }
    // Runtime/host/handle replacement is not a policy mutation. Preserve immutable leases and spend.
    val changed = storage.getString(OWNER_DIGEST, null) != digest
    if (changed && !FreedRetainedAdultProtection.advancePolicyNamespace(context)) return@synchronized false
    val editor = storage.edit().putString(OWNER_SALT, salt).putString(OWNER_DIGEST, digest)
    if (changed) { editor.putLong(SCOPE_EPOCH, scopeEpoch(context) + 1L); clearAuthority(editor) }
    val keys = listOf(OWNER_SALT, OWNER_DIGEST, SCOPE_EPOCH, CLAIM_KEY, EVENT_KEY, BREAKS_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY, FreedEarnedAppTimePolicy.BREAKS_KEY, FreedEarnedChallengeProofPolicy.KEY)
    val before = storage.all
    if (!FreedAppGroupTransaction.publish({ editor.commit() }, { storage.getString(OWNER_DIGEST, null) == digest },
      { !FreedProtectionConfiguration.resetInProgress }, { restore(storage, before, keys) })) return@synchronized false
    boundScope = token; boundSignedInOwner = true; boundDiscardScopeEpoch = scopeEpoch(context); privateOperationsSuspended = false
    policyContext = context.applicationContext
    if (changed) FreedAccessibilityService.requestAppGroupRecheck()
    true
  }

  /** Prepare is admitted while acknowledged. Execution/status need only the native-issued retry ID. */
  fun preparePrivateCleanup(context: Context, token: String, handle: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    if (!discardOwnerCurrent(context, token) || FreedPrivateAccountAdmission.handle(token) != handle)
      return@synchronized mapOf("accepted" to false, "reason" to "private-cleanup-owner-stale")
    FreedRetainedAdultProtection.prepare(context, token, handle)
  }
  fun clearPrivateRetainingAdult(context: Context, token: String, operationId: String): Map<String, Any?> =
    mapOf("accepted" to false, "reason" to "private-cleanup-native-issued-id-required")

  private fun validScope(token: String): Boolean = !privateOperationsSuspended && token == boundScope &&
    token.isNotBlank() && FreedPrivateAccountAdmission.valid(token)

  private var policyContext: Context? = null
  /** Persistent native policy actor, independent of live JS admission. Never returned as app authority. */
  fun capturePolicyScope(context: Context): String? = synchronized(FreedNativeUnlockStore.lock) {
    policyContext = context.applicationContext
    if (privateOperationsSuspended) return@synchronized null
    val storage = prefs(context)
    val owner = storage.getString(OWNER_DIGEST, null) ?: return@synchronized null
    if (!FreedRetainedAdultProtection.policyAvailable(context)) return@synchronized null
    "policy:$owner:${scopeEpoch(context)}:${FreedRetainedAdultProtection.policyNamespace(context)}"
  }
  fun policyScopeCurrent(context: Context, scope: String?): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    scope != null && scope == capturePolicyScope(context)
  }

  @Suppress("UNCHECKED_CAST")
  private fun groups(state: Map<String, Any?>): List<Map<String, Any?>> =
    (state["groups"] as? List<*>)?.mapNotNull { it as? Map<String, Any?> }.orEmpty()

  private fun read(context: Context): Map<String, Any?> {
    decode(prefs(context).getString(CONFIGURATION_KEY, null))?.let { state ->
      if (number(state["version"]) == 1L && groups(state).size <= 6) return state
    }
    return mapOf("version" to 1, "revision" to 0L, "generation" to 0L, "groups" to emptyList<Any>())
  }

  /** Marker is the persisted versioned state, including an empty state; migration can never run twice. */
  private fun migrate(context: Context): Boolean {
    val storage = prefs(context)
    if (storage.contains(CONFIGURATION_KEY)) return decode(storage.getString(CONFIGURATION_KEY, null)) != null
    val packages = storage.getString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, "").orEmpty().split(',')
      .filter { FreedInstalledAppPolicy.validPackage(it) && it != context.packageName }.distinct()
    val group = if (packages.isEmpty()) emptyList() else listOf(mapOf<String, Any?>("id" to "legacy-default", "slot" to 0,
      "revision" to 1L, "name" to "App blocking", "enabled" to FreedProtectionConfiguration.interceptionEnabled(context),
      "rule" to mapOf("kind" to "legacy"), "packages" to packages, "legacy" to true))
    val encoded = encode(mapOf("version" to 1, "revision" to (if (group.isEmpty()) 0L else 1L), "generation" to 0L, "groups" to group))
    val before = storage.all
    return FreedAppGroupTransaction.publish({ storage.edit().putString(CONFIGURATION_KEY, encoded).commit() },
      { storage.getString(CONFIGURATION_KEY, null) == encoded }, { !FreedProtectionConfiguration.resetInProgress },
      { restore(storage, before, listOf(CONFIGURATION_KEY)) })
  }

  fun snapshot(context: Context, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    // Reads never establish verified-owner authority or resume hydration suspension.
    // Only the explicit setAppGroupActionScope bridge may call bindScope.
    if (!validScope(token)) return@synchronized snapshotInternal(context, token, "app-group-owner-scope-invalid")
    if (!migrate(context)) return@synchronized snapshotInternal(context, token, "app-group-storage-invalid")
    snapshotInternal(context, token)
  }

  private fun discardOwnerCurrent(context: Context, token: String): Boolean = runCatching {
    if (!ownerScopeCurrent(token) || boundDiscardScopeEpoch != scopeEpoch(context)) return@runCatching false
    val storage = prefs(context)
    val salt = storage.getString(OWNER_SALT, null) ?: return@runCatching false
    val owner = JSONArray(token).opt(0) as? String ?: return@runCatching false
    val digest = MessageDigest.getInstance("SHA-256").digest("$salt\u0000$owner".toByteArray(Charsets.UTF_8))
      .joinToString("") { "%02x".format(it.toInt() and 255) }
    storage.getString(OWNER_DIGEST, null) == digest
  }.getOrDefault(false)

  /** Android selection drafts live in JS. This acknowledgement only validates the target; no native publication is needed. */
  fun discardPendingSelection(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    val targetId = (request["id"] as? String)?.takeIf { it.matches(Regex("^[A-Za-z0-9_-]{1,64}$")) }
    fun reply(accepted: Boolean, reason: String?): Map<String, Any?> = mapOf("accepted" to accepted, "reason" to reason,
      "operation" to "discard-pending-selection", "targetId" to targetId, "pendingSelectionDiscarded" to accepted,
      "snapshot" to snapshotInternal(context, token.takeIf { discardOwnerCurrent(context, it) }, reason))
    if (!discardOwnerCurrent(context, token)) return@synchronized reply(false, "app-group-owner-scope-stale")
    if (FreedProtectionConfiguration.resetInProgress) return@synchronized reply(false, "protection-reset-in-progress")
    val storage = prefs(context)
    val encoded = storage.getString(CONFIGURATION_KEY, null)
    val state = decode(encoded) ?: return@synchronized reply(false, "app-group-storage-invalid")
    val revision = FreedAppGroupPolicy.integer(state["revision"])
    val rows = state["groups"] as? List<*>
    if (FreedAppGroupPolicy.integer(state["version"]) != 1L || revision == null || FreedAppGroupPolicy.integer(state["generation"]) == null
      || rows == null || rows.size > FreedAppGroupPolicy.MAX_GROUPS || rows.any { it !is Map<*, *> }) return@synchronized reply(false, "app-group-storage-invalid")
    val target = groups(state).firstOrNull { it["id"] == targetId }
    val groupRevision = target?.let { FreedAppGroupPolicy.integer(it["revision"]) }
    if (request.keys != setOf("version", "expectedStoreRevision", "id", "expectedRevision") || targetId == null || groupRevision == null || groupRevision < 1
      || !FreedAppGroupPolicy.revisionMatches(request, revision, groupRevision)) return@synchronized reply(false, "app-group-request-invalid-or-stale")
    val epoch = FreedProtectionConfiguration.epoch(context)
    val scope = scopeEpoch(context)
    val result = reply(true, null)
    if (!discardOwnerCurrent(context, token) || epoch != FreedProtectionConfiguration.epoch(context) || scope != scopeEpoch(context)
      || FreedProtectionConfiguration.resetInProgress || encoded != storage.getString(CONFIGURATION_KEY, null)) return@synchronized reply(false, "app-group-owner-scope-stale")
    result
  }

  fun mutate(context: Context, request: Map<String, Any?>, token: String, operation: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    if (!validScope(token)) return@synchronized receipt(context, token, false, "app-group-owner-scope-stale")
    if (!ownerBound()) return@synchronized receipt(context, token, false, "app-group-signed-in-owner-required")
    if (FreedProtectionConfiguration.resetInProgress) return@synchronized receipt(context, token, false, "protection-reset-in-progress")
    if (!migrate(context)) return@synchronized receipt(context, token, false, "app-group-storage-invalid")
    val state = read(context)
    val eligible = FreedInstalledApplications.eligible(context)
    val next = FreedAppGroupPolicy.mutate(state, request, operation, eligible, UUID.randomUUID().toString())
      ?: return@synchronized receipt(context, token, false, "app-group-request-invalid-or-stale")
    val previousTarget = groups(state).firstOrNull { it["id"] == request["id"] }
    val nextTarget = groups(next).firstOrNull { it["id"] == request["id"] }
    val requiresActivation = operation == "update" && nextTarget?.get("enabled") == true &&
      (previousTarget?.get("enabled") != true || previousTarget["legacy"] == true ||
        previousTarget["rule"] != nextTarget["rule"] || previousTarget["packages"] != nextTarget["packages"])
    if (requiresActivation && (!FreedProtectionConfiguration.interceptionEnabled(context) || !FreedAccessibilityService.appSchedulesServiceConnected ||
      ((nextTarget.get("rule") as? Map<*, *>)?.get("kind") == "daily-limit" && !usageAuthorized(context))))
      return@synchronized receipt(context, token, false, "app-group-permission-or-runtime-required")
    val storage = prefs(context)
    val before = storage.all
    val epoch = FreedProtectionConfiguration.epoch(context)
    val scope = scopeEpoch(context)
    val encoded = encode(next)
    val editor = storage.edit().putString(CONFIGURATION_KEY, encoded)
    clearAuthority(editor)
    val priorGroup = groups(state).firstOrNull { it["id"] == request["id"] }
    val adopted = priorGroup?.get("legacy") == true && operation in setOf("update", "remove")
    if (adopted) editor.remove(FreedAccessibilityService.BLOCKED_APP_PACKAGES)
    val keys = mutableListOf(CONFIGURATION_KEY, CLAIM_KEY, EVENT_KEY, BREAKS_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY, FreedEarnedAppTimePolicy.BREAKS_KEY, FreedEarnedChallengeProofPolicy.KEY)
    if (adopted) keys.add(FreedAccessibilityService.BLOCKED_APP_PACKAGES)
    val accepted = FreedAppGroupTransaction.publish({ editor.commit() }, { storage.getString(CONFIGURATION_KEY, null) == encoded },
      { validScope(token) && scope == scopeEpoch(context) && epoch == FreedProtectionConfiguration.epoch(context) && !FreedProtectionConfiguration.resetInProgress },
      { restore(storage, before, keys) })
    FreedAccessibilityService.requestAppGroupRecheck()
    receipt(context, token, accepted, if (accepted) null else "app-group-native-install-failed")
  }

  private fun receipt(context: Context, token: String?, accepted: Boolean, reason: String?): Map<String, Any?> =
    mapOf("accepted" to accepted, "reason" to reason, "snapshot" to snapshotInternal(context, token, reason))

  fun unsupportedPicker(context: Context, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    receipt(context, token, false, "app-group-native-picker-unavailable")
  }

  private fun snapshotInternal(context: Context, token: String?, reason: String? = null): Map<String, Any?> {
    val privateOwner = ownerScopeCurrent(token)
    val state = read(context)
    val now = System.currentTimeMillis()
    val eligible = if (privateOwner) FreedInstalledApplications.eligible(context) else emptySet()
    val usage = if (privateOwner) todayUsage(context) else null
    val connected = FreedAccessibilityService.appSchedulesServiceConnected
    val enabled = FreedProtectionConfiguration.interceptionEnabled(context)
    val rules = groups(state)
    val leases = allBreaks(context)
    val rows: List<Map<String, Any?>> = if (!privateOwner) emptyList() else rules.map { group ->
      val packages = packages(group)
      val rule = rule(group)
      val total = usage?.let { FreedAppGroupPolicy.combinedUsage(packages, it) }
      val legacy = group["legacy"] == true
      val unavailable = packages.filter { it !in eligible }
      val configured = packages.isNotEmpty()
      val operational = enabled && connected && configured && packages.any { it in eligible } && (rule["kind"] != "daily-limit" || usage != null)
      val ready = operational && unavailable.isEmpty()
      val active = group["enabled"] == true && operational && rule["kind"] != "legacy" && FreedAppGroupPolicy.ruleActive(rule, now, total ?: 0L, TimeZone.getDefault())
      val lease = leases.firstOrNull { it["groupId"] == group["id"] && liveBreak(context, it, group, state) }
      val target = lease?.get("packageName") as? String
      val remaining = target?.let { restrictions(context, it, state, usage, leases).size + if (legacyRestriction(context, it)) 1 else 0 } ?: 0
      mapOf<String, Any?>("id" to group["id"], "revision" to number(group["revision"]), "name" to group["name"],
        "enabled" to (group["enabled"] == true), "rule" to rule, "packages" to packages.toList(),
        "preferredBreakSeconds" to (FreedEarnedAppTimePolicy.seconds(group["preferredBreakSeconds"]) ?: 300L),
        "applicationCount" to packages.size, "categoryCount" to 0, "webDomainCount" to 0, "legacy" to legacy,
        "configured" to configured, "ready" to ready, "active" to active,
        "thresholdReached" to (rule["kind"] == "daily-limit" && active), "unavailablePackages" to unavailable,
        "usageMinutes" to total?.div(60_000L), "nextBoundaryAt" to FreedAppGroupPolicy.nextBoundary(rule, now)?.let(::iso),
        "break" to lease?.let { mapOf("interventionId" to it["id"], "expiresAt" to iso(number(it["grantedExpiry"])),
          "effective" to (remaining == 0), "remainingRestrictionCount" to remaining) }) +
        (snapshotBudget(context, group["id"] as String)?.let { mapOf<String, Any?>("extraTimeBudget" to it) } ?: emptyMap<String, Any?>())
    }
    val legacyPackages = prefs(context).getString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, "").orEmpty().split(',').filter(String::isNotBlank)
    return mapOf("version" to 1, "supported" to true, "platform" to "android", "supportedBreakSeconds" to FreedEarnedAppTimePolicy.supportedBreakSeconds, "revision" to number(state["revision"]),
      "configurationGeneration" to generation(context, state), "scopeEpoch" to scopeEpoch(context), "groups" to rows.takeIf { ownerScopeCurrent(token) }.orEmpty(),
      "configuredGroupCount" to rules.size,
      "permissions" to mapOf("authorized" to connected, "usageAccess" to usageAuthorized(context), "runtimeConnected" to connected),
      "monitorBudget" to mapOf("used" to rules.count { it["enabled"] == true }, "limit" to 6), "maxGroups" to 6,
      "legacyCompatibility" to mapOf("retained" to (legacyPackages.isNotEmpty() || FreedAppScheduleStore.read(context).potentialPackages.isNotEmpty()),
        "applicationCount" to legacyPackages.size, "categoryCount" to 0, "webDomainCount" to 0), "reason" to reason)
  }

  fun potentialPackages(context: Context): Set<String> = groups(read(context)).filter { it["enabled"] == true && rule(it)["kind"] != "legacy" }.flatMap { packages(it) }.toSet()

  fun blockingGroup(context: Context, packageName: String): Map<String, Any?>? = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedProtectionConfiguration.interceptionEnabled(context) || !FreedAccessibilityService.appSchedulesServiceConnected ||
      packageName == context.packageName || packageName !in FreedInstalledApplications.eligible(context)) return@synchronized null
    val state = read(context)
    restrictions(context, packageName, state, todayUsage(context), allBreaks(context)).firstOrNull()
  }

  private fun restrictions(context: Context, target: String, state: Map<String, Any?>, usage: Map<String, Long>?, leases: List<Map<String, Any?>>): List<Map<String, Any?>> =
    groups(state).filter { group ->
      group["enabled"] == true && rule(group)["kind"] != "legacy" && target in packages(group) &&
        (rule(group)["kind"] != "daily-limit" || usage != null) &&
        FreedAppGroupPolicy.ruleActive(rule(group), System.currentTimeMillis(), usage?.let { FreedAppGroupPolicy.combinedUsage(packages(group), it) } ?: 0L, TimeZone.getDefault()) &&
        leases.none { it["groupId"] == group["id"] && it["packageName"] == target && liveBreak(context, it, group, state) }
    }

  fun issue(context: Context, group: Map<String, Any?>, target: String, id: String, editor: SharedPreferences.Editor): Boolean {
    val current = blockingGroup(context, target) ?: return false
    if (current["id"] != group["id"] || current["revision"] != group["revision"]) return false
    val state = read(context)
    val event = mapOf("id" to id, "targetKind" to "android-app-group", "packageName" to target,
      "groupId" to group["id"], "groupRevision" to number(group["revision"]), "configurationGeneration" to generation(context, state),
      "scopeEpoch" to scopeEpoch(context), "resetEpoch" to FreedProtectionConfiguration.epoch(context),
      "detectedAt" to System.currentTimeMillis(), "detectedElapsed" to SystemClock.elapsedRealtime(), "boot" to boot(context))
    editor.putString(EVENT_KEY, encode(event))
    return true
  }

  fun pendingScope(context: Context, pending: Map<String, *>): Map<String, Any?>? {
    val event = decode(prefs(context).getString(EVENT_KEY, null)) ?: return null
    if (event["id"] != pending[FreedAccessibilityService.PENDING_INTERVENTION_ID] || event["packageName"] != pending[FreedAccessibilityService.PENDING_SOURCE_PACKAGE] ||
      pending[FreedAccessibilityService.PENDING_RULE] != "app-group:${event["groupId"]}:${number(event["groupRevision"])}") return null
    val group = groups(read(context)).firstOrNull { it["id"] == event["groupId"] } ?: return null
    if (!eventCurrent(context, event, group)) return null
    return mapOf("kind" to "android-app-group", "groupId" to event["groupId"], "groupRevision" to number(event["groupRevision"]),
      "configurationGeneration" to number(event["configurationGeneration"]), "scopeEpoch" to number(event["scopeEpoch"]), "packageName" to event["packageName"])
  }

  private fun eventCurrent(context: Context, event: Map<String, Any?>, group: Map<String, Any?>): Boolean {
    val now = System.currentTimeMillis()
    val elapsed = SystemClock.elapsedRealtime()
    val detected = number(event["detectedAt"])
    val started = number(event["detectedElapsed"])
    return FreedProtectionConfiguration.interceptionEnabled(context) && number(event["groupRevision"]) == number(group["revision"]) &&
      number(event["configurationGeneration"]) == generation(context, read(context)) && number(event["scopeEpoch"]) == scopeEpoch(context) &&
      number(event["resetEpoch"]) == FreedProtectionConfiguration.epoch(context) && number(event["boot"]) == boot(context).toLong() &&
      detected > 0 && now >= detected && elapsed >= started && now - detected < 600_000L && elapsed - started < 600_000L &&
      blockingGroup(context, event["packageName"] as? String ?: "")?.get("id") == group["id"]
  }

  fun stage(context: Context, pending: Map<String, *>, editor: SharedPreferences.Editor) {
    editor.remove(CLAIM_KEY)
    if (pendingScope(context, pending) == null || !ownerBound()) return
    val event = decode(prefs(context).getString(EVENT_KEY, null)) ?: return
    editor.putString(CLAIM_KEY, encode(event + mapOf("claimedAt" to System.currentTimeMillis(), "claimedElapsed" to SystemClock.elapsedRealtime())))
  }

  /** Atomic consumption + lease publication; retry can only read the original active deadline. */
  fun grantResetReward(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    fun reject(reason: String) = FreedResetAppGroupRewardPolicy.rejected(reason)
    if (!FreedResetAppGroupRewardPolicy.valid(request)) return@synchronized reject("reset-reward-request-invalid")
    if (!discardOwnerCurrent(context, token) || !FreedProtectionConfiguration.interceptionEnabled(context) || !FreedAccessibilityService.appSchedulesServiceConnected) return@synchronized reject("reset-reward-owner-or-state-unavailable")
    val storage = prefs(context)
    val state = decode(storage.getString(CONFIGURATION_KEY, null)) ?: return@synchronized reject("reset-reward-state-unreadable")
    val group = groups(state).firstOrNull { it["id"] == request["groupId"] && number(it["revision"]) == number(request["groupRevision"]) && it["enabled"] == true && it["legacy"] != true } ?: return@synchronized reject("reset-reward-authority-stale")
    val target = request["packageName"] as String
    if (number(request["configurationGeneration"]) != generation(context, state) || number(request["scopeEpoch"]) != scopeEpoch(context) || target !in packages(group) || target !in FreedInstalledApplications.eligible(context)) return@synchronized reject("reset-reward-authority-stale")
    val encodedLedger = storage.getString(FreedResetAppGroupRewardPolicy.LEDGER_KEY, null)
    val ledger = if (encodedLedger == null) mapOf("version" to 1,"records" to emptyList<Any>()) else decode(encodedLedger, 4 * 1024 * 1024) ?: return@synchronized reject("reset-reward-ledger-unreadable")
    @Suppress("UNCHECKED_CAST") val records = (ledger["records"] as? List<*>)?.map { it as? Map<String,Any?> ?: return@synchronized reject("reset-reward-ledger-unreadable") } ?: return@synchronized reject("reset-reward-ledger-unreadable")
    if (number(ledger["version"]) != 1L || records.size > FreedResetAppGroupRewardPolicy.MAX_RECORDS) return@synchronized reject("reset-reward-ledger-unreadable")
    val owner = storage.getString(OWNER_DIGEST, null) ?: return@synchronized reject("reset-reward-owner-or-state-unavailable")
    val id = request["nativeInterventionId"] as String
    val completion = request["completionSessionId"] as String
    val previous = records.firstOrNull { it["ownerDigest"] == owner && it["completionSessionId"] == completion }
    val now = System.currentTimeMillis()
    val elapsed = SystemClock.elapsedRealtime()
    val leases = breaks(context)
    val cap = FreedResetAppGroupRewardPolicy.seconds(request["category"],request["policyVersion"])!!
    var replayed = false
    val fulfilled: Map<String,Any?>
    if (previous != null) {
      @Suppress("UNCHECKED_CAST") val previousRequest = previous["request"] as? Map<String,Any?>
      val current = leases.firstOrNull { it["id"] == id && it["groupId"] == group["id"] && it["packageName"] == target }
      // JSON integers normalize to Long; compare each exact request fence numerically.
      if (previousRequest == null || !FreedResetAppGroupRewardPolicy.valid(previousRequest) || request.keys.any { key -> if (request[key] is Number) FreedAppGroupPolicy.integer(request[key]) != FreedAppGroupPolicy.integer(previousRequest[key]) else request[key] != previousRequest[key] } || number(previous["boot"]) != boot(context).toLong() || current == null || number(current["grantedExpiry"]) != number(previous["expiresAt"]) || now < number(previous["grantedAt"]) || elapsed < number(previous["grantedElapsed"]) || now >= number(previous["expiresAt"]) || elapsed - number(previous["grantedElapsed"]) >= cap * 1000L || !liveBreak(context,current,group,state)) return@synchronized reject("reset-reward-already-consumed")
      fulfilled = current; replayed = true
    } else {
      if (records.size >= FreedResetAppGroupRewardPolicy.MAX_RECORDS || records.any { it["ownerDigest"] == owner && it["nativeInterventionId"] == id } || allBreaks(context).any { lease -> groups(state).any { liveBreak(context,lease,it,state) } }) return@synchronized reject("reset-reward-consumed-or-active-window")
      val claim = decode(storage.getString(CLAIM_KEY, null)) ?: return@synchronized reject("reset-reward-claim-missing")
      val expiry = now + cap * 1000L
      val decision = FreedAppGroupAuthorityPolicy.authorize(claim,group,generation(context,state),scopeEpoch(context),FreedProtectionConfiguration.epoch(context),id,target,expiry,now,elapsed,boot(context)) ?: return@synchronized reject("reset-reward-authority-stale")
      if (decision["firstFulfillment"] != true || number(decision["expiresAtMs"]) != expiry || restrictions(context,target,state,todayUsage(context),emptyList()).none { it["id"] == group["id"] }) return@synchronized reject("reset-reward-target-not-current")
      fulfilled = claim + mapOf("requestedExpiry" to expiry,"grantedExpiry" to expiry,"expiresElapsed" to elapsed + cap * 1000L,"rewardPolicyVersion" to 1,"completionSessionId" to completion)
      val record = mapOf("request" to request,"ownerDigest" to owner,"completionSessionId" to completion,"nativeInterventionId" to id,"boot" to boot(context),"grantedAt" to now,"grantedElapsed" to elapsed,"expiresAt" to expiry)
      val nextLeases = leases.filter { old -> groups(state).any { liveBreak(context,old,it,state) } } + fulfilled
      val nextBreaks = encode(mapOf("leases" to nextLeases))
      val nextLedger = encode(mapOf("version" to 1,"records" to records + record))
      if (nextLedger.length > 4 * 1024 * 1024) return@synchronized reject("reset-reward-ledger-capacity")
      val before = storage.all
      val keys = listOf(BREAKS_KEY,CLAIM_KEY,FreedResetAppGroupRewardPolicy.LEDGER_KEY)
      if (!FreedAppGroupTransaction.publish({ storage.edit().putString(BREAKS_KEY,nextBreaks).putString(FreedResetAppGroupRewardPolicy.LEDGER_KEY,nextLedger).remove(CLAIM_KEY).commit() },
          { storage.getString(BREAKS_KEY,null) == nextBreaks && storage.getString(FreedResetAppGroupRewardPolicy.LEDGER_KEY,null) == nextLedger },
          { discardOwnerCurrent(context,token) && !FreedProtectionConfiguration.resetInProgress && generation(context,read(context)) == number(request["configurationGeneration"]) && groups(read(context)).any { it["id"] == group["id"] && number(it["revision"]) == number(request["groupRevision"]) } },
          { restore(storage,before,keys) })) return@synchronized reject("reset-reward-persistence-failed")
    }
    val remaining = restrictions(context,target,state,todayUsage(context),allBreaks(context)).size + if (legacyRestriction(context,target)) 1 else 0
    FreedAccessibilityService.requestAppGroupRecheck()
    mapOf("version" to 1,"policyVersion" to 1,"supported" to true,"accepted" to true,"reason" to null,"completionSessionId" to completion,"nativeInterventionId" to id,"category" to request["category"],"seconds" to cap,"groupId" to group["id"],"groupRevision" to number(group["revision"]),"configurationGeneration" to generation(context,state),"scopeEpoch" to scopeEpoch(context),"expiresAt" to iso(number(fulfilled["grantedExpiry"])),"effective" to (remaining == 0),"remainingRestrictionCount" to remaining,"replayed" to replayed)
  }

  /** Strict v2 envelopes: corruption never becomes an empty ledger or a fresh daily allowance. */
  @Suppress("UNCHECKED_CAST")
  private fun earnedRows(context: Context, key: String): List<Map<String, Any?>>? {
    val storage = prefs(context)
    if (!storage.contains(key)) return emptyList()
    val value = decode(storage.getString(key, null), FreedEarnedAppTimePolicy.MAX_BYTES) ?: return null
    if (value.keys != setOf("version", "records") || FreedAppGroupPolicy.integer(value["version"]) != 2L) return null
    val raw = value["records"] as? List<*> ?: return null
    if (raw.size > FreedEarnedAppTimePolicy.MAX_RECORDS) return null
    return raw.map { it as? Map<String, Any?> ?: return null }
  }

  private fun earnedEncoded(rows: List<Map<String, Any?>>): String? = earnedJson(mapOf("version" to 2, "records" to rows)).toString()
    .takeIf { rows.size <= FreedEarnedAppTimePolicy.MAX_RECORDS && it.length <= FreedEarnedAppTimePolicy.MAX_BYTES }

  // JSONObject(Map) drops null values; explicit nulls are part of the strict v2 durable schema.
  private fun earnedJson(value: Any?): Any = when (value) {
    null -> JSONObject.NULL
    is Map<*, *> -> JSONObject().apply { value.forEach { (key, item) -> put(key as String, earnedJson(item)) } }
    is List<*> -> JSONArray().apply { value.forEach { put(earnedJson(it)) } }
    else -> value
  }

  private fun earnedBudgets(context: Context): List<Map<String, Any?>>? {
    val rows = earnedRows(context, FreedEarnedAppTimePolicy.BUDGET_KEY) ?: return null
    if (rows.any { !FreedEarnedAppTimePolicy.validBudget(it) } || rows.map { it["ownerDigest"] to it["groupId"] }.distinct().size != rows.size) return null
    return rows
  }

  private fun earnedBudget(context: Context, rows: List<Map<String, Any?>>, owner: String, groupId: String): Map<String, Any?>? =
    rows.firstOrNull { it["ownerDigest"] == owner && it["groupId"] == groupId }
      ?: FreedEarnedAppTimePolicy.newBudget(owner, groupId, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context))

  private fun replacingBudget(rows: List<Map<String, Any?>>, budget: Map<String, Any?>): List<Map<String, Any?>> =
    rows.filterNot { it["ownerDigest"] == budget["ownerDigest"] && it["groupId"] == budget["groupId"] } + budget

  private fun budgetView(context: Context, budget: Map<String, Any?>): Map<String, Any?> = FreedEarnedAppTimePolicy.view(budget,
    FreedEarnedAppTimePolicy.clockVerified(budget, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)))

  private fun snapshotBudget(context: Context, groupId: String): Map<String, Any?>? {
    val owner = prefs(context).getString(OWNER_DIGEST, null) ?: return null
    val rows = earnedBudgets(context) ?: return null
    val previous = earnedBudget(context, rows, owner, groupId) ?: return null
    val current = FreedEarnedAppTimePolicy.advanceBudget(previous, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) ?: previous
    return budgetView(context, current)
  }

  /** Atomic rule/cap change. A pure cap edit leaves every original active lease fence intact. */
  fun updateWithEarnedTime(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    fun reject(reason: String) = receipt(context, token, false, reason)
    if (!discardOwnerCurrent(context, token)) return@synchronized reject("app-group-owner-scope-stale")
    if (FreedProtectionConfiguration.resetInProgress) return@synchronized reject("protection-reset-in-progress")
    val originalFields = setOf("version", "expectedStoreRevision", "id", "expectedRevision", "name", "enabled", "rule", "packages", "extraTimeCapMinutes")
    if ((request.keys != originalFields && request.keys != originalFields + "preferredBreakSeconds") ||
      FreedAppGroupPolicy.integer(request["version"]) != 2L || !FreedEarnedAppTimePolicy.validCap(request["extraTimeCapMinutes"]) ||
      (request.containsKey("preferredBreakSeconds") && FreedEarnedAppTimePolicy.seconds(request["preferredBreakSeconds"]) == null)) return@synchronized reject("app-group-request-invalid-or-stale")
    val requestedRule = request["rule"] as? Map<*, *> ?: return@synchronized reject("app-group-request-invalid-or-stale")
    if (requestedRule["kind"] == "daily-limit" && (FreedAppGroupPolicy.integer(requestedRule["limitMinutes"]) ?: 0L) !in 5..240) return@synchronized reject("app-group-request-invalid-or-stale")
    if (!migrate(context)) return@synchronized reject("app-group-storage-invalid")
    val state = read(context)
    val storage = prefs(context)
    val owner = storage.getString(OWNER_DIGEST, null) ?: return@synchronized reject("app-group-owner-scope-stale")
    val oldGroup = groups(state).firstOrNull { it["id"] == request["id"] } ?: return@synchronized reject("app-group-request-invalid-or-stale")
    val preference = if (request.containsKey("preferredBreakSeconds")) FreedEarnedAppTimePolicy.seconds(request["preferredBreakSeconds"])!!
      else FreedEarnedAppTimePolicy.seconds(oldGroup["preferredBreakSeconds"]) ?: 300L
    val rawCandidate = FreedAppGroupPolicy.mutate(state, (request - setOf("extraTimeCapMinutes", "preferredBreakSeconds")) + ("version" to 1), "update", FreedInstalledApplications.eligible(context), "unused")
      ?: return@synchronized reject("app-group-request-invalid-or-stale")
    val candidate = rawCandidate + ("groups" to groups(rawCandidate).map { if (it["id"] == request["id"]) it + ("preferredBreakSeconds" to preference) else it })
    val changedGroup = groups(candidate).first { it["id"] == request["id"] }
    val ruleChanged = listOf("name", "enabled", "rule", "packages").any { !FreedEarnedAppTimePolicy.exact(oldGroup[it], changedGroup[it]) }
    val requiresActivation = changedGroup["enabled"] == true && (oldGroup["enabled"] != true || rule(oldGroup)["kind"] == "legacy" ||
      !FreedEarnedAppTimePolicy.exact(oldGroup["rule"], changedGroup["rule"]) || !FreedEarnedAppTimePolicy.exact(oldGroup["packages"], changedGroup["packages"]))
    if (requiresActivation && (!FreedProtectionConfiguration.interceptionEnabled(context) || !FreedAccessibilityService.appSchedulesServiceConnected ||
      (rule(changedGroup)["kind"] == "daily-limit" && !usageAuthorized(context)))) return@synchronized reject("app-group-permission-or-runtime-required")
    val rows = earnedBudgets(context) ?: return@synchronized reject("earned-time-budget-unreadable")
    val oldBudget = earnedBudget(context, rows, owner, oldGroup["id"] as String) ?: return@synchronized reject("earned-time-clock-unverified")
    // A clock problem must never prevent a cap decrease. It still cannot reset spend or authorize a grant.
    val current = FreedEarnedAppTimePolicy.advanceBudget(oldBudget, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) ?: oldBudget
    val budget = FreedEarnedAppTimePolicy.changeCap(current, number(request["extraTimeCapMinutes"])) ?: return@synchronized reject("earned-time-budget-unreadable")
    val next = if (ruleChanged) candidate else state + mapOf("revision" to number(state["revision"]) + 1L,
      "groups" to groups(state).map { if (it["id"] == request["id"]) it + ("preferredBreakSeconds" to preference) else it })
    val encoded = encode(next)
    val encodedBudget = earnedEncoded(replacingBudget(rows, budget)) ?: return@synchronized reject("earned-time-ledger-capacity")
    val before = storage.all
    val epoch = FreedProtectionConfiguration.epoch(context); val scope = scopeEpoch(context)
    val editor = storage.edit().putString(CONFIGURATION_KEY, encoded).putString(FreedEarnedAppTimePolicy.BUDGET_KEY, encodedBudget)
    val keys = mutableListOf(CONFIGURATION_KEY, FreedEarnedAppTimePolicy.BUDGET_KEY)
    if (ruleChanged) {
      clearAuthority(editor)
      keys.addAll(listOf(CLAIM_KEY, EVENT_KEY, BREAKS_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY, FreedEarnedAppTimePolicy.BREAKS_KEY, FreedEarnedChallengeProofPolicy.KEY))
    }
    if (rule(oldGroup)["kind"] == "legacy") { editor.remove(FreedAccessibilityService.BLOCKED_APP_PACKAGES); keys.add(FreedAccessibilityService.BLOCKED_APP_PACKAGES) }
    val accepted = FreedAppGroupTransaction.publish({ editor.commit() },
      { storage.getString(CONFIGURATION_KEY, null) == encoded && storage.getString(FreedEarnedAppTimePolicy.BUDGET_KEY, null) == encodedBudget &&
        (!ruleChanged || listOf(CLAIM_KEY, EVENT_KEY, BREAKS_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY, FreedEarnedAppTimePolicy.BREAKS_KEY, FreedEarnedChallengeProofPolicy.KEY).none(storage::contains)) },
      { discardOwnerCurrent(context, token) && scope == scopeEpoch(context) && epoch == FreedProtectionConfiguration.epoch(context) && !FreedProtectionConfiguration.resetInProgress },
      { restore(storage, before, keys) })
    FreedAccessibilityService.requestAppGroupRecheck()
    receipt(context, token, accepted, if (accepted) null else "app-group-native-install-failed")
  }

  private fun earnedRuntime(context: Context, token: String): Boolean = discardOwnerCurrent(context, token) &&
    !FreedProtectionConfiguration.resetInProgress && FreedProtectionConfiguration.interceptionEnabled(context) && FreedAccessibilityService.appSchedulesServiceConnected

  private fun earnedGroup(context: Context, request: Map<String, Any?>, state: Map<String, Any?>): Map<String, Any?>? {
    val target = request["packageName"] as? String ?: return null
    if (number(request["configurationGeneration"]) != generation(context, state) || number(request["scopeEpoch"]) != scopeEpoch(context) || target !in FreedInstalledApplications.eligible(context)) return null
    return groups(state).firstOrNull { it["id"] == request["groupId"] && number(it["revision"]) == number(request["groupRevision"]) &&
      it["enabled"] == true && rule(it)["kind"] != "legacy" && target in packages(it) }
  }

  private fun earnedClaimCurrent(context: Context, claim: Map<String, Any?>, request: Map<String, Any?>, group: Map<String, Any?>, state: Map<String, Any?>): Boolean {
    val now = System.currentTimeMillis(); val elapsed = SystemClock.elapsedRealtime()
    val claimed = FreedAppGroupPolicy.integer(claim["claimedAt"]) ?: return false
    val started = FreedAppGroupPolicy.integer(claim["claimedElapsed"]) ?: return false
    if (now < claimed || elapsed < started || kotlin.math.abs((now - claimed) - (elapsed - started)) > 5_000L ||
      now - claimed >= FreedEarnedAppTimePolicy.CLAIM_LIFETIME_MS || elapsed - started >= FreedEarnedAppTimePolicy.CLAIM_LIFETIME_MS) return false
    return FreedAppGroupAuthorityPolicy.authorize(claim, group + ("legacy" to false), generation(context, state), scopeEpoch(context), FreedProtectionConfiguration.epoch(context),
      request["nativeInterventionId"] as? String, request["packageName"] as? String ?: "", now + number(request["requestedSeconds"]) * 1000L,
      now, elapsed, boot(context))?.get("firstFulfillment") == true
  }

  private fun canReleaseEarnedTarget(context: Context, target: String, group: Map<String, Any?>, state: Map<String, Any?>): Boolean {
    val restrictions = restrictions(context, target, state, todayUsage(context), emptyList())
    return restrictions.size == 1 && restrictions.single()["id"] == group["id"] && !legacyRestriction(context, target)
  }

  private fun offerView(offer: Map<String, Any?>): Map<String, Any?> {
    @Suppress("UNCHECKED_CAST") val request = offer["request"] as Map<String, Any?>
    val duration = number(request["requestedSeconds"])
    return (request - setOf("version", "policyVersion", "packageName")) + mapOf("offerId" to offer["offerId"],
      "availableMethods" to offer["availableMethods"], "budgetDay" to offer["budgetDay"], "budgetRevision" to offer["budgetRevision"], "validUntil" to iso(number(offer["validUntilMs"])),
      "supportedPhotoTargetIds" to (offer["supportedPhotoTargetIds"] ?: emptyList<String>()),
      "requiredActiveSeconds" to FreedEarnedAppTimePolicy.requiredActiveSeconds(duration), "requiredSteps" to FreedEarnedAppTimePolicy.requiredSteps(duration), "requiredDistinctPhotoTargets" to FreedEarnedAppTimePolicy.requiredPhotoTargets(duration))
  }

  @Suppress("UNCHECKED_CAST")
  private fun validEarnedOffer(offer: Map<String, Any?>): Boolean {
    val oldFields = setOf("offerId", "ownerDigest", "request", "claim", "budgetDay", "budgetRevision", "validUntilMs", "availableMethods")
    if (offer.keys != oldFields && offer.keys != oldFields + "supportedPhotoTargetIds") return false
    val methods = offer["availableMethods"] as? List<*> ?: return false
    val targets = (offer["supportedPhotoTargetIds"] as? List<*>) ?: emptyList<Any?>()
    if (methods.isEmpty() || methods.first() != "timer" || methods.distinct().size != methods.size || methods.any { it !in setOf("timer", "steps", "photo") } ||
      targets.distinct().size != targets.size || targets.any { it !in FreedEarnedChallengeProofPolicy.targetCatalog } ||
      ("photo" in methods && targets.size < FreedEarnedAppTimePolicy.requiredPhotoTargets(number((offer["request"] as? Map<*, *>)?.get("requestedSeconds"))))) return false
    val request = offer["request"] as? Map<String, Any?> ?: return false
    val claim = offer["claim"] as? Map<String, Any?> ?: return false
    return FreedEarnedAppTimePolicy.validOfferRequest(request) && (offer["offerId"] as? String)?.let { runCatching { UUID.fromString(it).toString() == it }.getOrDefault(false) } == true &&
      !(offer["ownerDigest"] as? String).isNullOrBlank() && !(offer["budgetDay"] as? String).isNullOrBlank() &&
      FreedAppGroupPolicy.integer(offer["budgetRevision"]) != null && number(offer["validUntilMs"]) == number(claim["claimedAt"]) + FreedEarnedAppTimePolicy.CLAIM_LIFETIME_MS
  }

  @Suppress("UNCHECKED_CAST")
  private fun earnedRecords(context: Context): List<Map<String, Any?>>? {
    val records = earnedRows(context, FreedEarnedAppTimePolicy.LEDGER_KEY) ?: return null
    if (records.any { record ->
        val request = record["request"] as? Map<String, Any?>
        val offer = record["offer"] as? Map<String, Any?>
        val grantBudget = record["budgetAtGrant"] as? Map<String, Any?>
        record.keys != setOf("ownerDigest", "completionSessionId", "nativeInterventionId", "request", "offer", "lease", "budgetAtGrant") ||
          request == null || offer == null || grantBudget == null || !FreedEarnedAppTimePolicy.validBudget(grantBudget) ||
          !FreedEarnedAppTimePolicy.validGrantRequest(request) || !validEarnedOffer(offer) || request["offerId"] != offer["offerId"] ||
          grantBudget["dayKey"] != offer["budgetDay"] || grantBudget["ownerDigest"] != offer["ownerDigest"] ||
          number(grantBudget["revision"]) <= number(offer["budgetRevision"]) ||
          record["ownerDigest"] != offer["ownerDigest"] || record["completionSessionId"] != request["completionSessionId"] || record["lease"] !is Map<*, *>
      } || records.map { it["ownerDigest"] to it["completionSessionId"] }.distinct().size != records.size) return null
    return records
  }

  private data class EarnedClockFence(val token: String, val request: Map<String, Any?>, val owner: String,
    val configuration: String, val budgets: String, val bootCount: Int)

  private fun earnedClockFence(context: Context, request: Map<String, Any?>, token: String): EarnedClockFence? = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedEarnedAppTimePolicy.validOfferRequest(request) || !earnedRuntime(context, token)) return@synchronized null
    val storage = prefs(context)
    val configuration = storage.getString(CONFIGURATION_KEY, null) ?: return@synchronized null
    val state = decode(configuration) ?: return@synchronized null
    val group = earnedGroup(context, request, state) ?: return@synchronized null
    val rows = earnedBudgets(context) ?: return@synchronized null
    val owner = storage.getString(OWNER_DIGEST, null) ?: return@synchronized null
    val budget = rows.firstOrNull { it["ownerDigest"] == owner && it["groupId"] == group["id"] } ?: return@synchronized null
    if (FreedEarnedAppTimePolicy.clockVerified(budget, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context))) return@synchronized null
    val raw = storage.getString(FreedEarnedAppTimePolicy.BUDGET_KEY, null) ?: return@synchronized null
    EarnedClockFence(token, request.toMap(), owner, configuration, raw, boot(context)).takeIf { it.bootCount >= 0 }
  }

  private fun repairEarnedClock(context: Context, fence: EarnedClockFence, proof: FreedEarnedTimeClock.Proof): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val storage = prefs(context)
    fun stillCurrent(): Boolean = earnedRuntime(context, fence.token) && storage.getString(OWNER_DIGEST, null) == fence.owner &&
      boot(context) == fence.bootCount && storage.getString(CONFIGURATION_KEY, null) == fence.configuration &&
      earnedGroup(context, fence.request, read(context)) != null
    if (!stillCurrent() || storage.getString(FreedEarnedAppTimePolicy.BUDGET_KEY, null) != fence.budgets) return@synchronized false
    val rows = earnedBudgets(context) ?: return@synchronized false
    val budget = rows.firstOrNull { it["ownerDigest"] == fence.owner && it["groupId"] == fence.request["groupId"] } ?: return@synchronized false
    val recovered = FreedEarnedAppTimePolicy.recoverBudget(budget, proof, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) ?: return@synchronized false
    val encoded = earnedEncoded(replacingBudget(rows, recovered)) ?: return@synchronized false
    val before = storage.all
    FreedAppGroupTransaction.publish({ storage.edit().putString(FreedEarnedAppTimePolicy.BUDGET_KEY, encoded).remove(FreedEarnedAppTimePolicy.OFFERS_KEY).commit() },
      { storage.getString(FreedEarnedAppTimePolicy.BUDGET_KEY, null) == encoded && !storage.contains(FreedEarnedAppTimePolicy.OFFERS_KEY) },
      { stillCurrent() && FreedEarnedAppTimePolicy.clockVerified(recovered, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) },
      { restore(storage, before, listOf(FreedEarnedAppTimePolicy.BUDGET_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY)) })
  }

  /** HTTPS runs outside the native protection lock. Its result has no authority until every captured owner/rule/budget fence still matches. */
  fun prepareEarnedTimeWithClockRecovery(context: Context, request: Map<String, Any?>, token: String,
    fetchProof: () -> FreedEarnedTimeClock.Proof? = { FreedEarnedTimeClock.fetch() }): Map<String, Any?> {
    val fence = earnedClockFence(context, request, token)
    if (fence != null) runCatching { fetchProof() }.getOrNull()?.let { repairEarnedClock(context, fence, it) }
    return prepareEarnedTime(context, request, token)
  }

  /** Offer preparation spends nothing and persists the exact original native claim and chosen duration. */
  fun prepareEarnedTime(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    fun reject(reason: String, budget: Map<String, Any?>? = null) = FreedEarnedAppTimePolicy.rejectedOffer(reason, budget = budget)
    if (!FreedEarnedAppTimePolicy.validOfferRequest(request)) return@synchronized reject("earned-time-request-invalid")
    if (!earnedRuntime(context, token)) return@synchronized reject("earned-time-owner-or-state-unavailable")
    val storage = prefs(context)
    val state = decode(storage.getString(CONFIGURATION_KEY, null)) ?: return@synchronized reject("earned-time-state-unreadable")
    val group = earnedGroup(context, request, state) ?: return@synchronized reject("earned-time-authority-stale")
    val owner = storage.getString(OWNER_DIGEST, null) ?: return@synchronized reject("earned-time-owner-or-state-unavailable")
    val rows = earnedBudgets(context) ?: return@synchronized reject("earned-time-budget-unreadable")
    val oldBudget = earnedBudget(context, rows, owner, group["id"] as String) ?: return@synchronized reject("earned-time-clock-unverified")
    val budget = FreedEarnedAppTimePolicy.advanceBudget(oldBudget, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context))
      ?: return@synchronized reject("earned-time-clock-unverified", budgetView(context, oldBudget))
    if (FreedEarnedAppTimePolicy.remaining(budget) < number(request["requestedSeconds"])) return@synchronized reject("earned-time-budget-exhausted", budgetView(context, budget))
    val records = earnedRecords(context) ?: return@synchronized reject("earned-time-ledger-unreadable")
    if (records.size >= FreedEarnedAppTimePolicy.MAX_RECORDS || records.any { it["ownerDigest"] == owner && it["nativeInterventionId"] == request["nativeInterventionId"] }) return@synchronized reject("earned-time-already-consumed")
    val leases = allBreaks(context)
    if (legacyEarnedWindowActive(context) || leases.any { lease -> groups(state).any { liveBreak(context, lease, it, state) } }) return@synchronized reject("earned-time-active-window")
    if (!canReleaseEarnedTarget(context, request["packageName"] as String, group, state)) return@synchronized reject("earned-time-independent-restriction", budgetView(context, budget))
    val claim = decode(storage.getString(CLAIM_KEY, null)) ?: return@synchronized reject("earned-time-claim-missing")
    if (!earnedClaimCurrent(context, claim, request, group, state)) return@synchronized reject("earned-time-authority-stale")
    val offers = earnedRows(context, FreedEarnedAppTimePolicy.OFFERS_KEY) ?: return@synchronized reject("earned-time-offer-unreadable")
    if (offers.any { !validEarnedOffer(it) }) return@synchronized reject("earned-time-offer-unreadable")
    val previous = offers.firstOrNull { it["ownerDigest"] == owner && FreedEarnedAppTimePolicy.exact(it["request"], request) &&
      FreedEarnedAppTimePolicy.exact(it["claim"], claim) && it["budgetDay"] == budget["dayKey"] && number(it["budgetRevision"]) == number(budget["revision"]) }
    val offer = previous ?: mapOf("offerId" to UUID.randomUUID().toString(), "ownerDigest" to owner, "request" to request, "availableMethods" to (listOf("timer") + (if (FreedEarnedChallengeStepSensor.supported(context)) listOf("steps") else emptyList()) + (if (FreedEarnedChallengePhotoEvaluation.reviewedTargetIds.size >= FreedEarnedAppTimePolicy.requiredPhotoTargets(number(request["requestedSeconds"]))) listOf("photo") else emptyList())),
      "supportedPhotoTargetIds" to FreedEarnedChallengePhotoEvaluation.reviewedTargetIds,
      "claim" to claim, "budgetDay" to budget["dayKey"], "budgetRevision" to budget["revision"], "validUntilMs" to number(claim["claimedAt"]) + FreedEarnedAppTimePolicy.CLAIM_LIFETIME_MS)
    val encodedBudget = earnedEncoded(replacingBudget(rows, budget)) ?: return@synchronized reject("earned-time-ledger-capacity")
    // One current native claim and one outstanding offer globally. Replacement cannot leave reusable authority.
    val encodedOffers = earnedEncoded(listOf(offer)) ?: return@synchronized reject("earned-time-ledger-capacity")
    val before = storage.all
    val stateRaw = storage.getString(CONFIGURATION_KEY, null); val claimRaw = storage.getString(CLAIM_KEY, null)
    if (!FreedAppGroupTransaction.publish({ storage.edit().putString(FreedEarnedAppTimePolicy.BUDGET_KEY, encodedBudget).putString(FreedEarnedAppTimePolicy.OFFERS_KEY, encodedOffers).commit() },
        { storage.getString(FreedEarnedAppTimePolicy.BUDGET_KEY, null) == encodedBudget && storage.getString(FreedEarnedAppTimePolicy.OFFERS_KEY, null) == encodedOffers },
        { earnedRuntime(context, token) && storage.getString(CONFIGURATION_KEY, null) == stateRaw && storage.getString(CLAIM_KEY, null) == claimRaw &&
          earnedClaimCurrent(context, claim, request, group, state) && FreedEarnedAppTimePolicy.clockVerified(budget, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) },
        { restore(storage, before, listOf(FreedEarnedAppTimePolicy.BUDGET_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY)) })) return@synchronized reject("earned-time-persistence-failed")
    mapOf("version" to 2, "policyVersion" to 2, "supported" to true, "accepted" to true, "reason" to null, "offer" to offerView(offer), "budget" to budgetView(context, budget))
  }

  /** A proof operation captures the saved offer, never caller-supplied scope or thresholds. */
  fun earnedEvidenceAuthority(context: Context, offerId: String, token: String): Map<String, Any?>? = synchronized(FreedNativeUnlockStore.lock) {
    if (!earnedRuntime(context, token)) return@synchronized null
    val storage = prefs(context)
    val owner = storage.getString(OWNER_DIGEST, null) ?: return@synchronized null
    val offers = earnedRows(context, FreedEarnedAppTimePolicy.OFFERS_KEY) ?: return@synchronized null
    if (offers.any { !validEarnedOffer(it) }) return@synchronized null
    val offer = offers.singleOrNull { it["offerId"] == offerId && it["ownerDigest"] == owner } ?: return@synchronized null
    @Suppress("UNCHECKED_CAST") val request = offer["request"] as Map<String, Any?>
    val state = decode(storage.getString(CONFIGURATION_KEY, null)) ?: return@synchronized null
    val group = earnedGroup(context, request, state) ?: return@synchronized null
    val claim = decode(storage.getString(CLAIM_KEY, null)) ?: return@synchronized null
    if (!FreedEarnedAppTimePolicy.exact(offer["claim"], claim) || !earnedClaimCurrent(context, claim, request, group, state) ||
      !canReleaseEarnedTarget(context, request["packageName"] as String, group, state)) return@synchronized null
    val budget = earnedBudgets(context)?.firstOrNull { it["ownerDigest"] == owner && it["groupId"] == request["groupId"] }
      ?.let { FreedEarnedAppTimePolicy.advanceBudget(it, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) } ?: return@synchronized null
    offer.takeIf { it["budgetDay"] == budget["dayKey"] && number(it["budgetRevision"]) == number(budget["revision"]) && FreedEarnedAppTimePolicy.remaining(budget) >= number(request["requestedSeconds"]) }
  }

  fun grantEarnedTime(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> =
    resolveEarnedTimeGrant(context, request, token, replayOnly = false)

  /** Cold-start readback cannot submit an unconsumed request, create an offer, spend, or schedule a recheck. */
  fun getEarnedTimeGrant(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> =
    resolveEarnedTimeGrant(context, request, token, replayOnly = true)

  @Suppress("UNCHECKED_CAST")
  private fun resolveEarnedTimeGrant(context: Context, request: Map<String, Any?>, token: String, replayOnly: Boolean): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    fun reject(reason: String, budget: Map<String, Any?>? = null) = FreedEarnedAppTimePolicy.rejectedGrant(reason, budget = budget)
    if (!FreedEarnedAppTimePolicy.validGrantRequest(request)) return@synchronized reject("earned-time-request-invalid")
    if (!earnedRuntime(context, token)) return@synchronized reject("earned-time-owner-or-state-unavailable")
    val storage = prefs(context)
    val owner = storage.getString(OWNER_DIGEST, null) ?: return@synchronized reject("earned-time-owner-or-state-unavailable")
    val records = earnedRecords(context) ?: return@synchronized reject("earned-time-ledger-unreadable")
    val previous = records.firstOrNull { it["ownerDigest"] == owner && it["completionSessionId"] == request["completionSessionId"] }
    if (replayOnly && previous == null) return@synchronized reject("earned-time-grant-not-found")
    val offers = earnedRows(context, FreedEarnedAppTimePolicy.OFFERS_KEY) ?: return@synchronized reject("earned-time-offer-unreadable")
    if (offers.any { !validEarnedOffer(it) }) return@synchronized reject("earned-time-offer-unreadable")
    if (previous != null && !FreedEarnedAppTimePolicy.exact(previous["request"], request)) return@synchronized reject("earned-time-already-consumed")
    val offer = (previous?.get("offer") as? Map<String, Any?>) ?: offers.firstOrNull { it["offerId"] == request["offerId"] && it["ownerDigest"] == owner }
      ?: return@synchronized reject("earned-time-offer-missing")
    val original = offer["request"] as Map<String, Any?>
    val state = decode(storage.getString(CONFIGURATION_KEY, null)) ?: return@synchronized reject("earned-time-state-unreadable")
    val group = earnedGroup(context, original, state) ?: return@synchronized reject("earned-time-authority-stale")
    val duration = number(original["requestedSeconds"])
    val method = (request["evidence"] as Map<*, *>)["method"]
    if (method !in (offer["availableMethods"] as List<*>)) return@synchronized reject(
      if (method == "steps") "earned-time-steps-verification-unavailable" else "earned-time-photo-proof-unavailable")
    FreedEarnedAppTimePolicy.evidenceFailure(request, duration)?.let { return@synchronized reject(it) }
    val proofRows = if (previous == null && method != "timer") FreedEarnedChallengeProofStore.rows(context) ?: return@synchronized reject("earned-time-proof-store-unreadable") else null
    val consumedProofs = if (proofRows != null) FreedEarnedChallengeProofPolicy.consumed(proofRows, request, owner, offer)
      ?: return@synchronized reject("earned-time-native-proof-invalid") else null
    val encodedProofs = consumedProofs?.let(FreedEarnedChallengeProofStore::encoded)
    if (consumedProofs != null && encodedProofs == null) return@synchronized reject("earned-time-ledger-capacity")
    val rows = earnedBudgets(context) ?: return@synchronized reject("earned-time-budget-unreadable")
    // A saved offer must already have a budget. Missing state cannot mint a replacement allowance.
    val oldBudget = rows.firstOrNull { it["ownerDigest"] == owner && it["groupId"] == original["groupId"] } ?: return@synchronized reject("earned-time-budget-unreadable")
    val budget = FreedEarnedAppTimePolicy.advanceBudget(oldBudget, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context))
      ?: return@synchronized reject("earned-time-clock-unverified", budgetView(context, oldBudget))
    val lease: Map<String, Any?>
    val finalBudget: Map<String, Any?>
    if (previous != null) {
      lease = previous["lease"] as Map<String, Any?>
      if (replayOnly && number(lease["boot"]) != boot(context).toLong()) return@synchronized reject("earned-time-authority-stale")
      if (replayOnly && (System.currentTimeMillis() >= number(lease["grantedExpiry"]) || SystemClock.elapsedRealtime() >= number(lease["expiresElapsed"])))
        return@synchronized reject("earned-time-grant-expired")
      val current = earnedRows(context, FreedEarnedAppTimePolicy.BREAKS_KEY)?.firstOrNull { it["offerId"] == offer["offerId"] }
      if (current == null || !FreedEarnedAppTimePolicy.exact(current, lease) || !liveEarnedBreak(context, lease, group, state)) return@synchronized reject("earned-time-already-consumed")
      finalBudget = previous["budgetAtGrant"] as Map<String, Any?>
    } else {
      if (records.size >= FreedEarnedAppTimePolicy.MAX_RECORDS || records.any { it["ownerDigest"] == owner && it["nativeInterventionId"] == original["nativeInterventionId"] }) return@synchronized reject("earned-time-already-consumed")
      if (legacyEarnedWindowActive(context) || allBreaks(context).any { saved -> groups(state).any { liveBreak(context, saved, it, state) } }) return@synchronized reject("earned-time-active-window")
      if (offer["budgetDay"] != budget["dayKey"] || number(offer["budgetRevision"]) != number(budget["revision"])) return@synchronized reject("earned-time-budget-stale", budgetView(context, budget))
      finalBudget = FreedEarnedAppTimePolicy.spend(budget, duration) ?: return@synchronized reject("earned-time-budget-exhausted", budgetView(context, budget))
      val claim = decode(storage.getString(CLAIM_KEY, null)) ?: return@synchronized reject("earned-time-claim-missing")
      if (!FreedEarnedAppTimePolicy.exact(offer["claim"], claim) || !earnedClaimCurrent(context, claim, original, group, state)) return@synchronized reject("earned-time-authority-stale")
      val target = original["packageName"] as String
      if (!canReleaseEarnedTarget(context, target, group, state)) return@synchronized reject("earned-time-independent-restriction", budgetView(context, budget))
      val now = System.currentTimeMillis(); val elapsed = SystemClock.elapsedRealtime()
      lease = claim + mapOf("rewardPolicyVersion" to 2L, "ownerDigest" to owner, "offerId" to offer["offerId"], "completionSessionId" to request["completionSessionId"],
        "requestedSeconds" to duration, "grantedAt" to now, "grantedElapsed" to elapsed,
        "requestedExpiry" to now + duration * 1000L, "grantedExpiry" to now + duration * 1000L, "expiresElapsed" to elapsed + duration * 1000L)
      val record = mapOf("ownerDigest" to owner, "completionSessionId" to request["completionSessionId"], "nativeInterventionId" to original["nativeInterventionId"], "request" to request, "offer" to offer, "lease" to lease, "budgetAtGrant" to finalBudget)
      val encodedBudget = earnedEncoded(replacingBudget(rows, finalBudget)) ?: return@synchronized reject("earned-time-ledger-capacity")
      val encodedLedger = earnedEncoded(records + record) ?: return@synchronized reject("earned-time-ledger-capacity")
      val encodedBreaks = earnedEncoded(listOf(lease)) ?: return@synchronized reject("earned-time-ledger-capacity")
      val before = storage.all
      val stateRaw = storage.getString(CONFIGURATION_KEY, null)
      val keys = listOf(FreedEarnedAppTimePolicy.BUDGET_KEY, FreedEarnedAppTimePolicy.LEDGER_KEY, FreedEarnedAppTimePolicy.BREAKS_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY, CLAIM_KEY) + (if (encodedProofs != null) listOf(FreedEarnedChallengeProofPolicy.KEY) else emptyList())
      if (!FreedAppGroupTransaction.publish({ storage.edit().putString(FreedEarnedAppTimePolicy.BUDGET_KEY, encodedBudget)
          .putString(FreedEarnedAppTimePolicy.LEDGER_KEY, encodedLedger).putString(FreedEarnedAppTimePolicy.BREAKS_KEY, encodedBreaks)
          .apply { if (encodedProofs != null) putString(FreedEarnedChallengeProofPolicy.KEY, encodedProofs) }
          .remove(FreedEarnedAppTimePolicy.OFFERS_KEY).remove(CLAIM_KEY).commit() },
          { storage.getString(FreedEarnedAppTimePolicy.BUDGET_KEY, null) == encodedBudget && storage.getString(FreedEarnedAppTimePolicy.LEDGER_KEY, null) == encodedLedger &&
            storage.getString(FreedEarnedAppTimePolicy.BREAKS_KEY, null) == encodedBreaks && (encodedProofs == null || storage.getString(FreedEarnedChallengeProofPolicy.KEY, null) == encodedProofs) && !storage.contains(FreedEarnedAppTimePolicy.OFFERS_KEY) && !storage.contains(CLAIM_KEY) },
          { earnedRuntime(context, token) && storage.getString(CONFIGURATION_KEY, null) == stateRaw && earnedGroup(context, original, state) != null &&
            earnedClaimCurrent(context, claim, original, group, state) && canReleaseEarnedTarget(context, target, group, state) &&
            FreedEarnedAppTimePolicy.clockVerified(finalBudget, System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) },
          { restore(storage, before, keys) })) return@synchronized reject("earned-time-persistence-failed")
    }
    val remaining = restrictions(context, original["packageName"] as String, state, todayUsage(context), allBreaks(context)).size + if (legacyRestriction(context, original["packageName"] as String)) 1 else 0
    if (!replayOnly) FreedAccessibilityService.requestAppGroupRecheck()
    mapOf("version" to 2, "policyVersion" to 2, "supported" to true, "accepted" to true, "reason" to null, "offerId" to offer["offerId"],
      "completionSessionId" to request["completionSessionId"], "groupId" to group["id"], "nativeInterventionId" to original["nativeInterventionId"],
      "seconds" to duration, "expiresAt" to iso(number(lease["grantedExpiry"])), "effective" to (remaining == 0),
      "remainingRestrictionCount" to remaining, "replayed" to (previous != null), "budget" to budgetView(context, finalBudget))
  }

  private fun liveEarnedBreak(context: Context, lease: Map<String, Any?>, group: Map<String, Any?>, state: Map<String, Any?>): Boolean {
    val duration = FreedEarnedAppTimePolicy.seconds(lease["requestedSeconds"]) ?: return false
    val granted = FreedAppGroupPolicy.integer(lease["grantedAt"]) ?: return false
    val started = FreedAppGroupPolicy.integer(lease["grantedElapsed"]) ?: return false
    val now = System.currentTimeMillis(); val elapsed = SystemClock.elapsedRealtime()
    return number(lease["rewardPolicyVersion"]) == 2L && lease["ownerDigest"] == prefs(context).getString(OWNER_DIGEST, null) &&
      lease["targetKind"] == "android-app-group" && lease["groupId"] == group["id"] && lease["packageName"] in packages(group) &&
      group["enabled"] == true && rule(group)["kind"] != "legacy" && number(lease["groupRevision"]) == number(group["revision"]) &&
      number(lease["configurationGeneration"]) == generation(context, state) && number(lease["scopeEpoch"]) == scopeEpoch(context) &&
      number(lease["resetEpoch"]) == FreedProtectionConfiguration.epoch(context) && boot(context) >= 0 && number(lease["boot"]) == boot(context).toLong() &&
      granted > 0L && now >= granted && elapsed >= started && kotlin.math.abs((now - granted) - (elapsed - started)) <= 5_000L &&
      number(lease["grantedExpiry"]) == granted + duration * 1000L && number(lease["requestedExpiry"]) == number(lease["grantedExpiry"]) &&
      number(lease["expiresElapsed"]) == started + duration * 1000L && now < number(lease["grantedExpiry"]) && elapsed < number(lease["expiresElapsed"])
  }

  /** The v2 no-stacking decision also reads legacy package/surface receipts through their unchanged policy. */
  private fun legacyEarnedWindowActive(context: Context): Boolean {
    val storage = prefs(context)
    fun active(raw: String): Boolean {
      val saved = decode(raw) ?: return true
      val source = saved["package"] as? String ?: return true
      if (source !in FreedInstalledApplications.eligible(context)) return false
      val lease = FreedNativeUnlockLease(saved["id"] as? String ?: return true, source, saved["rule"] as? String,
        FreedAppGroupPolicy.integer(saved["claimedAt"]) ?: return true, FreedAppGroupPolicy.integer(saved["elapsed"]) ?: return true,
        (FreedAppGroupPolicy.integer(saved["boot"]) ?: return true).toInt(),
        FreedAppGroupPolicy.integer(saved["requestedExpiry"]) ?: return true, FreedAppGroupPolicy.integer(saved["grantedExpiry"]) ?: return true)
      return FreedNativeUnlockPolicy.authorize(lease, lease.interventionId, source, lease.ruleId, lease.fulfilledRequestExpiryMs!!,
        System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context))?.firstFulfillment == false
    }
    storage.getString("native_package_unlock_receipt_v1", null)?.let { if (active(it)) return true }
    storage.getString("native_surface_unlock_receipts_v1", null)?.let { raw ->
      val values = decode(raw) ?: return true
      if (values.values.any { it !is String || active(it) }) return true
    }
    return false
  }

  /** Used only to deny new legacy grants; existing v1 receipts keep their original replay path. */
  fun hasActiveEarnedTimeWindow(context: Context): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val state = read(context)
    earnedRows(context, FreedEarnedAppTimePolicy.BREAKS_KEY).orEmpty().any { lease ->
      groups(state).any { liveEarnedBreak(context, lease, it, state) }
    }
  }

  private fun allBreaks(context: Context): List<Map<String, Any?>> = breaks(context) + earnedRows(context, FreedEarnedAppTimePolicy.BREAKS_KEY).orEmpty()

  fun fulfill(context: Context, id: String?, target: String, requestedExpiry: Long): Map<String, Any?>? = synchronized(FreedNativeUnlockStore.lock) {
    if (!ownerBound() || !FreedProtectionConfiguration.interceptionEnabled(context) ||
      !FreedAccessibilityService.appSchedulesServiceConnected || target !in FreedInstalledApplications.eligible(context)) return@synchronized null
    val state = read(context)
    val leases = breaks(context)
    // Compatibility readback only: no unfulfilled claim or partial lease can grant.
    val lease = leases.firstOrNull { it["id"] == id && it["packageName"] == target } ?: return@synchronized null
    val group = groups(state).firstOrNull { it["id"] == lease["groupId"] } ?: return@synchronized null
    val now = System.currentTimeMillis()
    val decision = FreedAppGroupAuthorityPolicy.authorize(lease, group, generation(context, state), scopeEpoch(context),
      FreedProtectionConfiguration.epoch(context), id, target, requestedExpiry, now, SystemClock.elapsedRealtime(), boot(context)) ?: return@synchronized null
    val expiry = number(decision["expiresAtMs"])
    if (decision["firstFulfillment"] != false) return@synchronized null
    val remaining = restrictions(context, target, state, todayUsage(context), allBreaks(context)).size + if (legacyRestriction(context, target)) 1 else 0
    FreedAccessibilityService.requestAppGroupRecheck()
    mapOf("nativeUnlockGrantAccepted" to true, "nativeUnlockGrantInterventionId" to id,
      "appGroupBreakGroupId" to group["id"], "appGroupBreakRevision" to number(group["revision"]),
      "appGroupBreakEffective" to (remaining == 0), "appGroupRemainingRestrictionCount" to remaining,
      "activeUnlockExpiresAt" to iso(expiry), "activeUnlockSourcePackage" to target,
      "activeUnlockInterventionId" to id)
  }

  private fun liveBreak(context: Context, lease: Map<String, Any?>, group: Map<String, Any?>, state: Map<String, Any?>): Boolean {
    if (number(lease["rewardPolicyVersion"]) == 2L) return liveEarnedBreak(context, lease, group, state)
    if (lease["groupId"] != group["id"] || lease["packageName"] !in packages(group) || number(lease["expiresElapsed"]) <= SystemClock.elapsedRealtime()) return false
    return FreedAppGroupAuthorityPolicy.authorize(lease, group, generation(context, state), scopeEpoch(context), FreedProtectionConfiguration.epoch(context),
      lease["id"] as? String, lease["packageName"] as? String ?: "", number(lease["requestedExpiry"]), System.currentTimeMillis(), SystemClock.elapsedRealtime(), boot(context)) != null
  }

  private fun breaks(context: Context): List<Map<String, Any?>> = decode(prefs(context).getString(BREAKS_KEY, null))?.let(::groupsFromLeases).orEmpty()
  @Suppress("UNCHECKED_CAST") private fun groupsFromLeases(state: Map<String, Any?>): List<Map<String, Any?>> = (state["leases"] as? List<*>)?.take(6)?.mapNotNull { it as? Map<String, Any?> }.orEmpty()
  fun clearEarnedBreaks(context: Context): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val storage = prefs(context)
    val before = storage.all
    val epoch = FreedProtectionConfiguration.epoch(context)
    val keys = listOf(CLAIM_KEY, EVENT_KEY, BREAKS_KEY, FreedEarnedAppTimePolicy.OFFERS_KEY, FreedEarnedAppTimePolicy.BREAKS_KEY, FreedEarnedChallengeProofPolicy.KEY)
    val editor = storage.edit()
    clearAuthority(editor)
    val accepted = FreedAppGroupTransaction.publish({ editor.commit() }, { keys.none(storage::contains) },
      { epoch == FreedProtectionConfiguration.epoch(context) && !FreedProtectionConfiguration.resetInProgress },
      { restore(storage, before, keys) })
    FreedAccessibilityService.requestAppGroupRecheck()
    accepted
  }

  fun clearAuthority(editor: SharedPreferences.Editor) { editor.remove(CLAIM_KEY).remove(EVENT_KEY).remove(BREAKS_KEY)
    .remove(FreedEarnedAppTimePolicy.OFFERS_KEY).remove(FreedEarnedAppTimePolicy.BREAKS_KEY).remove(FreedEarnedChallengeProofPolicy.KEY) }
  fun restoreClaim(editor: SharedPreferences.Editor, snapshot: Map<String, *>) { (snapshot[CLAIM_KEY] as? String)?.let { editor.putString(CLAIM_KEY, it) } ?: editor.remove(CLAIM_KEY) }

  private fun legacyHardGuard(context: Context, target: String): Boolean {
    if (target !in FreedInstalledApplications.eligible(context)) return false
    val legacy = FreedAppScheduleStore.read(context)
    return target in FreedAppScheduleStore.snapshot(context).activePackages || (legacy.strictGuard && target in FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES)
  }
  private fun legacyRestriction(context: Context, target: String): Boolean {
    if (target !in FreedInstalledApplications.eligible(context)) return false
    if (legacyHardGuard(context, target)) return true
    val manual = prefs(context).getString(FreedAccessibilityService.BLOCKED_APP_PACKAGES, "").orEmpty().split(',').toSet()
    val mode = FreedAppGuardModeStore.read(context)
    return target in manual && (mode == "before-use" || (mode == "daily-limit" && (todayUsage(context)?.get(target) ?: 0L) >=
      prefs(context).getInt(FreedAccessibilityService.DAILY_LIMIT_MINUTES, FreedAccessibilityService.DEFAULT_DAILY_LIMIT_MINUTES) * 60_000L))
  }

  fun usageAuthorized(context: Context): Boolean = runCatching {
    (context.getSystemService(Context.APP_OPS_SERVICE) as? AppOpsManager)?.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  }.getOrDefault(false)

  /** UsageStats supplies measured foreground time; unavailable permission produces null, never guessed totals. */
  private fun todayUsage(context: Context): Map<String, Long>? {
    if (!usageAuthorized(context)) return null
    val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return null
    val start = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
    val measured = runCatching { manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, System.currentTimeMillis()).orEmpty()
      .groupBy { it.packageName }.mapValues { (_, rows) -> rows.sumOf { it.totalTimeInForeground.coerceIn(0L, 86_400_000L) }.coerceAtMost(86_400_000L) } }.getOrNull() ?: return null
    val selected = potentialPackages(context)
    val observed = FreedAccessibilityService.observedAppGroupUsage(context, selected)
    return (measured.keys + observed.keys).associateWith { maxOf(measured[it] ?: 0L, observed[it] ?: 0L) }
  }

  @Suppress("UNCHECKED_CAST") private fun rule(group: Map<String, Any?>): Map<String, Any?> = group["rule"] as? Map<String, Any?> ?: emptyMap()
  private fun packages(group: Map<String, Any?>): Set<String> = (group["packages"] as? List<*>)?.filterIsInstance<String>()?.toSet().orEmpty()
  private fun iso(ms: Long): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(java.util.Date(ms))
  private fun restore(storage: SharedPreferences, before: Map<String, *>, keys: List<String>) {
    val editor = storage.edit()
    keys.forEach { key -> when (val value = before[key]) { is String -> editor.putString(key, value); is Long -> editor.putLong(key, value); else -> editor.remove(key) } }
    editor.commit()
  }
  private fun encode(value: Map<String, Any?>): String = JSONObject(value).toString()
  @Suppress("UNCHECKED_CAST") private fun decode(raw: String?, maxBytes: Int = 131_072): Map<String, Any?>? = runCatching {
    if (raw == null || raw.length > maxBytes) null else jsonValue(JSONObject(raw), 0) as? Map<String, Any?>
  }.getOrNull()
  private fun jsonValue(value: Any?, depth: Int): Any? {
    if (depth > 8 || value == JSONObject.NULL) return null
    return when (value) {
      is JSONObject -> value.keys().asSequence().associateWith { jsonValue(value.opt(it), depth + 1) }
      is JSONArray -> (0 until value.length()).map { jsonValue(value.opt(it), depth + 1) }
      else -> value
    }
  }
}
