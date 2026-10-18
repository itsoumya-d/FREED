package app.freed.appleauth

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues

class FreedAppleAuthModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FreedAppleAuth")
    AsyncFunction("signIn") { promise: Promise -> run("sign-in", null, promise) }.runOnQueue(Queues.MAIN)
    AsyncFunction("link") { expectedUid: String, promise: Promise -> run("link", expectedUid, promise) }.runOnQueue(Queues.MAIN)
    AsyncFunction("reauthenticate") { expectedUid: String, promise: Promise -> run("reauthenticate", expectedUid, promise) }.runOnQueue(Queues.MAIN)
    AsyncFunction("reauthenticateAndRevoke") { expectedUid: String, promise: Promise -> run("reauthenticate-and-revoke", expectedUid, promise) }.runOnQueue(Queues.MAIN)
  }

  private fun run(action: String, expectedUid: String?, promise: Promise) {
    AppleAuthBridge.run(appContext.currentActivity, action, expectedUid, object : AppleAuthBridge.Callback {
      override fun resolve(result: MutableMap<String, Any>) { promise.resolve(result) }
      override fun reject(code: String, message: String) { promise.reject(code, message, null) }
    })
  }
}
