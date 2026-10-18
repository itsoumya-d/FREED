// Appended beside the existing actual controller/store harness. OS events/private I/O remain explicit fixtures.
private fun earnedChallengeRound1Cases() {
  val originalWall = System.now; val originalElapsed = SystemClock.now
  val failures = mutableListOf<String>()
  fun scenario(name: String, body: () -> Unit) {
    try { body(); println("PASS: $name") } catch (error: Throwable) { failures.add(name + ": " + (error.cause?.message ?: error.message)); println("FAIL: ${failures.last()}") }
  }
  for ((label, active, observed) in listOf(Triple("nonzero duration", 60, 30), Triple("inflated count", 0, 100000), Triple("deflated count", 0, 29))) {
    scenario("real completed native proof rejects $label without spend or authority mutation") {
      val h = ChallengeEvidenceHarness()
      try {
        val session = map(h.begin()["session"]); h.emit(100f); h.emit(130f)
        val done = map(h.finish(session)["session"]); check(done["stepProofId"] is String)
        val valid = h.grant(done); val before = h.context.storage.all
        val altered = valid + ("evidence" to (map(valid["evidence"]) + mapOf("activeDurationSec" to active, "observedSteps" to observed)))
        check(h.start(altered)["accepted"] == false) { "A real proof accepted altered request evidence: $label" }
        check(h.context.storage.all == before) { "Rejected $label changed native spend/proof/lease authority" }
        val issued = h.start(valid); check(issued["accepted"] == true)
        val replay = h.start(valid); check(replay["accepted"] == true && replay["expiresAt"] == issued["expiresAt"] && map(replay["budget"])["spentSeconds"] == 300L)
      } finally { h.call("destroy") }
    }
  }
  scenario("already consumed legacy-shaped receipt replays without modifying lease or budget") {
    val h = ChallengeEvidenceHarness()
    try {
      val session = map(h.begin()["session"]); h.emit(100f); h.emit(130f); val done = map(h.finish(session)["session"])
      val valid = h.grant(done); val issued = h.start(valid); check(issued["accepted"] == true)
      val historical = valid + ("evidence" to (map(valid["evidence"]) + ("activeDurationSec" to 60)))
      val key = "app_group_earned_time_consumption_v2"
      val stored = JSONObject(h.context.storage.getString(key, null)!!)
      stored.getJSONArray("records").getJSONObject(0).getJSONObject("request").getJSONObject("evidence").put("activeDurationSec", 60)
      h.context.storage.values[key] = stored.toString()
      val before = h.context.storage.all
      val replay = FreedAppGroupStore.getEarnedTimeGrant(h.context, historical, h.scope)
      check(replay["accepted"] == true && replay["expiresAt"] == issued["expiresAt"] && map(replay["budget"])["spentSeconds"] == 300L && h.context.storage.all == before)
    } finally { h.call("destroy") }
  }
  for (action in listOf("get", "paused", "cancelled", "finish")) {
    scenario("wrong-scope $action leaves active native observation intact") {
      val h = ChallengeEvidenceHarness()
      try {
        val session = map(h.begin()["session"]); h.emit(100f); h.emit(120f)
        val before = h.context.storage.all; val observer = h.sensor.listener
        val request = h.sessionRequest(session) + if (action in listOf("paused", "cancelled")) mapOf("phase" to action) else emptyMap()
        val response = map(h.call(if (action in listOf("paused", "cancelled")) "phase" else action, h.context, request, "[\"stale-caller\",16]"))
        check(response["accepted"] == false)
        val current = h.get(session)
        check(current["accepted"] == true && map(current["session"])["phase"] == "active" && map(current["session"])["observedSteps"] == 20L) { "Wrong caller token cancelled the valid session" }
        check(h.sensor.listener === observer && h.context.storage.all == before) { "Wrong caller token mutated native observer or storage" }
        h.emit(130f); check(h.finish(session)["accepted"] == true)
      } finally { h.call("destroy") }
    }
    scenario("wrong-scope $action cannot revoke a completed unconsumed proof") {
      val h = ChallengeEvidenceHarness()
      try {
        val session = map(h.begin()["session"]); h.emit(100f); h.emit(130f); val done = map(h.finish(session)["session"])
        val before = h.context.storage.all; val request = h.sessionRequest(done) + if (action in listOf("paused", "cancelled")) mapOf("phase" to action) else emptyMap()
        check(map(h.call(if (action in listOf("paused", "cancelled")) "phase" else action, h.context, request, "[\"stale-caller\",16]"))["accepted"] == false)
        val valid = h.get(done)
        check(valid["accepted"] == true && map(valid["session"])["stepProofId"] == done["stepProofId"] && h.context.storage.all == before) { "Wrong caller token revoked a frozen native proof" }
        check(h.start(h.grant(done))["accepted"] == true)
      } finally { h.call("destroy") }
    }
  }
  System.now = originalWall; SystemClock.now = originalElapsed
  check(failures.isEmpty()) { failures.joinToString("\n") }
  println("Round1 native evidence contract/scope cases passed; valid exact grant replay and spend remain immutable")
}
