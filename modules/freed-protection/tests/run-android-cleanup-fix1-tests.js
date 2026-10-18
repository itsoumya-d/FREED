// Composed actual retained coordinator + actual singleton executor/Core/store + exact history/Activity members.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..');const packet=path.join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-87');
const frozen=process.argv.includes('--frozen');const tag=frozen?'red':'green';const out=path.join(packet,'fix1',tag);const generated=path.join(out,'generated');fs.mkdirSync(generated,{recursive:true});
const native=path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection');
const selectedNative=frozen?path.join(packet,'fix1/preimages/modules/freed-protection/android/src/main/java/app/freed/protection'):native;
const base=path.join(packet,'callbacks/generated-after');const files=[],selected=[];
function write(name,body){const p=path.join(generated,name);fs.writeFileSync(p,body);files.push(p);return p;}
function block(source,marker){const start=source.indexOf(marker);if(start<0)throw Error(marker);let q=false,e=false,depth=0;for(let i=source.indexOf('{',start);i<source.length;i++){const c=source[i];if(q){if(e)e=false;else if(c==='\\')e=true;else if(c==='"')q=false;continue;}if(c==='"')q=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);}throw Error(marker);}
function range(source,a,b){const start=source.indexOf(a),end=source.indexOf(b,start);if(start<0||end<0)throw Error(a);return source.slice(start,end);}
for(const name of ['Ops.kt','Usage.kt','Clock.kt','Settings.kt','ChallengeSensor.kt','TopologyOs.kt','AtomicFile.kt','DirectorySync.kt','Pm.kt','ProcessTopology.kt','Uri.kt','Expo.kt','ExpoDynamic.kt','ExpoExceptions.kt','ExpoRegistry.kt','ExpoTypes.kt','ExpoJNI.kt','ExpoConverter.kt','ExpoRuntime.kt','Shared.kt','Binding87.kt'])write(name,fs.readFileSync(path.join(base,name),'utf8').replace('class Activity{companion object{const val RESULT_OK=-1}}',''));
let context=fs.readFileSync(path.join(base,'Context.kt'),'utf8');context=context.replace('var commits=0','var commits=0;var commitGate:((Map<String,Any?>)->String?)?=null');context=context.replace('commits++;writes.forEach','commits++;val injected=commitGate?.invoke(writes);if(injected=="before")return false;writes.forEach');context=context.replace('val accepted=!failNext','val accepted=!failNext&&injected!="after"');write('Context.kt',context);
let runtime=fs.readFileSync(path.join(base,'Runtime.kt'),'utf8');
function removeObject(text,marker){const body=block(text,marker);return text.replace(body,'');}
runtime=removeObject(runtime,'object FreedInterventionActivity');runtime=removeObject(runtime,'internal object FreedVpnService');
runtime=runtime.replace('fun runOnMainForReset(operation:()->Boolean)=operation();','var deferMain=false;val mainWork=mutableListOf<()->Boolean>();fun runOnMainForReset(operation:()->Boolean):Boolean{if(deferMain){mainWork.add(operation);return false};return runCatching(operation).getOrDefault(false)};');
runtime=runtime.replace('val values=mutableMapOf<String,ByteArray>();override fun read(k:String)=values[k];','companion object{val namespaces=java.util.IdentityHashMap<Context,MutableMap<String,ByteArray>>()};val values=namespaces.getOrPut(c.applicationContext){mutableMapOf()};override fun read(k:String)=values[k]?.clone();');
runtime+='\nclass CallbackRule\nclass CallbackService{companion object{val connected:CallbackService?=null};fun clearForCase()=true}\n';
write('Runtime.kt',runtime);
const vpn=fs.readFileSync(path.join(selectedNative,'FreedVpnService.kt'),'utf8');
const history=range(vpn,'    private val privateHistoryLock','    @Volatile\n    var lastForwardResolver:')+range(vpn,'    @Volatile\n    var lastForwardFailure:','    @Volatile private var encryptedDnsHealth:')+range(vpn,'    @Volatile\n    private var lastBlockedKey:', '    private const val VPN_ADDRESS')+range(vpn,'    /** Conditional original-process diagnostics only;', '    @Volatile var lastAdultStopReceipt');
selected.push({path:path.join(selectedNative,'FreedVpnService.kt'),selection:'history fields/setters and complete identity/clear/forget helpers',sha256:crypto.createHash('sha256').update(history).digest('hex')});
write('VpnHistory.kt',`package app.freed.protection
import android.content.Context
internal object FreedVpnService{
 val dnsGuardRuntimeReady get()=running;val dnsGuardCaptivePaused=false;val dnsGuardIpv6UnsupportedPackets=java.util.concurrent.atomic.AtomicLong(0);fun encryptedDnsHealthy():Boolean?=null;val isRunning get()=running;fun userEnabledReadback(c:Context)=c.storage.all["dns_guard_user_enabled"] as? Boolean;fun isUserEnabled(c:Context)=c.storage.getBoolean("dns_guard_user_enabled",false);fun ownedRuntimeCanReactivate()=!running;fun setUserEnabled(c:Context,b:Boolean,p:FreedAdultPermit?=null){c.storage.edit().putBoolean("dns_guard_user_enabled",b).commit()};fun stopOwnedRuntimeForReset(c:Context,r:String,p:FreedAdultPermit?=null):Boolean{running=false;return true};var running=true
 ${history}
 fun publishHistory(host:String){lastBlockedHost=host;lastForwardFailure="failure:$host";lastBlockedKey="key:$host";lastBlockedElapsedMs+=1}
 fun historySnapshot()=listOf(lastBlockedHost,lastForwardFailure,lastBlockedKey,lastBlockedElapsedMs,privateHistoryRevision)
}
`);
const activity=fs.readFileSync(path.join(selectedNative,'FreedInterventionActivity.kt'),'utf8');
const companion=range(activity,'  companion object {','  private var companion:');const dismiss=block(activity,'  private fun dismissForConfigurationReset(');const destroy=block(activity,'  override fun onDestroy(');
const modern=activity.includes('operationID: String');
const hasEpoch=activity.includes('private var presentationEpoch');const epoch=hasEpoch&&!companion.includes('private var presentationEpoch')?'private var presentationEpoch=0L':'';
selected.push({path:path.join(selectedNative,'FreedInterventionActivity.kt'),selection:'complete companion, dismissal and onDestroy bodies',sha256:crypto.createHash('sha256').update(companion+dismiss+destroy).digest('hex')});
write('ActivityOs.kt',`package android.app
open class Activity{companion object{const val RESULT_OK=-1};var isFinishing=false;var isDestroyed=false;var finishCalls=0;var finishMode="unconfirmed";var finishHook:(()->Unit)?=null
 fun setIntent(i:android.content.Intent){};open fun finish(){finishCalls++;finishHook?.invoke();if(finishMode=="throw")error("finish-throw");if(finishMode=="success")isFinishing=true};open fun onDestroy(){isDestroyed=true}}
`);
write('Intent.kt','package android.content\nclass Intent\n');
write('Activity.kt',`package app.freed.protection
import android.app.Activity
import android.content.Intent
import java.lang.ref.WeakReference
class Motion87{fun stopMotion(){}}
class FreedInterventionActivity:Activity(){
 ${companion}
 private var companion:Motion87?=null;private var hasOpenedRecovery=false;private var renderedWebsiteInterventionId:String?=null;${epoch}
 ${dismiss}
 ${destroy}
 fun publishForCase(){synchronized(activityOwnershipLock){${hasEpoch?'presentationEpoch+=1;':''}activeActivity=WeakReference(this)}}
 fun destroyForCase()=onDestroy()
 companionPlaceholder87
}
internal fun activityForget87(id:String){${modern?'FreedInterventionActivity.forgetCleanupOperation(id)':'Unit'}}
internal fun activityScrub87(id:String,valid:()->Boolean):Boolean=FreedInterventionActivity.clearOwnedRuntimeForCleanup(${modern?'id,':''}valid)
`.replace(' companionPlaceholder87',''));
write('Cases.kt',fs.readFileSync(path.join(__dirname,'AndroidCleanupFix1Cases.kt'),'utf8'));
const names=['FreedPrivateAccountSession','FreedInstalledAppPolicy','FreedAppGroupPolicy','FreedAppGroupAuthorityPolicy','FreedAppGroupTransaction','FreedAppGroupStore','FreedRetainedAdultProtection','FreedEarnedAppTimePolicy','FreedEarnedTimeClock','FreedEarnedChallengeProofPolicy','FreedEarnedChallengeProofStore','FreedEarnedChallengePhotoEvaluation','FreedNativeUnlockPolicy','FreedAppSchedulePolicy','FreedDoomscrollApps','FreedAppGuardModePolicy','FreedUrlClassifier','FreedFriendLockCore','FreedFriendLockRecordStore','FreedAdultExecutionJournal','FreedAdultAuthorizationExecutor','FreedAdultMutationBoundary','FreedAdultProtectionState','FreedAdultDomainFeed','FreedEncryptedDnsConfig','FreedWebsiteRecoveryHandoff','FreedInterventionHandoffPolicy','FreedDnsGuardPolicy','FreedDnsPacketPolicy'];
files.push(...names.map(n=>path.join(selectedNative,n+'.kt')));
const json=path.join(root,'.superpowers/android-candidate-20261005/pinned-dependency-downloads/org.json_json_20180813/json-20180813.jar'),jar=path.join(out,'composed.jar');
function run(cmd,args,name){const started=new Date().toISOString(),r=cp.spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:300000});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||''));const receipt={command:[cmd,...args],started,finished:new Date().toISOString(),exit:r.status,signal:r.signal};fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(receipt,null,2));process.stdout.write(name+': '+r.status+'\n');if(r.status && name==='compile'){process.stderr.write(r.stderr||'');process.exit(r.status||1);}return r.status;}
fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify(files.map(p=>({path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')})),null,2));fs.writeFileSync(path.join(out,'selections.json'),JSON.stringify(selected,null,2));
run('kotlinc',[...files,'-classpath',json,'-include-runtime','-d',jar],'compile');
let failures=0;for(const scenario of (frozen?['multi','uncertain','history','historyLost','activity','activityThrow','activityReplacement','activityReused']:['multi','uncertain','uncertainFollower','cohortLost','reopened','reserved','history','historyLost','activity','activityThrow','activityReplacement','activityReused','activityCapacity']))failures+=run('java',['-classpath',jar+':'+json,'app.freed.protection.CasesKt',scenario],scenario)!==0;
if(!frozen&&failures)process.exit(1);
