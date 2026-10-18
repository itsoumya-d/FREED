// Full current singleton facade/machine/Core/store/journal and exact native-layer adapter.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=process.cwd(),native=path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection');
const out=path.join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-90/'+(process.argv.find(a=>a.startsWith('--name='))?.slice(7)||'android'));fs.mkdirSync(out,{recursive:true});
const files=[];function write(n,s){const p=path.join(out,n);fs.writeFileSync(p,s);files.push(p);return p}
write('Context.kt',`package android.content
class Context {val applicationContext get()=this;val packageName="app.freed";val packageManager=android.content.pm.PackageManager();val noBackupFilesDir=java.nio.file.Files.createTempDirectory("freed90-").toFile();fun <T> getSystemService(c:Class<T>):T?=null}
`);
write('PackageManager.kt',`package android.content.pm
class ServiceInfo(val name:String,val processName:String="app.freed")
class PackageInfo {val services=arrayOf(ServiceInfo("app.freed.protection.FreedVpnService"),ServiceInfo("app.freed.protection.FreedAccessibilityService"))}
class PackageManager {companion object{const val GET_SERVICES=4};fun getPackageInfo(n:String,f:Int)=PackageInfo()}
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
internal class FriendLockKeystoreBytes(c:Context):FriendLockProtectedBytes {
 companion object {val values=mutableMapOf<String,ByteArray>();var unavailable=false}
 override fun read(k:String):ByteArray? {if(unavailable)fail(FriendLockError.STORAGE_UNAVAILABLE);return values[k]?.clone()}
 override fun write(k:String,v:ByteArray){if(unavailable)fail(FriendLockError.STORAGE_UNAVAILABLE);values[k]=v.clone()}
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
 fun configuration(c:Context)=FriendLockConfiguration(Test90OS.values.toSortedMap().toString().hashCode().toString(),Test90OS.generation.toString())
 fun <T> guarded(c:Context,body:()->T)=synchronized(FreedAdultAuthorizationExecutor.get(c).guard,body)
 fun repairFence(c:Context,r:String){FreedAdultAuthorizationExecutor.get(c).machine.revokeForRepair(r);Test90OS.generation++}
 fun setAccessibility(c:Context,v:Boolean,p:FreedAdultPermit?):Boolean{Test90OS.apply("accessibility-adult",v.toString(),p!!);return true}
}
internal object FreedRetainedAdultProtection {fun adultCleanupPending(c:Context,id:String?)=false;fun coreCleanupKnown(c:Context,id:String)=false;fun coreCleanupCanForget(c:Context,id:String)=false}
internal object FreedVpnService {
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
files.push(...['FreedAdultAuthorizationExecutor.kt','FreedFriendLockCore.kt','FreedFriendLockRecordStore.kt','FreedAdultExecutionJournal.kt'].map(n=>path.join(native,n)),path.join(root,'modules/freed-protection/tests/Task90AndroidDeviceAdultCases.kt'));
const records=[];const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function run(command,args){const start=Date.now(),r=cp.spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:180000});records.push({command,args,status:r.status,signal:r.signal,error:r.error?String(r.error):null,elapsedMs:Date.now()-start,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(records,null,2));process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');if(r.status!==0)process.exit(r.status||1)}
const jar=path.join(out,'device-adult.jar');fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(Object.fromEntries(files.map(p=>[p,hash(p)])),null,2));
run('kotlinc',[...files,'-include-runtime','-d',jar]);fs.writeFileSync(path.join(out,'binary.sha256'),hash(jar));if(process.argv.includes('--status-only'))run('java',['-jar',jar,'--status-only']);else{run('java',['-jar',jar]);run('java',['-jar',jar,'--missing-journal']);}
