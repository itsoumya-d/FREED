package app.freed.protection

import java.net.InetAddress

/** Pure packet rules for the DNS-only VpnService. It never handles unrelated IPv6 traffic. */
internal object FreedDnsPacketPolicy {
  const val IPV6_HEADER_SIZE = 40
  const val IPV4_HEADER_SIZE = 20
  const val UDP_HEADER_SIZE = 8
  private const val TCP_MIN_HEADER_SIZE = 20
  private const val DNS_HEADER_SIZE = 12
  private const val DNS_PORT = 53
  private const val UDP_PROTOCOL = 17
  private const val TCP_PROTOCOL = 6
  private const val ICMPV6_PROTOCOL = 58
  private const val MAX_DNS_PAYLOAD_SIZE = 4096
  private const val MAX_EXTENSION_HEADERS = 4
  private const val MAX_EXTENSION_BYTES = 256
  private const val MAX_INSPECT_EXTENSION_HEADERS = 16
  private const val MAX_INSPECT_EXTENSION_BYTES = 1024
  private const val MAX_ICMPV6_QUOTE_BYTES = 1232

  data class ResolverRoute(val address: String, val prefixLength: Int)

  data class DnsEnvelope(
    val sourceAddress: ByteArray,
    val destinationAddress: ByteArray,
    val sourcePort: Int,
    val destinationPort: Int,
    val dnsPayload: ByteArray,
    val isQuery: Boolean
  )

  sealed class Inspection {
    object NotDns : Inspection()
    object Malformed : Inspection()
    data class Unsupported(val pointer: Int) : Inspection()
    data class UdpDns(val envelope: DnsEnvelope) : Inspection()
    object TcpDns : Inspection()
  }

  /** Maps the current LinkProperties.dnsServers snapshot to host routes by address family. */
  fun resolverRoutes(resolvers: List<InetAddress>, excludedAddresses: Set<String> = emptySet()): List<ResolverRoute> {
    val excluded = excludedAddresses.map { it.substringBefore('%').lowercase() }.toSet()
    val routes = LinkedHashMap<String, ResolverRoute>()
    for (resolver in resolvers) {
      val raw = resolver.address
      if (raw.size != 4 && raw.size != 16) continue
      if (resolver.isAnyLocalAddress || resolver.isLoopbackAddress || resolver.isMulticastAddress) continue
      val address = InetAddress.getByAddress(raw).hostAddress.substringBefore('%').lowercase()
      if (address in excluded) continue
      val prefixLength = if (raw.size == 4) 32 else 128
      routes.putIfAbsent("$address/$prefixLength", ResolverRoute(address, prefixLength))
    }
    return routes.values.toList()
  }

  /** Parses IPv4 DNS packets through the same envelope used by the IPv6 path. */
  fun inspectIpv4(packet: ByteArray, readLength: Int): Inspection {
    if (readLength < 1 || readLength > packet.size) return Inspection.Malformed
    if (unsigned(packet[0]) ushr 4 != 4) return Inspection.NotDns
    if (readLength < IPV4_HEADER_SIZE) return Inspection.Malformed
    val headerLength = (unsigned(packet[0]) and 0x0f) * 4
    if (headerLength < IPV4_HEADER_SIZE || headerLength > readLength) return Inspection.Malformed
    if (unsigned(packet[9]) != UDP_PROTOCOL) return Inspection.NotDns
    val totalLength = read16(packet, 2)
    if (totalLength > readLength || totalLength < headerLength) return Inspection.Malformed
    if (read16(packet, 6) and 0x3fff != 0) return Inspection.Malformed
    if (!validIpv4HeaderChecksum(packet, headerLength)) return Inspection.Malformed
    if (totalLength < headerLength + UDP_HEADER_SIZE + DNS_HEADER_SIZE) return Inspection.Malformed
    val udpOffset = headerLength
    val sourcePort = read16(packet, udpOffset)
    val destinationPort = read16(packet, udpOffset + 2)
    if (sourcePort != DNS_PORT && destinationPort != DNS_PORT) return Inspection.NotDns
    val udpLength = read16(packet, udpOffset + 4)
    if (udpLength < UDP_HEADER_SIZE + DNS_HEADER_SIZE || udpLength > totalLength - udpOffset) return Inspection.Malformed
    val dnsLength = udpLength - UDP_HEADER_SIZE
    if (dnsLength > MAX_DNS_PAYLOAD_SIZE) return Inspection.Malformed
    // IPv4 permits a missing UDP checksum. A present checksum must cover
    // the pseudoheader and the complete segment, including odd-byte padding.
    if (read16(packet, udpOffset + 6) != 0 && !validIpv4UdpChecksum(packet, udpOffset, udpLength)) return Inspection.Malformed
    val dnsPayload = packet.copyOfRange(udpOffset + UDP_HEADER_SIZE, udpOffset + udpLength)
    return Inspection.UdpDns(DnsEnvelope(
      sourceAddress = packet.copyOfRange(12, 16),
      destinationAddress = packet.copyOfRange(16, 20),
      sourcePort = sourcePort,
      destinationPort = destinationPort,
      dnsPayload = dnsPayload,
      isQuery = unsigned(dnsPayload[2]) and 0x80 == 0
    ))
  }

  /**
   * Inspects outbound IPv6 requests. Extension scanning is bounded and reaches
   * destination port 53 before reporting an unsupported path as degraded DNS coverage.
   */
  fun inspectIpv6(packet: ByteArray, readLength: Int): Inspection {
    if (readLength < 1 || readLength > packet.size) return Inspection.Malformed
    if (unsigned(packet[0]) ushr 4 != 6) return Inspection.NotDns
    if (readLength < IPV6_HEADER_SIZE) return Inspection.Malformed

    val payloadLength = read16(packet, 4)
    // A zero payload length is a jumbogram marker; DNS jumbograms are unsupported.
    // Inspect the bytes actually available before treating a jumbogram as DNS.
    val packetEnd = if (payloadLength == 0) readLength else IPV6_HEADER_SIZE + payloadLength
    if (packetEnd > readLength) return Inspection.Malformed

    var nextHeader = unsigned(packet[6])
    var offset = IPV6_HEADER_SIZE
    var extensionCount = 0
    var extensionBytes = 0
    var sawHopByHop = false
    var unsupportedPointer: Int? = if (payloadLength == 0) 4 else null

    while (nextHeader in EXTENSION_HEADERS) {
      if (extensionCount >= MAX_INSPECT_EXTENSION_HEADERS || extensionBytes >= MAX_INSPECT_EXTENSION_BYTES) {
        return Inspection.Malformed
      }
      if ((extensionCount >= MAX_EXTENSION_HEADERS || extensionBytes >= MAX_EXTENSION_BYTES) && unsupportedPointer == null) {
        unsupportedPointer = offset
      }
      when (nextHeader) {
        HOP_BY_HOP, ROUTING, DESTINATION_OPTIONS -> {
          if (nextHeader == ROUTING && unsupportedPointer == null) unsupportedPointer = offset
          if (nextHeader == HOP_BY_HOP) {
            if (sawHopByHop || offset != IPV6_HEADER_SIZE) {
              if (unsupportedPointer == null) unsupportedPointer = offset
            }
            sawHopByHop = true
          }
          if (offset + 2 > packetEnd) return Inspection.Malformed
          val headerSize = (unsigned(packet[offset + 1]) + 1) * 8
          if (headerSize < 8 || offset + headerSize > packetEnd) return Inspection.Malformed
          if (extensionBytes + headerSize > MAX_INSPECT_EXTENSION_BYTES) return Inspection.Malformed
          if (extensionBytes + headerSize > MAX_EXTENSION_BYTES && unsupportedPointer == null) unsupportedPointer = offset
          if (nextHeader != ROUTING) {
            val optionScan = scanOptions(packet, offset + 2, offset + headerSize)
            if (!optionScan.wellFormed) return Inspection.Malformed
            if (optionScan.unsupportedPointer != null && unsupportedPointer == null) {
              unsupportedPointer = optionScan.unsupportedPointer
            }
          }
          nextHeader = unsigned(packet[offset])
          offset += headerSize
          extensionBytes += headerSize
        }
        in UNSUPPORTED_EXTENSION_HEADERS -> {
          if (offset + 2 > packetEnd) return Inspection.Malformed
          val headerSize = (unsigned(packet[offset + 1]) + 1) * 8
          if (headerSize < 8 || offset + headerSize > packetEnd) return Inspection.Malformed
          if (extensionBytes + headerSize > MAX_INSPECT_EXTENSION_BYTES) return Inspection.Malformed
          if (unsupportedPointer == null) unsupportedPointer = offset
          nextHeader = unsigned(packet[offset])
          offset += headerSize
          extensionBytes += headerSize
        }
        FRAGMENT -> {
          if (offset + 8 > packetEnd) return Inspection.Malformed
          if (extensionBytes + 8 > MAX_INSPECT_EXTENSION_BYTES) return Inspection.Malformed
          val fragmentBits = read16(packet, offset + 2)
          val fragmentOffset = fragmentBits ushr 3
          val moreFragments = fragmentBits and 1 != 0
          if (fragmentOffset != 0) return Inspection.NotDns
          if (moreFragments && unsupportedPointer == null) unsupportedPointer = offset + 2
          nextHeader = unsigned(packet[offset])
          offset += 8
          extensionBytes += 8
        }
        AUTHENTICATION -> {
          if (offset + 2 > packetEnd) return Inspection.Malformed
          val headerSize = (unsigned(packet[offset + 1]) + 2) * 4
          if (headerSize < 12 || offset + headerSize > packetEnd) return Inspection.Malformed
          if (extensionBytes + headerSize > MAX_INSPECT_EXTENSION_BYTES) return Inspection.Malformed
          if (unsupportedPointer == null) unsupportedPointer = offset
          nextHeader = unsigned(packet[offset])
          offset += headerSize
          extensionBytes += headerSize
        }
      }
      extensionCount += 1
    }

    if (nextHeader == UDP_PROTOCOL) {
      if (offset + UDP_HEADER_SIZE > packetEnd) return Inspection.Malformed
      val sourcePort = read16(packet, offset)
      val destinationPort = read16(packet, offset + 2)
      if (destinationPort != DNS_PORT) return Inspection.NotDns
      if (unsupportedPointer != null) return Inspection.Unsupported(unsupportedPointer)
      val udpLength = read16(packet, offset + 4)
      if (udpLength < UDP_HEADER_SIZE + DNS_HEADER_SIZE || udpLength != packetEnd - offset) return Inspection.Malformed
      val dnsLength = udpLength - UDP_HEADER_SIZE
      if (dnsLength > MAX_DNS_PAYLOAD_SIZE) return Inspection.Malformed
      val checksum = read16(packet, offset + 6)
      if (checksum == 0 || ipv6Checksum(packet, 8, 24, packet, offset, udpLength, UDP_PROTOCOL) != 0) {
        return Inspection.Malformed
      }
      val dnsOffset = offset + UDP_HEADER_SIZE
      val dnsPayload = packet.copyOfRange(dnsOffset, packetEnd)
      return Inspection.UdpDns(DnsEnvelope(
        sourceAddress = packet.copyOfRange(8, 24),
        destinationAddress = packet.copyOfRange(24, 40),
        sourcePort = sourcePort,
        destinationPort = destinationPort,
        dnsPayload = dnsPayload,
        isQuery = unsigned(dnsPayload[2]) and 0x80 == 0
      ))
    }

    if (nextHeader == TCP_PROTOCOL) {
      if (offset + 4 > packetEnd) return Inspection.Malformed
      if (read16(packet, offset + 2) != DNS_PORT) return Inspection.NotDns
      if (unsupportedPointer != null) return Inspection.Unsupported(unsupportedPointer)
      if (offset + TCP_MIN_HEADER_SIZE > packetEnd) return Inspection.Malformed
      val tcpHeaderSize = (unsigned(packet[offset + 12]) ushr 4) * 4
      if (tcpHeaderSize < TCP_MIN_HEADER_SIZE || offset + tcpHeaderSize > packetEnd) return Inspection.Malformed
      if (ipv6Checksum(packet, 8, 24, packet, offset, packetEnd - offset, TCP_PROTOCOL) != 0) return Inspection.Malformed
      return Inspection.TcpDns
    }

    return Inspection.NotDns
  }

  fun buildUdpResponse(query: DnsEnvelope, dnsResponse: ByteArray): ByteArray {
    require(query.sourceAddress.size == query.destinationAddress.size)
    require(dnsResponse.size in DNS_HEADER_SIZE..MAX_DNS_PAYLOAD_SIZE)
    if (query.sourceAddress.size == 4) return buildIpv4UdpResponse(query, dnsResponse)
    require(query.sourceAddress.size == 16)
    val udpLength = UDP_HEADER_SIZE + dnsResponse.size
    val response = ByteArray(IPV6_HEADER_SIZE + udpLength)
    response[0] = 0x60
    write16(response, 4, udpLength)
    response[6] = UDP_PROTOCOL.toByte()
    response[7] = 64
    query.destinationAddress.copyInto(response, 8)
    query.sourceAddress.copyInto(response, 24)
    write16(response, IPV6_HEADER_SIZE, query.destinationPort)
    write16(response, IPV6_HEADER_SIZE + 2, query.sourcePort)
    write16(response, IPV6_HEADER_SIZE + 4, udpLength)
    dnsResponse.copyInto(response, IPV6_HEADER_SIZE + UDP_HEADER_SIZE)
    val checksum = ipv6Checksum(response, 8, 24, response, IPV6_HEADER_SIZE, udpLength, UDP_PROTOCOL)
    write16(response, IPV6_HEADER_SIZE + 6, if (checksum == 0) 0xffff else checksum)
    return response
  }

  private fun buildIpv4UdpResponse(query: DnsEnvelope, dnsResponse: ByteArray): ByteArray {
    val totalLength = IPV4_HEADER_SIZE + UDP_HEADER_SIZE + dnsResponse.size
    val response = ByteArray(totalLength)
    response[0] = 0x45
    write16(response, 2, totalLength)
    response[8] = 64
    response[9] = UDP_PROTOCOL.toByte()
    query.destinationAddress.copyInto(response, 12)
    query.sourceAddress.copyInto(response, 16)
    write16(response, 10, ipv4Checksum(response))
    val udpOffset = IPV4_HEADER_SIZE
    write16(response, udpOffset, query.destinationPort)
    write16(response, udpOffset + 2, query.sourcePort)
    write16(response, udpOffset + 4, UDP_HEADER_SIZE + dnsResponse.size)
    // IPv4 permits a zero UDP checksum, matching the existing tunnel response format.
    dnsResponse.copyInto(response, udpOffset + UDP_HEADER_SIZE)
    return response
  }

  private fun validIpv4HeaderChecksum(packet: ByteArray, headerLength: Int): Boolean {
    var sum = 0
    for (offset in 0 until headerLength step 2) {
      sum += read16(packet, offset)
      while (sum > 0xffff) sum = (sum and 0xffff) + (sum ushr 16)
    }
    return sum == 0xffff
  }

  private fun validIpv4UdpChecksum(packet: ByteArray, udpOffset: Int, udpLength: Int): Boolean {
    var sum = UDP_PROTOCOL + udpLength
    for (offset in 12 until 20 step 2) sum += read16(packet, offset)
    val end = udpOffset + udpLength
    var offset = udpOffset
    while (offset < end) {
      val high = unsigned(packet[offset]) shl 8
      val low = if (offset + 1 < end) unsigned(packet[offset + 1]) else 0
      sum += high or low
      offset += 2
    }
    while (sum > 0xffff) sum = (sum and 0xffff) + (sum ushr 16)
    return sum == 0xffff
  }

  private fun ipv4Checksum(packet: ByteArray): Int {
    var sum = 0
    var offset = 0
    while (offset < IPV4_HEADER_SIZE) {
      if (offset == 10) {
        offset += 2
        continue
      }
      sum += (unsigned(packet[offset]) shl 8) or unsigned(packet[offset + 1])
      while (sum > 0xffff) sum = (sum and 0xffff) + (sum ushr 16)
      offset += 2
    }
    return sum.inv() and 0xffff
  }

  fun buildIcmpv6PortUnreachable(packet: ByteArray, readLength: Int): ByteArray? =
    buildIcmpv6Error(packet, readLength, type = 1, code = 4, pointer = null)

  /** Fail closed when a routed packet requires IPv6 processing this DNS-only tunnel does not implement. */
  fun buildIcmpv6AdminProhibited(packet: ByteArray, readLength: Int): ByteArray? =
    buildIcmpv6Error(packet, readLength, type = 1, code = 1, pointer = null)

  private fun buildIcmpv6Error(packet: ByteArray, readLength: Int, type: Int, code: Int, pointer: Int?): ByteArray? {
    if (readLength < IPV6_HEADER_SIZE || readLength > packet.size || unsigned(packet[0]) ushr 4 != 6) return null
    val quoteLength = minOf(readLength, MAX_ICMPV6_QUOTE_BYTES)
    val icmpLength = 8 + quoteLength
    val response = ByteArray(IPV6_HEADER_SIZE + icmpLength)
    response[0] = 0x60
    write16(response, 4, icmpLength)
    response[6] = ICMPV6_PROTOCOL.toByte()
    response[7] = 64
    packet.copyOfRange(24, 40).copyInto(response, 8)
    packet.copyOfRange(8, 24).copyInto(response, 24)
    response[IPV6_HEADER_SIZE] = type.toByte()
    response[IPV6_HEADER_SIZE + 1] = code.toByte()
    if (pointer != null) write32(response, IPV6_HEADER_SIZE + 4, pointer)
    packet.copyOfRange(0, quoteLength).copyInto(response, IPV6_HEADER_SIZE + 8)
    val checksum = ipv6Checksum(response, 8, 24, response, IPV6_HEADER_SIZE, icmpLength, ICMPV6_PROTOCOL)
    write16(response, IPV6_HEADER_SIZE + 2, if (checksum == 0) 0xffff else checksum)
    return response
  }

  private fun ipv6Checksum(
    addresses: ByteArray,
    sourceOffset: Int,
    destinationOffset: Int,
    segment: ByteArray,
    segmentOffset: Int,
    segmentLength: Int,
    nextHeader: Int
  ): Int {
    var sum = 0L
    fun add(bytes: ByteArray, offset: Int, length: Int) {
      var index = offset
      val end = offset + length
      while (index < end) {
        val high = unsigned(bytes[index]) shl 8
        val low = if (index + 1 < end) unsigned(bytes[index + 1]) else 0
        sum += high or low
        index += 2
      }
    }
    add(addresses, sourceOffset, 16)
    add(addresses, destinationOffset, 16)
    sum += ((segmentLength ushr 16) and 0xffff).toLong()
    sum += (segmentLength and 0xffff).toLong()
    sum += nextHeader.toLong()
    add(segment, segmentOffset, segmentLength)
    while (sum ushr 16 != 0L) sum = (sum and 0xffff) + (sum ushr 16)
    return (sum.inv() and 0xffff).toInt()
  }

  private data class OptionScan(val wellFormed: Boolean, val unsupportedPointer: Int?)

  private fun scanOptions(packet: ByteArray, start: Int, end: Int): OptionScan {
    var offset = start
    var unsupportedPointer: Int? = null
    while (offset < end) {
      val kind = unsigned(packet[offset])
      if (kind == 0) {
        offset += 1
        continue
      }
      if (offset + 2 > end) return OptionScan(false, null)
      val dataLength = unsigned(packet[offset + 1])
      if (offset + 2 + dataLength > end) return OptionScan(false, null)
      if (kind != 1 && kind and 0xc0 != 0 && unsupportedPointer == null) unsupportedPointer = offset
      offset += 2 + dataLength
    }
    return OptionScan(true, unsupportedPointer)
  }

  private fun read16(bytes: ByteArray, offset: Int): Int = (unsigned(bytes[offset]) shl 8) or unsigned(bytes[offset + 1])

  private fun write16(bytes: ByteArray, offset: Int, value: Int) {
    bytes[offset] = (value ushr 8).toByte()
    bytes[offset + 1] = value.toByte()
  }

  private fun write32(bytes: ByteArray, offset: Int, value: Int) {
    bytes[offset] = (value ushr 24).toByte()
    bytes[offset + 1] = (value ushr 16).toByte()
    bytes[offset + 2] = (value ushr 8).toByte()
    bytes[offset + 3] = value.toByte()
  }

  private fun unsigned(byte: Byte): Int = byte.toInt() and 0xff

  private const val HOP_BY_HOP = 0
  private const val ROUTING = 43
  private const val FRAGMENT = 44
  private const val AUTHENTICATION = 51
  private const val DESTINATION_OPTIONS = 60
  private val UNSUPPORTED_EXTENSION_HEADERS = setOf(135, 139, 140)
  private val EXTENSION_HEADERS = setOf(HOP_BY_HOP, ROUTING, FRAGMENT, AUTHENTICATION, DESTINATION_OPTIONS) + UNSUPPORTED_EXTENSION_HEADERS
}
