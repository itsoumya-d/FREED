const retainedFixtureSupport = require('./android-retained-fixture-support');
// Production native store + actual extracted runtime/query/publication members; only OS I/O is adapted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const prefix = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const moduleSource = fs.readFileSync(join(root, prefix, 'FreedProtectionModule.kt'), 'utf8');
const serviceSource = fs.readFileSync(join(root, prefix, 'FreedAccessibilityService.kt'), 'utf8');
const json = join(root, '.superpowers/android-candidate-20261005/pinned-dependency-downloads/org.json_json_20180813/json-20180813.jar');
function member(source, marker) {
  const start = source.indexOf(marker); assert.ok(start >= 0, marker);
  const brace = source.indexOf('{', start); let depth = 1, quoted = false, escaped = false;
  for (let i = brace + 1; i < source.length; i++) {
    const c = source[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(marker);
}
function moduleMethod(marker, header, replacement, label) {
  return member(moduleSource, marker).replace(header, replacement).replaceAll('return@AsyncFunction', 'return@' + label).replaceAll('return@Function', 'return@' + label) + '}';
}
const workspace = fs.mkdtempSync(join(tmpdir(), 'freed-android-review-'));
function fixture(name, text) { const file = join(workspace, name); fs.writeFileSync(file, retainedFixtureSupport(name, text)); return file; }
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 300000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status) process.stderr.write(result.stderr || '');
  assert.equal(result.status, 0, result.error?.message || `${command} failed`);
}
try {
  const android = fixture('Context.kt', `package android.content
interface SharedPreferences {val all:Map<String,Any?>;fun contains(k:String):Boolean;fun getString(k:String,d:String?):String?;fun getLong(k:String,d:Long):Long;fun getInt(k:String,d:Int):Int;fun edit():Editor
 interface Editor {fun putString(k:String,v:String?):Editor;fun putLong(k:String,v:Long):Editor;fun remove(k:String):Editor;fun commit():Boolean;fun apply()}}
class MemoryPreferences:SharedPreferences {val values=mutableMapOf<String,Any?>();override val all get()=values.toMap();override fun contains(k:String)=values.containsKey(k);override fun getString(k:String,d:String?)=values[k] as? String?:d;override fun getLong(k:String,d:Long)=values[k] as? Long?:d;override fun getInt(k:String,d:Int)=(values[k] as? Number)?.toInt()?:d;override fun edit()=Write()
 inner class Write:SharedPreferences.Editor {val changes=mutableMapOf<String,Any?>();override fun putString(k:String,v:String?)=apply{changes[k]=v};override fun putLong(k:String,v:Long)=apply{changes[k]=v};override fun remove(k:String)=apply{changes[k]=null};override fun commit():Boolean {changes.forEach{(k,v)->if(v==null)values.remove(k)else values[k]=v};return true};override fun apply(){commit()}}}
open class Context {val packageName="app.freed";val applicationContext get()=this;val storage=MemoryPreferences();val contentResolver=Any();val services=mutableMapOf<String,Any>()
 fun getSharedPreferences(n:String,m:Int):SharedPreferences=storage;fun getSystemService(n:String)=services[n];companion object{const val MODE_PRIVATE=0;const val APP_OPS_SERVICE="ops";const val USAGE_STATS_SERVICE="usage"}}
`);
  const ops = fixture('Ops.kt', `package android.app
class AppOpsManager {var authorized=true;fun checkOpNoThrow(op:String,uid:Int,p:String)=if(authorized)0 else 1;companion object{const val MODE_ALLOWED=0;const val OPSTR_GET_USAGE_STATS="usage"}}
`);
  const usage = fixture('Usage.kt', `package android.app.usage
data class UsageStats(val packageName:String,val totalTimeInForeground:Long)
class UsageStatsManager {var rows=listOf<UsageStats>();var onQuery:(()->Unit)?=null;fun queryUsageStats(i:Int,start:Long,end:Long):List<UsageStats>{onQuery?.invoke();return rows};companion object{const val INTERVAL_DAILY=0}}
`);
  const clock = fixture('Clock.kt', `package android.os
object SystemClock {var now=500_000L;fun elapsedRealtime()=now};object Process{fun myUid()=42}
`);
  const settings = fixture('Settings.kt', `package android.provider
object Settings {object Global {const val BOOT_COUNT="boot";fun getInt(c:Any,k:String,d:Int)=7}}
`);
  const runtime = fixture('Runtime.kt', `package app.freed.protection
import android.content.Context
import java.util.Locale
import java.util.Calendar
import java.util.TimeZone
import java.util.UUID
import android.os.SystemClock
import android.app.usage.UsageStatsManager
import java.text.SimpleDateFormat
import java.util.Date
object System {var now=java.time.Instant.parse("2026-10-05T10:00:00Z").toEpochMilli();fun currentTimeMillis()=now}
object FreedProtectionConfiguration {var enabled=true;var resetInProgress=false;fun interceptionEnabled(c:Context)=enabled&&!resetInProgress;fun epoch(c:Context)=4L}
object FreedAccessibilityService {const val PREFS_NAME="owned";const val BLOCKED_APP_PACKAGES="blocked";const val DAILY_LIMIT_MINUTES="limit";const val DEFAULT_DAILY_LIMIT_MINUTES=30
 const val PENDING_INTERVENTION_ID="id";const val PENDING_SOURCE_PACKAGE="package";const val PENDING_RULE="rule";const val PENDING_FOCUS_SHIELD_RULE_ID="surface";const val PENDING_DETECTED_AT="detected"
 const val EARNED_UNLOCK_EXPIRES_AT="earned-expiry";const val EARNED_UNLOCK_SOURCE_PACKAGE="earned-source"
 var appSchedulesServiceConnected=true;fun requestAppGroupRecheck(){};fun observedAppGroupUsage(c:Context,p:Set<String>)=emptyMap<String,Long>()}
object FreedInstalledApplications {
 var candidates=listOf(mapOf<String,Any?>("packageName" to "org.reader","label" to "Reader","enabled" to true,"exported" to true),mapOf("packageName" to FreedDoomscrollApps.YOUTUBE_PACKAGE,"label" to "YouTube","enabled" to true,"exported" to true))
 var critical=emptySet<String>()
 fun eligible(c:Context)=FreedInstalledAppPolicy.select(candidates,c.packageName,critical).map{it["packageName"] as String}.toSet()
 fun list(c:Context)=FreedInstalledAppPolicy.select(candidates,c.packageName,critical).map{it+mapOf("iconUri" to null)}
 fun page(c:Context,q:String,o:Int,l:Int):Map<String,Any?> = mapOf("supported" to true,"apps" to list(c).drop(o).take(l),"total" to list(c).size,"nextOffset" to null,"reason" to null)
}
internal object FreedAppScheduleStore {var configuration=FreedAppSchedulePolicy.empty;fun read(c:Context)=configuration;fun snapshot(c:Context)=FreedAppSchedulePolicy.evaluate(configuration,System.now)}
data class TestSurface(val id:String,val packageName:String,val enabled:Boolean)
object FreedFocusShieldRules {fun list(c:Context)=emptyList<TestSurface>()}
object FreedUrlClassifier {fun normalizeHostForStorage(s:String)=s}
class ServiceRuntime:Context() {
 val PREFS_NAME="owned";val MODE_PRIVATE=0;val BLOCKED_APP_PACKAGES="blocked";val SUPPORTED_BLOCKED_APP_PACKAGES=FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES
 val PENDING_INTERVENTION_ID="id";val PENDING_URL="url";val PENDING_HOST="host";val PENDING_SOURCE_PACKAGE="package";val PENDING_REASON="reason";val PENDING_RULE="rule";val PENDING_DETECTED_AT="detected";val PENDING_FOCUS_SHIELD_RULE_ID="surface";val PENDING_SESSION_DURATION_SECONDS="duration";val MAX_FOREGROUND_SEGMENT_MS=14_400_000L
 var lastBlockedKey="";var lastLaunchElapsedMs=0L;var launches=0;var reached=true
 fun isDailyAppLimitReached(p:String)=reached;fun isEarnedUnlockActiveForPackage(p:String)=false;fun currentForegroundSessionMs(p:String)=0L
 fun appHostForPackage(p:String)=p+".app.freed.local";fun nowIsoString()=java.time.Instant.ofEpochMilli(System.now).toString()
 fun buildAccessibilityInterventionIntent(p:String,u:String,h:String,r:String,f:String?)=Any()
 fun showAccessibilityInterventionNotification(title:String,sourceLabel:String,sourcePackage:String,redactedUrl:String,host:String,matchedRule:String,focusShieldRuleId:String?){}
 fun startActivity(intent:Any){launches++}
${member(serviceSource, 'private fun blockedAppPackages(')}
${member(serviceSource, 'private fun isManuallyBlockedApp(')}
${member(serviceSource, 'private fun isConfiguredBlockedApp(')}
${member(serviceSource, 'private fun appGuardShouldInterrupt(')}
${member(serviceSource, 'private fun launchAppIntervention(').replaceAll('this@FreedAccessibilityService', 'this')}
 fun selected()=blockedAppPackages();fun manual(p:String)=isManuallyBlockedApp(p);fun configured(p:String)=isConfiguredBlockedApp(p);fun interrupt(p:String)=appGuardShouldInterrupt(p);fun launch(p:String){launchAppIntervention(p)}
}
object R {object string{const val freed_recovery_channel=1}}
object FreedNativeCopy {fun text(c:Context,id:Int)="recovery"}
class ModuleAppContext(val reactContext:Context?)
class DiagnosticsRuntime:Context() {
 val appContext=ModuleAppContext(this)
${moduleMethod('AsyncFunction("getInstalledApplications")', 'AsyncFunction("getInstalledApplications") {', 'fun installedApplications():List<Map<String,Any?>> { return run installed@ {', 'installed')}
${moduleMethod('AsyncFunction("getInstalledGroupApps")', 'AsyncFunction("getInstalledGroupApps") { query: String, offset: Int, limit: Int ->', 'fun installedPage(query:String,offset:Int,limit:Int):Map<String,Any?> { return run installedPage@ {', 'installedPage')}
${moduleMethod('Function("setAppGroupActionScope")', 'Function("setAppGroupActionScope") { scope: String ->', 'fun explicitScopeSetter(scope:String):Map<String,Any?> { return run setter@ {', 'setter')}
 val SUPPORTED_BLOCKED_APP_PACKAGES=FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES
 fun isUsageStatsAuthorized(c:Context)=true;fun isAccessibilityServiceEnabled(c:Context)=true
${member(moduleSource, 'private fun appScheduleStatusPayload(')}
${moduleSource.slice(moduleSource.indexOf('  private data class UsageStatsSnapshot('), moduleSource.indexOf('  private fun queryConfiguredUsageStats('))}
${moduleSource.slice(moduleSource.indexOf('  private fun staticBlockedPackages('), moduleSource.indexOf('  private fun sanitizeDailyLimitMinutes('))}
${member(moduleSource, 'private fun queryConfiguredUsageStats(')}
${moduleSource.includes('private fun redactPrivateAppDiagnostics(') ? member(moduleSource, 'private fun redactPrivateAppDiagnostics(') : 'private fun redactPrivateAppDiagnostics(payload:Map<String,Any>,scope:String?):Map<String,Any> = payload'}
 fun selected()=staticBlockedPackages(this);fun enforceable()=configuredBlockedPackages(this);fun runtimeStatus()=appScheduleStatusPayload(this)
 fun query():Map<String,Any> {
  val captured=FreedAppGroupStore.captureOwnerScope()
  val snapshot=queryConfiguredUsageStats(this) ?: return emptyMap()
  return redactPrivateAppDiagnostics(mapOf("adultFilterActive" to true,"blockedApplications" to configuredBlockedPackages(this).size,
   "usageStatsObservedPackageNames" to snapshot.observedPackageNames,"usageStatsTodayMinutesByPackage" to snapshot.todayMinutesByPackage),captured)
 }
 fun delayedPublication(payload:Map<String,Any>,captured:String?)=redactPrivateAppDiagnostics(payload,captured)
}
`);
  const tests = fixture('ReviewCases.kt', `package app.freed.protection
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.app.usage.UsageStats
import android.content.Context
import java.util.TimeZone
import java.util.UUID
fun main(args:Array<String>) {
 TimeZone.setDefault(TimeZone.getTimeZone("UTC"));val target="org.reader"
 if(args[0]=="runtime") {
  val r=ServiceRuntime();r.storage.values["blocked"]=target;r.storage.values["app_guard_mode_v1"]="before-use"
  check(r.interrupt(target)&&r.configured(target)&&r.manual(target));r.launch(target);check(r.launches==1)
  val before=r.storage.values.toMap();FreedInstalledApplications.critical=setOf(target)
  check(!r.interrupt(target)&&!r.configured(target)&&!r.manual(target)){"Newly critical installed app cannot retain manual before-use/daily-limit authority"}
  r.launch(target);check(r.launches==1&&r.storage.values==before){"Final barrier publication must recheck eligible PackageManager state, without deleting stored selection"}
  r.storage.values["app_guard_mode_v1"]="daily-limit";check(!r.interrupt(target)){"Reached daily-limit cannot restore a now-critical target"}
  FreedInstalledApplications.critical=emptySet();check(r.interrupt(target)){"Actual eligible daily-limit target still interrupts at its measured threshold"}
  val originalCandidates=FreedInstalledApplications.candidates
  FreedInstalledApplications.candidates=originalCandidates.map{if(it["packageName"]==target)it+mapOf("enabled" to false)else it}
  check(!r.interrupt(target)&&!r.configured(target)){"Disabled package loses native authority without clearing its stored policy"}
  FreedInstalledApplications.candidates=originalCandidates.filter{it["packageName"]!=target}
  check(!r.interrupt(target)&&!r.manual(target)){"Uninstalled package loses manual native authority"}
  FreedInstalledApplications.candidates=originalCandidates;FreedInstalledApplications.critical=setOf(target)
  val input=mapOf("version" to 1,"schedules" to listOf(mapOf("id" to "work","enabled" to true,"startMinute" to 540,"endMinute" to 720,"days" to listOf(1),"packages" to listOf(target))))
  FreedAppScheduleStore.configuration=FreedAppSchedulePolicy.parse(input,"app.freed",false,setOf(target))!!
  r.storage.values.remove("blocked");check(!r.interrupt(target)&&!r.configured(target)){"Active stored schedule cannot intercept newly critical HOME/Settings/emergency route"}
  val m=DiagnosticsRuntime();m.storage.values["blocked"]=target;check(m.enforceable().isEmpty()&&m.selected()==listOf(target)){"Eligibility removes runtime authority but retains unavailable canonical selection"}
  check(m.runtimeStatus()["appGuardReady"]==false&&m.runtimeStatus()["activeAppSchedulePackageCount"]==0){"Native readiness/schedule coverage must reflect current eligible authority, not unavailable stored targets"}
  FreedInstalledApplications.critical=emptySet();check(r.interrupt(target)&&m.enforceable()==listOf(target))
  val legacy=Context();val source=FreedDoomscrollApps.YOUTUBE_PACKAGE;val id="c2b4053a-a9e0-4209-9bba-6a6e0fb270ba"
  val pending=mapOf("id" to id,"package" to source,"rule" to "configured-app:"+source,"detected" to java.time.Instant.ofEpochMilli(System.now).toString())
  val stage=legacy.storage.edit();FreedNativeUnlockStore.stage(legacy,pending,stage);stage.commit()
  FreedInstalledApplications.critical=setOf(source)
  check(FreedNativeUnlockStore.fulfill(legacy,id,source,null,System.now+60_000L)==null){"Previously staged legacy claim cannot grant a now-critical package"}
  FreedInstalledApplications.critical=emptySet();check(FreedNativeUnlockStore.fulfill(legacy,id,source,null,System.now+60_000L)!=null)
  FreedInstalledApplications.critical=setOf(source)
  check(!FreedNativeUnlockStore.hasActivePackageGrant(legacy,source,System.now+60_000L,id)){"Old grant cannot remain effective or replay once eligibility changes"}
  val blockedStage=legacy.storage.edit();FreedNativeUnlockStore.stage(legacy,pending,blockedStage);blockedStage.commit();FreedInstalledApplications.critical=emptySet()
  // No new lease was minted while critical; only the pre-existing receipt is retained for readback.
  check(legacy.storage.all["claimed_native_unlock_lease_v1"]==null)
  println("Reviewed native runtime: manual/schedule/final barrier/module target sets/claim/grant/replay recheck actual installed eligibility; stored policy retained")
 } else {
  val m=DiagnosticsRuntime();m.storage.values["blocked"]=target;m.storage.values["adult-DNS-policy"]="protected"
  val usage=UsageStatsManager();usage.rows=listOf(UsageStats(target,300_000L));m.services[Context.USAGE_STATS_SERVICE]=usage;m.services[Context.APP_OPS_SERVICE]=AppOpsManager()
  val a="[\\"owner-A\\",1]";check(FreedAppGroupStore.bindScope(m,a))
  check((m.query()["usageStatsTodayMinutesByPackage"] as Map<*, *>)[target]==5)
  check(FreedAppGroupStore.bindScope(m,"[null,2]"))
  val out=m.query();check((out["usageStatsTodayMinutesByPackage"] as? Map<*, *>).isNullOrEmpty()&&(out["usageStatsObservedPackageNames"] as? List<*>).isNullOrEmpty()){ "Signed-out diagnostics must not expose arbitrary configured package IDs" }
  check(m.storage.values["blocked"]==target&&m.storage.values["adult-DNS-policy"]=="protected")
  check(FreedAppGroupStore.bindScope(m,a));val captured=FreedAppGroupStore.captureOwnerScope();val payload=m.query()
  check(FreedAppGroupStore.suspendPrivateOperations())
  val suspended=m.delayedPublication(payload,captured)
  check((suspended["usageStatsTodayMinutesByPackage"] as? Map<*, *>).isNullOrEmpty())
  check((m.query()["usageStatsTodayMinutesByPackage"] as? Map<*, *>).isNullOrEmpty()){ "Auth hydration suspension must also redact diagnostics" }
  check(FreedAppGroupStore.bindScope(m,a));check((m.query()["usageStatsTodayMinutesByPackage"] as Map<*, *>)[target]==5)
  check(FreedAppGroupStore.bindScope(m,"[\\"owner-B\\",3]"))
  val stale=m.delayedPublication(payload,captured)
  check((stale["usageStatsTodayMinutesByPackage"] as? Map<*, *>).isNullOrEmpty()&&(stale["usageStatsObservedPackageNames"] as? List<*>).isNullOrEmpty()){ "An asynchronous diagnostics payload cannot publish private targets after its captured owner changes" }
  check(stale["adultFilterActive"]==true&&stale["blockedApplications"]==1)
  check(FreedAppGroupStore.bindScope(m,a));usage.onQuery={FreedAppGroupStore.bindScope(m,"[null,4]")}
  val during=m.query();check((during["usageStatsTodayMinutesByPackage"] as? Map<*, *>).isNullOrEmpty())
  usage.onQuery=null;val ack=m.explicitScopeSetter(a);check(ack["accepted"]==true && ack["bindingCurrent"]==true && ack["ownerVerified"]==true && ack["stage"]=="complete" && ack["reason"]==null);check(UUID.fromString(ack["operationId"] as String).version()==4);check(ack["generation"] is Number && ack["scopeEpoch"] is Number)
  val coldBefore=m.storage.values.toMap()
  FreedAppGroupStore.javaClass.getDeclaredField("boundScope").apply{isAccessible=true}.set(null,null)
  FreedAppGroupStore.javaClass.getDeclaredField("boundSignedInOwner").apply{isAccessible=true}.setBoolean(null,false)
  check(FreedAppGroupStore.suspendPrivateOperations())
  val lateRead=FreedAppGroupStore.snapshot(m,a)
  check((lateRead["groups"] as List<*>).isEmpty())
  check(m.installedApplications().isEmpty()&&(m.installedPage("",0,20)["apps"] as List<*>).isEmpty()){ "Cold suspended installed inventory methods cannot implicitly bind the old token" }
  val coldDiagnostics=m.query()
  check((coldDiagnostics["usageStatsTodayMinutesByPackage"] as? Map<*, *>).isNullOrEmpty()&&!FreedAppGroupStore.ownerBound())
  check(m.storage.values==coldBefore){ "Read/inventory/diagnostics must not change owner, policy or persisted epochs during cold suspension" }
  check(m.explicitScopeSetter(a)["accepted"]==true)
  check(m.installedApplications().isNotEmpty()&&(m.query()["usageStatsTodayMinutesByPackage"] as Map<*, *>)[target]==5)
  check(m.storage.values==coldBefore){ "Only verified explicit same-owner setter resumes private reads without changing persisted native state" }
  println("Reviewed native diagnostics: signed-out/current-owner/scope-change and during-query publication privacy; installed policy and generic coverage retained")
 }
}
`);
  const challengeSensor = fixture('ChallengeSensor.kt', `package app.freed.protection
import android.content.Context
internal object FreedEarnedChallengeStepSensor {fun supported(c:Context)=false}
`);
  const jar = join(workspace, 'review.jar');
  run('kotlinc', [android, ops, usage, clock, settings, runtime, challengeSensor, tests,
    ...['FreedInstalledAppPolicy', 'FreedAppGroupPolicy', 'FreedAppGroupAuthorityPolicy', 'FreedAppGroupTransaction', 'FreedAppGroupStore', 'FreedRetainedAdultProtection', 'FreedEarnedAppTimePolicy', 'FreedEarnedTimeClock', 'FreedEarnedChallengeProofPolicy', 'FreedEarnedChallengeProofStore', 'FreedEarnedChallengePhotoEvaluation', 'FreedAppSchedulePolicy', 'FreedDoomscrollApps', 'FreedAppGuardModePolicy', 'FreedAppGuardModeStore', 'FreedNativeUnlockPolicy', 'FreedNativeUnlockStore'].map(name => prefix + name + '.kt'),
    '-classpath', json, '-include-runtime', '-d', jar]);
  run('java', ['-classpath', jar + ':' + json, 'app.freed.protection.ReviewCasesKt', process.argv[2] || 'runtime']);
} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
