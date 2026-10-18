package app.freed.protection

import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.provider.Telephony
import android.telecom.TelecomManager
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit

/** Process-local admission only. No browsing URL, label, icon, history, JS inventory or network request. */
internal class FreedBrowserHandlers(
  private val context: Context,
  private val handler: Handler = Handler(Looper.getMainLooper()),
  private val dispatch: (Runnable) -> Unit = { queryExecutor.execute(it) }
) {
  companion object {
    // A replaced service can queue its scan, but old and new instances never query concurrently.
    private val queryExecutor = ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
      ArrayBlockingQueue<Runnable>(1), { task -> Thread(task, "freed-web-handlers").apply { isDaemon = true } },
      ThreadPoolExecutor.AbortPolicy())
    private val packageActions = setOf(
      Intent.ACTION_PACKAGE_ADDED, Intent.ACTION_PACKAGE_REMOVED, Intent.ACTION_PACKAGE_CHANGED,
      Intent.ACTION_PACKAGE_REPLACED, Intent.ACTION_PACKAGE_FULLY_REMOVED
    )
  }

  private val cache = FreedBrowserHandlerCache()
  private var active = false
  private var receiverRegistered = false
  private val receiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (!active || intent?.action !in packageActions || intent?.data?.scheme != "package") return
      // Never infer membership from a package extra, including replacement-removal broadcasts.
      cache.invalidate(SystemClock.elapsedRealtime())
      refresh()
    }
  }
  private val expiryCheck = object : Runnable {
    override fun run() {
      if (!active) return
      refresh()
      handler.postDelayed(this, FreedBrowserHandlerCache.TTL_MS)
    }
  }

  fun connect() {
    if (active || receiverRegistered) disconnect()
    val filter = IntentFilter().apply {
      packageActions.forEach(::addAction)
      addDataScheme("package")
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        @Suppress("DEPRECATION")
        context.registerReceiver(receiver, filter)
      }
      receiverRegistered = true
    } catch (_: Exception) {
      cache.disconnect("receiver-register-failed")
      return
    }
    active = true
    cache.connect(SystemClock.elapsedRealtime())
    refresh()
    handler.postDelayed(expiryCheck, FreedBrowserHandlerCache.TTL_MS)
  }

  fun disconnect() {
    active = false
    handler.removeCallbacks(expiryCheck)
    cache.disconnect()
    if (receiverRegistered) {
      receiverRegistered = false
      try {
        context.unregisterReceiver(receiver)
      } catch (_: Exception) {
        cache.disconnect("receiver-unregister-failed")
      }
    }
  }

  /** Read-only admission: never dispatch a query from an accessibility event or native grant lock. */
  fun contains(packageName: String?): Boolean = packageName != null && packageName in snapshot().packages

  fun snapshot(): FreedBrowserHandlerCache.Snapshot = cache.snapshot(SystemClock.elapsedRealtime())

  private fun refresh() {
    if (!active) return
    val query = cache.beginQuery(SystemClock.elapsedRealtime()) ?: return
    try {
      dispatch(Runnable {
        val result = runCatching { queryInstalledHandlers() }
        // Publish on the lifecycle looper; background reads cannot reorder monotonic cache observations.
        handler.post {
          cache.complete(query, result.getOrNull(), SystemClock.elapsedRealtime(),
            if (result.isFailure) "package-query-failed" else null)
          // A broadcast during this query may have advanced generation. Recheck once off the event path.
          if (active) refresh()
        }
      })
    } catch (_: Exception) {
      cache.complete(query, null, SystemClock.elapsedRealtime(), "query-dispatch-failed")
    }
  }

  @Suppress("DEPRECATION")
  private fun queryInstalledHandlers(): Set<String> {
    val pm = context.packageManager
    fun query(intent: Intent): List<ResolveInfo> = pm.queryIntentActivities(intent, PackageManager.GET_RESOLVED_FILTER)
    val http = query(Intent(Intent.ACTION_VIEW, Uri.parse("http://example.invalid/")).addCategory(Intent.CATEGORY_BROWSABLE))
    val https = query(Intent(Intent.ACTION_VIEW, Uri.parse("https://example.invalid/")).addCategory(Intent.CATEGORY_BROWSABLE))
    val excluded = linkedSetOf<String>()
    listOf(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), Intent(Settings.ACTION_SETTINGS),
      Intent(Intent.ACTION_DIAL, Uri.parse("tel:")), Intent("android.intent.action.EMERGENCY_DIAL"),
      Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:"))).forEach { safety ->
      query(safety).forEach { it.activityInfo?.packageName?.let(excluded::add) }
    }
    (context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager)?.defaultDialerPackage?.let(excluded::add)
    Telephony.Sms.getDefaultSmsPackage(context)?.let(excluded::add)
    val disabled = setOf(PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER,
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED)
    fun project(rows: List<ResolveInfo>, scheme: String): List<FreedBrowserHandlerPolicy.Candidate> = rows.mapNotNull { resolved ->
      val activity = resolved.activityInfo ?: return@mapNotNull null
      val app = activity.applicationInfo ?: return@mapNotNull null
      val id = activity.packageName ?: return@mapNotNull null
      if (!FreedInstalledAppPolicy.validPackage(id) || id != app.packageName) return@mapNotNull null
      // The public resolved filter is the evidence. Missing or restricted filters confer no admission.
      val filter = resolved.filter
      val generalWebHandler = filter != null && filter.hasAction(Intent.ACTION_VIEW) &&
        filter.hasCategory(Intent.CATEGORY_BROWSABLE) && filter.hasDataScheme(scheme) &&
        filter.countDataAuthorities() == 0 && filter.countDataPaths() == 0 &&
        filter.countDataSchemeSpecificParts() == 0 && filter.countDataTypes() == 0
      FreedBrowserHandlerPolicy.Candidate(id, app.packageName,
        activity.enabled && pm.getComponentEnabledSetting(ComponentName(id, activity.name)) !in disabled,
        activity.exported, app.enabled && pm.getApplicationEnabledSetting(id) !in disabled,
        generalWebHandler)
    }
    return FreedBrowserHandlerPolicy.select(project(http, "http"), project(https, "https"), context.packageName, excluded)
  }
}
