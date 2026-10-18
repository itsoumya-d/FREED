const retainedFixtureSupport = require('./android-retained-fixture-support');
// Actual native group store + actual org.json; only OS services/private preference I/O are local adapters.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const source = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const reviewBefore = '.superpowers/sdd/2026-10-08-challenge-earned-time-v2/android-native-evidence/review-clock-readback-before/';
const sourceFor = name => (process.argv.includes('--window20-before') && ['FreedEarnedAppTimePolicy','FreedAppGroupPolicy','FreedAppGroupStore','FreedEarnedChallengeProofPolicy','FreedEarnedChallengeEvidenceController'].includes(name) ? '.superpowers/sdd/2026-10-11-android-recovery-friend-lock/challenge-native-android/earned-window-20/before-' + name + '.kt' : (process.argv.includes('--round1-before') && ['FreedEarnedAppTimePolicy', 'FreedEarnedChallengeProofPolicy', 'FreedEarnedChallengeEvidenceController', 'FreedEarnedChallengeProofStore'].includes(name) ? '.superpowers/sdd/2026-10-11-android-recovery-friend-lock/challenge-native-android/fix-round1/before-' + name + '.kt' : (process.argv.includes('--proof-before') && ['FreedAppGroupStore', 'FreedEarnedAppTimePolicy'].includes(name) ? '.superpowers/sdd/2026-10-11-android-recovery-friend-lock/challenge-native-android/before-' + name + '.kt' : ((process.argv.includes('--clock-before') && name === 'FreedEarnedTimeClock') || (process.argv.includes('--lookup-before') && name === 'FreedAppGroupStore') ? reviewBefore : source) + name + '.kt')));
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
 interface Editor { fun putString(k:String,v:String?):Editor; fun putLong(k:String,v:Long):Editor;fun remove(k:String):Editor;fun commit():Boolean;fun apply() }
}
class MemoryPreferences:SharedPreferences {
 val values=mutableMapOf<String,Any?>();var failNext=false;var wrongReadback=false;var corruptNextKey:String?=null;var commits=0
 override val all get()=values.toMap();override fun contains(k:String)=values.containsKey(k)
 override fun getString(k:String,d:String?)=values[k] as? String?:d;override fun getLong(k:String,d:Long)=values[k] as? Long?:d;override fun getInt(k:String,d:Int)=(values[k] as? Number)?.toInt()?:d
 override fun edit()=Write()
 inner class Write:SharedPreferences.Editor {val writes=mutableMapOf<String,Any?>()
  override fun putString(k:String,v:String?)=apply{writes[k]=v};override fun putLong(k:String,v:Long)=apply{writes[k]=v};override fun remove(k:String)=apply{writes[k]=null}
  override fun apply(){commit()}
  override fun commit():Boolean {commits++;writes.forEach{(k,v)->if(v==null)values.remove(k)else values[k]=v};val accepted=!failNext;failNext=false
   if(wrongReadback&&writes.containsKey("app_groups_configuration_v1")){values["app_groups_configuration_v1"]="invalid";wrongReadback=false};corruptNextKey?.let{if(writes.containsKey(it)){values[it]="invalid";corruptNextKey=null}};return accepted }
 }
}
open class Context {var motionPermission=true;val packageName="app.freed";val storage=MemoryPreferences();val contentResolver=Any();val services=mutableMapOf<String,Any>()
 fun checkSelfPermission(p:String)=if(motionPermission)0 else -1;fun getSharedPreferences(n:String,m:Int):SharedPreferences=storage;fun getSystemService(n:String):Any?=services[n]
 companion object{const val MODE_PRIVATE=0;const val APP_OPS_SERVICE="ops";const val USAGE_STATS_SERVICE="usage";const val SENSOR_SERVICE="sensor"}
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
object SystemClock {var now=500_000L;fun elapsedRealtime()=now;fun elapsedRealtimeNanos()=now*1_000_000L}
object Build {object VERSION{const val SDK_INT=36}}
class Looper {companion object{fun getMainLooper()=Looper()}}
class Handler(l:Looper)
object Process {fun myUid()=42}
`);
  const settings = fixture('Settings.kt', `package android.provider
object Settings {object Global {const val BOOT_COUNT="boot";var boot=7;fun getInt(c:Any,key:String,default:Int)=boot}}
`);
  const runtime = fixture('Runtime.kt', `package app.freed.protection
import android.content.Context
object System {var now=1_000_000L;fun currentTimeMillis()=now}
object FreedProtectionConfiguration {var enabled=true;var resetInProgress=false;var currentEpoch=4L;fun epoch(c:Context)=currentEpoch;fun interceptionEnabled(c:Context)=enabled&&!resetInProgress}
object FreedAccessibilityService {
 const val PREFS_NAME="owned";const val BLOCKED_APP_PACKAGES="blocked";const val DAILY_LIMIT_MINUTES="limit";const val DEFAULT_DAILY_LIMIT_MINUTES=30
 const val EARNED_UNLOCK_SOURCE_PACKAGE="earned_package";const val EARNED_UNLOCK_EXPIRES_AT="earned_expiry";const val PENDING_FOCUS_SHIELD_RULE_ID="surface_rule";const val PENDING_DETECTED_AT="detected_at"
 const val PENDING_INTERVENTION_ID="id";const val PENDING_SOURCE_PACKAGE="package";const val PENDING_RULE="rule"
 var appSchedulesServiceConnected=true;var rechecks=0;fun requestAppGroupRecheck(){rechecks++};fun observedAppGroupUsage(c:Context,p:Set<String>)=emptyMap<String,Long>()
}
object FreedInstalledApplications {var installed=setOf("org.reader","org.game");fun eligible(c:Context)=installed}
data class TestSurfaceRule(val id:String,val packageName:String,val enabled:Boolean=true)
object FreedFocusShieldRules {var rules=emptyList<TestSurfaceRule>();fun list(c:Context)=rules}
object FreedAppGuardModeStore {fun read(c:Context)=c.storage.getString("mode","daily-limit")!!}
internal object FreedAppScheduleStore {var configuration=FreedAppSchedulePolicy.empty;fun read(c:Context)=configuration;fun snapshot(c:Context)=FreedAppSchedulePolicy.evaluate(configuration,System.now)}
`);
  const sensors = fixture('Sensors.kt', `package android.hardware
import android.os.Handler
class Sensor(val type:Int){companion object{const val TYPE_STEP_COUNTER=19;const val TYPE_STEP_DETECTOR=18}}
class SensorEvent(val sensor:Sensor,val values:FloatArray,val timestamp:Long)
interface SensorEventListener{fun onSensorChanged(event:SensorEvent);fun onAccuracyChanged(sensor:Sensor?,accuracy:Int)}
class SensorManager {var sensor:Sensor?=null;var registers=true;var listener:SensorEventListener?=null;var previous:SensorEventListener?=null;var unregisters=0
 fun getDefaultSensor(type:Int)=sensor?.takeIf{it.type==type};fun registerListener(l:SensorEventListener,s:Sensor,d:Int,h:Handler):Boolean{if(registers){listener=l;previous=l};return registers}
 fun unregisterListener(l:SensorEventListener){if(listener===l)listener=null;unregisters++}
 fun emit(value:Float,timestamp:Long){listener?.onSensorChanged(SensorEvent(sensor!!,floatArrayOf(value),timestamp))}
 fun late(value:Float,timestamp:Long){previous?.onSensorChanged(SensorEvent(sensor!!,floatArrayOf(value),timestamp))}
 companion object{const val SENSOR_DELAY_NORMAL=3}}
`);
  const permission = fixture('Permission.kt', `package android
object Manifest {object permission{const val ACTIVITY_RECOGNITION="motion"}}
`);
  const packageManager = fixture('PackageManager.kt', `package android.content.pm
object PackageManager{const val PERMISSION_GRANTED=0}
`);
  const activity = fixture('Activity.kt', `package android.app
open class Activity
`);
  const evidencePhoto = fixture('EvidencePhoto.kt', `package app.freed.protection
import android.content.Context
import android.app.Activity
internal class FreedEarnedChallengePhotoPipeline {
 fun cleanup(c:Context)=true;fun destroy(){};fun cancelSession(id:String){}
 fun capture(c:Context,a:Activity?,session:String,target:String,id:String,current:()->Boolean,publish:(String,String?)->Unit){error("Disabled photo target must never open camera or classify")}
}
`);
  const cases = fixture('AndroidEarnedAppTimeV2Cases.kt', fs.readFileSync('modules/freed-protection/tests/AndroidEarnedAppTimeV2Cases.kt','utf8') + (process.argv.includes('--proof') || process.argv.includes('--proof-before') ? '\n' + fs.readFileSync('modules/freed-protection/tests/AndroidEarnedChallengeEvidenceCases.kt','utf8') : '') + (process.argv.includes('--round1') || process.argv.includes('--round1-before') ? '\n' + fs.readFileSync('modules/freed-protection/tests/AndroidEarnedChallengeReviewCases.kt','utf8') : '') + (process.argv.includes('--window20') || process.argv.includes('--window20-before') ? '\n' + fs.readFileSync('modules/freed-protection/tests/AndroidEarnedWindow20Cases.kt','utf8') : ''));
  if (process.argv.includes('--proof') || process.argv.includes('--proof-before')) {
    const content = fs.readFileSync(cases, 'utf8').replace('fun main() {', 'fun main() {\n  ' + (process.argv.includes('--window20') || process.argv.includes('--window20-before') ? 'earnedWindow20Cases()' : process.argv.includes('--round1') || process.argv.includes('--round1-before') ? 'earnedChallengeRound1Cases()' : 'earnedChallengeEvidenceCases()')); fs.writeFileSync(cases, content);
  }
  const jar = join(workspace, 'store.jar');
  run('kotlinc', [android, ops, usage, clock, settings, runtime, sensors, permission, packageManager, activity, evidencePhoto, cases,
    ...['FreedInstalledAppPolicy', 'FreedAppGroupPolicy', 'FreedAppGroupAuthorityPolicy', 'FreedAppGroupTransaction', 'FreedAppGroupStore', 'FreedRetainedAdultProtection', 'FreedEarnedAppTimePolicy', 'FreedEarnedTimeClock', 'FreedNativeUnlockPolicy', 'FreedNativeUnlockStore', 'FreedAppSchedulePolicy', 'FreedDoomscrollApps', ...(process.argv.includes('--proof-before') ? [] : ['FreedEarnedChallengeProofPolicy','FreedEarnedChallengeProofStore','FreedEarnedChallengePhotoEvaluation','FreedEarnedChallengeStepSensor']), ...(process.argv.includes('--proof') ? ['FreedEarnedChallengeEvidenceController'] : [])].map(sourceFor),
    '-classpath', json, '-include-runtime', '-d', jar]);
  run('java', ['-classpath', jar + ':' + json, 'app.freed.protection.AndroidEarnedAppTimeV2CasesKt']);
} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
