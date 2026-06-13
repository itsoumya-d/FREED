# AI Backend Smoke Capture: ai-backend-smoke-current

This folder contains a deployed-AI QA plan. It does not satisfy release evidence by itself.

Never store these fields in evidence:

- rawPrompt
- rawPrompts
- rawUserInput
- rawUserMessage
- rawCoachRequest
- rawChallengeRequest
- rawRetentionRequest
- rawModelResponse
- rawCoachResponse
- rawChallengeResponse
- rawRetentionResponse
- rawRetentionPlan
- promptText
- userText
- privateNotes
- slipNote
- fullConversation
- conversationTranscript
- sensitiveUrl
- sensitiveDomain
- latitude
- longitude
- rawLocation
- preciseLocation
- apiKey
- openaiApiKey
- geminiApiKey
- providerApiKey

Manual capture checklist:

- ai-backend-smoke-current-release-env-preflight: Run npm run preflight:release-env and attach the passing command log. Suggested artifact: `ai.releasePreflightArtifact`. Metrics: `ai.releasePreflightCommand, ai.releasePreflightRunId, checks.releaseEnvPreflightPassed`.
- ai-backend-smoke-current-ai-safety-eval: Run npm run eval:ai-safety and attach the safety report with zero failures. Suggested artifact: `ai.safetyEvalArtifact`. Metrics: `ai.safetyEvalCommand, ai.safetyEvalCaseCount, ai.safetyEvalFailedCount`.
- ai-backend-smoke-current-ai-backend-smoke: Run npm run smoke:ai-backend with --report docs/validation/artifacts/ai-backend-smoke-current/ai-backend-smoke-report.json against deployed CLARA and challenge endpoints, attach that local ai-backend-smoke-v1 JSON report with sanitized=true, contractProof as ai.smokeReportArtifact, but keep ai.smokeCommand in the sanctioned command shape. Suggested artifact: `ai.smokeReportArtifact`. Metrics: `ai.smokeCommand, ai.smokeEndpointPassCount, ai.smokeEndpointFailCount`.
- ai-backend-smoke-current-coach-smoke: Attach redacted CLARA smoke proof for a normal support request. Suggested artifact: `ai.coachSmokeArtifact`. Metrics: `ai.coachSmokeRunId`.
- ai-backend-smoke-current-challenge-smoke: Attach redacted challenge-generation smoke proof. Suggested artifact: `ai.challengeSmokeArtifact`. Metrics: `ai.challengeSmokeRunId`.
- ai-backend-smoke-current-challenge-personalization: Prove at least two context-rich profile shapes, including weather/location-permission, aggregate urge-risk forecast, coarse session-duration bucket, aggregate recent failed-reset count, zero coordinate fields, and zero premium-only challenges for a free profile. Suggested artifact: `ai.challengePersonalizationArtifact`. Metrics: `ai.challengePersonalizationProfileCount, ai.challengeRiskForecastProfileCount, ai.challengeSessionDurationBucketProfileCount, ai.challengeRecentFailureProfileCount, ai.freeChallengePremiumCount, checks.riskForecastPersonalizationVerified, checks.sessionDurationBucketPersonalizationVerified, checks.recentFailureCountPersonalizationVerified`.
- ai-backend-smoke-current-no-coordinate-fields: Attach sanitized proof that challenge personalization requests/responses contain context signals but no latitude or longitude fields. Suggested artifact: `ai.noCoordinateFieldsArtifact`. Metrics: `ai.noCoordinateFieldsRunId, checks.noCoordinateFields`.
- ai-backend-smoke-current-no-sensitive-echo: Attach at least two redacted samples proving no sensitive URL/domain/private-note echo. Suggested artifact: `ai.noSensitiveEchoArtifact`. Metrics: `ai.noSensitiveEchoSampleCount`.
- ai-backend-smoke-current-redaction-report: Attach provider response redaction report with only sanitized excerpts or aggregate findings. Suggested artifact: `ai.redactionArtifact`. Metrics: `ai.redactionReportId`.
- ai-backend-smoke-current-crisis-fallback: Prove crisis/self-harm language routes to immediate safe support behavior. Suggested artifact: `ai.crisisFallbackArtifact`. Metrics: `ai.crisisFallbackRunId`.
- ai-backend-smoke-current-provider-fallback: Prove provider outage or missing-provider mode falls back to safe local support. Suggested artifact: `ai.providerFallbackArtifact`. Metrics: `ai.providerFallbackRunId`.

`ai-backend-smoke-evidence-fill-template.json` mirrors the final evidence shape with configured non-secret endpoint, model, and command context. It intentionally leaves artifacts/counts blank and checks false until real deployed-endpoint QA fills them.

After the real deployed-endpoint smoke runs, fill `ai-backend-smoke.json`, validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence`, then promote only after every proof artifact exists and contains sanitized data.

