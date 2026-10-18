package app.freed.protection

import android.content.Context
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.os.SystemClock
import android.provider.Settings
import org.json.JSONObject
import java.util.TimeZone

@Suppress("UNCHECKED_CAST") private fun rows(snapshot: Map<String, Any?>) = snapshot["groups"] as List<Map<String, Any?>>
@Suppress("UNCHECKED_CAST") private fun map(value: Any?) = value as Map<String, Any?>
/** Reflection lets the exact before snapshot fail on its missing read-only API, rather than fail compilation. */
private fun readOnlyGrant(context: Context, request: Map<String, Any?>, scope: String): Map<String, Any?> {
  val lookup = FreedAppGroupStore.javaClass.methods.firstOrNull { it.name == "getEarnedTimeGrant" }
    ?: error("Missing read-only native earned grant lookup")
  return map(lookup.invoke(FreedAppGroupStore, context, request, scope))
}

private fun httpDate(ms: Long): String = java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", java.util.Locale.US)
  .apply { timeZone = TimeZone.getTimeZone("GMT") }.format(java.util.Date(ms))

private fun clockProof(): FreedEarnedTimeClock.Proof = FreedEarnedTimeClock.fetch { request ->
  check(request.url.startsWith(FreedEarnedTimeClock.ENDPOINT + "?freed-clock="))
  check(request.method == "HEAD" && request.headers == mapOf("Cache-Control" to "no-cache", "Pragma" to "no-cache", "Cookie" to ""))
  check(!Thread.holdsLock(FreedNativeUnlockStore.lock)) { "HTTPS transport must run outside the native protection lock" }
  FreedEarnedTimeClock.Response(request.url, 200, httpDate(System.now), "0")
} ?: error("Mocked authenticated HTTPS clock proof rejected")

private fun clockPolicyCases() {
  val now = System.now; val elapsed = SystemClock.now
  val url = FreedEarnedTimeClock.ENDPOINT + "?freed-clock=" + java.util.UUID.randomUUID()
  val response = FreedEarnedTimeClock.Response(url, 200, httpDate(now), "0")
  check(clockProof().serverTimeMs == now)
  for (bad in listOf(response.copy(status = 302), response.copy(url = "https://foreign.example/privacy"),
    response.copy(age = "6"), response.copy(age = "-1"), response.copy(age = "invalid"), response.copy(date = null),
    response.copy(date = httpDate(now - 121_000L)))) {
    check(FreedEarnedTimeClock.evaluate(url, bad, now, elapsed, now, elapsed) == null)
  }
  check(FreedEarnedTimeClock.evaluate(url.replace("https:", "http:"), response, now, elapsed, now, elapsed) == null)
  check(FreedEarnedTimeClock.evaluate(url, response, now - 6_000L, elapsed - 6_000L, now, elapsed) == null)
  check(FreedEarnedTimeClock.evaluate(url, response, now + 121_000L, elapsed, now + 121_000L, elapsed) == null)
  check(FreedEarnedTimeClock.fetch { throw IllegalStateException("Offline") } == null)
  val initial = FreedEarnedAppTimePolicy.newBudget("owner", "group", now, elapsed, 7)!!
  val spent = FreedEarnedAppTimePolicy.spend(initial, 600L)!!
  val sameDay = FreedEarnedTimeClock.Proof(now + 60_000L, now + 60_000L, 20_000L)
  val recovered = FreedEarnedAppTimePolicy.recoverBudget(spent, sameDay, sameDay.receivedWallMs, sameDay.receivedElapsedMs, 8)!!
  check(recovered["spentSeconds"] == 600L && recovered["dayKey"] == spent["dayKey"] && FreedEarnedAppTimePolicy.remaining(recovered) == 600L)
  check(FreedEarnedAppTimePolicy.clockVerified(recovered, sameDay.receivedWallMs, sameDay.receivedElapsedMs, 8))
  val pending = FreedEarnedAppTimePolicy.changeCap(spent, 30L)!!
  val nextDay = FreedEarnedTimeClock.Proof(now + 86_400_000L, now + 86_400_000L, 10_000L)
  val advanced = FreedEarnedAppTimePolicy.recoverBudget(pending, nextDay, nextDay.receivedWallMs, nextDay.receivedElapsedMs, 9)!!
  check(advanced["spentSeconds"] == 0L && advanced["effectiveCapMinutes"] == 30L && advanced["pendingCapMinutes"] == null)
  check((advanced["previousDays"] as List<*>).any { map(it)["spentSeconds"] == 600L })
  check(FreedEarnedAppTimePolicy.recoverBudget(spent, sameDay, sameDay.receivedWallMs + 11_000L, sameDay.receivedElapsedMs + 11_000L, 8) == null)
  check(FreedEarnedAppTimePolicy.recoverBudget(spent, sameDay.copy(serverTimeMs = now - 1L), sameDay.receivedWallMs, sameDay.receivedElapsedMs, 8) == null)
  // A wall clock up to the accepted skew cannot advance the budget before the authenticated day clock.
  val boundary = FreedAppGroupPolicy.integer(spent["nextResetMs"])!!
  val skewed = FreedEarnedTimeClock.Proof(boundary - 30_000L, boundary + 60_000L, 40_000L)
  val skewRecovered = FreedEarnedAppTimePolicy.recoverBudget(spent, skewed, skewed.receivedWallMs, skewed.receivedElapsedMs, 8)!!
  check(skewRecovered["spentSeconds"] == 600L)
  check(FreedEarnedAppTimePolicy.advanceBudget(skewRecovered, skewed.receivedWallMs + 10_000L, skewed.receivedElapsedMs + 10_000L, 8)!!["spentSeconds"] == 600L)
  // Four seconds outbound and zero inbound: the response is received at authenticated
  // 23:59:59. RTT/2 would invent 00:00:01 and wrongly clear today's already spent cap.
  val receivedAt = boundary - 1_000L
  val asymmetric = FreedEarnedTimeClock.evaluate(url, response.copy(date = httpDate(receivedAt)),
    receivedAt - 4_000L, 100_000L, receivedAt, 104_000L)!!
  val nearMidnight = FreedEarnedAppTimePolicy.recoverBudget(spent, asymmetric, receivedAt, 104_000L, 8)!!
  check(nearMidnight["spentSeconds"] == 600L && nearMidnight["dayKey"] == spent["dayKey"]) {
    "Asymmetric network latency must not manufacture midnight or reset the spent budget"
  }
  check(asymmetric.serverTimeMs == receivedAt) { "Only the authenticated Date is a proven lower bound" }
  check(FreedEarnedAppTimePolicy.advanceBudget(nearMidnight, receivedAt + 999L, 104_999L, 8)!!["spentSeconds"] == 600L)
  val aged = FreedEarnedTimeClock.evaluate(url, response.copy(date = httpDate(receivedAt), age = "5"),
    receivedAt - 4_000L, 100_000L, receivedAt, 104_000L)!!
  check(aged.serverTimeMs == receivedAt) { "Fresh Age is a validation constraint, not authority to extrapolate past Date" }
}

fun main() {
  TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
  clockPolicyCases()
  val context = Context()
  context.services[Context.APP_OPS_SERVICE] = AppOpsManager()
  context.services[Context.USAGE_STATS_SERVICE] = UsageStatsManager()
  var scope = "[\"owner-A\",1]"
  context.storage.values["adult-DNS-policy"] = "protected"
  check(FreedAppGroupStore.bindScope(context, scope))
  fun snapshot() = FreedAppGroupStore.snapshot(context, scope)
  fun create(name: String, packages: List<String> = listOf("org.reader", "org.game")): Map<String, Any?> {
    val result = FreedAppGroupStore.mutate(context, mapOf("version" to 1, "expectedStoreRevision" to snapshot()["revision"], "name" to name), scope, "create")
    check(result["accepted"] == true)
    val group = rows(map(result["snapshot"])).last()
    val update = FreedAppGroupStore.updateWithEarnedTime(context, mapOf("version" to 2, "expectedStoreRevision" to snapshot()["revision"], "id" to group["id"], "expectedRevision" to group["revision"], "name" to name, "enabled" to true, "rule" to mapOf("kind" to "before-use"), "packages" to packages, "extraTimeCapMinutes" to 20), scope)
    check(update["accepted"] == true) { update.toString() }
    return rows(map(update["snapshot"])).last()
  }
  var group = create("Shared rule")
  fun advance(ms: Long) { System.now += ms; SystemClock.now += ms }
  fun claim(seconds: Int = 300): Map<String, Any?> {
    val current = FreedAppGroupStore.blockingGroup(context, "org.reader")!!
    val id = java.util.UUID.randomUUID().toString()
    val pending = context.storage.edit().putString("id", id).putString("package", "org.reader").putString("rule", "app-group:${current["id"]}:${current["revision"]}")
    check(FreedAppGroupStore.issue(context, current, "org.reader", id, pending)); check(pending.commit())
    val staged = context.storage.edit(); FreedAppGroupStore.stage(context, context.storage.all, staged); check(staged.commit())
    val authority = FreedAppGroupStore.pendingScope(context, context.storage.all)!!
    return mapOf("version" to 2, "policyVersion" to 2, "nativeInterventionId" to id, "groupId" to current["id"], "groupRevision" to current["revision"], "configurationGeneration" to authority["configurationGeneration"], "scopeEpoch" to authority["scopeEpoch"], "kind" to "android-app-group", "packageName" to "org.reader", "requestedSeconds" to seconds)
  }
  fun prepare(request: Map<String, Any?>): Map<String, Any?> = FreedAppGroupStore.prepareEarnedTime(context, request, scope)
  fun grant(offer: Map<String, Any?>, session: String, seconds: Int = 300): Map<String, Any?> = mapOf("version" to 2, "policyVersion" to 2, "offerId" to offer["offerId"], "completionSessionId" to session, "category" to "breathe", "templateId" to "momentum-breathe-soft:earned-v2:$seconds", "templateVersion" to 2, "evidence" to mapOf("method" to "timer", "activeDurationSec" to seconds / 5, "observedSteps" to 0, "photoProofIds" to emptyList<String>()))
  fun start(request: Map<String, Any?>) = FreedAppGroupStore.grantEarnedTime(context, request, scope)
  fun cap(minutes: Int): Map<String, Any?> {
    val current = rows(snapshot()).first { it["id"] == group["id"] }
    return FreedAppGroupStore.updateWithEarnedTime(context, mapOf("version" to 2, "expectedStoreRevision" to snapshot()["revision"], "id" to current["id"], "expectedRevision" to current["revision"], "name" to current["name"], "enabled" to current["enabled"], "rule" to current["rule"], "packages" to current["packages"], "extraTimeCapMinutes" to minutes), scope)
  }
  val native = claim()
  for (bad in listOf(native + ("requestedSeconds" to 120), native + ("requestedSeconds" to true), native + ("url" to "https://example.org"), native + ("scopeEpoch" to 99))) check(prepare(bad)["accepted"] == false)
  val legacyPackage = "com.instagram.android"
  FreedInstalledApplications.installed = FreedInstalledApplications.installed + legacyPackage
  val legacyReceipt = JSONObject().put("version", 1).put("id", java.util.UUID.randomUUID().toString()).put("package", legacyPackage)
    .put("rule", JSONObject.NULL).put("claimedAt", System.now).put("elapsed", SystemClock.now).put("boot", Settings.Global.boot)
    .put("requestedExpiry", System.now + 120_000L).put("grantedExpiry", System.now + 120_000L).toString()
  context.storage.values["native_package_unlock_receipt_v1"] = legacyReceipt
  check(prepare(native)["reason"] == "earned-time-active-window") { "Global v2 stacking guard must include a native legacy package receipt" }
  context.storage.values.remove("native_package_unlock_receipt_v1")
  val surfaceReceipt = JSONObject(legacyReceipt).put("rule", "surface-rule-123").toString()
  context.storage.values["native_surface_unlock_receipts_v1"] = JSONObject().put("$legacyPackage|surface-rule-123", surfaceReceipt).toString()
  check(prepare(native)["reason"] == "earned-time-active-window") { "Global v2 stacking guard must include a native legacy surface receipt" }
  context.storage.values.remove("native_surface_unlock_receipts_v1")
  val beforeOffer = context.storage.values.toMap()
  context.storage.failNext = true
  check(prepare(native)["accepted"] == false)
  check(context.storage.values == beforeOffer) { "Failed offer publication must preserve old authority and budget" }
  val prepared = prepare(native); check(prepared["accepted"] == true) { prepared.toString() }
  val five = map(prepared["offer"])
  check(five["availableMethods"] == listOf("timer")) { "Unattested steps and unevaluated photos must not be advertised as earned proof" }
  check(five["requiredActiveSeconds"] == 60L && five["requiredSteps"] == 30L && five["requiredDistinctPhotoTargets"] == 1L)
  check(map(prepared["budget"])["spentSeconds"] == 0L)
  advance(1_000)
  check(map(prepare(native)["offer"])["offerId"] == five["offerId"])
  check(map(prepare(native)["offer"])["validUntil"] == five["validUntil"])
  val ten = map(prepare(native + ("requestedSeconds" to 600))["offer"])
  check(ten["requiredActiveSeconds"] == 120L && ten["requiredSteps"] == 60L && ten["requiredDistinctPhotoTargets"] == 2L)
  check(start(grant(five, "replaced"))["accepted"] == false) { "Superseded offer must not grant" }
  val tenRequest = grant(ten, "ten", 600)
  val beforeUnsubmittedLookup = context.storage.values.toMap()
  val beforeUnsubmittedCommits = context.storage.commits
  check(readOnlyGrant(context, tenRequest, scope)["reason"] == "earned-time-grant-not-found") { "A valid but unsubmitted grant request is read-only and must not spend or start a break" }
  check(readOnlyGrant(context, tenRequest + ("offerId" to java.util.UUID.randomUUID().toString()), scope)["accepted"] == false)
  check(context.storage.values == beforeUnsubmittedLookup && context.storage.commits == beforeUnsubmittedCommits)
  for (bad in listOf(tenRequest + ("seconds" to 7200), tenRequest + ("templateVersion" to 1), tenRequest + ("templateId" to "momentum-breathe-soft:earned-v2:300"), tenRequest + ("evidence" to mapOf("method" to "timer", "activeDurationSec" to 119, "observedSteps" to 0, "photoProofIds" to emptyList<String>())))) check(start(bad)["accepted"] == false)
  val photo = tenRequest + mapOf("category" to "find", "templateId" to "momentum-find-flower:earned-v2:600", "evidence" to mapOf("method" to "photo", "activeDurationSec" to 0, "observedSteps" to 0, "photoProofIds" to listOf("fake-flower", "fake-chair")))
  check(start(photo)["accepted"] == false) { "Unvalidated photo proof cannot grant" }
  val steps = tenRequest + mapOf("category" to "move", "templateId" to "momentum-move-steps:earned-v2:600", "evidence" to mapOf("method" to "steps", "activeDurationSec" to 0, "observedSteps" to 6000, "photoProofIds" to emptyList<String>()))
  check(start(steps)["reason"] == "earned-time-steps-verification-unavailable") { "Client step counts are not native session-bound attestation" }
  val beforeGrant = context.storage.values.toMap()
  context.storage.failNext = true
  check(start(tenRequest)["accepted"] == false)
  check(context.storage.values == beforeGrant) { "Commit failure restores offers, cap, claim and leases" }
  context.storage.corruptNextKey = FreedEarnedAppTimePolicy.BUDGET_KEY
  check(start(tenRequest)["accepted"] == false)
  check(context.storage.values == beforeGrant) { "Readback corruption rolls back every owned key" }
  val started = start(tenRequest); check(started["accepted"] == true && started["effective"] == true && started["seconds"] == 600L) { started.toString() }
  val expiry = started["expiresAt"]
  val beforeLookup = context.storage.values.toMap(); val beforeLookupCommits = context.storage.commits; val beforeLookupRechecks = FreedAccessibilityService.rechecks
  val lookedUp = readOnlyGrant(context, tenRequest, scope)
  check(lookedUp["accepted"] == true && lookedUp["replayed"] == true && lookedUp["expiresAt"] == expiry && lookedUp["budget"] == started["budget"])
  check(context.storage.values == beforeLookup && context.storage.commits == beforeLookupCommits && FreedAccessibilityService.rechecks == beforeLookupRechecks) { "Lookup must not mutate durable or runtime grant authority" }
  check(readOnlyGrant(context, tenRequest + ("completionSessionId" to "not-consumed"), scope)["accepted"] == false)
  check(readOnlyGrant(context, tenRequest + ("evidence" to mapOf("method" to "timer", "activeDurationSec" to 121, "observedSteps" to 0, "photoProofIds" to emptyList<String>())), scope)["accepted"] == false)
  check(context.storage.values == beforeLookup && context.storage.commits == beforeLookupCommits)
  // Same-owner native cold binding resumes only a genuine still-active consumed receipt.
  FreedAppGroupStore.javaClass.getDeclaredField("boundScope").apply { isAccessible = true }.set(null, null)
  FreedAppGroupStore.javaClass.getDeclaredField("boundSignedInOwner").apply { isAccessible = true }.setBoolean(null, false)
  check(readOnlyGrant(context, tenRequest, scope)["accepted"] == false)
  check(FreedAppGroupStore.bindScope(context, scope))
  check(readOnlyGrant(context, tenRequest, scope)["expiresAt"] == expiry)
  check(map(started["budget"])["spentSeconds"] == 600L)
  check(FreedAppGroupStore.blockingGroup(context, "org.reader") == null)
  check(FreedAppGroupStore.blockingGroup(context, "org.game") != null) { "Only originating app receives a break" }
  advance(20_000)
  val retry = start(tenRequest); check(retry["accepted"] == true && retry["replayed"] == true && retry["expiresAt"] == expiry)
  check(map(retry["budget"])["spentSeconds"] == 600L)
  check(start(tenRequest + ("completionSessionId" to "different"))["accepted"] == false)
  val revision = rows(snapshot()).first()["revision"]
  check(cap(5)["accepted"] == true)
  check(rows(snapshot()).first()["revision"] == revision)
  check(map(rows(snapshot()).first()["break"])["expiresAt"] == expiry) { "Cap decrease cannot cancel/extend active lease" }
  check(map(rows(snapshot()).first()["extraTimeBudget"])["remainingSeconds"] == 0L)
  check(cap(30)["accepted"] == true)
  val pendingBudget = map(rows(snapshot()).first()["extraTimeBudget"])
  check(pendingBudget["effectiveCapMinutes"] == 5L && pendingBudget["pendingCapMinutes"] == 30L)
  check(start(tenRequest)["expiresAt"] == expiry) { "Exact replay survives cap-only edits with unchanged spend/deadline" }
  advance(600_000)
  val beforeExpiredLookup = context.storage.values.toMap(); val expiredLookupCommits = context.storage.commits
  check(readOnlyGrant(context, tenRequest, scope)["reason"] == "earned-time-grant-expired") { "Read-only lookup cannot revive an expired consumed lease" }
  check(context.storage.values == beforeExpiredLookup && context.storage.commits == expiredLookupCommits)
  check(FreedAppGroupStore.blockingGroup(context, "org.reader") != null) { "Native monotonic expiry relocks while JS is absent" }
  val exhausted = claim(); check(prepare(exhausted)["accepted"] == false)
  val budgetBeforeJump = context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY]
  System.now += 86_400_000
  check(prepare(exhausted)["reason"] == "earned-time-clock-unverified")
  check(context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] == budgetBeforeJump)
  System.now -= 86_400_000
  TimeZone.setDefault(TimeZone.getTimeZone("Pacific/Kiritimati"))
  check(prepare(exhausted)["accepted"] == false) { "Timezone cannot create a fresh budget day" }
  TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
  advance(86_400_000)
  val tomorrow = prepare(claim(600)); check(tomorrow["accepted"] == true) { tomorrow.toString() }
  check(map(tomorrow["budget"])["effectiveCapMinutes"] == 30L && map(tomorrow["budget"])["spentSeconds"] == 0L)
  check(context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY].toString().contains("600")) { "Prior-day spend tombstone must remain" }
  val tomorrowOffer = map(tomorrow["offer"])
  check(start(grant(tomorrowOffer, "ten", 600))["accepted"] == false) { "Consumed completion cannot be assigned a new offer" }
  val unchanged = context.storage.values.toMap(); context.storage.failNext = true
  check(cap(10)["accepted"] == false); check(context.storage.values == unchanged)
  check(cap(20)["accepted"] == true)
  check(start(grant(tomorrowOffer, "budget-edited", 600))["accepted"] == false) { "Budget revision fences unconsumed offers" }
  val fresh = map(prepare(claim())["offer"])
  val beforeOwner = context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY]
  check(FreedAppGroupStore.bindScope(context, "[\"owner-B\",2]"))
  check(start(grant(fresh, "wrong-owner"))["accepted"] == false)
  scope = "[\"owner-A\",3]"; check(FreedAppGroupStore.bindScope(context, scope))
  check(start(grant(fresh, "stale-owner"))["accepted"] == false)
  check(context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] == beforeOwner)
  // Four real five-minute grants exhaust the effective twenty-minute cap, without client timing.
  repeat(4) { index ->
    val preparedFive = prepare(claim()); check(preparedFive["accepted"] == true) { preparedFive.toString() }
    val requestFive = grant(map(preparedFive["offer"]), "five-$index")
    val resultFive = start(requestFive)
    check(resultFive["accepted"] == true && resultFive["seconds"] == 300L) { resultFive.toString() }
    check(map(resultFive["budget"])["spentSeconds"] == (index + 1) * 300L)
    advance(300_000)
    check(FreedAppGroupStore.blockingGroup(context, "org.reader") != null)
    check(start(requestFive)["accepted"] == false) { "Expired replay cannot extend the native deadline" }
  }
  check(prepare(claim())["reason"] == "earned-time-budget-exhausted")
  // A cap-only v2 update must also preserve an already active historical v1 lease and ledger.
  val v1Authority = claim()
  val v1Request = (v1Authority - "requestedSeconds") + mapOf("version" to 1, "policyVersion" to 1, "category" to "breathe", "completionSessionId" to "v1-historical", "templateId" to "gentle", "templateVersion" to 1)
  val v1Granted = FreedAppGroupStore.grantResetReward(context, v1Request, scope)
  check(v1Granted["accepted"] == true && v1Granted["seconds"] == 120L)
  val v1Ledger = context.storage.values[FreedResetAppGroupRewardPolicy.LEDGER_KEY]
  val v1Breaks = context.storage.values["app_group_breaks_v1"]
  check(cap(5)["accepted"] == true)
  check(context.storage.values[FreedResetAppGroupRewardPolicy.LEDGER_KEY] == v1Ledger && context.storage.values["app_group_breaks_v1"] == v1Breaks)
  check(FreedAppGroupStore.grantResetReward(context, v1Request, scope)["expiresAt"] == v1Granted["expiresAt"])
  advance(120_000)
  check(FreedAppGroupStore.blockingGroup(context, "org.reader") != null)
  // A genuine rule edit invalidates an outstanding offer but retains the spent budget and history.
  advance(86_400_000)
  val editOffer = map(prepare(claim())["offer"])
  val editable = rows(snapshot()).first()
  val oldBudgetBytes = context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY]
  val edited = FreedAppGroupStore.updateWithEarnedTime(context, mapOf("version" to 2, "expectedStoreRevision" to snapshot()["revision"], "id" to editable["id"], "expectedRevision" to editable["revision"], "name" to "Changed rule", "enabled" to editable["enabled"], "rule" to editable["rule"], "packages" to editable["packages"], "extraTimeCapMinutes" to 5), scope)
  check(edited["accepted"] == true)
  check(start(grant(editOffer, "after-rule-edit"))["accepted"] == false)
  check(context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] == oldBudgetBytes)
  // Persisted malformed budget is an error; it must never receive the default twenty minutes.
  val budgetBytes = context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY]
  context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] = "{}"
  check(prepare(claim())["reason"] == "earned-time-budget-unreadable")
  context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] = budgetBytes
  // Older converted records may keep provenance metadata; a valid authored rule is eligible.
  val converted = JSONObject(context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY] as String)
  converted.getJSONArray("groups").getJSONObject(0).put("legacy", true)
  context.storage.values[FreedAppGroupStore.CONFIGURATION_KEY] = converted.toString()
  // A lease spanning midnight replays the immutable original grant-day receipt. The fresh
  // snapshot, including a later cap edit, is the sole source of today's remaining allowance.
  val toBeforeMidnight = (86_400_000L - Math.floorMod(System.now, 86_400_000L) - 150_000L).let { if (it < 0) it + 86_400_000L else it }
  advance(toBeforeMidnight)
  val midnightOffer = map(prepare(claim())["offer"])
  val midnightRequest = grant(midnightOffer, "cross-midnight")
  val midnightGrant = start(midnightRequest); check(midnightGrant["accepted"] == true) { midnightGrant.toString() }
  // Exercise the actual legacy native store, not a JS or source-pattern gate.
  val freshLegacyId = java.util.UUID.randomUUID().toString()
  val legacyPending = mapOf(FreedAccessibilityService.PENDING_INTERVENTION_ID to freshLegacyId,
    FreedAccessibilityService.PENDING_SOURCE_PACKAGE to legacyPackage, FreedAccessibilityService.PENDING_RULE to "configured-app:$legacyPackage",
    FreedAccessibilityService.PENDING_DETECTED_AT to FreedEarnedAppTimePolicy.iso(System.now))
  val freshLegacyEditor = context.storage.edit()
  FreedNativeUnlockStore.stage(context, legacyPending, freshLegacyEditor); check(freshLegacyEditor.commit())
  val beforeLegacyAttempt = context.storage.values.toMap()
  check(FreedNativeUnlockStore.fulfill(context, freshLegacyId, legacyPackage, null, System.now + 120_000L) == null) { "A fresh legacy package grant cannot stack after a v2 group break" }
  check(context.storage.values == beforeLegacyAttempt)
  val legacySurfaceId = java.util.UUID.randomUUID().toString()
  FreedFocusShieldRules.rules = listOf(TestSurfaceRule("surface-rule-123", legacyPackage))
  val surfacePending = legacyPending + mapOf(FreedAccessibilityService.PENDING_INTERVENTION_ID to legacySurfaceId,
    FreedAccessibilityService.PENDING_RULE to "focus-shield:surface-rule-123", FreedAccessibilityService.PENDING_FOCUS_SHIELD_RULE_ID to "surface-rule-123")
  val surfaceEditor = context.storage.edit(); FreedNativeUnlockStore.stage(context, surfacePending, surfaceEditor); check(surfaceEditor.commit())
  val beforeSurfaceAttempt = context.storage.values.toMap()
  check(FreedNativeUnlockStore.fulfill(context, legacySurfaceId, legacyPackage, "surface-rule-123", System.now + 120_000L) == null)
  check(context.storage.values == beforeSurfaceAttempt)
  // An already issued historical receipt still takes the immutable replay path first.
  val existingLegacyReceipt = JSONObject().put("version", 1).put("id", freshLegacyId).put("package", legacyPackage)
    .put("rule", JSONObject.NULL).put("claimedAt", System.now).put("elapsed", SystemClock.now).put("boot", Settings.Global.boot)
    .put("requestedExpiry", System.now + 120_000L).put("grantedExpiry", System.now + 120_000L).toString()
  context.storage.values["native_package_unlock_receipt_v1"] = existingLegacyReceipt
  val beforeLegacyReplay = context.storage.values.toMap()
  val legacyReplay = FreedNativeUnlockStore.fulfill(context, freshLegacyId, legacyPackage, null, System.now + 120_000L)
  check(legacyReplay?.firstFulfillment == false && legacyReplay.expiresAtMs == System.now + 120_000L)
  check(context.storage.values == beforeLegacyReplay)
  context.storage.values.remove("native_package_unlock_receipt_v1")
  context.storage.values.remove("claimed_native_unlock_lease_v1")
  val consumedBeforeOverlap = context.storage.values[FreedEarnedAppTimePolicy.LEDGER_KEY]
  val leaseBeforeOverlap = context.storage.values[FreedEarnedAppTimePolicy.BREAKS_KEY]
  context.storage.values[FreedAccessibilityService.BLOCKED_APP_PACKAGES] = "org.reader"
  context.storage.values["mode"] = "before-use"
  val restrictedReplay = start(midnightRequest)
  val readbackBeforeRestriction = context.storage.values.toMap()
  val restrictedLookup = readOnlyGrant(context, midnightRequest, scope)
  check(restrictedLookup == restrictedReplay && context.storage.values == readbackBeforeRestriction)
  check(restrictedReplay["accepted"] == true && restrictedReplay["replayed"] == true && restrictedReplay["effective"] == false && restrictedReplay["remainingRestrictionCount"] == 1)
  check(restrictedReplay["expiresAt"] == midnightGrant["expiresAt"] && restrictedReplay["budget"] == midnightGrant["budget"])
  check(context.storage.values[FreedEarnedAppTimePolicy.LEDGER_KEY] == consumedBeforeOverlap && context.storage.values[FreedEarnedAppTimePolicy.BREAKS_KEY] == leaseBeforeOverlap)
  context.storage.values.remove(FreedAccessibilityService.BLOCKED_APP_PACKAGES)
  context.storage.values.remove("mode")
  advance(180_000)
  val freshDay = map(rows(snapshot()).first()["extraTimeBudget"])
  check(freshDay["dayKey"] != map(midnightGrant["budget"])["dayKey"] && freshDay["spentSeconds"] == 0L)
  check(cap(10)["accepted"] == true)
  val midnightReplay = start(midnightRequest)
  val midnightLookupState = context.storage.values.toMap()
  check(readOnlyGrant(context, midnightRequest, scope) == midnightReplay && context.storage.values == midnightLookupState)
  check(midnightReplay["accepted"] == true && midnightReplay["replayed"] == true && midnightReplay["expiresAt"] == midnightGrant["expiresAt"])
  check(midnightReplay["budget"] == midnightGrant["budget"]) { "Replay receipt must retain original budget day and consumption exactly" }
  advance(120_000)
  // Same-day reboot recovery verifies time over the fixed public endpoint without refunding spend.
  val beforeRebootOffer = map(prepare(claim())["offer"])
  val beforeRebootGrant = start(grant(beforeRebootOffer, "before-reboot"))
  check(beforeRebootGrant["accepted"] == true)
  advance(300_000)
  Settings.Global.boot += 1; SystemClock.now = 50_000L
  val rebootRequest = claim()
  val spentBeforeReboot = context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY]
  val consumedBeforeReboot = context.storage.values[FreedEarnedAppTimePolicy.LEDGER_KEY]
  check(FreedAppGroupStore.prepareEarnedTimeWithClockRecovery(context, rebootRequest, scope) { null }["reason"] == "earned-time-clock-unverified")
  check(context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] == spentBeforeReboot)
  check(FreedAppGroupStore.prepareEarnedTimeWithClockRecovery(context, rebootRequest, scope) {
    val stale = clockProof(); advance(11_000); stale
  }["reason"] == "earned-time-clock-unverified")
  val sameDayRecovery = FreedAppGroupStore.prepareEarnedTimeWithClockRecovery(context, rebootRequest, scope) { clockProof() }
  check(sameDayRecovery["reason"] == "earned-time-budget-exhausted") { sameDayRecovery.toString() }
  val sameDayBudget = map(rows(snapshot()).first()["extraTimeBudget"])
  check(sameDayBudget["clockState"] == "verified" && sameDayBudget["spentSeconds"] == 300L)
  check(context.storage.values[FreedEarnedAppTimePolicy.LEDGER_KEY] == consumedBeforeReboot)
  // A later verified day can roll over and apply the pending cap. A changed owner cannot accept the old response.
  Settings.Global.boot += 1; SystemClock.now = 10_000L; System.now += 86_400_000L
  val nextDayRequest = claim()
  val beforeOwnerRecovery = context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY]
  val changedOwner = FreedAppGroupStore.prepareEarnedTimeWithClockRecovery(context, nextDayRequest, scope) {
    val proof = clockProof(); check(FreedAppGroupStore.bindScope(context, "[\"owner-B\",4]")); proof
  }
  check(changedOwner["accepted"] == false && context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] == beforeOwnerRecovery)
  scope = "[\"owner-A\",5]"; check(FreedAppGroupStore.bindScope(context, scope))
  val recoveredOwnerRequest = claim()
  context.storage.failNext = true
  check(FreedAppGroupStore.prepareEarnedTimeWithClockRecovery(context, recoveredOwnerRequest, scope) { clockProof() }["reason"] == "earned-time-clock-unverified")
  check(context.storage.values[FreedEarnedAppTimePolicy.BUDGET_KEY] == beforeOwnerRecovery) { "Clock repair commit failure must retain spent/history state" }
  val nextDayRecovery = FreedAppGroupStore.prepareEarnedTimeWithClockRecovery(context, recoveredOwnerRequest, scope) { clockProof() }
  check(nextDayRecovery["accepted"] == true) { nextDayRecovery.toString() }
  check(map(nextDayRecovery["budget"])["spentSeconds"] == 0L && map(nextDayRecovery["budget"])["effectiveCapMinutes"] == 10L)
  check(context.storage.values[FreedEarnedAppTimePolicy.LEDGER_KEY] == consumedBeforeReboot)
  create("Overlap", listOf("org.reader"))
  check(prepare(claim())["accepted"] == false) { "Offers cannot promise access through an independent restriction" }
  Settings.Global.boot += 1
  check(map(rows(snapshot()).first()["extraTimeBudget"])["clockState"] == "unverified")
  check(context.storage.values["adult-DNS-policy"] == "protected")
  check(context.storage.values[FreedResetAppGroupRewardPolicy.LEDGER_KEY] == v1Ledger) { "V2 must never rewrite historical v1 ledger" }
  println("Android earned-time v2 actual store: requirements, strict inputs, offer replacement, evidence, persistence/readback rollback, exact replay, target-only scope, expiry, cap edits/day/clock fences, owner isolation, overlaps and v1/DNS preservation passed")
}
