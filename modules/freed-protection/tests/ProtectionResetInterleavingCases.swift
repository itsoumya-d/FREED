import Foundation

@main struct ProtectionResetInterleavingCases {
  static func main() throws {
    let arguments = CommandLine.arguments
    if arguments.count > 1 {
      let directory = URL(fileURLWithPath: arguments[2])
      let domain = arguments[3]
      let operation = arguments[1]
      try FreedAdultProtectionLegacyGate.withWriter {
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { defaults in
        switch operation {
        case "old-callback":
          precondition(FreedProtectionConfigurationLock.permitsPublication(defaults))
          try Data().write(to: directory.appendingPathComponent("callback-entered"))
          let deadline = Date().addingTimeInterval(3)
          while !FileManager.default.fileExists(atPath: directory.appendingPathComponent("release-callback").path) {
            precondition(Date() < deadline)
            Thread.sleep(forTimeInterval: 0.01)
          }
          // Simulate all load-bearing publications while the old callback
          // holds exclusion: opaque target, lease, pending event and limit.
          for key in ["freed.familyActivitySelection", "freed.earnedUnlock.scope",
                      "freed.pendingIntervention.record", "freed.appLimit.dailyMinutes"] {
            defaults.set("old-private-publication", forKey: key)
          }
        case "reset":
          FreedProtectionConfigurationLock.invalidateForReset(defaults)
          precondition(FreedProtectionResetPolicy.persistEmptyConfiguration(in: defaults, domain: domain))
          try Data().write(to: directory.appendingPathComponent("reset-acknowledged"))
        case "late-callback", "late-grant", "passive-empty-config":
          precondition(!FreedProtectionConfigurationLock.permitsPublication(defaults))
          // A denied writer exits without recreating preferences or monitors.
        case "stale-picker":
          precondition(FreedProtectionConfigurationLock.generation(defaults) != 0)
          precondition(!FreedProtectionConfigurationLock.permitsPublication(defaults, capturedGeneration: 0))
        default: preconditionFailure("Unexpected test operation")
        }
      }
      }
      return
    }

    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("freed-reset-interleaving-\(UUID().uuidString)")
    let domain = "app.freed.tests.reset-interleaving.\(UUID().uuidString)"
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let defaults = UserDefaults(suiteName: domain)!
    defer {
      defaults.removePersistentDomain(forName: domain)
      try? FileManager.default.removeItem(at: directory)
    }
    func launch(_ operation: String) throws -> Process {
      let child = Process()
      child.executableURL = URL(fileURLWithPath: arguments[0])
      child.arguments = [operation, directory.path, domain]
      try child.run()
      return child
    }
    func waitForFile(_ name: String) {
      let deadline = Date().addingTimeInterval(3)
      while !FileManager.default.fileExists(atPath: directory.appendingPathComponent(name).path) {
        precondition(Date() < deadline)
        Thread.sleep(forTimeInterval: 0.01)
      }
    }

    // Re-entering the same lock on this thread must reuse its context/fd.
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { outer in
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { inner in
        precondition(outer === inner)
        inner.set(false, forKey: FreedProtectionConfigurationLock.resetMarkerKey)
      }
    }
    let callback = try launch("old-callback")
    waitForFile("callback-entered")
    let reset = try launch("reset")
    Thread.sleep(forTimeInterval: 0.15)
    precondition(!FileManager.default.fileExists(atPath: directory.appendingPathComponent("reset-acknowledged").path),
      "Reset acknowledgment must wait until the earlier writer has finished.")
    try Data().write(to: directory.appendingPathComponent("release-callback"))
    callback.waitUntilExit()
    reset.waitUntilExit()
    precondition(callback.terminationStatus == 0 && reset.terminationStatus == 0)
    waitForFile("reset-acknowledged")
    for operation in ["late-callback", "late-grant", "passive-empty-config", "stale-picker"] {
      let child = try launch(operation)
      child.waitUntilExit()
      precondition(child.terminationStatus == 0)
    }
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: directory, domain: domain) { state in
      precondition(FreedProtectionResetPolicy.isEmptyConfiguration(state.persistentDomain(forName: domain)))
      precondition(FreedProtectionConfigurationLock.generation(state) == 1)
      for key in ["freed.familyActivitySelection", "freed.earnedUnlock.scope",
                  "freed.pendingIntervention.record", "freed.appLimit.dailyMinutes"] {
        precondition(state.object(forKey: key) == nil)
      }
    }
    print("Darwin multi-process reset exclusion, nested-lock re-entry, earlier/late publication, and stale picker generation cases passed")
  }
}
