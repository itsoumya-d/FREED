package app.freed.protection

internal object FreedAppGroupAuthorityPolicy {
  private val idPattern = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
  fun authorize(lease: Map<String, Any?>, group: Map<String, Any?>, generation: Long, scopeEpoch: Long,
    resetEpoch: Long, id: String?, source: String, requestedExpiry: Long, now: Long, elapsed: Long, boot: Int): Map<String, Any?>? {
    if (id == null || !idPattern.matches(id) || lease["id"] != id || lease["targetKind"] != "android-app-group" ||
      lease["packageName"] != source || lease["groupId"] != group["id"] || group["enabled"] != true || group["legacy"] == true ||
      (group["packages"] as? List<*>)?.contains(source) != true ||
      FreedAppGroupPolicy.integer(lease["groupRevision"]) != FreedAppGroupPolicy.integer(group["revision"]) ||
      FreedAppGroupPolicy.integer(lease["configurationGeneration"]) != generation ||
      FreedAppGroupPolicy.integer(lease["scopeEpoch"]) != scopeEpoch || FreedAppGroupPolicy.integer(lease["resetEpoch"]) != resetEpoch ||
      FreedAppGroupPolicy.integer(lease["boot"]) != boot.toLong() || boot < 0 || requestedExpiry <= now) return null
    val claimed = FreedAppGroupPolicy.integer(lease["claimedAt"])?.takeIf { it > 0 } ?: return null
    val started = FreedAppGroupPolicy.integer(lease["claimedElapsed"]) ?: return null
    if (now < claimed || elapsed < started) return null
    val previousRequest = FreedAppGroupPolicy.integer(lease["requestedExpiry"])
    val previousGrant = FreedAppGroupPolicy.integer(lease["grantedExpiry"])
    if (previousRequest != null) {
      if (previousRequest != requestedExpiry || previousGrant == null || previousGrant <= now || previousGrant > requestedExpiry ||
        elapsed - started >= previousGrant - claimed) return null
      return mapOf("expiresAtMs" to previousGrant, "firstFulfillment" to false)
    }
    if (now - claimed >= 20 * 60_000L || elapsed - started >= 20 * 60_000L) return null
    return mapOf("expiresAtMs" to minOf(requestedExpiry, now + 120 * 60_000L), "firstFulfillment" to true)
  }
}


/** No caller expiry/duration is accepted. Unknown policy variants fail closed. */
internal object FreedResetAppGroupRewardPolicy {
  private val ids = Regex("^[A-Za-z0-9:_-]{1,160}$")
  private val uuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
  const val LEDGER_KEY = "app_group_reset_rewards_v1"
  const val MAX_RECORDS = 4096
  fun seconds(category: Any?, policy: Any?): Long? = if (FreedAppGroupPolicy.integer(policy) != 1L) null else when(category) {"breathe" -> 120L; "move", "find" -> 300L; else -> null}
  fun valid(request: Map<String, Any?>): Boolean {
    val keys = setOf("version","policyVersion","category","completionSessionId","templateId","templateVersion","nativeInterventionId","groupId","groupRevision","configurationGeneration","scopeEpoch","kind","packageName")
    return request.keys == keys && FreedAppGroupPolicy.integer(request["version"]) == 1L && seconds(request["category"],request["policyVersion"]) != null &&
      listOf("completionSessionId","templateId").all { (request[it] as? String)?.matches(ids) == true } &&
      (request["nativeInterventionId"] as? String)?.matches(uuid) == true && (request["groupId"] as? String)?.matches(Regex("^[A-Za-z0-9_-]{1,64}$")) == true &&
      listOf("templateVersion","groupRevision").all { (FreedAppGroupPolicy.integer(request[it]) ?: 0L) > 0L } &&
      listOf("configurationGeneration","scopeEpoch").all { (FreedAppGroupPolicy.integer(request[it]) ?: -1L) >= 0L } &&
      request["kind"] == "android-app-group" && (request["packageName"] as? String)?.let(FreedInstalledAppPolicy::validPackage) == true
  }
  fun rejected(reason: String, supported: Boolean = true): Map<String, Any?> = mapOf("version" to 1,"policyVersion" to 1,"supported" to supported,"accepted" to false,"reason" to reason,"effective" to false,"replayed" to false)
}
