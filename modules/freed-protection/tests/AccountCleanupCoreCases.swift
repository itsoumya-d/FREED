import Foundation

@MainActor
func runAccountCleanupCoreCases(_ parent: URL) async throws {
 let path=parent.appendingPathComponent("task82-held-dns")
 try FileManager.default.createDirectory(at:path,withIntermediateDirectories:true)
 FreedAdultConfigurationAccess.fixtureContainer=path;DnsFixtureConfigurationLock.useAdultAdapter=true
 defer{DnsFixtureConfigurationLock.useAdultAdapter=false;FreedAdultConfigurationAccess.fixtureContainer=nil}
 let policy=FreedRetainedAdultProtection.Policy(continuous:true,encryptedDNS:true,safari:true,riskEnabled:false)
 let owner=String(repeating:"a",count:64),binding=UUID().uuidString.lowercased()
 try FreedAdultConfigurationAccess.withExclusiveAccess { d in
  try FreedRetainedAdultProtection.stage(policy,d);d.set(4,forKey:FreedProtectionConfigurationLock.generationKey)
  d.set(try JSONSerialization.data(withJSONObject:["scopeEpoch":1,"generation":4,"ownerDigest":owner]),forKey:"freed.appGroups.v1")
  var journal=FreedAccountProtectionCleanup.Journal();journal.currentBindingID=binding;try FreedAccountProtectionCleanup.stage(journal,d)
  d.set(Data("private".utf8),forKey:"freed.familyActivitySelection")
 }
 try Data(#"[{"trigger":{"url-filter":"adult"},"action":{"type":"block"}}]"#.utf8).write(to:path.appendingPathComponent("safari-content-blocker-rules.json"))
 let providers=FreedAdultSystemProviders();StubStore.latest!.webContent.blockedByFilter = .auto([],except:[])
 let adapter=FreedProductionAdultMutationAdapter(providers:providers),manager=NEDNSSettingsManager.shared()
 let dns=NEDNSOverHTTPSSettings(servers:["1.1.1.3","1.0.0.3","2606:4700:4700::1113","2606:4700:4700::1003"])
 dns.serverURL=URL(string:"https://family.cloudflare-dns.com/dns-query")!;dns.matchDomains=[""];dns.matchDomainsNoSearch=true;dns.allowFailover=false
 manager.storedSettings=dns;manager.storedEnabled=true;manager.storedRules=[]
 let lease=try FreedAdultProtectionLegacyGate.acquireWriter();let initial=try await adapter.snapshot(lease:lease);FreedAdultProtectionLegacyGate.releaseWriter(lease)
 let(core,bytes,records)=try await freshCore()
 _=try await core.enroll(pin:"123456",confirmation:"123456",baseline:FriendLockBaseline(configuration:initial.configuration,adultProtectionInstalled:true,nativeReadback:initial.nativeReadback))
 let operations=fixtureOperations[ObjectIdentifier(core)]!,hostBytes=fixtureOperationBytes[ObjectIdentifier(core)]!
 func coordinator()->FreedAdultProtectionLockCoordinator { FreedAdultProtectionLockCoordinator(core:core,crypto:FixtureCrypto(),adapter:adapter,operations:operations,coreRecords:records) }
 let c=coordinator(),receipt=try await c.prepare(request:.dnsOff)
 _=try await c.authorize(operationID:receipt.operationID,pin:"123456")
 manager.holdRemoval=true
 let task=Task{try await c.execute(operationID:receipt.operationID)}
 while manager.heldRemoval == nil {await Task.yield()}
 bytes.unavailable=true
 let before=Date()
 let cleanup=try FreedAdultConfigurationAccess.withExclusiveAccess { d in
  try FreedAccountProtectionCleanup.prepare(original:.init(ownerDigest:owner,generation:4,scopeEpoch:1),bindingID:binding,resources:.init(),defaults:d)
 }
 _=try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedAccountProtectionCleanup.arm(cleanup.operationID,$0) }
 _=try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedAccountProtectionCleanup.fence(cleanup.operationID,$0) }
 let erased=try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedAccountProtectionCleanup.erase(cleanup.operationID,$0) }
 expect(erased.privateStoreErased && erased.coreInvalidationPending,"Task82 private erase is independent of unavailable Keychain")
 expect(Date().timeIntervalSince(before)<2 && manager.heldRemoval != nil,"Task82 actual held DNS callback cannot delay native privacy erase")
 await rejects("Task82 unavailable core remains pending") { _=try await c.invalidateForPrivateCleanup(operationID:cleanup.operationID) }
 bytes.unavailable=false
 let generation=try records.load()!.authorizationGeneration
 hostBytes.failCleanupAcknowledgement=true
 await rejects("Task82 core committed but host acknowledgement lost") { _=try await c.invalidateForPrivateCleanup(operationID:cleanup.operationID) }
 expect(try records.load()!.authorizationGeneration==generation+1,"Task82 first transition increments core generation once")
 expect(try operations.load().invalidationPending,"Task82 lost acknowledgement retains durable admission exclusion")
 await rejects("Task82 generic invalidate cannot overtake unresolved cleanup") { try await coordinator().invalidate() }
 hostBytes.failCleanupAcknowledgement=false
 let status=try await coordinator().invalidateForPrivateCleanup(operationID:cleanup.operationID)
 expect(status == .acknowledged,"Task82 process-object recreation verifies lost acknowledgement")
 expect(try records.load()!.authorizationGeneration==generation+1,"Task82 acknowledgement retry never blindly invalidates twice")
 let later=try await core.prepare(change:FriendLockAdultChange(action:.disableAdultFilter,fields:["fixture":"later-authority"]),configuration:initial.configuration)
 let epoch=try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedProtectionConfigurationLock.adultMutationEpoch($0) }
 _=try await coordinator().invalidateForPrivateCleanup(operationID:cleanup.operationID)
 expect(try records.load()!.operations.contains(where: { $0.operationID == later.operationID }),"Task82 completed replay retains later protected authority")
 expect(try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedProtectionConfigurationLock.adultMutationEpoch($0) }==epoch,"Task82 exact replay never refences native authority")
 manager.settleRemoval()
 await rejects("Task82 late real DNS callback cannot publish old state") { _=try await task.value }
 try FreedAdultConfigurationAccess.withExclusiveAccess { d in
  expect(FreedRetainedAdultProtection.privateNamespacesAbsent(d),"Task82 no erased authority restoration after late callback")
  expect(try FreedRetainedAdultProtection.read(d)==policy,"Task82 retained adult bytes/intent preserved through held callback")
 }
 // A lost acknowledgement followed by distinguishable later core authority is
 // pending/uncertain; it must never issue another invalidation to erase that work.
 let secondBinding=UUID().uuidString.lowercased(),secondOwner=String(repeating:"b",count:64)
 let second=try FreedAdultConfigurationAccess.withExclusiveAccess { d in
  var journal=try FreedAccountProtectionCleanup.read(d);journal.currentBindingID=secondBinding;try FreedAccountProtectionCleanup.stage(journal,d)
  let generation=FreedProtectionConfigurationLock.generation(d)
  d.set(try JSONSerialization.data(withJSONObject:["scopeEpoch":2,"generation":generation,"ownerDigest":secondOwner]),forKey:"freed.appGroups.v1")
  return try FreedAccountProtectionCleanup.prepare(original:.init(ownerDigest:secondOwner,generation:generation,scopeEpoch:2),bindingID:secondBinding,resources:.init(),defaults:d)
 }
 _=try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedAccountProtectionCleanup.arm(second.operationID,$0) }
 _=try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedAccountProtectionCleanup.fence(second.operationID,$0) }
 _=try FreedAdultConfigurationAccess.withExclusiveAccess { try FreedAccountProtectionCleanup.erase(second.operationID,$0) }
 let beforeSecond=try records.load()!.authorizationGeneration
 hostBytes.failCleanupAcknowledgement=true
 await rejects("Task82 second lost acknowledgement") { _=try await coordinator().invalidateForPrivateCleanup(operationID:second.operationID) }
 hostBytes.failCleanupAcknowledgement=false
 expect(try records.load()!.authorizationGeneration==beforeSecond+1,"Task82 second fault occurs after actual core invalidation")
 let laterUnacknowledged=try await core.prepare(change:FriendLockAdultChange(action:.disableAdultFilter,fields:["fixture":"later-after-ack-loss"]),configuration:initial.configuration)
 let beforeRetry=try records.load()!.authorizationGeneration
 let uncertain=try await coordinator().invalidateForPrivateCleanup(operationID:second.operationID)
 expect(uncertain == .pending,"Task82 indistinguishable later authority leaves cleanup pending")
 expect(try records.load()!.authorizationGeneration==beforeRetry && records.load()!.operations.contains(where:{$0.operationID==laterUnacknowledged.operationID}),"Task82 ambiguous acknowledgement retry preserves later authority")
 expect(try operations.load().authorityUncertain && operations.load().invalidationPending,"Task82 missing-half uncertainty stays sticky while cleanup remains excluded")
 print("Task82 same-core cleanup-ID / held actual DNS / unavailable storage / lost acknowledgement / exact replay: PASS")
}
