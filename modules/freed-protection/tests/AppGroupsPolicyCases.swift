import Foundation
@main struct Cases {
 static func main() throws {
  let draft=FreedAppGroupsPolicy.draft(id:"group-a",name:"Work",slot:0)
  precondition(!draft.enabled && draft.rule.kind == "daily-limit" && draft.rule.limitMinutes == 30 && draft.packages.isEmpty)
  let window=FreedAppGroupRule(kind:"scheduled",startMinute:1320,endMinute:480,days:[5])
  precondition(FreedAppGroupsPolicy.validateRule(window,enabled:true))
  precondition(FreedAppGroupsPolicy.windowActive(window,day:5,minute:1320))
  precondition(FreedAppGroupsPolicy.windowActive(window,day:6,minute:479))
  precondition(!FreedAppGroupsPolicy.windowActive(window,day:6,minute:480))
  precondition(!FreedAppGroupsPolicy.windowActive(window,day:4,minute:1320))
  precondition(!FreedAppGroupsPolicy.validateRule(FreedAppGroupRule(kind:"scheduled",startMinute:100,endMinute:110,days:[1]),enabled:true))
  precondition(FreedAppGroupsPolicy.canStage(existingActivities:19,newActivities:1))
  precondition(!FreedAppGroupsPolicy.canStage(existingActivities:19,newActivities:2))
  let six=(0..<6).map{FreedAppGroupsPolicy.draft(id:"group-\($0)",name:"Group",slot:$0)}
  precondition(FreedAppGroupsPolicy.validateGroups(six))
  precondition(!FreedAppGroupsPolicy.validateGroups(six+[draft]))
  precondition(!FreedAppGroupsPolicy.validateGroups([draft,draft]))
  precondition(!FreedAppGroupsPolicy.matchesRevision(store:2,group:1,expectedStore:1,expectedGroup:1))
  let claim=FreedAppGroupClaim(interventionId:"d0e5d591-6d30-45f2-959e-a114fa9fb03a",groupId:"group-a",groupRevision:1,target:"opaque",generation:2,scopeEpoch:3,claimedAt:100,claimedUptime:100,bootIdentity:"boot-A")
  precondition(FreedAppGroupsPolicy.authorize(claim,groupId:"group-a",revision:1,targetMember:true,generation:2,scopeEpoch:3,now:110,uptime:110,requestedExpiry:130,bootIdentity:"boot-A") == 130)
  precondition(FreedAppGroupsPolicy.authorize(claim,groupId:"group-a",revision:2,targetMember:true,generation:2,scopeEpoch:3,now:110,uptime:110,requestedExpiry:130,bootIdentity:"boot-A") == nil)
  precondition(FreedAppGroupsPolicy.authorize(claim,groupId:"group-a",revision:1,targetMember:false,generation:2,scopeEpoch:3,now:110,uptime:110,requestedExpiry:130,bootIdentity:"boot-A") == nil)
  precondition(FreedAppGroupsPolicy.authorize(claim,groupId:"group-a",revision:1,targetMember:true,generation:2,scopeEpoch:4,now:110,uptime:110,requestedExpiry:130,bootIdentity:"boot-A") == nil)
  var ownerState=FreedAppGroupsState();ownerState.ownerDigest="owner-a-digest";ownerState.scopeEpoch=3;ownerState.claim=claim
  precondition(FreedAppGroupsPolicy.ownerChange(state:ownerState,newDigest:"owner-a-digest",hadBoundScope:false,scopeChanged:true).claim == claim)
  let changed=FreedAppGroupsPolicy.ownerChange(state:ownerState,newDigest:"owner-b-digest",hadBoundScope:false,scopeChanged:false)
  precondition(changed.claim==nil && changed.scopeEpoch==4)
  precondition(FreedAppGroupsPolicy.ownerChange(state:ownerState,newDigest:"owner-a-digest",hadBoundScope:true,scopeChanged:true).claim==nil)
  print("Production groups: six/capacity/draft/revision/overnight/target/scope authority cases passed")
 }
}
