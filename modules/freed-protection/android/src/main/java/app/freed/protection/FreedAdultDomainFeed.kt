package app.freed.protection

import android.content.Context
import java.util.Locale

object FreedAdultDomainFeed {
  const val DOMAINS_KEY = "adult_domain_feed_domains"
  const val VERSION_KEY = "adult_domain_feed_version"
  const val CHECKSUM_KEY = "adult_domain_feed_checksum"
  const val GENERATED_AT_KEY = "adult_domain_feed_generated_at"
  private const val MAX_DOMAINS = 50_000
  @Volatile private var cachedRawDomains: String? = null
  @Volatile private var cachedDomains: Set<String> = emptySet()

  fun configure(context: Context, domains: List<String>, version: String, checksum: String, generatedAt: String) {
    val sanitized = sanitizeDomains(domains)
    val rawDomains = sanitized.joinToString(",")
    cachedRawDomains = rawDomains
    cachedDomains = sanitized.toSet()
    context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(DOMAINS_KEY, rawDomains)
      .putString(VERSION_KEY, version.trim().take(96))
      .putString(CHECKSUM_KEY, checksum.trim().take(96))
      .putString(GENERATED_AT_KEY, generatedAt.trim().take(40))
      .apply()
  }

  fun domains(context: Context): Set<String> {
    val rawDomains = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .getString(DOMAINS_KEY, "")
      .orEmpty()
    if (rawDomains == cachedRawDomains) return cachedDomains
    val parsedDomains = rawDomains
      .split(",")
      .mapNotNull(::normalizeDomain)
      .toSet()
    cachedRawDomains = rawDomains
    cachedDomains = parsedDomains
    return parsedDomains
  }

  fun domainCount(context: Context): Int = domains(context).size

  fun version(context: Context): String? {
    return context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .getString(VERSION_KEY, null)
      ?.takeIf { it.isNotBlank() }
  }

  fun checksum(context: Context): String? {
    return context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .getString(CHECKSUM_KEY, null)
      ?.takeIf { it.isNotBlank() }
  }

  private fun sanitizeDomains(domains: List<String>): List<String> {
    return domains
      .mapNotNull(::normalizeDomain)
      .distinct()
      .sorted()
      .take(MAX_DOMAINS)
  }

  private fun normalizeDomain(input: String): String? {
    var value = input.trim().lowercase(Locale.US)
    if (value.isBlank() || value.startsWith("#") || value.startsWith("!") || value.startsWith("//")) return null

    value = value.substringBefore("#").trim()
    if (value.isBlank()) return null

    val parts = value.split(Regex("\\s+")).filter { it.isNotBlank() }
    if (parts.firstOrNull() in setOf("0.0.0.0", "127.0.0.1", "::1")) {
      value = parts.getOrNull(1).orEmpty()
    }

    value = value
      .removePrefix("||")
      .removePrefix("*.")
      .removePrefix(".")
      .substringBefore("^")
      .trim()

    value = value
      .removePrefix("https://")
      .removePrefix("http://")
      .substringBefore("/")
      .substringBefore("?")
      .substringBefore("#")
      .substringBefore(":")
      .removePrefix("www.")
      .trim()

    if (!Regex("^[a-z0-9.-]+$").matches(value)) return null
    if (!value.contains(".") || value.contains("..") || value.length > 253) return null
    if (value.split(".").any { label -> label.isBlank() || label.length > 63 || label.startsWith("-") || label.endsWith("-") }) {
      return null
    }

    return value
  }
}
