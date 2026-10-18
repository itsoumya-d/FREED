package app.freed.protection

import android.content.Context
import android.content.MemoryPreferences
import android.app.NotificationManager
import expo.modules.kotlin.AppContext
import java.util.UUID
import org.json.JSONObject

private class SessionHost(val context:Context=Context()) {
 val app=AppContext();val identity=Any();var registered=true
 val lease=FreedPrivateModuleLease {registered && app.registry.getModule("FreedProtection")===identity}
 init {app.registry.modules["FreedProtection"]=identity}
 fun create()=FreedPrivateAccountAdmission.create(lease)
 fun session()=FreedPrivateAccountAdmission.construct(app,lease)
 fun prepare(s:FreedAccountBindingSession,raw:String="[\"A\",1]",seq:Long=1)=FreedPrivateAccountAdmission.prepare(context,lease,s,raw,UUID.randomUUID().toString(),seq)
 fun commit(s:FreedAccountBindingSession,t:Map<String,Any?>)=FreedPrivateAccountAdmission.commit(context,lease,s,t["ticket"] as String)
 fun bind(raw:String="[\"A\",1]"):Pair<FreedAccountBindingSession,Map<String,Any?>>{check(create());val s=session();val r=commit(s,prepare(s,raw));check(r["accepted"]==true);return s to r}
}
fun privateSessionCleanupCases() {
 fun scope(r:Map<String,Any?>)=r["actionScope"] as String
 fun cleanup(h:SessionHost,r:Map<String,Any?>)=FreedAppGroupStore.preparePrivateCleanup(h.context,scope(r),r["bindingHandle"] as String)["operationId"] as String
 fun run(h:SessionHost,id:String)=FreedRetainedAdultProtection.execute(h.context,id){true}
 fun settle(h:SessionHost,id:String):Map<String,Any?> {var r=run(h,id);repeat(200){if(r["phase"] in setOf("terminal","superseded"))return r;Thread.sleep(2);r=FreedRetainedAdultProtection.status(h.context,id)};error(r.toString())}
 val old=SessionHost();check(old.create());check(old.create());val oldSession=old.session();val ticket=old.prepare(oldSession)
 val fresh=SessionHost(old.context);val (freshSession,freshReceipt)=fresh.bind()
 check(old.commit(oldSession,ticket)["accepted"]==false)
 check(runCatching{old.session()}.isFailure)
 check(!old.create());FreedPrivateAccountAdmission.destroy(old.lease)
 check(FreedPrivateAccountAdmission.valid(scope(freshReceipt),fresh.lease))
 check(FreedAppGroupStore.bindScope(fresh.context,"[\"A\",1]")==false)
 val queuedScope=scope(freshReceipt);freshSession.sharedObjectDidRelease()
 check(!FreedPrivateAccountAdmission.valid(queuedScope))
 check(FreedAppGroupStore.mutate(fresh.context,mapOf("version" to 1),queuedScope,"create")["accepted"]==false)
 val noJsi=SessionHost();check(noJsi.create());noJsi.app.runtime.installed=false;check(runCatching{noJsi.session()}.isFailure)
 val delayed=SessionHost();val newer=SessionHost();check(newer.create());check(!delayed.create())
 val mismatch=SessionHost();check(mismatch.create());val wrong=mismatch.session();mismatch.registered=false
 check(mismatch.prepare(wrong)["accepted"]==false)
 val a=SessionHost();val (aSession,receipt)=a.bind();val token=scope(receipt)
 a.context.services[Context.NOTIFICATION_SERVICE]=NotificationManager()
 a.context.storage.values["adult_unknown_bytes"]="retained-corrupt-value"
 a.context.storage.values["dns_guard_user_enabled"]=true
 a.context.storage.values["pending_private"]="old-A"
 a.context.storage.values["native_package_unlock_receipt_v1"]="old-lease"
 val encrypted=a.context.getSharedPreferences("freed_encrypted_dns",0) as MemoryPreferences;encrypted.values["sealed"]="adult"
 val adult=a.context.storage.values.filterKeys{!FreedRetainedAdultProtection.privateKey(it)}
 FreedRetainedAdultProtection.publishPrivateNotice(a.context,9403){}
 FreedRetainedAdultProtection.publishPrivateNotice(a.context,9404){}
 val id=cleanup(a,receipt);check(UUID.fromString(id).toString()==id)
 val privateBefore=a.context.storage.values.toMap()
 check(FreedRetainedAdultProtection.reconcilePrivateFence(a.context))
 check(a.context.storage.values==privateBefore && FreedPrivateAccountAdmission.valid(token))
 val beforeTicket=a.prepare(aSession,seq=2)
 check(a.context.storage.values==privateBefore) {"Prepared reservation cannot arm on generic reconciliation or Auth prepare"}
 val erase=run(a,id)
 check(a.context.storage.values.keys.none(FreedRetainedAdultProtection::privateKey))
 check(a.commit(aSession,beforeTicket)["accepted"]==false)
 check(!FreedPrivateAccountAdmission.valid(token))
 check(a.context.storage.values==adult && encrypted.values["sealed"]=="adult" && FreedVpnService.running)
 check(FreedAppGroupStore.snapshot(a.context,token)["groups"]==emptyList<Any>())
 val erased=settle(a,id);check(erased["phase"]=="terminal" && erased["privateCleanupAccepted"]==true)
 val b=SessionHost(a.context);val (_,bReceipt)=b.bind("[\"B\",2]")
 b.context.storage.values["pending_B"]="B-data"
 FreedRetainedAdultProtection.publishPrivateNotice(b.context,9404){}
 val beforeB=b.context.storage.values.toMap();val cleanupPrefs=b.context.getSharedPreferences("freed_private_cleanup_v2",0) as MemoryPreferences
 val commits=cleanupPrefs.commits;val scrubs=FreedAccessibilityService.cleanupCalls
 val replay=run(b,id);check(replay["replay"]==true&&replay["phase"]=="terminal")
 check(b.context.storage.values==beforeB && cleanupPrefs.commits==commits && FreedAccessibilityService.cleanupCalls==scrubs)
 check(FreedPrivateAccountAdmission.valid(scope(bReceipt)))
 check(run(b,UUID.randomUUID().toString())["accepted"]==false)
 check(a.commit(oldSession,ticket)["accepted"]==false)
 // Delayed A main callback owns only A's namespace; B survives after timeout/exclusion release.
 val c=SessionHost();val (_,cr)=c.bind();c.context.services[Context.NOTIFICATION_SERVICE]=NotificationManager()
 val cid=cleanup(c,cr);FreedAccessibilityService.delayCleanup=true;check(run(c,cid)["runtimeScrubComplete"]==false)
 val late=FreedAccessibilityService.delayedCleanup!!;FreedAccessibilityService.delayCleanup=false
 val d=SessionHost(c.context);d.bind("[\"D\",9]");d.context.storage.values["pending_D"]="D"
 val count=FreedAccessibilityService.cleanupCalls;check(!late());check(FreedAccessibilityService.cleanupCalls==count && d.context.storage.values["pending_D"]=="D")
 check(settle(d,cid)["phase"]=="superseded")
 // Failed erase is durably fenced; retry by ID requires neither old raw bind nor live Auth/session.
 val e=SessionHost();val (_,er)=e.bind();e.context.services[Context.NOTIFICATION_SERVICE]=NotificationManager()
 e.context.storage.values["pending_e"]="private";val eid=cleanup(e,er);e.context.storage.failNext=true
 check(run(e,eid)["accepted"]==false);check(!FreedPrivateAccountAdmission.valid(scope(er)))
 check(settle(e,eid)["phase"]=="terminal")
 // Corrupt/legacy state is unavailable, never empty success.
 val f=SessionHost();val (_,fr)=f.bind();val fid=cleanup(f,fr)
 (f.context.getSharedPreferences("freed_private_cleanup_v2",0) as MemoryPreferences).values["document"]="corrupt"
 check(run(f,fid)["accepted"]==false)
 val legacy=SessionHost();(legacy.context.getSharedPreferences("freed_private_cleanup_receipt_v1",0) as MemoryPreferences).values["junk"]="old"
 check(legacy.create());check(legacy.prepare(legacy.session())["accepted"]==false)
 // Held protected/DNS worker cannot delay the separate native private erasure or acknowledgement.
 val held=SessionHost();val (_,hr)=held.bind();held.context.services[Context.NOTIFICATION_SERVICE]=NotificationManager()
 held.context.storage.values["pending_held"]="private";val hid=cleanup(held,hr)
 FreedAdultAuthorizationExecutor.held=true
 val pending=run(held,hid);check(pending["privateCleanupAccepted"]==true && pending["runtimeScrubComplete"]==false)
 check(held.context.storage.values.keys.none(FreedRetainedAdultProtection::privateKey));FreedAdultAuthorizationExecutor.held=false
 check(settle(held,hid)["phase"]=="terminal")
 // Resource routing retains the original controller across replacement and never adopts B.
 val owned=SessionHost();check(owned.create());var cancelledA=0;var cancelledB=0
 FreedPrivateAccountAdmission.registerProcessOwner(owned.lease){cancelledA++;true}
 val ownedSession=owned.session();val ownedReceipt=owned.commit(ownedSession,owned.prepare(ownedSession))
 val replacement=SessionHost(owned.context);check(replacement.create())
 FreedPrivateAccountAdmission.registerProcessOwner(replacement.lease){cancelledB++;true}
 replacement.bind("[\"B-resource\",2]")
 check(FreedPrivateAccountAdmission.cancelOriginalProcess(ownedReceipt["bindingHandle"] as String))
 check(cancelledA==1 && cancelledB==0)
 check(FreedPrivateAccountAdmission.cancelOriginalProcess(ownedReceipt["bindingHandle"] as String) && cancelledA==1)
 // Prepared reservation survives fresh Module creation without erasure or an implicit execute.
 val reserved=SessionHost();val (_,rr)=reserved.bind();reserved.context.storage.values["pending_reserved"]="keep"
 val rid=cleanup(reserved,rr);val reserveBytes=reserved.context.storage.values.toMap()
 val reopened=SessionHost(reserved.context);val (_,reopenReceipt)=reopened.bind()
 check(reopened.context.storage.values==reserveBytes && FreedPrivateAccountAdmission.valid(scope(reopenReceipt)))
 check(FreedRetainedAdultProtection.status(reopened.context,rid)["phase"]=="prepared")
 // Every failed/lost document publication is retryable by ID; arming cannot leave old admission live.
 for (boundary in 1..6) {
  val t=SessionHost();val (_,tr)=t.bind();t.context.services[Context.NOTIFICATION_SERVICE]=NotificationManager()
  t.context.storage.values["pending_boundary"]="erase";val tid=cleanup(t,tr)
  val doc=t.context.getSharedPreferences("freed_private_cleanup_v2",0) as MemoryPreferences
  doc.failAt=doc.commits+boundary
  val failure=run(t,tid)
  check(!FreedPrivateAccountAdmission.valid(scope(tr))) {"Uncertain armed fence admitted an old caller at boundary $boundary"}
  doc.failAt=0
  check(settle(t,tid)["phase"]=="terminal")
 }
 // Capacity preserves all unresolved reservations. No eviction may convert unknown ID into execution.
 val capacity=SessionHost();var last=capacity.bind().second;val ids=mutableListOf<String>()
 repeat(32) { index ->
  if(index>0)last=capacity.bind().second
  ids.add(cleanup(capacity,last))
 }
 last=capacity.bind().second
 val overflow=FreedAppGroupStore.preparePrivateCleanup(capacity.context,scope(last),last["bindingHandle"] as String)
 check(overflow["accepted"]==false)
 check(ids.all { FreedRetainedAdultProtection.status(capacity.context,it)["phase"]=="prepared" })
 println("Task87 prepared reservation/cold reopen, every document boundary, arming-before-fence retry, original-controller routing and unresolved capacity passed")
 println("Task87 actual session/Store/retained methods: lifecycle order/release/registry/no-JSI, native ticket/fence, erase/ID replay/B/delayed-main/failure/legacy/adult retention and held Core passed")
}
