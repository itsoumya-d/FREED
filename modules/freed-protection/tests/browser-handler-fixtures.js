// Android I/O boundary fixtures shared by the real browser adapter and Task21 runner.
const { join } = require('node:path');
exports.nativeFiles = ['FreedBrowserHandlerPolicy.kt', 'FreedBrowserHandlerCache.kt', 'FreedBrowserHandlers.kt', 'FreedInstalledAppPolicy.kt'];
exports.contextMembers = `
 var registrationFails=false;var unregistrationFails=false;var registrations=0;var unregistrations=0;var receiverFlags:Int?=null
 var registeredReceiver:BroadcastReceiver?=null;var registeredFilter:IntentFilter?=null
 fun registerReceiver(r:BroadcastReceiver,f:IntentFilter):Intent? {if(registrationFails)throw SecurityException();registrations++;registeredReceiver=r;registeredFilter=f;return null}
 fun registerReceiver(r:BroadcastReceiver,f:IntentFilter,flags:Int):Intent? {receiverFlags=flags;return registerReceiver(r,f)}
 fun unregisterReceiver(r:BroadcastReceiver){unregistrations++;registeredReceiver=null;if(unregistrationFails)throw IllegalArgumentException()}
 fun getSystemService(n:String):Any?=null
 fun broadcast(action:String, allegedPackage:String="ignored.example") {registeredReceiver?.onReceive(this,Intent(action,android.net.Uri.parse("package:"+allegedPackage)))}
`;
exports.contextConstants = 'const val RECEIVER_NOT_EXPORTED=4;const val TELECOM_SERVICE="telecom";';
exports.packageManager = `package android.content.pm
import android.content.Intent
class Metadata{val flags=mutableMapOf<String,Boolean>();fun getBoolean(k:String,d:Boolean)=flags[k]?:d}
class ApplicationInfo {companion object{const val FLAG_DEBUGGABLE=2};var flags=0;var metaData:Metadata?=Metadata();var enabled=true;var packageName=""}
class ActivityInfo {var packageName="";var name="WebActivity";var enabled=true;var exported=true;var applicationInfo:ApplicationInfo?=null}
class ResolveInfo {var activityInfo:ActivityInfo?=null;var filter:android.content.IntentFilter?=null}
class PackageManager(val info:ApplicationInfo=ApplicationInfo()) {
 var failed=false;var queryFails=false;var failingScheme:String?=null;var settingFails=false;var appState=mutableMapOf<String,Int>();var componentState=mutableMapOf<String,Int>()
 var http=listOf<ResolveInfo>();var https=listOf<ResolveInfo>();var safety=listOf<ResolveInfo>();val queries=mutableListOf<Intent>();var onQuery:(()->Unit)?=null
 fun getLaunchIntentForPackage(p:String)=app.freed.protection.Intent("launch")
 fun getApplicationInfo(p:String,f:Int):ApplicationInfo{if(failed)throw SecurityException();return info}
 fun queryIntentActivities(i:Intent,flags:Int):List<ResolveInfo> {onQuery?.invoke();queries.add(i);check(flags==GET_RESOLVED_FILTER);if(queryFails||(failingScheme!=null&&i.data?.scheme==failingScheme))throw SecurityException();return when(i.data?.scheme){"http"->http;"https"->https;else->safety}}
 fun getApplicationEnabledSetting(p:String):Int {if(settingFails)throw SecurityException();return appState[p]?:0}
 fun getComponentEnabledSetting(c:android.content.ComponentName):Int {if(settingFails)throw SecurityException();return componentState[c.packageName]?:0}
 companion object{const val GET_META_DATA=128;const val GET_RESOLVED_FILTER=64;const val COMPONENT_ENABLED_STATE_DISABLED=2;const val COMPONENT_ENABLED_STATE_DISABLED_USER=3;const val COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED=4}
}
fun webHandler(p:String,general:Boolean=true,enabled:Boolean=true,exported:Boolean=true,appEnabled:Boolean=true):ResolveInfo=ResolveInfo().apply{filter=android.content.IntentFilter().apply{addAction(Intent.ACTION_VIEW);addCategory(Intent.CATEGORY_BROWSABLE);addDataScheme("http");addDataScheme("https");if(!general)addDataAuthority("only.example",null)};activityInfo=ActivityInfo().apply{packageName=p;this.enabled=enabled;this.exported=exported;applicationInfo=ApplicationInfo().apply{packageName=p;this.enabled=appEnabled}}}
`;
exports.clock = `package android.os
object SystemClock {var now=100_000L;fun elapsedRealtime()=now}
object Build {object VERSION {var SDK_INT=36};object VERSION_CODES {const val O=26;const val TIRAMISU=33}}
object Looper {fun getMainLooper()=Unit}
class Handler(a:Any=Unit){
 fun post(callback:()->Unit):Boolean{jobs.add(callback);return true};fun post(r:Runnable)=post{r.run()}
 fun postDelayed(r:Runnable,delay:Long):Boolean{delayed.add(SystemClock.now+delay to r);return true}
 fun removeCallbacks(r:Runnable){delayed.removeAll{it.second===r}}
 companion object {val jobs=java.util.Collections.synchronizedList(mutableListOf<()->Unit>());val delayed=mutableListOf<Pair<Long,Runnable>>()
 fun drain(){val due=synchronized(jobs){jobs.toList().also{jobs.clear()}};due.forEach{it()}}
 fun tick(){val due=delayed.filter{it.first<=SystemClock.now};delayed.removeAll(due.toSet());due.forEach{it.second.run()};drain()}}
}
`;
exports.install = function(write, files) {
  files.push(write('BrowserIntent.kt', `package android.content
class ComponentName(val packageName:String,val className:String)
open class BroadcastReceiver {open fun onReceive(context:Context?,intent:Intent?) {}}
class IntentFilter {val actions=mutableSetOf<String>();val schemes=mutableSetOf<String>();val categories=mutableSetOf<String>();var authorities=0;var paths=0;var specificParts=0;var types=0
 fun addAction(a:String){actions.add(a)};fun addCategory(c:String){categories.add(c)};fun addDataScheme(s:String){schemes.add(s)};fun addDataAuthority(h:String,p:String?){authorities++};fun addDataPath(p:String,m:Int){paths++};fun addDataSchemeSpecificPart(p:String,m:Int){specificParts++};fun addDataType(t:String){types++}
 fun hasAction(a:String)=a in actions;fun hasCategory(c:String)=c in categories;fun hasDataScheme(s:String)=s in schemes;fun countDataAuthorities()=authorities;fun countDataPaths()=paths;fun countDataSchemeSpecificParts()=specificParts;fun countDataTypes()=types}
class Intent(var action:String="",var data:android.net.Uri?=null) {val categories=mutableSetOf<String>();fun addCategory(c:String)=apply{categories.add(c)}
 companion object {const val ACTION_VIEW="android.intent.action.VIEW";const val CATEGORY_BROWSABLE="android.intent.category.BROWSABLE";const val ACTION_MAIN="main";const val CATEGORY_HOME="home";const val ACTION_DIAL="dial";const val ACTION_SENDTO="sendto";const val ACTION_PACKAGE_ADDED="added";const val ACTION_PACKAGE_REMOVED="removed";const val ACTION_PACKAGE_CHANGED="changed";const val ACTION_PACKAGE_REPLACED="replaced";const val ACTION_PACKAGE_FULLY_REMOVED="fully-removed"}}
`));
  files.push(write('BrowserUri.kt', `package android.net
class Uri(val value:String) {val scheme get()=value.substringBefore(':');override fun toString()=value;companion object{fun parse(v:String)=Uri(v)}}
`));
  files.push(write('BrowserSafety.kt', `package android.provider
object Settings {const val ACTION_SETTINGS="settings"}
object Telephony {object Sms {var packageName:String?=null;fun getDefaultSmsPackage(c:android.content.Context)=packageName}}
`));
  files.push(write('BrowserTelecom.kt', `package android.telecom
class TelecomManager {var defaultDialerPackage:String?=null}
`));
};
exports.production = native => exports.nativeFiles.map(file => join(native, file));
