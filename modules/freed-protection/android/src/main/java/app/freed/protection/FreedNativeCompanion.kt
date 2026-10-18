package app.freed.protection

import android.animation.ValueAnimator
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.ImageView
import android.widget.Toast

/** Bounded presentation motion only. It never represents protection or recovery health. */
class FreedNativeCompanion(context: Context) : ImageView(context) {
  private var active = false
  private var towardUp = true
  init {
    setImageResource(R.drawable.freed_momentum_companion)
    scaleType = ScaleType.FIT_CENTER
    isClickable = true
    isFocusable = true
    contentDescription = FreedNativeCopy.text(context, R.string.freed_companion_label)
    accessibilityDelegate = object : View.AccessibilityDelegate() {
      override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(host, info)
        info.className = "android.widget.Button"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) info.hintText = FreedNativeCopy.text(context, R.string.freed_companion_hint)
      }
    }
    setOnClickListener {
      performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
      Toast.makeText(context, FreedNativeCopy.text(context, R.string.freed_companion_hello), Toast.LENGTH_SHORT).show()
      if (motionAllowed()) {
        animate().cancel()
        animate().scaleX(1.04f).scaleY(1.04f).translationY(-dp(5f)).rotation(3f).setDuration(180).withEndAction {
          animate().scaleX(1f).scaleY(1f).translationY(0f).rotation(0f).setDuration(180).withEndAction { drift() }.start()
        }.start()
      }
    }
  }
  private fun dp(value: Float) = value * resources.displayMetrics.density
  private fun motionAllowed(): Boolean {
    val scale = runCatching { Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) }.getOrDefault(0f)
    return scale > 0f && (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ValueAnimator.areAnimatorsEnabled())
  }
  fun startMotion() { active = true; drift() }
  fun stopMotion() {
    active = false
    cancelMotion()
  }
  private fun cancelMotion() {
    animate().cancel()
    translationY = 0f; rotation = 0f; scaleX = 1f; scaleY = 1f
  }
  private fun drift() {
    if (!active || !isAttachedToWindow || windowVisibility != View.VISIBLE || !motionAllowed()) { cancelMotion(); return }
    towardUp = !towardUp
    animate().translationY(if (towardUp) -dp(3f) else 0f).rotation(if (towardUp) 1.5f else -1.5f)
      .setInterpolator(AccelerateDecelerateInterpolator()).setDuration(2200).withEndAction { drift() }.start()
  }
  override fun onAttachedToWindow() { super.onAttachedToWindow(); if (active) drift() }
  override fun onDetachedFromWindow() { stopMotion(); super.onDetachedFromWindow() }
  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    if (visibility == View.VISIBLE && active) drift() else cancelMotion()
  }
}
