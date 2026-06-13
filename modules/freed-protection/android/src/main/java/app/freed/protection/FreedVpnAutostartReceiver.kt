package app.freed.protection

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class FreedVpnAutostartReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    when (intent?.action) {
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED -> FreedVpnService.restartAfterSystemEvent(context.applicationContext, intent.action)
    }
  }
}
