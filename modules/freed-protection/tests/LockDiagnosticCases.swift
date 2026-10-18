import Foundation
import Darwin
@main struct LockDiagnosticCases {
  static func main() {
    let absent = FileManager.default.temporaryDirectory.appendingPathComponent("freed-absent-\(UUID().uuidString)")
    do {
      _ = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: absent, domain: "app.freed.tests.lock-diagnostic") { _ in true }
      preconditionFailure("Opening an absent directory must fail")
    } catch {
      let failure = Mirror(reflecting: error).children.first
      precondition(failure?.label == "lockOpenFailed", "Preserve which lock operation failed")
      precondition(failure?.value as? Int32 == ENOENT, "Preserve actual POSIX errno without a path")
    }
    precondition(!FileManager.default.fileExists(atPath: absent.path), "Diagnostics must not create or alter the failed container")
    print("Actual file-open lock rejection preserves stage and errno without creating or relaxing the container")
  }
}
