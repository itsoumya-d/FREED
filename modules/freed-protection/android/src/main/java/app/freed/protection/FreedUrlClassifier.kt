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

  // Developer-hosting platforms where the project label sits three labels deep.
  // Token matching extends one label further on these hosts only; user-content
  // platforms are deliberately excluded (adult content is common there).
  private val multiPartDevHostingSuffixes = setOf(
    "github.io",
    "gitlab.io",
    "pages.dev",
    "netlify.app",
    "vercel.app",
    "herokuapp.com",
    "web.app",
    "firebaseapp.com",
    "repl.co",
    "glitch.me"
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

  private val consumptionNegationWords = setOf(
    "stop", "stopped", "stopping", "quit", "quitting", "no", "never",
    "avoid", "avoiding", "block", "blocked", "blocking", "less",
    "overcome", "overcoming", "fight", "fighting", "end", "ending", "ended"
  )

  private val neutralHelpMarkerWords = setOf(
    "is", "are", "am", "was", "were", "be", "been",
    "does", "do", "did", "can", "cannot", "cant", "could",
    "why", "how", "what", "which", "who", "should", "would", "will",
    "meaning", "mean", "means", "define", "definition",
    "bad", "good", "wrong", "harm", "harmful", "healthy", "unhealthy",
    "sin", "sinful", "say", "says", "bible", "quran", "biblical",
    "morality", "moral", "ethics", "ethical", "legal", "illegal", "law", "laws",
    "age", "history", "statistics", "study", "studies", "research",
    "science", "scientific", "brain", "dopamine", "psychology", "psychological",
    "religion", "religious", "facts", "evidence"
  )

  private fun splitSearchWords(searchText: String): List<String> {
    return searchText.split(Regex("[^a-z0-9']+")).filter { it.isNotBlank() }
  }

  private fun isConsumptionIntentNegated(searchText: String): Boolean {
    val words = splitSearchWords(searchText)
    if (words.isEmpty()) return false

    return consumptionIntentSearchTerms.any { term ->
      val termWords = term.split(" ")
      val wordIndex: Int
      if (termWords.size > 1) {
        val phraseIndex = searchText.indexOf(term)
        if (phraseIndex < 0) return@any false
        val before = searchText.substring(0, phraseIndex).trim()
        wordIndex = if (before.isBlank()) 0 else splitSearchWords(before).size
      } else {
        wordIndex = words.indexOfFirst { word -> word.contains(term) }
        if (wordIndex < 0) return@any false
      }
      val windowStart = (wordIndex - 3).coerceAtLeast(0)
      words.subList(windowStart, wordIndex).any { word -> consumptionNegationWords.contains(word) }
    }
  }

  private fun hasNeutralHelpContext(searchText: String, explicitTerm: String): Boolean {
    val explicitTokens = explicitTerm.split(" ").toSet()
    return splitSearchWords(searchText).any { word ->
      !explicitTokens.contains(word) && neutralHelpMarkerWords.contains(word)
    }
  }

  private fun effectiveConsumptionIntent(searchText: String): Boolean {
    val rawConsumption = consumptionIntentSearchTerms.any { searchTextContains(searchText, it) }
    return rawConsumption && !isConsumptionIntentNegated(searchText)
  }

  fun classifyFocusedInput(
    input: String,
    adultDomainFeed: Set<String> = emptySet(),
    userAllowedDomains: Set<String> = emptySet()
  ): FreedClassification {
    val urlResult = classify(input, adultDomainFeed, userAllowedDomains)
    if (urlResult.shouldBlock || shouldTreatAsUrlCandidate(input) || (urlResult.matchedRule != "default-allow" && urlResult.matchedRule != "empty-input")) {
      return urlResult
    }

    val searchText = normalizeFocusedSearchText(input)
    if (searchText.isBlank()) return urlResult

    val explicitSearch = explicitFocusedSearchSignal(searchText)
    if (explicitSearch != null) {
      val educationIntent = recoveryEducationSearchTerms.any { searchTextContains(searchText, it) }
      val consumptionIntent = effectiveConsumptionIntent(searchText)

      if (educationIntent && !consumptionIntent) {
        return FreedClassification(
          shouldBlock = false,
          host = FOCUSED_SEARCH_HOST,
          reason = "Focused browser search text appears in recovery, health, or education context.",
          matchedRule = "focused-search-education:$explicitSearch"
        )
      }

      if (!consumptionIntent && hasNeutralHelpContext(searchText, explicitSearch)) {
        return FreedClassification(
          shouldBlock = false,
          host = FOCUSED_SEARCH_HOST,
          reason = "Focused browser search text mentions adult terms as a question or help-seeking, not consumption.",
          matchedRule = "focused-search-neutral:$explicitSearch"
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

  fun classify(
    input: String,
    adultDomainFeed: Set<String> = emptySet(),
    userAllowedDomains: Set<String> = emptySet()
  ): FreedClassification {
    val normalized = normalizeInput(input)
    val host = normalizeHost(normalized)

    if (host.isBlank()) {
      return FreedClassification(false, "", "No domain detected.", "empty-input")
    }

    val searchText = extractSearchText(normalized)

    // Ordinary-site exceptions never bypass adult domains or consumption queries.
    val normalAllowlisted = allowedNormalDomains.any { hostMatches(host, it) }
    val knownSearchEngine = isKnownSearchEngineHost(host)
    val requestedException = !normalAllowlisted && !knownSearchEngine && userAllowedDomains.any { hostMatches(host, it) }
    val knownAdultDomain = requestedException && (adultDomainFeed.any { hostMatches(host, it) } || adultDomains.any { hostMatches(host, it) })
    if (requestedException && !knownAdultDomain) {
      return FreedClassification(
        shouldBlock = false,
        host = host,
        reason = "User asked FREED to always allow this site.",
        matchedRule = "user-allowlist"
      )
    }

    if (normalAllowlisted || knownSearchEngine) {
      val explicitSearch = explicitSearchTerms.firstOrNull { searchText.contains(it) }
      if (explicitSearch != null) {
        val educationIntent = recoveryEducationSearchTerms.any { searchText.contains(it) }
        val consumptionIntent = effectiveConsumptionIntent(searchText)

        if (educationIntent && !consumptionIntent) {
          return FreedClassification(
            shouldBlock = false,
            host = host,
            reason = "Adult term appears in recovery, health, or education context.",
            matchedRule = "safe-site-education:$explicitSearch"
          )
        }

        if (!consumptionIntent && hasNeutralHelpContext(searchText, explicitSearch)) {
          return FreedClassification(
            shouldBlock = false,
            host = host,
            reason = "Adult term appears as a question or help-seeking query without consumption intent.",
            matchedRule = "safe-site-neutral-query:$explicitSearch"
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

    // Registrable-domain boundary: last two labels, extended by one extra label
    // on known developer-hosting platforms. Parity with blocking-engine.ts.
    val tokenParts = host.split(".")
    var tokenMinIndex = (tokenParts.size - 2).coerceAtLeast(0)
    if (multiPartDevHostingSuffixes.any { suffix -> hostMatches(host, suffix) }) {
      tokenMinIndex = (tokenParts.size - 3).coerceAtLeast(0)
    }
    fun tokenInScope(signal: String): Boolean =
      tokenParts.withIndex().any { (index, part) ->
        index >= tokenMinIndex && (part == signal || part.startsWith("$signal-") || part.endsWith("-$signal"))
      }
    fun tokenOnlyInSubdomain(signal: String): Boolean =
      tokenParts.withIndex().any { (index, part) ->
        index < tokenMinIndex && (part == signal || part.startsWith("$signal-") || part.endsWith("-$signal"))
      }

    val token = explicitDomainTokens.firstOrNull(::tokenInScope)
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

    // A token appearing only inside a deeper subdomain of an otherwise benign
    // registrable domain is allowed unless the host carries consumption signals.
    val subdomainToken = explicitDomainTokens.firstOrNull(::tokenOnlyInSubdomain)
    if (subdomainToken != null) {
      val subRecoveryContext = hasHostContext(host, recoveryDomainContextTerms)
      val subConsumptionContext = hasHostContext(host, consumptionDomainContextTerms)
      if (subRecoveryContext && !subConsumptionContext) {
        return FreedClassification(
          shouldBlock = false,
          host = host,
          reason = "Adult-looking hostname token appears in recovery, health, or filtering context.",
          matchedRule = "explicit-domain-token-recovery-context:$subdomainToken"
        )
      }
      if (!subConsumptionContext) {
        return FreedClassification(
          shouldBlock = false,
          host = host,
          reason = "Adult-looking token appears in a subdomain without any consumption signal.",
          matchedRule = "explicit-domain-token-subdomain-benign:$subdomainToken"
        )
      }
      return FreedClassification(
        shouldBlock = true,
        host = host,
        reason = "Hostname combines an adult-content token with consumption signals.",
        matchedRule = "explicit-domain-token:$subdomainToken"
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
