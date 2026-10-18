package app.freed.protection
import android.content.Context

fun main(args: Array<String>) {
 val context=Context();val authority=FreedAdultAuthorizationExecutor.get(context)
 check(FreedAdultAuthorizationExecutor.get(context)===authority)
 fun call(c:String,r:Map<String,Any?> = emptyMap())=authority.deviceAdultBridge(c,r)
 fun field(v:Map<String,Any?>,k:String,w:String){check(v[k]==w){"Task90 $k expected $w; observed ${v[k]}"}}
 field(call("status"),"credential","notEnrolled");check(call("status")["enrollmentAvailable"]==false)
 field(call("enroll"),"code","integrationDisabled")
 field(call("prepare",mapOf("action" to "adultReset")),"code","unsupportedAction")
 field(call("read",mapOf("operationID" to java.util.UUID.randomUUID().toString())),"code","invalidInput")
 field(call("prepare",mapOf("action" to "adultOff","baseline" to "forged")),"code","invalidInput")
 field(call("prepare",mapOf("action" to "feed","domains" to List(257){"example.invalid"},"version" to "v","checksum" to "c","generatedAt" to "g")),"code","invalidInput")
 val baseline=FriendLockBaseline(FreedAdultProtectionState.configuration(context),true,"native-os-fixture".toByteArray())
 // Fixture-only enrollment of the same production singleton Core; the public route remains disabled.
 val enrollment=authority.worker.submit{it.enroll("123456","123456",baseline)}.get()
 field(call("status"),"credential","enrolled")
 if(args.contains("--status-only")) {
  val enrolled=call("status");check(enrolled["bridgeAvailable"]==true);field(enrolled,"mutationAvailability","unknown");field(enrolled,"mutationReason","baselineUnobserved");check(enrolled["enrollmentAvailable"]==false)
  val saved=FriendLockKeystoreBytes.values.mapValues{it.value.clone()}
  FriendLockKeystoreBytes.unavailable=true;field(call("status"),"mutationAvailability","unavailable");field(call("status"),"mutationReason","protectedRecordUnavailable");FriendLockKeystoreBytes.unavailable=false
  FriendLockKeystoreBytes.values.clear();FriendLockKeystoreBytes.values["witness"]=byteArrayOf(1);field(call("status"),"credential","missingEnrolled");field(call("status"),"mutationAvailability","unavailable")
  FriendLockKeystoreBytes.values["witness"]=byteArrayOf(2);field(call("status"),"credential","corrupt");field(call("status"),"mutationAvailability","unavailable")
  FriendLockKeystoreBytes.values.clear();FriendLockKeystoreBytes.values.putAll(saved)
  val host=authority.journal.read();authority.journal.save(host.copy(uncertainty=setOf("status-fixture")))
  field(call("status"),"mutationAvailability","unavailable");field(call("status"),"mutationReason","operationStateUnavailable");authority.journal.save(host)
  val file=java.io.File(context.noBackupFilesDir,"freed-adult-execution-v1/execution");val hostBytes=file.readBytes();file.delete()
  field(call("status"),"mutationAvailability","unavailable");field(call("prepare",mapOf("action" to "encryptedDisable")),"kind","error")
  file.writeBytes(hostBytes)
  field(call("status"),"mutationAvailability","unavailable");check(authority.machine.isQuarantined())
  check(Test90OS.writes==0)
  println("Task90 Android explicit bridge/mutation/enrollment status correction: PASS (healthy unknown; degraded/missing/retained/in-memory quarantine unavailable)")
  return
 }
 if (args.contains("--missing-journal")) {
 val journalFile=java.io.File(context.noBackupFilesDir,"freed-adult-execution-v1/execution")
 val journalSaved=journalFile.readBytes();journalFile.delete()
 val missingJournal=call("status");field(missingJournal,"credential","enrolled");check(missingJournal["pendingKnown"]==false)
 field(call("prepare",mapOf("action" to "encryptedDisable")),"kind","error");check(!journalFile.exists())
 field(call("status"),"credential","enrolled")
 println("Task90 Android enrolled missing journal: PASS (no rebootstrap, sticky fail-closed quarantine)")
 return
 }
 val saved=FriendLockKeystoreBytes.values.mapValues{it.value.clone()}
 FriendLockKeystoreBytes.unavailable=true;field(call("status"),"credential","unavailable");FriendLockKeystoreBytes.unavailable=false
 FriendLockKeystoreBytes.values.clear();FriendLockKeystoreBytes.values["witness"]=byteArrayOf(1);field(call("status"),"credential","missingEnrolled")
 FriendLockKeystoreBytes.values["witness"]=byteArrayOf(2);field(call("status"),"credential","corrupt")
 FriendLockKeystoreBytes.values.clear();FriendLockKeystoreBytes.values.putAll(saved)
 val prepared=call("prepare",mapOf("action" to "encryptedDisable"));field(prepared,"phase","prepared");val id=prepared["operationID"] as String
 field(call("authorize",mapOf("operationID" to id,"pin" to "000000")),"code","incorrectSecret")
 field(call("authorize",mapOf("operationID" to id,"pin" to "123456")),"phase","authorized")
 field(call("authorize",mapOf("operationID" to id,"pin" to "123456")),"phase","authorized")
 val complete=call("execute",mapOf("operationID" to id));field(complete,"phase","completed");check(complete["accepted"]==true);field(complete,"currentStatus","unknown")
 val writes=Test90OS.writes;field(call("execute",mapOf("operationID" to id)),"operationID",id);check(Test90OS.writes==writes)
 val cancelling=call("prepare",mapOf("action" to "encryptedClear"));val cancelID=cancelling["operationID"] as String
 field(call("cancel",mapOf("operationID" to cancelID)),"phase","cancelled")
 val pending=call("prepare",mapOf("action" to "dnsStop"));val pendingID=pending["operationID"] as String
 field(call("authorize",mapOf("operationID" to pendingID,"pin" to "123456")),"phase","authorized")
 Test90OS.latch=java.util.concurrent.CountDownLatch(1)
 val timeout=call("execute",mapOf("operationID" to pendingID));field(timeout,"observation","pending");check(timeout["accepted"]==null)
 field(call("read",mapOf("operationID" to pendingID)),"operationID",pendingID)
 check(call("status")["pendingOperationIDs"]==listOf(pendingID))
 // Outstanding timed-out observers remain charged while the native dispatch is held.
 val pool=java.util.concurrent.Executors.newFixedThreadPool(15){task->Thread(task).apply{isDaemon=true}}
 val queued=(1..15).map{pool.submit<Map<String,Any?>>{call("execute",mapOf("operationID" to pendingID))}}
 val countField=authority.javaClass.getDeclaredField("publicBridgeObservers").also{it.isAccessible=true}
 val observers=countField.get(authority) as java.util.concurrent.atomic.AtomicInteger
 val deadline=System.nanoTime()+2_000_000_000L
 while(observers.get()<16 && System.nanoTime()<deadline)Thread.sleep(5)
 val operationCount=authority.journal.read().operations.size
 field(call("prepare",mapOf("action" to "adultOff")),"code","busy")
 check(authority.journal.read().operations.size==operationCount){"Saturated observer minted an operation"}
 Test90OS.latch!!.countDown();Test90OS.latch=null
 queued.forEach{field(it.get(),"operationID",pendingID)};pool.shutdown()
 var late=call("read",mapOf("operationID" to pendingID))
 repeat(200){if(late["phase"]!="completed"){Thread.sleep(10);late=call("read",mapOf("operationID" to pendingID))}}
 field(late,"phase","completed");field(call("cancel",mapOf("operationID" to pendingID)),"code","cancelNotProven")
 val throttle=call("prepare",mapOf("action" to "exceptions","domains" to emptyList<String>()));val throttleID=throttle["operationID"] as String
 repeat(5){field(call("authorize",mapOf("operationID" to throttleID,"pin" to "000000")),"code","incorrectSecret")}
 field(call("authorize",mapOf("operationID" to throttleID,"pin" to "123456")),"code","throttled")
 field(call("cancel",mapOf("operationID" to throttleID)),"phase","cancelled")
 val rotation=call("rotate",mapOf("secretType" to "recovery","secret" to enrollment.recoveryKey,"pin" to "654321","confirmation" to "654321"))
 field(rotation,"kind","rotation");check((rotation["recoveryKey"] as String).length==64)
 check(!call("status").toString().contains(rotation["recoveryKey"] as String));check(!call("status").toString().contains("123456"))
 field(call("enroll"),"code","integrationDisabled")
 println("Task90 actual Android singleton facade/Core/machine/native-layer adapter: PASS (OS/protected I/O/configuration substitutions disclosed)")
}
