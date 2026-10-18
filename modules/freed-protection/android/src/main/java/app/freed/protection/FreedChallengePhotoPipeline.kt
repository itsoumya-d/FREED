package app.freed.protection

import android.content.Context
import android.net.Uri
import android.os.Build
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import expo.modules.kotlin.Promise
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal class FreedChallengePhotoPipeline {
  internal class Operation(val promise: Promise, val ownerId: String)
  private companion object { val physicalGate = FreedPhotoOperationGate<Operation>() }
  private val gate get() = physicalGate
  private val ownerId = java.util.UUID.randomUUID().toString()
  private val executor = Executors.newSingleThreadExecutor { runnable -> Thread(runnable, "freed-challenge-photo") }
  private val deadlines = Executors.newSingleThreadScheduledExecutor { runnable -> Thread(runnable, "freed-photo-deadline") }
  private val targets = mapOf("flower" to listOf("flower", "blossom"), "plant" to listOf("plant"), "chair" to listOf("chair"), "cup" to listOf("cup", "mug"), "shoe" to listOf("shoe", "sneakers"), "branch" to listOf("branch"), "clock" to listOf("clock"), "fruit" to listOf("fruit"))
  // Exact labels documented by the bundled default label map. Label support is
  // distinct from held-out accuracy and cannot enable release eligibility.
  fun capabilities(cameraAvailable: Boolean) = mapOf("cameraAvailable" to cameraAvailable, "classifierAvailable" to true, "identity" to identity(), "supportedTargetIds" to targets.keys.sorted(), "validatedPhotoTargets" to emptyList<String>())
  private fun identity(): Map<String, Any?> = mapOf("provider" to "bundled-mlkit", "classifierRevision" to "com.google.mlkit:image-labeling:17.0.9", "runtimeRevision" to "android-${Build.VERSION.SDK_INT}", "ruleRevision" to "freed-photo-targets-v1", "modelWeightsRevision" to null)
  @Synchronized fun classify(context: Context?, uri: String, expectedLabels: List<String>, operationId: String, promise: Promise) {
    val operation = Operation(promise, ownerId)
    val started = synchronized(this) { !destroyed && gate.start(operationId, operation) }
    if (!started) { promise.resolve(payload("unavailable")); return }
    val deadline = deadlines.schedule({ cancel(operationId, "unavailable", operation) }, 8, TimeUnit.SECONDS)
    executor.execute {
      var physicalTaskStarted = false
      var labeler: com.google.mlkit.vision.label.ImageLabeler? = null
      try {
        val expected = expectedLabels.map(::normalize)
        if (context == null || expected.isEmpty() || expected.any { label -> targets.values.none { it.contains(label) } } || Uri.parse(uri).scheme != "file") {
          gate.takePublication(operationId)?.promise?.resolve(payload("unavailable")); return@execute
        }
        val activeLabeler = ImageLabeling.getClient(ImageLabelerOptions.Builder().setConfidenceThreshold(0.65f).build())
        labeler = activeLabeler
        val image = InputImage.fromFilePath(context, Uri.parse(uri))
        if (!gate.isPublishable(operationId)) return@execute
        val task = activeLabeler.process(image)
        physicalTaskStarted = true
        // Tasks.await is deliberately absent. Cancellation only invalidates UI
        // publication: ML Kit provides no forcible process cancellation here.
        task.addOnCompleteListener(executor) { finished ->
          try {
            if (finished.isSuccessful) {
              val labels = finished.result.take(12)
              val matching = labels.filter { label -> expected.any { FreedPhotoTargetMatching.matches(normalize(label.text), it) } }
              val confidence = matching.maxOfOrNull { it.confidence.toDouble() } ?: 0.0
              val matches = matching.filter { it.confidence >= 0.65f }.map { normalize(it.text) }.distinct().sorted()
              gate.takePublication(operationId)?.promise?.resolve(payload(if (matches.isEmpty()) "uncertain" else "matched", labels.map { it.text }, matches, confidence))
            } else gate.takePublication(operationId)?.promise?.resolve(payload("unavailable"))
          } finally {
            deadline.cancel(false); activeLabeler.close(); gate.drain(operationId); if (destroyed) executor.shutdown()
          }
        }
      } catch (_: Exception) {
        gate.takePublication(operationId)?.promise?.resolve(payload("unavailable"))
      } finally {
        if (!physicalTaskStarted) { deadline.cancel(false); labeler?.close(); gate.drain(operationId); if (destroyed) executor.shutdown() }
      }
    }
  }
  fun cancel(id: String, outcome: String = "cancelled", expected: Operation? = null): Boolean {
    val operation = gate.takePublication(id) { it.ownerId == ownerId && (expected == null || it === expected) } ?: return false
    operation.promise.resolve(payload(outcome)); return true
  }
  @Synchronized fun destroy() {
    val operation = synchronized(this) { destroyed = true; gate.invalidate { it.ownerId == ownerId } }
    operation?.promise?.resolve(payload("cancelled"))
    deadlines.shutdown()
    // Only this owner's task requires this completion executor. Another
    // module may occupy the shared physical gate while this instance is idle.
    runCatching { executor.execute { if (!gate.hasOperation { it.ownerId == ownerId }) executor.shutdown() } }
  }

  @Volatile private var destroyed = false
  private fun normalize(value: String) = value.lowercase(Locale.US).replace(Regex("[^a-z0-9]+"), " ").trim().replace(Regex("\\s+"), " ")
  private fun payload(outcome: String, labels: List<String> = emptyList(), matches: List<String> = emptyList(), confidence: Double = 0.0): Map<String, Any?> = mapOf("available" to (outcome == "matched" || outcome == "uncertain"), "matched" to (outcome == "matched"), "outcome" to outcome, "identity" to identity(), "labels" to labels, "matchedLabels" to matches, "confidence" to confidence,
    "message" to when (outcome) { "matched" -> "Photo target verified on device."; "cancelled" -> "Photo capture cancelled."; "uncertain" -> "The requested object is uncertain. Try a clearer photo or choose another reset."; else -> "On-device image classification is unavailable in this build." })
}
