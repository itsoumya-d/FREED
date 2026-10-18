package app.freed.protection

/** General local web-handler admission, separate from selected-app eligibility and URL-field hints. */
internal object FreedBrowserHandlerPolicy {
  data class Candidate(
    val packageName: String,
    val applicationPackage: String,
    val activityEnabled: Boolean,
    val exported: Boolean,
    val applicationEnabled: Boolean,
    val generalWebHandler: Boolean
  )

  private val critical = setOf(
    "android", "com.android.settings", "com.android.systemui", "com.android.phone",
    "com.android.server.telecom", "com.android.emergency", "com.google.android.apps.safetyhub",
    "com.android.providers.telephony", "com.android.permissioncontroller", "com.google.android.permissioncontroller",
    "com.android.intentresolver", "com.google.android.intentresolver"
  )

  fun select(http: List<Candidate>, https: List<Candidate>, ownPackage: String, excluded: Set<String>): Set<String> {
    fun eligible(rows: List<Candidate>): Set<String> = rows.asSequence().filter { row ->
      FreedInstalledAppPolicy.validPackage(row.packageName) && row.packageName == row.applicationPackage &&
        row.packageName != ownPackage && row.packageName !in critical && row.packageName !in excluded &&
        row.activityEnabled && row.exported && row.applicationEnabled && row.generalWebHandler
    }.map { it.packageName }.toSet()
    return eligible(http).intersect(eligible(https))
  }
}
