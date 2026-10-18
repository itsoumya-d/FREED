import Foundation
enum DnsFixtureInfo {static func object(forInfoDictionaryKey key:String)->Any?{key=="FreedEncryptedDnsReleaseEnabled" ? true:false}}
class NEDNSSettings {let servers:[String];var matchDomains:[String]?;var matchDomainsNoSearch=false;var allowFailover=true;init(servers:[String]){self.servers=servers}}
final class NEDNSOverHTTPSSettings:NEDNSSettings {var serverURL:URL?}
class NEOnDemandRule {}
@MainActor final class NEDNSSettingsManager {
 static let instance=NEDNSSettingsManager();static func shared()->NEDNSSettingsManager{instance}
 var dnsSettings:NEDNSSettings?;var localizedDescription:String?;var onDemandRules:[NEOnDemandRule]?;var isEnabled=false
 var storedSettings:NEDNSSettings?;var storedRules:[NEOnDemandRule]?;var storedDescription:String?;var storedEnabled=false
 var afterLoad: (() -> Void)?
 var holdLoad = false
 var heldLoad: CheckedContinuation<Void, Never>?
 var holdSave = false
 var heldSave: CheckedContinuation<Void, Never>?
 var inlineRemovalCompletion = false
 var onRemoveRegistration: (() -> Void)?
 var holdRemoval = false
 var heldRemoval: (() -> Void)?
 var removalCallbackError: Error?
 var duplicateRemovalCallback = false
 var callbacksReleased = 0
 var nextLoadError:Error?;var nextSaveError:Error?;var afterSave:(()->Void)?;var loadCount=0;var saveCount=0;var removeCount=0
 static func copy(_ settings:NEDNSSettings?)->NEDNSSettings?{guard let s=settings else{return nil};let c:NEDNSSettings;if let h=s as? NEDNSOverHTTPSSettings{let d=NEDNSOverHTTPSSettings(servers:s.servers);d.serverURL=h.serverURL;c=d}else{c=NEDNSSettings(servers:s.servers)};c.matchDomains=s.matchDomains;c.matchDomainsNoSearch=s.matchDomainsNoSearch;c.allowFailover=s.allowFailover;return c}
 func loadFromPreferences()async throws{loadCount += 1;if holdLoad {holdLoad=false;await withCheckedContinuation {heldLoad=$0}};if let e=nextLoadError{nextLoadError=nil;throw e};dnsSettings=Self.copy(storedSettings);onDemandRules=storedRules;localizedDescription=storedDescription;isEnabled=storedEnabled;let action=afterLoad;afterLoad=nil;action?()}
 func saveToPreferences()async throws{saveCount += 1;if holdSave {holdSave=false;await withCheckedContinuation {heldSave=$0}};if let e=nextSaveError{nextSaveError=nil;throw e};storedSettings=Self.copy(dnsSettings);storedRules=onDemandRules;storedDescription=localizedDescription;let action=afterSave;afterSave=nil;action?()}
 func removeFromPreferences()async throws{removeCount += 1;storedSettings=nil;storedRules=nil;storedDescription=nil;storedEnabled=false}
 func loadFromPreferences(completionHandler:@escaping(Error?)->Void){Task{do{try await loadFromPreferences();completionHandler(nil)}catch{completionHandler(error)}}}
 func saveToPreferences(completionHandler:@escaping(Error?)->Void){Task{do{try await saveToPreferences();completionHandler(nil)}catch{completionHandler(error)}}}
 func removeFromPreferences(completionHandler:@escaping(Error?)->Void){
  if inlineRemovalCompletion {inlineRemovalCompletion=false;completionHandler(nil);completionHandler(nil);return}
  let settle: () -> Void = { [self] in
   Task {
    callbacksReleased += 1
    if let error = removalCallbackError { removalCallbackError = nil; completionHandler(error); return }
    do { try await removeFromPreferences(); completionHandler(nil); if duplicateRemovalCallback { completionHandler(nil) } }
    catch { completionHandler(error) }
   }
  }
  let registrationHook=onRemoveRegistration;onRemoveRegistration=nil;registrationHook?()
  if holdRemoval { holdRemoval = false; heldRemoval = settle } else { settle() }
 }
 func settleLoad() { let continuation=heldLoad;heldLoad=nil;continuation?.resume() }
 func settleSave() { let continuation = heldSave; heldSave = nil; continuation?.resume() }
 func settleRemoval() { let callback = heldRemoval; heldRemoval = nil; callback?() }
}
enum FreedProtectionConfigurationLock {
 enum AccessError:Error{case unavailable;var stage:String{"state-commit"};var posixCode:Int32?{nil}}
 static var isInsideExclusiveAccess = false
 static var failAfterBody = false
 static func adultMutationEpoch(_ defaults:UserDefaults)throws->Int{defaults.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")}
 @discardableResult static func fenceAdultMutations(_ defaults:UserDefaults)throws->Int{let next=try adultMutationEpoch(defaults)+1;defaults.set(next,forKey:"freed.deviceAdult.mutationEpoch.v1");return next}
 static let resetMarkerKey="reset", generationKey="generation"
 static func persist(_ defaults:UserDefaults)->Bool{defaults.synchronize()}
 static let appGroupIdentifier="app.freed.tests.dns.\(UUID().uuidString)";static let d=UserDefaults(suiteName:appGroupIdentifier)!;static var currentGeneration=4;static var reset=false
 static func sharedDefaults()->UserDefaults{d}
 static func withExclusiveAccess<T>(_ body:(UserDefaults)throws->T)throws->T{let old=isInsideExclusiveAccess;isInsideExclusiveAccess=true;defer{isInsideExclusiveAccess=old};let result=try body(d);if failAfterBody{failAfterBody=false;throw AccessError.unavailable};return result}
 static func permitsPublication(_ d:UserDefaults,capturedGeneration:Int?=nil)->Bool{!reset&&(capturedGeneration==nil||capturedGeneration==currentGeneration)}
 static func generation(_ d:UserDefaults)->Int{currentGeneration}
 static func diagnostics(_ error:Error?=nil)->[String:Any]{["stage":"state-commit","errorCode":NSNull(),"errorDomain":"FreedProtection"]}
}
