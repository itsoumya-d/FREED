package app.freed.protection

import android.content.Context

/** Adult-only generation and classifier intent, retained outside private account preferences. */
internal object FreedAdultProtectionState {
  private val memoryFence = java.util.concurrent.atomic.AtomicLong(0)
  private const val FENCE_PREFS = "freed_adult_repair_fence_v1"
  private const val UNCERTAIN_REPAIR = "unreconciled"
  fun callbackEpoch(context: Context): Pair<Long?, Long> = generation(context) to memoryFence.get()
  private fun repairUncertain(context: Context): Boolean = try {
    context.getSharedPreferences(FENCE_PREFS, Context.MODE_PRIVATE).getBoolean(UNCERTAIN_REPAIR, false)
  } catch (_: Exception) { true }
  data class Read(val generation: Long?, val accessibility: Boolean, val health: String)
  fun read(context: Context): Read = try {
    val state = FreedAdultAuthorizationExecutor.get(context).journal.read()
    val uncertain = repairUncertain(context)
    Read(state.generation, if (uncertain) true else state.adultAccessibility ?: FreedProtectionConfiguration.interceptionEnabled(context),
      if (uncertain) "repair-uncertain" else if (state.adultAccessibility == null) "migration-required" else "readable")
  } catch (_: Exception) { Read(null, true, "unavailable") }

  fun <T> guarded(context: Context, operation: () -> T): T = synchronized(FreedAdultAuthorizationExecutor.get(context).guard, operation)
  fun generation(context: Context) = read(context).generation
  fun permitsClassification(context: Context, expectedGeneration: Pair<Long?, Long> = callbackEpoch(context)): Boolean {
    val current = read(context)
    // Unknown intent preserves installed classification; unknown generation never authorizes weakening.
    return current.accessibility && callbackEpoch(context) == expectedGeneration
  }
  fun configuration(context: Context): FriendLockConfiguration {
    val current = read(context)
    check(current.health == "readable" && current.generation != null) { "adult-baseline-unavailable" }
    val prefs = context.getSharedPreferences(FreedAccessibilityService.PREFS_NAME, Context.MODE_PRIVATE).all
    val fields = listOf(FreedAdultDomainFeed.DOMAINS_KEY, FreedAdultDomainFeed.VERSION_KEY,
      FreedAdultDomainFeed.CHECKSUM_KEY, FreedAdultDomainFeed.GENERATED_AT_KEY, "user_allowed_domains",
      "dns_guard_user_enabled", FreedProtectionConfiguration.INTERCEPTION_DISABLED).associateWith { key ->
        val value = prefs[key]
        val booleanKey = key == "dns_guard_user_enabled" || key == FreedProtectionConfiguration.INTERCEPTION_DISABLED
        check(value == null || (if (booleanKey) value is Boolean else value is String)) { "adult-native-state-malformed" }
        if (value == null) "absent" else "${value.javaClass.name}:$value"
      } + mapOf("accessibility-adult" to current.accessibility.toString(),
        "encrypted-request" to (FreedEncryptedDnsConfig.requestedReadback(context)?.toString() ?: "absent"),
        "dns-profile" to FreedRecoveryDnsPilot.activeDescriptor(context))
    val fingerprint = java.io.ByteArrayOutputStream().also { buffer ->
      java.io.DataOutputStream(buffer).use { output -> fields.toSortedMap().forEach { (key, value) ->
        val name = key.toByteArray(); val bytes = value.toByteArray()
        output.writeInt(name.size); output.write(name); output.writeInt(bytes.size); output.write(bytes)
      } }
    }.toByteArray()
    return FriendLockConfiguration(java.security.MessageDigest.getInstance("SHA-256").digest(fingerprint).friendHex(), current.generation.toString())
  }
  data class EnrollmentObservation(val configuration: FriendLockConfiguration, val runtimeVersion: Long, val readback: String)
  // Supported installed DNS-Guard coverage only. Saved request, an explicit upstream
  // probe, OS Private DNS alone and a disconnected accessibility service are insufficient.
  fun enrollmentObservation(context: Context): EnrollmentObservation {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    check(!Thread.holdsLock(authority.guard)) { "adult-enrollment-observation-must-not-hold-guard" }
    check(!FreedRetainedAdultProtection.adultCleanupPending(context, null)) { "adult-private-cleanup-admission-pending" }
    val before = configuration(context)
    val runtimeVersion = FreedVpnService.runtimeStateVersion
    val os = FreedNetworkDnsState.read(context).mode
    val state = read(context)
    check(state.health == "readable" && FreedVpnService.userEnabledReadback(context) == true && FreedVpnService.isRunning &&
      FreedDnsGuardPolicy.filteringActive(FreedVpnService.dnsGuardRuntimeReady, FreedVpnService.dnsGuardCaptivePaused,
        os, FreedVpnService.dnsGuardIpv6UnsupportedPackets.get())) { "adult-baseline-unavailable" }
    val expected = android.content.ComponentName(context, FreedAccessibilityService::class.java)
    val enabled = android.provider.Settings.Secure.getString(context.contentResolver,
      android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)?.split(":")?.any {
        it.equals(expected.flattenToString(), true) || it.equals(expected.flattenToShortString(), true)
      } == true
    check(!state.accessibility || (enabled && FreedAccessibilityService.appSchedulesServiceConnected &&
      FreedProtectionConfiguration.interceptionEnabled(context))) { "adult-baseline-unavailable" }
    val encrypted = FreedEncryptedDnsConfig.requestedReadback(context)
    check(encrypted != null || FreedEncryptedDnsConfig.ownedConfigurationEmpty(context)) { "adult-baseline-unavailable" }
    check(encrypted != true || FreedVpnService.encryptedDnsHealthy() == true) { "adult-baseline-unavailable" }
    val feed = FreedAdultDomainFeed.feedSnapshot(context)
    check(feed.isNotEmpty() && runtimeVersion == FreedVpnService.runtimeStateVersion && before == configuration(context)) { "adult-stale-generation" }
    return EnrollmentObservation(before, runtimeVersion, listOf(before.revision, before.mutationGeneration, runtimeVersion.toString(), os,
      enabled.toString(), state.accessibility.toString(), encrypted.toString(), FreedAdultHostOperation.digest(feed),
      FreedAdultHostOperation.digest(FreedAdultDomainFeed.exceptionsSnapshot(context))).joinToString("\n"))
  }
  fun enrollmentWitnessCurrent(context: Context, expected: EnrollmentObservation): Boolean {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    check(Thread.holdsLock(authority.guard))
    return !FreedRetainedAdultProtection.adultCleanupPending(context, null) &&
      expected.configuration == configuration(context) && expected.runtimeVersion == FreedVpnService.runtimeStateVersion &&
      FreedVpnService.isRunning && FreedVpnService.dnsGuardRuntimeReady && !FreedVpnService.dnsGuardCaptivePaused &&
      FreedVpnService.dnsGuardIpv6UnsupportedPackets.get() == 0L &&
      (!read(context).accessibility || FreedAccessibilityService.appSchedulesServiceConnected) &&
      // A DNS worker can update health (or its freshness can expire) without a runtime-version change.
      (FreedEncryptedDnsConfig.requestedReadback(context) != true || FreedVpnService.encryptedDnsHealthy() == true)
  }
  /** Explicit checked migration; never touches feed, exceptions, private scope, leases or global latch. */
  fun migrate(context: Context): Read = guarded(context) {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    val state = authority.journal.read()
    if (state.adultAccessibility == null) authority.journal.save(state.copy(
      adultAccessibility = FreedProtectionConfiguration.interceptionEnabled(context)))
    read(context)
  }
  fun repairFence(context: Context, reason: String) {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    authority.requireSameProcess()
    check(Thread.holdsLock(authority.guard))
    memoryFence.incrementAndGet() // revoke queued publication even if durable I/O fails
    val fence = context.getSharedPreferences(FENCE_PREFS, Context.MODE_PRIVATE)
    val markerSaved = runCatching { fence.edit().putBoolean(UNCERTAIN_REPAIR, true).commit() && fence.getBoolean(UNCERTAIN_REPAIR, false) }.getOrDefault(false)
    val saved = authority.machine.revokeForRepair(reason)
    if (saved && markerSaved) runCatching { fence.edit().putBoolean(UNCERTAIN_REPAIR, false).commit() }
    // With neither durable fence confirmed, do not persist a repair that an old
    // authorization could undo after restart. Existing stronger consumers stay installed.
    if (!saved && !markerSaved) throw FreedAdultMutationFailure(FriendLockAction.DISABLE_ADULT_FILTER, "adult-repair-fence-unavailable")
    authority.worker.submit { runCatching { authority.machine.invalidateAfterRepair() } }
  }
  fun setAccessibility(context: Context, enabled: Boolean, permit: FreedAdultPermit? = null): Boolean = guarded(context) {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    val before = read(context)
    if (!enabled) FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.DISABLE_ADULT_FILTER,
      "accessibility-adult", before.accessibility.toString(), "false", permit)
    else repairFence(context, "accessibility-enable")
    val state = authority.journal.read()
    authority.journal.save(state.copy(adultAccessibility = enabled))
    read(context).let { it.health == "readable" && it.accessibility == enabled }
  }
  fun status(context: Context, accessibilityEnabled: Boolean, accessibilityConnected: Boolean): Map<String, Any?> = guarded(context) {
    val intent = read(context)
    val authority = FreedAdultAuthorizationExecutor.get(context)
    val journal = runCatching { authority.journal.read() }.getOrNull()
    val dnsRequested = runCatching { FreedVpnService.userEnabledReadback(context) }.getOrNull()
    val encryptedRequested = runCatching { FreedEncryptedDnsConfig.requestedReadback(context) }.getOrNull()
    val encryptedEmpty = runCatching { FreedEncryptedDnsConfig.ownedConfigurationEmpty(context) }.getOrNull()
    val os = runCatching { FreedNetworkDnsState.read(context).mode }.getOrDefault("unknown")
    val pending = journal?.operations?.values?.filter { it.phase !in setOf(FreedAdultHostPhase.COMPLETED, FreedAdultHostPhase.CANCELLED) }
    val allOwnedOff = pending?.isEmpty() == true && !authority.machine.isQuarantined() && intent.health == "readable" && !intent.accessibility && dnsRequested == false &&
      FreedVpnService.ownedRuntimeCanReactivate() && (encryptedRequested == false || encryptedEmpty == true) && journal?.uncertainty?.isEmpty() == true
    mapOf("generation" to intent.generation, "readHealth" to intent.health,
      "intendedAccessibility" to intent.accessibility, "accessibilityEnabled" to accessibilityEnabled,
      "accessibilityConnected" to accessibilityConnected,
      "accessibilityAdultParticipating" to (intent.accessibility && accessibilityEnabled && accessibilityConnected && FreedProtectionConfiguration.interceptionEnabled(context)),
      "dnsRequested" to dnsRequested, "dnsRunning" to FreedVpnService.isRunning,
      "dnsCoverageReady" to FreedDnsGuardPolicy.filteringActive(FreedVpnService.dnsGuardRuntimeReady,
        FreedVpnService.dnsGuardCaptivePaused, os, FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()),
      "dnsCoverageIssue" to FreedDnsGuardPolicy.issueCode(FreedVpnService.dnsGuardRuntimeReady,
        FreedVpnService.dnsGuardCaptivePaused, os, FreedVpnService.dnsGuardIpv6UnsupportedPackets.get()),
      "dnsAllOwnersStopped" to FreedVpnService.ownedRuntimeCanReactivate(),
      "encryptedRequested" to encryptedRequested,
      "encryptedConfigurationState" to if (encryptedEmpty == true) "empty" else if (encryptedRequested != null) "saved" else "unknown",
      "encryptedCapability" to FreedEncryptedDnsConfig.capability(context).supported,
      "encryptedHealthy" to FreedVpnService.encryptedDnsHealthy(),
      "osPrivateDns" to os, "osPrivateDnsMutableByFreed" to false,
      "freedAdultProtectionOff" to allOwnedOff, "deviceAdultFilteringOff" to null,
      "legacyLatchDisabled" to !FreedProtectionConfiguration.interceptionEnabled(context),
      "pendingOperations" to pending?.map { it.receipt.operationID },
      "operationLayers" to pending?.map { mapOf("operationID" to it.receipt.operationID, "phase" to it.phase.name,
        "dispatched" to it.dispatched.toList(), "observedLayerDigests" to it.observed.mapValues { entry -> FreedAdultHostOperation.digest(entry.value) }, "outcome" to it.outcome) },
      "executionQuarantined" to authority.machine.isQuarantined(),
      "uncertainty" to (journal?.uncertainty?.toList() ?: listOf("journal-unavailable")))
  }
}

/** Actual lower methods. The machine never accepts a caller-supplied observation or write closure. */
internal class FreedAdultNativeLayers(private val context: Context) : FreedAdultExecutionLayers {
  override fun configuration() = FreedAdultProtectionState.configuration(context)
  override fun observe(layer: String): String = when (layer) {
    "dns-intent" -> (FreedVpnService.userEnabledReadback(context) ?: error("adult-dns-baseline-unavailable")).toString()
    "dns-runtime" -> (!FreedVpnService.ownedRuntimeCanReactivate()).toString()
    "encrypted-request" -> (FreedEncryptedDnsConfig.requestedReadback(context) ?: if (FreedEncryptedDnsConfig.ownedConfigurationEmpty(context)) false else error("adult-encrypted-baseline-unavailable")).toString()
    "encrypted-clear" -> if (FreedEncryptedDnsConfig.ownedConfigurationEmpty(context)) "empty" else FreedEncryptedDnsConfig.isRequested(context).toString()
    "feed" -> FreedAdultDomainFeed.feedSnapshot(context)
    "exceptions" -> FreedAdultDomainFeed.exceptionsSnapshot(context)
    "accessibility-adult" -> FreedAdultProtectionState.read(context).let { check(it.health == "readable"); it.accessibility.toString() }
    "dns-profile", "recovery-mode" -> FreedRecoveryDnsPilot.activeDescriptor(context)
    else -> error("adult-layer-unsupported")
  }
  override fun apply(step: FreedAdultStep, permit: FreedAdultPermit): String {
    if (step.layer !in setOf("feed", "exceptions", "encrypted-clear", "dns-profile", "recovery-mode")) check(step.desired == "false") { "adult-layer-delta-unsupported" }
    when (step.layer) {
      "dns-intent" -> FreedVpnService.setUserEnabled(context, false, permit)
      "dns-runtime" -> check(FreedVpnService.stopOwnedRuntimeForReset(context, "authorized-adult-stop", permit))
      "encrypted-request" -> check(FreedEncryptedDnsConfig.setRequested(context, false, permit))
      "encrypted-clear" -> { check(step.desired == "empty"); check(FreedEncryptedDnsConfig.clearOwnedConfiguration(context, permit)) }
      "feed" -> FreedAdultDomainFeed.applyFeedSnapshot(context, step.desired, permit)
      "exceptions" -> { check(FreedAdultDomainFeed.canonicalExceptions(step.desired.split(",")) == step.desired); FreedAdultDomainFeed.configureUserAllowedDomains(context, step.desired.split(","), permit) }
      "accessibility-adult" -> check(FreedAdultProtectionState.setAccessibility(context, false, permit))
      "dns-profile", "recovery-mode" -> return FreedRecoveryDnsPilotCoordinator.apply(context, step, permit)
      else -> error("adult-layer-unsupported")
    }
    return observe(step.layer)
  }
}
