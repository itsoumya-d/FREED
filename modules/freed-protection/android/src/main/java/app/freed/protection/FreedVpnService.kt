package app.freed.protection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.Configuration
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.Uri
import android.net.NetworkCapabilities
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.system.OsConstants
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

class FreedVpnService : VpnService() {
  private var presentationPreferences: SharedPreferences? = null
  private val presentationListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
    if (key == "language" || key == "themeMode") {
      if (isRunning) runCatching { refreshGuardNotification() }
    }
  }

  override fun onCreate() {
    super.onCreate()
    FreedAdultProtectionState.guarded(this) {
      liveService = this
      serviceOwners.add(this)
      runtimeOwners.add(runtimeOwnership)
      runtimeOwners.add(recoveryBootstrapOwnership)
    }
    presentationPreferences = getSharedPreferences("freed.presentation.v1", MODE_PRIVATE).also {
      it.registerOnSharedPreferenceChangeListener(presentationListener)
    }
  }

  override fun onConfigurationChanged(configuration: Configuration) {
    super.onConfigurationChanged(configuration)
    if (isRunning) runCatching { refreshGuardNotification() }
  }

  @Volatile private var vpnInterface: ParcelFileDescriptor? = null
  // establish() owns a real TUN before policy admission; rejected handles remain
  // here until close succeeds, without replacing any already-admitted handle.
  private val unadmittedInterfaces = java.util.concurrent.ConcurrentHashMap.newKeySet<ParcelFileDescriptor>()
  private var readerThread: Thread? = null
  private val workerThreads = mutableListOf<Thread>()
  @Volatile private var output: FileOutputStream? = null
  private val outputLock = Any()
  private val encryptedUpstreamDelegate = lazy { FreedEncryptedDnsUpstream { socket -> protect(socket) } }
  @Volatile private var recoveryUpstream: FreedRecoveryDnsPilotUpstream? = null
  @Volatile private var recoveryRuntimeDescriptor: String? = null
  private val recoveryUpstreamOwners = java.util.concurrent.ConcurrentHashMap.newKeySet<FreedRecoveryDnsPilotUpstream>()
  private val recoveryUpstreamLock = Any()
  private val runtimeOwnership = FreedDnsRuntimeOwnership()
  private val recoveryBootstrapOwnership = FreedDnsRuntimeOwnership()
  private val recoveryBootstrapGeneration = AtomicLong(0)
  private var guardEpoch = 0L
  @Volatile private var ownerCloseSucceeded = true
  @Volatile private var adultRuntimeGeneration: Long? = null
  private var packetGeneration = 0L

  // Pending work queue consumed by the worker pool. Bounded via permits so a slow
  // upstream can never balloon memory; overflow drops are counted and clients retry.
  private val pendingWork = ConcurrentLinkedQueue<DnsWorkItem>()
  private val workPermits = Semaphore(0)
  @Volatile private var workersRunning = false

  private var connectivityManager: ConnectivityManager? = null
  private var networkCallback: NetworkCallback? = null
  @Volatile private var networkResolverRoutes: List<FreedDnsPacketPolicy.ResolverRoute> = emptyList()
  private var resolverRouteRestartEpoch: Long? = null
  private var resolverSnapshotNetworks: Set<Network> = emptySet()
  @Volatile private var resolverSnapshotActiveNetwork: Network? = null
  private val lostResolverNetworks = mutableSetOf<Network>()
  @Volatile private var captivePortalPaused = false
  @Volatile private var probeGeneration = 0L
  private var probeThread: Thread? = null

  private data class DnsWorkItem(
    val envelope: DnsEnvelope,
    val dnsPayload: ByteArray,
    val questionHost: String?,
    val providerEpoch: Long = recoveryProviderEpoch.get()
  )

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action != ACTION_STOP && intent?.hasExtra("freed_adult_generation") == true &&
      intent.getLongExtra("freed_adult_generation", -1L) != (FreedAdultProtectionState.generation(this) ?: -1L)) {
      stopSelf(); return START_NOT_STICKY
    }
    when (intent?.action) {
      ACTION_STOP -> {
        // The same native request path owns preference commit, teardown and worker readback.
        val receipt = requestAdultStop(this)
        return if (receipt["runtimeStopped"] == true) START_NOT_STICKY else START_STICKY
      }
      ACTION_RESTORE -> {
        val restoreAction = intent.getStringExtra(EXTRA_RESTORE_ACTION) ?: "unknown"
        val skipReason = autoRestartSkipReason(this)
        if (skipReason != null) {
          recordAutoRestart(this, restoreAction, AUTO_RESTART_RESULT_SKIPPED, skipReason)
          stopSelf()
          return START_NOT_STICKY
        }
        startDnsGuard()
      }
      else -> startDnsGuard()
    }

    return START_STICKY
  }

  override fun onDestroy() {
    presentationPreferences?.unregisterOnSharedPreferenceChangeListener(presentationListener)
    presentationPreferences = null
    if (activeRuntimeService === this && runCatching { isUserEnabled(this) }.getOrDefault(true))
      lastAdultStopReceipt = mapOf("accepted" to false, "systemControlled" to true,
        "reason" to "service-destroyed", "status" to "needs-attention")
    val closed = stopDnsGuard(STOP_REASON_SERVICE_DESTROY)
    FreedAdultProtectionState.guarded(this) {
      if (closed && ownerCloseSucceeded && vpnInterface == null && output == null &&
        unadmittedInterfaces.isEmpty() && recoveryUpstreamOwners.isEmpty() && runtimeOwnership.isStopped() && recoveryBootstrapOwnership.isStopped()) {
        if (liveService === this) liveService = null
        runtimeOwners.remove(runtimeOwnership)
        runtimeOwners.remove(recoveryBootstrapOwnership)
        serviceOwners.remove(this)
      }
    }
    super.onDestroy()
  }

  override fun onRevoke() {
    // Android owns revocation. Retain intended adult policy; a PIN cannot prevent it.
    if (activeRuntimeService === this) lastAdultStopReceipt = mapOf("accepted" to false, "systemControlled" to true,
      "reason" to "vpn-permission-revoked", "status" to "needs-attention")
    stopDnsGuard(STOP_REASON_VPN_REVOKED)
    stopSelf()
    super.onRevoke()
  }

  private fun startDnsGuard() {
    val expectedAdultGeneration = FreedAdultProtectionState.callbackEpoch(this)
    // Satisfy the startForegroundService() contract before any early return so
    // Android never kills the process for a missing foreground notification.
    startForegroundGuard()
    if (!isUserEnabled(this) || runtimeStops.get() > 0) {
      if (activeRuntimeService == null || activeRuntimeService === this) stopForegroundGuard()
      stopSelf(); return
    }
    if (!FreedProtectionConfiguration.interceptionEnabled(this)) {
      stopDnsGuard("configuration-reset")
      stopSelf()
      return
    }
    val privacy = FreedNetworkDnsState.read(this)
    if (!FreedDnsGuardPolicy.allowsPlaintext(privacy.mode)) {
      stopDnsGuard(FreedDnsGuardPolicy.issueCode(false, false, privacy.mode)!!)
      stopSelf()
      return
    }
    if (isRunning) return
    captureCurrentNetworkResolverSnapshot()
    // Resolve the exact TLS host on a declared underlying network before establishing
    // the interceptor. A missing/unreadable active credential never selects plaintext.
    val recovery = runCatching { FreedRecoveryDnsPilot.activeCandidate(this) }
    if (recovery.isFailure) {
      markDnsGuardStopped("recovery-dns-secure-state-unavailable")
      stopForegroundGuard(); notifyRuntimeStateChanged(); stopSelf(); return
    }
    val candidate = recovery.getOrNull()
    if (candidate != null && !FreedRecoveryDnsPilot.supported(this)) {
      markDnsGuardStopped("recovery-dns-pilot-build-gated")
      stopForegroundGuard(); notifyRuntimeStateChanged(); stopSelf(); return
    }
    if (candidate != null && recoveryUpstream?.networkHandle != resolverSnapshotActiveNetwork?.networkHandle) {
      recoveryUpstream?.let(::releaseRecoveryDnsRuntime); recoveryUpstream = null; recoveryRuntimeDescriptor = null
    }
    if (candidate != null && recoveryRuntimeDescriptor != FreedRecoveryDnsPilot.descriptor(candidate)) {
      if (!recoveryBootstrapOwnership.isStopped()) return
      val startup = recoveryBootstrapGeneration.incrementAndGet()
      val epoch = recoveryBootstrapOwnership.beginEpoch()
      recoveryBootstrapOwnership.startThread(epoch, "FreedRecoveryDnsBootstrap") {
        val prepared = runCatching {
          val network = resolverSnapshotActiveNetwork ?: error("recovery-dns-underlying-network-unavailable")
          FreedRecoveryDnsPilotUpstream.prepare(candidate, FreedRecoveryDnsPilot.descriptor(candidate), network) { protect(it) }
            .also { upstream ->
              // Teardown closes admission before taking its owner snapshot. A resolver
              // finishing after that boundary must close its own unadmitted client.
              if (!recoveryBootstrapOwnership.withEpoch(epoch) { recoveryUpstreamOwners.add(upstream) }) {
                upstream.close()
                error("recovery-dns-bootstrap-superseded")
              }
            }
        }.getOrNull()
        recoveryBootstrapOwnership.closeAndInterrupt()
        val continuation = object : Runnable {
          override fun run() {
            if (!recoveryBootstrapOwnership.isStopped()) {
              Handler(Looper.getMainLooper()).postDelayed(this, 16); return
            }
            if (startup != recoveryBootstrapGeneration.get() || expectedAdultGeneration != FreedAdultProtectionState.callbackEpoch(this@FreedVpnService) ||
              !isUserEnabled(this@FreedVpnService) || runtimeStops.get() > 0 || isRunning) {
              prepared?.let { releaseRecoveryDnsRuntime(it) }; return
            }
            if (prepared == null) {
              markDnsGuardStopped("recovery-dns-bootstrap-unavailable")
              stopForegroundGuard(); notifyRuntimeStateChanged(); stopSelf(); return
            }
            recoveryUpstream = prepared; recoveryRuntimeDescriptor = prepared.descriptor
            startDnsGuard()
          }
        }
        Handler(Looper.getMainLooper()).post(continuation)
      }
      return
    }

    val builder = Builder()
      .setSession(FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_notification_title))
      .addAddress(VPN_ADDRESS, 32)
      .addDnsServer(VPN_ADDRESS)
      .addDnsServer(PRIMARY_DNS)
      .addDnsServer(SECONDARY_DNS)
      .addRoute(VPN_ADDRESS, 32)
      .addRoute(PRIMARY_DNS, 32)
      .addRoute(SECONDARY_DNS, 32)
      // Unrouted IPv6 stays on the underlying network. The current network's
      // DNS resolver addresses receive explicit /128 routes below.
      .allowFamily(OsConstants.AF_INET6)
      .setMtu(VPN_MTU)

    val commonDnsRoutes = listOf(
      // Intercept app-selected ordinary Cloudflare DNS; upstream defaults are Families.
      "1.1.1.1", "1.0.0.1",
      "8.8.8.8", "8.8.4.4",
      "9.9.9.9", "149.112.112.112",
      "208.67.222.222", "208.67.220.220"
    )
    val installedDnsRoutes = mutableSetOf(
      VPN_ADDRESS to 32,
      PRIMARY_DNS to 32,
      SECONDARY_DNS to 32
    )
    for (dns in commonDnsRoutes) {
      if (runCatching { builder.addRoute(dns, 32) }.isSuccess) installedDnsRoutes.add(dns to 32)
    }
    val resolverRoutesAdded = runCatching {
      for (route in networkResolverRoutes) {
        if (installedDnsRoutes.add(route.address to route.prefixLength)) {
          // Failure to install an active resolver route must not leave a
          // running service that appears to support that resolver family.
          builder.addRoute(route.address, route.prefixLength)
        }
      }
    }
    if (resolverRoutesAdded.isFailure) {
      markDnsGuardStopped(STOP_REASON_RESOLVER_ROUTE_FAILED)
      stopForegroundGuard()
      notifyRuntimeStateChanged()
      stopSelf()
      return
    }

    val descriptor = builder.establish()

    if (descriptor == null) {
      markDnsGuardStopped(STOP_REASON_ESTABLISH_FAILED)
      stopForegroundGuard()
      notifyRuntimeStateChanged()
      stopSelf()
      return
    }

    val admitted = FreedAdultProtectionState.guarded(this) {
      val canAdmit = runtimeStops.get() == 0 && runtimeCloseSucceeded && runtimeOwners.all { it.isStopped() } &&
        serviceOwners.none { it.vpnInterface != null || it.output != null || it.unadmittedInterfaces.isNotEmpty() } &&
        vpnInterface == null && output == null && unadmittedInterfaces.isEmpty() && isUserEnabled(this) &&
        expectedAdultGeneration == FreedAdultProtectionState.callbackEpoch(this) && !isRunning
      // Register every returned handle before attempting any rejection cleanup.
      serviceOwners.add(this)
      unadmittedInterfaces.add(descriptor)
      if (canAdmit) {
        vpnInterface = descriptor
        unadmittedInterfaces.remove(descriptor)
        adultRuntimeGeneration = expectedAdultGeneration.first
        activeRuntimeService = this
      }
      canAdmit
    }
    if (!admitted) {
      if (runCatching { descriptor.close() }.isSuccess) unadmittedInterfaces.remove(descriptor)
      else {
        ownerCloseSucceeded = false
        runtimeCloseSucceeded = false
      }
      stopSelf()
      return
    }
    FreedAdultProtectionState.guarded(this) {
    if (runtimeStops.get() > 0 || expectedAdultGeneration != FreedAdultProtectionState.callbackEpoch(this) || !isUserEnabled(this)) {
      // Descriptor remains owned and is closed below after leaving the guard.
      return@guarded
    }
    runtimeOwners.add(runtimeOwnership)
    guardEpoch = runtimeOwnership.beginEpoch()
    runtimeCloseSucceeded = false
    packetGeneration = dnsPacketHealth.beginGeneration()
    dnsGuardIpv4ResolverRouteCount = networkResolverRoutes.count { it.prefixLength == 32 }
    dnsGuardIpv6ResolverRouteCount = networkResolverRoutes.count { it.prefixLength == 128 }
    markDnsGuardStarted()
    notifyRuntimeStateChanged()
    registerNetworkWatch()
    output = FileOutputStream(descriptor.fileDescriptor)
    workersRunning = true
    repeat(DNS_WORKER_COUNT) { index ->
      val worker = runtimeOwnership.startThread(guardEpoch, "FreedDnsWorker-$index") {
        runWorkerLoop()
      }
      if (worker != null) workerThreads.add(worker)
    }
    val readerGeneration = packetGeneration
    readerThread = runtimeOwnership.startThread(guardEpoch, "FreedDnsGuard") {
      val stopReason = runCatching {
        runReaderLoop(descriptor, readerGeneration)
        STOP_REASON_LOOP_ENDED
      }.getOrElse { error ->
        publishDnsMetadata { lastForwardFailure = "DNS loop stopped: ${error.javaClass.simpleName}" }
        STOP_REASON_LOOP_FAILED
      }
      finishDnsGuardFromLoop(descriptor, stopReason)
    }
    probeThread = runtimeOwnership.startThread(guardEpoch, "FreedCaptiveProbe") {
      runCaptiveProbeLoop()
    }
    }
    if (expectedAdultGeneration != FreedAdultProtectionState.callbackEpoch(this) || !isUserEnabled(this) || runtimeStops.get() > 0)
      stopDnsGuard("adult-start-superseded")
  }

  @Synchronized
  private fun stopDnsGuard(reason: String): Boolean {
    dnsPacketHealth.endGeneration(packetGeneration)
    resolverRouteRestartEpoch = null
    val udpClosed = runtimeOwnership.closeAndInterrupt()
    recoveryBootstrapGeneration.incrementAndGet()
    val bootstrapClosed = recoveryBootstrapOwnership.closeAndInterrupt()
    val ownsPublishedRuntime = activeRuntimeService === this
    if (ownsPublishedRuntime) markDnsGuardStopped(reason)
    val upstreamClosed = !encryptedUpstreamDelegate.isInitialized() || runCatching { encryptedUpstreamDelegate.value.close() }.isSuccess
    val recoveryClosed = synchronized(recoveryUpstreamLock) {
      recoveryUpstreamOwners.toList().map { upstream ->
        runCatching { upstream.close(); recoveryUpstreamOwners.remove(upstream); true }.getOrDefault(false)
      }.all { it }.also { closed ->
        if (closed) { recoveryUpstream = null; recoveryRuntimeDescriptor = null }
      }
    }
    recoveryProviderEpoch.incrementAndGet()
    if (ownsPublishedRuntime) notifyRuntimeStateChanged()
    probeGeneration += 1
    workersRunning = false
    readerThread?.interrupt()
    readerThread = null
    workerThreads.forEach { it.interrupt() }
    workerThreads.clear()
    probeThread?.interrupt()
    probeThread = null
    unregisterNetworkWatch()
    val outputClosed = synchronized(outputLock) {
      val result = runCatching { output?.close() }.isSuccess
      if (result) output = null
      result
    }
    val interfaceClosed = runCatching { vpnInterface?.close() }.isSuccess
    if (interfaceClosed) vpnInterface = null
    val unadmittedClosed = unadmittedInterfaces.toList().map { descriptor ->
      val closed = runCatching { descriptor.close() }.isSuccess
      if (closed) unadmittedInterfaces.remove(descriptor)
      closed
    }.all { it }
    pendingWork.clear()
    workPermits.drainPermits()
    captivePortalPaused = false
    if (ownsPublishedRuntime) {
      dnsGuardCaptivePaused = false
      stopForegroundGuard()
    }
    cachedFeed = emptySet()
    cachedFeedSize = -1
    cachedFeedRefreshedAtElapsedMs = 0L
    ownerCloseSucceeded = udpClosed && bootstrapClosed && upstreamClosed && recoveryClosed && outputClosed && interfaceClosed && unadmittedClosed && unadmittedInterfaces.isEmpty()
    runtimeCloseSucceeded = serviceOwners.all { it.ownerCloseSucceeded }
    if (ownsPublishedRuntime && ownerCloseSucceeded) activeRuntimeService = null
    return ownerCloseSucceeded
  }

  @Synchronized
  private fun finishDnsGuardFromLoop(descriptor: ParcelFileDescriptor, reason: String) {
    if (vpnInterface !== descriptor) return
    // The same actual closer retains failed handles; an old reader owns only its instance.
    val wasCurrent = activeRuntimeService === this
    stopDnsGuard(reason)
    Handler(Looper.getMainLooper()).post {
      if (wasCurrent && activeRuntimeService == null && !isRunning && vpnInterface == null) {
        stopForegroundGuard()
        stopSelf()
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Network watch: track the active network's own DNS servers as fallback
  // resolvers so networks that block public DNS (captive portals, corporate
  // Wi-Fi, some ISPs) keep working instead of black-holing every lookup.
  // ---------------------------------------------------------------------------

  private inner class NetworkCallback(private val epoch: Long) : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) {
      if (!runtimeOwnership.isCurrentEpoch(epoch)) return
      refreshNetworkResolvers(network, epoch, networkAvailable = true)
    }

    override fun onLinkPropertiesChanged(network: Network, linkProperties: LinkProperties) {
      if (!runtimeOwnership.isCurrentEpoch(epoch)) return
      refreshNetworkResolvers(network, epoch)
    }

    override fun onLost(network: Network) {
      if (!runtimeOwnership.isCurrentEpoch(epoch)) return
      refreshNetworkResolvers(null, epoch, network)
    }
  }

  private fun registerNetworkWatch() {
    val manager = connectivityManager ?: getSystemService(ConnectivityManager::class.java)?.also {
      connectivityManager = it
    } ?: return
    runCatching {
      val callback = NetworkCallback(guardEpoch)
      networkCallback = callback
      manager.registerDefaultNetworkCallback(callback)
      refreshNetworkResolvers(manager.activeNetwork)
    }
  }

  private fun unregisterNetworkWatch() {
    val manager = connectivityManager
    val callback = networkCallback
    if (manager != null && callback != null) {
      runCatching { manager.unregisterNetworkCallback(callback) }
    }
    networkCallback = null
    networkResolvers = emptyList()
    networkResolverRoutes = emptyList()
    resolverSnapshotNetworks = emptySet()
    resolverSnapshotActiveNetwork = null
    dnsGuardIpv4ResolverRouteCount = 0
    dnsGuardIpv6ResolverRouteCount = 0
  }

  private fun captureCurrentNetworkResolverSnapshot() {
    val manager = connectivityManager ?: getSystemService(ConnectivityManager::class.java)?.also {
      connectivityManager = it
    } ?: run {
      resolverSnapshotNetworks = emptySet()
      resolverSnapshotActiveNetwork = null
      updateNetworkResolverSnapshot(emptyList())
      return
    }
    val targets = currentResolverNetworks(manager)
    val servers = targets.flatMap { target ->
      runCatching { manager.getLinkProperties(target)?.dnsServers.orEmpty() }.getOrElse { emptyList() }
    }
    resolverSnapshotNetworks = targets.toSet()
    resolverSnapshotActiveNetwork = currentResolverActiveNetwork(manager, targets)
    updateNetworkResolverSnapshot(servers)
  }

  private fun currentResolverNetworks(manager: ConnectivityManager, preferred: Network? = null): List<Network> {
    val reported = manager.allNetworks.toSet()
    // Retain authoritative losses while getters still report the old identity;
    // discard tombstones once every getter has moved on.
    lostResolverNetworks.removeAll { it !in reported && it != manager.activeNetwork && it != preferred }
    fun isUnderlying(network: Network): Boolean = runCatching {
      if (network in lostResolverNetworks) return@runCatching false
      val caps = manager.getNetworkCapabilities(network) ?: return@runCatching false
      !caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) &&
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }.getOrDefault(false)
    val active = preferred?.takeIf(::isUnderlying) ?: manager.activeNetwork?.takeIf(::isUnderlying)
    // Capture all live underlying candidates before and after VPN establishment.
    // Switching to our synthetic default network must not change the route set
    // or omit DNS on another live underlying network. Keep the default first.
    val candidates = reported.filter(::isUnderlying)
    return (active?.let { listOf(it) }.orEmpty() + candidates).distinct()
  }

  private fun currentResolverActiveNetwork(manager: ConnectivityManager, targets: List<Network>, preferred: Network? = null): Network? {
    // An actual underlying default switch invalidates upstream resources even
    // when both networks and their resolver hosts remain in the snapshot.
    return manager.activeNetwork?.takeIf { it in targets }
      ?: preferred?.takeIf { it in targets }
      ?: resolverSnapshotActiveNetwork?.takeIf { it in targets }
      ?: targets.firstOrNull()
  }

  private fun updateNetworkResolverSnapshot(servers: List<InetAddress>) {
    val snapshot = servers.distinct()
    networkResolvers = snapshot.take(MAX_NETWORK_RESOLVERS).mapNotNull { it.hostAddress }.filter { it.isNotBlank() }
    networkResolverRoutes = FreedDnsPacketPolicy.resolverRoutes(snapshot, setOf(VPN_ADDRESS))
  }

  @Synchronized
  private fun scheduleResolverRouteRestart() {
    val expectedEpoch = guardEpoch
    val expectedAdultGeneration = FreedAdultProtectionState.callbackEpoch(this)
    if (resolverRouteRestartEpoch == expectedEpoch) return
    resolverRouteRestartEpoch = expectedEpoch
    Handler(Looper.getMainLooper()).postDelayed({
      synchronized(this@FreedVpnService) {
        if (resolverRouteRestartEpoch != expectedEpoch) return@postDelayed
        resolverRouteRestartEpoch = null
        if (!isRunning || !runtimeOwnership.isCurrentEpoch(expectedEpoch) ||
          expectedAdultGeneration != FreedAdultProtectionState.callbackEpoch(this@FreedVpnService) || !isUserEnabled(this@FreedVpnService)) return@postDelayed
        stopDnsGuard(STOP_REASON_RESOLVER_ROUTES_CHANGED)
        startServiceAction(this, ACTION_START)
      }
    }, 250L)
  }

  @Synchronized
  private fun refreshNetworkResolvers(network: Network?, expectedEpoch: Long = guardEpoch, lostNetwork: Network? = null, networkAvailable: Boolean = false) {
    if (!runtimeOwnership.isCurrentEpoch(expectedEpoch)) return
    lostNetwork?.let { lostResolverNetworks.add(it) }
    if (networkAvailable && network != null) lostResolverNetworks.remove(network)
    val privacy = FreedNetworkDnsState.read(this)
    if (!FreedDnsGuardPolicy.allowsPlaintext(privacy.mode)) {
      stopForDnsPrivacy(privacy.mode, expectedEpoch)
      return
    }
    val manager = connectivityManager ?: getSystemService(ConnectivityManager::class.java)?.also {
      connectivityManager = it
    } ?: return
    val targets = currentResolverNetworks(manager, network).filter { it != lostNetwork }
    val activeNetwork = currentResolverActiveNetwork(manager, targets, network)
    val servers = targets.flatMap { target ->
      runCatching { manager.getLinkProperties(target)?.dnsServers.orEmpty() }.getOrElse { emptyList() }
    }
    val previousRoutes = networkResolverRoutes
    val previousNetworks = resolverSnapshotNetworks
    val previousActiveNetwork = resolverSnapshotActiveNetwork
    resolverSnapshotNetworks = targets.toSet()
    resolverSnapshotActiveNetwork = activeNetwork
    updateNetworkResolverSnapshot(servers)
    if (activeNetwork == previousActiveNetwork && resolverSnapshotNetworks == previousNetworks &&
      networkResolverRoutes.toSet() == previousRoutes.toSet()) return
    // Only real network/resolver changes invalidate health and close old upstream sockets.
    recoveryNetworkEpoch.incrementAndGet()
    resetEncryptedDnsHealth()
    if (encryptedUpstreamDelegate.isInitialized()) encryptedUpstreamDelegate.value.close()
    recoveryUpstream?.close()
    probeGeneration += 1
    if (isRunning) scheduleResolverRouteRestart()
  }

  private fun stopForDnsPrivacy(mode: String, expectedEpoch: Long) {
    if (!runtimeOwnership.isCurrentEpoch(expectedEpoch)) return
    Handler(Looper.getMainLooper()).post {
      synchronized(this@FreedVpnService) {
        if (!runtimeOwnership.isCurrentEpoch(expectedEpoch)) return@post
        stopDnsGuard(FreedDnsGuardPolicy.issueCode(false, false, mode)!!)
        stopSelf()
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Captive portal probing. When the active network hijacks HTTP (portal sign-in
  // required), classification pauses and DNS is forwarded untouched so the user
  // can complete sign-in; filtering resumes automatically once the probe sees a
  // clean generate_204 response.
  // ---------------------------------------------------------------------------

  private fun runCaptiveProbeLoop() {
    var lastRunAt = 0L
    var lastGeneration = -1L
    while (isRunning && !Thread.currentThread().isInterrupted && runtimeOwnership.isCurrentThreadEpoch()) {
      val generation = probeGeneration
      val dueToNetworkChange = generation != lastGeneration
      val elapsed = SystemClock.elapsedRealtime() - lastRunAt
      if (!dueToNetworkChange && elapsed < CAPTIVE_PROBE_INTERVAL_MS) {
        try {
          Thread.sleep(CAPTIVE_PROBE_IDLE_MS)
        } catch (_: InterruptedException) {
          break
        }
        continue
      }
      lastGeneration = generation
      lastRunAt = SystemClock.elapsedRealtime()

      val healthy = probeNetworkHealthy()
      val wasPaused = captivePortalPaused
      captivePortalPaused = !healthy
      dnsGuardCaptivePaused = !healthy
      if (wasPaused != captivePortalPaused) {
        notifyRuntimeStateChanged()
        Handler(Looper.getMainLooper()).post {
          if (isRunning) refreshGuardNotification()
        }
      }
    }
  }

  private fun probeNetworkHealthy(): Boolean {
    val cm = connectivityManager ?: getSystemService(ConnectivityManager::class.java)
    val target = cm?.activeNetwork
    if (cm != null && target != null) {
      val caps = runCatching { cm.getNetworkCapabilities(target) }.getOrNull()
      if (caps != null) {
        if (caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)) {
          return false
        }
        if (caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
          return true
        }
      }
    }
    if (FreedEncryptedDnsConfig.isRequested(this) || FreedRecoveryDnsPilot.activeOrUnknown(this)) {
      // Avoid resolving an HTTP probe hostname through our own VPN, or issuing
      // any bootstrap DNS in plaintext while encrypted DNS is selected.
      return cm?.allNetworks?.any { network ->
        val caps = cm.getNetworkCapabilities(network) ?: return@any false
        !caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_VPN) &&
          caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED) &&
          !caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL)
      } == true
    }
    return runCatching {
      Socket().use { socket ->
        protect(socket)
        socket.connect(InetSocketAddress(CAPTIVE_PROBE_HOST, 80), CAPTIVE_PROBE_CONNECT_TIMEOUT_MS)
        socket.soTimeout = CAPTIVE_PROBE_READ_TIMEOUT_MS
        val request = "GET /generate_204 HTTP/1.1\r\n" +
          "Host: $CAPTIVE_PROBE_HOST\r\n" +
          "Connection: close\r\n" +
          "User-Agent: FREED-DNSGuard/1\r\n\r\n"
        socket.getOutputStream().write(request.toByteArray(Charsets.US_ASCII))
        socket.getOutputStream().flush()
        val buffer = ByteArray(256)
        var total = 0
        while (total < buffer.size) {
          val read = socket.getInputStream().read(buffer, total, buffer.size - total)
          if (read <= 0) break
          total += read
        }
        val statusLine = String(buffer, 0, total, Charsets.US_ASCII)
        statusLine.startsWith("HTTP/") && statusLine.contains(" 204")
      }
    }.getOrDefault(true)
  }

  private fun refreshGuardNotification() {
    val manager = getSystemService(NotificationManager::class.java) ?: return
    manager.notify(NOTIFICATION_ID, buildGuardNotification())
  }

  // ---------------------------------------------------------------------------
  // Foreground service plumbing.
  // ---------------------------------------------------------------------------

  private fun startForegroundGuard() {
    val notification = buildGuardNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun stopForegroundGuard() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun buildGuardNotification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      val channel = NotificationChannel(
        NOTIFICATION_CHANNEL_ID,
        FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_notification_title),
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_channel_description)
      }
      manager.createNotificationChannel(channel)
    }

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val pendingIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }
    val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_lock_lock

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    val contentText = if (captivePortalPaused) {
      FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_paused_notification)
    } else {
      FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_active_notification)
    }

    return builder
      .setSmallIcon(icon)
      .setContentTitle(FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_notification_title))
      .setContentText(contentText)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setContentIntent(pendingIntent)
      .build()
  }

  // ---------------------------------------------------------------------------
  // Packet loops.
  // ---------------------------------------------------------------------------

  private fun runReaderLoop(descriptor: ParcelFileDescriptor, generation: Long) {
    val input = FileInputStream(descriptor.fileDescriptor)
    val packet = ByteArray(MAX_PACKET_SIZE)

    while (isRunning && !Thread.currentThread().isInterrupted && runtimeOwnership.isCurrentThreadEpoch()) {
      val readLength = try {
        input.read(packet)
      } catch (_: Exception) {
        break
      }
      if (!runtimeOwnership.isCurrentThreadEpoch()) break
      if (readLength <= 0) continue
      dnsGuardPacketsRead.incrementAndGet()

      val version = unsigned(packet[0]) ushr 4
      val envelope = if (version == 6) {
        when (val inspected = inspectIpv6DnsPacket(packet, readLength, generation)) {
          FreedDnsPacketPolicy.Inspection.NotDns -> continue
          FreedDnsPacketPolicy.Inspection.Malformed -> {
            continue
          }
          is FreedDnsPacketPolicy.Inspection.Unsupported -> {
            FreedDnsPacketPolicy.buildIcmpv6AdminProhibited(packet, readLength)?.let(::writeRawPacket)
            continue
          }
          FreedDnsPacketPolicy.Inspection.TcpDns -> {
            FreedDnsPacketPolicy.buildIcmpv6PortUnreachable(packet, readLength)?.let(::writeRawPacket)
            dnsGuardTcpFastFails.incrementAndGet()
            continue
          }
          is FreedDnsPacketPolicy.Inspection.UdpDns -> DnsEnvelope(
            sourceAddress = inspected.envelope.sourceAddress,
            destinationAddress = inspected.envelope.destinationAddress,
            sourcePort = inspected.envelope.sourcePort,
            destinationPort = inspected.envelope.destinationPort,
            dnsPayload = inspected.envelope.dnsPayload,
            isQuery = inspected.envelope.isQuery
          )
        }
      } else {
        if (version != 4) continue
        if (isTcpPacket(packet, readLength)) {
          writeTcpFastFail(packet, readLength)
          continue
        }
        parseDnsEnvelope(packet, readLength) ?: continue
      }
      val host = readDnsQuestionHost(envelope.dnsPayload)
      if (!envelope.isQuery) {
        continue
      }

      dnsGuardSessionQueries.incrementAndGet()
      val item = DnsWorkItem(envelope, envelope.dnsPayload, host)
      if (pendingWork.size >= WORK_QUEUE_CAPACITY) {
        pendingWork.poll()
        workPermits.tryAcquire()
        dnsGuardDroppedQueries.incrementAndGet()
      }
      pendingWork.offer(item)
      workPermits.release()
      dnsGuardWorkerQueueDepth.set(pendingWork.size.toLong())
    }
  }

  private fun inspectIpv6DnsPacket(packet: ByteArray, readLength: Int, generation: Long): FreedDnsPacketPolicy.Inspection {
    val inspected = FreedDnsPacketPolicy.inspectIpv6(packet, readLength)
    if (dnsPacketHealth.recordIpv6(generation, inspected)) notifyRuntimeStateChanged()
    return inspected
  }

  private fun runWorkerLoop() {
    while ((workersRunning || workPermits.availablePermits() > 0) && runtimeOwnership.isCurrentThreadEpoch()) {
      if (!workPermits.tryAcquire(WORKER_POLL_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
        if (!workersRunning) break
        continue
      }
      val item = pendingWork.poll() ?: continue
      dnsGuardWorkerQueueDepth.set(pendingWork.size.toLong())
      runCatching { handleQuery(item) }
    }
  }

  private fun handleQuery(item: DnsWorkItem) {
    if (!runtimeOwnership.isCurrentThreadEpoch() || !FreedProtectionConfiguration.interceptionEnabled(this) ||
      item.providerEpoch != recoveryProviderEpoch.get()) return
    val envelope = item.envelope
    val dnsPayload = item.dnsPayload

    if (item.questionHost == null) {
      dnsGuardMalformedPackets.incrementAndGet()
      buildServfailResponse(dnsPayload)?.let { response ->
        writeResponsePacket(envelope, response)
      }
      return
    }

    val classification = if (captivePortalPaused) null else {
      FreedUrlClassifier.classify("https://${item.questionHost}", resolveAdultDomains(), FreedAdultDomainFeed.userAllowedDomains(this))
    }

    val dnsResponse = if (classification?.shouldBlock == true) {
      dnsGuardBlockedQueries.incrementAndGet()
      val normalizedHost = dnsInterventionHost(item.questionHost, classification)
      publishDnsMetadata { lastBlockedHost = normalizedHost }
      recordAndLaunchDnsIntervention(normalizedHost, classification)
      buildNxdomainResponse(dnsPayload)
    } else {
      forwardDns(dnsPayload)?.let { forwarded ->
        if (isValidDnsResponse(forwarded, dnsPayload)) {
          dnsGuardAllowedQueries.incrementAndGet()
          forwarded
        } else {
          null
        }
      } ?: run {
        dnsGuardServfailResponses.incrementAndGet()
        lastForwardFailure?.let { dnsGuardForwardFailureCount.incrementAndGet() }
        buildServfailResponse(dnsPayload)
      }
    } ?: return

    synchronized(FreedRecoveryDnsPilot.configurationLock) {
      if (item.providerEpoch == recoveryProviderEpoch.get()) writeResponsePacket(envelope, dnsResponse)
    }
  }

  private fun writeResponsePacket(envelope: DnsEnvelope, dnsResponse: ByteArray) {
    val responsePacket = FreedDnsPacketPolicy.buildUdpResponse(
      FreedDnsPacketPolicy.DnsEnvelope(
        sourceAddress = envelope.sourceAddress,
        destinationAddress = envelope.destinationAddress,
        sourcePort = envelope.sourcePort,
        destinationPort = envelope.destinationPort,
        dnsPayload = envelope.dnsPayload,
        isQuery = envelope.isQuery
      ),
      dnsResponse
    )
    synchronized(outputLock) {
      val sink = output ?: return
      runCatching { sink.write(responsePacket) }
    }
  }

  private fun writeRawPacket(packet: ByteArray) {
    synchronized(outputLock) {
      val sink = output ?: return
      runCatching { sink.write(packet) }
    }
  }

  private fun writeTcpFastFail(packet: ByteArray, length: Int) {
    val icmp = buildIcmpPortUnreachable(packet, length) ?: return
    synchronized(outputLock) {
      val sink = output ?: return
      runCatching { sink.write(icmp) }
    }
    dnsGuardTcpFastFails.incrementAndGet()
  }

  // ---------------------------------------------------------------------------
  // Classification feed cache.
  // ---------------------------------------------------------------------------

  @Volatile private var cachedFeed: Set<String> = emptySet()
  @Volatile private var cachedFeedSize = -1
  @Volatile private var cachedFeedRefreshedAtElapsedMs = 0L

  private fun resolveAdultDomains(): Set<String> {
    val now = SystemClock.elapsedRealtime()
    val currentSize = FreedAdultDomainFeed.domainCount(this)
    if (currentSize != cachedFeedSize || now - cachedFeedRefreshedAtElapsedMs > FEED_REFRESH_INTERVAL_MS) {
      cachedFeed = FreedAdultDomainFeed.domains(this)
      cachedFeedSize = currentSize
      cachedFeedRefreshedAtElapsedMs = now
    }
    return cachedFeed
  }

  // ---------------------------------------------------------------------------
  // Upstream forwarding with racing + network fallback.
  // ---------------------------------------------------------------------------

  private fun forwardDns(dnsPayload: ByteArray): ByteArray? {
    if (!runtimeOwnership.isCurrentThreadEpoch() || !FreedProtectionConfiguration.interceptionEnabled(this)) return null
    publishDnsMetadata { lastForwardFailure = null }
    return FreedEncryptedDnsPolicy.forward(FreedEncryptedDnsConfig.isRequested(this) || FreedRecoveryDnsPilot.activeOrUnknown(this),
      { forwardEncryptedDns(dnsPayload) }, { forwardPlaintextDns(dnsPayload) })
  }

  private fun forwardEncryptedDns(dnsPayload: ByteArray): ByteArray? {
    // The opt-in selects one transport. Failure never enters UDP resolver
    // racing or the network's plaintext DNS fallback.
    val epoch = runtimeOwnership.threadEpoch()
    if (!runtimeOwnership.isCurrentEpoch(epoch)) return null
    val generation = encryptedDnsHealthGeneration
    val pilotSelected = FreedRecoveryDnsPilot.activeOrUnknown(this)
    if (pilotSelected && !FreedRecoveryDnsPilot.supported(this)) {
      publishDnsMetadata { lastForwardFailure = "Recovery DNS is disabled by this build's pilot gate." }
      recordEncryptedDnsHealth(false, generation)
      return null
    }
    if (!pilotSelected && !FreedEncryptedDnsConfig.capability(this).supported) {
      publishDnsMetadata { lastForwardFailure = "Encrypted DNS is disabled by this build's release gate." }
      recordEncryptedDnsHealth(false, generation)
      return null
    }
    val privacy = FreedNetworkDnsState.read(this)
    if (!FreedDnsGuardPolicy.allowsPlaintext(privacy.mode)) {
      stopForDnsPrivacy(privacy.mode, epoch)
      return null
    }
    val startedAt = SystemClock.elapsedRealtime()
    val providerEpoch = recoveryProviderEpoch.get()
    val runtime = recoveryUpstream
    val descriptor = recoveryRuntimeDescriptor
    return runCatching {
      if (pilotSelected) {
        check(runtime != null && descriptor == FreedRecoveryDnsPilot.activeDescriptor(this))
        runtime.forward(dnsPayload)
      } else encryptedUpstreamDelegate.value.forward(dnsPayload)
    }
      .onSuccess {
        if (providerEpoch != recoveryProviderEpoch.get() || generation != encryptedDnsHealthGeneration) return null
        publishDnsMetadata { lastForwardResolver = if (pilotSelected) FreedRecoveryDnsPilotPolicy.PROVIDER else FreedDohPolicy.URL }
        if (pilotSelected && descriptor != null) FreedRecoveryDnsPilotRouteCheck.observed(dnsPayload, it, descriptor, recoveryDnsNetworkEpoch())
        recordEncryptedDnsHealth(true, generation)
        recordForwardLatency(SystemClock.elapsedRealtime() - startedAt)
      }.onFailure { error ->
        publishDnsMetadata { lastForwardResolver = null }
        publishDnsMetadata { lastForwardFailure = "Encrypted DNS resolver failed: ${error.javaClass.simpleName}" }
        recordEncryptedDnsHealth(false, generation)
      }.getOrNull()?.takeIf { providerEpoch == recoveryProviderEpoch.get() && generation == encryptedDnsHealthGeneration }
  }

  private fun forwardPlaintextDns(dnsPayload: ByteArray): ByteArray? {
    val startedAt = SystemClock.elapsedRealtime()
    val raced = raceForward(dnsPayload, listOf(PRIMARY_DNS, SECONDARY_DNS), RACE_BUDGET_MS)
    val response = raced
      ?: sequentialFallback(dnsPayload)
      ?: run {
        publishDnsMetadata { lastForwardResolver = null }
        publishDnsMetadata { lastForwardFailure = "All configured DNS resolvers timed out or failed." }
        null
      }
    if (response != null) {
      recordForwardLatency(SystemClock.elapsedRealtime() - startedAt)
    }
    return response
  }

  private fun raceForward(dnsPayload: ByteArray, resolvers: List<String>, budgetMs: Long): ByteArray? {
    if (resolvers.isEmpty()) return null
    val results = resolvers.map { resolver ->
      ThreadWithResult(runtimeOwnership, runtimeOwnership.threadEpoch()) {
        forwardDnsToResolver(dnsPayload, resolver)
      }
    }
    results.forEach { it.start() }
    val deadline = SystemClock.elapsedRealtime() + budgetMs
    var winning: ByteArray? = null
    for (attempt in results) {
      val remaining = (deadline - SystemClock.elapsedRealtime()).coerceAtLeast(MIN_RACE_JOIN_MS)
      val value = attempt.await(remaining)
      if (value != null && winning == null) {
        winning = value
        break
      }
    }
    results.forEach { it.cancel() }
    if (winning != null) {
      return winning
    }
    // All racers lost the race budget; give each a short grace join before falling back.
    results.forEach { attempt ->
      val late = attempt.await(GRACE_JOIN_MS)
      if (late != null && winning == null) {
        winning = late
      }
    }
    return winning
  }

  private fun sequentialFallback(dnsPayload: ByteArray): ByteArray? {
    for (resolver in networkResolvers) {
      val response = forwardDnsToResolver(dnsPayload, resolver)
      if (response != null && isValidDnsResponse(response, dnsPayload)) {
        publishDnsMetadata { lastForwardResolver = resolver }
        dnsGuardNetworkFallbackHits.incrementAndGet()
        return response
      }
    }
    return null
  }

  private fun forwardDnsToResolver(dnsPayload: ByteArray, resolver: String): ByteArray? {
    val epoch = runtimeOwnership.threadEpoch()
    if (!runtimeOwnership.isCurrentEpoch(epoch) || !FreedProtectionConfiguration.interceptionEnabled(this)) return null
    // Recheck per query as network privacy settings can change after startup.
    val privacy = FreedNetworkDnsState.read(this)
    if (!FreedDnsGuardPolicy.allowsPlaintext(privacy.mode)) {
      stopForDnsPrivacy(privacy.mode, epoch)
      return null
    }
    return runCatching {
      DatagramSocket().use { socket ->
        if (!runtimeOwnership.registerUdpSocket(epoch, socket)) return null
        try {
        if (!protect(socket)) return null
        socket.soTimeout = RESOLVER_TIMEOUT_MS
        val currentPrivacy = FreedNetworkDnsState.read(this)
        if (!FreedDnsGuardPolicy.allowsPlaintext(currentPrivacy.mode)) {
          stopForDnsPrivacy(currentPrivacy.mode, epoch)
          return null
        }
        val request = DatagramPacket(
          dnsPayload,
          dnsPayload.size,
          InetAddress.getByName(resolver),
          DNS_PORT
        )
        val sent = FreedEncryptedDnsConfig.withPlaintextPermission(this) {
          socket.send(request)
          true
        } ?: false
        if (!sent) return null

        val responseBytes = ByteArray(MAX_DNS_PAYLOAD_SIZE)
        val response = DatagramPacket(responseBytes, responseBytes.size)
        socket.receive(response)
        publishDnsMetadata { lastForwardResolver = resolver }
        response.data.copyOfRange(0, response.length)
        } finally {
          socket.close()
          runtimeOwnership.releaseUdpSocket(socket)
        }
      }
    }.onFailure { error ->
      publishDnsMetadata { lastForwardFailure = "${resolver}: ${error.javaClass.simpleName}" }
    }.getOrNull()
  }

  private fun publishDnsMetadata(operation: () -> Unit) {
    runtimeOwnership.withEpoch(runtimeOwnership.threadEpoch()) {
      if (FreedProtectionConfiguration.interceptionEnabled(this)) operation()
    }
  }

  private fun recordForwardLatency(elapsedMs: Long) {
    dnsGuardAvgForwardMsRaw.updateAndGet { current ->
      if (current <= 0L) elapsedMs else (current * 7L + elapsedMs) / 8L
    }
  }

  /**
   * A lightweight one-shot thread wrapper so resolver races stay dependency-free.
   */
  private class ThreadWithResult(private val ownership: FreedDnsRuntimeOwnership, private val epoch: Long, private val block: () -> ByteArray?) {
    private val latch = CountDownLatch(1)
    @Volatile private var value: ByteArray? = null
    @Volatile private var worker: Thread? = null

    fun start() {
      worker = ownership.startThread(epoch, "FreedDnsRace") {
        value = runCatching { block() }.getOrNull()
        latch.countDown()
      }
      if (worker == null) latch.countDown()
    }

    fun await(timeoutMs: Long): ByteArray? {
      latch.await(timeoutMs, TimeUnit.MILLISECONDS)
      return value
    }

    fun cancel() {
      worker?.interrupt()
    }
  }

  // ---------------------------------------------------------------------------
  // Intervention recording.
  // ---------------------------------------------------------------------------

  private fun dnsInterventionHost(questionHost: String, result: FreedClassification): String {
    val resultHost = FreedUrlClassifier.normalizeHostForStorage(result.host)
    if (resultHost.isNotBlank()) return resultHost

    val fallbackHost = FreedUrlClassifier.normalizeHostForStorage(questionHost)
    return fallbackHost.ifBlank { "redacted.freed.local" }
  }

  private fun recordAndLaunchDnsIntervention(host: String, result: FreedClassification): Unit = synchronized(FreedNativeUnlockStore.lock) {
    val epoch = runtimeOwnership.threadEpoch()
    if (!runtimeOwnership.isCurrentEpoch(epoch) || !FreedProtectionConfiguration.interceptionEnabled(this)) return@synchronized
    val now = SystemClock.elapsedRealtime()
    val key = "dns:${host}:${result.matchedRule}"
    if (key == lastBlockedKey && now - lastBlockedElapsedMs < INTERVENTION_DEDUPE_WINDOW_MS) return@synchronized

    lastBlockedKey = key
    lastBlockedElapsedMs = now
    val redactedUrl = "https://$host"
    val interventionId = UUID.randomUUID().toString()

    val configurationEpoch = FreedProtectionConfiguration.epoch(this)
    val prefs = getSharedPreferences(FreedAccessibilityService.PREFS_NAME, MODE_PRIVATE)
    val published = runCatching { FreedWebsiteRecoveryHandoff.publish(this, prefs, interventionId) {
      putString(FreedAccessibilityService.PENDING_INTERVENTION_ID, interventionId)
      putString(FreedAccessibilityService.PENDING_URL, redactedUrl)
      putString(FreedAccessibilityService.PENDING_HOST, host)
      putString(FreedAccessibilityService.PENDING_SOURCE_PACKAGE, "android-dns")
      putString(FreedAccessibilityService.PENDING_REASON, "Adult-domain DNS request blocked. Recovery support is available on request.")
      putString(FreedAccessibilityService.PENDING_RULE, result.matchedRule)
      putString(FreedAccessibilityService.PENDING_DETECTED_AT, nowIsoString())
    } }.getOrDefault(false)
    // Capture the system-connected service now, never at dispatch of old VPN work.
    val dispatch = if (published) runCatching { FreedAccessibilityService.captureWebsiteRecoveryRequest(interventionId, configurationEpoch) {
      runtimeOwnership.isCurrentEpoch(epoch)
    } }.getOrNull() else null
    Handler(Looper.getMainLooper()).post {
      synchronized(FreedNativeUnlockStore.lock) {
        if (!runtimeOwnership.isCurrentEpoch(epoch) || configurationEpoch != FreedProtectionConfiguration.epoch(this) ||
          !FreedProtectionConfiguration.interceptionEnabled(this)) return@post
        if (published && !FreedWebsiteRecoveryHandoff.current(this, prefs.all, interventionId)) return@post
        // Filtering is independent from notification permission or background launch acceptance.
        runCatching { showDnsInterventionNotification(host, redactedUrl, result.matchedRule) }
        runCatching { dispatch?.invoke() }
      }
    }
    Unit
  }

  private fun buildDnsInterventionIntent(host: String, redactedUrl: String, matchedRule: String): Intent {
    // Notification taps are a context-free manual choice, independent of process-local private receipts.
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
      ?: Intent(Intent.ACTION_VIEW).setPackage(packageName)
    return launchIntent.apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("freed://guided-reset")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
  }

  private fun showDnsInterventionNotification(host: String, redactedUrl: String, matchedRule: String) {
    val notificationManager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          INTERVENTION_NOTIFICATION_CHANNEL_ID,
          FreedNativeCopy.text(this@FreedVpnService, R.string.freed_recovery_channel),
          NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
          description = FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_intervention_channel_description)
        }
      )
    }

    val interventionIntent = buildDnsInterventionIntent(host, redactedUrl, matchedRule)
    val contentPendingIntent = PendingIntent.getActivity(
      this,
      INTERVENTION_NOTIFICATION_ID,
      interventionIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_lock_lock
    val message = FreedNativeCopy.text(this@FreedVpnService, R.string.freed_dns_intervention_notification)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, INTERVENTION_NOTIFICATION_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    builder
      .setSmallIcon(icon)
      .setContentTitle(FreedNativeCopy.text(this@FreedVpnService, R.string.freed_recovery_channel))
      .setContentText(message)
      .setStyle(Notification.BigTextStyle().bigText(message))
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setContentIntent(contentPendingIntent)
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_STATUS)

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_DEFAULT)
    }

    FreedRetainedAdultProtection.publishPrivateNotice(this, INTERVENTION_NOTIFICATION_ID) {
      notificationManager.notify(INTERVENTION_NOTIFICATION_ID, builder.build())
    }
  }


  private fun isTcpPacket(packet: ByteArray, readLength: Int): Boolean {
    if (readLength < IPV4_HEADER_SIZE) return false
    val internetHeaderLength = (unsigned(packet[0]) and 0x0f) * 4
    if (internetHeaderLength < IPV4_HEADER_SIZE || readLength < internetHeaderLength) return false
    return unsigned(packet[9]) == TCP_PROTOCOL
  }

  /**
   * TCP/53 queries that fall back from UDP would otherwise hang inside the TUN
   * until client-side timeout. Answering with ICMP port-unreachable makes the
   * client fail fast and stay on UDP, which this service handles.
   */
  private fun buildIcmpPortUnreachable(packet: ByteArray, length: Int): ByteArray? {
    if (length < IPV4_HEADER_SIZE + ICMP_EMBEDDED_MIN_BYTES) return null
    val ihl = (unsigned(packet[0]) and 0x0f) * 4
    if (ihl < IPV4_HEADER_SIZE || length < ihl + ICMP_EMBEDDED_MIN_BYTES) return null

    val icmpLength = ICMP_HEADER_SIZE + ihl + ICMP_EMBEDDED_MIN_BYTES
    val totalLength = IPV4_HEADER_SIZE + icmpLength
    val response = ByteArray(totalLength)

    // Outer IPv4 header: pretend to be the resolver replying to the device.
    response[0] = 0x45
    response[1] = 0
    writeShort(response, 2, totalLength)
    writeShort(response, 4, 0)
    writeShort(response, 6, 0)
    response[8] = 64
    response[9] = ICMP_PROTOCOL.toByte()
    packet.copyOfRange(16, 20).copyInto(response, destinationOffset = 12)
    packet.copyOfRange(12, 16).copyInto(response, destinationOffset = 16)
    writeShort(response, 10, ipStyleChecksum(response, 0, IPV4_HEADER_SIZE))

    // ICMP header: type 3 (destination unreachable), code 3 (port unreachable).
    val icmpOffset = IPV4_HEADER_SIZE
    response[icmpOffset] = 3
    response[icmpOffset + 1] = 3
    writeShort(response, icmpOffset + 2, 0)
    writeShort(response, icmpOffset + 4, 0)

    // Embedded original header + first 8 bytes of payload.
    packet.copyOfRange(0, ihl).copyInto(response, destinationOffset = icmpOffset + ICMP_HEADER_SIZE)
    packet.copyOfRange(ihl, ihl + ICMP_EMBEDDED_MIN_BYTES)
      .copyInto(response, destinationOffset = icmpOffset + ICMP_HEADER_SIZE + ihl)

    val icmpChecksum = ipStyleChecksum(response, icmpOffset, icmpLength)
    writeShort(response, icmpOffset + 2, icmpChecksum)
    return response
  }

  private fun parseDnsEnvelope(packet: ByteArray, readLength: Int): DnsEnvelope? {
    return when (val inspected = FreedDnsPacketPolicy.inspectIpv4(packet, readLength)) {
      is FreedDnsPacketPolicy.Inspection.UdpDns -> if (inspected.envelope.destinationPort != DNS_PORT) null else DnsEnvelope(
        sourceAddress = inspected.envelope.sourceAddress,
        destinationAddress = inspected.envelope.destinationAddress,
        sourcePort = inspected.envelope.sourcePort,
        destinationPort = inspected.envelope.destinationPort,
        dnsPayload = inspected.envelope.dnsPayload,
        isQuery = inspected.envelope.isQuery
      )
      FreedDnsPacketPolicy.Inspection.Malformed -> {
        dnsGuardMalformedPackets.incrementAndGet()
        null
      }
      else -> null
    }
  }

  private fun readDnsQuestionHost(dnsPayload: ByteArray): String? {
    if (dnsPayload.size < DNS_HEADER_SIZE || readShort(dnsPayload, 4) < 1) return null

    var offset = DNS_HEADER_SIZE
    val labels = mutableListOf<String>()
    while (offset < dnsPayload.size) {
      val length = unsigned(dnsPayload[offset])
      if (length == 0) {
        offset += 1
        break
      }
      if ((length and 0xc0) != 0 || length > MAX_DNS_LABEL_LENGTH) return null
      if (offset + 1 + length > dnsPayload.size) return null

      labels += dnsPayload.copyOfRange(offset + 1, offset + 1 + length)
        .toString(Charsets.UTF_8)
        .lowercase(Locale.US)
      offset += 1 + length
    }

    if (labels.isEmpty() || offset + 4 > dnsPayload.size) return null
    return labels.joinToString(".")
  }

  /**
   * Guards against mismatched upstream replies racing in: transaction ID must
   * match the question and the QR bit must mark the payload as a response.
   */
  private fun isValidDnsResponse(response: ByteArray, question: ByteArray): Boolean {
    if (response.size < DNS_HEADER_SIZE || question.size < DNS_HEADER_SIZE) return false
    if (response[0] != question[0] || response[1] != question[1]) return false
    return (unsigned(response[2]) and 0x80) != 0
  }

  private fun buildNxdomainResponse(queryPayload: ByteArray): ByteArray? {
    return buildDnsErrorResponse(queryPayload, DNS_RCODE_NXDOMAIN)
  }

  private fun buildServfailResponse(queryPayload: ByteArray): ByteArray? {
    return buildDnsErrorResponse(queryPayload, DNS_RCODE_SERVFAIL)
  }

  private fun buildDnsErrorResponse(queryPayload: ByteArray, responseCode: Int): ByteArray? {
    if (queryPayload.size < DNS_HEADER_SIZE) return null
    val questionEnd = findQuestionEnd(queryPayload) ?: DNS_HEADER_SIZE
    val response = ByteArray(questionEnd)

    queryPayload.copyInto(response, endIndex = questionEnd)
    response[2] = 0x81.toByte()
    response[3] = (0x80 or (responseCode and 0x0f)).toByte()
    if (questionEnd == DNS_HEADER_SIZE) writeShort(response, 4, 0)
    writeShort(response, 6, 0)
    writeShort(response, 8, 0)
    writeShort(response, 10, 0)

    return response
  }

  private fun findQuestionEnd(dnsPayload: ByteArray): Int? {
    var offset = DNS_HEADER_SIZE
    while (offset < dnsPayload.size) {
      val length = unsigned(dnsPayload[offset])
      offset += 1
      if (length == 0) break
      if ((length and 0xc0) != 0 || length > MAX_DNS_LABEL_LENGTH) return null
      offset += length
      if (offset > dnsPayload.size) return null
    }

    val end = offset + 4
    return if (end <= dnsPayload.size) end else null
  }

  private fun ipStyleChecksum(packet: ByteArray, offset: Int, length: Int): Int {
    var sum = 0
    var index = offset
    val end = offset + length
    while (index < end) {
      if (index == offset + 10 && length == IPV4_HEADER_SIZE) {
        index += 2
        continue
      }
      val high = unsigned(packet[index]) shl 8
      val low = if (index + 1 < end) unsigned(packet[index + 1]) else 0
      sum += high or low
      while (sum > 0xffff) {
        sum = (sum and 0xffff) + (sum ushr 16)
      }
      index += 2
    }
    return sum.inv() and 0xffff
  }

  private fun readShort(bytes: ByteArray, offset: Int): Int {
    return (unsigned(bytes[offset]) shl 8) or unsigned(bytes[offset + 1])
  }

  private fun writeShort(bytes: ByteArray, offset: Int, value: Int) {
    bytes[offset] = ((value ushr 8) and 0xff).toByte()
    bytes[offset + 1] = (value and 0xff).toByte()
  }

  private fun unsigned(byte: Byte): Int = byte.toInt() and 0xff

  private data class DnsEnvelope(
    val sourceAddress: ByteArray,
    val destinationAddress: ByteArray,
    val sourcePort: Int,
    val destinationPort: Int,
    val dnsPayload: ByteArray,
    val isQuery: Boolean,
  )

  companion object {
    @Volatile private var liveService: FreedVpnService? = null
    @Volatile private var activeRuntimeService: FreedVpnService? = null
    private val serviceOwners = java.util.concurrent.ConcurrentHashMap.newKeySet<FreedVpnService>()
    private val runtimeStops = java.util.concurrent.atomic.AtomicInteger(0)
    @Volatile private var runtimeCloseSucceeded = true
    private val runtimeOwners = java.util.concurrent.ConcurrentHashMap.newKeySet<FreedDnsRuntimeOwnership>()

    fun ownedRuntimeCanReactivate(): Boolean = !isRunning && runtimeStops.get() == 0 && runtimeCloseSucceeded &&
      serviceOwners.all { it.ownerCloseSucceeded && it.vpnInterface == null && it.output == null && it.unadmittedInterfaces.isEmpty() && it.recoveryUpstreamOwners.isEmpty() } && runtimeOwners.all { it.isStopped() }

    fun stopOwnedRuntimeForReset(context: Context, stopReason: String = "configuration-reset"): Boolean =
      stopOwnedRuntimeForReset(context, stopReason, null)
    internal fun stopOwnedRuntimeForReset(context: Context, stopReason: String, permit: FreedAdultPermit?): Boolean {
      val generation = FreedAdultProtectionState.guarded(context) {
        FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.DISABLE_ADULT_FILTER,
          "dns-runtime", (!ownedRuntimeCanReactivate()).toString(), "false", permit)
        runtimeStops.incrementAndGet()
        FreedAdultProtectionState.callbackEpoch(context)
      }
      var owners = emptyList<FreedDnsRuntimeOwnership>()
      var services = emptyList<FreedVpnService>()
      val dispatchOpen = java.util.concurrent.atomic.AtomicBoolean(true)
      val callbackFinished = java.util.concurrent.atomic.AtomicBoolean(false)
      val returned = java.util.concurrent.atomic.AtomicBoolean(false)
      val released = java.util.concurrent.atomic.AtomicBoolean(false)
      fun releaseBarrier() { if (released.compareAndSet(false, true)) runtimeStops.decrementAndGet() }
      try {
        val resourcesClosed = FreedProtectionConfiguration.runOnMainForReset operation@ {
          if (!dispatchOpen.compareAndSet(true, false)) return@operation false
          try {
          val current = FreedAdultProtectionState.guarded(context) {
            if (generation != FreedAdultProtectionState.callbackEpoch(context)) false else {
              owners = runtimeOwners.toList(); services = serviceOwners.toList(); true
            }
          }
          if (!current) false else {
            val udpClosed = owners.map { it.closeAndInterrupt() }.all { it }
            val closed = services.map { it.stopDnsGuard(stopReason) }.all { it }
            val requested = runCatching { context.stopService(Intent(context, FreedVpnService::class.java)); services.forEach { it.stopSelf() } }.isSuccess
            udpClosed && closed && requested
          }
          } finally {
            callbackFinished.set(true)
            if (returned.get()) releaseBarrier()
          }
        }
        if (!resourcesClosed) return false
        val deadline = SystemClock.elapsedRealtime() + 4_500L
        val workersStopped = owners.map { it.awaitStopped((deadline - SystemClock.elapsedRealtime()).coerceAtLeast(0L)) }.all { it }
        return FreedAdultProtectionState.guarded(context) {
          if (!resourcesClosed || !workersStopped || generation != FreedAdultProtectionState.callbackEpoch(context) ||
            serviceOwners.any { it !in services } || runtimeOwners.any { it !in owners } ||
            services.any { !it.ownerCloseSucceeded || it.vpnInterface != null || it.output != null || it.unadmittedInterfaces.isNotEmpty() || it.recoveryUpstreamOwners.isNotEmpty() } ||
            runtimeOwners.any { !it.isStopped() } || isRunning) false else {
            runtimeOwners.removeAll { it.isStopped() }
            serviceOwners.removeAll { it.ownerCloseSucceeded && it.vpnInterface == null && it.output == null && it.unadmittedInterfaces.isEmpty() && it.recoveryUpstreamOwners.isEmpty() && it.runtimeOwnership.isStopped() }
            runtimeCloseSucceeded = true
            resetPrivateRuntimeHistory()
            dnsGuardLastStopReason = stopReason
            true
          }
        }
      } finally {
        returned.set(true)
        // A timeout cannot release admission while an already-running callback owns resources.
        // If it has not begun, atomically disarm it before dropping the barrier.
        if (dispatchOpen.compareAndSet(true, false) || callbackFinished.get()) releaseBarrier()
      }
    }

    /** Conditional original-process diagnostics only; never tunnel/worker/adult intent teardown. */
    fun capturePrivateRuntimeHistoryIdentity(): String = synchronized(privateHistoryLock) { "$privateHistoryProcessID:$privateHistoryRevision" }
    fun clearPrivateRuntimeHistoryRetainingAdult(expected: String): Boolean = synchronized(privateHistoryLock) {
      if (expected in settledPrivateHistories) return@synchronized true
      if (expected.substringBefore(':') != privateHistoryProcessID) return@synchronized true
      if (expected != capturePrivateRuntimeHistoryIdentity() || settledPrivateHistories.size >= 32) return@synchronized false
      lastBlockedHost = null; lastForwardFailure = null; lastBlockedKey = ""; lastBlockedElapsedMs = 0L
      // Independent original-resource acknowledgement survives a failed/lost aggregate document save.
      // New publications never change this acknowledgement or authorize adopting their identity.
      settledPrivateHistories.add(expected)
      true
    }
    fun forgetPrivateRuntimeHistoryIdentity(expected: String) = synchronized(privateHistoryLock) {
      settledPrivateHistories.remove(expected); Unit
    }
    fun clearPrivateRuntimeHistoryRetainingAdult() { clearPrivateRuntimeHistoryRetainingAdult(capturePrivateRuntimeHistoryIdentity()) }
    @Volatile var lastAdultStopReceipt: Map<String, Any?> = emptyMap()
      private set

    /** Stops DNS Guard only. Accessibility adult URL classification has independent intent. */
    fun requestAdultStop(context: Context): Map<String, Any?> {
      try { setUserEnabled(context, false) }
      catch (failure: Exception) { return (((failure as? FreedAdultMutationFailure)?.receipt()
        ?: mapOf("accepted" to false, "reason" to "adult-mutation-write-failed")) + mapOf("scope" to "dns-guard")).also { lastAdultStopReceipt = it } }
      val generation = FreedAdultProtectionState.callbackEpoch(context)
      val stopped = runCatching { stopOwnedRuntimeForReset(context, STOP_REASON_MANUAL) }.getOrDefault(false)
      return FreedAdultProtectionState.guarded(context) {
      if (generation != FreedAdultProtectionState.callbackEpoch(context)) return@guarded mapOf("accepted" to false,
        "scope" to "dns-guard", "reason" to "adult-stop-superseded", "runtimeStopped" to false)
      mapOf("accepted" to stopped, "operation" to "stop-dns-guard", "scope" to "dns-guard",
        "stopRequested" to true, "runtimeStopped" to (stopped && !isRunning),
        "reason" to if (stopped) null else "adult-runtime-stop-unconfirmed").also { lastAdultStopReceipt = it }
      }
    }

    private fun resetPrivateRuntimeHistory() {
      resetEncryptedDnsHealth()
      lastBlockedHost = null
      lastForwardResolver = null
      lastForwardFailure = null
      lastBlockedKey = ""
      lastBlockedElapsedMs = 0L
      dnsGuardStartedAtElapsedMs = 0L
      dnsGuardStoppedAtElapsedMs = 0L
      dnsGuardLastSessionDurationMs = 0L
      dnsGuardLastStopReason = "configuration-reset"
      networkResolvers = emptyList()
      listOf(dnsGuardStartCount, dnsGuardStopCount, dnsGuardPacketsRead, dnsGuardSessionQueries, dnsGuardAllowedQueries,
        dnsGuardBlockedQueries, dnsGuardServfailResponses, dnsGuardMalformedPackets, dnsGuardDroppedQueries,
        dnsGuardIpv6MalformedPackets, dnsGuardIpv6UnsupportedPackets, dnsGuardTcpFastFails,
        dnsGuardNetworkFallbackHits, dnsGuardForwardFailureCount, dnsGuardWorkerQueueDepth,
        dnsGuardAvgForwardMsRaw).forEach { it.set(0L) }
    }
    const val ACTION_START = "app.freed.protection.START_DNS_GUARD"
    const val ACTION_STOP = "app.freed.protection.STOP_DNS_GUARD"
    const val ACTION_RESTORE = "app.freed.protection.RESTORE_DNS_GUARD"
    const val EXTRA_RESTORE_ACTION = "app.freed.protection.EXTRA_RESTORE_ACTION"

    const val AUTO_RESTART_RESULT_STARTED = "started"
    const val AUTO_RESTART_RESULT_SKIPPED = "skipped"
    const val AUTO_RESTART_RESULT_FAILED = "failed"

    @Volatile
    var isRunning: Boolean = false
      private set

    // Bumped whenever runtime state flips (started/stopped) so listeners can react
    // to real tunnel transitions instead of optimistic predictions.
    @Volatile
    var runtimeStateVersion: Long = 0L
      private set

    @Volatile
    var onRuntimeStateChanged: (() -> Unit)? = null

    private fun notifyRuntimeStateChanged() {
      runtimeStateVersion += 1L
      onRuntimeStateChanged?.invoke()
    }

    private val privateHistoryLock = Any()
    private val privateHistoryProcessID = java.util.UUID.randomUUID().toString()
    private var privateHistoryRevision = 0L
    private val settledPrivateHistories = linkedSetOf<String>()
    @Volatile
    var lastBlockedHost: String? = null
      private set(value) { synchronized(privateHistoryLock) { field = value; privateHistoryRevision += 1 } }

    @Volatile
    var lastForwardResolver: String? = null
      private set

    @Volatile
    var lastForwardFailure: String? = null
      private set(value) { synchronized(privateHistoryLock) { field = value; privateHistoryRevision += 1 } }

    @Volatile private var encryptedDnsHealth: Boolean? = null
    @Volatile private var encryptedDnsHealthAt: Long = 0L
    @Volatile private var encryptedDnsHealthGeneration: Long = 0L
    private val encryptedDnsHealthLock = Any()
    private val recoveryProviderEpoch = AtomicLong(0)
    private val recoveryNetworkEpoch = AtomicLong(0)
    private val recoveryProcessID = UUID.randomUUID().toString()

    fun recoveryDnsNetworkEpoch(): String = "$recoveryProcessID:${recoveryNetworkEpoch.get()}"
    fun recoveryDnsRuntimeDescriptor(): String? = activeRuntimeService?.recoveryRuntimeDescriptor
      ?.takeIf { isRunning && dnsGuardRuntimeReady }

    internal fun prepareRecoveryDnsRuntime(candidate: FreedRecoveryDnsPilotPolicy.Candidate): FreedRecoveryDnsPilotUpstream {
      val service = activeRuntimeService ?: error("recovery-dns-vpn-not-running")
      check(isRunning && dnsGuardRuntimeReady && !dnsGuardCaptivePaused)
      val network = service.resolverSnapshotActiveNetwork ?: error("recovery-dns-underlying-network-unavailable")
      val epoch = recoveryDnsNetworkEpoch()
      val prepared = FreedRecoveryDnsPilotUpstream.prepare(candidate, FreedRecoveryDnsPilot.descriptor(candidate), network) { service.protect(it) }
      try {
        FreedAdultProtectionState.guarded(service) {
          synchronized(service.recoveryUpstreamLock) {
            check(epoch == recoveryDnsNetworkEpoch() && activeRuntimeService === service && isRunning &&
              dnsGuardRuntimeReady && runtimeStops.get() == 0 && service in serviceOwners)
            service.recoveryUpstreamOwners.add(prepared)
          }
        }
        // Transport admission only; this never produces a system-route receipt.
        val nonce = UUID.randomUUID().toString().replace("-", "")
        val query = FreedRecoveryDnsPilotWire.query(FreedRecoveryDnsPilotWire.host(nonce), 1, 0x4652)
        check(FreedRecoveryDnsPilotWire.sentinel(prepared.forward(query), query, 1)) { "recovery-dns-upstream-unavailable" }
        check(epoch == recoveryDnsNetworkEpoch() && activeRuntimeService === service && isRunning && dnsGuardRuntimeReady)
        return prepared
      } catch (failure: Exception) { releaseRecoveryDnsRuntime(prepared); throw failure }
    }

    /** Caller holds the DNS configuration guard; the old client is retained until durable readback. */
    internal fun swapRecoveryDnsRuntime(prepared: FreedRecoveryDnsPilotUpstream?, networkEpoch: String): FreedRecoveryDnsPilotUpstream? {
      check(Thread.holdsLock(FreedRecoveryDnsPilot.configurationLock))
      val service = activeRuntimeService ?: error("recovery-dns-vpn-not-running")
      return synchronized(service.recoveryUpstreamLock) {
        check(activeRuntimeService === service && isRunning && dnsGuardRuntimeReady && !dnsGuardCaptivePaused && networkEpoch == recoveryDnsNetworkEpoch())
        check(prepared == null || prepared.networkHandle == service.resolverSnapshotActiveNetwork?.networkHandle)
        check(prepared == null || prepared in service.recoveryUpstreamOwners)
        val previous = service.recoveryUpstream
        recoveryProviderEpoch.incrementAndGet()
        service.pendingWork.clear(); service.workPermits.drainPermits()
        service.recoveryUpstream = prepared
        service.recoveryRuntimeDescriptor = prepared?.descriptor
        service.adultRuntimeGeneration = FreedAdultProtectionState.generation(service)
        resetEncryptedDnsHealth()
        check(service.recoveryUpstream === prepared && service.recoveryRuntimeDescriptor == prepared?.descriptor)
        previous
      }
    }

    internal fun finishRecoveryDnsReplacement(previous: FreedRecoveryDnsPilotUpstream?) {
      previous?.let(::releaseRecoveryDnsRuntime)
      activeRuntimeService?.let { service ->
        if (service.encryptedUpstreamDelegate.isInitialized()) service.encryptedUpstreamDelegate.value.close()
      }
    }
    internal fun releaseRecoveryDnsRuntime(upstream: FreedRecoveryDnsPilotUpstream) {
      upstream.close()
      serviceOwners.forEach { it.recoveryUpstreamOwners.remove(upstream) }
    }

    fun encryptedDnsHealthy(): Boolean? = synchronized(encryptedDnsHealthLock) {
      if (isRunning && dnsGuardIpv6UnsupportedPackets.get() > 0L) false
      else if (isRunning && SystemClock.elapsedRealtime() - encryptedDnsHealthAt < 60_000L) encryptedDnsHealth else null
    }

    fun resetEncryptedDnsHealth() = synchronized(encryptedDnsHealthLock) {
      encryptedDnsHealthGeneration += 1L
      encryptedDnsHealth = null
      encryptedDnsHealthAt = 0L
    }

    private fun recordEncryptedDnsHealth(healthy: Boolean, generation: Long) = synchronized(encryptedDnsHealthLock) {
      if (generation != encryptedDnsHealthGeneration) return@synchronized
      encryptedDnsHealth = healthy
      encryptedDnsHealthAt = SystemClock.elapsedRealtime()
    }

    @Volatile
    var dnsGuardStartedAtElapsedMs: Long = 0L
      private set

    @Volatile
    var dnsGuardStoppedAtElapsedMs: Long = 0L
      private set

    @Volatile
    var dnsGuardLastStopReason: String? = null
      private set

    @Volatile
    var dnsGuardLastSessionDurationMs: Long = 0L
      private set

    @Volatile
    var dnsGuardCaptivePaused: Boolean = false
      private set

    @Volatile
    private var networkResolvers: List<String> = emptyList()

    fun networkResolverCount(): Int = networkResolvers.size

    val dnsGuardUptimeMs: Long
      get() {
        val startedAt = dnsGuardStartedAtElapsedMs
        return if (isRunning && startedAt > 0L) {
          (SystemClock.elapsedRealtime() - startedAt).coerceAtLeast(0L)
        } else {
          0L
        }
      }

    val dnsGuardRuntimeReady: Boolean
      get() = isRunning && dnsGuardStartedAtElapsedMs > 0L && dnsGuardLastStopReason == null

    val dnsGuardRuntimeIssue: String?
      get() {
        if (dnsGuardRuntimeReady) return null
        if (!isRunning) return "DNS Guard is not running."
        if (dnsGuardStartedAtElapsedMs <= 0L) return "DNS Guard service has no active runtime timestamp."
        return dnsGuardLastStopReason?.let { "DNS Guard stopped with reason: $it." }
          ?: "DNS Guard runtime is not ready."
      }

    val dnsGuardStartCount = AtomicLong(0L)
    val dnsGuardStopCount = AtomicLong(0L)
    val dnsGuardPacketsRead = AtomicLong(0L)
    val dnsGuardSessionQueries = AtomicLong(0L)
    val dnsGuardAllowedQueries = AtomicLong(0L)
    val dnsGuardBlockedQueries = AtomicLong(0L)
    val dnsGuardServfailResponses = AtomicLong(0L)
    val dnsGuardMalformedPackets = AtomicLong(0L)
    private val dnsPacketHealth = FreedDnsGuardPolicy.PacketHealth()
    val dnsGuardIpv6MalformedPackets = dnsPacketHealth.malformedPackets
    val dnsGuardIpv6UnsupportedPackets = dnsPacketHealth.unsupportedDnsPackets
    @Volatile var dnsGuardIpv4ResolverRouteCount = 0
      private set
    @Volatile var dnsGuardIpv6ResolverRouteCount = 0
      private set
    val dnsGuardDroppedQueries = AtomicLong(0L)
    val dnsGuardTcpFastFails = AtomicLong(0L)
    val dnsGuardNetworkFallbackHits = AtomicLong(0L)
    val dnsGuardForwardFailureCount = AtomicLong(0L)
    val dnsGuardWorkerQueueDepth = AtomicLong(0L)
    private val dnsGuardAvgForwardMsRaw = AtomicLong(0L)

    val dnsGuardAvgForwardMs: Long
      get() = dnsGuardAvgForwardMsRaw.get()

    @Volatile
    private var lastBlockedKey: String = ""
      set(value) { synchronized(privateHistoryLock) { field = value; privateHistoryRevision += 1 } }

    @Volatile
    private var lastBlockedElapsedMs: Long = 0L
      set(value) { synchronized(privateHistoryLock) { field = value; privateHistoryRevision += 1 } }

    private const val VPN_ADDRESS = "10.94.0.2"
    private const val VPN_MTU = 1500
    private const val NOTIFICATION_ID = 9402
    private const val INTERVENTION_NOTIFICATION_ID = 9403
    private const val NOTIFICATION_CHANNEL_ID = "freed_dns_guard"
    private const val INTERVENTION_NOTIFICATION_CHANNEL_ID = "freed_dns_interventions"
    private const val PRIMARY_DNS = "1.1.1.3"
    private const val SECONDARY_DNS = "1.0.0.3"
    val DNS_RESOLVERS = listOf(PRIMARY_DNS, SECONDARY_DNS)
    private const val MAX_PACKET_SIZE = 32767
    private const val MAX_DNS_PAYLOAD_SIZE = 4096
    private const val IPV4_HEADER_SIZE = 20
    private const val DNS_HEADER_SIZE = 12
    private const val TCP_PROTOCOL = 6
    private const val ICMP_PROTOCOL = 1
    private const val ICMP_HEADER_SIZE = 8
    private const val ICMP_EMBEDDED_MIN_BYTES = 8
    private const val DNS_PORT = 53
    private const val MAX_DNS_LABEL_LENGTH = 63
    private const val DNS_RCODE_SERVFAIL = 2
    private const val DNS_RCODE_NXDOMAIN = 3
    private const val STOP_REASON_MANUAL = "manual-stop"
    private const val STOP_REASON_SERVICE_DESTROY = "service-destroy"
    private const val STOP_REASON_VPN_REVOKED = "vpn-revoked"
    private const val STOP_REASON_ESTABLISH_FAILED = "establish-failed"
    private const val STOP_REASON_RESOLVER_ROUTE_FAILED = "resolver-route-failed"
    private const val STOP_REASON_RESOLVER_ROUTES_CHANGED = "resolver-routes-changed"
    private const val STOP_REASON_LOOP_ENDED = "dns-loop-ended"
    private const val STOP_REASON_LOOP_FAILED = "dns-loop-failed"

    private const val DNS_WORKER_COUNT = 4
    private const val WORK_QUEUE_CAPACITY = 128
    private const val WORKER_POLL_TIMEOUT_MS = 250L
    private const val RESOLVER_TIMEOUT_MS = 1_800
    private const val RACE_BUDGET_MS = 1_400L
    private const val GRACE_JOIN_MS = 500L
    private const val MIN_RACE_JOIN_MS = 50L
    private const val MAX_NETWORK_RESOLVERS = 3
    private const val FEED_REFRESH_INTERVAL_MS = 15_000L
    private const val INTERVENTION_DEDUPE_WINDOW_MS = 4_000L
    private const val CAPTIVE_PROBE_INTERVAL_MS = 60_000L
    private const val CAPTIVE_PROBE_IDLE_MS = 5_000L
    private const val CAPTIVE_PROBE_CONNECT_TIMEOUT_MS = 2_500
    private const val CAPTIVE_PROBE_READ_TIMEOUT_MS = 2_500
    private const val CAPTIVE_PROBE_HOST = "connectivitycheck.gstatic.com"

    private const val PREF_DNS_GUARD_USER_ENABLED = "dns_guard_user_enabled"
    private const val PREF_DNS_GUARD_AUTO_RESTART_ACTION = "dns_guard_auto_restart_action"
    private const val PREF_DNS_GUARD_AUTO_RESTART_AT = "dns_guard_auto_restart_at"
    private const val PREF_DNS_GUARD_AUTO_RESTART_RESULT = "dns_guard_auto_restart_result"
    private const val PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON = "dns_guard_auto_restart_skip_reason"

    fun setUserEnabled(context: Context, enabled: Boolean): Unit = setUserEnabled(context, enabled, null)
    internal fun setUserEnabled(context: Context, enabled: Boolean, permit: FreedAdultPermit?): Unit = FreedAdultProtectionState.guarded(context) {
      if (!enabled) FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.DISABLE_ADULT_FILTER,
        "dns-intent", isUserEnabled(context).toString(), "false", permit)
      else FreedAdultProtectionState.repairFence(context, "dns-enable")
      synchronized(FreedNativeUnlockStore.lock) {
      if (!FreedProtectionConfiguration.interceptionEnabled(context))
        throw FreedAdultMutationFailure(FriendLockAction.DISABLE_ADULT_FILTER, "adult-configuration-disabled")
      val editor = prefs(context).edit().putBoolean(PREF_DNS_GUARD_USER_ENABLED, enabled)
      if (!enabled) {
        editor.putString(PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON, "user-disabled")
      } else {
        // A fresh user-enabled grant must clear any stale skip reason (for example
        // "user-disabled" written while the VPN consent dialog was still pending).
        editor.remove(PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON)
      }
      if (!editor.commit() || isUserEnabled(context) != enabled)
        throw FreedAdultMutationFailure(FriendLockAction.DISABLE_ADULT_FILTER, "adult-intent-save-unconfirmed")
      }
    }

    internal fun userEnabledReadback(context: Context): Boolean? { return prefs(context).all[PREF_DNS_GUARD_USER_ENABLED] as? Boolean }

    fun isUserEnabled(context: Context): Boolean {
      return prefs(context).getBoolean(PREF_DNS_GUARD_USER_ENABLED, false)
    }

    fun isAutoRestartEligible(context: Context): Boolean {
      return autoRestartSkipReason(context) == null
    }

    fun lastAutoRestartAction(context: Context): String? {
      return prefs(context).getString(PREF_DNS_GUARD_AUTO_RESTART_ACTION, null)
    }

    fun lastAutoRestartAt(context: Context): String? {
      return prefs(context).getString(PREF_DNS_GUARD_AUTO_RESTART_AT, null)
    }

    fun lastAutoRestartResult(context: Context): String? {
      return prefs(context).getString(PREF_DNS_GUARD_AUTO_RESTART_RESULT, null)
    }

    fun lastAutoRestartSkipReason(context: Context): String? {
      return prefs(context).getString(PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON, null)
    }

    fun startUserEnabledGuard(context: Context) {
      if (!FreedProtectionConfiguration.interceptionEnabled(context)) return
      setUserEnabled(context, true)
      // The service flips its own runtime flags after establish() succeeds; do not
      // pre-mark them here or startDnsGuard() aborts and the tunnel never comes up.
      startServiceAction(context, ACTION_START)
    }

    fun restartAfterSystemEvent(context: Context, restoreAction: String?) {
      if (!FreedProtectionConfiguration.interceptionEnabled(context)) return
      val action = restoreAction ?: "unknown"
      val skipReason = autoRestartSkipReason(context)
      if (skipReason != null) {
        recordAutoRestart(context, action, AUTO_RESTART_RESULT_SKIPPED, skipReason)
        return
      }

      val result = runCatching {
        startServiceAction(context, ACTION_RESTORE, action)
      }
      if (result.isSuccess) {
        recordAutoRestart(context, action, AUTO_RESTART_RESULT_STARTED, null)
      } else {
        val reason = result.exceptionOrNull()?.javaClass?.simpleName ?: "start-failed"
        recordAutoRestart(context, action, AUTO_RESTART_RESULT_FAILED, reason)
      }
    }

    private fun startServiceAction(context: Context, action: String, restoreAction: String? = null) {
      val intent = Intent(context, FreedVpnService::class.java).apply {
        this.action = action
        putExtra("freed_adult_generation", FreedAdultProtectionState.generation(context) ?: -1L)
        if (restoreAction != null) {
          putExtra(EXTRA_RESTORE_ACTION, restoreAction)
        }
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    private fun autoRestartSkipReason(context: Context): String? {
      return when {
        !FreedProtectionConfiguration.interceptionEnabled(context) -> "configuration-reset"
        !isUserEnabled(context) -> "user-disabled"
        !FreedDnsGuardPolicy.allowsPlaintext(FreedNetworkDnsState.read(context).mode) ->
          FreedDnsGuardPolicy.issueCode(false, false, FreedNetworkDnsState.read(context).mode)
        VpnService.prepare(context) != null -> "vpn-permission-required"
        isRunning -> "already-running"
        else -> null
      }
    }

    private fun recordAutoRestart(context: Context, action: String, result: String, skipReason: String?) {
      prefs(context).edit()
        .putString(PREF_DNS_GUARD_AUTO_RESTART_ACTION, action)
        .putString(PREF_DNS_GUARD_AUTO_RESTART_AT, nowWallClockIsoString())
        .putString(PREF_DNS_GUARD_AUTO_RESTART_RESULT, result)
        .apply {
          if (skipReason == null) {
            remove(PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON)
          } else {
            putString(PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON, skipReason)
          }
        }
        .apply()
    }

    private fun prefs(context: Context) =
      context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE)

    private fun nowIsoString(): String {
      return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
      }.format(Date())
    }

    private fun nowWallClockIsoString(): String {
      return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
      }.format(Date())
    }

    private fun markDnsGuardStarted() {
      recoveryNetworkEpoch.incrementAndGet()
      resetEncryptedDnsHealth()
      dnsGuardStartedAtElapsedMs = SystemClock.elapsedRealtime()
      dnsGuardStoppedAtElapsedMs = 0L
      dnsGuardLastStopReason = null
      dnsGuardLastSessionDurationMs = 0L
      lastBlockedHost = null
      lastForwardResolver = null
      lastForwardFailure = null
      lastBlockedKey = ""
      lastBlockedElapsedMs = 0L
      dnsGuardPacketsRead.set(0L)
      dnsGuardSessionQueries.set(0L)
      dnsGuardAllowedQueries.set(0L)
      dnsGuardBlockedQueries.set(0L)
      dnsGuardServfailResponses.set(0L)
      dnsGuardMalformedPackets.set(0L)
      dnsGuardDroppedQueries.set(0L)
      dnsGuardTcpFastFails.set(0L)
      dnsGuardNetworkFallbackHits.set(0L)
      dnsGuardForwardFailureCount.set(0L)
      dnsGuardWorkerQueueDepth.set(0L)
      dnsGuardAvgForwardMsRaw.set(0L)
      dnsGuardStartCount.incrementAndGet()
      isRunning = true
    }

    private fun markDnsGuardStopped(reason: String) {
      recoveryNetworkEpoch.incrementAndGet()
      val wasRunning = isRunning
      val stoppedAt = SystemClock.elapsedRealtime()
      isRunning = false
      dnsGuardStoppedAtElapsedMs = stoppedAt
      if (wasRunning || dnsGuardLastStopReason == null) {
        dnsGuardLastStopReason = reason
      }
      val startedAt = dnsGuardStartedAtElapsedMs
      if (startedAt > 0L && stoppedAt >= startedAt) {
        dnsGuardLastSessionDurationMs = stoppedAt - startedAt
      }
      if (wasRunning) dnsGuardStopCount.incrementAndGet()
    }
  }
}
