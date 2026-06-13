package app.freed.protection

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class FreedUsageAccessConfigActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    requestWindowFeature(Window.FEATURE_NO_TITLE)
    setContentView(buildContentView())
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
      background = rounded(Color.parseColor("#F8F1E5"), dp(18).toFloat())
    }

    val eyebrow = TextView(this).apply {
      text = "FREED USAGE ACCESS"
      setTextColor(Color.parseColor("#53766C"))
      textSize = 12f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
    }

    val title = TextView(this).apply {
      text = "Usage Access stays limited to app timers."
      setTextColor(Color.parseColor("#10251F"))
      textSize = 24f
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setLineSpacing(0f, 1.05f)
    }

    val subtitle = TextView(this).apply {
      text = getString(R.string.freed_usage_access_reason)
      setTextColor(Color.parseColor("#36534B"))
      textSize = 16f
      gravity = Gravity.CENTER
      setLineSpacing(dp(2).toFloat(), 1f)
    }

    val note = TextView(this).apply {
      text = "Usage Access is controlled by Android Settings. After enabling FREED, return to setup so the activation test can verify protection."
      setTextColor(Color.parseColor("#53766C"))
      textSize = 14f
      gravity = Gravity.CENTER
      setLineSpacing(dp(2).toFloat(), 1f)
    }

    val button = Button(this).apply {
      text = "Return to FREED setup"
      setTextColor(Color.parseColor("#071613"))
      textSize = 16f
      typeface = Typeface.DEFAULT_BOLD
      background = rounded(Color.parseColor("#8FE3C8"), dp(18).toFloat())
      minHeight = dp(52)
      setOnClickListener { openFreedSetup() }
    }

    val backButton = Button(this).apply {
      text = "Back to Android Settings"
      setTextColor(Color.parseColor("#36534B"))
      textSize = 15f
      background = rounded(Color.TRANSPARENT, dp(18).toFloat()).apply {
        setStroke(dp(1), Color.parseColor("#53766C"))
      }
      minHeight = dp(48)
      setOnClickListener { finishCleanly() }
    }

    card.addView(eyebrow, layoutParams(match = true, top = 0))
    card.addView(title, layoutParams(match = true, top = dp(14)))
    card.addView(subtitle, layoutParams(match = true, top = dp(14)))
    card.addView(note, layoutParams(match = true, top = dp(18)))
    card.addView(button, layoutParams(match = true, top = dp(22)))
    card.addView(backButton, layoutParams(match = true, top = dp(12)))

    root.addView(card, LinearLayout.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT
    ))

    return root
  }

  private fun openFreedSetup() {
    val returnIntent = Intent(Intent.ACTION_VIEW, Uri.parse("freed://protection-setup?source=usage-access-config")).apply {
      setPackage(packageName)
      addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      )
      putExtra("freed_open_protection_setup", true)
      putExtra("freed_settings_return_source", "usage-access-config")
    }

    val openedDeepLink = runCatching {
      startActivity(returnIntent)
    }.isSuccess
    if (openedDeepLink) {
      finishCleanly()
      return
    }

    packageManager.getLaunchIntentForPackage(packageName)?.let { launchIntent ->
      launchIntent.action = Intent.ACTION_VIEW
      launchIntent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      )
      launchIntent.putExtra("freed_open_protection_setup", true)
      launchIntent.putExtra("freed_settings_return_source", "usage-access-config")
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
