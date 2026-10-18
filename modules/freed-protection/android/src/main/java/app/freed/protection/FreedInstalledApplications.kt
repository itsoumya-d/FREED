package app.freed.protection

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.provider.Settings
import android.provider.Telephony
import android.telecom.TelecomManager
import java.io.File
import java.util.Locale

/** Launchable PackageManager entries only; never QUERY_ALL_PACKAGES, catalogs, telemetry or backup. */
internal object FreedInstalledApplications {
  private const val ICON_SIZE = 96
  private const val MAX_ICON_BYTES = 64 * 1024L
  private const val MAX_CACHE_BYTES = 24 * 1024 * 1024L
  private val lock = Any()

  @Suppress("DEPRECATION")
  fun list(context: Context, includeIcons: Boolean = true): List<Map<String, Any?>> = synchronized(lock) {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val activities = pm.queryIntentActivities(intent, 0)
    val excluded = linkedSetOf<String>()
    val safetyIntents = listOf(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME),
      Intent(Settings.ACTION_SETTINGS), Intent(Intent.ACTION_DIAL, Uri.parse("tel:")),
      Intent("android.intent.action.EMERGENCY_DIAL"), Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:")))
    safetyIntents.forEach { safety -> runCatching { pm.queryIntentActivities(safety, 0) }
      .getOrNull()?.forEach { it.activityInfo?.packageName?.let(excluded::add) } }
    runCatching { (context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager)?.defaultDialerPackage }
      .getOrNull()?.let(excluded::add)
    runCatching { Telephony.Sms.getDefaultSmsPackage(context) }.getOrNull()?.let(excluded::add)
    val candidates = activities.mapNotNull { activity ->
      val info = activity.activityInfo ?: return@mapNotNull null
      val app = info.applicationInfo ?: return@mapNotNull null
      val enabled = info.enabled && app.enabled && runCatching { pm.getApplicationEnabledSetting(app.packageName) }
        .getOrDefault(0) !in setOf(2, 3, 4)
      val label = runCatching { pm.getApplicationLabel(app).toString() }.getOrNull() ?: return@mapNotNull null
      mapOf<String, Any?>("packageName" to info.packageName, "label" to label,
        "enabled" to enabled, "exported" to info.exported)
    }
    val selected = FreedInstalledAppPolicy.select(candidates, context.packageName, excluded)
    if (!includeIcons) return@synchronized selected
    val cache = File(context.cacheDir, "freed-installed-app-icons-v1")
    if (!cache.exists()) cache.mkdirs()
    val liveNames = selected.map { FreedInstalledAppPolicy.iconKey(it["packageName"] as String) }.toSet()
    cache.listFiles()?.filter { it.name !in liveNames || it.length() > MAX_ICON_BYTES }?.forEach(File::delete)
    val result = selected.map { row ->
      val id = row["packageName"] as String
      val file = File(cache, FreedInstalledAppPolicy.iconKey(id))
      val uri = runCatching {
        if (!file.exists() || System.currentTimeMillis() - file.lastModified() > 300_000L) {
          val drawable = pm.getApplicationIcon(id)
          val bitmap = Bitmap.createBitmap(ICON_SIZE, ICON_SIZE, Bitmap.Config.ARGB_8888)
          try {
            drawable.setBounds(0, 0, ICON_SIZE, ICON_SIZE)
            drawable.draw(Canvas(bitmap))
            file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it)) }
          } finally { bitmap.recycle() }
        }
        if (file.length() in 1..MAX_ICON_BYTES) Uri.fromFile(file).toString() else { file.delete(); null }
      }.getOrNull()
      row + mapOf("iconUri" to uri)
    }
    var bytes = cache.listFiles()?.sumOf(File::length) ?: 0L
    cache.listFiles()?.sortedBy(File::lastModified)?.forEach { file ->
      if (bytes > MAX_CACHE_BYTES) { bytes -= file.length(); file.delete() }
    }
    result.map { row ->
      val uri = row["iconUri"] as? String
      if (uri != null && !File(Uri.parse(uri).path.orEmpty()).exists()) row + mapOf("iconUri" to null) else row
    }
  }

  fun eligible(context: Context): Set<String> = list(context, includeIcons = false).map { it["packageName"] as String }.toSet()

  fun page(context: Context, query: String, offset: Int, limit: Int): Map<String, Any?> {
    if (offset < 0 || limit !in 1..60 || query.length > 120 || query.any(Char::isISOControl))
      return mapOf("supported" to true, "apps" to emptyList<Any>(), "total" to 0, "nextOffset" to null, "reason" to "installed-app-query-invalid")
    val needle = query.trim().lowercase(Locale.ROOT)
    val apps = list(context).filter { (it["label"] as String).lowercase(Locale.ROOT).contains(needle) ||
      (it["packageName"] as String).contains(needle) }
    val rows = apps.drop(offset).take(limit).map { mapOf("packageName" to it["packageName"],
      "name" to it["label"], "iconUri" to it["iconUri"], "eligible" to true) }
    return mapOf("supported" to true, "apps" to rows, "total" to apps.size,
      "nextOffset" to (offset + rows.size).takeIf { it < apps.size }, "reason" to null)
  }
}
