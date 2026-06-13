# Performance Profile Capture: performance-profile-current

This folder contains a profiling plan, optional device metadata, and a manual QA matrix. It does not satisfy release evidence by itself.

Required threshold proof:

- durationMinutes >= 30
- 0 <= batteryDrainPercent <= 8
- 0 < maxResidentMemoryMb <= 350
- 0 < maxDeviceTemperatureC <= 42
- 0 < dnsLatencyP95Ms <= 100
- backgroundCpuPercent <= 5
- downloadMbpsDuring >= 80% of downloadMbpsBefore
- noForegroundPollingLoopObserved=true
- noFullTrafficProxyConfirmed=true with routingProofArtifact reviewed
- noPacketInspectionConfirmed=true and noMitmHttpsConfirmed=true with routingProofArtifact reviewed
- noContinuousScreenshotOrOcrConfirmed=true with profiler/log proof
- noContinuousImageClassificationConfirmed=true with profiler/log proof that Vision/ML Kit runs only on demand for challenge submissions
- Android only: DNS resolver failover proof, bounded SERVFAIL fallback proof, and VPN revocation cleanup proof

Helper-captured fields:

- Android routing proof is captured automatically for physical Android runs as local `freed-routing-proof-report-v1` JSON plus supporting proxy, Private DNS, VPN, and route diagnostics.
- Add `--android-background-cpu-proof` to sample package-specific `dumpsys cpuinfo`; if parsing succeeds, the Android row is prefilled with the raw artifact and maximum sampled CPU percent for QA review.
- Attach network-speed and DNS-latency report artifacts with `sanitized=true` for each platform; numeric speed/latency values without the matching artifact are rejected.
- `performance-profile-evidence-fill-template.json` mirrors the final evidence shape with concrete run IDs, optional helper-captured routing/background-CPU artifacts, and false checks until real QA fills the profiler, DNS, speed, and routing proof.

Manual capture checklist:

- performance-profile-current-ios-performance-profile: Run a 60+ minute physical-device profiler session with FREED protection enabled. Suggested artifact: `profile.platformProfiles.ios.profilerArtifact`. Metric: `profile.platformProfiles.ios.durationMinutes/maxResidentMemoryMb/maxDeviceTemperatureC/batteryDrainPercent`.
- performance-profile-current-ios-background-cpu: Capture idle and normal-browsing background CPU proof; threshold is 5% or less. Suggested artifact: `profile.platformProfiles.ios.backgroundCpuArtifact`. Metric: `profile.platformProfiles.ios.backgroundCpuPercent`.
- performance-profile-current-ios-polling-loop-review: Attach profiler/log proof that FREED is not running a foreground polling loop, continuous screenshot/OCR analysis, or continuous image-classification loop. Suggested artifact: `profile.platformProfiles.ios.profilerArtifact`. Metric: `profile.platformProfiles.ios.noForegroundPollingLoopObserved/noContinuousScreenshotOrOcrConfirmed/noContinuousImageClassificationConfirmed`.
- performance-profile-current-ios-proxy-routing-review: Attach routing proof that normal traffic is not sent through a full-traffic proxy, packet-inspected tunnel, or MITM HTTPS path. Suggested artifact: `profile.platformProfiles.ios.routingProofArtifact`. Metric: `profile.platformProfiles.ios.noFullTrafficProxyConfirmed/noPacketInspectionConfirmed/noMitmHttpsConfirmed`.
- performance-profile-current-ios-network-speed: Measure download speed before and during protection while loading https://youtube.com/results?search_query=workout. Suggested artifact: `profile.platformProfiles.ios.networkSpeedArtifact`. Metric: `profile.platformProfiles.ios.downloadMbpsBefore/downloadMbpsDuring`.
- performance-profile-current-ios-dns-latency: Measure DNS p95 latency while protection is active. Suggested artifact: `profile.platformProfiles.ios.dnsLatencyArtifact`. Metric: `profile.platformProfiles.ios.dnsLatencyP95Ms`.
- performance-profile-current-android-performance-profile: Run a 60+ minute physical-device profiler session with FREED protection enabled. Suggested artifact: `profile.platformProfiles.android.profilerArtifact`. Metric: `profile.platformProfiles.android.durationMinutes/maxResidentMemoryMb/maxDeviceTemperatureC/batteryDrainPercent`.
- performance-profile-current-android-background-cpu: Capture idle and normal-browsing background CPU proof; threshold is 5% or less. Suggested artifact: `profile.platformProfiles.android.backgroundCpuArtifact`. Metric: `profile.platformProfiles.android.backgroundCpuPercent`.
- performance-profile-current-android-polling-loop-review: Attach profiler/log proof that FREED is not running a foreground polling loop, continuous screenshot/OCR analysis, or continuous image-classification loop. Suggested artifact: `profile.platformProfiles.android.profilerArtifact`. Metric: `profile.platformProfiles.android.noForegroundPollingLoopObserved/noContinuousScreenshotOrOcrConfirmed/noContinuousImageClassificationConfirmed`.
- performance-profile-current-android-proxy-routing-review: Attach routing proof that normal traffic is not sent through a full-traffic proxy, packet-inspected tunnel, or MITM HTTPS path. Suggested artifact: `profile.platformProfiles.android.routingProofArtifact`. Metric: `profile.platformProfiles.android.noFullTrafficProxyConfirmed/noPacketInspectionConfirmed/noMitmHttpsConfirmed`.
- performance-profile-current-android-network-speed: Measure download speed before and during protection while loading https://youtube.com/results?search_query=workout. Suggested artifact: `profile.platformProfiles.android.networkSpeedArtifact`. Metric: `profile.platformProfiles.android.downloadMbpsBefore/downloadMbpsDuring`.
- performance-profile-current-android-dns-latency: Measure DNS p95 latency while protection is active. Suggested artifact: `profile.platformProfiles.android.dnsLatencyArtifact`. Metric: `profile.platformProfiles.android.dnsLatencyP95Ms`.
- performance-profile-current-android-dns-resolver-failover: Disable or blackhole the primary DNS route and prove DNS Guard fails over to the secondary resolver. Suggested artifact: `profile.platformProfiles.android.dnsResolverFailoverArtifact`. Metric: `profile.platformProfiles.android.dnsResolverFailoverRunId`.
- performance-profile-current-android-dns-servfail: Blackhole all configured DNS resolvers and prove allowed DNS receives bounded SERVFAIL instead of hanging silently. Suggested artifact: `profile.platformProfiles.android.dnsServfailArtifact`. Metric: `profile.platformProfiles.android.dnsServfailFallbackConfirmed`.
- performance-profile-current-android-vpn-revocation: Revoke Android VPN permission or replace the active VPN slot and prove FREED cleans up foreground-service and TUN state. Suggested artifact: `profile.platformProfiles.android.vpnRevocationArtifact`. Metric: `profile.platformProfiles.android.vpnRevocationCleanupConfirmed`.

After the real profiler/network run, fill `performance-profile.json`, validate the draft with `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence`, then promote only if every threshold passes.

