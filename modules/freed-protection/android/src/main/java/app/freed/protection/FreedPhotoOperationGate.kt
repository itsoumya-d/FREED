package app.freed.protection

/** Keep the physical slot until ML Kit drains, even after UI publication ends. */
internal class FreedPhotoOperationGate<Value> {
  private data class Operation<Value>(val id: String, val value: Value, var publishable: Boolean = true)
  private var operation: Operation<Value>? = null
  @Synchronized fun start(id: String, value: Value): Boolean {
    if (operation != null) return false
    operation = Operation(id, value); return true
  }
  @Synchronized fun takePublication(id: String, accepting: (Value) -> Boolean = { true }): Value? {
    val current = operation ?: return null
    if (current.id != id || !current.publishable || !accepting(current.value)) return null
    current.publishable = false; return current.value
  }
  @Synchronized fun isPublishable(id: String) = operation?.let { it.id == id && it.publishable } == true
  @Synchronized fun drain(id: String) { if (operation?.id == id) operation = null }
  @Synchronized fun hasOperation(accepting: (Value) -> Boolean) = operation?.let { accepting(it.value) } == true
  @Synchronized fun invalidate(accepting: (Value) -> Boolean): Value? {
    val current = operation ?: return null
    if (!current.publishable || !accepting(current.value)) return null
    current.publishable = false; return current.value
  }
}
