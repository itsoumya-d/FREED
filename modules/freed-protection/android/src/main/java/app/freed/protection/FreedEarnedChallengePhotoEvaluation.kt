package app.freed.protection

/** Release gate is deliberately empty. A broad label map is never an accuracy evaluation. */
internal object FreedEarnedChallengePhotoEvaluation {
  val reviewedTargetIds: List<String> = emptyList()
  const val PROVIDER_REVISION = "bundled-mlkit:17.0.9:freed-photo-targets-v1"
  data class Report(val calibration: Boolean, val sampleCount: Int, val truePositive: Int, val falsePositive: Int, val falseNegative: Int,
    val providerRevision: String, val modelWeightsRevision: String?, val targetId: String)
  data class Result(val accepted: Boolean, val precision: Double, val recall: Double, val sampleCount: Int, val errors: Int)
  fun evaluate(report: Report): Result {
    val countsValid = report.sampleCount > 0 && report.truePositive >= 0 && report.falsePositive >= 0 && report.falseNegative >= 0 &&
      report.truePositive.toLong() + report.falsePositive + report.falseNegative <= report.sampleCount.toLong()
    val precision = if (report.truePositive + report.falsePositive > 0) report.truePositive.toDouble() / (report.truePositive + report.falsePositive) else 0.0
    val recall = if (report.truePositive + report.falseNegative > 0) report.truePositive.toDouble() / (report.truePositive + report.falseNegative) else 0.0
    return Result(countsValid && !report.calibration && report.providerRevision == PROVIDER_REVISION && !report.modelWeightsRevision.isNullOrBlank() &&
      report.targetId in FreedEarnedChallengeProofPolicy.targetCatalog && precision >= 0.95 && recall >= 0.85,
      precision, recall, report.sampleCount, report.falsePositive + report.falseNegative)
  }
}
