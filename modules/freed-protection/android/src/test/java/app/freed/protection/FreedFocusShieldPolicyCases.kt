package app.freed.protection

fun main() {
  check(!FreedFocusShieldPolicy.canInspectSurface(false, false, false, true, true))
  check(!FreedFocusShieldPolicy.canInspectSurface(false, false, true, true, true))
  check(!FreedFocusShieldPolicy.canInspectSurface(true, false, false, false, true))
  check(!FreedFocusShieldPolicy.canInspectSurface(true, false, false, true, false))
  check(FreedFocusShieldPolicy.canInspectSurface(true, false, false, true, true))
  check(FreedFocusShieldPolicy.canInspectSurface(false, true, true, true, true))
  check(!FreedFocusShieldPolicy.canInspectSurface(false, true, false, true, true))
  println("Android surface build, rollout and explicit opt-in policy cases passed")
}
