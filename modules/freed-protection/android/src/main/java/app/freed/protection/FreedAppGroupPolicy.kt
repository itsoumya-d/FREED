package app.freed.protection

import java.util.Calendar
import java.util.TimeZone

internal object FreedAppGroupPolicy {
  const val MAX_GROUPS = 6
  fun integer(value: Any?): Long? = (value as? Number)?.toDouble()?.takeIf {
    it.isFinite() && it >= 0 && it <= 9_007_199_254_740_991.0 && it == it.toLong().toDouble()
  }?.toLong()

  fun validateRule(input: Map<*, *>): Map<String, Any?>? = when (input["kind"]) {
    "before-use" -> if (input.keys == setOf("kind")) mapOf("kind" to "before-use") else null
    "daily-limit" -> integer(input["limitMinutes"])?.takeIf { it in 1..240 && input.keys == setOf("kind", "limitMinutes") }
      ?.let { mapOf("kind" to "daily-limit", "limitMinutes" to it) }
    "scheduled" -> {
      val start = integer(input["startMinute"])
      val end = integer(input["endMinute"])
      val raw = input["days"] as? List<*>
      val days = raw?.map { integer(it)?.toInt() }
      if (input.keys != setOf("kind", "startMinute", "endMinute", "days") || start == null || end == null ||
        start !in 0..1439 || end !in 0..1439 || start == end || days.isNullOrEmpty() || days.size > 7 ||
        days.any { it == null || it !in 0..6 } || days.distinct().size != days.size) null
      else mapOf("kind" to "scheduled", "startMinute" to start, "endMinute" to end, "days" to days)
    }
    else -> null
  }

  fun revisionMatches(request: Map<String, *>, storeRevision: Long, groupRevision: Long?): Boolean =
    integer(request["version"]) == 1L && integer(request["expectedStoreRevision"]) == storeRevision &&
      (groupRevision == null || integer(request["expectedRevision"]) == groupRevision)

  fun scopeChanged(previousDigest: String?, boundToken: String?, incomingToken: String, incomingDigest: String): Boolean =
    previousDigest == null || previousDigest != incomingDigest || (boundToken != null && boundToken != incomingToken)

  @Suppress("UNCHECKED_CAST")
  fun mutate(state: Map<String, Any?>, request: Map<String, Any?>, operation: String, eligible: Set<String>, newId: String): Map<String, Any?>? {
    val revision = integer(state["revision"]) ?: return null
    val generation = integer(state["generation"]) ?: return null
    val groups = ((state["groups"] as? List<*>)?.map { it as? Map<String, Any?> ?: return null } ?: return null).toMutableList()
    if (groups.size > MAX_GROUPS || !revisionMatches(request, revision, null)) return null
    val name = request["name"] as? String
    if (operation != "remove" && (name == null || name.trim().isBlank() || name.length > 80 || name.any(Char::isISOControl))) return null
    if (operation == "create") {
      if (request.keys != setOf("version", "expectedStoreRevision", "name") || groups.size == MAX_GROUPS || groups.any { it["id"] == newId }) return null
      val used = groups.mapNotNull { integer(it["slot"])?.toInt() }.toSet()
      groups.add(mapOf("id" to newId, "slot" to (0 until MAX_GROUPS).first { it !in used }, "revision" to 1L,
        "name" to name!!.trim(), "enabled" to false, "rule" to mapOf("kind" to "daily-limit", "limitMinutes" to 30L),
        "packages" to emptyList<String>(), "legacy" to false, "preferredBreakSeconds" to 300L))
    } else {
      val index = groups.indexOfFirst { it["id"] == request["id"] }
      if (index < 0) return null
      val current = groups[index]
      val groupRevision = integer(current["revision"]) ?: return null
      if (!revisionMatches(request, revision, groupRevision)) return null
      when (operation) {
        "remove" -> {
          if (request.keys != setOf("version", "expectedStoreRevision", "id", "expectedRevision")) return null
          groups.removeAt(index)
        }
        "update" -> {
          if (request.keys != setOf("version", "expectedStoreRevision", "id", "expectedRevision", "name", "enabled", "rule", "packages")) return null
          val enabled = request["enabled"] as? Boolean ?: return null
          val rule = validateRule(request["rule"] as? Map<*, *> ?: return null) ?: return null
          val raw = request["packages"] as? List<*> ?: return null
          if (raw.size > 128) return null
          val packages = raw.map { it as? String ?: return null }
          if (packages.any { it !in eligible } || (enabled && packages.isEmpty())) return null
          groups[index] = current + mapOf("name" to name!!.trim(), "enabled" to enabled, "rule" to rule,
            "packages" to packages.distinct(), "revision" to groupRevision + 1L, "legacy" to false)
        }
        else -> return null
      }
    }
    return mapOf("version" to 1, "revision" to revision + 1L, "generation" to generation + 1L, "groups" to groups)
  }

  fun combinedUsage(packages: Set<String>, usage: Map<String, Long>): Long = packages.fold(0L) { total, id ->
    (total + (usage[id] ?: 0L).coerceIn(0L, 86_400_000L)).coerceAtMost(86_400_000L)
  }

  fun ruleActive(rule: Map<String, *>, nowMs: Long, usageMs: Long, timeZone: TimeZone): Boolean = when (rule["kind"]) {
    "before-use" -> true
    "daily-limit" -> integer(rule["limitMinutes"])?.let { usageMs >= it * 60_000L } ?: false
    "scheduled" -> {
      val calendar = Calendar.getInstance(timeZone).apply { timeInMillis = nowMs }
      val day = calendar.get(Calendar.DAY_OF_WEEK) - Calendar.SUNDAY
      val minute = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
      val start = integer(rule["startMinute"])?.toInt() ?: return false
      val end = integer(rule["endMinute"])?.toInt() ?: return false
      val days = (rule["days"] as? List<*>)?.mapNotNull { integer(it)?.toInt() }?.toSet() ?: return false
      if (start < end) day in days && minute >= start && minute < end
      else (minute >= start && day in days) || (minute < end && (day + 6) % 7 in days)
    }
    else -> false
  }

  fun nextBoundary(rule: Map<String, *>, nowMs: Long): Long? {
    if (rule["kind"] != "scheduled") return null
    val zone = TimeZone.getDefault()
    val active = ruleActive(rule, nowMs, 0L, zone)
    var candidate = nowMs - Math.floorMod(nowMs, 60_000L) + 60_000L
    repeat(8 * 24 * 60) {
      if (ruleActive(rule, candidate, 0L, zone) != active) return candidate
      candidate += 60_000L
    }
    return null
  }
}
