// Appended to actual native group/sensor/controller harness. No APK/device/real photo evaluation claim.
private object PreferredOmitted20
private class EarnedWindow20Harness {
  val context = Context(); val usage = UsageStatsManager(); val scope = "[\"window20-owner\",23]"
  val groupId: String
  init {
    context.services[Context.APP_OPS_SERVICE] = AppOpsManager(); context.services[Context.USAGE_STATS_SERVICE] = usage
    check(FreedAppGroupStore.bindScope(context, scope))
    val result = FreedAppGroupStore.mutate(context, mapOf("version" to 1, "expectedStoreRevision" to snapshot()["revision"], "name" to "Daily allowance"), scope, "create")
    check(result["accepted"] == true); groupId = rows(map(result["snapshot"])).last()["id"] as String
    context.storage.values["adult-DNS-policy"] = "protected"
  }
  fun snapshot() = FreedAppGroupStore.snapshot(context, scope)
  fun group() = rows(snapshot()).single { it["id"] == groupId }
  fun update(cap: Int = 20, preferred: Any? = PreferredOmitted20, activate: Boolean = true): Map<String, Any?> {
    val group = group()
    val request = mapOf("version" to 2, "expectedStoreRevision" to snapshot()["revision"], "id" to groupId, "expectedRevision" to group["revision"],
      "name" to group["name"], "enabled" to if (activate) true else group["enabled"], "rule" to group["rule"], "packages" to if (activate) listOf("org.reader","org.game") else group["packages"], "extraTimeCapMinutes" to cap)
    return FreedAppGroupStore.updateWithEarnedTime(context, request + if (preferred === PreferredOmitted20) emptyMap() else mapOf("preferredBreakSeconds" to preferred), scope)
  }
  fun reachLimit() { usage.rows = listOf(android.app.usage.UsageStats("org.reader",30 * 60_000L), android.app.usage.UsageStats("org.game",0L)) }
  fun advance(ms: Long) { System.now += ms; SystemClock.now += ms }
  fun claim(seconds: Int = 1200, target: String = "org.reader"): Map<String, Any?> {
    val group = FreedAppGroupStore.blockingGroup(context, target) ?: error("Daily boundary is not natively active for $target")
    val id = java.util.UUID.randomUUID().toString()
    val pending = context.storage.edit().putString("id",id).putString("package",target).putString("rule","app-group:${group["id"]}:${group["revision"]}")
    check(FreedAppGroupStore.issue(context,group,target,id,pending));check(pending.commit())
    val staged=context.storage.edit();FreedAppGroupStore.stage(context,context.storage.all,staged);check(staged.commit())
    val authority=FreedAppGroupStore.pendingScope(context,context.storage.all)!!
    return mapOf("version" to 2,"policyVersion" to 2,"nativeInterventionId" to id,"groupId" to groupId,"groupRevision" to group["revision"],
      "configurationGeneration" to authority["configurationGeneration"],"scopeEpoch" to authority["scopeEpoch"],"kind" to "android-app-group","packageName" to target,"requestedSeconds" to seconds)
  }
  fun prepare(request: Map<String,Any?>)=FreedAppGroupStore.prepareEarnedTime(context,request,scope)
  fun grant(offer: Map<String, Any?>, session: String = "live20", seconds: Int = 1200, active: Int = if (seconds == 300) 60 else 120) = mapOf(
    "version" to 2,"policyVersion" to 2,"offerId" to offer["offerId"],"completionSessionId" to session,"category" to "breathe","templateId" to "momentum-breathe-soft:earned-v2:$seconds","templateVersion" to 2,
    "evidence" to mapOf("method" to "timer","activeDurationSec" to active,"observedSteps" to 0,"photoProofIds" to emptyList<String>()))
  fun start(request: Map<String,Any?>)=FreedAppGroupStore.grantEarnedTime(context,request,scope)
}

private fun earnedWindow20Cases() {
  val wall=System.now;val elapsed=SystemClock.now;val failures=mutableListOf<String>()
  fun scenario(name:String, body:()->Unit) {try{body();println("PASS: $name")}catch(error:Throwable){failures.add(name+": "+(error.cause?.message?:error.message));println("FAIL: ${failures.last()}")}}
  scenario("new native binary advertises5/10/20 and disabled daily30/cap20/default5 rule") {
    val h=EarnedWindow20Harness();val snapshot=h.snapshot();val group=h.group()
    check(snapshot["supportedBreakSeconds"] == listOf(300L,600L,1200L)) {"Native support advertisement lacks1200"}
    check(group["preferredBreakSeconds"] == 300L && group["enabled"] == false && map(group["rule"])["kind"] == "daily-limit" && FreedAppGroupPolicy.integer(map(group["rule"])["limitMinutes"]) == 30L)
    check(map(group["extraTimeBudget"])["configuredCapMinutes"] == 20L)
    check(h.update()["accepted"] == true)
    check(FreedAppGroupStore.blockingGroup(h.context,"org.reader") == null) {"Daily challenge cannot trigger at intervals while allowance remains"}
    h.reachLimit();check(FreedAppGroupStore.blockingGroup(h.context,"org.reader") != null)
  }
  scenario("optional preference persists and omitted legacy update preserves it") {
    val h=EarnedWindow20Harness();check(h.update()["accepted"] == true)
    val revision=h.group()["revision"];val generation=h.snapshot()["configurationGeneration"]
    check(h.update(preferred=1200)["accepted"] == true) {"20-minute preference not accepted"}
    check(h.group()["preferredBreakSeconds"] == 1200L && h.group()["revision"] == revision && h.snapshot()["configurationGeneration"] == generation)
    check(h.update()["accepted"] == true && h.group()["preferredBreakSeconds"] == 1200L)
    check(h.update(preferred=600)["accepted"] == true && h.group()["preferredBreakSeconds"] == 600L)
    for (bad in listOf<Any?>(null,true,0,120,299,301,900,1200.5,1201,1800)) {
      val before=h.context.storage.all;check(h.update(preferred=bad)["accepted"] == false && h.context.storage.all == before) {"Unsupported preference accepted: $bad"}
    }
  }
  scenario("preference/cap metadata preserves live300 lease deadline, spend, group authority and omitted preference") {
    val h=EarnedWindow20Harness();check(h.update()["accepted"] == true);h.reachLimit()
    val offer=map(h.prepare(h.claim(300))["offer"]);val request=h.grant(offer,"metadata-live300",300);val original=h.start(request);check(original["accepted"] == true)
    val groupRevision=h.group()["revision"];val generation=h.snapshot()["configurationGeneration"]
    val breaks=h.context.storage.getString("app_group_earned_time_breaks_v2",null);val ledger=h.context.storage.getString("app_group_earned_time_consumption_v2",null)
    check(h.update(preferred=1200)["accepted"] == true)
    check(h.group()["revision"] == groupRevision && h.snapshot()["configurationGeneration"] == generation && h.group()["preferredBreakSeconds"] == 1200L)
    check(h.context.storage.getString("app_group_earned_time_breaks_v2",null) == breaks && h.context.storage.getString("app_group_earned_time_consumption_v2",null) == ledger)
    check(h.update(cap=5)["accepted"] == true && h.group()["preferredBreakSeconds"] == 1200L)
    val retry=h.start(request);check(retry["accepted"] == true && retry["expiresAt"] == original["expiresAt"] && map(retry["budget"])["spentSeconds"] == 300L)
    check(h.context.storage.getString("app_group_earned_time_breaks_v2",null) == breaks && h.group()["revision"] == groupRevision && h.snapshot()["configurationGeneration"] == generation)
    check(FreedAppGroupStore.blockingGroup(h.context,"org.reader") == null && FreedAppGroupStore.blockingGroup(h.context,"org.game") != null && h.context.storage.values["adult-DNS-policy"] == "protected")
  }
  scenario("preference metadata commit/readback failure rolls back without touching live authority") {
    val h=EarnedWindow20Harness();check(h.update()["accepted"] == true);h.reachLimit()
    val offer=map(h.prepare(h.claim(300))["offer"]);val request=h.grant(offer,"metadata-rollback",300);val granted=h.start(request);check(granted["accepted"] == true)
    val before=h.context.storage.all
    h.context.storage.failNext=true;check(h.update(preferred=1200)["accepted"] == false && h.context.storage.all == before)
    h.context.storage.wrongReadback=true;check(h.update(preferred=1200)["accepted"] == false && h.context.storage.all == before)
    val replay=h.start(request);check(replay["accepted"] == true && replay["expiresAt"] == granted["expiresAt"] && map(replay["budget"])["spentSeconds"] == 300L)
  }
  scenario("saved default is not authority and does not rewrite outstanding explicit offer") {
    val h=EarnedWindow20Harness();check(h.update()["accepted"] == true);h.reachLimit()
    val offer=map(h.prepare(h.claim(300))["offer"])
    check(h.update(preferred=1200)["accepted"] == true)
    val native=FreedAppGroupStore.earnedEvidenceAuthority(h.context,offer["offerId"] as String,h.scope)
    check(native != null && map(native["request"])["requestedSeconds"] == 300)
    val granted=h.start(h.grant(offer,"default-is-not-authority",300));check(granted["accepted"] == true && granted["seconds"] == 300L)
  }
  scenario("live20 timer uses120seconds, spends1200 once/defaultcap exhausted, source-only, restart readback and closed-app expiry") {
    val h=EarnedWindow20Harness();check(h.update()["accepted"] == true);h.reachLimit()
    val original=h.claim();val prepared=h.prepare(original);check(prepared["accepted"] == true) {prepared.toString()};val offer=map(prepared["offer"])
    check(offer["requiredActiveSeconds"] == 120L && offer["requiredSteps"] == 60L && offer["requiredDistinctPhotoTargets"] == 2L && "photo" !in (offer["availableMethods"] as List<*>))
    for (invalid in listOf(0,120,299,301,599,601,900,1199,1201,1800,3600)) check(h.prepare(original + ("requestedSeconds" to invalid))["accepted"] == false)
    val request=h.grant(offer);val before=h.context.storage.all
    check(h.start(h.grant(offer,active=119))["accepted"] == false && h.context.storage.all == before)
    h.context.storage.failNext=true;check(h.start(request)["reason"] == "earned-time-persistence-failed" && h.context.storage.all == before)
    val started=h.start(request);check(started["accepted"] == true && started["seconds"] == 1200L && started["effective"] == true)
    check(map(started["budget"])["spentSeconds"] == 1200L && map(started["budget"])["remainingSeconds"] == 0L)
    check(FreedAppGroupStore.blockingGroup(h.context,"org.reader") == null && FreedAppGroupStore.blockingGroup(h.context,"org.game") != null && h.context.storage.values["adult-DNS-policy"] == "protected")
    val liveBreak=h.context.storage.getString("app_group_earned_time_breaks_v2",null)
    val liveLedger=h.context.storage.getString("app_group_earned_time_consumption_v2",null)
    val authorityRevision=h.group()["revision"];val authorityGeneration=h.snapshot()["configurationGeneration"]
    check(h.update(preferred=600)["accepted"] == true && h.update(cap=5)["accepted"] == true)
    check(h.group()["preferredBreakSeconds"] == 600L && h.group()["revision"] == authorityRevision && h.snapshot()["configurationGeneration"] == authorityGeneration)
    check(h.context.storage.getString("app_group_earned_time_breaks_v2",null) == liveBreak && h.context.storage.getString("app_group_earned_time_consumption_v2",null) == liveLedger && map(h.group()["extraTimeBudget"])["spentSeconds"] == 1200L)
    val metadataRetry=h.start(request);check(metadataRetry["accepted"] == true && metadataRetry["seconds"] == 1200L && metadataRetry["expiresAt"] == started["expiresAt"])
    val snapshot=h.context.storage.all
    FreedAppGroupStore.javaClass.getDeclaredField("boundScope").apply{isAccessible=true}.set(null,null)
    FreedAppGroupStore.javaClass.getDeclaredField("boundSignedInOwner").apply{isAccessible=true}.setBoolean(null,false)
    check(FreedAppGroupStore.bindScope(h.context,h.scope))
    val replay=FreedAppGroupStore.getEarnedTimeGrant(h.context,request,h.scope)
    check(replay["accepted"] == true && replay["replayed"] == true && replay["expiresAt"] == started["expiresAt"] && map(replay["budget"])["spentSeconds"] == 1200L && h.context.storage.all == snapshot)
    h.advance(1_200_000L)
    check(FreedAppGroupStore.blockingGroup(h.context,"org.reader") != null && !FreedAppGroupStore.hasActiveEarnedTimeWindow(h.context))
    check(FreedAppGroupStore.getEarnedTimeGrant(h.context,request,h.scope)["reason"] == "earned-time-grant-expired")
    check(h.prepare(h.claim())["reason"] == "earned-time-budget-exhausted" && map(h.group()["extraTimeBudget"])["spentSeconds"] == 1200L)
  }
  scenario("overlapping daily rules cannot be opened by20") {
    val h=EarnedWindow20Harness();check(h.update()["accepted"] == true);h.reachLimit()
    val created=FreedAppGroupStore.mutate(h.context,mapOf("version" to 1,"expectedStoreRevision" to h.snapshot()["revision"],"name" to "Second daily rule"),h.scope,"create")
    check(created["accepted"] == true);val second=rows(map(created["snapshot"])).last()
    val update=FreedAppGroupStore.updateWithEarnedTime(h.context,mapOf("version" to 2,"expectedStoreRevision" to h.snapshot()["revision"],"id" to second["id"],"expectedRevision" to second["revision"],"name" to second["name"],"enabled" to true,"rule" to second["rule"],"packages" to listOf("org.reader"),"extraTimeCapMinutes" to 20),h.scope)
    check(update["accepted"] == true);check(h.prepare(h.claim())["reason"] == "earned-time-independent-restriction")
  }
  scenario("20 native step proof requires60 observed steps and spends1200 once") {
    val h=ChallengeEvidenceHarness(1200,detector=true)
    try {
      val session=map(h.begin()["session"]);check(session["requiredSteps"] == 60L && session["requiredPhotoTargets"] == 2L)
      repeat(59){h.emit(1f)};check(h.finish(session)["reason"] == "earned-challenge-evidence-incomplete")
      h.emit(1f);val done=map(h.finish(session)["session"]);check(done["observedSteps"] == 60L && done["stepProofId"] is String)
      val request=h.grant(done) + ("evidence" to (map(h.grant(done)["evidence"]) + ("observedSteps" to 60)))
      val start=h.start(request);check(start["accepted"] == true && start["seconds"] == 1200L && map(start["budget"])["spentSeconds"] == 1200L)
      check(h.start(request)["expiresAt"] == start["expiresAt"])
    } finally {h.call("destroy")}
  }
  scenario("20 photo requirements stay two distinct evaluated targets, not four, with release gate closed") {
    check(FreedEarnedChallengeProofPolicy.targets("momentum-find-chair-cup:earned-v2:1200",1200L) == listOf("chair","cup"))
    check(FreedEarnedChallengeProofPolicy.targets("momentum-find-chair:earned-v2:1200",1200L) == null)
    check(FreedEarnedChallengeProofPolicy.targets("momentum-find-flower-plant:earned-v2:1200",1200L) == null)
    check(FreedEarnedChallengePhotoEvaluation.reviewedTargetIds.isEmpty())
  }
  System.now=wall;SystemClock.now=elapsed
  check(failures.isEmpty()){failures.joinToString("\n")}
  println("Android20 extension actual store/controller passed: explicit daily boundary, comfortable requirements, optional default metadata, exact/atomic source-only grant, cap exhaustion/restart/expiry, overlaps/adult filtering and legacy assertions retained")
}
