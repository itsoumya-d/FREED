package app.freed.protection

import java.net.DatagramSocket
import java.util.concurrent.TimeUnit

/** Owns every DNS worker/racer and UDP socket, independent of Android service flags. */
internal class FreedDnsRuntimeOwnership {
  private val lock = Any()
  private var epoch = 0L
  private var accepting = false
  private val threads = linkedMapOf<Thread, Long>()
  private val sockets = linkedSetOf<DatagramSocket>()

  fun beginEpoch(): Long = synchronized(lock) {
    threads.keys.removeAll { !it.isAlive }
    sockets.removeAll { it.isClosed }
    epoch += 1
    accepting = true
    epoch
  }

  fun threadEpoch(): Long = synchronized(lock) { threads[Thread.currentThread()] ?: -1L }
  fun isCurrentEpoch(expected: Long): Boolean = synchronized(lock) { accepting && expected == epoch }
  fun isCurrentThreadEpoch(): Boolean = isCurrentEpoch(threadEpoch())

  fun withEpoch(expected: Long, operation: () -> Unit): Boolean = synchronized(lock) {
    if (!accepting || expected != epoch) return@synchronized false
    operation()
    true
  }

  fun startThread(expected: Long, name: String, operation: () -> Unit): Thread? = synchronized(lock) {
    if (!accepting || expected != epoch) return@synchronized null
    threads.keys.removeAll { !it.isAlive }
    val worker = Thread({
      try { operation() }
      catch (error: InterruptedException) {
        if (isCurrentThreadEpoch()) throw error
        Thread.currentThread().interrupt()
      }
    }, name).apply { isDaemon = true }
    threads[worker] = expected
    // Start under the ownership lock: teardown cannot overlook an unstarted racer.
    worker.start()
    worker
  }

  fun registerUdpSocket(expected: Long, socket: DatagramSocket): Boolean = synchronized(lock) {
    sockets.add(socket)
    if (accepting && expected == epoch) return@synchronized true
    runCatching { socket.close() }
    if (socket.isClosed) sockets.remove(socket)
    false
  }

  fun releaseUdpSocket(socket: DatagramSocket) = synchronized(lock) {
    if (socket.isClosed) sockets.remove(socket)
  }

  fun closeAndInterrupt(): Boolean {
    val owned = synchronized(lock) {
      accepting = false
      epoch += 1
      sockets.toList() to threads.keys.toList()
    }
    val closed = owned.first.map { socket -> runCatching { socket.close(); socket.isClosed }.getOrDefault(false) }.all { it }
    owned.second.forEach { worker -> runCatching { worker.interrupt() } }
    return closed
  }

  fun awaitStopped(timeoutMs: Long): Boolean {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs.coerceAtLeast(0L))
    val owned = synchronized(lock) { threads.keys.toList() }
    owned.forEach { worker ->
      val remaining = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime())
      if (worker.isAlive && worker !== Thread.currentThread() && remaining > 0L) runCatching { worker.join(remaining) }
    }
    return synchronized(lock) {
      threads.keys.removeAll { !it.isAlive }
      sockets.removeAll { it.isClosed }
      !accepting && threads.isEmpty() && sockets.isEmpty()
    }
  }

  fun isStopped(): Boolean = synchronized(lock) { !accepting && threads.keys.none { it.isAlive } && sockets.all { it.isClosed } }
}
