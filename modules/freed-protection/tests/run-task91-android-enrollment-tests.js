// Full current singleton facade/machine/Core/store/journal and exact native-layer adapter.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=process.cwd(),native=path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection');
const out=process.env.FREED_TASK91_ANDROID_OUTPUT_DIR?path.resolve(process.env.FREED_TASK91_ANDROID_OUTPUT_DIR):fs.mkdtempSync(path.join(require('node:os').tmpdir(),'freed-task91-android-'));fs.mkdirSync(out,{recursive:true});
const files=[];function write(n,s){const p=path.join(out,n);fs.writeFileSync(p,s);files.push(p);return p}
write('Context.kt',`package android.content
class Context {val contentResolver=Any();val applicationContext get()=this;val packageName="app.freed";val packageManager=android.content.pm.PackageManager();val noBackupFilesDir=java.nio.file.Files.createTempDirectory("freed90-").toFile();fun <T> getSystemService(c:Class<T>):T?=null}
`);
write('PackageManager.kt',`package android.content.pm
class ServiceInfo(val name:String,val processName:String="app.freed")
class PackageInfo {val services=arrayOf(ServiceInfo("app.freed.protection.FreedVpnService"),ServiceInfo("app.freed.protection.FreedAccessibilityService"))}
class PackageManager {companion object{const val GET_SERVICES=4};fun getPackageInfo(n:String,f:Int)=PackageInfo()}
`);
write('SystemClock.kt',`package android.os
object SystemClock {var now=100L;fun elapsedRealtime()=now}
`);
write('Process.kt',`package android.os
object Build {object VERSION{const val SDK_INT=36}}
object Process{fun myPid()=12}
`);
write('Application.kt',`package android.app
object Application{fun getProcessName()="app.freed"}
class ActivityManager {data class RunningAppProcessInfo(val pid:Int=12,val processName:String="app.freed");val runningAppProcesses=listOf(RunningAppProcessInfo())}
`);
write('AtomicFile.kt',`package android.util
class AtomicFile(val file:java.io.File){fun openRead()=java.io.FileInputStream(file);fun startWrite()=java.io.FileOutputStream(file);fun finishWrite(s:java.io.FileOutputStream){s.close()};fun failWrite(s:java.io.FileOutputStream){s.close()}}
`);
write('Os.kt',`package android.system
object OsConstants{const val O_RDONLY=0;const val O_DIRECTORY=0}
object Os {fun open(p:String,f:Int,m:Int)=java.io.FileDescriptor();fun fsync(d:java.io.FileDescriptor){};fun close(d:java.io.FileDescriptor){}}
`);
const layersSource=fs.readFileSync(path.join(native,'FreedAdultProtectionState.kt'),'utf8');
write('ActualNativeLayers.kt','package app.freed.protection\nimport android.content.Context\n'+layersSource.slice(layersSource.indexOf('internal class FreedAdultNativeLayers')));
write('OSProtectedSeams.kt',`package app.freed.protection
import android.content.Context
import android.os.SystemClock
internal class FriendLockKeystoreBytes(c:Context):FriendLockProtectedBytes {
 companion object {val values=mutableMapOf<String,ByteArray>();var unavailable=false;var failure:String?=null;var lostCommit=false;var hideRecord=false;var writes=0}
 override fun read(k:String):ByteArray? {if(unavailable)fail(FriendLockError.STORAGE_UNAVAILABLE);return if(hideRecord&&k=="record")null else values[k]?.clone()}
 override fun write(k:String,v:ByteArray){writes++;if(unavailable)fail(FriendLockError.STORAGE_UNAVAILABLE);if(failure==k)fail(FriendLockError.STORAGE_UNAVAILABLE);values[k]=v.clone();if(lostCommit&&k=="journal"&&FriendLockRecordCodec.decodeJournal(v).committed)fail(FriendLockError.COMMIT_OUTCOME_UNKNOWN)}
 override fun remove(k:String){values.remove(k)}
}
internal class FreedAdultMutationGate(val record:()->FriendLockRecord?){fun requireUnenrolled(a:FriendLockAction){check(record()==null)}}
internal object Test90OS {
 val values=mutableMapOf("dns-intent" to "true","dns-runtime" to "true","encrypted-request" to "true","encrypted-clear" to "true","accessibility-adult" to "true","feed" to "before-feed","exceptions" to "")
 var generation=1L;var writes=0;var latch:java.util.concurrent.CountDownLatch?=null
 fun apply(layer:String,desired:String,p:FreedAdultPermit){p.issuer.consume(p,layer,values.getValue(layer),desired);if(layer=="dns-runtime")latch?.await();values[layer]=desired;writes++}
}
internal object FreedAdultProtectionState {
 data class Read(val health:String="readable",val accessibility:Boolean=Test90OS.values["accessibility-adult"]=="true")
 fun read(c:Context)=Read();fun migrate(c:Context)=Read()
 data class EnrollmentObservation(val configuration:FriendLockConfiguration,val runtimeVersion:Long,val readback:String)
 ACTUAL_ENROLLMENT_OBSERVATION
 fun configuration(c:Context):FriendLockConfiguration{if(Test91OS.finalRuntimeLoss&&Test91OS.observations>=2&&Thread.holdsLock(FreedAdultAuthorizationExecutor.get(c).guard))Test91OS.ready=false;return FriendLockConfiguration(Test90OS.values.toSortedMap().toString().hashCode().toString(),Test90OS.generation.toString())}
 fun <T> guarded(c:Context,body:()->T):T{if(Test91OS.observations>=2)Test91OS.beforeFinal?.invoke();return synchronized(FreedAdultAuthorizationExecutor.get(c).guard,body)}
 fun repairFence(c:Context,r:String){FreedAdultAuthorizationExecutor.get(c).machine.revokeForRepair(r);Test90OS.generation++}
 fun setAccessibility(c:Context,v:Boolean,p:FreedAdultPermit?):Boolean{Test90OS.apply("accessibility-adult",v.toString(),p!!);return true}
}
internal object FreedRetainedAdultProtection {fun adultCleanupPending(c:Context,id:String?)=Test91OS.cleanupPending;fun coreCleanupKnown(c:Context,id:String)=false;fun coreCleanupCanForget(c:Context,id:String)=false}
internal object Test91OS {var ready=true;var finalRuntimeLoss=false;var observations=0;var accessibilityEnabled=true;var os="off";var beforeFinal:(()->Unit)?=null;var cleanupPending=false;var firstObservation:java.util.concurrent.CountDownLatch?=null}
internal object FreedNetworkDnsState {data class State(val mode:String);fun read(c:Context):State{Test91OS.observations++;return State(Test91OS.os)}}
internal object FreedDnsGuardPolicy {fun filteringActive(r:Boolean,c:Boolean,o:String,i:Long)=r&&!c&&o=="off"&&i==0L}
internal object FreedAccessibilityService {val appSchedulesServiceConnected=true}
internal object FreedProtectionConfiguration {fun interceptionEnabled(c:Context)=true}
internal object FreedVpnService {
 val runtimeStateVersion=1L;val isRunning get()=Test91OS.ready;val dnsGuardRuntimeReady get():Boolean{Test91OS.firstObservation?.countDown();return Test91OS.ready};val dnsGuardCaptivePaused=false;val dnsGuardIpv6UnsupportedPackets=java.util.concurrent.atomic.AtomicLong(0)
 ACTUAL_ENCRYPTED_HEALTH
 init {recordEncryptedDnsHealth(true,0L)}

 fun userEnabledReadback(c:Context)=Test90OS.values["dns-intent"]=="true"
 fun ownedRuntimeCanReactivate()=Test90OS.values["dns-runtime"]!="true"
 fun setUserEnabled(c:Context,v:Boolean,p:FreedAdultPermit){Test90OS.apply("dns-intent",v.toString(),p)}
 fun stopOwnedRuntimeForReset(c:Context,r:String,p:FreedAdultPermit):Boolean{Test90OS.apply("dns-runtime","false",p);return true}
}
internal object FreedEncryptedDnsConfig {
 fun requestedReadback(c:Context):Boolean?=Test90OS.values["encrypted-request"]=="true"
 fun ownedConfigurationEmpty(c:Context)=Test90OS.values["encrypted-clear"]=="empty"
 fun isRequested(c:Context)=requestedReadback(c)==true
 fun setRequested(c:Context,v:Boolean,p:FreedAdultPermit):Boolean{Test90OS.apply("encrypted-request",v.toString(),p);return true}
 fun clearOwnedConfiguration(c:Context,p:FreedAdultPermit):Boolean{Test90OS.apply("encrypted-clear","empty",p);return true}
}
internal object FreedAdultDomainFeed {
 fun feedSnapshot(c:Context)=Test90OS.values.getValue("feed")
 fun exceptionsSnapshot(c:Context)=Test90OS.values.getValue("exceptions")
 fun canonicalFeed(d:List<String>,v:String,ch:String,g:String)=d.sorted().joinToString(",")+v+ch+g
 fun canonicalExceptions(d:List<String>)=d.filter{it.isNotEmpty()}.sorted().joinToString(",")
 fun applyFeedSnapshot(c:Context,d:String,p:FreedAdultPermit){Test90OS.apply("feed",d,p)}
 fun configureUserAllowedDomains(c:Context,d:List<String>,p:FreedAdultPermit){Test90OS.apply("exceptions",canonicalExceptions(d),p)}
}
`);
const observation=layersSource.slice(layersSource.indexOf('  fun enrollmentObservation('),layersSource.indexOf('  /** Explicit checked migration;'));
const seamPath=path.join(out,'OSProtectedSeams.kt');fs.writeFileSync(seamPath,fs.readFileSync(seamPath,'utf8').replace('ACTUAL_ENROLLMENT_OBSERVATION',observation).replace('ACTUAL_ENCRYPTED_HEALTH',fs.readFileSync(path.join(native,'FreedVpnService.kt'),'utf8').split('    @Volatile private var encryptedDnsHealth:')[1].split('    @Volatile\n    var dnsGuardStartedAtElapsedMs:')[0].replace(/^/, '    @Volatile private var encryptedDnsHealth:')));
write('ComponentName.kt',`package android.content
class ComponentName(c:Context,k:Class<*>) {fun flattenToString()="app.freed/Service";fun flattenToShortString()=flattenToString()}`);
write('Settings.kt',`package android.provider
object Settings {object Secure {const val ENABLED_ACCESSIBILITY_SERVICES="enabled";fun getString(c:Any,k:String):String?=if(app.freed.protection.Test91OS.accessibilityEnabled)"app.freed/Service" else null}}`);
write('Task91AndroidEnrollmentProbe.kt',fs.readFileSync(path.join(root,'modules/freed-protection/tests/Task91AndroidEnrollmentProbe.kt'),'utf8'));
files.push(...['FreedAdultAuthorizationExecutor.kt','FreedFriendLockCore.kt','FreedFriendLockRecordStore.kt','FreedAdultExecutionJournal.kt'].map(n=>path.join(native,n)),path.join(root,'modules/freed-protection/tests/'+(process.argv.includes('--compat')?'Task90AndroidDeviceAdultCases.kt':'Task91AndroidEnrollmentCases.kt')));
const records=[];const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function run(command,args){const start=Date.now(),r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});records.push({command,args,status:r.status,signal:r.signal,error:r.error?String(r.error):null,elapsedMs:Date.now()-start,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(records,null,2));process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)process.exit(r.status||1)}
const jar=path.join(out,'device-adult.jar');fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(Object.fromEntries(files.map(p=>[p,hash(p)])),null,2));
fs.mkdirSync(path.join(out,'inputs'),{recursive:true});for(const p of files)fs.copyFileSync(p,path.join(out,'inputs',path.basename(p)));fs.writeFileSync(path.join(out,'actual-state-source.sha256'),hash(path.join(native,'FreedAdultProtectionState.kt')));
run('kotlinc',[...files,'-include-runtime','-d',jar]);fs.writeFileSync(path.join(out,'binary.sha256'),hash(jar));
if(process.argv.includes('--compat')){run('java',['-jar',jar]);run('java',['-jar',jar,'--missing-journal']);}else for(const scenario of (process.env.FREED_TASK91_SCENARIOS?process.env.FREED_TASK91_SCENARIOS.split(','):['disabled','invalid','saved-only','final-runtime-loss','denied','unknown-dns','unhealthy','cleanup','uncertain','stale','legacy','write-failure','positive','lost','readback','census','final-health-false','final-health-expired','final-health-unknown','kdf-locks','stale-during-kdf']))run('java',['-jar',jar,scenario]);
