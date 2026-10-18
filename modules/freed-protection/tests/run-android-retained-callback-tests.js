// Actual event/usage/close/cleanup members + actual retained helper and AppGroupStore.
// OS event/tree/scheduling I/O is substituted; no production fence is reimplemented.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {join,resolve}=require('node:path');
const {tmpdir}=require('node:os');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'../../..');
const native=join(root,'modules/freed-protection/android/src/main/java/app/freed/protection');
const evidence=join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-85-android-enrolled-executor/callbacks');fs.mkdirSync(evidence,{recursive:true});
const base=join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-81-android-boundary/generated-retention-fixture');
const workspace=fs.mkdtempSync(join(tmpdir(),'freed-retained-callback-'));
const source=fs.readFileSync(process.argv.includes('--before')?join(evidence,'FreedAccessibilityService.before.kt'):join(native,'FreedAccessibilityService.kt'),'utf8');
const members=[];
function member(marker){const start=source.indexOf(marker);assert.ok(start>=0,marker);const brace=source.indexOf('{',start);let depth=1,q=false,e=false;for(let i=brace+1;i<source.length;i++){const c=source[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')q=false;continue;}if(c==='"')q=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){const body=source.slice(start,i+1);members.push({marker,sha256:createHash('sha256').update(body).digest('hex')});return body;}}throw Error(marker);}
function write(name,text){const p=join(workspace,name);fs.writeFileSync(p,text);return p;}
function run(c,args){const p=spawnSync(c,args,{cwd:root,encoding:'utf8',timeout:300000});process.stdout.write(p.stdout||'');if(p.status)process.stderr.write(p.stderr||'');assert.equal(p.status,0,p.error?.message||c+' failed');}
try {
const files=['Context.kt','Ops.kt','Usage.kt','Clock.kt','Settings.kt','ChallengeSensor.kt'].map(name=>{let text=fs.readFileSync(join(base,name),'utf8');if(name==='Context.kt')text=text.replace('interface Editor {','interface Editor {fun apply();').replace('override fun commit():Boolean','override fun apply(){commit()};override fun commit():Boolean');if(name==='Clock.kt')text=text.replace('object Process {','object Process {fun myPid()=1;');if(name==='Context.kt')text=text.replace('fun getSystemService(n:String):Any?=services[n]', 'fun getSystemService(n:String):Any?=services[n];fun <T> getSystemService(c:Class<T>):T?=c.cast(services[c.name])').replace('open class Context {','open class Context {val applicationContext get()=this;val noBackupFilesDir=java.nio.file.Files.createTempDirectory("freed85-callback-").toFile();val packageManager=android.content.pm.PackageManager();');return write(name,text);});
let runtime=fs.readFileSync(join(base,'Runtime.kt'),'utf8');
runtime=runtime.replace('fun clearOwnedRuntimeForReset():Boolean{cleanupCalls++;cleanupHook?.invoke();return cleanupAccepted}', 'fun clearOwnedRuntimeForReset():Boolean{cleanupCalls++;cleanupHook?.invoke();return cleanupAccepted && (CallbackService.connected?.clearForCase() ?: true)}');
runtime=runtime.replace('fun interceptionEnabled(c:Context)=', 'fun runOnMainForReset(operation:()->Boolean)=operation();fun interceptionEnabled(c:Context)=');
runtime=runtime.replace('object FreedFocusShieldRules {', 'object FreedFocusShieldRules {fun hasEnabledPresetRulesForPackage(c:Context,p:String)=false;fun matchingPresetRules(c:Context,p:String,r:String)=emptyList<CallbackRule>();fun isSurfaceUnlockActiveForRule(c:Context,r:CallbackRule)=false;');
runtime=runtime.replace('object FreedProtectionConfiguration {','object FreedProtectionConfiguration {const val INTERCEPTION_DISABLED="protection_interception_disabled_v1";');
runtime=runtime.replace('object System {','object System {fun nanoTime()=java.lang.System.nanoTime();');
runtime=runtime.slice(0,runtime.indexOf('object FreedWebsiteRecoveryHandoff'))+runtime.slice(runtime.indexOf('object FreedInterventionActivity'));
runtime=runtime.replace('object FreedVpnService {','object FreedVpnService {val dnsGuardRuntimeReady get()=running;val dnsGuardCaptivePaused=false;val dnsGuardIpv6UnsupportedPackets=java.util.concurrent.atomic.AtomicLong(0);fun encryptedDnsHealthy():Boolean?=null;val isRunning get()=running;fun userEnabledReadback(c:Context)=c.storage.all["dns_guard_user_enabled"] as? Boolean;fun isUserEnabled(c:Context)=c.storage.getBoolean("dns_guard_user_enabled",false);fun ownedRuntimeCanReactivate()=!running;fun setUserEnabled(c:Context,b:Boolean,p:FreedAdultPermit?=null){c.storage.edit().putBoolean("dns_guard_user_enabled",b).commit()};fun stopOwnedRuntimeForReset(c:Context,r:String,p:FreedAdultPermit?=null):Boolean{running=false;return true};');
runtime=runtime.replace('object FreedVpnService {','internal object FreedVpnService {');
runtime=runtime.replace('const val PENDING_INTERVENTION_ID=', 'const val PENDING_HOST="pending_host";const val PENDING_FOCUS_SHIELD_RULE_ID="pending_focus_shield_rule_id";const val PENDING_SESSION_DURATION_SECONDS="pending_session_duration_seconds";const val PENDING_DETECTED_AT="pending_detected_at";const val PENDING_INTERVENTION_ID=');
runtime+='\ninternal class FriendLockKeystoreBytes(c:Context):FriendLockProtectedBytes{val values=mutableMapOf<String,ByteArray>();override fun read(k:String)=values[k];override fun write(k:String,b:ByteArray){values[k]=b.clone()};override fun remove(k:String){values.remove(k)}}\nclass NetworkDnsState(val mode:String);object FreedNetworkDnsState{fun read(c:Context)=NetworkDnsState("off")}\n';
files.push(write('Runtime.kt',runtime));
files.push(write('TopologyOs.kt',`package android.os
object Build{object VERSION{const val SDK_INT=36}}
`));
const lowerGenerated=join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-85-android-enrolled-executor/generated-adult-fixture');
for(const name of ['AtomicFile.kt','DirectorySync.kt','Pm.kt','ProcessTopology.kt'])files.push(write(name,fs.readFileSync(join(lowerGenerated,name),'utf8')));
files.push(write('Event.kt',`package android.view.accessibility
class AccessibilityEvent(val packageName:CharSequence?,val eventType:Int=TYPE_WINDOW_STATE_CHANGED,val url:String="https://adult.example"){companion object{const val TYPE_WINDOW_STATE_CHANGED=32}}
`));
files.push(write('Uri.kt',`package android.net
class Uri(private val text:String){val host:String? get()=java.net.URI(text).host;fun getQueryParameter(k:String):String?=java.net.URI(text).rawQuery?.split('&')?.firstOrNull{it.substringBefore('=')==k}?.substringAfter('=')?.let{decode(it)};companion object{fun parse(t:String)=Uri(t);fun decode(t:String)=java.net.URLDecoder.decode(t,"UTF-8")}}
`));
const track=member('  private fun trackForegroundUsage(');const close=member('  private fun finishForegroundUsageSegment(');const ensure=member('  private fun ensureDailyUsageWindow(');
const fixed=source.includes('  private class PrivateUsageScope');
const fields=fixed?source.slice(source.indexOf('  private class PrivateUsageScope'),source.indexOf('  private fun capturePrivateUsageScope(')):'';
const capture=fixed?member('  private fun capturePrivateUsageScope('):'';
files.push(write('CallbackService.kt',`package app.freed.protection
import android.content.*
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import java.util.Locale
import java.util.TimeZone
import java.text.SimpleDateFormat
import java.util.Date
import java.util.UUID
open class CallbackServiceBase:Context(){open fun onAccessibilityEvent(event:AccessibilityEvent?){}}
class CallbackRule
class Calibration{fun onAccessibilityEvent(e:AccessibilityEvent,p:String?){};fun disposeWithoutResult(){}}
class BrowserHandlers{fun contains(p:String)=p=="com.android.chrome"}
object FreedFocusShieldRollout{var callbackHook:(()->Unit)?=null;fun enabled(c:Context):Boolean{callbackHook?.invoke();return false}}

object R{object string{const val freed_start_recovery=1;const val freed_recovery_channel=2}}
object FreedNativeCopy{fun text(c:Context,i:Int)="Recovery"}
internal class CallbackService:CallbackServiceBase(){
 companion object{var connected:CallbackService?=null;const val PREFS_NAME=FreedAccessibilityService.PREFS_NAME;const val APP_USAGE_DATE_KEY=FreedAccessibilityService.APP_USAGE_DATE_KEY;const val APP_USAGE_PREFIX=FreedAccessibilityService.APP_USAGE_PREFIX;const val LAST_FOREGROUND_PACKAGE=FreedAccessibilityService.LAST_FOREGROUND_PACKAGE;const val LAST_FOREGROUND_ELAPSED_MS=FreedAccessibilityService.LAST_FOREGROUND_ELAPSED_MS;const val MAX_FOREGROUND_SEGMENT_MS=14_400_000L;const val PENDING_INTERVENTION_ID=FreedAccessibilityService.PENDING_INTERVENTION_ID;const val PENDING_HOST=FreedAccessibilityService.PENDING_HOST;const val PENDING_SOURCE_PACKAGE=FreedAccessibilityService.PENDING_SOURCE_PACKAGE;const val PENDING_RULE=FreedAccessibilityService.PENDING_RULE;const val PENDING_DETECTED_AT=FreedAccessibilityService.PENDING_DETECTED_AT;const val PENDING_URL="pending_url";const val PENDING_REASON="pending_reason"}
 var connectedCurrent=true;var nextConfiguredHook:(()->Unit)?=null;var browserLaunches=0;val configured=setOf("org.reader","org.game");val eligibleWebHandlers=BrowserHandlers();var appGroupCheckRunnable:Any?=null;var appScheduleCheckRunnable:Any?=null;var scheduledLimitPackage:String?=null;var shortFormPackage:String?=null;var shortFormRule:String?=null;var scheduledEarnedUnlockRelockPackage:String?=null;var scheduleConnectionEpoch=1L;var lastScheduleForegroundPackage:String?=null;val focusShieldCalibrationTransitionLock=Any();var focusShieldCalibrationRequestedGeneration=0L;var focusShieldCalibrationSession:Calibration?=null;var focusShieldCalibrationSessionOwnerEpoch=0L;var lastLaunchElapsedMs=0L;var lastBlockedKey=""
 ${fields}
 ${capture}
 fun ownsConnectedRuntime()=connectedCurrent&&connected===this
 fun liveScheduleForegroundPackage():String?="com.android.chrome";fun isScreenInteractiveAndUnlocked()=true;fun armAppScheduleCheck(){};fun recheckAppGroups(p:String){}
 fun isConfiguredBlockedApp(p:String):Boolean{nextConfiguredHook?.let{nextConfiguredHook=null;it()};return p in configured}
 fun appGuardShouldInterrupt(p:String)=false;fun isEarnedUnlockActiveForPackage(p:String)=false;fun shortFormRuleForEvent(p:String,e:AccessibilityEvent):String?=null;fun isCurrentShortFormSurface(p:String,r:String)=false;fun isWebViewContext(e:AccessibilityEvent)=false
 fun scheduleEarnedUnlockRelock(p:String){};fun launchAppIntervention(p:String,reason:String){};fun launchFocusShieldIntervention(p:String,r:String,f:CallbackRule){};fun beginOrContinueShortFormSession(p:String,r:String){};fun scheduleAppLimitCheck(p:String){};fun cancelAppLimitCheck(p:String){};fun cancelShortFormSession(p:String){}
 fun cancelAppGroupCheck(){appGroupCheckRunnable=null};fun cancelAppScheduleCheck(){appScheduleCheckRunnable=null};fun cancelAnyAppLimitCheck(){scheduledLimitPackage=null};fun clearShortFormSession(){shortFormPackage=null};fun cancelEarnedUnlockRelock(){scheduledEarnedUnlockRelockPackage=null}
 var beforeClassify:(()->Unit)?=null;var startedActivities=0;var notices=0
 fun extractUrlCandidates(p:String,e:AccessibilityEvent):List<String>{beforeClassify?.let{beforeClassify=null;it()};return listOf(e.url)}
 fun launchIntervention(u:String,p:String,r:FreedClassification,g:Pair<Long?,Long>){browserLaunches++;launchAdultActual(u,p,r,g)}
 fun buildAccessibilityInterventionIntent(p:String,u:String,h:String,r:String)=Any()
 fun startActivity(intent:Any){startedActivities++}
 fun showAccessibilityInterventionNotification(title:String,sourceLabel:String,sourcePackage:String,redactedUrl:String,host:String,matchedRule:String){notices++}
 fun nowIsoString()=java.time.Instant.ofEpochMilli(System.now).toString()
 ${member('  private fun launchIntervention(').replace('private fun launchIntervention(', 'private fun launchAdultActual(').replaceAll('this@FreedAccessibilityService','this@CallbackService')}
 fun launchCaptured(g:Pair<Long?,Long>){launchAdultActual("https://adult.example","com.android.chrome",FreedUrlClassifier.classifyFocusedInput("https://adult.example",setOf("adult.example"),emptySet()),g)}
 ${member('  override fun onAccessibilityEvent(')}
 ${member('  private fun clearOwnedProtectionRuntime(')}
 ${track}
 ${close}
 ${ensure}
 ${member('  private fun usageKey(')}
 ${member('  private fun appUsageDateKey(')}
 fun clearForCase()=clearOwnedProtectionRuntime()
 fun trackForCase(p:String,scope:String?=FreedAppGroupStore.captureOwnerScope()){trackForegroundUsage(p${fixed?',scope':''})}
 fun closeForCase(scope:String?=FreedAppGroupStore.captureOwnerScope()){finishForegroundUsageSegment(${fixed?'scope':''})}
 fun ensureForCase(scope:String?=FreedAppGroupStore.captureOwnerScope()){ensureDailyUsageWindow(storage${fixed?',scope':''})}
}
`));
files.push(write('Cases.kt',fs.readFileSync(join(__dirname,'AndroidRetainedCallbackCases.kt'),'utf8')));
const names=['FreedInstalledAppPolicy','FreedAppGroupPolicy','FreedAppGroupAuthorityPolicy','FreedAppGroupTransaction','FreedAppGroupStore','FreedRetainedAdultProtection','FreedEarnedAppTimePolicy','FreedEarnedTimeClock','FreedEarnedChallengeProofPolicy','FreedEarnedChallengeProofStore','FreedEarnedChallengePhotoEvaluation','FreedNativeUnlockPolicy','FreedAppSchedulePolicy','FreedDoomscrollApps','FreedAppGuardModePolicy','FreedUrlClassifier','FreedFriendLockCore','FreedFriendLockRecordStore','FreedAdultExecutionJournal','FreedAdultAuthorizationExecutor','FreedAdultMutationBoundary','FreedAdultProtectionState','FreedAdultDomainFeed','FreedEncryptedDnsConfig','FreedWebsiteRecoveryHandoff','FreedInterventionHandoffPolicy','FreedDnsGuardPolicy','FreedDnsPacketPolicy'];
const tag=process.argv.includes('--before')?'before':'after';const jar=join(evidence,'callbacks-'+tag+'.jar');
run('kotlinc',[...files,...names.map(n=>join(native,n+'.kt')),'-classpath',join(root,'.superpowers/android-candidate-20261005/pinned-dependency-downloads/org.json_json_20180813/json-20180813.jar'),'-include-runtime','-d',jar]);
const generated=join(evidence,'generated-'+tag);fs.mkdirSync(generated,{recursive:true});for(const f of files)fs.copyFileSync(f,join(generated,f.split('/').pop()));
fs.writeFileSync(join(evidence,'extracted-'+tag+'.json'),JSON.stringify(members,null,2)+'\n');
run('java',['-classpath',jar+':'+join(root,'.superpowers/android-candidate-20261005/pinned-dependency-downloads/org.json_json_20180813/json-20180813.jar'),'app.freed.protection.CasesKt']);
}finally{fs.rmSync(workspace,{recursive:true,force:true});}
