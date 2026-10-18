package app.freed.protection

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ScrollView
import java.lang.ref.WeakReference

class FreedInterventionActivity : Activity() {
  companion object {
    const val INTERVENTION_ID_EXTRA = "freed_intervention_id"
    private val activityOwnershipLock = Any()
    private var activeActivity = WeakReference<FreedInterventionActivity>(null)

    private class CleanupActivityCapture(var activity: FreedInterventionActivity?, val presentation: Long, var settled: Boolean = false, var forgetWhenSettled: Boolean = false)
    private val cleanupActivities = linkedMapOf<String, CleanupActivityCapture>()
    private val unavailableCleanupActivities = linkedSetOf<String>()

    /** One native cleanup ID retains its exact Activity/presentation until positive settlement. */
    fun clearOwnedRuntimeForCleanup(operationID: String, valid: () -> Boolean): Boolean {
      val capture = synchronized(FreedNativeUnlockStore.lock) {
        synchronized(activityOwnershipLock) { cleanupActivities[operationID] } ?: run {
          if (!valid()) return false
          synchronized(activityOwnershipLock) {
            if (operationID in unavailableCleanupActivities) return false
            if (cleanupActivities.size >= 32) {
              // A failed capture is unknown, never permission to adopt a later current Activity.
              if (unavailableCleanupActivities.size < 32) unavailableCleanupActivities.add(operationID)
              return false
            }
            val current = activeActivity.get()
            CleanupActivityCapture(current, current?.presentationEpoch ?: 0L).also { cleanupActivities[operationID] = it }
          }
        }
      }
      return FreedProtectionConfiguration.runOnMainForReset {
        synchronized(FreedNativeUnlockStore.lock) {
          if (synchronized(activityOwnershipLock) { capture.settled }) return@synchronized true
          if (!valid()) return@synchronized false
          val target = synchronized(activityOwnershipLock) { capture.activity }
          if (target != null && !target.isFinishing && !target.isDestroyed && target.presentationEpoch == capture.presentation)
            target.dismissForConfigurationReset()
          val settled = target == null || target.isFinishing || target.isDestroyed || target.presentationEpoch != capture.presentation
          if (settled) synchronized(activityOwnershipLock) {
            // A replacement instance or a reused presentation remains independently owned.
            if (target != null && target.presentationEpoch == capture.presentation && activeActivity.get() === target) activeActivity.clear()
            capture.settled = true; capture.activity = null
            if (capture.forgetWhenSettled) cleanupActivities.remove(operationID)
          }
          settled
        }
      }
    }
    fun forgetCleanupOperation(operationID: String) = synchronized(activityOwnershipLock) {
      unavailableCleanupActivities.remove(operationID)
      cleanupActivities[operationID]?.let { capture ->
        capture.forgetWhenSettled = true
        if (capture.settled) cleanupActivities.remove(operationID)
      }
      Unit
    }

    fun clearOwnedRuntimeForReset(): Boolean {
      val captured = synchronized(activityOwnershipLock) { activeActivity.get() }
      return FreedProtectionConfiguration.runOnMainForReset {
        synchronized(activityOwnershipLock) {
          // A delayed teardown owns only the activity captured before dispatch.
          if (activeActivity.get() !== captured) return@runOnMainForReset false
        }
        captured?.dismissForConfigurationReset()
        captured == null || captured.isFinishing || captured.isDestroyed
      }
    }
  }
  private var presentationEpoch = 0L
  private var companion: FreedNativeCompanion? = null
  private var hasOpenedRecovery = false
  private var renderedWebsiteInterventionId: String? = null

  override fun attachBaseContext(base: Context) {
    super.attachBaseContext(FreedNativeCopy.localizedContext(base))
  }

  override fun onResume() {
    super.onResume()
    if (!canPresentCurrentIntervention()) {
      dismissForConfigurationReset()
      return
    }
    companion?.startMotion()
  }
  override fun onPause() { companion?.stopMotion(); super.onPause() }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    synchronized(activityOwnershipLock) { presentationEpoch += 1L }
    if (!canPresentCurrentIntervention()) {
      dismissForConfigurationReset()
      return
    }
    synchronized(activityOwnershipLock) { activeActivity = WeakReference(this) }
    requestWindowFeature(Window.FEATURE_NO_TITLE)
    setFinishOnTouchOutside(false)

    setContentView(buildContentView())
    renderedWebsiteInterventionId = intent.getStringExtra(INTERVENTION_ID_EXTRA).takeIf { currentIntentIsWebsite() }
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    synchronized(activityOwnershipLock) { presentationEpoch += 1L }
    renderedWebsiteInterventionId = null
    setIntent(intent)
    hasOpenedRecovery = false
    if (!canPresentCurrentIntervention()) dismissForConfigurationReset()
    else {
      setContentView(buildContentView())
      renderedWebsiteInterventionId = this.intent.getStringExtra(INTERVENTION_ID_EXTRA).takeIf { currentIntentIsWebsite() }
    }
  }

  override fun onDestroy() {
    renderedWebsiteInterventionId = null
    super.onDestroy()
    synchronized(activityOwnershipLock) {
      if (activeActivity.get() === this) activeActivity.clear()
      cleanupActivities.values.filter { it.activity === this }.forEach { it.settled = true; it.activity = null }
      cleanupActivities.entries.removeAll { it.value.settled && it.value.forgetWhenSettled }
    }
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    // Back is a request to leave the barrier, never an implicit request to open FREED.
    runCatching { startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    finishCleanly()
  }

  private fun buildContentView(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(32), dp(24), dp(32))
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(FreedNativeCopy.color(this@FreedInterventionActivity, "#FAFAFB", "#101319"), FreedNativeCopy.color(this@FreedInterventionActivity, "#FAFAFB", "#101319"))
      )
    }

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24), dp(24), dp(24), dp(22))
      background = rounded(FreedNativeCopy.color(this@FreedInterventionActivity, "#FFFFFF", "#1D222B"), dp(22).toFloat())
    }

    val eyebrow = TextView(this).apply {
      text = FreedNativeCopy.text(this@FreedInterventionActivity, R.string.freed_intervention_eyebrow)
      setTextColor(FreedNativeCopy.color(this@FreedInterventionActivity, "#626977", "#B8C0D0"))
      textSize = 12f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }

    val title = TextView(this).apply {
      text = FreedNativeCopy.text(this@FreedInterventionActivity, R.string.freed_intervention_title)
      setTextColor(FreedNativeCopy.color(this@FreedInterventionActivity, "#141827", "#F5F6FA"))
      textSize = 26f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setLineSpacing(0f, 1.05f)
    }

    val timer = TextView(this).apply {
      text = FreedNativeCopy.text(this@FreedInterventionActivity, R.string.freed_intervention_breathe)
      setTextColor(FreedNativeCopy.color(this@FreedInterventionActivity, "#626977", "#B8C0D0"))
      textSize = 14f
      gravity = Gravity.CENTER
    }

    val button = Button(this).apply {
      text = FreedNativeCopy.text(this@FreedInterventionActivity, R.string.freed_start_recovery)
      setTextColor(FreedNativeCopy.color(this@FreedInterventionActivity, "#FFFFFF", "#141827"))
      textSize = 17f
      typeface = Typeface.DEFAULT_BOLD
      background = rounded(FreedNativeCopy.color(this@FreedInterventionActivity, "#414ACE", "#A1ADFF"), dp(18).toFloat())
      minHeight = dp(52)
      setOnClickListener { openRecoveryApp() }
    }

    val buddy = FreedNativeCompanion(this).also { companion = it }
    card.addView(buddy, LinearLayout.LayoutParams(dp(104), dp(104)).apply { bottomMargin = dp(16) })
    card.addView(eyebrow, layoutParams(match = true, top = 0))
    card.addView(title, layoutParams(match = true, top = dp(14)))
    card.addView(timer, layoutParams(match = true, top = dp(18)))
    card.addView(button, layoutParams(match = true, top = dp(20)))

    root.addView(card, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ))

    return ScrollView(this).apply {
      isFillViewport = true
      clipToPadding = false
      addView(root, android.widget.FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }
  }

  private fun currentIntentIsWebsite(): Boolean {
    return FreedWebsiteRecoveryHandoff.isWebsite(mapOf(
      FreedAccessibilityService.PENDING_SOURCE_PACKAGE to intent.getStringExtra("freed_intervention_source"),
      FreedAccessibilityService.PENDING_RULE to intent.getStringExtra("freed_intervention_rule")
    ))
  }

  private fun openRecoveryApp() {
    val website = currentIntentIsWebsite()
    val renderedWebsite = renderedWebsiteInterventionId != null &&
      renderedWebsiteInterventionId == intent.getStringExtra(INTERVENTION_ID_EXTRA)
    if (!FreedProtectionConfiguration.interceptionEnabled(this) ||
      (if (website) !renderedWebsite else !canPresentCurrentIntervention())) {
      dismissForConfigurationReset()
      return
    }
    if (hasOpenedRecovery) return
    hasOpenedRecovery = true

    packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
      launchIntent.action = Intent.ACTION_VIEW
      launchIntent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      )
      if (website) {
        // A previously validated rendering permits this explicit context-free choice, never stale private authority.
        launchIntent.data = Uri.parse("freed://guided-reset")
      } else {
        launchIntent.putExtra("freed_intervention_source", intent.getStringExtra("freed_intervention_source"))
        launchIntent.putExtra("freed_intervention_url", intent.getStringExtra("freed_intervention_url"))
        launchIntent.putExtra("freed_intervention_host", intent.getStringExtra("freed_intervention_host"))
        launchIntent.putExtra("freed_intervention_rule", intent.getStringExtra("freed_intervention_rule"))
        launchIntent.putExtra("freed_focus_shield_rule_id", intent.getStringExtra("freed_focus_shield_rule_id"))
      }
      startActivity(launchIntent)
    }

    finishCleanly()
  }

  private fun canPresentCurrentIntervention(): Boolean {
    val prefs = getSharedPreferences(FreedAccessibilityService.PREFS_NAME, MODE_PRIVATE)
    if (FreedWebsiteRecoveryHandoff.isWebsite(prefs.all) &&
      !FreedWebsiteRecoveryHandoff.current(this, prefs.all, intent.getStringExtra(INTERVENTION_ID_EXTRA))) return false
    return FreedInterventionHandoffPolicy.mayOpen(
      intent.getStringExtra(INTERVENTION_ID_EXTRA), prefs.getString(FreedAccessibilityService.PENDING_INTERVENTION_ID, null),
      intent.getStringExtra("freed_intervention_source"), prefs.getString(FreedAccessibilityService.PENDING_SOURCE_PACKAGE, null),
      intent.getStringExtra("freed_intervention_rule"), prefs.getString(FreedAccessibilityService.PENDING_RULE, null),
      prefs.getString(FreedAccessibilityService.PENDING_DETECTED_AT, null),
      intent.getLongExtra(FreedProtectionConfiguration.INTENT_EPOCH, -1L), FreedProtectionConfiguration.epoch(this),
      FreedProtectionConfiguration.interceptionEnabled(this)
    )
  }

  private fun dismissForConfigurationReset() {
    val originalPresentation = synchronized(activityOwnershipLock) { presentationEpoch }
    renderedWebsiteInterventionId = null
    companion?.stopMotion()
    companion = null
    hasOpenedRecovery = true
    setIntent(Intent())
    finish()
    if (isFinishing || isDestroyed) synchronized(activityOwnershipLock) {
      if (presentationEpoch == originalPresentation && activeActivity.get() === this) activeActivity.clear()
    }
  }

  private fun finishCleanly() {
    renderedWebsiteInterventionId = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      finishAndRemoveTask()
    } else {
      finish()
    }
  }

  private fun rounded(color: Int, radius: Float): GradientDrawable {
    return GradientDrawable().apply {
      setColor(color)
      cornerRadius = radius
    }
  }

  private fun layoutParams(match: Boolean, top: Int): LinearLayout.LayoutParams {
    val width = if (match) ViewGroup.LayoutParams.MATCH_PARENT else ViewGroup.LayoutParams.WRAP_CONTENT
    return LinearLayout.LayoutParams(width, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = top
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
