import Foundation
import Vision
import CryptoKit

// Offline local-only evaluator. Input files remain local; the report contains
// sample IDs/errors and digests, never image bytes, paths or raw classifier labels.
// A macOS report cannot qualify a different iOS model/runtime identity.
struct PhotoEvaluationManifest:Decodable {
 let version:Int
 let samples:[Sample]
 struct Sample:Decodable {let id:String,path:String,targetId:String,present:Bool,partition:String}
}
struct PhotoEvaluationCount:Codable {
 var calibrationCount=0,heldOutCount=0,truePositive=0,falsePositive=0,falseNegative=0,trueNegative=0
 var errors:[String]=[]
 var precision:Double? {truePositive+falsePositive==0 ? nil:Double(truePositive)/Double(truePositive+falsePositive)}
 var recall:Double? {truePositive+falseNegative==0 ? nil:Double(truePositive)/Double(truePositive+falseNegative)}
 var passed:Bool {calibrationCount>0 && (precision ?? 0)>=0.95 && (recall ?? 0)>=0.85}
}
@main struct ChallengePhotoHeldOutEvaluator {
 static func main()throws {
  guard CommandLine.arguments.count==3 else{throw NSError(domain:"FreedPhotoEvaluation",code:1,userInfo:[NSLocalizedDescriptionKey:"Supply a local version1 sample manifest and a report output path."])}
  let manifestURL=URL(fileURLWithPath:CommandLine.arguments[1]),outputURL=URL(fileURLWithPath:CommandLine.arguments[2])
  let data=try Data(contentsOf:manifestURL)
  guard data.count<=2*1024*1024 else{throw CocoaError(.fileReadTooLarge)}
  let manifest=try JSONDecoder().decode(PhotoEvaluationManifest.self,from:data)
  guard manifest.version==1,!manifest.samples.isEmpty,manifest.samples.count<=4096,Set(manifest.samples.map(\.id)).count==manifest.samples.count,manifest.samples.allSatisfy({FreedEarnedAppTimePolicy.identifier($0.id) && FreedChallengePhotoCatalog.targetIds.contains($0.targetId) && ["calibration","held-out"].contains($0.partition)}) else{throw CocoaError(.fileReadCorruptFile)}
  var hashes=Set<String>(),rows=[[String:Any]](),counts=[String:PhotoEvaluationCount]()
  let request=VNClassifyImageRequest(),os=ProcessInfo.processInfo.operatingSystemVersion
  #if os(iOS)
  let runtime="ios-\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
  #else
  let runtime="macos-\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)"
  #endif
  for sample in manifest.samples {
   let url=sample.path.hasPrefix("/") ? URL(fileURLWithPath:sample.path):manifestURL.deletingLastPathComponent().appendingPathComponent(sample.path)
   let bytes=try Data(contentsOf:url)
   guard !bytes.isEmpty,bytes.count<=20*1024*1024 else{throw CocoaError(.fileReadTooLarge)}
   let digest=SHA256.hash(data:bytes).map{String(format:"%02x",$0)}.joined()
   guard hashes.insert(digest).inserted else{throw NSError(domain:"FreedPhotoEvaluation",code:2,userInfo:[NSLocalizedDescriptionKey:"Duplicate image content cannot cross calibration/held-out partitions or be counted twice."])}
   let classifier=VNClassifyImageRequest();var matched=false,failure=false
   do {
    try VNImageRequestHandler(url:url,options:[:]).perform([classifier])
    let expected=FreedChallengePhotoCatalog.labels[sample.targetId] ?? []
    matched=(classifier.results ?? []).prefix(12).contains{observation in observation.confidence>=0.65 && observation.identifier.split(separator:",").contains{label in expected.contains{FreedPhotoTargetMatching.matches(observed:String(label),expected:$0)}}}
   }catch{failure=true}
   var count=counts[sample.targetId] ?? PhotoEvaluationCount()
   let outcome:String
   if sample.partition=="calibration" {count.calibrationCount += 1;outcome=failure ? "unavailable":matched ? "matched":"uncertain"}
   else {
    count.heldOutCount += 1
    if matched && sample.present {count.truePositive += 1;outcome="true-positive"}
    else if matched {count.falsePositive += 1;count.errors.append(sample.id);outcome="false-positive"}
    else if sample.present {count.falseNegative += 1;count.errors.append(sample.id);outcome=failure ? "unavailable-false-negative":"false-negative"}
    else {count.trueNegative += 1;outcome=failure ? "unavailable-true-negative":"true-negative"}
   }
   counts[sample.targetId]=count
   rows.append(["id":sample.id,"targetId":sample.targetId,"partition":sample.partition,"digest":digest,"outcome":outcome])
  }
  let summary=counts.keys.sorted().map{target->[String:Any] in let c=counts[target]!;return["targetId":target,"calibrationCount":c.calibrationCount,"heldOutCount":c.heldOutCount,"truePositive":c.truePositive,"falsePositive":c.falsePositive,"falseNegative":c.falseNegative,"trueNegative":c.trueNegative,"precision":c.precision.map{$0 as Any} ?? NSNull(),"recall":c.recall.map{$0 as Any} ?? NSNull(),"passedMetrics":c.passed,"errors":c.errors]}
  let report:[String:Any]=["version":1,"provider":"apple-vision","classifierRevision":"VNClassifyImageRequest:revision-\(request.revision)","runtimeRevision":runtime,"ruleRevision":"freed-photo-targets-v1","confidenceThreshold":0.65,"requiredPrecision":0.95,"requiredRecall":0.85,"calibrationHeldOutSeparated":true,"catalogAutoEnabled":false,"deviceValidation":false,"targets":summary,"samples":rows]
  try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:outputURL,options:.atomic)
  print("Saved local held-out evaluation with \(manifest.samples.count) samples; catalog remains disabled pending review and matching iOS device/runtime evidence.")
 }
}
