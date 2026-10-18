// Executes unchanged extracted production notification members and the actual website adapter.
// Android framework facades are behavioral fixtures; SDK mode separately checks real public types.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
assert.ok(process.argv.includes('--compiler-reserved'), 'Root must reserve the sole native compiler.');
const red = process.argv.includes('--preimage');
const sdk = process.argv.includes('--sdk');
assert.ok(!(red && sdk));
const evidence = path.join(root, '.superpowers/sdd/2026-10-13-publishable-recovery/task-76');
const prefix = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const servicePath = red ? '.superpowers/sdd/2026-10-13-publishable-recovery/task-76/preimages/FreedAccessibilityService.kt' : prefix + 'FreedAccessibilityService.kt';
const service = fs.readFileSync(path.join(root, servicePath), 'utf8');
function member(marker) {
 const start = service.indexOf(marker); assert.ok(start >= 0, marker);
 const brace = service.indexOf('{', start); let depth = 1, quoted = false, escaped = false;
 for (let i = brace + 1; i < service.length; i++) {
  const c = service[i];
  if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
  if (c === '"') quoted = true;
  else if (c === '{') depth++;
  else if (c === '}' && --depth === 0) return service.slice(start, i + 1);
 }
 throw Error(marker);
}
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-accessibility-notice-'));
const inputs = [];
function write(name, value) { const file = path.join(work, name); fs.writeFileSync(file, value); inputs.push(file); return file; }
const notificationMembers = ['  private fun buildAccessibilityInterventionIntent(', '  private fun showAccessibilityInterventionNotification('].map(member).join('\n');
const websitePredicate = (() => {
 const file = fs.readFileSync(path.join(root, prefix, 'FreedWebsiteRecoveryHandoff.kt'), 'utf8');
 const start = file.indexOf('  fun isWebsite('); const end = file.indexOf('\n  /**', start);
 return file.slice(start, end).trim();
})();
write('Service.kt', `package app.freed.protection
import android.app.*
import android.content.*
import android.os.Build
open class FreedAccessibilityService: ContextWrapper(null) {
 companion object {const val PREFS_NAME="owned";const val PENDING_INTERVENTION_ID="pending_intervention_id";const val PENDING_SOURCE_PACKAGE="pending_source_package";const val PENDING_RULE="pending_rule"}
 val INTERVENTION_NOTIFICATION_CHANNEL_ID="interventions";val INTERVENTION_NOTIFICATION_ID=42
 ${notificationMembers}
 fun notice(rule:String="adult-seed", source:String="com.android.chrome", focus:String?=null) = showAccessibilityInterventionNotification("private title", "private.example.xxx", source, "https://private.example.xxx", "private.example.xxx", rule, focus)
}
object FreedWebsiteRecoveryHandoff { ${websitePredicate} }
object FreedProtectionConfiguration { const val INTENT_EPOCH="epoch";fun epoch(c:Context)=7L }
class FreedInterventionActivity { companion object {const val INTERVENTION_ID_EXTRA="freed_intervention_id"} }
object R { object string { const val freed_recovery_channel=1;const val freed_browser_channel_description=2;const val freed_accessibility_notification=3;const val freed_source_label=4;const val freed_start_recovery=5 } }
object FreedNativeCopy { fun text(c:Context, r:Int, v:Map<String,String> = emptyMap()) = if(r==R.string.freed_source_label) "Source: "+v["host"] else "localized-"+r }
`);
write('Website.kt', fs.readFileSync(path.join(root, prefix, 'FreedWebsiteRecoveryNotification.kt'), 'utf8'));
if (!sdk) {
 write('Content.kt', `package android.content
import android.content.pm.*
import android.app.*
import android.os.Bundle
import android.net.Uri
class ComponentName(val packageName:String,val className:String)
class Intent(var action:String="") {
 constructor(c:Context,t:Class<*>):this(""){component=ComponentName(c.packageName,t.name)}
 var component:ComponentName?=null;var \`package\`:String?=null;var extras:Bundle?=null;var data:Uri?=null;var selector:Intent?=null;var clipData:Any?=null;var flags=0;val categories=mutableSetOf<String>()
 fun setComponent(c:ComponentName)=apply{component=c};fun setPackage(p:String)=apply{\`package\`=p};fun addFlags(f:Int)=apply{flags=flags or f}
 fun putExtra(k:String,v:Any?)=apply{if(extras==null)extras=Bundle();extras!!.values[k]=v}
 companion object {const val ACTION_VIEW="android.intent.action.VIEW";const val ACTION_MAIN="android.intent.action.MAIN";const val FLAG_ACTIVITY_NEW_TASK=0x10000000;const val FLAG_ACTIVITY_CLEAR_TOP=0x04000000;const val FLAG_ACTIVITY_SINGLE_TOP=0x20000000}
}
open class Context {
 val packageName="app.freed.recovery";val packageManager=PackageManager();val applicationInfo=ApplicationInfo();val manager=NotificationManager();val prefs=Preferences()
 fun <T> getSystemService(c:Class<T>):T { @Suppress("UNCHECKED_CAST") return manager as T };fun getSharedPreferences(n:String,m:Int)=prefs
 companion object {const val MODE_PRIVATE=0}
}
open class ContextWrapper(c:Context?):Context()
class Preferences {val values=mutableMapOf<String,String?>();fun getString(k:String,d:String?)=values[k]?:d}
`);
 write('Pm.kt', `package android.content.pm
import android.content.*
class ApplicationInfo {var icon=0}
class PackageManager {var failed=false;var launch:Intent?=Intent(Intent.ACTION_MAIN).setComponent(ComponentName("app.freed.recovery","app.freed.recovery.MainActivity"))
 fun getLaunchIntentForPackage(p:String):Intent? {if(failed)throw SecurityException("lookup denied");return launch}}
`);
 write('Os.kt', `package android.os
class Bundle {val values=mutableMapOf<String,Any?>();val isEmpty get()=values.isEmpty()}
object Build { object VERSION {var SDK_INT=36};object VERSION_CODES {const val O=26} }
`);
 write('Uri.kt', `package android.net
class Uri private constructor(val value:String) {override fun toString()=value;companion object {fun parse(s:String)=Uri(s)}}
`);
 write('R.kt', `package android
object R {object drawable {const val ic_lock_lock=99}}
`);
 write('App.kt', `package android.app
import android.content.*
class PendingIntent(val intent:Intent,val flags:Int) {companion object {var denied=false;const val FLAG_UPDATE_CURRENT=0x08000000;const val FLAG_IMMUTABLE=0x04000000;fun getActivity(c:Context,id:Int,i:Intent,f:Int):PendingIntent {if(denied)throw SecurityException("pending denied");return PendingIntent(i,f)}}}
class NotificationChannel(val id:String,val title:String,val importance:Int) {var description=""}
class Notification(val title:String,val body:String,val big:String,val content:PendingIntent?,val actions:List<Pair<String,PendingIntent>>,val visibility:Int) {
 class BigTextStyle {var value="";fun bigText(s:String)=apply{value=s}}
 class Builder(c:Context,channel:String="") {var title="";var body="";var big="";var content:PendingIntent?=null;val actions=mutableListOf<Pair<String,PendingIntent>>();var visibility=0
 fun setSmallIcon(i:Int)=this;fun setContentTitle(s:String)=apply{title=s};fun setContentText(s:String)=apply{body=s};fun setStyle(s:BigTextStyle)=apply{big=s.value};fun setContentIntent(p:PendingIntent)=apply{content=p};fun setAutoCancel(b:Boolean)=this;fun setCategory(s:String)=this;fun setPriority(i:Int)=this;fun setVisibility(i:Int)=apply{visibility=i};fun addAction(i:Int,s:String,p:PendingIntent)=apply{actions.add(s to p)};fun build()=Notification(title,body,big,content,actions.toList(),visibility)
 }
 companion object {const val VISIBILITY_PRIVATE=0;const val CATEGORY_STATUS="status";const val PRIORITY_HIGH=1}
}
class NotificationManager {var denied=false;var channelDenied=false;val shown=mutableListOf<Notification>();val channels=mutableListOf<NotificationChannel>();fun createNotificationChannel(c:NotificationChannel){if(channelDenied)throw SecurityException("channel denied");channels.add(c)};fun notify(id:Int,n:Notification){if(denied)throw SecurityException("permission denied");shown.add(n)};companion object {const val IMPORTANCE_HIGH=4}}
`);
 write('Cases.kt', `package app.freed.protection
import android.content.*
import android.app.*
import android.net.Uri
import android.os.Build
fun main() {
 fun assertManual(i:Intent) {check(i.data.toString()=="freed://guided-reset"){"Website notice must open exact manual route in one tap"};check(i.action==Intent.ACTION_VIEW);check(i.component?.packageName=="app.freed.recovery");check(i.component?.className=="app.freed.recovery.MainActivity");check(i.\`package\`=="app.freed.recovery");check(i.extras==null||i.extras!!.isEmpty);check(i.selector==null&&i.clipData==null&&i.categories.isEmpty());check(i.flags==Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)}
 val s=FreedAccessibilityService();s.prefs.values["pending_intervention_id"]="owner-A-old-id";s.notice();val n=s.manager.shown.single();assertManual(n.content!!.intent)
 check(n.actions.size==1);check(n.actions.single().first=="localized-5");check(n.actions.single().second===n.content);check(n.content.flags==PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
 check(listOf(n.title,n.body,n.big).none{it.contains("private")||it.contains("Source:")});check(n.visibility==Notification.VISIBILITY_PRIVATE)
 // Neither website process-local state nor an old owner is consulted or transported.
 s.prefs.values.clear();s.notice();assertManual(s.manager.shown.last().content!!.intent);s.prefs.values["pending_intervention_id"]="owner-B-current";s.notice();assertManual(s.manager.shown.last().content!!.intent)
 val c=Context();fun rejected(template:Intent?)=check(FreedWebsiteRecoveryNotification.buildIntent(c,template)==null)
 rejected(null);rejected(Intent(Intent.ACTION_MAIN));rejected(Intent().setComponent(ComponentName("foreign.app","app.freed.recovery.MainActivity")));rejected(Intent().setComponent(ComponentName(c.packageName,"foreign.MainActivity")));rejected(Intent().setComponent(ComponentName(c.packageName,"app.freed.recovery.OtherActivity")))
 fun template()=Intent(Intent.ACTION_MAIN).setComponent(ComponentName(c.packageName,"app.freed.recovery.MainActivity"))
 rejected(template().apply{action=Intent.ACTION_VIEW});rejected(template().apply{action="android.intent.action.SEND"});rejected(template().setPackage("foreign.app"));rejected(template().putExtra("owner","A"));rejected(template().apply{data=Uri.parse("freed://guided-reset?target=private.example.xxx")});rejected(template().apply{selector=Intent()});rejected(template().apply{clipData="private"})
 val original=template().apply{flags=123;categories.add("launcher")};val manual=FreedWebsiteRecoveryNotification.buildIntent(c,original)!!;assertManual(manual);check(original.flags==123&&original.categories.size==1&&original.data==null)
 val missing=FreedAccessibilityService();missing.packageManager.launch=null;missing.notice();check(missing.manager.shown.isEmpty())
 val foreign=FreedAccessibilityService();foreign.packageManager.launch=Intent().setComponent(ComponentName("foreign","app.freed.recovery.MainActivity"));foreign.notice();check(foreign.manager.shown.isEmpty())
 val denied=FreedAccessibilityService();denied.manager.denied=true;check(runCatching{denied.notice()}.exceptionOrNull() is SecurityException);check(denied.manager.shown.isEmpty())
 denied.manager.denied=false;denied.manager.channelDenied=true;check(runCatching{denied.notice()}.isFailure);check(denied.manager.shown.isEmpty());denied.manager.channelDenied=false;PendingIntent.denied=true;check(runCatching{denied.notice()}.isFailure);PendingIntent.denied=false
 denied.packageManager.failed=true;check(runCatching{denied.notice()}.isFailure);check(denied.manager.shown.isEmpty())
 Build.VERSION.SDK_INT=25;val legacy=FreedAccessibilityService();legacy.notice();assertManual(legacy.manager.shown.single().content!!.intent);check(legacy.manager.channels.isEmpty());Build.VERSION.SDK_INT=36
 for(rule in listOf("configured-app:com.selected","short-form:reels","focus-shield:focus","app-group:group:revision")) {
  val app=FreedAccessibilityService();app.prefs.values["pending_intervention_id"]="native-valid-id";app.notice(rule,"com.selected",if(rule.startsWith("focus-shield:"))"focus" else null)
  val i=app.manager.shown.single().content!!.intent;check(i.data==null&&i.component?.className==FreedInterventionActivity::class.java.name);check(i.extras!!.values["freed_intervention_id"]=="native-valid-id");check(i.extras!!.values["freed_intervention_source"]=="com.selected");check(i.extras!!.values["freed_intervention_rule"]==rule);check(i.extras!!.values["epoch"]==7L);check(app.manager.shown.single().actions.isEmpty())
 }
 println("PASS actual accessibility notification branch + actual website adapter: one-action explicit immutable payload-free manual route; generic localized copy; absent/replaced owner-context transport empty; missing/foreign/template-input denial; channel/permission/PendingIntent/lookup failures; API25/36; app/shortform/focus/group native barrier context unchanged")
}
`);
}
const receipt = {testScope:{productionMembers:['FreedAccessibilityService.buildAccessibilityInterventionIntent','FreedAccessibilityService.showAccessibilityInterventionNotification','FreedWebsiteRecoveryNotification.buildIntent','FreedWebsiteRecoveryNotification.show','FreedWebsiteRecoveryHandoff.isWebsite'], boundaries:sdk?'Real installed android-36 public API types; wrapper class/epoch/native-copy/resources fixture':'Behavioral Android Context/Intent/Notification/PendingIntent facades; wrapper context; resource/native-copy/epoch fixtures',unexecuted:['Android OS PendingIntent dispatch','Chrome detection/enforcement','notification permission/channel delivery on phone','process restart delivery','JS current-owner membership/resume resolution','native break/expiry','signed APK/full build/store eligibility'],physicalProof:false,signedBinaryProduced:false},mode:red?'RED-live-preimage':sdk?'SDK-public-types':'GREEN',inputs:[servicePath,prefix+'FreedWebsiteRecoveryNotification.kt',prefix+'FreedWebsiteRecoveryHandoff.kt',path.relative(root,__filename)].map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')})),generated:inputs.map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')})),commands:[],host:{platform:process.platform,os:os.release(),arch:os.arch()}};
function run(command,args) {const r=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:2*1024*1024});receipt.commands.push({command,args,exit:r.status,stdout:r.stdout,stderr:r.stderr});process.stdout.write(r.stdout||'');if(r.status!==0)process.stderr.write(r.stderr||'');return r;}
if(sdk) {const jar=path.join(os.homedir(),'Library/Android/sdk/platforms/android-36/android.jar');assert.ok(fs.existsSync(jar));receipt.sdk={path:jar,sha256:createHash('sha256').update(fs.readFileSync(jar)).digest('hex')};const r=run('kotlinc',[...inputs,'-classpath',jar,'-d',path.join(work,'sdk-classes')]);receipt.passed=r.status===0;}
else {const jar=path.join(work,'cases.jar');const c=run('kotlinc',[...inputs,'-include-runtime','-d',jar]);assert.equal(c.status,0,c.stderr);receipt.binary={path:jar,sha256:createHash('sha256').update(fs.readFileSync(jar)).digest('hex')};const r=run('java',['-jar',jar]);receipt.passed=red?r.status!==0&&r.stderr.includes('Website notice must open exact manual route in one tap'):r.status===0;}
fs.writeFileSync(path.join(evidence,(red?'red':sdk?'sdk':'green')+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');assert.ok(receipt.passed,'Native test mode failed; inspect receipt.');console.log(JSON.stringify({mode:receipt.mode,passed:receipt.passed,snapshot:work,testScope:receipt.testScope}));
