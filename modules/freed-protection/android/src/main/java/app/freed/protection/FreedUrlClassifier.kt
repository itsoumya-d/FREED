package app.freed.protection

import android.net.Uri
import java.net.IDN
import java.util.Locale

data class FreedClassification(
  val shouldBlock: Boolean,
  val host: String,
  val reason: String,
  val matchedRule: String
)

object FreedUrlClassifier {
  private const val FOCUSED_SEARCH_HOST = "focused-search.app.freed.local"

  private val allowedNormalDomains = setOf(
    "google.com",
    "youtube.com",
    "youtu.be",
    "instagram.com",
    "x.com",
    "twitter.com",
    "reddit.com",
    "facebook.com",
    "linkedin.com",
    "wikipedia.org",
    "github.com",
    "stackoverflow.com",
    "netflix.com",
    "spotify.com",
    "twitch.tv",
    "roblox.com",
    "minecraft.net",
    "coursera.org",
    "khanacademy.org"
  )

  private val adultDomains = setOf(
    "adultfriendfinder.com",
    "beeg.com",
    "bongacams.com",
    "brazzers.com",
    "cam4.com",
    "camsoda.com",
    "chaturbate.com",
    "drtuber.com",
    "empflix.com",
    "eporner.com",
    "erome.com",
    "fakku.net",
    "flirt4free.com",
    "fux.com",
    "gotporn.com",
    "hentaihaven.xxx",
    "hentaifox.com",
    "javhd.com",
    "literotica.com",
    "livejasmin.com",
    "manyvids.com",
    "motherless.com",
    "myfreecams.com",
    "naughtyamerica.com",
    "nhentai.net",
    "nuvid.com",
    "onlyfans.com",
    "porn.com",
    "porn300.com",
    "pornhub.com",
    "porntrex.com",
    "redtube.com",
    "rule34.xxx",
    "sex.com",
    "spankbang.com",
    "stripchat.com",
    "sunporno.com",
    "tnaflix.com",
    "tube8.com",
    "vporn.com",
    "xhamster.com",
    "xhamsterlive.com",
    "xnxx.com",
    "xvideos.com",
    "youjizz.com",
    "youporn.com"
  )

  private val searchEngineDomains = setOf(
    "bing.com",
    "duckduckgo.com",
    "yahoo.com",
    "brave.com",
    "ecosia.org",
    "startpage.com",
    "qwant.com",
    "yandex.com",
    "baidu.com"
  )

  private val explicitDomainTokens = setOf(
    "porn",
    "xvideos",
    "xnxx",
    "xhamster",
    "redtube",
    "youporn",
    "camgirl",
    "chaturbate",
    "stripchat",
    "hentai",
    "nsfw",
    "xxx"
  )

  private val explicitSearchTerms = setOf(
    "porn",
    "pornography",
    "porno",
    "xxx",
    "adult video",
    "nude videos",
    "nsfw video",
    "hentai",
    "camgirl",
    "onlyfans leak"
  )

  private val recoveryEducationSearchTerms = setOf(
    "addiction",
    "recovery",
    "quit",
    "blocker",
    "parental control",
    "therapy",
    "research",
    "statistics",
    "effects",
    "education",
    "health",
    "support",
    "support group",
    "accountability",
    "relapse",
    "prevention",
    "urge",
    "sobriety",
    "nofap",
    "dopamine",
    "compulsive",
    "screen time"
  )

  private val consumptionIntentSearchTerms = setOf(
    "watch",
    "stream",
    "download",
    "free",
    "full",
    "leak",
    "gallery",
    "pics",
    "images",
    "uncensored"
  )

  private val recoveryDomainContextTerms = setOf(
    "addiction",
    "recovery",
    "quit",
    "blocker",
    "filter",
    "parental",
    "control",
    "therapy",
    "research",
    "statistics",
    "effects",
    "education",
    "health",
    "support",
    "accountability",
    "relapse",
    "prevention",
    "urge",
    "sobriety",
    "nofap",
    "dopamine",
    "compulsive",
    "screen",
    "time",
    "help"
  )

  private val consumptionDomainContextTerms = setOf(
    "watch",
    "stream",
    "download",
    "free",
    "full",
    "leak",
    "gallery",
    "pics",
    "images",
    "uncensored",
    "tube",
    "videos",
    "cams"
  )

  fun classifyFocusedInput(input: String, adultDomainFeed: Set<String> = emptySet()): FreedClassification {
    val urlResult = classify(input, adultDomainFeed)
    if (urlResult.shouldBlock || shouldTreatAsUrlCandidate(input) || (urlResult.matchedRule != "default-allow" && urlResult.matchedRule != "empty-input")) {
      return urlResult
    }

    val searchText = normalizeFocusedSearchText(input)
    if (searchText.isBlank()) return urlResult

    val explicitSearch = explicitFocusedSearchSignal(searchText)
    if (explicitSearch != null) {
      val educationIntent = recoveryEducationSearchTerms.any { searchTextContains(searchText, it) }
      val consumptionIntent = consumptionIntentSearchTerms.any { searchTextContains(searchText, it) }

      if (educationIntent && !consumptionIntent) {
        return FreedClassification(
          shouldBlock = false,
          host = FOCUSED_SEARCH_HOST,
          reason = "Focused browser search text appears in recovery, health, or education context.",
          matchedRule = "focused-search-education:$explicitSearch"
        )
      }

      return FreedClassification(
        shouldBlock = true,
        host = FOCUSED_SEARCH_HOST,
        reason = "Focused browser search text showed adult intent.",
        matchedRule = "focused-search:$explicitSearch"
      )
    }

    return urlResult
  }

  fun classify(input: String, adultDomainFeed: Set<String> = emptySet()): FreedClassification {
    val normalized = normalizeInput(input)
    val host = normalizeHost(normalized)

    if (host.isBlank()) {
      return FreedClassification(false, "", "No domain detected.", "empty-input")
    }

    val searchText = extractSearchText(normalized)

    val normalAllowlisted = allowedNormalDomains.any { hostMatches(host, it) }
    val knownSearchEngine = isKnownSearchEngineHost(host)

    if (normalAllowlisted || knownSearchEngine) {
      val explicitSearch = explicitSearchTerms.firstOrNull { searchText.contains(it) }
      if (explicitSearch != null) {
        val educationIntent = recoveryEducationSearchTerms.any { searchText.contains(it) }
        val consumptionIntent = consumptionIntentSearchTerms.any { searchText.contains(it) }

        if (educationIntent && !consumptionIntent) {
          return FreedClassification(
            shouldBlock = false,
            host = host,
            reason = "Adult term appears in recovery, health, or education context.",
            matchedRule = "safe-site-education:$explicitSearch"
          )
        }

        return FreedClassification(
          shouldBlock = true,
          host = host,
          reason = "Allowed site, but adult search intent was detected.",
          matchedRule = "safe-site-search:$explicitSearch"
        )
      }

      return FreedClassification(
        shouldBlock = false,
        host = host,
        reason = if (knownSearchEngine) {
          "Known search engine without adult-consumption intent."
        } else {
          "Known normal browsing domain."
        },
        matchedRule = if (knownSearchEngine) "known-search-engine" else "normal-web-allowlist"
      )
    }

    val adultDomain = adultDomainFeed.firstOrNull { hostMatches(host, it) } ?: adultDomains.firstOrNull { hostMatches(host, it) }
    if (adultDomain != null) {
      return FreedClassification(
        shouldBlock = true,
        host = host,
        reason = "Adult-content domain feed.",
        matchedRule = "adult-domain:$adultDomain"
      )
    }

    val token = explicitDomainTokens.firstOrNull { signal ->
      host.split(".").any { part -> part == signal || part.startsWith("$signal-") || part.endsWith("-$signal") }
    }
    if (token != null) {
      val recoveryContext = hasHostContext(host, recoveryDomainContextTerms)
      val consumptionContext = hasHostContext(host, consumptionDomainContextTerms)

      if (recoveryContext && !consumptionContext) {
        return FreedClassification(
          shouldBlock = false,
          host = host,
          reason = "Adult-looking hostname token appears in recovery, health, or filtering context.",
          matchedRule = "explicit-domain-token-recovery-context:$token"
        )
      }

      return FreedClassification(
        shouldBlock = true,
        host = host,
        reason = "High-confidence adult-content hostname token.",
        matchedRule = "explicit-domain-token:$token"
      )
    }

    return FreedClassification(
      shouldBlock = false,
      host = host,
      reason = "No adult-content signal found; default allow.",
      matchedRule = "default-allow"
    )
  }

  fun normalizeHostForStorage(input: String): String {
    return normalizeHost(normalizeInput(input))
  }

  private fun normalizeInput(input: String): String {
    val trimmed = input.trim()
    if (trimmed.isBlank()) return trimmed
    return if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
      trimmed
    } else {
      "https://$trimmed"
    }
  }

  private fun normalizeHost(input: String): String {
    val parsedHost = runCatching { Uri.parse(input).host.orEmpty() }.getOrDefault("")
    val parsed = sanitizeHostCandidate(parsedHost)
    if (parsed.isNotBlank()) return parsed

    return sanitizeHostCandidate(
      input
        .removePrefix("https://")
        .removePrefix("http://")
    )
  }

  private fun sanitizeHostCandidate(input: String): String {
    val hostOnly = input
      .trim()
      .lowercase(Locale.US)
      .substringAfterLast("@")
      .substringBefore("/")
      .substringBefore("?")
      .substringBefore("#")
      .let { value ->
        if (!value.startsWith("[") && value.contains(":")) value.substringBefore(":") else value
      }

    val asciiHost = runCatching { IDN.toASCII(hostOnly) }.getOrElse { hostOnly }
    val normalized = asciiHost
      .lowercase(Locale.US)
      .removePrefix("www.")
      .replace(Regex("[^a-z0-9.-]"), "")
      .trim('.')
      .take(120)

    if (!normalized.contains(".")) return ""
    if (!Regex("^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$").matches(normalized)) return ""
    if (normalized.split(".").any { part -> part.isBlank() || part.startsWith("-") || part.endsWith("-") }) return ""
    return normalized
  }

  private fun extractSearchText(input: String): String {
    return runCatching {
      val uri = Uri.parse(input)
      listOf("q", "query", "search_query", "p", "text")
        .joinToString(" ") { key -> uri.getQueryParameter(key).orEmpty() }
        .replace("+", " ")
        .lowercase(Locale.US)
    }.getOrElse {
      input.lowercase(Locale.US)
    }
  }

  private fun shouldTreatAsUrlCandidate(input: String): Boolean {
    val value = input.trim().lowercase(Locale.US)
    if (value.isBlank()) return false
    if (value.startsWith("http://") || value.startsWith("https://")) return true
    if (value.contains("/") || value.contains("?") || value.contains("#")) return true
    return value.contains(".") && value.none { it.isWhitespace() }
  }

  private fun normalizeFocusedSearchText(input: String): String {
    val decoded = runCatching { Uri.decode(input) }.getOrElse { input }
    return decoded
      .lowercase(Locale.US)
      .replace(Regex("[+_]+"), " ")
      .replace(Regex("\\s+"), " ")
      .trim()
  }

  private fun explicitFocusedSearchSignal(searchText: String): String? {
    val domainNameSignals = adultDomains.map { domain -> domain.substringBefore(".") }
    return (explicitSearchTerms + explicitDomainTokens + domainNameSignals)
      .firstOrNull { signal -> searchTextContains(searchText, signal) }
  }

  private fun searchTextContains(searchText: String, signal: String): Boolean {
    val normalizedSignal = signal
      .lowercase(Locale.US)
      .replace(".", " ")
      .replace("-", " ")
      .replace(Regex("\\s+"), " ")
      .trim()
    if (normalizedSignal.isBlank()) return false
    if (normalizedSignal.contains(" ")) return searchText.contains(normalizedSignal)
    return Regex("(^|[^a-z0-9])${Regex.escape(normalizedSignal)}([^a-z0-9]|$)")
      .containsMatchIn(searchText)
  }

  private fun hostMatches(host: String, domain: String): Boolean {
    return host == domain || host.endsWith(".$domain")
  }

  private fun hasHostContext(host: String, terms: Set<String>): Boolean {
    val parts = host.split(Regex("[^a-z0-9]+")).filter { it.isNotBlank() }
    val phrase = parts.joinToString(" ")
    return terms.any { term -> if (term.contains(" ")) phrase.contains(term) else parts.contains(term) }
  }

  private fun isKnownSearchEngineHost(host: String): Boolean {
    return searchEngineDomains.any { hostMatches(host, it) } || Regex("^google\\.[a-z.]{2,}$").matches(host)
  }
}
