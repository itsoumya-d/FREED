package app.freed.protection

import android.content.Context
import android.net.DnsResolver
import android.os.Build
import android.os.CancellationSignal
import android.os.SystemClock
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

/** Public system-resolver checks, correlated with the actual VPN handler; never an HTTPS reachability check. */
internal object FreedRecoveryDnsPilotRouteCheck {
  private val gate = Semaphore(1)
  private val lock = Any()
  private class Attempt(val descriptor: String, val networkEpoch: String, val queries: List<ByteArray>) {
    val observed = mutableSetOf<Int>()
  }
  private data class Receipt(val id: String, val reference: String, val descriptor: String,
    val ownerDigest: String, val generation: String, val networkEpoch: String, val issued: Long) {
    fun publicValue(): Map<String, Any?> = mapOf("id" to id, "reference" to reference,
      "nativeConfigurationGeneration" to generation, "networkEpoch" to networkEpoch,
      "checkedAtElapsedMs" to issued.toDouble(), "expiresAtElapsedMs" to (issued + 30_000L).toDouble(),
      "routeVerified" to true, "denyVerified" to true)
  }
  private var attempt: Attempt? = null
  private var receipt: Receipt? = null
  fun invalidate() = synchronized(lock) { attempt = null; receipt = null }

  fun observed(query: ByteArray, response: ByteArray, descriptor: String, networkEpoch: String) = synchronized(lock) {
    val active = attempt ?: return@synchronized
    if (active.descriptor != descriptor || active.networkEpoch != networkEpoch) return@synchronized
    active.queries.forEachIndexed { index, expected ->
      // Android may rewrite the transaction ID. The exact random name, type and class must match.
      if (query.size == expected.size && query.copyOfRange(12, query.size).contentEquals(expected.copyOfRange(12, expected.size))) {
        val valid = if (index == 2) FreedRecoveryDnsPilotWire.refused(response, query)
          else FreedRecoveryDnsPilotWire.sentinel(response, query, if (index == 0) 1 else 28)
        if (valid) active.observed.add(index)
      }
    }
  }

  fun current(context: Context, candidate: FreedRecoveryDnsPilotPolicy.Candidate, scope: String,
    foreground: () -> Boolean): Map<String, Any?>? {
    val value = synchronized(lock) { receipt } ?: return null
    val now = SystemClock.elapsedRealtime()
    return value.takeIf {
      now >= it.issued && now - it.issued <= 30_000L && foreground() &&
        FreedAppGroupStore.ownerScopeCurrent(scope) && it.ownerDigest == FreedRecoveryDnsPilotPolicy.digest(scope) &&
        it.reference == candidate.reference && it.descriptor == FreedRecoveryDnsPilot.descriptor(candidate) &&
        it.generation == candidate.configurationGeneration && it.networkEpoch == FreedVpnService.recoveryDnsNetworkEpoch() &&
        FreedRecoveryDnsPilot.routeReady(context, candidate)
    }?.takeIf { synchronized(lock) { receipt === value } }?.publicValue()
  }

  fun run(context: Context, candidate: FreedRecoveryDnsPilotPolicy.Candidate, scope: String,
    foreground: () -> Boolean, admitted: () -> Boolean): Map<String, Any?> {
    check(Build.VERSION.SDK_INT >= 29) { "recovery-dns-system-resolver-api-unavailable" }
    check(gate.tryAcquire()) { "recovery-dns-route-check-busy" }
    val signals = mutableListOf<CancellationSignal>()
    try {
      check(foreground() && admitted() && FreedRecoveryDnsPilot.routeReady(context, candidate)) { "recovery-dns-route-not-ready" }
      val descriptor = FreedRecoveryDnsPilot.descriptor(candidate)
      val epoch = FreedVpnService.recoveryDnsNetworkEpoch()
      val nonce = UUID.randomUUID().toString().replace("-", "")
      val queries = listOf(FreedRecoveryDnsPilotWire.query(FreedRecoveryDnsPilotWire.host(nonce), 1, 0x4651),
        FreedRecoveryDnsPilotWire.query(FreedRecoveryDnsPilotWire.host(nonce), 28, 0x4652),
        FreedRecoveryDnsPilotWire.query(FreedRecoveryDnsPilotWire.host(nonce, true), 1, 0x4653))
      val active = Attempt(descriptor, epoch, queries)
      synchronized(lock) { attempt = active; receipt = null }
      val done = CountDownLatch(3)
      val answers = java.util.concurrent.ConcurrentHashMap<Int, Boolean>()
      val callbackExecutor = Executor { it.run() }
      queries.forEachIndexed { index, query ->
        val signal = CancellationSignal(); signals.add(signal)
        DnsResolver.getInstance().rawQuery(null, query,
          DnsResolver.FLAG_NO_CACHE_LOOKUP or DnsResolver.FLAG_NO_CACHE_STORE or DnsResolver.FLAG_NO_RETRY,
          callbackExecutor, signal, object : DnsResolver.Callback<ByteArray> {
            override fun onAnswer(answer: ByteArray, rcode: Int) {
              // Bind answers to the exact sent question and expected test-only response.
              val expected = query.copyOf().also { if (answer.size >= 2) { it[0] = answer[0]; it[1] = answer[1] } }
              answers[index] = if (index == 2) rcode == 5 && FreedRecoveryDnsPilotWire.refused(answer, expected)
                else rcode == 0 && FreedRecoveryDnsPilotWire.sentinel(answer, expected, if (index == 0) 1 else 28)
              done.countDown()
            }
            override fun onError(error: DnsResolver.DnsException) { answers[index] = false; done.countDown() }
          })
      }
      val deadline = SystemClock.elapsedRealtime() + 12_000L
      while (done.count > 0 && SystemClock.elapsedRealtime() < deadline) {
        check(foreground() && admitted() && epoch == FreedVpnService.recoveryDnsNetworkEpoch() &&
          FreedRecoveryDnsPilot.routeReady(context, candidate)) { "recovery-dns-route-check-stale" }
        done.await(100, TimeUnit.MILLISECONDS)
      }
      check(done.count == 0L && answers.size == 3 && answers.values.all { it }) { "recovery-dns-system-route-failed" }
      check(foreground() && admitted() && epoch == FreedVpnService.recoveryDnsNetworkEpoch() &&
        FreedRecoveryDnsPilot.routeReady(context, candidate)) { "recovery-dns-route-check-stale" }
      val proof = synchronized(lock) {
        check(attempt === active && active.observed == setOf(0, 1, 2)) { "recovery-dns-vpn-route-unobserved" }
        Receipt(UUID.randomUUID().toString(), candidate.reference, descriptor, FreedRecoveryDnsPilotPolicy.digest(scope),
          candidate.configurationGeneration, epoch, SystemClock.elapsedRealtime()).also { receipt = it }.publicValue()
      }
      return proof
    } finally {
      signals.forEach { it.cancel() }
      synchronized(lock) { attempt = null }
      gate.release()
    }
  }
}
