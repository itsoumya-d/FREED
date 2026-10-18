package app.freed.protection

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import java.util.UUID
import java.util.concurrent.TimeUnit

/** Internal, owner-fenced DNS profile authority; candidate staging alone never changes protection. */
internal object FreedRecoveryDnsPilot {
  internal val configurationLock = FreedEncryptedDnsConfig.configurationLock
  private const val FLAG = "FREEDRecoveryDnsPilotEnabled"
  private const val CHANNEL = "FREEDRecoveryDnsPilotChannel"

  fun supported(context: Context): Boolean = runCatching {
    val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
    val resourceID = context.resources.getIdentifier("freed_recovery_dns_pilot_enabled", "bool", context.packageName)
    val flag = info.metaData?.getBoolean(FLAG, false) == true ||
      (resourceID != 0 && context.resources.getBoolean(resourceID))
    FreedRecoveryDnsPilotPolicy.supported(flag, info.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0,
      info.metaData?.getString(CHANNEL))
  }.getOrDefault(false)

  internal fun failure(code: String, supported: Boolean = false): Map<String, Any?> = mapOf(
    "schema" to 1, "kind" to "error", "supported" to supported, "accepted" to false,
    "code" to code, "reason" to code)

  internal fun generation(context: Context): String {
    val state = FreedAdultProtectionState.read(context)
    check(state.health == "readable" && state.generation != null) { "recovery-dns-native-state-unavailable" }
    check(!FreedRetainedAdultProtection.adultCleanupPending(context, null)) { "recovery-dns-owner-stale" }
    return state.generation.toString()
  }

  internal fun ownerCurrent(scope: String, admitted: (String) -> Boolean): Boolean =
    admitted(scope) && FreedAppGroupStore.ownerScopeCurrent(scope)

  /** Salted native owner + policy epoch/namespace, independent of the ephemeral JS binding handle. */
  internal fun ownerIdentity(context: Context, scope: String, admitted: (String) -> Boolean): String? =
    synchronized(FreedNativeUnlockStore.lock) {
      if (!ownerCurrent(scope, admitted)) return@synchronized null
      FreedAppGroupStore.capturePolicyScope(context)?.let {
        FreedRecoveryDnsPilotPolicy.digest("freed-recovery-dns-owner-v1\u0000$it")
      }
    }

  fun stage(context: Context?, input: Map<String, Any?>, foreground: () -> Boolean,
    admitted: (String) -> Boolean): Map<String, Any?> {
    if (context == null) return failure("native-context-unavailable")
    if (!supported(context)) return failure("recovery-dns-pilot-build-gated")
    return try {
      val value = FreedRecoveryDnsPilotPolicy.validate(input)
      if (!foreground()) return failure("recovery-dns-foreground-required", true)
      if (!ownerCurrent(value.actionScope, admitted)) return failure("recovery-dns-owner-stale", true)
      FreedAdultProtectionState.migrate(context)
      val expectedGeneration = generation(context)
      val identity = ownerIdentity(context, value.actionScope, admitted) ?: return failure("recovery-dns-owner-stale", true)
      val candidate = FreedRecoveryDnsPilotPolicy.Candidate(UUID.randomUUID().toString().replace("-", ""),
        value.rawSecret, value.credentialHash, value.audience, value.ownerGeneration, value.installationId,
        FreedRecoveryDnsPilotPolicy.digest(value.actionScope), expectedGeneration, UUID.randomUUID().toString(), identity)
      val saved = FreedAdultAuthorizationExecutor.get(context).submit {
        FreedAdultProtectionState.guarded(context) {
          synchronized(FreedNativeUnlockStore.lock) {
            fun current() = foreground() && supported(context) && ownerCurrent(value.actionScope, admitted) &&
              generation(context) == expectedGeneration && ownerIdentity(context, value.actionScope, admitted) == identity
            check(current())
            FreedRecoveryDnsPilotStore(context).stage(candidate, value.actionScope, ::current) { operations ->
              FreedRecoveryDnsPilotCoordinator.retireForRebinding(context, operations)
            }
          }
        }
      }.get(8, TimeUnit.SECONDS)
      // A changed owner never receives another account's reference, audience or enrollment metadata.
      if (!foreground() || !ownerCurrent(value.actionScope, admitted) || generation(context) != expectedGeneration ||
        ownerIdentity(context, value.actionScope, admitted) != identity)
        failure("recovery-dns-owner-stale", true)
      else saved.publicReceipt()
    } catch (_: IllegalArgumentException) { failure("recovery-dns-input-invalid", true) }
    catch (_: Exception) { failure("recovery-dns-secure-state-unavailable", true) }
  }

  internal fun candidate(context: Context, reference: String, scope: String,
    admitted: (String) -> Boolean, renewBinding: Boolean = false): FreedRecoveryDnsPilotPolicy.Candidate? {
    if (!FreedRecoveryDnsPilotPolicy.validReference(reference) || !ownerCurrent(scope, admitted)) return null
    return FreedAdultProtectionState.guarded(context) {
      synchronized(FreedNativeUnlockStore.lock) {
        val identity = ownerIdentity(context, scope, admitted) ?: return@synchronized null
        val expectedGeneration = generation(context)
        val store = FreedRecoveryDnsPilotStore(context)
        val value = store.read().candidates.firstOrNull {
          it.reference == reference && it.ownedBy(scope, identity, expectedGeneration)
        } ?: return@synchronized null
        fun current() = (!renewBinding || FreedRecoveryDnsPilotCoordinator.foreground()) &&
          ownerCurrent(scope, admitted) && generation(context) == expectedGeneration &&
          ownerIdentity(context, scope, admitted) == identity
        if (renewBinding) store.renew(reference, scope, identity, expectedGeneration, ::current) { operations ->
          FreedRecoveryDnsPilotCoordinator.retireForRebinding(context, operations)
        } else value.takeIf { it.current(scope, expectedGeneration) && current() }
      }
    }
  }

  fun descriptor(candidate: FreedRecoveryDnsPilotPolicy.Candidate): String =
    "pilot:${candidate.reference}:${candidate.credentialHash}:${candidate.configurationGeneration}"
  fun activeCandidate(context: Context): FreedRecoveryDnsPilotPolicy.Candidate? {
    val state = FreedRecoveryDnsPilotStore(context).read()
    return state.activeReference?.let { ref -> state.candidates.single { it.reference == ref } }
  }
  fun activeOrUnknown(context: Context): Boolean = runCatching { activeCandidate(context) != null }.getOrDefault(true)
  fun activeDescriptor(context: Context): String = activeCandidate(context)?.let(::descriptor)
    ?: "families:${FreedEncryptedDnsConfig.requestedReadback(context) ?: false}"
  fun routeReady(context: Context, candidate: FreedRecoveryDnsPilotPolicy.Candidate): Boolean = runCatching {
    activeDescriptor(context) == descriptor(candidate) && FreedVpnService.recoveryDnsRuntimeDescriptor() == descriptor(candidate) &&
      FreedVpnService.isRunning && FreedVpnService.dnsGuardRuntimeReady && !FreedVpnService.dnsGuardCaptivePaused &&
      FreedVpnService.dnsGuardIpv6UnsupportedPackets.get() == 0L && FreedNetworkDnsState.read(context).mode == "off" &&
      android.net.VpnService.prepare(context) == null
  }.getOrDefault(false)

  fun check(context: Context?, reference: String, scope: String, foreground: () -> Boolean,
    admitted: (String) -> Boolean): Map<String, Any?> {
    if (context == null) return failure("native-context-unavailable")
    if (!supported(context)) return failure("recovery-dns-pilot-build-gated")
    if (android.os.Build.VERSION.SDK_INT < 29) return failure("recovery-dns-system-resolver-api-unavailable")
    return try {
      check(foreground()) { "recovery-dns-foreground-required" }
      val value = FreedAdultAuthorizationExecutor.get(context).submit {
        check(foreground()) { "recovery-dns-foreground-required" }
        candidate(context, reference, scope, admitted, renewBinding = true)
      }.get(8, TimeUnit.SECONDS) ?: return failure("recovery-dns-candidate-stale", true)
      val proof = FreedRecoveryDnsPilotRouteCheck.run(context, value, scope, foreground) {
        ownerCurrent(scope, admitted) && value.current(scope, generation(context))
      }
      mapOf("schema" to 1, "kind" to "routeCheck", "supported" to true, "accepted" to true,
        "reference" to reference, "nativeConfigurationGeneration" to value.configurationGeneration,
        "profileSaved" to true, "systemEnabled" to true, "routeVerified" to true, "denyVerified" to true,
        "networkEpoch" to FreedVpnService.recoveryDnsNetworkEpoch(), "receipt" to proof,
        "reason" to "recovery-dns-routing-check-only")
    } catch (caught: Exception) {
      val code = when (caught.message) {
        "recovery-dns-foreground-required", "recovery-dns-system-resolver-api-unavailable", "recovery-dns-route-check-busy",
        "recovery-dns-route-not-ready", "recovery-dns-route-check-stale", "recovery-dns-system-route-failed",
        "recovery-dns-vpn-route-unobserved" -> caught.message!!
        else -> "recovery-dns-route-check-unavailable"
      }
      failure(code, true) + mapOf("profileSaved" to runCatching { activeCandidate(context)?.reference == reference }.getOrDefault(false),
        "systemEnabled" to false, "routeVerified" to false, "denyVerified" to false, "receipt" to null)
    }
  }

  fun prepare(context: Context?, reference: String, scope: String, foreground: () -> Boolean,
    admitted: (String) -> Boolean, activation: Boolean = false): Map<String, Any?> {
    if (context == null) return failure("native-context-unavailable")
    if (!supported(context)) return failure("recovery-dns-pilot-build-gated")
    if (android.os.Build.VERSION.SDK_INT < 29) return failure("recovery-dns-system-resolver-api-unavailable")
    return try {
      FreedRecoveryDnsPilotCoordinator.prepare(context, reference, scope, foreground, admitted, activation)
    } catch (_: Exception) { failure("recovery-dns-operation-unavailable", true) }
  }

  /** Families is an explicit stronger protected repair; it never resets app rules or leases. */
  fun restoreFamilies(context: Context) = synchronized(configurationLock) {
    val store = FreedRecoveryDnsPilotStore(context)
    val state = store.read()
    if (state.activeReference == null) return@synchronized
    val epoch = FreedVpnService.recoveryDnsNetworkEpoch()
    var previous: FreedRecoveryDnsPilotUpstream? = null
    var swapped = false
    try {
      store.update { it.copy(activeReference = null) }
      if (FreedVpnService.isRunning) {
        previous = FreedVpnService.swapRecoveryDnsRuntime(null, epoch); swapped = true
        check(FreedVpnService.recoveryDnsRuntimeDescriptor() == null)
      }
      check(store.read().activeReference == null)
      FreedRecoveryDnsPilotRouteCheck.invalidate()
      if (swapped) FreedVpnService.finishRecoveryDnsReplacement(previous)
    } catch (failure: Exception) {
      store.update { it.copy(activeReference = state.activeReference) }
      if (swapped) FreedVpnService.swapRecoveryDnsRuntime(previous, epoch)
      throw failure
    }
  }

  fun status(context: Context?, scope: String, foreground: () -> Boolean, admitted: (String) -> Boolean): Map<String, Any?> {
    if (context == null) return failure("native-context-unavailable")
    val enabled = supported(context)
    val resolverSupported = android.os.Build.VERSION.SDK_INT >= 29
    return try {
      val state = FreedRecoveryDnsPilotStore(context).read()
      val owner = enabled && ownerCurrent(scope, admitted)
      val expectedGeneration = if (owner) generation(context) else null
      val identity = if (owner) ownerIdentity(context, scope, admitted) else null
      val active = state.activeReference?.let { ref -> state.candidates.single { it.reference == ref } }
      val value = if (expectedGeneration != null && identity != null) {
        FreedRecoveryDnsPilotRecord.scopedCandidate(state, scope, identity, expectedGeneration)
      } else null
      val current = owner && ownerCurrent(scope, admitted) && expectedGeneration == generation(context) &&
        identity != null && ownerIdentity(context, scope, admitted) == identity
      val profileSaved = current && value != null && value.reference == state.activeReference
      val systemEnabled = profileSaved && active != null && routeReady(context, active)
      val proof = value?.takeIf { current && it.reference == state.activeReference }?.let {
        FreedRecoveryDnsPilotRouteCheck.current(context, it, scope, foreground)
      }
      mapOf("schema" to 1, "kind" to "status", "platform" to "android", "supported" to enabled,
        "provider" to FreedRecoveryDnsPilotPolicy.PROVIDER, "replacementSupported" to (enabled && resolverSupported),
        "activationSupported" to (enabled && resolverSupported), "systemResolverSupported" to resolverSupported,
        "modeActivationSupported" to (enabled && resolverSupported), "modeActive" to (current && systemEnabled),
        "configured" to profileSaved, "enabled" to systemEnabled, "profileSaved" to profileSaved, "systemEnabled" to systemEnabled,
        "routeVerified" to (proof != null), "denyVerified" to (proof != null), "receipt" to proof,
        "networkEpoch" to FreedVpnService.recoveryDnsNetworkEpoch(),
        "staged" to (current && value != null), "reference" to value?.reference.takeIf { current },
        "credentialHash" to value?.credentialHash.takeIf { current }, "audience" to value?.audience.takeIf { current },
        "ownerGeneration" to value?.ownerGeneration.takeIf { current },
        "nativeConfigurationGeneration" to value?.configurationGeneration.takeIf { current },
        "activeProvider" to if (systemEnabled) FreedRecoveryDnsPilotPolicy.PROVIDER else if (active == null &&
          FreedEncryptedDnsConfig.isRequested(context) && FreedVpnService.dnsGuardRuntimeReady) "cloudflare-families" else null,
        "vpnRunning" to FreedVpnService.isRunning, "vpnRuntimeReady" to FreedVpnService.dnsGuardRuntimeReady,
        "reason" to if (!enabled) "recovery-dns-pilot-build-gated" else if (!resolverSupported) "recovery-dns-system-resolver-api-unavailable"
          else if (proof != null) "recovery-dns-routing-check-only"
          else if (profileSaved) "recovery-dns-awaiting-system-route-check" else "recovery-dns-not-active")
    } catch (_: Exception) { failure("recovery-dns-secure-state-unavailable", enabled) }
  }
}
