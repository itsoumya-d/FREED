package app.freed.protection

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Separate optional v1 proof schema: missing key is empty, never alters legacy leases or budgets. */
internal object FreedEarnedChallengeProofStore {
  private fun prefs(context: Context) = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
  fun rows(context: Context): List<Map<String, Any?>>? = synchronized(FreedNativeUnlockStore.lock) {
    val storage = prefs(context)
    if (!storage.contains(FreedEarnedChallengeProofPolicy.KEY)) return@synchronized emptyList()
    val raw = storage.getString(FreedEarnedChallengeProofPolicy.KEY, null) ?: return@synchronized null
    if (raw.length > FreedEarnedChallengeProofPolicy.MAX_BYTES) return@synchronized null
    runCatching {
      val value = decode(JSONObject(raw), 0) as? Map<*, *> ?: return@runCatching null
      if (value.keys != setOf("version", "records") || FreedEarnedChallengeProofPolicy.integer(value["version"]) != 1L) return@runCatching null
      val records = (value["records"] as? List<*>)?.map { @Suppress("UNCHECKED_CAST") (it as? Map<String, Any?>) ?: return@runCatching null } ?: return@runCatching null
      records.takeIf { it.size <= FreedEarnedChallengeProofPolicy.MAX_RECORDS && it.all(FreedEarnedChallengeProofPolicy::validRecord) && it.map { row -> row["proofId"] }.distinct().size == it.size }
    }.getOrNull()
  }
  fun encoded(rows: List<Map<String, Any?>>): String? = json(mapOf("version" to 1L, "records" to rows)).toString()
    .takeIf { rows.size <= FreedEarnedChallengeProofPolicy.MAX_RECORDS && it.length <= FreedEarnedChallengeProofPolicy.MAX_BYTES }
  fun save(context: Context, additions: List<Map<String, Any?>>, current: () -> Boolean): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    if (!current() || additions.any { !FreedEarnedChallengeProofPolicy.validRecord(it) }) return@synchronized false
    val previous = rows(context) ?: return@synchronized false
    if (additions.any { added -> previous.any { it["proofId"] == added["proofId"] || (added["captureDigest"] != null && it["captureDigest"] == added["captureDigest"]) } }) return@synchronized false
    val next = encoded(previous + additions) ?: return@synchronized false
    val storage = prefs(context); val before = storage.getString(FreedEarnedChallengeProofPolicy.KEY, null)
    FreedAppGroupTransaction.publish({ storage.edit().putString(FreedEarnedChallengeProofPolicy.KEY, next).commit() },
      { storage.getString(FreedEarnedChallengeProofPolicy.KEY, null) == next }, current,
      { storage.edit().apply { if (before == null) remove(FreedEarnedChallengeProofPolicy.KEY) else putString(FreedEarnedChallengeProofPolicy.KEY, before) }.commit() })
  }
  /** Cancellation revokes only unspent proof rows. Committed grant receipts/budgets are untouched. */
  fun revokeSession(context: Context, sessionId: String, ownerDigest: String, current: () -> Boolean): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val previous = rows(context) ?: return@synchronized false
    val retained = previous.filterNot { it["evidenceSessionId"] == sessionId && it["ownerDigest"] == ownerDigest && it["consumedBy"] == null }
    if (retained.size == previous.size) return@synchronized true
    val next = encoded(retained) ?: return@synchronized false
    val storage = prefs(context); val before = storage.getString(FreedEarnedChallengeProofPolicy.KEY, null)
    FreedAppGroupTransaction.publish({ storage.edit().putString(FreedEarnedChallengeProofPolicy.KEY, next).commit() },
      { storage.getString(FreedEarnedChallengeProofPolicy.KEY, null) == next }, current,
      { storage.edit().apply { if (before == null) remove(FreedEarnedChallengeProofPolicy.KEY) else putString(FreedEarnedChallengeProofPolicy.KEY, before) }.commit() })
  }
  private fun json(value: Any?): Any = when (value) {
    null -> JSONObject.NULL
    is Map<*, *> -> JSONObject().apply { value.forEach { (key, item) -> put(key as String, json(item)) } }
    is List<*> -> JSONArray().apply { value.forEach { put(json(it)) } }
    else -> value
  }
  private fun decode(value: Any?, depth: Int): Any? {
    if (depth > 10) error("Proof metadata nesting exceeds bound")
    return when (value) {
      null, JSONObject.NULL -> null
      is JSONObject -> value.keys().asSequence().associateWith { decode(value.get(it), depth + 1) }
      is JSONArray -> (0 until value.length()).map { decode(value.get(it), depth + 1) }
      is String, is Number, is Boolean -> value
      else -> error("Invalid proof metadata")
    }
  }
}
