import Foundation
import CryptoKit

final class EnrollmentBytes: FriendLockProtectedBytes {
  var values: [String: Data] = [:]
  var writes = 0
  var failure: String?
  var lostCommit = false
  func read(_ key: String) throws -> Data? {
    precondition(!FreedProtectionConfigurationLock.isInsideExclusiveAccess || FriendLockEnrollmentPublication.active)
    return values[key]
  }
  func write(_ key: String, _ value: Data) throws {
    writes += 1
    if failure == key { throw FriendLockFailure.storageUnavailable }
    values[key] = value
    if lostCommit, key == "journal", let object = try? JSONSerialization.jsonObject(with: value) as? [String: Any], object["phase"] as? String == "committed" { throw FriendLockFailure.commitOutcomeUnknown }
  }
  func remove(_ key: String) throws { values.removeValue(forKey: key) }
}
final class EnrollmentCrypto: FriendLockCrypto {
  var hook: (() throws -> Void)?
  var derivations = 0
  func random(_ count: Int) throws -> Data { try FixtureCrypto().random(count) }
  func digest(_ data: Data) throws -> Data { try FixtureCrypto().digest(data) }
  func derive(_ secret: String, salt: Data) throws -> Data {
    derivations += 1
    precondition(!Thread.isMainThread && !FreedProtectionConfigurationLock.isInsideExclusiveAccess)
    if let hook { self.hook = nil; try hook() }
    return try FixtureCrypto().derive(secret, salt: salt)
  }
}
@MainActor func runTask91Cases(_ parent: URL) async throws {
  func make(_ name: String, enabled: Bool = true, crypto: EnrollmentCrypto = EnrollmentCrypto()) throws -> (FreedAdultProtectionRuntime, EnrollmentBytes, FixtureOperationBytes, EnrollmentCrypto) {
    let path = parent.appendingPathComponent(name)
    try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
    FreedAdultConfigurationAccess.fixtureContainer = path; DnsFixtureConfigurationLock.useAdultAdapter = true
    try FreedAdultConfigurationAccess.withExclusiveAccess { d in
      try FreedRetainedAdultProtection.stage(.init(continuous: true, encryptedDNS: true, safari: true, riskEnabled: false), d)
      d.set(try JSONSerialization.data(withJSONObject: ["scopeEpoch": 1]), forKey: "freed.appGroups.v1")
      d.set("private-survives", forKey: "fixture.private")
    }
    try Data(#"[{"trigger":{"url-filter":"adult-fixture"},"action":{"type":"block"}}]"#.utf8).write(to: path.appendingPathComponent("safari-content-blocker-rules.json"))
    let providers = FreedAdultSystemProviders(); StubStore.latest!.webContent.blockedByFilter = .auto([], except: [])
    FreedAdultSystemProviders.fixtureAuthorizationApproved = true; SFContentBlockerManager.enabled = true; SFContentBlockerManager.stateError = nil
    let manager = NEDNSSettingsManager.shared()
    let dns = NEDNSOverHTTPSSettings(servers: FreedAdultDNSProfile.servers)
    dns.serverURL = URL(string: FreedAdultDNSProfile.url)!; dns.matchDomains = [""]; dns.matchDomainsNoSearch = true; dns.allowFailover = false
    manager.storedSettings = dns; manager.storedEnabled = true; manager.storedRules = []
    let bytes = EnrollmentBytes(), host = FixtureOperationBytes()
    return (FreedAdultProtectionRuntime.fixture(coreBytes: bytes, operationBytes: host, crypto: crypto, providers: providers, enrollmentEnabled: enabled), bytes, host, crypto)
  }
  defer { FreedAdultConfigurationAccess.fixtureContainer = nil; DnsFixtureConfigurationLock.useAdultAdapter = false }
  func enroll(_ r: FreedAdultProtectionRuntime, _ pin: String = "123456", _ confirmation: String = "123456") async -> [String: Any] { await r.deviceAdultBridge("enroll", ["pin":pin,"confirmation":confirmation]) }
  func check(_ result: [String: Any], _ code: String) { expect(result["code"] as? String == code, "Task91 error \(code)") }
  let (disabled, disabledBytes, _, _) = try make("disabled", enabled: false)
  check(await enroll(disabled), "integrationDisabled"); expect(disabledBytes.writes == 0, "Task91 gate performs zero protected writes")
  for (name, mutate) in [
    ("saved-only", { StubStore.latest!.webContent.blockedByFilter = nil }),
    ("permission", { FreedAdultSystemProviders.fixtureAuthorizationApproved = false }),
    ("dns-disabled", { NEDNSSettingsManager.shared().storedEnabled = false }),
    ("safari-disabled", { SFContentBlockerManager.enabled = false })
  ] {
    let (r,b,_,_) = try make(name); mutate(); check(await enroll(r), "baselineUnavailable"); expect(b.values.isEmpty, "Task91 \(name) cannot publish enrollment")
  }
  let (unknownDNS, unknownDNSBytes, _, _) = try make("unknown-dns")
  NEDNSSettingsManager.shared().storedSettings = NEDNSSettings(servers:["8.8.8.8"])
  check(await enroll(unknownDNS), "invalidReadback"); expect(unknownDNSBytes.writes == 0, "Task91 unrecognized provider cannot enroll")
  let (unknownSafari, unknownSafariBytes, _, _) = try make("unknown-safari")
  SFContentBlockerManager.stateError = NSError(domain:"OSFixture",code:1)
  check(await enroll(unknownSafari), "unavailable"); expect(unknownSafariBytes.writes == 0, "Task91 unknown Safari cannot enroll")
  let (cleanup, cleanupBytes, _, _) = try make("cleanup-unknown")
  try FreedAdultConfigurationAccess.withExclusiveAccess { $0.set(Data([0]),forKey:FreedAccountProtectionCleanup.key) }
  check(await enroll(cleanup), "unavailable"); expect(cleanupBytes.writes == 0, "Task91 corrupt cleanup admission cannot enroll")
  let (reservation, reservationBytes, _, _) = try make("dispatch-unknown")
  try FreedAdultConfigurationAccess.withExclusiveAccess { $0.set(Data([0]),forKey:FreedAdultLayerPermit.reservationKey) }
  check(await enroll(reservation), "interruptedOperation"); expect(reservationBytes.writes == 0, "Task91 retained native dispatch reservation cannot enroll")
  let (invalid, invalidBytes, _, _) = try make("invalid")
  check(await enroll(invalid, "12345"), "invalidPIN"); check(await enroll(invalid, "123456", "654321"), "pinMismatch")
  check(await invalid.deviceAdultBridge("enroll", ["pin":"123456","confirmation":"123456","baseline":"forged"]), "invalidInput")
  expect(invalidBytes.writes == 0, "Task91 invalid PIN never publishes")
  for (name, protected, expected) in [("missing-protected", ["witness":Data([1])], "missingEnrolled"), ("corrupt-protected", ["witness":Data([2])], "corrupt")] {
    let (r,b,_,_) = try make(name); b.values = protected
    check(await enroll(r), expected); expect(b.values == protected && b.writes == 0, "Task91 degraded protected state remains truthful and untouched")
  }
  let (stale,bStale,_,crypto) = try make("stale-kdf")
  crypto.hook = { try FreedAdultConfigurationAccess.withExclusiveAccess { _ = try FreedProtectionConfigurationLock.fenceAdultMutations($0) } }
  check(await enroll(stale), "staleConfiguration"); expect(bStale.writes == 0 && crypto.derivations == 2, "Task91 native change during KDF rejects before protected write")
  let (uncertain,bUncertain,hUncertain,_) = try make("uncertain")
  try await uncertain.initialize(); try uncertain.fixtureOperations.update { $0.authorityUncertain = true }
  check(await enroll(uncertain), "interruptedOperation"); expect(bUncertain.writes == 0 && !hUncertain.values.isEmpty, "Task91 retained uncertainty preserved")
  let (queued, queuedBytes, _, queuedCrypto) = try make("legacy-queued")
  FreedAdultProtectionLegacyGate.fixtureStore = FriendLockRecordStore(bytes: queuedBytes)
  var legacyTask: Task<[String: Any], Never>?
  queuedCrypto.hook = {
    legacyTask = FreedAdultProtectionLegacyGate.enqueueLegacy(key: "task91-legacy") { authority in
      do { try authority.requireUnenrolled(); return ["weakened":true] }
      catch { return ["weakened":false] }
    }
  }
  expect((await enroll(queued))["kind"] as? String == "enrollment", "Task91 queued legacy cannot interrupt enrollment")
  expect((await legacyTask!.value)["weakened"] as? Bool == false, "Task91 stale queued legacy authority cannot weaken after commit")
  FreedAdultProtectionLegacyGate.fixtureStore = nil
  let (held, heldBytes, _, heldCrypto) = try make("competing")
  let entered = DispatchSemaphore(value: 0), release = DispatchSemaphore(value: 0)
  heldCrypto.hook = { entered.signal(); release.wait() }
  let first = Task { await enroll(held) }
  await Task.detached { entered.wait() }.value
  check(await enroll(held), "operationInProgress")
  // Reachable config-holder/status schedule: protected status is queued, while
  // configuration exclusion is released without waiting for Core or MainActor.
  let configEntered = DispatchSemaphore(value: 0), configRelease = DispatchSemaphore(value: 0)
  let configHolder = Task.detached {
    try FreedAdultConfigurationAccess.withExclusiveAccess { _ in configEntered.signal(); configRelease.wait() }
  }
  await Task.detached { configEntered.wait() }.value
  let statusRead = Task { await held.deviceAdultBridge("status", [:]) }
  // Independent release proves Core/config contention does not need MainActor or
  // a nested protected read by the holder to make progress.
  DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) { configRelease.signal() }
  release.signal()
  expect((await first.value)["kind"] as? String == "enrollment", "Task91 competing enrollment publishes once")
  _ = await statusRead.value
  try await configHolder.value
  expect(heldBytes.writes > 0 && !FriendLockEnrollmentPublication.active, "Task91 status/Core/config contention settles without marker leak")
  let (positive,bPositive,host,_) = try make("positive")
  let result = await enroll(positive)
  expect(result["kind"] as? String == "enrollment" && result["keyPresentation"] as? String == "required", "Task91 production runtime enrollment returns unconfirmed key presentation")
  let key = result["recoveryKey"] as! String
  expect(key.count == 64 && !FriendLockEnrollmentPublication.active, "Task91 direct key and no marker leak")
  let protected = bPositive.values, hostSnapshot = host.values
  check(await enroll(positive), "alreadyEnrolled"); expect(bPositive.values == protected && host.values == hostSnapshot, "Task91 retry cannot replace credentials or key")
  let status = await positive.deviceAdultBridge("status", [:])
  expect(status["credential"] as? String == "enrolled" && status["enrollmentAvailable"] as? Bool == false, "Task91 status after lost presentation remains enrolled")
  expect(!String(describing:status).contains(key), "Task91 status never returns key")
  let rotated = await positive.deviceAdultBridge("rotate", ["secretType":"pin","secret":"123456","pin":"654321","confirmation":"654321"])
  expect(rotated["kind"] as? String == "rotation", "Task91 known PIN recovers lost presentation via existing rotation")
  expect(try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedRetainedAdultProtection.read($0).continuous && $0.string(forKey:"fixture.private") == "private-survives" }, "Task91 protection and private data preserved")
  let (lost,bLost,_,_) = try make("lost-commit"); bLost.lostCommit = true
  check(await enroll(lost), "commitOutcomeUnknown"); expect(!FriendLockEnrollmentPublication.active, "Task91 thrown commit clears marker")
  bLost.lostCommit = false
  expect((await lost.deviceAdultBridge("status", [:]))["credential"] as? String == "enrolled", "Task91 lost commit remains positively enrolled")
  let retained = bLost.values; check(await enroll(lost), "alreadyEnrolled"); expect(retained == bLost.values, "Task91 lost commit retry cannot reenroll")
  let (write,bWrite,_,_) = try make("write-failure"); bWrite.failure = "witness"
  check(await enroll(write), "storageUnavailable"); expect(bWrite.values.isEmpty && !FriendLockEnrollmentPublication.active, "Task91 precommit storage failure leaves prior protection and no marker")
  // The compatibility route retains protected exact-once semantics and rejects candidate misuse.
  let c = FriendLockCore(store: FriendLockRecordStore(bytes: EnrollmentBytes()), crypto: FixtureCrypto())
  let baseline = FriendLockBaseline(configuration: try FriendLockConfiguration(revision:"1",mutationGeneration:"1"), adultProtectionInstalled:true,nativeReadback:Data("fixture".utf8))
  let candidate = try await c.deriveEnrollment(pin:"123456",confirmation:"123456",baseline:baseline)
  do { _ = try await c.publishEnrollment(candidate) { _ in }; expect(false,"Task91 wrapper omission must fail") } catch FriendLockFailure.invalidTransition { }
  do { _ = try await c.publishEnrollment(candidate); expect(false,"Task91 candidate cannot retry") } catch FriendLockFailure.storageConflict { }
  let foreign = FriendLockCore(store: FriendLockRecordStore(bytes: EnrollmentBytes()), crypto: FixtureCrypto())
  let other = try await c.deriveEnrollment(pin:"123456",confirmation:"123456",baseline:baseline)
  do { _ = try await foreign.publishEnrollment(other); expect(false,"Task91 foreign issuer must fail") } catch FriendLockFailure.storageConflict { }
  do { _ = try await c.publishEnrollment(other) { _ in throw FriendLockFailure.storageUnavailable }; expect(false,"Task91 wrapper throw must fail") } catch FriendLockFailure.storageUnavailable { }
  expect(!FriendLockEnrollmentPublication.active, "Task91 refusal/throw leaves ordinary protection assertion active")
  print("Task91 actual iOS runtime/coordinator/two-phase Core/store/providers: PASS; explicit fixture gate, OS/protected I/O/KDF substitutions")
}
