package app.freed.protection

fun main() {
  val type = runCatching { Class.forName("app.freed.protection.FreedAppGroupAuthorityPolicy") }.getOrNull()
  check(type != null) { "Native exact-group claim authority is missing" }
  val policy = type.getField("INSTANCE").get(null)
  val authorize = type.methods.first { it.name == "authorize" }
  val id = "a2b4053a-a9e0-4209-9bba-6a6e0fb270ba"
  val group = mapOf("id" to "group-1", "revision" to 3L, "enabled" to true, "legacy" to false, "packages" to listOf("org.reader"))
  val lease = mapOf<String, Any?>("id" to id, "targetKind" to "android-app-group", "packageName" to "org.reader",
    "groupId" to "group-1", "groupRevision" to 3L, "configurationGeneration" to 8L, "scopeEpoch" to 2L,
    "resetEpoch" to 4L, "claimedAt" to 1_000_000L, "claimedElapsed" to 500_000L, "boot" to 7)
  fun checkGrant(change: Map<String, Any?> = emptyMap(), current: Map<String, Any?> = group, generation: Long = 8L,
    scope: Long = 2L, reset: Long = 4L, source: String = "org.reader", request: Long = 2_000_000L,
    now: Long = 1_060_000L, elapsed: Long = 560_000L, boot: Int = 7): Map<*, *>? =
    authorize.invoke(policy, lease + change, current, generation, scope, reset, id, source, request, now, elapsed, boot) as? Map<*, *>
  val accepted = checkGrant()
  check(accepted != null && accepted["expiresAtMs"] == 2_000_000L && accepted["firstFulfillment"] == true)
  check(checkGrant(generation = 9L) == null)
  check(checkGrant(scope = 3L) == null)
  check(checkGrant(reset = 5L) == null)
  check(checkGrant(current = group + ("revision" to 4L)) == null)
  check(checkGrant(current = group + ("enabled" to false)) == null)
  check(checkGrant(source = "org.game") == null)
  check(checkGrant(boot = 8) == null)
  check(checkGrant(elapsed = 499_999L) == null)
  check(checkGrant(now = 999_999L) == null)
  check(checkGrant(now = 2_200_000L, elapsed = 1_700_000L, request = 2_300_000L) == null)
  val capped = checkGrant(request = 99_000_000L)!!
  check(capped["expiresAtMs"] == 8_260_000L) { "Even verified challenge claims cannot grant more than 120 minutes" }
  val receipt = mapOf("requestedExpiry" to 2_000_000L, "grantedExpiry" to 2_000_000L)
  check(checkGrant(receipt)?.get("firstFulfillment") == false)
  check(checkGrant(receipt, request = 2_000_001L) == null) { "Duplicate fulfillment may observe, never extend the receipt" }
  check(checkGrant(mapOf("targetKind" to "android-app")) == null)
  println("Group authority: exact native ID/group/revision/target, reset/owner/generation fences, monotonic/boot freshness, TTL, bounded expiry and no-renewal replay passed")
}
