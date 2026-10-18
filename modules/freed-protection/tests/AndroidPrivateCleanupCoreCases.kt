package app.freed.protection

private class CleanupBytes87 : FriendLockProtectedBytes {
 val values=mutableMapOf<String,ByteArray>();var writes=0;var failAt=-1;var after=false
 override fun read(k:String)=values[k]?.clone()
 override fun write(k:String,b:ByteArray){writes++;if(writes==failAt){if(after)values[k]=b.clone();fail(FriendLockError.STORAGE_UNAVAILABLE)};values[k]=b.clone()}
 override fun remove(k:String){values.remove(k)}
}
private class CleanupIO87:FreedAdultJournalIO {
 var bytes:ByteArray?=null;var writes=0;var failAt=-1;var after=false
 override fun read()=bytes?.clone()
 override fun write(b:ByteArray){writes++;if(writes==failAt){if(after)bytes=b.clone();error("journal-lost-ack")};bytes=b.clone()}
}
private class CleanupLayers87:FreedAdultExecutionLayers {
 override fun configuration()=FriendLockConfiguration("1","1")
 override fun observe(layer:String)="true"
 override fun apply(step:FreedAdultStep,permit:FreedAdultPermit):String=error("Cleanup must never dispatch DNS or weaken adult protection")
}
private class Core87(enroll:Boolean=true) {
 val bytes=CleanupBytes87();val store=FriendLockRecordStore(bytes);val core=FriendLockCore(store,FriendLockNativeCrypto())
 val io=CleanupIO87();val journal=FreedAdultExecutionJournal(io).also{it.initialize()};val layers=CleanupLayers87()
 val machine=FreedAdultExecutionMachine(core,store,journal,layers)
 val id=java.util.UUID.randomUUID().toString()
 init {if(enroll)core.enroll("123456","123456",FriendLockBaseline(layers.configuration(),true,byteArrayOf(87)))}
 fun request()=machine.reservePrivateCleanup(id)
 fun execute()=machine.invalidatePrivateCleanup(id)
}
fun privateCleanupCoreCases() {
 val empty=Core87(false);check(empty.request()=="requested");check(empty.execute()=="complete");check(empty.bytes.writes==0)
 val h=Core87();val plan=listOf(FreedAdultStep("dns-intent","true","false"))
 val action=h.machine.prepare(FriendLockAction.DISABLE_ADULT_FILTER,plan);h.machine.authorize(action,"123456")
 val generation=h.store.load()!!.authorizationGeneration
 check(h.request()=="requested")
 check(runCatching{h.machine.prepare(FriendLockAction.DISABLE_ADULT_FILTER,plan)}.isFailure)
 check(h.execute()=="complete" && h.store.load()!!.authorizationGeneration==generation+1 && h.store.load()!!.operations.isEmpty())
 check(h.journal.read().operations.keys==setOf(action) && h.journal.read().uncertainty.isNotEmpty())
 val writes=h.bytes.writes;val journalWrites=h.io.writes
 check(h.execute()=="complete" && h.bytes.writes==writes && h.io.writes==journalWrites)
 // Exact terminal replay cannot revoke a later protected authorization, even through the actual Core.
 val change=FriendLockAdultChange(FriendLockAction.DISABLE_ADULT_FILTER,mapOf("scope" to "later-B"))
 val b=h.core.prepare(change,h.layers.configuration());val bBytes=h.bytes.values.mapValues{it.value.toList()}
 check(h.execute()=="complete" && h.bytes.values.mapValues{it.value.toList()}==bBytes && h.store.load()!!.operations.single().operationID==b.operationID)
 // Every reservation/Core publication boundary retains exact operation identity on retry.
 for(after in listOf(false,true)) for(boundary in 1..2) {
  val f=Core87();f.request();f.io.failAt=f.io.writes+boundary;f.io.after=after
  check(runCatching{f.execute()}.isFailure)
  f.io.failAt=-1
  val cold=FreedAdultExecutionMachine(f.core,f.store,f.journal,f.layers)
  check(cold.invalidatePrivateCleanup(f.id)=="complete")
  check(f.store.load()!!.authorizationGeneration==1L)
  val before=f.bytes.writes;check(cold.invalidatePrivateCleanup(f.id)=="complete"&&f.bytes.writes==before)
 }
 for(after in listOf(false,true)) for(boundary in 1..3) {
  val f=Core87();f.request();f.bytes.failAt=f.bytes.writes+boundary;f.bytes.after=after
  check(runCatching{f.execute()}.isFailure)
  f.bytes.failAt=-1
  val cold=FreedAdultExecutionMachine(f.core,f.store,f.journal,f.layers)
  check(cold.invalidatePrivateCleanup(f.id)=="complete" && f.store.load()!!.authorizationGeneration==1L)
 }
 // Lost completion acknowledgement followed by newer authority is positively superseded, never repeated.
 val lost=Core87();lost.request();lost.io.failAt=lost.io.writes+2
 check(runCatching{lost.execute()}.isFailure);lost.io.failAt=-1
 check(lost.store.load()!!.authorizationGeneration==1L)
 lost.core.prepare(change,lost.layers.configuration())
 val later=lost.bytes.values.mapValues{it.value.toList()}
 check(lost.execute()=="superseded" && lost.bytes.values.mapValues{it.value.toList()}==later)
 // Retained preclaim/uncertainty cannot be bypassed by cleanup.
 val claimed=Core87();val cid=claimed.machine.prepare(FriendLockAction.DISABLE_ADULT_FILTER,plan);claimed.machine.authorize(cid,"123456");claimed.machine.reserve(cid)
 check(runCatching{claimed.request()}.isFailure)
 val uncertain=Core87();uncertain.journal.save(uncertain.journal.read().copy(uncertainty=setOf("sticky")))
 check(runCatching{uncertain.request()}.isFailure && uncertain.journal.read().uncertainty.contains("sticky"))
 // Missing/corrupt durable data cannot create an empty cleanup acknowledgement.
 val corrupt=Core87();corrupt.request();corrupt.io.bytes=byteArrayOf(1,2,3)
 check(runCatching{corrupt.execute()}.isFailure)
 // Durable native arming closes the scheduling gap before the authority worker can reserve.
 val armed=Core87();var pending=true;var known=true
 val gated=FreedAdultExecutionMachine(armed.core,armed.store,armed.journal,armed.layers,
  cleanupPending={except->pending && except!=armed.id},cleanupKnown={known})
 check(runCatching{gated.prepare(FriendLockAction.DISABLE_ADULT_FILTER,plan)}.isFailure)
 check(gated.reservePrivateCleanup(armed.id)=="requested")
 check(gated.invalidatePrivateCleanup(armed.id)=="complete")
 pending=false;known=false
 val unknown=java.util.UUID.randomUUID().toString()
 check(runCatching{gated.reservePrivateCleanup(unknown)}.isFailure)
 val protectedBeforeReplay=armed.bytes.writes;check(gated.invalidatePrivateCleanup(armed.id)=="complete" && armed.bytes.writes==protectedBeforeReplay)
 println("Task87 real same-Core/store cleanup: durable reservation, census/preclaim/sticky uncertainty, every protected/journal publication failure, cold/lost-ack retries, exact once invalidation and later-authority preservation passed")
}
