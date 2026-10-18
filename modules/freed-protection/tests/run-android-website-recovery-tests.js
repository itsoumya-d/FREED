// Execute production website fences and service/module adapters; only Android/Expo boundaries are fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const browserFixtures = require('./browser-handler-fixtures');
const root = resolve(__dirname, '../../..');
const native = join(root, 'modules/freed-protection/android/src/main/java/app/freed/protection');
function member(file, marker) {
  const text=fs.readFileSync(join(native,file),'utf8');const start=text.indexOf(marker);assert.ok(start>=0, marker);
  const brace=text.indexOf('{',start);let depth=1,q=false,e=false;
  for(let i=brace+1;i<text.length;i++){const c=text[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')q=false;continue;}if(c==='"'){q=true;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return text.slice(start,i+1);}
  throw Error(marker);
}
const work=fs.mkdtempSync(join(tmpdir(),'freed-website-recovery-'));
function write(name,text){const p=join(work,name);fs.writeFileSync(p,text);return p;}
function run(c,args){const r=spawnSync(c,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.error?.message||r.stdout+r.stderr);process.stdout.write(r.stdout);}
try {
const files=[];
const observationReceipt=require('./android-adult-observation-fixture')(write,files,native);
fs.writeFileSync(join(work,'adult-observation-extraction.json'),JSON.stringify(observationReceipt,null,2));
files.push(write('Context.kt',`package android.content
import android.content.pm.*
open class Context { val noBackupFilesDir=java.nio.file.Files.createTempDirectory("freed85-website-").toFile();var prefs=SharedPreferences(); val packageName="app.freed.recovery";val applicationInfo=ApplicationInfo();val packageManager=PackageManager(applicationInfo)
 ${browserFixtures.contextMembers}
 fun getSharedPreferences(n:String,m:Int)=prefs;companion object {const val MODE_PRIVATE=0;${browserFixtures.contextConstants}}}
class SharedPreferences {val data=mutableMapOf<String,Any?>();val all:Map<String,Any?> get()=data.toMap();var commitAccepted=true
 fun getBoolean(k:String,d:Boolean)=data[k] as? Boolean?:d;fun getString(k:String,d:String?)=(data[k] as? String)?:d;fun edit()=Editor(this)
 class Editor(val p:SharedPreferences){val updates=mutableMapOf<String,Any?>();val removals=mutableSetOf<String>();fun putString(k:String,v:String?)=apply{updates[k]=v};fun remove(k:String)=apply{removals.add(k)}
 fun commit():Boolean {if(!p.commitAccepted)return false;removals.forEach{p.data.remove(it)};p.data.putAll(updates);return true};fun apply(){commit()}}}
`));
files.push(write('Pm.kt',browserFixtures.packageManager));
files.push(write('Clock.kt',browserFixtures.clock));
browserFixtures.install(write,files);
const accessibility=fs.readFileSync(join(native,'FreedAccessibilityService.kt'),'utf8');
const constants=accessibility.slice(accessibility.indexOf('    const val PREFS_NAME'),accessibility.indexOf('    const val EARNED_UNLOCK_EXPIRES_AT'));
const capture=member('FreedAccessibilityService.kt','    fun captureWebsiteRecoveryRequest(');
const request=member('FreedAccessibilityService.kt','  private fun requestWebsiteRecovery(');
const websiteLaunch=member('FreedAccessibilityService.kt','  private fun launchIntervention(');
const publishDns=member('FreedVpnService.kt','  private fun recordAndLaunchDnsIntervention(');
const claim=member('FreedProtectionModule.kt','  private fun claimPendingIntervention(');
const present=member('FreedInterventionActivity.kt','  private fun canPresentCurrentIntervention(');
const activitySource=fs.readFileSync(join(native,'FreedInterventionActivity.kt'),'utf8');
const activityFields=activitySource.slice(activitySource.indexOf('  private var companion:'),activitySource.indexOf('  override fun attachBaseContext'));
const activityMethods=['  override fun onCreate(', '  override fun onResume(', '  override fun onNewIntent(', '  override fun onDestroy(', '  private fun openRecoveryApp(', '  private fun dismissForConfigurationReset(', '  private fun finishCleanly('].map(m=>member('FreedInterventionActivity.kt',m)).join('\n');
const websiteIntentMethod=activitySource.includes('  private fun currentIntentIsWebsite(')?member('FreedInterventionActivity.kt','  private fun currentIntentIsWebsite('):'';
const dnsNotificationIntent=member('FreedVpnService.kt','  private fun buildDnsInterventionIntent(');
const getter=member('FreedProtectionModule.kt','    AsyncFunction("getPendingIntervention")');
const dnsMethods=['  private fun handleQuery(', '  private fun buildNxdomainResponse(', '  private fun buildServfailResponse(', '  private fun buildDnsErrorResponse(', '  private fun findQuestionEnd(', '  private fun writeShort('].map(m=>member('FreedVpnService.kt',m)).join('\n');
const ownerCapture=member('FreedAppGroupStore.kt','  fun captureOwnerScope(');const ownerCurrent=member('FreedAppGroupStore.kt','  fun ownerScopeCurrent(');
files.push(write('Adapters.kt',`package app.freed.protection
import android.content.*
import android.os.*
import java.util.UUID
import java.lang.ref.WeakReference
class Uri(val value:String){override fun toString()=value;companion object{fun parse(v:String)=Uri(v)}}
class Intent(var action:String="") {constructor(c:Context,t:Class<*>):this("barrier");var data:Uri?=null;fun addFlags(f:Int)=this;fun setPackage(p:String)=this
companion object{const val ACTION_VIEW="view";const val FLAG_ACTIVITY_NEW_TASK=1;const val FLAG_ACTIVITY_CLEAR_TOP=2;const val FLAG_ACTIVITY_SINGLE_TOP=4;const val FLAG_ACTIVITY_REORDER_TO_FRONT=8}
val extras=mutableMapOf<String,Any?>();fun getStringExtra(k:String)=extras[k] as? String;fun getLongExtra(k:String,d:Long)=(extras[k] as? Long)?:d;fun putExtra(k:String,v:Any?)=apply{extras[k]=v}}
object FreedNativeUnlockStore {val lock=Any();var staged=0;fun stage(c:Context,s:Map<String,*>,e:SharedPreferences.Editor){staged++};fun restoreClaimedLease(e:SharedPreferences.Editor,s:Map<String,*>){} }
object FreedAppGroupStore {var boundScope:String?="A";var boundSignedInOwner=true;var privateOperationsSuspended=false;var owner:String? get()=boundScope;set(v){boundScope=v;boundSignedInOwner=v!=null};var suspended:Boolean get()=privateOperationsSuspended;set(v){privateOperationsSuspended=v};var staged=0;\n${ownerCapture}\n${ownerCurrent}\nprivate fun validScope(token:String)=!privateOperationsSuspended&&token==boundScope&&token.isNotBlank();fun awaitingOwnerBinding()=owner==null||suspended;fun pendingScope(c:Context,s:Map<String,*>):Map<String,Any?>?=null;fun stage(c:Context,s:Map<String,*>,e:SharedPreferences.Editor){staged++};fun restoreClaim(e:SharedPreferences.Editor,s:Map<String,*>){} }
object FreedProtectionConfiguration {const val INTENT_EPOCH="epoch";var enabled=true;var resetInProgress=false;var revision=7L;fun epoch(c:Context)=revision;fun interceptionEnabled(c:Context)=enabled&&!resetInProgress}
data class FreedClassification(val matchedRule:String,val host:String="private.example.xxx",val reason:String="blocked",val shouldBlock:Boolean=true)
object FreedUrlClassifier {fun normalizeHostForStorage(h:String)=h;fun classify(u:String,a:Any,b:Any)=FreedClassification("adult-seed")}\nobject FreedAdultDomainFeed{fun userAllowedDomains(c:Context)=emptySet<String>()}
object R {object string {const val freed_recovery_channel=1}}
object FreedNativeCopy {fun text(c:Context,id:Int)="support"}
class FreedAccessibilityService : Context() {companion object {
${constants}
var connectedService:FreedAccessibilityService?=null
${capture}
}
val handler=Handler();var serviceConnected=true;var scheduleConnectionEpoch=1L;var screen=true;var foreground:String?="com.android.chrome";var launches=0;var denied=false;var notices=0
val browserJobs=mutableListOf<Runnable>();internal var eligibleWebHandlers:FreedBrowserHandlers?=FreedBrowserHandlers(this,handler,{browserJobs.add(it)})
init {packageManager.http=listOf(android.content.pm.webHandler("com.android.chrome"));packageManager.https=packageManager.http;eligibleWebHandlers!!.connect();refreshBrowserQuery()}
fun refreshBrowserQuery(){if(browserJobs.isNotEmpty())browserJobs.removeAt(0).run();Handler.drain()}
fun browserChanged(rows:List<android.content.pm.ResolveInfo>){packageManager.http=rows;packageManager.https=rows;broadcast(android.content.Intent.ACTION_PACKAGE_CHANGED);refreshBrowserQuery()}
var lastBlockedKey="";var lastLaunchElapsedMs=0L
fun ownsConnectedRuntime()=serviceConnected&&connectedService===this
fun isScreenInteractiveAndUnlocked()=screen
fun liveScheduleForegroundPackage()=foreground
fun startActivity(i:Intent){if(denied)throw SecurityException();launches++;lastIntent=i};var lastIntent:Intent?=null
fun buildAccessibilityInterventionIntent(s:String,u:String,h:String,r:String)=Intent().putExtra("freed_intervention_source",s).putExtra("freed_intervention_rule",r)
fun showAccessibilityInterventionNotification(title:String,sourceLabel:String,sourcePackage:String,redactedUrl:String,host:String,matchedRule:String){notices++}
fun nowIsoString()=nowDate()
${request}
${websiteLaunch}
fun localWebsite(host:String){launchIntervention("https://"+host,"com.android.chrome",FreedClassification("adult-seed",host),FreedAdultProtectionState.callbackEpoch(this))}
fun capturedWebsite(host:String,epoch:Pair<Long?,Long>){launchIntervention("https://"+host,"com.android.chrome",FreedClassification("adult-seed",host),epoch)}
}
class Ownership {var epoch=1L;fun threadEpoch()=epoch;fun isCurrentEpoch(e:Long)=e==epoch;fun isCurrentThreadEpoch()=true}
class FreedVpnService : Context() {val runtimeOwnership=Ownership();var lastBlockedKey="";var lastBlockedElapsedMs=0L;val INTERVENTION_DEDUPE_WINDOW_MS=4000L;var notices=0;var notificationDenied=false;val notificationIntents=mutableListOf<Intent>()
val DNS_HEADER_SIZE=12;val MAX_DNS_LABEL_LENGTH=63;val DNS_RCODE_NXDOMAIN=3;val DNS_RCODE_SERVFAIL=2
class DnsEnvelope;class DnsWorkItem(val questionHost:String?,val dnsPayload:ByteArray,val envelope:DnsEnvelope=DnsEnvelope())
val dnsGuardMalformedPackets=java.util.concurrent.atomic.AtomicInteger();val dnsGuardBlockedQueries=java.util.concurrent.atomic.AtomicInteger();val dnsGuardAllowedQueries=java.util.concurrent.atomic.AtomicInteger();val dnsGuardServfailResponses=java.util.concurrent.atomic.AtomicInteger();val dnsGuardForwardFailureCount=java.util.concurrent.atomic.AtomicInteger()
var captivePortalPaused=false;var lastBlockedHost="";var lastForwardFailure:String?=null;var response:ByteArray?=null
fun unsigned(b:Byte)=b.toInt() and 255;fun publishDnsMetadata(f:()->Unit){f()};fun resolveAdultDomains()=emptySet<String>();fun dnsInterventionHost(h:String,c:FreedClassification)=h;fun forwardDns(b:ByteArray):ByteArray?=null;fun isValidDnsResponse(a:ByteArray,b:ByteArray)=false;fun writeResponsePacket(e:DnsEnvelope,b:ByteArray){response=b}
${dnsMethods}
fun query(host:String){handleQuery(DnsWorkItem(host,byteArrayOf(1,2,1,0,0,1,0,0,0,0,0,0,0,0,1,0,1)))}
fun nowIsoString()=nowDate();fun showDnsInterventionNotification(h:String,u:String,r:String){if(notificationDenied)throw SecurityException();notices++;notificationIntents.add(buildDnsInterventionIntent(h,u,r))}\n${dnsNotificationIntent}\n${publishDns}
fun block(host:String){recordAndLaunchDnsIntervention(host,FreedClassification("adult-seed",host))}
}
object FreedInstalledApplications{fun eligible(c:Context)=emptySet<String>()}\nobject FreedFocusShieldRules{data class Rule(val id:String,val packageName:String);fun list(c:Context)=emptyList<Rule>()}\nclass AppContext(var reactContext:Context?)
class Module(val context:Context) {val appContext=AppContext(context);val pendingInterventionClaimLock=FreedNativeUnlockStore.lock;val PENDING_CONSUMED_INTERVENTION_IDS="pending_consumed_intervention_ids_v1";val MAX_PENDING_CONSUMED_INTERVENTION_IDS=32
var read:(()->Any?)?=null;fun AsyncFunction(n:String,b:()->Any?){read=b};init{\n${getter}\n}\nfun isFreshPendingIntervention(s:String)=true;fun sanitizedPendingHost(h:String,u:String)=h;fun sanitizedPendingSourcePackage(s:String?,r:String)=s.orEmpty();fun sanitizedPendingSessionDuration(s:Map<String,*>)=0L\nfun sanitizedPendingInterventionId(s:String?)=s
fun pendingConsumedInterventionIds(p:SharedPreferences)=p.getString(PENDING_CONSUMED_INTERVENTION_IDS,"").orEmpty().split(',').filter{it.isNotBlank()}
fun isPendingInterventionConsumed(p:SharedPreferences,s:String)=s in pendingConsumedInterventionIds(p)
${claim}
fun claim(id:String)=claimPendingIntervention(context.prefs,id)
}
class Bundle
object Window{const val FEATURE_NO_TITLE=1}
object Build{object VERSION{const val SDK_INT=36};object VERSION_CODES{const val LOLLIPOP=21}}
class FreedNativeCompanion{fun startMotion(){};fun stopMotion(){}}
open class ActivityPlatform:Context(){private var current=Intent();val intent get()=current;val launches=mutableListOf<Intent>();var finished=false;var rendered=false
 fun setIntent(i:Intent?){current=i?:Intent()};fun requestWindowFeature(v:Int){};fun setFinishOnTouchOutside(v:Boolean){};fun setContentView(v:Any){rendered=true};fun startActivity(i:Intent){launches.add(i)};fun finish(){finished=true};fun finishAndRemoveTask(){finished=true}
 open fun onCreate(b:Bundle?){};open fun onResume(){};open fun onNewIntent(i:Intent?){};open fun onDestroy(){}
}
class FreedInterventionActivity:ActivityPlatform() {companion object {const val INTERVENTION_ID_EXTRA="freed_intervention_id";val activityOwnershipLock=Any();var activeActivity=WeakReference<FreedInterventionActivity>(null)}
${activityFields}
${present}
${activityMethods}
${websiteIntentMethod}
private fun buildContentView()=Unit
fun present()=canPresentCurrentIntervention()
fun click(){openRecoveryApp()}
}
fun nowDate()=java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").apply{timeZone=java.util.TimeZone.getTimeZone("UTC")}.format(java.util.Date())
`));
files.push(write('Cases.kt',`package app.freed.protection
import android.content.*
import android.os.*
import android.content.pm.*
fun main(args:Array<String>){
if(args.firstOrNull()=="cold-notification") {
 val p=java.util.Properties().apply{java.io.File(args[1]).inputStream().use{load(it)}}
 val restored=Context();restored.prefs.data.putAll(mapOf("app_group_scope_epoch_v1" to 3L,"pending_intervention_id" to p.getProperty("id"),"pending_source_package" to "android-dns","pending_rule" to "adult-seed","pending_host" to "private.example.xxx","pending_detected_at" to nowDate()))
 check(!FreedWebsiteRecoveryHandoff.current(restored,restored.prefs.all,p.getProperty("id"))){"Fresh JVM must not resurrect website stamp"}
 check(p.getProperty("uri")=="freed://guided-reset"){"Notification built while receipt was live must retain manual URI after process death"};check(p.getProperty("extras")=="0");check(p.getProperty("action")=="view");println("Actual notification intent survives fresh-JVM stamp loss as payload-free manual recovery");return
}
fun drain(){repeat(3){Handler.drain()}}
val id="12345678-1234-4234-8234-123456789abc";val other="87654321-1234-4234-8234-123456789abc"
val c=Context();c.prefs.data["app_group_scope_epoch_v1"]=1L
fun publish(target:Context=c,key:String=id):Boolean = FreedWebsiteRecoveryHandoff.publish(target,target.prefs,key){
 putString(FreedAccessibilityService.PENDING_URL,"https://private.example.xxx");putString(FreedAccessibilityService.PENDING_INTERVENTION_ID,key);putString(FreedAccessibilityService.PENDING_SOURCE_PACKAGE,"android-dns");putString(FreedAccessibilityService.PENDING_HOST,"private.example.xxx");putString(FreedAccessibilityService.PENDING_RULE,"adult-seed");putString(FreedAccessibilityService.PENDING_DETECTED_AT,nowDate())}
fun valid(target:Context=c,key:String=id)=FreedWebsiteRecoveryHandoff.current(target,target.prefs.all,key)
c.prefs.data["pending_intervention_id"]=id;check(!valid()){ "Restored record without process-local owner stamp stays unavailable" };c.prefs.data.remove("pending_intervention_id");check(!FreedWebsiteRecoveryHandoff.previewEnabled(c));c.applicationInfo.metaData!!.flags[FreedWebsiteRecoveryHandoff.PREVIEW_FLAG]=true
check(!FreedWebsiteRecoveryHandoff.previewEnabled(c)){"Production flag alone must stay off"};c.applicationInfo.flags=ApplicationInfo.FLAG_DEBUGGABLE;check(FreedWebsiteRecoveryHandoff.previewEnabled(c));c.packageManager.failed=true;check(!FreedWebsiteRecoveryHandoff.previewEnabled(c));c.packageManager.failed=false
check(publish());check(valid())
check(!FreedWebsiteRecoveryHandoff.clearPrivatePendingRetainingDevice("A"){false});check(valid())
check(!FreedWebsiteRecoveryHandoff.clearPrivatePendingRetainingDevice("B"){true});check(valid())
check(FreedWebsiteRecoveryHandoff.clearPrivatePendingRetainingDevice("A"){true});check(!valid()){ "Original private in-memory owner/host stamp must actually be erased even with unchanged prefs" }
FreedAppGroupStore.owner="B";check(publish());check(valid())
check(!FreedWebsiteRecoveryHandoff.clearPrivatePendingRetainingDevice("A"){false});check(valid()){ "Delayed original-owner cleanup must leave a newer owner's stamp intact" }
check(!FreedWebsiteRecoveryHandoff.clearPrivatePendingRetainingDevice("A"){true});check(valid())
check(FreedWebsiteRecoveryHandoff.clearPrivatePendingRetainingDevice("B"){true});check(!valid())
FreedAppGroupStore.owner="A";c.prefs.data.clear();c.prefs.data["app_group_scope_epoch_v1"]=2L
FreedAppGroupStore.owner=null;check(!publish());check(c.prefs.data["pending_intervention_id"]==null);FreedAppGroupStore.owner="A"
c.prefs.data["pending_focus_shield_rule_id"]="old";c.prefs.data["pending_session_duration_seconds"]=10L;c.prefs.data["pending_old_group_authority"]="old"
check(publish());check(valid());check(c.prefs.all.keys.none{it in setOf("pending_focus_shield_rule_id","pending_session_duration_seconds","pending_old_group_authority")})
FreedAppGroupStore.owner="B";check(!valid());FreedAppGroupStore.owner="A";c.prefs.data["app_group_scope_epoch_v1"]=3L;check(!valid()){ "A to B to A must not resurrect the old owner record" };check(publish());FreedAppGroupStore.suspended=true;check(!valid());FreedAppGroupStore.suspended=false
for((k,v) in listOf("pending_intervention_id" to other,"pending_host" to "changed.example","pending_rule" to "other","pending_rule" to "configured-app:com.android.chrome","pending_source_package" to "other","pending_focus_shield_rule_id" to "old","pending_session_duration_seconds" to 0L,"pending_consumed_intervention_ids_v1" to id,"pending_detected_at" to "2020-01-01T00:00:00Z","pending_detected_at" to "2099-01-01T00:00:00Z","app_groups_configuration_v1" to "changed")) {val old=c.prefs.data[k];c.prefs.data[k]=v;check(!valid()){ "Fence must reject "+k };if(old==null)c.prefs.data.remove(k) else c.prefs.data[k]=old}
FreedProtectionConfiguration.revision++;check(!valid());FreedProtectionConfiguration.revision--;FreedProtectionConfiguration.resetInProgress=true;check(!valid());FreedProtectionConfiguration.resetInProgress=false
SystemClock.now+=600001;check(!valid());SystemClock.now-=600001;check(!valid(c,other));check(publish())
val activity=FreedInterventionActivity();activity.prefs.data.putAll(c.prefs.all);activity.intent.putExtra("freed_intervention_id",id).putExtra("freed_intervention_source","android-dns").putExtra("freed_intervention_rule","adult-seed").putExtra("epoch",7L);check(activity.present());activity.prefs.data["pending_consumed_intervention_ids_v1"]=id;check(!activity.present())
val module=Module(c);c.prefs.data["pending_rule"]="configured-app:com.android.chrome";check(module.read!!.invoke()==null);check(!module.claim(id));c.prefs.data["pending_rule"]="adult-seed";val payload=module.read!!.invoke() as Map<*,*>;check(payload.keys==setOf("interventionId","url","host","sourcePackage","reason","matchedRule","detectedAt","sessionDurationSec")){"JS receives no owner stamps or scope authority"};FreedAppGroupStore.owner="B";check(module.read!!.invoke()==null);check(!module.claim(id));FreedAppGroupStore.owner="A";check(module.claim(id));check(!module.claim(id));check(!valid());check(FreedNativeUnlockStore.staged==0&&FreedAppGroupStore.staged==0){"Website exact claim must never stage app authority"};c.prefs.data.remove("pending_consumed_intervention_ids_v1")
val service=FreedAccessibilityService();service.prefs.data["app_group_scope_epoch_v1"]=3L;service.applicationInfo.flags=2;service.applicationInfo.metaData!!.flags[FreedWebsiteRecoveryHandoff.PREVIEW_FLAG]=true;FreedAccessibilityService.connectedService=service
fun captured():()->Unit{SystemClock.now+=5000;check(publish(service,other));return FreedAccessibilityService.captureWebsiteRecoveryRequest(other,7L){true}!!}
for(mode in listOf("locked","off","freed","unrelated","unknown","disconnected","replaced","configuration","vpn")) {
 val call=captured();when(mode){"locked","off"->service.screen=false;"freed"->service.foreground="app.freed.recovery";"unrelated"->service.foreground="com.example.reader";"unknown"->service.foreground=null;"disconnected"->service.serviceConnected=false;"replaced"->service.scheduleConnectionEpoch++;"configuration"->FreedProtectionConfiguration.revision++;"vpn"->Unit}
 if(mode=="vpn"){val fence=FreedAccessibilityService.captureWebsiteRecoveryRequest(other,7L){false}!!;fence()}else call();drain();check(service.launches==0){mode};service.screen=true;service.foreground="com.android.chrome";service.serviceConnected=true;FreedProtectionConfiguration.revision=7L
}
val old=captured();FreedAccessibilityService.connectedService=FreedAccessibilityService();old();drain();check(service.launches==0);FreedAccessibilityService.connectedService=service
val arbitraryBrowser="dev.future.navigator";service.foreground=arbitraryBrowser
for(mode in listOf("undiscovered","removed","disabled","unavailable","expired","disconnected-cache")) {
 service.browserChanged(listOf(android.content.pm.webHandler(arbitraryBrowser)));val call=captured()
 when(mode){"undiscovered","removed"->service.browserChanged(emptyList());"disabled"->service.browserChanged(listOf(android.content.pm.webHandler(arbitraryBrowser,appEnabled=false)));"unavailable"->{service.packageManager.queryFails=true;service.browserChanged(listOf(android.content.pm.webHandler(arbitraryBrowser)));service.packageManager.queryFails=false};"expired"->SystemClock.now+=60_000;"disconnected-cache"->service.eligibleWebHandlers!!.disconnect()}
 call();drain();check(service.launches==0){"Actual service gate rejects "+mode};if(mode=="disconnected-cache"){service.eligibleWebHandlers!!.connect();service.refreshBrowserQuery()}
}
service.browserChanged(listOf(android.content.pm.webHandler(arbitraryBrowser),android.content.pm.webHandler("com.android.chrome")))
val go=captured();go();drain();check(service.launches==1){"Arbitrary new handler admitted through actual query/cache/service gate"};go();drain();check(service.launches==1)
check(FreedNativeUnlockStore.staged==0&&FreedAppGroupStore.staged==0){"Dynamic admission grants no app-time authority"};service.foreground="com.android.chrome"
val visible=FreedInterventionActivity();visible.prefs=service.prefs;visible.setIntent(service.lastIntent);visible.onCreate(null);check(visible.rendered&&!visible.finished);check(visible.launches.isEmpty())
fun renderedCopy():FreedInterventionActivity=FreedInterventionActivity().apply{prefs=service.prefs;setIntent(service.lastIntent);onCreate(null);check(rendered&&!finished)}
val resumed=renderedCopy();val newIntent=renderedCopy();val destroyed=renderedCopy();destroyed.onDestroy();destroyed.click();check(destroyed.launches.isEmpty())
val neverRendered=FreedInterventionActivity();neverRendered.prefs=service.prefs;neverRendered.setIntent(service.lastIntent);neverRendered.click();check(!neverRendered.rendered&&neverRendered.launches.isEmpty())
val ownerManual=renderedCopy();FreedAppGroupStore.owner="B";ownerManual.click();check(ownerManual.launches.single().data.toString()=="freed://guided-reset"&&ownerManual.launches.single().extras.isEmpty());FreedAppGroupStore.owner="A"
check(publish(service,id));val alternate=FreedAccessibilityService.captureWebsiteRecoveryRequest(id,7L){true}!!;alternate();drain();check(service.launches==1){"Alternating producers share cooldown"};check(!visible.present());resumed.onResume();resumed.click();check(resumed.finished&&resumed.launches.isEmpty());newIntent.onNewIntent(service.lastIntent);newIntent.click();check(newIntent.finished&&newIntent.launches.isEmpty());if(args.firstOrNull()!="notification-only"){visible.click();check(visible.launches.singleOrNull()?.data.toString()=="freed://guided-reset"){"Visible first website must recover manually after overwritten receipt and suppressed second launch"};check(visible.launches.single().extras.isEmpty());visible.click();check(visible.launches.size==1)}
SystemClock.now+=5000;service.denied=true;alternate();drain();check(service.launches==1);service.denied=false;SystemClock.now+=5000;alternate();drain();check(service.launches==1){"Failed start still dedupes exact ID"}
SystemClock.now+=5000;service.localWebsite("one.example.xxx");check(service.launches==2);service.localWebsite("two.example.xxx");check(service.launches==2);check(service.notices==2)
val vpn=FreedVpnService();vpn.prefs.data["app_group_scope_epoch_v1"]=3L;vpn.block("three.example.xxx");drain();check(vpn.notices==1);check(service.launches==2){"DNS source cannot dispatch another store publication"}
service.prefs=vpn.prefs;vpn.applicationInfo.flags=2;vpn.applicationInfo.metaData!!.flags[FreedWebsiteRecoveryHandoff.PREVIEW_FLAG]=true
SystemClock.now+=5000;vpn.block("enabled.example.xxx");drain();check(vpn.notices==2);check(service.launches==3){"Actual DNS publication and connected-service request reaches startActivity"}
val liveNotice=vpn.notificationIntents.last();val saved=java.io.File.createTempFile("freed-notification-fixture-",".properties")
try{java.util.Properties().apply{setProperty("uri",liveNotice.data.toString());setProperty("extras",liveNotice.extras.size.toString());setProperty("action",liveNotice.action);setProperty("id",vpn.prefs.getString("pending_intervention_id",null))}.also{props->saved.outputStream().use{props.store(it,"test boundary fixture")}}
val cold=ProcessBuilder(java.io.File(System.getProperty("java.home"),"bin/java").absolutePath,"-jar",System.getProperty("java.class.path"),"cold-notification",saved.absolutePath).inheritIO().start();check(cold.waitFor()==0)}finally{saved.delete()}
FreedAppGroupStore.owner="B";check(liveNotice.data.toString()=="freed://guided-reset"&&liveNotice.extras.isEmpty());FreedAppGroupStore.owner="A"
service.applicationInfo.metaData!!.flags[FreedWebsiteRecoveryHandoff.PREVIEW_FLAG]=false;SystemClock.now+=5000;vpn.block("disabled.example.xxx");drain();check(vpn.notices==3);check(service.launches==3){"Disabled preview preserves notification-only DNS path"};service.applicationInfo.metaData!!.flags[FreedWebsiteRecoveryHandoff.PREVIEW_FLAG]=true
vpn.notificationDenied=true;SystemClock.now+=5000;vpn.block("four.example.xxx");drain();check(vpn.prefs.data["pending_host"]=="four.example.xxx");SystemClock.now+=5000;vpn.notificationDenied=false;vpn.block("five.example.xxx");vpn.runtimeOwnership.epoch++;drain();check(vpn.notices==3)\nSystemClock.now+=5000;val writeFailure=FreedVpnService();writeFailure.prefs.data["app_group_scope_epoch_v1"]=3L;writeFailure.prefs.commitAccepted=false;writeFailure.query("failure.example.xxx");drain();check(writeFailure.response!![3].toInt() and 15==3);check(writeFailure.dnsGuardBlockedQueries.get()==1);check(writeFailure.notices==1){"NXDOMAIN and notification survive failed publication"}
FreedAppGroupStore.owner=null;SystemClock.now+=5000;val unknown=FreedVpnService();unknown.query("six.example.xxx");drain();check(unknown.response!![3].toInt() and 15==3);check(unknown.prefs.data["pending_intervention_id"]==null);check(unknown.notices==1){"Unknown owner still has generic notification/manual fallback"}
val strict=FreedInterventionActivity();strict.prefs.data.putAll(mapOf("pending_intervention_id" to id,"pending_source_package" to "com.android.chrome","pending_rule" to "configured-app:com.android.chrome","pending_detected_at" to nowDate()));strict.setIntent(Intent().putExtra("freed_intervention_id",id).putExtra("freed_intervention_source","com.android.chrome").putExtra("freed_intervention_rule","configured-app:com.android.chrome").putExtra("epoch",7L));strict.onCreate(null);check(strict.rendered);strict.prefs.data["pending_intervention_id"]=other;strict.click();check(strict.launches.isEmpty())
val staleGroup=FreedInterventionActivity();staleGroup.prefs.data.putAll(mapOf("pending_intervention_id" to id,"pending_source_package" to "com.android.chrome","pending_rule" to "app-group:daily:1","pending_detected_at" to nowDate()));staleGroup.setIntent(Intent().putExtra("freed_intervention_id",id).putExtra("freed_intervention_source","com.android.chrome").putExtra("freed_intervention_rule","app-group:daily:1").putExtra("epoch",7L));staleGroup.onCreate(null);check(staleGroup.rendered);staleGroup.prefs.data["pending_intervention_id"]=other;staleGroup.click();check(staleGroup.launches.isEmpty())
val invalid=FreedInterventionActivity();invalid.setIntent(service.lastIntent);invalid.prefs=service.prefs;invalid.onCreate(null);invalid.click();check(!invalid.rendered&&invalid.launches.isEmpty())
FreedAppGroupStore.owner="A";FreedAppGroupStore.suspended=false;SystemClock.now+=5000
val oldAdultEpoch=FreedAdultProtectionState.callbackEpoch(service);val oldNotices=service.notices;val oldPending=service.prefs.all
FreedAdultAuthorizationExecutor.advance();service.capturedWebsite("stale-adult.example",oldAdultEpoch)
check(service.notices==oldNotices&&service.prefs.all==oldPending){"Actual adult publication must reject an earlier generation before private writes"}
println("Actual Kotlin website fences/adapters: gate, owner/ABA, epochs/reset, metadata/freshness/claim, lifecycle/screen/foreground, exact dedupe/cross-producer cooldown, failure; live-notification/fresh-JVM stamp loss, validated website replacement manual tap, strict resume/new-intent/unrendered/app/group cases passed")
}
`));
files.push(join(native,'FreedWebsiteRecoveryHandoff.kt'),join(native,'FreedInterventionHandoffPolicy.kt'),...browserFixtures.production(native));
if(process.argv.includes('--prepare-only')){process.stdout.write('Task21 harness prepared without native compilation; runtime assertions unexecuted.\n');}else{const jar=join(work,'cases.jar');run('kotlinc',[...files,'-include-runtime','-d',jar]);run('java',['-jar',jar,...(process.argv.includes('--notification-only')?['notification-only']:[])]);process.stdout.write('Harness JAR SHA-256: '+createHash('sha256').update(fs.readFileSync(jar)).digest('hex')+'\n');}
}finally{fs.rmSync(work,{recursive:true,force:true});}
