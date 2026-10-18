package app.freed.protection
import android.content.Context

fun main(args: Array<String>) {
 val scenario=args.firstOrNull()?:"positive"
 val context=Context();val authority=FreedAdultAuthorizationExecutor.get(context) {scenario!="disabled"}
 fun call(c:String,r:Map<String,Any?> = emptyMap())=authority.deviceAdultBridge(c,r)
 fun enroll()=call("enroll",mapOf("pin" to "123456","confirmation" to "123456"))
 fun code(result:Map<String,Any?>,expected:String){check(result["code"]==expected){"Task91 expected $expected, got ${result.filterKeys{it!="recoveryKey"}}"}}
 if(scenario=="disabled"){code(enroll(),"integrationDisabled");check(FriendLockKeystoreBytes.values.isEmpty());println("Task91 disabled PASS");return}
 if(scenario=="invalid"){
  code(call("enroll",mapOf("pin" to "12345","confirmation" to "123456")),"invalidPIN")
  code(call("enroll",mapOf("pin" to "123456","confirmation" to "654321")),"pinMismatch")
  code(call("enroll",mapOf("pin" to "x".repeat(1000),"confirmation" to "123456")),"invalidInput")
  code(call("enroll",mapOf("pin" to "123456","confirmation" to "123456","baseline" to "forged")),"invalidInput")
  check(FriendLockKeystoreBytes.values.isEmpty());println("Task91 invalid PIN/twice/bounds/native-derived-only PASS");return
 }
 if(scenario in setOf("final-health-false","final-health-expired","final-health-unknown")) {
  Task91KdfProbe.install(false)
  Test91OS.beforeFinal = {
   check(Test91OS.observations == 2 && Task91KdfProbe.completed == 2)
   check(FreedVpnService.encryptedDnsHealthy() == true)
   val version=FreedVpnService.runtimeStateVersion
   when(scenario) {
    "final-health-false" -> task91RecordEncryptedHealth(false)
    "final-health-expired" -> android.os.SystemClock.now += 60_000L
    else -> FreedVpnService.resetEncryptedDnsHealth()
   }
   check(version == FreedVpnService.runtimeStateVersion)
  }
  code(enroll(),"staleConfiguration")
  check(FriendLockKeystoreBytes.values.isEmpty() && FriendLockKeystoreBytes.writes == 0)
  check(Task91KdfProbe.calls == 2 && Task91KdfProbe.completed == 2)
  println("Task91 $scenario after second observation refuses final publication; zero protected writes PASS");return
 }
 if(scenario in setOf("kdf-locks","stale-during-kdf")) {
  Task91KdfProbe.install(true)
  val pool=java.util.concurrent.Executors.newSingleThreadExecutor()
  val future=pool.submit<Map<String,Any?>>{enroll()}
  var available=true
  val accessFailure=java.util.concurrent.atomic.AtomicReference<Throwable?>()
  val contenders=mutableListOf<Thread>()
  for(index in 0..1) {
   check(Task91KdfProbe.entered[index].await(3,java.util.concurrent.TimeUnit.SECONDS))
   check(Task91KdfProbe.calls == index+1 && Task91KdfProbe.completed == index && Test91OS.observations == 1)
   val accessed=java.util.concurrent.CountDownLatch(1)
   val contender=Thread {
    try {
     synchronized(authority.core) { check(authority.core.status()==FriendLockStatus.NOT_ENROLLED) }
     synchronized(authority.guard) { check(authority.store.load()==null) }
     check(authority.store.load()==null) // Acquires the actual unchanged protected process lock.
     if(scenario=="stale-during-kdf" && index==0) synchronized(authority.guard) { Test90OS.generation++ }
     accessed.countDown()
    } catch(failure:Throwable) { accessFailure.set(failure) }
   }
   contenders.add(contender);contender.start()
   available=accessed.await(3,java.util.concurrent.TimeUnit.SECONDS) && available
   Task91KdfProbe.proceed[index].countDown()
  }
  val result=future.get(10,java.util.concurrent.TimeUnit.SECONDS)
  contenders.forEach { it.join(5000) };pool.shutdown()
  check(available) { "Core monitor/status or guard/protected access blocked while actual enrollment derivation was gated" }
  check(accessFailure.get()==null && contenders.none { it.isAlive })
  check(Task91KdfProbe.calls==2 && Task91KdfProbe.completed==2)
  if(scenario=="stale-during-kdf") {
   code(result,"staleConfiguration")
   check(FriendLockKeystoreBytes.values.isEmpty() && FriendLockKeystoreBytes.writes==0)
   println("Task91 generation changes after actual 600k derivation entry; both verifiers complete off monitor/guard/store; facade refuses with zero protected writes PASS")
  } else {
   check(result["kind"]=="enrollment")
   println("Task91 actual 600k derivation permits concurrent Core monitor/status and guard/protected access; both verifiers complete PASS")
  }
  return
 }
 if(scenario=="final-runtime-loss")Test91OS.finalRuntimeLoss=true
 if(scenario=="saved-only")Test91OS.ready=false
 if(scenario=="denied")Test91OS.accessibilityEnabled=false
 if(scenario=="unknown-dns")Test91OS.os="unknown"
 if(scenario=="unhealthy")FreedVpnService.resetEncryptedDnsHealth()
 if(scenario=="cleanup")Test91OS.cleanupPending=true
 if(scenario=="uncertain")authority.journal.save(authority.journal.read().copy(uncertainty=setOf("retained")))
 if(scenario in setOf("saved-only","final-runtime-loss","denied","unknown-dns","unhealthy","cleanup","uncertain")){
  check(enroll()["kind"]=="error");check(FriendLockKeystoreBytes.values.isEmpty());println("Task91 $scenario rejects before protected write PASS");return
 }
 if(scenario=="stale"){
  val changed=java.util.concurrent.CountDownLatch(1)
  Test91OS.firstObservation=java.util.concurrent.CountDownLatch(1)
  val racer=Thread{
   Test91OS.firstObservation!!.await()
   synchronized(authority.guard){Test90OS.generation++};changed.countDown()
  };racer.start()
  val result=enroll();racer.join();check(changed.count==0L);code(result,"staleConfiguration");check(FriendLockKeystoreBytes.values.isEmpty())
  println("Task91 historical early-observation configuration race refuses before protected writes PASS");return
 }
 if(scenario=="legacy"){
  Test91OS.firstObservation=java.util.concurrent.CountDownLatch(1)
  val pool=java.util.concurrent.Executors.newSingleThreadExecutor()
  val future=pool.submit<Map<String,Any?>>{enroll()}
  check(Test91OS.firstObservation!!.await(3,java.util.concurrent.TimeUnit.SECONDS))
  // The actual lower admission rejects while derivation owns the logical token.
  val refused=runCatching{authority.machine.requireLegacy(FriendLockAction.DISABLE_ADULT_FILTER)}.isFailure
  check(refused)
  check(runCatching{authority.machine.reservePrivateCleanup(java.util.UUID.randomUUID().toString())}.isFailure)
  val result=future.get();check(result["kind"]=="enrollment")
  check(runCatching{authority.machine.requireLegacy(FriendLockAction.DISABLE_ADULT_FILTER)}.isFailure)
  pool.shutdown();check(Test90OS.writes==0);println("Task91 legacy contention before/after enrollment preserves layers PASS");return
 }
 if(scenario=="lost")FriendLockKeystoreBytes.lostCommit=true
 if(scenario=="write-failure")FriendLockKeystoreBytes.failure="witness"
 if(scenario=="readback")FriendLockKeystoreBytes.hideRecord=true
 val result=enroll()
 if(scenario=="write-failure"){code(result,"storageUnavailable");check(FriendLockKeystoreBytes.values.isEmpty());println("Task91 write failure PASS");return}
 if(scenario=="readback"){
  code(result,"storageUnavailable");FriendLockKeystoreBytes.hideRecord=false
  check(call("status")["credential"]=="missingEnrolled");check(enroll()["kind"]=="error");check(Test90OS.writes==0)
  println("Task91 failed protected readback preserves missing-enrolled failure; no rebootstrap PASS");return
 }
 if(scenario=="lost")code(result,"commitOutcomeUnknown") else check(result["kind"]=="enrollment" && result["keyPresentation"]=="required")
 FriendLockKeystoreBytes.lostCommit=false
 val saved=FriendLockKeystoreBytes.values.mapValues{it.value.clone()}
 check(call("status")["credential"]=="enrolled");check(call("status")["enrollmentAvailable"]==false)
 code(enroll(),"alreadyEnrolled");check(saved.all{(k,v)->FriendLockKeystoreBytes.values[k]!!.contentEquals(v)})
 check(Test90OS.writes==0)
 if(scenario=="census"){
  check(authority.prepareEncryptedDisable().get().length==32)
  FriendLockKeystoreBytes.values.clear()
  check(enroll()["kind"]=="error");check(authority.machine.isQuarantined());check(FriendLockKeystoreBytes.values.isEmpty())
  println("Task91 protected/host census mismatch quarantines without replacement PASS");return
 }
 if(scenario=="positive"){
  val key=result["recoveryKey"] as String;check(key.length==64&&!call("status").toString().contains(key))
  val rotated=call("rotate",mapOf("secretType" to "pin","secret" to "123456","pin" to "654321","confirmation" to "654321"))
  check(rotated["kind"]=="rotation");check(Test90OS.writes==0)
  fun fresh():FriendLockCore {
   val bytes=object:FriendLockProtectedBytes {val values=mutableMapOf<String,ByteArray>();override fun read(key:String)=values[key];override fun write(key:String,value:ByteArray){values[key]=value};override fun remove(key:String){values.remove(key)}}
   return FriendLockCore(FriendLockRecordStore(bytes),FriendLockNativeCrypto())
  }
  val c=fresh();val other=fresh();val baseline=FriendLockBaseline(FriendLockConfiguration("1","1"),true,"fixture".toByteArray())
  val candidate=c.deriveEnrollment("123456","123456",baseline)
  check(runCatching{other.publishEnrollment(candidate)}.isFailure)
  check(runCatching{c.publishEnrollment(candidate){}}.isFailure)
  check(runCatching{c.publishEnrollment(candidate)}.isFailure)
  val retained=c.deriveEnrollment("123456","123456",baseline)
  var late:(()->Unit)?=null
  check(runCatching{c.publishEnrollment(retained){late=it}}.isFailure)
  check(runCatching{late!!()}.isFailure)
  check(c.status()==FriendLockStatus.NOT_ENROLLED)
 }
 println("Task91 actual singleton/worker/Core/store/native readiness $scenario PASS")
}
