package app.freed.protection

import android.app.Activity
import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import java.util.UUID

/** One live observer per native module, bound to native offer and current owner at every publication. */
internal class FreedEarnedChallengeEvidenceController {
  private class Session(val context: Context, val id: String, val request: Map<String, Any?>, val offer: Map<String, Any?>, val token: String) {
    var phase = "active"
    var observed = 0L
    var sensor: FreedEarnedChallengeStepSensor? = null
    var pendingStep: Map<String, Any?>? = null
    val photos = mutableListOf<Map<String, Any?>>()
    val duration get() = FreedEarnedChallengeProofPolicy.integer((offer["request"] as Map<*, *>)["requestedSeconds"]) ?: 0L
  }
  private val sessions = linkedMapOf<String, Session>()
  private val photos = FreedEarnedChallengePhotoPipeline()
  private var foreground = false
  private var destroyed = false
  private val validityExecutor = java.util.concurrent.Executors.newSingleThreadScheduledExecutor { runnable -> Thread(runnable, "freed-challenge-validity").apply { isDaemon = true } }
  private var validityWatch: java.util.concurrent.ScheduledFuture<*>? = null
  private fun stopWatchIfIdle() {
    if (sessions.values.none { it.phase == "active" }) { validityWatch?.cancel(false); validityWatch = null }
  }
  private fun ensureWatch() {
    if (destroyed || validityWatch != null) return
    validityWatch = validityExecutor.scheduleAtFixedRate({ synchronized(FreedNativeUnlockStore.lock) {
      if (!destroyed) sessions.values.filter { it.phase == "active" && !current(it.context, it) }.forEach { cancel(it) }
      stopWatchIfIdle()
    } }, 1L, 1L, java.util.concurrent.TimeUnit.SECONDS)
  }
  fun initialize(context: Context) { photos.cleanup(context) }
  fun foreground(active: Boolean) = synchronized(FreedNativeUnlockStore.lock) {
    foreground = active
    if (!active) sessions.values.filter { it.phase == "active" && it.request["method"] == "steps" }.forEach { pause(it) }
  }
  fun destroy() = synchronized(FreedNativeUnlockStore.lock) {
    destroyed = true; validityWatch?.cancel(false); validityWatch = null; validityExecutor.shutdownNow(); sessions.values.forEach { it.sensor?.stop() }; photos.destroy(); sessions.clear()
  }
  /** Only original binding resources. Erased proofs are never recreated during cancellation. */
  fun cancelOriginalBinding(token: String): Boolean = synchronized(FreedNativeUnlockStore.lock) {
    sessions.values.filter { it.token == token }.forEach { session ->
      session.sensor?.stop(); session.sensor = null; photos.cancelSession(session.id)
      session.phase = "cancelled"; session.pendingStep = null; session.photos.clear()
    }
    sessions.entries.removeAll { it.value.token == token }; stopWatchIfIdle()
    sessions.values.none { it.token == token }
  }
  private fun current(context: Context, session: Session): Boolean = !destroyed && session.phase != "cancelled" &&
    FreedAppGroupStore.earnedEvidenceAuthority(context, session.request["offerId"] as String, session.token)?.let { FreedEarnedAppTimePolicy.exact(it, session.offer) } == true
  private fun view(session: Session): Map<String, Any?> = mapOf("evidenceSessionId" to session.id, "offerId" to session.request["offerId"],
    "completionSessionId" to session.request["completionSessionId"], "templateId" to session.request["templateId"], "templateVersion" to 2,
    "method" to session.request["method"], "phase" to session.phase, "observedSteps" to session.observed,
    "requiredSteps" to FreedEarnedAppTimePolicy.requiredSteps(session.duration), "requiredPhotoTargets" to FreedEarnedAppTimePolicy.requiredPhotoTargets(session.duration),
    "supportedTargetIds" to if (session.request["method"] == "photo") FreedEarnedChallengeProofPolicy.targets(session.request["templateId"] as String, session.duration).orEmpty() else emptyList<String>(),
    "matchedTargetIds" to session.photos.mapNotNull { it["targetId"] as? String }.sorted(),
    "stepProofId" to session.pendingStep?.get("proofId").takeIf { session.phase == "completed" }, "photoProofIds" to session.photos.map { it["proofId"] })
  private fun reply(session: Session, accepted: Boolean = true, reason: String? = null) = FreedEarnedChallengeProofPolicy.reply(accepted, reason, view(session))
  private fun pause(session: Session) { session.sensor?.stop(); session.phase = "paused"; stopWatchIfIdle() }
  private fun cancel(session: Session): Boolean {
    session.sensor?.stop(); photos.cancelSession(session.id)
    if (!FreedPrivateAccountAdmission.valid(session.token)) {
      session.phase = "cancelled"; session.pendingStep = null; session.photos.clear(); stopWatchIfIdle(); return true
    }
    val owner = session.offer["ownerDigest"] as String
    if (!FreedEarnedChallengeProofStore.revokeSession(session.context, session.id, owner) { !destroyed && sessions[session.id] === session && session.offer["ownerDigest"] == owner }) { session.phase = "paused"; return false }
    session.phase = "cancelled"; session.pendingStep = null; session.photos.clear(); stopWatchIfIdle(); return true
  }
  private fun startSensor(context: Context, session: Session): Boolean {
    session.sensor = FreedEarnedChallengeStepSensor(context) { delta -> synchronized(FreedNativeUnlockStore.lock) {
      if (delta > 0 && foreground && session.phase == "active" && current(context, session)) session.observed = (session.observed + delta.coerceAtMost(FreedEarnedAppTimePolicy.requiredSteps(session.duration))).coerceAtMost(FreedEarnedAppTimePolicy.requiredSteps(session.duration))
      else if (!current(context, session)) cancel(session)
    } }
    return session.sensor?.start() == true
  }
  fun begin(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    fun reject(reason: String) = FreedEarnedChallengeProofPolicy.reply(reason = reason)
    if (!FreedEarnedChallengeProofPolicy.validBegin(request)) return@synchronized reject("earned-challenge-request-invalid")
    val offer = FreedAppGroupStore.earnedEvidenceAuthority(context, request["offerId"] as String, token) ?: return@synchronized reject("earned-challenge-authority-stale")
    val duration = FreedEarnedChallengeProofPolicy.integer((offer["request"] as Map<*, *>)["requestedSeconds"]) ?: return@synchronized reject("earned-challenge-authority-stale")
    val supportedTargets = (offer["supportedPhotoTargetIds"] as? List<*>)?.filterIsInstance<String>().orEmpty().filter { it in FreedEarnedChallengePhotoEvaluation.reviewedTargetIds }
    if (request["method"] !in (offer["availableMethods"] as List<*>)) return@synchronized reject("earned-challenge-method-unavailable")
    if (!FreedEarnedChallengeProofPolicy.templateValid(request, duration, supportedTargets)) return@synchronized reject("earned-challenge-template-invalid")
    if (sessions.values.any { it.token == token && it.request["completionSessionId"] == request["completionSessionId"] && it.phase != "cancelled" && !FreedEarnedAppTimePolicy.exact(it.request, request) }) return@synchronized reject("earned-challenge-replacement-requires-cancel")
    val same = sessions.values.firstOrNull { it.token == token && FreedEarnedAppTimePolicy.exact(it.request, request) && it.phase != "cancelled" && current(context, it) }
    if (same != null) return@synchronized reply(same)
    val records = FreedEarnedChallengeProofStore.rows(context) ?: return@synchronized reject("earned-challenge-proof-store-unreadable")
    if (records.any { it["offerId"] == offer["offerId"] && it["completionSessionId"] == request["completionSessionId"] && (it["templateId"] != request["templateId"] || it["method"] != request["method"]) && it["consumedBy"] == null }) return@synchronized reject("earned-challenge-replacement-requires-cancel")
    val retained = records.filter { it["ownerDigest"] == offer["ownerDigest"] && it["offerId"] == offer["offerId"] && it["completionSessionId"] == request["completionSessionId"] &&
      it["templateId"] == request["templateId"] && it["method"] == request["method"] && it["consumedBy"] == null && FreedEarnedAppTimePolicy.exact(it["offerBinding"], offer["request"]) }
    if (retained.isNotEmpty() && retained.map { it["evidenceSessionId"] }.distinct().size == 1) {
      val restored = Session(context, retained.first()["evidenceSessionId"] as String, request, offer, token)
      if (request["method"] == "steps") { restored.pendingStep = retained.singleOrNull(); restored.observed = FreedEarnedChallengeProofPolicy.integer(restored.pendingStep?.get("observedSteps")) ?: 0L }
      else restored.photos.addAll(retained)
      restored.phase = if (request["method"] == "steps" && restored.observed >= FreedEarnedAppTimePolicy.requiredSteps(duration) || request["method"] == "photo" && restored.photos.size == (FreedEarnedAppTimePolicy.requiredPhotoTargets(duration)).toInt()) "completed" else "paused"
      sessions[restored.id] = restored
      return@synchronized reply(restored)
    }
    if (!foreground || destroyed) return@synchronized reject("earned-challenge-foreground-required")
    if (request["method"] == "steps" && (!FreedEarnedChallengeStepSensor.supported(context) || !FreedEarnedChallengeStepSensor.permitted(context))) return@synchronized reject("earned-challenge-step-permission-or-sensor-required")
    if (sessions.values.filter { it.phase == "active" || it.phase == "paused" }.any { !cancel(it) }) return@synchronized reject("earned-challenge-persistence-failed")
    if (sessions.size >= 128) sessions.entries.removeAll { it.value.phase == "cancelled" }
    if (sessions.size >= 128) return@synchronized reject("earned-challenge-session-capacity")
    val session = Session(context, UUID.randomUUID().toString(), request, offer, token)
    sessions[session.id] = session
    if (request["method"] == "steps" && !startSensor(context, session)) { cancel(session); return@synchronized reject("earned-challenge-step-sensor-unavailable") }
    ensureWatch(); reply(session)
  }
  private fun resolve(context: Context, request: Map<String, Any?>, token: String): Session? {
    val id = request["evidenceSessionId"] as? String ?: return null
    val session = sessions[id] ?: run {
      val records = FreedEarnedChallengeProofStore.rows(context)?.filter { it["evidenceSessionId"] == id && it["consumedBy"] == null }.orEmpty()
      val proof = records.firstOrNull() ?: return null
      val begin = mapOf("version" to 1L, "offerId" to proof["offerId"], "completionSessionId" to proof["completionSessionId"], "templateId" to proof["templateId"], "templateVersion" to proof["templateVersion"], "method" to proof["method"])
      if (this.begin(context, begin, token)["accepted"] != true) return null
      sessions[id] ?: return null
    }
    if (session.token != token) return null
    if (!current(context, session)) { cancel(session); return null }
    return session
  }
  fun get(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedEarnedChallengeProofPolicy.validSessionRequest(request)) return@synchronized FreedEarnedChallengeProofPolicy.reply(reason = "earned-challenge-request-invalid")
    val session = resolve(context, request, token) ?: return@synchronized FreedEarnedChallengeProofPolicy.reply(reason = "earned-challenge-authority-stale")
    if (session.request["method"] == "steps" && session.phase == "active" && !FreedEarnedChallengeStepSensor.permitted(context)) { pause(session); return@synchronized reply(session, false, "earned-challenge-step-permission-required") }
    reply(session)
  }
  fun phase(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedEarnedChallengeProofPolicy.validSessionRequest(request, setOf("phase")) || request["phase"] !in setOf("active", "paused", "cancelled")) return@synchronized FreedEarnedChallengeProofPolicy.reply(reason = "earned-challenge-request-invalid")
    val session = resolve(context, request, token) ?: return@synchronized FreedEarnedChallengeProofPolicy.reply(reason = "earned-challenge-authority-stale")
    if (request["phase"] == "cancelled") { val cancelled = cancel(session); return@synchronized reply(session, cancelled, if (cancelled) null else "earned-challenge-persistence-failed") }
    if (session.phase == "completed") return@synchronized reply(session)
    if (request["phase"] == "paused") { pause(session); photos.cancelSession(session.id); return@synchronized reply(session) }
    if (!foreground) return@synchronized reply(session, false, "earned-challenge-foreground-required")
    if (session.phase == "active") return@synchronized reply(session)
    if (session.request["method"] == "steps" && !startSensor(context, session)) return@synchronized reply(session, false, "earned-challenge-step-permission-or-sensor-required")
    session.phase = "active"; ensureWatch(); reply(session)
  }
  private fun record(context: Context, session: Session, proofId: String, target: String? = null, captureId: String? = null, digest: String? = null): Map<String, Any?> = mapOf(
    "proofId" to proofId, "evidenceSessionId" to session.id, "method" to session.request["method"], "ownerDigest" to session.offer["ownerDigest"], "offerId" to session.request["offerId"],
    "completionSessionId" to session.request["completionSessionId"], "templateId" to session.request["templateId"], "templateVersion" to 2L, "offerBinding" to session.offer["request"],
    "observedSteps" to session.observed, "targetId" to target, "captureOperationId" to captureId, "captureDigest" to digest,
    "providerRevision" to if (target == null) null else FreedEarnedChallengePhotoEvaluation.PROVIDER_REVISION,
    "createdAtMs" to System.currentTimeMillis(), "createdElapsedMs" to SystemClock.elapsedRealtime(), "boot" to Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1).toLong(), "consumedBy" to null)
  fun finish(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedEarnedChallengeProofPolicy.validSessionRequest(request)) return@synchronized FreedEarnedChallengeProofPolicy.reply(reason = "earned-challenge-request-invalid")
    val session = resolve(context, request, token) ?: return@synchronized FreedEarnedChallengeProofPolicy.reply(reason = "earned-challenge-authority-stale")
    if (session.phase == "completed") return@synchronized reply(session)
    if (!foreground || session.phase != "active") return@synchronized reply(session, false, "earned-challenge-active-required")
    if (session.request["method"] == "steps") {
      if (!FreedEarnedChallengeStepSensor.permitted(context)) { pause(session); return@synchronized reply(session, false, "earned-challenge-step-permission-required") }
      if (session.observed < FreedEarnedAppTimePolicy.requiredSteps(session.duration)) return@synchronized reply(session, false, "earned-challenge-evidence-incomplete")
      if (session.pendingStep == null) session.pendingStep = record(context, session, UUID.randomUUID().toString())
      if (!FreedEarnedChallengeProofStore.save(context, listOf(session.pendingStep!!)) { current(context, session) && foreground && session.phase == "active" }) return@synchronized reply(session, false, "earned-challenge-persistence-failed")
    } else if (session.photos.size != (FreedEarnedAppTimePolicy.requiredPhotoTargets(session.duration)).toInt()) return@synchronized reply(session, false, "earned-challenge-evidence-incomplete")
    session.sensor?.stop(); session.phase = "completed"; stopWatchIfIdle(); reply(session)
  }
  fun capture(context: Context?, activity: Activity?, request: Map<String, Any?>, token: String, publish: (Map<String, Any?>) -> Unit) {
    synchronized(FreedNativeUnlockStore.lock) {
      if (context == null || !FreedEarnedChallengeProofPolicy.validSessionRequest(request, setOf("targetId", "captureOperationId")) || !FreedEarnedChallengeProofPolicy.validId(request["captureOperationId"])) {
        publish(FreedEarnedChallengeProofPolicy.photoReply(reason = "earned-challenge-request-invalid")); return
      }
      val session = resolve(context, request, token)
      val target = request["targetId"] as? String
      if (session == null || session.request["method"] != "photo" || !foreground || session.phase != "active" || target !in (view(session)["supportedTargetIds"] as List<*>) || target !in FreedEarnedChallengePhotoEvaluation.reviewedTargetIds || session.photos.any { it["targetId"] == target }) {
        publish(FreedEarnedChallengeProofPolicy.photoReply(reason = "earned-challenge-photo-unavailable")); return
      }
      photos.capture(context, activity, session.id, target!!, request["captureOperationId"] as String, { synchronized(FreedNativeUnlockStore.lock) { current(context, session) && session.phase == "active" } }) { outcome, digest ->
        synchronized(FreedNativeUnlockStore.lock) {
          if (!current(context, session) || session.phase != "active") { publish(FreedEarnedChallengeProofPolicy.photoReply(result = "cancelled", reason = "earned-challenge-authority-stale")); return@synchronized }
          if (outcome != "matched" || digest == null) { publish(FreedEarnedChallengeProofPolicy.photoReply(session = view(session), result = outcome, targetId = target)); return@synchronized }
          val proof = record(context, session, UUID.randomUUID().toString(), target, request["captureOperationId"] as String, digest)
          if (!FreedEarnedChallengeProofStore.save(context, listOf(proof)) { current(context, session) && session.phase == "active" }) { publish(FreedEarnedChallengeProofPolicy.photoReply(reason = "earned-challenge-persistence-failed", session = view(session))); return@synchronized }
          session.photos.add(proof); publish(FreedEarnedChallengeProofPolicy.photoReply(true, null, view(session), "matched", target, proof["proofId"] as String))
        }
      }
    }
  }
  /** Compatibility API: a caller URI is not a native-owned camera result. */
  fun verify(context: Context, request: Map<String, Any?>, token: String): Map<String, Any?> = synchronized(FreedNativeUnlockStore.lock) {
    if (!FreedEarnedChallengeProofPolicy.validSessionRequest(request, setOf("targetId", "captureOperationId", "uri"))) return@synchronized FreedEarnedChallengeProofPolicy.photoReply(reason = "earned-challenge-request-invalid")
    val session = resolve(context, request, token)
    FreedEarnedChallengeProofPolicy.photoReply(reason = "earned-challenge-native-capture-required", session = session?.let(::view))
  }
}
