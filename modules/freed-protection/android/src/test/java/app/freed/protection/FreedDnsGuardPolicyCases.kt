package app.freed.protection

/** Dependency-free executable policy cases, compiled with the production policy. */
fun main() {
  check(FreedDnsGuardPolicy.filteringActive(true, false, "off"))
  check(!FreedDnsGuardPolicy.filteringActive(true, true, "off"))
  check(FreedDnsGuardPolicy.issueCode(true, true, "off") == "android-dns-guard-captive-paused")
  // Captive portal sign-in completion restores coverage without broadening it.
  check(FreedDnsGuardPolicy.filteringActive(true, false, "off"))
  check(!FreedDnsGuardPolicy.filteringActive(false, false, "off"))
  for (mode in listOf("hostname", "opportunistic", "unknown", "unexpected")) {
    check(!FreedDnsGuardPolicy.allowsPlaintext(mode))
    check(!FreedDnsGuardPolicy.filteringActive(true, false, mode))
    check(FreedDnsGuardPolicy.issueCode(true, false, mode) != null)
  }
  check(FreedDnsGuardPolicy.issueCode(true, false, "hostname") == "android-private-dns-strict-unsupported")
  check(FreedDnsGuardPolicy.issueCode(true, false, "opportunistic") == "android-private-dns-encrypted-unsupported")
  check(FreedDnsGuardPolicy.issueCode(true, false, "unknown") == "android-private-dns-state-unknown")
  check(FreedDnsGuardPolicy.issueCode(true, false, "off") == null)
  check(FreedDnsGuardPolicy.issueCode(false, false, "off") == "android-dns-guard-not-running")
  val health = FreedDnsGuardPolicy.PacketHealth()
  val first = health.beginGeneration()
  check(!health.recordIpv6(first, FreedDnsPacketPolicy.Inspection.NotDns))
  check(!health.recordIpv6(first, FreedDnsPacketPolicy.Inspection.Malformed))
  check(health.malformedPackets.get() == 1L && health.unsupportedDnsPackets.get() == 0L)
  check(FreedDnsGuardPolicy.filteringActive(true, false, "off", health.unsupportedDnsPackets.get()))
  check(health.recordIpv6(first, FreedDnsPacketPolicy.Inspection.Unsupported(42)))
  check(!FreedDnsGuardPolicy.filteringActive(true, false, "off", health.unsupportedDnsPackets.get()))
  repeat(3) {
    check(FreedDnsGuardPolicy.issueCode(true, false, "off", health.unsupportedDnsPackets.get()) == "android-ipv6-dns-format-unsupported")
    check(health.unsupportedDnsPackets.get() == 1L) // Reading health never resets failure.
  }
  check(!health.recordIpv6(first, FreedDnsPacketPolicy.Inspection.TcpDns))
  check(health.unsupportedDnsPackets.get() == 2L) // DNS TCP fails fast and lowers coverage.
  // Privacy/captive/stopped reasons retain precedence over the packet limitation.
  check(FreedDnsGuardPolicy.issueCode(true, false, "hostname", 2) == "android-private-dns-strict-unsupported")
  check(FreedDnsGuardPolicy.issueCode(true, true, "off", 2) == "android-dns-guard-captive-paused")
  check(FreedDnsGuardPolicy.issueCode(false, false, "off", 2) == "android-dns-guard-not-running")
  health.endGeneration(first)
  check(!health.recordIpv6(first, FreedDnsPacketPolicy.Inspection.Unsupported(42)))
  check(health.unsupportedDnsPackets.get() == 2L) // Stop preserves evidence.
  val second = health.beginGeneration()
  check(second != first && health.unsupportedDnsPackets.get() == 0L && health.malformedPackets.get() == 0L)
  check(!health.recordIpv6(first, FreedDnsPacketPolicy.Inspection.Unsupported(42)))
  health.endGeneration(first) // A late old stop cannot invalidate the new generation.
  check(health.recordIpv6(second, FreedDnsPacketPolicy.Inspection.TcpDns))
  check(!FreedDnsGuardPolicy.filteringActive(true, false, "off", health.unsupportedDnsPackets.get()))
  println("DNS-only readiness/privacy and generation-bound IPv6 packet-health cases passed")
}
