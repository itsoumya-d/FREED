package app.freed.protection

/** Transport readiness is not proof that every app uses this DNS-only VPN. */
internal object FreedEncryptedDnsPolicy {
  fun forward(encryptedRequested: Boolean, encrypted: () -> ByteArray?, plaintext: () -> ByteArray?): ByteArray? =
    if (encryptedRequested) encrypted() else plaintext()

  fun status(
    supported: Boolean, releaseEnabled: Boolean, configured: Boolean, running: Boolean,
    privateDnsMode: String, otherVpnActive: Boolean, consentRequired: Boolean,
    captivePaused: Boolean, healthy: Boolean?, error: String? = null
  ): Map<String, Any?> {
    val conflict = FreedDnsGuardPolicy.issueCode(true, false, privateDnsMode)
    val enabled = supported && configured && running && conflict == null &&
      !otherVpnActive && !consentRequired && !captivePaused && error == null
    val reason = when {
      error != null -> error
      !supported -> "encrypted-dns-release-gated"
      !configured -> null
      otherVpnActive -> "android-other-vpn-active"
      conflict != null -> conflict
      consentRequired -> "android-vpn-consent-required"
      captivePaused -> "android-dns-guard-captive-paused"
      !running -> "android-dns-guard-not-running"
      healthy == false -> "android-encrypted-dns-resolver-failed"
      healthy == null -> "android-encrypted-dns-awaiting-query"
      !releaseEnabled -> "encrypted-dns-device-unverified"
      else -> null
    }
    return mapOf(
      "supported" to supported, "releaseEnabled" to releaseEnabled, "configured" to configured,
      "enabled" to enabled, "healthy" to (if (enabled) healthy else null), "reason" to reason,
      "provider" to "cloudflare-families",
      "requiresSettings" to (configured && (otherVpnActive || consentRequired ||
        privateDnsMode == "hostname" || privateDnsMode == "opportunistic"))
    )
  }
}
