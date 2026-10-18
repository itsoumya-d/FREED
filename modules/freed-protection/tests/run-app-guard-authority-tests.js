// Executes production module grant/getter/status and service lease authority members with local platform adapters.
// Existing NativeUnlockStore JVM cases independently exercise private-ID, freshness, replay and atomic receipt proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const prefix = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
const moduleSource = fs.readFileSync(join(root, prefix, 'FreedProtectionModule.kt'), 'utf8');
const serviceSource = fs.readFileSync(join(root, prefix, 'FreedAccessibilityService.kt'), 'utf8');
function member(source, marker) {
  const start = source.indexOf(marker); assert.ok(start >= 0, marker);
  const brace = source.indexOf('{', start); let depth = 1, quoted = false, escaped = false;
  for (let i = brace + 1; i < source.length; i++) {
    const c = source[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(marker);
}
const getter = marker => member(moduleSource, marker);
const grant = member(moduleSource, 'AsyncFunction("applyEarnedUnlockWindow")').replace(
  'AsyncFunction("applyEarnedUnlockWindow") { expiresAt: String, sourceAttemptHost: String?, nativeInterventionId: String? ->',
  'fun grant(expiresAt: String, sourceAttemptHost: String?, nativeInterventionId: String?): Map<String, Any> { return run authority@ {'
).replaceAll('return@AsyncFunction', 'return@authority') + '}';
const workspace = fs.mkdtempSync(join(tmpdir(), 'freed-guard-authority-'));
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  if (result.stdout.trim()) process.stdout.write(result.stdout);
}
try {
  const android = join(workspace, 'Android.kt');
  fs.writeFileSync(android, `package android.content
interface SharedPreferences { fun getString(k:String,d:String?):String?;fun edit():Editor;interface Editor {fun putString(k:String,v:String?):Editor;fun remove(k:String):Editor;fun apply()} }
class MemoryPreferences:SharedPreferences {val values=mutableMapOf<String,String?>();override fun getString(k:String,d:String?)=values[k]?:d;override fun edit()=Write()
 inner class Write:SharedPreferences.Editor {override fun putString(k:String,v:String?)=apply{values[k]=v};override fun remove(k:String)=apply{values.remove(k)};override fun apply(){} } }
open class Context {val packageName="app.freed";open val storage=MemoryPreferences();fun getSharedPreferences(n:String,m:Int):SharedPreferences=storage;companion object {const val MODE_PRIVATE=0} }
`);
  const fixture = join(workspace, 'Authority.kt');
  fs.writeFileSync(fixture, `package app.freed.protection
import android.content.Context
import android.content.SharedPreferences
import java.util.Locale
import java.time.Instant
object System {var now=0L;fun currentTimeMillis()=now}
fun parseIsoMillis(s:String):Long?=try {Instant.parse(s).toEpochMilli()}catch(e:Exception){null}
fun formatIsoMillis(t:Long)=Instant.ofEpochMilli(t).toString()
object FreedAccessibilityService {const val PREFS_NAME="owned";const val EARNED_UNLOCK_EXPIRES_AT="expiry";const val EARNED_UNLOCK_SOURCE_PACKAGE="source";const val MAX_EARNED_UNLOCK_MINUTES=15;const val MODE_PRIVATE=0}
internal object FreedAppScheduleStore {var configuration=FreedAppSchedulePolicy.empty;fun read(c:Context)=configuration;fun snapshot(c:Context)=FreedAppSchedulePolicy.evaluate(configuration,System.now)}
object FreedInstalledAppPolicy {fun validPackage(s:String)=s.matches(Regex("^[a-z][a-z0-9_]*(\\\\.[a-z][a-z0-9_]*)+$"))}
object FreedInstalledApplications {fun eligible(c:Context)=FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES}
object FreedAppGroupStore {fun blockingGroup(c:Context,p:String):Map<String,Any?>?=null;fun fulfill(c:Context,id:String?,target:String,expiry:Long):Map<String,Any?>?=null}
object FreedVpnService {var isRunning=true}
object FreedProtectionConfiguration {var enabled=true;fun interceptionEnabled(c:Context)=enabled}
internal object FreedNativeUnlockStore {
 val lock=Any();var calls=0;var nativeId="native-ID-A";var nativePackage=FreedDoomscrollApps.YOUTUBE_PACKAGE
 data class Authority(val expiresAtMs:Long,val firstFulfillment:Boolean=true)
 fun fulfill(c:Context,id:String?,p:String,r:String?,expiry:Long):Authority? {calls++;if(id!=nativeId||p!=nativePackage)return null
  c.storage.values.putAll(mapOf("proof-id" to id,"proof-pkg" to p,"proof-exp" to expiry.toString(),"expiry" to formatIsoMillis(expiry),"source" to p));return Authority(expiry)}
 fun hasActivePackageGrant(c:Context,p:String,e:Long,id:String?=null)=FreedProtectionConfiguration.enabled&&e>System.now&&c.storage.values["proof-pkg"]==p&&c.storage.values["proof-exp"]==e.toString()&&(id==null||c.storage.values["proof-id"]==id)
 fun clearPackageReceipt(e:SharedPreferences.Editor){e.remove("proof-id").remove("proof-pkg").remove("proof-exp")}
}
class AppContext(var reactContext:Context?)
class Module(val context:Context) {
 val appContext=AppContext(context);val SUPPORTED_BLOCKED_APP_PACKAGES=FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES
 fun isAccessibilityServiceEnabled(c:Context)=true;fun isUsageStatsAuthorized(c:Context)=true;fun isVpnConsentRequired(c:Context)=false;fun androidSettingsRoutes()=emptyList<String>();fun configuredBlockedPackages(c:Context)=listOf(FreedDoomscrollApps.YOUTUBE_PACKAGE,FreedDoomscrollApps.INSTAGRAM_PACKAGE)
 fun sanitizedPendingInterventionId(s:String?)=s?.takeIf{it.startsWith("native-ID-")}
 fun statusPayload(authorized:Boolean,active:Boolean,mode:String,message:String,adultFilterActive:Boolean?=null,appInterventionAuthorized:Boolean?=null,usageStatsAuthorized:Boolean?=null,vpnConsentRequired:Boolean?=null,androidSettingsRoutes:List<String>?=null,activeUnlockExpiresAt:String?=null,activeUnlockSourcePackage:String?=null):Map<String,Any> = mutableMapOf<String,Any>("adultFilterActive" to (adultFilterActive?:false)).apply {
  activeUnlockExpiresAt?.let{put("activeUnlockExpiresAt",it)};activeUnlockSourcePackage?.let{put("activeUnlockSourcePackage",it)} }
 fun statusPayloadWithAndroidDiagnostics(c:Context,p:Map<String,Any>):Map<String,Any> = ${moduleSource.includes('suppressBreakEvidenceWhileHardGuarded') ? 'suppressBreakEvidenceWhileHardGuarded' : 'suppressBreakEvidenceWhileStrict'}(c,p.toMutableMap().apply {
  activeEarnedUnlockExpiresAt(c)?.let{put("activeUnlockExpiresAt",it)};activeUnlockSourcePackage(c)?.let{put("activeUnlockSourcePackage",it);c.storage.values["proof-id"]?.let{id->put("activeUnlockInterventionId",id)}} })
${getter('private fun activeEarnedUnlockExpiresAt(')}
${getter('private fun activeUnlockSourcePackage(')}
${getter('private fun storedEarnedUnlockSourcePackage(')}
${getter('private fun clearEarnedUnlockPrefs(context:')}
${getter(moduleSource.includes('private fun suppressBreakEvidenceWhileHardGuarded') ? 'private fun suppressBreakEvidenceWhileHardGuarded' : 'private fun suppressBreakEvidenceWhileStrict')}
${moduleSource.includes('private fun hardAppGuardActive(') ? getter('private fun hardAppGuardActive(') : ''}
${grant}
 fun status()=statusPayloadWithAndroidDiagnostics(context,emptyMap())
 fun surfaceStatus(p:String)= ${moduleSource.includes('suppressBreakEvidenceWhileHardGuarded') ? 'suppressBreakEvidenceWhileHardGuarded' : 'suppressBreakEvidenceWhileStrict'}(context,mapOf("activeFocusShieldUnlockPackageName" to p,"activeFocusShieldUnlockExpiresAt" to "expiry","activeFocusShieldUnlockRuleId" to "rule","activeFocusShieldUnlockInterventionId" to "native-ID-surface"))
}
class Service(val context:Context):Context() {
 override val storage get()=context.storage
 val PREFS_NAME="owned";val MODE_PRIVATE=0;val EARNED_UNLOCK_EXPIRES_AT="expiry";val EARNED_UNLOCK_SOURCE_PACKAGE="source";val SUPPORTED_BLOCKED_APP_PACKAGES=FreedDoomscrollApps.SUPPORTED_BLOCKED_APP_PACKAGES
 // Supply the same local persistence as the module to the unmodified production service getter.
${member(serviceSource,'private fun isEarnedUnlockActiveForPackage(').replace('getSharedPreferences(PREFS_NAME, MODE_PRIVATE)','context.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)')}
${member(serviceSource,'private fun clearEarnedUnlockPrefs(prefs:')}
${member(serviceSource,'private fun earnedUnlockSourcePackage(')}
 fun effective(p:String)=isEarnedUnlockActiveForPackage(p)
}
fun main() {
 val failures=mutableListOf<String>()
 fun expect(condition:Boolean,message:()->String={"Unlabelled authority assertion"}) {if(!condition)failures.add(message())}
 fun at(s:String)=Instant.parse(s).toEpochMilli()
 val youtube=FreedDoomscrollApps.YOUTUBE_PACKAGE;val instagram=FreedDoomscrollApps.INSTAGRAM_PACKAGE
 java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("UTC"));System.now=at("2026-10-05T08:59:00Z")
 val c=Context();val module=Module(c);val service=Service(c);val expiry=at("2026-10-05T09:04:00Z")
 expect(module.grant(formatIsoMillis(expiry),youtube,"native-ID-A")["nativeUnlockGrantAccepted"]==true);expect(service.effective(youtube));val saved=c.storage.values.toMap()
 fun window(p:String)=FreedAppSchedulePolicy.parse(mapOf("version" to 1,"schedules" to listOf(mapOf("id" to "sleep","enabled" to true,"startMinute" to 540,"endMinute" to 542,"days" to listOf(1),"packages" to listOf(p)))),"app.freed")!!
 FreedAppScheduleStore.configuration=window(youtube);System.now=at("2026-10-05T09:00:00Z")
 expect(!service.effective(youtube)){"Actual service must suppress a still-valid old lease inside its matching timed package window"}
 expect(module.status().keys.none{it.startsWith("activeUnlock")}){"Actual module status must hide expiry/source/exact ID while the matching hard window is active"}
 expect(module.surfaceStatus(youtube).isEmpty()){"Matching surface evidence must be suppressed by its package hard guard"};expect(module.surfaceStatus(instagram).size==4){"An unrelated surface package receipt must remain visible"}
 expect(c.storage.values==saved){"Hard windows must leave the original receipt and expiry intact"}
 val priorCalls=FreedNativeUnlockStore.calls
 expect(module.grant(formatIsoMillis(expiry),youtube,"native-ID-A")["nativeUnlockGrantAccepted"]==false){"Actual new grant acknowledgment must reject an active matching hard window"}
 expect(FreedNativeUnlockStore.calls==priorCalls&&c.storage.values==saved){"A new grant inside the hard window must never reach native fulfillment or change any receipt"}
 FreedAppScheduleStore.configuration=window(instagram);expect(service.effective(youtube));expect(module.status()["activeUnlockInterventionId"]=="native-ID-A"){"Unrelated timed package cannot suppress matching native proof"}
 FreedAppScheduleStore.configuration=window(youtube);System.now=at("2026-10-05T09:02:00Z");expect(service.effective(youtube));expect(module.status()["activeUnlockExpiresAt"]==formatIsoMillis(expiry));expect(c.storage.values==saved)
 System.now=expiry;expect(!service.effective(youtube));expect(module.status().keys.none{it.startsWith("activeUnlock")}){"Window ending must never revive an expired receipt"}
 FreedAppScheduleStore.configuration=FreedAppSchedulePolicy.empty;System.now=at("2026-10-05T10:00:00Z")
 val rejects=listOf("youtube.com","https://youtube.com/watch?v=1","adult","category:adult","com.google.android.youtube.invalid");val beforeInvalid=c.storage.values.toMap();val calls=FreedNativeUnlockStore.calls
 rejects.forEach{expect(module.grant(formatIsoMillis(System.now+60_000),it,"native-ID-A")["nativeUnlockGrantAccepted"]!=true)};expect(FreedNativeUnlockStore.calls==calls&&c.storage.values==beforeInvalid){"Web/category inputs must never reach package authority"}
 expect(module.grant(formatIsoMillis(System.now+60_000),youtube,"native-ID-wrong")["nativeUnlockGrantAccepted"]==false)
 check(failures.isEmpty()){failures.joinToString(" | ")}
 println("Actual module/service package authority cases passed: prior lease, timed boundary, new grant refusal, exact status proof, unrelated scope, unchanged expiry, expiry, invalid source and wrong ID")
}
`);
  const jar = join(workspace, 'cases.jar');
  run('kotlinc', [android, fixture, prefix + 'FreedAppGuardModePolicy.kt', prefix + 'FreedAppSchedulePolicy.kt', prefix + 'FreedDoomscrollApps.kt', '-include-runtime', '-d', jar]);
  run('java', ['-jar', jar]);
} finally { fs.rmSync(workspace, { recursive: true, force: true }); }
