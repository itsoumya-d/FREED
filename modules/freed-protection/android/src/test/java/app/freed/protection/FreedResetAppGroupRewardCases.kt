package app.freed.protection
import android.content.Context
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
@Suppress("UNCHECKED_CAST") fun groupRows(s:Map<String,Any?>)=s["groups"] as List<Map<String,Any?>>
fun main() {
 val context=Context();context.services[Context.APP_OPS_SERVICE]=AppOpsManager();context.services[Context.USAGE_STATS_SERVICE]=UsageStatsManager()
 val scope="[\"owner-A\",1]";context.storage.values["adult-DNS-policy"]="protected"
 check(FreedAppGroupStore.bindScope(context,scope));var snapshot=FreedAppGroupStore.snapshot(context,scope)
 fun create():Map<String,Any?> {val r=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"name" to "Reader"),scope,"create");check(r["accepted"]==true);snapshot=r["snapshot"] as Map<String,Any?>;val g=groupRows(snapshot).last();val update=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"id" to g["id"],"expectedRevision" to g["revision"],"name" to g["name"],"enabled" to true,"rule" to mapOf("kind" to "before-use"),"packages" to listOf("org.reader")),scope,"update");check(update["accepted"]==true);snapshot=update["snapshot"] as Map<String,Any?>;return groupRows(snapshot).last()}
 create()
 fun claim(session:String,category:String="breathe"):Map<String,Any?> {
  val g=FreedAppGroupStore.blockingGroup(context,"org.reader")!!;val id=java.util.UUID.randomUUID().toString()
  val pending=context.storage.edit().putString("id",id).putString("package","org.reader").putString("rule","app-group:${g["id"]}:${g["revision"]}")
  check(FreedAppGroupStore.issue(context,g,"org.reader",id,pending));check(pending.commit());val claim=context.storage.edit();FreedAppGroupStore.stage(context,context.storage.all,claim);check(claim.commit())
  val native=FreedAppGroupStore.pendingScope(context,context.storage.all)!!
  return mapOf("version" to 1,"policyVersion" to 1,"category" to category,"completionSessionId" to session,"templateId" to "gentle","templateVersion" to 1,"nativeInterventionId" to id,"kind" to "android-app-group","packageName" to "org.reader","groupId" to g["id"],"groupRevision" to g["revision"],"configurationGeneration" to native["configurationGeneration"],"scopeEpoch" to native["scopeEpoch"])
 }
 val q=claim("session-1");val before=context.storage.values.toMap()
 check(FreedAppGroupStore.fulfill(context,q["nativeInterventionId"] as String,"org.reader",System.now+7_200_000)==null){"Generic request cannot create group reward"}
 for(bad in listOf(q+mapOf("seconds" to 7200),q+mapOf("policyVersion" to 2),q+mapOf("category" to "journal"),q+mapOf("templateVersion" to true),q+mapOf("scopeEpoch" to 99),q+mapOf("groupRevision" to 99),q+mapOf("configurationGeneration" to 99)))check(FreedAppGroupStore.grantResetReward(context,bad,scope)["accepted"]==false)
 check(context.storage.values==before)
 context.storage.failNext=true;check(FreedAppGroupStore.grantResetReward(context,q,scope)["accepted"]==false);check(context.storage.values==before){"Failed commit preserves claim and has no consumption"}
 val received=FreedAppGroupStore.grantResetReward(context,q,scope);check(received["accepted"]==true&&received["seconds"]==120L&&received["effective"]==true)
 val expiry=received["expiresAt"];check(expiry=="1970-01-01T00:18:40.000Z")
 System.now+=20_000;SystemClock.now+=20_000
 val retry=FreedAppGroupStore.grantResetReward(context,q,scope);check(retry["accepted"]==true&&retry["replayed"]==true&&retry["expiresAt"]==expiry)
 check(FreedAppGroupStore.grantResetReward(context,q+mapOf("category" to "move"),scope)["accepted"]==false)
 // Same-owner native cold binding reuses exact ledger and deadline.
 val reflected=FreedAppGroupStore.javaClass.getDeclaredField("boundScope").apply{isAccessible=true};reflected.set(null,null)
 val reflectedOwner=FreedAppGroupStore.javaClass.getDeclaredField("boundSignedInOwner").apply{isAccessible=true};reflectedOwner.setBoolean(null,false)
 check(FreedAppGroupStore.bindScope(context,scope));check(FreedAppGroupStore.grantResetReward(context,q,scope)["expiresAt"]==expiry)
 System.now-=10_000;SystemClock.now+=121_000
 check(FreedAppGroupStore.grantResetReward(context,q,scope)["accepted"]==false){"Backwards wall clock cannot extend monotonic cap"}
 System.now+=200_000
 check(FreedAppGroupStore.grantResetReward(context,q,scope)["accepted"]==false)
 val q2=claim("session-2","move");val moved=FreedAppGroupStore.grantResetReward(context,q2,scope);check(moved["accepted"]==true&&moved["seconds"]==300L)
 Settings.Global.boot+=1;SystemClock.now+=30_000
 check(FreedAppGroupStore.grantResetReward(context,q2,scope)["accepted"]==false)
 create();val q3=claim("session-3","find");val found=FreedAppGroupStore.grantResetReward(context,q3,scope);check(found["accepted"]==true&&found["seconds"]==300L&&found["effective"]==false&&found["remainingRestrictionCount"]==1)
 val q4=claim("session-4");check(FreedAppGroupStore.grantResetReward(context,q4,scope)["accepted"]==false){"A second group cannot stack a window"}
 check(FreedAppGroupStore.bindScope(context,"[\"owner-B\",2]"));check(FreedAppGroupStore.grantResetReward(context,q3,scope)["accepted"]==false)
 check(FreedAppGroupStore.bindScope(context,"[\"owner-A\",3]"));check(FreedAppGroupStore.grantResetReward(context,q3,"[\"owner-A\",3]")["accepted"]==false)
 // Same completion with a fresh event cannot reuse a consumed record within this owner store.
 val q5=claim("session-3");check(FreedAppGroupStore.grantResetReward(context,q5,"[\"owner-A\",3]")["accepted"]==false)
 FreedProtectionConfiguration.currentEpoch+=1
 context.storage.values.remove(FreedResetAppGroupRewardPolicy.LEDGER_KEY);context.storage.values.remove(FreedAppGroupStore.CLAIM_KEY)
 check(FreedAppGroupStore.grantResetReward(context,q3,"[\"owner-A\",3]")["accepted"]==false){"Protection reset invalidates original authority even if spent ledger is removed"}
 check(context.storage.values["adult-DNS-policy"]=="protected")
 println("Actual Android reward store: native caps, strict request, generic bypass rejection, atomic rollback, replay/restart, monotonic cap, expiry/reboot, overlap/stacking, owner/reset fences and adult/DNS retention passed")
}
