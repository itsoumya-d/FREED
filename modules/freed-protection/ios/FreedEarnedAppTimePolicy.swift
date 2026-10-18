import Foundation
import CoreFoundation
import CryptoKit

// V2 is stored separately. V1 request/lease schemas and historical durations
// remain unchanged; only the existing opaque native claim is shared.
enum FreedEarnedAppTimePolicy {
 static let key="freed.appGroups.earnedTime.v2"
 static let caps:Set<Int>=[0,5,10,20,30,60]
 static let maximumRecords=4096
 static func recordKey(_ owner:String,_ identity:String)->String {SHA256.hash(data:Data((owner+"\0"+identity).utf8)).map{String(format:"%02x",$0)}.joined()}
 enum Failure:Error {case invalidBudget,clockUnavailable,capacity}
 static func integer(_ input:[String:Any],_ key:String)->Int? {
  guard let n=input[key] as? NSNumber,CFGetTypeID(n) != CFBooleanGetTypeID(),n.doubleValue.isFinite,n.doubleValue>=0,n.doubleValue<=9_007_199_254_740_991,n.doubleValue.rounded()==n.doubleValue else{return nil}
  return n.intValue
 }
 static func identifier(_ value:String)->Bool {value.range(of:#"^[A-Za-z0-9:_-]{1,160}$"#,options:.regularExpression) != nil}
 static func uuid(_ value:String)->Bool {UUID(uuidString:value)?.uuidString.lowercased()==value}
 static func decode<T:Decodable>(_ input:[String:Any],as:T.Type)->T? {guard let data=try? JSONSerialization.data(withJSONObject:input) else{return nil};return try? JSONDecoder().decode(T.self,from:data)}
 static func iso(_ value:Double)->String {ISO8601DateFormatter().string(from:Date(timeIntervalSince1970:value))}
}

struct FreedEarnedAppTimeOfferRequest:Codable,Equatable {
 let version:Int,policyVersion:Int,nativeInterventionId:String,groupId:String,groupRevision:Int,configurationGeneration:Int,scopeEpoch:Int,kind:String,tokenType:String,requestedSeconds:Int
 static func parse(_ input:[String:Any])->Self? {
  guard Set(input.keys)==Set(["version","policyVersion","nativeInterventionId","groupId","groupRevision","configurationGeneration","scopeEpoch","kind","tokenType","requestedSeconds"]),["version","policyVersion","groupRevision","configurationGeneration","scopeEpoch","requestedSeconds"].allSatisfy({FreedEarnedAppTimePolicy.integer(input,$0) != nil}),let r=FreedEarnedAppTimePolicy.decode(input,as:Self.self),r.version==2,r.policyVersion==2,r.kind=="ios-app-group",r.tokenType=="application",FreedAppGroupsPolicy.supportedBreakSeconds.contains(r.requestedSeconds),r.groupRevision>0,FreedAppGroupsPolicy.validId(r.groupId),FreedEarnedAppTimePolicy.uuid(r.nativeInterventionId) else{return nil}
  return r
 }
}
struct FreedEarnedAppTimeEvidence:Codable,Equatable {
 let method:String,activeDurationSec:Int,observedSteps:Int,photoProofIds:[String]
 let stepProofId:String?
}
struct FreedEarnedAppTimeGrantRequest:Codable,Equatable {
 let version:Int,policyVersion:Int,offerId:String,completionSessionId:String,category:String,templateId:String,templateVersion:Int,evidence:FreedEarnedAppTimeEvidence
 static func parse(_ input:[String:Any])->Self? {
  guard Set(input.keys)==Set(["version","policyVersion","offerId","completionSessionId","category","templateId","templateVersion","evidence"]),["version","policyVersion","templateVersion"].allSatisfy({FreedEarnedAppTimePolicy.integer(input,$0) != nil}),let evidence=input["evidence"] as? [String:Any],(Set(evidence.keys)==Set(["method","activeDurationSec","observedSteps","photoProofIds"]) || evidence["method"] as? String=="steps" && Set(evidence.keys)==Set(["method","activeDurationSec","observedSteps","photoProofIds","stepProofId"]) && (evidence["stepProofId"] as? String).map(FreedEarnedAppTimePolicy.uuid)==true),["activeDurationSec","observedSteps"].allSatisfy({FreedEarnedAppTimePolicy.integer(evidence,$0) != nil}),let r=FreedEarnedAppTimePolicy.decode(input,as:Self.self),r.version==2,r.policyVersion==2,r.templateVersion==2,FreedEarnedAppTimePolicy.uuid(r.offerId),[r.completionSessionId,r.templateId].allSatisfy(FreedEarnedAppTimePolicy.identifier),r.evidence.photoProofIds.count<=2,Set(r.evidence.photoProofIds).count==r.evidence.photoProofIds.count,r.evidence.photoProofIds.allSatisfy(FreedEarnedAppTimePolicy.identifier),["breathe","move","find"].contains(r.category),["timer","steps","photo"].contains(r.evidence.method) else{return nil}
  return r
 }
 func evidenceFailure(seconds:Int)->String? {
  guard FreedAppGroupsPolicy.supportedBreakSeconds.contains(seconds) else{return "earned-time-duration-invalid"}
  let bases:[String]
  switch (category,evidence.method) {
  case ("breathe","timer"):bases=["momentum-breathe-soft","momentum-breathe-exhale"]
  case ("move","timer"):bases=["momentum-move-seated","momentum-move-stretch"]
  case ("move","steps"):
   guard templateId=="momentum-move-steps:earned-v2:\(seconds)",evidence.activeDurationSec==0,evidence.observedSteps >= (seconds==300 ? 30:60),evidence.photoProofIds.isEmpty,evidence.stepProofId.map(FreedEarnedAppTimePolicy.uuid)==true else{return "steps-native-proof-required"};return nil
  case ("find","photo"):
   guard FreedChallengePhotoCatalog.templateTargets(templateId,seconds:seconds) != nil,evidence.activeDurationSec==0,evidence.observedSteps==0,evidence.stepProofId==nil,evidence.photoProofIds.count==(seconds==300 ? 1:2),evidence.photoProofIds.allSatisfy(FreedEarnedAppTimePolicy.uuid) else{return "photo-native-proof-required"};return nil
  default:return "earned-time-evidence-invalid"
  }
  guard templateVersion==2,bases.contains(where:{templateId=="\($0):earned-v2:\(seconds)"}),evidence.activeDurationSec >= (seconds==300 ? 60:120),evidence.observedSteps==0,evidence.stepProofId==nil,evidence.photoProofIds.isEmpty else{return "earned-time-evidence-invalid"}
  return nil
 }
}

struct FreedEarnedAppTimeBudgetDay:Codable,Equatable {let dayKey:String,spentSeconds:Int,nextResetAt:Double}
struct FreedEarnedAppTimeBudget:Codable,Equatable {
 let ownerDigest:String,groupId:String,timeZoneIdentifier:String
 var anchorWall:Double,anchorUptime:Double,bootIdentity:String
 var trustedWallOffset=0.0
 var configuredCapMinutes:Int,effectiveCapMinutes:Int,spentSeconds:Int,dayKey:String,nextResetAt:Double,pendingCapMinutes:Int?,revision:Int
 var previousDays:[FreedEarnedAppTimeBudgetDay]=[]
 var remainingSeconds:Int {max(0,effectiveCapMinutes*60-spentSeconds)}
 private static func calendar(_ zone:TimeZone)->Calendar {var calendar=Calendar(identifier:.gregorian);calendar.timeZone=zone;return calendar}
 private static func day(_ now:Date,_ calendar:Calendar)->String {let f=DateFormatter();f.calendar=calendar;f.timeZone=calendar.timeZone;f.locale=Locale(identifier:"en_US_POSIX");f.dateFormat="yyyy-MM-dd";return f.string(from:now)}
 static func make(owner:String,group:String,now:Date,uptime:Double,boot:String?,timeZone:TimeZone = .current)throws->Self {
  guard let boot,!boot.isEmpty,now.timeIntervalSince1970.isFinite,now.timeIntervalSince1970>0,uptime.isFinite,uptime>=0 else{throw FreedEarnedAppTimePolicy.Failure.clockUnavailable}
  let calendar=calendar(timeZone)
  guard let reset=calendar.date(byAdding:.day,value:1,to:calendar.startOfDay(for:now)) else{throw FreedEarnedAppTimePolicy.Failure.clockUnavailable}
  return Self(ownerDigest:owner,groupId:group,timeZoneIdentifier:timeZone.identifier,anchorWall:now.timeIntervalSince1970,anchorUptime:uptime,bootIdentity:boot,configuredCapMinutes:20,effectiveCapMinutes:20,spentSeconds:0,dayKey:day(now,calendar),nextResetAt:reset.timeIntervalSince1970,pendingCapMinutes:nil,revision:0)
 }
 func clockVerified(now:Date,uptime:Double,boot:String?)->Bool {
  let wall=now.timeIntervalSince1970
  return boot==bootIdentity && wall.isFinite && uptime.isFinite && wall>=anchorWall && uptime>=anchorUptime && abs((wall-anchorWall)-(uptime-anchorUptime))<=5
 }
 mutating func advance(now:Date,uptime:Double,boot:String?)throws->Bool {
  guard clockVerified(now:now,uptime:uptime,boot:boot) else{return false}
  let budgetNow=Date(timeIntervalSince1970:anchorWall+trustedWallOffset+(uptime-anchorUptime))
  guard budgetNow.timeIntervalSince1970>=nextResetAt else{return true}
  guard previousDays.count<FreedEarnedAppTimePolicy.maximumRecords,let zone=TimeZone(identifier:timeZoneIdentifier) else{throw FreedEarnedAppTimePolicy.Failure.capacity}
  let calendar=Self.calendar(zone)
  guard let reset=calendar.date(byAdding:.day,value:1,to:calendar.startOfDay(for:budgetNow)),reset.timeIntervalSince1970>nextResetAt else{throw FreedEarnedAppTimePolicy.Failure.clockUnavailable}
  previousDays.append(.init(dayKey:dayKey,spentSeconds:spentSeconds,nextResetAt:nextResetAt))
  dayKey=Self.day(budgetNow,calendar);nextResetAt=reset.timeIntervalSince1970;spentSeconds=0
  if let pendingCapMinutes{effectiveCapMinutes=pendingCapMinutes;self.pendingCapMinutes=nil}
  revision += 1
  return true
 }
 mutating func repairClock(_ proof:FreedEarnedAppTimeClockProof,now:Date,uptime:Double,boot:String?)throws {
  let elapsed=uptime-proof.receivedUptime
  guard boot==proof.bootIdentity,elapsed.isFinite,elapsed>=0,elapsed<=30,abs(now.timeIntervalSince(proof.receivedWall)-elapsed)<=5,abs(proof.receivedWall.timeIntervalSince(proof.serverDate))<=120 else{throw FreedEarnedAppTimePolicy.Failure.clockUnavailable}
  anchorWall=now.timeIntervalSince1970;anchorUptime=uptime;bootIdentity=proof.bootIdentity
  trustedWallOffset=proof.serverDate.addingTimeInterval(elapsed).timeIntervalSince(now)
  revision += 1
  _=try advance(now:now,uptime:uptime,boot:boot)
 }
 mutating func setCap(_ minutes:Int)throws {
  guard FreedEarnedAppTimePolicy.caps.contains(minutes) else{throw FreedEarnedAppTimePolicy.Failure.invalidBudget}
  guard minutes != configuredCapMinutes else{return}
  configuredCapMinutes=minutes
  if minutes>effectiveCapMinutes {pendingCapMinutes=minutes}
  else {effectiveCapMinutes=minutes;pendingCapMinutes=nil}
  revision += 1
 }
 var valid:Bool {
  !ownerDigest.isEmpty && FreedAppGroupsPolicy.validId(groupId) && TimeZone(identifier:timeZoneIdentifier) != nil && anchorWall.isFinite && anchorWall>0 && anchorUptime.isFinite && anchorUptime>=0 && trustedWallOffset.isFinite && abs(trustedWallOffset)<=120 && !bootIdentity.isEmpty && FreedEarnedAppTimePolicy.caps.contains(configuredCapMinutes) && FreedEarnedAppTimePolicy.caps.contains(effectiveCapMinutes) && (pendingCapMinutes.map{FreedEarnedAppTimePolicy.caps.contains($0) && $0>effectiveCapMinutes && $0==configuredCapMinutes} ?? (configuredCapMinutes==effectiveCapMinutes)) && spentSeconds>=0 && spentSeconds<=3600 && spentSeconds%300==0 && revision>=0 && revision<=9_007_199_254_740_991 && nextResetAt.isFinite && nextResetAt>anchorWall+trustedWallOffset && dayKey.range(of:#"^\d{4}-\d{2}-\d{2}$"#,options:.regularExpression) != nil && previousDays.count<=FreedEarnedAppTimePolicy.maximumRecords && Set(previousDays.map(\.dayKey)).count==previousDays.count && previousDays.allSatisfy{$0.spentSeconds>=0 && $0.spentSeconds<=3600 && $0.spentSeconds%300==0 && $0.nextResetAt.isFinite && $0.nextResetAt<nextResetAt}
 }
 func payload(now:Date,uptime:Double,boot:String?)->[String:Any] {
  ["version":2,"configuredCapMinutes":configuredCapMinutes,"effectiveCapMinutes":effectiveCapMinutes,"spentSeconds":spentSeconds,"remainingSeconds":remainingSeconds,"dayKey":dayKey,"nextResetAt":FreedEarnedAppTimePolicy.iso(nextResetAt),"pendingCapMinutes":pendingCapMinutes.map{$0 as Any} ?? NSNull(),"pendingEffectiveAt":pendingCapMinutes.map{_ in FreedEarnedAppTimePolicy.iso(nextResetAt) as Any} ?? NSNull(),"revision":revision,"clockState":clockVerified(now:now,uptime:uptime,boot:boot) ? "verified":"unverified"]
 }
}
struct FreedEarnedAppTimeOffer:Codable,Equatable {
 let id:String,ownerDigest:String,request:FreedEarnedAppTimeOfferRequest,claim:FreedAppGroupClaim,budgetDay:String,budgetRevision:Int,validUntil:Double
 let availableMethods:[String]
 var supportedPhotoTargetIds:[String]? = nil
 var superseded=false
 var payload:[String:Any] {["offerId":id,"nativeInterventionId":request.nativeInterventionId,"groupId":request.groupId,"groupRevision":request.groupRevision,"configurationGeneration":request.configurationGeneration,"scopeEpoch":request.scopeEpoch,"kind":request.kind,"requestedSeconds":request.requestedSeconds,"budgetDay":budgetDay,"budgetRevision":budgetRevision,"validUntil":FreedEarnedAppTimePolicy.iso(validUntil),"requiredActiveSeconds":request.requestedSeconds==300 ? 60:120,"requiredSteps":request.requestedSeconds==300 ? 30:60,"requiredDistinctPhotoTargets":request.requestedSeconds==300 ? 1:2,"availableMethods":availableMethods].merging(supportedPhotoTargetIds.map{["supportedPhotoTargetIds":$0]} ?? [:],uniquingKeysWith:{$1})}
}
struct FreedEarnedAppTimeLease:Codable,Equatable {let offerId:String,ownerDigest:String,seconds:Int,native:FreedAppGroupLease}
struct FreedEarnedAppTimeConsumption:Codable,Equatable {let request:FreedEarnedAppTimeGrantRequest,lease:FreedEarnedAppTimeLease,budgetAtGrant:FreedEarnedAppTimeBudget}
struct FreedEarnedAppTimeState:Codable,Equatable {
 var version=2
 var budgets:[String:FreedEarnedAppTimeBudget]=[:],offers:[String:FreedEarnedAppTimeOffer]=[:],consumptions:[String:FreedEarnedAppTimeConsumption]=[:],leases:[String:FreedEarnedAppTimeLease]=[:]
 var challengeSessions:[String:FreedChallengeEvidenceSession]? = nil
 var challengeProofs:[String:FreedChallengeEvidenceProof]? = nil
 // Cancel only unconsumed authority. Proof pointers and targets must disappear
 // in the same acknowledged transaction as revocation, including partial Find.
 @discardableResult mutating func revokeChallengeEvidence(_ id:String,failureReason:String?=nil)->FreedChallengeEvidenceSession? {
  guard var session=challengeSessions?[id],!consumptions.values.contains(where:{$0.lease.ownerDigest==session.binding.ownerDigest && $0.request.completionSessionId==session.request.completionSessionId}) else{return nil}
  for (proofId,proof) in challengeProofs ?? [:] where proof.evidenceSessionId==id && proof.consumedBy==nil {challengeProofs?.removeValue(forKey:proofId)}
  session.phase="cancelled";session.stepProofId=nil;session.photoProofIds=[];session.matchedTargetIds=[];session.stopSegment()
  if let failureReason {session.failureReason=failureReason}
  challengeSessions?[id]=session;return session
 }
 func challengeEvidenceFailure(_ request:FreedEarnedAppTimeGrantRequest,offer:FreedEarnedAppTimeOffer,consumedBy:String?=nil)->String? {
  if request.evidence.method=="timer" {return nil}
  guard let binding=FreedChallengeEvidenceBinding.make(offer) else{return "challenge-native-proof-invalid"}
  let ids=request.evidence.method=="steps" ? request.evidence.stepProofId.map{[$0]} ?? []:request.evidence.photoProofIds
  guard ids.count==(request.evidence.method=="steps" ? 1:(offer.request.requestedSeconds==300 ? 1:2)),Set(ids).count==ids.count else{return "challenge-native-proof-required"}
  var targets=[String](),captures=Set<String>(),digests=Set<String>()
  for id in ids {
   guard let proof=challengeProofs?[id],let session=challengeSessions?[proof.evidenceSessionId],proof.valid,proof.bound(to:session,binding:binding),proof.request.completionSessionId==request.completionSessionId,proof.request.templateId==request.templateId,proof.request.templateVersion==request.templateVersion,proof.method==request.evidence.method,proof.consumedBy==consumedBy else{return "challenge-native-proof-invalid"}
   if proof.method=="steps" {guard request.evidence.observedSteps==proof.observedSteps else{return "challenge-native-proof-invalid"}}
   else {guard let target=proof.targetId,let capture=proof.captureOperationId,let digest=proof.captureDigest,captures.insert(capture).inserted,digests.insert(digest).inserted,offer.supportedPhotoTargetIds?.contains(target)==true else{return "challenge-native-photo-proof-invalid"};targets.append(target)}
  }
  if request.evidence.method=="photo" {guard Set(targets).count==targets.count,targets.sorted()==FreedChallengePhotoCatalog.templateTargets(request.templateId,seconds:offer.request.requestedSeconds) else{return "challenge-native-photo-proof-invalid"}}
  return nil
 }
 mutating func consumeChallengeEvidence(_ request:FreedEarnedAppTimeGrantRequest,offer:FreedEarnedAppTimeOffer)->String? {
  if let failure=challengeEvidenceFailure(request,offer:offer){return failure}
  let ids=request.evidence.method=="steps" ? request.evidence.stepProofId.map{[$0]} ?? []:request.evidence.photoProofIds
  for id in ids {challengeProofs?[id]?.consumedBy=request.completionSessionId}
  return nil
 }
 static func decode(_ data:Data?)->Self? {
  guard let data else{return Self()}
  guard data.count<=8*1024*1024,let s=try? JSONDecoder().decode(Self.self,from:data),s.version==2,[s.budgets.count,s.offers.count,s.consumptions.count,s.leases.count].allSatisfy({$0<=FreedEarnedAppTimePolicy.maximumRecords}),s.budgets.allSatisfy({$0.value.valid && $0.key==FreedEarnedAppTimePolicy.recordKey($0.value.ownerDigest,$0.value.groupId)}) else{return nil}
  func validOffer(_ offer:FreedEarnedAppTimeOffer)->Bool {
   let q=offer.request,c=offer.claim
   return FreedEarnedAppTimePolicy.uuid(offer.id) && !offer.ownerDigest.isEmpty && q.version==2 && q.policyVersion==2 && q.kind=="ios-app-group" && q.tokenType=="application" && FreedAppGroupsPolicy.supportedBreakSeconds.contains(q.requestedSeconds) && q.groupRevision>0 && q.configurationGeneration>=0 && q.scopeEpoch>=0 && FreedAppGroupsPolicy.validId(q.groupId) && FreedEarnedAppTimePolicy.uuid(q.nativeInterventionId) && c.interventionId==q.nativeInterventionId && c.groupId==q.groupId && c.groupRevision==q.groupRevision && c.generation==q.configurationGeneration && c.scopeEpoch==q.scopeEpoch && c.claimedAt.isFinite && c.claimedAt>0 && c.claimedUptime.isFinite && c.claimedUptime>=0 && c.bootIdentity?.isEmpty==false && Data(base64Encoded:c.target) != nil && offer.budgetRevision>=0 && offer.validUntil.isFinite && offer.validUntil==c.claimedAt+1200 && offer.availableMethods.first=="timer" && Set(offer.availableMethods).count==offer.availableMethods.count && offer.availableMethods.allSatisfy{["timer","steps","photo"].contains($0)} && (offer.supportedPhotoTargetIds.map{$0==$0.sorted() && Set($0).count==$0.count && $0.allSatisfy{FreedChallengePhotoCatalog.targetIds.contains($0)}} ?? true) && (!offer.availableMethods.contains("photo") || (offer.supportedPhotoTargetIds?.count ?? 0)>=(q.requestedSeconds==300 ? 1:2)) && s.budgets[FreedEarnedAppTimePolicy.recordKey(offer.ownerDigest,q.groupId)] != nil
  }
  func validLease(_ lease:FreedEarnedAppTimeLease)->Bool {
   guard let offer=s.offers[lease.offerId],lease.ownerDigest==offer.ownerDigest,lease.native.claim==offer.claim,lease.seconds==offer.request.requestedSeconds,FreedAppGroupsPolicy.supportedBreakSeconds.contains(lease.seconds),lease.native.grantedAt.isFinite,lease.native.grantedUptime.isFinite,lease.native.grantedAt>=offer.claim.claimedAt,lease.native.grantedAt<offer.validUntil,lease.native.grantedUptime>=offer.claim.claimedUptime,lease.native.bootIdentity==offer.claim.bootIdentity,lease.native.expiresAt-lease.native.grantedAt==Double(lease.seconds),lease.native.requestedExpiry==lease.native.expiresAt else{return false}
   return true
  }
  guard s.offers.allSatisfy({$0.key==$0.value.id && validOffer($0.value)}),s.leases.allSatisfy({$0.key==FreedEarnedAppTimePolicy.recordKey($0.value.ownerDigest,$0.value.native.claim.groupId) && validLease($0.value)}),s.consumptions.allSatisfy({key,value in
   key==FreedEarnedAppTimePolicy.recordKey(value.lease.ownerDigest,value.request.completionSessionId) && value.request.version==2 && value.request.policyVersion==2 && value.request.offerId==value.lease.offerId && FreedEarnedAppTimePolicy.identifier(value.request.completionSessionId) && value.request.evidenceFailure(seconds:value.lease.seconds)==nil && s.offers[value.lease.offerId].map{s.challengeEvidenceFailure(value.request,offer:$0,consumedBy:value.request.completionSessionId)==nil}==true && validLease(value.lease) && value.budgetAtGrant.valid && value.budgetAtGrant.ownerDigest==value.lease.ownerDigest && value.budgetAtGrant.groupId==value.lease.native.claim.groupId && value.budgetAtGrant.spentSeconds>=value.lease.seconds
  }),s.leases.values.allSatisfy({lease in s.consumptions.values.contains{$0.lease==lease}}) else{return nil}
  guard (s.challengeSessions?.count ?? 0)<=FreedEarnedAppTimePolicy.maximumRecords,(s.challengeProofs?.count ?? 0)<=FreedEarnedAppTimePolicy.maximumRecords,(s.challengeSessions ?? [:]).allSatisfy({key,session in session.valid && key==session.id && s.offers[session.binding.offerId].flatMap(FreedChallengeEvidenceBinding.make)==session.binding}),(s.challengeProofs ?? [:]).allSatisfy({key,proof in proof.valid && key==proof.id && s.challengeSessions?[proof.evidenceSessionId].map{$0.request==proof.request && $0.binding==proof.binding}==true && (proof.consumedBy.map{s.consumptions[FreedEarnedAppTimePolicy.recordKey(proof.binding.ownerDigest,$0)]?.request.offerId==proof.binding.offerId} ?? true)}) else{return nil}
  return s
 }
}
