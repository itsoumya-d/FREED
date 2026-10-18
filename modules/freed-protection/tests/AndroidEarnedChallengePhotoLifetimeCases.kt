package app.freed.protection

import android.app.Activity
import android.content.Context
import android.content.Environment
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

private class CameraHarness {
  val context = Context(); val activity = Activity(); val pipeline = FreedEarnedChallengePhotoPipeline()
  val results = mutableListOf<Pair<String, String?>>()
  val id = UUID.randomUUID().toString(); val sessionId = UUID.randomUUID().toString()
  var relay: FreedEarnedChallengeCaptureActivity? = null
  var output: File? = null
  fun start() {
    pipeline.capture(context, activity, sessionId, "chair", id, { true }) { outcome, digest -> synchronized(results) { results.add(outcome to digest) } }
    check(Environment.relay.size == 1) { "Native relay did not launch" }
    relay = FreedEarnedChallengeCaptureActivity().also { it.intent = Environment.relay.last(); it.onCreate(null) }
    check(Environment.external.size == 1) { "External camera did not launch through actual relay" }
    output = File((Environment.external.single().extras["output"] as Uri).path)
    check(output!!.exists())
  }
  fun next(): List<Pair<String, String?>> {
    val next = mutableListOf<Pair<String, String?>>()
    pipeline.capture(context, activity, UUID.randomUUID().toString(), "chair", UUID.randomUUID().toString(), { true }) { outcome, digest -> next.add(outcome to digest) }
    return next
  }
  fun lateWriteAndResult() {
    output!!.writeText("late external camera output")
    relay!!.onActivityResult(9408, Activity.RESULT_OK, null)
    check(!output!!.exists()) { "Late camera result left cancelled native output behind" }
    check(results.single().first == "cancelled" && results.single().second == null) { "Cancelled camera published proof or duplicated callback" }
    check(Environment.classifierCalls == 0) { "Cancelled camera result entered local classifier" }
  }
  fun deadline() {
    val field = FreedEarnedChallengePhotoPipeline::class.java.getDeclaredField("operation").apply { isAccessible = true }
    val active = field.get(null) ?: error("Missing owned operation for deadline")
    val method = FreedEarnedChallengePhotoPipeline::class.java.declaredMethods.single { it.name == "cancelOperation" }.apply { isAccessible = true }
    method.invoke(pipeline, active, "cancelled") // same actual handler scheduled by native 120-second deadline; no real wait.
  }
  fun close() {
    relay?.onActivityResult(9408, 0, null)
    pipeline.destroy()
  }
}

fun main() {
  val failures = mutableListOf<String>()
  fun scenario(name: String, body: () -> Unit) {
    Environment.reset(); Environment.cache.mkdirs()
    try { body(); println("PASS: $name") } catch (error: Throwable) { failures.add(name + ": " + (error.cause?.message ?: error.message)); println("FAIL: ${failures.last()}") }
  }
  for (mode in listOf("session cancellation", "camera deadline", "relay destruction", "module destruction")) {
    scenario("$mode keeps physical camera ownership until native result drains") {
      val h = CameraHarness()
      try {
        h.start()
        when (mode) {
          "session cancellation" -> h.pipeline.cancelSession(h.sessionId)
          "camera deadline" -> h.deadline()
          "relay destruction" -> h.relay!!.onDestroy()
          "module destruction" -> h.pipeline.destroy()
        }
        check(h.results.single().first == "cancelled")
        check(Environment.revoked.any { it.path == h.output!!.absolutePath }) { "Cancelled camera did not revoke URI access" }
        if (mode != "module destruction") check(h.next() == listOf("unavailable" to null)) { "Next capture entered while cancelled external camera still owned output" }
        h.lateWriteAndResult()
        if (mode != "module destruction") {
          val oldRelayCount = Environment.relay.size; check(h.next().isEmpty() && Environment.relay.size == oldRelayCount + 1) { "Drained camera slot did not admit next native capture" }
          val latest = Environment.relay.last().getStringExtra("captureOperationId")!!
          // A duplicate old result may not affect a newer operation.
          FreedEarnedChallengePhotoPipeline.cameraResult(h.id, true)
          check(FreedEarnedChallengePhotoPipeline.cameraIntent(latest) != null)
          FreedEarnedChallengePhotoPipeline.cameraResult(latest, false)
        }
      } finally { h.close() }
    }
  }
  scenario("cancelled late owned camera result removes a recreated output") {
    val h = CameraHarness()
    try { h.start(); h.pipeline.cancelSession(h.sessionId); h.lateWriteAndResult() } finally { h.close() }
  }
  scenario("cancelled external camera serializes the next capture until its callback") {
    val h = CameraHarness()
    try {
      h.start(); h.pipeline.cancelSession(h.sessionId)
      check(h.next() == listOf("unavailable" to null)) { "A second native capture started before the first camera drained" }
      h.lateWriteAndResult()
    } finally { h.close() }
  }
  scenario("rotation retains cancelled camera tombstone without opening another external camera") {
    val h = CameraHarness()
    try {
      h.start(); h.pipeline.cancelSession(h.sessionId)
      h.relay!!.isChangingConfigurations = true; h.relay!!.onDestroy()
      val rotated = FreedEarnedChallengeCaptureActivity(); rotated.intent = Environment.relay.first(); rotated.onCreate(Bundle()); h.relay = rotated
      check(!rotated.isFinishing && Environment.external.size == 1) { "Rotated relay discarded owned cancelled-camera callback" }
      h.lateWriteAndResult()
    } finally { h.close() }
  }
  scenario("external camera launch exception drains output and permits next capture") {
    val h = CameraHarness()
    try {
      Environment.launchThrows = true
      h.pipeline.capture(h.context, h.activity, h.sessionId, "chair", h.id, { true }) { outcome, digest -> h.results.add(outcome to digest) }
      val relay = FreedEarnedChallengeCaptureActivity(); relay.intent = Environment.relay.single(); relay.onCreate(null)
      check(h.results.single() == ("cancelled" to null) && Environment.external.isEmpty())
      check(File(h.context.cacheDir, "freed-earned-challenge-captures-v1").listFiles().orEmpty().none { it.extension == "jpg" })
      Environment.launchThrows = false; check(h.next().isEmpty())
      val id = Environment.relay.last().getStringExtra("captureOperationId")!!; FreedEarnedChallengePhotoPipeline.cameraResult(id, false)
    } finally { h.close() }
  }
  scenario("local classifier process launch exception closes adapter and cleans owned output") {
    val h = CameraHarness()
    try {
      h.start(); h.output!!.writeText("fresh local camera file"); h.relay!!.onActivityResult(9408, Activity.RESULT_OK, null)
      val deadline = java.lang.System.nanoTime() + TimeUnit.SECONDS.toNanos(2)
      while ((synchronized(h.results) { h.results.isEmpty() } || Environment.classifierCloses == 0) && java.lang.System.nanoTime() < deadline) Thread.sleep(10)
      check(synchronized(h.results) { h.results.single() } == ("unavailable" to null))
      check(Environment.classifierCalls == 1 && Environment.classifierCloses == 1 && !h.output!!.exists())
    } finally { h.close() }
  }
  check(failures.isEmpty()) { failures.joinToString("\n") }
  println("Actual native photo lifetime adapters passed. Test-only catalog seam; no real evaluation, match, proof, device or production target enablement.")
}
