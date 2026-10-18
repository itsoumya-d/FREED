// Execute production PackageManager projection, cache/lifecycle and focused extraction at Android I/O boundaries.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fixtures = require('./browser-handler-fixtures');
const root = resolve(__dirname, '../../..');
const native = join(root, 'modules/freed-protection/android/src/main/java/app/freed/protection');
const service = fs.readFileSync(join(native, 'FreedAccessibilityService.kt'), 'utf8');
function member(marker) {
  const start = service.indexOf(marker); assert.ok(start >= 0, marker);
  const brace = service.indexOf('{', start); let depth = 1, quoted = false, escaped = false;
  for (let i = brace + 1; i < service.length; i++) {
    const c = service[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') { quoted = true; continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) return service.slice(start, i + 1);
  }
  throw Error(marker);
}
const gate = service.split('\n').find(line => line.includes('!isWebViewContext(accessibilityEvent)') && line.includes('return'));
assert.ok(gate);
const work = fs.mkdtempSync(join(tmpdir(), 'freed-browser-handlers-'));
function write(name, text) { const path = join(work, name); fs.writeFileSync(path, text); return path; }
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 180000 });
  process.stdout.write(result.stdout || '');
  assert.equal(result.status, 0, result.error?.message || result.stderr);
}
try {
  const files = [];
  files.push(write('Context.kt', `package android.content
open class Context {val packageName="app.freed.recovery";val packageManager=android.content.pm.PackageManager();${fixtures.contextMembers}
 companion object {${fixtures.contextConstants}}}
`));
  files.push(write('Pm.kt', fixtures.packageManager));
  files.push(write('Clock.kt', fixtures.clock));
  fixtures.install(write, files);
  files.push(write('Nodes.kt', `package android.view.accessibility
class AccessibilityNodeInfo {var text:CharSequence?=null;var className:CharSequence?=null;var contentDescription:CharSequence?=null;var hintText:CharSequence?=null;var viewIdResourceName:String?=null;var isEditable=false;var isFocused=false;var isAccessibilityFocused=false
 val children=mutableListOf<AccessibilityNodeInfo>();val childCount get()=children.size;fun getChild(i:Int)=children[i];fun findAccessibilityNodeInfosByViewId(id:String):List<AccessibilityNodeInfo> = (if(viewIdResourceName==id)listOf(this)else emptyList())+children.flatMap{it.findAccessibilityNodeInfosByViewId(id)}}
class AccessibilityEvent {var className:CharSequence?=null;var source:AccessibilityNodeInfo?=null;var eventType=1;var text:List<CharSequence?>?=emptyList();companion object{const val TYPE_VIEW_TEXT_CHANGED=16}}
`));
  const hintsStart = service.indexOf('  private val browserUrlViewIds =');
  const hintsEnd = service.indexOf('  private var lastLaunchElapsedMs', hintsStart);
  assert.ok(hintsStart >= 0 && hintsEnd > hintsStart);
  const extraction = ['  private fun extractUrlCandidates(', '  private fun isWebViewContext(', '  private fun containsWebViewNode(', '  private fun shouldTrustEventText(', '  private fun collectLikelyFocusedUrlText(', '  private fun shouldCollectFocusedCandidateText(', '  private fun sourceIsKnownBrowserUrlField(', '  private fun nodeLooksLikeUrlOrSearchField(', '  private fun looksLikeBoundedFocusedSearchText(', '  private fun looksLikeUrlOrSearch('].map(member).join('\n');
  files.push(write('Extraction.kt', `package app.freed.protection
import android.os.Build
import android.view.accessibility.*
import java.util.Locale
class Intent(val action:String)
object FreedNativeUnlockStore {val lock=Any()}
internal class ExtractionService(val eligibleWebHandlers:FreedBrowserHandlers) {
 var rootInActiveWindow:AccessibilityNodeInfo?=null
 ${service.slice(hintsStart, hintsEnd)}
 ${extraction}
 fun read(normalizedPackage:String,accessibilityEvent:AccessibilityEvent):List<String> {${gate.replace(/return\s*$/, 'return emptyList()')};return extractUrlCandidates(normalizedPackage,accessibilityEvent)}
}
`));
  files.push(write('Cases.kt', `package app.freed.protection
import android.content.Context
import android.content.Intent as AndroidIntent
import android.content.pm.*
import android.os.*
import android.view.accessibility.*
fun main() {
 val arbitrary="dev.future.browser";val other="org.independent.navigator";val c=Context();val pm=c.packageManager
 val pending=mutableListOf<Runnable>()
 val cache=FreedBrowserHandlers(c,Handler(),{pending.add(it)})
 fun runQuery(){check(pending.size==1);pending.removeAt(0).run();Handler.drain()}
 fun both(vararg entries:ResolveInfo){pm.http=entries.toList();pm.https=entries.toList()}
 pm.onQuery={check(!Thread.holdsLock(FreedNativeUnlockStore.lock)){"Package queries must stay outside native enforcement lock"}}
 both(webHandler(arbitrary),webHandler(arbitrary),webHandler(other),webHandler("app.freed.recovery"),webHandler("android"),webHandler("com.android.intentresolver"),webHandler("com.android.settings"),webHandler("bad/identifier"),webHandler("DEV.UPPERCASE"),webHandler("org.domain.links",false),webHandler("org.disabled.activity",enabled=false),webHandler("org.private.activity",exported=false),webHandler("org.disabled.app",appEnabled=false),webHandler("org.safety.home"))
 val mismatch=webHandler("org.mismatched.app").apply{activityInfo!!.applicationInfo!!.packageName="org.different.app"}
 val noApp=webHandler("org.missing.app").apply{activityInfo!!.applicationInfo=null}
 val pathSpecific=webHandler("org.path.links").apply{filter!!.addDataPath("/only",0)}
 val partSpecific=webHandler("org.part.links").apply{filter!!.addDataSchemeSpecificPart("only",0)}
 val mimeSpecific=webHandler("org.mime.links").apply{filter!!.addDataType("text/html")}
 val noFilter=webHandler("org.unknown.filter").apply{filter=null}
 val noBrowsable=webHandler("org.not.browsable").apply{filter!!.categories.clear()}
 val noView=webHandler("org.not.view").apply{filter!!.actions.clear()}
 val onlyHttpsFilter=webHandler("org.false.http").apply{filter!!.schemes.remove("http")}
 val restricted=listOf(mismatch,noApp,pathSpecific,partSpecific,mimeSpecific,noFilter,noBrowsable,noView,onlyHttpsFilter,ResolveInfo())
 pm.safety=listOf(webHandler("org.safety.home"));pm.http=pm.http+webHandler("org.http.only")+restricted;pm.https=pm.https+webHandler("org.https.only")+restricted
 cache.connect();check(c.registrations==1&&c.receiverFlags==Context.RECEIVER_NOT_EXPORTED);check(c.registeredFilter!!.schemes==setOf("package"));check(c.registeredFilter!!.actions.size==5)
 check(!cache.contains(arbitrary)&&cache.snapshot().state==FreedBrowserHandlerCache.State.REFRESHING);runQuery();check(cache.contains(arbitrary)&&cache.contains(other));check(cache.snapshot().packages==setOf(arbitrary,other))
 val web=pm.queries.filter{it.data?.scheme in setOf("http","https")};check(web.size==2);check(web.map{it.data.toString()}==listOf("http://example.invalid/","https://example.invalid/"));check(web.all{it.action==AndroidIntent.ACTION_VIEW&&it.categories==setOf(AndroidIntent.CATEGORY_BROWSABLE)})
 val initialQueries=pm.queries.size;repeat(2000){cache.contains("unknown.app");cache.contains(arbitrary)};check(pm.queries.size==initialQueries&&pending.isEmpty())
 c.registeredReceiver!!.onReceive(c,AndroidIntent(AndroidIntent.ACTION_PACKAGE_ADDED,android.net.Uri.parse("https://not-a-package/")));check(cache.contains(arbitrary)&&pending.isEmpty())
 val extraction=ExtractionService(cache)
 fun field(text:String,focused:Boolean=true,editable:Boolean=true,id:String="dev.future.browser:id/address_input")=AccessibilityNodeInfo().apply{this.text=text;isFocused=focused;isEditable=editable;viewIdResourceName=id;className="android.widget.EditText"}
 val event=AccessibilityEvent();extraction.rootInActiveWindow=field("https://adult.example.xxx");check(extraction.read(arbitrary,event)==listOf("https://adult.example.xxx"))
 extraction.rootInActiveWindow=field("adult.example.xxx",false,false,"page_body").apply{className="android.widget.TextView"};check(extraction.read(arbitrary,event).isEmpty())
 extraction.rootInActiveWindow=field("adult.example.xxx",false,false,"search_label").apply{className="android.widget.TextView"};check(extraction.read(arbitrary,event).isEmpty())
 extraction.rootInActiveWindow=field("adult.example.xxx");check(extraction.read("org.unrelated.app",event).isEmpty())
 extraction.rootInActiveWindow=null;event.text=listOf("adult.example.xxx");check(extraction.read(arbitrary,event).isEmpty())
 event.eventType=AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED;event.source=field("",id="dev.future.browser:id/search_box");event.text=listOf("bounded focused search");check(extraction.read(arbitrary,event)==listOf("bounded focused search"));event.source=field("",false,false,"search_label");check(extraction.read(arbitrary,event).isEmpty())
 event.text=emptyList();event.source=null;extraction.rootInActiveWindow=AccessibilityNodeInfo().apply{var n=this;repeat(7){val child=AccessibilityNodeInfo();n.children.add(child);n=child};n.children.add(field("adult.example.xxx"))};check(extraction.read(arbitrary,event).isEmpty())
 extraction.rootInActiveWindow=field("adult.example.xxx").apply{className="android.webkit.WebView"};check(extraction.read("org.embedded.app",event)==listOf("adult.example.xxx"))
 extraction.rootInActiveWindow=field("chrome.example.xxx",false,false,"com.android.chrome:id/url_bar");both(webHandler("com.android.chrome"));c.broadcast(AndroidIntent.ACTION_PACKAGE_REPLACED);runQuery();check(extraction.read("com.android.chrome",event)==listOf("chrome.example.xxx"))
 both(webHandler(arbitrary));c.broadcast(AndroidIntent.ACTION_PACKAGE_ADDED,"org.fake.extra");check(!cache.contains("com.android.chrome")&&!cache.contains("org.fake.extra"));runQuery();check(cache.contains(arbitrary))
 both();c.broadcast(AndroidIntent.ACTION_PACKAGE_REMOVED,arbitrary);check(!cache.contains(arbitrary));runQuery();check(!cache.contains(arbitrary)&&cache.snapshot().state==FreedBrowserHandlerCache.State.READY)
 for(state in listOf(2,3,4)){both(webHandler(arbitrary));pm.appState[arbitrary]=state;c.broadcast(AndroidIntent.ACTION_PACKAGE_CHANGED);runQuery();check(!cache.contains(arbitrary))};pm.appState.clear()
 both(webHandler(arbitrary));pm.componentState[arbitrary]=2;c.broadcast(AndroidIntent.ACTION_PACKAGE_CHANGED);runQuery();check(!cache.contains(arbitrary));pm.componentState.clear()
 c.broadcast(AndroidIntent.ACTION_PACKAGE_REPLACED);repeat(100){c.broadcast(AndroidIntent.ACTION_PACKAGE_REMOVED)};check(pending.size==1);runQuery();check(cache.snapshot().state==FreedBrowserHandlerCache.State.REFRESHING&&pending.size==1);runQuery();check(cache.contains(arbitrary))
 both(webHandler(other));c.broadcast(AndroidIntent.ACTION_PACKAGE_FULLY_REMOVED);runQuery();check(!cache.contains(arbitrary)&&cache.contains(other))
 pm.queryFails=true;c.broadcast(AndroidIntent.ACTION_PACKAGE_ADDED);runQuery();check(cache.snapshot().state==FreedBrowserHandlerCache.State.UNAVAILABLE&&!cache.contains(other));val failures=pm.queries.size;repeat(2000){cache.contains(other)};check(pm.queries.size==failures&&pending.isEmpty());pm.queryFails=false
 SystemClock.now+=60_000;Handler.tick();check(pending.size==1);runQuery();check(cache.contains(other))
 pm.settingFails=true;c.broadcast(AndroidIntent.ACTION_PACKAGE_CHANGED);runQuery();check(!cache.contains(other));pm.settingFails=false
 pm.failingScheme="https";c.broadcast(AndroidIntent.ACTION_PACKAGE_CHANGED);runQuery();check(cache.snapshot().failure=="package-query-failed"&&!cache.contains(other));pm.failingScheme=null
 c.broadcast(AndroidIntent.ACTION_PACKAGE_CHANGED);runQuery();check(cache.contains(other));both(webHandler(arbitrary));SystemClock.now+=60_000;check(!cache.contains(other)){"Expired snapshot must reject dropped-broadcast stale membership"};Handler.tick();runQuery();check(cache.contains(arbitrary)&&!cache.contains(other))
 val clockBefore=SystemClock.now;SystemClock.now-=1;check(!cache.contains(arbitrary));SystemClock.now=clockBefore;check(!cache.contains(arbitrary)){"Clock rollback invalidation cannot resurrect snapshot"};SystemClock.now+=60_000;Handler.tick();runQuery();check(cache.contains(arbitrary))
 c.broadcast(AndroidIntent.ACTION_PACKAGE_CHANGED);cache.disconnect();check(c.unregistrations==1&&!cache.contains(arbitrary));runQuery();check(cache.snapshot().state==FreedBrowserHandlerCache.State.UNAVAILABLE&&pending.isEmpty());cache.disconnect();check(c.unregistrations==1)
 cache.connect();runQuery();check(cache.contains(arbitrary));c.unregistrationFails=true;cache.disconnect();check(cache.snapshot().failure=="receiver-unregister-failed"&&!cache.contains(arbitrary));check(c.unregistrations==2);c.unregistrationFails=false
 val registration=Context().apply{registrationFails=true};val broken=FreedBrowserHandlers(registration,Handler(),{error("No query after receiver registration failure")});broken.connect();check(broken.snapshot().failure=="receiver-register-failed");broken.disconnect();check(registration.unregistrations==0)
 val dispatchFailure=FreedBrowserHandlers(Context(),Handler(),{throw java.util.concurrent.RejectedExecutionException()});dispatchFailure.connect();check(dispatchFailure.snapshot().failure=="query-dispatch-failed");dispatchFailure.disconnect()
 Build.VERSION.SDK_INT=24;val legacy=Context();legacy.packageManager.http=listOf(webHandler(arbitrary));legacy.packageManager.https=legacy.packageManager.http;val legacyJobs=mutableListOf<Runnable>();val legacyCache=FreedBrowserHandlers(legacy,Handler(),{legacyJobs.add(it)});legacyCache.connect();check(legacy.receiverFlags==null);legacyJobs.single().run();Handler.drain();check(legacyCache.contains(arbitrary));legacyCache.disconnect();Build.VERSION.SDK_INT=36
 val replaced=Context();both(webHandler(arbitrary));cache.connect();val oldJob=pending.removeAt(0);cache.disconnect();val newJobs=mutableListOf<Runnable>();val newCache=FreedBrowserHandlers(replaced,Handler(),{newJobs.add(it)});replaced.packageManager.http=listOf(webHandler(other));replaced.packageManager.https=replaced.packageManager.http;newCache.connect();oldJob.run();Handler.drain();check(!cache.contains(arbitrary)&&!newCache.contains(arbitrary));newJobs.single().run();Handler.drain();check(newCache.contains(other));newCache.disconnect()
 val coordinator=FreedBrowserHandlerCache();coordinator.connect(500L);val stale=coordinator.beginQuery(500L)!!;coordinator.disconnect();coordinator.connect(600L);check(coordinator.beginQuery(600L)==null);coordinator.complete(stale,setOf(arbitrary),600L);check(coordinator.snapshot(600L).packages.isEmpty());val fresh=coordinator.beginQuery(600L)!!;coordinator.complete(fresh,setOf(other),600L);check(coordinator.snapshot(600L).packages==setOf(other));coordinator.invalidate(601L);val longScan=coordinator.beginQuery(601L)!!;coordinator.complete(longScan,setOf(arbitrary),60_601L);check(coordinator.snapshot(60_601L).packages.isEmpty())
 val started=java.util.concurrent.CountDownLatch(1);val release=java.util.concurrent.CountDownLatch(1);val secondStarted=java.util.concurrent.CountDownLatch(1);val secondDone=java.util.concurrent.CountDownLatch(1)
 val firstContext=Context();firstContext.packageManager.onQuery={started.countDown();check(Thread.currentThread().name=="freed-web-handlers");check(release.await(3,java.util.concurrent.TimeUnit.SECONDS))}
 val firstDefault=FreedBrowserHandlers(firstContext);firstDefault.connect();check(started.await(3,java.util.concurrent.TimeUnit.SECONDS))
 val secondContext=Context();var secondCalls=0;secondContext.packageManager.onQuery={secondStarted.countDown();secondCalls++;if(secondCalls==7)secondDone.countDown()};val secondDefault=FreedBrowserHandlers(secondContext);secondDefault.connect()
 val thirdDefault=FreedBrowserHandlers(Context());thirdDefault.connect();check(thirdDefault.snapshot().failure=="query-dispatch-failed"){"Rapid service replacement cannot grow an unbounded shared query queue"};check(secondStarted.count==1L){"Only one background PackageManager scan can run"}
 firstDefault.disconnect();secondDefault.disconnect();thirdDefault.disconnect();release.countDown();check(secondDone.await(3,java.util.concurrent.TimeUnit.SECONDS));Handler.drain();check(firstDefault.snapshot().packages.isEmpty()&&secondDefault.snapshot().packages.isEmpty())
 println("Production browser adapters passed: generic both-scheme projection, malformed/critical/deep-link/disabled exclusion; bounded background query, package invalidation/generation races, TTL/rollback/failure and receiver lifecycle; actual service membership plus focused URL/search/depth/WebView/compatibility extraction")
}
`));
  files.push(...fixtures.production(native));
  if (process.argv.includes('--prepare-only')) {
    process.stdout.write('Harness prepared without native compilation; runtime assertions unexecuted.\n');
  } else {
    const jar = join(work, 'cases.jar'); run('kotlinc', [...files, '-include-runtime', '-d', jar]); run('java', ['-jar', jar]);
    process.stdout.write('Harness JAR SHA-256: ' + createHash('sha256').update(fs.readFileSync(jar)).digest('hex') + '\n');
  }
} finally { fs.rmSync(work, { recursive: true, force: true }); }
