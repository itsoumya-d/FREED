import Foundation

@MainActor func runTask90Cases(_ parent: URL) async throws {
  let path = parent.appendingPathComponent("device-adult-bridge")
  try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
  FreedAdultConfigurationAccess.fixtureContainer = path
  DnsFixtureConfigurationLock.useAdultAdapter = true
  defer { DnsFixtureConfigurationLock.useAdultAdapter = false; FreedAdultConfigurationAccess.fixtureContainer = nil }
  let policy = FreedRetainedAdultProtection.Policy(continuous: true, encryptedDNS: true, safari: true, riskEnabled: false)
  try FreedAdultConfigurationAccess.withExclusiveAccess { d in
    try FreedRetainedAdultProtection.stage(policy, d)
    d.set(try JSONSerialization.data(withJSONObject: ["scopeEpoch": 1]), forKey: "freed.appGroups.v1")
    d.set("private-owner-must-not-export", forKey: "fixture.private")
  }
  try Data(#"[{"trigger":{"url-filter":"adult-fixture"},"action":{"type":"block"}}]"#.utf8).write(to: path.appendingPathComponent("safari-content-blocker-rules.json"))
  let providers = FreedAdultSystemProviders()
  StubStore.latest!.webContent.blockedByFilter = .auto([], except: [])
  let manager = NEDNSSettingsManager.shared()
  let dns = NEDNSOverHTTPSSettings(servers: ["1.1.1.3","1.0.0.3","2606:4700:4700::1113","2606:4700:4700::1003"])
  dns.serverURL = URL(string: "https://family.cloudflare-dns.com/dns-query")!; dns.matchDomains = [""]; dns.matchDomainsNoSearch = true; dns.allowFailover = false
  manager.storedSettings = dns; manager.storedEnabled = true; manager.storedRules = []
  let bytes = FixtureBytes(), operations = FixtureOperationBytes()
  let runtime = FreedAdultProtectionRuntime.fixture(coreBytes: bytes, operationBytes: operations, crypto: FixtureCrypto(), providers: providers)
  func call(_ command: String, _ input: [String: Any] = [:]) async -> [String: Any] { await runtime.deviceAdultBridge(command, input) }
  func check(_ value: [String: Any], _ key: String, _ expected: String) { expect(value[key] as? String == expected, "Task90 \(key) expected \(expected)") }
  let initial = await call("status"); check(initial,"credential","notEnrolled")
  check(initial,"mutationAvailability","unavailable"); check(initial,"mutationReason","notEnrolled")
  expect(initial["bridgeAvailable"] as? Bool == true, "Task90 bridge reply availability")
  expect(initial["enrollmentAvailable"] as? Bool == false, "Task90 enrollment remains disabled")
  expect(operations.values.isEmpty, "Task90 status must not initialize journal or observe DNS")
  check(await call("enroll"),"code","integrationDisabled")
  check(await call("prepare", ["action":"feed"]),"code","unsupportedAction")
  check(await call("prepare", ["action":"adultReset", "baseline":"forged"]),"code","invalidInput")
  check(await call("read", ["operationID":UUID().uuidString]),"code","invalidInput")
  check(await call("authorize", ["operationID":String(repeating:"a",count:32), "pin":String(repeating:"x",count:500)]),"code","invalidInput")
  try await runtime.initialize()
  let baseline = try await runtime.snapshot()
  // Fixture-only enrollment: public route stays disabled; same runtime's actual Core/store.
  _ = try await runtime.fixtureCore.enroll(pin:"123456",confirmation:"123456",baseline:FriendLockBaseline(configuration:baseline.configuration,adultProtectionInstalled:true,nativeReadback:baseline.nativeReadback))
  check(await call("status"),"credential","enrolled")
  if CommandLine.arguments.contains("--task90-status-only") {
    let enrolled = await call("status"); check(enrolled,"mutationAvailability","unknown"); check(enrolled,"mutationReason","baselineUnobserved")
    let protectedSaved = bytes.values, hostSaved = operations.values
    bytes.unavailable = true
    check(await call("status"),"mutationAvailability","unavailable"); check(await call("status"),"mutationReason","protectedRecordUnavailable")
    bytes.unavailable = false; bytes.values = ["witness":Data([1])]
    check(await call("status"),"credential","missingEnrolled"); check(await call("status"),"mutationAvailability","unavailable")
    bytes.values = ["witness":Data([2])]; check(await call("status"),"credential","corrupt"); check(await call("status"),"mutationAvailability","unavailable")
    bytes.values = protectedSaved; operations.values = [:]
    let missing = await call("status"); check(missing,"credential","enrolled"); check(missing,"mutationAvailability","unavailable"); check(missing,"mutationReason","operationStateUnavailable")
    expect(missing["pendingKnown"] as? Bool == false, "Task90 missing operation status remains unknown")
    operations.values = hostSaved
    try runtime.fixtureOperations.update { $0.authorityUncertain = true }
    check(await call("status"),"mutationAvailability","unavailable")
    operations.values = hostSaved
    try runtime.fixtureOperations.update { $0.invalidationPending = true }
    check(await call("status"),"mutationAvailability","unavailable")
    expect(SFContentBlockerManager.reloadCount == 0, "Task90 status-only path never dispatches Safari")
    print("Task90 iOS explicit bridge/mutation/enrollment status correction: PASS (healthy baseline unknown; degraded/missing/uncertain/invalidation unavailable)")
    return
  }
  let journalSaved = operations.values
  operations.values = [:]
  let missingJournal = await call("status")
  expect(missingJournal["pendingKnown"] as? Bool == false, "Task90 enrolled missing host journal remains unknown")
  check(missingJournal,"credential","enrolled")
  check(await call("prepare",["action":"continuousOff"]),"kind","error")
  expect(operations.values.isEmpty, "Task90 public facade cannot reinitialize enrolled missing journal")
  operations.values = journalSaved
  // Separate fixture graph, before any OS mutation: same native adapter baseline and actual throttle.
  let throttle = FreedAdultProtectionRuntime.fixture(coreBytes: FixtureBytes(), operationBytes: FixtureOperationBytes(), crypto: FixtureCrypto(), providers: providers)
  try await throttle.initialize()
  _ = try await throttle.fixtureCore.enroll(pin:"123456",confirmation:"123456",baseline:FriendLockBaseline(configuration:baseline.configuration,adultProtectionInstalled:true,nativeReadback:baseline.nativeReadback))
  let throttlePrepared = await throttle.deviceAdultBridge("prepare",["action":"continuousOff"])
  let throttleID = throttlePrepared["operationID"] as! String
  for _ in 0..<5 { check(await throttle.deviceAdultBridge("authorize",["operationID":throttleID,"pin":"000000"]),"code","incorrectSecret") }
  check(await throttle.deviceAdultBridge("authorize",["operationID":throttleID,"pin":"123456"]),"code","throttled")
  _ = await throttle.deviceAdultBridge("cancel",["operationID":throttleID])
  let saved = bytes.values
  bytes.unavailable = true; check(await call("status"),"credential","unavailable"); bytes.unavailable = false
  bytes.values = ["witness":Data([1])]; check(await call("status"),"credential","missingEnrolled")
  bytes.values = ["witness":Data([2])]; check(await call("status"),"credential","corrupt"); bytes.values = saved
  let prepared = await call("prepare",["action":"continuousOff"])
  check(prepared,"phase","prepared"); let id = prepared["operationID"] as! String
  check(await call("authorize",["operationID":id,"pin":"000000"]),"code","incorrectSecret")
  check(await call("authorize",["operationID":id,"pin":"123456"]),"phase","authorized")
  check(await call("authorize",["operationID":id,"pin":"123456"]),"phase","authorized")
  let completed = await call("execute",["operationID":id]); check(completed,"phase","completed")
  expect(completed["accepted"] as? Bool == true, "Task90 observed completion")
  check(completed,"currentStatus","unknown")
  expect(completed["historicalResultStale"] is NSNull, "Task90 historical readback not current OS evidence")
  let replay = await call("execute",["operationID":id]); check(replay,"operationID",id); check(replay,"phase","completed")
  let cancelling = await call("prepare",["action":"dnsOff"]); let cancelID = cancelling["operationID"] as! String
  check(await call("cancel",["operationID":cancelID]),"phase","cancelled")
  let pending = await call("prepare",["action":"adultOff"]); let pendingID = pending["operationID"] as! String
  _ = await call("authorize",["operationID":pendingID,"pin":"123456"])
  SFContentBlockerManager.holdReload = true
  let observed = await call("execute",["operationID":pendingID]); check(observed,"observation","pending")
  expect(observed["accepted"] is NSNull, "Task90 timeout cannot claim completion")
  check(await call("read",["operationID":pendingID]),"operationID",pendingID)
  let refused = await call("cancel",["operationID":pendingID]); check(refused,"kind","error")
  SFContentBlockerManager.holdReload = false; let callback = SFContentBlockerManager.pendingReload; SFContentBlockerManager.pendingReload = nil; callback?(nil)
  var late = await call("read",["operationID":pendingID])
  for _ in 0..<200 where late["phase"] as? String != "completed" { try await Task.sleep(nanoseconds:10_000_000); late = await call("read",["operationID":pendingID]) }
  check(late,"phase","completed"); check(late,"operationID",pendingID)
  let rotation = await call("rotate",["secretType":"pin","secret":"123456","pin":"654321","confirmation":"654321"])
  check(rotation,"kind","rotation"); expect((rotation["recoveryKey"] as? String)?.count == 64, "Task90 ephemeral recovery key")
  let status = await call("status")
  let text = String(data:try JSONSerialization.data(withJSONObject:status),encoding:.utf8)!
  expect(!text.contains(rotation["recoveryKey"] as! String) && !text.contains("private-owner") && !text.contains("123456"), "Task90 status redaction")
  check(await call("enroll"),"code","integrationDisabled")
  print("Task90 actual iOS runtime/Core/production adapter bridge: PASS (status/errors/exact auth/replay/cancel/pending/late/rotation/redaction; OS+protected I/O substituted)")
}
