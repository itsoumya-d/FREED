package app.freed.protection

import android.content.Context
import android.content.MemoryPreferences
import android.app.NotificationManager
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.ExecutorService
import java.util.concurrent.TimeUnit

private class H87 {
 val context=Context();val notifications=NotificationManager()
 val authority:FreedAdultAuthorizationExecutor
 init {context.services[Context.NOTIFICATION_SERVICE]=notifications;context.storage.values["dns_guard_user_enabled"]=true;context.storage.values["adult_unknown_bytes"]="retained";authority=FreedAdultAuthorizationExecutor.get(context)}
 fun bind(owner:String):String {var scope="";check(Task87Fixture.bind(context,"[\"$owner\",1]"){scope=it});return scope}
 fun prepare(scope:String):String=FreedAppGroupStore.preparePrivateCleanup(context,scope,FreedPrivateAccountAdmission.handle(scope)!!)["operationId"] as String
 fun execute(id:String,process:Boolean=true)=FreedRetainedAdultProtection.execute(context,id){process}
 fun status(id:String)=FreedRetainedAdultProtection.status(context,id)
 fun doc()=context.getSharedPreferences("freed_private_cleanup_v2",0) as MemoryPreferences
 fun record(id:String)=JSONObject(doc().getString("document",null)!!).getJSONObject("records").getJSONObject(id)
 fun await(id:String):Map<String,Any?> {var r=status(id);repeat(400){if(r["phase"] in setOf("terminal","superseded"))return r;Thread.sleep(5);r=status(id)};return r}
 fun freshAuthority():FreedAdultAuthorizationExecutor {FreedAdultAuthorizationExecutor::class.java.getDeclaredField("instance").apply{isAccessible=true}.set(null,null);return FreedAdultAuthorizationExecutor.get(context)}
}
private fun holdCleanupQueue():()->Unit {
 val executor=FreedRetainedAdultProtection::class.java.getDeclaredField("coreExecutor").apply{isAccessible=true}.get(FreedRetainedAdultProtection) as ExecutorService
 val entered=CountDownLatch(1);val release=CountDownLatch(1)
 executor.submit{entered.countDown();check(release.await(10,TimeUnit.SECONDS))};check(entered.await(2,TimeUnit.SECONDS));return {release.countDown()}
}
private fun authorize(h:H87):Pair<FriendLockRecord,FriendLockAdultChange> {
 FreedAdultProtectionState.migrate(h.context)
 val config=FreedAdultProtectionState.configuration(h.context)
 h.authority.core.enroll("123456","123456",FriendLockBaseline(config,true,byteArrayOf(87)))
 val op=h.authority.prepareDnsStop().get(3,TimeUnit.SECONDS);h.authority.authorize(op,"123456").get(3,TimeUnit.SECONDS)
 return h.authority.store.load()!! to h.authority.journal.read().operations.getValue(op).change()
}
private fun multi(uncertain:Boolean=false) {
 val h=H87();val (original,change)=authorize(h)
 if(uncertain)h.authority.journal.save(h.authority.journal.read().copy(uncertainty=setOf("unrelated-sticky")))
 val release=holdCleanupQueue()
 val a=h.prepare(h.bind("A"));check(h.execute(a)["privateCleanupAccepted"]==true)
 val b=h.prepare(h.bind("B"));check(h.execute(b)["privateCleanupAccepted"]==true)
 check(h.record(a).getString("core")=="pending"&&h.record(b).getString("core")=="pending")
 check(runCatching{h.authority.prepareDnsStop().get(3,TimeUnit.SECONDS)}.isFailure){"Armed native IDs must close fresh adult authorization"}
 // Reopen the actual singleton graph against the same persisted protected bytes/journal before either reservation.
 val recreated=h.freshAuthority();check(recreated.store.load()!!.authorizationGeneration==original.authorizationGeneration)
 release()
 if(uncertain){Thread.sleep(120);h.execute(a);h.execute(b);Thread.sleep(120)
  check(h.status(a)["runtimeScrubComplete"]==false&&h.status(b)["runtimeScrubComplete"]==false)
  check(recreated.store.load()!!.authorizationGeneration==original.authorizationGeneration)
  check(recreated.journal.read().uncertainty.contains("unrelated-sticky"));println("PASS unrelated actual journal uncertainty remains pending across two armed IDs and recreation");return}
 // Both exact retries must advance despite being armed before the first Core reservation.
 h.execute(a);h.execute(b)
 val ar=h.await(a);val br=h.await(b)
 check(ar["phase"] in setOf("terminal","superseded")&&br["phase"]=="terminal"){"Both original IDs must settle after the actual Core cohort: A=$ar B=$br"}
 val after=recreated.store.load()!!
 check(after.authorizationGeneration==original.authorizationGeneration+1&&after.operations.isEmpty()){"One continuously closed cohort must invalidate only once"}
 check(after.pin.salt.contentEquals(original.pin.salt)&&after.pin.derived.contentEquals(original.pin.derived)&&after.recovery.derived.contentEquals(original.recovery.derived))
 check(recreated.journal.read().uncertainty.contains("private-cleanup-invalidated-receipts"))
 val later=recreated.core.prepare(change,FreedAdultProtectionState.configuration(h.context));val newer=recreated.store.load()!!
 val bytes=h.context.storage.all;val privateCommits=h.doc().commits
 h.execute(a);h.execute(b)
 check(h.context.storage.all==bytes&&h.doc().commits==privateCommits)
 check(recreated.store.load()!!.operations.any{it.operationID==later.operationID}&&recreated.store.load()!!.authorizationGeneration==newer.authorizationGeneration)
 println("PASS actual retained+singleton machine/Core two armed IDs, exact retries/recreation, one original invalidation, credentials/sticky evidence and newer protected authority")
}
private fun history(lostAck:Boolean) {
 val h=H87();FreedVpnService.publishHistory("original-A")
 val id=h.prepare(h.bind("history-A"));val originalIdentity=FreedVpnService.capturePrivateRuntimeHistoryIdentity()
 if(lostAck){var fired=false;h.doc().commitGate={writes->val text=writes["document"] as? String
   if(!fired&&text!=null&&JSONObject(text).getJSONObject("records").getJSONObject(id).optBoolean("runtime")){fired=true;"before"}else null}
  check(h.execute(id)["accepted"]==false);check(fired);h.doc().commitGate=null
 }else{h.notifications.fail=true;FreedRetainedAdultProtection.publishPrivateNotice(h.context,9404){};check(h.execute(id)["runtimeScrubComplete"]==false);h.notifications.fail=false}
 check(FreedVpnService.historySnapshot().take(4)==listOf(null,null,"",0L))
 val afterOriginal=FreedVpnService.historySnapshot();check(FreedVpnService.capturePrivateRuntimeHistoryIdentity()!=originalIdentity)
 FreedVpnService.publishHistory("newer-device-history");val newer=FreedVpnService.historySnapshot()
 h.execute(id);val result=h.await(id)
 check(result["phase"]=="terminal"){"Original successful history scrub became permanently pending on exact partial/lost-ack retry: $result"}
 check(FreedVpnService.historySnapshot()==newer){"Exact retry adopted/cleared newer history"}
 val commits=h.doc().commits;h.execute(id);check(h.doc().commits==commits&&FreedVpnService.historySnapshot()==newer)
 check(afterOriginal.last()!=newer.last());println("PASS actual history setters+retained coordinator ${if(lostAck)"lost runtime save" else "notification failure"}: original effect settles once, retry/terminal replay preserve newer publication")
}
private fun activity(mode:String) {
 val id=UUID.randomUUID().toString();val a=FreedInterventionActivity();a.publishForCase();a.finishMode=mode
 check(!activityScrub87(id){true})
 check(!activityScrub87(id){true}){"Unconfirmed/throwing Activity became successful null absence on exact retry"}
 check(a.finishCalls==2){"Exact original Activity was not retained for retry"}
 a.finishMode="success";check(activityScrub87(id){true});check(a.finishCalls==3)
 val b=FreedInterventionActivity();b.publishForCase();check(activityScrub87(id){true});check(b.finishCalls==0&&a.finishCalls==3){"Lost aggregate acknowledgement cleared replacement Activity"}
 println("PASS actual Activity $mode failure, retained original reference, positive exact retry and replacement after settled replay")
}
private fun activityReplacement(reused:Boolean) {
 val id=UUID.randomUUID().toString();val a=FreedInterventionActivity();a.publishForCase();a.finishMode="success"
 FreedProtectionConfiguration.deferMain=true;check(!activityScrub87(id){true});FreedProtectionConfiguration.deferMain=false
 val b=if(reused)a else FreedInterventionActivity();b.publishForCase();b.finishMode="success"
 val work=FreedProtectionConfiguration.mainWork.removeAt(0);work()
 if(reused){check(a.finishCalls==0){"Delayed original callback dismissed a reused presentation"}}
 else{check(b.finishCalls==0);check(activityScrub87(id){true});check(b.finishCalls==0){"Original exact retry adopted replacement Activity"}}
 check(activityScrub87(id){true});check(b.finishCalls==0)
 // A delayed original namespace callback never touches a replacement under a later owner.
 val late=UUID.randomUUID().toString();FreedProtectionConfiguration.deferMain=true;var valid=true;check(!activityScrub87(late){valid});FreedProtectionConfiguration.deferMain=false
 val c=FreedInterventionActivity();c.publishForCase();valid=false;FreedProtectionConfiguration.mainWork.removeAt(0).invoke();check(c.finishCalls==0)
 println("PASS actual Activity deferred main/timeout ${if(reused)"reused presentation" else "replacement resource"}, exact retry and later-owner namespace fence")
}
private fun cohortLostAckCapacity() {
 val h=H87();val (original,change)=authorize(h)
 var allowA=false;var allowB=false;var a="";var b=""
 h.doc().commitGate={writes -> val text=writes["document"] as? String
  if(text==null)null else {val rows=JSONObject(text).getJSONObject("records")
   if(a.isNotEmpty()&&rows.optJSONObject(a)?.optString("core")=="complete"&&!allowA || b.isNotEmpty()&&rows.optJSONObject(b)?.optString("core")=="complete"&&!allowB) "before" else null}}
 a=h.prepare(h.bind("lost-leader-A"));h.execute(a)
 repeat(400){if(h.authority.privateCleanupInvalidationStatus(a)!="complete")Thread.sleep(5)}
 check(h.authority.privateCleanupInvalidationStatus(a)=="complete"&&h.record(a).getString("core")=="pending")
 check(runCatching{h.authority.prepareDnsStop().get(3,TimeUnit.SECONDS)}.isFailure){"Lost leader acknowledgement must keep the native gate closed"}
 b=h.prepare(h.bind("lost-follower-B"));h.execute(b);check(h.record(b).optString("coreLeader")==a)
 allowA=true;check(h.await(a)["phase"] in setOf("terminal","superseded"))
 Thread.sleep(60);check(h.record(b).getString("core")=="pending")
 check(!FreedRetainedAdultProtection.coreCleanupCanForget(h.context,a))
 // Fill the real bounded native document: terminal A is still a live lookup dependency for pending B.
 repeat(30){h.prepare(h.bind("prepared-capacity-$it"))}
 val latest=h.bind("overflow-owner")
 check(FreedAppGroupStore.preparePrivateCleanup(h.context,latest,FreedPrivateAccountAdmission.handle(latest)!!)["accepted"]==false)
 check(h.record(a).getString("phase") in setOf("terminal","superseded")&&h.record(b).getString("coreLeader")==a)
 check(!FreedRetainedAdultProtection.coreCleanupCanForget(h.context,a)&&h.authority.privateCleanupInvalidationStatus(a)=="complete")
 val active=FreedRetainedAdultProtection::class.java.getDeclaredField("coreRunning").apply{isAccessible=true}.get(FreedRetainedAdultProtection) as MutableSet<*>
 repeat(400){if(active.isNotEmpty())Thread.sleep(5)};check(active.isEmpty())
 // Recreate actual Core/store/journal composition after lost follower acknowledgement and drop the memory outcome cache.
 (FreedRetainedAdultProtection::class.java.getDeclaredField("coreOutcomes").apply{isAccessible=true}.get(FreedRetainedAdultProtection) as MutableMap<*,*>).clear()
 val cold=h.freshAuthority();check(cold.privateCleanupInvalidationStatus(a)=="complete")
 allowB=true;h.doc().commitGate=null
 val newer=h.context.storage.all;h.execute(b);val result=h.await(b);check(result["phase"] in setOf("terminal","superseded")){result.toString()}
 check(h.context.storage.all==newer&&cold.store.load()!!.authorizationGeneration==original.authorizationGeneration+1)
 check(cold.journal.read().uncertainty.contains("private-cleanup-invalidated-receipts"))
 check(FreedRetainedAdultProtection.coreCleanupCanForget(h.context,a))
 println("PASS actual lost leader/follower acknowledgement, continuously closed cohort, terminal leader dependency at32-record capacity and cold exact follower settlement")
}
private fun reopenedCohort() {
 val h=H87();val a=h.prepare(h.bind("first-unenrolled"));h.execute(a);check(h.await(a)["phase"]=="terminal")
 check(!FreedRetainedAdultProtection.adultCleanupPending(h.context,null))
 val (newAuthority,change)=authorize(h)
 val b=h.prepare(h.bind("new-cohort"));h.execute(b)
 check(h.record(b).optString("coreLeader")==b){"A reopened gate must never attach newer authority to an old cohort"}
 check(h.await(b)["phase"]=="terminal"&&h.authority.store.load()!!.authorizationGeneration==newAuthority.authorizationGeneration+1)
 val later=h.authority.core.prepare(change,FreedAdultProtectionState.configuration(h.context));val before=h.authority.store.load()!!
 h.execute(a);h.execute(b)
 check(h.authority.store.load()!!.authorizationGeneration==before.authorizationGeneration&&h.authority.store.load()!!.operations.any{it.operationID==later.operationID})
 println("PASS actual gate reopening creates a new root and invalidates its own later authority once; old terminal IDs cannot revoke newer protected authority")
}
private fun reservedLeader() {
 val h=H87();val (original,change)=authorize(h);val release=holdCleanupQueue()
 val b=h.prepare(h.bind("original-reserved-B"));h.execute(b)
 check(h.authority.machine.reservePrivateCleanup(b)=="requested")
 val a=h.prepare(h.bind("later-armed-A"));h.execute(a)
 // Exact pre-upgrade pending representation: links absent, actual original Core reservation intact.
 val doc=JSONObject(h.doc().getString("document",null)!!);doc.getJSONObject("records").getJSONObject(a).remove("coreLeader");doc.getJSONObject("records").getJSONObject(b).remove("coreLeader")
 h.doc().edit().putString("document",doc.toString()).commit();h.execute(a)
 val cold=h.freshAuthority();check(cold.privateCleanupInvalidationStatus(b)=="requested");release()
 h.execute(a);h.execute(b)
 check(h.await(a)["phase"] in setOf("terminal","superseded")&&h.await(b)["phase"] in setOf("terminal","superseded"))
 check(cold.store.load()!!.authorizationGeneration==original.authorizationGeneration+1&&cold.journal.read().cleanups.size==1)
 check(cold.journal.read().cleanups[b]?.phase=="complete")
 println("PASS actual pre-existing requested reservation, missing-link migration, original-leader selection and Core graph recreation without a second invalidation")
}
private fun activityCapacity() {
 val ids=mutableListOf<String>();val resources=mutableListOf<FreedInterventionActivity>()
 repeat(32){val id=UUID.randomUUID().toString();val a=FreedInterventionActivity();a.publishForCase();check(!activityScrub87(id){true});ids.add(id);resources.add(a);activityForget87(id)}
 val unknown=UUID.randomUUID().toString();val b=FreedInterventionActivity();b.publishForCase()
 check(!activityScrub87(unknown){true}&&b.finishCalls==0)
 resources.forEach { it.destroyForCase() }
 b.finishMode="success"
 check(!activityScrub87(unknown){true}&&b.finishCalls==0){"An unavailable original capture cannot adopt a later resource after capacity frees"}
 val fresh=UUID.randomUUID().toString();check(activityScrub87(fresh){true}&&b.finishCalls==1)
 println("PASS actual32 unresolved Activity captures retained through prune requests, positive destroy reclamation, unknown capture remains pending and fresh resource admission")
}
private fun uncertainFollower() {
 val h=H87();val (original,change)=authorize(h);var allowA=false;var a=""
 h.doc().commitGate={writes -> val text=writes["document"] as? String
  if(!allowA&&a.isNotEmpty()&&text!=null&&JSONObject(text).getJSONObject("records").optJSONObject(a)?.optString("core")=="complete") "before" else null}
 a=h.prepare(h.bind("uncertain-leader"));h.execute(a)
 repeat(400){if(h.authority.privateCleanupInvalidationStatus(a)!="complete")Thread.sleep(5)}
 check(h.authority.privateCleanupInvalidationStatus(a)=="complete"&&h.record(a).getString("core")=="pending")
 val release=holdCleanupQueue();val b=h.prepare(h.bind("uncertain-follower"));h.execute(b)
 FreedAdultProtectionState.guarded(h.context){h.authority.journal.save(h.authority.journal.read().copy(uncertainty=h.authority.journal.read().uncertainty+"unrelated-after-leader"))}
 allowA=true;h.doc().commitGate=null;val cold=h.freshAuthority();release()
 h.execute(b);Thread.sleep(120)
 check(h.status(b)["runtimeScrubComplete"]==false&&h.record(b).getString("core")=="pending")
 check(cold.store.load()!!.authorizationGeneration==original.authorizationGeneration+1&&cold.journal.read().uncertainty.contains("unrelated-after-leader"))
 println("PASS actual unrelated uncertainty after leader completion keeps unacknowledged follower pending after graph recreation without another protected invalidation")
}
fun main(args:Array<String>){when(args.single()){"multi"->multi();"cohortLost"->cohortLostAckCapacity();"reserved"->reservedLeader();"activityCapacity"->activityCapacity();"reopened"->reopenedCohort();"uncertain"->multi(true);"uncertainFollower"->uncertainFollower();"history"->history(false);"historyLost"->history(true);"activity"->activity("unconfirmed");"activityThrow"->activity("throw");"activityReplacement"->activityReplacement(false);"activityReused"->activityReplacement(true);else->error("unknown")}}
