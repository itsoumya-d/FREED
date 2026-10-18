import Foundation

// No bridge accepts these values. A proof can only originate from the native
// fixed-host transport; tests replace that transport boundary, never JS input.
struct FreedEarnedAppTimeClockProof:Equatable {
 let serverDate:Date,receivedWall:Date,receivedUptime:Double,bootIdentity:String
}
enum FreedEarnedAppTimeTrustedClock {
 typealias Transport=(URLRequest) async throws -> HTTPURLResponse
 enum Failure:Error {case unavailable,invalidResponse,staleResponse,clockDrift,timeout}
 private final class NoRedirect:NSObject,URLSessionTaskDelegate {
  func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping (URLRequest?)->Void) {completionHandler(nil)}
 }
 static func live(_ request:URLRequest)async throws->HTTPURLResponse {
  let configuration=URLSessionConfiguration.ephemeral
  configuration.timeoutIntervalForRequest=10;configuration.timeoutIntervalForResource=10
  configuration.urlCache=nil;configuration.httpCookieStorage=nil;configuration.urlCredentialStorage=nil;configuration.httpShouldSetCookies=false
  let session=URLSession(configuration:configuration,delegate:NoRedirect(),delegateQueue:nil)
  defer{session.invalidateAndCancel()}
  let (_,response)=try await session.data(for:request)
  guard let response=response as? HTTPURLResponse else{throw Failure.invalidResponse}
  return response
 }
 static func fetch(clock:FreedAppGroupsClock,transport:@escaping Transport=live)async throws->FreedEarnedAppTimeClockProof {
  guard let boot=clock.bootIdentity(),!boot.isEmpty else{throw Failure.unavailable}
  var components=URLComponents(string:"https://freed-7d5ee.firebaseapp.com/privacy")!
  components.queryItems=[URLQueryItem(name:"freed-time",value:UUID().uuidString.lowercased())]
  let url=components.url!
  var request=URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData,timeoutInterval:10)
  request.httpMethod="HEAD";request.setValue("no-cache, no-store, max-age=0",forHTTPHeaderField:"Cache-Control");request.setValue("no-cache",forHTTPHeaderField:"Pragma");request.setValue("FREED-Native-Time/2",forHTTPHeaderField:"User-Agent")
  let start=clock.uptime(),startWall=clock.now()
  let response=try await withThrowingTaskGroup(of:HTTPURLResponse.self){group in
   group.addTask{try await transport(request)}
   group.addTask{try await Task.sleep(nanoseconds:10_000_000_000);throw Failure.timeout}
   defer{group.cancelAll()}
   guard let result=try await group.next() else{throw Failure.unavailable};return result
  }
  let end=clock.uptime(),wall=clock.now(),elapsed=end-start
  guard clock.bootIdentity()==boot,start.isFinite,end.isFinite,start>=0,elapsed>=0,elapsed<=5,abs(wall.timeIntervalSince(startWall)-elapsed)<=5 else{throw Failure.staleResponse}
  guard response.statusCode==200,response.url==url,response.url?.scheme=="https",response.url?.host=="freed-7d5ee.firebaseapp.com",response.url?.path=="/privacy",response.value(forHTTPHeaderField:"Location")==nil else{throw Failure.invalidResponse}
  if let age=response.value(forHTTPHeaderField:"Age")?.trimmingCharacters(in:.whitespacesAndNewlines),age != "0" {throw Failure.staleResponse}
  guard let raw=response.value(forHTTPHeaderField:"Date"),raw.hasSuffix(" GMT") else{throw Failure.invalidResponse}
  let formatter=DateFormatter();formatter.locale=Locale(identifier:"en_US_POSIX");formatter.timeZone=TimeZone(secondsFromGMT:0);formatter.dateFormat="EEE, dd MMM yyyy HH:mm:ss 'GMT'";formatter.isLenient=false
  guard let server=formatter.date(from:raw),formatter.string(from:server)==raw else{throw Failure.invalidResponse}
  guard abs(wall.timeIntervalSince(server))<=120 else{throw Failure.clockDrift}
  // HTTP Date has second precision. Keeping its lower bound avoids an early
  // day rollover caused by estimating half the network round trip.
  return .init(serverDate:server,receivedWall:wall,receivedUptime:end,bootIdentity:boot)
 }
}
