package app.freed.protection

import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** A link or activity intent routes UI; only the matching fresh private publication may open recovery. */
internal object FreedInterventionHandoffPolicy {
  private val id = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
  fun mayOpen(expectedId: String?, pendingId: String?, source: String?, pendingSource: String?, rule: String?,
    pendingRule: String?, detectedAt: String?, intentEpoch: Long, currentEpoch: Long, enabled: Boolean,
    nowMs: Long = System.currentTimeMillis()): Boolean {
    if (!enabled || intentEpoch != currentEpoch || expectedId == null || !id.matches(expectedId) || expectedId != pendingId ||
      source.isNullOrBlank() || source != pendingSource || rule.isNullOrBlank() || rule != pendingRule) return false
    val detected = parseDate(detectedAt) ?: return false
    return detected > 0 && detected <= nowMs + 60_000L && nowMs - detected <= 10 * 60_000L
  }
  private fun parseDate(value: String?): Long? = value?.let { raw ->
    listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'").firstNotNullOfOrNull { format ->
      val parser = SimpleDateFormat(format, Locale.US).apply { isLenient = false; timeZone = TimeZone.getTimeZone("UTC") }
      val position = ParsePosition(0)
      parser.parse(raw, position)?.takeIf { position.index == raw.length }?.time
    }
  }
}
