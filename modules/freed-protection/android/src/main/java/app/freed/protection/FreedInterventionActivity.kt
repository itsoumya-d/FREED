package app.freed.protection

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class FreedInterventionActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var hasOpenedRecovery = false

  private val openRecoveryRunnable = Runnable {
    openRecoveryApp()
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestWindowFeature(Window.FEATURE_NO_TITLE)
    setFinishOnTouchOutside(false)

    setContentView(buildContentView())
    handler.postDelayed(openRecoveryRunnable, 1_200)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    openRecoveryApp()
  }

  override fun onDestroy() {
    handler.removeCallbacks(openRecoveryRunnable)
    super.onDestroy()
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    openRecoveryApp()
  }

  private fun buildContentView(): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(24), dp(32), dp(24), dp(32))
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(Color.parseColor("#071613"), Color.parseColor("#10251F"))
      )
    }

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24), dp(24), dp(24), dp(22))
      background = rounded(Color.parseColor("#F8F1E5"), dp(22).toFloat())
    }

    val eyebrow = TextView(this).apply {
      text = "FREED PROTECTION"
      setTextColor(Color.parseColor("#53766C"))
      textSize = 12f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }

    val title = TextView(this).apply {
      text = "Hold on. You are still in control."
      setTextColor(Color.parseColor("#10251F"))
      textSize = 26f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setLineSpacing(0f, 1.05f)
    }

    val subtitle = TextView(this).apply {
      text = "FREED noticed a high-risk moment and is opening a recovery reset now."
      setTextColor(Color.parseColor("#36534B"))
      textSize = 16f
      gravity = Gravity.CENTER
      setLineSpacing(dp(2).toFloat(), 1f)
    }

    val timer = TextView(this).apply {
      text = "Breathe in. Breathe out."
      setTextColor(Color.parseColor("#53766C"))
      textSize = 14f
      gravity = Gravity.CENTER
    }

    val button = Button(this).apply {
      text = "Start recovery"
      setTextColor(Color.parseColor("#071613"))
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      background = rounded(Color.parseColor("#8FE3C8"), dp(18).toFloat())
      minHeight = dp(52)
      setOnClickListener { openRecoveryApp() }
    }

    card.addView(eyebrow, layoutParams(match = true, top = 0))
    card.addView(title, layoutParams(match = true, top = dp(14)))
    card.addView(subtitle, layoutParams(match = true, top = dp(14)))
    card.addView(timer, layoutParams(match = true, top = dp(18)))
    card.addView(button, layoutParams(match = true, top = dp(20)))

    root.addView(card, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ))

    return root
  }

  private fun openRecoveryApp() {
    if (hasOpenedRecovery) return
    hasOpenedRecovery = true
    handler.removeCallbacks(openRecoveryRunnable)

    packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
      launchIntent.action = Intent.ACTION_VIEW
      launchIntent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      )
      launchIntent.putExtra("freed_intervention_source", intent.getStringExtra("freed_intervention_source"))
      launchIntent.putExtra("freed_intervention_url", intent.getStringExtra("freed_intervention_url"))
      launchIntent.putExtra("freed_intervention_host", intent.getStringExtra("freed_intervention_host"))
      launchIntent.putExtra("freed_intervention_rule", intent.getStringExtra("freed_intervention_rule"))
      startActivity(launchIntent)
    }

    finishCleanly()
  }

  private fun finishCleanly() {
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
