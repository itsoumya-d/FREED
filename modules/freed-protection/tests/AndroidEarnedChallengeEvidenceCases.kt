// Appended by runner. Reflection keeps the preserved RED source compilable on its missing bridge.
private class ChallengeEvidenceHarness(val seconds: Int = 300, detector: Boolean = false) {
  val context = Context()
  val sensor = android.hardware.SensorManager()
  var scope = "[\"evidence-owner\",17]"
  val controllerClass = runCatching { Class.forName("app.freed.protection.FreedEarnedChallengeEvidenceController") }.getOrNull()
    ?: error("Missing native session-bound SensorManager challenge evidence controller")
  val controller = controllerClass.getDeclaredConstructor().newInstance()
  lateinit var group: Map<String, Any?>
  lateinit var offer: Map<String, Any?>
  init {
    context.services[Context.APP_OPS_SERVICE] = AppOpsManager(); context.services[Context.USAGE_STATS_SERVICE] = UsageStatsManager()
    sensor.sensor = android.hardware.Sensor(if (detector) android.hardware.Sensor.TYPE_STEP_DETECTOR else android.hardware.Sensor.TYPE_STEP_COUNTER)
    context.services[Context.SENSOR_SERVICE] = sensor
    check(FreedAppGroupStore.bindScope(context, scope)); call("foreground", true)
    val initial = FreedAppGroupStore.snapshot(context, scope)
    val created = FreedAppGroupStore.mutate(context, mapOf("version" to 1, "expectedStoreRevision" to initial["revision"], "name" to "Observed challenge"), scope, "create")
    check(created["accepted"] == true)
    group = rows(map(created["snapshot"])).last()
    val update = FreedAppGroupStore.updateWithEarnedTime(context, mapOf("version" to 2, "expectedStoreRevision" to map(created["snapshot"])["revision"], "id" to group["id"], "expectedRevision" to group["revision"], "name" to group["name"], "enabled" to true, "rule" to mapOf("kind" to "before-use"), "packages" to listOf("org.reader"), "extraTimeCapMinutes" to 20), scope)
    check(update["accepted"] == true); group = rows(map(update["snapshot"])).last()
    group = FreedAppGroupStore.blockingGroup(context, "org.reader")!!
    val id = java.util.UUID.randomUUID().toString()
    val pending = context.storage.edit().putString("id", id).putString("package", "org.reader").putString("rule", "app-group:${group["id"]}:${group["revision"]}")
    check(FreedAppGroupStore.issue(context, group, "org.reader", id, pending)); check(pending.commit())
    val stage = context.storage.edit(); FreedAppGroupStore.stage(context, context.storage.all, stage); check(stage.commit())
    val authority = FreedAppGroupStore.pendingScope(context, context.storage.all)!!
    val prepared = FreedAppGroupStore.prepareEarnedTime(context, mapOf("version" to 2, "policyVersion" to 2, "nativeInterventionId" to id, "groupId" to group["id"], "groupRevision" to group["revision"], "configurationGeneration" to authority["configurationGeneration"], "scopeEpoch" to authority["scopeEpoch"], "kind" to "android-app-group", "packageName" to "org.reader", "requestedSeconds" to seconds), scope)
    check(prepared["accepted"] == true); offer = map(prepared["offer"])
    check(offer["availableMethods"] == listOf("timer", "steps")); check(offer["supportedPhotoTargetIds"] == emptyList<String>())
    context.storage.values["adult-DNS-policy"] = "protected"
  }
  fun call(name: String, vararg args: Any?): Any? = controllerClass.methods.single { it.name == name && it.parameterCount == args.size }.invoke(controller, *args)
  fun beginRequest(session: String = "observed-$seconds") = mapOf("version" to 1, "offerId" to offer["offerId"], "completionSessionId" to session, "templateId" to "momentum-move-steps:earned-v2:$seconds", "templateVersion" to 2, "method" to "steps")
  fun begin(request: Map<String, Any?> = beginRequest()) = map(call("begin", context, request, scope))
  fun sessionRequest(session: Map<String, Any?>) = mapOf("version" to 1, "evidenceSessionId" to session["evidenceSessionId"])
  fun get(session: Map<String, Any?>) = map(call("get", context, sessionRequest(session), scope))
  fun phase(session: Map<String, Any?>, phase: String) = map(call("phase", context, sessionRequest(session) + ("phase" to phase), scope))
  fun finish(session: Map<String, Any?>) = map(call("finish", context, sessionRequest(session), scope))
  fun emit(value: Float) { System.now += 1L; SystemClock.now += 1L; sensor.emit(value, SystemClock.now * 1_000_000L) }
  fun grant(session: Map<String, Any?>, proof: String? = session["stepProofId"] as? String): Map<String, Any?> {
    val evidence = mapOf("method" to "steps", "activeDurationSec" to 0, "observedSteps" to seconds / 10, "photoProofIds" to emptyList<String>()) + if (proof == null) emptyMap() else mapOf("stepProofId" to proof)
    return mapOf("version" to 2, "policyVersion" to 2, "offerId" to offer["offerId"], "completionSessionId" to session["completionSessionId"], "category" to "move", "templateId" to session["templateId"], "templateVersion" to 2, "evidence" to evidence)
  }
  fun start(request: Map<String, Any?>) = FreedAppGroupStore.grantEarnedTime(context, request, scope)
  fun recordedProofs(): List<Map<String, Any?>> {
    val raw = context.storage.getString("app_group_earned_challenge_proofs_v1", null) ?: return emptyList()
    val array = JSONObject(raw).getJSONArray("records")
    return (0 until array.length()).map { index -> val row = array.getJSONObject(index); row.keys().asSequence().associateWith { key -> row.opt(key).takeUnless { it == JSONObject.NULL } } }
  }
  fun restart(): Any = controllerClass.getDeclaredConstructor().newInstance().also { controllerClass.methods.single { m -> m.name == "foreground" }.invoke(it, true) }
  fun restartedCall(newController: Any, name: String, request: Map<String, Any?>) = map(controllerClass.methods.single { it.name == name && it.parameterCount == 3 }.invoke(newController, context, request, scope))
}

private fun earnedChallengeEvidenceCases() {
  val originalWall = System.now; val originalElapsed = SystemClock.now
  run {
    val h = ChallengeEvidenceHarness(); val started = h.begin(); check(started["accepted"] == true)
    val session = map(started["session"]); check(h.begin()["session"] == session) { "Exact live begin must be idempotent" }
    check(h.finish(session)["reason"] == "earned-challenge-evidence-incomplete")
    val fake = h.grant(session) + ("evidence" to mapOf("method" to "steps", "activeDurationSec" to 0, "observedSteps" to 100000, "photoProofIds" to emptyList<String>()))
    check(h.start(fake)["reason"] == "earned-time-native-proof-invalid") { "Caller counts cannot mint a grant" }
    check(h.start(h.grant(session, java.util.UUID.randomUUID().toString()))["reason"] == "earned-time-native-proof-invalid")
    h.emit(100f); h.emit(129f); check(map(h.get(session)["session"])["observedSteps"] == 29L)
    check(h.phase(session, "paused")["accepted"] == true); h.sensor.late(200f, SystemClock.now * 1_000_000L + 1L)
    check(map(h.get(session)["session"])["observedSteps"] == 29L)
    check(h.phase(session, "active")["accepted"] == true); h.emit(230f); check(map(h.get(session)["session"])["observedSteps"] == 29L)
    h.emit(231f); h.context.storage.failNext = true
    check(h.finish(session)["reason"] == "earned-challenge-persistence-failed"); check(h.recordedProofs().isEmpty())
    val done = map(h.finish(session)["session"]); check(done["phase"] == "completed" && done["stepProofId"] is String)
    check(map(h.finish(session)["session"])["stepProofId"] == done["stepProofId"])
    val freshController = h.restart(); val restored = h.restartedCall(freshController, "get", h.sessionRequest(done))
    check(restored["accepted"] == true && map(restored["session"])["stepProofId"] == done["stepProofId"]) { "Finished proof survives JS save failure/restart without counting new movement" }
    val grant = h.grant(done); val before = h.context.storage.all
    h.context.storage.corruptNextKey = "app_group_earned_challenge_proofs_v1"
    check(h.start(grant)["reason"] == "earned-time-persistence-failed")
    check(h.context.storage.all == before) { "Proof consumption, spend and target release must roll back together" }
    val issued = h.start(grant); check(issued["accepted"] == true && issued["effective"] == true)
    check(h.recordedProofs().single()["consumedBy"] == done["completionSessionId"])
    val replay = h.start(grant); check(replay["accepted"] == true && replay["replayed"] == true && replay["expiresAt"] == issued["expiresAt"])
    check(map(replay["budget"])["spentSeconds"] == 300L && h.context.storage.values["adult-DNS-policy"] == "protected")
    val altered = grant + ("completionSessionId" to "stolen-completion"); check(h.start(altered)["accepted"] == false)
    h.call("destroy")
  }
  run {
    val h = ChallengeEvidenceHarness(600, detector = true); val session = map(h.begin()["session"])
    repeat(30) { h.emit(1f) }; h.call("foreground", false); check(map(h.get(session)["session"])["phase"] == "paused")
    h.sensor.late(1f, SystemClock.now * 1_000_000L + 1L); check(h.finish(session)["accepted"] == false)
    h.call("foreground", true); check(h.phase(session, "active")["accepted"] == true)
    repeat(29) { h.emit(1f) }; check(h.finish(session)["reason"] == "earned-challenge-evidence-incomplete")
    h.emit(1f); val done = map(h.finish(session)["session"]); check(done["observedSteps"] == 60L)
    check(h.phase(done, "cancelled")["accepted"] == true && h.recordedProofs().isEmpty())
    check(h.start(h.grant(done))["reason"] == "earned-time-native-proof-invalid") { "Cancellation revokes only the unconsumed authority" }
    val newSession = map(h.begin()["session"]); check(newSession["evidenceSessionId"] != done["evidenceSessionId"] && newSession["observedSteps"] == 0L)
    h.call("destroy")
  }
  run {
    val h = ChallengeEvidenceHarness(); h.context.motionPermission = false
    check(h.begin()["reason"] == "earned-challenge-step-permission-or-sensor-required")
    h.context.motionPermission = true; h.sensor.registers = false
    check(h.begin()["reason"] == "earned-challenge-step-sensor-unavailable")
    h.sensor.registers = true; val session = map(h.begin()["session"]); h.emit(100f); h.emit(130f)
    h.context.motionPermission = false; check(h.finish(session)["reason"] == "earned-challenge-step-permission-required")
    h.context.motionPermission = true; check(h.phase(session, "active")["accepted"] == true)
    val done = map(h.finish(session)["session"]); check(done["stepProofId"] is String)
    h.scope = "[\"other-owner\",18]"; check(FreedAppGroupStore.bindScope(h.context, h.scope))
    h.sensor.late(9999f, SystemClock.now * 1_000_000L + 1L); check(h.get(done)["accepted"] == false)
    check(h.start(h.grant(done))["accepted"] == false && h.recordedProofs().isEmpty())
    h.call("destroy")
  }
  run {
    val h = ChallengeEvidenceHarness(); val session = map(h.begin()["session"]); h.emit(100f); h.emit(120f)
    val restarted = h.restart(); check(h.restartedCall(restarted, "get", h.sessionRequest(session))["accepted"] == false)
    val next = map(h.restartedCall(restarted, "begin", h.beginRequest())["session"]); check(next["observedSteps"] == 0L && next["evidenceSessionId"] != session["evidenceSessionId"])
    val photo = h.beginRequest() + mapOf("method" to "photo", "templateId" to "momentum-find-chair:earned-v2:300")
    check(h.begin(photo)["accepted"] == false)
    val verify = h.sessionRequest(session) + mapOf("targetId" to "chair", "captureOperationId" to java.util.UUID.randomUUID().toString(), "uri" to "file:///foreign.jpg")
    check(map(h.call("verify", h.context, verify, h.scope))["reason"] == "earned-challenge-native-capture-required")
    h.call("destroy"); h.controllerClass.methods.single { it.name == "destroy" }.invoke(restarted)
  }
  run {
    val h = ChallengeEvidenceHarness(); val session = map(h.begin()["session"])
    System.now += 20 * 60_000L + 1L; SystemClock.now += 20 * 60_000L + 1L
    Thread.sleep(1150L)
    check(h.sensor.listener == null) { "Offer expiry must unregister the actual native listener even without another sensor callback" }
    check(h.get(session)["accepted"] == false && h.recordedProofs().isEmpty())
    h.call("destroy")
  }
  System.now = originalWall; SystemClock.now = originalElapsed
  println("Native earned challenge evidence: counter/detector thresholds, pause/background/stale callbacks, permission/runtime failures, finish retry/restart, forged proof rejection, atomic rollback, exact replay, owner isolation, disabled photo path PASS")
}
