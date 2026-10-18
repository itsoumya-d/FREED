package app.freed.protection

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/** Unexported relay; accepts only a nonce already registered by this process's earned photo pipeline. */
internal class FreedEarnedChallengeCaptureActivity : Activity() {
  private var captureId: String? = null
  private var resultDelivered = false
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val id = intent?.getStringExtra("captureOperationId")
    if (!FreedEarnedChallengeProofPolicy.validId(id)) { finish(); return }
    captureId = id
    if (savedInstanceState != null) { if (!FreedEarnedChallengePhotoPipeline.ownsCamera(id!!)) finish(); return }
    val request = FreedEarnedChallengePhotoPipeline.cameraIntent(id!!) ?: run { finish(); return }
    runCatching { startActivityForResult(request, 9408) }.onFailure { deliver(false) }
  }
  @Deprecated("Native camera relay retains the platform result callback")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode == 9408) deliver(resultCode == RESULT_OK)
  }
  private fun deliver(accepted: Boolean) {
    if (!resultDelivered) { resultDelivered = true; captureId?.let { FreedEarnedChallengePhotoPipeline.cameraResult(it, accepted) } }
    finish()
  }
  override fun onDestroy() {
    if (!isChangingConfigurations && !resultDelivered) captureId?.let(FreedEarnedChallengePhotoPipeline::abandonCamera)
    super.onDestroy()
  }
}
