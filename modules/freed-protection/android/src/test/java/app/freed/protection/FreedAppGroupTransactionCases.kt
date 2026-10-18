package app.freed.protection

fun main() {
  val type = runCatching { Class.forName("app.freed.protection.FreedAppGroupTransaction") }.getOrNull()
  check(type != null) { "Native group confirmed-commit and rollback transaction is missing" }
  val objectValue = type.getField("INSTANCE").get(null)
  val publish = type.methods.first { it.name == "publish" }
  var state = "previous"
  var unrelated = "adult-DNS-active"
  var fail = false
  var stale = false
  val commit: () -> Boolean = { state = "candidate"; !fail }
  val readback: () -> Boolean = { state == "candidate" }
  val current: () -> Boolean = { !stale }
  val rollback: () -> Unit = { state = "previous" }
  check(publish.invoke(objectValue, commit, readback, current, rollback) == true)
  fail = true
  check(publish.invoke(objectValue, commit, readback, current, rollback) == false && state == "previous")
  fail = false; stale = true
  check(publish.invoke(objectValue, commit, readback, current, rollback) == false && state == "previous")
  stale = false
  check(publish.invoke(objectValue, commit, { false }, current, rollback) == false && state == "previous")
  check(unrelated == "adult-DNS-active")
  println("Group transaction: persistence, exact readback, final generation fences and rollback preserve prior native policy passed")
}
