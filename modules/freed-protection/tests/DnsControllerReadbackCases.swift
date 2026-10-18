import Foundation
@main struct DnsControllerReadbackCases {
 @MainActor static func main()async throws{
  let c=FreedEncryptedDnsController.shared,m=NEDNSSettingsManager.shared()
  defer{FreedProtectionConfigurationLock.d.removePersistentDomain(forName:FreedProtectionConfigurationLock.appGroupIdentifier)}
  func valid()->NEDNSOverHTTPSSettings{let s=NEDNSOverHTTPSSettings(servers:["1.1.1.3","1.0.0.3","2606:4700:4700::1113","2606:4700:4700::1003"]);s.serverURL=URL(string:"https://family.cloudflare-dns.com/dns-query");s.matchDomains=[""];s.matchDomainsNoSearch=true;s.allowFailover=false;return s}
  func readback(_ result:[String:Any])->[String:Any]{result["configurationReadback"] as! [String:Any]}
  func c1Fix1StatusCases() async throws {
   let key = "freed.encryptedDns.cloudflareFamilies.configured"
   let owner = DNSOwnerBindHarness()
   try FreedProtectionConfigurationLock.withExclusiveAccess { try owner.bindOwner("owner-A", $0) }
   for changedOwner in [false, true] {
    let newerMarker = changedOwner
    m.storedSettings = changedOwner ? nil : valid(); m.storedEnabled = !changedOwner
    let retained = FreedRetainedAdultProtection.Policy(continuous:true,encryptedDNS:true,safari:true,riskEnabled:false)
    try FreedRetainedAdultProtection.stage(retained, FreedProtectionConfigurationLock.d)
    let retainedBytes = FreedProtectionConfigurationLock.d.data(forKey:FreedRetainedAdultProtection.key)
    m.holdLoad = true
    let status = Task { await c.status() }
    for _ in 0..<1000 { if m.heldLoad != nil { break }; await Task.yield() }
    precondition(m.heldLoad != nil, "Public status must be held in its actual preferences load")
    let beforeEpoch = try FreedProtectionConfigurationLock.adultMutationEpoch(FreedProtectionConfigurationLock.d)
    let beforeScope = owner.state.scopeEpoch
    try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
     if changedOwner { try owner.bindOwner("owner-B", defaults) }
     else { try FreedProtectionConfigurationLock.fenceAdultMutations(defaults) }
     defaults.set(newerMarker, forKey:key)
    }
    let afterEpoch = try FreedProtectionConfigurationLock.adultMutationEpoch(FreedProtectionConfigurationLock.d)
    precondition(afterEpoch == beforeEpoch+1 && (!changedOwner || owner.state.scopeEpoch == beforeScope+1), "Actual owner bind or independent fence must revoke the old native epoch")
    m.settleLoad()
    let result = await status.value
    precondition(result["configured"] as? Bool == !newerMarker && readback(result)["freshPreferencesLoaded"] as? Bool == true)
    precondition(FreedProtectionConfigurationLock.d.bool(forKey:key) == newerMarker, "Held public DNS status must not overwrite a newer contradictory marker after native revocation")
    precondition(FreedProtectionConfigurationLock.d.data(forKey:FreedRetainedAdultProtection.key) == retainedBytes, "Public status must preserve retained intent through owner/native epoch changes")
   }
   m.storedSettings=valid();m.storedEnabled=false
   FreedProtectionConfigurationLock.d.set(false,forKey:key)
   let fresh=await c.status()
   precondition(fresh["configured"] as? Bool == true && fresh["enabled"] as? Bool == false && readback(fresh)["configurationValid"] as? Bool == true)
   precondition(!FreedProtectionConfigurationLock.d.bool(forKey:key), "Fresh public DNS status must also remain marker-free")
   m.afterSave = {
    m.afterLoad = {
     do {
      try FreedProtectionConfigurationLock.withExclusiveAccess { defaults in
       try FreedProtectionConfigurationLock.fenceAdultMutations(defaults)
       defaults.set(false,forKey:key)
      }
     } catch { preconditionFailure("Fixture epoch revocation must commit") }
    }
   }
   let revokedConfigure = await c.configure(enabled:true)
   precondition(revokedConfigure["operationAccepted"] as? Bool == false, "Read-only snapshot must preserve explicit configure rejection when final readback crosses an epoch fence")
   precondition(!FreedProtectionConfigurationLock.d.bool(forKey:key), "Revoked configure readback must preserve the newer marker")
   print("C1 Fix1 public DNS status: actual delayed load, independent epoch, actual changed-owner bind, contradictory markers/retained intent and fresh readback: PASS")
  }
  if CommandLine.arguments.contains("--c1-fix1-only") { try await c1Fix1StatusCases(); return }
  func c1Cases() async throws {
   // Actual outer ownership precedes a held fresh observation. Marker metadata
   // must remain untouched, and a queued repair cannot enter the DNS manager.
   let lease = try FreedAdultProtectionLegacyGate.acquireWriter()
   m.storedSettings = nil; m.storedEnabled = false; m.holdLoad = true
   FreedProtectionConfigurationLock.d.set(true, forKey: "freed.encryptedDns.cloudflareFamilies.configured")
   let observation = Task { try await c.observeSettled(lease: lease) }
   for _ in 0..<1000 { if m.heldLoad != nil { break }; await Task.yield() }
   precondition(m.heldLoad != nil, "Settled observation must await the real preferences load")
   let saves = m.saveCount, loads = m.loadCount
   let repair = Task { await c.configure(enabled: true) }
   for _ in 0..<100 { await Task.yield() }
   precondition(m.saveCount == saves && m.loadCount == loads, "A legacy request must wait outside the inner DNS queue while the observer owns outer admission")
   do { _ = try FreedAdultProtectionLegacyGate.withWriter { true }; preconditionFailure("Conflicting synchronous adult mutation must reject busy") }
   catch FreedAdultLockIntegrationFailure.operationInProgress { }
   m.settleLoad()
   let loaded = try await observation.value
   precondition(!loaded.hasSettings && !loaded.enabled && loaded.recognized, "Fresh loaded absence must be a typed OS observation")
   precondition(FreedProtectionConfigurationLock.d.bool(forKey: "freed.encryptedDns.cloudflareFamilies.configured"), "Read-only authority observation must not write setSaved metadata")
   FreedAdultProtectionLegacyGate.releaseWriter(lease)
   let repaired = await repair.value
   precondition(repaired["operationAccepted"] as? Bool == true && m.saveCount == saves + 1, "Queued repair must enter only after outer observation ownership is released")

   // Never-arriving callback until explicitly released: many duplicate callers
   // consume at most sixteen retained observer tasks, including after timeout.
   m.storedSettings = valid(); m.storedEnabled = true; m.holdRemoval = true
   let removed = m.removeCount
   let first = Task { await c.resetConfiguration() }
   for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
   precondition(m.heldRemoval != nil)
   let duplicates = (0..<40).map { _ in Task { await c.resetConfiguration() } }
   for _ in 0..<1000 { if c.retainedCallerObserverCount == 16 { break }; await Task.yield() }
   precondition(c.retainedCallerObserverCount == 16, "Duplicate unresolved caller observers must be bounded at sixteen")
   first.cancel()
   let firstResult = await first.value
   precondition(firstResult["operationPending"] as? Bool == true && firstResult["removed"] as? Bool == false)
   for caller in duplicates { let result = await caller.value; precondition(result["operationPending"] as? Bool == true) }
   precondition(c.retainedCallerObserverCount == 16 && m.removeCount == removed, "Expired/cancelled callers must retain bounded observers and OS ownership")
   do { _ = try FreedAdultProtectionLegacyGate.acquireWriter(); preconditionFailure("DNS timeout must retain outer adult ownership") }
   catch FreedAdultLockIntegrationFailure.operationInProgress { }
   let previous = try FreedProtectionConfigurationLock.adultMutationEpoch(FreedProtectionConfigurationLock.d)
   let revoked = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
   precondition(revoked == previous + 1, "Native revocation must remain available without waiting for the held DNS/adult lane")
   m.duplicateRemovalCallback = true; m.settleRemoval()
   for _ in 0..<1000 { if c.retainedCallerObserverCount == 0 { break }; await Task.yield() }
   precondition(c.retainedCallerObserverCount == 0 && m.removeCount == removed + 1, "Real duplicate callback settles once and releases every bounded observer")
   let retainedAfterRevocation = try FreedRetainedAdultProtection.read(FreedProtectionConfigurationLock.d)
   precondition(retainedAfterRevocation.encryptedDNS, "Native epoch revocation must prevent the old callback from publishing weakened retained DNS intent")
   m.duplicateRemovalCallback = false
   let last = await c.configure(enabled: true)
   precondition(last["operationAccepted"] as? Bool == true)
   m.storedSettings = valid(); m.storedEnabled = true; m.inlineRemovalCompletion = true
   let inline = await c.resetConfiguration()
   precondition(inline["removed"] as? Bool == false && inline["error"] as? String == "ios-reset-dns-remove-not-confirmed", "Inline duplicate success callback without absent OS readback must never accept removal")
   _ = await c.configure(enabled: true)

   // A short transaction may fail after OS registration. Its file error
   // must not release the inner task while the daemon callback is unresolved.
   let failedLease = try FreedAdultProtectionLegacyGate.acquireWriter()
   let failedAuthority = try FreedAdultProtectionLegacyGate.authority(for: failedLease)
   let failedEpoch = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
   m.storedSettings = valid(); m.storedEnabled = true; m.holdRemoval = true
   m.onRemoveRegistration = { FreedProtectionConfigurationLock.failAfterBody = true }
   var failedRegistrationFinished = false
   let failedRegistration = Task {
    let result = await c.resetConfigurationSettled(authority: failedAuthority, generation: FreedProtectionConfigurationLock.currentGeneration, epoch: failedEpoch)
    failedRegistrationFinished = true; return result
   }
   for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
   precondition(m.heldRemoval != nil)
   try await Task.sleep(nanoseconds: 10_000_000)
   precondition(!failedRegistrationFinished, "Failure after registration must retain ownership until actual callback settlement")
   m.settleRemoval()
   let failedResult = await failedRegistration.value
   precondition(failedResult["removed"] as? Bool == false && failedResult["error"] as? String == "ios-reset-dns-preferences-remove-failed", "Settled OS effect with failed dispatch transaction must remain failed")
   FreedAdultProtectionLegacyGate.releaseWriter(failedLease)
   _ = await c.configure(enabled: true)

   // A native-only revocation also distinguishes a fresh legacy request from
   // an old same-kind task even when the global app generation is unchanged.
   m.storedSettings = valid(); m.storedEnabled = true; m.holdRemoval = true
   let oldEpochReset = Task { await c.resetConfiguration() }
   for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
   precondition(m.heldRemoval != nil)
   _ = try FreedProtectionConfigurationLock.withExclusiveAccess { try FreedProtectionConfigurationLock.fenceAdultMutations($0) }
   let freshEpochReset = Task { await c.resetConfiguration() }
   for _ in 0..<100 { await Task.yield() }
   m.settleRemoval()
   let oldEpochResult = await oldEpochReset.value, freshEpochResult = await freshEpochReset.value
   precondition(oldEpochResult["removed"] as? Bool == false && freshEpochResult["removed"] as? Bool == true, "Same-kind request after native epoch change must not alias the invalidated request")
   print("C1 actual DNS: fresh marker-free observation, outer-before-inner ordering, synchronous busy rejection, sixteen-observer bound, real callback ownership and independent epoch revocation: PASS")
  }
  if CommandLine.arguments.contains("--c1-only") { try await c1Cases(); return }
  if CommandLine.arguments.contains("--routing-regression-only"){
   let s=valid();s.matchDomains=["private.example"];m.storedSettings=s;m.storedEnabled=true
   let result=await c.status();precondition(result["configured"] as? Bool==false,"Endpoint matches with incorrect routing must never report configured")
   print("Real controller routing mismatch regression passed");return
  }
  // Fix1: these exercise the actual controller queue, with only OS settlement held.
  func sameKindResetAcrossGeneration() async {
   _ = await c.configure(enabled: true)
   m.storedSettings = valid(); m.storedEnabled = true; m.holdRemoval = true
   let beforeRemovals = m.removeCount
   let older = Task { await c.resetConfiguration() }
   for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
   precondition(m.heldRemoval != nil)
   FreedProtectionConfigurationLock.currentGeneration += 1
   let current = Task { await c.resetConfiguration() }
   for _ in 0..<100 { await Task.yield() }
   precondition(m.removeCount == beforeRemovals, "New-generation reset must wait for actual old callback settlement")
   m.settleRemoval()
   let oldResult = await older.value
   let currentResult = await current.value
   precondition(oldResult["removed"] as? Bool == false, "Old reset must still report invalidated generation")
   precondition(currentResult["removed"] as? Bool == true, "Current-generation same-kind reset must not join the older invalidated task")
   precondition(m.removeCount == beforeRemovals + 1, "Fresh reset may acknowledge observed absence without a second remove")
   print("Fix1 same-kind cross-generation reset: fresh request queues, old task invalidates, fresh absent readback succeeds: PASS")
  }
  func sameKindRepairAcrossGeneration() async {
   _ = await c.configure(enabled: true)
   m.holdSave = true
   let beforeSaves = m.saveCount, beforeRemovals = m.removeCount
   let older = Task { await c.configure(enabled: true) }
   for _ in 0..<1000 { if m.heldSave != nil { break }; await Task.yield() }
   precondition(m.heldSave != nil)
   FreedProtectionConfigurationLock.currentGeneration += 1
   let current = Task { await c.configure(enabled: true) }
   for _ in 0..<100 { await Task.yield() }
   precondition(m.saveCount == beforeSaves + 1, "Current-generation repair must wait behind the actual old save")
   m.settleSave()
   let oldResult = await older.value
   let currentResult = await current.value
   precondition(oldResult["operationAccepted"] as? Bool == false, "Old stronger save must still report invalidated generation")
   precondition(currentResult["operationAccepted"] as? Bool == true, "Current-generation same-kind repair must not join the older invalidated task")
   precondition(m.saveCount == beforeSaves + 2 && m.removeCount == beforeRemovals, "Current-generation stronger repair must save once after old save without removal")
   print("Fix1 same-kind cross-generation stronger repair: fresh request queues and saves last; old stronger layer retained: PASS")
  }
  func cancelLiveCaller() async {
   _ = await c.configure(enabled: true)
   m.storedSettings = valid(); m.storedEnabled = true; m.holdRemoval = true
   var callerFinished = false
   let live = Task { let result = await c.resetConfiguration(); callerFinished = true; return result }
   for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
   precondition(m.heldRemoval != nil && !callerFinished, "Cancellation must target a still-suspended live caller")
   live.cancel()
   let beforeLoads = m.loadCount, beforeSaves = m.saveCount, beforeRemovals = m.removeCount
   let status = await c.status()
   precondition(m.loadCount == beforeLoads && status["operationPending"] as? Bool == true, "Live caller cancellation must retain manager ownership against status")
   let repair = Task { await c.configure(enabled: true) }
   for _ in 0..<100 { await Task.yield() }
   precondition(m.saveCount == beforeSaves && m.removeCount == beforeRemovals, "Live caller cancellation must not admit repair before callback settlement")
   m.settleRemoval()
   _ = await live.value
   let result = await repair.value
   precondition(result["operationAccepted"] as? Bool == true && m.saveCount == beforeSaves + 1 && m.removeCount == beforeRemovals + 1, "Live cancelled caller must leave one ordered removal then repair")
   print("Fix1 active caller cancellation before completion: status remains pending; repair waits for real callback: PASS")
  }
  if CommandLine.arguments.contains("--fix1-reset-only") { await sameKindResetAcrossGeneration(); return }
  if CommandLine.arguments.contains("--fix1-repair-only") { await sameKindRepairAcrossGeneration(); return }
  if CommandLine.arguments.contains("--fix1-cancel-only") { await cancelLiveCaller(); return }
  m.storedSettings=valid();m.storedDescription="FREED DNS";m.storedEnabled=false
  let initial=await c.status(),rb=readback(initial)
  precondition(initial["configured"] as? Bool==true && initial["enabled"] as? Bool==false && initial["healthy"] is NSNull)
  precondition(rb["freshPreferencesLoaded"] as? Bool==true && rb["configurationValid"] as? Bool==true && rb["managerIsEnabled"] as? Bool==false && rb["configurationGeneration"] as? Int==4)
  let count=m.saveCount
  for key in ["domains","search","rules","failover"]{
   let s=valid();m.storedRules=nil
   if key=="domains"{s.matchDomains=["private.example"]};if key=="search"{s.matchDomainsNoSearch=false};if key=="rules"{m.storedRules=[NEOnDemandRule()]};if key=="failover"{s.allowFailover=true}
   m.storedSettings=s;m.storedEnabled=true
   let result=await c.status(),fields=readback(result)
   precondition(result["configured"] as? Bool==false && result["enabled"] as? Bool==false && result["reason"] as? String=="ios-dns-configuration-mismatch")
   precondition(fields["serverURLMatches"] as? Bool==true && fields["serversMatch"] as? Bool==true && fields["configurationValid"] as? Bool==false && fields["managerIsEnabled"] as? Bool==true)
   let json=String(data:try JSONSerialization.data(withJSONObject:result),encoding:.utf8)!;precondition(!json.contains("private.example"),"Raw requested domains cannot enter diagnostic DTOs")
  }
  precondition(m.saveCount==count,"Status validity checking must not rewrite resolver settings")
  m.storedRules=nil;m.storedSettings=valid();m.storedEnabled=false
  let saved=await c.configure(enabled:true),saveFields=readback(saved)
  precondition(saved["operationAccepted"] as? Bool==true && saved["enabled"] as? Bool==false)
  precondition(saveFields["stage"] as? String=="dns-save-readback" && saveFields["configurationValid"] as? Bool==true && UUID(uuidString:saveFields["operationId"] as! String) != nil)
  m.nextSaveError=NSError(domain:"NEDNSSettingsErrorDomain",code:1)
  let failed=await c.configure(enabled:true)
  precondition(failed["operationAccepted"] as? Bool==false && failed["operationErrorDomain"] as? String=="NEDNSSettingsErrorDomain" && failed["operationErrorCode"] as? Int==1)
  precondition(readback(failed)["freshPreferencesLoaded"] as? Bool==false)
  m.nextLoadError=NSError(domain:"NEDNSSettingsErrorDomain",code:3)
  let unread=await c.status();precondition(unread["configured"] as? Bool==false && readback(unread)["freshPreferencesLoaded"] as? Bool==false)
  precondition(unread["operationErrorDomain"] as? String=="NEDNSSettingsErrorDomain" && unread["operationErrorCode"] as? Int==3)
  m.afterSave={FreedProtectionConfigurationLock.currentGeneration += 1}
  let stale=await c.configure(enabled:true);precondition(stale["operationAccepted"] as? Bool==false && stale["reason"] as? String=="ios-reset-dns-configuration-invalidated")
  // 2026-10-13 Task72 retention correction supersedes stale-save removal:
  // generation invalidation reports failure while retaining the stronger saved OS layer.
  precondition(m.removeCount==0,"Stale stronger save must not dispatch OS removal")
  let retained=await c.status();precondition(retained["configured"] as? Bool==true && readback(retained)["managerHasSettings"] as? Bool==true && readback(retained)["freshPreferencesLoaded"] as? Bool==true)
  // Task79A: releasing the controller at the caller deadline must fail this case.
  // The real controller is compiled unchanged; only the OS callback is scripted.
  m.storedSettings = valid(); m.storedEnabled = true
  m.holdRemoval = true; m.duplicateRemovalCallback = true
  let removedBefore = m.removeCount
  let reset = Task { await c.resetConfiguration() }
  for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
  precondition(m.heldRemoval != nil, "Actual reset must dispatch its removal callback")
  let duplicate = Task { await c.resetConfiguration() }
  let timedOut = await reset.value
  precondition(timedOut["removed"] as? Bool != true, "Caller deadline cannot report removal success")
  let loadsBefore = m.loadCount
  let blockedStatus = await c.status()
  precondition(m.loadCount == loadsBefore, "Caller timeout must retain DNS manager ownership until the real callback settles")
  precondition(blockedStatus["operationPending"] as? Bool == true, "Status must report unresolved DNS operation")
  let savesBefore = m.saveCount
  let repair = Task { await c.configure(enabled: true) }
  for _ in 0..<100 { await Task.yield() }
  precondition(m.saveCount == savesBefore, "Stronger repair must not race an unresolved removal")
  m.settleRemoval()
  let repaired = await repair.value
  let duplicateResult = await duplicate.value
  precondition(repaired["operationAccepted"] as? Bool == true, "Queued repair must install after real removal completion")
  precondition(duplicateResult["removed"] as? Bool == true || duplicateResult["operationPending"] as? Bool == true, "Duplicate reset must join the same operation")
  precondition(m.removeCount == removedBefore + 1 && m.saveCount == savesBefore + 1, "Duplicate callbacks and callers must not duplicate OS dispatch")
  let afterRepair = await c.status()
  precondition(afterRepair["configured"] as? Bool == true, "Late removal must settle before stronger save")
  precondition(afterRepair["healthy"] is NSNull, "A saved configuration is not enforced DNS evidence")
  m.duplicateRemovalCallback = false

  // A failed real callback releases ownership, without accepting removal.
  m.storedSettings = valid(); m.storedEnabled = true
  m.holdRemoval = true; m.removalCallbackError = NSError(domain: "NEDNSSettingsErrorDomain", code: 9)
  let failedReset = Task { await c.resetConfiguration() }
  for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
  precondition(m.heldRemoval != nil)
  let repairAfterFailure = Task { await c.configure(enabled: true) }
  for _ in 0..<100 { await Task.yield() }
  m.settleRemoval()
  let failedRemoval = await failedReset.value
  precondition(failedRemoval["removed"] as? Bool == false && failedRemoval["error"] as? String == "ios-reset-dns-preferences-remove-failed", "Failed callback must preserve explicit failure")
  let repairedAfterFailure = await repairAfterFailure.value
  precondition(repairedAfterFailure["operationAccepted"] as? Bool == true, "Actual callback failure must settle ownership for queued repair")
  // A newer acknowledged owner/configuration cannot be overwritten by an old
  // load/removal callback. Assert retained device intent as well as OS dispatch.
  m.storedSettings = valid(); m.storedEnabled = true
  let beforeStaleLoadRemovals = m.removeCount
  m.afterLoad = { FreedProtectionConfigurationLock.currentGeneration += 1 }
  let staleLoadReset = await c.resetConfiguration()
  precondition(m.removeCount == beforeStaleLoadRemovals, "Stale DNS load must not dispatch removal after a generation transition")
  precondition(staleLoadReset["removed"] as? Bool == false)
  m.holdRemoval = true
  let staleReset = Task { await c.resetConfiguration() }
  for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
  precondition(m.heldRemoval != nil)
  FreedProtectionConfigurationLock.currentGeneration += 1
  m.settleRemoval()
  let staleRemovalResult = await staleReset.value
  precondition(staleRemovalResult["removed"] as? Bool == false, "A stale removal callback must not acknowledge a current operation")
  let staleRetained = try FreedRetainedAdultProtection.read(FreedProtectionConfigurationLock.d)
  precondition(staleRetained.encryptedDNS, "A stale removal callback must preserve the newer retained DNS intent")
  let repairNewGeneration = await c.configure(enabled: true)
  precondition(repairNewGeneration["operationAccepted"] as? Bool == true)
  // A reset queued by the prior generation cannot acquire the new generation
  // simply because its predecessor finishes later.
  m.storedSettings = valid(); m.storedEnabled = true; m.holdRemoval = true
  let removalsBeforeQueuedTransition = m.removeCount
  let firstReset = Task { await c.resetConfiguration() }
  for _ in 0..<1000 { if m.heldRemoval != nil { break }; await Task.yield() }
  precondition(m.heldRemoval != nil)
  let currentRepair = Task { await c.configure(enabled: true) }
  for _ in 0..<100 { await Task.yield() }
  let oldQueuedReset = Task { await c.resetConfiguration() }
  for _ in 0..<100 { await Task.yield() }
  FreedProtectionConfigurationLock.currentGeneration += 1
  m.settleRemoval()
  _ = await firstReset.value
  let queuedRepairResult = await currentRepair.value
  precondition(queuedRepairResult["operationAccepted"] as? Bool == true)
  let rejectedQueuedReset = await oldQueuedReset.value
  precondition(rejectedQueuedReset["removed"] as? Bool == false, "Queued old reset must not adopt the next generation")
  precondition(m.removeCount == removalsBeforeQueuedTransition + 1 && m.storedSettings != nil, "Stale queued reset must preserve the stronger queued repair")
  await sameKindResetAcrossGeneration()
  await sameKindRepairAcrossGeneration()
  await cancelLiveCaller()
  try await c1Cases()
  try await c1Fix1StatusCases()
  print("Task79A generation fence: stale loaded snapshot cannot dispatch removal; stale removal cannot republish DNS intent: PASS")
  print("Task79A actual DNS reset: timeout retains manager, duplicate reset joins, duplicate callback settles once, queued stronger repair runs last, failed callback permits queued repair: PASS")
  print("Actual DNS controller with scripted persisted-manager boundary: fresh disabled save, endpoint/routing mismatch, privacy, no status rewrite, load/save NSError, stale generation and stronger-layer retention reload passed")
 }
}
