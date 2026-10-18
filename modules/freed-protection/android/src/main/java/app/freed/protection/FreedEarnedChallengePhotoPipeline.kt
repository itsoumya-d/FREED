package app.freed.protection

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** Private output + native result callback. No URI or classification labels are published to JavaScript. */
internal class FreedEarnedChallengePhotoPipeline {
  private class Operation(val owner: FreedEarnedChallengePhotoPipeline, val context: Context, val sessionId: String, val target: String,
    val id: String, val file: File, val uri: Uri, val current: () -> Boolean, val publish: (String, String?) -> Unit) {
    @Volatile var cancelled = false
    var captured = false
    var cameraLaunched = false
    @Volatile var physicalTask = false
    var published = false
    var cameraDeadline: java.util.concurrent.ScheduledFuture<*>? = null
  }
  companion object {
    private val lock = Any()
    private var operation: Operation? = null
    private const val DIRECTORY = "freed-earned-challenge-captures-v1"
    fun cameraIntent(id: String): Intent? {
      val active = synchronized(lock) { operation?.takeIf { it.id == id && !it.cancelled } } ?: return null
      if (!active.current()) return null
      val admitted = synchronized(lock) { (operation === active && !active.cancelled).also { if (it) active.cameraLaunched = true } }
      if (!admitted) return null
      return Intent("android.media.action.IMAGE_CAPTURE").putExtra("output", active.uri)
        .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    fun cameraResult(id: String, accepted: Boolean) {
      val active = synchronized(lock) { operation?.takeIf { it.id == id && !it.captured }?.also { it.captured = true } } ?: return
      active.cameraDeadline?.cancel(false)
      active.owner.revoke(active)
      if (!accepted || active.cancelled) active.owner.complete(active, "cancelled", null) else active.owner.classify(active)
    }
    fun ownsCamera(id: String): Boolean = synchronized(lock) { operation?.let { it.id == id && it.cameraLaunched && !it.captured } == true }
    fun abandonCamera(id: String) {
      val active = synchronized(lock) { operation?.takeIf { it.id == id && !it.captured } } ?: return
      // Relay destruction is not evidence that the external camera has released its output.
      active.owner.cancelOperation(active, "cancelled")
    }
  }
  private val executor = Executors.newSingleThreadExecutor { Thread(it, "freed-earned-photo") }
  private val deadlines = Executors.newSingleThreadScheduledExecutor { Thread(it, "freed-earned-photo-deadline") }
  private val usedIds = mutableSetOf<String>()
  @Volatile private var destroyed = false
  fun cleanup(context: Context): Boolean {
    val directory = File(context.cacheDir, DIRECTORY)
    if (!directory.exists()) return true
    val candidates = directory.listFiles() ?: return false
    if (candidates.size > 128) return false
    val live = synchronized(lock) { operation?.file }
    return candidates.filter { it != live && it.name.matches(Regex("^[a-f0-9-]{36}\\.jpg$")) }.all { file ->
      val revoked = runCatching { context.revokeUriPermission(FileProvider.getUriForFile(context, context.packageName + ".freedchallengephotos", file), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }.isSuccess
      val deleted = file.delete() || !file.exists()
      revoked && deleted
    }
  }
  fun capture(context: Context, activity: Activity?, sessionId: String, target: String, id: String, current: () -> Boolean, publish: (String, String?) -> Unit) {
    synchronized(lock) {
      if (destroyed || activity == null || !current() || target !in FreedEarnedChallengePhotoEvaluation.reviewedTargetIds || operation != null || usedIds.size >= 128 || !usedIds.add(id) || !cleanup(context)) { publish("unavailable", null); return }
      val directory = File(context.cacheDir, DIRECTORY)
      val file = File(directory, "${java.util.UUID.randomUUID()}.jpg")
      val created = runCatching { (directory.isDirectory || directory.mkdirs()) && file.createNewFile() }.getOrDefault(false)
      if (!created) { publish("unavailable", null); return }
      val uri = runCatching { FileProvider.getUriForFile(context, context.packageName + ".freedchallengephotos", file) }.getOrNull()
      if (uri == null) { file.delete(); publish("unavailable", null); return }
      val active = Operation(this, context, sessionId, target, id, file, uri, current, publish)
      operation = active
      active.cameraDeadline = deadlines.schedule({ cancelOperation(active, "cancelled") }, 120, TimeUnit.SECONDS)
      activity.runOnUiThread {
        if (!current() || !activity.hasWindowFocus() || activity.isFinishing || activity.isDestroyed) { complete(active, "cancelled", null); return@runOnUiThread }
        runCatching { activity.startActivity(Intent(activity, FreedEarnedChallengeCaptureActivity::class.java).putExtra("captureOperationId", id)) }
          .onFailure { complete(active, "unavailable", null) }
      }
    }
  }
  private fun classify(active: Operation) {
    executor.execute {
      var labeler: com.google.mlkit.vision.label.ImageLabeler? = null
      var physicalTaskStarted = false
      try {
        if (active.cancelled || !active.current() || !active.file.isFile || active.file.length() !in 1..20_000_000L) { complete(active, "cancelled", null); return@execute }
        val digest = active.file.inputStream().use { input ->
          val sha = MessageDigest.getInstance("SHA-256"); val buffer = ByteArray(8192)
          while (true) { val size = input.read(buffer); if (size < 0) break; sha.update(buffer, 0, size) }
          sha.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
        }
        if (FreedEarnedChallengeProofStore.rows(active.context)?.any { it["captureDigest"] == digest || it["captureOperationId"] == active.id } != false) { complete(active, "unavailable", null); return@execute }
        val classifier = ImageLabeling.getClient(ImageLabelerOptions.Builder().setConfidenceThreshold(0.65f).build()); labeler = classifier
        val image = InputImage.fromFilePath(active.context, active.uri)
        if (active.cancelled || !active.current()) { complete(active, "cancelled", null); return@execute }
        val admitted = synchronized(lock) { (operation === active && !active.cancelled).also { if (it) active.physicalTask = true } }
        if (!admitted) return@execute
        val deadline = deadlines.schedule({ cancelOperation(active, "unavailable") }, 8, TimeUnit.SECONDS)
        val physicalTask = classifier.process(image)
        physicalTaskStarted = true
        physicalTask.addOnCompleteListener(executor) { task ->
          try {
            val acceptedLabels = when (active.target) { "flower" -> listOf("flower", "blossom"); "cup" -> listOf("cup", "mug"); "shoe" -> listOf("shoe", "sneakers"); else -> listOf(active.target) }
            val matched = task.isSuccessful && task.result.any { label -> label.confidence >= 0.65f && acceptedLabels.any { FreedPhotoTargetMatching.matches(label.text, it) } }
            complete(active, if (active.cancelled || !active.current()) "cancelled" else if (!task.isSuccessful) "unavailable" else if (matched) "matched" else "uncertain", digest.takeIf { matched })
          } finally { deadline.cancel(false); classifier.close(); if (destroyed) executor.shutdown() }
        }
      } catch (_: Exception) { complete(active, "unavailable", null) }
      finally { if (!physicalTaskStarted) { labeler?.close(); if (destroyed) executor.shutdown() } }
    }
  }
  private fun revoke(active: Operation): Boolean = runCatching {
    active.context.revokeUriPermission(active.uri, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
  }.isSuccess
  private fun complete(active: Operation, outcome: String, digest: String?) {
    val publication = synchronized(lock) {
      if (operation !== active) return
      active.cameraDeadline?.cancel(false)
      operation = null
      val revoked = revoke(active)
      val deleted = active.file.delete() || !active.file.exists()
      if (active.published) null else {
        active.published = true
        Triple(active.publish, if (deleted && revoked) outcome else "unavailable", if (deleted && revoked) digest else null)
      }
    }
    publication?.let { it.first(it.second, it.third) }
  }
  private fun cancelOperation(active: Operation, outcome: String) {
    val publication = synchronized(lock) {
      if (operation !== active || active.published) return
      active.cancelled = true; active.published = true; active.cameraDeadline?.cancel(false)
      val revoked = revoke(active)
      val deleted = active.file.delete() || !active.file.exists()
      // One bounded tombstone retains the physical slot through camera or classifier drain.
      if (!active.cameraLaunched && !active.physicalTask) operation = null
      active.publish to if (deleted && revoked) outcome else "unavailable"
    }
    publication.first(publication.second, null)
  }
  fun cancelSession(sessionId: String) {
    val active = synchronized(lock) { operation?.takeIf { it.owner === this && it.sessionId == sessionId } } ?: return
    cancelOperation(active, "cancelled")
  }
  fun destroy() {
    destroyed = true
    val active = synchronized(lock) { operation?.takeIf { it.owner === this } }
    if (active != null) cancelSession(active.sessionId)
    deadlines.shutdownNow()
    if (active?.physicalTask != true) executor.shutdown()
  }
}
