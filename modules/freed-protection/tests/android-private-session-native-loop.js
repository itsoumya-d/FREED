const fs=require('node:fs');const path=require('node:path');
module.exports = function nativeLoop(root) {
 const source=fs.readFileSync(path.join(root,'modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt'),'utf8');
 const start=source.indexOf('  private fun recheckAppGroups(');const end=source.indexOf('\n  private fun isConfiguredBlockedApp(',start);
 const member=source.slice(start,end);
 return `package app.freed.protection
import android.content.Context
class LoopHandler87 {var callback:Runnable?=null;fun removeCallbacks(r:Runnable){if(callback===r)callback=null};fun postDelayed(r:Runnable,ms:Long){callback=r}}
internal class NativeLoop87(val original:Context):Context(){
 override fun getSharedPreferences(n:String,m:Int)=original.getSharedPreferences(n,m)
 private var appGroupCheckRunnable:Runnable?=null;private val handler=LoopHandler87();private val scheduleConnectionEpoch=1L
 var launches=0
 init{services.putAll(original.services)}
 private fun ownsConnectedRuntime()=true;private fun isScreenInteractiveAndUnlocked()=true;private fun liveScheduleForegroundPackage()="org.reader"
 private fun trackForegroundUsage(p:String){}
 private fun launchAppIntervention(p:String,reason:String,matchedRule:String,appGroup:Map<String,Any?>){
  launches++;val id=java.util.UUID.randomUUID().toString();val storage=getSharedPreferences(FreedAccessibilityService.PREFS_NAME,0)
  val editor=storage.edit().putString("id",id).putString("package",p).putString("rule",matchedRule)
  check(FreedAppGroupStore.issue(this,appGroup,p,id,editor));check(editor.commit())
 }
 ${member}
 fun tick()=recheckAppGroups();fun scheduled()=handler.callback!!.run();fun scheduledPresent()=handler.callback!=null
}
internal fun verifyNoHostWindow87(context:Context,scope:String,deadline:String):String {
 val oldWall=System.now;val oldElapsed=android.os.SystemClock.now
 val original=context.storage.values.toMap();val namespaces=context.namespaces.mapValues{it.value.values.toMap()}
 val cold=Context();cold.storage.values.putAll(original);namespaces.forEach{(name,values)->(cold.getSharedPreferences(name,0) as android.content.MemoryPreferences).values.putAll(values)}
 cold.services.putAll(context.services)
 Task87Fixture.retireCurrent();check(!FreedPrivateAccountAdmission.valid(scope))
 val native=NativeLoop87(cold);native.tick();check(native.launches==0 && native.scheduledPresent())
 check(FreedAppGroupStore.blockingGroup(cold,"org.reader")==null)
 check(FreedAppGroupStore.blockingGroup(cold,"org.game")!=null){"Native originating-only release must keep the other app restricted"}
 val until=java.time.Instant.parse(deadline).toEpochMilli();val delta=until-oldWall
 check(delta>0);System.now=until;android.os.SystemClock.now=oldElapsed+delta
 native.scheduled();check(native.launches==1 && native.scheduledPresent())
 check(FreedAppGroupStore.pendingScope(cold,cold.storage.all)!=null){"Actual no-host recheck must produce fresh native app intervention authority"}
 check(FreedAppGroupStore.blockingGroup(cold,"org.reader")!=null)
 System.now=oldWall;android.os.SystemClock.now=oldElapsed
 var freshScope="";check(Task87Fixture.bind(context,scope){freshScope=it})
 check(context.storage.values==original){"Same-owner native reopening changed original lease/deadline/spend/epoch"}
 println("PASS actual Accessibility recheck/Handler callback + Store producer/expiry without host; same-owner reopen preserved original deadline/spend/overlap")
 return freshScope
}
`;
};
