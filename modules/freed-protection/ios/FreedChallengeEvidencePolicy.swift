import Foundation
import CryptoKit
#if canImport(Vision) && os(iOS)
import Vision
#endif

// Native observations are authority. Public receipts intentionally omit owner,
// sensor timestamps, classifier labels and image data.
struct FreedChallengeEvidenceBegin:Codable,Equatable {
 let version:Int,offerId:String,completionSessionId:String,templateId:String,templateVersion:Int,method:String
 static func parse(_ input:[String:Any])->Self? {
  guard Set(input.keys)==Set(["version","offerId","completionSessionId","templateId","templateVersion","method"]),FreedEarnedAppTimePolicy.integer(input,"version")==1,FreedEarnedAppTimePolicy.integer(input,"templateVersion")==2,let r=FreedEarnedAppTimePolicy.decode(input,as:Self.self),FreedEarnedAppTimePolicy.uuid(r.offerId),[r.completionSessionId,r.templateId].allSatisfy(FreedEarnedAppTimePolicy.identifier),["steps","photo"].contains(r.method) else{return nil};return r
 }
}
struct FreedChallengeEvidenceBinding:Codable,Equatable {
 let ownerDigest:String,offerId:String,interventionId:String,groupId:String,groupRevision:Int,generation:Int
 var scopeEpoch:Int
 let budgetDay:String,budgetRevision:Int,requestedSeconds:Int,bootIdentity:String,validUntil:Double
 static func make(_ offer:FreedEarnedAppTimeOffer)->Self? {
  guard let boot=offer.claim.bootIdentity else{return nil}
  return Self(ownerDigest:offer.ownerDigest,offerId:offer.id,interventionId:offer.claim.interventionId,groupId:offer.request.groupId,groupRevision:offer.request.groupRevision,generation:offer.request.configurationGeneration,scopeEpoch:offer.request.scopeEpoch,budgetDay:offer.budgetDay,budgetRevision:offer.budgetRevision,requestedSeconds:offer.request.requestedSeconds,bootIdentity:boot,validUntil:offer.validUntil)
 }
}
struct FreedChallengeEvidenceSession:Codable,Equatable {
 let id:String,request:FreedChallengeEvidenceBegin,binding:FreedChallengeEvidenceBinding,processId:String,startedAt:Double,supportedTargetIds:[String]
 var phase:String,observedSteps:Int,matchedTargetIds:[String],stepProofId:String?,photoProofIds:[String],failureReason:String?
 var segmentId:String?,segmentStartedAt:Double?,segmentSteps:Int=0
 var requiredSteps:Int {binding.requestedSeconds==300 ? 30:60}
 var requiredPhotoTargets:Int {binding.requestedSeconds==300 ? 1:2}
 static func make(_ request:FreedChallengeEvidenceBegin,binding:FreedChallengeEvidenceBinding,processId:String,now:Double,supportedTargetIds:[String]=[])->Self {
  Self(id:UUID().uuidString.lowercased(),request:request,binding:binding,processId:processId,startedAt:now,supportedTargetIds:supportedTargetIds,phase:"active",observedSteps:0,matchedTargetIds:[],stepProofId:nil,photoProofIds:[],failureReason:nil,segmentId:nil,segmentStartedAt:nil)
 }
 mutating func startSegment(now:Double) {segmentId=UUID().uuidString.lowercased();segmentStartedAt=now;segmentSteps=0}
 mutating func stopSegment() {segmentId=nil;segmentStartedAt=nil;segmentSteps=0}
 // Counts are cumulative within a CMPedometer interval, never a JS step count.
 @discardableResult mutating func observe(segmentId:String,processId:String,count:Int,start:Double,end:Double,now:Double)->Bool {
  guard request.method=="steps",phase=="active",self.processId==processId,self.segmentId==segmentId,let segmentStartedAt,count>=segmentSteps,count<=10000,start.isFinite,end.isFinite,now.isFinite,abs(start-segmentStartedAt)<=1,end>=start,end<=now+5,now<binding.validUntil else{return false}
  observedSteps=min(10000,observedSteps+count-segmentSteps);segmentSteps=count;return true
 }
 var valid:Bool {
  FreedEarnedAppTimePolicy.uuid(id) && request.version==1 && request.templateVersion==2 && ["steps","photo"].contains(request.method) && [request.completionSessionId,request.templateId].allSatisfy(FreedEarnedAppTimePolicy.identifier) && request.offerId==binding.offerId && !processId.isEmpty && processId.count<=160 && startedAt.isFinite && startedAt>0 && startedAt<binding.validUntil && ["active","paused","cancelled","completed"].contains(phase) && observedSteps>=0 && observedSteps<=10000 && matchedTargetIds.count<=requiredPhotoTargets && Set(matchedTargetIds).count==matchedTargetIds.count && supportedTargetIds==supportedTargetIds.sorted() && Set(supportedTargetIds).count==supportedTargetIds.count && supportedTargetIds.allSatisfy{FreedChallengePhotoCatalog.targetIds.contains($0)} && matchedTargetIds.allSatisfy{supportedTargetIds.contains($0)} && photoProofIds.count==matchedTargetIds.count && photoProofIds.allSatisfy(FreedEarnedAppTimePolicy.uuid) && (stepProofId.map(FreedEarnedAppTimePolicy.uuid) ?? true) && (failureReason.map{FreedEarnedAppTimePolicy.identifier($0)} ?? true) && segmentSteps>=0 && segmentSteps<=10000 && ((segmentId==nil && segmentStartedAt==nil && segmentSteps==0) || (phase=="active" && request.method=="steps" && segmentId.map(FreedEarnedAppTimePolicy.uuid)==true && segmentStartedAt.map{$0.isFinite && $0>=startedAt && $0<binding.validUntil}==true)) && (phase != "completed" || (request.method=="steps" ? observedSteps>=requiredSteps && stepProofId != nil && photoProofIds.isEmpty:stepProofId==nil && photoProofIds.count==requiredPhotoTargets))
 }
 var payload:[String:Any] {["evidenceSessionId":id,"offerId":request.offerId,"completionSessionId":request.completionSessionId,"templateId":request.templateId,"templateVersion":2,"method":request.method,"phase":phase,"observedSteps":observedSteps,"requiredSteps":requiredSteps,"requiredPhotoTargets":requiredPhotoTargets,"supportedTargetIds":supportedTargetIds,"matchedTargetIds":phase=="cancelled" ? []:matchedTargetIds,"stepProofId":phase=="cancelled" ? NSNull():stepProofId.map{$0 as Any} ?? NSNull(),"photoProofIds":phase=="cancelled" ? []:photoProofIds]}
}
struct FreedChallengeEvidenceProof:Codable,Equatable {
 let id:String,evidenceSessionId:String,request:FreedChallengeEvidenceBegin,binding:FreedChallengeEvidenceBinding,method:String,observedSteps:Int,createdAt:Double
 let targetId:String?,captureOperationId:String?,captureDigest:String?,providerRevision:String?
 var consumedBy:String?
 static func steps(_ session:FreedChallengeEvidenceSession,now:Double)->Self {Self(id:UUID().uuidString.lowercased(),evidenceSessionId:session.id,request:session.request,binding:session.binding,method:"steps",observedSteps:session.observedSteps,createdAt:now,targetId:nil,captureOperationId:nil,captureDigest:nil,providerRevision:nil,consumedBy:nil)}
 static func photo(_ session:FreedChallengeEvidenceSession,targetId:String,operationId:String,digest:String,providerRevision:String,now:Double)->Self {Self(id:UUID().uuidString.lowercased(),evidenceSessionId:session.id,request:session.request,binding:session.binding,method:"photo",observedSteps:0,createdAt:now,targetId:targetId,captureOperationId:operationId,captureDigest:digest,providerRevision:providerRevision,consumedBy:nil)}
 func bound(to session:FreedChallengeEvidenceSession,binding:FreedChallengeEvidenceBinding)->Bool {session.phase=="completed" && evidenceSessionId==session.id && request==session.request && self.binding==binding && session.binding==binding && method==request.method && createdAt>=session.startedAt && createdAt<binding.validUntil && (method=="steps" ? session.stepProofId==id && observedSteps>=session.requiredSteps:session.photoProofIds.contains(id) && targetId.map{session.matchedTargetIds.contains($0)}==true)}
 var valid:Bool {FreedEarnedAppTimePolicy.uuid(id) && FreedEarnedAppTimePolicy.uuid(evidenceSessionId) && request.offerId==binding.offerId && method==request.method && createdAt.isFinite && createdAt>0 && createdAt<binding.validUntil && (consumedBy.map(FreedEarnedAppTimePolicy.identifier) ?? true) && (method=="steps" ? observedSteps >= (binding.requestedSeconds==300 ? 30:60) && observedSteps<=10000 && targetId==nil && captureOperationId==nil && captureDigest==nil && providerRevision==nil:observedSteps==0 && targetId.map{FreedChallengePhotoCatalog.targetIds.contains($0)}==true && captureOperationId.map(FreedEarnedAppTimePolicy.identifier)==true && captureDigest?.range(of:#"^[a-f0-9]{64}$"#,options:.regularExpression) != nil && providerRevision?.isEmpty==false)}
}
enum FreedChallengeEvidenceReceipt {
 static func make(_ session:FreedChallengeEvidenceSession?=nil,reason:String?=nil,supported:Bool=true)->[String:Any] {["version":1,"supported":supported,"accepted":reason==nil && session != nil,"reason":reason.map{$0 as Any} ?? NSNull(),"session":session.map{$0.payload as Any} ?? NSNull()]}
 static func photo(_ session:FreedChallengeEvidenceSession?=nil,reason:String?=nil,result:String="unavailable",targetId:String?=nil,proofId:String?=nil)->[String:Any] {var r=make(session,reason:reason);r["result"]=result;r["targetId"]=targetId.map{$0 as Any} ?? NSNull();r["proofId"]=proofId.map{$0 as Any} ?? NSNull();return r}
 static func sessionId(_ input:[String:Any],phase:Bool=false)->String? {guard Set(input.keys)==Set(phase ? ["version","evidenceSessionId","phase"]:["version","evidenceSessionId"]),FreedEarnedAppTimePolicy.integer(input,"version")==1,let id=input["evidenceSessionId"] as? String,FreedEarnedAppTimePolicy.uuid(id),!phase || ["active","paused","cancelled"].contains(input["phase"] as? String ?? "") else{return nil};return id}
}
struct FreedChallengePhotoEvaluation:Equatable {
 let provider:String,classifierRevision:String,runtimeRevision:String,ruleRevision:String,targetId:String,calibrationCount:Int,truePositive:Int,falsePositive:Int,falseNegative:Int,heldOutCount:Int
 var passed:Bool {provider=="apple-vision" && !classifierRevision.isEmpty && !runtimeRevision.isEmpty && !ruleRevision.isEmpty && FreedChallengePhotoCatalog.targetIds.contains(targetId) && calibrationCount>0 && truePositive>0 && falsePositive>=0 && falseNegative>=0 && heldOutCount>=truePositive+falsePositive+falseNegative && Double(truePositive)/Double(truePositive+falsePositive)>=0.95 && Double(truePositive)/Double(truePositive+falseNegative)>=0.85}
}
enum FreedChallengePhotoCatalog {
 static let targetIds:Set<String>=["flower","plant","chair","cup","shoe","branch","clock","fruit"]
 static let labels:[String:[String]]=["flower":["flower","blossom"],"plant":["plant"],"chair":["chair"],"cup":["cup","mug"],"shoe":["shoe","sneakers"],"branch":["branch"],"clock":["clock"],"fruit":["fruit"]]
 // Empty deliberately: no measured held-out Apple Vision packet has passed.
 // A reviewed model/runtime-specific receipt is required before adding entries.
 static let reviewedEvaluations:[FreedChallengePhotoEvaluation]=[]
 static var nativeSupportedTargetIds:[String] {
  #if canImport(Vision) && os(iOS)
  let request=VNClassifyImageRequest(),os=ProcessInfo.processInfo.operatingSystemVersion
  let identity:[String:Any]=["provider":"apple-vision","classifierRevision":"VNClassifyImageRequest:revision-\(request.revision)","runtimeRevision":"ios-\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)","ruleRevision":"freed-photo-targets-v1"]
  let available=Set(((try? request.supportedIdentifiers()) ?? []).flatMap{$0.split(separator:",").map{String($0).lowercased().trimmingCharacters(in:.whitespaces)}})
  return reviewedTargetIds(identity:identity).filter{target in labels[target]?.contains(where:available.contains)==true}
  #else
  return []
  #endif
 }
 static func reviewedTargetIds(identity:[String:Any])->[String] {reviewedEvaluations.filter{$0.passed && $0.provider==identity["provider"] as? String && $0.classifierRevision==identity["classifierRevision"] as? String && $0.runtimeRevision==identity["runtimeRevision"] as? String && $0.ruleRevision==identity["ruleRevision"] as? String}.map(\.targetId).sorted()}
 static func templateTargets(_ template:String,seconds:Int)->[String]? {
  let prefix="momentum-find-",suffix=":earned-v2:\(seconds)"
  guard FreedAppGroupsPolicy.supportedBreakSeconds.contains(seconds),template.hasPrefix(prefix),template.hasSuffix(suffix) else{return nil}
  let targets=String(template.dropFirst(prefix.count).dropLast(suffix.count)).split(separator:"-").map(String.init)
  guard targets.count==(seconds==300 ? 1:2),targets==targets.sorted(),Set(targets).count==targets.count,targets.allSatisfy({targetIds.contains($0)}) else{return nil}
  let overlapping:Set<String>=["flower","plant","branch","fruit"]
  guard targets.count<2 || !targets.allSatisfy({overlapping.contains($0)}) else{return nil};return targets
 }
}

struct FreedNativeChallengePhoto {
 let url:URL,operationId:String,capturedAt:Double,digest:String
}
enum FreedChallengeOwnedCaptureFiles {
 static var nativeDirectory:URL {FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask)[0].appendingPathComponent("freed-native-challenge-photos-v1",isDirectory:true)}
 static func removeCompatibilityCapture(_ uri:String)->Bool {
  guard let url=URL(string:uri),url.isFileURL,let cache=FileManager.default.urls(for:.cachesDirectory,in:.userDomainMask).first else{return true}
  let owned=cache.appendingPathComponent("freed-challenge-photos-v1",isDirectory:true).standardizedFileURL
  guard url.standardizedFileURL.deletingLastPathComponent()==owned,url.standardizedFileURL==url.resolvingSymlinksInPath().standardizedFileURL,url.lastPathComponent.range(of:#"^[A-Za-z0-9_-]+\.(jpg|jpeg|png|heic)$"#,options:[.regularExpression,.caseInsensitive]) != nil else{return true}
  guard FileManager.default.fileExists(atPath:url.path) else{return true}
  do{try FileManager.default.removeItem(at:url);return true}catch{return false}
 }
 static func cleanupAbandoned()->Bool {
  let root=nativeDirectory
  guard FileManager.default.fileExists(atPath:root.path) else{return true}
  guard let files=try? FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil),files.count<=128 else{return false}
  var cleaned=true
  for file in files where file.lastPathComponent.range(of:#"^[a-f0-9-]{36}\.jpg$"#,options:.regularExpression) != nil {do{try FileManager.default.removeItem(at:file)}catch{cleaned=false}}
  return cleaned
 }
 static func save(_ bytes:Data,operationId:String,now:Double)throws->FreedNativeChallengePhoto {
  guard !bytes.isEmpty,bytes.count<=20*1024*1024,FreedEarnedAppTimePolicy.identifier(operationId),now.isFinite else{throw CocoaError(.fileWriteInvalidFileName)}
  let root=nativeDirectory
  try FileManager.default.createDirectory(at:root,withIntermediateDirectories:true)
  guard let files=try? FileManager.default.contentsOfDirectory(at:root,includingPropertiesForKeys:nil),files.count<128 else{throw CocoaError(.fileWriteOutOfSpace)}
  let url=root.appendingPathComponent(UUID().uuidString.lowercased()+".jpg")
  do {
   #if os(iOS)
   try bytes.write(to:url,options:[.atomic,.completeFileProtection])
   #else
   try bytes.write(to:url,options:.atomic)
   #endif
  }catch{try? FileManager.default.removeItem(at:url);throw error}
  let digest=SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined()
  return FreedNativeChallengePhoto(url:url,operationId:operationId,capturedAt:now,digest:digest)
 }
 static func remove(_ capture:FreedNativeChallengePhoto)->Bool {
  guard capture.url.deletingLastPathComponent()==nativeDirectory else{return false}
  guard FileManager.default.fileExists(atPath:capture.url.path) else{return true}
  do{try FileManager.default.removeItem(at:capture.url);return true}catch{return false}
 }
}
