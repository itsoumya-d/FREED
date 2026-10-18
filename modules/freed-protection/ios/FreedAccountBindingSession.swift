import Foundation

// Covers positively identified native Module creation/replacement only. Expo's
// same-Module runtime swap/registry clear has no retirement signal here.
enum FreedAccountBindingLifecycle {
  private static let lock = NSRecursiveLock()
  private static var currentModule: UUID?
  private static var currentSession: UUID?
  static func created(module: UUID) { lock.lock(); defer { lock.unlock() }; currentModule = module; currentSession = nil }
  static func destroyed(module: UUID) {
    lock.lock(); defer { lock.unlock() }
    if currentModule == module { currentModule = nil; currentSession = nil }
  }
  static func issue(module: UUID) throws -> FreedAccountBindingSessionState {
    lock.lock(); defer { lock.unlock() }
    guard currentModule == module else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
    let nonce = UUID(); currentSession = nonce
    return FreedAccountBindingSessionState(module: module, nonce: nonce)
  }
  static func retire(_ session: FreedAccountBindingSessionState) {
    lock.lock(); defer { lock.unlock() }
    if currentModule == session.module && currentSession == session.nonce { currentSession = nil }
  }
  static func withCurrent<T>(_ session: FreedAccountBindingSessionState, _ body: () throws -> T) throws -> T {
    // Status/picker readers can already own configuration exclusion. Never wait
    // there for a lifecycle holder that may itself be acquiring configuration.
    guard lock.try() else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
    defer { lock.unlock() }
    guard currentModule == session.module, currentSession == session.nonce else { throw FreedAccountProtectionCleanup.Failure.staleBinding }
    return try body()
  }
}
final class FreedAccountBindingSessionState {
  fileprivate let module: UUID
  fileprivate let nonce: UUID
  fileprivate init(module: UUID, nonce: UUID) { self.module = module; self.nonce = nonce }
  var id: String { nonce.uuidString.lowercased() }
  var current: Bool { (try? FreedAccountBindingLifecycle.withCurrent(self) { true }) == true }
  func withCurrent<T>(_ body: () throws -> T) throws -> T { try FreedAccountBindingLifecycle.withCurrent(self, body) }
  func retire() { FreedAccountBindingLifecycle.retire(self) }
}
