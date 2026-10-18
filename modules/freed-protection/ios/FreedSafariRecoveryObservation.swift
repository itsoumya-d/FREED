import Foundation
import CryptoKit
import Security
import CoreFoundation

// Configuration observations only. This type never calls friend/app authority.
final class FreedSafariRecoveryObservation {
  static let shared = FreedSafariRecoveryObservation()
  static let key = "freed.deviceAdult.safariRecoveryObservation.v1"
  struct Stamp { let wall: Double; let uptime: Double }
  struct Package { let digest: String; let scopeDigest: String; let requiredCount: Int; let variant: String }
  struct Snapshot { let payload: [String: Any]; let binding: String }
  struct Failure: Error { let reason: String }
  private let container: URL?, domain: String, packageDirectory: URL?
  private let clock: () -> Stamp, random: () throws -> String
  private let hostSession = UUID().uuidString
  private static let factKeys: Set<String> = ["bundleArtifactDigest", "scopeDigest", "staticRules", "dynamicRules", "sessionRules", "grants", "requiredScopeCount", "coveredScopeCount", "diagnostic"]
  private static let ticketKeys: Set<String> = ["nonce", "revision", "presentationEpoch", "hostSession", "generation", "nativeEpoch", "bundleArtifactDigest", "scopeDigest", "issuedWallMs", "issuedUptimeMs", "deadlineWallMs", "deadlineUptimeMs"]
  private static let nativeReasons = Set(["none", "storage-unavailable", "malformed", "expired", "superseded", "stale-config", "stale-presentation", "reset", "clock", "package-unavailable"])
  init(container: URL? = nil, domain: String = FreedProtectionConfigurationLock.appGroupIdentifier, packageDirectory: URL? = nil,
       clock: @escaping () -> Stamp = { Stamp(wall: Date().timeIntervalSince1970 * 1000, uptime: ProcessInfo.processInfo.systemUptime * 1000) },
       random: @escaping () throws -> String = {
         var bytes = [UInt8](repeating: 0, count: 32)
         guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw Failure(reason: "storage-unavailable") }
         return bytes.map { String(format: "%02x", $0) }.joined()
       }) { self.container = container; self.domain = domain; self.packageDirectory = packageDirectory; self.clock = clock; self.random = random }
  static func hash(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
  private static func json(_ value: Any) throws -> Data { try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed]) }
  private static func integer(_ value: Any?) -> Int? {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(), number.doubleValue >= 0,
      number.doubleValue <= 9_007_199_254_740_990, number.doubleValue.rounded() == number.doubleValue else { return nil }; return number.intValue
  }
  private static func number(_ value: Any?) -> Double? {
    guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID(), n.doubleValue.isFinite, n.doubleValue >= 0 else { return nil }; return n.doubleValue
  }
  private static func hex(_ value: Any?) -> Bool { (value as? String)?.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil }
  private static func exact(_ value: [String: Any], _ keys: Set<String>) -> Bool { Set(value.keys) == keys }
  private static func member(_ value: Any?, _ values: [String]) -> Bool { (value as? String).map { values.contains($0) } ?? false }
  private static func validFacts(_ facts: [String: Any]) -> Bool {
    guard exact(facts, factKeys), hex(facts["bundleArtifactDigest"]), hex(facts["scopeDigest"]),
      member(facts["staticRules"], ["not-configured", "expected-enabled", "missing", "unexpected", "unavailable", "error"]),
      member(facts["dynamicRules"], ["zero", "nonzero", "unavailable", "error"]), member(facts["sessionRules"], ["zero", "nonzero", "unavailable", "error"]),
      member(facts["grants"], ["complete", "partial", "missing", "unknown"]),
      member(facts["diagnostic"], ["none", "package-read", "package-mismatch", "api-unavailable", "api-error", "check-timeout"]),
      let required = integer(facts["requiredScopeCount"]), (1...4012).contains(required) else { return false }
    let covered = integer(facts["coveredScopeCount"])
    switch facts["grants"] as? String {
    case "complete": return covered == required
    case "missing": return covered == 0
    case "partial": return covered.map { $0 > 0 && $0 < required } ?? false
    default: return facts["coveredScopeCount"] is NSNull
    }
  }
  // The supplied directory is an internal fixture seam only; no exported bridge accepts it.
  func readExpectedPackage() throws -> Package {
    guard !FreedProtectionConfigurationLock.isInsideExclusiveAccess else { throw Failure(reason: "package-unavailable") }
    let directory: URL
    if let supplied = packageDirectory { directory = supplied }
    else if Bundle.main.bundleIdentifier == "app.freed.recovery.safari-focus-shield" { directory = Bundle.main.bundleURL }
    else {
      guard let plugins = Bundle.main.builtInPlugInsURL,
        let bundle = Bundle(url: plugins.appendingPathComponent("FREEDSafariFocusShield.appex")),
        bundle.bundleIdentifier == "app.freed.recovery.safari-focus-shield" else { throw Failure(reason: "package-unavailable") }
      directory = bundle.bundleURL
    }
    func bytes(_ file: String) throws -> Data {
      var current = directory
      for component in file.split(separator: "/") {
        guard component != ".", component != ".." else { throw Failure(reason: "package-unavailable") }
        current.appendPathComponent(String(component))
        let attributes = try FileManager.default.attributesOfItem(atPath: current.path)
        guard attributes[.type] as? FileAttributeType != .typeSymbolicLink else { throw Failure(reason: "package-unavailable") }
      }
      let attributes = try FileManager.default.attributesOfItem(atPath: current.path)
      guard attributes[.type] as? FileAttributeType == .typeRegular, (attributes[.size] as? NSNumber)?.intValue ?? Int.max <= 1_048_576 else { throw Failure(reason: "package-unavailable") }
      return try Data(contentsOf: current, options: [.mappedIfSafe])
    }
    guard (try directory.resourceValues(forKeys: [.isSymbolicLinkKey])).isSymbolicLink != true,
      let manifest = try JSONSerialization.jsonObject(with: bytes("manifest.json")) as? [String: Any],
      let info = try PropertyListSerialization.propertyList(from: bytes("Info.plist"), format: nil) as? [String: Any],
      let action = manifest["action"] as? [String: String], action == ["default_popup": "safari-observation/check.html"],
      let hosts = manifest["host_permissions"] as? [String], !hosts.isEmpty, hosts.count <= 2006, Set(hosts).count == hosts.count,
      manifest["optional_permissions"] == nil, manifest["optional_host_permissions"] == nil,
      let ext = info["NSExtension"] as? [String: Any], let access = ext["SFSafariWebsiteAccess"] as? [String: Any],
      Set(access.keys) == ["Allowed Domains", "Level"], access["Level"] as? String == "Some",
      access["Allowed Domains"] as? [String] == hosts.map({ $0.replacingOccurrences(of: "^([*]|https?)://", with: "", options: .regularExpression).replacingOccurrences(of: "/[*]$", with: "", options: .regularExpression) }) else { throw Failure(reason: "package-unavailable") }
    var files = ["manifest.json", "background.js", "content.js", "safari-observation/check.html", "safari-observation/check.js", "safari-observation/check.css"]
    var variant = "short-form-v1"
    if let dnr = manifest["declarative_net_request"] as? [String: Any] {
      guard Set(dnr.keys) == ["rule_resources"], let rules = dnr["rule_resources"] as? [[String: Any]], rules.count == 1,
        Set(rules[0].keys) == ["id", "enabled", "path"], (rules[0]["enabled"] as? NSNumber).map({ CFGetTypeID($0) == CFBooleanGetTypeID() && $0.boolValue }) == true,
        manifest["permissions"] as? [String] == ["nativeMessaging", "declarativeNetRequestWithHostAccess"] else { throw Failure(reason: "package-unavailable") }
      if rules[0]["id"] as? String == "freed_adult_recovery_internal_v1", rules[0]["path"] as? String == "adult-recovery/rules.json", info["FREEDSafariAdultRecoveryArtifact"] as? String == "adult-recovery-internal-v1" {
        variant = "adult-recovery-internal-v1"
        files += ["adult-recovery/artifact.json", "adult-recovery/feed.json", "adult-recovery/rules.json", "adult-recovery/page.html", "adult-recovery/page.js", "adult-recovery/page.css", "adult-recovery/kite.svg"]
        guard let artifact = try JSONSerialization.jsonObject(with: bytes("adult-recovery/artifact.json")) as? [String: Any],
          artifact["schemaVersion"] as? String == variant,
          artifact["rulesSha256"] as? String == Self.hash(try bytes("adult-recovery/rules.json")),
          let feed = artifact["feed"] as? [String: Any], feed["sha256"] as? String == Self.hash(try bytes("adult-recovery/feed.json")),
          let hashes = artifact["resourceHashes"] as? [String: String], hashes.count == 4 else { throw Failure(reason: "package-unavailable") }
        for file in ["page.html", "page.js", "page.css", "kite.svg"] { guard hashes[file] == Self.hash(try bytes("adult-recovery/" + file)) else { throw Failure(reason: "package-unavailable") } }
      } else if rules[0]["id"] as? String == "freed_safe_recovery_probe_v1", rules[0]["path"] as? String == "recovery-probe/rules.json", info["FREEDWebsiteRecoveryProbeEnabled"] as? Bool == true {
        variant = "safe-recovery-probe-v1"; files += ["recovery-probe/rules.json", "recovery-probe/page.html", "recovery-probe/page.js", "recovery-probe/page.css", "recovery-probe/kite.svg"]
      } else { throw Failure(reason: "package-unavailable") }
    } else {
      guard manifest["permissions"] as? [String] == ["nativeMessaging"], info["FREEDSafariAdultRecoveryArtifact"] == nil,
        info["FREEDWebsiteRecoveryProbeEnabled"] == nil, manifest["web_accessible_resources"] == nil else { throw Failure(reason: "package-unavailable") }
    }
    var inventory = "FREED_SAFARI_OBSERVATION_V1\n"
    for file in files.sorted() { inventory += file + "\0" + Self.hash(try bytes(file)) + "\n" }
    var scope: [String] = []
    for host in hosts {
      guard host.range(of: "^([*]|https?)://([*][.])?[a-z0-9.-]+/[*]$", options: .regularExpression) != nil else { throw Failure(reason: "package-unavailable") }
      scope += host.hasPrefix("*://") ? ["http://" + host.dropFirst(4), "https://" + host.dropFirst(4)] : [host]
    }
    scope = Array(Set(scope)).sorted(); guard scope.count <= 4012 else { throw Failure(reason: "package-unavailable") }
    return Package(digest: Self.hash(Data(inventory.utf8)), scopeDigest: Self.hash(Data(("FREED_SAFARI_OBSERVATION_SCOPE_V1\n" + scope.map { $0 + "\n" }.joined()).utf8)), requiredCount: scope.count, variant: variant)
  }
  private func transaction<T>(_ body: (UserDefaults) throws -> T) throws -> T {
    try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride: container, domain: domain, body)
  }
  private func empty() -> [String: Any] { ["version": 1, "revision": 0, "presentationEpoch": 0, "hostSession": "", "pending": NSNull(), "lastReceipt": NSNull(), "diagnostic": "none"] }
  private static func validTicket(_ value: [String: Any], receipt: Bool) -> Bool {
    let keys = receipt ? ticketKeys.union(["commitDigest", "receivedWallMs", "receivedUptimeMs", "expiresWallMs", "expiresUptimeMs", "facts"]) : ticketKeys
    guard exact(value, keys), hex(value["nonce"]), (value["hostSession"] as? String).flatMap(UUID.init(uuidString:)) != nil,
      ["revision", "presentationEpoch", "generation", "nativeEpoch"].allSatisfy({ integer(value[$0]) != nil }), hex(value["bundleArtifactDigest"]), hex(value["scopeDigest"]),
      let issuedWall = number(value["issuedWallMs"]), let issuedUp = number(value["issuedUptimeMs"]),
      number(value["deadlineWallMs"]) == issuedWall + 30000, number(value["deadlineUptimeMs"]) == issuedUp + 30000 else { return false }
    if !receipt { return true }
    guard hex(value["commitDigest"]), let facts = value["facts"] as? [String: Any], validFacts(facts),
      let received = number(value["receivedWallMs"]), let receivedUp = number(value["receivedUptimeMs"]),
      number(value["expiresWallMs"]) == received + 300000, number(value["expiresUptimeMs"]) == receivedUp + 300000,
      received >= issuedWall, receivedUp >= issuedUp, received < issuedWall + 30000, receivedUp < issuedUp + 30000,
      abs((received - issuedWall) - (receivedUp - issuedUp)) <= 2000,
      facts["bundleArtifactDigest"] as? String == value["bundleArtifactDigest"] as? String,
      facts["scopeDigest"] as? String == value["scopeDigest"] as? String else { return false }; return true
  }
  private func record(_ defaults: UserDefaults) throws -> [String: Any] {
    guard let raw = defaults.object(forKey: Self.key) else { return empty() }
    guard let data = raw as? Data, data.count <= 16384, let value = try JSONSerialization.jsonObject(with: data) as? [String: Any],
      Self.exact(value, ["version", "revision", "presentationEpoch", "hostSession", "pending", "lastReceipt", "diagnostic"]), Self.integer(value["version"]) == 1,
      Self.integer(value["revision"]) != nil, Self.integer(value["presentationEpoch"]) != nil,
      (value["hostSession"] as? String).flatMap(UUID.init(uuidString:)) != nil,
      (value["diagnostic"] as? String).map(Self.nativeReasons.contains) == true else { throw Failure(reason: "malformed") }
    for (key, receipt) in [("pending", false), ("lastReceipt", true)] {
      if value[key] is NSNull { continue }; guard let item = value[key] as? [String: Any], Self.validTicket(item, receipt: receipt) else { throw Failure(reason: "malformed") }
      guard Self.integer(item["revision"])! <= Self.integer(value["revision"])! else { throw Failure(reason: "malformed") }
      if !receipt { guard Self.integer(item["revision"]) == Self.integer(value["revision"]) else { throw Failure(reason: "malformed") } }
    }; return value
  }
  private func stage(_ record: [String: Any], _ defaults: UserDefaults) throws {
    let data = try Self.json(record); guard data.count <= 16384 else { throw Failure(reason: "malformed") }; defaults.set(data, forKey: Self.key)
  }
  private static func advance(_ value: Any?) throws -> Int { guard let n = integer(value), n < 9_007_199_254_740_990 else { throw Failure(reason: "malformed") }; return n + 1 }
  func startHostSession() throws {
    try transaction { defaults in
      var value = try record(defaults); if value["hostSession"] as? String == hostSession { return }
      value["hostSession"] = hostSession; value["presentationEpoch"] = try Self.advance(value["presentationEpoch"]); value["pending"] = NSNull(); try stage(value, defaults)
    }
  }
  func invalidateForSettings() throws {
    try startHostSession()
    try transaction { defaults in var value = try record(defaults); value["presentationEpoch"] = try Self.advance(value["presentationEpoch"]); value["pending"] = NSNull(); try stage(value, defaults) }
  }
  func recordDiagnostic(_ reason: String) throws {
    guard Self.nativeReasons.contains(reason) else { return }
    try transaction { defaults in
      var value = try record(defaults)
      guard (value["hostSession"] as? String).flatMap(UUID.init(uuidString:)) != nil else { return }
      value["revision"] = try Self.advance(value["revision"]); value["pending"] = NSNull(); value["diagnostic"] = reason; try stage(value, defaults)
    }
  }
  private func binding(_ value: [String: Any], _ defaults: UserDefaults) throws -> String {
    "\(FreedProtectionConfigurationLock.generation(defaults)):\(try FreedProtectionConfigurationLock.adultMutationEpoch(defaults)):\(value["presentationEpoch"]!):\(value["hostSession"]!):\(value["revision"]!)"
  }
  private func current(_ ticket: [String: Any], _ value: [String: Any], _ defaults: UserDefaults, _ expected: Package) -> String? {
    if defaults.bool(forKey: FreedProtectionConfigurationLock.resetMarkerKey) { return "reset" }
    if Self.integer(ticket["generation"]) != FreedProtectionConfigurationLock.generation(defaults) || Self.integer(ticket["nativeEpoch"]) != (try? FreedProtectionConfigurationLock.adultMutationEpoch(defaults)) { return "stale-config" }
    if ticket["hostSession"] as? String != value["hostSession"] as? String || Self.integer(ticket["presentationEpoch"]) != Self.integer(value["presentationEpoch"]) { return "stale-presentation" }
    if ticket["bundleArtifactDigest"] as? String != expected.digest || ticket["scopeDigest"] as? String != expected.scopeDigest { return "package-unavailable" }
    return nil
  }
  private func age(_ value: [String: Any], stamp: Stamp, receipt: Bool) -> String? {
    let wall = stamp.wall - (Self.number(value[receipt ? "receivedWallMs" : "issuedWallMs"]) ?? .infinity)
    let up = stamp.uptime - (Self.number(value[receipt ? "receivedUptimeMs" : "issuedUptimeMs"]) ?? .infinity)
    if !wall.isFinite || !up.isFinite || wall < 0 || up < 0 || abs(wall - up) > 2000 { return "clock" }
    return max(wall, up) >= (receipt ? 300000 : 30000) ? "expired" : nil
  }
  func begin(expected: Package) throws -> [String: Any] {
    let stamp = clock(), nonce = try random(); guard Self.hex(nonce) else { throw Failure(reason: "malformed") }
    return try transaction { defaults in
      var value = try record(defaults)
      guard (value["hostSession"] as? String).flatMap(UUID.init(uuidString:)) != nil else { throw Failure(reason: "stale-presentation") }
      guard !defaults.bool(forKey: FreedProtectionConfigurationLock.resetMarkerKey) else { throw Failure(reason: "reset") }
      let revision = try Self.advance(value["revision"])
      value["revision"] = revision; value["diagnostic"] = "none"
      value["pending"] = ["nonce": nonce, "revision": revision, "presentationEpoch": value["presentationEpoch"]!, "hostSession": value["hostSession"]!, "generation": FreedProtectionConfigurationLock.generation(defaults), "nativeEpoch": try FreedProtectionConfigurationLock.adultMutationEpoch(defaults), "bundleArtifactDigest": expected.digest, "scopeDigest": expected.scopeDigest, "issuedWallMs": stamp.wall, "issuedUptimeMs": stamp.uptime, "deadlineWallMs": stamp.wall + 30000, "deadlineUptimeMs": stamp.uptime + 30000]
      try stage(value, defaults); return ["version": 1, "issued": true, "nonce": nonce, "expiresAfterMs": 30000]
    }
  }
  func commit(_ message: [String: Any], expected: Package) throws -> [String: Any] {
    guard Self.exact(message, Self.factKeys.union(["version", "type", "nonce"])), Self.integer(message["version"]) == 1,
      message["type"] as? String == "commit-safari-recovery-observation", Self.hex(message["nonce"]), try Self.json(message).count <= 4096 else { throw Failure(reason: "malformed") }
    let facts = message.filter { Self.factKeys.contains($0.key) }
    guard Self.validFacts(facts), facts["bundleArtifactDigest"] as? String == expected.digest, facts["scopeDigest"] as? String == expected.scopeDigest,
      Self.integer(facts["requiredScopeCount"]) == expected.requiredCount,
      expected.variant != "short-form-v1" || facts["staticRules"] as? String != "expected-enabled",
      expected.variant == "short-form-v1" || facts["staticRules"] as? String != "not-configured" else { throw Failure(reason: "malformed") }
    let digest = Self.hash(try Self.json(message)), stamp = clock()
    var response: [String: Any] = try transaction { defaults in
      var value = try record(defaults)
      if let previous = value["lastReceipt"] as? [String: Any], previous["nonce"] as? String == message["nonce"] as? String,
        Self.integer(value["revision"]) == Self.integer(previous["revision"]) {
        guard previous["commitDigest"] as? String == digest else { throw Failure(reason: "malformed") }
        if let reason = current(previous, value, defaults, expected) ?? age(previous, stamp: stamp, receipt: true) { throw Failure(reason: reason) }
        return ["version": 1, "persisted": true, "reason": "none", "receipt": previous]
      }
      guard var pending = value["pending"] as? [String: Any], pending["nonce"] as? String == message["nonce"] as? String else { throw Failure(reason: "superseded") }
      if let reason = current(pending, value, defaults, expected) ?? age(pending, stamp: stamp, receipt: false) { throw Failure(reason: reason) }
      pending["commitDigest"] = digest; pending["receivedWallMs"] = stamp.wall; pending["receivedUptimeMs"] = stamp.uptime
      pending["expiresWallMs"] = stamp.wall + 300000; pending["expiresUptimeMs"] = stamp.uptime + 300000; pending["facts"] = facts
      value["pending"] = NSNull(); value["lastReceipt"] = pending; value["diagnostic"] = "none"; try stage(value, defaults)
      return ["version": 1, "persisted": true, "reason": "none", "receipt": pending]
    }
    if let receipt = response["receipt"] as? [String: Any] { response["receipt"] = projection(receipt, expected) }
    return response
  }
  private func projection(_ receipt: [String: Any], _ expected: Package) -> [String: Any] {
    var result = receipt.filter { ["revision", "bundleArtifactDigest", "scopeDigest", "generation", "nativeEpoch", "presentationEpoch", "facts"].contains($0.key) }
    result["version"] = 1; result["packageVariant"] = expected.variant; result["context"] = "profile-and-private-unqualified"
    for (destination, source) in [("receivedAt", "receivedWallMs"), ("expiresAt", "expiresWallMs")] { result[destination] = Self.iso(Self.number(receipt[source]) ?? 0) }; return result
  }
  static func iso(_ milliseconds: Double) -> String { let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return formatter.string(from: Date(timeIntervalSince1970: milliseconds / 1000)) }
  static var unknownEnabled: [String: Any] { ["value": NSNull(), "checkedAt": NSNull(), "reason": "api-unavailable"] }
  static func unavailable(_ reason: String) -> [String: Any] { ["version": 1, "receipt": NSNull(), "freshness": "absent", "reason": reason, "enabled": unknownEnabled] }
  func read(expected: Package, enabled: [String: Any] = FreedSafariRecoveryObservation.unknownEnabled, captured: String? = nil) throws -> Snapshot {
    let stamp = clock()
    let snapshot: Snapshot = try transaction { defaults in
      let value = try record(defaults), currentBinding = try binding(value, defaults)
      var safeEnabled = enabled
      let staleQuery = captured != nil && captured != currentBinding
      if staleQuery { safeEnabled = ["value": NSNull(), "checkedAt": NSNull(), "reason": "stale-config"] }
      var latestReason = value["diagnostic"] as? String == "none" ? nil : value["diagnostic"] as? String
      if let pending = value["pending"] as? [String: Any] { latestReason = current(pending, value, defaults, expected) ?? age(pending, stamp: stamp, receipt: false) ?? "pending" }
      else if defaults.bool(forKey: FreedProtectionConfigurationLock.resetMarkerKey) { latestReason = "reset" }
      if latestReason == "superseded" { latestReason = "stale-presentation" }
      guard let receipt = value["lastReceipt"] as? [String: Any] else { return Snapshot(payload: ["version": 1, "receipt": NSNull(), "freshness": "absent", "reason": staleQuery ? "stale-config" : latestReason ?? "none", "enabled": safeEnabled], binding: currentBinding) }
      guard receipt["bundleArtifactDigest"] as? String == expected.digest, receipt["scopeDigest"] as? String == expected.scopeDigest else { return Snapshot(payload: Self.unavailable("package-unavailable"), binding: currentBinding) }
      var reason = current(receipt, value, defaults, expected) ?? age(receipt, stamp: stamp, receipt: true)
      if Self.integer(receipt["revision"]) != Self.integer(value["revision"]) { reason = latestReason ?? "stale-presentation" }
      if let captured, captured != currentBinding { reason = "stale-config"; safeEnabled = ["value": NSNull(), "checkedAt": NSNull(), "reason": "stale-config"] }
      if reason == "superseded" { reason = "stale-presentation" }
      if safeEnabled["value"] as? Bool == false { reason = "native-disabled" }
      return Snapshot(payload: ["version": 1, "receipt": receipt, "freshness": reason == nil ? "fresh" : "historical", "reason": reason ?? "none", "enabled": safeEnabled], binding: currentBinding)
    }
    var payload = snapshot.payload
    if let receipt = payload["receipt"] as? [String: Any] { payload["receipt"] = projection(receipt, expected) }
    return Snapshot(payload: payload, binding: snapshot.binding)
  }
}
