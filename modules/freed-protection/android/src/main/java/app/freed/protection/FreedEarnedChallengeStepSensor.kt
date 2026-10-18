package app.freed.protection

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/** Native observations only. Each activation establishes a new counter baseline. */
internal class FreedEarnedChallengeStepSensor(private val context: Context, private val observe: (Long) -> Unit) : SensorEventListener {
  companion object {
    private fun manager(context: Context) = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private fun sensor(context: Context) = manager(context)?.let { it.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: it.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) }
    fun supported(context: Context): Boolean = runCatching { sensor(context) != null }.getOrDefault(false)
    fun permitted(context: Context): Boolean = Build.VERSION.SDK_INT < 29 || context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
  }
  private var manager: SensorManager? = null
  private var registeredSensor: Sensor? = null
  private var baseline: Long? = null
  private var lastTimestamp = 0L
  private var activationFloor = 0L
  fun start(): Boolean {
    stop()
    if (!permitted(context)) return false
    return runCatching {
      val service = manager(context) ?: return false
      val selected = sensor(context) ?: return false
      manager = service; registeredSensor = selected; activationFloor = SystemClock.elapsedRealtimeNanos()
      service.registerListener(this, selected, SensorManager.SENSOR_DELAY_NORMAL, Handler(Looper.getMainLooper())).also { if (!it) stop() }
    }.getOrElse { stop(); false }
  }
  fun stop() { manager?.unregisterListener(this); manager = null; registeredSensor = null; baseline = null; lastTimestamp = 0L }
  override fun onSensorChanged(event: SensorEvent) {
    val selected = registeredSensor ?: return
    if (!permitted(context) || event.sensor.type != selected.type || event.timestamp < activationFloor || event.timestamp <= lastTimestamp) return
    val raw = event.values.firstOrNull()?.toDouble() ?: return
    if (!raw.isFinite() || raw < 0 || raw % 1.0 != 0.0 || raw > Long.MAX_VALUE.toDouble()) return
    lastTimestamp = event.timestamp
    if (selected.type == Sensor.TYPE_STEP_DETECTOR) { if (raw == 1.0) observe(1L); return }
    val current = raw.toLong(); val previous = baseline
    baseline = current
    if (previous != null && current >= previous) observe(current - previous)
  }
  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
}
