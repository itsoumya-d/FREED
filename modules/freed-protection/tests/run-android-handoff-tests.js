const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '../../..');
const prefix = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
function member(text, marker) {
  const start = text.indexOf(marker); assert.ok(start >= 0, marker);
  const brace = text.indexOf('{', start); let depth = 1, quote = false, escape = false;
  for (let i = brace + 1; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') quote = false; continue; }
    if (c === '"') { quote = true; continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error('Unclosed member ' + marker);
}
const activity = fs.readFileSync(join(root, prefix, 'FreedInterventionActivity.kt'), 'utf8');
const fields = activity.slice(activity.indexOf('  private var companion:'), activity.indexOf('  override fun attachBaseContext'));
const members = ['override fun onCreate(', 'override fun onNewIntent(', 'override fun onDestroy(', 'override fun onBackPressed(',
  'private fun openRecoveryApp()', 'private fun currentIntentIsWebsite()', 'private fun dismissForConfigurationReset()', 'private fun finishCleanly()'];
let present;
if (activity.includes('private fun canPresentCurrentIntervention(): Boolean =')) {
  present = activity.slice(activity.indexOf('  private fun canPresentCurrentIntervention()'), activity.indexOf('  private fun dismissForConfigurationReset'));
} else present = member(activity, 'private fun canPresentCurrentIntervention()');
const click = activity.match(/setOnClickListener\s*\{([^{}]+)\}/); assert.ok(click, 'Real native Start recovery callback exists');
const workspace = fs.mkdtempSync(join(tmpdir(), 'freed-native-handoff-'));
function run(command, args) { const r = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, r.error?.message || r.stdout + r.stderr); if (r.stdout.trim()) process.stdout.write(r.stdout); }
try {
  const code = `package app.freed.protection
import java.lang.ref.WeakReference
class Uri(val value:String){override fun toString()=value;companion object{fun parse(v:String)=Uri(v)}}
class Intent(var action:String="") { var data:Uri?=null;val extras=mutableMapOf<String,Any?>(); var home=false
  fun getStringExtra(k:String)=extras[k] as? String
  fun getLongExtra(k:String,d:Long)=(extras[k] as? Long)?:d
  fun putExtra(k:String,v:Any?)=apply{extras[k]=v}
  fun addFlags(flags:Int)=this
  fun addCategory(category:String)=apply{home=category==CATEGORY_HOME}
  companion object { const val ACTION_VIEW="view"; const val ACTION_MAIN="main"; const val CATEGORY_HOME="home"
    const val FLAG_ACTIVITY_NEW_TASK=1;const val FLAG_ACTIVITY_CLEAR_TOP=2;const val FLAG_ACTIVITY_SINGLE_TOP=4;const val FLAG_ACTIVITY_REORDER_TO_FRONT=8 }
}
class Bundle
object Window {const val FEATURE_NO_TITLE=1}
object Build {object VERSION{const val SDK_INT=36};object VERSION_CODES{const val LOLLIPOP=21}}
object Looper {fun getMainLooper()=Unit}
class Handler(any:Any){ fun postDelayed(r:Runnable,ms:Long){jobs.add(r)};fun removeCallbacks(r:Runnable){jobs.remove(r)};companion object{val jobs=mutableListOf<Runnable>();fun drain(){val due=jobs.toList();jobs.clear();due.forEach{it.run()}}}}
class FreedNativeCompanion{fun stopMotion(){}}
object FreedWebsiteRecoveryHandoff{fun isWebsite(s:Map<String,Any?>)=s["source"]=="android-dns"||(s["rule"] as? String)?.let{r->!listOf("configured-app:","app-group:","short-form:","focus-shield:").any(r::startsWith)}==true;fun current(c:Any,s:Any,id:String?)=true}\nclass Preferences(val data:MutableMap<String,Any?>){val all get()=data;fun getString(k:String,d:String?)=(data[k] as? String)?:d}
object FreedAccessibilityService{const val PREFS_NAME="owned";const val PENDING_INTERVENTION_ID="id";const val PENDING_SOURCE_PACKAGE="source";const val PENDING_RULE="rule";const val PENDING_DETECTED_AT="at"}
object FreedProtectionConfiguration{const val INTENT_EPOCH="epoch";var enabled=true;var revision=1L;fun epoch(a:Any)=revision;fun interceptionEnabled(a:Any)=enabled}
object FreedProtectionResetPolicy{fun currentInterventionMayOpen(i:Long,c:Long,e:Boolean)=e&&i==c}
open class Platform {private var current=Intent();val intent get()=current;val packageName="app.freed.recovery";val launches=mutableListOf<Intent>();val data=mutableMapOf<String,Any?>();var finished=false
  val packageManager=Manager();class Manager{fun getLaunchIntentForPackage(p:String)=Intent("launch")}
  fun setIntent(i:Intent?){current=i?:Intent()};fun getSharedPreferences(n:String,m:Int)=Preferences(data)
  fun requestWindowFeature(v:Int){};fun setFinishOnTouchOutside(v:Boolean){};fun setContentView(v:Any){}
  fun startActivity(i:Intent){launches.add(i)};fun finish(){finished=true};fun finishAndRemoveTask(){finished=true}
  open fun onCreate(b:Bundle?){};open fun onNewIntent(i:Intent?){};open fun onDestroy(){};open fun onBackPressed(){}
  companion object {const val MODE_PRIVATE=0}
}
class FreedInterventionActivity:Platform(){companion object {const val INTERVENTION_ID_EXTRA="freed_intervention_id";val activityOwnershipLock=Any();var activeActivity=WeakReference<FreedInterventionActivity>(null)}
${fields}
${members.map(m => member(activity, m)).join('\n')}
${present}
private fun buildContentView()=Unit
fun click(){${click[1]}}
}
fun main(){
  val idA="12345678-1234-4234-8234-123456789abc";val idB="87654321-1234-4234-8234-123456789abc"
  fun fixture():FreedInterventionActivity=FreedInterventionActivity().apply{
    data.putAll(mapOf("id" to idA,"source" to "com.google.android.youtube","rule" to "configured-app:com.google.android.youtube","at" to java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").apply{timeZone=java.util.TimeZone.getTimeZone("UTC")}.format(java.util.Date())))
    setIntent(Intent().putExtra("epoch",1L).putExtra("freed_intervention_id",idA).putExtra("freed_intervention_source",data["source"]).putExtra("freed_intervention_rule",data["rule"]))
  }
  val a=fixture();a.onCreate(null);Handler.drain();check(a.launches.isEmpty()){ "Rendering native barrier must never automatically open FREED" }
  a.click();check(a.launches.count{it.action==Intent.ACTION_VIEW}==1);a.click();check(a.launches.count{it.action==Intent.ACTION_VIEW}==1)
  val b=fixture();b.onCreate(null);b.onNewIntent(b.intent);check(b.launches.isEmpty()){ "New native intent must not implicitly open FREED" }
  b.onBackPressed();check(b.launches.none{it.action==Intent.ACTION_VIEW}){ "Back must not implicitly open FREED" }
  val stale=fixture();stale.onCreate(null);stale.data["id"]=idB;stale.click();check(stale.launches.isEmpty()){ "Replaced private publication must reject stale click" }
  val reset=fixture();reset.onCreate(null);FreedProtectionConfiguration.enabled=false;reset.click();check(reset.launches.isEmpty());FreedProtectionConfiguration.enabled=true
  val epoch=fixture();epoch.onCreate(null);FreedProtectionConfiguration.revision=2;epoch.click();check(epoch.launches.isEmpty());FreedProtectionConfiguration.revision=1
  val mismatch=fixture();mismatch.onCreate(null);mismatch.data["source"]="android-dns";mismatch.click();check(mismatch.launches.isEmpty())
  val expired=fixture();expired.onCreate(null);expired.data["at"]="2020-01-01T00:00:00Z";expired.click();check(expired.launches.isEmpty())
  check(a.launches.first().data==null);check(a.launches.first().extras["freed_intervention_source"]=="com.google.android.youtube");check(a.launches.first().extras["freed_intervention_rule"]=="configured-app:com.google.android.youtube")
  val website=fixture();website.data["source"]="android-dns";website.data["rule"]="adult-seed";website.intent.putExtra("freed_intervention_source","android-dns").putExtra("freed_intervention_rule","adult-seed").putExtra("freed_intervention_url","https://private.example.xxx").putExtra("freed_intervention_host","private.example.xxx");website.onCreate(null);check(website.launches.isEmpty());website.click();check(website.launches.single().data.toString()=="freed://guided-reset"){"Website tap must route exact manual recovery URI"};check(website.launches.single().extras.isEmpty()){ "Website manual route must forward no private context" }
  val browser=fixture();browser.data["source"]="com.android.chrome";browser.data["rule"]="adult-seed";browser.intent.putExtra("freed_intervention_source","com.android.chrome").putExtra("freed_intervention_rule","adult-seed");browser.onCreate(null);browser.click();check(browser.launches.single().data.toString()=="freed://guided-reset");check(browser.launches.single().extras.isEmpty())
  val replacedWebsite=fixture();replacedWebsite.data["source"]="android-dns";replacedWebsite.data["rule"]="adult-seed";replacedWebsite.intent.putExtra("freed_intervention_source","android-dns").putExtra("freed_intervention_rule","adult-seed");replacedWebsite.onCreate(null);replacedWebsite.data["id"]=idB;replacedWebsite.click();check(replacedWebsite.launches.singleOrNull()?.data.toString()=="freed://guided-reset"){"A validated visible website may manually recover after replacement"};check(replacedWebsite.launches.single().extras.isEmpty())
  val group=fixture();group.data["rule"]="app-group:daily:1";group.intent.putExtra("freed_intervention_rule","app-group:daily:1");group.onCreate(null);group.click();check(group.launches.single().data==null);check(group.launches.single().extras["freed_intervention_rule"]=="app-group:daily:1")
  println("Native Android handoff: rendering/new-intent/back never auto-open; explicit exact fresh click, duplicate, replacement, reset, epoch, source and expiry; exact website manual URI/no private payload and selected-app/group preservation passed")
}
`;
  const input = join(workspace, 'Handoff.kt'); fs.writeFileSync(input, code);
  const jar = join(workspace, 'cases.jar'); const files = [input];
  const policy = join(root, prefix, 'FreedInterventionHandoffPolicy.kt'); if (fs.existsSync(policy)) files.push(policy);
  run('kotlinc', [...files, '-include-runtime', '-d', jar]);run('java',['-jar',jar]);process.stdout.write('Harness JAR SHA-256: '+createHash('sha256').update(fs.readFileSync(jar)).digest('hex')+'\n');
} finally {fs.rmSync(workspace,{recursive:true,force:true});}
