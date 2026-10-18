import ExpoModulesCore
import Foundation
#if canImport(Vision)
import Vision
#endif

final class FreedChallengePhotoPipeline {
  private let queue = DispatchQueue(label: "app.freed.challenge-photo", qos: .userInitiated)
  #if canImport(Vision)
  private struct Operation { let request: VNClassifyImageRequest; let resolve: ([String:Any])->Void; let ownerId: String }
  private static let physicalGate = FreedPhotoOperationGate<Operation>()
  private var gate: FreedPhotoOperationGate<Operation> { Self.physicalGate }
  private let ownerId = UUID().uuidString
  private let lifecycleLock = NSLock()
  private var destroyed = false
  private static let targets = FreedChallengePhotoCatalog.labels
  private func identity(_ request: VNClassifyImageRequest) -> [String: Any] {
    let os = ProcessInfo.processInfo.operatingSystemVersion
    return ["provider":"apple-vision", "classifierRevision":"VNClassifyImageRequest:revision-\(request.revision)",
      "runtimeRevision":"ios-\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)","ruleRevision":"freed-photo-targets-v1","modelWeightsRevision":NSNull()]
  }
  #endif
  func capabilities(cameraAvailable: Bool) -> [String: Any] {
    #if canImport(Vision)
    let request = VNClassifyImageRequest()
    let labels = (try? request.supportedIdentifiers()) ?? []
    let normalized = Set(labels.flatMap { $0.split(separator: ",").map { normalize(String($0)) } })
    let supported = Self.targets.keys.filter { key in Self.targets[key]!.contains { normalized.contains($0) } }.sorted()
    return ["cameraAvailable":cameraAvailable,"classifierAvailable":!labels.isEmpty,"identity":identity(request),"supportedTargetIds":supported,"validatedPhotoTargets":FreedChallengePhotoCatalog.reviewedTargetIds(identity:identity(request))]
    #else
    return ["cameraAvailable":cameraAvailable,"classifierAvailable":false,"identity":NSNull(),"supportedTargetIds":[String](),"validatedPhotoTargets":[String]()]
    #endif
  }
  func classify(uri: String, expectedLabels: [String], operationId: String, promise: Promise) {
    classify(uri:uri,expectedLabels:expectedLabels,operationId:operationId,completion:{promise.resolve($0)})
  }
  func classifyNativeCapture(_ capture:FreedNativeChallengePhoto,targetId:String,completion:@escaping([String:Any])->Void) {
    classify(uri:capture.url.absoluteString,expectedLabels:FreedChallengePhotoCatalog.labels[targetId] ?? [],operationId:capture.operationId,completion:completion)
  }
  private func classify(uri:String,expectedLabels:[String],operationId:String,completion:@escaping([String:Any])->Void) {
    #if canImport(Vision)
    let request = VNClassifyImageRequest()
    lifecycleLock.lock()
    let started = !destroyed && gate.start(operationId, value: Operation(request: request, resolve: completion, ownerId: ownerId))
    lifecycleLock.unlock()
    guard started else { completion(payload(request: request, outcome: "unavailable")); return }
    // Deadline/cancel runs independently from synchronous handler.perform.
    DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + 8) { [weak self] in self?.cancel(operationId, outcome: "unavailable", expectedRequest: request) }
    queue.async { [self] in
      defer { gate.drain(operationId) }
      let expected = expectedLabels.map(normalize)
      let supportedLabels = (try? request.supportedIdentifiers()) ?? []
      let supported = Set(supportedLabels.flatMap { $0.split(separator: ",").map { normalize(String($0)) } })
      guard !expected.isEmpty, expected.allSatisfy({ label in Self.targets.values.contains { $0.contains(label) } }),
        expected.contains(where: supported.contains), let url = URL(string: uri), url.isFileURL else {
        if let operation = gate.takePublication(operationId) { operation.resolve(payload(request:request,outcome:"unavailable")) }; return
      }
      guard gate.isPublishable(operationId) else { return }
      do {
        try VNImageRequestHandler(url: url, options: [:]).perform([request])
        let observations = (request.results ?? []).prefix(12)
        var matches = [String](); var confidence: Double = 0
        for observation in observations {
          let labels = observation.identifier.split(separator: ",").map { normalize(String($0)) }
          if let match = labels.first(where: { observed in expected.contains { FreedPhotoTargetMatching.matches(observed: observed, expected: $0) } }) {
            confidence = max(confidence, Double(observation.confidence))
            if observation.confidence >= 0.65 { matches.append(match) }
          }
        }
        let outcome = matches.isEmpty ? "uncertain" : "matched"
        if let operation = gate.takePublication(operationId) { operation.resolve(payload(request:request,outcome:outcome,labels:observations.map { $0.identifier },matches:Array(Set(matches)).sorted(),confidence:confidence)) }
      } catch {
        if let operation = gate.takePublication(operationId) { operation.resolve(payload(request:request,outcome:"unavailable")) }
      }
    }
    #else
    completion(["available":false,"matched":false,"outcome":"unavailable","identity":NSNull(),"labels":[String](),"matchedLabels":[String](),"message":"On-device image classification is unavailable in this build."])
    #endif
  }
  @discardableResult func cancel(_ id: String, outcome: String = "cancelled", expectedRequest: VNClassifyImageRequest? = nil) -> Bool {
    #if canImport(Vision)
    guard let operation = gate.takePublication(id, accepting: {  $0.ownerId == ownerId && (expectedRequest == nil || $0.request === expectedRequest) }) else { return false }
    operation.request.cancel()
    operation.resolve(payload(request:operation.request,outcome:outcome)); return true
    #else
    return false
    #endif
  }
  func destroy() {
    #if canImport(Vision)
    lifecycleLock.lock(); destroyed = true
    let operation = gate.invalidate { $0.ownerId == ownerId }
    lifecycleLock.unlock()
    if let operation { operation.request.cancel(); operation.resolve(payload(request:operation.request,outcome:"cancelled")) }
    #endif
  }
  private func normalize(_ value: String) -> String {
    value.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator:" ")
  }
  #if canImport(Vision)
  private func payload(request: VNClassifyImageRequest, outcome: String, labels: [String] = [], matches: [String] = [], confidence: Double = 0) -> [String: Any] {
    ["available":outcome == "matched" || outcome == "uncertain","matched":outcome == "matched","outcome":outcome,"identity":identity(request),"labels":labels,"matchedLabels":matches,"confidence":confidence,
     "message":outcome == "matched" ? "Photo target verified on device." : outcome == "cancelled" ? "Photo capture cancelled." : outcome == "uncertain" ? "The requested object is uncertain. Try a clearer photo or choose another reset." : "On-device image classification is unavailable in this build."]
  }
  #endif
}
