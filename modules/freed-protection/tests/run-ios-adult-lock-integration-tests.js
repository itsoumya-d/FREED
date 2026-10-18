const {mkdtempSync,readFileSync,writeFileSync,rmSync,copyFileSync,mkdirSync}=require('node:fs');
const {tmpdir}=require('node:os');const {join}=require('node:path');const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');const assert=require('node:assert/strict');
const scratch=mkdtempSync(join(tmpdir(),'freed-task72-'));
const commandEvidence=process.argv.find(arg=>arg.startsWith('--evidence-dir='))?.slice('--evidence-dir='.length);
const commandRecords=[];
function capturedRun(command,args,timeout) {
 const started=Date.now();const result=spawnSync(command,args,{encoding:'utf8',timeout});
 const record={command,args,timeoutMs:timeout,status:result.status,signal:result.signal,error:result.error?{code:result.error.code,message:result.error.message}:null,elapsedMs:Date.now()-started,stdout:result.stdout,stderr:result.stderr};
 commandRecords.push(record);
 if(commandEvidence){mkdirSync(commandEvidence,{recursive:true});writeFileSync(join(commandEvidence,'command-results.json'),JSON.stringify(commandRecords,null,2)+'\n');}
 if(result.error || result.signal) console.error(JSON.stringify({status:record.status,signal:record.signal,error:record.error,timeoutMs:timeout}));
 return result;
}
const modulePath=process.argv.includes('--fix1-red-setter')?'.superpowers/sdd/2026-10-13-publishable-recovery/task-72/fix1/preimages/FreedProtectionModule.swift':'modules/freed-protection/ios/FreedProtectionModule.swift';
const moduleSource=readFileSync(modulePath,'utf8');
const safariConsumer=readFileSync('ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift','utf8');
const monitor=readFileSync('ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift','utf8');
function functionBody(source, name) {const start=source.indexOf(`  private func ${name}`);assert(start>=0,name);let begin=source.indexOf('{',start),depth=1,end=begin+1;while(depth && end<source.length){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}assert.equal(depth,0);const text=source.slice(start,end).replace('private func','func');return /->\s*Bool\s*\{/.test(text)?'@discardableResult '+text:text;}
function stopBody(name) {const start=moduleSource.indexOf(`    AsyncFunction("${name}")`);assert(start>=0);let begin=moduleSource.indexOf('{',start),depth=1,end=begin+1;while(depth&&end<moduleSource.length){if(moduleSource[end]==='{')depth++;if(moduleSource[end]==='}')depth--;end++;}const block=moduleSource.slice(begin+1,end-1);return block.slice(block.indexOf(' in\n')+4).replaceAll('#if canImport(ManagedSettings)','#if true').replaceAll('#if canImport(DeviceActivity)','#if true');}
const adultHelpers=functionBody(moduleSource,'withAdultProtectionConfigurationAccess')+'\n'+functionBody(moduleSource,'setAdultFilterActive')+'\n'+functionBody(moduleSource,'setRiskWindowMonitoringActive')+'\n'+functionBody(readFileSync('modules/freed-protection/ios/FreedProtectionModule.swift','utf8'),'applyWebContentFilterForCurrentState').replaceAll('#if canImport(ManagedSettings)','#if true');
const stopHarness=`final class AdultMutationBoundary {
 var defaults:UserDefaults; let container:URL?; let domain:String;let store=StubStore();var selectedShieldWrites=0;var onTransactionStart:((UserDefaults)->Void)?
 init(defaults:UserDefaults,container:URL?=nil,domain:String="fixture"){self.defaults=defaults;self.container=container;self.domain=domain}
 let adultFilterActiveKey="freed.adultFilterActive",riskWindowActiveKey="freed.riskWindowActive",riskWindowCurrentlyActiveKey="freed.riskWindow.currentlyActive",riskWindowActivityName="freed.nightGuard"
 func sharedDefaults()->UserDefaults{defaults};func isAuthorized()->Bool{true};func isAdultFilterActive()->Bool{defaults.bool(forKey:adultFilterActiveKey) && store.webContent.blockedByFilter != nil};func isRiskWindowMonitoringActive()->Bool{defaults.bool(forKey:riskWindowActiveKey)}
 func applySelectedShieldsForCurrentState(){selectedShieldWrites += 1}
 func statusPayload(authorized:Bool,active:Bool,scheduled:Bool,message:String)->[String:Any]{["active":active,"scheduled":scheduled,"message":message]}
 func withProtectionConfigurationAccess(_ body:()->[String:Any])->[String:Any]{guard let container else{return body()};do{return try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:container,domain:domain){d in self.defaults=d;self.onTransactionStart?(d);return body()}}catch{return["nativeConfigurationOperationAccepted":false,"nativeConfigurationDiagnostics":FreedProtectionConfigurationLock.diagnostics(error)]}}
 func stopAdult()->[String:Any]{${stopBody('stopAdultContentFilter')}}
 func stopRisk()->[String:Any]{${stopBody('stopRiskWindowMonitoring')}}
 ${adultHelpers}
}
struct DeviceActivityName:Hashable {let rawValue:String;init(_ value:String){rawValue=value}}
struct DeviceActivitySchedule:Equatable {let intervalStart:DateComponents;let intervalEnd:DateComponents;let repeats:Bool;var warningTime:DateComponents?=nil}
struct DeviceActivityEvent:Equatable {struct Name:Hashable {let rawValue:String};var applications=Set<String>();var categories=Set<String>();var webDomains=Set<String>();var threshold=DateComponents();var includesPastActivity=false}
final class DeviceActivityCenter {
 static var stopped=0;static var rejectNightStopOnce=false;static var schedules:[DeviceActivityName:DeviceActivitySchedule]=[:];static var eventMap:[DeviceActivityName:[DeviceActivityEvent.Name:DeviceActivityEvent]]=[:]
 var activities:[DeviceActivityName]{Array(Self.schedules.keys)}
 func schedule(for name:DeviceActivityName)->DeviceActivitySchedule?{Self.schedules[name]}
 func events(for name:DeviceActivityName)->[DeviceActivityEvent.Name:DeviceActivityEvent]{Self.eventMap[name] ?? [:]}
 func startMonitoring(_ name:DeviceActivityName,during schedule:DeviceActivitySchedule,events:[DeviceActivityEvent.Name:DeviceActivityEvent]=[:]) throws {Self.schedules[name]=schedule;Self.eventMap[name]=events}
 func stopMonitoring(_ activities:[DeviceActivityName]){Self.stopped += 1;for name in activities{if name.rawValue=="freed.nightGuard" && Self.rejectNightStopOnce{Self.rejectNightStopOnce=false;continue};Self.schedules.removeValue(forKey:name);Self.eventMap.removeValue(forKey:name)}}
}
enum FreedNightGuardIntent {static let key="freed.riskWindow.expected.v1"}
`;
let reset=moduleSource.slice(moduleSource.indexOf('struct FreedProtectionResetPolicy {'),moduleSource.indexOf('// MARK: - Existing protection layers'));
if(process.argv.includes('--red')) {reset=reset.replace('try FreedAdultProtectionLegacyGate.requireUnenrolled()','// semantic mutation: authorization gate removed');}
const dnsBoundary=readFileSync('modules/freed-protection/tests/DnsControllerReadbackBoundary.swift','utf8').split('enum FreedProtectionConfigurationLock {')[0];
let dns=moduleSource.slice(moduleSource.indexOf('@available(iOS 14.0, *)\n@MainActor\nprivate final class FreedEncryptedDnsController'),moduleSource.indexOf('// MARK: - Protection configuration reset policy'));
dns=dns.slice(0,dns.lastIndexOf('#endif')).replace('private final class FreedEncryptedDnsController','final class FreedEncryptedDnsController').replaceAll('FreedProtectionConfigurationLock','DnsFixtureConfigurationLock').replaceAll('Bundle.main.object(forInfoDictionaryKey:', 'DnsFixtureInfo.object(forInfoDictionaryKey:');
const dnsPolicy=moduleSource.slice(moduleSource.indexOf('struct FreedEncryptedDnsPolicy'),moduleSource.indexOf('#if os(iOS) && canImport(NetworkExtension)'));
const dnsLock=`enum DnsFixtureConfigurationLock { typealias AccessError=FreedProtectionConfigurationLock.AccessError; static let appGroupIdentifier="freed.task72.dns.\\(UUID().uuidString)"; static let d=UserDefaults(suiteName:appGroupIdentifier)!; static var gen=4; static var reset=false; static var isInsideExclusiveAccess=false; static var useAdultAdapter=false; static func adultMutationEpoch(_ d:UserDefaults)throws->Int{d.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")}; @discardableResult static func fenceAdultMutations(_ d:UserDefaults)throws->Int{let v=try adultMutationEpoch(d)+1;d.set(v,forKey:"freed.deviceAdult.mutationEpoch.v1");return v}; static func sharedDefaults()->UserDefaults{useAdultAdapter ? try! FreedAdultConfigurationAccess.withExclusiveAccess{$0}:d}; static func withExclusiveAccess<T>(_ body:(UserDefaults)throws->T)throws->T{if useAdultAdapter{return try FreedAdultConfigurationAccess.withExclusiveAccess(body)};return try body(d)}; static func permitsPublication(_ d:UserDefaults,capturedGeneration:Int?=nil)->Bool{!reset && (capturedGeneration == nil || capturedGeneration == gen)}; static func generation(_ d:UserDefaults)->Int{useAdultAdapter ? FreedProtectionConfigurationLock.generation(d):gen}; static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{FreedProtectionConfigurationLock.diagnostics(error,generation:generation)} }`;
const safariHelpers=functionBody(moduleSource,'configureSafariContentBlockerRulesFile');
const safariHarness=`final class SafariMutationBoundary {let defaults:UserDefaults;let path:URL;init(defaults:UserDefaults,path:URL){self.defaults=defaults;self.path=path};func sharedDefaults()->UserDefaults{defaults};func safariContentBlockerRulesURL()->URL?{path};func makeFreedError(_ message:String)->NSError{NSError(domain:"Fixture",code:1)};func validateSafariContentBlockerRules(_ rules:[Any])throws{};func isSafariFocusShieldRule(_ item:Any)->Bool{false};let safariContentBlockerVersionKey="freed.safariContentBlocker.version",safariContentBlockerChecksumKey="freed.safariContentBlocker.checksum",safariContentBlockerGeneratedAtKey="freed.safariContentBlocker.generatedAt",safariContentBlockerRuleCountKey="freed.safariContentBlocker.ruleCount",safariContentBlockerLastReloadErrorKey="freed.safariContentBlocker.lastReloadError";${safariHelpers}}`;
const boundary=`import Foundation
${dnsBoundary}
${dnsPolicy}
${dnsLock}
${dns}
${safariHarness}
\n${reset}\n${stopHarness}\nstruct WebDomain:Hashable {}\nenum StubFilter: Equatable {case auto(Set<WebDomain>,except:Set<WebDomain>)}\nfinal class StubWebContent {static var rejectClearOnce=false;static var rejectInstallOnce=false;private var value:StubFilter?;var attemptedValues:[Bool]=[];var resultingValues:[Bool]=[];func simulateExternalFilterLoss(){value=nil};var blockedByFilter:StubFilter?{get{value}set{attemptedValues.append(newValue != nil);defer{resultingValues.append(value != nil)};if newValue==nil && Self.rejectClearOnce{Self.rejectClearOnce=false;return};if newValue != nil && Self.rejectInstallOnce{Self.rejectInstallOnce=false;return};value=newValue}}}\nfinal class StubStore {static var latest:StubStore?;let webContent=StubWebContent();init(){Self.latest=self}}\nfinal class MonitorAdultBoundary {let defaults:UserDefaults;let store=StubStore();init(defaults:UserDefaults){self.defaults=defaults};func sharedDefaults()->UserDefaults{defaults};func clearSelectedShields(){}\n${functionBody(monitor,'applyWebContentFilterForCurrentState')}\n${functionBody(monitor,'clearOwnedProtection')}\n}\n`;
const runtimePath=process.argv.includes('--c2-fix1-before')?'.superpowers/sdd/2026-10-13-publishable-recovery/task-79c2/fix1/preimages/modules/freed-protection/ios/FreedAdultProtectionRuntime.swift':'modules/freed-protection/ios/FreedAdultProtectionRuntime.swift';
const productionRuntime=readFileSync(runtimePath,'utf8');
let productionProviders=productionRuntime.slice(productionRuntime.indexOf('@available(iOS 15.1, *)\n@MainActor\nfinal class FreedAdultProtectionRuntime'),productionRuntime.lastIndexOf('#endif')).replaceAll('FriendLockNativeCrypto()', 'FixtureCrypto()');
const c2API=`
typealias ManagedSettingsStore=StubStore
final class SFContentBlockerState {let isEnabled:Bool;init(_ enabled:Bool){isEnabled=enabled}}
enum SFContentBlockerManager {
 static var enabled=true;static var reloadError:Error?;static var reloadErrors:[Error?]=[];static var holdReload=false;static var pendingReload:((Error?)->Void)?;static var reloadCount=0;static var stateCount=0
 static func getStateOfContentBlocker(withIdentifier:String,completionHandler:@escaping(SFContentBlockerState?,Error?)->Void){stateCount += 1;completionHandler(SFContentBlockerState(enabled),nil)}
 static func reloadContentBlocker(withIdentifier:String,completionHandler:@escaping(Error?)->Void){reloadCount += 1;if holdReload{pendingReload=completionHandler}else{completionHandler(reloadErrors.isEmpty ? reloadError:reloadErrors.removeFirst())}}
}
`;
let actualConsumer=safariConsumer.replace('@objc(ContentBlockerRequestHandler)','').replace('ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling','C2ContentBlockerConsumer: NSObject').replaceAll('NSExtensionContext','C2ConsumerContext').replaceAll('NSExtensionItem','C2ConsumerItem').replaceAll('NSItemProvider','C2ConsumerProvider').replaceAll('FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)','FreedAdultConfigurationAccess.fixtureContainer').replaceAll('FreedProtectionConfigurationLock.withExclusiveAccess','FreedAdultConfigurationAccess.withExclusiveAccess').replaceAll('FreedProtectionConfigurationLock.sharedDefaults()','FreedProtectionConfigurationLock.sharedDefaults(containerOverride:FreedAdultConfigurationAccess.fixtureContainer,domain:FreedAdultConfigurationAccess.fixtureDomain)');
const consumerAPI=`
final class C2ConsumerProvider {let data:Data;init(item:NSData,typeIdentifier:String){data=item as Data}}
final class C2ConsumerItem {var attachments:[C2ConsumerProvider]?}
final class C2ConsumerContext {var data:Data?;var error:Error?;func cancelRequest(withError:Error){error=withError};func completeRequest(returningItems:[C2ConsumerItem]){data=returningItems.first?.attachments?.first?.data}}
`;
writeFileSync(join(scratch,'NativeBoundaries.swift'),boundary+'\n'+c2API+'\n'+productionProviders+'\n'+consumerAPI+'\n'+actualConsumer);
const retainedPath='modules/freed-protection/ios/FreedRetainedAdultProtection.swift';
let compiledRetained=retainedPath;
if(process.argv.includes('--fix1-red-missing')){compiledRetained=join(scratch,'FreedRetainedAdultProtection.swift');const retained=readFileSync(retainedPath,'utf8');const guardLine='guard !reset, adultIntent == true || (adultIntent == false && riskIntent == true && bounded) else { throw Failure.baselineUnknown }';assert(retained.includes(guardLine));writeFileSync(compiledRetained,retained.replace(guardLine,'// Semantic mutation: absent native baseline treated as empty again'));}
const sources=['modules/freed-protection/ios/FreedFriendLockCore.swift','modules/freed-protection/ios/FreedFriendLockRecordStore.swift','modules/freed-protection/ios/FreedProtectionConfigurationLock.swift',compiledRetained,'modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift','modules/freed-protection/ios/FreedAdultProtectionOperationStore.swift','modules/freed-protection/ios/FreedNativeAdultMutationAdapter.swift','modules/freed-protection/tests/AdultLockIntegrationCases.swift','modules/freed-protection/tests/AdultAdapterCases.swift',join(scratch,'NativeBoundaries.swift')];
sources.push('modules/freed-protection/ios/FreedAccountProtectionCleanup.swift','modules/freed-protection/tests/AccountCleanupCoreCases.swift');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const binding={mode:process.argv.includes('--fix1-red-missing')?'RED-missing-baseline':process.argv.includes('--fix1-red-setter')?'RED-swallowed-setters':process.argv.includes('--red')?'RED-gate-mutation':'GREEN',extractedModuleSHA256:hash(modulePath),sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(p)])),actualBoundaryHashes:{runtime:hash(runtimePath),module:hash('modules/freed-protection/ios/FreedProtectionModule.swift'),monitor:hash('ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift'),safariConsumer:hash('ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift')}};
console.log(JSON.stringify(binding,null,2));
if(process.argv.includes('--sdk')) {
 const sdk=spawnSync('xcrun',['--sdk','iphoneos','--show-sdk-path'],{encoding:'utf8'});assert.equal(sdk.status,0);
 const dnsSDK=moduleSource.slice(moduleSource.indexOf('// MARK: - Optional encrypted DNS'),moduleSource.indexOf('// MARK: - Protection configuration reset policy'));
 const nativeSDK=join(scratch,'SDKBoundaries.swift');
 const night=`final class NightSDK {var lastNightGuardDiagnostics:[String:Any]?;let riskWindowActivityName="freed.nightGuard",riskWindowActiveKey="freed.riskWindowActive";${functionBody(moduleSource,'installAcknowledgedNightGuard')}}`;
 const adultSDK=stopHarness.slice(0,stopHarness.indexOf('struct DeviceActivityName:')).replaceAll('StubStore','ManagedSettingsStore');
 const monitorSDK=`final class MonitorSDK {let store=ManagedSettingsStore();func sharedDefaults()->UserDefaults{FreedProtectionConfigurationLock.sharedDefaults()};func clearSelectedShields(){};${functionBody(monitor,'applyWebContentFilterForCurrentState')};${functionBody(monitor,'clearOwnedProtection')}}`;
 writeFileSync(nativeSDK,'import Foundation\nimport NetworkExtension\nimport UIKit\nimport DeviceActivity\nimport ManagedSettings\n'+dnsSDK+reset+'\n'+night+'\n'+monitorSDK+'\n'+adultSDK+'\n'+moduleSource.slice(moduleSource.indexOf('@available(iOSApplicationExtension, unavailable)'),moduleSource.indexOf('public class FreedProtectionModule')).replace(/#endif\s*$/, ''));
 const sdkEvidence=process.argv.find(arg=>arg.startsWith('--evidence-dir='))?.slice('--evidence-dir='.length);if(sdkEvidence){mkdirSync(sdkEvidence,{recursive:true});copyFileSync(nativeSDK,join(sdkEvidence,'SDKBoundaries.swift'));}
 const nativeSources=sources.slice(0,7).concat(['modules/freed-protection/ios/FreedAccountProtectionCleanup.swift','modules/freed-protection/ios/FreedFriendLockKeychain.swift','modules/freed-protection/ios/FreedAdultProtectionRuntime.swift','modules/freed-protection/ios/FreedAppGroupsPolicy.swift','ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift',nativeSDK]);
 const result=capturedRun('xcrun',['swiftc','-typecheck','-swift-version','5','-sdk',sdk.stdout.trim(),'-target','arm64-apple-ios15.1',...nativeSources],180000);process.stdout.write(result.stdout+result.stderr);assert.equal(result.status,0,'Actual iOS SDK typecheck failed');console.log('Task72 coordinator / retained / DNS / reset / Night Guard / monitor actual iOS SDK typecheck: PASS');
}
const binary=join(scratch,'cases');
const evidence=process.argv.find(arg=>arg.startsWith('--evidence-dir='))?.slice('--evidence-dir='.length);
if(evidence){mkdirSync(evidence,{recursive:true});copyFileSync(runtimePath,join(evidence,'ProductionRuntime.swift'));for(const file of sources)copyFileSync(file,join(evidence,file.split('/').pop()));writeFileSync(join(evidence,'source-bindings.json'),JSON.stringify(binding,null,2)+'\n');}
try {let compiled=capturedRun('xcrun',['swiftc','-parse-as-library','-D','FREED_NATIVE_FIXTURES','-swift-version','5',...sources,'-o',binary],180000);process.stdout.write(compiled.stdout+compiled.stderr);assert.equal(compiled.status,0,'Compilation failed');console.log(`fixtureBinarySHA256=${hash(binary)}`);if(evidence)copyFileSync(binary,join(evidence,'native-fixture'));const result=capturedRun(binary,process.argv.filter(x=>x==='--task82-only'||x==='--c2-fix1-only'||x.startsWith('--c2-fix1-mode=')),90000);process.stdout.write(result.stdout+result.stderr);if(process.argv.includes('--red')||process.argv.includes('--fix1-red-missing')||process.argv.includes('--fix1-red-setter')){assert.notEqual(result.status,0,'RED mutation unexpectedly passed');const expected=process.argv.includes('--fix1-red-missing')?/Missing retained baseline must preserve installed filter/:process.argv.includes('--fix1-red-setter')?/Corrupt retained storage must reject full adult stop caller|Full adult stop must reject unknown retained baseline/:/Enrolled legacy reset must retain adult intent/;assert.match(result.stderr,expected);console.log('Semantic RED: successfully compiled regression failed its intended preservation/acknowledgment assertion');}else assert.equal(result.status,0,'Native cases failed');}finally{rmSync(scratch,{recursive:true,force:true});}
