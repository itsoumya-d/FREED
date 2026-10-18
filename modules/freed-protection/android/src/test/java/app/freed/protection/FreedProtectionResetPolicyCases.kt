package app.freed.protection

fun main() {
  // Disposable in-memory fixtures only. No Android context, device, or real reset API.
  fun attempt(storeResults: List<Boolean>, runtimeResult: Boolean, verified: Boolean): FreedProtectionResetResult {
    val calls = mutableListOf<String>()
    val result = FreedProtectionResetPolicy.reset(storeResults.mapIndexed { index, value ->
      { calls.add("store-$index"); value }
    }, { calls.add("runtime"); runtimeResult }, { calls.add("verify"); verified })
    check(calls == storeResults.indices.map { "store-$it" } + listOf("runtime", "verify"))
    return result
  }
  check(attempt(listOf(true, true, true), true, true).accepted)
  for (index in 0..2) {
    val stores = MutableList(3) { true }.apply { this[index] = false }
    check(!attempt(stores, true, true).accepted)
  }
  check(!attempt(listOf(true, true, true), false, true).accepted) // A stop request is not a stopped runtime.
  check(!attempt(listOf(true, true, true), true, false).accepted) // A changed store cannot be acknowledged.
  var stopped = false
  check(!FreedProtectionResetPolicy.reset(listOf({ error("fixture commit failure") }), { stopped = true; true }, { true }).accepted)
  check(stopped) // Best effort shutdown still runs after a store failure.
  check(!FreedProtectionResetPolicy.reset(listOf({ true }), { error("fixture runtime failure") }, { true }).accepted)
  check(FreedProtectionResetPolicy.interceptionEnabled(null, false)) // Legacy behavior when flag is absent.
  check(!FreedProtectionResetPolicy.interceptionEnabled(true, false))
  check(!FreedProtectionResetPolicy.interceptionEnabled(false, true))
  check(!FreedProtectionResetPolicy.shouldReactivate(false, true)) // Empty/default sync cannot enable interception.
  check(FreedProtectionResetPolicy.shouldReactivate(true, true))
  check(!FreedProtectionResetPolicy.shouldReactivate(true, false))
  check(FreedProtectionResetPolicy.currentInterventionMayOpen(0, 0, true)) // Legacy intent before any reset.
  check(!FreedProtectionResetPolicy.currentInterventionMayOpen(0, 1, false))
  check(!FreedProtectionResetPolicy.currentInterventionMayOpen(0, 1, true)) // Old pending intent after explicit activation.
  check(FreedProtectionResetPolicy.currentInterventionMayOpen(1, 1, true))
  println("Protection reset: confirmed stores, actual runtime stop, verification, partial failures, retry, legacy and empty-sync cases passed")
}
