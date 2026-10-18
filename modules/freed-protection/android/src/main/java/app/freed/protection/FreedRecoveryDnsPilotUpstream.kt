package app.freed.protection

import android.net.Network
import java.io.IOException
import java.net.InetAddress
import java.net.Proxy
import java.net.Socket
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import okhttp3.Call
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/** Fixed TLS hostname, normal CA validation, protected network-bound sockets, no fallback. */
internal class FreedRecoveryDnsPilotUpstream private constructor(
  internal val descriptor: String, candidate: FreedRecoveryDnsPilotPolicy.Candidate,
  network: Network, addresses: List<InetAddress>, protect: (Socket) -> Boolean
) {
  internal val networkHandle = network.networkHandle
  private val endpoint = FreedRecoveryDnsPilotPolicy.endpoint(candidate.rawSecret)
  private val lifecycleLock = Any()
  private var closed = false
  private val calls = linkedSetOf<Call>()
  private val client = OkHttpClient.Builder()
    .socketFactory(FreedProtectedSocketFactory { socket ->
      protect(socket) && runCatching { network.bindSocket(socket); true }.getOrDefault(false)
    })
    .dns(object : Dns {
      override fun lookup(hostname: String): List<InetAddress> {
        if (hostname != FreedRecoveryDnsPilotPolicy.HOST) throw IOException("Unapproved DNS host")
        return addresses
      }
    }).proxy(Proxy.NO_PROXY).followRedirects(false).followSslRedirects(false)
    .retryOnConnectionFailure(false).connectTimeout(2, TimeUnit.SECONDS)
    .readTimeout(3, TimeUnit.SECONDS).callTimeout(5, TimeUnit.SECONDS).build()

  fun forward(query: ByteArray): ByteArray {
    if (query.size !in 12..FreedDohPolicy.MAX_RESPONSE_BYTES) throw IOException("Invalid DNS query")
    val request = Request.Builder().url(endpoint).header("Accept", "application/dns-message")
      .header("Accept-Encoding", "identity").post(query.toRequestBody("application/dns-message".toMediaType())).build()
    val call = synchronized(lifecycleLock) {
      check(!closed) { "recovery-dns-transport-closed" }
      client.newCall(request).also { calls.add(it) }
    }
    try { call.execute().use { response ->
      val body = response.body ?: throw IOException("Missing DNS response")
      if (response.code != 200 || body.contentType()?.toString()?.substringBefore(';')?.trim()?.lowercase() != "application/dns-message" ||
        body.contentLength() > FreedDohPolicy.MAX_RESPONSE_BYTES) throw IOException("Invalid DNS response")
      val bytes = FreedDohPolicy.readResponseBody(body.byteStream())
      if (!FreedRecoveryDnsPilotWire.accept(bytes, query)) throw IOException("Invalid DNS response")
      return bytes
    } } finally { synchronized(lifecycleLock) { calls.remove(call) } }
  }
  fun close() {
    synchronized(lifecycleLock) { closed = true; calls.forEach { it.cancel() } }
    client.dispatcher.cancelAll(); client.connectionPool.evictAll()
  }
  override fun toString() = "RecoveryDnsPilotUpstream(redacted)"

  companion object {
    // A stalled platform resolver occupies at most one daemon; retries cannot create unbounded threads.
    private val bootstrap = ThreadPoolExecutor(0, 1, 10L, TimeUnit.SECONDS, SynchronousQueue<Runnable>(),
      { job -> Thread(job, "freed-recovery-dns-bootstrap").apply { isDaemon = true } })
    fun prepare(candidate: FreedRecoveryDnsPilotPolicy.Candidate, descriptor: String, network: Network,
      protect: (Socket) -> Boolean): FreedRecoveryDnsPilotUpstream {
      val lookup = bootstrap.submit<List<InetAddress>> { network.getAllByName(FreedRecoveryDnsPilotPolicy.HOST).toList() }
      val addresses = try { lookup.get(3, TimeUnit.SECONDS) } finally { lookup.cancel(true) }
      require(addresses.isNotEmpty() && addresses.size <= 16 && addresses.none {
        it.isAnyLocalAddress || it.isLoopbackAddress || it.isLinkLocalAddress || it.isMulticastAddress || it.isSiteLocalAddress
      })
      return FreedRecoveryDnsPilotUpstream(descriptor, candidate, network, addresses, protect)
    }
  }
}
