package app.freed.protection

import android.content.Context
import java.util.concurrent.Future

/** A non-exported, one-dispatch capability. No caller can construct a valid issuer binding. */
internal class FreedAdultPermit internal constructor(
  internal val issuer: FreedAdultExecutionMachine,
  internal val operationID: String,
  internal val digest: String,
  internal val generation: String,
  internal val step: FreedAdultStep,
  internal val attempt: Any = Any()
)
internal interface FreedAdultExecutionLayers {
  fun configuration(): FriendLockConfiguration
  fun observe(layer: String): String
  fun apply(step: FreedAdultStep, permit: FreedAdultPermit): String
}
/** Called only on the authority worker. The guard is also used by actual lower commits/repair. */
internal class FreedAdultExecutionMachine(
  private val core: FriendLockCore,
  private val store: FriendLockRecordStore,
  private val journal: FreedAdultExecutionJournal,
  private val layers: FreedAdultExecutionLayers,
  internal val guard: Any = Any(),
  private val cleanupPending: (String?) -> Boolean = { false },
  private val cleanupKnown: (String) -> Boolean = { true },
  private val cleanupCanForget: (String) -> Boolean = { false }
) {
  private val permits = mutableSetOf<FreedAdultPermit>()
  private var quarantined = false
  private var enrollmentOwner: Any? = null

  fun isQuarantined(): Boolean = synchronized(guard) { quarantined }
  fun beginEnrollment(): Pair<Any, FreedAdultJournalSnapshot> = synchronized(guard) {
    check(enrollmentOwner == null) { "adult-enrollment-in-progress" }
    val snapshot = census()
    if (store.load() != null) fail(FriendLockError.ALREADY_ENROLLED)
    check(snapshot.operations.isEmpty() && snapshot.cleanups.isEmpty()) { "adult-enrollment-journal-unavailable" }
    val token = Any(); enrollmentOwner = token; token to snapshot
  }
  fun validateEnrollment(token: Any, original: FreedAdultJournalSnapshot) {
    check(Thread.holdsLock(guard) && enrollmentOwner === token) { "adult-enrollment-in-progress" }
    check(census() == original) { "adult-stale-generation" }
  }
  fun endEnrollment(token: Any) = synchronized(guard) { if (enrollmentOwner === token) enrollmentOwner = null }

  private fun quarantine(reason: String, identities: Collection<String> = emptyList()): Nothing {
    quarantined = true; permits.clear()
    runCatching {
      val snapshot = journal.read()
      journal.save(snapshot.copy(uncertainty = (snapshot.uncertainty + identities.map { "unresolved:$it" } + reason.take(128)).take(128).toSet()))
    }
    error("adult-execution-uncertain:$reason")
  }
  /** Full same-store receipt census, including host-only and protected-only identities. */
  private fun census(operationID: String? = null, cleanupID: String? = null): FreedAdultJournalSnapshot {
    check(!cleanupPending(cleanupID)) { "adult-private-cleanup-admission-pending" }
    if (quarantined) quarantine("in-memory-quarantine")
    val snapshot = try { journal.read() } catch (_: Exception) { quarantine("journal-unavailable") }
    if (snapshot.uncertainty.isNotEmpty()) quarantine("retained-uncertainty")
    check(snapshot.cleanups.values.none { it.phase in setOf("requested", "reserved") }) { "adult-private-cleanup-pending" }
    val record = try { store.load() } catch (_: Exception) { quarantine("protected-read-unavailable", snapshot.operations.keys) }
    val protected = record?.operations?.associateBy { it.operationID } ?: emptyMap()
    if (protected.keys != snapshot.operations.keys) quarantine("operation-census-missing-half", protected.keys + snapshot.operations.keys)
    snapshot.operations.forEach { (id, host) ->
      val receipt = protected.getValue(id)
      if (receipt != host.receipt || host.change().digest(FriendLockNativeCrypto()) != receipt.deltaDigest)
        quarantine("operation-census-binding-mismatch:$id")
      val validPhase = when (receipt.state) {
        FriendLockOperationState.AWAITING_SECRET -> host.phase == FreedAdultHostPhase.PREPARED
        FriendLockOperationState.AUTHORIZED -> host.phase in setOf(FreedAdultHostPhase.AUTHORIZED, FreedAdultHostPhase.CLAIM_RESERVED)
        FriendLockOperationState.IN_FLIGHT -> host.phase in setOf(FreedAdultHostPhase.CLAIMED, FreedAdultHostPhase.OUTCOME)
        FriendLockOperationState.COMPLETED -> host.phase == FreedAdultHostPhase.COMPLETED
        FriendLockOperationState.CANCELLED -> host.phase == FreedAdultHostPhase.CANCELLED
      }
      if (!validPhase) quarantine("operation-census-phase-mismatch:$id")
      val orderedDispatched = host.steps.take(host.dispatched.size).map { it.layer }.toSet()
      val orderedObserved = host.steps.take(host.observed.size).associate { it.layer to it.desired }
      if (host.dispatched != orderedDispatched || host.observed != orderedObserved ||
        host.dispatched.size - host.observed.size !in 0..1) quarantine("operation-census-layer-order:$id")
      if (host.phase in setOf(FreedAdultHostPhase.PREPARED, FreedAdultHostPhase.AUTHORIZED, FreedAdultHostPhase.CLAIM_RESERVED, FreedAdultHostPhase.CANCELLED) &&
        host.dispatched.isNotEmpty()) quarantine("operation-census-premature-dispatch:$id")
      if (host.phase in setOf(FreedAdultHostPhase.OUTCOME, FreedAdultHostPhase.COMPLETED) &&
        (host.observed.size != host.steps.size || host.outcome != "observed")) quarantine("operation-census-incomplete-outcome:$id")
      if (id != operationID && host.phase in setOf(FreedAdultHostPhase.CLAIM_RESERVED, FreedAdultHostPhase.CLAIMED, FreedAdultHostPhase.OUTCOME))
        error("adult-execution-reserved:$id")
    }
    return snapshot
  }
  private fun save(host: FreedAdultHostOperation) {
    try { val snapshot = journal.read(); journal.save(snapshot.copy(operations = snapshot.operations + (host.receipt.operationID to host))) }
    catch (_: Exception) { quarantine("host-publication-unknown:${host.receipt.operationID}") }
  }
  fun prepare(action: FriendLockAction, steps: List<FreedAdultStep>): String = synchronized(guard) {
    check(enrollmentOwner == null) { "adult-enrollment-in-progress" }
    val snapshot = census()
    check(snapshot.operations.size < 32) { "adult-authorization-capacity" }
    check(steps.size in 1..8 && steps.map { it.layer }.toSet().size == steps.size)
    val allowed = when (action) {
      FriendLockAction.DISABLE_ADULT_FILTER -> setOf("dns-intent", "dns-runtime", "encrypted-request", "accessibility-adult")
      FriendLockAction.DISABLE_ENCRYPTED_DNS -> setOf("encrypted-request", "encrypted-clear")
      FriendLockAction.REMOVE_ADULT_DOMAINS -> setOf("feed")
      FriendLockAction.ADD_ADULT_EXCEPTIONS -> setOf("exceptions")
      FriendLockAction.REPLACE_DNS_PROVIDER -> setOf("dns-profile", "recovery-mode")
      else -> emptySet()
    }
    check(steps.all { it.layer in allowed }) { "adult-action-layer-mismatch" }
    steps.forEach { check(layers.observe(it.layer) == it.before) { "adult-baseline-unavailable" } }
    val config = layers.configuration()
    val template = FreedAdultHostOperation(action, FriendLockReceipt("0".repeat(32), "0".repeat(64), config, 1, 0, FriendLockOperationState.AWAITING_SECRET), steps.toList(), FreedAdultHostPhase.PREPARED)
    journal.validateCapacity(snapshot.copy(operations = snapshot.operations + (template.receipt.operationID to template)))
    val receipt = try { core.prepare(template.change(), config) } catch (failure: Exception) {
      // Failed protected publication can have committed; a fresh census must see every orphan.
      census(); throw failure
    }
    save(template.copy(receipt = receipt)); census(receipt.operationID); receipt.operationID
  }
  fun authorize(operationID: String, pin: String): FriendLockReceipt {
    val host = synchronized(guard) { census(operationID).operations[operationID] ?: error("adult-unknown-operation") }
    if (host.receipt.state != FriendLockOperationState.AWAITING_SECRET) return host.receipt
    check(layers.configuration() == host.receipt.configuration) { "adult-stale-generation" }
    // No adult/grant/config/service lock is held during the KDF.
    val authorized = try { core.authorize(pin, host.change(), host.receipt.configuration, operationID) }
    catch (failure: Exception) { synchronized(guard) { census(operationID) }; throw failure }
    return synchronized(guard) {
      if (layers.configuration() != host.receipt.configuration) quarantine("authorization-raced-repair:$operationID")
      save(host.copy(receipt = authorized, phase = FreedAdultHostPhase.AUTHORIZED)); census(operationID); authorized
    }
  }
  fun reserve(operationID: String) = synchronized(guard) {
    val host = census(operationID).operations[operationID] ?: error("adult-unknown-operation")
    check(host.receipt.state == FriendLockOperationState.AUTHORIZED && host.dispatched.isEmpty())
    check(layers.configuration() == host.receipt.configuration) { "adult-stale-generation" }
    save(host.copy(phase = FreedAdultHostPhase.CLAIM_RESERVED))
  }
  fun execute(operationID: String): FreedAdultHostOperation {
    var host = synchronized(guard) {
      val h = census(operationID).operations[operationID] ?: error("adult-unknown-operation")
      if (h.phase == FreedAdultHostPhase.COMPLETED) return h // historical, never permission
      check(h.phase in setOf(FreedAdultHostPhase.AUTHORIZED, FreedAdultHostPhase.CLAIM_RESERVED,
        FreedAdultHostPhase.CLAIMED, FreedAdultHostPhase.OUTCOME)) { "adult-operation-not-authorized" }
      check(layers.configuration().mutationGeneration == h.receipt.configuration.mutationGeneration) { "adult-stale-generation" }
      if (h.phase in setOf(FreedAdultHostPhase.AUTHORIZED, FreedAdultHostPhase.CLAIM_RESERVED))
        check(layers.configuration() == h.receipt.configuration) { "adult-stale-baseline" }
      if (h.phase == FreedAdultHostPhase.AUTHORIZED) reserve(operationID)
      val reserved = journal.read().operations.getValue(operationID)
      if (reserved.phase == FreedAdultHostPhase.CLAIM_RESERVED) {
        val claimed = try { core.claim(operationID, reserved.change(), reserved.receipt.configuration) }
        catch (failure: Exception) { census(operationID); throw failure }
        check(claimed.state == FriendLockOperationState.IN_FLIGHT)
        save(reserved.copy(receipt = claimed, phase = FreedAdultHostPhase.CLAIMED))
      }
      census(operationID).operations.getValue(operationID)
    }
    for (step in host.steps) {
      if (host.observed[step.layer] == step.desired) {
        check(layers.observe(step.layer) == step.desired) { "adult-observed-layer-changed" }
        continue
      }
      if (step.layer in host.dispatched) synchronized(guard) { quarantine("dispatch-outcome-unknown:$operationID:${step.layer}") }
      val permit = synchronized(guard) {
        val current = census(operationID).operations.getValue(operationID)
        check(current.phase == FreedAdultHostPhase.CLAIMED && current.receipt.state == FriendLockOperationState.IN_FLIGHT) { "adult-operation-not-claimed" }
        check(layers.configuration().mutationGeneration == host.receipt.configuration.mutationGeneration && layers.observe(step.layer) == step.before) { "adult-stale-baseline" }
        host = host.copy(dispatched = host.dispatched + step.layer)
        save(host) // durable BEFORE publishing the one-shot capability
        FreedAdultPermit(this, operationID, host.receipt.deltaDigest, host.receipt.configuration.mutationGeneration, step).also { permits.add(it) }
      }
      val observed = try { layers.apply(step, permit) } catch (_: Exception) {
        synchronized(guard) { quarantine("native-effect-unknown:$operationID:${step.layer}") }
      }
      synchronized(guard) {
        permits.remove(permit)
        if (layers.configuration().mutationGeneration != host.receipt.configuration.mutationGeneration || observed != step.desired || layers.observe(step.layer) != observed)
          quarantine("native-readback-unknown:$operationID:${step.layer}")
        host = host.copy(observed = host.observed + (step.layer to observed)); save(host)
      }
    }
    return synchronized(guard) {
      census(operationID)
      val resulting = layers.configuration()
      host = host.copy(phase = FreedAdultHostPhase.OUTCOME, outcome = "observed")
      save(host)
      val readback = host.steps.joinToString("\n") { "${it.layer}:${FreedAdultHostOperation.digest(host.observed.getValue(it.layer))}" }.toByteArray()
      val completed = try { core.complete(operationID, host.change(), host.receipt.configuration, resulting, readback) }
      catch (_: Exception) { quarantine("core-completion-unknown:$operationID") }
      host = host.copy(receipt = completed, phase = FreedAdultHostPhase.COMPLETED); save(host); census(operationID); host
    }
  }
  fun reconcile(operationID: String): FreedAdultHostOperation = synchronized(guard) {
    val host = census(operationID).operations[operationID] ?: error("adult-unknown-operation")
    // Observation supplements intact pairing, never reconstructs a lost host half.
    host.steps.forEach { layers.observe(it.layer) }
    if (host.dispatched.any { it !in host.observed }) quarantine("unobserved-dispatch:$operationID")
    host
  }
  fun cancel(operationID: String): FriendLockReceipt = synchronized(guard) {
    val host = census(operationID).operations[operationID] ?: error("adult-unknown-operation")
    check(host.dispatched.isEmpty() && permits.none { it.operationID == operationID } &&
      host.phase in setOf(FreedAdultHostPhase.PREPARED, FreedAdultHostPhase.AUTHORIZED, FreedAdultHostPhase.CLAIM_RESERVED)) { "adult-cancel-not-proven" }
    val cancelled = try { core.cancel(operationID) } catch (_: Exception) { quarantine("cancel-publication-unknown") }
    save(host.copy(receipt = cancelled, phase = FreedAdultHostPhase.CANCELLED)); cancelled
  }
  fun consume(permit: FreedAdultPermit, layer: String, before: String, desired: String) = synchronized(guard) {
    check(permit.issuer === this && permit in permits && permit.step == FreedAdultStep(layer, before, desired) &&
      permit.generation == layers.configuration().mutationGeneration) { "adult-invalid-permit" }
    val host = census(permit.operationID).operations.getValue(permit.operationID)
    check(host.phase == FreedAdultHostPhase.CLAIMED && host.receipt.state == FriendLockOperationState.IN_FLIGHT &&
      host.receipt.deltaDigest == permit.digest && layer in host.dispatched && layer !in host.observed)
    check(permits.remove(permit))
  }
  fun requireLegacy(action: FriendLockAction) = synchronized(guard) {
    check(enrollmentOwner == null) { "adult-enrollment-in-progress" }
    census()
    FreedAdultMutationGate { store.load() }.requireUnenrolled(action)
  }
  fun checkAuthorityCensus() = synchronized(guard) { census(); Unit }
  fun invalidateAfterRepair() = synchronized(guard) {
    val snapshot = journal.read()
    if (snapshot.uncertainty.isNotEmpty()) {
      val record = store.load()
      if (record != null) {
        // Preserve every protected identity before invalidation, including an orphan that
        // a concurrent stronger repair did not itself need to authorize.
        journal.save(snapshot.copy(uncertainty = snapshot.uncertainty + record.operations.map { "invalidated:${it.operationID}:${it.deltaDigest}" }))
        core.invalidateAuthorizations()
      }
    }
  }
  fun reservePrivateCleanup(operationID: String): String = synchronized(guard) {
    check(enrollmentOwner == null) { "adult-enrollment-in-progress" }
    require(java.util.UUID.fromString(operationID).toString() == operationID)
    var snapshot = journal.read()
    snapshot.cleanups[operationID]?.let { return@synchronized it.phase }
    check(cleanupKnown(operationID)) { "adult-private-cleanup-unknown-id" }
    // Full census before reserving; existing uncertainty remains sticky and cannot be cleared.
    census(cleanupID = operationID)
    if (snapshot.cleanups.size >= 32) {
      val prunable = snapshot.cleanups.entries.firstOrNull { it.value.phase in setOf("complete", "superseded") && cleanupCanForget(it.key) }
      if (prunable != null) snapshot = snapshot.copy(cleanups = snapshot.cleanups - prunable.key)
    }
    check(snapshot.cleanups.size < 32) { "adult-private-cleanup-capacity" }
    journal.save(snapshot.copy(cleanups = snapshot.cleanups + (operationID to FreedAdultCleanupReservation(snapshot.generation, "requested"))))
    "requested"
  }
  fun invalidatePrivateCleanup(operationID: String): String = synchronized(guard) {
    var snapshot = journal.read()
    var reservation = snapshot.cleanups[operationID] ?: error("adult-private-cleanup-not-reserved")
    if (reservation.phase in setOf("complete", "superseded")) return@synchronized reservation.phase
    check(snapshot.uncertainty.isEmpty() && !quarantined) { "adult-private-cleanup-uncertain" }
    val record = store.load()
    fun saveReservation(next: FreedAdultCleanupReservation) {
      snapshot = journal.read(); journal.save(snapshot.copy(cleanups = snapshot.cleanups + (operationID to next)))
      reservation = next
    }
    if (record == null) { saveReservation(reservation.copy(phase = "complete")); return@synchronized "complete" }
    if (reservation.phase == "requested") {
      // An in-flight/preclaimed execution cannot be silently cancelled or recertified.
      check(snapshot.operations.values.none { it.phase in setOf(FreedAdultHostPhase.CLAIM_RESERVED, FreedAdultHostPhase.CLAIMED, FreedAdultHostPhase.OUTCOME) }) { "adult-private-cleanup-in-flight" }
      check(snapshot.generation == reservation.generation) { "adult-private-cleanup-generation-stale" }
      check(record.operations.associateBy { it.operationID } == snapshot.operations.mapValues { it.value.receipt }) { "adult-private-cleanup-census-mismatch" }
      saveReservation(reservation.copy(phase = "reserved", lockRevision = record.lockRevision, authorizationGeneration = record.authorizationGeneration))
    }
    val actual = store.load() ?: error("adult-private-cleanup-protected-unavailable")
    val original = actual.lockRevision == reservation.lockRevision && actual.authorizationGeneration == reservation.authorizationGeneration
    val acknowledged = actual.lockRevision == reservation.lockRevision && actual.authorizationGeneration == reservation.authorizationGeneration + 1 && actual.operations.isEmpty()
    if (!original && !acknowledged) { saveReservation(reservation.copy(phase = "superseded")); return@synchronized "superseded" }
    if (original) core.invalidateAuthorizations()
    val after = store.load() ?: error("adult-private-cleanup-protected-unavailable")
    check(after.lockRevision == reservation.lockRevision && after.authorizationGeneration == reservation.authorizationGeneration + 1 && after.operations.isEmpty())
    snapshot = journal.read()
    // Preserve host receipts and sticky evidence rather than pretending their protected halves survived.
    journal.save(snapshot.copy(cleanups = snapshot.cleanups + (operationID to reservation.copy(phase = "complete")),
      uncertainty = if (snapshot.operations.isEmpty()) snapshot.uncertainty else snapshot.uncertainty + "private-cleanup-invalidated-receipts"))
    permits.clear(); "complete"
  }
  /** Observation only: a pre-existing reservation remains the original cohort authority after restart. */
  fun privateCleanupReservationLeader(operationIDs: Set<String>): String? = synchronized(guard) {
    val active = journal.read().cleanups.filter { (id, value) -> id in operationIDs && value.phase in setOf("requested", "reserved") }
    check(active.size <= 1) { "adult-private-cleanup-reservations-uncertain" }
    active.keys.singleOrNull()
  }
  /** Followers share a proved continuously closed admission interval, never a later authority.
   * Keep unrelated uncertainty/preclaim/generation changes pending; this does not clear or recensus them. */
  fun privateCleanupCoverageStatus(operationID: String): String = synchronized(guard) {
    val snapshot = journal.read()
    val original = snapshot.cleanups[operationID] ?: return@synchronized "unknown"
    if (original.phase != "complete") return@synchronized original.phase
    if (quarantined || snapshot.generation != original.generation || snapshot.uncertainty.any { it != "private-cleanup-invalidated-receipts" })
      return@synchronized "pending"
    if (snapshot.operations.values.any { it.phase in setOf(FreedAdultHostPhase.CLAIM_RESERVED, FreedAdultHostPhase.CLAIMED, FreedAdultHostPhase.OUTCOME) })
      return@synchronized "pending"
    val actual = store.load()
    if (original.lockRevision < 0) return@synchronized if (actual == null && snapshot.operations.isEmpty()) "complete" else "superseded"
    if (actual != null && actual.lockRevision == original.lockRevision && actual.authorizationGeneration == original.authorizationGeneration + 1 && actual.operations.isEmpty()) "complete"
    else "superseded"
  }
  fun privateCleanupStatus(operationID: String): String = synchronized(guard) {
    journal.read().cleanups[operationID]?.phase ?: "unknown"
  }
  fun revokeForRepair(reason: String) = synchronized(guard) {
    permits.clear()
    val snapshot = try { journal.read() } catch (_: Exception) { quarantined = true; return@synchronized false }
    val unresolved = snapshot.operations.filterValues { it.phase !in setOf(FreedAdultHostPhase.COMPLETED, FreedAdultHostPhase.CANCELLED) }.keys
    try { journal.save(snapshot.copy(generation = Math.addExact(snapshot.generation, 1),
      uncertainty = if (unresolved.isEmpty()) snapshot.uncertainty else snapshot.uncertainty + "repair:$reason")); true }
    catch (_: Exception) { quarantined = true; false }
  }
}

/** One process authority. All native integrations retain this same Core AND store. */
internal class FreedAdultAuthorizationExecutor private constructor(context: Context, private val nativeEnrollmentGate: () -> Boolean = { false }) {
  private val context = context.applicationContext
  internal val store = FriendLockRecordStore(FriendLockKeystoreBytes(this.context))
  internal val core = FriendLockCore(store, FriendLockNativeCrypto())
  internal val worker = FriendLockWorker(core)
  internal val journal = FreedAdultExecutionJournal(FreedAdultJournalFile(this.context))
  internal val guard = Any()
  internal val machine: FreedAdultExecutionMachine
  init {
    // Existing enrollment without its host journal cannot initialize an empty census.
    runCatching { requireSameProcess(); if (store.load() == null) journal.initialize() else journal.read() }
    machine = FreedAdultExecutionMachine(core, store, journal, FreedAdultNativeLayers(this.context), guard,
      cleanupPending = { id -> FreedRetainedAdultProtection.adultCleanupPending(this.context, id) },
      cleanupKnown = { id -> FreedRetainedAdultProtection.coreCleanupKnown(this.context, id) },
      cleanupCanForget = { id -> FreedRetainedAdultProtection.coreCleanupCanForget(this.context, id) })
  }
  fun enroll(pin: String, confirmation: String): Future<FriendLockEnrollment> = worker.submit { authorityCore ->
    requireSameProcess()
    check(nativeEnrollmentGate()) { "adult-enrollment-disabled" }
    val (token, _) = machine.beginEnrollment()
    try {
      FreedAdultProtectionState.migrate(context)
      val baselineJournal = journal.read()
      synchronized(guard) { machine.validateEnrollment(token, baselineJournal) }
      val before = FreedAdultProtectionState.enrollmentObservation(context)
      val candidate = authorityCore.deriveEnrollment(pin, confirmation,
        FriendLockBaseline(before.configuration, true, before.readback.toByteArray()))
      val after = FreedAdultProtectionState.enrollmentObservation(context)
      check(before == after) { "adult-stale-generation" }
      authorityCore.publishEnrollment(candidate) { commit ->
        FreedAdultProtectionState.guarded(context) {
          machine.validateEnrollment(token, baselineJournal)
          check(FreedAdultProtectionState.enrollmentWitnessCurrent(context, before)) { "adult-stale-generation" }
          commit()
        }
      }
    } finally { machine.endEnrollment(token) }
  }
  private fun enrollmentReady(): Boolean {
    if (!nativeEnrollmentGate()) return false
    return runCatching {
      val (token, _) = machine.beginEnrollment()
      try { FreedAdultProtectionState.migrate(context); FreedAdultProtectionState.enrollmentObservation(context); true }
      finally { machine.endEnrollment(token) }
    }.getOrDefault(false)
  }
  fun requireSameProcess() {
    val process = runCatching {
      if (android.os.Build.VERSION.SDK_INT >= 28) android.app.Application.getProcessName()
      else context.getSystemService(android.app.ActivityManager::class.java)?.runningAppProcesses
        ?.firstOrNull { it.pid == android.os.Process.myPid() }?.processName
    }.getOrNull()
    val declared = runCatching {
      context.packageManager.getPackageInfo(context.packageName, android.content.pm.PackageManager.GET_SERVICES).services
    }.getOrNull()
    val owned = listOf("app.freed.protection.FreedVpnService", "app.freed.protection.FreedAccessibilityService")
    check(process == context.packageName && owned.all { name ->
      declared?.firstOrNull { it.name == name }?.processName == context.packageName
    }) { "adult-process-topology-unavailable" }
  }
  fun <T> submit(operation: (FreedAdultExecutionMachine) -> T): Future<T> = worker.submit { requireSameProcess(); operation(machine) }
  /** Native-only request builders read the actual normalized plan. No public PIN bridge. */
  fun prepareAdultOff(): Future<String> = prepareLayers(FriendLockAction.DISABLE_ADULT_FILTER,
    listOf("dns-intent", "dns-runtime", "encrypted-request", "accessibility-adult"))
  fun prepareDnsStop(): Future<String> = prepareLayers(FriendLockAction.DISABLE_ADULT_FILTER, listOf("dns-intent", "dns-runtime"))
  fun prepareEncryptedDisable(): Future<String> = prepareLayers(FriendLockAction.DISABLE_ENCRYPTED_DNS, listOf("encrypted-request"))
  fun prepareEncryptedClear(): Future<String> = submit { executor ->
    FreedAdultProtectionState.migrate(context)
    executor.prepare(FriendLockAction.DISABLE_ENCRYPTED_DNS, listOf(FreedAdultStep("encrypted-clear", FreedAdultNativeLayers(context).observe("encrypted-clear"), "empty")))
  }
  fun authorize(operationID: String, pin: String): Future<FriendLockReceipt> = submit { it.authorize(operationID, pin) }
  fun execute(operationID: String): Future<Map<String, Any?>> = submit { executor ->
    try {
      val host = executor.execute(operationID)
      val current = runCatching { FreedAdultProtectionState.configuration(context) }.getOrNull()
      mapOf("accepted" to true, "operationID" to operationID, "phase" to host.phase.name, "observedLayers" to host.observed,
        "historicalReceipt" to true, "currentStatus" to if (current == null) "unknown" else "readable",
        "historicalResultStale" to current?.let { host.receipt.resultingConfiguration != it })
    } catch (failure: Exception) {
      val host = runCatching { journal.read().operations[operationID] }.getOrNull()
      mapOf("accepted" to false, "operationID" to operationID, "phase" to host?.phase?.name,
        "status" to "needs-attention", "observedLayers" to host?.observed,
        "reason" to if (executor.isQuarantined()) "adult-execution-outcome-unknown" else "adult-execution-unavailable")
    }
  }
  private fun prepareLayers(action: FriendLockAction, layers: List<String>): Future<String> = submit { executor ->
    FreedAdultProtectionState.migrate(context)
    val native = FreedAdultNativeLayers(context)
    executor.prepare(action, layers.map { FreedAdultStep(it, native.observe(it), "false") })
  }
  fun prepareFeed(domains: List<String>, version: String, checksum: String, generatedAt: String): Future<String> = submit { executor ->
    FreedAdultProtectionState.migrate(context)
    executor.prepare(FriendLockAction.REMOVE_ADULT_DOMAINS, listOf(FreedAdultStep("feed", FreedAdultDomainFeed.feedSnapshot(context),
      FreedAdultDomainFeed.canonicalFeed(domains, version, checksum, generatedAt))))
  }
  fun prepareExceptions(domains: List<String>): Future<String> = submit { executor ->
    FreedAdultProtectionState.migrate(context)
    executor.prepare(FriendLockAction.ADD_ADULT_EXCEPTIONS, listOf(FreedAdultStep("exceptions", FreedAdultDomainFeed.exceptionsSnapshot(context),
      FreedAdultDomainFeed.canonicalExceptions(domains))))
  }
  fun rotate(secret: FriendLockSecret, pin: String, confirmation: String): Future<FriendLockEnrollment> = worker.submit { authorityCore ->
    requireSameProcess()
    FreedAdultProtectionState.guarded(context) {
      machine.checkAuthorityCensus()
      FreedAdultProtectionState.repairFence(context, "credential-rotation")
      check(!machine.isQuarantined()) { "adult-rotation-fence-unavailable" }
      val host = journal.read()
      // Rotation discards protected receipts. Retain the historical/unresolved host identities
      // durably before that transition; rotation can never clear their quarantine.
      if (host.operations.isNotEmpty()) journal.save(host.copy(uncertainty = host.uncertainty + "credential-rotation-receipts-retained"))
    }
    authorityCore.rotate(secret, pin, confirmation) // KDF outside every mutation/service/grant lock.
  }
  fun invalidateAuthorizations(): Future<Unit> = worker.submit { authorityCore ->
    requireSameProcess()
    FreedAdultProtectionState.guarded(context) {
      machine.checkAuthorityCensus()
      FreedAdultProtectionState.repairFence(context, "explicit-invalidation")
      check(!machine.isQuarantined()) { "adult-invalidation-fence-unavailable" }
      val host = journal.read()
      if (host.operations.isNotEmpty()) journal.save(host.copy(uncertainty = host.uncertainty + "invalidation-receipts-retained"))
      if (store.load() != null) authorityCore.invalidateAuthorizations()
    }
  }
  /** No grant/private exclusion is held here. Existing same-Core worker performs the transition. */
  fun invalidateForPrivateCleanup(operationID: String): Future<String> {
    machine.reservePrivateCleanup(operationID)
    return submit { it.invalidatePrivateCleanup(operationID) }
  }
  fun privateCleanupReservationLeader(operationIDs: Set<String>): String? = machine.privateCleanupReservationLeader(operationIDs)
  fun privateCleanupCoverageStatus(operationID: String): String = machine.privateCleanupCoverageStatus(operationID)
  fun privateCleanupInvalidationStatus(operationID: String): String = machine.privateCleanupStatus(operationID)
  fun operationStatus(operationID: String): Future<Map<String, Any?>> = submit { executor ->
    val historical = executor.reconcile(operationID)
    val current = runCatching { FreedAdultProtectionState.configuration(context) }.getOrNull()
    mapOf("operationID" to operationID, "phase" to historical.phase.name, "outcome" to historical.outcome,
      "observedLayers" to historical.observed, "historicalResultStale" to current?.let { observed -> historical.receipt.resultingConfiguration?.let { it != observed } },
      "currentStatus" to if (current == null) "unknown" else "readable", "currentConfiguration" to current?.revision)
  }
  /** Serial cancellation uses the existing machine's proof; a screen close is not rollback. */
  fun cancel(operationID: String): Future<FriendLockReceipt> = submit { it.cancel(operationID) }

  private val publicBridgeObservers = java.util.concurrent.atomic.AtomicInteger(0)
  internal fun publicRecoveryDnsOperation(id: String): Map<String, Any?> = publicOperation(id)
  private fun publicOperation(id: String, pending: Boolean = false): Map<String, Any?> {
    val host = journal.read().operations[id] ?: fail(FriendLockError.UNKNOWN_OPERATION)
    val action = when (host.steps.map { it.layer }) {
      listOf("dns-intent", "dns-runtime", "encrypted-request", "accessibility-adult") -> "adultOff"
      listOf("dns-intent", "dns-runtime") -> "dnsStop"
      listOf("encrypted-request") -> "encryptedDisable"
      listOf("encrypted-clear") -> "encryptedClear"
      listOf("feed") -> "feed"
      listOf("exceptions") -> "exceptions"
      listOf("dns-profile") -> "dnsReplace"
      listOf("recovery-mode") -> "recoveryModeActivate"
      else -> error("adult-public-action-unavailable")
    }
    val phase = when(host.phase) {
      FreedAdultHostPhase.PREPARED -> "prepared"
      FreedAdultHostPhase.AUTHORIZED -> "authorized"
      FreedAdultHostPhase.CLAIM_RESERVED -> "claimReserved"
      FreedAdultHostPhase.CLAIMED -> "claimed"
      FreedAdultHostPhase.OUTCOME -> "outcomeRecorded"
      FreedAdultHostPhase.COMPLETED -> "completed"
      FreedAdultHostPhase.CANCELLED -> "cancelled"
    }
    val authorization = when(host.receipt.state) {
      FriendLockOperationState.AWAITING_SECRET -> "awaitingSecret"
      FriendLockOperationState.AUTHORIZED -> "authorized"
      FriendLockOperationState.IN_FLIGHT -> "inFlight"
      FriendLockOperationState.COMPLETED -> "completed"
      FriendLockOperationState.CANCELLED -> "cancelled"
    }
    return mapOf("schema" to 1, "kind" to "operation", "operationID" to id, "action" to action,
      "phase" to phase, "authorization" to authorization, "generation" to host.receipt.configuration.mutationGeneration,
      "lockRevision" to host.receipt.lockRevision.toString(), "authorizationGeneration" to host.receipt.authorizationGeneration.toString(),
      "accepted" to if (host.phase == FreedAdultHostPhase.COMPLETED) true else null,
      "observation" to if (host.phase == FreedAdultHostPhase.COMPLETED) "settled" else if (pending) "pending" else "unknown",
      "historicalReceipt" to true, "currentStatus" to "unknown", "historicalResultStale" to null,
      // Never return the observed feed/exception text or before/desired data.
      "layers" to host.steps.associate { it.layer to if (it.layer in host.observed) "observedApplied" else if (it.layer in host.dispatched) "dispatchReserved" else "untouched" })
  }
  /** Account-free public seam. The future remains queue-owned after the observer times out. */
  fun deviceAdultBridge(command: String, request: Map<String, Any?>): Map<String, Any?> {
    fun failure(code: String): Map<String, Any?> = mapOf("schema" to 1, "kind" to "error", "code" to code)
    fun exact(vararg keys: String) = request.keys == keys.toSet()
    fun text(key: String, limit: Int = 128): String {
      val value = request[key] as? String ?: fail(FriendLockError.INVALID_SCOPE)
      require(value.toByteArray().size <= limit); return value
    }
    fun <T> observe(future: Future<T>): T = future.get(8, java.util.concurrent.TimeUnit.SECONDS)
    var admitted = false
    try {
      requireSameProcess()
      if (command.length > 16 || request.size > 6) return failure("invalidInput")
      if (command in setOf("execute", "read", "cancel", "authorize")) {
        val dnsID = request["operationID"] as? String
        if (dnsID != null && validHex(dnsID, 32) && FreedRecoveryDnsPilotCoordinator.owns(context, dnsID)) {
          if (!(if (command == "authorize") exact("operationID", "pin") else exact("operationID"))) return failure("invalidInput")
          return FreedRecoveryDnsPilotCoordinator.bridge(context, command, dnsID)
        }
      }
      if (command == "status") {
        if (request.isNotEmpty()) return failure("invalidInput")
        // Same protected Core, independently of the executor queue/DNS/private admission.
        val credential = when(core.status()) {
          FriendLockStatus.NOT_ENROLLED -> "notEnrolled"
          FriendLockStatus.ENROLLED -> "enrolled"
          FriendLockStatus.MISSING_ENROLLED -> "missingEnrolled"
          FriendLockStatus.CORRUPT -> "corrupt"
          FriendLockStatus.UNAVAILABLE -> "unavailable"
        }
        val state = runCatching { journal.read() }.getOrNull()
        val pending = runCatching { state?.operations?.values?.filter { it.phase !in setOf(FreedAdultHostPhase.COMPLETED, FreedAdultHostPhase.CANCELLED) }?.map { it.receipt.operationID } }.getOrNull()
        val operationUnavailable = state == null || machine.isQuarantined() || state.uncertainty.isNotEmpty() || state.cleanups.values.any { it.phase in setOf("requested", "reserved") }
        val mutationUnavailable = credential != "enrolled" || operationUnavailable
        val mutationReason = if(credential == "notEnrolled") "notEnrolled" else if(credential != "enrolled") "protectedRecordUnavailable" else if(operationUnavailable) "operationStateUnavailable" else "baselineUnobserved"
        val enrollmentReady = enrollmentReady()
        return mapOf("schema" to 1, "kind" to "status", "platform" to "android", "credential" to credential,
          "bridgeAvailable" to true, "mutationAvailability" to if(mutationUnavailable) "unavailable" else "unknown", "mutationReason" to mutationReason,
          "enrollmentAvailable" to enrollmentReady, "enrollmentReason" to if (!nativeEnrollmentGate()) "integrationDisabled" else if (credential == "enrolled") "alreadyEnrolled" else if (enrollmentReady) "nativeReady" else "nativeReadinessUnavailable",
          "actions" to listOf("adultOff", "dnsStop", "encryptedDisable", "encryptedClear", "feed", "exceptions"),
          "pendingKnown" to (pending != null), "pendingOperationIDs" to (pending ?: emptyList<String>()),
          "observations" to listOf("accessibility-adult", "dns-runtime", "encrypted-request").associateWith { "unknown" })
      }
      if (command == "enroll" && !nativeEnrollmentGate()) return failure("integrationDisabled")
      if (command !in listOf("enroll", "prepare", "rotate", "authorize", "execute", "read", "cancel")) return failure("invalidInput")
      if (command != "read") {
        if (publicBridgeObservers.incrementAndGet() > 16) { publicBridgeObservers.decrementAndGet(); return failure("busy") }
        admitted = true
      }
      if (command == "enroll") {
        if (!exact("pin", "confirmation")) return failure("invalidInput")
        val result = observe(enroll(text("pin", 64), text("confirmation", 64)))
        return mapOf("schema" to 1, "kind" to "enrollment", "credential" to "enrolled", "keyPresentation" to "required", "lockRevision" to result.lockRevision.toString(), "recoveryKey" to result.recoveryKey)
      }
      if (command == "prepare") {
        val action = text("action")
        if (action !in listOf("adultOff", "dnsStop", "encryptedDisable", "encryptedClear", "feed", "exceptions")) return failure("unsupportedAction")
        val expected = when(action) { "feed" -> arrayOf("action", "domains", "version", "checksum", "generatedAt"); "exceptions" -> arrayOf("action", "domains"); else -> arrayOf("action") }
        if (!exact(*expected)) return failure("invalidInput")
        fun domains(): List<String> {
          val values = request["domains"] as? List<*> ?: fail(FriendLockError.INVALID_SCOPE)
          require(values.size <= 256 && values.all { it is String && it.toByteArray().size in 1..253 })
          return values.map { it as String }
        }
        val future = when(action) {
          "adultOff" -> prepareAdultOff()
          "dnsStop" -> prepareDnsStop()
          "encryptedDisable" -> prepareEncryptedDisable()
          "encryptedClear" -> prepareEncryptedClear()
          "feed" -> prepareFeed(domains(), text("version"), text("checksum"), text("generatedAt"))
          else -> prepareExceptions(domains())
        }
        return publicOperation(observe(future))
      }
      if (command == "rotate") {
        if (!exact("secretType", "secret", "pin", "confirmation")) return failure("invalidInput")
        val type = text("secretType"); val secret = text("secret"); val pin = text("pin", 64); val confirmation = text("confirmation", 64)
        if (type !in listOf("pin", "recovery")) return failure("invalidInput")
        val result = observe(rotate(if(type == "pin") FriendLockSecret.Pin(secret) else FriendLockSecret.Recovery(secret), pin, confirmation))
        return mapOf("schema" to 1, "kind" to "rotation", "lockRevision" to result.lockRevision.toString(), "recoveryKey" to result.recoveryKey)
      }
      if (command !in listOf("authorize", "execute", "read", "cancel") || !(if(command == "authorize") exact("operationID", "pin") else exact("operationID"))) return failure("invalidInput")
      val id = text("operationID", 32)
      if (!validHex(id, 32)) return failure("invalidInput")
      when(command) {
        "authorize" -> observe(authorize(id, text("pin", 64)))
        "cancel" -> observe(cancel(id))
        "execute" -> {
          try { observe(execute(id)) }
          catch (_: java.util.concurrent.TimeoutException) { return publicOperation(id, pending = true) }
        }
        // Observation only: never queues a retry or dispatches work.
        "read" -> Unit
      }
      return publicOperation(id)
    } catch (_: java.util.concurrent.TimeoutException) { return failure("outcomeUnknown") }
    catch (caught: Exception) {
      val cause = (caught as? java.util.concurrent.ExecutionException)?.cause ?: caught
      if (cause is FriendLockException) {
        val name = cause.reason.name.lowercase().split('_')
        return failure(if (cause.reason == FriendLockError.INVALID_PIN) "invalidPIN" else name.first() + name.drop(1).joinToString("") { it.replaceFirstChar(Char::uppercaseChar) })
      }
      // Only fixed vocabulary; Throwable messages/cause chains can contain sensitive input.
      return failure(when (cause.message) {
        "adult-cancel-not-proven" -> "cancelNotProven"
        "adult-stale-generation", "adult-stale-baseline" -> "staleConfiguration"
        "adult-unknown-operation" -> "unknownOperation"
        else -> if (cause is IllegalArgumentException) "invalidInput" else "unavailable"
      })
    } finally {
      // Charge timed-out observers until their original queue-owned work actually settles.
      // The sentinel retains no request, secret, result or recovery key.
      if (admitted) worker.submit { publicBridgeObservers.decrementAndGet(); Unit }
    }
  }
  companion object {
    @Volatile private var instance: FreedAdultAuthorizationExecutor? = null
    fun get(context: Context, nativeEnrollmentGate: () -> Boolean = { false }): FreedAdultAuthorizationExecutor = instance ?: synchronized(this) {
      instance ?: FreedAdultAuthorizationExecutor(context, nativeEnrollmentGate).also { instance = it }
    }
  }
}
