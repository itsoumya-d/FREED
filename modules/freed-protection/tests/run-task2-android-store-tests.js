const retainedFixtureSupport = require('./android-retained-fixture-support');
// Actual native group store + actual org.json; only OS services/private preference I/O are local adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const source = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const json = join(root, '.superpowers/android-candidate-20261005/pinned-dependency-downloads/org.json_json_20180813/json-20180813.jar');
assert.ok(fs.existsSync(json), 'Use the already cached real org.json artifact; no download fallback');
const workspace = fs.mkdtempSync(join(tmpdir(), 'freed-task2-store-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 300000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status) process.stderr.write(result.stderr || '');
  assert.equal(result.status, 0, result.error?.message || `${command} failed`);
}
function fixture(name, body) { const path = join(workspace, name); fs.writeFileSync(path, retainedFixtureSupport(name, body)); return path; }
try {
  const android = fixture('Context.kt', `package android.content
interface SharedPreferences {
 val all:Map<String,Any?>; fun contains(k:String):Boolean; fun getString(k:String,d:String?):String?;fun getLong(k:String,d:Long):Long;fun getInt(k:String,d:Int):Int;fun edit():Editor
 interface Editor { fun putString(k:String,v:String?):Editor; fun putLong(k:String,v:Long):Editor;fun remove(k:String):Editor;fun commit():Boolean }
}
class MemoryPreferences:SharedPreferences {
 val values=mutableMapOf<String,Any?>();var failNext=false;var wrongReadback=false;var commits=0
 override val all get()=values.toMap();override fun contains(k:String)=values.containsKey(k)
 override fun getString(k:String,d:String?)=values[k] as? String?:d;override fun getLong(k:String,d:Long)=values[k] as? Long?:d;override fun getInt(k:String,d:Int)=(values[k] as? Number)?.toInt()?:d
 override fun edit()=Write()
 inner class Write:SharedPreferences.Editor {val writes=mutableMapOf<String,Any?>()
  override fun putString(k:String,v:String?)=apply{writes[k]=v};override fun putLong(k:String,v:Long)=apply{writes[k]=v};override fun remove(k:String)=apply{writes[k]=null}
  override fun commit():Boolean {commits++;writes.forEach{(k,v)->if(v==null)values.remove(k)else values[k]=v};val accepted=!failNext;failNext=false
   if(wrongReadback&&writes.containsKey("app_groups_configuration_v1")){values["app_groups_configuration_v1"]="invalid";wrongReadback=false};return accepted }
 }
}
open class Context {val packageName="app.freed";val storage=MemoryPreferences();val contentResolver=Any();val services=mutableMapOf<String,Any>()
 fun getSharedPreferences(n:String,m:Int):SharedPreferences=storage;fun getSystemService(n:String):Any?=services[n]
 companion object{const val MODE_PRIVATE=0;const val APP_OPS_SERVICE="ops";const val USAGE_STATS_SERVICE="usage"}
}
`);
  const ops = fixture('Ops.kt', `package android.app
class AppOpsManager {var authorized=true;fun checkOpNoThrow(op:String,uid:Int,p:String)=if(authorized)MODE_ALLOWED else 1
 companion object{const val MODE_ALLOWED=0;const val OPSTR_GET_USAGE_STATS="usage"}}
`);
  const usage = fixture('Usage.kt', `package android.app.usage
data class UsageStats(val packageName:String,val totalTimeInForeground:Long)
class UsageStatsManager {var rows=listOf<UsageStats>();fun queryUsageStats(i:Int,start:Long,end:Long)=rows;companion object{const val INTERVAL_DAILY=0}}
`);
  const clock = fixture('Clock.kt', `package android.os
object SystemClock {var now=500_000L;fun elapsedRealtime()=now}
object Process {fun myUid()=42}
`);
  const settings = fixture('Settings.kt', `package android.provider
object Settings {object Global {const val BOOT_COUNT="boot";var boot=7;fun getInt(c:Any,key:String,default:Int)=boot}}
`);
  const runtime = fixture('Runtime.kt', `package app.freed.protection
import android.content.Context
object System {var now=1_000_000L;fun currentTimeMillis()=now}
object FreedNativeUnlockStore {val lock=Any()}
object FreedProtectionConfiguration {var enabled=true;var resetInProgress=false;var currentEpoch=4L;fun epoch(c:Context)=currentEpoch;fun interceptionEnabled(c:Context)=enabled&&!resetInProgress}
object FreedAccessibilityService {
 const val PREFS_NAME="owned";const val BLOCKED_APP_PACKAGES="blocked";const val DAILY_LIMIT_MINUTES="limit";const val DEFAULT_DAILY_LIMIT_MINUTES=30
 const val PENDING_INTERVENTION_ID="id";const val PENDING_SOURCE_PACKAGE="package";const val PENDING_RULE="rule"
 var appSchedulesServiceConnected=true;var rechecks=0;fun requestAppGroupRecheck(){rechecks++};fun observedAppGroupUsage(c:Context,p:Set<String>)=emptyMap<String,Long>()
}
object FreedInstalledApplications {var installed=setOf("org.reader","org.game");fun eligible(c:Context)=installed}
object FreedAppGuardModeStore {fun read(c:Context)=c.storage.getString("mode","daily-limit")!!}
internal object FreedAppScheduleStore {var configuration=FreedAppSchedulePolicy.empty;fun read(c:Context)=configuration;fun snapshot(c:Context)=FreedAppSchedulePolicy.evaluate(configuration,System.now)}
`);
  const cases = fixture('StoreCases.kt', `package app.freed.protection
import android.content.Context
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.app.usage.UsageStats
import android.os.SystemClock
import org.json.JSONObject
@Suppress("UNCHECKED_CAST") fun groupRows(s:Map<String,Any?>)=s["groups"] as List<Map<String,Any?>>
fun main() {
 val context=Context();val ops=AppOpsManager();val usage=UsageStatsManager();context.services[Context.APP_OPS_SERVICE]=ops;context.services[Context.USAGE_STATS_SERVICE]=usage
 val scope="[\\"owner-A\\",1]";context.storage.values["adult-DNS-policy"]="protected"
 check(FreedAppGroupStore.bindScope(context,scope));var snapshot=FreedAppGroupStore.snapshot(context,scope)
 fun create(name:String):Map<String,Any?> {val r=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"name" to name),scope,"create");check(r["accepted"]==true);snapshot=r["snapshot"] as Map<String,Any?>;return groupRows(snapshot).last()}
 val reader=create("Reader");val game=create("Games");check(groupRows(snapshot).size==2)
 val before=context.storage.values.toMap();context.storage.failNext=true
 val failed=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"name" to "Rejected"),scope,"create")
 check(failed["accepted"]==false&&context.storage.values==before){"Failed disk commit must restore every old group and preserve unrelated adult filtering"}
 context.storage.wrongReadback=true
 check(FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"name" to "Readback failure"),scope,"create")["accepted"]==false)
 check(context.storage.values==before)
 fun update(group:Map<String,Any?>,packages:List<String>,rule:Map<String,Any?> = mapOf("kind" to "before-use")):Map<String,Any?> {
  val result=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"id" to group["id"],"expectedRevision" to group["revision"],"name" to group["name"],"enabled" to true,"rule" to rule,"packages" to packages),scope,"update")
  if(result["accepted"]==true)snapshot=result["snapshot"] as Map<String,Any?>;return result
 }
 FreedAccessibilityService.appSchedulesServiceConnected=false
 check(update(reader,listOf("org.reader"))["accepted"]==false&&context.storage.values==before)
 FreedAccessibilityService.appSchedulesServiceConnected=true
 check(update(reader,listOf("org.uninstalled"))["accepted"]==false&&context.storage.values==before)
 check(update(reader,listOf("org.reader"))["accepted"]==true)
 check(update(game,listOf("org.reader"))["accepted"]==true)
 val protected=FreedAppGroupStore.blockingGroup(context,"org.reader")!!
 val id="a2b4053a-a9e0-4209-9bba-6a6e0fb270ba"
 val pending=context.storage.edit().putString("id",id).putString("package","org.reader").putString("rule","app-group:\${protected["id"]}:\${protected["revision"]}")
 check(FreedAppGroupStore.issue(context,protected,"org.reader",id,pending));check(pending.commit())
 check(FreedAppGroupStore.pendingScope(context,context.storage.all)?.get("kind")=="android-app-group")
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)==null){"An issued event cannot fulfill until the real pending consume stages its claim"}
 val claim=context.storage.edit();FreedAppGroupStore.stage(context,context.storage.all,claim);check(claim.commit())
 check(FreedAppGroupStore.fulfill(context,id,"org.game",1_120_000L)==null)
 val rewardScope=FreedAppGroupStore.pendingScope(context,context.storage.all)!!
 val rewardRequest=mapOf("version" to 1,"policyVersion" to 1,"category" to "breathe","completionSessionId" to "fixture-session","templateId" to "fixture-breathe","templateVersion" to 1,"nativeInterventionId" to id,"kind" to "android-app-group","packageName" to "org.reader","groupId" to protected["id"],"groupRevision" to protected["revision"],"configurationGeneration" to rewardScope["configurationGeneration"],"scopeEpoch" to rewardScope["scopeEpoch"])
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)==null){"Generic group creation cannot bypass category reward policy"}
 check(FreedAppGroupStore.grantResetReward(context,rewardRequest,scope)["accepted"]==true)
 val granted=FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)!!
 check(granted["nativeUnlockGrantAccepted"]==true&&granted["appGroupBreakEffective"]==false&&granted["appGroupRemainingRestrictionCount"]==1){"Breaking one exact group must keep the overlapping group restricted"}
 ${process.argv.includes('--draft-discard') ? `
 val discard=FreedAppGroupStore.javaClass.methods.firstOrNull{it.name=="discardPendingSelection"}
 check(discard!=null){"Native target-fenced JS-only draft discard acknowledgement must exist"}
 val discardSnapshot=FreedAppGroupStore.snapshot(context,scope)
 val discardTarget=groupRows(discardSnapshot).first()
 val discardRequest=mapOf("version" to 1,"expectedStoreRevision" to discardSnapshot["revision"],"id" to discardTarget["id"],"expectedRevision" to discardTarget["revision"])
 fun discardReceipt(input:Map<String,Any?> = discardRequest,owner:String=scope):Map<String,Any?> = discard.invoke(FreedAppGroupStore,context,input,owner) as Map<String,Any?>
 val beforeDiscard=context.storage.values.toMap();val beforeRechecks=FreedAccessibilityService.rechecks;val beforeCommits=context.storage.commits
 val discarded=discardReceipt()
 check(discarded["accepted"]==true&&discarded["operation"]=="discard-pending-selection"&&discarded["targetId"]==discardTarget["id"]&&discarded["pendingSelectionDiscarded"]==true)
 check(context.storage.values==beforeDiscard&&FreedAccessibilityService.rechecks==beforeRechecks){"Success must leave exact committed packages/rule/enablement/claim/breaks/adult-DNS bytes and OS rechecks unchanged"}
 check(groupRows(discarded["snapshot"] as Map<String,Any?>).first()==discardTarget)
 context.storage.failNext=true
 check(discardReceipt()["accepted"]==true&&context.storage.failNext){"JS-only discard never commits native preferences, even if storage is read-only"}
 context.storage.failNext=false
 for(input in listOf(discardRequest+mapOf("expectedStoreRevision" to 0L),discardRequest+mapOf("expectedRevision" to 0L),discardRequest+mapOf("id" to "missing"),discardRequest+mapOf("version" to true))) {
  check(discardReceipt(input)["accepted"]==false&&context.storage.values==beforeDiscard&&FreedAccessibilityService.rechecks==beforeRechecks)
 }
 check(discardReceipt(owner="[\\"other-owner\\",99]")["accepted"]==false&&context.storage.values==beforeDiscard&&FreedAccessibilityService.rechecks==beforeRechecks)
 context.storage.values["app_group_scope_epoch_v1"]=999L
 val changedEpoch=context.storage.values.toMap();check(discardReceipt()["accepted"]==false&&context.storage.values==changedEpoch&&FreedAccessibilityService.rechecks==beforeRechecks)
 context.storage.values.clear();context.storage.values.putAll(beforeDiscard)
 context.storage.values["app_group_owner_digest_v1"]="different-owner"
 val changedOwner=context.storage.values.toMap();val staleOwnerReceipt=discardReceipt()
 check(staleOwnerReceipt["accepted"]==false&&groupRows(staleOwnerReceipt["snapshot"] as Map<String,Any?>).isEmpty()&&context.storage.values==changedOwner&&FreedAccessibilityService.rechecks==beforeRechecks)
 context.storage.values.clear();context.storage.values.putAll(beforeDiscard)
 context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY]="unreadable"
 val unreadable=context.storage.values.toMap();check(discardReceipt()["accepted"]==false&&context.storage.values==unreadable&&FreedAccessibilityService.rechecks==beforeRechecks)
 context.storage.values.clear();context.storage.values.putAll(beforeDiscard)
 FreedProtectionConfiguration.resetInProgress=true
 check(discardReceipt()["accepted"]==false&&context.storage.values==beforeDiscard&&FreedAccessibilityService.rechecks==beforeRechecks)
 FreedProtectionConfiguration.resetInProgress=false
 check(context.storage.commits==beforeCommits){"No successful, stale, corrupt, reset or read-only discard attempts may publish native preferences"}
 println("Data-only Android native discard: exact target/store/owner fences, read-only storage, corrupt storage, reset and zero preferences/OS recheck publications passed")
 ` : ''}
 val after=context.storage.values.toMap()
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_001L)==null&&context.storage.values==after){"Replay cannot renew a granted target break"}
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)!=null)
 val suspend=FreedAppGroupStore.javaClass.methods.firstOrNull{it.name=="suspendPrivateOperations"}
 check(suspend!=null){"Unknown/hydrating SDK owner needs a memory-only private-operation suspension"}
 val beforeUnknown=context.storage.values.toMap();val epochBeforeUnknown=FreedAppGroupStore.snapshot(context,scope)["scopeEpoch"]
 check(suspend.invoke(FreedAppGroupStore)==true)
 check(!FreedAppGroupStore.ownerBound()&&FreedAppGroupStore.captureOwnerScope()==null)
 check(groupRows(FreedAppGroupStore.snapshot(context,scope)).isEmpty())
 check(FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"name" to "Hydrating draft"),scope,"create")["accepted"]==false)
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)==null)
 check(context.storage.values==beforeUnknown){"Unknown owner suspension must not clear cold event/claims/leases or change installed policy"}
 check(FreedAppGroupStore.bindScope(context,scope))
 check(FreedAppGroupStore.snapshot(context,scope)["scopeEpoch"]==epochBeforeUnknown)
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)!=null){"Same verified owner resume must retain the genuine previously issued native receipt"}
 // Simulate a cold process with persisted genuine policy/receipt but no verified in-memory owner.
 val reflected=FreedAppGroupStore.javaClass.getDeclaredField("boundScope").apply{isAccessible=true}
 val reflectedOwner=FreedAppGroupStore.javaClass.getDeclaredField("boundSignedInOwner").apply{isAccessible=true}
 val reflectedSuspension=FreedAppGroupStore.javaClass.getDeclaredField("privateOperationsSuspended").apply{isAccessible=true}
 reflected.set(null,null);reflectedOwner.setBoolean(null,false);reflectedSuspension.setBoolean(null,false)
 val beforeCold=context.storage.values.toMap()
 val coldUnverified=FreedAppGroupStore.snapshot(context,scope)
 check(groupRows(coldUnverified).isEmpty()&&!FreedAppGroupStore.ownerBound()){ "A cold read cannot grant its own verified owner binding" }
 check(context.storage.values==beforeCold)
 check(FreedAppGroupStore.suspendPrivateOperations())
 val coldPaused=FreedAppGroupStore.snapshot(context,scope)
 check(groupRows(coldPaused).isEmpty()&&!FreedAppGroupStore.ownerBound()&&FreedAppGroupStore.captureOwnerScope()==null){ "A late old token cannot resume private access during cold auth suspension" }
 val coldCreate=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"name" to "Cold unauthorized draft"),scope,"create")
 check(coldCreate["accepted"]==false&&groupRows(coldCreate["snapshot"] as Map<String,Any?>).isEmpty())
 val coldPicker=FreedAppGroupStore.unsupportedPicker(context,scope)
 check(groupRows(coldPicker["snapshot"] as Map<String,Any?>).isEmpty())
 check(FreedAppGroupStore.blockingGroup(context,"org.reader")!=null){ "Device-native enforcement remains on while private operations are cold/suspended" }
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)==null)
 check(context.storage.values==beforeCold){ "Cold read/CRUD/picker calls must not alter prefs, policy, epoch, events, claims or leases" }
 check(FreedAppGroupStore.bindScope(context,scope))
 check(context.storage.values==beforeCold&&FreedAppGroupStore.snapshot(context,scope)["scopeEpoch"]==epochBeforeUnknown)
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)!=null){ "Only explicit same-owner binding may resume the genuine native handoff without renewing its receipt" }
 reflected.set(null,null)

 val epoch=snapshot["scopeEpoch"];check(FreedAppGroupStore.bindScope(context,scope))
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)!=null){"Same-owner cold start retains genuine issued receipt"}
 reflected.set(null,null);reflectedOwner.setBoolean(null,false);check(FreedAppGroupStore.suspendPrivateOperations())
 val beforeDifferentResume=context.storage.values.toMap()
 check(groupRows(FreedAppGroupStore.snapshot(context,scope)).isEmpty()&&context.storage.values==beforeDifferentResume)
 check(FreedAppGroupStore.bindScope(context,"[\\"owner-B\\",1]"))
 check(context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY]==beforeDifferentResume[FreedAppGroupStore.CONFIGURATION_KEY])
 check(FreedAppGroupStore.blockingGroup(context,"org.reader")!=null){ "Explicit different-owner resume relocks the existing policy" }
 check(FreedAppGroupStore.fulfill(context,id,"org.reader",1_120_000L)==null){"Different-owner cold start destroys the old native group receipt"}
 check(FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to 4,"name" to "Stale owner"),scope,"create")["accepted"]==false)
 val staleRead=FreedAppGroupStore.snapshot(context,scope)
 check(groupRows(staleRead).isEmpty()&&staleRead["configuredGroupCount"]==2){"Rejected old-owner reads must return only generic counts, not private group names/packages/breaks"}
 val staleReceipt=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to 4,"name" to "Stale owner"),scope,"create")
 check(groupRows(staleReceipt["snapshot"] as Map<String,Any?>).isEmpty()){ "Rejected old-owner mutation receipts must not disclose the new owner's private rows" }
 check(groupRows(FreedAppGroupStore.snapshot(context,"[\\"owner-B\\",1]")).size==2){"Exact current owner must still receive the native group state"}
 val stalePicker=FreedAppGroupStore.unsupportedPicker(context,scope)
 check(groupRows(stalePicker["snapshot"] as Map<String,Any?>).isEmpty()){ "Unsupported picker receipts must also use their initiating exact scope" }
 check(context.storage.values["adult-DNS-policy"]=="protected")
 // Restore owner for a real combined UsageStats budget, not fake package-specific defaults.
 check(FreedAppGroupStore.bindScope(context,scope));snapshot=FreedAppGroupStore.snapshot(context,scope)
 val first=groupRows(snapshot).first();usage.rows=listOf(UsageStats("org.reader",900_000L),UsageStats("org.game",900_000L))
 check(update(first,listOf("org.reader","org.game"),mapOf("kind" to "daily-limit","limitMinutes" to 30))["accepted"]==true)
 check(FreedAppGroupStore.blockingGroup(context,"org.game")?.get("id")==first["id"])
 ops.authorized=false;check(FreedAppGroupStore.blockingGroup(context,"org.game")==null){"Missing Usage Access cannot fabricate an active daily threshold"};ops.authorized=true
 FreedInstalledApplications.installed=setOf("org.reader");val unavailable=groupRows(FreedAppGroupStore.snapshot(context,scope)).first()["unavailablePackages"] as List<*>
 check(unavailable==listOf("org.game")){"Uninstalled packages remain stored and are reported unavailable"}
 val partial=groupRows(FreedAppGroupStore.snapshot(context,scope)).first()
 check(partial["active"]==true&&partial["ready"]==false){"Unavailable selection must not hide the real active rule still protecting an eligible target"}
 check(FreedAppGroupStore.blockingGroup(context,"org.game")==null){"A stored package that is no longer eligible cannot intercept a disabled/uninstalled or newly critical pathway"}
 SystemClock.now+=130_000L;System.now+=130_000L
 check(context.storage.values["adult-DNS-policy"]=="protected")
 val encoded=context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY] as String
 check(JSONObject(encoded).getJSONArray("groups").length()==2){"Use actual JSON roundtrip and retain both independent groups"}
 val signedOut="[null,9]"
 check(FreedAppGroupStore.bindScope(context,signedOut))
 val generic=FreedAppGroupStore.snapshot(context,signedOut)
 check(groupRows(generic).isEmpty()&&generic["configuredGroupCount"]==2){"Signed-out scope may read generic coverage counts, never private group names or targets"}
 check(FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to generic["revision"],"name" to "Signed-out private draft"),signedOut,"create")["accepted"]==false)
 check(context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY]==encoded){"Signed-out invalidation must retain device protection while denying private configuration"}
 check(FreedAppGroupStore.bindScope(context,scope));snapshot=FreedAppGroupStore.snapshot(context,scope)
 FreedAccessibilityService.appSchedulesServiceConnected=false
 val draft=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"name" to "Offline draft"),scope,"create")
 check(draft["accepted"]==true){"A disabled draft must remain editable after runtime permission disconnects"}
 snapshot=draft["snapshot"] as Map<String,Any?>
 val removeTarget=groupRows(snapshot).first()
 val removed=FreedAppGroupStore.mutate(context,mapOf("version" to 1,"expectedStoreRevision" to snapshot["revision"],"id" to removeTarget["id"],"expectedRevision" to removeTarget["revision"]),scope,"remove")
 check(removed["accepted"]==true){"Explicit removal must not be blocked by another group's missing permission"}
 FreedAccessibilityService.appSchedulesServiceConnected=true
 val finalGroup=FreedAppGroupStore.blockingGroup(context,"org.reader")!!
 val finalId="b2b4053a-a9e0-4209-9bba-6a6e0fb270ba"
 val finalPending=context.storage.edit().putString("id",finalId).putString("package","org.reader").putString("rule","app-group:\${finalGroup["id"]}:\${finalGroup["revision"]}")
 check(FreedAppGroupStore.issue(context,finalGroup,"org.reader",finalId,finalPending));check(finalPending.commit())
 val finalClaim=context.storage.edit();FreedAppGroupStore.stage(context,context.storage.all,finalClaim);check(finalClaim.commit())
 val finalExpiry=System.now+120_000L
 val finalScope=FreedAppGroupStore.pendingScope(context,context.storage.all)!!
 val finalRequest=mapOf("version" to 1,"policyVersion" to 1,"category" to "breathe","completionSessionId" to "fixture-final-session","templateId" to "fixture-breathe","templateVersion" to 1,"nativeInterventionId" to finalId,"kind" to "android-app-group","packageName" to "org.reader","groupId" to finalGroup["id"],"groupRevision" to finalGroup["revision"],"configurationGeneration" to finalScope["configurationGeneration"],"scopeEpoch" to finalScope["scopeEpoch"])
 check(FreedAppGroupStore.grantResetReward(context,finalRequest,scope)["accepted"]==true)
 check(FreedAppGroupStore.fulfill(context,finalId,"org.reader",finalExpiry)?.get("appGroupBreakEffective")==true)
 val clear=FreedAppGroupStore.javaClass.methods.firstOrNull{it.name=="clearEarnedBreaks"}
 check(clear!=null){"Explicit central earned-window cancellation must also relock scoped group breaks"}
 check(clear.invoke(FreedAppGroupStore,context)==true)
 check(FreedAppGroupStore.fulfill(context,finalId,"org.reader",finalExpiry)==null&&FreedAppGroupStore.blockingGroup(context,"org.reader")!=null)
 check(context.storage.values["adult-DNS-policy"]=="protected")
 println("Actual Android group store: JSON persistence, native commit/readback rollback, connected runtime/eligibility, exact issued-and-consumed claims, overlap, replay, owner cold start, combined UsageStats, missing permissions and unavailable package reporting passed")
}
`);
  const retentionCases = process.argv.includes('--adult-retention') ? fixture('AndroidRetainedCleanupCases.kt', fs.readFileSync(join(__dirname, 'AndroidRetainedCleanupCases.kt'), 'utf8')) : null;
  if (retentionCases) fs.writeFileSync(cases, fs.readFileSync(cases, 'utf8').replace('fun main() {', 'fun main() {\n retainedCleanupCases()'));
  const challengeSensor = fixture('ChallengeSensor.kt', `package app.freed.protection
import android.content.Context
internal object FreedEarnedChallengeStepSensor {fun supported(c:Context)=false}
`);
  const jar = join(workspace, 'store.jar');
  run('kotlinc', [android, ops, usage, clock, settings, runtime, challengeSensor, cases, ...(retentionCases ? [retentionCases] : []),
    ...['FreedInstalledAppPolicy', 'FreedAppGroupPolicy', 'FreedAppGroupAuthorityPolicy', 'FreedAppGroupTransaction', 'FreedAppGroupStore', 'FreedRetainedAdultProtection', 'FreedEarnedAppTimePolicy', 'FreedEarnedTimeClock', 'FreedEarnedChallengeProofPolicy', 'FreedEarnedChallengeProofStore', 'FreedEarnedChallengePhotoEvaluation', 'FreedNativeUnlockPolicy', 'FreedAppSchedulePolicy', 'FreedDoomscrollApps'].map(name => source + name + '.kt'),
    '-classpath', json, '-include-runtime', '-d', jar]);
  if (retentionCases) {
    const evidence = join(root, '.superpowers/sdd/2026-10-13-publishable-recovery/task-81-android-boundary');
    fs.copyFileSync(jar, join(evidence, 'retention-fixture.jar'));
    const generated=join(evidence,'generated-retention-fixture');fs.mkdirSync(generated,{recursive:true});
    for(const name of fs.readdirSync(workspace).filter(name=>name.endsWith('.kt')))fs.copyFileSync(join(workspace,name),join(generated,name));
  }
  run('java', ['-classpath', jar + ':' + json, 'app.freed.protection.StoreCasesKt']);
} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
