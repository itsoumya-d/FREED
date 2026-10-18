package app.freed.protection

import java.security.MessageDigest
import java.util.UUID

/** Internal pilot constants; no caller-controlled host, URL, header or alternate resolver. */
internal object FreedRecoveryDnsPilotPolicy {
  const val HOST = "freedrecovery.web.app"
  const val PROVIDER = "freed-recovery-pilot"
  const val REPLACEMENT_UNAVAILABLE = "android-recovery-dns-replacement-transaction-unavailable"
  const val MAX_RECORD_BYTES = 65_536
  private val hex64 = Regex("^[0-9a-f]{64}$")
  private val hex32 = Regex("^[0-9a-f]{32}$")
  private val uuid = Regex("^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$")
  private val installation = Regex("^[cdef][A-Za-z0-9_-]{21}$")

  fun digest(value: String): String = MessageDigest.getInstance("SHA-256")
    .digest(value.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it.toInt() and 255) }

  fun canonicalUUID(value: String): Boolean = uuid.matches(value) &&
    runCatching { UUID.fromString(value).toString() == value }.getOrDefault(false)

  fun validReference(value: String): Boolean = hex32.matches(value)
  fun validDigest(value: String): Boolean = hex64.matches(value)
  fun validInstallationId(value: String): Boolean = installation.matches(value)
  fun supported(flag: Boolean, debuggable: Boolean, channel: String?): Boolean =
    flag && (debuggable || channel in setOf("internal", "development"))

  fun endpoint(rawSecret: String): String {
    require(hex64.matches(rawSecret))
    return "https://$HOST/dns/$rawSecret/dns-query"
  }

  /** The server generation is opaque; admission is separately bound to the native owner scope. */
  fun validate(input: Map<String, Any?>): Input {
    require(input.keys == setOf("rawSecret", "credentialHash", "audience", "ownerGeneration", "installationId", "actionScope"))
    fun field(name: String) = input[name] as? String ?: throw IllegalArgumentException("recovery-dns-input-invalid")
    val rawSecret = field("rawSecret")
    val credentialHash = field("credentialHash")
    val audience = field("audience")
    val ownerGeneration = field("ownerGeneration")
    val installationId = field("installationId")
    val actionScope = field("actionScope")
    require(hex64.matches(rawSecret) && hex64.matches(credentialHash) && hex32.matches(audience))
    require(canonicalUUID(ownerGeneration) && validInstallationId(installationId))
    require(actionScope.isNotBlank() && actionScope.toByteArray(Charsets.UTF_8).size <= 1100)
    require(MessageDigest.isEqual(digest(rawSecret).toByteArray(Charsets.US_ASCII), credentialHash.toByteArray(Charsets.US_ASCII)))
    return Input(rawSecret, credentialHash, audience, ownerGeneration, installationId, actionScope)
  }

  // These classes deliberately do not synthesize toString/copy/componentN for credential material.
  class Input(val rawSecret: String, val credentialHash: String, val audience: String,
    val ownerGeneration: String, val installationId: String, val actionScope: String) {
    override fun toString() = "RecoveryDnsPilotInput(redacted)"
  }

  class Candidate(val reference: String, val rawSecret: String, val credentialHash: String,
    val audience: String, val ownerGeneration: String, val installationId: String,
    val ownerScopeDigest: String, val adultGeneration: String, val configurationGeneration: String,
    val ownerIdentityDigest: String? = null) {
    init {
      require(validReference(reference) && validDigest(rawSecret) && validDigest(credentialHash) && hex32.matches(audience))
      require(digest(rawSecret) == credentialHash && canonicalUUID(ownerGeneration) && validInstallationId(installationId))
      require(validDigest(ownerScopeDigest) && adultGeneration.matches(Regex("^[1-9][0-9]{0,15}$")) && canonicalUUID(configurationGeneration))
      require(ownerIdentityDigest == null || validDigest(ownerIdentityDigest))
    }
    fun sameEnrollment(input: Input): Boolean = rawSecret == input.rawSecret && credentialHash == input.credentialHash &&
      audience == input.audience && ownerGeneration == input.ownerGeneration && installationId == input.installationId
    fun sameEnrollment(other: Candidate): Boolean = rawSecret == other.rawSecret && credentialHash == other.credentialHash &&
      audience == other.audience && ownerGeneration == other.ownerGeneration && installationId == other.installationId
    fun current(scope: String, generation: String): Boolean = ownerScopeDigest == digest(scope) && adultGeneration == generation
    /** Stable native policy identity permits metadata only; it is never execution authority. */
    fun ownedBy(scope: String, identity: String, generation: String): Boolean = adultGeneration == generation &&
      (ownerIdentityDigest == identity || (ownerIdentityDigest == null && current(scope, generation)))
    fun renew(scope: String, identity: String, generation: String): Candidate {
      check(validDigest(identity) && ownedBy(scope, identity, generation)) { "recovery-dns-owner-stale" }
      val nextScope = digest(scope)
      if (ownerScopeDigest == nextScope && ownerIdentityDigest == identity) return this
      return Candidate(reference, rawSecret, credentialHash, audience, ownerGeneration, installationId,
        nextScope, adultGeneration, configurationGeneration, identity)
    }
    fun publicReceipt(): Map<String, Any?> = mapOf("schema" to 1, "kind" to "candidate", "supported" to true,
      "staged" to true, "reference" to reference, "credentialHash" to credentialHash, "audience" to audience,
      "ownerGeneration" to ownerGeneration, "nativeConfigurationGeneration" to configurationGeneration)
    override fun toString() = "RecoveryDnsPilotCandidate(redacted)"
  }
}
