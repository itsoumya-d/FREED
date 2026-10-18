package app.freed.protection

import java.util.concurrent.atomic.AtomicLong

/** DNS-only transport policy. Never weaken the device's encrypted-DNS choice. */
internal object FreedDnsGuardPolicy {
  fun allowsPlaintext(privateDnsMode: String): Boolean = privateDnsMode == "off"

  fun filteringActive(running: Boolean, captivePaused: Boolean, privateDnsMode: String, unsupportedIpv6DnsPackets: Long = 0): Boolean =
    running && !captivePaused && allowsPlaintext(privateDnsMode) && unsupportedIpv6DnsPackets == 0L

  fun issueCode(running: Boolean, captivePaused: Boolean, privateDnsMode: String, unsupportedIpv6DnsPackets: Long = 0): String? = when {
    privateDnsMode == "hostname" -> "android-private-dns-strict-unsupported"
    privateDnsMode == "opportunistic" -> "android-private-dns-encrypted-unsupported"
    privateDnsMode != "off" -> "android-private-dns-state-unknown"
    captivePaused -> "android-dns-guard-captive-paused"
    !running -> "android-dns-guard-not-running"
    unsupportedIpv6DnsPackets > 0 -> "android-ipv6-dns-format-unsupported"
    else -> null
  }

/** Evidence survives reads/stop; only a new service/network generation clears it. */
  class PacketHealth {
    val malformedPackets = AtomicLong(0L)
    val unsupportedDnsPackets = AtomicLong(0L)
    private var generation = 0L
    private var accepting = false

    @Synchronized fun beginGeneration(): Long {
      generation += 1L
      accepting = true
      malformedPackets.set(0L)
      unsupportedDnsPackets.set(0L)
      return generation
    }

    @Synchronized fun endGeneration(expected: Long) {
      if (generation == expected) accepting = false
    }

    /** True only for the first coverage loss; stale readers cannot alter new evidence. */
    @Synchronized fun recordIpv6(expected: Long, inspection: FreedDnsPacketPolicy.Inspection): Boolean {
      if (!accepting || generation != expected) return false
      return when (inspection) {
        FreedDnsPacketPolicy.Inspection.Malformed -> { malformedPackets.incrementAndGet(); false }
        is FreedDnsPacketPolicy.Inspection.Unsupported, FreedDnsPacketPolicy.Inspection.TcpDns ->
          unsupportedDnsPackets.incrementAndGet() == 1L
        else -> false
      }
    }
  }

  fun message(privateDnsMode: String): String = when (privateDnsMode) {
    "hostname" -> "DNS Guard is inactive because strict Private DNS is enabled. FREED preserves encrypted DNS; local recovery and enabled app shields remain available."
    "opportunistic" -> "DNS Guard is inactive because this network uses encrypted Private DNS. FREED preserves it; local recovery and enabled app shields remain available."
    else -> "DNS Guard is inactive because this network's DNS privacy state could not be verified. Reconnect and retry; local recovery and enabled app shields remain available."
  }
}
