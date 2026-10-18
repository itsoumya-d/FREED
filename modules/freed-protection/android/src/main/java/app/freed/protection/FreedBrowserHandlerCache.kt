package app.freed.protection

/** Only state transitions take this lock. Android queries never execute under it or an enforcement lock. */
internal class FreedBrowserHandlerCache {
  enum class State { READY, REFRESHING, UNAVAILABLE }
  data class Snapshot(val packages: Set<String>, val checkedAtMs: Long?, val generation: Long, val state: State, val failure: String?)
  data class Query(val generation: Long, val startedAtMs: Long)

  companion object { const val TTL_MS = 60_000L }
  private val lock = Any()
  private var connected = false
  private var generation = 0L
  private var packages = emptySet<String>()
  private var checkedAtMs: Long? = null
  private var lastObservedMs: Long? = null
  private var lastAttemptMs: Long? = null
  private var refreshRequested = false
  private var inFlight: Query? = null
  private var state = State.UNAVAILABLE
  private var failure: String? = "service-disconnected"

  fun connect(now: Long): Unit = synchronized(lock) {
    generation += 1
    connected = true
    packages = emptySet()
    checkedAtMs = null
    lastObservedMs = now
    lastAttemptMs = null
    refreshRequested = true
    state = State.REFRESHING
    failure = null
  }

  fun disconnect(reason: String = "service-disconnected"): Unit = synchronized(lock) {
    generation += 1
    connected = false
    packages = emptySet()
    checkedAtMs = null
    refreshRequested = false
    state = State.UNAVAILABLE
    failure = reason
  }

  fun invalidate(now: Long): Unit = synchronized(lock) {
    if (!connected) return@synchronized
    observeTime(now)
    generation += 1
    packages = emptySet()
    checkedAtMs = null
    refreshRequested = true
    state = State.REFRESHING
    failure = null
  }

  fun beginQuery(now: Long): Query? = synchronized(lock) {
    if (!connected) return@synchronized null
    observeTime(now)
    if (inFlight != null) return@synchronized null
    val last = lastAttemptMs
    if (!refreshRequested && last != null && now - last < TTL_MS) return@synchronized null
    val query = Query(generation, now)
    inFlight = query
    lastAttemptMs = now
    refreshRequested = false
    packages = emptySet()
    checkedAtMs = null
    state = State.REFRESHING
    failure = null
    query
  }

  fun complete(query: Query, result: Set<String>?, now: Long, reason: String? = null): Unit = synchronized(lock) {
    if (inFlight !== query) return@synchronized
    inFlight = null
    if (!connected) return@synchronized
    observeTime(now)
    if (query.generation != generation) return@synchronized
    if (result == null || now < query.startedAtMs || now - query.startedAtMs >= TTL_MS) {
      packages = emptySet()
      checkedAtMs = null
      state = State.UNAVAILABLE
      failure = reason ?: "query-expired"
    } else {
      packages = result.toSet()
      checkedAtMs = query.startedAtMs
      state = State.READY
      failure = null
    }
  }

  fun snapshot(now: Long): Snapshot = synchronized(lock) {
    if (connected) observeTime(now)
    val checked = checkedAtMs
    if (state == State.READY && (checked == null || now < checked || now - checked >= TTL_MS)) {
      Snapshot(emptySet(), checked, generation, State.REFRESHING, "snapshot-expired")
    } else {
      Snapshot(if (state == State.READY) packages else emptySet(), checked, generation, state, failure)
    }
  }

  private fun observeTime(now: Long) {
    if (lastObservedMs?.let { now < it } == true) {
      generation += 1
      packages = emptySet()
      checkedAtMs = null
      lastAttemptMs = null
      refreshRequested = true
      state = State.REFRESHING
      failure = "monotonic-clock-rollback"
    }
    lastObservedMs = now
  }
}
