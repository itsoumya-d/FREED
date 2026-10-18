import Foundation
import Darwin
@main struct EarnedWindow20PolicyCases {
 static func main()throws {
  func expect(_ c:Bool,_ message:String){if !c{FileHandle.standardError.write(Data(("FAIL: "+message+"\n").utf8));exit(1)}}
  let offer:[String:Any]=["version":2,"policyVersion":2,"nativeInterventionId":"11111111-1111-4111-8111-111111111111","groupId":"group","groupRevision":1,"configurationGeneration":0,"scopeEpoch":0,"kind":"ios-app-group","tokenType":"application","requestedSeconds":1200]
  expect(FreedEarnedAppTimeOfferRequest.parse(offer)?.requestedSeconds==1200,"Native20 duration parser must accept1200")
  for unsupported in [0,120,900,1800]{expect(FreedEarnedAppTimeOfferRequest.parse(offer.merging(["requestedSeconds":unsupported],uniquingKeysWith:{$1}))==nil,"Only advertised durations can produce a live offer")}
  func timer(_ seconds:Int)->[String:Any] {["version":2,"policyVersion":2,"offerId":"11111111-1111-4111-8111-111111111111","completionSessionId":"session","category":"breathe","templateId":"momentum-breathe-soft:earned-v2:1200","templateVersion":2,"evidence":["method":"timer","activeDurationSec":seconds,"observedSteps":0,"photoProofIds":[String]()]]}
  expect(FreedEarnedAppTimeGrantRequest.parse(timer(120))?.evidenceFailure(seconds:1200)==nil,"20 window needs comfortable120seconds timer")
  expect(FreedEarnedAppTimeGrantRequest.parse(timer(119))?.evidenceFailure(seconds:1200) != nil,"Short20 timer cannot grant")
  expect(FreedChallengePhotoCatalog.templateTargets("momentum-find-chair-cup:earned-v2:1200",seconds:1200)==["chair","cup"],"20 authored photo schema requires two distinct sorted targets")
  expect(FreedChallengePhotoCatalog.templateTargets("momentum-find-flower-plant:earned-v2:1200",seconds:1200)==nil,"20 cannot use overlapping broad plant targets")
  expect(FreedChallengePhotoCatalog.nativeSupportedTargetIds.isEmpty,"No actual passing evaluation: photo stays disabled")
  let legacy=FreedAppGroupsPolicy.draft(id:"group",name:"Focus",slot:0),raw=try JSONSerialization.jsonObject(with:JSONEncoder().encode(legacy)) as! [String:Any]
  for unsupported in [900,1800]{let encoded=try JSONSerialization.data(withJSONObject:raw.merging(["preferredBreakSeconds":unsupported],uniquingKeysWith:{$1}));let g=try JSONDecoder().decode(FreedAppGroupDefinition.self,from:encoded);expect(!FreedAppGroupsPolicy.validateGroups([g]),"Stored unsupported preference cannot be silently accepted")}
  let restored=try JSONDecoder().decode(FreedAppGroupDefinition.self,from:JSONEncoder().encode(legacy));expect(FreedAppGroupsPolicy.validateGroups([restored]) && restored.rule.kind=="daily-limit" && restored.rule.limitMinutes==30 && !restored.enabled,"Legacy/default disabled daily30 rule remains valid")
  print("Native20 policy supported durations, comfortable evidence, disabled photo and legacy/preference validation passed")
 }
}
