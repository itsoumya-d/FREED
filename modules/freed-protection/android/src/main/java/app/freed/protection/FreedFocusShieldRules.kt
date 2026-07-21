package app.freed.protection

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal data class FreedFocusShieldSelector(
  val packageName: String,
  val viewId: String?,
  val role: String?,
  val ancestorRoles: List<String>,
  val normalizedBounds: FreedFocusShieldBounds?
)

internal data class FreedFocusShieldBounds(
  val x: Double,
  val y: Double,
  val width: Double,
  val height: Double
)

internal data class FreedFocusShieldRule(
  val version: Int,
  val id: String,
  val packageName: String,
  val displayLabel: String,
  val kind: String,
  val presetId: String?,
  val enabled: Boolean,
  val selector: FreedFocusShieldSelector
) {
  fun toPayload(): Map<String, Any> {
    val selectorPayload = mutableMapOf<String, Any>("packageName" to selector.packageName)
    selector.viewId?.let { selectorPayload["viewId"] = it }
    selector.role?.let { selectorPayload["role"] = it }
    if (selector.ancestorRoles.isNotEmpty()) selectorPayload["ancestorRoles"] = selector.ancestorRoles
    selector.normalizedBounds?.let { bounds ->
      selectorPayload["normalizedBounds"] = mapOf(
        "x" to bounds.x,
        "y" to bounds.y,
        "width" to bounds.width,
        "height" to bounds.height
      )
    }

    return mutableMapOf<String, Any>(
      "version" to version,
      "id" to id,
      "packageName" to packageName,
      "displayLabel" to displayLabel,
      "kind" to kind,
      "enabled" to enabled,
      "selector" to selectorPayload
    ).apply {
      presetId?.let { put("presetId", it) }
    }
  }
}

internal data class FreedFocusShieldRuleSnapshot(
  val rules: List<FreedFocusShieldRule>,
  val health: String
) {
  val enabledCount: Int
    get() = rules.count { it.enabled }
}

internal object FreedFocusShieldRules {
  const val FOCUS_SHIELD_RULES = "focus_shield_rules_v1"
  const val FOCUS_SHIELD_UNLOCK_EXPIRES_AT = "focus_shield_unlock_expires_at"
  const val FOCUS_SHIELD_UNLOCK_RULE_ID = "focus_shield_unlock_rule_id"
  const val FOCUS_SHIELD_UNLOCK_PACKAGE = "focus_shield_unlock_package"

  private const val CONTRACT_VERSION = 1
  private const val MAX_RULES = 64
  private const val MAX_UNLOCK_MINUTES = 120
  private const val YOUTUBE_PRESET = "youtube-shorts"
  private const val INSTAGRAM_PRESET = "instagram-reels"
  private const val TIKTOK_PRESET = "tiktok-for-you"

  private data class Preset(
    val id: String,
    val displayName: String,
    val packageName: String,
    val legacyRule: String,
    val viewId: String,
    val role: String,
    val ancestorRoles: List<String>
  )

  private val presets = listOf(
    Preset(
      id = YOUTUBE_PRESET,
      displayName = "YouTube Shorts",
      packageName = FreedDoomscrollApps.YOUTUBE_PACKAGE,
      legacyRule = FreedDoomscrollApps.YOUTUBE_SHORTS_RULE,
      viewId = "com.google.android.youtube:id/reel_player",
      role = "android.view.View",
      ancestorRoles = listOf("android.widget.FrameLayout")
    ),
    Preset(
      id = INSTAGRAM_PRESET,
      displayName = "Instagram Reels",
      packageName = FreedDoomscrollApps.INSTAGRAM_PACKAGE,
      legacyRule = FreedDoomscrollApps.INSTAGRAM_REELS_RULE,
      viewId = "com.instagram.android:id/clips_viewer",
      role = "android.view.View",
      ancestorRoles = listOf("android.widget.FrameLayout")
    ),
    Preset(
      id = TIKTOK_PRESET,
      displayName = "TikTok For You",
      packageName = FreedDoomscrollApps.TIKTOK_PRIMARY_PACKAGE,
      legacyRule = FreedDoomscrollApps.TIKTOK_FEED_RULE,
      viewId = "com.zhiliaoapp.musically:id/pager",
      role = "androidx.viewpager.widget.ViewPager",
      ancestorRoles = listOf("android.widget.FrameLayout")
    )
  )

  private val presetById = presets.associateBy { it.id }
  private val allowedViewIds = presets.associate { it.packageName to setOf(it.viewId) }

  fun configure(context: Context, value: Map<String, Any?>): FreedFocusShieldRule? {
    val rule = sanitizeRule(value) ?: return null
    val current = snapshot(context).rules
      .filterNot { it.id == rule.id }
      .take(MAX_RULES - 1)
      .plus(rule)
      .sortedBy { it.id }
    write(context, current)
    if (!rule.enabled) clearSurfaceUnlockIfRule(context, rule.id)
    return rule
  }

  fun list(context: Context): List<FreedFocusShieldRule> = snapshot(context).rules

  fun remove(context: Context, rawRuleId: String): Boolean {
    val ruleId = sanitizeRuleId(rawRuleId) ?: return false
    val existing = snapshot(context).rules
    val remaining = existing.filterNot { it.id == ruleId }
    if (remaining.size == existing.size) return false
    write(context, remaining)
    clearSurfaceUnlockIfRule(context, ruleId)
    return true
  }

  fun snapshot(context: Context): FreedFocusShieldRuleSnapshot {
    val raw = prefs(context).getString(FOCUS_SHIELD_RULES, null)?.trim().orEmpty()
    if (raw.isBlank()) return FreedFocusShieldRuleSnapshot(emptyList(), "empty")

    return try {
      val array = JSONArray(raw)
      var rejected = 0
      val rules = buildList<FreedFocusShieldRule> {
        for (index in 0 until array.length()) {
          val item = array.optJSONObject(index)
          val rule = item?.let { sanitizeRule(jsonObjectToMap(it)) }
          if (rule == null) {
            rejected += 1
          } else if (none { existing -> existing.id == rule.id }) {
            add(rule)
          } else {
            rejected += 1
          }
        }
      }.sortedBy { it.id }.take(MAX_RULES)
      FreedFocusShieldRuleSnapshot(
        rules = rules,
        health = if (rejected == 0 && array.length() <= MAX_RULES) "ready" else "degraded"
      )
    } catch (_: Exception) {
      FreedFocusShieldRuleSnapshot(emptyList(), "degraded")
    }
  }

  fun hasEnabledPresetRulesForPackage(context: Context, packageName: String): Boolean {
    val normalizedPackage = sanitizePackageName(packageName) ?: return false
    return snapshot(context).rules.any { rule ->
      rule.enabled && rule.kind == "preset" && rule.packageName == normalizedPackage
    }
  }

  fun matchingPresetRules(context: Context, packageName: String, legacyRule: String): List<FreedFocusShieldRule> {
    val normalizedPackage = sanitizePackageName(packageName) ?: return emptyList()
    return snapshot(context).rules.filter { rule ->
      if (!rule.enabled || rule.kind != "preset" || rule.packageName != normalizedPackage) return@filter false
      val preset = rule.presetId?.let(presetById::get) ?: return@filter false
      preset.legacyRule == legacyRule
    }
  }

  fun applySurfaceUnlock(
    context: Context,
    expiresAt: String,
    ruleId: String,
    packageName: String
  ): String? {
    val normalizedRuleId = sanitizeRuleId(ruleId) ?: return null
    val normalizedPackage = sanitizePackageName(packageName) ?: return null
    val rule = snapshot(context).rules.firstOrNull { stored ->
      stored.enabled && stored.id == normalizedRuleId && stored.packageName == normalizedPackage
    } ?: return null
    val nowMs = System.currentTimeMillis()
    val requestedExpiryMs = parseIsoMillis(expiresAt) ?: return null
    if (requestedExpiryMs <= nowMs) return null

    val boundedExpiryMs = minOf(requestedExpiryMs, nowMs + MAX_UNLOCK_MINUTES * 60_000L)
    val boundedExpiresAt = formatIsoMillis(boundedExpiryMs)
    prefs(context).edit()
      .putString(FOCUS_SHIELD_UNLOCK_EXPIRES_AT, boundedExpiresAt)
      .putString(FOCUS_SHIELD_UNLOCK_RULE_ID, rule.id)
      .putString(FOCUS_SHIELD_UNLOCK_PACKAGE, rule.packageName)
      .apply()
    return boundedExpiresAt
  }

  fun isSurfaceUnlockActiveForRule(context: Context, rule: FreedFocusShieldRule): Boolean {
    val preferences = prefs(context)
    val storedRuleId = preferences.getString(FOCUS_SHIELD_UNLOCK_RULE_ID, null)
    val storedPackage = preferences.getString(FOCUS_SHIELD_UNLOCK_PACKAGE, null)
      ?.lowercase(Locale.US)
    val expiryMs = preferences.getString(FOCUS_SHIELD_UNLOCK_EXPIRES_AT, null)
      ?.let(::parseIsoMillis)

    if (storedRuleId == rule.id && storedPackage == rule.packageName && expiryMs != null && expiryMs > System.currentTimeMillis()) {
      return true
    }
    if (expiryMs == null || expiryMs <= System.currentTimeMillis()) clearSurfaceUnlock(context)
    return false
  }

  fun activeSurfaceUnlockExpiresAt(context: Context): String? {
    val preferences = prefs(context)
    val ruleId = preferences.getString(FOCUS_SHIELD_UNLOCK_RULE_ID, null) ?: return null
    val packageName = preferences.getString(FOCUS_SHIELD_UNLOCK_PACKAGE, null) ?: return null
    val rule = snapshot(context).rules.firstOrNull { it.enabled && it.id == ruleId && it.packageName == packageName }
    if (rule == null) {
      clearSurfaceUnlock(context)
      return null
    }
    if (!isSurfaceUnlockActiveForRule(context, rule)) return null
    return preferences.getString(FOCUS_SHIELD_UNLOCK_EXPIRES_AT, null)
  }

  fun activeSurfaceUnlockRuleId(context: Context): String? {
    if (activeSurfaceUnlockExpiresAt(context) == null) return null
    return prefs(context).getString(FOCUS_SHIELD_UNLOCK_RULE_ID, null)
  }

  fun activeSurfaceUnlockPackage(context: Context): String? {
    if (activeSurfaceUnlockExpiresAt(context) == null) return null
    return prefs(context).getString(FOCUS_SHIELD_UNLOCK_PACKAGE, null)
  }

  fun clearSurfaceUnlock(context: Context) {
    prefs(context).edit()
      .remove(FOCUS_SHIELD_UNLOCK_EXPIRES_AT)
      .remove(FOCUS_SHIELD_UNLOCK_RULE_ID)
      .remove(FOCUS_SHIELD_UNLOCK_PACKAGE)
      .apply()
  }

  private fun clearSurfaceUnlockIfRule(context: Context, ruleId: String) {
    if (prefs(context).getString(FOCUS_SHIELD_UNLOCK_RULE_ID, null) == ruleId) clearSurfaceUnlock(context)
  }

  private fun sanitizeRule(value: Map<String, Any?>): FreedFocusShieldRule? {
    val version = (value["version"] as? Number)?.toInt()?.takeIf { it == CONTRACT_VERSION } ?: return null
    val id = sanitizeRuleId(value["id"] as? String) ?: return null
    val kind = (value["kind"] as? String)?.takeIf { it == "preset" || it == "custom" } ?: return null
    val packageName = sanitizePackageName(value["packageName"] as? String) ?: return null
    val displayLabel = sanitizeLabel(value["displayLabel"] as? String) ?: return null
    val enabled = value["enabled"] as? Boolean ?: return null

    if (kind == "preset") {
      val preset = (value["presetId"] as? String)?.let(presetById::get) ?: return null
      if (preset.packageName != packageName) return null
      return FreedFocusShieldRule(
        version = version,
        id = id,
        packageName = packageName,
        displayLabel = displayLabel,
        kind = kind,
        presetId = preset.id,
        enabled = enabled,
        selector = presetSelector(preset)
      )
    }

    val selectorValue = value["selector"] as? Map<*, *> ?: return null
    val selectorPackage = sanitizePackageName(selectorValue["packageName"] as? String) ?: return null
    if (selectorPackage != packageName) return null
    val viewId = sanitizeIdentifier(selectorValue["viewId"] as? String, 180, VIEW_ID_CHARACTERS)
    if (viewId != null && allowedViewIds[packageName].orEmpty().contains(viewId).not()) return null
    val role = sanitizeIdentifier(selectorValue["role"] as? String, 180, ROLE_CHARACTERS)
    val ancestorRoles = (selectorValue["ancestorRoles"] as? List<*>)
      .orEmpty()
      .mapNotNull { sanitizeIdentifier(it as? String, 180, ROLE_CHARACTERS) }
      .distinct()
      .take(8)
    if (viewId == null && role == null && ancestorRoles.isEmpty()) return null

    return FreedFocusShieldRule(
      version = version,
      id = id,
      packageName = packageName,
      displayLabel = displayLabel,
      kind = kind,
      presetId = null,
      enabled = enabled,
      selector = FreedFocusShieldSelector(
        packageName = packageName,
        viewId = viewId,
        role = role,
        ancestorRoles = ancestorRoles,
        normalizedBounds = sanitizeBounds(selectorValue["normalizedBounds"])
      )
    )
  }

  private fun presetSelector(preset: Preset): FreedFocusShieldSelector {
    return FreedFocusShieldSelector(
      packageName = preset.packageName,
      viewId = preset.viewId,
      role = preset.role,
      ancestorRoles = preset.ancestorRoles,
      normalizedBounds = null
    )
  }

  private fun sanitizeBounds(value: Any?): FreedFocusShieldBounds? {
    val bounds = value as? Map<*, *> ?: return null
    val x = (bounds["x"] as? Number)?.toDouble() ?: return null
    val y = (bounds["y"] as? Number)?.toDouble() ?: return null
    val width = (bounds["width"] as? Number)?.toDouble() ?: return null
    val height = (bounds["height"] as? Number)?.toDouble() ?: return null
    if (!x.isFinite() || !y.isFinite() || !width.isFinite() || !height.isFinite()) return null
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) return null
    return FreedFocusShieldBounds(x, y, width, height)
  }

  private fun sanitizeRuleId(value: String?): String? {
    return sanitizeIdentifier(value, 128, BASIC_IDENTIFIER_CHARACTERS)?.takeIf { it.length >= 6 }
  }

  private fun sanitizePackageName(value: String?): String? {
    val normalized = value?.trim()?.lowercase(Locale.US).orEmpty()
    return normalized.takeIf { it.matches(Regex("^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)+$")) }
  }

  private fun sanitizeLabel(value: String?): String? {
    val normalized = value?.replace(Regex("\\s+"), " ")?.trim()?.take(80).orEmpty()
    return normalized.ifBlank { null }
  }

  private fun sanitizeIdentifier(value: String?, maxLength: Int, allowed: Regex): String? {
    val normalized = value?.trim()?.filter { character -> allowed.matches(character.toString()) }?.take(maxLength).orEmpty()
    return normalized.ifBlank { null }
  }

  private fun write(context: Context, rules: List<FreedFocusShieldRule>) {
    val array = JSONArray()
    rules.sortedBy { it.id }.take(MAX_RULES).forEach { rule -> array.put(toJson(rule)) }
    prefs(context).edit().putString(FOCUS_SHIELD_RULES, array.toString()).apply()
  }

  private fun toJson(rule: FreedFocusShieldRule): JSONObject {
    val selector = JSONObject().put("packageName", rule.selector.packageName)
    rule.selector.viewId?.let { selector.put("viewId", it) }
    rule.selector.role?.let { selector.put("role", it) }
    if (rule.selector.ancestorRoles.isNotEmpty()) selector.put("ancestorRoles", JSONArray(rule.selector.ancestorRoles))
    rule.selector.normalizedBounds?.let { bounds ->
      selector.put(
        "normalizedBounds",
        JSONObject()
          .put("x", bounds.x)
          .put("y", bounds.y)
          .put("width", bounds.width)
          .put("height", bounds.height)
      )
    }

    return JSONObject()
      .put("version", rule.version)
      .put("id", rule.id)
      .put("packageName", rule.packageName)
      .put("displayLabel", rule.displayLabel)
      .put("kind", rule.kind)
      .put("enabled", rule.enabled)
      .put("selector", selector)
      .apply { rule.presetId?.let { put("presetId", it) } }
  }

  private fun jsonObjectToMap(value: JSONObject): Map<String, Any?> {
    return value.keys().asSequence().associateWith { key -> jsonValue(value.opt(key)) }
  }

  private fun jsonValue(value: Any?): Any? {
    return when (value) {
      is JSONObject -> jsonObjectToMap(value)
      is JSONArray -> (0 until value.length()).map { index -> jsonValue(value.opt(index)) }
      JSONObject.NULL -> null
      else -> value
    }
  }

  private fun prefs(context: Context): SharedPreferences {
    return context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
  }

  private fun parseIsoMillis(value: String): Long? {
    return listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'").firstNotNullOfOrNull { pattern ->
      try {
        SimpleDateFormat(pattern, Locale.US).apply {
          timeZone = TimeZone.getTimeZone("UTC")
        }.parse(value)?.time
      } catch (_: Exception) {
        null
      }
    }
  }

  private fun formatIsoMillis(value: Long): String {
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date(value))
  }

  private val BASIC_IDENTIFIER_CHARACTERS = Regex("[a-zA-Z0-9_.-]")
  private val VIEW_ID_CHARACTERS = Regex("[a-zA-Z0-9_.$:/-]")
  private val ROLE_CHARACTERS = Regex("[a-zA-Z0-9_.$-]")
}
