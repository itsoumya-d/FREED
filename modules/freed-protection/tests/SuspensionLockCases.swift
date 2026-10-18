import Foundation
import Darwin

@main struct SuspensionLockCases {
  enum TestFailure: Error { case expected }
  static func require(_ condition: @autoclosure () throws -> Bool, _ message: String) {
    do { guard try condition() else { fputs("FAIL: \(message)\n", stderr); exit(1) } }
    catch { fputs("FAIL: \(message): \(error)\n", stderr); exit(1) }
  }
  static func canAcquire(_ directory: URL) -> Bool {
    let descriptor = open(directory.appendingPathComponent("freed-protection-configuration.lock").path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
    require(descriptor >= 0, "test lock opens")
    defer { close(descriptor) }
    if flock(descriptor, LOCK_EX | LOCK_NB) == 0 { flock(descriptor, LOCK_UN); return true }
    require(errno == EWOULDBLOCK || errno == EAGAIN, "expected contention errno")
    return false
  }
  static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("freed-suspension-\(UUID().uuidString)")
    let domain = "app.freed.tests.suspension.\(UUID().uuidString)"
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { UserDefaults(suiteName: domain)?.removePersistentDomain(forName: domain); try? FileManager.default.removeItem(at: directory) }
    let lockURL = directory.appendingPathComponent("freed-protection-configuration.lock")
    let stateURL = directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
    var begins = 0, ends = 0, publications = 0
    var active: FreedProtectionConfigurationLock.ExecutionLease?
    var deny = true, expireOnBegin = false
    var leaseDeadline: TimeInterval?
    FreedProtectionConfigurationLock.installAppExecutionProvider {
      begins += 1
      if deny { throw FreedProtectionConfigurationLock.AccessError.executionUnavailable }
      let lease = FreedProtectionConfigurationLock.ExecutionLease(deadline: leaseDeadline ?? ProcessInfo.processInfo.systemUptime + 10)
      active = lease
      lease.onFinish {
        require(!FileManager.default.fileExists(atPath: lockURL.path) || canAcquire(directory), "owner releases flock before ending assertion")
        ends += 1
      }
      if expireOnBegin { lease.expire() }
      return lease
    }
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { _ in
        require(false, "denied assertion must prevent transaction body")
      }
      require(false, "denial must throw")
    } catch FreedProtectionConfigurationLock.AccessError.executionUnavailable {}
    require(!FileManager.default.fileExists(atPath: lockURL.path) && !FileManager.default.fileExists(atPath: stateURL.path), "denial occurs before any lock or state file")
    require(ends == 0, "denied task has no valid assertion to end")
    deny = false; expireOnBegin = true
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { _ in require(false, "expired admission prevents body") }
      require(false, "expired admission throws")
    } catch FreedProtectionConfigurationLock.AccessError.executionExpired {}
    require(!FileManager.default.fileExists(atPath: stateURL.path) && ends == 1, "immediate expiration creates no authority, ends once")
    expireOnBegin = false
    let value = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain, afterSuccessfulPersistence: { (value: Int) in
      require(value == 42 && !canAcquire(directory), "publication remains under lock")
      require(ends == 1, "assertion remains active through publication")
      publications += 1
    }) { defaults in
      require(begins == 3 && !canAcquire(directory), "admission precedes actual exclusive transaction")
      defaults.set("owner-A", forKey: "freed.appGroups.owner")
      defaults.set(17, forKey: "freed.protectionConfiguration.generation")
      defaults.set(600, forKey: "freed.earnedUnlock.spent")
      defaults.set("scope-A", forKey: "freed.earnedUnlock.scope")
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { nested in
        require(defaults === nested && begins == 3, "nested transaction shares assertion and snapshot")
      }
      return 42
    }
    require(value == 42 && ends == 2 && publications == 1, "successful transaction ends exactly once")
    active?.finish(); require(ends == 2, "duplicate finish cannot end another assertion")
    let before = try Data(contentsOf: stateURL)
    var nativeOwner = "owner-A"
    let completedAfterExpiry: Int
    do {
      completedAfterExpiry = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain, afterSuccessfulPersistence: { (_: Int) in publications += 1 }) { defaults in
        defaults.set("owner-B", forKey: "freed.appGroups.owner")
        defaults.set(999, forKey: "freed.earnedUnlock.spent")
        require(FreedProtectionConfigurationLock.persist(defaults), "explicit durability before simulated native call")
        nativeOwner = "owner-B" // Simulated synchronous native publication before returning.
        let expired = active!
        let expirationHandled = DispatchSemaphore(value: 0)
        DispatchQueue.global().async { expired.expire(); expirationHandled.signal() }
        require(expirationHandled.wait(timeout: .now() + 2) == .success, "expiration callback completes without waiting for flock")
        require(ends == 2 && !canAcquire(directory), "expiration cannot release another thread's flock or end its assertion")
        try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { nested in
          require(defaults === nested && nested.string(forKey: "freed.appGroups.owner") == nativeOwner, "completion-phase nested readback remains valid after expiry")
          require(FreedProtectionConfigurationLock.persist(nested), "completion-phase persist must not invent file-only rollback")
        }
        return 7
      }
    } catch { require(false, "admitted native success must settle after expiry: \(error)"); return }
    let settled = try Data(contentsOf: stateURL)
    let envelope = try PropertyListSerialization.propertyList(from: settled, format: nil) as! [String: Any]
    let values = envelope["values"] as! [String: Any]
    require(completedAfterExpiry == 7 && settled != before && values["freed.appGroups.owner"] as? String == nativeOwner && values["freed.earnedUnlock.spent"] as? Int == 999, "successful native publication after expiry retains matching durable authority")
    require(values["freed.protectionConfiguration.generation"] as? Int == 17 && values["freed.earnedUnlock.scope"] as? String == "scope-A", "completion retains generation and scope")
    require(ends == 3 && publications == 2, "admitted body settles and publishes before ending assertion once")
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { defaults in
        defaults.set(9999, forKey: "freed.earnedUnlock.spent")
        require(FreedProtectionConfigurationLock.persist(defaults), "durability before body failure")
        throw TestFailure.expected
      }
    } catch TestFailure.expected {}
    require(try Data(contentsOf: stateURL) == settled && ends == 4, "ordinary error restores authority then ends")
    leaseDeadline = ProcessInfo.processInfo.systemUptime - 1
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { _ in require(false, "bounded deadline stops new body") }
      require(false, "deadline must throw")
    } catch FreedProtectionConfigurationLock.AccessError.executionExpired {}
    require(ends == 5, "bounded deadline finishes task once")
    leaseDeadline = nil
    // Contention uses a separate open-file description. Expiration must end only
    // the waiting transaction, with the original holder retaining its lock.
    let holder = open(lockURL.path, O_RDWR); require(holder >= 0 && flock(holder, LOCK_EX | LOCK_NB) == 0, "fixture acquires competing lock")
    defer { flock(holder, LOCK_UN); close(holder) }
    var waitingEnds = 0
    FreedProtectionConfigurationLock.installAppExecutionProvider {
      let lease = FreedProtectionConfigurationLock.ExecutionLease()
      lease.onFinish { waitingEnds += 1; require(!canAcquire(directory), "waiter must never unlock holder") }
      DispatchQueue.global().asyncAfter(deadline: .now() + 0.05) { lease.expire() }
      return lease
    }
    let started = ProcessInfo.processInfo.systemUptime
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { _ in require(false, "expired waiter never enters") }
      require(false, "wait expiration must throw")
    } catch FreedProtectionConfigurationLock.AccessError.executionExpired {}
    require(waitingEnds == 1 && ProcessInfo.processInfo.systemUptime - started < 1, "expiration stops contention wait promptly")
    require(try Data(contentsOf: stateURL) == settled, "contention expiry leaves all authority unchanged")
    let diagnostics = FreedProtectionConfigurationLock.diagnostics(FreedProtectionConfigurationLock.AccessError.executionUnavailable)
    require(diagnostics["stage"] as? String == "execution-assertion" && diagnostics["reason"] as? String == "configuration-execution-unavailable", "retry failure exposes native stage and reason")
    print("PASS: actual flock admission, denial, immediate expiration, nested reuse, publication exclusion, owner-only release, post-expiry native/file consistency, byte-exact failure rollback, bounded admission deadline, contention cancellation and diagnostics")
  }
}
