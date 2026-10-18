import Foundation
#if canImport(UIKit) && os(iOS)
import UIKit
import AVFoundation

// UIImagePickerController camera output never passes through a JS URI. The
// private native file exists only until classification and cleanup finish.
@MainActor final class FreedChallengeNativeCamera:NSObject,UIImagePickerControllerDelegate,UINavigationControllerDelegate {
 private var picker:UIImagePickerController?
 private var continuation:CheckedContinuation<FreedNativeChallengePhoto,Error>?
 private var operationId:String?
 private var generation=0
 private var observingBackground:NSObjectProtocol?
 private var destroyed=false
 enum Failure:Error {case unavailable,cancelled,cleanup}
 override init() {super.init();observingBackground=NotificationCenter.default.addObserver(forName:UIApplication.didEnterBackgroundNotification,object:nil,queue:.main){[weak self] _ in Task{@MainActor in self?.cancel()}}}
 func capture(operationId:String)async throws->FreedNativeChallengePhoto {
  guard !Task.isCancelled else{throw Failure.cancelled}
  guard !destroyed,self.operationId==nil,continuation==nil,UIApplication.shared.applicationState == .active,UIImagePickerController.isSourceTypeAvailable(.camera),FreedEarnedAppTimePolicy.identifier(operationId),FreedChallengeOwnedCaptureFiles.cleanupAbandoned() else{throw Failure.unavailable}
  // Reserve before permission awaits. Cancel/owner change must invalidate even
  // when there is no picker or continuation to dismiss/resume yet.
  generation += 1;let capturedGeneration=generation;self.operationId=operationId
  defer{if generation==capturedGeneration {self.operationId=nil}}
  return try await withTaskCancellationHandler(operation:{
   let permission=AVCaptureDevice.authorizationStatus(for:.video)
   if permission == .notDetermined {
    let approved=await AVCaptureDevice.requestAccess(for:.video)
    guard self.generation==capturedGeneration,self.operationId==operationId,!self.destroyed,!Task.isCancelled else{throw Failure.cancelled}
    guard approved else{throw Failure.unavailable}
   }else if permission != .authorized {throw Failure.unavailable}
   guard self.generation==capturedGeneration,self.operationId==operationId,!self.destroyed,!Task.isCancelled else{throw Failure.cancelled}
   guard self.continuation==nil,UIApplication.shared.applicationState == .active,let root=UIApplication.shared.connectedScenes.compactMap({$0 as? UIWindowScene}).filter({$0.activationState == .foregroundActive}).flatMap(\.windows).first(where:{$0.isKeyWindow})?.rootViewController else{throw Failure.unavailable}
   var presenter=root;while let presented=presenter.presentedViewController{presenter=presented}
   guard !presenter.isBeingDismissed else{throw Failure.unavailable}
   return try await withCheckedThrowingContinuation{continuation in
    guard self.generation==capturedGeneration,self.operationId==operationId,!self.destroyed,!Task.isCancelled else{continuation.resume(throwing:Failure.cancelled);return}
    self.continuation=continuation
    let picker=UIImagePickerController();picker.sourceType = .camera;picker.mediaTypes=["public.image"];picker.allowsEditing=false;picker.delegate=self;self.picker=picker
    presenter.present(picker,animated:true)
   }
  },onCancel:{[weak self] in Task{@MainActor in self?.cancel(expectedGeneration:capturedGeneration)}})
 }
 func imagePickerController(_ picker:UIImagePickerController,didFinishPickingMediaWithInfo info:[UIImagePickerController.InfoKey:Any]) {
  guard self.picker===picker else{return}
  guard let operationId,let image=info[.originalImage] as? UIImage,let bytes=image.jpegData(compressionQuality:0.9),UIApplication.shared.applicationState == .active else{cancel();return}
  do{let capture=try FreedChallengeOwnedCaptureFiles.save(bytes,operationId:operationId,now:Date().timeIntervalSince1970);finish(.success(capture))}catch{finish(.failure(error))}
 }
 func imagePickerControllerDidCancel(_ picker:UIImagePickerController){guard self.picker===picker else{return};cancel()}
 private func finish(_ result:Result<FreedNativeChallengePhoto,Error>) {generation += 1;let completion=continuation;continuation=nil;operationId=nil;let current=picker;picker=nil;current?.dismiss(animated:true);completion?.resume(with:result)}
 func cancel(){finish(.failure(Failure.cancelled))}
 private func cancel(expectedGeneration:Int){guard generation==expectedGeneration else{return};cancel()}
 func destroy(){destroyed=true;cancel();if let observingBackground{NotificationCenter.default.removeObserver(observingBackground)};observingBackground=nil}
}
#endif
