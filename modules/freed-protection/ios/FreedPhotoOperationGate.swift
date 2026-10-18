import Foundation

/// Publication cancellation and physical draining are separate. All callers use
/// this lock; a cancelled/timed-out SDK operation still occupies the single slot.
final class FreedPhotoOperationGate<Value> {
  private let lock = NSLock()
  private var operation: (id: String, value: Value, publishable: Bool)?
  func start(_ id: String, value: Value) -> Bool {
    lock.lock(); defer { lock.unlock() }
    guard operation == nil else { return false }
    operation = (id, value, true); return true
  }
  func takePublication(_ id: String, accepting: (Value) -> Bool = { _ in true }) -> Value? {
    lock.lock(); defer { lock.unlock() }
    guard let current = operation, current.id == id, current.publishable, accepting(current.value) else { return nil }
    operation?.publishable = false; return current.value
  }
  func isPublishable(_ id: String) -> Bool {
    lock.lock(); defer { lock.unlock() }
    return operation?.id == id && operation?.publishable == true
  }
  func drain(_ id: String) {
    lock.lock(); defer { lock.unlock() }
    if operation?.id == id { operation = nil }
  }
  func invalidate(accepting: (Value) -> Bool) -> Value? {
    lock.lock(); defer { lock.unlock() }
    guard let current = operation, current.publishable, accepting(current.value) else { return nil }
    operation?.publishable = false; return current.value
  }
}
