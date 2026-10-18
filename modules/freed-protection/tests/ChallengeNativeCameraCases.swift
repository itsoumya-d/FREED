import Foundation
import Darwin
func expect(_ condition:Bool,_ message:String="Native camera outcome mismatch") {if !condition{FileHandle.standardError.write(Data(("FAIL: "+message+"\n").utf8));exit(1)}}

// Only framework boundaries are replaced. The actual native camera actor below
// owns permission awaits, operation state, cancellation and UI publication.
enum TestApplicationState {case active,background}
final class UIApplication {
 static let shared=UIApplication()
 static let didEnterBackgroundNotification=Notification.Name("camera-test-background")
 var applicationState=TestApplicationState.active
 var connectedScenes:[Any]=[UIWindowScene()]
}
enum TestActivationState {case foregroundActive}
final class UIWindowScene {var activationState=TestActivationState.foregroundActive;var windows=[UIWindow()]}
final class UIWindow {var isKeyWindow=true;var rootViewController:UIViewController?=UIViewController()}
class UIViewController {
 static var presentations:[UIImagePickerController]=[]
 var presentedViewController:UIViewController?;var isBeingDismissed=false
 func present(_ controller:UIImagePickerController,animated:Bool){Self.presentations.append(controller);presentedViewController=controller}
 func dismiss(animated:Bool){}
}
protocol UIImagePickerControllerDelegate:AnyObject {}
protocol UINavigationControllerDelegate:AnyObject {}
final class UIImagePickerController:UIViewController {
 enum SourceType {case camera}
 struct InfoKey:Hashable {static let originalImage=InfoKey()}
 static func isSourceTypeAvailable(_ source:SourceType)->Bool {true}
 var sourceType=SourceType.camera,mediaTypes=[String](),allowsEditing=false
 weak var delegate:(any UIImagePickerControllerDelegate)?
}
final class UIImage {func jpegData(compressionQuality:Double)->Data?{Data([1,2,3])}}
enum TestAVStatus {case notDetermined,authorized,denied}
enum TestMedia {case video}
@MainActor enum AVCaptureDevice {
 static var status=TestAVStatus.notDetermined
 static var pending:[CheckedContinuation<Bool,Never>]=[]
 static func authorizationStatus(for media:TestMedia)->TestAVStatus {status}
 static func requestAccess(for media:TestMedia)async->Bool {await withCheckedContinuation{pending.append($0)}}
 static func approve(_ index:Int){pending[index].resume(returning:true)}
}
struct FreedNativeChallengePhoto {}
enum FreedEarnedAppTimePolicy {static func identifier(_ id:String)->Bool {true}}
enum FreedChallengeOwnedCaptureFiles {static func cleanupAbandoned()->Bool {true};static func save(_ bytes:Data,operationId:String,now:Double)throws->FreedNativeChallengePhoto {FreedNativeChallengePhoto()}}
@main struct ChallengeNativeCameraCases {
 @MainActor static func main()async {
  let scenario=CommandLine.arguments[1],camera=FreedChallengeNativeCamera()
  func pump(_ predicate:@escaping()->Bool)async {for _ in 0..<1000 {if predicate(){return};await Task.yield()};expect(false,"Async camera test did not reach its requested boundary")}
  func wasCancelled(_ task:Task<FreedNativeChallengePhoto,Error>)async->Bool {switch await task.result {case .failure(let error):return error as? FreedChallengeNativeCamera.Failure == .cancelled;case .success:return false}}
  let first=Task{@MainActor in try await camera.capture(operationId:"first")}
  await pump{AVCaptureDevice.pending.count==1}
  if scenario=="permission-task-cancel" {first.cancel()}
  else {camera.cancel()}
  if scenario=="permission-newer" {
   let second=Task{@MainActor in try await camera.capture(operationId:"second")}
   await pump{AVCaptureDevice.pending.count==2}
   AVCaptureDevice.approve(0)
   for _ in 0..<100 {await Task.yield()}
   expect(UIViewController.presentations.isEmpty,"Late approval of a cancelled request must not publish camera UI while a newer request is pending")
   AVCaptureDevice.approve(1);await pump{UIViewController.presentations.count==1}
   let firstCancelled=await wasCancelled(first);expect(firstCancelled,"Old permission operation must remain cancelled without clearing newer operation state")
   camera.cancel();let secondCancelled=await wasCancelled(second);expect(secondCancelled)
  }else {
   AVCaptureDevice.approve(0)
   for _ in 0..<100 {await Task.yield()}
   expect(UIViewController.presentations.isEmpty,"Cancel during camera permission await must prevent later camera presentation")
   let firstCancelled=await wasCancelled(first);expect(firstCancelled)
  }
  camera.destroy()
  print("Actual native camera permission boundary scenario passed: \(scenario); physical camera UI unexecuted")
 }
}
