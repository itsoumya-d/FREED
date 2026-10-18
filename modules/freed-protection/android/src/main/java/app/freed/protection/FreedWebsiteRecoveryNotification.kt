package app.freed.protection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/** A manual recovery choice. No pending website receipt or app-break authority enters this intent. */
internal object FreedWebsiteRecoveryNotification {
  fun buildIntent(context: Context, launchIntent: Intent? = context.packageManager.getLaunchIntentForPackage(context.packageName)): Intent? {
    val component = launchIntent?.component ?: return null
    if (component.packageName != context.packageName || component.className != "app.freed.recovery.MainActivity" ||
      launchIntent.action != Intent.ACTION_MAIN ||
      launchIntent.`package`?.let { it != context.packageName } == true ||
      launchIntent.extras?.isEmpty == false || launchIntent.data != null ||
      launchIntent.selector != null || launchIntent.clipData != null) return null
    // Do not copy launch-template categories, flags, extras or other transport state.
    return Intent(Intent.ACTION_VIEW).apply {
      setComponent(component)
      setPackage(context.packageName)
      data = Uri.parse("freed://guided-reset")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
  }

  fun show(context: Context, channelId: String, notificationId: Int) {
    val intent = buildIntent(context) ?: return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(channelId,
        FreedNativeCopy.text(context, R.string.freed_recovery_channel), NotificationManager.IMPORTANCE_HIGH).apply {
        description = FreedNativeCopy.text(context, R.string.freed_browser_channel_description)
      })
    }
    val pending = PendingIntent.getActivity(context, notificationId, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val icon = context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_lock_lock
    val message = FreedNativeCopy.text(context, R.string.freed_accessibility_notification)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, channelId)
      else { @Suppress("DEPRECATION") Notification.Builder(context) }
    builder.setSmallIcon(icon)
      .setContentTitle(FreedNativeCopy.text(context, R.string.freed_recovery_channel))
      .setContentText(message)
      .setStyle(Notification.BigTextStyle().bigText(message))
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setCategory(Notification.CATEGORY_STATUS)
    @Suppress("DEPRECATION")
    builder.addAction(icon, FreedNativeCopy.text(context, R.string.freed_start_recovery), pending)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_HIGH)
    }
    // Permission/channel delivery failures remain failures at the existing producer runCatching boundary.
    manager.notify(notificationId, builder.build())
  }
}
