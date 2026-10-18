package app.freed.protection

import java.io.IOException
import java.io.ByteArrayInputStream
import java.net.InetAddress

fun main() {
  fun status(configured: Boolean = false, allowed: Boolean = true, running: Boolean = false,
             privacy: String = "off", otherVpn: Boolean = false, consent: Boolean = false,
             healthy: Boolean? = null) = FreedEncryptedDnsPolicy.status(
    supported = allowed, releaseEnabled = false, configured = configured, running = running,
    privateDnsMode = privacy, otherVpnActive = otherVpn, consentRequired = consent,
    captivePaused = false, healthy = healthy)
  check(status()["enabled"] == false)
  check(status(configured = true, running = true)["healthy"] == null)
  check(status(configured = true, running = true, healthy = true)["enabled"] == true)
  check(status(configured = true, running = true, healthy = false)["reason"] == "android-encrypted-dns-resolver-failed")
  check(status(configured = true, otherVpn = true)["requiresSettings"] == true)
  check(status(configured = true, consent = true)["reason"] == "android-vpn-consent-required")
  for (mode in listOf("hostname", "opportunistic", "unknown")) {
    check(status(configured = true, running = true, privacy = mode)["enabled"] == false)
  }
  check(status(configured = true, allowed = false, running = true)["enabled"] == false)
  check(status(configured = true, allowed = false)["configured"] == true)

  var plaintextCalls = 0
  var encryptedCalls = 0
  // A resolver outage while opted in must not downgrade or invoke UDP fallback.
  check(FreedEncryptedDnsPolicy.forward(true, { encryptedCalls += 1; null }, {
    plaintextCalls += 1; byteArrayOf(1)
  }) == null)
  check(encryptedCalls == 1 && plaintextCalls == 0)
  check(FreedEncryptedDnsPolicy.forward(false, { encryptedCalls += 1; byteArrayOf(2) }, {
    plaintextCalls += 1; byteArrayOf(1)
  })?.contentEquals(byteArrayOf(1)) == true)
  check(encryptedCalls == 1 && plaintextCalls == 1)

  // A real socket must be protected while still unconnected; failure closes it.
  var protected = 0
  FreedProtectedSocketFactory { socket ->
    check(!socket.isConnected)
    protected += 1
    true
  }.createSocket().use { check(!it.isConnected) }
  check(protected == 1)
  var refusedSocket: java.net.Socket? = null
  val refused = runCatching { FreedProtectedSocketFactory { refusedSocket = it; false }.createSocket() }
  check(refused.exceptionOrNull() is IOException)
  check(refusedSocket?.isClosed == true)
  val bootstrap = FreedDohPolicy.bootstrapAddresses("family.cloudflare-dns.com")
  check(bootstrap.map { it.hostAddress } == listOf("1.1.1.3", "1.0.0.3"))
  check(runCatching { FreedDohPolicy.bootstrapAddresses("other.example") }.isFailure)

  val query = byteArrayOf(0x12, 0x34, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0,
    1, 'a'.code.toByte(), 0, 0, 1, 0, 1)
  val answer = query.copyOf().also { it[2] = 0x81.toByte(); it[3] = 0x80.toByte() }
  check(FreedDohPolicy.readResponseBody(ByteArrayInputStream(answer)).contentEquals(answer))
  check(FreedDohPolicy.readResponseBody(ByteArrayInputStream(ByteArray(10000))).size == 4097)
  check(FreedDohPolicy.acceptResponse(200, "application/dns-message", answer, query))
  check(!FreedDohPolicy.acceptResponse(302, "application/dns-message", answer, query))
  check(!FreedDohPolicy.acceptResponse(200, "text/html", answer, query))
  check(!FreedDohPolicy.acceptResponse(200, "application/dns-message", ByteArray(4097), query))
  check(!FreedDohPolicy.acceptResponse(200, "application/dns-message", answer.copyOf().also { it[0] = 0x44 }, query))
  check(!FreedDohPolicy.acceptResponse(200, "application/dns-message", answer.copyOf().also { it[13] = 'b'.code.toByte() }, query))
  check(!FreedDohPolicy.acceptResponse(200, "application/dns-message", answer.copyOf().also { it[3] = 0x82.toByte() }, query))
  println("Encrypted DNS Android policy, bootstrap, protection, and reply cases passed")
}
