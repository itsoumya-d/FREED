import Foundation

@MainActor
func runC2SystemAdapterCases(_ parent: URL, mode: String = "success") async throws {
  let path = parent.appendingPathComponent("c2-real-provider-" + mode)
  try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
  FreedAdultConfigurationAccess.fixtureContainer = path
  DnsFixtureConfigurationLock.useAdultAdapter = true
  defer { DnsFixtureConfigurationLock.useAdultAdapter = false; FreedAdultConfigurationAccess.fixtureContainer = nil }
  let now = Calendar.current.component(.hour, from: Date()) * 60 + Calendar.current.component(.minute, from: Date())
  let start = mode == "continuousOnly" ? (now + 1439) % 1440 : 1200
  let end = mode == "continuousOnly" ? (now + 60) % 1440 : 1320
  let policy = FreedRetainedAdultProtection.Policy(continuous: true, encryptedDNS: true, safari: true, riskEnabled: true, riskStartMinute: start, riskEndMinute: end)
  try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
    try FreedRetainedAdultProtection.stage(policy, defaults)
    defaults.set(4, forKey: FreedProtectionConfigurationLock.generationKey)
    defaults.set(try JSONSerialization.data(withJSONObject: ["scopeEpoch": 1]), forKey: "freed.appGroups.v1")
    defaults.set(Data("selected-app-preserved".utf8), forKey: "freed.familyActivitySelection")
    defaults.set("independent-focus", forKey: "freed.appGuard.mode")
    defaults.set("adult-setup-metadata", forKey: "freed.safariContentBlocker.version")
  }
  try Data(#"[{"trigger":{"url-filter":"adult-fixture"},"action":{"type":"block"}}]"#.utf8).write(to: path.appendingPathComponent("safari-content-blocker-rules.json"))
  let center = DeviceActivityCenter()
  let schedule = DeviceActivitySchedule(intervalStart: DateComponents(hour:start / 60,minute:start % 60), intervalEnd:DateComponents(hour:end / 60,minute:end % 60), repeats:true)
  try center.startMonitoring(DeviceActivityName("freed.nightGuard"), during:schedule)
  try center.startMonitoring(DeviceActivityName("freed.apps.fixture"), during:schedule)
  let providers = C2CheckingProviders(system: FreedAdultSystemProviders())
  StubStore.latest!.webContent.blockedByFilter = .auto([], except: [])
  let adapter = FreedProductionAdultMutationAdapter(providers: providers)
  let manager = NEDNSSettingsManager.shared()
  let dns = NEDNSOverHTTPSSettings(servers:["1.1.1.3","1.0.0.3","2606:4700:4700::1113","2606:4700:4700::1003"])
  dns.serverURL=URL(string:"https://family.cloudflare-dns.com/dns-query")!;dns.matchDomains=[""];dns.matchDomainsNoSearch=true;dns.allowFailover=false
  manager.storedSettings=dns;manager.storedEnabled=true;manager.storedRules=[]
  let lease = try FreedAdultProtectionLegacyGate.acquireWriter()
  let initial = try await adapter.snapshot(lease:lease)
  let scopeBytes=try FreedAdultConfigurationAccess.withExclusiveAccess{d -> Data in
    let saved=d.data(forKey:"freed.appGroups.v1")!
    d.set(try JSONSerialization.data(withJSONObject:["scopeEpoch":true]),forKey:"freed.appGroups.v1")
    return saved
  }
  await rejects("C2 Boolean app scope cannot masquerade as native integer epoch") {_=try await adapter.snapshot(lease:lease)}
  try FreedAdultConfigurationAccess.withExclusiveAccess{$0.set(scopeBytes,forKey:"freed.appGroups.v1")}
  manager.storedSettings=NEDNSSettings(servers:["foreign-profile"])
  await rejects("C2 unknown loaded DNS profile must reject canonical weakening baseline") {_=try await adapter.snapshot(lease:lease)}
  manager.storedSettings=dns
  let bytes = try Data(contentsOf:path.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName))
  let second = try await adapter.snapshot(lease:lease)
  expect(initial == second, "C2 real canonical snapshot is stable under the same existing lease")
  expect(try Data(contentsOf:path.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)) == bytes, "C2 actual snapshot writes no policy or status marker")
  FreedAdultProtectionLegacyGate.releaseWriter(lease)
  await rejects("C2 released lease cannot observe OS") { _ = try await adapter.snapshot(lease:lease) }
  let runtimeBytes=FixtureBytes(),operationBytes=FixtureOperationBytes()
  let runtime = FreedAdultProtectionRuntime.fixture(coreBytes: runtimeBytes, operationBytes: operationBytes, crypto: FixtureCrypto(), providers: providers)
  try await runtime.initialize()
  let core = runtime.fixtureCore
  fixtureOperations[ObjectIdentifier(core)] = runtime.fixtureOperations
  _ = try await core.enroll(pin:"123456",confirmation:"123456",baseline:FriendLockBaseline(configuration:initial.configuration,adultProtectionInstalled:true,nativeReadback:initial.nativeReadback))
  try await runtime.initialize()
  let coordinator = runtime.coordinator
  runtimeBytes.unavailable=true
  await rejects("C2 runtime protected-data unavailability remains observable") {try await runtime.initialize()}
  runtimeBytes.unavailable=false
  try await runtime.initialize()
  let request = try await coordinator.prepare(request: mode == "continuousOnly" ? .continuousOff : mode == "reset" ? .adultReset : .adultOff)
  _ = try await coordinator.authorize(operationID:request.operationID,pin:"123456")
  let failure = NSError(domain:"C2.PublicAPI",code:17)
  switch mode {
  case "dns": manager.removalCallbackError=failure
  case "safari": SFContentBlockerManager.reloadErrors=[failure,nil]
  case "risk": DeviceActivityCenter.rejectNightStopOnce=true
  case "continuous": StubWebContent.rejectClearOnce=true
  default: break
  }
  let beforeRemovals=manager.removeCount
  manager.duplicateRemovalCallback = mode == "success"
  let result = try await coordinator.execute(operationID:request.operationID)
  manager.duplicateRemovalCallback=false
  if mode == "success" {expect(manager.removeCount==beforeRemovals+1,"C2 exact same-permit enrolled DNS callers join one real removal despite duplicate callback")}
  expect(providers.checked > 0,"C2 every real native entry rejected wrong-layer and forged-before attempts")
  if ["dns","safari","risk","continuous"].contains(mode) {
    expect(!result.accepted && result.stage == .partial, "C2 native layer failure cannot become accepted")
    let saved=try fixtureOperations[ObjectIdentifier(core)]!.required(request.operationID)
    expect(saved.checkpoints.last?.layer.rawValue == mode && saved.checkpoints.last?.state == .failed,"C2 stops forward work at the failed layer")
    expect(saved.compensations.map(\.layer) == saved.checkpoints.map(\.layer).reversed() && saved.compensations.allSatisfy({$0.state == .applied}),"C2 compensation is durable, ordered and limited to owned attempted layers")
    var actual=result.resultingSnapshot.policy;actual.revision=policy.revision
    expect(actual==policy,"C2 exact owned strengthening restores prior retained policy")
    expect(center.schedule(for:DeviceActivityName("freed.apps.fixture"))==schedule,"C2 partial failure preserves independent app monitor")
    expect(try await coordinator.execute(operationID:request.operationID)==result,"C2 failed outcome exact retry retains original bytes")
    print("Task79C2 actual \(mode) failure / owned strengthening compensation / refreshed final CAS: PASS")
    return
  }
  if mode == "continuousOnly" {
    expect(result.accepted && !result.resultingSnapshot.policy.continuous && result.resultingSnapshot.policy.riskEnabled,"C2 continuous-only Off preserves active risk policy")
    expect(StubStore.latest!.webContent.blockedByFilter == .auto([],except:[]),"C2 active risk still requires actual default-store filtering after continuous Off")
    expect(center.schedule(for:DeviceActivityName("freed.nightGuard"))==schedule && manager.storedSettings != nil,"C2 continuous-only Off leaves other installed layers untouched")
    print("Task79C2 actual continuous-only Off retains active risk filter and other layers: PASS")
    return
  }
  expect(result.accepted && !result.resultingSnapshot.policy.continuous && !result.resultingSnapshot.policy.safari && !result.resultingSnapshot.policy.riskEnabled && !result.resultingSnapshot.policy.encryptedDNS, "C2 real four-layer adapter completes compound Off")
  expect(manager.storedSettings == nil && !manager.storedEnabled, "C2 actual DNS callback and fresh load prove absence")
  expect(center.schedule(for:DeviceActivityName("freed.nightGuard")) == nil && center.schedule(for:DeviceActivityName("freed.apps.fixture")) == schedule, "C2 actual monitor stop preserves app monitors")
  try FreedAdultConfigurationAccess.withExclusiveAccess { defaults in
    let publication = try FreedRetainedAdultProtection.SafariPublication.read(defaults)
    expect(publication?.reloadAcknowledged == true, "C2 actual Safari reload acknowledges the exact adult publication")
    expect(defaults.data(forKey:"freed.familyActivitySelection") == Data("selected-app-preserved".utf8) && defaults.string(forKey:"freed.appGuard.mode") == "independent-focus", "C2 Off preserves selected apps and Focus Shield")
    expect(!defaults.bool(forKey:FreedProtectionConfigurationLock.resetMarkerKey), "C2 adult Off never invokes mixed app reset")
    expect(mode == "reset" ? defaults.object(forKey:"freed.safariContentBlocker.version")==nil : defaults.string(forKey:"freed.safariContentBlocker.version")=="adult-setup-metadata","C2 Reset clears adult setup metadata; Off retains reusable setup")
  }
  let saved = try fixtureOperations[ObjectIdentifier(core)]!.required(request.operationID)
  expect(saved.checkpoints.map(\.layer) == [.dns,.safari,.risk,.continuous] && saved.checkpoints.allSatisfy({$0.state == .applied}), "C2 real checkpoint order survives the refreshed final CAS")
  let priorLoads = manager.loadCount, priorReloads=SFContentBlockerManager.reloadCount
  _ = try await coordinator.execute(operationID:request.operationID)
  expect(manager.loadCount == priorLoads && SFContentBlockerManager.reloadCount == priorReloads, "C2 exact completion retry performs zero OS observation or dispatch")
  let consumer=C2ContentBlockerConsumer(),valid=C2ConsumerContext()
  consumer.beginRequest(with:valid)
  expect(valid.data==FreedRetainedAdultProtection.SafariPublication.inert && valid.error==nil,"C2 actual extension consumes adult-only no-op independently of mixed reset")
  let inertPath=path.appendingPathComponent(FreedRetainedAdultProtection.SafariPublication.fileName)
  let inert=try Data(contentsOf:inertPath)
  try FileManager.default.removeItem(at:inertPath)
  let missing=C2ConsumerContext();consumer.beginRequest(with:missing)
  expect(missing.error != nil && missing.data==nil,"C2 missing selected inert payload cannot fall back to stronger or fabricated no-op bytes")
  try inert.write(to:inertPath)
  let savedMarker=try FreedAdultConfigurationAccess.withExclusiveAccess{d -> Data in
    let data=d.data(forKey:FreedRetainedAdultProtection.SafariPublication.key)!
    d.set(Data("corrupt".utf8),forKey:FreedRetainedAdultProtection.SafariPublication.key)
    return data
  }
  let corrupt=C2ConsumerContext();consumer.beginRequest(with:corrupt)
  expect(corrupt.error != nil && corrupt.data==nil,"C2 corrupt adult Safari publication fails closed")
  try FreedAdultConfigurationAccess.withExclusiveAccess{d in
    d.set(savedMarker,forKey:FreedRetainedAdultProtection.SafariPublication.key)
    var publication=try FreedRetainedAdultProtection.SafariPublication.read(d)!
    publication.reloadAcknowledged=false;try publication.stage(d)
  }
  let postKillLease=try FreedAdultProtectionLegacyGate.acquireWriter()
  _=try await adapter.snapshot(lease:postKillLease)
  FreedAdultProtectionLegacyGate.releaseWriter(postKillLease)
  expect(try FreedAdultConfigurationAccess.withExclusiveAccess{try FreedRetainedAdultProtection.SafariPublication.read($0)?.reloadAcknowledged} == false,"C2 later getState observation cannot manufacture a missing reload acknowledgement")
  operationBytes.values.removeValue(forKey:"operations")
  await rejects("C2 enrolled runtime must not bootstrap missing operation storage") {try await runtime.initialize()}
  expect(operationBytes.values["operations"]==nil,"C2 missing enrolled storage stays missing and retryable")
  print("Task79C2 actual production adapter / same-store factory / DNS / Safari / risk / filter providers: PASS (\(mode))")
}

@MainActor
func runC2HeldDNSFenceCase(_ parent: URL, safari: Bool = false) async throws {
  let path = parent.appendingPathComponent(safari ? "c2-held-safari" : "c2-held-dns")
  try FileManager.default.createDirectory(at:path,withIntermediateDirectories:true)
  FreedAdultConfigurationAccess.fixtureContainer=path;DnsFixtureConfigurationLock.useAdultAdapter=true
  defer{DnsFixtureConfigurationLock.useAdultAdapter=false;FreedAdultConfigurationAccess.fixtureContainer=nil}
  let policy=FreedRetainedAdultProtection.Policy(continuous:true,encryptedDNS:true,safari:true,riskEnabled:false)
  try FreedAdultConfigurationAccess.withExclusiveAccess { d in
    try FreedRetainedAdultProtection.stage(policy,d);d.set(4,forKey:FreedProtectionConfigurationLock.generationKey)
    d.set(try JSONSerialization.data(withJSONObject:["scopeEpoch":1]),forKey:"freed.appGroups.v1")
  }
  try Data(#"[{"trigger":{"url-filter":"adult"},"action":{"type":"block"}}]"#.utf8).write(to:path.appendingPathComponent("safari-content-blocker-rules.json"))
  let providers=FreedAdultSystemProviders();StubStore.latest!.webContent.blockedByFilter = .auto([],except:[])
  let adapter=FreedProductionAdultMutationAdapter(providers:providers)
  let manager=NEDNSSettingsManager.shared()
  let dns=NEDNSOverHTTPSSettings(servers:["1.1.1.3","1.0.0.3","2606:4700:4700::1113","2606:4700:4700::1003"])
  dns.serverURL=URL(string:"https://family.cloudflare-dns.com/dns-query")!;dns.matchDomains=[""];dns.matchDomainsNoSearch=true;dns.allowFailover=false
  manager.storedSettings=dns;manager.storedEnabled=true;manager.storedRules=[]
  let lease=try FreedAdultProtectionLegacyGate.acquireWriter();let initial=try await adapter.snapshot(lease:lease);FreedAdultProtectionLegacyGate.releaseWriter(lease)
  let(core,_,_)=try await freshCore()
  _=try await core.enroll(pin:"123456",confirmation:"123456",baseline:FriendLockBaseline(configuration:initial.configuration,adultProtectionInstalled:true,nativeReadback:initial.nativeReadback))
  let coordinator=FreedAdultProtectionLockCoordinator(core:core,crypto:FixtureCrypto(),adapter:adapter,operations:fixtureOperations[ObjectIdentifier(core)]!,coreRecords:fixtureCoreRecords[ObjectIdentifier(core)]!)
  let receipt=try await coordinator.prepare(request:safari ? .adultOff : .dnsOff)
  _=try await coordinator.authorize(operationID:receipt.operationID,pin:"123456")
  manager.holdRemoval = !safari; SFContentBlockerManager.holdReload=safari
  let task=Task{try await coordinator.execute(operationID:receipt.operationID)}
  while safari ? SFContentBlockerManager.pendingReload == nil : manager.heldRemoval == nil {await Task.yield()}
  if !safari {
  let observers=(0..<16).map { _ in Task { await FreedAdultExecutionObserver.wait(task) } }
  observers[0].cancel()
  for observer in observers {
    if case .pending=await observer.value {} else {preconditionFailure("C2 held OS call must return bounded pending")}
  }
  var admittedBeyondCapacity=false
  let saturated=await FreedAdultExecutionObserver.run { admittedBeyondCapacity=true;return try await task.value }
  if case .pending=saturated {} else {preconditionFailure("C2 saturated observer must return pending")}
  for _ in 0..<10 {await Task.yield()}
  expect(!admittedBeyondCapacity,"C2 sixteen pending observers bound admission before creating another waiting execution task")
  }
  await rejects("C2 bounded observation retains original writer lease") {_=try FreedAdultProtectionLegacyGate.acquireWriter()}
  let beforeFence=Date()
  try await coordinator.invalidate()
  expect(Date().timeIntervalSince(beforeFence)<2,"C2 native revocation must complete without waiting for held DNS")
  let epoch=try FreedAdultConfigurationAccess.withExclusiveAccess{try FreedProtectionConfigurationLock.adultMutationEpoch($0)}
  expect(epoch==1,"C2 coordinator fences native authority before host/core invalidation")
  if safari {
    let callback=SFContentBlockerManager.pendingReload;SFContentBlockerManager.pendingReload=nil
    SFContentBlockerManager.holdReload=false;callback?(nil)
  } else {manager.settleRemoval()}
  await rejects("C2 late enrolled callback cannot publish or complete after fence") {_=try await task.value}
  try FreedAdultConfigurationAccess.withExclusiveAccess{d in
    expect(try FreedRetainedAdultProtection.read(d).encryptedDNS == !safari,"C2 stale actual callback retains fenced intent")
    if safari {expect(try FreedRetainedAdultProtection.SafariPublication.read(d)?.reloadAcknowledged == false,"C2 stale enrolled Safari reload cannot acknowledge the staged publication")}
    expect(try FreedRetainedAdultProtection.read(d).continuous,"C2 revocation prevents continuation into untouched continuous protection")
    expect(try FreedProtectionConfigurationLock.adultMutationEpoch(d)==epoch,"C2 stale callback cannot renew its epoch")
  }
  let operation=try fixtureOperations[ObjectIdentifier(core)]!.required(receipt.operationID)
  expect(operation.phase == .dispatchReserved && operation.outcome == nil && operation.checkpoints.last?.state == .reserved,"C2 revoked dispatch remains durably unresolved")
  let removals=manager.removeCount
  await rejects("C2 recreated caller cannot replay revoked dispatch") {_=try await coordinator.execute(operationID:receipt.operationID)}
  expect(manager.removeCount==removals,"C2 revoked retry dispatches zero OS work")
  print("Task79C2 held actual \(safari ? "Safari" : "DNS") / bounded observer / independent native fence / late publication rejection: PASS")
}

func runC2CheckpointCrashCases() async throws {
  for state: FreedAdultCheckpointState in [.reserved,.applied] {
    for after in [false,true] {
      let(core,_,_)=try await freshCore();let adapter=try FixtureAdapter();try await enroll(core,adapter)
      let store=fixtureOperations[ObjectIdentifier(core)]!,bytes=fixtureOperationBytes[ObjectIdentifier(core)]!
      func make()->FreedAdultProtectionLockCoordinator {FreedAdultProtectionLockCoordinator(core:core,crypto:FixtureCrypto(),adapter:adapter,operations:store,coreRecords:fixtureCoreRecords[ObjectIdentifier(core)]!)}
      let receipt=try await make().prepare(request:.continuousOff)
      _=try await make().authorize(operationID:receipt.operationID,pin:"123456")
      if after {bytes.throwAfterCheckpointState=state}else{bytes.failCheckpointState=state}
      await rejects("C2 checkpoint persistence interruption") {_=try await make().execute(operationID:receipt.operationID)}
      bytes.throwAfterCheckpointState=nil;bytes.failCheckpointState=nil
      let before=adapter.calls
      _=try await make().reconcilePending()
      await rejects("C2 persisted checkpoint never reconstructs a restart permit") {_=try await make().execute(operationID:receipt.operationID)}
      expect(adapter.calls==before && before==(state == .reserved ? 0:1),"C2 every checkpoint publication/result gap has zero redispatch")
      expect(try store.required(receipt.operationID).outcome==nil,"C2 interrupted step is not promoted by matching native state")
    }
  }
  print("Task79C2 checkpoint before/after durable reservation/result recreation with zero redispatch: PASS")
}

@MainActor
final class C2CheckingProviders: FreedAdultNativeProviders {
  let system: FreedAdultSystemProviders
  var checked = 0
  init(system: FreedAdultSystemProviders) { self.system=system }
  func localLayers(_ defaults:UserDefaults)throws->[String:Data]{try system.localLayers(defaults)}
  func observeDNS(lease:FreedAdultProtectionLegacyGate.WriterLease)async throws->FreedLoadedDnsObservation{try await system.observeDNS(lease:lease)}
  func observeSafariSettled(lease:FreedAdultProtectionLegacyGate.WriterLease)async throws->Bool{try await system.observeSafariSettled(lease:lease)}
  func perform(_ layer:FreedAdultLayer,permit:FreedAdultLayerPermit)async throws{
    try FreedAdultConfigurationAccess.withExclusiveAccess{d in
      do {try permit.beginDispatch(d,layer:layer == .dns ? .safari:.dns,observed:permit.expectedLayer);preconditionFailure("C2 wrong-layer permit must reject before native registration")} catch {}
      do {try permit.beginDispatch(d,layer:layer,observed:Data("forged-baseline".utf8));preconditionFailure("C2 wrong actual baseline must reject before native registration")} catch {}
    }
    await rejects("C2 forward permit cannot dispatch a compensation action") {try await system.compensate(layer,permit:permit)}
    checked += 1
    if layer == .dns {
      async let first: Void = system.perform(layer,permit:permit)
      async let joined: Void = system.perform(layer,permit:permit)
      _ = try await (first,joined)
    } else {try await system.perform(layer,permit:permit)}
  }
  func compensate(_ layer:FreedAdultLayer,permit:FreedAdultLayerPermit)async throws{
    await rejects("C2 compensation permit cannot dispatch the forward weakening action") {try await system.perform(layer,permit:permit)}
    if layer == .dns {await rejects("C2 lower DNS removal rejects compensation action") {_ = try await FreedAdultDNSProvider.remove(permit:permit,lease:permit.lease)}}
    try await system.compensate(layer,permit:permit)
  }
  func discard(_ operationID:String){system.discard(operationID)}
}

// C2-R1: risk-only filtering survives the gap between reverse continuous and
// risk restoration. All mutations below execute the actual system providers.
@MainActor
func runC2RiskOnlyCompensationCase(_ parent: URL, mode: String) async throws {
  let path = parent.appendingPathComponent("c2-risk-only-compensation-" + mode)
  try FileManager.default.createDirectory(at: path, withIntermediateDirectories: true)
  FreedAdultConfigurationAccess.fixtureContainer = path
  DnsFixtureConfigurationLock.useAdultAdapter = true
  defer {
    DnsFixtureConfigurationLock.useAdultAdapter = false
    FreedAdultConfigurationAccess.fixtureContainer = nil
    StubWebContent.rejectClearOnce = false; StubWebContent.rejectInstallOnce = false
  }
  let minute = Calendar.current.component(.hour, from: Date()) * 60 + Calendar.current.component(.minute, from: Date())
  let start = (minute + 1439) % 1440, end = (minute + 60) % 1440
  let policy = FreedRetainedAdultProtection.Policy(continuous: false, encryptedDNS: true, safari: true,
    riskEnabled: true, riskStartMinute: start, riskEndMinute: end)
  try FreedAdultConfigurationAccess.withExclusiveAccess { d in
    try FreedRetainedAdultProtection.stage(policy, d)
    d.set(4, forKey: FreedProtectionConfigurationLock.generationKey)
    d.set(try JSONSerialization.data(withJSONObject: ["scopeEpoch": 1]), forKey: "freed.appGroups.v1")
  }
  try Data(#"[{"trigger":{"url-filter":"adult-fixture"},"action":{"type":"block"}}]"#.utf8).write(to: path.appendingPathComponent("safari-content-blocker-rules.json"))
  let center = DeviceActivityCenter()
  let schedule = DeviceActivitySchedule(intervalStart: DateComponents(hour: start / 60, minute: start % 60),
    intervalEnd: DateComponents(hour: end / 60, minute: end % 60), repeats: true)
  try center.startMonitoring(DeviceActivityName("freed.nightGuard"), during: schedule)
  try center.startMonitoring(DeviceActivityName("freed.apps.fix1"), during: schedule)
  let providers = C2RiskCompensationProviders(mode: mode)
  let web = StubStore.latest!.webContent
  web.blockedByFilter = .auto([], except: [])
  let manager = NEDNSSettingsManager.shared()
  let dns = NEDNSOverHTTPSSettings(servers: ["1.1.1.3", "1.0.0.3", "2606:4700:4700::1113", "2606:4700:4700::1003"])
  dns.serverURL = URL(string: "https://family.cloudflare-dns.com/dns-query")!
  dns.matchDomains = [""]; dns.matchDomainsNoSearch = true; dns.allowFailover = false
  manager.storedSettings = dns; manager.storedEnabled = true; manager.storedRules = []
  let adapter = FreedProductionAdultMutationAdapter(providers: providers)
  let lease = try FreedAdultProtectionLegacyGate.acquireWriter()
  let initial = try await adapter.snapshot(lease: lease)
  FreedAdultProtectionLegacyGate.releaseWriter(lease)
  let (core, _, _) = try await freshCore()
  _ = try await core.enroll(pin: "123456", confirmation: "123456", baseline: FriendLockBaseline(configuration: initial.configuration, adultProtectionInstalled: true, nativeReadback: initial.nativeReadback))
  let operations = fixtureOperations[ObjectIdentifier(core)]!
  let coordinator = FreedAdultProtectionLockCoordinator(core: core, crypto: FixtureCrypto(), adapter: adapter,
    operations: operations, coreRecords: fixtureCoreRecords[ObjectIdentifier(core)]!)
  let request = try await coordinator.prepare(request: .adultOff)
  _ = try await coordinator.authorize(operationID: request.operationID, pin: "123456")
  StubWebContent.rejectClearOnce = true
  if mode == "stale" {
    await rejects("C2-R1 revoked risk compensation cannot publish an outcome") { _ = try await coordinator.execute(operationID: request.operationID) }
    let saved = try operations.required(request.operationID)
    expect(saved.outcome == nil && saved.compensations.last?.state == .reserved, "C2-R1 revoked compensation remains unresolved, never applied")
    expect(providers.staleDispatchRejected && providers.compensationLayers == [.continuous, .risk], "C2-R1 stale lower permit rejects before filter or monitor mutation")
    let calls = providers.calls
    await rejects("C2-R1 revoked compensation retry cannot redispatch") { _ = try await coordinator.execute(operationID: request.operationID) }
    expect(providers.calls == calls, "C2-R1 revoked retry performs zero provider work")
  } else {
    let result = try await coordinator.execute(operationID: request.operationID)
    let saved = try operations.required(request.operationID)
    expect(!result.accepted && result.stage == .partial && saved.checkpoints.last?.layer == .continuous && saved.checkpoints.last?.state == .failed, "C2-R1 forward clear rejection remains the original compound failure")
    expect(providers.survivingFilterPreserved, "C2-R1 continuous compensation must never clear the surviving risk-only filter")
    if mode == "rejectRestore" {
      expect(saved.compensations.map(\.layer) == [.continuous, .risk] && saved.compensations.last?.state == .failed, "C2-R1 rejected risk filter restoration must be failed, never acknowledged applied")
      expect(web.blockedByFilter == nil && providers.riskRestoreWrites == 1, "C2-R1 failed filter setter readback remains truthful without invented restoration")
    } else {
      expect(saved.compensations.map(\.layer) == [.continuous, .risk, .safari, .dns] && saved.compensations.allSatisfy { $0.state == .applied }, "C2-R1 risk-only compensation completes in owned reverse order")
      expect(web.blockedByFilter == .auto([], except: []) && providers.riskRestoreWrites == 1, "C2-R1 risk restoration synchronously reapplies and verifies its effective filter")
      expect(center.schedule(for: DeviceActivityName("freed.nightGuard")) == schedule, "C2-R1 restored risk monitor retains its exact schedule")
      var restored = result.resultingSnapshot.policy; restored.revision = policy.revision
      expect(restored == policy, "C2-R1 final retained policy restores risk-only baseline")
    }
    let calls = providers.calls, removes = manager.removeCount, loads = manager.loadCount, reloads = SFContentBlockerManager.reloadCount, writes = web.attemptedValues.count
    expect(try await coordinator.execute(operationID: request.operationID) == result, "C2-R1 exact retry returns the original failed outcome bytes")
    expect(providers.calls == calls && manager.removeCount == removes && manager.loadCount == loads && SFContentBlockerManager.reloadCount == reloads && web.attemptedValues.count == writes, "C2-R1 exact outcome retry performs zero native observation or redispatch")
  }
  expect(center.schedule(for: DeviceActivityName("freed.apps.fix1")) == schedule, "C2-R1 all compensation outcomes preserve independent app monitoring")
  print("C2-R1 actual risk-only compensation / \(mode): PASS")
}

@MainActor
final class C2RiskCompensationProviders: FreedAdultNativeProviders {
  let system = FreedAdultSystemProviders()
  let mode: String
  var calls = 0, riskRestoreWrites = 0
  var survivingFilterPreserved = false, staleDispatchRejected = false
  var compensationLayers: [FreedAdultLayer] = []
  init(mode: String) { self.mode = mode }
  func localLayers(_ d: UserDefaults) throws -> [String: Data] { try system.localLayers(d) }
  func observeDNS(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> FreedLoadedDnsObservation { try await system.observeDNS(lease: lease) }
  func observeSafariSettled(lease: FreedAdultProtectionLegacyGate.WriterLease) async throws -> Bool { try await system.observeSafariSettled(lease: lease) }
  func perform(_ layer: FreedAdultLayer, permit: FreedAdultLayerPermit) async throws { calls += 1; try await system.perform(layer, permit: permit) }
  func compensate(_ layer: FreedAdultLayer, permit: FreedAdultLayerPermit) async throws {
    calls += 1; compensationLayers.append(layer)
    let web = StubStore.latest!.webContent, writeCount = StubStore.latest!.webContent.attemptedValues.count
    if layer == .risk {
      if mode == "restore" || mode == "rejectRestore" {
        // Public OS seam: filtering disappeared after reservation, before the
        // synchronous risk restore. The provider must install and verify it.
        web.simulateExternalFilterLoss()
        StubWebContent.rejectInstallOnce = mode == "rejectRestore"
      }
      if mode == "stale" {
        try FreedAdultConfigurationAccess.withExclusiveAccess { d in
          _ = try FreedProtectionConfigurationLock.fenceAdultMutations(d)
        }
        let stopped = DeviceActivityCenter.stopped, schedule = DeviceActivityCenter().schedule(for: DeviceActivityName("freed.nightGuard"))
        do { try await system.compensate(layer, permit: permit); preconditionFailure("C2-R1 stale risk compensation must reject") }
        catch {
          staleDispatchRejected = web.attemptedValues.count == writeCount && DeviceActivityCenter.stopped == stopped && DeviceActivityCenter().schedule(for: DeviceActivityName("freed.nightGuard")) == schedule
          throw error
        }
      }
      defer { riskRestoreWrites = web.attemptedValues.count - writeCount }
      try await system.compensate(layer, permit: permit)
    } else {
      try await system.compensate(layer, permit: permit)
    }
    if layer == .continuous {
      survivingFilterPreserved = web.blockedByFilter == .auto([], except: []) && web.attemptedValues.dropFirst(writeCount).allSatisfy { $0 } && web.resultingValues.dropFirst(writeCount).allSatisfy { $0 }
      expect(survivingFilterPreserved, "C2-R1 continuous compensation must never clear the surviving risk-only filter")
    }
  }
  func discard(_ operationID: String) { system.discard(operationID) }
}
