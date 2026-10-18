package app.freed.protection

internal object FreedAppGroupTransaction {
  /** Disk commit can change memory on failure; every rejected publication restores only owned keys. */
  fun publish(commit: () -> Boolean, readback: () -> Boolean, stillCurrent: () -> Boolean, rollback: () -> Unit): Boolean {
    val accepted = runCatching { stillCurrent() && commit() && readback() && stillCurrent() }.getOrDefault(false)
    if (!accepted) rollback()
    return accepted
  }
}
