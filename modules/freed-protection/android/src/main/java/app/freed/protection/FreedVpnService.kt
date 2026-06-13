package app.freed.protection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.atomic.AtomicLong
import kotlin.concurrent.thread
import kotlin.math.min

class FreedVpnService : VpnService() {
  private var vpnInterface: ParcelFileDescriptor? = null
  private var vpnThread: Thread? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        setUserEnabled(this, false)
        stopDnsGuard(STOP_REASON_MANUAL)
        stopSelf()
        return START_NOT_STICKY
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
    stopDnsGuard(STOP_REASON_SERVICE_DESTROY)
    super.onDestroy()
  }

  override fun onRevoke() {
    setUserEnabled(this, false)
    stopDnsGuard(STOP_REASON_VPN_REVOKED)
    stopSelf()
    super.onRevoke()
  }

  private fun startDnsGuard() {
    if (isRunning) return

    startForegroundGuard()
    val descriptor = Builder()
      .setSession("FREED DNS Guard")
      .addAddress(VPN_ADDRESS, 32)
      .addDnsServer(PRIMARY_DNS)
      .addDnsServer(SECONDARY_DNS)
      .addRoute(PRIMARY_DNS, 32)
      .addRoute(SECONDARY_DNS, 32)
      .establish()

    if (descriptor == null) {
      markDnsGuardStopped(STOP_REASON_ESTABLISH_FAILED)
      stopForegroundGuard()
      return
    }

    vpnInterface = descriptor
    markDnsGuardStarted()
    vpnThread = thread(name = "FreedDnsGuard", isDaemon = true) {
      val stopReason = runCatching {
        runDnsLoop(descriptor)
        STOP_REASON_LOOP_ENDED
      }.getOrElse { error ->
        lastForwardFailure = "DNS loop stopped: ${error.javaClass.simpleName}"
        STOP_REASON_LOOP_FAILED
      }
      finishDnsGuardFromLoop(descriptor, stopReason)
    }
  }

  private fun stopDnsGuard(reason: String) {
    markDnsGuardStopped(reason)
    vpnThread?.interrupt()
    vpnThread = null
    vpnInterface?.close()
    vpnInterface = null
    stopForegroundGuard()
  }

  private fun finishDnsGuardFromLoop(descriptor: ParcelFileDescriptor, reason: String) {
    if (isRunning) markDnsGuardStopped(reason)
    if (vpnInterface === descriptor) {
      runCatching { vpnInterface?.close() }
      vpnInterface = null
    }
    if (vpnThread === Thread.currentThread()) {
      vpnThread = null
    }
    Handler(Looper.getMainLooper()).post {
      if (!isRunning && vpnInterface == null) {
        stopForegroundGuard()
        stopSelf()
      }
    }
  }

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
        "FREED DNS Guard",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        description = "Shows when FREED's DNS-only adult-domain filter is active."
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

    return builder
      .setSmallIcon(icon)
      .setContentTitle("FREED DNS Guard")
      .setContentText("Adult-domain DNS filtering is active. Normal browsing stays direct.")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setContentIntent(pendingIntent)
      .build()
  }

  private fun runDnsLoop(descriptor: ParcelFileDescriptor) {
    val input = FileInputStream(descriptor.fileDescriptor)
    val output = FileOutputStream(descriptor.fileDescriptor)
    val packet = ByteArray(MAX_PACKET_SIZE)

    while (isRunning && !Thread.currentThread().isInterrupted) {
      val readLength = try {
        input.read(packet)
      } catch (_: Exception) {
        break
      }
      if (readLength <= 0) continue
      dnsGuardPacketsRead.incrementAndGet()

      val envelope = parseDnsEnvelope(packet, readLength) ?: continue
      val host = readDnsQuestionHost(envelope.dnsPayload)
      if (host == null) {
        dnsGuardMalformedPackets.incrementAndGet()
        buildServfailResponse(envelope.dnsPayload)?.let { dnsResponse ->
          output.write(buildUdpResponsePacket(envelope, dnsResponse))
        }
        continue
      }
      dnsGuardSessionQueries.incrementAndGet()
      val classification = FreedUrlClassifier.classify("https://${host}", FreedAdultDomainFeed.domains(this))
      val dnsResponse = if (classification.shouldBlock) {
        dnsGuardBlockedQueries.incrementAndGet()
        val normalizedHost = dnsInterventionHost(host, classification)
        lastBlockedHost = normalizedHost
        recordAndLaunchDnsIntervention(normalizedHost, classification)
        buildNxdomainResponse(envelope.dnsPayload)
      } else {
        val forwarded = forwardDns(envelope.dnsPayload)
        if (forwarded == null) {
          dnsGuardServfailResponses.incrementAndGet()
          buildServfailResponse(envelope.dnsPayload)
        } else {
          dnsGuardAllowedQueries.incrementAndGet()
          forwarded
        }
      } ?: continue

      val responsePacket = buildUdpResponsePacket(envelope, dnsResponse)
      output.write(responsePacket)
    }
  }

  private fun dnsInterventionHost(questionHost: String, result: FreedClassification): String {
    val resultHost = FreedUrlClassifier.normalizeHostForStorage(result.host)
    if (resultHost.isNotBlank()) return resultHost

    val fallbackHost = FreedUrlClassifier.normalizeHostForStorage(questionHost)
    return fallbackHost.ifBlank { "redacted.freed.local" }
  }

  private fun recordAndLaunchDnsIntervention(host: String, result: FreedClassification) {
    val now = SystemClock.elapsedRealtime()
    val key = "dns:${host}:${result.matchedRule}"
    if (key == lastBlockedKey && now - lastBlockedElapsedMs < 4_000) return

    lastBlockedKey = key
    lastBlockedElapsedMs = now
    val redactedUrl = "https://$host"

    getSharedPreferences(FreedAccessibilityService.PREFS_NAME, MODE_PRIVATE)
      .edit()
      .putString(FreedAccessibilityService.PENDING_URL, redactedUrl)
      .putString(FreedAccessibilityService.PENDING_HOST, host)
      .putString(FreedAccessibilityService.PENDING_SOURCE_PACKAGE, "android-dns")
      .putString(FreedAccessibilityService.PENDING_REASON, "Adult-domain DNS request blocked. FREED is opening a recovery challenge.")
      .putString(FreedAccessibilityService.PENDING_RULE, result.matchedRule)
      .putString(FreedAccessibilityService.PENDING_DETECTED_AT, nowIsoString())
      .remove(FreedAccessibilityService.PENDING_SESSION_DURATION_SECONDS)
      .apply()

    Handler(Looper.getMainLooper()).post {
      showDnsInterventionNotification(host, redactedUrl, result.matchedRule)
      runCatching {
        startActivity(buildDnsInterventionIntent(host, redactedUrl, result.matchedRule))
      }
    }
  }

  private fun buildDnsInterventionIntent(host: String, redactedUrl: String, matchedRule: String): Intent {
    return Intent(this, FreedInterventionActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra("freed_intervention_source", "android-dns")
      putExtra("freed_intervention_url", redactedUrl)
      putExtra("freed_intervention_host", host)
      putExtra("freed_intervention_rule", matchedRule)
    }
  }

  private fun showDnsInterventionNotification(host: String, redactedUrl: String, matchedRule: String) {
    val notificationManager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notificationManager.createNotificationChannel(
        NotificationChannel(
          INTERVENTION_NOTIFICATION_CHANNEL_ID,
          "FREED recovery interventions",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Shows when FREED blocks an adult-domain DNS request and a recovery challenge is ready."
        }
      )
    }

    val pendingIntent = PendingIntent.getActivity(
      this,
      INTERVENTION_NOTIFICATION_ID,
      buildDnsInterventionIntent(host, redactedUrl, matchedRule),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_lock_lock
    val message = "Open FREED to complete a recovery challenge. Normal browsing stays direct."
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, INTERVENTION_NOTIFICATION_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    builder
      .setSmallIcon(icon)
      .setContentTitle("FREED blocked an adult-domain request")
      .setContentText(message)
      .setStyle(Notification.BigTextStyle().bigText("$message\nBlocked host: ${host.take(80)}"))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_STATUS)

    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_HIGH)
    }

    notificationManager.notify(INTERVENTION_NOTIFICATION_ID, builder.build())
  }

  private fun nowIsoString(): String {
    return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
  }

  private fun parseDnsEnvelope(packet: ByteArray, readLength: Int): DnsEnvelope? {
    if (readLength < MIN_IPV4_UDP_DNS_PACKET) return null
    val version = unsigned(packet[0]) ushr 4
    val internetHeaderLength = (unsigned(packet[0]) and 0x0f) * 4
    if (version != 4 || internetHeaderLength < IPV4_HEADER_SIZE) return null
    if (unsigned(packet[9]) != UDP_PROTOCOL) return null

    val totalLength = readShort(packet, 2).coerceAtMost(readLength)
    if (totalLength < internetHeaderLength + UDP_HEADER_SIZE + DNS_HEADER_SIZE) return null

    val udpOffset = internetHeaderLength
    val sourcePort = readShort(packet, udpOffset)
    val destinationPort = readShort(packet, udpOffset + 2)
    if (destinationPort != DNS_PORT) return null

    val udpLength = readShort(packet, udpOffset + 4)
    if (udpLength < UDP_HEADER_SIZE) return null
    val dnsOffset = udpOffset + UDP_HEADER_SIZE
    val dnsLength = min(udpLength - UDP_HEADER_SIZE, totalLength - dnsOffset)
    if (dnsLength < DNS_HEADER_SIZE) return null

    val dnsPayload = packet.copyOfRange(dnsOffset, dnsOffset + dnsLength)

    return DnsEnvelope(
      sourceAddress = packet.copyOfRange(12, 16),
      destinationAddress = packet.copyOfRange(16, 20),
      sourcePort = sourcePort,
      destinationPort = destinationPort,
      dnsPayload = dnsPayload
    )
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

  private fun forwardDns(dnsPayload: ByteArray): ByteArray? {
    lastForwardFailure = null

    for (resolver in DNS_RESOLVERS) {
      val response = forwardDnsToResolver(dnsPayload, resolver)
      if (response != null) {
        lastForwardResolver = resolver
        return response
      }
    }

    lastForwardResolver = null
    lastForwardFailure = "All configured DNS resolvers timed out or failed."
    return null
  }

  private fun forwardDnsToResolver(dnsPayload: ByteArray, resolver: String): ByteArray? {
    return runCatching {
      DatagramSocket().use { socket ->
        protect(socket)
        socket.soTimeout = DNS_TIMEOUT_MS
        val request = DatagramPacket(
          dnsPayload,
          dnsPayload.size,
          InetAddress.getByName(resolver),
          DNS_PORT
        )
        socket.send(request)

        val responseBytes = ByteArray(MAX_DNS_PAYLOAD_SIZE)
        val response = DatagramPacket(responseBytes, responseBytes.size)
        socket.receive(response)
        response.data.copyOfRange(0, response.length)
      }
    }.onFailure { error ->
      lastForwardFailure = "${resolver}: ${error.javaClass.simpleName}"
    }.getOrNull()
  }

  private fun buildUdpResponsePacket(query: DnsEnvelope, dnsResponse: ByteArray): ByteArray {
    val totalLength = IPV4_HEADER_SIZE + UDP_HEADER_SIZE + dnsResponse.size
    val response = ByteArray(totalLength)

    response[0] = 0x45
    response[1] = 0
    writeShort(response, 2, totalLength)
    writeShort(response, 4, 0)
    writeShort(response, 6, 0)
    response[8] = 64
    response[9] = UDP_PROTOCOL.toByte()
    query.destinationAddress.copyInto(response, destinationOffset = 12)
    query.sourceAddress.copyInto(response, destinationOffset = 16)
    writeShort(response, 10, ipv4Checksum(response, IPV4_HEADER_SIZE))

    val udpOffset = IPV4_HEADER_SIZE
    writeShort(response, udpOffset, query.destinationPort)
    writeShort(response, udpOffset + 2, query.sourcePort)
    writeShort(response, udpOffset + 4, UDP_HEADER_SIZE + dnsResponse.size)
    writeShort(response, udpOffset + 6, 0)
    dnsResponse.copyInto(response, destinationOffset = udpOffset + UDP_HEADER_SIZE)

    return response
  }

  private fun ipv4Checksum(packet: ByteArray, headerLength: Int): Int {
    var sum = 0
    var index = 0
    while (index < headerLength) {
      if (index == 10) {
        index += 2
        continue
      }
      sum += readShort(packet, index)
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
    val dnsPayload: ByteArray
  )

  companion object {
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

    @Volatile
    var lastBlockedHost: String? = null
      private set

    @Volatile
    var lastForwardResolver: String? = null
      private set

    @Volatile
    var lastForwardFailure: String? = null
      private set

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

    @Volatile
    private var lastBlockedKey: String = ""

    @Volatile
    private var lastBlockedElapsedMs: Long = 0L

    private const val VPN_ADDRESS = "10.94.0.2"
    private const val NOTIFICATION_ID = 9402
    private const val INTERVENTION_NOTIFICATION_ID = 9403
    private const val NOTIFICATION_CHANNEL_ID = "freed_dns_guard"
    private const val INTERVENTION_NOTIFICATION_CHANNEL_ID = "freed_dns_interventions"
    private const val PRIMARY_DNS = "1.1.1.1"
    private const val SECONDARY_DNS = "1.0.0.1"
    val DNS_RESOLVERS = listOf(PRIMARY_DNS, SECONDARY_DNS)
    private const val MAX_PACKET_SIZE = 32767
    private const val MAX_DNS_PAYLOAD_SIZE = 4096
    private const val DNS_TIMEOUT_MS = 3000
    private const val IPV4_HEADER_SIZE = 20
    private const val UDP_HEADER_SIZE = 8
    private const val DNS_HEADER_SIZE = 12
    private const val MIN_IPV4_UDP_DNS_PACKET = IPV4_HEADER_SIZE + UDP_HEADER_SIZE + DNS_HEADER_SIZE
    private const val UDP_PROTOCOL = 17
    private const val DNS_PORT = 53
    private const val MAX_DNS_LABEL_LENGTH = 63
    private const val DNS_RCODE_SERVFAIL = 2
    private const val DNS_RCODE_NXDOMAIN = 3
    private const val STOP_REASON_MANUAL = "manual-stop"
    private const val STOP_REASON_SERVICE_DESTROY = "service-destroy"
    private const val STOP_REASON_VPN_REVOKED = "vpn-revoked"
    private const val STOP_REASON_ESTABLISH_FAILED = "establish-failed"
    private const val STOP_REASON_LOOP_ENDED = "dns-loop-ended"
    private const val STOP_REASON_LOOP_FAILED = "dns-loop-failed"
    private const val PREF_DNS_GUARD_USER_ENABLED = "dns_guard_user_enabled"
    private const val PREF_DNS_GUARD_AUTO_RESTART_ACTION = "dns_guard_auto_restart_action"
    private const val PREF_DNS_GUARD_AUTO_RESTART_AT = "dns_guard_auto_restart_at"
    private const val PREF_DNS_GUARD_AUTO_RESTART_RESULT = "dns_guard_auto_restart_result"
    private const val PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON = "dns_guard_auto_restart_skip_reason"

    fun setUserEnabled(context: Context, enabled: Boolean) {
      val editor = prefs(context).edit().putBoolean(PREF_DNS_GUARD_USER_ENABLED, enabled)
      if (!enabled) {
        editor.putString(PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON, "user-disabled")
      }
      editor.apply()
    }

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
      setUserEnabled(context, true)
      startServiceAction(context, ACTION_START)
    }

    fun restartAfterSystemEvent(context: Context, restoreAction: String?) {
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
        !isUserEnabled(context) -> "user-disabled"
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

    private fun nowWallClockIsoString(): String {
      return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
      }.format(Date())
    }

    private fun markDnsGuardStarted() {
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
      dnsGuardStartCount.incrementAndGet()
      isRunning = true
    }

    private fun markDnsGuardStopped(reason: String) {
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
