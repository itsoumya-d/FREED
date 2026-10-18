package app.freed.protection

fun main() {
  val now = 1_800_000_000_000L
  val id = "10101010-1010-4010-8010-101010101010"
  val source = FreedDoomscrollApps.YOUTUBE_PACKAGE
  fun claim(rule: String = "configured-app:$source", actual: String = source, detected: Long = now, surface: String? = null) =
    FreedNativeUnlockPolicy.claim(id, actual, rule, surface, detected, now, 100_000, 4)
  val lease = claim() ?: error("A fresh native event must stage its exact target before the challenge.")
  fun decide(value: FreedNativeUnlockLease? = lease, requestId: String? = id, target: String = source, rule: String? = null,
    at: Long = now + 15 * 60_000, elapsed: Long = 100_000 + (at - now), boot: Int = 4, expiry: Long = at + 30 * 60_000) =
    FreedNativeUnlockPolicy.authorize(value, requestId, target, rule, expiry, at, elapsed, boot)
  check(decide()?.firstFulfillment == true) // Fifteen-minute challenge after early event consumption.
  check(decide(requestId = null) == null)
  check(decide(requestId = "20202020-2020-4020-8020-202020202020") == null)
  check(decide(target = FreedDoomscrollApps.INSTAGRAM_PACKAGE) == null)
  check(decide(at = now + FreedNativeUnlockPolicy.CLAIM_TTL_MS) == null)
  check(decide(at = now - 1, elapsed = 99_999) == null)
  check(decide(boot = 5) == null)
  check(decide(elapsed = 99_999) == null)
  check(decide(expiry = now) == null)
  check(claim(detected = now - 600_001) == null)
  check(claim(detected = now + 60_001) == null)
  check(claim(actual = FreedDoomscrollApps.INSTAGRAM_PACKAGE) == null)
  check(claim(actual = "") == null)
  check(claim(rule = "short-form:youtube-shorts", actual = FreedDoomscrollApps.INSTAGRAM_PACKAGE) == null)
  check(claim(rule = "short-form:tiktok-feed", actual = FreedDoomscrollApps.TIKTOK_TRILL_PACKAGE) != null)
  val surface = claim(rule = "focus-shield:focus-rule-a7f9", surface = "focus-rule-a7f9") ?: error("Surface lease should stage.")
  check(decide(value = surface) == null) // Surface cannot widen to package access.
  check(decide(value = surface, rule = "different-rule") == null)
  check(decide(value = surface, rule = "focus-rule-a7f9")?.firstFulfillment == true)
  val first = decide(at = now, expiry = now + 24 * 60 * 60_000)!!
  check(first.expiresAtMs == now + 120 * 60_000)
  val fulfilled = lease.copy(fulfilledRequestExpiryMs = now + 24 * 60 * 60_000, grantedExpiryMs = first.expiresAtMs)
  check(decide(value = fulfilled, at = now, expiry = now + 24 * 60 * 60_000)?.firstFulfillment == false)
  check(decide(value = fulfilled, at = now, expiry = now + 24 * 60 * 60_000 + 1) == null)
  check(decide(value = fulfilled, at = first.expiresAtMs, expiry = now + 24 * 60 * 60_000) == null)
  println("Fresh claimed target, challenge lease, single fulfillment, replay and expiry cases passed")
}
