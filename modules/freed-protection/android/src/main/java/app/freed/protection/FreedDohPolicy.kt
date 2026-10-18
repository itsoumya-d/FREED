package app.freed.protection

import java.net.InetAddress
import java.net.UnknownHostException
import java.io.InputStream

internal object FreedDohPolicy {
  const val URL = "https://family.cloudflare-dns.com/dns-query"
  const val HOST = "family.cloudflare-dns.com"
  const val MAX_RESPONSE_BYTES = 4096

  fun readResponseBody(stream: InputStream): ByteArray {
    val buffer = ByteArray(MAX_RESPONSE_BYTES + 1)
    var length = 0
    while (length < buffer.size) {
      val count = stream.read(buffer, length, buffer.size - length)
      if (count < 0) break
      if (count == 0) continue
      length += count
    }
    return buffer.copyOf(length)
  }

  // Literal bootstrap addresses avoid resolving this hostname through our own
  // intercepted DNS path. HTTPS still verifies the hostname and normal CA chain.
  fun bootstrapAddresses(host: String): List<InetAddress> {
    if (host != HOST) throw UnknownHostException("Unapproved encrypted DNS host")
    return listOf(InetAddress.getByAddress(byteArrayOf(1, 1, 1, 3)),
      InetAddress.getByAddress(byteArrayOf(1, 0, 0, 3)))
  }

  fun acceptResponse(code: Int, type: String?, response: ByteArray, query: ByteArray): Boolean {
    if (code != 200 || type?.substringBefore(';')?.trim()?.lowercase() != "application/dns-message") return false
    if (response.size !in 12..MAX_RESPONSE_BYTES || query.size !in 12..MAX_RESPONSE_BYTES) return false
    if (response[0] != query[0] || response[1] != query[1]) return false
    if (response[2].toInt() and 0x80 == 0) return false
    if (response[2].toInt() and 0x78 != query[2].toInt() and 0x78) return false
    // SERVFAIL and REFUSED are failures, not evidence of a healthy resolver.
    if (response[3].toInt() and 0x0f !in listOf(0, 3)) return false
    val end = questionEnd(query) ?: return false
    val responseEnd = questionEnd(response) ?: return false
    return end == responseEnd && query.copyOfRange(12, end).contentEquals(response.copyOfRange(12, responseEnd))
  }

  private fun questionEnd(bytes: ByteArray): Int? {
    if (bytes.size < 12 || bytes[4].toInt() != 0 || bytes[5].toInt() != 1) return null
    var offset = 12
    while (offset < bytes.size) {
      val length = bytes[offset].toInt() and 0xff
      offset += 1
      if (length == 0) return (offset + 4).takeIf { it <= bytes.size }
      if (length > 63 || offset + length > bytes.size) return null
      offset += length
    }
    return null
  }
}
