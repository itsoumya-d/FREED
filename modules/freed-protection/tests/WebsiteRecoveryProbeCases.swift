import Foundation
final class FixtureStore: FreedWebsiteProbeStore {
  var tokens: [Data] = []; var mismatch = false; var writeFailure = false
  // These independent stores are intentionally never passed to the probe adapter.
  var adultAuto = true; var familiesDNS = true; var applicationShields = ["fixture-app"]
  func read() throws -> [Data] { mismatch ? [] : tokens }
  func write(_ values: [Data]) throws { if writeFailure { throw FreedWebsiteProbeError.readback }; tokens = values }
}
@main enum Cases {
 static func main() throws {
  var checks = 0
  func check(_ value: @autoclosure () -> Bool, _ name: String) { precondition(value(),name); checks += 1 }
  func refuses(_ name: String, _ run: () throws -> Void) { do { try run(); fatalError(name) } catch { checks += 1 } }
  let a = FreedWebsiteProbeIdentity(owner:"owner-A",generation:1,epoch:2)
  let b = FreedWebsiteProbeIdentity(owner:"owner-B",generation:1,epoch:3)
  let aba = FreedWebsiteProbeIdentity(owner:"owner-A",generation:1,epoch:4)
  let token = Data("fixture-opaque-picker-value".utf8)
  // Fixture bytes are generic adapter data, never decoded into an Apple token.
  check(!FreedWebsiteProbeTransaction.rawTokenAvailable(Optional<Data>.none), "nil raw diagnostic")
  check(FreedWebsiteProbeTransaction.rawTokenAvailable(token), "optional raw diagnostic")
  check(!FreedWebsiteProbeTransaction.buildAllowed(flag:true,channel:"production",internalTestflight:true,debug:true),"production refusal")
  check(!FreedWebsiteProbeTransaction.buildAllowed(flag:false,channel:"internal-testflight",internalTestflight:true,debug:false),"default off")
  check(FreedWebsiteProbeTransaction.buildAllowed(flag:true,channel:"internal-testflight",internalTestflight:true,debug:false),"internal bundled gate")
  refuses("app selection") { _ = try FreedWebsiteProbeTransaction.selection(apps:1,categories:0,websites:[token]) }
  refuses("category selection") { _ = try FreedWebsiteProbeTransaction.selection(apps:0,categories:1,websites:[token]) }
  refuses("zero selection") { _ = try FreedWebsiteProbeTransaction.selection(apps:0,categories:0,websites:[]) }
  refuses("over capacity") { _ = try FreedWebsiteProbeTransaction.selection(apps:0,categories:0,websites:(0..<51).map{Data("token\($0)".utf8)}) }
  let selected = try FreedWebsiteProbeTransaction.selection(apps:0,categories:0,websites:[token])
  check(selected == [token],"guaranteed opaque picker adapter input")
  let store = FixtureStore(); var saved: FreedWebsiteProbeState?
  func mutate(_ operation:String, identity:FreedWebsiteProbeIdentity=a, revision:Int?=nil, allowed:Bool=true, authorized:Bool=true, failSave:Bool=false) throws {
    saved = try FreedWebsiteProbeTransaction.mutate(state:saved,identity:identity,expectedRevision:revision ?? saved?.revision ?? 0,operation:operation,selection:selected,allowed:allowed,authorized:authorized,store:store){next in if failSave {throw FreedWebsiteProbeError.persistence}; saved=next}
  }
  refuses("off activation") {try mutate("activate")}
  refuses("permission denial") {try mutate("opt-in",authorized:false)}
  refuses("disabled capability") {try mutate("opt-in",allowed:false)}
  try mutate("opt-in"); try mutate("select")
  check(saved?.pending == [token] && store.tokens.isEmpty,"pending requires explicit activate")
  let beforeCancel = saved
  // Cancel invokes no mutation; existing committed and pending state remain intact.
  check(saved == beforeCancel && store.tokens.isEmpty,"cancel retains pending")
  refuses("owner change") {try mutate("activate",identity:b)}
  refuses("owner ABA") {try mutate("activate",identity:aba)}
  refuses("stale picker/revision") {try mutate("select",revision:0)}
  refuses("save failure rollback") {try mutate("activate",failSave:true)}
  check(store.tokens.isEmpty && saved == beforeCancel,"failed persistence restores native store")
  store.mismatch=true
  refuses("readback failure rollback") {try mutate("activate")}
  store.mismatch=false
  check(store.tokens.isEmpty && saved == beforeCancel,"readback failure retains state")
  store.writeFailure=true
  refuses("write failure") {try mutate("activate")}
  store.writeFailure=false
  try mutate("activate")
  check(saved?.active == [token] && saved?.pending == nil && store.tokens == [token],"native apply and readback")
  let active = saved!
  func callback(_ identity:FreedWebsiteProbeIdentity?, _ revision:Int?, _ installed:[Data]=[token], _ tokenData:Data=token)->Bool {
    FreedWebsiteProbeTransaction.validCallback(state:saved,identity:identity,revision:revision,token:tokenData,installed:installed,allowed:true,authorized:true)
  }
  check(callback(a,active.revision),"current callback")
  check(!callback(b,active.revision) && !callback(aba,active.revision),"owner and ABA callback refusal")
  check(!callback(a,active.revision-1),"late callback refusal")
  check(!callback(a,active.revision,[]),"store missing callback refusal")
  check(!callback(a,active.revision,[token],Data("other".utf8)),"unselected callback refusal")
  check(!callback(nil,active.revision),"reset/no identity refusal")
  try mutate("select"); try mutate("discard")
  check(saved?.pending == nil && saved?.active == [token],"explicit discard only pending")
  try mutate("remove",identity:b)
  check(store.tokens.isEmpty && saved?.active.isEmpty == true && saved?.identity == b && saved?.optedIn == false,"explicit stale-owner cleanup isolated")
  check(store.adultAuto && store.familiesDNS && store.applicationShields == ["fixture-app"],"baseline and app stores retained")
  check(!callback(a,active.revision),"removed callback refusal")
  let failedReadback: [String: Any] = ["accepted": false, "reason": "probe-native-readback-unavailable"]
  check(FreedWebsiteProbeTransaction.finalReceipt(snapshot: failedReadback, expectedRevision: 1, operation: "remove")["accepted"] as? Bool == false, "failed final readback cannot acknowledge")
  let suspended: [String: Any] = ["accepted": false, "reason": "owner-unavailable-or-changed"]
  check(FreedWebsiteProbeTransaction.finalReceipt(snapshot: suspended, expectedRevision: 1, operation: "activate")["accepted"] as? Bool == false, "suspended final snapshot cannot acknowledge")
  let final: [String: Any] = ["accepted": true, "revision": 7, "readbackAvailable": true, "installed": true]
  check(FreedWebsiteProbeTransaction.finalReceipt(snapshot: final, expectedRevision: 7, operation: "activate")["accepted"] as? Bool == true, "current native final readback acknowledged")
  check(FreedWebsiteProbeTransaction.finalReceipt(snapshot: final, expectedRevision: 8, operation: "activate")["accepted"] as? Bool == false, "stale final revision cannot acknowledge")
  var absent = final; absent["installed"] = false
  check(FreedWebsiteProbeTransaction.finalReceipt(snapshot: absent, expectedRevision: 7, operation: "activate")["accepted"] as? Bool == false, "missing installed shield cannot acknowledge activation")
  absent = final; absent["readbackAvailable"] = false
  check(FreedWebsiteProbeTransaction.finalReceipt(snapshot: absent, expectedRevision: 7, operation: "remove")["accepted"] as? Bool == false, "unavailable store read cannot acknowledge removal")
  print("PASS \(checks) production website-probe adapter fixtures; no real Apple token/store/device outcome inferred")
 }
}
