package app.freed.protection

import java.util.Locale

internal object FreedPhotoTargetMatching {
  fun matches(observed: String, expected: String): Boolean {
    fun normalize(value: String) = value.lowercase(Locale.US)
      .replace(Regex("[^a-z0-9]+"), " ").trim().replace(Regex("\\s+"), " ")
    val actual = normalize(observed)
    val target = normalize(expected)
    return actual.isNotEmpty() && target.isNotEmpty() && actual == target
  }
}
