const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

// Execute current service methods; replace Android scheduling/connectivity and
// resource I/O only. This verifies source integration, never a built VPN/device.
const root = resolve(__dirname, '../../..');
const nativeRoot = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const args = process.argv.slice(2);
const serviceSource = args.find(arg => arg.startsWith('--service-source='))?.slice('--service-source='.length);
const caseArgs = args.filter(arg => !arg.startsWith('--service-source='));
const source = readFileSync(serviceSource || join(root, nativeRoot, 'FreedVpnService.kt'), 'utf8');
function method(name) {
  return declaration(`  private fun ${name}(`);
}
function declaration(prefix) {
  const start = source.indexOf(prefix);
  assert.ok(start >= 0, `Production declaration ${prefix} must exist.`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`Unclosed declaration ${prefix}`);
}
const fixture = `package app.freed.protection
import android.content.Context
import java.net.InetAddress
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

internal data class DnsEnvelope(
  val sourceAddress: ByteArray,
  val destinationAddress: ByteArray,
  val sourcePort: Int,
  val destinationPort: Int,
  val dnsPayload: ByteArray,
  val isQuery: Boolean
)

data class Network(val id: Int)
data class LinkProperties(val dnsServers: List<InetAddress>)
class NetworkCapabilities(private val vpn: Boolean) {
  companion object { const val TRANSPORT_VPN = 4; const val NET_CAPABILITY_INTERNET = 12 }
  @Suppress("UNUSED_PARAMETER") fun hasTransport(transport: Int) = vpn
  @Suppress("UNUSED_PARAMETER") fun hasCapability(capability: Int) = true
}
class ConnectivityManager {
  open class NetworkCallback {
    open fun onAvailable(network: Network) {}
    open fun onLinkPropertiesChanged(network: Network, linkProperties: LinkProperties) {}
    open fun onLost(network: Network) {}
  }
  var activeNetwork: Network? = Network(1)
  val properties = mutableMapOf(Network(1) to LinkProperties(listOf(
    InetAddress.getByName("192.0.2.53"), InetAddress.getByName("2001:db8::53"))))
  val allNetworks: List<Network> get() = properties.keys.toList()
  fun getNetworkCapabilities(network: Network) = properties[network]?.let { NetworkCapabilities(network.id == 99) }
  var unregisters = 0
  @Suppress("UNUSED_PARAMETER") fun unregisterNetworkCallback(callback: Any) { unregisters += 1 }
  fun getLinkProperties(network: Network) = properties[network]
}
object FreedNetworkDnsState {
  data class State(val mode: String)
  var mode = "off"
  var readHook: (() -> Unit)? = null
  @Suppress("UNUSED_PARAMETER") fun read(context: Any): State { readHook?.invoke(); return State(mode) }
}
class ParcelFileDescriptor { var closes = 0; fun close() { closes += 1 } }
class FakeOutput { var closes = 0; fun close() { closes += 1 } }
class FakeUpstream {
  var closes = 0
  fun close() { closes += 1 }
  fun forward(query: ByteArray) = query
}
object FreedEncryptedDnsConfig {
  data class Capability(val supported: Boolean)
  @Suppress("UNUSED_PARAMETER") fun capability(context: Any) = Capability(true)
  @Suppress("UNUSED_PARAMETER") fun withPlaintextPermission(context: Any, operation: () -> Boolean): Boolean? =
    error("Fixture must never send DNS")
}
object FreedProtectionConfiguration { @Suppress("UNUSED_PARAMETER") fun interceptionEnabled(context: Any) = true }
object FreedDohPolicy { const val URL = "https://fixture.invalid/dns-query" }
object SystemClock { fun elapsedRealtime() = 100L }
object Looper { fun getMainLooper() = Unit }
@Suppress("UNUSED_PARAMETER")
class Handler(looper: Unit) {
  companion object {
    val callbacks = mutableListOf<() -> Unit>()
    fun drain() { val copy = callbacks.toList(); callbacks.clear(); copy.forEach { it() } }
  }
  fun post(action: () -> Unit) { callbacks += action }
  fun postDelayed(action: () -> Unit, delay: Long) { callbacks += action }
}

internal class FreedVpnService : Context() {
  val manager = ConnectivityManager()
  var connectivityManager: ConnectivityManager? = manager
  val runtimeOwnership = FreedDnsRuntimeOwnership()
  var guardEpoch = runtimeOwnership.beginEpoch()
  val dnsPacketHealth = FreedDnsGuardPolicy.PacketHealth()
  var packetGeneration = dnsPacketHealth.beginGeneration()
  val dnsGuardMalformedPackets = AtomicLong(0L)
  var resolverSnapshotNetworks: Set<Network> = emptySet()
  var resolverSnapshotActiveNetwork: Network? = null
  val lostResolverNetworks = mutableSetOf<Network>()
  var networkResolvers = emptyList<String>()
  var networkResolverRoutes = emptyList<FreedDnsPacketPolicy.ResolverRoute>()
  var resolverRouteRestartEpoch: Long? = null
  var networkCallback: Any? = "callback"
  var dnsGuardIpv4ResolverRouteCount = 1
  var dnsGuardIpv6ResolverRouteCount = 1
  val encryptedUpstreamDelegate = lazy { FakeUpstream() }
  var healthResets = 0
  var probeGeneration = 0L
  var activeRuntimeService: FreedVpnService? = this
  val serviceOwners = setOf(this)
  var ownerCloseSucceeded = true
  var runtimeCloseSucceeded = true
  var readerThread: Thread? = null
  var captivePortalPaused = false
  var dnsGuardCaptivePaused = false
  var cachedFeed = emptySet<String>()
  var cachedFeedSize = -1
  var cachedFeedRefreshedAtElapsedMs = 0L
  fun isUserEnabled(context: Context) = true
  var isRunning = true
    set(value) {
      val restarting = value && !field
      field=value
      if(value) activeRuntimeService=this
      // The fixture's explicit false→true transition stands for the real start's
      // OS resolver snapshot capture after actual stop unregisters old networks.
      if(restarting) captureCurrentNetworkResolverSnapshot()
    }
  var notifications = 0
  var stopCalls = 0
  var startCalls = 0
  var selfStops = 0
  var foregroundStops = 0
  var stopReason: String? = null
  var lastForwardFailure: String? = null
  var lastForwardResolver: String? = null
  var encryptedDnsHealthGeneration = 0L
  val unadmittedInterfaces = java.util.concurrent.ConcurrentHashMap.newKeySet<ParcelFileDescriptor>()
  var vpnInterface: ParcelFileDescriptor? = ParcelFileDescriptor()
  var output: FakeOutput? = FakeOutput()
  val outputLock = Any()
  var workersRunning = true
  val workerThreads = mutableListOf<Thread>()
  var probeThread: Thread? = null
  val pendingWork = ConcurrentLinkedQueue<Int>()
  val workPermits = Semaphore(0)
  val VPN_ADDRESS = "10.94.0.2"
  val MAX_NETWORK_RESOLVERS = 4
  val DNS_PORT = 53
  val MAX_DNS_PAYLOAD_SIZE = 4096
  val RESOLVER_TIMEOUT_MS = 1
  val STOP_REASON_RESOLVER_ROUTES_CHANGED = "resolver-routes-changed"
  val ACTION_START = "start"
  @Suppress("UNCHECKED_CAST", "UNUSED_PARAMETER")
  fun <T> getSystemService(type: Class<T>): T? = manager as? T
  fun resetEncryptedDnsHealth() { healthResets += 1 }
  fun notifyRuntimeStateChanged() { notifications += 1 }
  fun stopDnsGuard(reason: String) { stopCalls += 1; actualStopDnsGuard(reason) }
  ${method('stopDnsGuard').replace('private fun stopDnsGuard(', 'private fun actualStopDnsGuard(')}
  @Suppress("UNUSED_PARAMETER") fun startServiceAction(context: Any, action: String) { startCalls += 1 }
  fun markDnsGuardStopped(reason: String) { isRunning = false; stopReason = reason }
  fun stopForegroundGuard() { foregroundStops += 1 }
  fun stopSelf() { selfStops += 1 }
  private fun publishDnsMetadata(operation: () -> Unit) = runtimeOwnership.withEpoch(runtimeOwnership.threadEpoch(), operation)
  @Suppress("UNUSED_PARAMETER") private fun recordEncryptedDnsHealth(healthy: Boolean, generation: Long) {}
  @Suppress("UNUSED_PARAMETER") private fun recordForwardLatency(elapsedMs: Long) {}
  fun capture() = captureCurrentNetworkResolverSnapshot()
  fun refresh(network: Network?, epoch: Long = guardEpoch) = refreshNetworkResolvers(network, epoch)
  fun inspect(packet: ByteArray, generation: Long = packetGeneration) = inspectIpv6DnsPacket(packet, packet.size, generation)
  fun admitIpv4(packet: ByteArray) = parseDnsEnvelope(packet, packet.size)
  fun finish(descriptor: ParcelFileDescriptor) = finishDnsGuardFromLoop(descriptor, "loop-ended")
  fun encryptedForward() = forwardEncryptedDns(ByteArray(12))
  fun resolverForward() = forwardDnsToResolver(ByteArray(12), "192.0.2.53")
  @Suppress("UNUSED_PARAMETER") fun protect(socket: DatagramSocket) = true
  fun lost(network: Network) = NetworkCallback(guardEpoch).onLost(network)
  fun available(network: Network) = NetworkCallback(guardEpoch).onAvailable(network)
${method('captureCurrentNetworkResolverSnapshot')}
${method('currentResolverNetworks')}
${source.includes('  private fun currentResolverActiveNetwork(') ? method('currentResolverActiveNetwork') : ''}
${method('updateNetworkResolverSnapshot')}
${method('refreshNetworkResolvers')}
${method('scheduleResolverRouteRestart')}
${method('stopForDnsPrivacy')}
${method('inspectIpv6DnsPacket')}
${method('parseDnsEnvelope')}
${method('finishDnsGuardFromLoop')}
${method('unregisterNetworkWatch')}
${method('forwardEncryptedDns')}
${method('forwardDnsToResolver')}
${declaration('  private inner class NetworkCallback(')}
}

fun main(args: Array<String>) {
  if (args.firstOrNull() == "i3-ipv4") { ipv4AdmissionReviewCase(); return }
  if (args.firstOrNull() == "i1") { activeNetworkReviewCase(); return }
  if (args.firstOrNull() == "i2") { latePrivacyWorkerReviewCase(); return }
  if (args.firstOrNull() == "i2-udp-first") { latePrivacyWorkerReviewCase("udp-first"); return }
  if (args.firstOrNull() == "i2-udp-second") { latePrivacyWorkerReviewCase("udp-second"); return }
  val staleAdult = FreedVpnService()
  staleAdult.capture()
  staleAdult.manager.properties[Network(1)] = LinkProperties(listOf(InetAddress.getByName("192.0.2.54")))
  staleAdult.refresh(Network(1))
  check(Handler.callbacks.isNotEmpty())
  FreedAdultAuthorizationExecutor.advance()
  Handler.drain()
  check(staleAdult.stopCalls == 0 && staleAdult.startCalls == 0) { "Stale adult-generation route callback must not stop/restart the repaired policy" }
  activeNetworkReviewCase()
  latePrivacyWorkerReviewCase()
  latePrivacyWorkerReviewCase("udp-first")
  latePrivacyWorkerReviewCase("udp-second")
  ipv4AdmissionReviewCase()
  val masked = FreedVpnService()
  masked.manager.properties[Network(99)] = LinkProperties(listOf(InetAddress.getByName("10.94.0.2")))
  masked.manager.activeNetwork = Network(99)
  masked.capture()
  check(masked.networkResolvers == listOf("192.0.2.53", "2001:db8:0:0:0:0:0:53"))
  masked.refresh(Network(99))
  check(masked.healthResets == 0 && Handler.callbacks.isEmpty())
  val multi = FreedVpnService()
  multi.manager.properties[Network(2)] = LinkProperties(listOf(InetAddress.getByName("192.0.2.54")))
  multi.capture()
  multi.manager.properties[Network(99)] = LinkProperties(listOf(InetAddress.getByName("10.94.0.2")))
  multi.manager.activeNetwork = Network(99)
  multi.refresh(Network(99))
  check(multi.healthResets == 0 && Handler.callbacks.isEmpty()) // VPN masking must not create a rebuild loop.
  val guard = FreedVpnService()
  guard.capture()
  check(guard.networkResolvers == listOf("192.0.2.53", "2001:db8:0:0:0:0:0:53"))
  check(guard.networkResolverRoutes.map { it.prefixLength } == listOf(32, 128))
  val upstream = guard.encryptedUpstreamDelegate.value
  // Unsupported routing extension, with an actual outbound UDP/53 header.
  val dns = ByteArray(56).also { bytes ->
    bytes[0] = 0x60; bytes[5] = 16; bytes[6] = 43; bytes[40] = 17
    bytes[48] = 0x14; bytes[49] = 0x9c.toByte(); bytes[51] = 53
  }
  val ordinarySource53 = dns.copyOf().also { it[48] = 0; it[49] = 53; it[50] = 1; it[51] = 0xbb.toByte() }
  val ordinaryGuard = FreedVpnService()
  check(ordinaryGuard.inspect(ordinarySource53) === FreedDnsPacketPolicy.Inspection.NotDns)
  check(ordinaryGuard.dnsPacketHealth.unsupportedDnsPackets.get() == 0L && ordinaryGuard.notifications == 0)
  check(FreedDnsGuardPolicy.filteringActive(true, false, "off", ordinaryGuard.dnsPacketHealth.unsupportedDnsPackets.get()))
  check(guard.inspect(dns) is FreedDnsPacketPolicy.Inspection.Unsupported)
  check(guard.dnsPacketHealth.unsupportedDnsPackets.get() == 1L && guard.notifications == 1)
  guard.refresh(Network(1)); guard.refresh(Network(1))
  check(guard.dnsPacketHealth.unsupportedDnsPackets.get() == 1L)
  check(guard.healthResets == 0 && upstream.closes == 0 && Handler.callbacks.isEmpty())
  val ordinary = dns.copyOf().also { it[50] = 1; it[51] = 0xbb.toByte() }
  check(guard.inspect(ordinary) === FreedDnsPacketPolicy.Inspection.NotDns)
  check(guard.dnsPacketHealth.unsupportedDnsPackets.get() == 1L && guard.notifications == 1)

  // Same resolvers on a different network still require a real new generation.
  guard.manager.properties[Network(2)] = guard.manager.properties.getValue(Network(1))
  guard.manager.activeNetwork = Network(2)
  guard.refresh(Network(2)); guard.refresh(Network(2))
  check(guard.healthResets == 1 && upstream.closes == 1 && Handler.callbacks.size == 1)
  check(guard.dnsPacketHealth.unsupportedDnsPackets.get() == 1L) // Wait for actual rebuild.
  Handler.drain()
  check(guard.stopCalls == 1 && guard.startCalls == 1 && guard.stopReason == "resolver-routes-changed")
  val oldEpoch = guard.guardEpoch
  val oldGeneration = guard.packetGeneration
  guard.guardEpoch = guard.runtimeOwnership.beginEpoch()
  guard.packetGeneration = guard.dnsPacketHealth.beginGeneration()
  guard.isRunning = true
  val resets = guard.healthResets
  guard.refresh(Network(1), oldEpoch)
  guard.inspect(dns, oldGeneration)
  check(guard.healthResets == resets && guard.dnsPacketHealth.unsupportedDnsPackets.get() == 0L)
  check(guard.resolverSnapshotNetworks == setOf(Network(1), Network(2)))

  // Old pending rebuild/privacy callbacks cannot stop the replacement epoch.
  guard.manager.properties[Network(1)] = LinkProperties(listOf(InetAddress.getByName("192.0.2.54")))
  guard.refresh(Network(1))
  guard.guardEpoch = guard.runtimeOwnership.beginEpoch()
  Handler.drain()
  check(guard.stopCalls == 1 && guard.startCalls == 1)
  FreedNetworkDnsState.mode = "hostname"
  guard.refresh(Network(1))
  guard.guardEpoch = guard.runtimeOwnership.beginEpoch()
  Handler.drain()
  check(guard.stopCalls == 1)
  guard.refresh(Network(1)); Handler.drain()
  check(guard.stopCalls == 2 && guard.stopReason == "android-private-dns-strict-unsupported")
  FreedNetworkDnsState.mode = "off"

  // Execute the actual finish method with a stale descriptor, then the current one.
  val current = FreedVpnService()
  val descriptor = checkNotNull(current.vpnInterface)
  val output = checkNotNull(current.output)
  val currentUpstream = current.encryptedUpstreamDelegate.value
  current.finish(ParcelFileDescriptor())
  check(current.isRunning && descriptor.closes == 0 && output.closes == 0 && currentUpstream.closes == 0)
  check(current.runtimeOwnership.isCurrentEpoch(current.guardEpoch))
  check(current.dnsGuardIpv4ResolverRouteCount == 1 && current.dnsGuardIpv6ResolverRouteCount == 1)
  current.finish(descriptor); Handler.drain()
  check(!current.isRunning && descriptor.closes == 1 && output.closes == 1 && currentUpstream.closes == 1)
  check(current.vpnInterface == null && current.output == null && current.selfStops == 1)
  check(current.dnsGuardIpv4ResolverRouteCount == 0 && current.dnsGuardIpv6ResolverRouteCount == 0)
  check(current.networkCallback == null && current.manager.unregisters == 1)
  println("Actual dual-stack service snapshot, counted coverage, unchanged/change/stale network callbacks, old reader isolation, and resource close cases passed")
}

fun activeNetworkReviewCase() {
  val guard = FreedVpnService()
  guard.manager.properties[Network(2)] = guard.manager.properties.getValue(Network(1))
  guard.capture()
  val routeSet = guard.networkResolverRoutes.toSet()
  val upstream = guard.encryptedUpstreamDelegate.value
  guard.manager.activeNetwork = Network(2)
  guard.refresh(Network(2))
  check(guard.resolverSnapshotNetworks == setOf(Network(1), Network(2)) && guard.networkResolverRoutes.toSet() == routeSet)
  check(guard.healthResets == 1 && upstream.closes == 1 && Handler.callbacks.size == 1) {
    "I1: active network changed with identical candidate/route sets but health/resources/rebuild were unchanged"
  }
  guard.refresh(Network(2))
  guard.manager.properties[Network(99)] = LinkProperties(listOf(InetAddress.getByName("10.94.0.2")))
  guard.manager.activeNetwork = Network(99)
  guard.refresh(Network(99)); guard.refresh(Network(99))
  check(guard.healthResets == 1 && upstream.closes == 1 && Handler.callbacks.size == 1)
  Handler.drain()
  check(guard.stopCalls == 1 && guard.startCalls == 1)

  val lost = FreedVpnService()
  lost.manager.properties[Network(2)] = lost.manager.properties.getValue(Network(1))
  lost.capture()
  val lostUpstream = lost.encryptedUpstreamDelegate.value
  // onLost is authoritative even before the system's active/allNetworks getters update.
  lost.lost(Network(1))
  check(lost.resolverSnapshotNetworks == setOf(Network(2)))
  check(lost.networkResolvers.none { it == "10.94.0.2" })
  check(lost.healthResets == 1 && lostUpstream.closes == 1 && Handler.callbacks.size == 1)
  lost.manager.properties[Network(99)] = LinkProperties(listOf(InetAddress.getByName("10.94.0.2")))
  lost.manager.activeNetwork = Network(99)
  lost.refresh(Network(99)); lost.refresh(Network(99))
  check(lost.resolverSnapshotNetworks == setOf(Network(2)) && lost.healthResets == 1 && lostUpstream.closes == 1) {
    "I1: synthetic callback reintroduced an authoritatively lost network from stale getters"
  }
  lost.manager.activeNetwork = Network(1)
  lost.available(Network(1))
  check(lost.resolverSnapshotNetworks == setOf(Network(1), Network(2)) && lost.healthResets == 2 && lostUpstream.closes == 2)
  Handler.drain()
  println("I1 actual active-network switch, synthetic-default idempotence and lost-network cases passed")
}

fun ipv4AdmissionReviewCase() {
  val guard = FreedVpnService()
  fun packet(sourcePort: Int, destinationPort: Int, reply: Boolean): ByteArray {
    val dns = byteArrayOf(0x12, 0x34, if (reply) 0x81.toByte() else 1, 0, 0, 1, 0, 0, 0, 0, 0, 0,
      1, 'a'.code.toByte(), 0, 0, 1, 0, 1)
    val bytes = ByteArray(28 + dns.size)
    fun put16(offset: Int, value: Int) { bytes[offset] = (value ushr 8).toByte(); bytes[offset + 1] = value.toByte() }
    bytes[0] = 0x45; bytes[8] = 64; bytes[9] = 17
    put16(2, bytes.size)
    byteArrayOf(10, 94, 0, 2).copyInto(bytes, 12)
    byteArrayOf(1, 1, 1, 3).copyInto(bytes, 16)
    put16(20, sourcePort); put16(22, destinationPort); put16(24, 8 + dns.size)
    dns.copyInto(bytes, 28) // IPv4 UDP zero checksum remains permitted.
    var sum = 0
    for (offset in 0 until 20 step 2) sum += ((bytes[offset].toInt() and 0xff) shl 8) or (bytes[offset + 1].toInt() and 0xff)
    while (sum > 0xffff) sum = (sum and 0xffff) + (sum ushr 16)
    put16(10, sum.inv() and 0xffff)
    return bytes
  }
  val destination53 = packet(53000, 53, false)
  val admitted = checkNotNull(guard.admitIpv4(destination53))
  check(admitted.destinationPort == 53 && admitted.sourcePort == 53000 && admitted.isQuery)
  for (reply in listOf(false, true)) {
    val ordinary = packet(53, 443, reply)
    val generic = FreedDnsPacketPolicy.inspectIpv4(ordinary, ordinary.size)
    check(generic is FreedDnsPacketPolicy.Inspection.UdpDns && generic.envelope.isQuery == !reply)
    check(guard.admitIpv4(ordinary) == null) {
      "I3 IPv4: service admitted source53 to destination443 with QR=" + (if (reply) 1 else 0)
    }
  }
  val query = FreedDnsPacketPolicy.inspectIpv4(destination53, destination53.size) as FreedDnsPacketPolicy.Inspection.UdpDns
  val responsePayload = query.envelope.dnsPayload.copyOf().also { it[2] = 0x81.toByte(); it[3] = 0x80.toByte() }
  val response = FreedDnsPacketPolicy.buildUdpResponse(query.envelope, responsePayload)
  val decoded = FreedDnsPacketPolicy.inspectIpv4(response, response.size)
  check(decoded is FreedDnsPacketPolicy.Inspection.UdpDns && !decoded.envelope.isQuery)
  check(decoded.envelope.sourcePort == 53 && decoded.envelope.destinationPort == 53000)
  check(guard.admitIpv4(response) == null)
  check(guard.dnsGuardMalformedPackets.get() == 0L && guard.dnsPacketHealth.unsupportedDnsPackets.get() == 0L)
  println("I3 actual IPv4 service admits destination53, rejects source53-to443 QR0/QR1, and preserves generic reply verification")
}

fun latePrivacyWorkerReviewCase(caller: String = "encrypted") {
  val guard = FreedVpnService()
  val entered = CountDownLatch(1)
  val release = CountDownLatch(1)
  var reads = 0
  FreedNetworkDnsState.mode = "off"
  FreedNetworkDnsState.readHook = {
    reads += 1
    if (reads == (if (caller == "udp-second") 2 else 1)) {
      entered.countDown(); check(release.await(3, TimeUnit.SECONDS))
      FreedNetworkDnsState.mode = "hostname"
    }
  }
  val old = guard.guardEpoch
  val worker = checkNotNull(guard.runtimeOwnership.startThread(old, "late-old-privacy") {
    if (caller == "encrypted") guard.encryptedForward() else guard.resolverForward()
  })
  check(entered.await(3, TimeUnit.SECONDS))
  guard.guardEpoch = guard.runtimeOwnership.beginEpoch()
  release.countDown(); worker.join(3000)
  FreedNetworkDnsState.readHook = null
  check(!worker.isAlive)
  val queued = Handler.callbacks.size
  Handler.drain()
  check(queued == 0 && guard.stopCalls == 0 && guard.runtimeOwnership.isCurrentEpoch(guard.guardEpoch)) {
    "I2: stale worker privacy stop queued=" + queued + ", replacement stops=" + guard.stopCalls
  }
  guard.refresh(Network(1)); Handler.drain()
  check(guard.stopCalls == 1 && guard.stopReason == "android-private-dns-strict-unsupported")
  FreedNetworkDnsState.mode = "off"
  println("I2 actual late old " + caller + " worker cannot schedule a replacement-epoch privacy stop; current privacy stop remains effective")
}
`;
const workspace = mkdtempSync(join(tmpdir(), 'freed-dualstack-dns-service-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}
try {
  const input = join(workspace, 'DnsServiceCases.kt');
  const jar = join(workspace, 'cases.jar');
  writeFileSync(input, fixture);
  const extra=[];const write=(name,body)=>{const file=join(workspace,name);writeFileSync(file,body);return file;};
  extra.push(write('AdultContext.kt',`package android.content
open class Context {val noBackupFilesDir=java.nio.file.Files.createTempDirectory("freed85-routes-").toFile();fun getSharedPreferences(n:String,m:Int)=SharedPreferences();companion object{const val MODE_PRIVATE=0}}
class SharedPreferences{fun getBoolean(k:String,d:Boolean)=d}
`));
  const observed=require('./android-adult-observation-fixture')(write,extra,join(root,nativeRoot));
  writeFileSync(join(workspace,'adult-observation-extraction.json'),JSON.stringify(observed,null,2));
  run('kotlinc', [input,...extra, nativeRoot + 'FreedDnsGuardPolicy.kt', nativeRoot + 'FreedDnsPacketPolicy.kt',
    nativeRoot + 'FreedDnsRuntimeOwnership.kt', '-include-runtime', '-d', jar]);
  run('java', ['-jar', jar, ...caseArgs]);
} finally { rmSync(workspace, { recursive: true, force: true }); }
