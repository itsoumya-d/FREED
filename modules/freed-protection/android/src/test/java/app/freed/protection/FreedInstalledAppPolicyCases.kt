package app.freed.protection

fun main() {
  val type = runCatching { Class.forName("app.freed.protection.FreedInstalledAppPolicy") }.getOrNull()
  check(type != null) { "Actual installed launchable app policy is missing" }
  val policy = type.getField("INSTANCE").get(null)
  val select = type.getMethod("select", List::class.java, String::class.java, Set::class.java)
  fun candidate(id: String, label: String, enabled: Boolean = true, exported: Boolean = true) =
    mapOf<String, Any?>("packageName" to id, "label" to label, "enabled" to enabled, "exported" to exported)
  val selected = select.invoke(policy, listOf(
    candidate("org.example.reader", "  Real Reader\u0000  "),
    candidate("org.example.reader", "Duplicate launcher activity"),
    candidate("org.example.game", "Chess"),
    candidate("app.freed.recovery", "FREED"),
    candidate("org.example.home", "Home"),
    candidate("com.android.settings", "Settings"),
    candidate("org.example.dialer", "Emergency calling"),
    candidate("org.example.disabled", "Disabled", enabled = false),
    candidate("org.example.hidden", "Hidden", exported = false),
    candidate("org.example.injection/../../", "Invalid")
  ), "app.freed.recovery", setOf("org.example.home", "org.example.dialer")) as List<*>
  check(selected.size == 2) { "Deduplicate real activities and exclude own, HOME, critical, disabled and invalid packages" }
  val rows = selected.map { it as Map<*, *> }
  check(rows[0]["packageName"] == "org.example.game" && rows[0]["label"] == "Chess")
  check(rows[1]["packageName"] == "org.example.reader" && rows[1]["label"] == "Real Reader")
  val validate = type.getMethod("validateSelection", List::class.java, Set::class.java)
  check(validate.invoke(policy, listOf("org.example.reader", "org.example.reader"), setOf("org.example.reader")) == listOf("org.example.reader"))
  check(validate.invoke(policy, emptyList<String>(), emptySet<String>()) == emptyList<String>()) { "Only explicit empty input removes the selection" }
  for (bad in listOf("org.example.uninstalled", "org.example.disabled", "https://org.example.reader", "ORG.EXAMPLE.READER", " org.example.reader", "org.example.reader\n", "org.example.reader;code")) {
    check(validate.invoke(policy, listOf("org.example.reader", bad), setOf("org.example.reader")) == null) { "Invalid/unavailable input must reject atomically, never silently clear: $bad" }
  }
  val key = type.getMethod("iconKey", String::class.java)
  val hash = key.invoke(policy, "org.example.reader") as String
  check(hash.matches(Regex("^[0-9a-f]{64}\\.png$"))) { "App-private icon paths must be hash-mapped, never package-derived paths" }
  check(key.invoke(policy, "org.example.game") != hash)
  println("Installed app policy: real labels, deduplication, critical pathways, disabled/uninstalled rejection, atomic selection and hashed cache paths passed")
}
