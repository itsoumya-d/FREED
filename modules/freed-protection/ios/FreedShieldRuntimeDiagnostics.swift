import Foundation
import CoreFoundation
import CryptoKit
import Darwin

// Internal, best-effort observations only. Missing records never establish that
// an extension was not invoked. Fixed slots prevent growth across owner changes.
enum FreedShieldRuntimeDiagnostics {
  enum Role: String, Codable, CaseIterable { case configuration, action }
  enum Callback: String, Codable, CaseIterable { case app, site, category }
  enum Phase: String, Codable, CaseIterable { case entry, `return` }
  enum Action: String, Codable { case none, primary, secondary, unknown }
  enum Outcome: String, Codable { case none, configured, close, deferred, openParent }
  struct Record: Codable {
    let version: Int
    let role: Role
    let callback: Callback
    let phase: Phase
    let action: Action
    let outcome: Outcome
    let elapsedMilliseconds: Double
    let timestamp: Double
    let binaryVersion: String
    var sanitized: [String: Any] {
      ["version": version, "role": role.rawValue, "callback": callback.rawValue,
       "phase": phase.rawValue, "action": action.rawValue, "outcome": outcome.rawValue,
       "elapsedMilliseconds": elapsedMilliseconds, "timestamp": timestamp, "binaryVersion": binaryVersion]
    }
  }
  struct Context { let namespace: String; let binaryVersion: String }
  struct Measurement {
    let context: Context
    let role: Role
    let callback: Callback
    let action: Action
    let start: Double
  }
  private struct Owner: Decodable { let version: Int; let ownerDigest: String; let generation: Int; let scopeEpoch: Int }
  private struct Identity: Codable, Equatable { let owner: String; let generation: Int; let epoch: Int }
  private struct Preview: Decodable { let version: Int; let identity: Identity; let revision: Int; let optedIn: Bool }
  private struct Envelope: Codable { let namespace: String; let record: Record }
  private static let prefix = "freed.shieldDiagnostics.v1."
  private static let group = "group.app.freed.recovery"
  private static let maximumBytes = 1024
  private static let maximumAge: Double = 86400
  private static let recordKeys: Set<String> = ["version", "role", "callback", "phase", "action", "outcome", "elapsedMilliseconds", "timestamp", "binaryVersion"]

  private static func boolean(_ value: Any?) -> Bool? {
    guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return nil }
    return number.boolValue
  }
  private static func integer(_ value: Any?) -> Int? {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
      number.doubleValue.isFinite, number.doubleValue >= 0, number.doubleValue <= 9_007_199_254_740_991,
      number.doubleValue.rounded(.towardZero) == number.doubleValue else { return nil }
    return number.intValue
  }
  private static func validVersion(_ value: String) -> Bool {
    !value.isEmpty && value.utf8.count <= 32 && value.range(of: "^[0-9]+(?:\\.[0-9]+){0,3}$", options: .regularExpression) != nil
  }
  static func context(info: [String: Any], defaults: UserDefaults?, debug: Bool) -> Context? {
    context(info: info, values: defaults.map { values($0) }, debug: debug)
  }
  private static func values(_ defaults: UserDefaults) -> [String: Any] {
    var result: [String: Any] = [:]
    for key in ["freed.protectionConfiguration.reset", "freed.protectionConfiguration.generation", "freed.appGroups.v1", "freed.selection.websiteRecoveryProbe.v1"] {
      result[key] = defaults.object(forKey: key)
    }
    return result
  }
  static func context(info: [String: Any], values: [String: Any]?, debug: Bool) -> Context? {
    guard boolean(info["FREEDWebsiteRecoveryProbeEnabled"]) == true,
      let channel = info["FREEDWebsiteRecoveryProbeChannel"] as? String,
      (channel == "internal-testflight" && boolean(info["FREEDWebsiteRecoveryProbeInternalTestflight"]) == true
        || channel == "development" && debug && boolean(info["FREEDWebsiteRecoveryProbeInternalTestflight"]) != nil),
      let binary = info["CFBundleVersion"] as? String, validVersion(binary), let values,
      values["freed.protectionConfiguration.reset"] == nil || boolean(values["freed.protectionConfiguration.reset"]) == false,
      let generation = integer(values["freed.protectionConfiguration.generation"]),
      let ownerData = values["freed.appGroups.v1"] as? Data, ownerData.count <= 524288,
      let previewData = values["freed.selection.websiteRecoveryProbe.v1"] as? Data, previewData.count <= 524288,
      let owner = try? JSONDecoder().decode(Owner.self, from: ownerData), owner.version == 1,
      !owner.ownerDigest.isEmpty, owner.ownerDigest.utf8.count <= 256, owner.generation == generation, owner.scopeEpoch >= 0, owner.scopeEpoch <= 9_007_199_254_740_991,
      let preview = try? JSONDecoder().decode(Preview.self, from: previewData), preview.version == 1,
      preview.optedIn, preview.revision >= 0, preview.revision <= 9_007_199_254_740_991,
      preview.identity == Identity(owner: owner.ownerDigest, generation: owner.generation, epoch: owner.scopeEpoch)
    else { return nil }
    // Private one-way namespace is never bridged or logged. Slots are fixed,
    // so a new namespace overwrites observations rather than adding keys.
    guard let seed = try? JSONEncoder().encode([owner.ownerDigest, String(generation), String(owner.scopeEpoch), String(preview.revision)]) else { return nil }
    return Context(namespace: SHA256.hash(data: seed).map { String(format: "%02x", $0) }.joined(), binaryVersion: binary)
  }
  // Atomic rename lets this observational read avoid the enforcement lock.
  // Fail closed above 1 MiB rather than imposing enforcement's 16 MiB parse cost.
  private struct CommittedState {
    let values: [String: Any]
    let data: Data
    let device: dev_t
    let inode: ino_t
  }
  static func nativeValues(at url: URL) -> [String: Any]? { committedState(at: url)?.values }
  private static func committedState(at url: URL) -> CommittedState? {
    let descriptor = open(url.path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW)
    guard descriptor >= 0 else { return nil }
    defer { close(descriptor) }
    var info = stat()
    guard fstat(descriptor, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG,
      info.st_size > 0, info.st_size <= 1_048_576 else { return nil }
    let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: false)
    guard let data = try? handle.read(upToCount: 1_048_577), data.count <= 1_048_576,
      let raw = (try? PropertyListSerialization.propertyList(from: data, format: nil)) as? [String: Any],
      integer(raw["version"]) == 1, integer(raw["revision"]) != nil,
      let values = raw["values"] as? [String: Any], values.keys.allSatisfy({ key in
        ["freed.protectionConfiguration.", "freed.appGroups.", "freed.appGuard.", "freed.appLimit.",
         "freed.earnedUnlock.", "freed.pendingIntervention.", "freed.selection.", "freed.safariContentBlocker.",
         "freed.riskWindow.", "freed.encryptedDns."].contains { key.hasPrefix($0) }
        || ["freed.familyActivitySelection", "freed.adultFilterActive", "freed.riskWindowActive"].contains(key)
      }), values["freed.protectionConfiguration.generation"] == nil || integer(values["freed.protectionConfiguration.generation"]) != nil,
      values["freed.protectionConfiguration.reset"] == nil || boolean(values["freed.protectionConfiguration.reset"]) != nil else { return nil }
    // Read only the existing native fence; never export its input payloads.
    return CommittedState(values: values, data: data, device: info.st_dev, inode: info.st_ino)
  }
  private static func nativeURL() -> URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("freed-enforcement-state.v1.plist")
  }
  private static func bundledContext(_ values: [String: Any]?) -> Context? {
    #if DEBUG
    let debug = true
    #else
    let debug = false
    #endif
    return context(info: Bundle.main.infoDictionary ?? [:], values: values, debug: debug)
  }
  private static func liveContext() -> Context? {
    // Bundle refusal precedes any file access, including in production.
    let info = Bundle.main.infoDictionary ?? [:]
    guard boolean(info["FREEDWebsiteRecoveryProbeEnabled"]) == true,
      let channel = info["FREEDWebsiteRecoveryProbeChannel"] as? String,
      channel == "internal-testflight" || channel == "development" else { return nil }
    return nativeURL().flatMap { nativeValues(at: $0) }.flatMap { bundledContext($0) }
  }
  private static func key(_ role: Role, _ callback: Callback, _ phase: Phase) -> String {
    prefix + role.rawValue + "." + callback.rawValue + "." + phase.rawValue
  }
  private static func valid(_ record: Record, context: Context, now: Double) -> Bool {
    guard record.version == 1, record.binaryVersion == context.binaryVersion, validVersion(record.binaryVersion),
      now.isFinite, record.timestamp.isFinite, record.timestamp > 0, record.timestamp <= now,
      now - record.timestamp <= maximumAge, record.elapsedMilliseconds.isFinite,
      (0...86_400_000).contains(record.elapsedMilliseconds) else { return false }
    if record.phase == .entry { return record.outcome == .none && record.elapsedMilliseconds == 0 && (record.role == .action ? record.action != .none : record.action == .none) }
    return record.role == .configuration
      ? record.action == .none && record.outcome == .configured
      : record.action != .none && [.close, .deferred, .openParent].contains(record.outcome)
  }
  static func store(_ record: Record, context: Context, write: (Data, String) throws -> Void) {
    guard valid(record, context: context, now: Date().timeIntervalSince1970),
      let encoded = try? JSONEncoder().encode(Envelope(namespace: context.namespace, record: record)),
      encoded.count <= maximumBytes else { return }
    // No synchronize, network, lock or retry. Failure never affects protection.
    try? write(encoded, key(record.role, record.callback, record.phase))
  }
  static func records(context: Context, now: Double, read: (String) -> Data?) -> [Record] {
    var result: [Record] = []
    for role in Role.allCases { for callback in Callback.allCases { for phase in Phase.allCases {
      guard let data = read(key(role, callback, phase)), data.count <= maximumBytes,
        let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        Set(raw.keys) == ["namespace", "record"], let fields = raw["record"] as? [String: Any], Set(fields.keys) == recordKeys,
        let value = try? JSONDecoder().decode(Envelope.self, from: data), value.namespace == context.namespace,
        value.record.role == role, value.record.callback == callback, value.record.phase == phase,
        valid(value.record, context: context, now: now) else { continue }
      result.append(value.record)
    } } }
    return result.sorted { $0.timestamp < $1.timestamp }
  }
  static func begin(role: Role, callback: Callback, action: Action = .none) -> Measurement? {
    guard let defaults = UserDefaults(suiteName: group), let context = liveContext() else { return nil }
    store(Record(version: 1, role: role, callback: callback, phase: .entry, action: action, outcome: .none,
      elapsedMilliseconds: 0, timestamp: Date().timeIntervalSince1970, binaryVersion: context.binaryVersion), context: context,
      write: { defaults.set($0, forKey: $1) })
    return Measurement(context: context, role: role, callback: callback, action: action, start: ProcessInfo.processInfo.systemUptime)
  }
  static func finish(_ measurement: Measurement?, outcome: Outcome) {
    let end = ProcessInfo.processInfo.systemUptime
    guard let measurement, let defaults = UserDefaults(suiteName: group), let current = liveContext(),
      current.namespace == measurement.context.namespace, current.binaryVersion == measurement.context.binaryVersion else { return }
    store(Record(version: 1, role: measurement.role, callback: measurement.callback, phase: .return, action: measurement.action, outcome: outcome,
      elapsedMilliseconds: max(0, (end - measurement.start) * 1000),
      timestamp: Date().timeIntervalSince1970, binaryVersion: current.binaryVersion), context: current,
      write: { defaults.set($0, forKey: $1) })
  }
  // A diagnostic owner check receives only this immutable committed snapshot.
  // No legacy preference fallback or migration-capable lock is used here.
  private final class CommittedDefaults: UserDefaults {
    private let committed: [String: Any]
    init(_ values: [String: Any]) { committed = values; super.init(suiteName: group)! }
    override func object(forKey key: String) -> Any? { committed[key] }
    override func string(forKey key: String) -> String? { committed[key] as? String }
    override func data(forKey key: String) -> Data? { committed[key] as? Data }
    override func integer(forKey key: String) -> Int { (committed[key] as? NSNumber)?.intValue ?? 0 }
    override func bool(forKey key: String) -> Bool { (committed[key] as? NSNumber)?.boolValue ?? false }
    override func set(_ value: Any?, forKey key: String) {}
    override func removeObject(forKey key: String) {}
  }
  // Caller runs the existing native owner fence on MainActor. Rechecking the
  // inode and committed bytes after that fence rejects disappearance/replacement
  // without repairing the file or importing preferences. Records stay separate.
  static func readCommitted(verifyOwner: (UserDefaults) -> Bool) -> [String: Any] {
    let unknown: [String: Any] = ["enabled": false, "status": "unknown", "records": []]
    let info = Bundle.main.infoDictionary ?? [:]
    guard boolean(info["FREEDWebsiteRecoveryProbeEnabled"]) == true,
      let channel = info["FREEDWebsiteRecoveryProbeChannel"] as? String,
      channel == "internal-testflight" || channel == "development",
      let url = nativeURL(), let committed = committedState(at: url),
      let context = bundledContext(committed.values),
      verifyOwner(CommittedDefaults(committed.values)),
      let preferences = UserDefaults(suiteName: group) else { return unknown }
    let values = records(context: context, now: Date().timeIntervalSince1970, read: { preferences.data(forKey: $0) })
    guard let current = committedState(at: url), current.device == committed.device, current.inode == committed.inode,
      current.data == committed.data else { return unknown }
    return ["enabled": true, "status": values.isEmpty ? "unknown" : "diagnostic", "binaryVersion": context.binaryVersion,
      "records": values.map { $0.sanitized }]
  }
}
