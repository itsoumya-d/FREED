import Foundation

@main struct EarnedPolicyCases {
 static func main()throws {
  let now=Date(timeIntervalSince1970:1_900_022_400),boot="boot-A"
  var budget=try FreedEarnedAppTimeBudget.make(owner:"owner",group:"group",now:now,uptime:100,boot:boot,timeZone:TimeZone(secondsFromGMT:0)!)
  precondition(budget.effectiveCapMinutes==20 && budget.remainingSeconds==1200)
  var midnight=try FreedEarnedAppTimeBudget.make(owner:"owner",group:"group",now:Date(timeIntervalSince1970:budget.nextResetAt-2),uptime:100,boot:boot,timeZone:TimeZone(secondsFromGMT:0)!)
  midnight.spentSeconds=300
  precondition(try! midnight.advance(now:Date(timeIntervalSince1970:midnight.nextResetAt+2),uptime:100,boot:boot))
  precondition(midnight.spentSeconds==300,"Small accepted wall skew cannot advance the budget day before monotonic time reaches its boundary")
  var malformed=budget;malformed.revision=Int.max
  precondition(!malformed.valid,"Unsafe stored revision must be rejected before incrementing it")
  budget.spentSeconds=600
  let frozenReset=budget.nextResetAt,originalZone=NSTimeZone.default
  NSTimeZone.default=TimeZone(secondsFromGMT:14*3600)!
  precondition(try! budget.advance(now:now.addingTimeInterval(60),uptime:160,boot:boot))
  precondition(budget.nextResetAt==frozenReset && budget.spentSeconds==600,"Changing device timezone cannot reset today's budget")
  NSTimeZone.default=originalZone
  try budget.setCap(30)
  precondition(budget.configuredCapMinutes==30 && budget.effectiveCapMinutes==20 && budget.pendingCapMinutes==30 && budget.remainingSeconds==600)
  try budget.setCap(5)
  precondition(budget.effectiveCapMinutes==5 && budget.pendingCapMinutes==nil && budget.spentSeconds==600 && budget.remainingSeconds==0)
  try budget.setCap(20)
  let next=Date(timeIntervalSince1970:budget.nextResetAt+1),elapsed=next.timeIntervalSince(now)
  precondition(try! budget.advance(now:next,uptime:100+elapsed,boot:boot))
  precondition(budget.spentSeconds==0 && budget.effectiveCapMinutes==20 && budget.previousDays.count==1 && budget.previousDays[0].spentSeconds==600)
  let retained=budget
  precondition(try! !budget.advance(now:now,uptime:100+elapsed+1,boot:boot))
  precondition(budget==retained,"Clock rollback cannot clear spent state or tombstones")
  precondition(try! !budget.advance(now:next.addingTimeInterval(86_400),uptime:100+elapsed+86_400,boot:"boot-B"))
  precondition(budget==retained,"A new boot cannot prove a fresh day")
  precondition(try! !budget.advance(now:next.addingTimeInterval(86_400),uptime:101+elapsed,boot:boot))
  precondition(budget==retained,"A wall-clock jump cannot reset cap")
  let offer:[String:Any]=["version":2,"policyVersion":2,"nativeInterventionId":"11111111-1111-4111-8111-111111111111","groupId":"group","groupRevision":1,"configurationGeneration":0,"scopeEpoch":0,"kind":"ios-app-group","tokenType":"application","requestedSeconds":300]
  precondition(FreedEarnedAppTimeOfferRequest.parse(offer)?.requestedSeconds==300)
  for bad in [offer.merging(["requestedSeconds":120],uniquingKeysWith:{$1}),offer.merging(["scopeEpoch":true],uniquingKeysWith:{$1}),offer.merging(["target":"url"],uniquingKeysWith:{$1})] {precondition(FreedEarnedAppTimeOfferRequest.parse(bad)==nil)}
  func grant(_ category:String="breathe",_ method:String="timer",_ duration:Int=60,_ template:String="momentum-breathe-soft:earned-v2:300")->[String:Any] { ["version":2,"policyVersion":2,"offerId":"11111111-1111-4111-8111-111111111111","completionSessionId":"completion","category":category,"templateId":template,"templateVersion":2,"evidence":["method":method,"activeDurationSec":duration,"observedSteps":0,"photoProofIds":[String]()]] }
  precondition(FreedEarnedAppTimeGrantRequest.parse(grant())!.evidenceFailure(seconds:300)==nil)
  precondition(FreedEarnedAppTimeGrantRequest.parse(grant("breathe","timer",59))!.evidenceFailure(seconds:300) != nil)
  precondition(FreedEarnedAppTimeGrantRequest.parse(grant())!.evidenceFailure(seconds:600) != nil)
  precondition(FreedEarnedAppTimeGrantRequest.parse(grant("move","timer",120,"momentum-move-seated:earned-v2:600"))!.evidenceFailure(seconds:600)==nil)
  precondition(FreedEarnedAppTimeGrantRequest.parse(grant("find","photo",0,"momentum-find-flower:earned-v2:300"))!.evidenceFailure(seconds:300)=="photo-native-proof-required")
  precondition(FreedEarnedAppTimeGrantRequest.parse(grant("move","steps",0,"momentum-move-steps:earned-v2:300"))!.evidenceFailure(seconds:300)=="steps-native-proof-required")
  precondition(FreedEarnedAppTimeGrantRequest.parse(grant().merging(["seconds":600],uniquingKeysWith:{$1}))==nil)
  print("Earned-time v2 policy: cap transitions, retained day tombstones, wall/boot rollback refusal, exact parser and authored evidence requirements passed")
 }
}
