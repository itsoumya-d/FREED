import Foundation
import CoreFoundation
import Darwin

// Enforcement intent is a single versioned atomic file. UserDefaults supplies
// the one-time legacy seed and presentation only; synchronize is not durability.
// The same advisory lock and synchronous context are used by every extension.
enum FreedProtectionConfigurationLock {
  static let appGroupIdentifier = "group.app.freed.recovery"
  static let generationKey = "freed.protectionConfiguration.generation"
  static let resetMarkerKey = "freed.protectionConfiguration.reset"
  static let adultMutationEpochKey = "freed.deviceAdult.mutationEpoch.v1"
  private static let exclusiveDepthKey = "freed.configuration.exclusiveDepth"
  static var isInsideExclusiveAccess: Bool { (Thread.current.threadDictionary[exclusiveDepthKey] as? Int ?? 0) > 0 }
  static func adultMutationEpoch(_ defaults: UserDefaults) throws -> Int {
    guard let value = defaults.object(forKey: adultMutationEpochKey) else { return 0 }
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
      number.doubleValue >= 0, number.doubleValue.rounded() == number.doubleValue,
      number.doubleValue <= 9_007_199_254_740_990 else { throw AccessError.stateUnreadable }
    return number.intValue
  }
  @discardableResult static func fenceAdultMutations(_ defaults: UserDefaults) throws -> Int {
    let epoch = try adultMutationEpoch(defaults)
    guard epoch < 9_007_199_254_740_990 else { throw AccessError.stateUnreadable }
    let next = epoch + 1
    defaults.set(next, forKey: adultMutationEpochKey)
    guard persist(defaults) else { throw AccessError.persistenceFailed }
    return next
  }

  static let stateFileName = "freed-enforcement-state.v1.plist"
  // UIKit belongs to the containing app, never the shared extension source.
  // A lease is acquired before opening a lock file and ended by its owner only
  // after transaction rollback/commit, flock release and descriptor close.
  final class ExecutionLease {
    private let mutex = NSLock()
    private var expired = false
    private var finished = false
    private var completing = false
    private var finishAction: (() -> Void)?
    private let deadline: TimeInterval
    init(deadline: TimeInterval = ProcessInfo.processInfo.systemUptime + 10) { self.deadline = deadline }
    func onFinish(_ action: @escaping () -> Void) {
      mutex.lock(); defer { mutex.unlock() }
      precondition(finishAction == nil && !finished)
      finishAction = action
    }
    func expire() {
      // The expiration callback does not own the transaction or its flock.
      // It must not end the assertion while a synchronous OS call still runs.
      mutex.lock(); expired = true; mutex.unlock()
    }
    func checkActive() throws {
      mutex.lock(); defer { mutex.unlock() }
      guard !finished, completing || (!expired && ProcessInfo.processInfo.systemUptime < deadline) else { throw AccessError.executionExpired }
    }
    func beginCompletion() throws {
      mutex.lock(); defer { mutex.unlock() }
      guard !finished, !expired, ProcessInfo.processInfo.systemUptime < deadline else { throw AccessError.executionExpired }
      // The body can publish OS state before returning. Once admitted, only
      // that body's existing completion/rollback may settle its authority.
      // Expiration cannot invent a later file-only rollback after OS success.
      completing = true
    }
    func finish() {
      mutex.lock()
      guard !finished else { mutex.unlock(); return }
      finished = true; let action = finishAction; finishAction = nil
      mutex.unlock()
      action?()
    }
  }
  private static let executionProviderMutex = NSLock()
  private static var executionProvider: (() throws -> ExecutionLease)?
  static func installAppExecutionProvider(_ provider: @escaping () throws -> ExecutionLease) {
    executionProviderMutex.lock(); defer { executionProviderMutex.unlock() }
    executionProvider = provider
  }
  private static func beginExecution() throws -> ExecutionLease? {
    executionProviderMutex.lock(); let provider = executionProvider; executionProviderMutex.unlock()
    if let provider { return try provider() }
    #if os(iOS)
    // Extensions run inside their host's callback lifetime and cannot request
    // UIApplication execution. An uninitialized containing app fails closed.
    guard Bundle.main.bundleURL.pathExtension == "appex" else { throw AccessError.executionUnavailable }
    #endif
    return nil
  }
  enum AccessError: Error {
    case unavailable, containerUnavailable, timedOut, persistenceFailed, stateUnreadable, stateVersionUnsupported
    case executionUnavailable, executionExpired
    case lockOpenFailed(Int32), lockAcquireFailed(Int32), stateReadFailed(Int32), stateWriteFailed(Int32), stateReplaceFailed(Int32)
    var stage: String {
      switch self {
      case .unavailable: return "nested-transaction"
      case .executionUnavailable, .executionExpired: return "execution-assertion"
      case .containerUnavailable: return "app-group-container"
      case .lockOpenFailed: return "lock-open"
      case .lockAcquireFailed, .timedOut: return "lock-acquire"
      case .stateUnreadable, .stateVersionUnsupported, .stateReadFailed: return "state-read"
      case .persistenceFailed, .stateWriteFailed, .stateReplaceFailed: return "state-commit"
      }
    }
    var posixCode: Int32? {
      switch self {
      case .lockOpenFailed(let c), .lockAcquireFailed(let c), .stateReadFailed(let c), .stateWriteFailed(let c), .stateReplaceFailed(let c): return c
      default: return nil
      }
    }
    var reason: String {
      switch self {
      case .executionUnavailable: return "configuration-execution-unavailable"
      case .executionExpired: return "configuration-execution-expired"
      case .containerUnavailable: return "app-group-container-unavailable"
      case .timedOut: return "configuration-lock-timeout"
      case .stateUnreadable: return "enforcement-state-unreadable"
      case .stateVersionUnsupported: return "enforcement-state-version-unsupported"
      case .persistenceFailed, .stateWriteFailed, .stateReplaceFailed: return "enforcement-state-commit-failed"
      case .stateReadFailed: return "enforcement-state-read-failed"
      default: return "configuration-lock-unavailable"
      }
    }
  }
  static func diagnostics(_ error: Error? = nil, generation: Int? = nil) -> [String: Any] {
    let access = error as? AccessError, identity = error.map { $0 as NSError }
    let nativeDomain = identity?.domain
    let safeDomain = nativeDomain.flatMap { value in
      ["NS", "NE", "Freed", "DeviceActivity"].contains(where: value.hasPrefix) && value.count <= 128 ? value : "FreedProtection"
    }
    return ["stage": access?.stage ?? (error == nil ? "complete" : "native-operation"),
      "reason": access?.reason as Any? ?? (error == nil ? NSNull() : "native-operation-failed") as Any,
      "configurationGeneration": generation.map { $0 as Any } ?? NSNull(),
      "errorCode": access?.posixCode.map { Int($0) as Any } ?? identity.map { $0.code as Any } ?? NSNull(),
      "errorDomain": access?.posixCode != nil ? NSPOSIXErrorDomain as Any : safeDomain.map { $0 as Any } ?? NSNull()]
  }
  static func bindingFailure(reason: String, stage: String, supported: Bool = true, operationId: String = UUID().uuidString, generation: Int? = nil, scopeEpoch: Int? = nil, errorCode: Int32? = nil) -> [String: Any] {
    ["version": 1, "operationId": operationId, "supported": supported, "accepted": false, "bindingCurrent": false, "ownerVerified": false,
     "stage": stage, "reason": reason, "generation": generation.map { $0 as Any } ?? NSNull(), "scopeEpoch": scopeEpoch.map { $0 as Any } ?? NSNull(),
     "errorCode": errorCode.map { Int($0) as Any } ?? NSNull(), "errorDomain": errorCode == nil ? NSNull() : NSPOSIXErrorDomain as Any]
  }
  private final class Context: NSObject {
    let defaults: EnforcementDefaults
    let execution: ExecutionLease?
    let readOnly: Bool
    var failure: Error?
    init(_ defaults: EnforcementDefaults, execution: ExecutionLease?, readOnly: Bool = false) {
      self.defaults = defaults; self.execution = execution; self.readOnly = readOnly
    }
  }
  // Deliberate allowlist: journal, recovery history, photos and account data are
  // independent and must never be migrated into or cleared with enforcement.
  fileprivate static func owns(_ key: String) -> Bool {
    ["freed.protectionConfiguration.", "freed.appGroups.", "freed.appGuard.", "freed.appLimit.",
     "freed.earnedUnlock.", "freed.pendingIntervention.", "freed.selection.", "freed.safariContentBlocker.",
     "freed.riskWindow.", "freed.encryptedDns.", "freed.deviceAdult."].contains { key.hasPrefix($0) }
      || ["freed.familyActivitySelection", "freed.adultFilterActive", "freed.riskWindowActive"].contains(key)
  }
  private static func contextKey(_ container: URL) -> String { "FreedProtectionConfigurationLock:\(container.path)" }
  private static func container() throws -> URL {
    guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else { throw AccessError.containerUnavailable }
    return url
  }
  private static func unsignedInteger(_ value: Any?) -> Int? {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
      number.doubleValue >= 0, number.doubleValue <= 9_007_199_254_740_991, number.doubleValue.rounded() == number.doubleValue else { return nil }
    return number.intValue
  }
  private static func validAuthority(_ values: [String: Any]) -> Bool {
    (values[generationKey] == nil || unsignedInteger(values[generationKey]) != nil)
      && (values[resetMarkerKey] == nil || (values[resetMarkerKey] as? NSNumber).map { CFGetTypeID($0) == CFBooleanGetTypeID() } == true)
  }
  private static func read(_ url: URL) throws -> (values: [String: Any], revision: Int, data: Data)? {
    let descriptor = open(url.path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW)
    if descriptor < 0 { if errno == ENOENT { return nil }; throw AccessError.stateReadFailed(errno) }
    defer { close(descriptor) }
    var info = stat()
    guard fstat(descriptor, &info) == 0 else { throw AccessError.stateReadFailed(errno) }
    guard (info.st_mode & S_IFMT) == S_IFREG, info.st_size > 0, info.st_size <= 16 * 1024 * 1024 else { throw AccessError.stateUnreadable }
    let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: false)
    guard let data = try? handle.readToEnd(),
      let envelope = (try? PropertyListSerialization.propertyList(from: data, format: nil)) as? [String: Any],
      let versionNumber = envelope["version"] as? NSNumber, CFGetTypeID(versionNumber) != CFBooleanGetTypeID(), versionNumber.doubleValue.rounded() == versionNumber.doubleValue else { throw AccessError.stateUnreadable }
    guard versionNumber.intValue == 1 else { throw AccessError.stateVersionUnsupported }
    guard let revision = unsignedInteger(envelope["revision"]),
      let values = envelope["values"] as? [String: Any], values.keys.allSatisfy(owns),
      validAuthority(values) else { throw AccessError.stateUnreadable }
    return (values, revision, data)
  }
  private static func replace(_ data: Data, at url: URL) throws {
    let temporary = url.deletingLastPathComponent().appendingPathComponent(".freed-enforcement-\(UUID().uuidString).tmp")
    let descriptor = open(temporary.path, O_CREAT | O_EXCL | O_WRONLY | O_CLOEXEC | O_NOFOLLOW, S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw AccessError.stateWriteFailed(errno) }
    defer { close(descriptor); try? FileManager.default.removeItem(at: temporary) }
    #if os(iOS)
    // Existing entitlements use Complete. Do not make locked-device writes work
    // by weakening the protection class; return the real failure stage instead.
    do { try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: temporary.path) }
    catch { throw AccessError.persistenceFailed }
    #endif
    try data.withUnsafeBytes { bytes in
      guard let base = bytes.baseAddress else { throw AccessError.persistenceFailed }
      var offset = 0
      while offset < bytes.count {
        let count = Darwin.write(descriptor, base.advanced(by: offset), bytes.count - offset)
        if count < 0 { if errno == EINTR { continue }; throw AccessError.stateWriteFailed(errno) }
        guard count > 0 else { throw AccessError.stateWriteFailed(EIO) }; offset += count
      }
    }
    guard fsync(descriptor) == 0 else { throw AccessError.stateWriteFailed(errno) }
    let backup = url.deletingLastPathComponent().appendingPathComponent(".freed-enforcement-\(UUID().uuidString).rollback")
    let existing = FileManager.default.fileExists(atPath: url.path)
    if existing, link(url.path, backup.path) != 0 { throw AccessError.stateReplaceFailed(errno) }
    defer { try? FileManager.default.removeItem(at: backup) }
    guard rename(temporary.path, url.path) == 0 else { throw AccessError.stateReplaceFailed(errno) }
    let directoryDescriptor = open(url.deletingLastPathComponent().path, O_RDONLY | O_CLOEXEC)
    let syncCode: Int32
    if directoryDescriptor < 0 { syncCode = errno }
    else { syncCode = fsync(directoryDescriptor) == 0 ? 0 : errno; close(directoryDescriptor) }
    if syncCode != 0 {
      // A publication that cannot be made durable must restore the old inode.
      if existing { guard rename(backup.path, url.path) == 0 else { throw AccessError.persistenceFailed } }
      else { guard unlink(url.path) == 0 else { throw AccessError.persistenceFailed } }
      throw AccessError.stateReplaceFailed(syncCode)
    }
  }
  private static func commit(_ context: Context) throws {
    if let failure = context.failure { throw failure }
    try context.execution?.checkActive()
    let d = context.defaults
    if context.readOnly {
      guard !d.dirty else { throw AccessError.unavailable }
      return
    }
    guard d.dirty else { return }
    guard validAuthority(d.values), d.revision < 9_007_199_254_740_991 else { throw AccessError.stateUnreadable }
    let envelope: [String: Any] = ["version": 1, "revision": d.revision + 1, "values": d.values]
    guard PropertyListSerialization.propertyList(envelope, isValidFor: .binary) else { throw AccessError.persistenceFailed }
    let data: Data
    do { data = try PropertyListSerialization.data(fromPropertyList: envelope, format: .binary, options: 0) }
    catch { throw AccessError.persistenceFailed }
    guard data.count <= 16 * 1024 * 1024 else { throw AccessError.persistenceFailed }
    try replace(data, at: d.url)
    d.revision += 1; d.dirty = false; d.committed = true
  }
  // Existing boolean persistence guards retain their control flow while failure
  // remains attached to the transaction and is thrown by the outer boundary.
  static func persist(_ defaults: UserDefaults) -> Bool {
    guard let d = defaults as? EnforcementDefaults, let context = Thread.current.threadDictionary[contextKey(d.url.deletingLastPathComponent())] as? Context else {
      // Used only for scrubbing legacy standard preferences. Never authority.
      return !(defaults is EnforcementDefaults)
    }
    do { try commit(context); return true } catch { context.failure = error; return false }
  }
  static func withExclusiveAccess<T>(containerOverride: URL? = nil,
                                    domain: String = appGroupIdentifier,
                                    afterSuccessfulPersistence: ((T) -> Void)? = nil,
                                    readOnly: Bool = false,
                                    _ body: (UserDefaults) throws -> T) throws -> T {
    guard !readOnly || afterSuccessfulPersistence == nil else { throw AccessError.unavailable }
    let directory = try containerOverride ?? container()
    let key = contextKey(directory)
    if let existing = Thread.current.threadDictionary[key] as? Context {
      guard afterSuccessfulPersistence == nil, existing.readOnly == readOnly else { throw AccessError.unavailable }
      try existing.execution?.checkActive()
      return try body(existing.defaults)
    }
    let execution = try beginExecution()
    defer { execution?.finish() }
    try execution?.checkActive()
    let descriptor = open(directory.appendingPathComponent("freed-protection-configuration.lock").path, O_CREAT | O_RDWR | O_CLOEXEC | O_NOFOLLOW, S_IRUSR | S_IWUSR)
    guard descriptor >= 0 else { throw AccessError.lockOpenFailed(errno) }
    defer { close(descriptor) }
    let deadline = ProcessInfo.processInfo.systemUptime + 4
    while flock(descriptor, LOCK_EX | LOCK_NB) != 0 {
      guard errno == EWOULDBLOCK || errno == EAGAIN else { throw AccessError.lockAcquireFailed(errno) }
      try execution?.checkActive()
      guard ProcessInfo.processInfo.systemUptime < deadline else { throw AccessError.timedOut }; usleep(10_000)
    }
    defer { flock(descriptor, LOCK_UN) }
    try execution?.checkActive()
    let url = directory.appendingPathComponent(stateFileName)
    let previous = try read(url)
    // A public snapshot cannot initialize an enforcement file or import legacy
    // authority. Only the existing default writer/admission path may migrate.
    guard !readOnly || previous != nil else { throw AccessError.stateUnreadable }
    guard let legacy = UserDefaults(suiteName: domain) else { throw AccessError.persistenceFailed }
    var values = previous?.values ?? (legacy.persistentDomain(forName: domain) ?? [:]).filter { owns($0.key) }
    if previous == nil, domain == appGroupIdentifier,
      let dnsMarker = UserDefaults.standard.object(forKey: "freed.encryptedDns.cloudflareFamilies.configured"),
      values["freed.encryptedDns.cloudflareFamilies.configured"] == nil { values["freed.encryptedDns.cloudflareFamilies.configured"] = dnsMarker }
    let defaults = EnforcementDefaults(url: url, domain: domain, values: values, revision: previous?.revision ?? 0, legacy: legacy)
    defaults.readOnly = readOnly
    let context = Context(defaults, execution: execution, readOnly: readOnly); defaults.dirty = previous == nil
    Thread.current.threadDictionary[key] = context
    let previousDepth = Thread.current.threadDictionary[exclusiveDepthKey] as? Int ?? 0
    Thread.current.threadDictionary[exclusiveDepthKey] = previousDepth + 1
    defer {
      Thread.current.threadDictionary.removeObject(forKey: key)
      Thread.current.threadDictionary[exclusiveDepthKey] = previousDepth
    }
    do {
      // Migration succeeds before consumer side effects, never removes legacy,
      // and never publishes an empty replacement over an unreadable file.
      if previous == nil { try commit(context) }
      try execution?.beginCompletion()
      let value = try body(defaults)
      try commit(context)
      afterSuccessfulPersistence?(value)
      return value
    } catch {
      // Explicit durability points may precede OS registration. A throwing body
      // restores the original authority under exclusion; legacy remains intact.
      if defaults.committed, let previous {
        do { try replace(previous.data, at: url) }
        catch { throw AccessError.persistenceFailed }
      }
      throw context.failure ?? error
    }
  }
  static func withReadOnlyAccess<T>(containerOverride: URL? = nil,
                                   domain: String = appGroupIdentifier,
                                   _ body: (UserDefaults) throws -> T) throws -> T {
    try withExclusiveAccess(containerOverride: containerOverride, domain: domain, readOnly: true, body)
  }
  static func sharedDefaults(containerOverride: URL? = nil, domain: String = appGroupIdentifier) -> UserDefaults {
    if let directory = containerOverride ?? (try? container()), let current = Thread.current.threadDictionary[contextKey(directory)] as? Context { return current.defaults }
    // Always acquire a fresh file snapshot; never cache legacy defaults across
    // processes. Missing/protected/corrupt storage cannot create unlock authority.
    if let result = try? withExclusiveAccess(containerOverride: containerOverride, domain: domain, { $0 }) { return result }
    return EnforcementDefaults(url: URL(fileURLWithPath: "/unavailable"), domain: appGroupIdentifier,
      values: [resetMarkerKey: true, "freed.deviceAdult.storageUnavailable": true], revision: 0, legacy: UserDefaults.standard)
  }
  // Cleanup enumerates the committed enforcement projection, never inherited
  // UserDefaults global domains (EnforcementDefaults deliberately owns only keys).
  static func configurationKeys(_ defaults: UserDefaults) -> [String] {
    if let enforcement = defaults as? EnforcementDefaults { return Array(enforcement.values.keys) }
    return defaults.dictionaryRepresentation().keys.filter { owns($0) }
  }
  // Cleanup-only access to the known legacy app-group domain. This does not
  // change general migration, and cache readback is not a filesystem durability receipt.
  static func legacyConfiguration(_ defaults: UserDefaults) -> (domain: String, values: [String: Any])? {
    guard let enforcement = defaults as? EnforcementDefaults else { return nil }
    return (enforcement.domain, enforcement.legacy.persistentDomain(forName: enforcement.domain) ?? [:])
  }
  static func removeLegacyConfigurationKey(_ key: String, defaults: UserDefaults) {
    guard let enforcement = defaults as? EnforcementDefaults else { return }
    enforcement.legacy.removeObject(forKey: key)
  }
  static func generation(_ defaults: UserDefaults) -> Int { defaults.integer(forKey: generationKey) }
  static func permitsPublication(_ defaults: UserDefaults, capturedGeneration: Int? = nil) -> Bool {
    !defaults.bool(forKey: resetMarkerKey) && (capturedGeneration == nil || capturedGeneration == generation(defaults))
  }
  static func invalidateForReset(_ defaults: UserDefaults) {
    defaults.set(generation(defaults) + 1, forKey: generationKey); defaults.set(true, forKey: resetMarkerKey)
  }

  // A UserDefaults-shaped adapter bounds the migration without duplicating all
  // native policies. Owned reads/writes use the transaction's file snapshot.
  private final class EnforcementDefaults: UserDefaults {
    let url: URL, domain: String, legacy: UserDefaults
    var readOnly = false
    var values: [String: Any], revision: Int, dirty = false, committed = false
    init(url: URL, domain: String, values: [String: Any], revision: Int, legacy: UserDefaults) {
      self.url = url; self.domain = domain; self.values = values; self.revision = revision; self.legacy = legacy
      super.init(suiteName: domain)!
    }
    override func object(forKey key: String) -> Any? { owns(key) ? values[key] : legacy.object(forKey: key) }
    override func string(forKey key: String) -> String? { object(forKey: key) as? String }
    override func data(forKey key: String) -> Data? { object(forKey: key) as? Data }
    override func array(forKey key: String) -> [Any]? { object(forKey: key) as? [Any] }
    override func stringArray(forKey key: String) -> [String]? { object(forKey: key) as? [String] }
    override func dictionary(forKey key: String) -> [String: Any]? { object(forKey: key) as? [String: Any] }
    override func bool(forKey key: String) -> Bool { (object(forKey: key) as? NSNumber)?.boolValue ?? false }
    override func integer(forKey key: String) -> Int { (object(forKey: key) as? NSNumber)?.intValue ?? 0 }
    override func double(forKey key: String) -> Double { (object(forKey: key) as? NSNumber)?.doubleValue ?? 0 }
    override func set(_ value: Any?, forKey key: String) {
      // Reject even explicit persist() calls, and prevent writes to the legacy
      // preferences backing non-enforcement keys from a snapshot operation.
      if readOnly { dirty = true; return }
      guard owns(key) else { legacy.set(value, forKey: key); return }
      values[key] = value; dirty = true
    }
    override func removeObject(forKey key: String) { set(nil, forKey: key) }
    override func persistentDomain(forName name: String) -> [String: Any]? { name == domain ? values : legacy.persistentDomain(forName: name) }
  }
}
