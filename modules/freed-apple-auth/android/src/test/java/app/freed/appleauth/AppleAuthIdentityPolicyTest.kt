package app.freed.appleauth

import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Test

class AppleAuthIdentityPolicyTest {
  @Test fun signInCannotReplaceAnExistingGuestOrPermanentAccount() {
    for (anonymous in listOf(true, false)) {
      assertFailure("sign-out-required") { AppleAuthIdentityPolicy.validateBefore("sign-in", "owner", null, anonymous) }
    }
    AppleAuthIdentityPolicy.validateBefore("sign-in", null, null, false)
  }

  @Test fun linkRequiresTheExpectedOwner() {
    AppleAuthIdentityPolicy.validateBefore("link", "owner", "owner", true)
    assertFailure("user-changed") { AppleAuthIdentityPolicy.validateBefore("link", "other", "owner", true) }
  }

  @Test fun reauthenticationRequiresAPermanentAccount() {
    assertFailure("sign-in-required") { AppleAuthIdentityPolicy.validateBefore("reauthenticate", "owner", "owner", true) }
    AppleAuthIdentityPolicy.validateBefore("reauthenticate", "owner", "owner", false)
  }

  @Test fun pendingResultMustRetainBothExpectedAndCurrentUid() {
    AppleAuthIdentityPolicy.validateAfter("owner", "owner", "owner")
    assertFailure("user-changed") { AppleAuthIdentityPolicy.validateAfter("owner", "other", "other") }
    assertFailure("user-changed") { AppleAuthIdentityPolicy.validateAfter("owner", "owner", null) }
    AppleAuthIdentityPolicy.validateAfter(null, "new-owner", "new-owner")
  }

  private fun assertFailure(code: String, action: () -> Unit) {
    try { action(); fail("Expected identity protection failure") }
    catch (error: AppleAuthIdentityException) { assertEquals(code, error.code) }
  }
}
