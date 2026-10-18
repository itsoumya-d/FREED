// Production lower writers + exact Module/Service members; fixture OS/file I/O only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {join, resolve} = require('node:path');
const {tmpdir} = require('node:os');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const root=resolve(__dirname,'../../..');
const native=join(root,'modules/freed-protection/android/src/main/java/app/freed/protection');
const evidence=process.env.FREED85_EVIDENCE?resolve(process.env.FREED85_EVIDENCE):join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-85-android-enrolled-executor');fs.mkdirSync(evidence,{recursive:true});
const workspace=fs.mkdtempSync(join(tmpdir(),'freed-adult-boundary-'));
const extracted=[];
function member(file, marker) {
 const source=fs.readFileSync(join(native,file),'utf8');const start=source.indexOf(marker);assert.ok(start>=0,marker);
 let depth=0, quote=false, escape=false;const brace=source.indexOf('{',start);
 for(let i=brace;i<source.length;i++){const c=source[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;continue;}if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0){const value=source.slice(start,i+1);extracted.push({file,marker,sha256:createHash('sha256').update(value).digest('hex')});return value;}}
 throw Error(marker);
}
function file(name,text){const p=join(workspace,name);fs.writeFileSync(p,text);const generated=join(evidence,'generated-adult-fixture');fs.mkdirSync(generated,{recursive:true});fs.writeFileSync(join(generated,name),text);return p;}
function run(command,args){const result=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:300000});process.stdout.write(result.stdout||'');if(result.status)process.stderr.write(result.stderr||'');assert.equal(result.status,0,result.error?.message||command);}
try {
 const files=[];
 files.push(file('AtomicFile.kt',`package android.util
object Base64{const val NO_WRAP=2;const val DEFAULT=0;fun encodeToString(b:ByteArray,f:Int)=java.util.Base64.getEncoder().encodeToString(b);fun decode(s:String,f:Int)=java.util.Base64.getDecoder().decode(s)}
class AtomicFile(val file:java.io.File){companion object{var failWrites=false};fun openRead()=java.io.FileInputStream(file);fun startWrite():java.io.FileOutputStream{if(failWrites)error("journal-write-failed");return java.io.FileOutputStream(file)};fun finishWrite(s:java.io.FileOutputStream){s.close()};fun failWrite(s:java.io.FileOutputStream){s.close()}}
`));
 files.push(file('DirectorySync.kt',`package android.system
object OsConstants{const val O_RDONLY=0;const val AF_INET6=10}
object Os{fun open(p:String,f:Int,m:Int)=java.io.FileDescriptor();fun fsync(d:java.io.FileDescriptor){};fun close(d:java.io.FileDescriptor){}}
`));
 files.push(file('Context.kt',`package android.content
import android.content.pm.PackageManager
open class Context {
 val applicationContext get()=this; val noBackupFilesDir=java.nio.file.Files.createTempDirectory("freed85-lower-").toFile()
 val packageName="app.freed";val packageManager=PackageManager();val namespaces=mutableMapOf<String,SharedPreferences>();val services=mutableMapOf<String,Any>(android.net.ConnectivityManager::class.java.name to android.net.ConnectivityManager());var stopAccepted=true;var stops=0
 fun getSharedPreferences(n:String,m:Int)=namespaces.getOrPut(n){SharedPreferences()};fun getSystemService(n:String)=services[n];fun <T> getSystemService(c:Class<T>):T?=c.cast(services[c.name])
 fun stopService(i:Intent):Boolean{stops++;if(!stopAccepted)throw IllegalStateException("stop denied");return true}
 companion object{const val MODE_PRIVATE=0;const val NOTIFICATION_SERVICE="notifications"}
}
class SharedPreferences {
 val values=mutableMapOf<String,Any?>();val all get()=values.toMap();var fail=false;var corruptKey:String?=null;var commits=0
 fun contains(k:String)=values.containsKey(k);fun getString(k:String,d:String?)=if(values.containsKey(k))values[k] as String? else d
 fun getBoolean(k:String,d:Boolean)=if(values.containsKey(k))values[k] as Boolean else d;fun getLong(k:String,d:Long)=if(values.containsKey(k))values[k] as Long else d
 fun unregisterOnSharedPreferenceChangeListener(listener:Any){};fun edit()=Editor(this)
 class Editor(val p:SharedPreferences){val writes=mutableMapOf<String,Any?>();fun putString(k:String,v:String?)=apply{writes[k]=v};fun putBoolean(k:String,v:Boolean)=apply{writes[k]=v};fun putLong(k:String,v:Long)=apply{writes[k]=v};fun putInt(k:String,v:Int)=apply{writes[k]=v};fun remove(k:String)=apply{writes[k]=null};fun clear()=apply{p.values.keys.forEach{writes[it]=null}}
 fun commit():Boolean{p.commits++;writes.forEach{(k,v)->if(v==null)p.values.remove(k)else p.values[k]=v};p.corruptKey?.let{if(writes.containsKey(it))p.values[it]="corrupt"};return !p.fail};fun apply(){commit()}}
}
class Intent {var action:String?=null;constructor();constructor(c:Context,t:Class<*>);fun getStringExtra(k:String):String?=null;fun hasExtra(k:String)=false;fun getLongExtra(k:String,d:Long)=d}
`));
 files.push(file('Pm.kt',`package android.content.pm
class Metadata{fun getBoolean(k:String,d:Boolean)=false}
class ApplicationInfo{val metaData:Metadata?=Metadata();val flags=0;companion object{const val FLAG_DEBUGGABLE=2}}
class ServiceInfo(val name:String,val processName:String);class PackageInfo(val services:Array<ServiceInfo>)
class PackageManager{var alternateProcess:String?=null;fun getApplicationInfo(p:String,f:Int)=ApplicationInfo();fun getPackageInfo(p:String,f:Int)=PackageInfo(arrayOf(ServiceInfo("app.freed.protection.FreedVpnService",alternateProcess?:p),ServiceInfo("app.freed.protection.FreedAccessibilityService",p)));companion object{const val GET_META_DATA=128;const val GET_SERVICES=4}}
`));
 files.push(file('Os.kt',`package android.os
class Looper{companion object{val main=Looper();var background=false;fun myLooper()=if(background)Looper()else main;fun getMainLooper()=main}}
class Handler(l:Looper){companion object{var mode="immediate";var last:Runnable?=null;val callbacks=java.util.concurrent.ConcurrentLinkedQueue<Runnable>()};fun post(r:Runnable):Boolean{last=r;when(mode){"queued"->callbacks.add(r);"async"->Thread(r).start();else->r.run()};return true};fun removeCallbacks(r:Runnable){callbacks.remove(r)}}
class ParcelFileDescriptor{val stream=java.io.FileOutputStream(java.io.File.createTempFile("freed85-tun-",".bin"));val fileDescriptor get()=stream.fd;var fail=false;var closed=false;var closeCalls=0;fun close(){closeCalls++;if(fail)error("descriptor-close-failed");stream.close();closed=true}}
object Process{fun myPid()=1}
object SystemClock{fun elapsedRealtime()=java.lang.System.nanoTime()/1_000_000L}
`));
 files.push(file('ProcessTopology.kt',`package android.app
class Activity{companion object{const val RESULT_OK=-1}}
object Application{var currentName="app.freed";fun getProcessName()=currentName}
class ActivityManager{data class Entry(val pid:Int,val processName:String);val runningAppProcesses=listOf(Entry(1,"app.freed"))}
`));
 files.push(file('Network.kt' ,`package android.net
 class VpnService{companion object{var requiresConsent=false;fun prepare(c:android.content.Context):Any?=if(requiresConsent)Any()else null}}
 data class Network(val id:Int)
 class NetworkCapabilities(val vpn:Boolean=false,val internet:Boolean=true){fun hasTransport(t:Int)=vpn;fun hasCapability(c:Int)=internet;companion object{const val TRANSPORT_VPN=4;const val NET_CAPABILITY_INTERNET=12}}
 class LinkProperties(val privateDnsServerName:String?=null,val isPrivateDnsActive:Boolean=false)
 class ConnectivityManager{var activeNetwork:Network?=Network(1);val links=linkedMapOf(Network(1) to LinkProperties());val caps=linkedMapOf(Network(1) to NetworkCapabilities());val allNetworks get()=links.keys.toTypedArray();fun getNetworkCapabilities(n:Network)=caps[n];fun getLinkProperties(n:Network)=links[n]}
`));
 files.push(file('Build.kt',`package android.os
 object Build{object VERSION{var SDK_INT=36};object VERSION_CODES{const val P=28}}
`));
 files.push(file('Notification.kt' ,`package android.app
class NotificationManager{val cancelled=mutableListOf<Int>();var fail=false;fun cancel(id:Int){if(fail)throw IllegalStateException();cancelled.add(id)}}
`));
 const serviceMethods=['    fun setUserEnabled(', '    fun isUserEnabled(', '    internal fun userEnabledReadback(', '    fun requestAdultStop(', '    fun stopOwnedRuntimeForReset(', '    fun clearPrivateRuntimeHistoryRetainingAdult(', '    fun restartAfterSystemEvent('].map(m=>member('FreedVpnService.kt',m)).join('\n');
 files.push(file('Adapters.kt',`package app.freed.protection
import android.content.*
import android.os.SystemClock
import android.os.ParcelFileDescriptor
import android.os.Handler
import android.os.Looper
import android.net.VpnService
import java.io.FileOutputStream
import android.system.OsConstants
object FreedNativeUnlockStore {val lock=Any();fun clearAllAuthority(e:SharedPreferences.Editor){e.remove("native_package_unlock_receipt_v1")}}
internal object RecordFixture:FriendLockProtectedBytes {val values=mutableMapOf<String,ByteArray>();var error:FriendLockError?=null;override fun read(key:String):ByteArray?{error?.let{fail(it)};return values[key]};override fun write(key:String,value:ByteArray){values[key]=value.clone()};override fun remove(key:String){values.remove(key)}}
class FriendLockKeystoreBytes(c:Context):FriendLockProtectedBytes by RecordFixture
object FreedAccessibilityService {const val PREFS_NAME="owned";const val APP_USAGE_PREFIX="app_usage_ms_";const val APP_USAGE_DATE_KEY="app_usage_date_key";const val LAST_FOREGROUND_PACKAGE="last_foreground_package";const val LAST_FOREGROUND_ELAPSED_MS="last_foreground_elapsed_ms";val appSchedulesServiceConnected=true;var clears=0;fun clearOwnedRuntimeForReset():Boolean{clears++;return true}}

object FreedFocusShieldRules{const val FOCUS_SHIELD_UNLOCKS="focus_shield_unlocks_v1"}
object FreedFocusShieldRollout{var clears=0;fun clearOwnedConfiguration(c:Context):Boolean{clears++;return true};fun ownedConfigurationEmpty(c:Context)=true}
object FreedInterventionActivity{var clears=0;fun clearOwnedRuntimeForReset():Boolean{clears++;return true}}

class FixtureOutput:FileOutputStream(java.io.File.createTempFile("freed85-output-",".bin")){var fail=false;var closed=false;override fun close(){if(fail)error("output-close-failed");super.close();closed=true}}
internal class FixtureUpstream(val service:FreedVpnService){var closed=false;fun close(){service.closeCalls++;service.closeHook?.let{service.closeHook=null;it()};if(!service.closeAccepted)error("upstream-close-failed");closed=true}}
object PacketHealth85{var generation=0L;fun beginGeneration():Long{generation++;return generation};fun endGeneration(g:Long){}}
object R{object string{const val freed_dns_notification_title=1}}
object FreedNativeCopy{fun text(c:Context,i:Int)="DNS Guard"}

open class ServiceBase:Context(){open fun onRevoke(){};open fun onDestroy(){};open fun onStartCommand(i:Intent?,f:Int,s:Int)=0}
internal class FreedVpnService:ServiceBase(){
 var presentationPreferences:SharedPreferences?=null;val presentationListener=Any();var vpnInterface:ParcelFileDescriptor?=null;val unadmittedInterfaces=java.util.concurrent.ConcurrentHashMap.newKeySet<ParcelFileDescriptor>();var output:FileOutputStream?=null;var ownerCloseSucceeded=true;var closeAccepted=true;var closeCalls=0;var selfStops=0;val runtimeOwnership=FreedDnsRuntimeOwnership()
 val encryptedUpstreamDelegate=lazy { FixtureUpstream(this) }.also{it.value};val outputLock=Any();var packetGeneration=0L;var resolverRouteRestartEpoch:Long?=null;var probeGeneration=0L;var workersRunning=false;var readerThread:Thread?=null;val workerThreads=mutableListOf<Thread>();var probeThread:Thread?=null;val pendingWork=java.util.concurrent.ConcurrentLinkedQueue<Any>();val workPermits=java.util.concurrent.Semaphore(0);var captivePortalPaused=false;var cachedFeed=emptySet<String>();var cachedFeedSize=-1;var cachedFeedRefreshedAtElapsedMs=0L;var foregroundStops=0;var closeHook:(()->Unit)?=null
 fun unregisterNetworkWatch(){};fun stopForegroundGuard(){foregroundStops++};fun notifyRuntimeStateChanged(){};fun markDnsGuardStopped(reason:String){isRunning=false}
 @Synchronized
 ${member('FreedVpnService.kt','  private fun stopDnsGuard(')}
 @Synchronized
 ${member('FreedVpnService.kt','  private fun finishDnsGuardFromLoop(')}
 fun finishForCase(descriptor:ParcelFileDescriptor){finishDnsGuardFromLoop(descriptor,"reader-finished")}
 fun stopSelf(){selfStops++}
 var guardEpoch=0L;var adultRuntimeGeneration:Long?=null;val networkResolverRoutes=emptyList<Route85>();var establishHook:(()->Unit)?=null;var established=0;var descriptorForEstablish:ParcelFileDescriptor?=null;var foregroundStarts=0
 data class Route85(val address:String,val prefixLength:Int)
 inner class Builder{fun setSession(s:String)=this;fun addAddress(s:String,p:Int)=this;fun addDnsServer(s:String)=this;fun addRoute(s:String,p:Int)=this;fun allowFamily(f:Int)=this;fun setMtu(m:Int)=this;fun establish():ParcelFileDescriptor{established++;establishHook?.invoke();return descriptorForEstablish?:ParcelFileDescriptor()}}
 fun startForegroundGuard(){foregroundStarts++};fun captureCurrentNetworkResolverSnapshot(){};fun registerNetworkWatch(){};fun markDnsGuardStarted(){isRunning=true}
 fun runWorkerLoop(){try{java.util.concurrent.CountDownLatch(1).await()}catch(_:InterruptedException){}}
 fun runReaderLoop(d:ParcelFileDescriptor,g:Long){try{java.util.concurrent.CountDownLatch(1).await()}catch(_:InterruptedException){}}
 fun runCaptiveProbeLoop(){try{java.util.concurrent.CountDownLatch(1).await()}catch(_:InterruptedException){}}
 fun publishDnsMetadata(f:()->Unit){f()}
 ${member('FreedVpnService.kt','  private fun startDnsGuard(')}
 fun startForCase(){startDnsGuard()}
 ${member('FreedVpnService.kt','  override fun onStartCommand(')}
 ${member('FreedVpnService.kt','  override fun onRevoke(')}
 ${member('FreedVpnService.kt','  override fun onDestroy(')}
 companion object {
 const val VPN_ADDRESS="10.0.0.2";const val PRIMARY_DNS="1.1.1.3";const val SECONDARY_DNS="1.0.0.3";const val VPN_MTU=1500;const val DNS_WORKER_COUNT=4;const val STOP_REASON_RESOLVER_ROUTE_FAILED="routes";const val STOP_REASON_ESTABLISH_FAILED="establish";const val STOP_REASON_LOOP_ENDED="loop-ended";const val STOP_REASON_LOOP_FAILED="loop-failed";var dnsGuardIpv4ResolverRouteCount=0;var dnsGuardIpv6ResolverRouteCount=0;const val ACTION_STOP="stop";const val ACTION_RESTORE="restore";const val EXTRA_RESTORE_ACTION="restore-extra";const val START_STICKY=1;const val START_NOT_STICKY=2;const val STOP_REASON_SERVICE_DESTROY="destroy";const val STOP_REASON_MANUAL="manual";const val STOP_REASON_VPN_REVOKED="revoked";const val AUTO_RESTART_RESULT_STARTED="started";const val AUTO_RESTART_RESULT_FAILED="failed";const val AUTO_RESTART_RESULT_SKIPPED="skipped"
 const val PREF_DNS_GUARD_USER_ENABLED="dns_guard_user_enabled";const val PREF_DNS_GUARD_AUTO_RESTART_SKIP_REASON="dns_guard_auto_restart_skip_reason"
 val dnsGuardRuntimeReady get()=isRunning;val dnsGuardIpv6UnsupportedPackets=java.util.concurrent.atomic.AtomicLong(0);fun encryptedDnsHealthy():Boolean?=null;val dnsPacketHealth=PacketHealth85;var dnsGuardCaptivePaused=false;var liveService:FreedVpnService?=null;var activeRuntimeService:FreedVpnService?=null;val serviceOwners=mutableSetOf<FreedVpnService>();val runtimeStops=java.util.concurrent.atomic.AtomicInteger(0);var isRunning=true;var runtimeCloseSucceeded=true;val runtimeOwners=mutableSetOf<FreedDnsRuntimeOwnership>();var dnsGuardLastStopReason="";var lastAdultStopReceipt=emptyMap<String,Any?>();var lastBlockedHost:String?="old.example";var lastForwardFailure:String?="old failure";var lastBlockedKey="old";var lastBlockedElapsedMs=4L
 fun resetEncryptedDnsHealth(){};fun startUserEnabledGuard(c:Context){};fun ownedRuntimeCanReactivate()=!isRunning&&runtimeStops.get()==0&&runtimeCloseSucceeded&&serviceOwners.all{it.ownerCloseSucceeded&&it.vpnInterface==null&&it.output==null&&it.unadmittedInterfaces.isEmpty()}&&runtimeOwners.all{it.isStopped()};fun prefs(c:Context)=c.getSharedPreferences("owned",0);fun resetPrivateRuntimeHistory(){clearPrivateRuntimeHistoryRetainingAdult()};fun recordAutoRestart(c:Context,a:String,r:String,s:String?){}
 var startRequests=0
 fun startServiceAction(c:Context,a:String,r:String?=null){startRequests++}
 ${member('FreedVpnService.kt','    private fun autoRestartSkipReason(')}
 ${serviceMethods}
 }
}
`));
 const consentBlock=member('FreedProtectionModule.kt','    OnActivityResult {').replace('OnActivityResult { _, payload ->','fun consentResult(payload:ConsentPayload):Unit = run result@ {').replaceAll('return@OnActivityResult','return@result');
 const stopBlock=member('FreedProtectionModule.kt','    AsyncFunction("stopAdultContentFilter")').replace('AsyncFunction("stopAdultContentFilter") {','fun stop():Map<String,Any> = run stop@ {').replaceAll('return@AsyncFunction','return@stop');
 const feedBlock=member('FreedProtectionModule.kt','    AsyncFunction("configureAdultDomainFeed")').replace('AsyncFunction("configureAdultDomainFeed") { domains: List<String>, version: String, checksum: String, generatedAt: String ->','fun feed(domains:List<String>,version:String,checksum:String,generatedAt:String):Map<String,Any> = run feed@ {').replaceAll('return@AsyncFunction','return@feed');
 const allowedBlock=member('FreedProtectionModule.kt','    AsyncFunction("configureUserAllowedDomains")').replace('AsyncFunction("configureUserAllowedDomains") { domains: List<String> ->','fun allowed(domains:List<String>):Map<String,Any> = run allowed@ {').replaceAll('return@AsyncFunction','return@allowed');
 const resetBlock=member('FreedProtectionModule.kt','    AsyncFunction("resetProtectionConfiguration")').replace('AsyncFunction("resetProtectionConfiguration") {','fun reset():Map<String,Any> = run reset@ {').replaceAll('return@AsyncFunction','return@reset');
 const encryptedBlock=member('FreedProtectionModule.kt','    AsyncFunction("configureEncryptedDns")').replace('AsyncFunction("configureEncryptedDns") { configuration: Map<String, Any?> ->','fun encrypted(configuration:Map<String,Any?>):Map<String,Any?> = run encrypted@ {').replaceAll('return@AsyncFunction','return@encrypted');
 files.push(file('Module.kt',`package app.freed.protection
import android.content.Context
import android.app.Activity
private const val VPN_CONSENT_REQUEST_CODE=9407
class ConsentPayload(val requestCode:Int,val resultCode:Int)
class AppContext(val reactContext:Context?)
class ModuleAdapter(val appContext:AppContext){
 var pendingAdultConsentGeneration:Pair<Long?,Long>?=null
 val events=mutableListOf<Map<String,Any?>>()
 fun sendEvent(name:String,payload:Map<String,Any?>){events.add(payload)}
 ${consentBlock}
 ${stopBlock}
 ${feedBlock}
 ${allowedBlock}
 ${resetBlock}
 ${encryptedBlock}
 fun encryptedDnsStatus(c:Context?,error:String?=null):Map<String,Any?> = mapOf("error" to error);fun encryptedDnsOtherVpnActive(c:Context)=true
 fun statusPayload(authorized:Boolean,active:Boolean,mode:String,message:String,adultFilterActive:Boolean=false,appInterventionAuthorized:Boolean=false,usageStatsAuthorized:Boolean=false,vpnConsentRequired:Boolean=false,androidSettingsRoutes:List<String> = emptyList(),adultDomainFeedVersion:String?=null,adultDomainFeedChecksum:String?=null,adultDomainFeedDomainCount:Int=0,userAllowedDomainCount:Int=0):Map<String,Any> = mapOf("active" to active,"adultFilterActive" to adultFilterActive,"message" to message)
 fun statusPayloadWithAndroidDiagnostics(c:Context,p:Map<String,Any>)=p;fun dnsGuardFilteringActive(c:Context)=FreedVpnService.isRunning;fun isAccessibilityServiceEnabled(c:Context)=true;fun isUsageStatsAuthorized(c:Context)=true;fun isVpnConsentRequired(c:Context)=false;fun androidSettingsRoutes()=emptyList<String>()
 ${fs.readFileSync(join(native,'FreedProtectionModule.kt'),'utf8').split('  private fun adultMutationFailurePayload(')[1].split('  private fun isAccessibilityServiceEnabled(')[0].replace(/^/, '  private fun adultMutationFailurePayload(')}
}
`));
 files.push(file('Cases.kt',fs.readFileSync(join(__dirname,'AndroidAdultBoundaryCases.kt'),'utf8')));
 const jar=join(evidence,'adult-boundary-fixture.jar');
 run('kotlinc',[...files,...['FreedFriendLockCore','FreedFriendLockRecordStore','FreedAdultMutationBoundary','FreedAdultDomainFeed','FreedEncryptedDnsConfig','FreedProtectionConfiguration','FreedProtectionResetPolicy','FreedAdultAuthorizationExecutor','FreedAdultProtectionState','FreedAdultExecutionJournal','FreedDnsRuntimeOwnership','FreedNetworkDnsState','FreedDnsGuardPolicy','FreedDnsPacketPolicy'].map(n=>n==='FreedAdultProtectionState'&&process.argv.some(a=>a.startsWith('--state-source='))?process.argv.find(a=>a.startsWith('--state-source=')).slice('--state-source='.length):join(native,n+'.kt')),'-include-runtime','-d',jar]);
 fs.writeFileSync(join(evidence,'extracted-members.json'),JSON.stringify(extracted,null,2)+'\n');
 run('java',['-jar',jar]);
} finally {fs.rmSync(workspace,{recursive:true,force:true});}
