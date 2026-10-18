package app.freed.protection

import android.content.Context
import android.content.Intent

private fun fresh(): Context {
  // Drain the previous simulated process before replacing its shared OS/key adapter.
  (FreedAdultAuthorizationExecutor::class.java.getDeclaredField("instance").apply { isAccessible = true }.get(null) as? FreedAdultAuthorizationExecutor)
    ?.worker?.submit { Unit }?.get()
  RecordFixture.error = null; RecordFixture.values.clear()
  // Each fresh OS fixture is a new application process/storage sandbox.
  FreedAdultAuthorizationExecutor::class.java.getDeclaredField("instance").apply { isAccessible = true }.set(null, null)
  val context = Context()
  FreedAdultDomainFeed.configure(context, listOf("one.example", "two.example"), "fixture", "checksum", "now")
  FreedAdultDomainFeed.configureUserAllowedDomains(context, listOf("allowed.example"))
  check(FreedEncryptedDnsConfig.setRequested(context, true))
  FreedVpnService.setUserEnabled(context, true)
  FreedVpnService.isRunning = true
  FreedVpnService.liveService = FreedVpnService()
  FreedVpnService.activeRuntimeService = FreedVpnService.liveService
  FreedVpnService.serviceOwners.clear(); FreedVpnService.runtimeOwners.clear()
  FreedVpnService.serviceOwners.add(FreedVpnService.liveService!!)
  FreedVpnService.runtimeOwners.add(FreedVpnService.liveService!!.runtimeOwnership)
  return context
}
private fun enrolled() {
  val record = FriendLockRecord("0".repeat(64), FriendLockVerifier(ByteArray(16), ByteArray(32)), FriendLockVerifier(ByteArray(16), ByteArray(32)))
  FriendLockRecordStore(RecordFixture).publish(record, null)
}
private fun unchanged(context: Context, action: () -> Unit) {
  val before = context.namespaces.mapValues { it.value.all }
  val commits = context.namespaces.mapValues { it.value.commits }
  try { action(); error("weakening should fail") } catch (_: FreedAdultMutationFailure) { }
  check(context.namespaces.mapValues { it.value.all } == before)
  check(context.namespaces.mapValues { it.value.commits } == commits)
  check(FreedVpnService.isRunning)
}
fun main() {
  for (state in listOf("enrolled", "missing", "corrupt", "unavailable")) {
    val context = fresh()
    if (state == "enrolled") enrolled() else RecordFixture.error = when (state) {
      "missing" -> FriendLockError.MISSING_ENROLLED
      "corrupt" -> FriendLockError.CORRUPT
      else -> FriendLockError.STORAGE_UNAVAILABLE
    }
    unchanged(context) { FreedVpnService.setUserEnabled(context, false) }
    unchanged(context) { FreedEncryptedDnsConfig.setRequested(context, false) }
    unchanged(context) { FreedEncryptedDnsConfig.clearOwnedConfiguration(context) }
    unchanged(context) { FreedAdultDomainFeed.configure(context, listOf("one.example"), "new", "new", "later") }
    unchanged(context) { FreedAdultDomainFeed.configureUserAllowedDomains(context, listOf("allowed.example", "new.example")) }
    unchanged(context) { FreedVpnService.stopOwnedRuntimeForReset(context) }
    val before = context.namespaces.mapValues { it.value.all }
    val resetCalls = FreedAccessibilityService.clears
    check(!FreedProtectionConfiguration.reset(context).accepted)
    check(FreedAccessibilityService.clears == resetCalls)
    check(context.namespaces.mapValues { it.value.all } == before)
    val module = ModuleAdapter(AppContext(context))
    val stop = module.stop()
    check(stop["active"] == true && (stop["adultMutationReceipt"] as Map<*, *>)["accepted"] == false)
    check((stop["adultMutationReceipt"] as Map<*, *>)["scope"] == "dns-guard")
    check(module.feed(listOf("one.example"), "new", "new", "later")["adultMutationAccepted"] == false)
    check(module.allowed(listOf("allowed.example", "new.example"))["adultMutationAccepted"] == false)
    check(module.reset()["protectionConfigurationResetAccepted"] == false)
    check(module.reset()["adultFilterActive"] == true)
    check(module.encrypted(mapOf("enabled" to false, "provider" to "cloudflare-families"))["error"] is String)
    check(context.namespaces.mapValues { it.value.all } == before)
    // Direct service action is also gated; rejecting it must not trigger onDestroy through stopSelf.
    val service = FreedVpnService(); service.namespaces.putAll(context.namespaces)
    check(service.onStartCommand(Intent().apply { action = FreedVpnService.ACTION_STOP }, 0, 1) == FreedVpnService.START_STICKY)
    check(service.closeCalls == 0 && service.selfStops == 0)
    check(context.namespaces.mapValues { it.value.all } == before)
    // Stronger feed coverage and fewer bypass exceptions remain usable through unreadable lock state.
    FreedAdultDomainFeed.configure(context, listOf("one.example", "two.example", "three.example"), "stronger", "x", "now")
    check(FreedAdultDomainFeed.configureUserAllowedDomains(context, emptyList()).isEmpty())
    check(FreedEncryptedDnsConfig.setRequested(context, true))
    context.getSharedPreferences("owned", 0).values[FreedProtectionConfiguration.INTERCEPTION_DISABLED] = true
    check(module.feed(listOf("one.example", "two.example", "three.example", "four.example"), "repair", "x", "now")["adultMutationAccepted"] != false)
    check(module.allowed(emptyList())["adultMutationAccepted"] != false)
    check(FreedEncryptedDnsConfig.setRequested(context, true))
    context.getSharedPreferences("owned", 0).values[FreedProtectionConfiguration.INTERCEPTION_DISABLED] = false
  }
  var context = fresh()
  val module = ModuleAdapter(AppContext(context))
  FreedVpnService.liveService!!.closeAccepted = false
  val failedStop = module.stop()
  // Actual closer marks packet processing stopped before resource close; the old fake
  // incorrectly retained isRunning=true on close failure. The all-layer Off check
  // must still remain false until every retained resource owner is confirmed closed.
  check(failedStop["active"] == false && (failedStop["adultMutationReceipt"] as Map<*, *>)["runtimeStopped"] == false)
  check(FreedAdultProtectionState.status(context, true, true)["freedAdultProtectionOff"] == false)
  check((failedStop["adultMutationReceipt"] as Map<*, *>)["reason"] == "adult-runtime-stop-unconfirmed")
  check(FreedVpnService.liveService!!.selfStops == 1) // actual stop request ran; observed runtime still failed.
  FreedVpnService.liveService!!.closeAccepted = true
  val stopped = module.stop()
  check(stopped["active"] == false && (stopped["adultMutationReceipt"] as Map<*, *>)["runtimeStopped"] == true)
  check(FreedVpnService.dnsGuardLastStopReason == FreedVpnService.STOP_REASON_MANUAL)
  check((stopped["adultMutationReceipt"] as Map<*, *>)["scope"] == "dns-guard")
  check((stopped["adultMutationReceipt"] as Map<*, *>)["operation"] == "stop-dns-guard")
  context = fresh(); enrolled()
  val service = FreedVpnService(); service.namespaces.putAll(context.namespaces)
  FreedVpnService.activeRuntimeService = service
  service.onRevoke()
  check(FreedVpnService.isUserEnabled(context))
  check(!FreedVpnService.isRunning && FreedVpnService.lastAdultStopReceipt["systemControlled"] == true)
  check(FreedVpnService.lastAdultStopReceipt["status"] == "needs-attention")
  FreedVpnService.isRunning = true
  FreedVpnService.activeRuntimeService = service
  service.onDestroy()
  check(FreedVpnService.isUserEnabled(context) && !FreedVpnService.isRunning)
  check(FreedVpnService.lastAdultStopReceipt["reason"] == "service-destroyed")
  check(FreedVpnService.lastAdultStopReceipt["systemControlled"] == true)
  context = fresh()
  val storage = context.getSharedPreferences("owned", 0)
  storage.fail = true
  try { FreedVpnService.setUserEnabled(context, false); error("failed native commit must fail visibly") }
  catch (failure: FreedAdultMutationFailure) { check(failure.code == "adult-intent-save-unconfirmed") }
  storage.fail = false
  storage.corruptKey = FreedAdultDomainFeed.DOMAINS_KEY
  try { FreedAdultDomainFeed.configure(context, listOf("one.example", "two.example", "three.example"), "x", "x", "x"); error("readback must fail") }
  catch (failure: FreedAdultMutationFailure) { check(failure.code == "adult-feed-save-unconfirmed") }
  context = fresh()
  check(FreedEncryptedDnsConfig.setRequested(context, false))
  check(FreedEncryptedDnsConfig.clearOwnedConfiguration(context))
  check(FreedAdultDomainFeed.configureUserAllowedDomains(context, listOf("new.example")).contains("new.example"))
  FreedAdultDomainFeed.configure(context, listOf("one.example"), "weaker", "x", "now")
  check(FreedAdultDomainFeed.domainCount(context) == 1)
  // Unknown record/read errors cannot be interpreted as unenrolled.
  val gate = FreedAdultMutationGate { throw IllegalStateException("read failed") }
  try { gate.requireUnenrolled(FriendLockAction.DISABLE_ADULT_FILTER); error("read error permit") }
  catch (failure: FreedAdultMutationFailure) { check(failure.code == "adult-lock-storage-unavailable") }
  // Actual service resource closer and all-owner census, with only resource I/O substituted.
  context = fresh()
  val oldOwner = FreedVpnService.liveService!!
  val newerOwner = FreedVpnService()
  oldOwner.vpnInterface = android.os.ParcelFileDescriptor()
  oldOwner.output = FixtureOutput().apply { fail = true }
  newerOwner.vpnInterface = android.os.ParcelFileDescriptor()
  newerOwner.output = FixtureOutput()
  FreedVpnService.serviceOwners.add(newerOwner); FreedVpnService.runtimeOwners.add(newerOwner.runtimeOwnership)
  FreedVpnService.activeRuntimeService = newerOwner; FreedVpnService.liveService = newerOwner
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == false)
  check(oldOwner.output != null && !oldOwner.ownerCloseSucceeded)
  check(newerOwner.vpnInterface == null && newerOwner.output == null)
  (oldOwner.output as FixtureOutput).fail = false
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)
  check(FreedVpnService.serviceOwners.isEmpty() && FreedVpnService.runtimeOwners.isEmpty())

  context = fresh()
  val closing = FreedVpnService.liveService!!
  closing.vpnInterface = android.os.ParcelFileDescriptor().apply { fail = true }
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == false)
  check(closing.vpnInterface != null)
  closing.vpnInterface!!.fail = false
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)

  context = fresh()
  val original = FreedVpnService.liveService!!
  val descriptor = android.os.ParcelFileDescriptor(); original.vpnInterface = descriptor
  val replacement = FreedVpnService()
  FreedVpnService.serviceOwners.add(replacement); FreedVpnService.activeRuntimeService = replacement
  original.finishForCase(descriptor)
  check(FreedVpnService.isRunning && original.foregroundStops == 0)
  check(original.vpnInterface == null && replacement.foregroundStops == 0)

  context = fresh()
  val racing = FreedVpnService.liveService!!
  racing.closeHook = {
    val arriving = FreedVpnService()
    FreedVpnService.serviceOwners.add(arriving); FreedVpnService.runtimeOwners.add(arriving.runtimeOwnership)
  }
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == false)

  context = fresh()
  val repairContext = context
  FreedVpnService.liveService!!.closeHook = { FreedVpnService.setUserEnabled(repairContext, true) }
  val superseded = FreedVpnService.requestAdultStop(context)
  check(superseded["reason"] == "adult-stop-superseded" && FreedVpnService.isUserEnabled(context))
  println("PASS actual all-instance teardown: old output failure, descriptor failure, old reader after replacement, new owner during close, repair during close")

  context = fresh()
  val blockedOwner = FreedVpnService.liveService!!
  val started = java.util.concurrent.CountDownLatch(1); val releaseWorker = java.util.concurrent.CountDownLatch(1)
  val workerEpoch = blockedOwner.runtimeOwnership.beginEpoch()
  blockedOwner.runtimeOwnership.startThread(workerEpoch, "fixture-blocked-worker") {
    started.countDown()
    while (releaseWorker.count > 0) try { releaseWorker.await() } catch (_: InterruptedException) { }
  }
  check(started.await(1, java.util.concurrent.TimeUnit.SECONDS))
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == false)
  check(blockedOwner in FreedVpnService.serviceOwners && blockedOwner.runtimeOwnership in FreedVpnService.runtimeOwners)
  releaseWorker.countDown()
  check(blockedOwner.runtimeOwnership.awaitStopped(1_000))
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)

  context = fresh()
  android.os.Looper.background = true; android.os.Handler.mode = "queued"
  val queuedOwner = FreedVpnService.liveService!!
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == false)
  check(FreedVpnService.runtimeStops.get() == 0 && queuedOwner.closeCalls == 0)
  val delayed = android.os.Handler.last!!
  FreedVpnService.setUserEnabled(context, true)
  delayed.run()
  check(queuedOwner.closeCalls == 0 && FreedVpnService.isUserEnabled(context))
  android.os.Looper.background = false; android.os.Handler.mode = "immediate"

  context = fresh()
  val timeoutContext = context
  val closingOwner = FreedVpnService.liveService!!
  val closeBegan = java.util.concurrent.CountDownLatch(1); val finishClose = java.util.concurrent.CountDownLatch(1)
  closingOwner.closeHook = { closeBegan.countDown(); finishClose.await() }
  android.os.Looper.background = true; android.os.Handler.mode = "async"
  val timedCaller = Thread { FreedVpnService.requestAdultStop(timeoutContext) }
  timedCaller.start(); check(closeBegan.await(1, java.util.concurrent.TimeUnit.SECONDS))
  timedCaller.join(6_500); check(!timedCaller.isAlive)
  check(FreedVpnService.runtimeStops.get() == 1 && !FreedVpnService.ownedRuntimeCanReactivate()) {
    "Timed out caller must not release runtime admission before the running callback finishes"
  }
  FreedVpnService.setUserEnabled(context, true)
  finishClose.countDown()
  repeat(200) { if (FreedVpnService.runtimeStops.get() != 0) Thread.sleep(5) }
  check(FreedVpnService.runtimeStops.get() == 0 && FreedVpnService.isUserEnabled(context))
  android.os.Looper.background = false; android.os.Handler.mode = "immediate"
  println("PASS actual worker join failure/retention/retry, cancelled queued callback, running post-timeout callback admission fence")

  context = fresh()
  val starting = FreedVpnService.liveService!!
  starting.namespaces.putAll(context.namespaces)
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)
  starting.startForCase()
  check(starting.established == 0 && !FreedVpnService.isRunning) { "Old queued start after Off must not establish" }
  FreedVpnService.setUserEnabled(context, true)
  starting.startForCase()
  check(starting.established == 1 && FreedVpnService.isRunning && starting.vpnInterface != null && starting.output != null)
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)
  check(starting.vpnInterface == null && starting.output == null && starting.runtimeOwnership.isStopped())
  val establishRace = FreedVpnService(); establishRace.namespaces.putAll(context.namespaces)
  FreedVpnService.setUserEnabled(context,true)
  establishRace.establishHook = { FreedVpnService.setUserEnabled(context,false) }
  establishRace.startForCase()
  check(establishRace.established == 1 && establishRace.vpnInterface == null && !FreedVpnService.isRunning)
  for (generationOnly in listOf(false,true)) {
    context = fresh()
    check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)
    FreedVpnService.setUserEnabled(context,true)
    val rejected = FreedVpnService(); rejected.namespaces.putAll(context.namespaces)
    val rejectedDescriptor = android.os.ParcelFileDescriptor().apply { fail=true }
    rejected.descriptorForEstablish = rejectedDescriptor
    val concurrentContext = context
    rejected.establishHook = {
      val change = Thread { FreedVpnService.setUserEnabled(concurrentContext,generationOnly) }
      change.start(); change.join(2_000); check(!change.isAlive)
    }
    rejected.startForCase()
    check(rejectedDescriptor.closeCalls == 1 && !rejectedDescriptor.closed)
    check(rejected in FreedVpnService.serviceOwners && !FreedVpnService.ownedRuntimeCanReactivate()) {
      "Rejected established descriptor with failed close was forgotten (generationOnly=$generationOnly)"
    }
    check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == false)
    check(rejectedDescriptor.closeCalls >= 2 && !rejectedDescriptor.closed)
    rejectedDescriptor.fail=false
    check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)
    check(rejectedDescriptor.closed && rejectedDescriptor.closeCalls >= 3 && FreedVpnService.ownedRuntimeCanReactivate())
    check(FreedAdultProtectionState.read(context).accessibility)
  }
  context = fresh()
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true)
  FreedVpnService.setUserEnabled(context,true)
  val retaining = FreedVpnService(); retaining.namespaces.putAll(context.namespaces)
  val alreadyOwned = android.os.ParcelFileDescriptor(); retaining.vpnInterface=alreadyOwned
  val secondDescriptor = android.os.ParcelFileDescriptor().apply { fail=true }; retaining.descriptorForEstablish=secondDescriptor
  retaining.startForCase()
  check(retaining.vpnInterface === alreadyOwned && alreadyOwned.closeCalls == 0) { "Rejected establishment overwrote an already-owned descriptor" }
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == false && alreadyOwned.closed)
  secondDescriptor.fail=false
  check(FreedVpnService.requestAdultStop(context)["runtimeStopped"] == true && secondDescriptor.closed)
  println("PASS rejected established descriptor: Off/generation races retain failed handle; exact cleanup retry closes it; another owned descriptor is not overwritten")
  println("PASS actual start admission: queued start after Off, repair establishes registered TUN/output/workers, stop verifies all, Off during establish rejects publication")

  context = fresh()
  val topologyBefore = context.namespaces.mapValues { it.value.all }
  android.app.Application.currentName = "app.freed:unexpected"
  check(runCatching { FreedVpnService.setUserEnabled(context, false) }.isFailure)
  check(context.namespaces.mapValues { it.value.all } == topologyBefore)
  android.app.Application.currentName = "app.freed"
  context.packageManager.alternateProcess = "app.freed:unexpected"
  check(runCatching { FreedVpnService.setUserEnabled(context, false) }.isFailure)
  check(context.namespaces.mapValues { it.value.all } == topologyBefore)
  context.packageManager.alternateProcess = null
  println("PASS process topology change denies lower weakening without effects")

  context = fresh()
  val consentModule = ModuleAdapter(AppContext(context))
  val requestsBefore = FreedVpnService.startRequests
  consentModule.pendingAdultConsentGeneration = FreedAdultProtectionState.callbackEpoch(context)
  FreedVpnService.setUserEnabled(context, false)
  consentModule.consentResult(ConsentPayload(9407,android.app.Activity.RESULT_OK))
  check(FreedVpnService.startRequests == requestsBefore && !FreedVpnService.isUserEnabled(context))
  FreedVpnService.setUserEnabled(context,true)
  consentModule.pendingAdultConsentGeneration = FreedAdultProtectionState.callbackEpoch(context)
  FreedAdultProtectionState.setAccessibility(context,true)
  consentModule.consentResult(ConsentPayload(9407,android.app.Activity.RESULT_OK))
  check(FreedVpnService.startRequests == requestsBefore)
  FreedVpnService.isRunning = false
  consentModule.pendingAdultConsentGeneration = FreedAdultProtectionState.callbackEpoch(context)
  consentModule.consentResult(ConsentPayload(9407,0))
  check(FreedVpnService.startRequests == requestsBefore && FreedVpnService.isUserEnabled(context))
  consentModule.pendingAdultConsentGeneration = FreedAdultProtectionState.callbackEpoch(context)
  consentModule.consentResult(ConsentPayload(9407,android.app.Activity.RESULT_OK))
  check(FreedVpnService.startRequests == requestsBefore+1 && FreedVpnService.isUserEnabled(context))
  println("PASS actual Module consent callback plus actual restart gate: Off/old generation/denial cannot revive intent; current consent dispatches")

  context = fresh()
  check(FreedEncryptedDnsConfig.setRequested(context,false))
  val repairFenceStorage = context.getSharedPreferences("freed_adult_repair_fence_v1",0)
  repairFenceStorage.fail = true
  android.util.AtomicFile.failWrites = true
  val failedRepair = try { runCatching { FreedEncryptedDnsConfig.setRequested(context,true) } }
    finally { android.util.AtomicFile.failWrites=false;repairFenceStorage.fail=false }
  check(failedRepair.isFailure && !FreedEncryptedDnsConfig.isRequested(context)) {
    "Persistent repair ran with neither durable fence confirmed"
  }
  println("PASS two unavailable durable fences reject target repair before persistence")

  context = fresh()
  FreedAdultProtectionState.migrate(context)
  val rotating = FreedAdultAuthorizationExecutor.get(context)
  val credentials = rotating.core.enroll("123456","123456",FriendLockBaseline(FreedAdultProtectionState.configuration(context),true,byteArrayOf(87)))
  val pendingRotationID = rotating.prepareDnsStop().get()
  rotating.authorize(pendingRotationID,"123456").get()
  val beforeRotation = context.getSharedPreferences("owned",0).all
  val rotated = rotating.rotate(FriendLockSecret.Recovery(credentials.recoveryKey),"654321","654321").get()
  rotating.worker.submit { Unit }.get()
  check(rotated.lockRevision == 2L && rotated.recoveryKey.length == 64)
  check(context.getSharedPreferences("owned",0).all == beforeRotation && FreedVpnService.isRunning && FreedEncryptedDnsConfig.isRequested(context))
  check(rotating.journal.read().uncertainty.isNotEmpty() && rotating.store.load()!!.operations.isEmpty())
  check(rotating.execute(pendingRotationID).get()["accepted"] == false)
  check(runCatching { rotating.prepareAdultOff().get() }.isFailure)
  println("PASS actual root credential rotation retains policy and host uncertainty after protected receipts clear; old and fresh operations remain fenced")

  // Same production composition root authorizes and calls the actual lower setters.
  context = fresh()
  FreedAdultProtectionState.migrate(context)
  val authority = FreedAdultAuthorizationExecutor.get(context)
  authority.core.enroll("123456", "123456", FriendLockBaseline(FreedAdultProtectionState.configuration(context), true, byteArrayOf(85)))
  val offID = authority.prepareAdultOff().get()
  authority.submit { it.authorize(offID, "123456") }.get()
  val receipt = authority.submit { it.execute(offID) }.get()
  check(receipt.phase == FreedAdultHostPhase.COMPLETED)
  check(!FreedVpnService.isUserEnabled(context) && !FreedVpnService.isRunning)
  check(!FreedEncryptedDnsConfig.isRequested(context) && !FreedAdultProtectionState.read(context).accessibility)
  check(FreedAdultProtectionState.status(context, true, true)["freedAdultProtectionOff"] == true)
  val stopCalls = context.stops
  check(authority.submit { it.execute(offID) }.get() == receipt)
  check(context.stops == stopCalls) // Completed authority is historical, never a second dispatch.
  val beforeAppState = context.getSharedPreferences("owned", 0).all
  val forged = FreedAdultPermit(authority.machine, offID, receipt.receipt.deltaDigest,
    receipt.receipt.configuration.mutationGeneration, FreedAdultStep("encrypted-request", "false", "false"))
  check(runCatching { FreedEncryptedDnsConfig.setRequested(context, false, forged) }.isFailure)
  check(context.getSharedPreferences("owned", 0).all == beforeAppState)
  check(FreedAdultProtectionState.setAccessibility(context, true))
  check(FreedAdultProtectionState.read(context).accessibility)
  check(authority.operationStatus(offID).get()["historicalResultStale"] == true)
  check(context.stops == stopCalls)

  // DNS-only enrolled stop retains the actual adult-only classifier intent.
  context = fresh()
  FreedAdultProtectionState.migrate(context)
  val dnsAuthority = FreedAdultAuthorizationExecutor.get(context)
  dnsAuthority.core.enroll("123456", "123456", FriendLockBaseline(FreedAdultProtectionState.configuration(context), true, byteArrayOf(86)))
  val dnsID = dnsAuthority.prepareDnsStop().get()
  dnsAuthority.submit { it.authorize(dnsID, "123456") }.get()
  dnsAuthority.submit { it.execute(dnsID) }.get()
  check(FreedAdultProtectionState.read(context).accessibility)
  check(FreedAdultProtectionState.status(context, true, true)["freedAdultProtectionOff"] == false)
  check(FreedEncryptedDnsConfig.isRequested(context))
  val feedID = dnsAuthority.prepareFeed(listOf("one.example"), "next", "next-checksum", "later").get()
  dnsAuthority.authorize(feedID, "123456").get()
  check(dnsAuthority.execute(feedID).get()["accepted"] == true)
  check(FreedAdultDomainFeed.domains(context) == setOf("one.example"))
  val exceptionsID = dnsAuthority.prepareExceptions(listOf("allowed.example", "second.example")).get()
  dnsAuthority.authorize(exceptionsID, "123456").get()
  check(dnsAuthority.execute(exceptionsID).get()["accepted"] == true)
  check(FreedAdultDomainFeed.userAllowedDomains(context) == setOf("allowed.example", "second.example"))
  check(dnsAuthority.operationStatus(dnsID).get()["historicalResultStale"] == true)
  val malformedBefore = dnsAuthority.store.load()!!.operations.size
  context.getSharedPreferences("owned", 0).values[FreedAdultDomainFeed.DOMAINS_KEY] = true
  check(runCatching { dnsAuthority.prepareAdultOff().get() }.isFailure)
  check(dnsAuthority.store.load()!!.operations.size == malformedBefore)
  context.getSharedPreferences("owned", 0).values[FreedAdultDomainFeed.DOMAINS_KEY] = "one.example"
  val clearID = dnsAuthority.prepareEncryptedClear().get()
  dnsAuthority.authorize(clearID,"123456").get()
  check(dnsAuthority.execute(clearID).get()["accepted"] == true)
  check(FreedEncryptedDnsConfig.ownedConfigurationEmpty(context))
  check(FreedNetworkDnsState.read(context).mode == "off")
  val networks = context.getSystemService(android.net.ConnectivityManager::class.java)!!
  val physical = android.net.Network(1); val vpn = android.net.Network(2)
  networks.links[physical] = android.net.LinkProperties("family.example", true)
  networks.links[vpn] = android.net.LinkProperties(); networks.caps[vpn] = android.net.NetworkCapabilities(vpn=true)
  networks.activeNetwork = vpn
  check(FreedNetworkDnsState.read(context).mode == "hostname")
  check(FreedAdultProtectionState.status(context,true,true)["osPrivateDns"] == "hostname")
  check(FreedAdultProtectionState.status(context,true,true)["deviceAdultFilteringOff"] == null)
  check(FreedEncryptedDnsConfig.ownedConfigurationEmpty(context))
  check(networks.links[physical]!!.privateDnsServerName == "family.example") { "FREED namespace clear cannot remove OS Private DNS" }
  networks.links[physical] = android.net.LinkProperties(isPrivateDnsActive=true)
  check(FreedNetworkDnsState.read(context).mode == "opportunistic")
  networks.caps.clear()
  check(FreedNetworkDnsState.read(context).mode == "unknown")
  android.os.Build.VERSION.SDK_INT = 27
  check(FreedNetworkDnsState.read(context).mode == "off")
  android.os.Build.VERSION.SDK_INT = 36
  println("PASS actual underlying NetworkDnsState hostname/opportunistic/off/unknown, masked VPN and distinct FREED namespace removal")
  println("PASS production composition + Core + actual DNS/encrypted/adult intent setters; compound and DNS-only status; exact replay; forged permit denial; repair staleness")
  println("Actual Android adult boundary: protected positive unenrolled, enrolled/missing/corrupt/unavailable denials with zero lower effects; Module/Service no false success; runtime failure/readback; strengthening; OS revoke retains intent passed")
}
