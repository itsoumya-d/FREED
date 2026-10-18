import Foundation
import CryptoKit

enum Fixture {
 static let directory=URL(fileURLWithPath:CommandLine.arguments[1])
 static let suite=CommandLine.arguments[2]
 static var mode="none"
 static var replacement=Data()
 static var raceCount=0
 static var file:URL{directory.appendingPathComponent("freed-enforcement-state.v1.plist")}
 static func scheduleRace(){
  guard mode != "none" else{return};let next=mode;mode="none";raceCount += 1
  if next=="remove"{try! FileManager.default.removeItem(at:file)}
  else{try! replacement.write(to:file,options:.atomic)}
 }
 static func beforeLock()->URL{scheduleRace();return directory}
 static func beforeOwnerFence(){scheduleRace()}
}
@main enum BridgeCases {
 static func main() async throws {
  let d=UserDefaults(suiteName:Fixture.suite)!;defer{d.removePersistentDomain(forName:Fixture.suite)}
  let owner="fixture-owner",salt="fixture-salt",scope="[\"fixture-owner\",1]"
  let digest=SHA256.hash(data:Data((salt+"\0"+owner).utf8)).map{String(format:"%02x",$0)}.joined()
  var state=FreedAppGroupsState();state.ownerDigest=digest;state.generation=2;state.scopeEpoch=3
  let preview:[String:Any]=["version":1,"identity":["owner":digest,"generation":2,"epoch":3],"revision":1,"optedIn":true,"active":[]]
  let values:[String:Any]=["freed.protectionConfiguration.generation":2,"freed.appGroups.v1":try JSONEncoder().encode(state),"freed.appGroups.ownerSalt.v1":salt,"freed.selection.websiteRecoveryProbe.v1":try JSONSerialization.data(withJSONObject:preview),"freed.adultFilterActive":true]
  let original=try PropertyListSerialization.data(fromPropertyList:["version":1,"revision":1,"values":values],format:.binary,options:0)
  Fixture.replacement=try PropertyListSerialization.data(fromPropertyList:["version":1,"revision":2,"values":values],format:.binary,options:0)
  // A complete legacy seed would be imported by the real ordinary lock if the
  // bridge incorrectly invokes migration after disappearance.
  for (key,value) in values{d.set(value,forKey:key)}
  let native=FreedAppGroupsRuntime.shared
  native.configureFixture(scope:scope,privateOwner:true,epoch:3)
  try original.write(to:Fixture.file)
  let context=FreedShieldRuntimeDiagnostics.context(info:Bundle.main.infoDictionary!,values:values,debug:false)!
  FreedShieldRuntimeDiagnostics.store(.init(version:1,role:.configuration,callback:.site,phase:.return,action:.none,outcome:.configured,elapsedMilliseconds:1,timestamp:Date().timeIntervalSince1970,binaryVersion:"16"),context:context,write:{d.set($0,forKey:$1)})
  let legacyBefore=d.persistentDomain(forName:Fixture.suite)! as NSDictionary
  var failures:[String]=[];var checks=0
  func check(_ value:Bool,_ name:String){checks += 1;if !value{failures.append(name);print("FAIL \(name)")}}
  let normal=await runBridge()
  check(normal["status"] as? String=="diagnostic","matching committed owner exposes bounded diagnostic")
  check(try Data(contentsOf:Fixture.file)==original,"normal refresh never changes authority file")
  check((d.persistentDomain(forName:Fixture.suite)! as NSDictionary)==legacyBefore,"normal refresh never changes preview or legacy/enforcement preferences")
  for change in ["unknown-owner","wrong-owner","wrong-epoch"]{
   native.configureFixture(scope:change=="wrong-owner" ? "[\"another-fixture\",1]":scope,privateOwner:change != "unknown-owner",epoch:change=="wrong-epoch" ? 4:3)
   let refused=await runBridge();check(refused["status"] as? String=="unknown","\(change) refused")
   check(try Data(contentsOf:Fixture.file)==original,"refused owner refresh unchanged authority")
  }
  native.configureFixture(scope:scope,privateOwner:true,epoch:3)
  for race in ["remove","replace"]{
   try original.write(to:Fixture.file,options:.atomic);Fixture.mode=race;let count=Fixture.raceCount
   let result=await runBridge()
   check(Fixture.raceCount==count+1,"\(race) scheduled at committed-read/owner boundary")
   check(result["status"] as? String=="unknown","\(race) refresh rejects unavailable or replaced committed authority")
   check((result["records"] as? [[String:Any]])?.isEmpty==true,"\(race) refresh does not expose old diagnostic authority")
   let exists=FileManager.default.fileExists(atPath:Fixture.file.path)
   if race=="remove"{check(!exists,"disappearance never recreates or migrates enforcement file")}
   else{check(try Data(contentsOf:Fixture.file)==Fixture.replacement,"replacement refresh never repairs or overwrites committed authority")}
   check((d.persistentDomain(forName:Fixture.suite)! as NSDictionary)==legacyBefore,"\(race) refresh never imports or mutates preview/legacy enforcement preferences")
   print("Race \(race): status=\(result["status"] as? String ?? "unknown") authorityFileExists=\(exists)")
  }
  Fixture.mode="none"
  for data in [Data("corrupt".utf8),try PropertyListSerialization.data(fromPropertyList:["version":2,"revision":1,"values":values],format:.binary,options:0)]{
   try data.write(to:Fixture.file,options:.atomic);let result=await runBridge()
   check(result["status"] as? String=="unknown","corrupt/future committed snapshot unknown")
   check(try Data(contentsOf:Fixture.file)==data,"corrupt/future snapshot not repaired")
  }
  try FileManager.default.removeItem(at:Fixture.file)
  check((await runBridge())["status"] as? String=="unknown","missing committed state unknown without legacy fallback")
  check(!FileManager.default.fileExists(atPath:Fixture.file.path),"missing state never created")
  check((d.persistentDomain(forName:Fixture.suite)! as NSDictionary)==legacyBefore,"all refused paths preserve legacy/preferences")
  precondition(failures.isEmpty,"bridge read-only failures: \(failures.joined(separator:", "))")
  print("PASS \(checks) exact bridge/existing owner fence/actual committed-reader and lock migration regression checks")
 }
}
