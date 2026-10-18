package app.freed.protection

import java.io.IOException
import java.net.Proxy
import java.net.Socket
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** HTTPS wireformat transport. It has no plaintext transport or redirect path. */
internal class FreedEncryptedDnsUpstream(protectSocket: (Socket) -> Boolean) {
  private val client = OkHttpClient.Builder()
    .socketFactory(FreedProtectedSocketFactory(protectSocket))
    .dns(object : Dns {
      override fun lookup(hostname: String) = FreedDohPolicy.bootstrapAddresses(hostname)
    })
    .proxy(Proxy.NO_PROXY)
    .followRedirects(false)
    .followSslRedirects(false)
    .retryOnConnectionFailure(false)
    .connectTimeout(2, TimeUnit.SECONDS)
    .readTimeout(3, TimeUnit.SECONDS)
    .callTimeout(5, TimeUnit.SECONDS)
    .build()

  fun forward(query: ByteArray): ByteArray {
    if (query.size !in 12..FreedDohPolicy.MAX_RESPONSE_BYTES) throw IOException("Invalid DNS query size")
    val request = Request.Builder().url(FreedDohPolicy.URL)
      .header("Accept", "application/dns-message")
      .header("Accept-Encoding", "identity")
      .post(query.toRequestBody("application/dns-message".toMediaType()))
      .build()
    client.newCall(request).execute().use { response ->
      val body = response.body ?: throw IOException("Empty DoH response")
      if (body.contentLength() > FreedDohPolicy.MAX_RESPONSE_BYTES) throw IOException("Oversized DoH response")
      // Bound chunked responses too, before allocating the full payload.
      val bytes = FreedDohPolicy.readResponseBody(body.byteStream())
      if (!FreedDohPolicy.acceptResponse(response.code, body.contentType()?.toString(), bytes, query)) {
        throw IOException("Invalid DoH response")
      }
      return bytes
    }
  }

  fun close() {
    client.dispatcher.cancelAll()
    client.connectionPool.evictAll()
  }
}
