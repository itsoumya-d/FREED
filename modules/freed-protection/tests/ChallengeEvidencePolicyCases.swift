import Foundation

@main struct ChallengeEvidencePolicyCases {
 static func main() throws {
  let offerId="11111111-1111-4111-8111-111111111111"
  func request(_ method:String="steps",_ template:String="momentum-move-steps:earned-v2:300")->[String:Any] {["version":1,"offerId":offerId,"completionSessionId":"session","templateId":template,"templateVersion":2,"method":method]}
  precondition(FreedChallengeEvidenceBegin.parse(request()) != nil)
  for bad in [request().merging(["requiredSteps":1],uniquingKeysWith:{$1}),request().merging(["version":true],uniquingKeysWith:{$1}),request().merging(["method":"timer"],uniquingKeysWith:{$1})] {precondition(FreedChallengeEvidenceBegin.parse(bad)==nil)}
  let begin=FreedChallengeEvidenceBegin.parse(request())!
  let binding=FreedChallengeEvidenceBinding(ownerDigest:"owner",offerId:offerId,interventionId:offerId,groupId:"group",groupRevision:1,generation:1,scopeEpoch:1,budgetDay:"2030-01-01",budgetRevision:0,requestedSeconds:300,bootIdentity:"boot",validUntil:1400)
  var session=FreedChallengeEvidenceSession.make(begin,binding:binding,processId:"process",now:200)
  precondition(session.requiredSteps==30 && session.observedSteps==0)
  session.startSegment(now:200)
  let segment=session.segmentId!
  precondition(!session.observe(segmentId:"late",processId:"process",count:99,start:200,end:210,now:210))
  precondition(session.observe(segmentId:segment,processId:"process",count:10,start:200,end:210,now:210))
  precondition(session.observe(segmentId:segment,processId:"process",count:10,start:200,end:211,now:211))
  precondition(session.observedSteps==10,"Cumulative callbacks do not double-count")
  precondition(!session.observe(segmentId:segment,processId:"process",count:9,start:200,end:212,now:212))
  session.phase="paused";session.stopSegment()
  precondition(!session.observe(segmentId:segment,processId:"process",count:100,start:200,end:220,now:220))
  session.phase="active";session.startSegment(now:230)
  precondition(!session.observe(segmentId:segment,processId:"process",count:100,start:200,end:231,now:231))
  precondition(!session.observe(segmentId:session.segmentId!,processId:"restart",count:30,start:230,end:232,now:232))
  precondition(!session.observe(segmentId:session.segmentId!,processId:"process",count:30,start:200,end:232,now:232))
  precondition(session.observe(segmentId:session.segmentId!,processId:"process",count:20,start:230,end:240,now:240))
  precondition(session.observedSteps==30)
  let proof=FreedChallengeEvidenceProof.steps(session,now:240)
  session.phase="completed";session.stepProofId=proof.id;session.stopSegment()
  precondition(proof.bound(to:session,binding:binding) && proof.observedSteps==30)
  var changed=binding;changed.scopeEpoch += 1
  precondition(!proof.bound(to:session,binding:changed))
  var cancelled=session;cancelled.phase="cancelled"
  precondition(!proof.bound(to:cancelled,binding:binding))
  precondition(FreedChallengePhotoCatalog.reviewedTargetIds(identity:["provider":"apple-vision","classifierRevision":"unknown","runtimeRevision":"ios-99","ruleRevision":"freed-photo-targets-v1"]).isEmpty)
  precondition(!FreedChallengePhotoEvaluation(provider:"apple-vision",classifierRevision:"r1",runtimeRevision:"ios-26",ruleRevision:"v1",targetId:"flower",calibrationCount:50,truePositive:94,falsePositive:6,falseNegative:6,heldOutCount:106).passed)
  precondition(!FreedChallengePhotoEvaluation(provider:"apple-vision",classifierRevision:"r1",runtimeRevision:"ios-26",ruleRevision:"v1",targetId:"flower",calibrationCount:0,truePositive:100,falsePositive:0,falseNegative:0,heldOutCount:100).passed)
  precondition(FreedChallengePhotoCatalog.templateTargets("momentum-find-chair-cup:earned-v2:600",seconds:600)==["chair","cup"])
  precondition(FreedChallengePhotoCatalog.templateTargets("momentum-find-plant-flower:earned-v2:600",seconds:600)==nil)
  precondition(FreedChallengePhotoCatalog.templateTargets("momentum-find-flower-plant:earned-v2:600",seconds:600)==nil)
  print("Challenge evidence policy: strict native requests, cumulative observations, pause/late/restart rejection, binding fences, uncalibrated photo catalog passed")
 }
}
