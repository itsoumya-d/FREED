const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');

// Execute the production builder and plaintext forwarding methods. Only Android
// framework calls, clock/metadata writes, and network I/O are replaced; no DNS is sent.
const root = resolve(__dirname, '../../..');
const nativeRoot = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const source = readFileSync(join(root, nativeRoot, 'FreedVpnService.kt'), 'utf8');
function method(name) {
  const start = source.indexOf(`  private fun ${name}(`);
  assert.ok(start >= 0, `Production method ${name} must exist.`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`Production method ${name} must remain extractable.`);
}
const builderStart = source.indexOf('    val builder = Builder()');
const builderEnd = source.indexOf('    val descriptor = builder.establish()', builderStart);
assert.ok(builderStart >= 0 && builderEnd > builderStart, 'Execute the actual VPN route registration.');
const builder = source.slice(builderStart, builderEnd);
const constants = ['VPN_ADDRESS', 'VPN_MTU', 'PRIMARY_DNS', 'SECONDARY_DNS', 'RACE_BUDGET_MS', 'DNS_HEADER_SIZE']
  .map(name => {
    const match = source.match(new RegExp(`^\\s*private const val ${name} = .+$`, 'm'));
    assert.ok(match, `Production constant ${name} must exist.`);
    return match[0].trim();
  }).join('\n');
const fixture = `package app.freed.protection
import java.util.concurrent.atomic.AtomicLong
import java.net.InetAddress

@Suppress("UNUSED_PARAMETER")
object FreedNativeCopy { fun text(context: Any, id: Int) = "DNS Guard" }
object R { object string { const val freed_dns_notification_title = 1 } }
object OsConstants { const val AF_INET6 = 10 }
object SystemClock { fun elapsedRealtime() = 100L }
@Suppress("UNUSED_PARAMETER")
class Builder {
  companion object { var rejectedAddress: String? = null }
  val dnsServers = mutableListOf<String>()
  val routes = mutableSetOf<Pair<String, Int>>()
  var ipv6Allowed = false
  fun setSession(value: String) = this
  fun addAddress(value: String, prefix: Int) = this
  fun addDnsServer(value: String) = apply { dnsServers += value }
  fun addRoute(value: String, prefix: Int) = apply { check(value != rejectedAddress); routes += value to prefix }
  fun allowFamily(value: Int) = apply { ipv6Allowed = value == OsConstants.AF_INET6 }
  fun setMtu(value: Int) = this
}
@Suppress("UNUSED_PARAMETER")
internal class FreedVpnService {
  companion object { ${constants} }
  var networkResolvers = listOf("192.0.2.53")
  var networkResolverRoutes = FreedDnsPacketPolicy.resolverRoutes(listOf(
    InetAddress.getByName("192.0.2.53"), InetAddress.getByName("2001:db8::53")))
  var registered: Builder? = null
  var stoppedReason: String? = null
  var notifications = 0
  private val STOP_REASON_RESOLVER_ROUTE_FAILED = "resolver-route-failed"
  private fun markDnsGuardStopped(reason: String) { stoppedReason = reason }
  private fun stopForegroundGuard() {}
  private fun notifyRuntimeStateChanged() { notifications += 1 }
  private fun stopSelf() {}
  var racedResolvers = emptyList<String>()
  var raceReply: ByteArray? = null
  val networkReplies = mutableMapOf<String, ByteArray>()
  val networkAttempts = mutableListOf<String>()
  var lastForwardResolver: String? = null
  var lastForwardFailure: String? = null
  val dnsGuardNetworkFallbackHits = AtomicLong(0L)
  fun configureRoutes() {
${builder}
    registered = builder
  }
  fun forward(query: ByteArray) = forwardPlaintextDns(query)
  private fun raceForward(query: ByteArray, resolvers: List<String>, budget: Long): ByteArray? {
    racedResolvers = resolvers
    return raceReply
  }
  private fun forwardDnsToResolver(query: ByteArray, resolver: String): ByteArray? {
    networkAttempts += resolver
    return networkReplies[resolver]
  }
  private fun publishDnsMetadata(block: () -> Unit) = block()
  private fun recordForwardLatency(value: Long) {}
  private fun unsigned(value: Byte) = value.toInt() and 0xff
${method('forwardPlaintextDns')}
${method('sequentialFallback')}
${method('isValidDnsResponse')}
}

fun main() {
  val failures = mutableListOf<String>()
  fun expect(condition: Boolean, message: String) { if (!condition) failures += message }
  val guard = FreedVpnService()
  guard.configureRoutes()
  val registered = checkNotNull(guard.registered)
  expect(registered.dnsServers == listOf("10.94.0.2", "1.1.1.3", "1.0.0.3"),
    "VPN must advertise Families DNS after its local interceptor; actual=" + registered.dnsServers)
  for (address in listOf("1.1.1.3", "1.0.0.3", "1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4",
      "9.9.9.9", "149.112.112.112", "208.67.222.222", "208.67.220.220", "192.0.2.53")) {
    expect((address to 32) in registered.routes, "VPN must intercept UDP resolver route " + address)
  }
  expect(("2001:db8:0:0:0:0:0:53" to 128) in registered.routes, "Current IPv6 resolver must receive a /128 host route")
  expect(registered.routes.none { it.second == 0 }, "No DNS route may capture full ordinary traffic")
  expect(registered.ipv6Allowed, "DNS-only VPN must preserve ordinary IPv6 traffic")
  Builder.rejectedAddress = "2001:db8:0:0:0:0:0:53"
  val routeFailure = FreedVpnService()
  routeFailure.configureRoutes()
  expect(routeFailure.registered == null && routeFailure.stoppedReason == "resolver-route-failed" && routeFailure.notifications == 1,
    "An active resolver route installation failure must publish failure and never proceed to establish")
  Builder.rejectedAddress = null
  val query = byteArrayOf(0x12, 0x34, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0)
  val answer = query.copyOf().also { it[2] = 0x81.toByte() }
  guard.raceReply = answer
  expect(guard.forward(query)?.contentEquals(answer) == true, "A public resolver reply must be returned")
  expect(guard.racedResolvers == listOf("1.1.1.3", "1.0.0.3"),
    "Plaintext DNS must try Families first; actual=" + guard.racedResolvers)
  expect(guard.networkAttempts.isEmpty(), "A public reply must not invoke network fallback")

  val fallback = FreedVpnService()
  fallback.networkResolvers = listOf("192.0.2.52", "192.0.2.53")
  fallback.networkReplies["192.0.2.52"] = answer.copyOf().also { it[0] = 0x44 }
  fallback.networkReplies["192.0.2.53"] = answer
  expect(fallback.forward(query)?.contentEquals(answer) == true, "Public outage must preserve valid network fallback")
  expect(fallback.networkAttempts == listOf("192.0.2.52", "192.0.2.53"), "Fallback must reject mismatched replies")
  expect(fallback.lastForwardResolver == "192.0.2.53", "Fallback metadata must name the accepted network resolver")
  expect(fallback.dnsGuardNetworkFallbackHits.get() == 1L, "Accepted network fallback must increment its counter")

  val failed = FreedVpnService()
  expect(failed.forward(query) == null, "An outage of all upstreams must return failure")
  expect(failed.lastForwardResolver == null && failed.lastForwardFailure != null, "Total outage must clear resolver metadata")
  expect(FreedDnsGuardPolicy.filteringActive(true, false, "off"), "Local classification remains available during network fallback")
  expect(!FreedDnsGuardPolicy.filteringActive(true, true, "off"), "Captive sign-in must remain surfaced as paused")
  check(failures.isEmpty()) { failures.joinToString("\\n") }
  println("Actual Android DNS builder, Families upstream priority, network fallback, and pause cases passed")
}
`;
const workspace = mkdtempSync(join(tmpdir(), 'freed-dns-upstream-routing-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}
try {
  const input = join(workspace, 'DnsUpstreamRouting.kt');
  const jar = join(workspace, 'cases.jar');
  writeFileSync(input, fixture);
  run('kotlinc', [input, nativeRoot + 'FreedDnsGuardPolicy.kt', nativeRoot + 'FreedDnsPacketPolicy.kt', '-include-runtime', '-d', jar]);
  run('java', ['-jar', jar]);
} finally { rmSync(workspace, { recursive: true, force: true }); }
