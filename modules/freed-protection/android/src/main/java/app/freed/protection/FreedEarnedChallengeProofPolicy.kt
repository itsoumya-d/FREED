package app.freed.protection

/** Authored requirements and proof binding; caller counts and classifier labels carry no authority. */
internal object FreedEarnedChallengeProofPolicy {
  const val KEY = "app_group_earned_challenge_proofs_v1"
  const val MAX_RECORDS = 4096
  const val MAX_BYTES = 4 * 1024 * 1024
  private val uuid = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
  private val identifier = Regex("^[A-Za-z0-9:_-]{1,160}$")
  val targetCatalog = setOf("flower", "plant", "chair", "cup", "shoe", "branch", "clock", "fruit")
  fun integer(value: Any?) = FreedAppGroupPolicy.integer(value)
  fun validId(value: Any?) = (value as? String)?.matches(uuid) == true
  fun validBegin(request: Map<String, Any?>) = request.keys == setOf("version", "offerId", "completionSessionId", "templateId", "templateVersion", "method") &&
    integer(request["version"]) == 1L && validId(request["offerId"]) && integer(request["templateVersion"]) == 2L &&
    listOf("completionSessionId", "templateId").all { (request[it] as? String)?.matches(identifier) == true } && request["method"] in setOf("steps", "photo")
  fun validSessionRequest(request: Map<String, Any?>, extra: Set<String> = emptySet()) = request.keys == setOf("version", "evidenceSessionId") + extra &&
    integer(request["version"]) == 1L && validId(request["evidenceSessionId"])
  fun targets(template: String, duration: Long): List<String>? {
    if (FreedEarnedAppTimePolicy.seconds(duration) == null) return null
    val suffix = ":earned-v2:$duration"
    if (!template.startsWith("momentum-find-") || !template.endsWith(suffix)) return null
    val selected = template.removePrefix("momentum-find-").removeSuffix(suffix).split('-')
    if (selected.size != FreedEarnedAppTimePolicy.requiredPhotoTargets(duration).toInt() || selected.any { it !in targetCatalog } || selected.distinct().size != selected.size || selected != selected.sorted()) return null
    if (selected.size == 2 && selected.all { it in setOf("flower", "plant", "branch", "fruit") }) return null
    return selected
  }
  fun templateValid(request: Map<String, Any?>, duration: Long, supportedTargets: List<String>) = if (request["method"] == "steps")
    request["templateId"] == "momentum-move-steps:earned-v2:$duration"
    else targets(request["templateId"] as String, duration)?.all { it in supportedTargets } == true
  fun reply(accepted: Boolean = false, reason: String? = "earned-challenge-unavailable", session: Map<String, Any?>? = null, supported: Boolean = true): Map<String, Any?> =
    mapOf("version" to 1, "supported" to supported, "accepted" to accepted, "reason" to reason, "session" to session)
  fun photoReply(accepted: Boolean = false, reason: String? = "earned-challenge-photo-unavailable", session: Map<String, Any?>? = null,
    result: String? = "unavailable", targetId: String? = null, proofId: String? = null): Map<String, Any?> = reply(accepted, reason, session) + mapOf("result" to result, "targetId" to targetId, "proofId" to proofId)

  fun validRecord(record: Map<String, Any?>): Boolean = record.keys == setOf("proofId", "evidenceSessionId", "method", "ownerDigest", "offerId", "completionSessionId", "templateId", "templateVersion", "offerBinding", "observedSteps", "targetId", "captureOperationId", "captureDigest", "providerRevision", "createdAtMs", "createdElapsedMs", "boot", "consumedBy") &&
    validId(record["proofId"]) && validId(record["evidenceSessionId"]) && validId(record["offerId"]) &&
    record["method"] in setOf("steps", "photo") && !(record["ownerDigest"] as? String).isNullOrBlank() && integer(record["templateVersion"]) == 2L &&
    listOf("completionSessionId", "templateId").all { (record[it] as? String)?.matches(identifier) == true } &&
    (record["offerBinding"] as? Map<*, *>)?.let { @Suppress("UNCHECKED_CAST") FreedEarnedAppTimePolicy.validOfferRequest(it as Map<String, Any?>) } == true &&
    integer(record["observedSteps"]) != null && (integer(record["createdAtMs"]) ?: 0L) > 0L && integer(record["createdElapsedMs"]) != null && integer(record["boot"]) != null &&
    (record["consumedBy"] == null || record["consumedBy"] == record["completionSessionId"]) &&
    if (record["method"] == "steps") record["targetId"] == null && record["captureOperationId"] == null && record["captureDigest"] == null && record["providerRevision"] == null
    else record["targetId"] in targetCatalog && validId(record["captureOperationId"]) && (record["captureDigest"] as? String)?.matches(Regex("^[a-f0-9]{64}$")) == true && !(record["providerRevision"] as? String).isNullOrBlank()

  fun consumed(records: List<Map<String, Any?>>, request: Map<String, Any?>, owner: String, offer: Map<String, Any?>): List<Map<String, Any?>>? {
    val evidence = request["evidence"] as? Map<*, *> ?: return null
    if (evidence["method"] == "timer") return records
    // New native grants use the frozen sensor/photo evidence; preserve legacy receipt parsing for exact replay.
    if (integer(evidence["activeDurationSec"]) != 0L) return null
    val duration = integer((offer["request"] as? Map<*, *>)?.get("requestedSeconds")) ?: return null
    val ids = if (evidence["method"] == "steps") listOfNotNull(evidence["stepProofId"] as? String) else (evidence["photoProofIds"] as? List<*>)?.filterIsInstance<String>() ?: return null
    if (ids.isEmpty() || ids.distinct().size != ids.size) return null
    val selected = ids.map { id -> records.firstOrNull { it["proofId"] == id } ?: return null }
    if (selected.any { !validRecord(it) || it["consumedBy"] != null || it["method"] != evidence["method"] || it["ownerDigest"] != owner ||
      it["offerId"] != offer["offerId"] || it["completionSessionId"] != request["completionSessionId"] || it["templateId"] != request["templateId"] ||
      it["templateVersion"] != request["templateVersion"] && integer(it["templateVersion"]) != integer(request["templateVersion"]) ||
      !FreedEarnedAppTimePolicy.exact(it["offerBinding"], offer["request"]) } || selected.map { it["evidenceSessionId"] }.distinct().size != 1) return null
    if (evidence["method"] == "steps") {
      if (selected.size != 1 || (integer(selected.single()["observedSteps"]) ?: 0L) < FreedEarnedAppTimePolicy.requiredSteps(duration) ||
        integer(evidence["observedSteps"]) != integer(selected.single()["observedSteps"])) return null
    } else {
      val required = targets(request["templateId"] as String, duration) ?: return null
      if (selected.map { it["targetId"] }.toSet() != required.toSet() || selected.size != required.size || selected.map { it["captureDigest"] }.distinct().size != selected.size ||
        selected.any { it["targetId"] !in FreedEarnedChallengePhotoEvaluation.reviewedTargetIds }) return null
    }
    return records.map { if (it["proofId"] in ids) it + ("consumedBy" to request["completionSessionId"]) else it }
  }
}
