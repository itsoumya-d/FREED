const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function check(id, condition, evidence) {
  return {
    id,
    status: condition ? "pass" : "fail",
    evidence
  };
}

function lacksAny(source, needles) {
  return needles.every((needle) => !source.includes(needle));
}

const androidManifest = read("modules/freed-protection/android/src/main/AndroidManifest.xml");
const appManifest = read("android/app/src/main/AndroidManifest.xml");
const vpnService = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnService.kt");
const vpnAutostartReceiver = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedVpnAutostartReceiver.kt");
const accessibilityService = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedAccessibilityService.kt");
const accessibilityServiceConfig = read("modules/freed-protection/android/src/main/res/xml/freed_accessibility_service.xml");
const interventionActivity = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedInterventionActivity.kt");
const androidAdultDomainFeed = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedAdultDomainFeed.kt");
const androidClassifier = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedUrlClassifier.kt");
const androidDoomscrollApps = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedDoomscrollApps.kt");
const doomscrollApps = read("src/lib/doomscroll-apps.ts");
const recoveryState = read("src/lib/recovery-state.ts");
const blockingEngine = read("src/lib/blocking-engine.ts");
const aiCoach = read("src/lib/ai-coach.ts");
const challengeGenerator = read("src/lib/challenge-generator.ts");
const androidModule = read("modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt");
const iosModule = read("modules/freed-protection/ios/FreedProtectionModule.swift");
const iosDeviceActivity = read("ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift");
const nativeIntervention = read("src/lib/native-intervention.ts");
const safariContentBlockerHandler = read("ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift");
const appSurface = read("src/features/freed-app.tsx");
const protectionPermissions = read("src/lib/protection-permissions.ts");
const safariContentBlockerList = read("ios/FREEDSafariContentBlocker/blockerList.json");
const safariFocusManifest = read("ios/FREEDSafariFocusShield/manifest.json");
const safariFocusContent = read("ios/FREEDSafariFocusShield/content.js");
const safariFocusBackground = read("ios/FREEDSafariFocusShield/background.js");
const adultFeedSync = read("src/lib/adult-domain-feed-sync.ts");
const adultFeedIngestion = read("src/lib/adult-domain-feed-ingestion.ts");
const adultFeedRoute = read("app/api/adult-domain-feed+api.ts");
const boundedResponseJson = read("src/lib/bounded-response-json.ts");
const shortFormWebContract = read("scripts/lib/short-form-web-contract.js");

const screenshotOrOcrRuntimeApis = [
  "MediaProjection",
  "AccessibilityService.ScreenshotResult",
  "takeScreenshot",
  "PixelCopy",
  "ScreenCapture",
  "ScreenCaptureKit",
  "VNRecognizeTextRequest",
  "TextRecognition",
  "TextRecognizer",
  "ImageAnalysis",
  "UIGraphicsImageRenderer"
];

const imageClassificationRuntimeApis = [
  "VNClassifyImageRequest",
  "ImageLabeling.getClient",
  "InputImage.fromFilePath",
  "classifyChallengePhoto"
];

const checks = [
  check(
    "android-no-overlay-permission",
    !androidManifest.includes("SYSTEM_ALERT_WINDOW") && !/SYSTEM_ALERT_WINDOW(?![^<]*tools:node="remove")/.test(appManifest),
    "Android native/app manifests do not request a draw-over-apps overlay permission."
  ),
  check(
    "android-dns-only-vpn",
    vpnService.includes(".addRoute(PRIMARY_DNS, 32)") &&
      vpnService.includes(".addRoute(SECONDARY_DNS, 32)") &&
      !vpnService.includes('.addRoute("0.0.0.0", 0)') &&
      !vpnService.includes('.addRoute("::", 0)'),
    "DNS-only VPN fallback routes only configured DNS resolver IPs instead of default-routing all traffic."
  ),
  check(
    "android-vpn-protected-upstream",
    vpnService.includes("protect(socket)") && vpnService.includes("DatagramSocket"),
    "DNS upstream socket is protected so DNS forwarding does not loop back through the VPN."
  ),
  check(
    "android-vpn-revocation-cleanup",
    vpnService.includes("override fun onRevoke()") &&
      vpnService.includes("stopDnsGuard(STOP_REASON_VPN_REVOKED)") &&
      vpnService.includes("stopSelf()") &&
      vpnService.includes("super.onRevoke()"),
    "DNS Guard explicitly tears down the foreground service and TUN descriptor when Android revokes VPN permission."
  ),
  check(
    "android-dns-resolver-failover",
    vpnService.includes("DNS_RESOLVERS = listOf(PRIMARY_DNS, SECONDARY_DNS)") &&
      vpnService.includes("for (resolver in DNS_RESOLVERS)") &&
      vpnService.includes("forwardDnsToResolver(dnsPayload, resolver)") &&
      vpnService.includes("lastForwardResolver") &&
      vpnService.includes("lastForwardFailure") &&
      vpnService.includes("buildServfailResponse(envelope.dnsPayload)") &&
      vpnService.includes("DNS_RCODE_SERVFAIL"),
    "DNS Guard tries both configured local resolver routes, returns a bounded SERVFAIL instead of letting allowed DNS hang, and exposes resolver diagnostics."
  ),
  check(
    "android-dns-malformed-servfail",
    vpnService.includes("parseDnsEnvelope(packet, readLength)") &&
      vpnService.includes("readDnsQuestionHost(envelope.dnsPayload)") &&
      vpnService.includes("dnsGuardMalformedPackets.incrementAndGet()") &&
      vpnService.includes("output.write(buildUdpResponsePacket(envelope, dnsResponse))") &&
      vpnService.includes("val questionEnd = findQuestionEnd(queryPayload) ?: DNS_HEADER_SIZE") &&
      vpnService.includes("if (questionEnd == DNS_HEADER_SIZE) writeShort(response, 4, 0)"),
    "Malformed DNS questions are counted and receive bounded SERVFAIL responses when the DNS envelope is available, avoiding silent client hangs."
  ),
  check(
    "android-dns-guard-lifecycle-diagnostics",
    vpnService.includes("dnsGuardUptimeMs") &&
      vpnService.includes("dnsGuardSessionQueries.incrementAndGet()") &&
      vpnService.includes("dnsGuardBlockedQueries.incrementAndGet()") &&
      vpnService.includes("dnsGuardAllowedQueries.incrementAndGet()") &&
      vpnService.includes("dnsGuardServfailResponses.incrementAndGet()") &&
      vpnService.includes("dnsGuardMalformedPackets.incrementAndGet()") &&
      vpnService.includes("STOP_REASON_VPN_REVOKED = \"vpn-revoked\"") &&
      vpnService.includes("STOP_REASON_LOOP_FAILED = \"dns-loop-failed\"") &&
      vpnService.includes("finishDnsGuardFromLoop(descriptor, stopReason)") &&
      androidModule.includes("dnsGuardUptimeMs") &&
      androidModule.includes("dnsGuardLastStopReason") &&
      androidModule.includes("dnsGuardSessionQueries") &&
      appSurface.includes("DNS Guard session:"),
    "DNS Guard exposes per-session query/blocked/allowed/SERVFAIL/malformed counters, uptime, stop reasons, and loop-exit cleanup for long-running physical-device QA without storing normal browsing hosts."
  ),
  check(
    "android-dns-block-intervention-notification",
    vpnService.includes("val normalizedHost = dnsInterventionHost(host, classification)") &&
      vpnService.includes("lastBlockedHost = normalizedHost") &&
      vpnService.includes("recordAndLaunchDnsIntervention(normalizedHost, classification)") &&
      vpnService.includes("FreedUrlClassifier.normalizeHostForStorage(result.host)") &&
      !vpnService.includes("lastBlockedHost = host") &&
      !vpnService.includes("recordAndLaunchDnsIntervention(host, classification)") &&
      vpnService.includes("showDnsInterventionNotification(host, redactedUrl, result.matchedRule)") &&
      vpnService.includes("INTERVENTION_NOTIFICATION_CHANNEL_ID") &&
      vpnService.includes("NotificationManager.IMPORTANCE_HIGH") &&
      vpnService.includes("FREED blocked an adult-domain request") &&
      vpnService.includes("buildDnsInterventionIntent(host, redactedUrl, matchedRule)") &&
      vpnService.includes('putExtra("freed_intervention_source", "android-dns")') &&
      vpnService.includes("startActivity(buildDnsInterventionIntent(host, redactedUrl, result.matchedRule))") &&
      !androidManifest.includes("SYSTEM_ALERT_WINDOW"),
    "DNS Guard posts a no-overlay recovery notification with the same redacted intervention handoff before attempting the immediate activity launch, so Android background-start restrictions still leave a visible challenge path."
  ),
  check(
    "android-accessibility-intervention-notification",
    accessibilityService.includes("showAccessibilityInterventionNotification(") &&
      accessibilityService.includes("buildAccessibilityInterventionIntent(") &&
      accessibilityService.includes("FREED recovery interventions") &&
      accessibilityService.includes("NotificationManager.IMPORTANCE_HIGH") &&
      accessibilityService.includes("No overlays, screenshots, or OCR are used.") &&
      accessibilityService.includes('putExtra("freed_intervention_rule", matchedRule)') &&
      accessibilityService.includes("runCatching { startActivity(intent) }") &&
      interventionActivity.includes('launchIntent.putExtra("freed_intervention_rule", intent.getStringExtra("freed_intervention_rule"))') &&
      !androidManifest.includes("SYSTEM_ALERT_WINDOW"),
    "Accessibility browser/WebView/app-limit handoffs post a no-overlay recovery notification with a redacted source and matched-rule handoff before attempting the Activity launch, preserving a visible challenge path without screenshots or OCR."
  ),
  check(
    "android-dns-guard-user-enabled-restart",
    androidManifest.includes("android.permission.RECEIVE_BOOT_COMPLETED") &&
      androidManifest.includes("FreedVpnAutostartReceiver") &&
      androidManifest.includes("android.intent.action.BOOT_COMPLETED") &&
      androidManifest.includes("android.intent.action.MY_PACKAGE_REPLACED") &&
      vpnAutostartReceiver.includes("Intent.ACTION_BOOT_COMPLETED") &&
      vpnAutostartReceiver.includes("Intent.ACTION_MY_PACKAGE_REPLACED") &&
      vpnAutostartReceiver.includes("FreedVpnService.restartAfterSystemEvent") &&
      vpnService.includes("PREF_DNS_GUARD_USER_ENABLED = \"dns_guard_user_enabled\"") &&
      vpnService.includes("ACTION_RESTORE = \"app.freed.protection.RESTORE_DNS_GUARD\"") &&
      vpnService.includes("VpnService.prepare(context) != null") &&
      vpnService.includes("recordAutoRestart(context, action, AUTO_RESTART_RESULT_STARTED, null)") &&
      vpnService.includes("setUserEnabled(this, false)") &&
      androidModule.includes("FreedVpnService.startUserEnabledGuard(context)") &&
      androidModule.includes("dnsGuardAutoRestartEligible") &&
      appSurface.includes("DNS Guard restart:"),
    "DNS Guard restart after boot/package update is gated by explicit user enablement and existing VPN consent, clears intent on manual stop/revoke, and exposes restart diagnostics for QA."
  ),
  check(
    "ios-no-network-extension",
    !iosModule.includes("import NetworkExtension") &&
      !iosModule.includes("NEDNSSettingsManager") &&
      !iosModule.includes("NEPacketTunnelProvider") &&
      !iosModule.includes("NETunnelProviderManager") &&
      !iosModule.includes("NEVPNManager"),
    "iOS protection uses Screen Time and Safari extensions without a stale NetworkExtension, packet-tunnel, or VPN-manager path."
  ),
  check(
    "ios-safari-short-form-web-rules",
    doomscrollApps.includes("SAFARI_SHORT_FORM_WEB_RULE_FILTERS") &&
      !blockingEngine.includes("export const SAFARI_SHORT_FORM_WEB_RULE_FILTERS = [") &&
      shortFormWebContract.includes("SHORT_FORM_WEB_SURFACES") &&
      shortFormWebContract.includes("isShortFormWebUrl") &&
      doomscrollApps.includes("youtube\\\\.com/shorts") &&
      doomscrollApps.includes("instagram\\\\.com/reel") &&
      doomscrollApps.includes("tiktok\\\\.com/foryou") &&
      !safariContentBlockerList.includes("youtube\\\\.com/shorts") &&
      !safariContentBlockerList.includes("instagram\\\\.com/reel") &&
      !safariContentBlockerList.includes("tiktok\\\\.com/foryou") &&
      safariFocusManifest.includes('\"strict_min_version\": \"15.4\"') &&
      safariFocusManifest.includes('\"service_worker\": \"background.js\"') &&
      safariFocusContent.includes("runtime?.sendMessage") &&
      !safariFocusContent.includes("sendNativeMessage") &&
      safariFocusBackground.includes("runtime.onMessage.addListener") &&
      safariFocusBackground.includes("sendNativeMessage") &&
      iosModule.includes("validateSafariContentBlockerRules") &&
      iosModule.includes("must use a block action") &&
      safariContentBlockerHandler.includes("validatedSharedRulesURL") &&
      safariContentBlockerHandler.includes("isValidBlockingRule") &&
      safariContentBlockerHandler.includes("rules.allSatisfy(isValidBlockingRule)") &&
      iosModule.includes("Short-form web paths are handled by Safari Focus Shield"),
    "Safari Focus Shield's iOS 15.4 MV3 background-worker contract relays approved short-form routes while the Content Blocker remains adult-domain-only."
  ),
  check(
    "android-accessibility-focused-scan",
    accessibilityService.includes("collectLikelyFocusedUrlText") &&
      accessibilityService.includes("isWebViewContext") &&
      accessibilityService.includes("node.isEditable || node.isFocused || node.isAccessibilityFocused") &&
      accessibilityService.includes("FreedUrlClassifier.classifyFocusedInput(candidate, adultDomainFeed)") &&
      accessibilityService.includes("shouldTrustEventText(packageName, event)") &&
      accessibilityService.includes("shouldCollectFocusedCandidateText(packageName, node, text)") &&
      accessibilityService.includes("sourceIsKnownBrowserUrlField(packageName, source)") &&
      accessibilityService.includes("nodeLooksLikeUrlOrSearchField(source)") &&
      accessibilityService.includes("looksLikeBoundedFocusedSearchText(text)") &&
      accessibilityService.includes("sourceHasUrlFieldSignal") &&
      accessibilityService.includes("nodeHasUrlFieldSignal") &&
      accessibilityService.includes("chromiumUrlFields") &&
      accessibilityService.includes("com.chrome.beta") &&
      accessibilityService.includes("com.microsoft.emmx.beta") &&
      accessibilityService.includes("com.sec.android.app.sbrowser.beta") &&
      androidClassifier.includes("focused-search.app.freed.local") &&
      androidClassifier.includes("focused-search-education:$explicitSearch") &&
      !accessibilityService.includes("if (looksLikeUrlOrSearch(text)) return true") &&
      !accessibilityService.includes("collectLikelyUrlText(root"),
    "Accessibility scanner is scoped to supported stable/beta browsers and focused WebView URL/search fields, including raw adult search text, instead of page-wide text scraping."
  ),
  check(
    "android-pending-url-redaction",
    vpnService.includes("FreedUrlClassifier.normalizeHostForStorage(result.host)") &&
      vpnService.includes("FreedUrlClassifier.normalizeHostForStorage(questionHost)") &&
      vpnService.includes('return fallbackHost.ifBlank { "redacted.freed.local" }') &&
      accessibilityService.includes("FreedUrlClassifier.normalizeHostForStorage(result.host)") &&
      accessibilityService.includes('val redactedUrl = "https://$host"') &&
      accessibilityService.includes(".putString(PENDING_HOST, host)") &&
      androidClassifier.includes("fun normalizeHostForStorage(input: String): String") &&
      androidClassifier.includes("sanitizeHostCandidate") &&
      androidModule.includes("sanitizedPendingHost") &&
      androidModule.includes("sanitizedPendingSourcePackage") &&
      nativeIntervention.includes("SUPPORTED_NATIVE_INTERVENTION_APP_PACKAGES") &&
      nativeIntervention.includes("supportedNativeAppPackageSet.has(normalized)") &&
      nativeIntervention.includes("appPackageForEarnedUnlockSource") &&
      nativeIntervention.includes("getActiveNativeEarnedUnlock") &&
      androidModule.includes("packageForShortFormRule(rawSource)") &&
      accessibilityService.includes("SUPPORTED_BLOCKED_APP_PACKAGES.contains(it)") &&
      nativeIntervention.includes('platform === "android"') &&
      nativeIntervention.includes('platform === "ios"') &&
      nativeIntervention.includes('IOS_SCREEN_TIME_SHIELD_HOST = "screen-time-shield.freed.local"') &&
      iosModule.includes("isScreenTimeUnlockSource") &&
      iosModule.includes("guard self.isScreenTimeUnlockSource(sourceAttemptHost) else") &&
      iosModule.includes("sanitizeHostForStorage(trimmed) == screenTimeShieldHost") &&
      iosModule.includes('earnedUnlockSourceKey = "freed.earnedUnlock.source"') &&
      iosModule.includes("set(self.screenTimeShieldHost, forKey: self.earnedUnlockSourceKey)") &&
      iosModule.includes("guard isScreenTimeUnlockSource(storedSource), let scope = activeEarnedUnlockScope(), isSelectedScreenTimeScope(scope) else") &&
      iosDeviceActivity.includes('earnedUnlockSourceKey = "freed.earnedUnlock.source"') &&
      iosDeviceActivity.includes("guard isScreenTimeUnlockSource(storedSource), let scope = activeEarnedUnlockScope(), isSelectedScreenTimeScope(scope) else") &&
      appSurface.includes("getActiveNativeEarnedUnlock(recoveryState.earnedUnlocks, Platform.OS") &&
      appSurface.includes("applyEarnedUnlockWindow(activeNativeUnlock.expiresAt, activeNativeUnlock.sourceAttemptHost)") &&
      nativeIntervention.includes('APP_INTERVENTION_FALLBACK_HOST = "selected-app.app.freed.local"') &&
      nativeIntervention.includes("configured-app:unsupported") &&
      nativeIntervention.includes("normalizePendingReason") &&
      !accessibilityService.includes(".putString(PENDING_URL, url)"),
    "Native Android handoff persists host-level redacted URLs and sanitized pending hosts/source packages, and the JS consumer only keeps allowlisted app unlock sources."
  ),
  check(
    "native-pending-intervention-expiry",
    appSurface.includes("isFreshPendingIntervention(pending)") &&
      androidModule.includes("PENDING_INTERVENTION_MAX_AGE_MS") &&
      androidModule.includes("isFreshPendingIntervention(detectedAt)") &&
      androidModule.includes("clearPendingInterventionPrefs(prefs)") &&
      iosModule.includes("pendingInterventionMaxAgeSeconds") &&
      iosModule.includes("self.isFreshPendingIntervention(record.detectedAt)") &&
      iosModule.includes("clearPendingInterventionDefaults()") &&
      iosModule.includes("sanitizedPendingHost") &&
      iosModule.includes("sanitizeHostForStorage") &&
      iosModule.includes('"url": "https://\\(host)"'),
    "Native and JS handoff paths expire stale or future-dated pending interventions before recovery UI opens, and iOS reads legacy pending values back as host-only redacted URLs."
  ),
  check(
    "android-accessibility-event-driven-app-shield",
    accessibilityService.includes("trackForegroundUsage(normalizedPackage)") &&
      accessibilityService.includes("currentDailyUsageMs") &&
      accessibilityService.includes("queryUsageStatsTodayMs") &&
      accessibilityService.includes("UsageStatsManager") &&
      accessibilityService.includes("AppOpsManager.OPSTR_GET_USAGE_STATS") &&
      accessibilityService.includes("maxOf(storedUsageMs + activeSessionMs, platformUsageMs)") &&
      accessibilityService.includes("ensureDailyUsageWindow") &&
      accessibilityService.includes("SystemClock.elapsedRealtime()") &&
      accessibilityService.includes("private val appLimitRunnable = Runnable") &&
      accessibilityService.includes("handler.postDelayed(appLimitRunnable") &&
      accessibilityService.includes("remainingMs.coerceIn(1_000L, 15 * 60_000L)") &&
      accessibilityService.includes("isEarnedUnlockActiveForPackage(packageName)") &&
      accessibilityService.includes("if (sourcePackage == null)") &&
      accessibilityService.includes("clearEarnedUnlockPrefs(prefs)") &&
      accessibilityService.includes("if (sourcePackage != normalizedPackage)") &&
      accessibilityService.includes("if (expiresAt == null)") &&
      accessibilityService.includes("if (expiryMs == null)") &&
      accessibilityService.includes("private val shortFormRunnable = Runnable") &&
      accessibilityService.includes("handler.postDelayed(shortFormRunnable") &&
      accessibilityService.includes("shortFormThresholdMs()") &&
      accessibilityService.includes("hasSelectedShortFormSurfaceSignal") &&
      accessibilityService.includes("requireSelectedSurfaceSignal && !hasSelectedShortFormSurfaceSignal(rule, event)") &&
      accessibilityService.includes("YOUTUBE_SHORTS_RULE -> packageName == YOUTUBE_PACKAGE && containsSelectedShortsNode(rootInActiveWindow, depth = 0)") &&
      accessibilityService.includes("INSTAGRAM_REELS_RULE -> packageName == INSTAGRAM_PACKAGE && containsSelectedReelsNode(rootInActiveWindow, depth = 0)") &&
      accessibilityService.includes("TIKTOK_FEED_RULE -> TIKTOK_PACKAGES.contains(packageName) && containsSelectedTikTokFeedNode(rootInActiveWindow, depth = 0)") &&
      !accessibilityService.includes("requireSurfaceSignal && !hasShortFormSurfaceSignal(rule, event)") &&
      accessibilityService.includes("private val earnedUnlockRelockRunnable = Runnable") &&
      accessibilityService.includes("handler.postDelayed(earnedUnlockRelockRunnable") &&
      accessibilityService.includes("MAX_EARNED_UNLOCK_MINUTES = 120") &&
      accessibilityService.includes("MAX_EARNED_UNLOCK_MINUTES * 60_000L") &&
      accessibilityService.includes("scheduleEarnedUnlockRelock") &&
      androidModule.includes("Earned unlock source is not a supported app") &&
      androidModule.includes("storedEarnedUnlockSourcePackage(prefs) == null") &&
      androidModule.includes("clearEarnedUnlockPrefs(context)") &&
      !accessibilityService.includes("unsafeCheckOpNoThrow") &&
      !androidModule.includes("unsafeCheckOpNoThrow") &&
      !accessibilityService.includes("Thread.sleep") &&
      !accessibilityService.includes("Timer(") &&
      !accessibilityService.includes("CountDownTimer") &&
      !accessibilityService.includes("while (true)"),
    "Android app-shield usage tracking is event-driven from Accessibility foreground changes, cross-checks user-enabled UsageStats totals for restart resilience, scopes earned unlocks to the package that earned them, gates YouTube/Instagram/TikTok short-form scroll cadence behind selected surface evidence, requires current selected Shorts/Reels/For You surface proof before the threshold timer can interrupt, and uses bounded native deadline timers for active app limits, sustained short-form thresholds, and earned-unlock relock."
  ),
  check(
    "android-supported-app-allowlist",
    androidModule.includes("SUPPORTED_BLOCKED_APP_PACKAGES") &&
      androidModule.includes("SUPPORTED_BLOCKED_APP_PACKAGES.contains(it)") &&
      androidModule.includes("SUPPORTED_BLOCKED_APP_PACKAGES.contains(normalizedHost)") &&
      androidModule.includes("FreedDoomscrollApps.packageForShortFormHost(normalizedHost)") &&
      accessibilityService.includes("FreedDoomscrollApps.shortFormHostForRule(rule)") &&
      androidDoomscrollApps.includes("SUPPORTED_BLOCKED_APP_PACKAGES") &&
      doomscrollApps.includes("SUPPORTED_DOOMSCROLL_APP_PACKAGES") &&
      doomscrollApps.includes("androidPackageAliases") &&
      doomscrollApps.includes("expandDoomscrollAppPackages") &&
      doomscrollApps.includes("primaryDoomscrollPackageBySupportedPackage") &&
      doomscrollApps.includes("surfaceForDoomscrollAppPackage") &&
      doomscrollApps.includes("SHORT_FORM_RULE_PACKAGES") &&
      doomscrollApps.includes("SHORT_FORM_RULE_HOSTS") &&
      doomscrollApps.includes("hostForShortFormRule") &&
      doomscrollApps.includes("packageForShortFormRule") &&
      nativeIntervention.includes("SUPPORTED_DOOMSCROLL_APP_PACKAGES") &&
      nativeIntervention.includes("SHORT_FORM_RULE_HOSTS") &&
      nativeIntervention.includes("hostForShortFormRule") &&
      nativeIntervention.includes("packageForShortFormRule") &&
      recoveryState.includes("expandDoomscrollAppPackages") &&
      androidModule.includes('removePrefix("configured-app:")') &&
      androidDoomscrollApps.includes('"com.google.android.youtube"') &&
      androidDoomscrollApps.includes('"com.instagram.android"') &&
      androidDoomscrollApps.includes('"com.ss.android.ugc.trill"') &&
      androidDoomscrollApps.includes('"com.tiktok"') &&
      androidDoomscrollApps.includes('"com.reddit.frontpage"'),
    "Native app-shield configuration rejects arbitrary package names, JS expands selected supported app aliases for native sync, and only supported doomscroll packages persist."
  ),
  check(
    "android-usage-stats-bridge",
    androidManifest.includes("android.permission.PACKAGE_USAGE_STATS") &&
      androidModule.includes("UsageStatsManager") &&
      androidModule.includes("AppOpsManager.OPSTR_GET_USAGE_STATS") &&
      androidModule.includes("Settings.ACTION_USAGE_ACCESS_SETTINGS") &&
      androidModule.includes("queryUsageStats") &&
      accessibilityService.includes("queryUsageStatsTodayMs") &&
      androidModule.includes("usageStatsAuthorized") &&
      androidModule.includes("usageStatsObservedPackageNames") &&
      androidModule.includes("usageStatsTodayMinutes") &&
      androidModule.includes("usageStatsTodayMinutesByPackage"),
    "Android exposes a user-enabled Usage Access bridge for aggregate selected-app timer checks and package-level QA diagnostics without reading in-app content."
  ),
  check(
    "android-short-form-heuristics-are-event-driven",
    accessibilityService.includes("shortFormRuleForEvent") &&
      androidDoomscrollApps.includes("short-form:youtube-shorts") &&
      androidDoomscrollApps.includes("short-form:instagram-reels") &&
      androidDoomscrollApps.includes("short-form:tiktok-feed") &&
      accessibilityServiceConfig.includes("typeViewScrolled") &&
      accessibilityService.includes("AccessibilityEvent.TYPE_VIEW_SCROLLED") &&
      accessibilityService.includes("MIN_SHORT_FORM_SCROLL_EVENTS") &&
      accessibilityService.includes("SHORT_FORM_SCROLL_WINDOW_MS") &&
      accessibilityService.includes("requireSelectedSurfaceSignal") &&
      accessibilityService.includes("hasSelectedShortFormSurfaceSignal") &&
      accessibilityService.includes("requireSelectedSurfaceSignal && !hasSelectedShortFormSurfaceSignal(rule, event)") &&
      !accessibilityService.includes("requireSurfaceSignal && !hasShortFormSurfaceSignal(rule, event)") &&
      accessibilityService.includes("hasShortFormSurfaceSignal") &&
      accessibilityService.includes("shortFormLabelSignals") &&
      accessibilityService.includes("shortFormViewIdSignals") &&
      accessibilityService.includes("containsSelectedShortsNode") &&
      accessibilityService.includes("containsSelectedReelsNode") &&
      accessibilityService.includes("containsSelectedTikTokFeedNode") &&
      accessibilityService.includes("YOUTUBE_SHORTS_RULE -> packageName == YOUTUBE_PACKAGE && containsSelectedShortsNode(rootInActiveWindow, depth = 0)") &&
      accessibilityService.includes("INSTAGRAM_REELS_RULE -> packageName == INSTAGRAM_PACKAGE && containsSelectedReelsNode(rootInActiveWindow, depth = 0)") &&
      accessibilityService.includes("TIKTOK_FEED_RULE -> TIKTOK_PACKAGES.contains(packageName) && containsSelectedTikTokFeedNode(rootInActiveWindow, depth = 0)") &&
      accessibilityService.includes("isSustainedShortFormScroll(packageName, TIKTOK_FEED_RULE, event, requireSelectedSurfaceSignal = true)") &&
      !accessibilityService.includes("Thread.sleep") &&
      !accessibilityService.includes("while (true)"),
    "Short-form detection covers opted-in YouTube Shorts, Instagram Reels, and TikTok For You through selected labels plus subscribed scroll-cadence events, with all scroll thresholds gated by selected surface evidence, current selected Shorts/Reels/For You confirmation at the deadline, and no polling."
  ),
  check(
    "android-private-dns-diagnostics",
    androidModule.includes('"private_dns_mode"') &&
      androidModule.includes('"private_dns_specifier"') &&
      androidModule.includes("privateDnsMode") &&
      androidModule.includes('AsyncFunction("openPrivateDnsSettings"') &&
      androidModule.includes("Settings.ACTION_WIRELESS_SETTINGS") &&
      androidModule.includes("Strict Private DNS is enabled") &&
      androidModule.includes("dnsGuardLastResolver") &&
      androidModule.includes("dnsGuardLastForwardFailure") &&
      appSurface.includes("Review Private DNS") &&
      appSurface.includes("openPrivateDnsSettings"),
    "Android status exposes Private DNS mode/specifier, DNS Guard resolver diagnostics, and a guided Network settings path for physical-device QA."
  ),
  check(
    "android-native-domain-feed-sync",
    androidAdultDomainFeed.includes("object FreedAdultDomainFeed") &&
      androidAdultDomainFeed.includes("MAX_DOMAINS = 50_000") &&
      androidAdultDomainFeed.includes("cachedRawDomains") &&
      androidAdultDomainFeed.includes("cachedDomains") &&
      accessibilityService.includes("FreedAdultDomainFeed.domains(this)") &&
      vpnService.includes('FreedUrlClassifier.classify("https://${host}", FreedAdultDomainFeed.domains(this))') &&
      androidModule.includes('AsyncFunction("configureAdultDomainFeed"') &&
      androidModule.includes("adultDomainFeedDomainCount") &&
      androidModule.includes("statusPayloadWithAndroidDiagnostics") &&
      androidModule.includes('putIfMissing("adultDomainFeedDomainCount", FreedAdultDomainFeed.domainCount(context))') &&
      androidModule.includes('putIfMissing("dnsGuardResolverCount", FreedVpnService.DNS_RESOLVERS.size)') &&
      adultFeedSync.includes("If-None-Match") &&
      adultFeedSync.includes("remote-cache") &&
      adultFeedSync.includes("nativeAlreadySynced") &&
      adultFeedSync.includes("getConditionalAdultFeedChecksumForStatus") &&
      adultFeedSync.includes("safariCanBePrimaryLayer") &&
      adultFeedSync.includes("safariLayerExpected") &&
      adultFeedSync.includes("minimumSafariRuleCount") &&
      adultFeedSync.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_SYNC_TIMEOUT_MS") &&
      adultFeedSync.includes("EXPO_PUBLIC_ADULT_DOMAIN_FEED_RESPONSE_MAX_BYTES") &&
      adultFeedSync.includes("fetchRemoteFeedPayload") &&
      adultFeedSync.includes("readBoundedResponseJson") &&
      adultFeedSync.includes('label: "Adult domain feed response"') &&
      boundedResponseJson.includes("responseTooLargeError") &&
      adultFeedSync.includes("Adult domain feed sync timed out") &&
      adultFeedIngestion.includes("resolveCachedAdultDomainFeed") &&
      adultFeedIngestion.includes("FREED_ADULT_DOMAIN_FEED_CACHE_TTL_SECONDS") &&
      adultFeedIngestion.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_TIMEOUT_MS") &&
      adultFeedIngestion.includes("FREED_ADULT_DOMAIN_FEED_SOURCE_MAX_BYTES") &&
      adultFeedIngestion.includes("readResponseTextWithByteLimit") &&
      adultFeedIngestion.includes("adult-domain-feed-source-too-large") &&
      adultFeedIngestion.includes("fetchSourceTextWithTimeout") &&
      adultFeedIngestion.includes("stale-if-error") &&
      adultFeedRoute.includes("X-FREED-Adult-Feed-Cache") &&
      adultFeedRoute.includes("X-FREED-Adult-Feed-Source-Max-Bytes"),
    "Android Accessibility and DNS Guard read a cached synced adult-domain feed, native action responses preserve feed/DNS diagnostics, app startup uses timeout- and byte-bounded checksum/304 incremental sync only after required native/Safari layers are populated, and the server feed route reuses timeout- and byte-bounded reviewed source ingestion instead of rebuilding or downgrading on every unchanged sync."
  ),
  check(
    "local-state-url-redaction",
    recoveryState.includes("redactUrlForStorage(attempt.url)") && blockingEngine.includes("redactUrlForStorage"),
    "Recovery state redacts blocked attempts to host-level URLs before persistence."
  ),
  check(
    "ai-redaction-boundary",
    aiCoach.includes("redactCoachText") &&
      aiCoach.includes("recentRiskHosts") &&
      !challengeGenerator.includes("url") &&
      !challengeGenerator.includes("host"),
    "AI coach requests redact user text and send host-level risk summaries instead of raw browsing history."
  ),
  check(
    "no-native-polling-loop",
    !accessibilityService.includes("while (true)") &&
      !accessibilityService.includes("Thread.sleep") &&
      !accessibilityService.includes("Timer(") &&
      !accessibilityService.includes("CountDownTimer") &&
      accessibilityService.includes("scheduleAppLimitCheck") &&
      accessibilityService.includes("scheduleEarnedUnlockRelock") &&
      !vpnService.includes("Thread.sleep") &&
      !vpnService.includes("Timer("),
    "Native protection does not use broad polling loops or timer-based URL scanning; Android timers are bounded deadline checks for app limits, sustained short-form sessions, and earned-unlock relock."
  ),
  check(
    "runtime-no-continuous-screenshot-or-ocr",
    lacksAny(accessibilityService, screenshotOrOcrRuntimeApis) &&
      lacksAny(androidModule, screenshotOrOcrRuntimeApis) &&
      lacksAny(iosModule, screenshotOrOcrRuntimeApis) &&
      lacksAny(appSurface, [
        "captureRef",
        "takeSnapshotAsync",
        "MediaProjection",
        "ScreenCapture",
        "TextRecognition",
        "TextRecognizer",
        "VNRecognizeTextRequest"
      ]) &&
      appSurface.includes("ImagePicker.launchCameraAsync") &&
      appSurface.includes("base64: false") &&
      appSurface.includes("exif: false") &&
      appSurface.includes("deleteTemporaryChallengePhoto(photoUri)") &&
      protectionPermissions.includes("No continuous camera, image classification, screenshot, OCR, or background location analysis is used"),
    "Runtime protection avoids screenshot/OCR/screen-capture APIs; challenge photo capture is on-demand only, without base64/exif capture and with best-effort temporary-photo cleanup."
  ),
  check(
    "runtime-no-continuous-image-classification",
    lacksAny(accessibilityService, imageClassificationRuntimeApis) &&
      lacksAny(vpnService, imageClassificationRuntimeApis) &&
      lacksAny(iosDeviceActivity, imageClassificationRuntimeApis) &&
      lacksAny(safariContentBlockerHandler, imageClassificationRuntimeApis) &&
      appSurface.includes("const capturePhoto = React.useCallback(async () =>") &&
      appSurface.includes("ImagePicker.launchCameraAsync") &&
      appSurface.includes("classifyChallengePhoto(photoUri, expectedLabels)") &&
      appSurface.includes("deleteTemporaryChallengePhoto(photoUri)") &&
      iosModule.includes("VNClassifyImageRequest") &&
      iosModule.includes('AsyncFunction("classifyChallengePhoto"') &&
      androidModule.includes("ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS)") &&
      androidModule.includes('AsyncFunction("classifyChallengePhoto"') &&
      androidModule.includes("Tasks.await(labeler.process(image), 8, TimeUnit.SECONDS)") &&
      protectionPermissions.includes("continuous image classification"),
    "On-device image classification is reachable only through explicit photo challenge submission; Accessibility, DNS Guard, DeviceActivity, and Safari blocker protection paths do not run Vision/ML Kit loops."
  ),
  check(
    "typed-foreground-service",
    androidManifest.includes("FOREGROUND_SERVICE_SPECIAL_USE") &&
      androidManifest.includes('android:foregroundServiceType="specialUse"') &&
      androidManifest.includes("PROPERTY_SPECIAL_USE_FGS_SUBTYPE"),
    "DNS fallback service is explicitly typed for foreground-service review."
  ),
  check(
    "native-handoff-task-cleanup",
    androidManifest.includes('android:noHistory="true"') &&
      androidManifest.includes('android:excludeFromRecents="true"') &&
      interventionActivity.includes("setFinishOnTouchOutside(false)") &&
      interventionActivity.includes("finishAndRemoveTask()"),
    "Native handoff screen is no-history, excluded from recents, non-dismissible by outside touch, and removes its task after launching recovery."
  )
];

const failed = checks.filter((entry) => entry.status === "fail");

console.log("# FREED performance safety audit");
console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
