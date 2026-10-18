package app.freed.protection

import java.net.InetAddress

fun main(args: Array<String>) {
  val ipv4RouteResolver = InetAddress.getByAddress(byteArrayOf(1, 1, 1, 1))
  val ipv6Resolver = InetAddress.getByAddress(byteArrayOf(
    0x20, 0x01, 0x48, 0x60.toByte(), 0x48, 0x60.toByte(), 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0x88.toByte()
  ))
  val mappedRoutes = FreedDnsPacketPolicy.resolverRoutes(listOf(ipv4RouteResolver, ipv6Resolver))
  check(mappedRoutes.any { it.address == "1.1.1.1" && it.prefixLength == 32 })
  check(mappedRoutes.any { it.prefixLength == 128 && InetAddress.getByName(it.address).address.contentEquals(ipv6Resolver.address) })
  check(mappedRoutes.size == 2) // The live LinkProperties resolver snapshot maps only its resolver hosts.

  val question = byteArrayOf(0x12, 0x34, 0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0,
    1, 'a'.code.toByte(), 0, 0, 1, 0, 1)
  val response = question.copyOf().also { it[2] = 0x81.toByte(); it[3] = 0x80.toByte() }
  val ipv4Client = InetAddress.getByAddress(byteArrayOf(10, 94, 0, 2))
  val ipv4Resolver = InetAddress.getByAddress(byteArrayOf(1, 1, 1, 3))
  fun ipv4Udp(dns: ByteArray, sourcePort: Int = 53000, destinationPort: Int = 53): ByteArray {
    val bytes = ByteArray(20 + 8 + dns.size)
    bytes[0] = 0x45
    put16(bytes, 2, bytes.size)
    bytes[8] = 64
    bytes[9] = 17
    ipv4Client.address.copyInto(bytes, 12)
    ipv4Resolver.address.copyInto(bytes, 16)
    put16(bytes, 20, sourcePort)
    put16(bytes, 22, destinationPort)
    put16(bytes, 24, 8 + dns.size)
    dns.copyInto(bytes, 28)
    put16(bytes, 10, ipv4HeaderChecksum(bytes))
    return bytes
  }
  val ipv4Query = ipv4Udp(question)
  if (args.isEmpty() || args.firstOrNull() == "i4") {
    // Hand-derived checksum 0x0d81 includes the IPv4 pseudoheader and odd final DNS byte.
    val validPresentChecksum = ipv4Query.copyOf().also { put16(it, 26, 0x0d81) }
    check(FreedDnsPacketPolicy.inspectIpv4(validPresentChecksum, validPresentChecksum.size) is FreedDnsPacketPolicy.Inspection.UdpDns)
    check(FreedDnsPacketPolicy.inspectIpv4(ipv4Query, ipv4Query.size) is FreedDnsPacketPolicy.Inspection.UdpDns) // Zero is permitted.
    val invalidPresentChecksum = ipv4Query.copyOf().also { put16(it, 26, 0x1234) }
    check(FreedDnsPacketPolicy.inspectIpv4(invalidPresentChecksum, invalidPresentChecksum.size) === FreedDnsPacketPolicy.Inspection.Malformed) {
      "I4: corrupt nonzero IPv4 UDP checksum was accepted"
    }
    val corruptedDnsPayload = validPresentChecksum.copyOf().also { it[41] = 'b'.code.toByte() }
    check(FreedDnsPacketPolicy.inspectIpv4(corruptedDnsPayload, corruptedDnsPayload.size) === FreedDnsPacketPolicy.Inspection.Malformed)
    val unrelatedV4 = ipv4Udp(question, destinationPort = 443).also { put16(it, 26, 0x1234) }
    check(FreedDnsPacketPolicy.inspectIpv4(unrelatedV4, unrelatedV4.size) === FreedDnsPacketPolicy.Inspection.NotDns)
    println("I4 IPv4 zero/valid nonzero checksum and corrupt checksum/payload rejection cases passed")
    if (args.firstOrNull() == "i4") return
  }
  val ipv4Parsed = FreedDnsPacketPolicy.inspectIpv4(ipv4Query, ipv4Query.size)
  check(ipv4Parsed is FreedDnsPacketPolicy.Inspection.UdpDns)
  val ipv4Envelope = ipv4Parsed.envelope
  check(ipv4Envelope.isQuery && ipv4Envelope.dnsPayload.contentEquals(question))
  val ipv4Response = FreedDnsPacketPolicy.buildUdpResponse(ipv4Envelope, response)
  val ipv4Returned = FreedDnsPacketPolicy.inspectIpv4(ipv4Response, ipv4Response.size)
  check(ipv4Returned is FreedDnsPacketPolicy.Inspection.UdpDns)
  check(!ipv4Returned.envelope.isQuery)
  check(ipv4Returned.envelope.sourceAddress.contentEquals(ipv4Resolver.address))
  check(ipv4Returned.envelope.destinationAddress.contentEquals(ipv4Client.address))
  check(ipv4Returned.envelope.dnsPayload.copyOfRange(0, 2).contentEquals(question.copyOfRange(0, 2)))
  check(ipv4Returned.envelope.dnsPayload[3].toInt() and 0x0f == response[3].toInt() and 0x0f)
  check(ipv4Returned.envelope.dnsPayload.copyOfRange(12, ipv4Returned.envelope.dnsPayload.size)
    .contentEquals(question.copyOfRange(12, question.size)))
  check(validIpv4HeaderChecksum(ipv4Response) && ipv4Response[26].toInt() == 0 && ipv4Response[27].toInt() == 0)

  val declaredTruncatedV4 = ipv4Query.copyOf().also {
    put16(it, 2, it.size + 1); put16(it, 10, 0); put16(it, 10, ipv4HeaderChecksum(it))
  }
  check(FreedDnsPacketPolicy.inspectIpv4(declaredTruncatedV4, declaredTruncatedV4.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val fragmentedV4 = ipv4Query.copyOf().also {
    put16(it, 6, 1); put16(it, 10, 0); put16(it, 10, ipv4HeaderChecksum(it))
  }
  check(FreedDnsPacketPolicy.inspectIpv4(fragmentedV4, fragmentedV4.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val badHeaderV4 = ipv4Query.copyOf().also { it[8] = 63 }
  check(FreedDnsPacketPolicy.inspectIpv4(badHeaderV4, badHeaderV4.size) === FreedDnsPacketPolicy.Inspection.Malformed)

  val client = InetAddress.getByAddress(byteArrayOf(0x20, 1, 0x0d, 0xb8.toByte(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1))
  val resolver = InetAddress.getByAddress(byteArrayOf(0x20, 1, 0x0d, 0xb8.toByte(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 53))

  fun packet(nextHeader: Int, payload: ByteArray, extension: Boolean = false): ByteArray {
    val udpOffset = 40 + if (extension) 8 else 0
    val bytes = ByteArray(udpOffset + payload.size)
    bytes[0] = 0x60
    put16(bytes, 4, bytes.size - 40)
    bytes[6] = (if (extension) 60 else nextHeader).toByte()
    bytes[7] = 64
    client.address.copyInto(bytes, 8)
    resolver.address.copyInto(bytes, 24)
    if (extension) {
      bytes[40] = nextHeader.toByte()
      bytes[41] = 0
    }
    payload.copyInto(bytes, udpOffset)
    return bytes
  }

  fun udp(dns: ByteArray, sourcePort: Int = 53000, destinationPort: Int = 53, extension: Boolean = false): ByteArray {
    val bytes = ByteArray(8 + dns.size)
    put16(bytes, 0, sourcePort)
    put16(bytes, 2, destinationPort)
    put16(bytes, 4, bytes.size)
    dns.copyInto(bytes, 8)
    val framed = packet(17, bytes, extension)
    put16(framed, (if (extension) 48 else 40) + 6, udpChecksum(framed, if (extension) 48 else 40))
    return framed
  }

  if (args.isEmpty() || args.firstOrNull() == "i3") {
    val source53Ordinary = udp(question, sourcePort = 53, destinationPort = 443, extension = true).also { it[42] = 0x82.toByte() }
    check(FreedDnsPacketPolicy.inspectIpv6(source53Ordinary, source53Ordinary.size) === FreedDnsPacketPolicy.Inspection.NotDns) {
      "I3: outbound source53 to destination443 was classified as unsupported DNS"
    }
    val routingSource53 = packet(43, byteArrayOf(17, 0, 0, 0, 0, 0, 0, 0) +
      udp(question, sourcePort = 53, destinationPort = 443).copyOfRange(40, 8 + 40 + question.size))
    val jumboSource53 = source53Ordinary.copyOf().also { put16(it, 4, 0) }
    val health = FreedDnsGuardPolicy.PacketHealth()
    val generation = health.beginGeneration()
    for (ordinarySource53 in listOf(source53Ordinary, routingSource53, jumboSource53)) {
      val inspected = FreedDnsPacketPolicy.inspectIpv6(ordinarySource53, ordinarySource53.size)
      check(inspected === FreedDnsPacketPolicy.Inspection.NotDns)
      check(!health.recordIpv6(generation, inspected))
    }
    check(health.unsupportedDnsPackets.get() == 0L && FreedDnsGuardPolicy.filteringActive(true, false, "off", health.unsupportedDnsPackets.get()))
    val source53Dns = udp(question, sourcePort = 53, destinationPort = 53)
    check(FreedDnsPacketPolicy.inspectIpv6(source53Dns, source53Dns.size) is FreedDnsPacketPolicy.Inspection.UdpDns)
    println("I3 outbound destination53 admission, unrelated source53 and unchanged coverage cases passed")
    if (args.firstOrNull() == "i3") return
  }

  val query = udp(question, extension = true)
  val parsed = FreedDnsPacketPolicy.inspectIpv6(query, query.size)
  check(parsed is FreedDnsPacketPolicy.Inspection.UdpDns)
  val envelope = parsed.envelope
  check(envelope.dnsPayload.contentEquals(question) && envelope.isQuery)
  val synthesized = FreedDnsPacketPolicy.buildUdpResponse(envelope, response)
  // The TUN parser admits outbound requests only. Decode the generated inbound
  // reply independently so its source53 cannot weaken production admission.
  check(FreedDnsPacketPolicy.inspectIpv6(synthesized, synthesized.size) === FreedDnsPacketPolicy.Inspection.NotDns)
  val returned = readIpv6DnsReply(synthesized)
  check(!returned.isQuery)
  check(returned.sourceAddress.contentEquals(resolver.address) && returned.destinationAddress.contentEquals(client.address))
  check(returned.dnsPayload.copyOfRange(0, 2).contentEquals(question.copyOfRange(0, 2)))
  check(returned.dnsPayload.copyOfRange(12, returned.dnsPayload.size).contentEquals(question.copyOfRange(12, question.size)))
  check(validUdpChecksum(synthesized, 40)) // IPv6 UDP response checksum is mandatory and valid.

  val ordinary = packet(17, byteArrayOf(0x14, 0x9c.toByte(), 0x01, 0xbb.toByte(), 0, 8, 0, 0))
  check(FreedDnsPacketPolicy.inspectIpv6(ordinary, ordinary.size) === FreedDnsPacketPolicy.Inspection.NotDns)
  val tcp = packet(6, byteArrayOf(0x14, 0x9c.toByte(), 0, 53, 0, 0, 0, 0, 0, 0, 0, 0, 0x50, 0x10, 0, 0, 0, 0, 0, 0)).also {
    put16(it, 56, checksum(it, 40, it.size - 40, nextHeader = 6))
  }
  check(FreedDnsPacketPolicy.inspectIpv6(tcp, tcp.size) is FreedDnsPacketPolicy.Inspection.TcpDns)
  val badTcpChecksum = tcp.copyOf().also { it[56] = (it[56].toInt() xor 1).toByte() }
  check(FreedDnsPacketPolicy.inspectIpv6(badTcpChecksum, badTcpChecksum.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val tcpFailure = FreedDnsPacketPolicy.buildIcmpv6PortUnreachable(tcp, tcp.size) ?: error("IPv6 DNS TCP must fail fast")
  check(tcpFailure[6].toInt() and 0xff == 58 && tcpFailure[40].toInt() and 0xff == 1 && tcpFailure[41].toInt() and 0xff == 4)
  check(validIcmpv6Checksum(tcpFailure))

  val unsupportedOptions = query.copyOf().also { it[42] = 0x82.toByte() }
  val unsupported = FreedDnsPacketPolicy.inspectIpv6(unsupportedOptions, unsupportedOptions.size)
  check(unsupported is FreedDnsPacketPolicy.Inspection.Unsupported)
  check(unsupported.pointer == 42)
  val unsupportedResponse = FreedDnsPacketPolicy.buildIcmpv6AdminProhibited(unsupportedOptions, unsupportedOptions.size)
    ?: error("Unsupported IPv6 extension options must fail fast")
  check(unsupportedResponse[40].toInt() and 0xff == 1 && unsupportedResponse[41].toInt() and 0xff == 1)
  check(validIcmpv6Checksum(unsupportedResponse))
  val unsupportedOrdinary = udp(question, destinationPort = 443, extension = true).also { it[42] = 0x82.toByte() }
  check(FreedDnsPacketPolicy.inspectIpv6(unsupportedOrdinary, unsupportedOrdinary.size) === FreedDnsPacketPolicy.Inspection.NotDns)
  val routingHeader = packet(43, byteArrayOf(17, 0, 0, 0, 0, 0, 0, 0) + udp(question).copyOfRange(40, udp(question).size))
  check(FreedDnsPacketPolicy.inspectIpv6(routingHeader, routingHeader.size) is FreedDnsPacketPolicy.Inspection.Unsupported)
  val routingOrdinary = packet(43, byteArrayOf(17, 0, 0, 0, 0, 0, 0, 0) + udp(question, destinationPort = 443).copyOfRange(40, udp(question, destinationPort = 443).size))
  check(FreedDnsPacketPolicy.inspectIpv6(routingOrdinary, routingOrdinary.size) === FreedDnsPacketPolicy.Inspection.NotDns)

  // Zero payload length must still prove a port-53 transport before degrading DNS.
  val zeroLengthOrdinary = ordinary.copyOf().also { put16(it, 4, 0) }
  check(FreedDnsPacketPolicy.inspectIpv6(zeroLengthOrdinary, zeroLengthOrdinary.size) === FreedDnsPacketPolicy.Inspection.NotDns)
  val zeroLengthDns = udp(question).also { put16(it, 4, 0) }
  check(FreedDnsPacketPolicy.inspectIpv6(zeroLengthDns, zeroLengthDns.size) is FreedDnsPacketPolicy.Inspection.Unsupported)
  val emptyJumbo = ByteArray(40).also { it[0] = 0x60; it[6] = 17 }
  check(FreedDnsPacketPolicy.inspectIpv6(emptyJumbo, emptyJumbo.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val nonInitialFragment = fragmentedFixture(packet(17, ByteArray(8)), offsetBits = 8)
  check(FreedDnsPacketPolicy.inspectIpv6(nonInitialFragment, nonInitialFragment.size) === FreedDnsPacketPolicy.Inspection.NotDns)

  val truncatedBase = ByteArray(39).also { it[0] = 0x60 }
  check(FreedDnsPacketPolicy.inspectIpv6(truncatedBase, truncatedBase.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  check(FreedDnsPacketPolicy.inspectIpv6(query, query.size - 1) === FreedDnsPacketPolicy.Inspection.Malformed)
  val oversized = udp(ByteArray(4097).also { it[2] = 1; it[5] = 1 })
  check(FreedDnsPacketPolicy.inspectIpv6(oversized, oversized.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val badChecksum = query.copyOf().also { it[54] = (it[54].toInt() xor 1).toByte() }
  check(FreedDnsPacketPolicy.inspectIpv6(badChecksum, badChecksum.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val fragmented = packet(44, byteArrayOf(17, 0, 0, 1, 0, 0, 0, 1) + udp(question).copyOfRange(40, udp(question).size))
  check(FreedDnsPacketPolicy.inspectIpv6(fragmented, fragmented.size) is FreedDnsPacketPolicy.Inspection.Unsupported)
  val tooManyExtensions = ByteArray(40 + 5 * 8 + 8 + question.size).also { bytes ->
    bytes[0] = 0x60; put16(bytes, 4, bytes.size - 40); bytes[6] = 60; bytes[7] = 64
    client.address.copyInto(bytes, 8); resolver.address.copyInto(bytes, 24)
    repeat(5) { index -> bytes[40 + index * 8] = (if (index == 4) 17 else 60).toByte() }
    val offset = 40 + 5 * 8
    put16(bytes, offset, 53000); put16(bytes, offset + 2, 53); put16(bytes, offset + 4, 8 + question.size)
    question.copyInto(bytes, offset + 8)
  }
  check(FreedDnsPacketPolicy.inspectIpv6(tooManyExtensions, tooManyExtensions.size) is FreedDnsPacketPolicy.Inspection.Unsupported)
  val excessiveExtensionBytes = packet(60, ByteArray(2048).also { it[0] = 17; it[1] = 0xff.toByte() } + udp(question).copyOfRange(40, udp(question).size))
  check(FreedDnsPacketPolicy.inspectIpv6(excessiveExtensionBytes, excessiveExtensionBytes.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val badOptionAfterUnsupported = query.copyOf().also {
    it[42] = 0x82.toByte(); it[43] = 0; it[44] = 1; it[45] = 5
  }
  check(FreedDnsPacketPolicy.inspectIpv6(badOptionAfterUnsupported, badOptionAfterUnsupported.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val atomicFragment = fragmentedFixture(udp(question), offsetBits = 0)
  check(FreedDnsPacketPolicy.inspectIpv6(atomicFragment, atomicFragment.size) is FreedDnsPacketPolicy.Inspection.UdpDns)
  val initialOrdinaryFragment = fragmentedFixture(udp(question, destinationPort = 443), offsetBits = 1)
  check(FreedDnsPacketPolicy.inspectIpv6(initialOrdinaryFragment, initialOrdinaryFragment.size) === FreedDnsPacketPolicy.Inspection.NotDns)
  val missingChecksum = udp(question).also { put16(it, 46, 0) }
  check(FreedDnsPacketPolicy.inspectIpv6(missingChecksum, missingChecksum.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val badUdpLength = udp(question).also { put16(it, 44, 8) }
  check(FreedDnsPacketPolicy.inspectIpv6(badUdpLength, badUdpLength.size) === FreedDnsPacketPolicy.Inspection.Malformed)
  val tooManyOrdinary = tooManyExtensions.copyOf().also { put16(it, 40 + 5 * 8 + 2, 443) }
  check(FreedDnsPacketPolicy.inspectIpv6(tooManyOrdinary, tooManyOrdinary.size) === FreedDnsPacketPolicy.Inspection.NotDns)
  val nxdomain = response.copyOf().also { it[3] = 0x83.toByte() }
  val denied = FreedDnsPacketPolicy.buildUdpResponse(envelope, nxdomain)
  check(denied[51].toInt() and 0x0f == 3 && validUdpChecksum(denied, 40))
  val largeUnsupported = oversized.copyOf().also { it[6] = 6 }
  val quote = checkNotNull(FreedDnsPacketPolicy.buildIcmpv6AdminProhibited(largeUnsupported, largeUnsupported.size))
  check(quote.size == 1280 && validIcmpv6Checksum(quote))
  println("Android IPv4/IPv6 DNS route mapping and UDP round trips/checksums, ordinary IPv6 preservation, TCP fail-fast, and bounded/malformed packet cases passed")
}

private fun put16(bytes: ByteArray, offset: Int, value: Int) {
  bytes[offset] = (value ushr 8).toByte()
  bytes[offset + 1] = value.toByte()
}

private data class Ipv6Reply(val sourceAddress: ByteArray, val destinationAddress: ByteArray, val dnsPayload: ByteArray, val isQuery: Boolean)

private fun readIpv6DnsReply(packet: ByteArray): Ipv6Reply {
  fun read16(offset: Int) = ((packet[offset].toInt() and 0xff) shl 8) or (packet[offset + 1].toInt() and 0xff)
  check(packet.size >= 60 && packet[0].toInt() and 0xf0 == 0x60 && packet[6].toInt() == 17)
  check(read16(4) == packet.size - 40 && read16(44) == packet.size - 40)
  check(read16(40) == 53 && read16(42) == 53000 && validUdpChecksum(packet, 40))
  val dns = packet.copyOfRange(48, packet.size)
  return Ipv6Reply(packet.copyOfRange(8, 24), packet.copyOfRange(24, 40), dns, dns[2].toInt() and 0x80 == 0)
}

private fun ipv4HeaderChecksum(packet: ByteArray): Int {
  var sum = 0
  for (offset in 0 until 20 step 2) {
    if (offset == 10) continue
    sum += ((packet[offset].toInt() and 0xff) shl 8) or (packet[offset + 1].toInt() and 0xff)
    while (sum > 0xffff) sum = (sum and 0xffff) + (sum ushr 16)
  }
  return sum.inv() and 0xffff
}

private fun validIpv4HeaderChecksum(packet: ByteArray): Boolean {
  var sum = 0
  for (offset in 0 until 20 step 2) {
    sum += ((packet[offset].toInt() and 0xff) shl 8) or (packet[offset + 1].toInt() and 0xff)
    while (sum > 0xffff) sum = (sum and 0xffff) + (sum ushr 16)
  }
  return sum == 0xffff
}

private fun udpChecksum(packet: ByteArray, offset: Int): Int = checksum(packet, offset, packet.size - offset)

private fun validUdpChecksum(packet: ByteArray, offset: Int): Boolean =
  (packet[offset + 6].toInt() != 0 || packet[offset + 7].toInt() != 0) &&
    checksum(packet, offset, packet.size - offset) == 0

private fun validIcmpv6Checksum(packet: ByteArray): Boolean =
  checksum(packet, 40, packet.size - 40, nextHeader = 58) == 0

private fun checksum(
  packet: ByteArray,
  offset: Int,
  length: Int,
  nextHeader: Int = 17
): Int {
  var sum = 0L
  fun add(start: Int, size: Int) {
    var index = start
    val end = start + size
    while (index < end) {
      sum += ((packet[index].toInt() and 0xff) shl 8) or
        (if (index + 1 < end) packet[index + 1].toInt() and 0xff else 0)
      index += 2
    }
  }
  add(8, 32)
  sum += (length ushr 16).toLong() + (length and 0xffff).toLong() + nextHeader.toLong()
  add(offset, length)
  while (sum ushr 16 != 0L) sum = (sum and 0xffff) + (sum ushr 16)
  return (sum.inv() and 0xffff).toInt()
}

private fun fragmentedFixture(base: ByteArray, offsetBits: Int): ByteArray {
  val result = ByteArray(base.size + 8)
  base.copyInto(result, endIndex = 40)
  result[6] = 44
  result[40] = base[6]
  put16(result, 4, result.size - 40)
  put16(result, 42, offsetBits)
  base.copyInto(result, 48, 40)
  return result
}
