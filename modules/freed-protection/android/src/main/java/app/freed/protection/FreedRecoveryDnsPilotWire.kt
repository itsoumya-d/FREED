package app.freed.protection

import java.io.ByteArrayOutputStream
import java.net.InetAddress

internal object FreedRecoveryDnsPilotWire {
  const val SUFFIX = ".probe.freedrecovery.web.app"
  fun host(nonce: String, denied: Boolean = false): String {
    require(FreedRecoveryDnsPilotPolicy.validReference(nonce))
    return "${if (denied) "b" else "a"}.$nonce$SUFFIX"
  }
  fun query(host: String, type: Int, transaction: Int): ByteArray {
    require(type in setOf(1, 28) && host.length <= 253)
    val output = ByteArrayOutputStream()
    output.write(byteArrayOf((transaction ushr 8).toByte(), transaction.toByte(), 1, 0, 0, 1, 0, 0, 0, 0, 0, 0))
    host.split('.').forEach { label ->
      require(label.length in 1..63 && label.all { it in 'a'..'z' || it in '0'..'9' || it == '-' })
      output.write(label.length); output.write(label.toByteArray(Charsets.US_ASCII))
    }
    output.write(byteArrayOf(0, 0, type.toByte(), 0, 1))
    return output.toByteArray()
  }
  private fun unsigned(value: Byte) = value.toInt() and 255
  private fun short(bytes: ByteArray, at: Int) = (unsigned(bytes[at]) shl 8) or unsigned(bytes[at + 1])
  private fun questionEnd(bytes: ByteArray): Int? {
    if (bytes.size !in 12..FreedDohPolicy.MAX_RESPONSE_BYTES || short(bytes, 4) != 1) return null
    var at = 12
    while (at < bytes.size) {
      val count = unsigned(bytes[at++])
      if (count == 0) return (at + 4).takeIf { it <= bytes.size }
      if (count > 63 || at + count > bytes.size) return null
      at += count
    }
    return null
  }
  /** REFUSED is an authenticated policy answer, unlike a transport error or SERVFAIL. */
  fun accept(response: ByteArray, query: ByteArray): Boolean {
    val end = questionEnd(query) ?: return false
    val responseEnd = questionEnd(response) ?: return false
    return end == responseEnd && response[0] == query[0] && response[1] == query[1] &&
      unsigned(response[2]) and 0xf8 == (unsigned(query[2]) or 0x80) and 0xf8 &&
      unsigned(response[2]) and 0x02 == 0 && unsigned(response[3]) and 15 in setOf(0, 3, 5) &&
      response.copyOfRange(12, end).contentEquals(query.copyOfRange(12, end))
  }
  fun refused(response: ByteArray, query: ByteArray): Boolean = accept(response, query) &&
    unsigned(response[3]) and 15 == 5 && short(response, 6) == 0 && short(response, 8) == 0 && short(response, 10) == 0 &&
    response.size == questionEnd(query)

  fun sentinel(response: ByteArray, query: ByteArray, type: Int): Boolean {
    if (!accept(response, query) || unsigned(response[3]) and 15 != 0 || short(response, 6) != 1) return false
    var at = questionEnd(response) ?: return false
    // The pilot emits exactly one address RR. Accept a pointer to the exact question or its literal name.
    if (at + 2 <= response.size && unsigned(response[at]) == 0xc0 && unsigned(response[at + 1]) == 12) at += 2
    else {
      val name = query.copyOfRange(12, (questionEnd(query) ?: return false) - 4)
      if (at + name.size > response.size || !response.copyOfRange(at, at + name.size).contentEquals(name)) return false
      at += name.size
    }
    if (at + 10 > response.size || short(response, at) != type || short(response, at + 2) != 1) return false
    if ((at + 4..at + 7).any { response[it].toInt() != 0 }) return false
    val expected = InetAddress.getByName(if (type == 1) "198.51.100.42" else "2001:db8::42").address
    val length = short(response, at + 8); at += 10
    return length == expected.size && at + length == response.size &&
      response.copyOfRange(at, at + length).contentEquals(expected) && short(response, 8) == 0 && short(response, 10) == 0
  }
}
