package app.freed.protection

internal data class FreedNativeUnlockLease(
  val interventionId: String, val packageName: String, val ruleId: String?,
  val claimedAtMs: Long, val claimedElapsedMs: Long, val bootCount: Int,
  val fulfilledRequestExpiryMs: Long? = null, val grantedExpiryMs: Long? = null
)
internal data class FreedNativeUnlockDecision(val expiresAtMs: Long, val firstFulfillment: Boolean)

/** UI consumes an event before a bounded challenge. Only that claimed target can fulfill once. */
internal object FreedNativeUnlockPolicy {
  const val CLAIM_TTL_MS = 20 * 60_000L // Fifteen-minute custom challenge plus delivery/pause allowance.
  private const val MAX_UNLOCK_MS = 120 * 60_000L
  private val idPattern = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
  private val rulePattern = Regex("^[a-zA-Z0-9_.-]{6,128}$")

  fun claim(id: String, source: String, matchedRule: String, surfaceRuleId: String?, detectedAtMs: Long,
    nowMs: Long, elapsedMs: Long, bootCount: Int): FreedNativeUnlockLease? {
    if (!idPattern.matches(id) || source !in FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES ||
      detectedAtMs <= 0 || detectedAtMs > nowMs + 60_000 || nowMs - detectedAtMs > 600_000 ||
      nowMs <= 0 || elapsedMs < 0 || bootCount < 0) return null
    val ruleId = when {
      matchedRule.startsWith("configured-app:") -> {
        if (matchedRule.removePrefix("configured-app:") != source || surfaceRuleId != null) return null
        null
      }
      matchedRule.startsWith("short-form:") -> {
        val expected = FreedDoomscrollApps.packageForShortFormRule(matchedRule) ?: return null
        val equivalent = source == expected || (expected == FreedDoomscrollApps.TIKTOK_PRIMARY_PACKAGE && source in FreedDoomscrollApps.TIKTOK_PACKAGES)
        if (!equivalent || surfaceRuleId != null) return null
        null
      }
      matchedRule.startsWith("focus-shield:") -> {
        val encoded = matchedRule.removePrefix("focus-shield:")
        if (!rulePattern.matches(encoded) || encoded != surfaceRuleId) return null
        encoded
      }
      else -> return null
    }
    return FreedNativeUnlockLease(id, source, ruleId, nowMs, elapsedMs, bootCount)
  }

  fun authorize(lease: FreedNativeUnlockLease?, id: String?, source: String, ruleId: String?, requestedExpiryMs: Long,
    nowMs: Long, elapsedMs: Long, bootCount: Int): FreedNativeUnlockDecision? {
    if (lease == null || !idPattern.matches(lease.interventionId) || lease.packageName !in FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES ||
      lease.claimedAtMs <= 0 || lease.claimedElapsedMs < 0 || (lease.ruleId != null && !rulePattern.matches(lease.ruleId)) ||
      id != lease.interventionId || source != lease.packageName || ruleId != lease.ruleId ||
      bootCount != lease.bootCount || bootCount < 0 || nowMs < lease.claimedAtMs || elapsedMs < lease.claimedElapsedMs ||
      requestedExpiryMs <= nowMs) return null
    if (lease.fulfilledRequestExpiryMs != null) {
      val granted = lease.grantedExpiryMs ?: return null
      return if (requestedExpiryMs == lease.fulfilledRequestExpiryMs && granted > nowMs && granted <= requestedExpiryMs)
        FreedNativeUnlockDecision(granted, false) else null
    }
    if (nowMs - lease.claimedAtMs >= CLAIM_TTL_MS || elapsedMs - lease.claimedElapsedMs >= CLAIM_TTL_MS) return null
    return FreedNativeUnlockDecision(minOf(requestedExpiryMs, nowMs + MAX_UNLOCK_MS), true)
  }
}
