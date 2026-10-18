import Foundation
@main enum ShieldDiagnosticCases {
 static func main() throws {
  var checks=0
  func check(_ condition:@autoclosure ()->Bool,_ name:String){precondition(condition(),name);checks += 1}
  let suite="freed-task60-fixture-\(UUID().uuidString)",defaults=UserDefaults(suiteName:suite)!
  defer {defaults.removePersistentDomain(forName:suite)}
  let info:[String:Any]=["FREEDWebsiteRecoveryProbeEnabled":true,"FREEDWebsiteRecoveryProbeChannel":"internal-testflight","FREEDWebsiteRecoveryProbeInternalTestflight":true,"CFBundleVersion":"16"]
  func state(owner:String="fixture-a",revision:Int=1,generation:Int=2,epoch:Int=3,optedIn:Bool=true){
   defaults.set(generation,forKey:"freed.protectionConfiguration.generation")
   defaults.set(try! JSONSerialization.data(withJSONObject:["version":1,"ownerDigest":owner,"generation":generation,"scopeEpoch":epoch]),forKey:"freed.appGroups.v1")
   defaults.set(try! JSONSerialization.data(withJSONObject:["version":1,"identity":["owner":owner,"generation":generation,"epoch":epoch],"revision":revision,"optedIn":optedIn]),forKey:"freed.selection.websiteRecoveryProbe.v1")
  }
  state()
  func context(_ flags:[String:Any]?=nil)->FreedShieldRuntimeDiagnostics.Context?{FreedShieldRuntimeDiagnostics.context(info:flags ?? info,defaults:defaults,debug:false)}
  let original=context()!;check(original.binaryVersion=="16","numeric build version")
  for flags in [[String:Any](),info.merging(["FREEDWebsiteRecoveryProbeEnabled":false]){_,b in b},info.merging(["FREEDWebsiteRecoveryProbeEnabled":1]){_,b in b},info.merging(["FREEDWebsiteRecoveryProbeChannel":"production"]){_,b in b},info.merging(["FREEDWebsiteRecoveryProbeInternalTestflight":false]){_,b in b},info.merging(["CFBundleVersion":"private"]){_,b in b}] {check(context(flags)==nil,"missing invalid and production gate disabled")}
  let development=info.merging(["FREEDWebsiteRecoveryProbeChannel":"development","FREEDWebsiteRecoveryProbeInternalTestflight":false]){_,b in b}
  check(FreedShieldRuntimeDiagnostics.context(info:development,defaults:defaults,debug:true) != nil,"bundled DEBUG development enabled")
  check(FreedShieldRuntimeDiagnostics.context(info:development,defaults:defaults,debug:false)==nil,"release cannot impersonate development")
  check(FreedShieldRuntimeDiagnostics.context(info:info,defaults:nil,debug:false)==nil,"unavailable native defaults disabled")
  state(optedIn:false);check(context()==nil,"explicit opt-in required");state()
  defaults.set(Data("corrupt".utf8),forKey:"freed.appGroups.v1");check(context()==nil,"corrupt owner disabled");state()
  defaults.set(true,forKey:"freed.protectionConfiguration.reset");check(context()==nil,"reset gate disabled");defaults.removeObject(forKey:"freed.protectionConfiguration.reset")
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  defer {try? FileManager.default.removeItem(at:directory)}
  let file=directory.appendingPathComponent("freed-enforcement-state.v1.plist")
  let values=defaults.persistentDomain(forName:suite)!
  let packet:[String:Any]=["version":1,"revision":1,"values":values]
  let encoded=try PropertyListSerialization.data(fromPropertyList:packet,format:.binary,options:0)
  check(FreedShieldRuntimeDiagnostics.nativeValues(at:file)==nil,"missing atomic authority unavailable")
  try encoded.write(to:file)
  check(FreedShieldRuntimeDiagnostics.context(info:info,values:FreedShieldRuntimeDiagnostics.nativeValues(at:file),debug:false) != nil,"actual atomic authority adapter")
  for data in [Data("corrupt".utf8),Data(repeating:32,count:1048577),try PropertyListSerialization.data(fromPropertyList:["version":2,"revision":1,"values":values],format:.binary,options:0)] {
   try data.write(to:file);check(FreedShieldRuntimeDiagnostics.nativeValues(at:file)==nil,"corrupt oversize future atomic state unavailable")
  }
  try FileManager.default.removeItem(at:file)
  let target=directory.appendingPathComponent("target");try encoded.write(to:target)
  try FileManager.default.createSymbolicLink(at:file,withDestinationURL:target)
  check(FreedShieldRuntimeDiagnostics.nativeValues(at:file)==nil,"symlink authority unavailable")
  let now=Date().timeIntervalSince1970
  let record=FreedShieldRuntimeDiagnostics.Record(version:1,role:.configuration,callback:.site,phase:.return,action:.none,outcome:.configured,elapsedMilliseconds:12,timestamp:now,binaryVersion:"16")
  var slots:[String:Data]=[:]
  let write:(Data,String)throws->Void={data,key in slots[key]=data}
  FreedShieldRuntimeDiagnostics.store(record,context:original,write:write)
  check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{slots[$0]}).count==1,"real codec round trip")
  for change in ["owner","revision","generation","epoch"] {state(owner:change=="owner" ? "fixture-b":"fixture-a",revision:change=="revision" ? 2:1,generation:change=="generation" ? 4:2,epoch:change=="epoch" ? 4:3);check(FreedShieldRuntimeDiagnostics.records(context:context()!,now:now,read:{slots[$0]}).isEmpty,"changed namespace cannot expose old records")};state()
  for i in 0..<100 {state(revision:i+1);FreedShieldRuntimeDiagnostics.store(record,context:context()!,write:write)}
  check(slots.count==1,"namespace changes cannot grow slot keys");state();FreedShieldRuntimeDiagnostics.store(record,context:original,write:write)
  let key=slots.keys.first!,valid=slots[key]!
  check(valid.count<1024,"record envelope bounded")
  for corrupt in [Data("bad".utf8),Data(repeating:32,count:1025)] {slots[key]=corrupt;check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{slots[$0]}).isEmpty,"corrupt oversize rejected")}
  slots[key]=valid
  let envelope=try JSONSerialization.jsonObject(with:valid) as! [String:Any]
  for mutation in [["version":2],["timestamp":now+1],["timestamp":now-86401],["binaryVersion":"15"],["elapsedMilliseconds":-1],["outcome":"private"],["callback":"private"],["phase":"private"]] as [[String:Any]] {
   var changed=envelope;var value=changed["record"] as! [String:Any];value.merge(mutation){_,b in b};changed["record"]=value;slots[key]=try JSONSerialization.data(withJSONObject:changed)
   check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{slots[$0]}).isEmpty,"invalid future stale version enum rejected")
  }
  slots[key]=valid
  enum Failure:Error{case unavailable}
  FreedShieldRuntimeDiagnostics.store(record,context:original,write:{_,_ in throw Failure.unavailable})
  check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{_ in nil}).isEmpty,"unavailable storage unknown")
  check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{slots[$0]}).count==1,"failed diagnostic write harmless")
  check(!String(data:valid,encoding:.utf8)!.contains("fixture-a"),"raw private owner never serialized")
  let actionKey="freed.shieldDiagnostics.v1.action.app.entry"
  var malformed=try JSONSerialization.jsonObject(with:valid) as! [String:Any]
  var invalid=malformed["record"] as! [String:Any]
  invalid.merge(["role":"action","callback":"app","phase":"entry","action":"none","outcome":"none","elapsedMilliseconds":0]){_,b in b}
  malformed["record"]=invalid;slots[actionKey]=try JSONSerialization.data(withJSONObject:malformed)
  check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{slots[$0]}).count==1,"corrupt action entry none rejected with valid neighbor retained")
  for action in [FreedShieldRuntimeDiagnostics.Action.primary,.secondary,.unknown] {
   FreedShieldRuntimeDiagnostics.store(.init(version:1,role:.action,callback:.app,phase:.entry,action:action,outcome:.none,elapsedMilliseconds:0,timestamp:now,binaryVersion:"16"),context:original,write:write)
   check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{slots[$0]}).count==2,"valid action entry retained")
  }
  FreedShieldRuntimeDiagnostics.store(.init(version:1,role:.configuration,callback:.site,phase:.entry,action:.none,outcome:.none,elapsedMilliseconds:0,timestamp:now,binaryVersion:"16"),context:original,write:write)
  check(FreedShieldRuntimeDiagnostics.records(context:original,now:now,read:{slots[$0]}).count==3,"configuration none entry retained")
  print("PASS \(checks) shield diagnostic gate/codec/fixed-slot corruption, namespace and unavailable cases")
 }
}
