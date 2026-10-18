import Foundation

private func check(_ condition: Bool, _ message: String) {
  if !condition { fatalError(message) }
}
private func canonical(_ value: Any) throws -> Data {
  try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed])
}
private final class FixtureClock {
  var wall = 1_792_100_000_000.0, uptime = 100_000.0
  var nonceSequence: UInt64 = 0
  func nextNonce() -> String { nonceSequence += 1; return String(format: "%064llx", nonceSequence) }
  func advance(_ milliseconds: Double) { wall += milliseconds; uptime += milliseconds }
}
// Test utilities inspect the actual committed record. They contain no acceptance policy.
private final class ObservationFixture {
  let container: URL, package: URL, clock: FixtureClock
  let service: FreedSafariRecoveryObservation
  let expected: FreedSafariRecoveryObservation.Package
  let handler = SafariWebExtensionHandler()
  var issuedNonces = Set<String>()
  static let beginMessage: [String: Any] = ["version": 1, "type": "begin-safari-recovery-observation"]
  init(_ root: URL, _ package: URL, _ scenario: String, startHost: Bool = true) throws {
    container = root.appendingPathComponent(scenario); self.package = package
    try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
    let clock = FixtureClock(); self.clock = clock
    service = FreedSafariRecoveryObservation(container: container, domain: "freed96-fixture", packageDirectory: package,
      clock: { .init(wall: clock.wall, uptime: clock.uptime) }, random: { clock.nextNonce() })
    expected = try service.readExpectedPackage()
    if startHost { try service.startHostSession() }
  }
  func record() throws -> [String: Any] {
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: "freed96-fixture") { defaults in
      guard let data = defaults.data(forKey: FreedSafariRecoveryObservation.key),
        let value = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { fatalError("actual observation record missing") }
      return value
    }
  }
  func receiptBytes() throws -> Data { try canonical(record()["lastReceipt"]!) }
  func begin() throws -> [String: Any] {
    let response = handler.processObservationMessage(Self.beginMessage, observation: service)
    check(response["issued"] as? Bool == true, "fresh native begin acknowledged")
    guard let nonce = response["nonce"] as? String else { fatalError("begin response nonce missing") }
    check(nonce.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil, "native nonce schema")
    check(issuedNonces.insert(nonce).inserted, "distinct begin-response-derived nonce")
    let pending = try record()["pending"] as? [String: Any]
    check(pending?["nonce"] as? String == nonce, "acknowledged begin has actual pending nonce")
    return ["version": 1, "type": "commit-safari-recovery-observation", "nonce": nonce,
      "bundleArtifactDigest": expected.digest, "scopeDigest": expected.scopeDigest,
      "staticRules": expected.variant == "short-form-v1" ? "not-configured" : "expected-enabled",
      "dynamicRules": "zero", "sessionRules": "zero", "grants": "complete",
      "requiredScopeCount": expected.requiredCount, "coveredScopeCount": expected.requiredCount, "diagnostic": "none"]
  }
  func commit(_ request: [String: Any]) -> [String: Any] { handler.processObservationMessage(request, observation: service) }
  func reject(_ response: [String: Any], reason: String, label: String) {
    check(response["persisted"] as? Bool == false, label + " persisted=false")
    check(response["reason"] as? String == reason, label + " exact reason=" + reason)
    check(response["receipt"] is NSNull, label + " no new response receipt")
  }
  @discardableResult func fresh() throws -> [String: Any] {
    let request = try begin(), response = commit(request)
    check(response["persisted"] as? Bool == true && response["reason"] as? String == "none", "fresh receipt durable")
    let read = try service.read(expected: expected).payload
    check(read["freshness"] as? String == "fresh" && read["reason"] as? String == "none", "fresh current host receipt before guard")
    return request
  }
}

@main struct SafariObservationCases {
  static func main() throws {
    let root = URL(fileURLWithPath: CommandLine.arguments[1]), package = URL(fileURLWithPath: CommandLine.arguments[2])
    let selected = CommandLine.arguments.count > 3 ? CommandLine.arguments[3] : "all"
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    var results: [[String: Any]] = []
    func scenario(_ name: String, _ body: () throws -> [String: Any]) throws {
      if selected != "all" && selected != name { return }
      var result = try body(); result["scenario"] = name; result["result"] = "PASS"; results.append(result)
      print("Task96A fixture \(name): PASS")
    }
    try scenario("baseline") {
      let f = try ObservationFixture(root, package, "baseline", startHost: false)
      check(f.handler.processObservationMessage(ObservationFixture.beginMessage, observation: f.service)["issued"] as? Bool == false, "no host session must fail")
      try f.service.startHostSession()
      let lockRefused = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: f.container, domain: "freed96-fixture") { _ -> Bool in
        do { _ = try f.service.readExpectedPackage(); return false } catch { return true }
      }
      check(lockRefused, "no bundle IO under configuration exclusion")
      let request = try f.begin()
      let restarted = FreedSafariRecoveryObservation(container: f.container, domain: "freed96-fixture", packageDirectory: package, clock: { .init(wall: f.clock.wall, uptime: f.clock.uptime) })
      let first = f.handler.processObservationMessage(request, observation: restarted)
      check(first["persisted"] as? Bool == true, "persist before response")
      let receipt = try canonical(first["receipt"]!)
      f.clock.advance(1000)
      check(try canonical(f.commit(request)["receipt"]!) == receipt, "exact retry immutable")
      let read = try f.service.read(expected: f.expected).payload
      check(read["freshness"] as? String == "fresh", "fresh historical observation")
      try canonical(read).write(to: root.deletingLastPathComponent().appendingPathComponent("public-read.json"))
      return ["issuedNonces": f.issuedNonces.sorted(), "exactReplayReceiptUnchanged": true]
    }
    try scenario("changed-replay") {
      let f = try ObservationFixture(root, package, "changed-replay")
      let request = try f.fresh(), original = try f.receiptBytes()
      var changed = request
      // ValidFacts permits nonzero mutable rules. All counts/grants remain valid.
      changed["dynamicRules"] = "nonzero"
      f.clock.advance(1000)
      let response = f.commit(changed)
      f.reject(response, reason: "malformed", label: "changed-replay canonical digest guard")
      check(try f.receiptBytes() == original, "changed-replay original receipt and timestamps unchanged")
      return ["changedFact": "dynamicRules:zero->nonzero", "reason": response["reason"]!, "originalReceiptUnchanged": true, "nonce": request["nonce"]!]
    }
    try scenario("malformed") {
      let f = try ObservationFixture(root, package, "malformed")
      var contradictory = try f.begin()
      contradictory["coveredScopeCount"] = 0 // Preserve old complete/zero malformed-input assertion.
      f.reject(f.commit(contradictory), reason: "malformed", label: "complete/zero malformed facts")
      var rawSite = try f.begin()
      rawSite["rawSite"] = "private.example" // Preserve separate old raw-site rejection.
      f.reject(f.commit(rawSite), reason: "malformed", label: "extra raw site rejected")
      rawSite.removeValue(forKey: "rawSite")
      f.reject(f.commit(rawSite), reason: "superseded", label: "failed message cleared pending")
      return ["issuedNonces": f.issuedNonces.sorted(), "malformedSeparateFromReplay": true]
    }
    try scenario("native-epoch") {
      let f = try ObservationFixture(root, package, "native-epoch")
      let request = try f.begin(), before = try f.record(), originalReceipt = try f.receiptBytes()
      let beforePending = before["pending"] as! [String: Any]
      check(beforePending["nonce"] as? String == request["nonce"] as? String, "native-epoch pending acknowledged immediately before fence")
      let beforeEpoch = beforePending["nativeEpoch"] as! Int
      let afterEpoch = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: f.container, domain: "freed96-fixture") { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
      let after = try f.record(), afterPending = after["pending"] as! [String: Any]
      check(afterEpoch == beforeEpoch + 1, "native-epoch actual epoch changed")
      check(try canonical(afterPending) == canonical(beforePending), "native-epoch pending remains intact across epoch-only change")
      check(after["revision"] as? Int == before["revision"] as? Int, "native-epoch no intervening failed-message revision")
      let response = f.commit(request)
      f.reject(response, reason: "stale-config", label: "native-epoch current pending guard")
      check(try f.receiptBytes() == originalReceipt, "native-epoch zero new durable observation")
      _ = try f.fresh()
      return ["reason": response["reason"]!, "beforeEpoch": beforeEpoch, "afterEpoch": afterEpoch, "zeroNewReceipt": true, "nonce": request["nonce"]!]
    }
    try scenario("superseded") {
      let f = try ObservationFixture(root, package, "superseded")
      let first = try f.begin(), second = try f.begin()
      check(first["nonce"] as? String != second["nonce"] as? String, "superseding begins have distinct native response nonces")
      f.reject(f.commit(first), reason: "superseded", label: "actual superseded nonce")
      _ = try f.fresh()
      return ["firstNonce": first["nonce"]!, "secondNonce": second["nonce"]!, "distinct": true]
    }
    try scenario("expiry") {
      let f = try ObservationFixture(root, package, "expiry")
      let request = try f.begin(); f.clock.advance(30001)
      check(try f.service.read(expected: f.expected).payload["reason"] as? String == "expired", "pending read expiry")
      f.reject(f.commit(request), reason: "expired", label: "nonce expiry")
      _ = try f.fresh(); f.clock.advance(300000)
      check(try f.service.read(expected: f.expected).payload["reason"] as? String == "expired", "receipt TTL")
      return ["nonceExpiry": true, "receiptExpiry": true]
    }
    try scenario("settings-clock-cold") {
      let f = try ObservationFixture(root, package, "settings-clock-cold")
      _ = try f.fresh(); let beforeRead = try f.service.read(expected: f.expected)
      try f.service.invalidateForSettings()
      check(try f.service.read(expected: f.expected).payload["freshness"] as? String == "historical", "settings invalidation")
      check(try f.service.read(expected: f.expected, enabled: ["value": true, "checkedAt": FreedSafariRecoveryObservation.iso(f.clock.wall), "reason": "observed"], captured: beforeRead.binding).payload["reason"] as? String == "stale-config", "late enabled callback scope")
      _ = try f.fresh()
      check(try f.service.read(expected: f.expected, enabled: ["value": false, "checkedAt": FreedSafariRecoveryObservation.iso(f.clock.wall), "reason": "observed"]).payload["reason"] as? String == "native-disabled", "enabled false defeats check")
      let clockRequest = try f.begin(); f.clock.wall += 3000
      f.reject(f.commit(clockRequest), reason: "clock", label: "wall/uptime mismatch")
      f.clock.uptime += 3000; _ = try f.fresh()
      let cold = FreedSafariRecoveryObservation(container: f.container, domain: "freed96-fixture", packageDirectory: package, clock: { .init(wall: f.clock.wall, uptime: f.clock.uptime) })
      try cold.startHostSession()
      check(try cold.read(expected: f.expected).payload["freshness"] as? String == "historical", "cold read cannot restore acknowledgement")
      return ["settingsInvalidated": true, "coldHistorical": true, "issuedNonces": f.issuedNonces.sorted()]
    }
    try scenario("cleanup") {
      let f = try ObservationFixture(root, package, "cleanup")
      _ = try f.fresh(); let observationBefore = try f.record(), originalReceipt = try f.receiptBytes()
      let retained = FreedRetainedAdultProtection.Policy(continuous: true, encryptedDNS: true, safari: true, riskEnabled: false)
      let binding = UUID().uuidString
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: f.container, domain: "freed96-fixture") { defaults in
        let generation = FreedProtectionConfigurationLock.generation(defaults), owner = String(repeating: "b", count: 64)
        defaults.set(try canonical(["ownerDigest": owner, "generation": generation, "scopeEpoch": 0]), forKey: "freed.appGroups.v1")
        defaults.set("private fixture", forKey: "freed.earnedUnlock.fixture")
        try FreedRetainedAdultProtection.stage(retained, defaults)
        var journal = FreedAccountProtectionCleanup.Journal(); journal.currentBindingID = binding; try FreedAccountProtectionCleanup.stage(journal, defaults)
      }
      let before = try f.service.read(expected: f.expected).payload
      check(before["freshness"] as? String == "fresh" && before["reason"] as? String == "none", "cleanup starts from fresh current host receipt")
      let counters = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: f.container, domain: "freed96-fixture") { defaults -> [String: Int] in
        let generation = FreedProtectionConfigurationLock.generation(defaults), epoch = try FreedProtectionConfigurationLock.adultMutationEpoch(defaults), owner = String(repeating: "b", count: 64)
        let prepared = try FreedAccountProtectionCleanup.prepare(original: .init(ownerDigest: owner, generation: generation, scopeEpoch: 0), bindingID: binding, resources: .init(), defaults: defaults)
        _ = try FreedAccountProtectionCleanup.arm(prepared.operationID, defaults)
        _ = try FreedAccountProtectionCleanup.fence(prepared.operationID, defaults)
        _ = try FreedAccountProtectionCleanup.erase(prepared.operationID, defaults)
        check(defaults.data(forKey: FreedSafariRecoveryObservation.key) != nil, "device observation retained across actual private erasure")
        check(try FreedRetainedAdultProtection.read(defaults) == retained, "actual cleanup retains adult policy")
        check(FreedRetainedAdultProtection.privateNamespacesAbsent(defaults), "actual private projection removed")
        check(defaults.bool(forKey: FreedProtectionConfigurationLock.resetMarkerKey), "actual cleanup reset fence installed")
        return ["generationBefore": generation, "generationAfter": FreedProtectionConfigurationLock.generation(defaults), "epochBefore": epoch, "epochAfter": try FreedProtectionConfigurationLock.adultMutationEpoch(defaults)]
      }
      let after = try f.service.read(expected: f.expected).payload
      check(after["freshness"] as? String == "historical" && after["reason"] as? String == "reset", "cleanup fresh receipt becomes fenced historical reset")
      check(counters["generationAfter"]! == counters["generationBefore"]! + 1 && counters["epochAfter"]! == counters["epochBefore"]! + 1, "cleanup generation and native epoch both fenced")
      check(try f.receiptBytes() == originalReceipt && canonical(f.record()) == canonical(observationBefore), "cleanup retains exact device observation and receipt")
      return ["beforeFreshness": before["freshness"]!, "beforeReason": before["reason"]!, "afterFreshness": after["freshness"]!, "afterReason": after["reason"]!, "counters": counters, "retainedObservationUnchanged": true]
    }
    try scenario("reset-storage") {
      let f = try ObservationFixture(root, package, "reset-storage")
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: f.container, domain: "freed96-fixture") { FreedProtectionConfigurationLock.invalidateForReset($0) }
      let reset = f.handler.processObservationMessage(ObservationFixture.beginMessage, observation: f.service)
      check(reset["issued"] as? Bool == false && reset["reason"] as? String == "reset", "reset blocks observation only")
      try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: f.container, domain: "freed96-fixture") { $0.set(Data("{}".utf8), forKey: FreedSafariRecoveryObservation.key) }
      check(f.handler.processObservationMessage(ObservationFixture.beginMessage, observation: f.service)["issued"] as? Bool == false, "corrupt observation store refuses")
      let unavailable = FreedSafariRecoveryObservation(container: f.container.appendingPathComponent("freed-enforcement-state.v1.plist/no-directory"), domain: "freed96-fixture", packageDirectory: package)
      check(f.handler.processObservationMessage(ObservationFixture.beginMessage, observation: unavailable)["reason"] as? String == "storage-unavailable", "actual lock-file storage failure")
      return ["resetRejected": true, "corruptRejected": true, "storageFailure": true]
    }
    check(!results.isEmpty, "named fixture scenario selected")
    try canonical(results).write(to: root.deletingLastPathComponent().appendingPathComponent("guard-results.json"))
    print("Task96A actual handler/helper/atomic store: PASS; package/time/distinct deterministic random/container substitutions; no Safari runtime")
  }
}
