const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const prefix = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const source = fs.readFileSync(join(root,prefix,'FreedAccessibilityService.kt'),'utf8');
function member(marker) { const start=source.indexOf(marker);assert.ok(start>=0,marker);const brace=source.indexOf('{',start);let depth=1,quoted=false,escaped=false;
  for(let i=brace+1;i<source.length;i++){const c=source[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"'){quoted=true;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);}throw new Error(marker); }
const workspace=fs.mkdtempSync(join(tmpdir(),'freed-guard-runtime-'));
function run(command,args){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.error?.message||r.stdout+r.stderr);if(r.stdout.trim())process.stdout.write(r.stdout);}
try{
  const android=join(workspace,'Android.kt');fs.writeFileSync(android,`package android.content
interface SharedPreferences{val all:Map<String,Any?>;fun edit():Editor;interface Editor{fun putString(k:String,v:String?):Editor;fun remove(k:String):Editor;fun commit():Boolean;fun apply()}}
class MemoryPreferences:SharedPreferences{val values=mutableMapOf<String,Any?>();var failNext=false;override val all get()=values.toMap();override fun edit()=Write()
 inner class Write:SharedPreferences.Editor{val updates=mutableMapOf<String,String?>();override fun putString(k:String,v:String?)=apply{updates[k]=v};override fun remove(k:String)=apply{updates[k]=null};fun publish(){updates.forEach{(k,v)->if(v==null)values.remove(k)else values[k]=v}};override fun commit():Boolean{publish();val accepted=!failNext;failNext=false;return accepted};override fun apply(){publish()}}}
open class Context{val storage=MemoryPreferences();fun getSharedPreferences(n:String,m:Int):SharedPreferences=storage;companion object{const val MODE_PRIVATE=0}}
`);
  const fixture=join(workspace,'Runtime.kt');fs.writeFileSync(fixture,`package app.freed.protection
import android.content.Context
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
object System{var now=0L;fun currentTimeMillis()=now}
object FreedNativeUnlockStore{val lock=Any()}
object FreedInstalledApplications{fun eligible(c:Context)=FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES}
object FreedProtectionConfiguration{var enabled=true;fun interceptionEnabled(c:Context)=enabled}
object FreedAccessibilityService{const val PREFS_NAME="owned"}
internal object FreedAppScheduleStore{var configuration=FreedAppSchedulePolicy.empty;fun read(c:Context)=configuration}
object R{object string{const val freed_start_recovery=1}}
object FreedNativeCopy{fun text(c:Context,id:Int)="localized-copy"}
class Runtime:Context(){var connected=true;var interactive=true;var foreground:String?=FreedDoomscrollApps.YOUTUBE_PACKAGE;var manual=setOf(FreedDoomscrollApps.YOUTUBE_PACKAGE);var granted=false;var reached=true
 var scheduledLimitPackage:String?=FreedDoomscrollApps.YOUTUBE_PACKAGE;var lastScheduleForegroundPackage:String?=null;var launches=0;var rechecks=0
 fun ownsConnectedRuntime()=connected;fun isScreenInteractiveAndUnlocked()=interactive;fun liveScheduleForegroundPackage()=if(interactive)foreground else null
 fun blockedAppPackages()=manual;fun isManuallyBlockedApp(p:String)=p in manual;fun isDailyAppLimitReached(p:String)=reached;fun isEarnedUnlockActiveForPackage(p:String)=granted
 fun isConfiguredBlockedApp(p:String)=p in manual||p in FreedAppScheduleStore.configuration.potentialPackages
 fun cancelAppScheduleCheck(){};fun trackForegroundUsage(p:String){};fun clearShortFormSession(){}
 fun scheduleEarnedUnlockRelock(p:String){};fun cancelEarnedUnlockRelock(){};fun armAppScheduleCheck(){}
 fun currentForegroundPackage()=FreedDoomscrollApps.YOUTUBE_PACKAGE;fun dailyLimitMinutes()=5;fun currentDailyUsageMs(p:String)=if(reached)300_000L else 0L
 val handler=Handler();class Handler{var posts=0;fun removeCallbacks(r:Runnable){};fun postDelayed(r:Runnable,ms:Long){posts++}}
 fun postAppScheduleRecheck(){rechecks++};fun launchAppIntervention(p:String,reason:String=""){launches++}
${member('private val appLimitRunnable = Runnable')}
${member('private fun recheckAppSchedules()')}
${member('private fun appGuardShouldInterrupt(')}
${member('private fun scheduleAppLimitCheck(')}
${member('private fun cancelAppLimitCheck(')}
${member('private fun cancelAnyAppLimitCheck(')}
 fun deadline(){scheduledLimitPackage=FreedDoomscrollApps.YOUTUBE_PACKAGE;appLimitRunnable.run()};fun recheck(){recheckAppSchedules()}
}
fun main(){
 TimeZone.setDefault(TimeZone.getTimeZone("UTC"));fun at(s:String)=SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'",Locale.US).apply{timeZone=TimeZone.getTimeZone("UTC")}.parse(s)!!.time
 // Exercise the actual runnable and fallback scheduler together, retaining stale cached foreground.
 val deadline=Runtime();System.now=at("2026-10-05T08:59:59Z")
 deadline.foreground=null;deadline.deadline();check(deadline.launches==0&&deadline.scheduledLimitPackage==null){"An expired daily timer must not launch from cached foreground when live root is absent"}
 deadline.foreground=FreedDoomscrollApps.INSTAGRAM_PACKAGE;deadline.deadline();check(deadline.launches==0&&deadline.scheduledLimitPackage==null){"A changed live foreground cannot trigger the old target deadline"}
 deadline.foreground=FreedDoomscrollApps.YOUTUBE_PACKAGE;deadline.granted=true;deadline.deadline();check(deadline.launches==0&&deadline.scheduledLimitPackage==null){"The fallback scheduler must retain a valid matching break"}
 FreedProtectionConfiguration.enabled=false;deadline.deadline();check(deadline.launches==0);FreedProtectionConfiguration.enabled=true
 FreedAppGuardModeStore.save(deadline,"before-use");deadline.deadline();check(deadline.launches==0){"A stale daily callback cannot act after mode change"}
 FreedAppGuardModeStore.save(deadline,"daily-limit");deadline.granted=false;deadline.reached=false;deadline.deadline();check(deadline.launches==0&&deadline.handler.posts==1){"Only the real current target may arm its remaining daily deadline"}
 deadline.reached=true;deadline.deadline();check(deadline.launches==1){"An eligible live target must still interrupt at its real deadline"}
 val r=Runtime();r.storage.values.putAll(mapOf("daily-limit" to 47,"receipt-A" to "native-proof-A","receipt-B" to "native-proof-B"))
 check(FreedAppGuardModeStore.read(r)=="daily-limit")
 check(FreedAppGuardModeStore.save(r,"before-use").accepted);check(r.storage.values["daily-limit"]==47);check(r.storage.values["receipt-B"]=="native-proof-B")
 val before=r.storage.values.toMap();check(!FreedAppGuardModeStore.save(r,"invalid").accepted);check(r.storage.values==before)
 r.storage.failNext=true;check(!FreedAppGuardModeStore.save(r,"scheduled").accepted);check(r.storage.values==before){"Failed mode commit must restore only its key and preserve unrelated authority"}
 FreedProtectionConfiguration.enabled=false;check(!FreedAppGuardModeStore.save(r,"scheduled").accepted);check(r.storage.values==before);FreedProtectionConfiguration.enabled=true
 check(FreedAppGuardModeStore.save(r,"scheduled").accepted)
 r.deadline();check(r.launches==0){"An old daily deadline must reread scheduled mode before launching"};check(r.scheduledLimitPackage==null&&r.rechecks==1)
 val pkg=FreedDoomscrollApps.YOUTUBE_PACKAGE
 FreedAppScheduleStore.configuration=FreedAppSchedulePolicy.parse(mapOf("version" to 1,"schedules" to listOf(mapOf("id" to "work","enabled" to true,"startMinute" to 540,"endMinute" to 780,"days" to listOf(1),"packages" to listOf(pkg)))),"app.freed")!!
 val boundary=Runtime();FreedAppGuardModeStore.save(boundary,"scheduled");boundary.granted=true
 System.now=at("2026-10-05T08:59:59Z");boundary.recheck();check(boundary.launches==0){"An accepted old break is effective before the independent timed window begins"}
 System.now=at("2026-10-05T09:00:00Z");boundary.recheck();check(boundary.launches==1){"A live native boundary recheck must override the existing break for the same package"}
 boundary.foreground=null;boundary.recheck();check(boundary.launches==1){"Hard windows still require current live foreground evidence"}
 boundary.foreground=FreedDoomscrollApps.INSTAGRAM_PACKAGE;boundary.recheck();check(boundary.launches==1){"A timed package window cannot block a different unselected foreground package"}
 boundary.foreground=pkg;System.now=at("2026-10-05T13:00:00Z");boundary.recheck();check(boundary.launches==1){"An ended timed window stops blocking when an old break remains effective"}
 System.now=at("2026-10-05T13:00:00Z");r.recheck();check(r.launches==0){"Expired scheduled windows cannot relock a quiet foreground app due to its old daily threshold"}
 System.now=at("2026-10-05T12:59:59Z");r.recheck();check(r.launches==1)
 r.granted=true;r.recheck();check(r.launches==2){"An active timed package guard must override an old break"}
 FreedAppScheduleStore.configuration=FreedAppScheduleStore.configuration.copy(strictGuard=true);r.recheck();check(r.launches==3){"Hard strict must override a previously accepted break"}
 r.manual=emptySet();r.foreground=FreedDoomscrollApps.INSTAGRAM_PACKAGE;r.recheck();check(r.launches==4){"Independent hard strict cannot be narrowed to ordinary selected packages"}
 FreedProtectionConfiguration.enabled=false;r.recheck();check(r.launches==4);FreedProtectionConfiguration.enabled=true
 FreedAppScheduleStore.configuration=FreedAppSchedulePolicy.empty;r.manual=setOf(pkg);r.foreground=null;r.granted=false;FreedAppGuardModeStore.save(r,"before-use");r.recheck();check(r.launches==4){"Never reuse historical foreground evidence"}
 println("Android actual deadline/recheck and mode-store cases: stale timers, expired windows, strict overlap, grants, foreground, reset, confirmed persistence and rollback passed")
}
`);
  const jar=join(workspace,'cases.jar');run('kotlinc',[android,fixture,prefix+'FreedAppGuardModePolicy.kt',prefix+'FreedAppGuardModeStore.kt',prefix+'FreedAppSchedulePolicy.kt',prefix+'FreedDoomscrollApps.kt','-include-runtime','-d',jar]);run('java',['-jar',jar]);
}finally{fs.rmSync(workspace,{recursive:true,force:true});}
