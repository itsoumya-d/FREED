import Foundation
#if canImport(CoreMotion) && os(iOS)
import CoreMotion
#endif

struct FreedChallengeStepSample {let count:Int,start:Double,end:Double}
protocol FreedChallengeStepObserving:AnyObject {
 var available:Bool {get}
 var processId:String {get}
 func start(from:Date,receive:@escaping(FreedChallengeStepSample?,String?)->Void)
 func stop()
}
// One live interval. Stop invalidates queued callbacks independently of policy
// session/segment fences. No query of pre-session or post-restart step history.
final class FreedChallengeStepObserver:FreedChallengeStepObserving {
 let processId=UUID().uuidString.lowercased()
 private let lock=NSLock()
 private var generation=0
 #if canImport(CoreMotion) && os(iOS)
 private let pedometer=CMPedometer()
 #endif
 var available:Bool {
  #if canImport(CoreMotion) && os(iOS)
  let status=CMPedometer.authorizationStatus()
  return CMPedometer.isStepCountingAvailable() && status != .denied && status != .restricted
  #else
  return false
  #endif
 }
 func start(from:Date,receive:@escaping(FreedChallengeStepSample?,String?)->Void) {
  stop()
  guard available else{receive(nil,"steps-verification-unavailable");return}
  lock.lock();let captured=generation;lock.unlock()
  #if canImport(CoreMotion) && os(iOS)
  pedometer.startUpdates(from:from){[weak self] data,error in
   guard let self else{return};self.lock.lock();let current=self.generation==captured;self.lock.unlock();guard current else{return}
   if let error {_ = error;receive(nil,CMPedometer.authorizationStatus() == .denied || CMPedometer.authorizationStatus() == .restricted ? "steps-permission-denied":"steps-observation-failed");return}
   guard let data else{receive(nil,"steps-observation-unavailable");return}
   let n=data.numberOfSteps.doubleValue
   guard n.isFinite,n>=0,n<=10000,n.rounded()==n else{receive(nil,"steps-observation-invalid");return}
   receive(FreedChallengeStepSample(count:Int(n),start:data.startDate.timeIntervalSince1970,end:data.endDate.timeIntervalSince1970),nil)
  }
  #endif
 }
 func stop() {
  lock.lock();generation += 1;lock.unlock()
  #if canImport(CoreMotion) && os(iOS)
  pedometer.stopUpdates()
  #endif
 }
 deinit{stop()}
}
