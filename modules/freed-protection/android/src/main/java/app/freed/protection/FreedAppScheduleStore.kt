package app.freed.protection

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal data class FreedAppScheduleSaveResult(val accepted: Boolean, val error: String? = null)

/** Separate from manual daily limits. Invalid input never mutates the last accepted configuration. */
internal object FreedAppScheduleStore {
  const val CONFIGURATION_KEY = "app_schedule_configuration_v1"
  private const val MAX_CONFIGURATION_LENGTH = 16_384
  private val lock = Any()
  private var cachedRaw: String? = null
  private var cachedOwnPackage: String? = null
  private var cachedConfiguration = FreedAppSchedulePolicy.empty
  private fun prefs(context: Context) = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)

  fun read(context: Context): FreedAppScheduleConfiguration = synchronized(lock) {
    val raw = prefs(context).getString(CONFIGURATION_KEY, null)
    if (raw == cachedRaw && context.packageName == cachedOwnPackage) return@synchronized cachedConfiguration
    val configuration = decode(raw, context.packageName) ?: FreedAppSchedulePolicy.empty
    cachedRaw = raw
    cachedOwnPackage = context.packageName
    cachedConfiguration = configuration
    configuration
  }

  // All configuration writes and package grant acceptance share this outer lock.
  // Lock order is always native unlock -> schedule store; read() never takes the native lock.
  fun save(context: Context, input: Map<String, *>): FreedAppScheduleSaveResult = synchronized(FreedNativeUnlockStore.lock) {
    saveUnderNativeLock(context, input)
  }

  private fun saveUnderNativeLock(context: Context, input: Map<String, *>): FreedAppScheduleSaveResult = synchronized(lock) {
    if (FreedProtectionConfiguration.resetInProgress) return@synchronized FreedAppScheduleSaveResult(false, "protection-reset-in-progress")
    if (!FreedProtectionConfiguration.interceptionEnabled(context)) return@synchronized FreedAppScheduleSaveResult(false, "protection-disabled")
    val configuration = FreedAppSchedulePolicy.parse(input, context.packageName, read(context).strictGuard,
      FreedInstalledApplications.eligible(context))
      ?: return@synchronized FreedAppScheduleSaveResult(false, "app-schedule-configuration-invalid")
    val storage = prefs(context)
    val previous = storage.getString(CONFIGURATION_KEY, null)
    val encoded = encode(configuration)
    if (!storage.edit().putString(CONFIGURATION_KEY, encoded).commit()) {
      // commit can update SharedPreferences memory even if disk persistence fails.
      // Roll back only this transaction's key; manual selections/unlock receipts stay untouched.
      val rollback = storage.edit()
      if (previous == null) rollback.remove(CONFIGURATION_KEY) else rollback.putString(CONFIGURATION_KEY, previous)
      rollback.apply()
      cachedRaw = null
      cachedOwnPackage = null
      return@synchronized FreedAppScheduleSaveResult(false, "app-schedule-save-failed")
    }
    cachedRaw = encoded
    cachedOwnPackage = context.packageName
    cachedConfiguration = configuration
    FreedAppScheduleSaveResult(true)
  }

  fun snapshot(context: Context, nowMs: Long = System.currentTimeMillis()): FreedAppScheduleSnapshot =
    FreedAppSchedulePolicy.evaluate(read(context), nowMs)

  private fun encode(configuration: FreedAppScheduleConfiguration): String = JSONObject().apply {
    put("version", 1)
    put("strictGuard", configuration.strictGuard)
    put("schedules", JSONArray().apply {
      configuration.schedules.forEach { schedule ->
        put(JSONObject().apply {
          put("id", schedule.id)
          put("enabled", schedule.enabled)
          put("startMinute", schedule.startMinute)
          put("endMinute", schedule.endMinute)
          put("days", JSONArray(schedule.days.toList()))
          put("packages", JSONArray(schedule.packages.toList()))
          put("allDay", schedule.allDay)
        })
      }
    })
  }.toString()

  private fun decode(raw: String?, ownPackage: String): FreedAppScheduleConfiguration? = try {
    if (raw == null || raw.length > MAX_CONFIGURATION_LENGTH) null else {
      val json = JSONObject(raw)
      val input = json.keys().asSequence().associateWith { key -> jsonValue(json.opt(key), 0) }
      // Persisted configuration was validated on save; retain unavailable targets for honest status.
      val storedPackages = (input["schedules"] as? List<*>)?.flatMap { value ->
        ((value as? Map<*, *>)?.get("packages") as? List<*>)?.filterIsInstance<String>().orEmpty()
      }?.filter(FreedInstalledAppPolicy::validPackage)?.toSet().orEmpty()
      FreedAppSchedulePolicy.parse(input, ownPackage, eligiblePackages = storedPackages)
    }
  } catch (_: Exception) { null }

  private fun jsonValue(value: Any?, depth: Int): Any? {
    if (depth > 4 || value == JSONObject.NULL) return null
    return when (value) {
      is JSONObject -> value.keys().asSequence().associateWith { key -> jsonValue(value.opt(key), depth + 1) }
      is JSONArray -> (0 until value.length()).map { index -> jsonValue(value.opt(index), depth + 1) }
      else -> value
    }
  }
}
