package app.freed.appleauth

class AppleAuthIdentityException(val code: String) : IllegalStateException("Apple identity confirmation failed")

/** No provider operation may replace the account that owns recovery purchases. */
object AppleAuthIdentityPolicy {
  @JvmStatic fun validateBefore(action: String, currentUid: String?, expectedUid: String?, anonymous: Boolean) {
    if (action == "sign-in") {
      if (currentUid != null) throw AppleAuthIdentityException("sign-out-required")
      return
    }
    if (currentUid == null || expectedUid.isNullOrBlank()) throw AppleAuthIdentityException("sign-in-required")
    if (currentUid != expectedUid) throw AppleAuthIdentityException("user-changed")
    if (action != "link" && anonymous) throw AppleAuthIdentityException("sign-in-required")
  }

  @JvmStatic fun validateAfter(expectedUid: String?, resultUid: String?, currentUid: String?) {
    if (resultUid.isNullOrBlank() || resultUid != currentUid || (expectedUid != null && resultUid != expectedUid)) {
      throw AppleAuthIdentityException("user-changed")
    }
  }
}
