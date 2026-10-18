package app.freed.protection

// Executes the production census and same-store Core transitions, replacing only durable I/O.
private class Bytes85 : FriendLockProtectedBytes {
  val values = mutableMapOf<String, ByteArray>()
  var writes = 0; var failAt = -1; var after = false; var fired = false
  override fun read(key: String) = values[key]?.clone()
  override fun write(key: String, value: ByteArray) {
    writes++
    if (writes == failAt) {
      fired = true
      if (after) values[key] = value.clone()
      fail(FriendLockError.STORAGE_UNAVAILABLE)
    }
    values[key] = value.clone()
  }
  override fun remove(key: String) { values.remove(key) }
}
private class Journal85 : FreedAdultJournalIO {
  var bytes: ByteArray? = null
  var failWrite = false
  var remaining = -1
  var failAfterWrite = false
  override fun read() = bytes?.clone()
  override fun write(value: ByteArray) {
    if (remaining > 0) remaining--
    if (failWrite || remaining == 0) {
      if (failAfterWrite) bytes = value.clone()
      error("injected journal publication failure")
    }
    bytes = value.clone()
  }
}
private class Native85 : FreedAdultExecutionLayers {
  var config = FriendLockConfiguration("1", "1")
  var writes = 0
  var beforeConsume: ((FreedAdultPermit) -> Unit)? = null
  override fun configuration() = config
  override fun observe(layer: String) = if (writes == 0) "true" else "false"
  override fun apply(step: FreedAdultStep, permit: FreedAdultPermit): String {
    beforeConsume?.invoke(permit)
    permit.issuer.consume(permit, step.layer, observe(step.layer), step.desired)
    check(runCatching { permit.issuer.consume(permit, step.layer, observe(step.layer), step.desired) }.isFailure) { "A lower permit was reusable" }
    writes++; return "false"
  }
}
fun main() {
  val unauthStore = FriendLockRecordStore(Bytes85())
  val unauthCore = FriendLockCore(unauthStore, FriendLockNativeCrypto())
  unauthCore.enroll("123456", "123456", FriendLockBaseline(FriendLockConfiguration("1", "1"), true, byteArrayOf(9)))
  val unauthJournal = FreedAdultExecutionJournal(Journal85()).also { it.initialize() }
  val unauthNative = Native85()
  val unauthMachine = FreedAdultExecutionMachine(unauthCore, unauthStore, unauthJournal, unauthNative)
  val preparedOnly = unauthMachine.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false")))
  val unauthorizedResult = runCatching { unauthMachine.execute(preparedOnly) }
  check(unauthNative.writes == 0 && unauthorizedResult.isFailure) { "Prepared-only receipt reached native effect without authorization/claim" }
  check(runCatching { unauthMachine.authorize(preparedOnly, "654321") }.isFailure)
  check(unauthNative.writes == 0)
  check(runCatching { unauthMachine.execute(preparedOnly) }.isFailure && unauthNative.writes == 0)
  unauthMachine.cancel(preparedOnly)
  check(runCatching { unauthMachine.execute(preparedOnly) }.isFailure && unauthNative.writes == 0)
  println("PASS PREPARED/incorrect-secret/CANCELLED receipts cause zero native effects")
  val orphanStore=FriendLockRecordStore(Bytes85());val orphanCore=FriendLockCore(orphanStore,FriendLockNativeCrypto())
  orphanCore.enroll("123456","123456",FriendLockBaseline(FriendLockConfiguration("1","1"),true,byteArrayOf(10)))
  val orphanJournal=FreedAdultExecutionJournal(Journal85()).also{it.initialize()};val orphanNative=Native85()
  val orphanMachine=FreedAdultExecutionMachine(orphanCore,orphanStore,orphanJournal,orphanNative)
  val knownID=orphanMachine.prepare(FriendLockAction.DISABLE_ADULT_FILTER,listOf(FreedAdultStep("dns-intent","true","false")))
  val known=orphanJournal.read().operations.getValue(knownID)
  val orphan=orphanCore.prepare(known.change(),known.receipt.configuration)
  check(runCatching{orphanMachine.prepare(FriendLockAction.DISABLE_ADULT_FILTER,listOf(FreedAdultStep("dns-intent","true","false")))}.isFailure)
  check(orphanJournal.read().uncertainty.any{it.contains(orphan.operationID)}) { "Protected-only orphan identity was not retained independently of Core receipts" }
  check(orphanNative.writes==0)
  val bytes = Bytes85()
  val store = FriendLockRecordStore(bytes)
  val crypto = FriendLockNativeCrypto()
  val core = FriendLockCore(store, crypto)
  core.enroll("123456", "123456", FriendLockBaseline(FriendLockConfiguration("1", "1"), true, byteArrayOf(1)))
  val io = Journal85()
  val journal = FreedAdultExecutionJournal(io)
  journal.initialize()
  val native = Native85()
  val executor = FreedAdultExecutionMachine(core, store, journal, native)
  val first = executor.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false")))
  val second = executor.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false")))
  executor.authorize(first, "123456")
  executor.authorize(second, "123456")
  // Durable preclaim remains when protected IN_FLIGHT succeeds but host claimed publication fails.
  executor.reserve(first)
  val host = journal.read().operations.getValue(first)
  core.claim(first, host.change(), host.receipt.configuration)
  io.failWrite = true
  check(runCatching { executor.execute(second) }.isFailure)
  check(runCatching { executor.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false"))) }.isFailure)
  check(native.writes == 0)
  io.failWrite = false
  check(runCatching { executor.reconcile(first) }.isFailure)
  check(journal.read().uncertainty.isNotEmpty())
  core.invalidateAuthorizations()
  val restarted = FreedAdultExecutionMachine(core, store, journal, native)
  check(runCatching { restarted.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false"))) }.isFailure)
  check(native.writes == 0)
  for (after in listOf(false, true)) for (boundary in 1..6) {
    val protectedIO = Bytes85(); val pairedStore = FriendLockRecordStore(protectedIO)
    val pairedCore = FriendLockCore(pairedStore, crypto)
    pairedCore.enroll("123456", "123456", FriendLockBaseline(FriendLockConfiguration("1", "1"), true, byteArrayOf(2)))
    val hostIO = Journal85(); val hostJournal = FreedAdultExecutionJournal(hostIO); hostJournal.initialize()
    val effects = Native85(); val machine = FreedAdultExecutionMachine(pairedCore, pairedStore, hostJournal, effects)
    val id = machine.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false")))
    machine.authorize(id, "123456")
    hostIO.remaining = boundary; hostIO.failAfterWrite = after
    check(runCatching { machine.execute(id) }.isFailure)
    val firstWrites = effects.writes
    hostIO.remaining = -1; hostIO.failAfterWrite = false
    val cold = FreedAdultExecutionMachine(pairedCore, pairedStore, hostJournal, effects)
    runCatching { cold.execute(id) }
    check(effects.writes <= 1 && (firstWrites == 0 || effects.writes == firstWrites)) {
      "Failure boundary $boundary after=$after repeated an observed effect"
    }
  }
  val emptyStore = FriendLockRecordStore(Bytes85()); val emptyCore = FriendLockCore(emptyStore, crypto)
  emptyCore.enroll("123456", "123456", FriendLockBaseline(FriendLockConfiguration("1", "1"), true, byteArrayOf(3)))
  val capacityJournal = FreedAdultExecutionJournal(Journal85()).also { it.initialize() }
  val capacityMachine = FreedAdultExecutionMachine(emptyCore, emptyStore, capacityJournal, Native85())
  repeat(32) { capacityMachine.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false"))) }
  check(runCatching { capacityMachine.prepare(FriendLockAction.DISABLE_ADULT_FILTER, listOf(FreedAdultStep("dns-intent", "true", "false"))) }.isFailure)
  check(emptyStore.load()!!.operations.size == 32)
  val substitutionStore = FriendLockRecordStore(Bytes85())
  val substitutionCore = FriendLockCore(substitutionStore, crypto)
  substitutionCore.enroll("123456","123456",FriendLockBaseline(FriendLockConfiguration("1","1"),true,byteArrayOf(4)))
  val substitutionJournal = FreedAdultExecutionJournal(Journal85()).also { it.initialize() }
  val substitutionNative = Native85()
  val substitution = FreedAdultExecutionMachine(substitutionCore,substitutionStore,substitutionJournal,substitutionNative)
  val substitutedID = substitution.prepare(FriendLockAction.DISABLE_ADULT_FILTER,listOf(FreedAdultStep("dns-intent","true","false")))
  substitution.authorize(substitutedID,"123456")
  substitutionNative.beforeConsume = { permit ->
    check(runCatching { capacityMachine.consume(permit,"dns-intent","true","false") }.isFailure)
    check(runCatching { substitution.consume(permit,"encrypted-request","true","false") }.isFailure)
    check(runCatching { substitution.consume(permit,"dns-intent","true","true") }.isFailure)
  }
  substitution.execute(substitutedID)
  check(substitutionNative.writes==1)
  for (stage in listOf("prepare", "authorize", "execute")) for (afterCommit in listOf(false,true)) {
    val boundaries = if(stage=="prepare") 3 else 6
    for(boundary in 1..boundaries) {
      val faultyBytes=Bytes85();val faultyStore=FriendLockRecordStore(faultyBytes)
      val faultyCore=FriendLockCore(faultyStore,crypto)
      faultyCore.enroll("123456","123456",FriendLockBaseline(FriendLockConfiguration("1","1"),true,byteArrayOf(5)))
      val faultyJournal=FreedAdultExecutionJournal(Journal85()).also{it.initialize()}
      val effects=Native85();val faultyMachine=FreedAdultExecutionMachine(faultyCore,faultyStore,faultyJournal,effects)
      val step=listOf(FreedAdultStep("dns-intent","true","false"))
      val id=if(stage!="prepare")faultyMachine.prepare(FriendLockAction.DISABLE_ADULT_FILTER,step)else null
      if(stage=="execute")faultyMachine.authorize(id!!,"123456")
      faultyBytes.writes=0;faultyBytes.failAt=boundary;faultyBytes.after=afterCommit
      val failed=runCatching { when(stage){
        "prepare"->faultyMachine.prepare(FriendLockAction.DISABLE_ADULT_FILTER,step)
        "authorize"->faultyMachine.authorize(id!!,"123456")
        else->faultyMachine.execute(id!!)
      } }
      check(faultyBytes.fired && failed.isFailure){"Protected publication fault was not reached: $stage/$boundary/$afterCommit"}
      val prior=effects.writes
      check(stage=="execute" || prior==0)
      faultyBytes.failAt=-1
      val restartedMachine=FreedAdultExecutionMachine(faultyCore,faultyStore,faultyJournal,effects)
      if(id!=null)runCatching{restartedMachine.execute(id)}
      check(effects.writes<=1 && (prior==0 || effects.writes==prior)){"Protected uncertain commit repeated effect: $stage/$boundary/$afterCommit"}
    }
  }
  println("PASS 30 actual protected prepare/authorize(throttle+authorization)/claim/complete write failures before/after every publication boundary; cold exact retry never repeats effect")
  println("PASS exact one-shot permit, cross-Core issuer/wrong layer/wrong desired denial")
  println("PASS twelve host durable-boundary failures/recreation, no repeated native effect, bounded 32 receipt capacity")
  println("PASS actual Core claim gap, complete census, marker write failure, invalidation and restart quarantine")
}
