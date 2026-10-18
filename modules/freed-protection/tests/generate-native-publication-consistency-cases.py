import pathlib,re,json,hashlib,sys
root=pathlib.Path.cwd(); out=pathlib.Path(sys.argv[1]); out.mkdir(parents=True,exist_ok=True); frozen=root/'.superpowers/sdd/2026-10-07-activation-repair/task-a-fix1-before' if '--before' in sys.argv else root
module=(frozen/'modules/freed-protection/ios/FreedProtectionModule.swift').read_text(); monitor=(frozen/'ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift').read_text()
def block(src,marker):
 start=src.index(marker); pos=src.index('{',start); depth=1; end=pos+1
 while depth:
  if src[end]=='{':depth+=1
  if src[end]=='}':depth-=1
  end+=1
 return src[start:end]
def extracted(names):
 value = re.sub(r'^\s*#if canImport\((?:ManagedSettings|FamilyControls|DeviceActivity)\).*$', '#if true', '\n'.join(block(module,'  private func '+n+'(') for n in names).replace('private ','').replace('FreedProtectionConfigurationLock','RuntimeLock'),flags=re.M)
 return re.sub(r'try adultRuleData\.write\(to: rulesURL, options: ([^)]+)\)', r'try RulePublicationBoundary.write(adultRuleData, to: rulesURL, options: \1)', value)
boundary=(root/'modules/freed-protection/tests/AppGuardCases.swift').read_text().split('enum FreedProtectionConfigurationLock')[0]
adapter='''
enum RuntimeLock {
 typealias AccessError=FreedProtectionConfigurationLock.AccessError
 static var directory:URL!;static var domain:String!
 static let resetMarkerKey=FreedProtectionConfigurationLock.resetMarkerKey
 static func generation(_ d:UserDefaults)->Int{FreedProtectionConfigurationLock.generation(d)}
 static func permitsPublication(_ d:UserDefaults,capturedGeneration:Int?=nil)->Bool{FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:capturedGeneration)}
 static func persist(_ d:UserDefaults)->Bool{FreedProtectionConfigurationLock.persist(d)}
 static func sharedDefaults()->UserDefaults{FreedProtectionConfigurationLock.sharedDefaults(containerOverride:directory,domain:domain)}
 static func withExclusiveAccess<T>(afterSuccessfulPersistence:((T)->Void)?=nil,_ body:(UserDefaults)throws->T)throws->T{try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:afterSuccessfulPersistence,body)}
}
enum FreedAppGroupsPolicy{static let prefix="freed.group."}
final class FreedAppGroupsRuntime{static let shared=FreedAppGroupsRuntime();static func legacyAppsAdopted(_ d:UserDefaults)->Bool{false};func callback(activity:String,event:String?=nil){}}
'''
methods=['invalidateActiveEarnedUnlockLease','activeEarnedUnlockExpiresAt','isEarnedUnlockActive','clearActiveEarnedUnlockState','parseIsoDate','formatIsoDate','boundedEarnedUnlockExpiry','isScreenTimeUnlockSource','sanitizedPendingInterventionId','sanitizeHostForStorage','isValidHostLabel','activeEarnedUnlockScope','scopeStored','decodedScopeTokenData','isSelectedScreenTimeScope','configuredAppGuardMode','applySelectedShieldsForCurrentState','applySelectedShieldsIfAvailable','clearSelectedShields','applySelectedShieldsExcludingEarnedUnlockScope']
struct=block(module,'  private struct InterventionScope').replace('private ','')
members=(root/'modules/freed-protection/tests/LeaseAuthorityHarnessMembers.swift').read_text().replace('func sharedDefaults() -> UserDefaults { UserDefaults(suiteName: domain)! }','func sharedDefaults() -> UserDefaults { RuntimeLock.sharedDefaults() }').replace('  deinit { sharedDefaults().removePersistentDomain(forName: domain) }','')
lease='final class LeaseAuthorityHarness {\n'+struct+'\n'+extracted(methods)+'\n'+members+'''
 var stops=0
 func isEarnedUnlockMonitoringReady(expiresAt:Date)->Bool{false}
 func stopEarnedUnlockMonitoring(){stops+=1;if stops==12{print("BOUNDED_RECURSION: identical persisted lease was invalidated 12 times in one getter call");fflush(stdout);UserDefaults(suiteName:RuntimeLock.domain)?.removePersistentDomain(forName:RuntimeLock.domain);try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:RuntimeLock.directory.path);try? FileManager.default.removeItem(at:RuntimeLock.directory);exit(42)}}
}\n'''
safari='final class SafariHarness {\n'+extracted(['configureSafariContentBlockerRulesFile','validateSafariContentBlockerRules','isSafariFocusShieldRule'])+'''
 let safariContentBlockerVersionKey="freed.safariContentBlocker.version",safariContentBlockerChecksumKey="freed.safariContentBlocker.checksum",safariContentBlockerGeneratedAtKey="freed.safariContentBlocker.generatedAt",safariContentBlockerRuleCountKey="freed.safariContentBlocker.ruleCount",safariContentBlockerLastReloadErrorKey="freed.safariContentBlocker.lastReloadError"
 func sharedDefaults()->UserDefaults{RuntimeLock.sharedDefaults()}
 var rulesDirectory:URL?
 func safariContentBlockerRulesURL()->URL?{(rulesDirectory ?? RuntimeLock.directory).appendingPathComponent("safari-content-blocker-rules.json")}
 func makeFreedError(_ message:String)->Error{NSError(domain:"FreedProtection",code:1)}
}\n'''
monitor= re.sub(r'^import (?:DeviceActivity|FamilyControls|ManagedSettings)\n','',monitor,flags=re.M).replace('private ','').replace('FreedProtectionConfigurationLock','RuntimeLock')

reader=(frozen/'ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift').read_text().replace('FreedProtectionConfigurationLock','RuntimeLock').replace('FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)','Optional(RuntimeLock.directory!)').replace('NSItemProvider','SnapshotItemProvider').replace('NSExtensionContext','SnapshotExtensionContext').replace('NSExtensionItem','SnapshotExtensionItem').replace('NSExtensionRequestHandling','SnapshotRequestHandling')
transport="""
protocol SnapshotRequestHandling {}
final class SnapshotItemProvider {
 let data:Data?,url:URL?,version:String?
 init?(contentsOf:URL){data=nil;url=contentsOf;version=RuntimeLock.sharedDefaults().string(forKey:"freed.safariContentBlocker.version")}
 init(item:NSData,typeIdentifier:String){data=item as Data;url=nil;version=RuntimeLock.sharedDefaults().string(forKey:"freed.safariContentBlocker.version")}
 func delayedData()throws->Data{if let data{return data};return try Data(contentsOf:url!)}
}
final class SnapshotExtensionItem{var attachments:[SnapshotItemProvider]?}
final class SnapshotExtensionContext {
 var items:[SnapshotExtensionItem]=[];var error:Error?
 func completeRequest(returningItems:[SnapshotExtensionItem]){items=returningItems}
 func cancelRequest(withError:Error){error=withError}
}
enum RulePublicationBoundary {
 static var pauseDirectory:URL?
 static func write(_ data:Data,to url:URL,options:Data.WritingOptions)throws {
  if let directory=pauseDirectory {
   try Data().write(to:directory.appendingPathComponent("publication-paused"))
   let deadline=Date().addingTimeInterval(3)
   while !FileManager.default.fileExists(atPath:directory.appendingPathComponent("release-publication").path){precondition(Date()<deadline,"Publication barrier timed out");Thread.sleep(forTimeInterval:0.01)}
  }
  try data.write(to:url,options:options)
 }
}
"""

cases='''
@main struct ReviewProbes {
 static func main() throws {
  if CommandLine.arguments.count>3 {
   let op=CommandLine.arguments[1];RuntimeLock.directory=URL(fileURLWithPath:CommandLine.arguments[2]);RuntimeLock.domain=CommandLine.arguments[3]
   if op=="concurrent-writer" {RulePublicationBoundary.pauseDirectory=RuntimeLock.directory;let h=SafariHarness();try RuntimeLock.withExclusiveAccess{_ in _=try h.configureSafariContentBlockerRulesFile(rulesJson:#"[{"trigger":{"url-filter":"new-adult-host"},"action":{"type":"block"}}]"#,version:"next",checksum:"c",generatedAt:"date")}}
   else {
    try Data().write(to:RuntimeLock.directory.appendingPathComponent("reader-attempted"))
    let context=SnapshotExtensionContext();ContentBlockerRequestHandler().beginRequest(with:context);precondition(context.error==nil)
    let provider=context.items[0].attachments![0];let payload=try provider.delayedData()
    precondition(provider.version=="next" && String(decoding:payload,as:UTF8.self).contains("new-adult-host"),"Concurrent reader must see a complete matching metadata/rule publication")
    try Data().write(to:RuntimeLock.directory.appendingPathComponent("reader-completed"))
   };return
  }
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-task-a-review-\\(UUID().uuidString)")
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  RuntimeLock.directory=directory;RuntimeLock.domain="app.freed.review.\\(UUID().uuidString)"
  defer{UserDefaults(suiteName:RuntimeLock.domain)?.removePersistentDomain(forName:RuntimeLock.domain);try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);try? FileManager.default.removeItem(at:directory)}
  let file=directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  if CommandLine.arguments[1]=="lease" {
   let h=LeaseAuthorityHarness(),token=ApplicationToken(id:"opaque-A");h.selection.applicationTokens=[token]
   let scope=LeaseAuthorityHarness.InterventionScope(kind:"ios-token",tokenType:"application",token:try JSONEncoder().encode(token).base64EncodedString(),domain:nil)
   try RuntimeLock.withExclusiveAccess{d in d.set("before-use",forKey:h.appGuardModeKey);d.set(try JSONEncoder().encode(h.selection),forKey:"freed.familyActivitySelection");d.set("ios-screen-time",forKey:h.earnedUnlockSourceKey);d.set(UUID().uuidString,forKey:h.earnedUnlockInterventionIdKey);d.set(try JSONEncoder().encode(scope),forKey:h.earnedUnlockScopeKey);d.set(h.formatIsoDate(Date().addingTimeInterval(-60)),forKey:h.earnedUnlockExpiresAtKey)}
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   do{try RuntimeLock.withExclusiveAccess{_ in _=h.activeEarnedUnlockExpiresAt()};preconditionFailure("expected commit denial")}catch{}
   precondition(h.stops==1)
   precondition(h.activeEarnedUnlockExpiresAt()==nil)
   precondition(h.stops==2,"One denied lease invalidation per getter must remain bounded")
   let stillInvalid=RuntimeLock.sharedDefaults();precondition(stillInvalid.string(forKey:h.earnedUnlockExpiresAtKey) != nil)
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(h.activeEarnedUnlockExpiresAt()==nil)
   precondition(RuntimeLock.sharedDefaults().object(forKey:h.earnedUnlockExpiresAtKey)==nil,"Writable retry must durably remove expired authority")
   precondition(RuntimeLock.sharedDefaults().data(forKey:"freed.familyActivitySelection") != nil,"Expiry cleanup preserves independent selected policy")
   print("PASS: expired legacy getter stays bounded under readonly commit denial, grants no access, and persists cleanup after storage recovers")
  } else if CommandLine.arguments[1]=="monitor" {
   try RuntimeLock.withExclusiveAccess{d in d.set(true,forKey:"freed.riskWindowActive");d.set(true,forKey:"freed.riskWindow.currentlyActive");d.set(false,forKey:"freed.adultFilterActive")}
   let before=try Data(contentsOf:file),h=DeviceActivityMonitorExtension();h.store.webContent.blockedByFilter = .auto([],except:[])
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   h.intervalDidEnd(for:.init("freed.nightGuard"))
   let after=try Data(contentsOf:file);precondition(before==after);precondition(RuntimeLock.sharedDefaults().bool(forKey:"freed.riskWindow.currentlyActive"));precondition(h.store.webContent.blockedByFilter != nil,"Rejected Night Guard boundary commit must preserve previous OS policy")
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   h.intervalDidEnd(for:.init("freed.nightGuard"))
   precondition(!RuntimeLock.sharedDefaults().bool(forKey:"freed.riskWindow.currentlyActive") && h.store.webContent.blockedByFilter==nil)
   let inactive=try Data(contentsOf:file)
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
   h.intervalDidStart(for:.init("freed.nightGuard"))
   let deniedStart=try Data(contentsOf:file);precondition(inactive==deniedStart && h.store.webContent.blockedByFilter==nil)
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   h.intervalDidStart(for:.init("freed.nightGuard"))
   precondition(RuntimeLock.sharedDefaults().bool(forKey:"freed.riskWindow.currentlyActive") && h.store.webContent.blockedByFilter != nil)
   print("PASS: failed Night Guard end/start commits preserve exact durable intent and previous OS policy; successful retry publishes matching state")
  } else if CommandLine.arguments[1]=="safari-encoded-bound" {
   let h=SafariHarness(),rulesURL=h.safariContentBlockerRulesURL()!,old=Data(#"[{"trigger":{"url-filter":"old-adult-host"},"action":{"type":"block"}}]"#.utf8)
   try old.write(to:rulesURL);try RuntimeLock.withExclusiveAccess{d in d.set("old",forKey:h.safariContentBlockerVersionKey);d.set(1,forKey:h.safariContentBlockerRuleCountKey)}
   let before=try Data(contentsOf:file)
   let expansion=#"[{"trigger":{"url-filter":""#+String(repeating:"/",count:8*1024*1024)+#""},"action":{"type":"block"}}]"#
   precondition(expansion.utf8.count<16*1024*1024)
   let parsed=try JSONSerialization.jsonObject(with:Data(expansion.utf8));let encoded=try JSONSerialization.data(withJSONObject:parsed);precondition(encoded.count>16*1024*1024,"Fixture must distinguish input size from published JSON size")
   var rejected=false;do{try RuntimeLock.withExclusiveAccess{_ in _=try h.configureSafariContentBlockerRulesFile(rulesJson:expansion,version:"next",checksum:"c",generatedAt:"date")}}catch{rejected=true}
   let after=try Data(contentsOf:file),afterRules=try Data(contentsOf:rulesURL);precondition(rejected && before==after && old==afterRules,"Encoded output bounds must precede every publication")
   print("PASS: bounded input that expands beyond the JSON publication limit retains the exact prior rules and metadata")
  } else if CommandLine.arguments[1]=="safari-snapshot" || CommandLine.arguments[1]=="safari-concurrent" {
   let h=SafariHarness(),rulesURL=h.safariContentBlockerRulesURL()!,old=Data(#"[{"trigger":{"url-filter":"old-adult-host"},"action":{"type":"block"}}]"#.utf8)
   try old.write(to:rulesURL);try RuntimeLock.withExclusiveAccess{d in d.set("old",forKey:h.safariContentBlockerVersionKey);d.set(1,forKey:h.safariContentBlockerRuleCountKey)}
   if CommandLine.arguments[1]=="safari-snapshot" {
    let context=SnapshotExtensionContext();ContentBlockerRequestHandler().beginRequest(with:context);precondition(context.error==nil)
    let provider=context.items[0].attachments![0];precondition(provider.version=="old")
    try RuntimeLock.withExclusiveAccess{_ in _=try h.configureSafariContentBlockerRulesFile(rulesJson:#"[{"trigger":{"url-filter":"new-adult-host"},"action":{"type":"block"}}]"#,version:"next",checksum:"c",generatedAt:"date")}
    let delayed=try provider.delayedData();precondition(delayed==old,"Deferred extension transport must retain the matching rule version captured under exclusion")
    print("PASS: deferred content-blocker transport pins immutable bytes paired with the metadata observed under the lock")
   }else {
    func launch(_ op:String)throws->Process{let p=Process();p.executableURL=URL(fileURLWithPath:CommandLine.arguments[0]);p.arguments=[op,directory.path,RuntimeLock.domain];try p.run();return p}
    func waitFor(_ name:String){let deadline=Date().addingTimeInterval(3);while !FileManager.default.fileExists(atPath:directory.appendingPathComponent(name).path){precondition(Date()<deadline);Thread.sleep(forTimeInterval:0.01)}}
    let writer=try launch("concurrent-writer");waitFor("publication-paused")
    let reader=try launch("concurrent-reader");waitFor("reader-attempted");Thread.sleep(forTimeInterval:0.15)
    precondition(!FileManager.default.fileExists(atPath:directory.appendingPathComponent("reader-completed").path),"Reader must wait while metadata and rule publication are staged")
    try Data().write(to:directory.appendingPathComponent("release-publication"));writer.waitUntilExit();reader.waitUntilExit();precondition(writer.terminationStatus==0 && reader.terminationStatus==0)
    print("PASS: actual child-process content reader waits for the shared lock and observes one complete metadata/JSON pair")
   }
  } else if CommandLine.arguments[1]=="safari" {
   let h=SafariHarness(),rulesURL=h.safariContentBlockerRulesURL()!
   let old=Data(#"[{"trigger":{"url-filter":"old-adult-host"},"action":{"type":"block"}}]"#.utf8)
   try old.write(to:rulesURL)
   try RuntimeLock.withExclusiveAccess{d in d.set("old",forKey:h.safariContentBlockerVersionKey);d.set(1,forKey:h.safariContentBlockerRuleCountKey)}
   let before=try Data(contentsOf:file)
   let validJSON=#"[{"trigger":{"url-filter":"new-adult-host"},"action":{"type":"block"}}]"#
   for input in [(String(repeating:"v",count:257),"c","date",validJSON),("v",String(repeating:"c",count:129),"date",validJSON),("v","c",String(repeating:"d",count:129),validJSON),("v","c","date",String(repeating:"x",count:16*1024*1024+1))] {
    var rejected=false;do{try RuntimeLock.withExclusiveAccess{_ in _=try h.configureSafariContentBlockerRulesFile(rulesJson:input.3,version:input.0,checksum:input.1,generatedAt:input.2)}}catch{rejected=true}
    let rejectedState=try Data(contentsOf:file),rejectedRules=try Data(contentsOf:rulesURL);precondition(rejected && rejectedState==before && rejectedRules==old,"Bounded input rejection must precede every publication")
   }
   do{try RuntimeLock.withExclusiveAccess{_ in _=try h.configureSafariContentBlockerRulesFile(rulesJson:#"[{"trigger":{"url-filter":"new-adult-host"},"action":{"type":"block"}}]"#,version:String(repeating:"v",count:17*1024*1024),checksum:"c",generatedAt:"date")};preconditionFailure("oversized authority must reject")}catch{}
   let after=try Data(contentsOf:file),rulesAfter=try Data(contentsOf:rulesURL)
   precondition(before==after);precondition(old==rulesAfter,"Rejected metadata must retain extension-readable rules")
   let rulesDirectory=directory.appendingPathComponent("safari-rules")
   try FileManager.default.createDirectory(at:rulesDirectory,withIntermediateDirectories:true)
   h.rulesDirectory=rulesDirectory;let nestedRules=h.safariContentBlockerRulesURL()!;try old.write(to:nestedRules)
   try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:rulesDirectory.path)
   var denied=false
   do{try RuntimeLock.withExclusiveAccess{_ in _=try h.configureSafariContentBlockerRulesFile(rulesJson:#"[{"trigger":{"url-filter":"new-adult-host"},"action":{"type":"block"}}]"#,version:"next",checksum:"c",generatedAt:"date")}}catch{denied=true}
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:rulesDirectory.path)
   let afterFileFailure=try Data(contentsOf:file),rulesAfterFailure=try Data(contentsOf:nestedRules)
   precondition(denied && afterFileFailure==before && rulesAfterFailure==old,"Rejected rule-file replacement must roll metadata back and retain previous rule bytes")
   try RuntimeLock.withExclusiveAccess{_ in _=try h.configureSafariContentBlockerRulesFile(rulesJson:#"[{"trigger":{"url-filter":"new-adult-host"},"action":{"type":"block"}}]"#,version:"next",checksum:"c",generatedAt:"date")}
   let acceptedRules=try Data(contentsOf:nestedRules);precondition(String(decoding:acceptedRules,as:UTF8.self).contains("new-adult-host"));precondition(RuntimeLock.sharedDefaults().string(forKey:h.safariContentBlockerVersionKey)=="next")
   print("PASS: failed Safari metadata/file publication retains previous bytes and authority; successful retry publishes consistent metadata and rules")
  }
 }
}
'''
(out/'ReviewProbes.swift').write_text(boundary+adapter+transport+lease+safari+monitor+reader+cases)
receipt={'frozenModuleSha256':hashlib.sha256(module.encode()).hexdigest(),'frozenMonitorSha256':hashlib.sha256((frozen/'ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift').read_bytes()).hexdigest(),'readerSha256':hashlib.sha256((frozen/'ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift').read_bytes()).hexdigest(),'copiedLockSha256':hashlib.sha256((frozen/'modules/freed-protection/ios/FreedProtectionConfigurationLock.swift').read_bytes()).hexdigest(),'extractedMethods':methods+['configureSafariContentBlockerRulesFile','validateSafariContentBlockerRules','isSafariFocusShieldRule'],'harnessSha256':hashlib.sha256((out/'ReviewProbes.swift').read_bytes()).hexdigest(),'transformations':['Apple framework imports removed; conditionally imported policies enabled for deterministic boundaries','Configuration lock call sites routed to unchanged real helper with temporary container/domain','Access modifiers removed for observation','Unavailable Apple policy/schedule objects use existing AppGuardCases boundaries','Lease OS stop boundary exits after 12 invalidations to bound recursion; no getter body changes','Safari rules URL points to temporary container; final Foundation data-write call wraps real filesystem I/O with optional test-only publication pause' , 'Content-blocker transport substitutes unavailable extension context/item provider; data snapshots are immutable and file URLs use delayed reads'],'fullNativeBuild':False,'physicalProof':False}
(out/'harness-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt,indent=2))
