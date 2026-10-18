import Foundation

@main struct EarnedClockCases {
 static var now=Date(timeIntervalSince1970:1_900_022_400),uptime=10_000.0,boot="boot-A"
 static func clock()->FreedAppGroupsClock {.init(now:{now},uptime:{uptime},bootIdentity:{boot})}
 static func dateHeader(_ date:Date)->String {let f=DateFormatter();f.locale=Locale(identifier:"en_US_POSIX");f.timeZone=TimeZone(secondsFromGMT:0);f.dateFormat="EEE, dd MMM yyyy HH:mm:ss 'GMT'";return f.string(from:date)}
 static func response(_ request:URLRequest,date:Date?=nil,age:String?=nil,status:Int=200,url:URL?=nil)->HTTPURLResponse {
  var headers=["Date":dateHeader(date ?? now)];if let age{headers["Age"]=age}
  return HTTPURLResponse(url:url ?? request.url!,statusCode:status,httpVersion:"HTTP/1.1",headerFields:headers)!
 }
 @MainActor static func main()async throws {
  let scenario=CommandLine.arguments[1]
  if scenario=="live" {
   let proof=try await FreedEarnedAppTimeTrustedClock.fetch(clock:FreedAppGroupsClock())
   precondition(abs(proof.receivedWall.timeIntervalSince(proof.serverDate))<=120)
   print("Live native URLSession HEAD fixed-host TLS/time validation passed: \(dateHeader(proof.serverDate))")
   return
  }
  if scenario=="transport" {
   var requests=[URLRequest]()
   let proof=try await FreedEarnedAppTimeTrustedClock.fetch(clock:clock()){request in requests.append(request);uptime += 0.2;now=now.addingTimeInterval(0.2);return response(request,age:"0")}
   precondition(proof.bootIdentity==boot && requests.count==1)
   let request=requests[0]
   precondition(request.httpMethod=="HEAD" && request.httpBody==nil && request.timeoutInterval==10 && request.url?.host=="freed-7d5ee.firebaseapp.com" && request.url?.path=="/privacy")
   precondition(request.value(forHTTPHeaderField:"Authorization")==nil && request.value(forHTTPHeaderField:"Cookie")==nil && request.value(forHTTPHeaderField:"Cache-Control")!.contains("no-cache"))
   precondition(URLComponents(url:request.url!,resolvingAgainstBaseURL:false)!.queryItems!.count==1)
   for mode in ["age","foreign","redirect","old","drift","rtt","tls","invalid-date"] {
    do {
     _=try await FreedEarnedAppTimeTrustedClock.fetch(clock:clock()){request in
      switch mode {
      case "age":return response(request,age:"20")
      case "foreign":return response(request,url:URL(string:"https://foreign.example/privacy")!)
      case "redirect":return response(request,status:302)
      case "old":return response(request,date:now.addingTimeInterval(-600))
      case "drift":return response(request,date:now.addingTimeInterval(-121))
      case "rtt":uptime += 6;now=now.addingTimeInterval(6);return response(request)
      case "tls":throw URLError(.serverCertificateUntrusted)
      default:return HTTPURLResponse(url:request.url!,statusCode:200,httpVersion:"HTTP/1.1",headerFields:["Date":"untrusted-date"])!
      }
     }
     preconditionFailure("Rejected clock transport accepted: \(mode)")
    }catch{}
   }
   print("Native trusted-time transport rejects cache, foreign host, redirect, stale Date, clock drift, long RTT and TLS errors; request has no account/recovery data")
   return
  }
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-clock-v2-\(UUID().uuidString)"),domain="app.freed.clock-v2.\(UUID().uuidString)"
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true);RuntimeLock.directory=directory;RuntimeLock.domain=domain
  defer{try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  let r=FreedAppGroupsRuntime(clock:clock()),scope="[\"owner-A\",1]",token=TestToken(value:"private-native-target")
  precondition(r.setScope(scope)["accepted"] as? Bool==true)
  let initial=r.snapshot(scope);precondition(r.create(["version":1,"expectedStoreRevision":initial["revision"]!,"name":"Focus"],scope)["accepted"] as? Bool==true)
  func target()->[String:Any]{let s=r.snapshot(scope),g=(s["groups"] as! [[String:Any]])[0];return["version":1,"expectedStoreRevision":s["revision"]!,"id":g["id"]!,"expectedRevision":g["revision"]!]}
  var selected=FamilyActivitySelection();selected.applicationTokens=[token]
  precondition(r.update(target(),scope,selectionData:try! JSONEncoder().encode(selected))["accepted"] as? Bool==true)
  var update=target();update["name"]="Focus";update["enabled"]=true;update["packages"]=[String]();update["rule"]=["kind":"before-use"]
  precondition(r.update(update,scope)["accepted"] as? Bool==true)
  func ledger()->FreedEarnedAppTimeState {try! RuntimeLock.withExclusiveAccess{FreedEarnedAppTimeState.decode($0.data(forKey:FreedEarnedAppTimePolicy.key))!}}
  func issue()->[String:Any] {try! RuntimeLock.withExclusiveAccess{d in let issued=r.issueScope(for:token,d)!,id=UUID().uuidString.lowercased();precondition(r.stageClaim(id:id,scope:issued,d));return["version":2,"policyVersion":2,"nativeInterventionId":id,"groupId":issued["groupId"]!,"groupRevision":issued["groupRevision"]!,"configurationGeneration":issued["configurationGeneration"]!,"scopeEpoch":issued["scopeEpoch"]!,"kind":"ios-app-group","tokenType":"application","requestedSeconds":300]}}
  let first=r.prepareEarnedAppTimeOffer(issue(),scope)["offer"] as! [String:Any]
  let grant:[String:Any]=["version":2,"policyVersion":2,"offerId":first["offerId"]!,"completionSessionId":"original-completion","category":"breathe","templateId":"momentum-breathe-soft:earned-v2:300","templateVersion":2,"evidence":["method":"timer","activeDurationSec":60,"observedSteps":0,"photoProofIds":[String]()]]
  precondition(r.grantEarnedAppTimeBreak(grant,scope)["accepted"] as? Bool==true)
  now=now.addingTimeInterval(301);uptime += 301
  let expiry=DeviceActivityCenter().activities.first{$0.rawValue.hasSuffix(".earned-v2")}!;precondition(r.callback(activity:expiry.rawValue))
  if scenario=="next-day" {var cap=target();cap["version"]=2;cap["name"]="Focus";cap["enabled"]=true;cap["packages"]=[String]();cap["rule"]=["kind":"before-use"];cap["extraTimeCapMinutes"]=30;precondition(r.updateAppGroupWithEarnedTime(cap,scope)["accepted"] as? Bool==true)}
  let prior=ledger(),budget=prior.budgets.values.first!
  var serverDate=now
  if scenario=="next-day" {now=Date(timeIntervalSince1970:budget.nextResetAt+60);serverDate=now}
  if scenario=="clock-offset" {serverDate=Date(timeIntervalSince1970:budget.nextResetAt-60);now=serverDate.addingTimeInterval(119)}
  boot="boot-B";uptime=100
  precondition(r.setScope(scope)["accepted"] as? Bool==true)
  let q=issue();precondition(r.prepareEarnedAppTimeOffer(q,scope)["reason"] as? String=="earned-time-clock-unverified")
  let before=ledger()
  let result=await r.prepareEarnedAppTimeOfferWithClockRepair(q,scope){request in
   if scenario=="offline" {throw URLError(.notConnectedToInternet)}
   if scenario=="owner-change" {await MainActor.run{precondition(r.setScope("[\"owner-B\",2]")["accepted"] as? Bool==true)}}
   if scenario=="store-failure" {try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)}
   uptime += 0.25;now=now.addingTimeInterval(0.25)
   return response(request,date:scenario=="wall-drift" ? now.addingTimeInterval(-121):serverDate,age:scenario=="bad-cache" ? "300":nil,url:scenario=="bad-host" ? URL(string:"https://foreign.example/privacy"):nil)
  }
  if ["offline","owner-change","bad-cache","bad-host","wall-drift","store-failure"].contains(scenario) {
   try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
   precondition(result["accepted"] as? Bool==false && ledger().budgets==before.budgets && ledger().consumptions==before.consumptions,"Failed time repair preserves spent/caps/consumptions")
   if scenario=="store-failure" {let retry=await r.prepareEarnedAppTimeOfferWithClockRepair(q,scope){response($0,date:serverDate)};precondition(retry["accepted"] as? Bool==true)}
  }else{
   precondition(result["accepted"] as? Bool==true,"Clock repair rejected: \(result)")
   let after=ledger(),current=after.budgets.values.first!
   precondition(current.bootIdentity=="boot-B" && current.clockVerified(now:now,uptime:uptime,boot:boot) && after.consumptions==prior.consumptions)
   if scenario=="next-day" {precondition(current.spentSeconds==0 && current.effectiveCapMinutes==30 && current.previousDays.last!.spentSeconds==300)}
   else {precondition(current.spentSeconds==300 && current.dayKey==budget.dayKey && current.effectiveCapMinutes==budget.effectiveCapMinutes,"Same-day/server-before-midnight repair never resets spend")}
  }
  print("Actual runtime trusted-clock repair scenario passed: \(scenario)")
 }
}
