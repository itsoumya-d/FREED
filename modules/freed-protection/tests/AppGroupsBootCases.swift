import Foundation
@main struct Cases {
 static func main(){
  let claim=FreedAppGroupClaim(interventionId:"d0e5d591-6d30-45f2-959e-a114fa9fb03a",groupId:"group-a",groupRevision:1,target:"opaque",generation:2,scopeEpoch:3,claimedAt:1000,claimedUptime:5)
  precondition(FreedAppGroupsPolicy.authorize(claim,groupId:"group-a",revision:1,targetMember:true,generation:2,scopeEpoch:3,now:1100,uptime:50,requestedExpiry:1200)==nil,"a plausible greater uptime cannot establish same boot")
  var sameBoot=claim;sameBoot.bootIdentity="boot-A"
  precondition(FreedAppGroupsPolicy.authorize(sameBoot,groupId:"group-a",revision:1,targetMember:true,generation:2,scopeEpoch:3,now:1100,uptime:50,requestedExpiry:1200,bootIdentity:"boot-B")==nil)
  precondition(FreedAppGroupsPolicy.authorize(sameBoot,groupId:"group-a",revision:1,targetMember:true,generation:2,scopeEpoch:3,now:1100,uptime:50,requestedExpiry:1200,bootIdentity:"boot-A")==1200)
  let group=FreedAppGroupsPolicy.draft(id:"group-a",name:"Work",slot:0)
  let lease=FreedAppGroupLease(claim:sameBoot,requestedExpiry:1300,expiresAt:1300,grantedAt:1000,grantedUptime:5,bootIdentity:"boot-A")
  precondition(!FreedAppGroupsPolicy.leaseActive(lease,group:group,generation:2,scopeEpoch:3,now:1100,uptime:50,bootIdentity:"boot-B"))
  precondition(FreedAppGroupsPolicy.leaseActive(lease,group:group,generation:2,scopeEpoch:3,now:1100,uptime:50,bootIdentity:"boot-A"))
  precondition(!FreedAppGroupsPolicy.issuedClockValid(bootIdentity:"boot-A",currentBootIdentity:"boot-B",issuedAt:1000,issuedUptime:5,now:1100,uptime:50))
  precondition(!FreedAppGroupsPolicy.issuedClockValid(bootIdentity:"boot-A",currentBootIdentity:"boot-A",issuedAt:1000,issuedUptime:5,now:2300,uptime:1305))
  if let actual=FreedAppGroupsClock.kernelBootIdentity(){precondition(UUID(uuidString:actual) != nil && actual==FreedAppGroupsClock.kernelBootIdentity())}
  print("Production native boot authority: plausible increasing uptime on another boot rejects claim/lease/issue; same boot preserves valid handoff; missing old boot and issue TTL fail closed")
 }
}
