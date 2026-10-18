struct UIBackgroundTaskIdentifier: Equatable {
  let rawValue: Int
  static let invalid = Self(rawValue: -1)
}
final class UIApplication {
  static let shared = UIApplication()
  var deny = false
  var expireImmediately = false
  var expiration: (() -> Void)?
  var begins = 0
  var ended: [UIBackgroundTaskIdentifier] = []
  var beforeEnd: (() -> Void)?
  func beginBackgroundTask(withName name: String?, expirationHandler: (() -> Void)?) -> UIBackgroundTaskIdentifier {
    begins += 1
    precondition(name == "FREED protection transaction")
    expiration = expirationHandler
    if expireImmediately { expirationHandler?() }
    return deny ? .invalid : UIBackgroundTaskIdentifier(rawValue: begins)
  }
  func endBackgroundTask(_ identifier: UIBackgroundTaskIdentifier) {
    beforeEnd?()
    precondition(identifier != .invalid && !ended.contains(identifier))
    ended.append(identifier)
  }
}
@main struct AppExecutionAdapterCases {
  static func main() throws {
    let app = UIApplication.shared
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent("freed-app-execution-\(UUID().uuidString)")
    let domain = "app.freed.test.execution-adapter.\(UUID().uuidString)"
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder); UserDefaults(suiteName: domain)?.removePersistentDomain(forName: domain) }
    FreedProtectionAppExecution.install()
    app.deny = true
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: folder, domain: domain) { _ -> Void in preconditionFailure("denied UIKit assertion entered body") }
      preconditionFailure("denied UIKit assertion not surfaced")
    } catch FreedProtectionConfigurationLock.AccessError.executionUnavailable {}
    precondition(app.ended.isEmpty && !FileManager.default.fileExists(atPath: folder.appendingPathComponent("freed-protection-configuration.lock").path))
    app.deny = false; app.expireImmediately = true
    do {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: folder, domain: domain) { _ -> Void in preconditionFailure("immediately expired UIKit assertion entered body") }
      preconditionFailure("immediate expiry not surfaced")
    } catch FreedProtectionConfigurationLock.AccessError.executionExpired {}
    precondition(app.ended == [UIBackgroundTaskIdentifier(rawValue: 2)])
    app.expireImmediately = false
    app.beforeEnd = {
      let descriptor = open(folder.appendingPathComponent("freed-protection-configuration.lock").path, O_RDWR)
      precondition(descriptor >= 0 && flock(descriptor, LOCK_EX | LOCK_NB) == 0, "UIKit end called before flock release")
      flock(descriptor, LOCK_UN); close(descriptor)
    }
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: folder, domain: domain) { _ in
      app.expiration?()
      precondition(app.ended.count == 1, "expiration handler ended assertion while transaction still runs")
    }
    precondition(app.ended == [UIBackgroundTaskIdentifier(rawValue: 2), UIBackgroundTaskIdentifier(rawValue: 3)])
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: folder, domain: domain) { _ in }
    precondition(app.begins == 4 && app.ended.count == 3)
    let finished = DispatchSemaphore(value: 0)
    DispatchQueue.global().async {
      do { try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: folder, domain: domain) { _ in } }
      catch { preconditionFailure("background-thread adapter failed: \(error)") }
      finished.signal()
    }
    precondition(finished.wait(timeout: .now() + 2) == .success, "adapter must not require a main-thread hop while caller waits")
    precondition(app.begins == 5 && app.ended.count == 4)
    print("PASS: actual app adapter with injected UIKit boundary: invalid task, immediate expiration, owning release, valid task balanced once, background-thread admission/end")
  }
}
