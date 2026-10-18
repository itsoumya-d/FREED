package app.freed.protection

import android.content.Context
import java.util.UUID
import java.util.concurrent.TimeUnit

/** All exact operations run on the existing native adult authority worker. */
internal object FreedRecoveryDnsPilotCoordinator {
  @Volatile var foreground: () -> Boolean = { false }
  private fun id() = UUID.randomUUID().toString().replace("-", "")
  private fun store(context: Context) = FreedRecoveryDnsPilotStore(context)
  private fun operation(context: Context, operationID: String) = store(context).read().operations.firstOrNull { it.id == operationID }
  fun owns(context: Context, operationID: String): Boolean {
    val value = operation(context, operationID) ?: return false
    return value.friendOperationID == null
  }

  /** Called on the existing authority worker under both native owner/adult guards. */
  internal fun retireForRebinding(context: Context, operations: List<FreedRecoveryDnsPilotRecord.Operation>) {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    check(Thread.holdsLock(authority.guard) && Thread.holdsLock(FreedNativeUnlockStore.lock))
    operations.forEach { operation -> operation.friendOperationID?.let { id ->
      when (authority.publicRecoveryDnsOperation(id)["phase"]) {
        "prepared", "authorized", "claimReserved" -> authority.machine.cancel(id)
        "cancelled" -> Unit
        else -> error("recovery-dns-operation-outcome-unknown")
      }
    } }
    FreedRecoveryDnsPilotRouteCheck.invalidate()
  }

  fun prepare(context: Context, reference: String, scope: String, foreground: () -> Boolean,
    admitted: (String) -> Boolean, activation: Boolean): Map<String, Any?> {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    return authority.submit { machine ->
      FreedAdultProtectionState.migrate(context)
      check(foreground() && FreedRecoveryDnsPilot.ownerCurrent(scope, admitted))
      val candidate = FreedRecoveryDnsPilot.candidate(context, reference, scope, admitted, renewBinding = !activation)
        ?: error("recovery-dns-candidate-stale")
      val original = FreedRecoveryDnsPilotRecord.originalOperation(store(context).read(), candidate, activation)
      if (original != null) {
        // Completed/cancelled receipts remain historical. A changed network or expired
        // route receipt cannot turn an exact preparation retry into a new operation.
        original.friendOperationID?.let { return@submit authority.publicRecoveryDnsOperation(it) }
        check(original.phase != "prepared") { "recovery-dns-prepare-outcome-unknown" }
        return@submit publicOperation(original)
      }
      check(FreedVpnService.isRunning && FreedVpnService.dnsGuardRuntimeReady && !FreedVpnService.dnsGuardCaptivePaused &&
        FreedNetworkDnsState.read(context).mode == "off") { "recovery-dns-vpn-not-ready" }
      if (activation) check(FreedRecoveryDnsPilotRouteCheck.current(context, candidate, scope, foreground) != null) { "recovery-dns-route-receipt-required" }
      FreedAdultProtectionState.guarded(context) {
        synchronized(FreedNativeUnlockStore.lock) {
          machine.checkAuthorityCensus()
          check(foreground() && FreedRecoveryDnsPilot.ownerCurrent(scope, admitted))
          val config = FreedAdultProtectionState.configuration(context)
          val before = FreedRecoveryDnsPilot.activeDescriptor(context)
          val desired = FreedRecoveryDnsPilot.descriptor(candidate)
          val networkEpoch = FreedVpnService.recoveryDnsNetworkEpoch()
          check(FreedRecoveryDnsPilotRecord.originalOperation(store(context).read(), candidate, activation) == null)
          val pending = FreedRecoveryDnsPilotRecord.Operation(id(), candidate.reference,
            FreedRecoveryDnsPilotPolicy.digest(scope), before, desired, config.revision,
            config.mutationGeneration, networkEpoch, "prepared", activation = activation)
          val locked = when (authority.core.status()) {
            FriendLockStatus.ENROLLED -> true
            FriendLockStatus.NOT_ENROLLED -> false
            else -> error("recovery-dns-friend-lock-unavailable")
          }
          if (!locked) machine.requireLegacy(FriendLockAction.REPLACE_DNS_PROVIDER)
          store(context).update { state ->
            check(state.operations.size < 32 && state.operations.none { it.phase in setOf("applying", "failed") })
            state.copy(operations = state.operations + pending)
          }
          if (locked) {
            val friendID = machine.prepare(FriendLockAction.REPLACE_DNS_PROVIDER,
              listOf(FreedAdultStep(if (activation) "recovery-mode" else "dns-profile", before, desired)))
            store(context).update { state -> state.copy(operations = state.operations.map {
              if (it.id == pending.id) it.copy(friendOperationID = friendID) else it
            }) }
            authority.publicRecoveryDnsOperation(friendID)
          } else {
            val authorized = pending.copy(phase = "authorized")
            store(context).update { state -> state.copy(operations = state.operations.map { if (it.id == pending.id) authorized else it }) }
            publicOperation(authorized)
          }
        }
      }
    }.get(8, TimeUnit.SECONDS)
  }

  private fun publicOperation(value: FreedRecoveryDnsPilotRecord.Operation): Map<String, Any?> {
    val completed = value.phase == "completed"
    val cancelled = value.phase == "cancelled"
    val failed = value.phase == "failed"
    val phase = when (value.phase) { "applying", "failed" -> "claimed"; "prepared" -> "authorized"; else -> value.phase }
    return mapOf("schema" to 1, "kind" to "operation", "operationID" to value.id,
      "action" to if (value.activation) "recoveryModeActivate" else "dnsReplace", "phase" to phase,
      "authorization" to if (completed) "completed" else if (cancelled) "cancelled" else if (value.phase in setOf("applying", "failed")) "inFlight" else "authorized",
      "generation" to value.adultGeneration, "lockRevision" to "0", "authorizationGeneration" to "0",
      "accepted" to if (completed) true else null, "observation" to if (completed) "settled" else "unknown",
      "historicalReceipt" to true, "currentStatus" to "unknown", "historicalResultStale" to null,
      "layers" to mapOf((if (value.activation) "recovery-mode" else "dns-profile") to if (completed) "observedApplied" else if (failed) "uncertain" else if (value.phase == "applying") "dispatchReserved" else "untouched"))
  }

  fun bridge(context: Context, command: String, operationID: String): Map<String, Any?> {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    return authority.submit { machine ->
      val pending = operation(context, operationID) ?: error("recovery-dns-unknown-operation")
      check(pending.friendOperationID == null)
      when (command) {
        "execute" -> {
          if (pending.phase != "completed") {
            machine.requireLegacy(FriendLockAction.REPLACE_DNS_PROVIDER)
            install(context, pending, null)
          }
        }
        "cancel" -> FreedAdultProtectionState.guarded(context) {
          check(pending.phase in setOf("prepared", "authorized", "cancelled"))
          store(context).update { state -> state.copy(operations = state.operations.map { if (it.id == operationID) it.copy(phase = "cancelled") else it }) }
        }
        "read", "authorize" -> Unit
        else -> error("recovery-dns-command-invalid")
      }
      publicOperation(operation(context, operationID) ?: error("recovery-dns-operation-unavailable"))
    }.get(15, TimeUnit.SECONDS)
  }

  /** Same protected exact permit as every other enrolled adult weakening operation. */
  fun apply(context: Context, step: FreedAdultStep, permit: FreedAdultPermit): String {
    val pending = store(context).read().operations.singleOrNull {
      it.friendOperationID == permit.operationID && it.before == step.before && it.desired == step.desired
    } ?: error("recovery-dns-protected-operation-missing")
    install(context, pending, permit)
    return FreedRecoveryDnsPilot.activeDescriptor(context)
  }

  private fun install(context: Context, pending: FreedRecoveryDnsPilotRecord.Operation, permit: FreedAdultPermit?) {
    check(FreedRecoveryDnsPilot.supported(context) && foreground())
    check(pending.phase in setOf("prepared", "authorized")) { "recovery-dns-operation-outcome-unknown" }
    val authority = FreedAdultAuthorizationExecutor.get(context)
    val scope = FreedAppGroupStore.captureOwnerScope() ?: error("recovery-dns-owner-stale")
    val state = store(context).read()
    val candidate = state.candidates.single { it.reference == pending.reference }
    fun current(): Boolean = foreground() && FreedAppGroupStore.ownerScopeCurrent(scope) &&
      FreedPrivateAccountAdmission.valid(scope) && pending.ownerScopeDigest == FreedRecoveryDnsPilotPolicy.digest(scope) &&
      candidate.current(scope, FreedRecoveryDnsPilot.generation(context)) &&
      pending.networkEpoch == FreedVpnService.recoveryDnsNetworkEpoch() &&
      FreedRecoveryDnsPilot.activeDescriptor(context) == pending.before &&
      FreedAdultProtectionState.configuration(context) == FriendLockConfiguration(pending.baselineRevision, pending.adultGeneration)
    check(current()) { "recovery-dns-operation-stale" }
    if (pending.activation) check(FreedRecoveryDnsPilotRouteCheck.current(context, candidate, scope, foreground) != null)
    // DNS, bootstrap and TLS admission happen before all adult/grant/configuration guards.
    val prepared = if (pending.activation) null else FreedVpnService.prepareRecoveryDnsRuntime(candidate)
    var previous: FreedRecoveryDnsPilotUpstream? = null
    var swapped = false
    try {
      FreedAdultProtectionState.guarded(context) {
        synchronized(FreedNativeUnlockStore.lock) {
          synchronized(FreedRecoveryDnsPilot.configurationLock) {
            check(current()) { "recovery-dns-operation-stale" }
            if (permit != null) FreedAdultMutationBoundary.requireMutation(context, FriendLockAction.REPLACE_DNS_PROVIDER,
              if (pending.activation) "recovery-mode" else "dns-profile", pending.before, pending.desired, permit)
            else authority.machine.requireLegacy(FriendLockAction.REPLACE_DNS_PROVIDER)
            store(context).update { current ->
              check(current.activeReference == state.activeReference)
              current.copy(operations = current.operations.map { if (it.id == pending.id) it.copy(phase = "applying") else it })
            }
            FreedRecoveryDnsPilotTransaction.commit(
              publish = { if (!pending.activation) store(context).update { it.copy(activeReference = candidate.reference) } },
              swap = { if (!pending.activation) {
                previous = FreedVpnService.swapRecoveryDnsRuntime(prepared, pending.networkEpoch); swapped = true
              } },
              observe = { FreedRecoveryDnsPilot.activeDescriptor(context) == pending.desired &&
                FreedVpnService.recoveryDnsRuntimeDescriptor() == pending.desired &&
                pending.networkEpoch == FreedVpnService.recoveryDnsNetworkEpoch() &&
                foreground() && FreedAppGroupStore.ownerScopeCurrent(scope) },
              acknowledge = {
                store(context).update { current -> current.copy(operations = current.operations.map {
                  if (it.id == pending.id) it.copy(phase = "completed") else it
                }) }
                check(operation(context, pending.id)?.phase == "completed")
                if (!pending.activation) FreedRecoveryDnsPilotRouteCheck.invalidate()
              },
              rollback = {
              // Keep the old client alive until both durable pointer and live readback acknowledge.
              val durableRollback = runCatching {
                store(context).update { current -> current.copy(activeReference = state.activeReference,
                  operations = current.operations.map { if (it.id == pending.id) it.copy(phase = "failed") else it }) }
              }.isSuccess
              val runtimeRollback = !swapped || runCatching { FreedVpnService.swapRecoveryDnsRuntime(previous, pending.networkEpoch) }.isSuccess
                durableRollback && runtimeRollback
              })
          }
        }
      }
      if (swapped) FreedVpnService.finishRecoveryDnsReplacement(previous)
    } finally {
      if (FreedVpnService.recoveryDnsRuntimeDescriptor() != prepared?.descriptor) prepared?.let(FreedVpnService::releaseRecoveryDnsRuntime)
    }
  }
}
