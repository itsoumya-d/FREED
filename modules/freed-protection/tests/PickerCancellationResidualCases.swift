import Foundation
@main struct PickerCancellationResidualCases {
 @MainActor static func main() {
  func require(_ value:Bool,_ message:String){precondition(value,message)}
  func run(_ label:String,install:(String,UUID,FixtureHost?,Bool)->FixturePresentation?,cancel:(String)->String,direct:()->Void,reset:()->Void,count:()->Int,prune:(String)->Void){
   reset();let original=UUID(),host=FixtureHost();let presentation=install("A",original,host,false)!
   require(cancel("A")=="pending","\(label): first cancellation requests dismissal")
   require(host.requests==1&&presentation.continuation.resumes==1,"\(label): original finish resumes once")
   direct();direct();require(cancel("A")=="pending","\(label): exact replay remains pending before observed dismissal")
   require(host.requests==1&&presentation.continuation.resumes==1,"\(label): replay adds zero effects")
   let oldCallback=host.callback;host.complete(false)
   require(cancel("A")=="unavailable","\(label): callback without positive absence stays unavailable")
   host.markAbsent();oldCallback?();require(cancel("A")=="notApplicable","\(label): positive original-host absence settles replay")
   require(install("A",UUID(),FixtureHost(),false)==nil,"\(label): retired binding cannot adopt a new presentation")
   let forced=FixtureHost(),newer=install("A",UUID(),forced,true)!
   require(cancel("A")=="notApplicable"&&forced.requests==0,"\(label): old target cannot cancel newer same-binding presentation")
   presentation.finish([:]);oldCallback?();require(forced.requests==0,"\(label): old finish/callback cannot change newer presentation")
   newer.finish([:]);forced.complete(true)
   let bHost=FixtureHost(),b=install("B",original,bHost,false)!
   require(cancel("B")=="pending","\(label): new B with reused presentation identifier requests only B")
   oldCallback?();require(cancel("B")=="pending"&&bHost.requests==1&&b.continuation.resumes==1,"\(label): late A callback cannot settle reused B identifier")
   require(cancel("A")=="notApplicable"&&bHost.requests==1,"\(label): A replay never adopts B")
   bHost.complete(true);require(cancel("B")=="notApplicable","\(label): positive B settlement is separate")
   reset();let directHost=FixtureHost(),d=install("direct",UUID(),directHost,false)!
   direct();direct();require(cancel("direct")=="pending"&&directHost.requests==1&&d.continuation.resumes==1,"\(label): direct cancelCurrent retains original residual before binding read")
   directHost.complete(true);require(cancel("direct")=="notApplicable","\(label): direct cancellation settles only after callback")
   reset();let missing=install("missing",UUID(),nil,false)!
   require(cancel("missing")=="unavailable"&&missing.continuation.resumes==1,"\(label): missing dismissal observation is unavailable")
   reset();var hosts:[FixtureHost]=[]
   for i in 0..<32{let h=FixtureHost();hosts.append(h);_ = install("capacity-\(i)",UUID(),h,true)!;require(cancel("capacity-\(i)")=="pending","\(label): bounded original residual seeded through actual finish")}
   require(count()==32,"\(label): pending residual capacity is bounded")
   let overflowHost=FixtureHost(),overflow=install("overflow",UUID(),overflowHost,true)!
   require(cancel("overflow")=="unavailable","\(label): capacity refuses an unrecordable cancellation")
   direct();require(overflowHost.requests==0&&overflow.continuation.resumes==0&&count()==32,"\(label): capacity adds zero dismissal/continuation effects")
   for h in hosts{h.complete(true)};prune("overflow")
   require(cancel("overflow")=="pending"&&overflowHost.requests==1,"\(label): only positively settled records may release capacity")
   overflowHost.complete(true)
   print("PASS actual \(label) finish/cancel bodies: delayed/unavailable/positive observation, exact replay, direct cancel, B/reused identity and bounded capacity")
  }
  run("group",install:{FreedAppGroupPicker.fixtureInstall(owner:$0,identity:$1,providedHost:$2,force:$3)},cancel:{cancellationState(FreedAppGroupPicker.cancel(bindingID:$0))},direct:FreedAppGroupPicker.cancelCurrent,reset:FreedAppGroupPicker.fixtureReset,count:FreedAppGroupPicker.fixtureCount,prune:FreedAppGroupPicker.fixturePrune)
  run("website",install:{FreedWebsiteProbePicker.fixtureInstall(owner:$0,identity:$1,providedHost:$2,force:$3)},cancel:{cancellationState(FreedWebsiteProbePicker.cancel(bindingID:$0))},direct:FreedWebsiteProbePicker.cancelCurrent,reset:FreedWebsiteProbePicker.fixtureReset,count:FreedWebsiteProbePicker.fixtureCount,prune:FreedWebsiteProbePicker.fixturePrune)
 }
}
