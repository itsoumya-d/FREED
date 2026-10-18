package app.freed.protection

import android.content.Context

/** Only a positive protected non-enrollment read permits the legacy in-app writers.
 * Enrollment and scoped secret execution deliberately have no public bridge yet. */
internal class FreedAdultMutationFailure(val action: FriendLockAction, val code: String) : Exception(code) {
  fun receipt(): Map<String, Any?> = mapOf("accepted" to false, "operation" to action.wire, "reason" to code,
    "adultMutationAccepted" to false, "adultMutationError" to code)
}
internal class FreedAdultMutationGate(private val record: () -> FriendLockRecord?) {
  fun requireUnenrolled(action: FriendLockAction) {
    val enrolled = try { record() != null } catch (failure: FriendLockException) {
      throw FreedAdultMutationFailure(action, when (failure.reason) {
        FriendLockError.MISSING_ENROLLED -> "adult-lock-missing-enrolled"
        FriendLockError.CORRUPT -> "adult-lock-corrupt"
        else -> "adult-lock-storage-unavailable"
      })
    } catch (_: Exception) { throw FreedAdultMutationFailure(action, "adult-lock-storage-unavailable") }
    if (enrolled) throw FreedAdultMutationFailure(action, "adult-lock-authorization-required")
  }
}
internal object FreedAdultMutationBoundary {
  fun requireUnenrolled(context: Context, action: FriendLockAction) {
    try {
      FreedAdultAuthorizationExecutor.get(context).requireSameProcess()
      check(FreedAdultProtectionState.read(context).health !in setOf("unavailable", "repair-uncertain"))
      FreedAdultAuthorizationExecutor.get(context).machine.requireLegacy(action)
    }
    catch (failure: FreedAdultMutationFailure) { throw failure }
    catch (_: Exception) { throw FreedAdultMutationFailure(action, "adult-execution-unavailable") }
  }
  fun requireMutation(context: Context, action: FriendLockAction, layer: String, before: String, desired: String, permit: FreedAdultPermit? = null) {
    val authority = FreedAdultAuthorizationExecutor.get(context)
    authority.requireSameProcess()
    check(Thread.holdsLock(authority.guard)) { "adult-transition-guard-required" }
    if (permit == null) requireUnenrolled(context, action)
    else {
      try { authority.machine.consume(permit, layer, before, desired) }
      catch (_: Exception) { throw FreedAdultMutationFailure(action, "adult-invalid-permit") }
    }
  }
  fun reason(failure: Throwable?) = (failure as? FreedAdultMutationFailure)?.code ?: "adult-mutation-write-failed"
}
