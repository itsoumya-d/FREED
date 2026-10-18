package app.freed.protection

import java.util.TimeZone

fun main() {
  val type = runCatching { Class.forName("app.freed.protection.FreedAppGroupPolicy") }.getOrNull()
  check(type != null) { "Independent installed-app group policy is missing" }
  val policy = type.getField("INSTANCE").get(null)
  val validate = type.getMethod("validateRule", Map::class.java)
  check(validate.invoke(policy, mapOf("kind" to "before-use")) != null)
  check(validate.invoke(policy, mapOf("kind" to "daily-limit", "limitMinutes" to 30)) != null)
  for (bad in listOf(mapOf("kind" to "legacy"), mapOf("kind" to "daily-limit", "limitMinutes" to 0),
    mapOf("kind" to "daily-limit", "limitMinutes" to 30.5),
    mapOf("kind" to "before-use", "code" to "ignore"),
    mapOf("kind" to "scheduled", "startMinute" to 540, "endMinute" to 540, "days" to listOf(1))))
    check(validate.invoke(policy, bad) == null) { "Malformed or native-only rules cannot be installed" }
  val active = type.getMethod("ruleActive", Map::class.java, Long::class.javaPrimitiveType, Long::class.javaPrimitiveType, TimeZone::class.java)
  fun at(raw: String) = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'").apply { timeZone = TimeZone.getTimeZone("UTC") }.parse(raw)!!.time
  val night = mapOf("kind" to "scheduled", "startMinute" to 1380, "endMinute" to 60, "days" to listOf(1))
  val utc = TimeZone.getTimeZone("UTC")
  check(active.invoke(policy, night, at("2026-10-05T23:00:00Z"), 0L, utc) == true)
  check(active.invoke(policy, night, at("2026-10-06T00:59:59Z"), 0L, utc) == true)
  check(active.invoke(policy, night, at("2026-10-06T01:00:00Z"), 0L, utc) == false)
  check(active.invoke(policy, night, at("2026-10-06T23:00:00Z"), 0L, utc) == false)
  val daily = mapOf("kind" to "daily-limit", "limitMinutes" to 30)
  check(active.invoke(policy, daily, at("2026-10-05T12:00:00Z"), 1_799_999L, utc) == false)
  check(active.invoke(policy, daily, at("2026-10-05T12:00:00Z"), 1_800_000L, utc) == true)
  val budget = type.getMethod("combinedUsage", Set::class.java, Map::class.java)
  check(budget.invoke(policy, setOf("org.reader", "org.game"), mapOf("org.reader" to 900_000L, "org.game" to 900_000L, "org.other" to 999_999L)) == 1_800_000L)
  val revision = type.getMethod("revisionMatches", Map::class.java, Long::class.javaPrimitiveType, Long::class.javaObjectType)
  check(revision.invoke(policy, mapOf("version" to 1, "expectedStoreRevision" to 4, "expectedRevision" to 2), 4L, 2L) == true)
  for (bad in listOf(mapOf("version" to 1, "expectedStoreRevision" to 3, "expectedRevision" to 2),
    mapOf("version" to 1, "expectedStoreRevision" to 4.5, "expectedRevision" to 2),
    mapOf("version" to 1, "expectedStoreRevision" to 4, "expectedRevision" to 1)))
    check(revision.invoke(policy, bad, 4L, 2L) == false) { "Stale/fractional CAS must preserve prior configuration" }
  val mutate = type.methods.firstOrNull { it.name == "mutate" }
  check(mutate != null) { "Native group CAS transaction is missing" }
  val eligible = setOf("org.reader", "org.game")
  var state: Map<String, Any?> = mapOf("version" to 1, "revision" to 0L, "generation" to 0L, "groups" to emptyList<Any>())
  fun change(operation: String, input: Map<String, Any?>, id: String = "new-group"): Map<String, Any?>? {
    @Suppress("UNCHECKED_CAST")
    return mutate.invoke(policy, state, input, operation, eligible, id) as? Map<String, Any?>
  }
  repeat(6) { index ->
    state = change("create", mapOf("version" to 1, "expectedStoreRevision" to index, "name" to "Group $index"), "group-$index")!!
  }
  val groups = state["groups"] as List<*>
  val first = groups[0] as Map<*, *>
  check(first["enabled"] == false && first["rule"] == mapOf("kind" to "daily-limit", "limitMinutes" to 30L))
  check(change("create", mapOf("version" to 1, "expectedStoreRevision" to 6, "name" to "Seventh")) == null)
  val update = mapOf<String, Any?>("version" to 1, "expectedStoreRevision" to 6, "id" to "group-0", "expectedRevision" to 1,
    "name" to "Reader and chess", "enabled" to true, "rule" to daily, "packages" to listOf("org.reader", "org.game"))
  check(change("update", update + ("expectedRevision" to 0)) == null)
  check(change("update", update + ("packages" to listOf("org.uninstalled"))) == null)
  check(change("update", update + ("packages" to emptyList<String>())) == null)
  state = change("update", update)!!
  check(state["revision"] == 7L && state["generation"] == 7L)
  check(change("remove", mapOf("version" to 1, "expectedStoreRevision" to 6, "id" to "group-0", "expectedRevision" to 2)) == null)
  state = change("remove", mapOf("version" to 1, "expectedStoreRevision" to 7, "id" to "group-0", "expectedRevision" to 2))!!
  check((state["groups"] as List<*>).size == 5)
  val binding = type.getMethod("scopeChanged", String::class.java, String::class.java, String::class.java, String::class.java)
  check(binding.invoke(policy, "owner-A-digest", null, "[A,1]", "owner-A-digest") == false) { "Same owner cold start preserves current scope epoch" }
  check(binding.invoke(policy, "owner-A-digest", null, "[B,1]", "owner-B-digest") == true)
  check(binding.invoke(policy, null, null, "[A,1]", "owner-A-digest") == true) { "Unknown persisted owner must invalidate old authority" }
  check(binding.invoke(policy, "owner-A-digest", "[A,1]", "[A,2]", "owner-A-digest") == true)
  println("Group policy: exact writable rules, overnight start-day bounds, combined real usage threshold and stale CAS rejection passed")
}
