const fs = require('node:fs');
const {join} = require('node:path');
function privatePendingMember() {
  const source=fs.readFileSync(join(__dirname,'../android/src/main/java/app/freed/protection/FreedWebsiteRecoveryHandoff.kt'),'utf8');
  const start=source.indexOf('  fun clearPrivatePendingRetainingDevice(');const end=source.indexOf('\n  fun previewEnabled(',start);
  if(start<0||end<0)throw Error('Exact private-pending seam unavailable');
  return source.slice(start,end);
}
// Namespace-faithful OS adapters for existing actual AppGroupStore fixtures.
// Retained policy and owner cleanup logic always compile from production Kotlin.
module.exports = function augment(name, text) {
  if (name === 'Context.kt') {
    text = text.replace('fun edit():Editor', 'fun getBoolean(k:String,d:Boolean):Boolean;fun edit():Editor');
    text = text.replace('interface Editor {', 'interface Editor {fun putInt(k:String,v:Int):Editor;fun putBoolean(k:String,v:Boolean):Editor;fun clear():Editor;');
    text = text.replace('override fun edit()=Write()', 'override fun getBoolean(k:String,d:Boolean)=values[k] as? Boolean?:d;override fun edit()=Write()');
    const variable = text.includes('val writes=') ? 'writes' : 'changes';
    text = text.replace('override fun putString(k:String,v:String?)', `override fun putInt(k:String,v:Int)=apply{${variable}[k]=v};override fun putBoolean(k:String,v:Boolean)=apply{${variable}[k]=v};override fun clear()=apply{values.keys.forEach{${variable}[it]=null}};override fun putString(k:String,v:String?)`);
    text = text.replace('fun getSharedPreferences(n:String,m:Int):SharedPreferences=storage', 'val namespaces=mutableMapOf<String,MemoryPreferences>();fun getSharedPreferences(n:String,m:Int):SharedPreferences=if(n=="owned")storage else namespaces.getOrPut(n){MemoryPreferences()}');
    text = text.replace('const val MODE_PRIVATE=0;', 'const val MODE_PRIVATE=0;const val NOTIFICATION_SERVICE="notifications";');
  }
  if (name === 'Ops.kt') text += '\nclass NotificationManager {val cancelled=mutableListOf<Int>();var fail=false;fun cancel(id:Int){if(fail)throw IllegalStateException("notification-unavailable");cancelled.add(id)}}\n';
  if (name === 'Runtime.kt') {
    const accessibility = {
      APP_USAGE_PREFIX: 'app_usage_ms_', APP_USAGE_DATE_KEY: 'app_usage_date_key', LAST_FOREGROUND_PACKAGE: 'last_foreground_package',
      LAST_FOREGROUND_ELAPSED_MS: 'last_foreground_elapsed_ms', SHORT_FORM_THRESHOLD_SECONDS: 'short_form_threshold_seconds',
    };
    const fields = Object.entries(accessibility).filter(([key]) => !text.includes('const val ' + key + '=')).map(([k,v]) => `const val ${k}="${v}";`).join('');
    text = text.replace('object FreedAccessibilityService {', `object FreedAccessibilityService {${fields}var cleanupCalls=0;var cleanupAccepted=true;var cleanupHook:(()->Unit)?=null;fun clearOwnedRuntimeForReset():Boolean{cleanupCalls++;cleanupHook?.invoke();return cleanupAccepted};`);
    text = text.replace('object FreedAppScheduleStore {', 'object FreedAppScheduleStore {const val CONFIGURATION_KEY="app_schedule_configuration_v1";');
    text = text.replace('object FreedAppGuardModeStore {', 'object FreedAppGuardModeStore {const val MODE_KEY="app_guard_mode_v1";');
    const focus = 'const val FOCUS_SHIELD_RULES="focus_shield_rules_v1";const val FOCUS_SHIELD_UNLOCKS="focus_shield_unlocks_v1";';
    if (text.includes('object FreedFocusShieldRules {')) text = text.replace('object FreedFocusShieldRules {', 'object FreedFocusShieldRules {' + focus);
    else text += `\nobject FreedFocusShieldRules {${focus}}\n`;
    text += `\nobject FreedWebsiteRecoveryHandoff {data class Stamp(val owner:String);var pending:Stamp?=null;${privatePendingMember()}}\n`;
    text += '\nobject FreedInterventionActivity {var cleanupCalls=0;var cleanupAccepted=true;fun clearOwnedRuntimeForReset():Boolean{cleanupCalls++;return cleanupAccepted}}\nobject FreedVpnService {var running=true;var cleanupCalls=0;fun clearPrivateRuntimeHistoryRetainingAdult(){cleanupCalls++}}\n';
  }
  return text;
};
