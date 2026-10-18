package app.freed.protection

import java.util.Calendar
import java.util.TimeZone
import java.util.Locale
import kotlin.math.abs

/** Version two has its own durable state. Never reinterpret or rewrite version-one rewards. */
internal object FreedEarnedAppTimePolicy {
  const val BUDGET_KEY = "app_group_earned_time_budgets_v2"
  const val OFFERS_KEY = "app_group_earned_time_offers_v2"
  const val LEDGER_KEY = "app_group_earned_time_consumption_v2"
  const val BREAKS_KEY = "app_group_earned_time_breaks_v2"
  const val MAX_RECORDS = 4096
  const val MAX_BYTES = 4 * 1024 * 1024
  const val CLAIM_LIFETIME_MS = 20 * 60_000L
  private val caps = setOf(0L, 5L, 10L, 20L, 30L, 60L)
  private val uuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
  private val identifier = Regex("^[A-Za-z0-9:_-]{1,160}$")
  private fun integer(value: Any?) = FreedAppGroupPolicy.integer(value)
  fun validCap(value: Any?): Boolean = integer(value) in caps
  val supportedBreakSeconds = listOf(300L, 600L, 1200L)
  fun seconds(value: Any?): Long? = integer(value)?.takeIf { it in supportedBreakSeconds }
  // A20-minute break uses the same comfortable activity requirement as10 minutes.
  fun requiredActiveSeconds(duration: Long): Long = duration.coerceAtMost(600L) / 5L
  fun requiredSteps(duration: Long): Long = duration.coerceAtMost(600L) / 10L
  fun requiredPhotoTargets(duration: Long): Long = duration.coerceAtMost(600L) / 300L

  fun validOfferRequest(request: Map<String, Any?>): Boolean =
    request.keys == setOf("version", "policyVersion", "nativeInterventionId", "groupId", "groupRevision", "configurationGeneration", "scopeEpoch", "kind", "packageName", "requestedSeconds") &&
      integer(request["version"]) == 2L && integer(request["policyVersion"]) == 2L && seconds(request["requestedSeconds"]) != null &&
      (request["nativeInterventionId"] as? String)?.matches(uuid) == true &&
      (request["groupId"] as? String)?.matches(Regex("^[A-Za-z0-9_-]{1,64}$")) == true &&
      (integer(request["groupRevision"]) ?: 0L) > 0L && listOf("configurationGeneration", "scopeEpoch").all { integer(request[it]) != null } &&
      request["kind"] == "android-app-group" && (request["packageName"] as? String)?.let(FreedInstalledAppPolicy::validPackage) == true

  fun validGrantRequest(request: Map<String, Any?>): Boolean {
    if (request.keys != setOf("version", "policyVersion", "offerId", "completionSessionId", "category", "templateId", "templateVersion", "evidence") ||
      integer(request["version"]) != 2L || integer(request["policyVersion"]) != 2L ||
      (request["offerId"] as? String)?.matches(uuid) != true ||
      listOf("completionSessionId", "templateId").any { (request[it] as? String)?.matches(identifier) != true } ||
      (integer(request["templateVersion"]) ?: 0L) < 1L) return false
    val evidence = request["evidence"] as? Map<*, *> ?: return false
    val legacyFields = setOf("method", "activeDurationSec", "observedSteps", "photoProofIds")
    if ((evidence.keys != legacyFields && (evidence["method"] != "steps" || evidence.keys != legacyFields + "stepProofId" || !FreedEarnedChallengeProofPolicy.validId(evidence["stepProofId"]))) ||
      integer(evidence["activeDurationSec"]) == null || integer(evidence["observedSteps"]) == null) return false
    val proofs = evidence["photoProofIds"] as? List<*> ?: return false
    if (proofs.size > 2 || proofs.any { (it as? String)?.matches(identifier) != true } || proofs.distinct().size != proofs.size) return false
    return when (request["category"]) {
      "breathe" -> evidence["method"] == "timer" && proofs.isEmpty() && integer(evidence["observedSteps"]) == 0L
      "move" -> evidence["method"] in setOf("timer", "steps") && proofs.isEmpty() && (evidence["method"] == "steps" || integer(evidence["observedSteps"]) == 0L)
      "find" -> evidence["method"] == "photo" && integer(evidence["observedSteps"]) == 0L
      else -> false
    }
  }

  fun evidenceFailure(request: Map<String, Any?>, duration: Long): String? {
    if (!validGrantRequest(request) || seconds(duration) == null) return "earned-time-request-invalid"
    val evidence = request["evidence"] as Map<*, *>
    if (request["category"] == "find") {
      if (integer(request["templateVersion"]) != 2L || FreedEarnedChallengeProofPolicy.targets(request["templateId"] as String, duration) == null) return "earned-time-template-invalid"
      return if ((evidence["photoProofIds"] as List<*>).size != requiredPhotoTargets(duration).toInt()) "earned-time-evidence-incomplete" else null
    }
    val template = request["templateId"] as String
    val suffix = ":earned-v2:$duration"
    if (integer(request["templateVersion"]) != 2L || !template.endsWith(suffix)) return "earned-time-template-invalid"
    val base = template.removeSuffix(suffix)
    val validTemplate = when (request["category"]) {
      "breathe" -> evidence["method"] == "timer" && base in setOf("momentum-breathe-soft", "momentum-breathe-exhale")
      "move" -> if (evidence["method"] == "steps") base == "momentum-move-steps" else base in setOf("momentum-move-seated", "momentum-move-stretch")
      else -> false
    }
    if (!validTemplate) return "earned-time-template-invalid"
    return if (evidence["method"] == "steps") {
      if (integer(evidence["observedSteps"])!! < requiredSteps(duration)) "earned-time-evidence-incomplete" else null
    } else if (integer(evidence["activeDurationSec"])!! < requiredActiveSeconds(duration)) "earned-time-evidence-incomplete" else null
  }

  /** Recursive numeric normalization makes exact JS/JSON replay stable without relaxing field equality. */
  fun exact(left: Any?, right: Any?): Boolean = when {
    left is Number || right is Number -> integer(left) != null && integer(left) == integer(right)
    left is Map<*, *> && right is Map<*, *> -> left.keys == right.keys && left.keys.all { exact(left[it], right[it]) }
    left is List<*> && right is List<*> -> left.size == right.size && left.indices.all { exact(left[it], right[it]) }
    else -> left == right
  }

  private fun boundary(now: Long, zone: TimeZone): Pair<String, Long> {
    val calendar = Calendar.getInstance(zone).apply { timeInMillis = now }
    val key = String.format(Locale.US, "%04d-%02d-%02d:%s", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1, calendar.get(Calendar.DAY_OF_MONTH), zone.id)
    calendar.set(Calendar.HOUR_OF_DAY, 0); calendar.set(Calendar.MINUTE, 0); calendar.set(Calendar.SECOND, 0); calendar.set(Calendar.MILLISECOND, 0)
    calendar.add(Calendar.DAY_OF_MONTH, 1)
    return key to calendar.timeInMillis
  }

  fun newBudget(owner: String, group: String, now: Long, elapsed: Long, boot: Int): Map<String, Any?>? {
    if (now <= 0 || elapsed < 0 || boot < 0) return null
    val zone = TimeZone.getDefault()
    val (day, next) = boundary(now, zone)
    return mapOf("ownerDigest" to owner, "groupId" to group, "configuredCapMinutes" to 20L, "effectiveCapMinutes" to 20L,
      "spentSeconds" to 0L, "dayKey" to day, "nextResetMs" to next, "zoneId" to zone.id, "pendingCapMinutes" to null,
      "pendingEffectiveMs" to null, "revision" to 0L, "anchorWall" to now, "anchorElapsed" to elapsed, "anchorDayWall" to now,
      "boot" to boot.toLong(), "previousDays" to emptyList<Map<String, Any?>>())
  }

  fun validBudget(budget: Map<String, Any?>): Boolean {
    if (budget.keys != setOf("ownerDigest", "groupId", "configuredCapMinutes", "effectiveCapMinutes", "spentSeconds", "dayKey", "nextResetMs", "zoneId", "pendingCapMinutes", "pendingEffectiveMs", "revision", "anchorWall", "anchorElapsed", "anchorDayWall", "boot", "previousDays") ||
      listOf("ownerDigest", "groupId", "dayKey", "zoneId").any { (budget[it] as? String).isNullOrBlank() } ||
      listOf("spentSeconds", "revision", "anchorElapsed", "boot").any { integer(budget[it]) == null } ||
      listOf("nextResetMs", "anchorWall", "anchorDayWall").any { (integer(budget[it]) ?: 0L) == 0L } ||
      !validCap(budget["configuredCapMinutes"]) || !validCap(budget["effectiveCapMinutes"]) || integer(budget["spentSeconds"])!! > 3600L ||
      integer(budget["nextResetMs"])!! <= integer(budget["anchorDayWall"])!! ||
      budget["zoneId"] !in TimeZone.getAvailableIDs().toSet()) return false
    val pending = budget["pendingCapMinutes"]
    if (pending == null) {
      if (budget["pendingEffectiveMs"] != null || integer(budget["configuredCapMinutes"]) != integer(budget["effectiveCapMinutes"])) return false
    } else if (!validCap(pending) || integer(pending)!! <= integer(budget["effectiveCapMinutes"])!! ||
      integer(pending) != integer(budget["configuredCapMinutes"]) || integer(budget["pendingEffectiveMs"]) != integer(budget["nextResetMs"])) return false
    val history = budget["previousDays"] as? List<*> ?: return false
    if (history.size > MAX_RECORDS) return false
    val days = mutableSetOf<String>()
    return history.all { raw ->
      val row = raw as? Map<*, *> ?: return@all false
      val day = row["dayKey"] as? String ?: return@all false
      row.keys == setOf("dayKey", "spentSeconds", "closedAtMs") && day != budget["dayKey"] && days.add(day) &&
        integer(row["spentSeconds"])?.let { it <= 3600L } == true &&
        integer(row["closedAtMs"])?.let { it > 0L && it <= integer(budget["anchorDayWall"])!! } == true
    }
  }

  fun clockVerified(budget: Map<String, Any?>, now: Long, elapsed: Long, boot: Int): Boolean {
    if (!validBudget(budget) || boot < 0 || integer(budget["boot"]) != boot.toLong()) return false
    val wall = integer(budget["anchorWall"])!!; val monotonic = integer(budget["anchorElapsed"])!!
    if (now < wall || elapsed < monotonic) return false
    return abs((now - wall) - (elapsed - monotonic)) <= 5_000L
  }

  /** The day clock advances monotonically from the last trusted/native anchor, independently of wall-clock edits. */
  fun advanceBudget(budget: Map<String, Any?>, now: Long, elapsed: Long, boot: Int): Map<String, Any?>? {
    if (!clockVerified(budget, now, elapsed, boot)) return null
    val dayNow = integer(budget["anchorDayWall"])!! + elapsed - integer(budget["anchorElapsed"])!!
    if (dayNow < integer(budget["nextResetMs"])!!) return budget
    return rollover(budget, dayNow, now, elapsed, boot)
  }

  private fun rollover(budget: Map<String, Any?>, dayNow: Long, now: Long, elapsed: Long, boot: Int): Map<String, Any?>? {
    val history = budget["previousDays"] as List<*>
    if (history.size >= MAX_RECORDS) return null
    val (day, next) = boundary(dayNow, TimeZone.getTimeZone(budget["zoneId"] as String))
    if (day == budget["dayKey"] || history.any { (it as? Map<*, *>)?.get("dayKey") == day }) return null
    val cap = budget["pendingCapMinutes"] ?: budget["effectiveCapMinutes"]
    return budget + mapOf("dayKey" to day, "nextResetMs" to next, "spentSeconds" to 0L,
      "effectiveCapMinutes" to cap, "pendingCapMinutes" to null, "pendingEffectiveMs" to null,
      "revision" to integer(budget["revision"])!! + 1L, "anchorWall" to now, "anchorElapsed" to elapsed, "anchorDayWall" to dayNow, "boot" to boot.toLong(),
      "previousDays" to history + mapOf("dayKey" to budget["dayKey"], "spentSeconds" to budget["spentSeconds"], "closedAtMs" to budget["nextResetMs"]))
  }

  /** A native HTTPS proof can repair a reboot/discontinuity, never reset same-day spend or move backward. */
  fun recoverBudget(budget: Map<String, Any?>, proof: FreedEarnedTimeClock.Proof, now: Long, elapsed: Long, boot: Int): Map<String, Any?>? {
    if (!validBudget(budget) || boot < 0 || elapsed < proof.receivedElapsedMs || elapsed - proof.receivedElapsedMs > 10_000L ||
      now < proof.receivedWallMs || abs((now - proof.receivedWallMs) - (elapsed - proof.receivedElapsedMs)) > 5_000L ||
      abs(proof.receivedWallMs - proof.serverTimeMs) > 120_000L) return null
    val dayNow = proof.serverTimeMs + elapsed - proof.receivedElapsedMs
    if (dayNow < integer(budget["anchorDayWall"])!!) return null
    if (dayNow >= integer(budget["nextResetMs"])!!) return rollover(budget, dayNow, now, elapsed, boot)
    return budget + mapOf("anchorWall" to now, "anchorElapsed" to elapsed, "anchorDayWall" to dayNow,
      "boot" to boot.toLong(), "revision" to integer(budget["revision"])!! + 1L)
  }

  fun changeCap(budget: Map<String, Any?>, minutes: Long): Map<String, Any?>? {
    if (!validBudget(budget) || minutes !in caps) return null
    if (integer(budget["configuredCapMinutes"]) == minutes) return budget
    val increase = minutes > integer(budget["effectiveCapMinutes"])!!
    return budget + mapOf("configuredCapMinutes" to minutes,
      "effectiveCapMinutes" to if (increase) budget["effectiveCapMinutes"] else minutes,
      "pendingCapMinutes" to minutes.takeIf { increase }, "pendingEffectiveMs" to budget["nextResetMs"].takeIf { increase },
      "revision" to integer(budget["revision"])!! + 1L)
  }

  fun remaining(budget: Map<String, Any?>): Long = (integer(budget["effectiveCapMinutes"])!! * 60L - integer(budget["spentSeconds"])!!).coerceAtLeast(0L)
  fun spend(budget: Map<String, Any?>, duration: Long): Map<String, Any?>? =
    if (!validBudget(budget) || seconds(duration) == null || remaining(budget) < duration) null
    else budget + mapOf("spentSeconds" to integer(budget["spentSeconds"])!! + duration, "revision" to integer(budget["revision"])!! + 1L)

  fun iso(ms: Long): String = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(java.util.Date(ms))
  fun view(budget: Map<String, Any?>, verified: Boolean): Map<String, Any?> = mapOf("version" to 2, "configuredCapMinutes" to integer(budget["configuredCapMinutes"]),
    "effectiveCapMinutes" to integer(budget["effectiveCapMinutes"]), "spentSeconds" to integer(budget["spentSeconds"]), "remainingSeconds" to remaining(budget),
    "dayKey" to budget["dayKey"], "nextResetAt" to iso(integer(budget["nextResetMs"])!!), "pendingCapMinutes" to integer(budget["pendingCapMinutes"]),
    "pendingEffectiveAt" to integer(budget["pendingEffectiveMs"])?.let(::iso), "revision" to integer(budget["revision"]), "clockState" to if (verified) "verified" else "unverified")

  fun rejectedOffer(reason: String, supported: Boolean = true, budget: Map<String, Any?>? = null): Map<String, Any?> =
    mapOf("version" to 2, "policyVersion" to 2, "supported" to supported, "accepted" to false, "reason" to reason, "offer" to null, "budget" to budget)
  fun rejectedGrant(reason: String, supported: Boolean = true, budget: Map<String, Any?>? = null): Map<String, Any?> =
    mapOf("version" to 2, "policyVersion" to 2, "supported" to supported, "accepted" to false, "reason" to reason, "offerId" to null,
      "completionSessionId" to null, "groupId" to null, "nativeInterventionId" to null, "seconds" to null,
      "expiresAt" to null, "effective" to false, "remainingRestrictionCount" to null, "replayed" to false, "budget" to budget)
}
