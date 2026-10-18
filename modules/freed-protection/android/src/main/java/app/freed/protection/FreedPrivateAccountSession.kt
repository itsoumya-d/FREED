package app.freed.protection

import android.content.Context
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.sharedobjects.SharedObject
import org.json.JSONArray
import java.util.UUID
import java.util.concurrent.atomic.AtomicLong

/** Lifetime is native-issued. Neither this object nor its nonce authenticates a Firebase UID. */
class FreedAccountBindingSession internal constructor(appContext: AppContext, internal val lease: FreedPrivateModuleLease) : SharedObject(appContext) {
  internal val identity = UUID.randomUUID().toString()
  internal var retired = false
  internal var sequence = 0L
  internal var transition: String? = null
  override fun sharedObjectDidRelease() = synchronized(FreedNativeUnlockStore.lock) { retired = true; Unit }
}
internal class FreedPrivateModuleLease(val registered: () -> Boolean) {
  val order = next.incrementAndGet()
  var admitted = false
  var retired = false
  companion object { private val next = AtomicLong() }
}

/** All entry/final checks use the existing grant exclusion. No DNS, Core or main wait under it. */
internal object FreedPrivateAccountAdmission {
  private data class Ticket(val id: String, val session: FreedAccountBindingSession, val raw: String,
    val transition: String, val sequence: Long, val revision: Long, var receipt: Map<String, Any?>? = null)
  private data class Binding(val session: FreedAccountBindingSession, val scope: String, val handle: String,
    val revision: Long, val context: Context)
  private var current: FreedPrivateModuleLease? = null
  private var admittedOrder = 0L
  private val processOwners = linkedMapOf<String, Pair<FreedPrivateModuleLease, (String) -> Boolean>>()
  private val processHandlers = java.util.IdentityHashMap<FreedPrivateModuleLease, (String) -> Boolean>()
  private var binding: Binding? = null
  private var latestSession: FreedAccountBindingSession? = null
  private val tickets = linkedMapOf<String, Ticket>()
  fun create(lease: FreedPrivateModuleLease): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    if (lease.retired) return@synchronized false
    if (!lease.registered()) { lease.retired = true; return@synchronized false }
    if (lease.admitted) return@synchronized current === lease
    if (admittedOrder >= lease.order) { lease.retired = true; return@synchronized false }
    latestSession?.retired = true; latestSession = null
    current?.retired = true
    current = lease; admittedOrder = lease.order; lease.admitted = true; binding = null; tickets.clear(); true
  }
  fun destroy(lease: FreedPrivateModuleLease) = synchronized(FreedNativeUnlockStore.lock) {
    lease.retired = true
    if (current === lease) { current = null; binding = null; tickets.clear() }
  }
  fun registerProcessOwner(lease: FreedPrivateModuleLease, cancel: (String) -> Boolean) = synchronized(FreedNativeUnlockStore.lock) {
    if (live(lease)) processHandlers[lease] = cancel
  }
  /** Runs exact owning controller even when execution comes from a replacement Module. */
  fun cancelOriginalProcess(handle: String): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val owner = processOwners[handle] ?: return@synchronized true // Cold process has no retained process resources.
    val result = owner.second(handle)
    if (result) processOwners.remove(handle)
    result
  }
  fun processDestroyed(lease: FreedPrivateModuleLease) = synchronized(FreedNativeUnlockStore.lock) {
    processHandlers.remove(lease); processOwners.entries.removeAll { it.value.first === lease }
  }
  fun live(lease: FreedPrivateModuleLease) = lease.admitted && !lease.retired && current === lease && lease.registered()
  fun construct(appContext: AppContext, lease: FreedPrivateModuleLease): FreedAccountBindingSession = synchronized(FreedNativeUnlockStore.lock) {
    check(live(lease) && runCatching { appContext.runtime.jsiContext }.isSuccess) { "private-runtime-unavailable" }
    latestSession?.retired = true
    FreedAccountBindingSession(appContext, lease).also { latestSession = it }
  }
  private fun sessionCurrent(session: FreedAccountBindingSession, lease: FreedPrivateModuleLease) =
    session.lease === lease && latestSession === session && !session.retired && live(lease)
  fun valid(scope: String, lease: FreedPrivateModuleLease? = null): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val b = binding ?: return@synchronized false
    b.scope == scope && (lease == null || b.session.lease === lease) && sessionCurrent(b.session, b.session.lease) &&
      runCatching { FreedRetainedAdultProtection.admissionRevision(b.context) == b.revision }.getOrDefault(false)
  }
  fun revokeCleanup(handle: String) = synchronized(FreedNativeUnlockStore.lock) {
    binding?.takeIf { it.handle == handle }?.let { it.session.retired = true; binding = null }
  }
  fun handle(scope: String): String? = synchronized(FreedNativeUnlockStore.lock) { binding?.takeIf { valid(scope) }?.handle }
  fun suspend(lease: FreedPrivateModuleLease, scope: String): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    val b = binding?.takeIf { valid(scope, lease) } ?: return@synchronized false
    b.session.retired = true; binding = null; FreedAppGroupStore.suspendPrivateOperations(); true
  }
  fun prepare(context: Context, lease: FreedPrivateModuleLease, session: FreedAccountBindingSession, raw: String,
    transition: String, sequence: Long): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    fun reject(reason: String) = mapOf<String, Any?>("version" to 2, "accepted" to false, "reason" to reason)
    if (!sessionCurrent(session, lease) || !runCatching { UUID.fromString(transition).toString() == transition }.getOrDefault(false)) return@synchronized reject("private-session-stale")
    val parts = runCatching { JSONArray(raw) }.getOrNull()
    if (parts == null || parts.length() != 2 || parts.opt(0) !is String || parts.getString(0).isBlank() ||
      parts.getString(0).length > 256 || FreedAppGroupPolicy.integer(parts.opt(1)) == null || raw.length > 1024 || sequence < 1)
      return@synchronized reject("private-binding-request-invalid")
    tickets.values.firstOrNull { it.session === session && it.transition == transition && it.sequence == sequence && it.raw == raw }?.let {
      if (sequence == session.sequence) return@synchronized mapOf("version" to 2, "accepted" to true, "ticket" to it.id)
    }
    if (sequence <= session.sequence || session.transition == transition) return@synchronized reject("private-auth-transition-stale")
    if (!FreedRetainedAdultProtection.reconcilePrivateFence(context)) return@synchronized reject("private-cleanup-pending")
    val revision = runCatching { FreedRetainedAdultProtection.admissionRevision(context) }.getOrNull() ?: return@synchronized reject("private-admission-storage-unavailable")
    // Early invalidate before any later callback/commit; installed policy/leases stay intact.
    binding = null; session.sequence = sequence; session.transition = transition; tickets.clear()
    val ticket = Ticket(UUID.randomUUID().toString(), session, raw, transition, sequence, revision)
    tickets[ticket.id] = ticket
    mapOf("version" to 2, "accepted" to true, "ticket" to ticket.id, "admissionRevision" to revision)
  }
  fun commit(context: Context, lease: FreedPrivateModuleLease, session: FreedAccountBindingSession, ticketID: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    fun reject() = mapOf<String, Any?>("version" to 2, "accepted" to false, "reason" to "private-binding-ticket-stale")
    val ticket = tickets[ticketID] ?: return@synchronized reject()
    if (ticket.session !== session || !sessionCurrent(session, lease) || ticket.sequence != session.sequence || ticket.transition != session.transition ||
      runCatching { FreedRetainedAdultProtection.admissionRevision(context) != ticket.revision }.getOrDefault(true)) return@synchronized reject()
    ticket.receipt?.let { return@synchronized if (valid(it["actionScope"] as String, lease)) it else reject() }
    val handle = UUID.randomUUID().toString()
    val raw = JSONArray(ticket.raw)
    val scope = JSONArray().put(raw.getString(0)).put(raw.getLong(1)).put(handle).toString()
    if (processOwners.size >= 128) return@synchronized reject()
    if (!FreedAppGroupStore.bindAcknowledgedScope(context, scope)) return@synchronized reject()
    // Discard old resolved controller routes before installing a new one; unresolved routes are bounded.
    processHandlers[lease]?.let { cancel -> processOwners[handle] = lease to { _: String -> cancel(scope) } }
    binding = Binding(session, scope, handle, ticket.revision, context.applicationContext)
    val snapshot = FreedAppGroupStore.snapshot(context, scope)
    val receipt = mapOf("version" to 2, "accepted" to true, "bindingHandle" to handle, "actionScope" to scope,
      "generation" to snapshot["configurationGeneration"], "scopeEpoch" to snapshot["scopeEpoch"], "admissionRevision" to ticket.revision)
    ticket.receipt = receipt; receipt
  }
}
