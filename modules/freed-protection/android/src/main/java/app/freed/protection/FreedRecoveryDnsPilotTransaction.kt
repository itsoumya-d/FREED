package app.freed.protection

/** Shared commit ordering for native DNS pointer/runtime transactions. Never releases the old transport. */
internal object FreedRecoveryDnsPilotTransaction {
  fun commit(publish: () -> Unit, swap: () -> Unit, observe: () -> Boolean, acknowledge: () -> Unit,
    rollback: () -> Boolean) {
    try {
      publish()
      swap()
      check(observe()) { "recovery-dns-readback-unavailable" }
      acknowledge()
    } catch (failure: Exception) {
      val restored = try { rollback() } catch (_: Exception) { false }
      check(restored) { "recovery-dns-rollback-outcome-unknown" }
      throw failure
    }
  }
}
