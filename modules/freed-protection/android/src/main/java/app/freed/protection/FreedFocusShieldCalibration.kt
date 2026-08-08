package app.freed.protection

import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.util.Locale

internal const val CALIBRATION_TIMEOUT_MS = 5 * 60_000L

internal data class FreedFocusShieldCalibrationRequest(
  val ruleId: String,
  val packageName: String,
  val displayLabel: String
) {
  companion object {
    fun fromPayload(value: Map<String, Any?>): FreedFocusShieldCalibrationRequest? {
      val ruleId = sanitizeIdentifier(value["ruleId"] as? String, 128, RULE_ID_CHARACTERS)
        ?.takeIf { it.length >= 6 }
        ?: return null
      val packageName = (value["packageName"] as? String)
        ?.trim()
        ?.lowercase(Locale.US)
        ?.takeIf { it.matches(PACKAGE_NAME_PATTERN) }
        ?: return null
      val displayLabel = (value["displayLabel"] as? String)
        ?.replace(Regex("\\s+"), " ")
        ?.trim()
        ?.take(80)
        ?.takeIf(String::isNotBlank)
        ?: "Calibrated surface"
      return FreedFocusShieldCalibrationRequest(ruleId, packageName, displayLabel)
    }

    private fun sanitizeIdentifier(value: String?, maxLength: Int, allowed: Regex): String? {
      val sanitized = value
        ?.trim()
        ?.filter { character -> allowed.matches(character.toString()) }
        ?.take(maxLength)
        .orEmpty()
      return sanitized.ifBlank { null }
    }

    private val RULE_ID_CHARACTERS = Regex("[a-zA-Z0-9_.-]")
    private val PACKAGE_NAME_PATTERN = Regex("^[a-z][a-z0-9_]*(\\.[a-z0-9_]+)+$")
  }
}

internal data class FreedFocusShieldCalibrationResult(
  val state: String,
  val message: String,
  val rule: Map<String, Any>? = null
) {
  fun toPayload(): Map<String, Any> {
    return mutableMapOf<String, Any>(
      "state" to state,
      "message" to message.take(240)
    ).apply {
      rule?.let { put("rule", it) }
    }
  }
}

internal object FreedFocusShieldCalibrationBridge {
  private data class AttachmentSnapshot(
    val service: FreedAccessibilityService?,
    val ownerEpoch: Long
  )

  private val serviceReferenceLock = Any()
  private val handler = Handler(Looper.getMainLooper())
  private var serviceReference = WeakReference<FreedAccessibilityService>(null)
  private var focusShieldCalibrationAttachmentEpoch = 0L

  @Volatile
  private var latestResult = FreedFocusShieldCalibrationResult(
    state = "idle",
    message = "Focus Shield calibration is not running."
  )

  fun attach(service: FreedAccessibilityService) {
    val previousOwner = synchronized(serviceReferenceLock) {
      val previousService = serviceReference.get()
      val previousOwnerEpoch = focusShieldCalibrationAttachmentEpoch
      focusShieldCalibrationAttachmentEpoch += 1
      val ownerEpoch = focusShieldCalibrationAttachmentEpoch
      service.updateFocusShieldCalibrationOwner(ownerEpoch)
      serviceReference = WeakReference(service)
      previousService?.let { it to previousOwnerEpoch }
    }
    previousOwner?.let { (previousService, previousOwnerEpoch) ->
      previousService.invalidateFocusShieldCalibrationOwner(previousOwnerEpoch)
    }
  }

  fun detach(service: FreedAccessibilityService, state: String, message: String) {
    val detachedEpochs = synchronized(serviceReferenceLock) {
      if (serviceReference.get() !== service) return
      val previousOwnerEpoch = focusShieldCalibrationAttachmentEpoch
      focusShieldCalibrationAttachmentEpoch += 1
      serviceReference.clear()
      previousOwnerEpoch to focusShieldCalibrationAttachmentEpoch
    }
    service.invalidateFocusShieldCalibrationOwner(detachedEpochs.first)
    publishWithoutOwner(
      FreedFocusShieldCalibrationResult(state, message),
      detachedEpochs.second
    )
  }

  fun start(value: Map<String, Any?>): Map<String, Any> {
    val request = FreedFocusShieldCalibrationRequest.fromPayload(value)
      ?: return failStart("Focus Shield calibration needs a valid local rule ID and Android package.")
    val initial = FreedFocusShieldCalibrationResult(
      state = "calibrating",
      message = "Open the selected app, then tap the temporary FREED edge handle."
    )
    val unavailable = FreedFocusShieldCalibrationResult(
      state = "unavailable",
      message = "Enable FREED Accessibility protection before starting calibration."
    )
    val owner = attachmentSnapshot()
    val service = owner.service
    if (service == null) {
      publishWithoutOwner(unavailable, owner.ownerEpoch)
      return unavailable.toPayload()
    }
    service.beginFocusShieldCalibration(request, owner.ownerEpoch)
    return initial.toPayload()
  }

  fun failStart(message: String): Map<String, Any> {
    val result = FreedFocusShieldCalibrationResult("failed", message)
    val owner = attachmentSnapshot()
    owner.service?.stopFocusShieldCalibration("failed", message, owner.ownerEpoch)
      ?: publishWithoutOwner(result, owner.ownerEpoch)
    return result.toPayload()
  }

  fun cancel(): Map<String, Any> {
    val result = FreedFocusShieldCalibrationResult(
      "cancelled",
      "Focus Shield calibration was cancelled."
    )
    val owner = attachmentSnapshot()
    owner.service?.stopFocusShieldCalibration(result.state, result.message, owner.ownerEpoch)
      ?: publishWithoutOwner(result, owner.ownerEpoch)
    return result.toPayload()
  }

  fun permissionRevoked(): Map<String, Any> {
    val message = "Accessibility permission was revoked, so calibration stopped and no selector was stored."
    val result = FreedFocusShieldCalibrationResult("revoked-permission", message)
    val detachedOwner = synchronized(serviceReferenceLock) {
      val previousService = serviceReference.get()
      val previousOwnerEpoch = focusShieldCalibrationAttachmentEpoch
      focusShieldCalibrationAttachmentEpoch += 1
      serviceReference.clear()
      Triple(previousService, previousOwnerEpoch, focusShieldCalibrationAttachmentEpoch)
    }
    detachedOwner.first?.invalidateFocusShieldCalibrationOwner(detachedOwner.second)
    publishWithoutOwner(result, detachedOwner.third)
    return result.toPayload()
  }

  fun get(): Map<String, Any> = latestResult.toPayload()

  fun isCurrentOwner(service: FreedAccessibilityService, ownerEpoch: Long): Boolean {
    return synchronized(serviceReferenceLock) {
      serviceReference.get() === service &&
        focusShieldCalibrationAttachmentEpoch == ownerEpoch
    }
  }

  fun publish(
    service: FreedAccessibilityService,
    ownerEpoch: Long,
    result: FreedFocusShieldCalibrationResult
  ): Boolean {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      handler.post { publish(service, ownerEpoch, result) }
      return false
    }
    return synchronized(serviceReferenceLock) {
      if (
        serviceReference.get() !== service ||
        focusShieldCalibrationAttachmentEpoch != ownerEpoch
      ) {
        false
      } else {
        latestResult = result
        true
      }
    }
  }

  private fun attachmentSnapshot(): AttachmentSnapshot {
    return synchronized(serviceReferenceLock) {
      AttachmentSnapshot(serviceReference.get(), focusShieldCalibrationAttachmentEpoch)
    }
  }

  private fun publishWithoutOwner(
    result: FreedFocusShieldCalibrationResult,
    expectedAttachmentEpoch: Long
  ) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      handler.post { publishWithoutOwner(result, expectedAttachmentEpoch) }
      return
    }
    synchronized(serviceReferenceLock) {
      if (
        serviceReference.get() == null &&
        focusShieldCalibrationAttachmentEpoch == expectedAttachmentEpoch
      ) {
        latestResult = result
      }
    }
  }
}

internal class FreedFocusShieldCalibrationSession(
  private val service: FreedAccessibilityService,
  private val request: FreedFocusShieldCalibrationRequest,
  private val onFinished: (FreedFocusShieldCalibrationSession, FreedFocusShieldCalibrationResult) -> Unit
) {
  private data class Candidate(
    val viewId: String,
    val role: String,
    val ancestorRoles: List<String>,
    val bounds: Rect
  )

  private val handler = Handler(Looper.getMainLooper())
  private val windowManager = service.getSystemService(WindowManager::class.java)
  private var handleView: View? = null
  private var selectorView: FrameLayout? = null
  private var highlightView: View? = null
  private var statusView: TextView? = null
  private var confirmButton: Button? = null
  private var candidate: Candidate? = null
  private var targetObserved = false
  private var disposed = false
  private val timeoutRunnable = Runnable {
    finish(
      state = "timeout",
      message = "Calibration timed out after five minutes. No selector was stored; retry or choose a vetted preset."
    )
  }

  fun start() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      handler.post(::start)
      return
    }
    if (disposed) return
    try {
      if (!showEdgeHandle()) return
      handler.postDelayed(timeoutRunnable, CALIBRATION_TIMEOUT_MS)
    } catch (_: Exception) {
      finish(
        state = "failed",
        message = "The temporary Accessibility overlay could not be created. No selector was stored."
      )
    }
  }

  fun onAccessibilityEvent(event: AccessibilityEvent, packageName: String?) {
    if (disposed) return
    val isWindowTransition =
      event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED ||
        event.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED
    if (packageName == request.packageName) {
      targetObserved = true
      if (!isWindowTransition) return
    }
    if (!targetObserved) return
    if (isCalibrationOverlayEvent(event)) return
    if (!isWindowTransition) return
    val activePackage = activeForegroundApplicationPackage(event) ?: return
    if (activePackage == request.packageName) return
    finish(
      state = "app-switched",
      message = "Calibration stopped because the selected app was left. No selector was stored."
    )
  }

  private fun isCalibrationOverlayEvent(event: AccessibilityEvent): Boolean {
    if (event.packageName?.toString() != service.packageName || event.windowId < 0) return false
    return service.windows.orEmpty().any { window ->
      window.id == event.windowId && window.type == AccessibilityWindowInfo.TYPE_ACCESSIBILITY_OVERLAY
    }
  }

  private fun activeForegroundApplicationPackage(event: AccessibilityEvent): String? {
    val applicationWindows = service.windows.orEmpty().filter { window ->
      window.type == AccessibilityWindowInfo.TYPE_APPLICATION && (window.isActive || window.isFocused)
    }
    val activeWindow = applicationWindows.firstOrNull { window -> window.id == event.windowId }
      ?: applicationWindows.firstOrNull()
      ?: return null
    return activeWindow.root?.packageName?.toString()?.trim()?.lowercase(Locale.US)
  }

  fun finish(state: String, message: String) {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      handler.post { finish(state, message) }
      return
    }
    if (disposed) return
    disposed = true
    handler.removeCallbacks(timeoutRunnable)
    removeOverlays()
    candidate = null
    onFinished(this, FreedFocusShieldCalibrationResult(state, message))
  }

  fun disposeWithoutResult() {
    if (Looper.myLooper() != Looper.getMainLooper()) {
      handler.post(::disposeWithoutResult)
      return
    }
    if (disposed) return
    disposed = true
    handler.removeCallbacks(timeoutRunnable)
    removeOverlays()
    candidate = null
  }

  private fun showEdgeHandle(): Boolean {
    val handle = Button(service).apply {
      text = "FREED"
      setTextColor(Color.WHITE)
      textSize = 12f
      setPadding(dp(12), dp(10), dp(12), dp(10))
      background = roundedBackground(Color.rgb(37, 99, 235), dp(18).toFloat())
      setOnClickListener { showSelectorOverlay() }
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.END or Gravity.CENTER_VERTICAL
      x = dp(4)
    }
    handleView = handle
    if (!addOverlayView(handle, params)) return false
    return true
  }

  private fun showSelectorOverlay() {
    if (disposed) return
    val rootNode = service.rootInActiveWindow
    if (rootNode == null || rootNode.packageName?.toString()?.lowercase(Locale.US) != request.packageName) {
      finish(
        state = "unsupported-tree",
        message = "The selected app did not expose a usable Accessibility tree. Retry there or choose a vetted preset."
      )
      return
    }
    targetObserved = true

    removeView(handleView)
    handleView = null

    val overlay = FrameLayout(service).apply {
      setBackgroundColor(Color.argb(38, 15, 23, 42))
      isClickable = true
      setOnTouchListener { _, event ->
        if (event.action == MotionEvent.ACTION_UP) {
          selectCandidate(event.rawX.toInt(), event.rawY.toInt())
        }
        true
      }
    }

    val status = TextView(service).apply {
      text = "Tap the surface to calibrate. Only its stable view fingerprint stays on this device."
      setTextColor(Color.WHITE)
      textSize = 14f
      setPadding(dp(16), dp(12), dp(16), dp(12))
      background = roundedBackground(Color.rgb(15, 23, 42), dp(12).toFloat())
    }
    overlay.addView(
      status,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.TOP
      ).apply { setMargins(dp(16), dp(24), dp(16), 0) }
    )
    statusView = status

    val controls = LinearLayout(service).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(dp(12), dp(10), dp(12), dp(10))
      background = roundedBackground(Color.rgb(15, 23, 42), dp(14).toFloat())
    }
    val cancelButton = Button(service).apply {
      text = "Cancel"
      setOnClickListener {
        finish("cancelled", "Focus Shield calibration was cancelled. No selector was stored.")
      }
    }
    val confirm = Button(service).apply {
      text = "Confirm"
      isEnabled = false
      setOnClickListener { confirmCandidate() }
    }
    controls.addView(cancelButton)
    controls.addView(confirm)
    overlay.addView(
      controls,
      FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.WRAP_CONTENT,
        FrameLayout.LayoutParams.WRAP_CONTENT,
        Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      ).apply { bottomMargin = dp(24) }
    )
    confirmButton = confirm

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply { gravity = Gravity.TOP or Gravity.START }
    selectorView = overlay
    if (!addOverlayView(overlay, params)) return
  }

  private fun addOverlayView(view: View, params: WindowManager.LayoutParams): Boolean {
    return try {
      windowManager.addView(view, params)
      true
    } catch (_: Exception) {
      finish(
        state = "failed",
        message = "The temporary Accessibility overlay could not be created. No selector was stored."
      )
      false
    }
  }

  private fun selectCandidate(x: Int, y: Int) {
    if (disposed) return
    val rootNode = service.rootInActiveWindow
    if (rootNode == null || rootNode.packageName?.toString()?.lowercase(Locale.US) != request.packageName) {
      finish(
        state = "unsupported-tree",
        message = "The active app no longer exposes a usable Accessibility tree. No selector was stored."
      )
      return
    }
    targetObserved = true

    val selected = hitTest(rootNode, x, y, emptyList())
    if (selected == null) {
      finish(
        state = "unsupported-tree",
        message = "That target has no allowlisted resource ID, role, and ancestor roles. Retry or choose a vetted preset."
      )
      return
    }

    candidate = selected
    showHighlight(selected.bounds)
    confirmButton?.isEnabled = true
    statusView?.text = "Stable local selector found. Confirm to save it, or cancel to discard it."
    onFinished(
      this,
      FreedFocusShieldCalibrationResult(
        state = "ready",
        message = "A stable selector is highlighted and waiting for explicit confirmation."
      )
    )
  }

  private fun hitTest(
    node: AccessibilityNodeInfo,
    x: Int,
    y: Int,
    ancestorRoles: List<String>
  ): Candidate? {
    val bounds = Rect()
    node.getBoundsInScreen(bounds)
    if (!bounds.contains(x, y)) return null

    val role = node.className?.toString()?.trim().orEmpty()
    val nextAncestors = if (role.isBlank()) ancestorRoles else (ancestorRoles + role).takeLast(8)
    for (index in node.childCount - 1 downTo 0) {
      val child = node.getChild(index) ?: continue
      hitTest(child, x, y, nextAncestors)?.let { return it }
    }

    val viewId = node.viewIdResourceName?.trim().orEmpty()
    val allowedForPackage = allowedViewIds[request.packageName].orEmpty()
    if (viewId.isBlank() || viewId !in allowedForPackage || role.isBlank() || ancestorRoles.isEmpty()) return null
    return Candidate(viewId, role, ancestorRoles.distinct().takeLast(8), Rect(bounds))
  }

  private fun showHighlight(bounds: Rect) {
    val overlay = selectorView ?: return
    highlightView?.let(overlay::removeView)
    val highlight = View(service).apply {
      background = GradientDrawable().apply {
        setColor(Color.argb(30, 34, 197, 94))
        setStroke(dp(3), Color.rgb(34, 197, 94))
        cornerRadius = dp(10).toFloat()
      }
    }
    overlay.addView(
      highlight,
      FrameLayout.LayoutParams(bounds.width().coerceAtLeast(1), bounds.height().coerceAtLeast(1)).apply {
        leftMargin = bounds.left
        topMargin = bounds.top
      }
    )
    highlightView = highlight
  }

  private fun confirmCandidate() {
    val selected = candidate ?: return
    val metrics = service.resources.displayMetrics
    val screenWidth = metrics.widthPixels.coerceAtLeast(1)
    val screenHeight = metrics.heightPixels.coerceAtLeast(1)
    val left = selected.bounds.left.coerceIn(0, screenWidth).toDouble() / screenWidth
    val top = selected.bounds.top.coerceIn(0, screenHeight).toDouble() / screenHeight
    val right = selected.bounds.right.coerceIn(0, screenWidth).toDouble() / screenWidth
    val bottom = selected.bounds.bottom.coerceIn(0, screenHeight).toDouble() / screenHeight
    val selector = mapOf(
      "packageName" to request.packageName,
      "viewId" to selected.viewId,
      "role" to selected.role,
      "ancestorRoles" to selected.ancestorRoles,
      "normalizedBounds" to mapOf(
        "x" to left,
        "y" to top,
        "width" to (right - left),
        "height" to (bottom - top)
      )
    )
    val storedRule = FreedFocusShieldRules.configure(
      service,
      mapOf(
        "version" to 1,
        "id" to request.ruleId,
        "packageName" to request.packageName,
        "displayLabel" to request.displayLabel,
        "kind" to "custom",
        "enabled" to true,
        "selector" to selector
      )
    )
    if (storedRule == null) {
      finish(
        state = "unsupported-tree",
        message = "The selector did not pass local safety checks. Nothing was stored; retry or choose a vetted preset."
      )
      return
    }

    disposed = true
    handler.removeCallbacks(timeoutRunnable)
    removeOverlays()
    candidate = null
    onFinished(
      this,
      FreedFocusShieldCalibrationResult(
        state = "success",
        message = "Selector saved locally. Current immediate enforcement remains limited to vetted presets.",
        rule = storedRule.toPayload()
      )
    )
  }

  private fun removeOverlays() {
    removeView(handleView)
    removeView(selectorView)
    handleView = null
    selectorView = null
    highlightView = null
    statusView = null
    confirmButton = null
  }

  private fun removeView(view: View?) {
    if (view == null || !view.isAttachedToWindow) return
    try {
      windowManager.removeViewImmediate(view)
    } catch (_: Exception) {
      // The Accessibility service may already be detaching its window token.
    }
  }

  private fun roundedBackground(color: Int, radius: Float): GradientDrawable {
    return GradientDrawable().apply {
      setColor(color)
      cornerRadius = radius
    }
  }

  private fun dp(value: Int): Int {
    return (value * service.resources.displayMetrics.density).toInt()
  }

  companion object {
    private val allowedViewIds = mapOf(
      "com.google.android.youtube" to setOf("com.google.android.youtube:id/reel_player"),
      "com.instagram.android" to setOf("com.instagram.android:id/clips_viewer"),
      "com.zhiliaoapp.musically" to setOf("com.zhiliaoapp.musically:id/pager")
    )
  }
}
