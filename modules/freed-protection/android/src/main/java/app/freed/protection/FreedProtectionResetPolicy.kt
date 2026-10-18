package app.freed.protection

internal data class FreedProtectionResetResult(val accepted: Boolean, val errorCode: String? = null)

internal object FreedProtectionResetPolicy {
  fun reset(stores: List<() -> Boolean>, stopRuntime: () -> Boolean, verify: () -> Boolean): FreedProtectionResetResult {
    val saved = stores.map { runCatching(it).getOrDefault(false) }.all { it }
    val stopped = runCatching(stopRuntime).getOrDefault(false)
    val verified = runCatching(verify).getOrDefault(false)
    return when {
      !saved -> FreedProtectionResetResult(false, "protection-reset-save-failed")
      !stopped -> FreedProtectionResetResult(false, "protection-reset-runtime-stop-failed")
      !verified -> FreedProtectionResetResult(false, "protection-reset-verification-failed")
      else -> FreedProtectionResetResult(true)
    }
  }

  fun interceptionEnabled(disabled: Boolean?, resetInProgress: Boolean): Boolean = !resetInProgress && disabled != true
  fun shouldReactivate(hasEffectiveTargets: Boolean, disabled: Boolean): Boolean = hasEffectiveTargets && disabled
  fun currentInterventionMayOpen(intentEpoch: Long, currentEpoch: Long, enabled: Boolean): Boolean = enabled && intentEpoch == currentEpoch
}
