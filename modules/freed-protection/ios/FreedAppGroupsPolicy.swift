import Foundation
#if canImport(Darwin)
import Darwin
#endif

// Raw boot values stay native and local. Only enums, errno and availability
// cross the diagnostic boundary; a failure never creates substitute authority.
struct FreedAppGroupsBootReading {
 let identity:String?,source:String,stage:String,errorCode:Int32?,primaryStage:String,primaryErrno:Int32?
 var diagnostics:[String:Any] {[
  "clockBootAvailable":identity != nil,"clockBootSource":source,"clockBootStage":stage,
  "clockBootErrno":errorCode.map{Int($0) as Any} ?? NSNull(),
  "clockPrimaryStage":primaryStage,"clockPrimaryErrno":primaryErrno.map{Int($0) as Any} ?? NSNull()
 ]}
}
struct FreedAppGroupsBootReader {
 // Inject the public syscall boundary, never a JS-issued boot identity.
 var namedRead:(String,UnsafeMutableRawPointer?,inout Int)->Int32 = {name,pointer,size in
  #if canImport(Darwin)
  return sysctlbyname(name,pointer,&size,nil,0)
  #else
  return -1
  #endif
 }
 var bootTimeRead:(UnsafeMutableRawPointer,inout Int)->Int32 = {pointer,size in
  #if canImport(Darwin)
  var selectors:[Int32]=[CTL_KERN,KERN_BOOTTIME]
  return selectors.withUnsafeMutableBufferPointer{sysctl($0.baseAddress,2,pointer,&size,nil,0)}
  #else
  return -1
  #endif
 }
 var errorCode:()->Int32 = {
  #if canImport(Darwin)
  return errno
  #else
  return 0
  #endif
 }
 func read()->FreedAppGroupsBootReading {
  var size=0,primaryStage="uuid-size";var primaryErrno:Int32?
  if namedRead("kern.bootsessionuuid",nil,&size) != 0 {primaryErrno=errorCode()}
  else if size>1 && size<=128 {
   var buffer=[UInt8](repeating:0,count:size)
   let result=buffer.withUnsafeMutableBytes{namedRead("kern.bootsessionuuid",$0.baseAddress,&size)}
   primaryStage="uuid-read"
   if result != 0 {primaryErrno=errorCode()}
   else if size>1 && size<=buffer.count {
    primaryStage="uuid-value"
    let bytes=buffer.prefix(size)
    if let end=bytes.firstIndex(of:0),let value=String(bytes:bytes.prefix(end),encoding:.utf8),let uuid=UUID(uuidString:value) {
     return .init(identity:uuid.uuidString.lowercased(),source:"kernel-uuid",stage:"complete",errorCode:nil,primaryStage:"complete",primaryErrno:nil)
    }
   }
  }
  #if canImport(Darwin)
  var value=timeval(),returnedSize=MemoryLayout<timeval>.size
  let result=withUnsafeMutableBytes(of:&value){bootTimeRead($0.baseAddress!,&returnedSize)}
  if result != 0 {return .init(identity:nil,source:"unavailable",stage:"boottime-read",errorCode:errorCode(),primaryStage:primaryStage,primaryErrno:primaryErrno)}
  guard returnedSize==MemoryLayout<timeval>.size else{return .init(identity:nil,source:"unavailable",stage:"boottime-size",errorCode:nil,primaryStage:primaryStage,primaryErrno:primaryErrno)}
  guard value.tv_sec>0,value.tv_usec>=0,value.tv_usec<1_000_000 else{return .init(identity:nil,source:"unavailable",stage:"boottime-value",errorCode:nil,primaryStage:primaryStage,primaryErrno:primaryErrno)}
  // Complete exact timeval, source-prefixed and deliberately not wall-derived.
  // Stability under device clock changes/reboot remains a physical release gate.
  return .init(identity:"kern-boottime:\(value.tv_sec):\(value.tv_usec)",source:"kernel-boottime",stage:"complete",errorCode:nil,primaryStage:primaryStage,primaryErrno:primaryErrno)
  #else
  return .init(identity:nil,source:"unavailable",stage:"unsupported",errorCode:nil,primaryStage:primaryStage,primaryErrno:primaryErrno)
  #endif
 }
}
struct FreedAppGroupsClock {
 var now:()->Date
 var uptime:()->Double
 var readBoot:()->FreedAppGroupsBootReading
 var dailyPastUsageAvailable:()->Bool
 init(now:@escaping ()->Date={Date()},uptime:@escaping ()->Double={ProcessInfo.processInfo.systemUptime},bootIdentity:(()->String?)?=nil,dailyPastUsageAvailable:@escaping ()->Bool={if #available(iOS 17.4, *){return true};return false},bootReader:FreedAppGroupsBootReader=FreedAppGroupsBootReader()) {
  self.now=now;self.uptime=uptime;self.dailyPastUsageAvailable=dailyPastUsageAvailable
  if let bootIdentity {readBoot={let identity=bootIdentity();return .init(identity:identity,source:identity==nil ? "unavailable":"injected",stage:"injected",errorCode:nil,primaryStage:"injected",primaryErrno:nil)}}
  else {readBoot={bootReader.read()}}
 }
 func bootIdentity()->String? {readBoot().identity}
 static func kernelBootIdentity()->String? {FreedAppGroupsBootReader().read().identity}
 struct ValidationFailure:Error {let underlying:Error;let diagnostics:[String:Any]}
}



struct FreedAppGroupRule: Codable, Equatable {
 let kind: String
 var limitMinutes: Int?
 var startMinute: Int?
 var endMinute: Int?
 var days: [Int]?
 init(kind: String, limitMinutes: Int? = nil, startMinute: Int? = nil, endMinute: Int? = nil, days: [Int]? = nil) {
  self.kind=kind;self.limitMinutes=limitMinutes;self.startMinute=startMinute;self.endMinute=endMinute;self.days=days
 }
}
struct FreedAppGroupDefinition: Codable, Equatable {
 var id: String;var revision: Int;var name: String;var enabled: Bool;var rule: FreedAppGroupRule
 var slot: Int;var bank: Int;var packages: [String];var selection: Data?;var pendingSelection: Data?;var legacy: Bool
 var preferredBreakSeconds:Int? = nil
}
struct FreedAppGroupClaim: Codable, Equatable {
 let interventionId: String;let groupId: String;let groupRevision: Int;let target: String
 let generation: Int;let scopeEpoch: Int;let claimedAt: Double;let claimedUptime: Double
 var bootIdentity: String? = nil
}
struct FreedAppGroupLease: Codable, Equatable {
 let claim: FreedAppGroupClaim;let requestedExpiry: Double;let expiresAt: Double;let grantedAt: Double;let grantedUptime: Double
 var bootIdentity: String? = nil
}
struct FreedAppGroupsState: Codable, Equatable {
 var version=1;var revision=0;var generation=0;var scopeEpoch=0
 var groups: [FreedAppGroupDefinition]=[];var thresholds: [String:String]=[:];var leases: [String:FreedAppGroupLease]=[:]
 var ownerDigest: String?;var claim: FreedAppGroupClaim?;var legacyMigrated=false;var legacyAppsAdopted=false
}
enum FreedAppGroupsPolicy {
 static let key="freed.appGroups.v1";static let maximumGroups=6;static let maximumActivities=20
 static let legacyId="legacy-default";static let prefix="freed.group."
 static let supportedBreakSeconds=[300,600,1200]
 static func draft(id:String,name:String,slot:Int)->FreedAppGroupDefinition {
  FreedAppGroupDefinition(id:id,revision:1,name:name,enabled:false,rule:FreedAppGroupRule(kind:"daily-limit",limitMinutes:30),slot:slot,bank:0,packages:[],selection:nil,pendingSelection:nil,legacy:false)
 }
 static func validId(_ id:String)->Bool { id.range(of:#"^[A-Za-z0-9_-]{1,64}$"#,options:.regularExpression) != nil }
 static func validateRule(_ r:FreedAppGroupRule,enabled:Bool,allowLegacy:Bool=false)->Bool {
  switch r.kind {
  case "before-use":return r.limitMinutes==nil && r.startMinute==nil && r.endMinute==nil && r.days==nil
  case "daily-limit":return r.limitMinutes.map{(5...240).contains($0)} == true && r.startMinute==nil && r.endMinute==nil && r.days==nil
  case "scheduled":
   guard r.limitMinutes==nil,let start=r.startMinute,let end=r.endMinute,let days=r.days,(0..<1440).contains(start),(0..<1440).contains(end),days.count<=7,Set(days).count==days.count,days.allSatisfy({(0...6).contains($0)}) else{return false}
   return !enabled || (!days.isEmpty && (end-start+1440)%1440 >= 15)
  case "legacy":return allowLegacy && r.limitMinutes==nil && r.startMinute==nil && r.endMinute==nil && r.days==nil
  default:return false
  }
 }
 static func validateGroups(_ groups:[FreedAppGroupDefinition])->Bool {
  guard groups.count<=maximumGroups else{return false};var ids=Set<String>(),slots=Set<Int>()
  return groups.allSatisfy{g in validId(g.id) && ids.insert(g.id).inserted && slots.insert(g.slot).inserted && (0..<6).contains(g.slot) && (0...1).contains(g.bank) && g.revision>0 && g.name.count<=80 && (g.preferredBreakSeconds.map{supportedBreakSeconds.contains($0)} ?? true) && g.packages.count<=200 && Set(g.packages).count==g.packages.count && (g.selection?.count ?? 0)<=131072 && validateRule(g.rule,enabled:g.enabled,allowLegacy:g.legacy && g.id==legacyId)}
 }
 static func decode(_ data:Data?)->FreedAppGroupsState? {
  guard let data,data.count<=524288,let state=try? JSONDecoder().decode(FreedAppGroupsState.self,from:data),state.version==1,state.revision>=0,state.generation>=0,state.scopeEpoch>=0,validateGroups(state.groups) else{return nil};return state
 }
 static func ownerChange(state:FreedAppGroupsState,newDigest:String?,hadBoundScope:Bool,scopeChanged:Bool)->FreedAppGroupsState {
  var next=state
  let changed=state.ownerDigest != newDigest || hadBoundScope && scopeChanged || !hadBoundScope && newDigest==nil
  if changed {next.scopeEpoch += 1;next.claim=nil;next.leases=[:]}
  next.ownerDigest=newDigest;return next
 }
 static func matchesRevision(store:Int,group:Int,expectedStore:Int,expectedGroup:Int)->Bool {store==expectedStore && group==expectedGroup}
 static func canStage(existingActivities:Int,newActivities:Int)->Bool {existingActivities>=0 && newActivities>=0 && existingActivities+newActivities<=maximumActivities}
 static func windowActive(_ r:FreedAppGroupRule,day:Int,minute:Int)->Bool {
  guard r.kind=="scheduled",let start=r.startMinute,let end=r.endMinute,let days=r.days,(0...6).contains(day),(0..<1440).contains(minute) else{return false}
  return start<end ? days.contains(day) && minute>=start && minute<end : days.contains(day) && minute>=start || days.contains((day+6)%7) && minute<end
 }
 static func issuedClockValid(bootIdentity:String?,currentBootIdentity:String?,issuedAt:Double,issuedUptime:Double,now:Double,uptime:Double)->Bool {
  guard let bootIdentity,!bootIdentity.isEmpty,bootIdentity==currentBootIdentity,issuedAt.isFinite,issuedUptime.isFinite,now.isFinite,uptime.isFinite,issuedAt>0,issuedUptime>=0,now>=issuedAt,uptime>=issuedUptime else{return false}
  return now-issuedAt<1200 && uptime-issuedUptime<1200
 }
 static func authorize(_ c:FreedAppGroupClaim,groupId:String,revision:Int,targetMember:Bool,generation:Int,scopeEpoch:Int,now:Double,uptime:Double,requestedExpiry:Double,bootIdentity:String?=nil)->Double? {
  guard let bootIdentity,!bootIdentity.isEmpty,c.bootIdentity==bootIdentity,UUID(uuidString:c.interventionId) != nil,c.groupId==groupId,c.groupRevision==revision,targetMember,c.generation==generation,c.scopeEpoch==scopeEpoch,c.claimedAt>0,c.claimedUptime>=0,now>=c.claimedAt,uptime>=c.claimedUptime,now-c.claimedAt<1200,uptime-c.claimedUptime<1200,requestedExpiry>now else{return nil}
  return min(requestedExpiry,now+7200)
 }
 static func leaseActive(_ l:FreedAppGroupLease,group:FreedAppGroupDefinition,generation:Int,scopeEpoch:Int,now:Double,uptime:Double,bootIdentity:String?=nil)->Bool {
  guard let bootIdentity,!bootIdentity.isEmpty,l.bootIdentity==bootIdentity,l.claim.bootIdentity==bootIdentity else{return false}
  return l.claim.groupId==group.id && l.claim.groupRevision==group.revision && l.claim.generation==generation && l.claim.scopeEpoch==scopeEpoch && now>=l.grantedAt && uptime>=l.grantedUptime && now<l.expiresAt && uptime-l.grantedUptime<l.expiresAt-l.grantedAt
 }
}


struct FreedNightGuardIntent: Codable, Equatable {
 static let key="freed.riskWindow.expected.v1"
 let version:Int
 let generation:Int
 let startMinute:Int
 let endMinute:Int
 let repeats:Bool
 var operationID:String? = nil
 static func decode(_ data:Data?,generation:Int)->FreedNightGuardIntent? {
  guard let data,data.count<=1024,let value=try? JSONDecoder().decode(Self.self,from:data),value.version==1,value.generation==generation,(0..<1440).contains(value.startMinute),(0..<1440).contains(value.endMinute),value.startMinute != value.endMinute,value.repeats else{return nil}
  return value
 }
}

/// Native derives the only allowed duration; a caller cannot choose expiry or cap.
struct FreedResetAppGroupRewardRequest: Codable, Equatable {
 let version:Int;let policyVersion:Int;let category:String
 let completionSessionId:String;let templateId:String;let templateVersion:Int
 let nativeInterventionId:String;let groupId:String;let groupRevision:Int
 let configurationGeneration:Int;let scopeEpoch:Int;let kind:String
 let tokenType:String?;let packageName:String?
 var seconds:Int {category=="breathe" ? 120:300}
 static func parse(_ input:[String:Any],platform:String)->Self? {
  let keys:Set<String>=["version","policyVersion","category","completionSessionId","templateId","templateVersion","nativeInterventionId","groupId","groupRevision","configurationGeneration","scopeEpoch","kind",platform=="ios" ? "tokenType":"packageName"]
  guard Set(input.keys)==keys else{return nil}
  for key in ["version","policyVersion","templateVersion","groupRevision","configurationGeneration","scopeEpoch"] {
   guard let value=input[key] as? NSNumber,CFGetTypeID(value) != CFBooleanGetTypeID(),value.doubleValue.isFinite,value.doubleValue>=0,value.doubleValue<=9_007_199_254_740_991,value.doubleValue.rounded()==value.doubleValue else{return nil}
  }
  guard let data=try? JSONSerialization.data(withJSONObject:input),let value=try? JSONDecoder().decode(Self.self,from:data),value.version==1,value.policyVersion==1,["breathe","move","find"].contains(value.category),value.templateVersion>0,value.groupRevision>0,FreedAppGroupsPolicy.validId(value.groupId),UUID(uuidString:value.nativeInterventionId)?.uuidString.lowercased()==value.nativeInterventionId,
   [value.completionSessionId,value.templateId].allSatisfy({$0.range(of:#"^[A-Za-z0-9:_-]{1,160}$"#,options:.regularExpression) != nil}),
   value.kind=="\(platform)-app-group",platform != "ios" || value.tokenType=="application" else{return nil}
  return value
 }
}
struct FreedResetAppGroupRewardConsumption: Codable, Equatable {
 let request:FreedResetAppGroupRewardRequest;let ownerDigest:String;let bootIdentity:String
 let grantedAt:Double;let grantedUptime:Double;let expiresAt:Double
}
struct FreedResetAppGroupRewardLedger: Codable {
 static let key="freed.appGroups.resetRewards.v1"
 // No eviction: a full ledger refuses new grants rather than making old sessions reusable.
 static let maximumRecords=4096
 var version=1;var records:[String:FreedResetAppGroupRewardConsumption]=[:]
 static func decode(_ data:Data?)->Self? {
  guard let data else{return Self()}
  guard data.count<=4*1024*1024,let value=try? JSONDecoder().decode(Self.self,from:data),value.version==1,value.records.count<=maximumRecords else{return nil}
  return value
 }
}
