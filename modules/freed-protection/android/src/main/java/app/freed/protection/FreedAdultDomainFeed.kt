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

  fun configure(context: Context, domains: List<String>, version: String, checksum: String, generatedAt: String): Unit =
    configure(context, domains, version, checksum, generatedAt, null)
  internal fun configure(context: Context, domains: List<String>, version: String, checksum: String, generatedAt: String, permit: FreedAdultPermit?): Unit = FreedAdultProtectionState.guarded(context) {
    synchronized(FreedNativeUnlockStore.lock) {
      val sanitized = sanitizeDomains(domains)
      val desired = canonicalFeed(sanitized, version, checksum, generatedAt)
      if (!sanitized.containsAll(domains(context)))
        FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.REMOVE_ADULT_DOMAINS,
          "feed", feedSnapshot(context), desired, permit)
      else FreedAdultProtectionState.repairFence(context, "feed-strengthen")
      val rawDomains = sanitized.joinToString(",")
      val storage = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      val saved = storage.edit().putString(DOMAINS_KEY, rawDomains)
        .putString(VERSION_KEY, version.trim().take(96)).putString(CHECKSUM_KEY, checksum.trim().take(96))
        .putString(GENERATED_AT_KEY, generatedAt.trim().take(40)).commit()
      if (!saved || feedSnapshot(context) != desired)
        throw FreedAdultMutationFailure(FriendLockAction.REMOVE_ADULT_DOMAINS, "adult-feed-save-unconfirmed")
      cachedRawDomains = rawDomains
      cachedDomains = sanitized.toSet()
    }
  }
  internal fun canonicalFeed(domains: List<String>, version: String, checksum: String, generatedAt: String): String =
    listOf(sanitizeDomains(domains).joinToString(","), version.trim().take(96), checksum.trim().take(96), generatedAt.trim().take(40))
      .joinToString(":") { android.util.Base64.encodeToString(it.toByteArray(Charsets.UTF_8), android.util.Base64.NO_WRAP) }
  internal fun feedSnapshot(context: Context): String {
    val storage = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
    val values = listOf(DOMAINS_KEY, VERSION_KEY, CHECKSUM_KEY, GENERATED_AT_KEY).map { key ->
      storage.all[key] as? String ?: error("adult-feed-baseline-unavailable") }
    return canonicalFeed(values[0].split(","), values[1], values[2], values[3])
  }
  internal fun applyFeedSnapshot(context: Context, desired: String, permit: FreedAdultPermit) {
    val values = desired.split(":").map { android.util.Base64.decode(it, android.util.Base64.DEFAULT).toString(Charsets.UTF_8) }
    check(values.size == 4 && canonicalFeed(values[0].split(","), values[1], values[2], values[3]) == desired)
    configure(context, values[0].split(","), values[1], values[2], values[3], permit)
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

  // ── User allowlist (always-allow domains) ───────────────────────────────────
  private const val USER_ALLOWED_KEY = "user_allowed_domains"
  private const val MAX_USER_ALLOWED = 200
  @Volatile private var cachedUserAllowedRaw: String? = null
  @Volatile private var cachedUserAllowed: Set<String> = emptySet()

  fun configureUserAllowedDomains(context: Context, domains: List<String>): Set<String> = configureUserAllowedDomains(context, domains, null)
  internal fun configureUserAllowedDomains(context: Context, domains: List<String>, permit: FreedAdultPermit?): Set<String> = FreedAdultProtectionState.guarded(context) {
    synchronized(FreedNativeUnlockStore.lock) {
      val sanitized = sanitizeDomains(domains).take(MAX_USER_ALLOWED)
      val rawDomains = sanitized.joinToString(",")
      if (!userAllowedDomains(context).containsAll(sanitized))
        FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.ADD_ADULT_EXCEPTIONS,
          "exceptions", if (permit == null) userAllowedDomains(context).sorted().joinToString(",") else exceptionsSnapshot(context), rawDomains, permit)
      else FreedAdultProtectionState.repairFence(context, "exceptions-reduce")
      val storage = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      if (!storage.edit().putString(USER_ALLOWED_KEY, rawDomains).commit() || storage.getString(USER_ALLOWED_KEY, null) != rawDomains)
        throw FreedAdultMutationFailure(FriendLockAction.ADD_ADULT_EXCEPTIONS, "adult-exceptions-save-unconfirmed")
      cachedUserAllowedRaw = rawDomains
      cachedUserAllowed = sanitized.toSet()
      cachedUserAllowed
    }
  }
  internal fun canonicalExceptions(domains: List<String>): String = sanitizeDomains(domains).take(MAX_USER_ALLOWED).joinToString(",")
  internal fun exceptionsSnapshot(context: Context): String =
    (context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE).all[USER_ALLOWED_KEY] as? String)
      ?.let { canonicalExceptions(it.split(",")) } ?: error("adult-exceptions-baseline-unavailable")

  fun userAllowedDomains(context: Context): Set<String> {
    val rawDomains = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)
      .getString(USER_ALLOWED_KEY, "")
      .orEmpty()
    if (rawDomains == cachedUserAllowedRaw) return cachedUserAllowed
    val parsed = rawDomains
      .split(",")
      .mapNotNull(::normalizeDomain)
      .toSet()
    cachedUserAllowedRaw = rawDomains
    cachedUserAllowed = parsed
    return parsed
  }

  fun userAllowedDomainCount(context: Context): Int = userAllowedDomains(context).size

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
