import Foundation

enum SensorAuthorization {case authorized,denied,restricted,notDetermined}
struct SensorData {let numberOfSteps:NSNumber,startDate:Date,endDate:Date}
final class CMPedometer {
 static var status=SensorAuthorization.notDetermined,hardware=true
 static var callbacks:[(SensorData?,Error?)->Void]=[]
 static var starts:[Date]=[],stops=0
 static func authorizationStatus()->SensorAuthorization {status}
 static func isStepCountingAvailable()->Bool {hardware}
 func startUpdates(from date:Date,withHandler:@escaping(SensorData?,Error?)->Void){Self.starts.append(date);Self.callbacks.append(withHandler)}
 func stopUpdates(){Self.stops += 1}
}
@main struct ChallengeStepObserverCases {
 static func main() {
  let observer=FreedChallengeStepObserver(),start=Date(timeIntervalSince1970:100)
  var counts=[Int](),failures=[String]()
  precondition(observer.available,"Undetermined permission may request native observation, never grant from elapsed time")
  observer.start(from:start){sample,failure in if let sample{counts.append(sample.count)};if let failure{failures.append(failure)}}
  precondition(CMPedometer.starts==[start])
  CMPedometer.callbacks[0](SensorData(numberOfSteps:30,startDate:start,endDate:start.addingTimeInterval(10)),nil)
  precondition(counts==[30])
  observer.stop();CMPedometer.callbacks[0](SensorData(numberOfSteps:60,startDate:start,endDate:start.addingTimeInterval(20)),nil)
  precondition(counts==[30],"Actual adapter discards queued native callbacks after stop")
  observer.start(from:start.addingTimeInterval(30)){sample,failure in if let sample{counts.append(sample.count)};if let failure{failures.append(failure)}}
  CMPedometer.status = .denied
  CMPedometer.callbacks[1](nil,NSError(domain:"CoreMotion",code:105))
  precondition(failures==["steps-permission-denied"] && !observer.available)
  observer.stop();observer.start(from:start){_,failure in if let failure{failures.append(failure)}}
  precondition(failures.last=="steps-verification-unavailable" && CMPedometer.starts.count==2)
  CMPedometer.status = .authorized;CMPedometer.hardware=false;precondition(!observer.available)
  CMPedometer.hardware=true
  observer.start(from:start){sample,failure in if let sample{counts.append(sample.count)};if let failure{failures.append(failure)}}
  CMPedometer.callbacks[2](SensorData(numberOfSteps:1.5,startDate:start,endDate:start),nil)
  precondition(failures.last=="steps-observation-invalid" && counts==[30])
  CMPedometer.callbacks[2](nil,nil);precondition(failures.last=="steps-observation-unavailable")
  print("Actual native CMPedometer adapter (local OS boundary): native start, stop/late callback, denial, hardware absence, malformed/missing sample passed; physical sensor unexecuted")
 }
}
