const fs = require('node:fs');
const path = require('node:path');
const prior = require('./android-retained-fixture-support');
module.exports = function augment(name, body) {
  let text = prior(name, body);
  if (name === 'Context.kt') {
    text = text.replace('fun getSharedPreferences(n:String,m:Int)', 'open fun getSharedPreferences(n:String,m:Int)');
    text = text.replace('open class Context {', 'open class Context {val applicationContext get()=this;');
    text = text.replace('var commits=0', 'var failAt=0;var commitHook:(()->Unit)?=null;var commits=0');
    text = text.replace('commits++;', 'commits++;commitHook?.invoke();if(failAt==commits)failNext=true;');
  }
  if (name === 'Runtime.kt') {
    text = text.replace('object FreedAccessibilityService {', 'object FreedAccessibilityService {var delayedCleanup:(()->Boolean)?=null;fun clearOwnedRuntimeForCleanup(valid:()->Boolean):Boolean{val work={synchronized(FreedNativeUnlockStore.lock){if(!valid())false else clearOwnedRuntimeForReset()}};if(delayCleanup){delayedCleanup=work;return false};return work()};var delayCleanup=false;');
    text = text.replace('object FreedInterventionActivity {', 'object FreedInterventionActivity {fun forgetCleanupOperation(id:String){};fun clearOwnedRuntimeForCleanup(id:String,valid:()->Boolean)=synchronized(FreedNativeUnlockStore.lock){if(!valid())false else clearOwnedRuntimeForReset()};');
    text = text.replace('object FreedVpnService {','object FreedVpnService {fun forgetPrivateRuntimeHistoryIdentity(id:String){};fun capturePrivateRuntimeHistoryIdentity()="00000000-0000-4000-8000-000000000000:0";fun clearPrivateRuntimeHistoryRetainingAdult(expected:String):Boolean{clearPrivateRuntimeHistoryRetainingAdult();return true};');
    // Core behavior is a declared adapter in this session/Store fixture; separate Core fixture uses real graph.
    text += '\ninternal object FreedAdultAuthorizationExecutor {fun privateCleanupReservationLeader(ids:Set<String>):String?=null;fun privateCleanupCoverageStatus(id:String)="complete";var held=false;fun get(c:Context)=this;fun invalidateForPrivateCleanup(id:String):java.util.concurrent.Future<String> = java.util.concurrent.CompletableFuture.supplyAsync {while(held)Thread.yield();"complete"};fun privateCleanupInvalidationStatus(id:String)="complete"}\n';
  }
  if (name.endsWith('Cases.kt')) {
    // Only legacy binding setup is superseded; all policy/cap/expiry assertions remain.
    text = text.replaceAll('val scope = "[', 'var scope = "[');
    if(name==='AndroidEarnedAppTimeV2Cases.kt') {
      text=text.replace('  val expiry = started["expiresAt"]','  val expiry = started["expiresAt"]\n  scope=verifyNoHostWindow87(context,scope,expiry as String)');
      text=text.replace('  val v1Ledger = context.storage.values','  scope=verifyNoHostWindow87(context,scope,v1Granted["expiresAt"] as String)\n  val v1Ledger = context.storage.values');
    }
    text = text.replace('    val started=h.start(request);check(started["accepted"] == true && started["seconds"] == 1200L && started["effective"] == true)', '    val started=h.start(request);check(started["accepted"] == true && started["seconds"] == 1200L && started["effective"] == true)\n    h.scope=verifyNoHostWindow87(h.context,h.scope,started["expiresAt"] as String)');
    text = text.replace(/FreedAppGroupStore\.bindScope\((context|h\.context),\s*(scope|h\.scope)\)/g, 'Task87Fixture.bind($1,$2){$2=it}');
    text = text.replace(/FreedAppGroupStore\.bindScope\((context|h\.context),\s*("(?:\\.|[^"\\])*")\)/g, 'Task87Fixture.bind($1,$2){}');
  }
  return text;
};
module.exports.expo = `package expo.modules.kotlin
class AppContext {val runtime=Runtime();val registry=Registry()}
class Runtime {var installed=true;val jsiContext:Any get(){check(installed);return this}}
class Registry {val modules=mutableMapOf<String,Any>();fun getModule(name:String)=modules[name]}
`;
module.exports.shared = `package expo.modules.kotlin.sharedobjects
open class SharedObject(val context:expo.modules.kotlin.AppContext){open fun sharedObjectDidRelease(){}}
`;
module.exports.binding = `package app.freed.protection
import android.content.Context
import expo.modules.kotlin.AppContext
import org.json.JSONArray
internal object Task87Fixture {
 var sequence=0L;var lastLease:FreedPrivateModuleLease?=null
 fun retireCurrent(){lastLease?.let(FreedPrivateAccountAdmission::destroy)}
 fun bind(context:Context,raw:String,publish:(String)->Unit):Boolean {
  val app=AppContext();val identity=Any();app.registry.modules["FreedProtection"]=identity
  val lease=FreedPrivateModuleLease {app.registry.getModule("FreedProtection")===identity}
  if(!FreedPrivateAccountAdmission.create(lease))return false;lastLease=lease
  val session=FreedPrivateAccountAdmission.construct(app,lease)
  val parts=JSONArray(raw);val normalized=JSONArray().put(parts.opt(0)).put(parts.getLong(1)).toString()
  val prepared=FreedPrivateAccountAdmission.prepare(context,lease,session,normalized,java.util.UUID.randomUUID().toString(),++sequence)
  val ticket=prepared["ticket"] as? String?:return false
  val committed=FreedPrivateAccountAdmission.commit(context,lease,session,ticket)
  (committed["actionScope"] as? String)?.let(publish)
  return committed["accepted"]==true
 }
}
`;
