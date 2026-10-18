const retainedFixtureSupport = require('./android-retained-fixture-support');
// Actual native group store + actual org.json; only OS services/private preference I/O are local adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const source = process.argv.includes('--before') ? '.superpowers/sdd/2026-10-08-verified-blocking-balanced-screens/task-native-reward-before/modules/freed-protection/android/src/main/java/app/freed/protection/' : 'modules/freed-protection/android/src/main/java/app/freed/protection/';
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
  const cases = fixture('FreedResetAppGroupRewardCases.kt', fs.readFileSync('modules/freed-protection/android/src/test/java/app/freed/protection/FreedResetAppGroupRewardCases.kt','utf8'));
  const challengeSensor = fixture('ChallengeSensor.kt', `package app.freed.protection
import android.content.Context
internal object FreedEarnedChallengeStepSensor {fun supported(c:Context)=false}
`);
  const jar = join(workspace, 'store.jar');
  run('kotlinc', [android, ops, usage, clock, settings, runtime, challengeSensor, cases,
    ...['FreedInstalledAppPolicy', 'FreedAppGroupPolicy', 'FreedAppGroupAuthorityPolicy', 'FreedAppGroupTransaction', 'FreedAppGroupStore', 'FreedRetainedAdultProtection', 'FreedEarnedAppTimePolicy', 'FreedEarnedTimeClock', 'FreedEarnedChallengeProofPolicy', 'FreedEarnedChallengeProofStore', 'FreedEarnedChallengePhotoEvaluation', 'FreedNativeUnlockPolicy', 'FreedAppSchedulePolicy', 'FreedDoomscrollApps'].map(name => (process.argv.includes('--before') && !['FreedAppGroupStore', 'FreedRetainedAdultProtection','FreedAppGroupAuthorityPolicy'].includes(name) ? 'modules/freed-protection/android/src/main/java/app/freed/protection/' : source) + name + '.kt'),
    '-classpath', json, '-include-runtime', '-d', jar]);
  run('java', ['-classpath', jar + ':' + json, 'app.freed.protection.FreedResetAppGroupRewardCasesKt']);
} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
