package app.freed.protection

/** Pure locale policy, shared by native services and standalone contract tests. */
object FreedPresentationLocale {
  val supported = setOf("en", "hi", "es", "pt", "fr", "de", "ar", "ja", "ko", "zh-Hans")
  fun resolve(selected: String?, preferred: String): String {
    if (selected in supported) return selected!!
    val normalized = preferred.replace('_', '-').lowercase()
    if (normalized.startsWith("zh")) {
      return if (Regex("(?:hant|tw|hk|mo)").containsMatchIn(normalized)) "en" else "zh-Hans"
    }
    return normalized.substringBefore('-').takeIf { it in supported } ?: "en"
  }
}
