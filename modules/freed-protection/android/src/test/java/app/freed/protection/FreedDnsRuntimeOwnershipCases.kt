package app.freed.protection

import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.SocketException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

fun main() {
  // Disposable localhost UDP fixtures only. No device VPN, real DNS, or owner reset API.
  val ownership = FreedDnsRuntimeOwnership()
  val epoch = ownership.beginEpoch()
  val socket = DatagramSocket(null).apply { bind(InetSocketAddress(InetAddress.getLoopbackAddress(), 0)) }
  check(ownership.registerUdpSocket(epoch, socket))
  val entered = CountDownLatch(1)
  val closedReceive = AtomicBoolean(false)
  val racer = ownership.startThread(epoch, "FreedDnsRace-fixture") {
    entered.countDown()
    try { socket.receive(DatagramPacket(ByteArray(32), 32)) }
    catch (_: SocketException) { closedReceive.set(socket.isClosed) }
    finally { ownership.releaseUdpSocket(socket) }
  } ?: error("Fixture racer should start")
  check(entered.await(2, TimeUnit.SECONDS))
  check(racer.isAlive)
  check(ownership.closeAndInterrupt())
  check(ownership.awaitStopped(2_000))
  check(socket.isClosed && !racer.isAlive && closedReceive.get())
  var writes = 0
  check(!ownership.withEpoch(epoch) { writes += 1 })
  val nextEpoch = ownership.beginEpoch()
  check(nextEpoch > epoch)
  check(!ownership.withEpoch(epoch) { writes += 1 })
  check(ownership.withEpoch(nextEpoch) { writes += 1 })
  check(writes == 1)
  check(ownership.closeAndInterrupt())
  check(ownership.startThread(nextEpoch, "FreedDnsRace-late-fixture") { error("Late work must not start") } == null)
  val lateSocket = DatagramSocket(null)
  check(!ownership.registerUdpSocket(nextEpoch, lateSocket))
  check(lateSocket.isClosed)
  check(ownership.awaitStopped(2_000))
  check(ownership.isStopped())
  println("Owned DNS racers: blocked UDP receive closed/joined, stale epochs cannot publish, and late work is rejected")
}
