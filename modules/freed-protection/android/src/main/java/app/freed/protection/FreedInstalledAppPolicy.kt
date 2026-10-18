package app.freed.protection

import java.security.MessageDigest
import java.util.Locale

/** Inventory stays on device. Package IDs are exact authority, never URLs, paths or aliases. */
internal object FreedInstalledAppPolicy {
  const val MAX_APPS = 512
  const val MAX_SELECTED = 128
  private val packagePattern = Regex("^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$")
  private val critical = setOf("android", "com.android.settings", "com.android.systemui", "com.android.phone",
    "com.android.server.telecom", "com.android.emergency", "com.google.android.apps.safetyhub",
    "com.android.providers.telephony", "com.android.permissioncontroller", "com.google.android.permissioncontroller")

  fun validPackage(value: String): Boolean = value.length <= 255 && packagePattern.matches(value)

  fun select(candidates: List<Map<String, Any?>>, ownPackage: String, excluded: Set<String>): List<Map<String, Any?>> {
    val seen = HashSet<String>()
    return candidates.asSequence().mapNotNull { candidate ->
      val id = candidate["packageName"] as? String ?: return@mapNotNull null
      if (!validPackage(id) || id == ownPackage || id in critical || id in excluded ||
        candidate["enabled"] != true || candidate["exported"] != true || !seen.add(id)) return@mapNotNull null
      val label = (candidate["label"] as? String)?.filter { !it.isISOControl() }?.trim()?.take(120)
        ?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
      mapOf<String, Any?>("packageName" to id, "label" to label)
    }.sortedWith(compareBy<Map<String, Any?>> { (it["label"] as String).lowercase(Locale.ROOT) }
      .thenBy { it["packageName"] as String }).take(MAX_APPS).toList()
  }

  /** Rejection is all-or-nothing. An explicit [] is the only empty replacement. */
  fun validateSelection(input: List<String>, eligible: Set<String>): List<String>? {
    if (input.size > MAX_SELECTED || input.any { !validPackage(it) || it !in eligible }) return null
    return input.distinct()
  }

  fun iconKey(packageName: String): String = MessageDigest.getInstance("SHA-256")
    .digest(packageName.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) } + ".png"
}
